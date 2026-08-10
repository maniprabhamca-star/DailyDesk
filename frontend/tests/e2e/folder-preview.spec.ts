import { test, expect } from '@playwright/test';
import path from 'node:path';
import { isEnvNoise } from './_routes';

// Folder Preview — driven through the webkitdirectory path, which is what every
// browser gets. The directory-picker path is Chrome-only and cannot be driven
// from a test, so the fallback is the one that must be provably correct.
//
// tests/.fixtures/demo-folder holds one file of each render kind plus a .psd
// that deliberately cannot be previewed.

const asOwner = async (page: import('@playwright/test').Page) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('dd_cookie_ack', '1');
      localStorage.setItem('dd-splash-seen-v1', '1');
      localStorage.setItem('dd_token', 't');
      localStorage.setItem('dd_user', JSON.stringify({ id: '1', name: 'Owner', email: 'maniprabhamca@gmail.com', plan: 'pro' }));
    } catch { /* private mode */ }
  });
};

const openDemoFolder = async (page: import('@playwright/test').Page) => {
  await page.goto('/folder-preview', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /see every file in a folder/i })).toBeVisible({ timeout: 20_000 });
  await page.locator('input[type=file]').first()
    .setInputFiles(path.join(process.cwd(), 'tests/.fixtures/demo-folder'));
  await expect(page.getByText(/of 7 files/)).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2000); // let the render queue drain
};

test.describe('Folder Preview', () => {
  test('every render kind appears, and the one we cannot draw says why', async ({ page }) => {
    await asOwner(page);
    const errs: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error' && !isEnvNoise(m.text())) errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));

    await openDemoFolder(page);
    const body = await page.locator('main').innerText();

    for (const name of ['notes.md', 'statement.csv', 'config.json', 'pricing.ts', 'logo.svg', 'readme.txt', 'artwork.psd']) {
      expect(body, `${name} should be listed`).toContain(name);
    }

    // The important one: a file we cannot preview is LISTED with a reason rather
    // than dropped. Hiding it makes the folder look emptier than it is, which is
    // the mistake the tool this came from made first and then fixed.
    expect(body, 'the .psd must explain itself').toMatch(/Photoshop/i);

    expect(body).toMatch(/0 bytes uploaded/);

    // The assertion that actually matters, and the one the first version of this
    // test lacked: the previews must have RENDERED. Listing filenames passed
    // happily while every card sat on its spinner forever — a stale ref meant the
    // queue dropped every item. Prove the content is on screen.
    expect(body, 'the CSV preview should show its row count').toMatch(/first \d+ of \d+ rows/);
    expect(body, 'the markdown preview should show its content').toMatch(/Q3 handover/);
    expect(body, 'the code preview should show its content').toMatch(/tier/);
    const spinners = await page.locator('.animate-spin').count();
    expect(spinners, 'no card should still be loading after the queue drains').toBe(0);

    expect(errs, 'console errors while previewing').toEqual([]);
  });

  test('the viewer is a review queue — arrows move, Escape leaves', async ({ page }) => {
    await asOwner(page);
    await openDemoFolder(page);

    await page.locator('button[title="Open full size"]').first().click();
    const header = page.locator('.fixed .truncate').first();
    await expect(page.getByRole('button', { name: /back to grid/i })).toBeVisible();

    const first = await header.innerText();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    const second = await header.innerText();
    expect(second, 'ArrowRight should advance the queue').not.toBe(first);

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(400);
    expect(await header.innerText(), 'ArrowLeft should go back').toBe(first);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /back to grid/i })).toHaveCount(0);
  });

  test('the free cap is stated before anyone picks a folder', async ({ page }) => {
    // Signed out — the cap has to be visible BEFORE the work, not after.
    await page.addInitScript(() => {
      try { localStorage.setItem('dd_cookie_ack', '1'); localStorage.setItem('dd-splash-seen-v1', '1'); } catch { /* ignore */ }
    });
    await page.goto('/folder-preview', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/we read only the folder you pick/i)).toBeVisible({ timeout: 20_000 });
  });
});

// A gated tool's tile was non-clickable for EVERYONE — including the owner, who
// was expected to type the URL of every tool they were testing. The owner is the
// one person who needs to open it, so the tile is now a link for them.
//
// ⚠️ Only the OWNER half is asserted here, deliberately. `lib/plan.ts` grants the
// owner bypass on localhost, so under test everybody is the owner and a "the
// public cannot click it" assertion would pass no matter what the code did. An
// earlier version of this file had exactly that test, and it passed for the wrong
// reason — the locator was finding nothing at all. A test that cannot fail is
// worse than no test, because it is read as coverage. The public half needs a
// non-local hostname; it is tracked as the known gap in docs/qa/.
test.describe('gated tools open for the owner', () => {
  test('the owner can click a coming-soon tile', async ({ page }) => {
    await asOwner(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Settle FIRST: the tile is a <div> until auth restores and then becomes an
    // <a>, so grabbing it too early gets a node React is about to replace.
    await page.waitForTimeout(2500);
    const tile = page.getByText('Folder preview').first();
    await tile.scrollIntoViewIfNeeded();
    const href = await tile.evaluate((n) => (n as HTMLElement).closest('a')?.getAttribute('href') ?? null);
    expect(href, 'the owner should reach a gated tool from the tile').toBe('/folder-preview');
  });
});
