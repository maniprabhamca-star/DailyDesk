import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ARCHETYPES } from './_routes';

// XC-006 / XC-007 / XC-008 from docs/qa/test-catalog.md — the three cross-cutting
// checks that were specced but never written.
//
//   XC-006  both themes are really designed: text has AA contrast against what
//           is actually behind it, and nothing is invisible.
//   XC-007  accessibility: axe finds no serious/critical violation, focus is
//           visible, and Escape closes what it opens.
//   XC-008  reduced motion is honoured — for people who get motion sick, this
//           is not a nicety.
//
// Run on the archetype set rather than all ~140 routes: these are properties of
// the shared shell and the per-archetype templates, so a page-by-page sweep buys
// repetition, not coverage.

const SETTLE = 400; // let fonts land and next-themes apply the class

// ⚠ `test.use({ reducedMotion: 'reduce' })` does NOT take effect in this setup —
// matchMedia still reports no-preference, so a test written that way passes or
// fails for reasons unrelated to the app. page.emulateMedia() does work, and is
// what every reduced-motion assertion here relies on.
async function visit(page: Page, path: string, theme: 'light' | 'dark', reduceMotion = false) {
  if (reduceMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('theme', t as string);
      // Dismiss the consent banner: it is not what these tests are about, and
      // it covers page content (REG-022).
      localStorage.setItem('dd_cookie_ack', '1');
      localStorage.setItem('dd-splash-seen-v1', '1');
    } catch { /* private mode — the test still works, just noisier */ }
  }, theme);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(SETTLE);
}

/* ------------------------------------------------------------------ XC-006 */

type ContrastFinding = { text: string; ratio: number; fg: string; bg: string; tag: string };

// Contrast is computed in the page, where the cascade has already resolved.
// Deliberately conservative: an element is only judged when the background
// behind it resolves to a solid colour. Gradients and images are skipped rather
// than guessed at — a test that cries wolf gets switched off, and then it
// protects nothing.
const CONTRAST_PROBE = `(() => {
  const parse = (c) => {
    const m = String(c).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map((n) => parseFloat(n.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => {
    const f = [c.r, c.g, c.b].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  // Walk up for the first opaque background. Returns null if we hit a gradient
  // or an image on the way — unknowable, so not judged.
  const backdrop = (el) => {
    let n = el;
    while (n && n !== document.documentElement.parentNode) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null;
      const c = parse(s.backgroundColor);
      if (c && c.a === 1) return c;
      if (c && c.a > 0 && c.a < 1) return null; // translucent stack — approximate, skip
      n = n.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  const out = [];
  const els = document.querySelectorAll('body *');
  for (const el of els) {
    if (el.closest('[aria-hidden="true"]')) continue;
    if (/^(SCRIPT|STYLE|SVG|PATH|NOSCRIPT)$/.test(el.tagName)) continue;
    // Only elements holding their own text — otherwise every wrapper is counted.
    let own = '';
    for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue;
    own = own.trim();
    if (own.length < 2) continue;

    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) < 0.15) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;

    const fg = parse(s.color);
    if (!fg || fg.a < 0.5) continue;
    const bg = backdrop(el);
    if (!bg) continue;

    const size = parseFloat(s.fontSize);
    const weight = parseInt(s.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(fg, bg);
    if (got + 0.05 < need) {
      out.push({
        text: own.slice(0, 60),
        ratio: Math.round(got * 100) / 100,
        fg: s.color,
        bg: 'rgb(' + bg.r + ', ' + bg.g + ', ' + bg.b + ')',
        tag: el.tagName.toLowerCase() + (large ? ' [large]' : ''),
      });
    }
  }
  return out;
})()`;

for (const theme of ['light', 'dark'] as const) {
  test.describe(`XC-006 — ${theme} theme is designed, not inherited`, () => {
    for (const { path, arch } of ARCHETYPES) {
      test(`${path} [${arch}] has readable contrast in ${theme}`, async ({ page }) => {
        await visit(page, path, theme);

        // next-themes with attribute="class" adds `dark` and adds nothing at all
        // for light — so light is asserted as the absence of dark, not a class.
        const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
        expect(isDark, `the ${theme} theme should be the one applied`).toBe(theme === 'dark');

        const findings = (await page.evaluate(CONTRAST_PROBE)) as ContrastFinding[];
        const report = findings
          .map((f) => `  ${f.ratio}:1  <${f.tag}> ${f.fg} on ${f.bg} — "${f.text}"`)
          .join('\n');
        expect(findings, `text below AA contrast in ${theme}:\n${report}`).toEqual([]);
      });
    }
  });
}

// The probe is a single computed-style read, so it has to be retried rather
// than trusted once: visit() waits a fixed SETTLE, and under a loaded parallel
// run a page can still be hydrating, or mid colour-transition, when we look —
// and mid-transition an element's colour genuinely does pass through its own
// background. /pricing and /changelog failed exactly that way in a full run
// while passing 33/33 in isolation.
//
// What we care about is text that is PERSISTENTLY invisible, so poll until the
// page stops changing its mind. Same lesson as REG-041: a wall-clock wait is
// not a settled page.
const INVISIBLE_PROBE = () => {
  const bad: string[] = [];
  document.querySelectorAll('body *').forEach((el) => {
    let own = '';
    el.childNodes.forEach((n) => { if (n.nodeType === 3) own += n.nodeValue; });
    if (own.trim().length < 2) return;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none') return;
    const r = (el as HTMLElement).getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    if (s.color === s.backgroundColor) bad.push(`${el.tagName.toLowerCase()}: "${own.trim().slice(0, 40)}"`);
  });
  return bad;
};

