// A headless Chrome we can hand a URL to.
//
// Chrome is NOT launched by this process directly. The backend runs as root
// under pm2, and Chrome refuses to enable its own sandbox when it is root —
// the usual answer is --no-sandbox, which throws away the layer that contains
// a compromised renderer. Since this is the one feature that loads hostile
// third-party pages, that is the wrong trade.
//
// Instead Chrome runs as the unprivileged `ddrender` user with its sandbox
// intact, spawned through setpriv, and we talk to it over the DevTools socket.
// One long-lived browser, a fresh isolated context per request.

const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const { isRequestAllowed } = require('./ssrfGuard');

const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';
const PROFILE_ROOT = process.env.CHROME_PROFILE || '/var/lib/ddrender';
// The backend runs as a pm2 CLUSTER — two processes. Chrome locks its profile
// directory, so the second instance to try was refused outright (exit 21) and
// every capture that landed on it failed while the other worked. One profile
// per instance, keyed by pm2's instance id and falling back to the pid.
const INSTANCE = process.env.NODE_APP_INSTANCE ?? process.env.pm_id ?? String(process.pid);
const PROFILE = `${PROFILE_ROOT}/inst-${INSTANCE}`;
const RENDER_USER = process.env.CHROME_USER || 'ddrender';
const NAV_TIMEOUT = 25_000;
// How long we let a page keep fetching after the document is there. Bounded on
// purpose: this is a courtesy to images and fonts, not a condition for success.
const SETTLE_TIMEOUT = 8_000;
const RENDER_TIMEOUT = 45_000;
const MAX_BYTES = 40 * 1024 * 1024; // stop a page that tries to stream us a film

