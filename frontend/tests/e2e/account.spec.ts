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
      localStorage.setItem('dd_splash_seen', '1');
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
    // And a way out, not a dead end.
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
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
