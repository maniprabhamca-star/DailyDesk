import { test, expect, type Page } from '@playwright/test';

// REG-034 — an expired session left /account looking signed in and doing nothing.
//
// Reported by the owner from production: the page showed their name, their PRO
// badge and "Active", while "Checking your subscription…" span forever and the
// billing button printed a raw "Invalid or expired token". Tokens last 7 days;
// theirs had simply lapsed. Three separate faults lined up:
//
//   1. the subscription panel checked `subs === null` BEFORE it checked `error`,
//      so any failure left it spinning with the message it had already stored;
//   2. refreshUser() swallowed a 401 exactly like a network blip, so the cached
//      user stayed on screen and the page kept claiming to be signed in;
//   3. the raw backend string was shown to a human as if it meant something.
//
// These stub the API rather than a live backend: the point is what the UI does
// with a 401, and that has to hold whatever the server is doing that day.

const signIn = async (page: Page) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('dd_token', 'expired.token.value');
      localStorage.setItem('dd_user', JSON.stringify({ id: '1', name: 'Test Owner', email: 't@example.com', plan: 'pro' }));
      localStorage.setItem('dd_cookie_ack', '1');
      localStorage.setItem('dd-splash-seen-v1', '1');
    } catch { /* private mode */ }
  });
};

test.describe('REG-034 — a lapsed session says so', () => {
  test('the subscription panel never spins forever on an error', async ({ page }) => {
    await signIn(page);
    // The session itself is fine here; only billing fails. The panel must still
    // reach a state a person can act on.
    await page.route('**/api/user/me', (r) => r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'fresh.token', user: { id: '1', name: 'Test Owner', email: 't@example.com', plan: 'pro' } }),
    }));
    await page.route('**/api/stripe/subscription', (r) => r.fulfill({
      status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid or expired token' }),
    }));

    await page.goto('/account', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/session has expired/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Checking your subscription')).toHaveCount(0);
    // And a way out, not a dead end — scoped to the SUBSCRIPTION panel.
    //
    // Page-wide this now matches twice: the ledger below it also fails on a dead
    // session and also offers a retry. Both are correct — every panel that cannot
    // load says so and offers a way back — so the fix is to aim the assertion,
    // not to remove the second button.
    const panel = page.locator('div').filter({ hasText: /session has expired/i }).last();
    await expect(panel.getByRole('button', { name: /try again/i })).toBeVisible();
  });

  test('a raw backend error is never shown to a person', async ({ page }) => {
    await signIn(page);
    await page.route('**/api/user/me', (r) => r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'fresh.token', user: { id: '1', name: 'Test Owner', email: 't@example.com', plan: 'pro' } }),
    }));
    await page.route('**/api/stripe/subscription', (r) => r.fulfill({
      status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid or expired token' }),
    }));

    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/session has expired/i).first()).toBeVisible({ timeout: 15_000 });
    expect(await page.getByText('Invalid or expired token').count(), 'the backend string must not reach the page').toBe(0);
  });

  test('an expired token signs you out and explains why', async ({ page }) => {
    await signIn(page);
    // The whole session is dead — /me itself 401s.
    await page.route('**/api/user/me', (r) => r.fulfill({
      status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid or expired token' }),
    }));
    await page.route('**/api/stripe/**', (r) => r.fulfill({
      status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid or expired token' }),
    }));

    await page.goto('/account', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /your session has expired/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /sign in again/i })).toBeVisible();
    // The stale credentials must be gone, not left to fail against every later call.
    const token = await page.evaluate(() => localStorage.getItem('dd_token'));
    expect(token, 'a dead token must be cleared, not kept').toBeNull();
    // And it must NOT still be claiming you are signed in as Pro.
    await expect(page.getByText('Test Owner')).toHaveCount(0);
  });
});

// The account page as a transparency ledger — docs/designs/account-page.md.
// It was three cards of nothing, and it was missing both GDPR exits (Art. 20
// portability, Art. 17 erasure) while we serve the UK and EU.
const LEDGER = {
  memberSince: '2026-01-15T10:00:00.000Z',
  storageUsedBytes: 0,
  hasPassword: true,
  items: [
    { table: 'notes', label: 'Notes', href: '/notes', count: 3 },
    { table: 'habits', label: 'Habits', href: '/habits', count: 0 },
    { table: 'vault_files', label: 'Vault items (encrypted — we cannot read these)', href: '/file-vault', count: 0 },
  ],
};

