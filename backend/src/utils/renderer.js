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
async function renderUrlToPdf(url, { landscape = false, background = true, format = 'A4' } = {}, onProgress) {
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
    const page = await context.newPage();
    await page.setViewport({ width: 1280, height: 1696, deviceScaleFactor: 1 });
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 DiemDesk/1.0 (+https://diemdesk.com)');
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

    // A last beat for lazy images that started loading during the settle.
    await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));

    report('printing');
    const pdf = await page.pdf({
      format,
      landscape,
      printBackground: background,
      margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
      timeout: RENDER_TIMEOUT,
    });
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