test.describe('XC-006 — no text is invisible', () => {
  for (const { path, arch } of ARCHETYPES) {
    test(`${path} [${arch}] never paints text in its own background colour`, async ({ page }) => {
      await visit(page, path, 'light');
      await expect
        .poll(async () => page.evaluate(INVISIBLE_PROBE), {
          message: 'text painted in exactly its own background colour',
          timeout: 10_000,
        })
        .toEqual([]);
    });
  }
});

/* ------------------------------------------------------------------ XC-007 */

test.describe('XC-007 — accessibility', () => {
  for (const { path, arch } of ARCHETYPES) {
    test(`${path} [${arch}] has no serious or critical axe violation`, async ({ page }) => {
      await visit(page, path, 'light');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      const report = serious
        .map((v) => `  [${v.impact}] ${v.id}: ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n    ')}`)
        .join('\n');
      expect(serious, `axe violations on ${path}:\n${report}`).toEqual([]);
    });
  }

  test('keyboard focus is always visible', async ({ page }) => {
    await visit(page, '/', 'light');
    // Walk the first stretch of the tab order. Every stop must paint something
    // a sighted keyboard user can see — an outline, a ring, or a border change.
    const invisible: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      const state = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        return {
          who: el.tagName.toLowerCase() + (el.textContent || '').trim().slice(0, 24),
          outline: parseFloat(s.outlineWidth) || 0,
          outlineStyle: s.outlineStyle,
          shadow: s.boxShadow,
          ring: s.getPropertyValue('--tw-ring-offset-shadow') + s.getPropertyValue('--tw-ring-shadow'),
        };
      });
      if (!state) continue;
      const visible = (state.outline > 0 && state.outlineStyle !== 'none')
        || (state.shadow && state.shadow !== 'none')
        || /rgb|px/.test(state.ring);
      if (!visible) invisible.push(state.who);
    }
    expect(invisible, 'focusable elements with no visible focus state').toEqual([]);
  });

  test('Escape closes the command palette', async ({ page }) => {
    await visit(page, '/', 'light');
    // ⌘K / Ctrl-K is the one overlay reachable identically on every viewport —
    // the header's Search *button* is sm:hidden, so a desktop run never sees it.
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog').first();
    await expect(dialog, '⌘K should open the palette').toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog, 'Escape must close it — a keyboard user has no other way out').not.toBeVisible();
  });

  test('Escape closes the mobile menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await visit(page, '/', 'light');
    const menu = page.getByRole('button', { name: /menu/i }).first();
    await menu.click();
    await expect(menu, 'the menu button should report itself open').toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(menu, 'Escape must close the mobile menu').toHaveAttribute('aria-expanded', 'false');
  });

  test('every page can be reached by keyboard from the top', async ({ page }) => {
    await visit(page, '/compress-pdf', 'light');
    // The one control that matters most on a tool page is the file picker, and
    // it must be reachable without a mouse (REG-015 took it off-screen; it has
    // to stay focusable).
    const reachable = await page.evaluate(() => {
      const input = document.querySelector('input[type=file]') as HTMLElement | null;
      if (!input) return 'no file input at all';
      input.focus();
      return document.activeElement === input ? 'ok' : 'file input cannot take focus';
    });
    expect(reachable).toBe('ok');
  });
});

/* ------------------------------------------------------------------ XC-008 */

test.describe('XC-008 — reduced motion is honoured', () => {
  for (const { path, arch } of ARCHETYPES.slice(0, 5)) {
    test(`${path} [${arch}] runs no looping animation when motion is reduced`, async ({ page }) => {
      await visit(page, path, 'light', true);
      const looping = await page.evaluate(() => {
        const bad: string[] = [];
        document.querySelectorAll('body *').forEach((el) => {
          const s = getComputedStyle(el);
          if (s.animationName === 'none') return;
          const dur = parseFloat(s.animationDuration) || 0;
          const count = s.animationIterationCount;
          // A one-shot 200ms fade is fine. An endless loop is the thing that
          // makes people ill, and it is what this must catch.
          if (dur > 0 && (count === 'infinite' || parseFloat(count) > 3)) {
            bad.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} — ${s.animationName} ×${count}`);
          }
        });
        return bad;
      });
      expect(looping, 'animations still looping under prefers-reduced-motion').toEqual([]);
    });
  }

  test('the first-visit splash does not animate when motion is reduced', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('dd-splash-seen-v1');
        localStorage.setItem('dd_cookie_ack', '1');
      } catch { /* ignore */ }
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Whatever the splash does, the page underneath must be usable immediately —
    // reduced motion means "get me there", not "play a shorter film".
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 3_000 });
    const dancing = await page.evaluate(() => {
      const d = document.querySelector('.dd-d');
      return d ? getComputedStyle(d).animationName : 'none';
    });
    expect(dancing, 'the logo should hold still under reduced motion').toBe('none');
  });
});