async function signedInAccount(page: Page) {
  await signIn(page);
  await page.route('**/api/user/me', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ token: 'fresh.token', user: { id: '1', name: 'Test Owner', email: 't@example.com', plan: 'pro' } }),
  }));
  await page.route('**/api/stripe/subscription', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, subscriptions: [] }),
  }));
  await page.route('**/api/user/data-summary', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(LEDGER),
  }));
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
}

test.describe('the account page tells you what we hold', () => {
  test('the ledger lists the empty rows too', async ({ page }) => {
    await signedInAccount(page);
    await expect(page.getByText('What we hold')).toBeVisible({ timeout: 15_000 });
    // A count that exists...
    await expect(page.getByText('Notes', { exact: true })).toBeVisible();
    // ...and the zeroes, which are the whole point for a privacy-first product:
    // "nothing stored" only reads as an answer if it is actually shown.
    expect(await page.getByText('none', { exact: true }).count()).toBeGreaterThanOrEqual(2);
  });

  test('both GDPR exits are present', async ({ page }) => {
    await signedInAccount(page);
    // Article 20 — portability.
    await expect(page.getByRole('button', { name: /download everything/i })).toBeVisible({ timeout: 15_000 });
    // Article 17 — erasure.
    await expect(page.getByRole('button', { name: /^delete$/i })).toBeVisible();
  });

  test('deleting needs the email typed, not just a click', async ({ page }) => {
    await signedInAccount(page);
    let deleteCalled = false;
    await page.route('**/api/user/account', (r) => { deleteCalled = true; return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });

    await page.getByRole('button', { name: /^delete$/i }).click();
    const confirm = page.getByRole('button', { name: /delete my account for good/i });
    await expect(confirm).toBeVisible();
    // Armed only by typing the real address — a destructive action reached by
    // one click is a trap.
    await expect(confirm).toBeDisabled();
    await page.getByLabel(/confirm your email address/i).fill('wrong@example.com');
    await expect(confirm).toBeDisabled();
    await page.getByLabel(/confirm your email address/i).fill('t@example.com');
    await expect(confirm).toBeEnabled();
    expect(deleteCalled, 'nothing should have been sent yet').toBe(false);
  });

  test('the plan badge does not claim Active with nothing to bill', async ({ page }) => {
    await signedInAccount(page);
    // Owner/comped Pro is real, but "Active" beside "no paid subscription" reads
    // as a bug. It says Included, and the panel explains why.
    await expect(page.getByText('Included')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/doesn’t come from a card/i)).toBeVisible();
  });
});

// REG-038 — the header overflowed at 375px, but ONLY when signed in.
//
// The signed-in header carries an avatar the signed-out one doesn't, and at
// 375px that pushed the row 29px past the viewport — on every page, for every
// person with an account. XC-005 checks 375/768/1280 across the archetypes and
// saw nothing, because the whole E2E suite browses signed out. That is the real
// lesson: a responsive check that never authenticates is only testing half the
// header. This one authenticates.
test.describe('REG-038 — the signed-in header fits a phone', () => {
  for (const path of ['/', '/account', '/compress-pdf']) {
    test(`${path} does not scroll sideways at 375 when signed in`, async ({ page }) => {
      await signIn(page);
      await page.route('**/api/user/me', (r) => r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 't', user: { id: '1', name: 'Test Owner', email: 't@example.com', plan: 'pro' } }),
      }));
      await page.route('**/api/stripe/subscription', (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, subscriptions: [] }),
      }));
      await page.route('**/api/user/data-summary', (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(LEDGER),
      }));

      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);

      // Measured directly rather than inferred from a pass/fail elsewhere —
      // the last time this class of bug was called "environment-sensitive" it
      // was a real 29px overflow.
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(over, `${path} overflows by ${over}px at 375 while signed in`).toBeLessThanOrEqual(1);
    });
  }
});
