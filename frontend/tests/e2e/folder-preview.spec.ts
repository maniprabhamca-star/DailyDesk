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
  await expect(page.getByRole('heading', { name: /preview every file in a folder/i })).toBeVisible({ timeout: 20_000 });
  await page.locator('input[type=file]').first()
    .setInputFiles(path.join(process.cwd(), 'tests/.fixtures/demo-folder'));
  await expect(page.getByText(/of 8 files/)).toBeVisible({ timeout: 20_000 });
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

// The rAF hang, tested where it actually happens.
//
// `pdf-render.ts` paces on requestAnimationFrame unless given `intent: 'print'`,
// and rAF does not fire in a backgrounded tab — so the render promise never
// settles and the card spins forever. A grid renders many PDFs at once while
// someone flicks to another tab, so this is the tool's most likely way to die.
//
// dev-harness/folder-pdf-volume.mjs cannot cover it: Node has no rAF for pdf.js
// to pace against, and that harness passes even with intent:'print' deleted —
// verified, not assumed. This is the test that would actually fail.
test('PDF previews still finish when the tab is backgrounded', async ({ page, context }) => {
  await asOwner(page);
  await page.goto('/folder-preview', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /preview every file in a folder/i })).toBeVisible({ timeout: 20_000 });
  await page.locator('input[type=file]').first()
    .setInputFiles(path.join(process.cwd(), 'tests/.fixtures/demo-folder'));
  await expect(page.getByText(/of 8 files/)).toBeVisible({ timeout: 20_000 });

  // Front a second tab. The grid keeps working in the background — or it hangs.
  const other = await context.newPage();
  await other.goto('about:blank');
  await other.bringToFront();
  await page.waitForTimeout(6000);
  await other.close();
  await page.bringToFront();

  // Every card must have settled. A spinner here is the hang.
  await expect
    .poll(async () => page.locator('.animate-spin').count(), { timeout: 20_000 })
    .toBe(0);

  const body = await page.locator('main').innerText();
  expect(body, 'the PDF should be listed').toContain('contract.pdf');
});

// Multi-select. Triage is the reason people open a folder, and selecting forty
// files one at a time is not triage — so the range and the select-all matter as
// much as the checkbox does.
test.describe('selection', () => {
  const open = async (page: import('@playwright/test').Page) => {
    await asOwner(page);
    await openDemoFolder(page);
  };
  const ticks = (page: import('@playwright/test').Page) => page.locator('button[aria-label^="Select "]');

  test('a tick selects, and the bar switches to the selection', async ({ page }) => {
    await open(page);
    await ticks(page).first().click();
    await expect(page.getByText(/1 selected ·/)).toBeVisible();
    // Size is shown because "how much will this free up" is the actual question.
    await expect(page.getByText(/selected · \d/)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Clear$/ })).toBeVisible();
  });

  test('shift-click takes the whole range', async ({ page }) => {
    await open(page);
    await ticks(page).nth(1).click();
    await ticks(page).nth(5).click({ modifiers: ['Shift'] });
    // 1..5 inclusive.
    await expect(page.getByText(/5 selected ·/)).toBeVisible();
  });

  test('select all, then Escape clears', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /select all/i }).click();
    await expect(page.getByText(/8 selected ·/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText(/of 8 files/)).toBeVisible();
  });

  test('with a selection open, clicking a card selects instead of opening it', async ({ page }) => {
    await open(page);
    await ticks(page).first().click();
    await page.locator('button[title="Select / deselect"]').nth(1).click();
    await expect(page.getByText(/2 selected ·/)).toBeVisible();
    // Crucially it did NOT open the viewer.
    await expect(page.getByRole('button', { name: /back to grid/i })).toHaveCount(0);
  });

  test('the trash button is absent when the browser cannot write', async ({ page }) => {
    // webkitdirectory path = no folder handle = no writes. It must not offer
    // a button that cannot work.
    await open(page);
    await ticks(page).first().click();
    await expect(page.getByRole('button', { name: /move 1 to trash/i })).toHaveCount(0);
  });
});

// Confirmation and undo.
//
// The split is deliberate: bulk asks first, single doesn't. A confirm on every
// delete trains people to click through it, at which point it protects nobody —
// whereas an undo that works protects them after the mistake, which is when it
// actually matters. Forty files at once is a different act, so that one asks.
//
// The webkitdirectory path has no folder-write permission, so the destructive
// half can't run here; what IS asserted is that the tool never offers a control
// it cannot honour. The real move-and-restore was verified manually in Chrome.
test.describe('confirmation and undo', () => {
  test('no delete controls at all without folder permission', async ({ page }) => {
    await asOwner(page);
    await openDemoFolder(page);

    // Single-file bin, bulk button and undo are all absent — not present-and-broken.
    await expect(page.locator('button[title="Move to trash"]')).toHaveCount(0);
    await page.locator('button[aria-label^="Select "]').first().click();
    await expect(page.getByRole('button', { name: /move 1 to trash/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^undo/i })).toHaveCount(0);
  });

  test('the banner explains why tidying is unavailable rather than hiding it', async ({ page }) => {
    await asOwner(page);
    await openDemoFolder(page);
    // Silently removing the buttons would read as a missing feature. Say why.
    await expect(page.getByText(/tidying doesn.t/i)).toBeVisible();
    await expect(page.getByText(/Chrome or Edge/i)).toBeVisible();
  });
});