// The two ways someone wants to see a page, and the widths that produce them.
const VIEWS = {
  desktop: {
    width: 1280, height: 1696, isMobile: false, touch: false,
    ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 DiemDesk/1.0 (+https://diemdesk.com)',
  },
  mobile: {
    width: 390, height: 844, isMobile: true, touch: true,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 DiemDesk/1.0 (+https://diemdesk.com)',
  },
};

// Paper widths in CSS pixels at 96dpi, which is the unit Chrome lays print out
// in. Used to work out how much to shrink a wide layout so it fits the sheet.
const PAPER_PX = {
  A4: { portrait: 794, landscape: 1123 },
  Letter: { portrait: 816, landscape: 1056 },
  Legal: { portrait: 816, landscape: 1344 },
  A3: { portrait: 1123, landscape: 1587 },
};
const MARGIN_PX = 76;      // the 10mm side margins, both sides, at 96dpi
const MAX_PAGE_PX = 19_000; // PDF caps a page at 200in; stay inside it

let browserPromise = null;
let child = null;

function chromeArgs(port) {
  return [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${PROFILE}`,
    '--disable-gpu',
    '--disable-dev-shm-usage',      // /dev/shm is small on a VPS; without this Chrome dies mid-render
    '--disable-background-networking',
    '--disable-sync',
    '--disable-extensions',
    '--disable-default-apps',
    '--no-first-run',
    '--no-default-browser-check',
    '--mute-audio',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--disable-features=Translate,MediaRouter',
    // Nothing we render should ever reach a file, and nothing should be
    // downloaded to the box.
    '--disable-file-system',
    '--window-size=1280,1696',
  ];
}

/** Spawn Chrome as ddrender and resolve the ws:// endpoint it prints. */
function spawnChrome() {
  return new Promise((resolve, reject) => {
    // port 0 lets the OS pick, so two deploys can never fight over one port.
    // setpriv changes the user but NOT the environment, so without this Chrome
    // inherits HOME=/root, cannot write there, and spends its startup failing
    // to create config directories it is not allowed to touch.
    const proc = spawn('setpriv', [
      '--reuid', RENDER_USER, '--regid', RENDER_USER, '--init-groups',
      '--', CHROME, ...chromeArgs(0),
    ], {
      stdio: ['ignore', 'ignore', 'pipe'],
      env: {
        PATH: process.env.PATH,
        HOME: PROFILE,
        XDG_CONFIG_HOME: `${PROFILE}/.config`,
        XDG_CACHE_HOME: `${PROFILE}/.cache`,
        XDG_DATA_HOME: `${PROFILE}/.local/share`,
        LANG: process.env.LANG || 'C.UTF-8',
      },
    });

    let out = '';
    const onData = (buf) => {
      out += buf.toString();
      const m = out.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) {
        proc.stderr.off('data', onData);
        clearTimeout(timer);
        resolve({ proc, wsEndpoint: m[1] });
      }
    };
    proc.stderr.on('data', onData);
    proc.on('error', (e) => { clearTimeout(timer); reject(e); });
    proc.on('exit', (code) => { clearTimeout(timer); reject(new Error(`chrome exited early (${code})`)); });

    const timer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* already gone */ }
      reject(new Error('chrome did not start in time'));
    }, 20_000);
  });
}

async function getBrowser() {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      if (b.connected) return b;
    } catch { /* fall through and start a new one */ }
  }
  browserPromise = (async () => {
    const { proc, wsEndpoint } = await spawnChrome();
    child = proc;
    const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint, protocolTimeout: RENDER_TIMEOUT + 15_000 });
    // If Chrome dies, forget it so the next request starts a fresh one rather
    // than failing forever against a corpse.
    proc.once('exit', () => { browserPromise = null; child = null; });
    browser.once('disconnected', () => { browserPromise = null; });
    return browser;
  })();
  return browserPromise;
}

/**
 * Render a URL to PDF bytes.
 * `url` must already have passed validateTarget(); every request the page then
 * makes is checked again here, which is what catches redirects and DNS
 * rebinding — by that point the address is the one actually being connected to.
 */
async function renderUrlToPdf(url, { landscape = false, background = true, format = 'A4', view = 'desktop', singlePage = false } = {}, onProgress) {
  // The caller may want to narrate this: a cold Chrome start alone can take
  // fifteen seconds, and a spinner that says nothing for that long reads as
  // broken. Never let a progress callback break a capture.
  const report = (stage, detail) => {
    try { if (onProgress) onProgress(stage, detail); } catch { /* never fatal */ }
  };

  report('browser');
  const browser = await getBrowser();
  // A throwaway context per render: no cookies, storage or cache carried from
  // one person's capture into the next.
  const context = await browser.createBrowserContext();
  let bytes = 0;

  try {
    const v = VIEWS[view] || VIEWS.desktop;
    const page = await context.newPage();
    await page.setViewport({
      width: v.width, height: v.height, deviceScaleFactor: 1,
      isMobile: v.isMobile, hasTouch: v.touch,
    });
    await page.setUserAgent(v.ua);
    // The promise on the page is "exactly as it looks today", so render what a
    // visitor sees rather than what a print stylesheet wants to show.
    await page.emulateMediaType('screen');
    await page.setJavaScriptEnabled(true);
    await page.setBypassCSP(false);

    await page.setRequestInterception(true);
    page.on('request', async (req) => {
      try {
        const target = req.url();
        if (target.startsWith('data:') || target.startsWith('blob:')) return req.continue();
        if (!(await isRequestAllowed(target))) return req.abort('blockedbyclient');
        return req.continue();
      } catch {
        try { return req.abort('failed'); } catch { /* already handled */ }
      }
    });
    page.on('response', (res) => {
      const len = Number(res.headers()['content-length'] || 0);
      bytes += Number.isFinite(len) ? len : 0;
    });
    // Nothing on the page gets to open a dialog and hold the render open.
    page.on('dialog', (d) => d.dismiss().catch(() => {}));

    report('opening');
    // `domcontentloaded`, not `networkidle2`.
    //
    // Waiting for the network to go quiet sounds right and is wrong for real
    // sites: analytics beacons, chat widgets, live dashboards and anything with
    // a websocket never go quiet, so a perfectly capturable page timed out and
    // the user was told it "took too long to load". Get a document first, then
    // settle on a budget — a page we can see is a page we can print.
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    if (!resp) throw new Error('no-response');

    report('settling');
    // Best effort. Images and fonts usually finish inside this; if the site
    // keeps a socket open forever we print what is there rather than failing.
    await page.waitForNetworkIdle({ idleTime: 600, timeout: SETTLE_TIMEOUT }).catch(() => {});
    if (bytes > MAX_BYTES) throw new Error('too-large');

    // Walk the page to the bottom and back.
    //
    // Two things depend on this. Lazy images only load when they scroll into
    // view, so a capture without it is full of blank boxes. And the page keeps
    // GROWING as they load — measuring the height first gave a document 2696px
    // tall that was really taller, so "one long page" came out as two.
    await page.evaluate(async () => {
      const step = Math.max(200, window.innerHeight * 0.9);
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 250));
    });

    // A last beat for anything that started loading on the way down.
    await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));

    report('printing');

    // The bug this replaces: Chrome lays PRINT out at the PAPER width, not the
    // viewport. So a 1280px capture was being re-laid-out at ~794px (A4), the
    // site switched to its narrow breakpoint, and anything wider than the sheet
    // was simply cut off. It looked like a mobile screenshot with the edges
    // missing, because that is effectively what it was.
    //
    // Chrome's print `scale` divides the layout width: layout = paper / scale.
    // So asking for scale = paperWidth / viewportWidth lays the page out at
    // EXACTLY the viewport width and then shrinks the result onto the sheet.
    // The desktop layout stays the desktop layout; it just gets smaller.
    let pdf;
    if (singlePage) {
      // One continuous page the width of the viewport and as tall as the
      // document — no page breaks cutting through a section.
      const contentHeight = await page.evaluate(() => Math.max(
        document.body?.scrollHeight || 0,
        document.documentElement?.scrollHeight || 0,
        document.body?.offsetHeight || 0,
        document.documentElement?.offsetHeight || 0,
        document.body?.getBoundingClientRect().height || 0,
      ));
      // A couple of pixels of rounding, or a sub-pixel layout, is enough to spill
      // onto a second page and defeat the whole point of this mode.
      const height = Math.min(Math.max(Math.ceil(contentHeight) + 2, v.height), MAX_PAGE_PX);
      pdf = await page.pdf({
        width: `${v.width}px`,
        height: `${Math.ceil(height)}px`,
        printBackground: background,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        scale: 1,
        timeout: RENDER_TIMEOUT,
      });
    } else {
      const paper = (PAPER_PX[format] || PAPER_PX.A4)[landscape ? 'landscape' : 'portrait'];
      const usable = Math.max(200, paper - MARGIN_PX);
      // Chrome accepts 0.1–2. Shrinking a desktop layout onto A4 lands ~0.56;
      // a narrow mobile layout is allowed to grow so it fills the sheet.
      const scale = Math.min(2, Math.max(0.1, usable / v.width));
      pdf = await page.pdf({
        format,
        landscape,
        printBackground: background,
        margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
        scale,
        timeout: RENDER_TIMEOUT,
      });
    }
    return Buffer.from(pdf);
  } finally {
    await context.close().catch(() => {});
  }
}

function shutdown() {
  try { if (child) child.kill('SIGTERM'); } catch { /* ignore */ }
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

module.exports = { renderUrlToPdf };
