'use client';

// Client side of the Statement Converter page-quota. It sends only a PAGE COUNT to
// the server — never the statement — so the on-device privacy promise holds while
// the free allowance is still enforced server-side (a client-only counter would
// reset on refresh). Fails OPEN on any network/backend trouble so a metering hiccup
// never blocks a conversion.

const API = process.env.NEXT_PUBLIC_API_URL || '';

export type Quota = {
  pro: boolean;            // Pro/owner → unlimited, never counted
  unlimited: boolean;
  limit: number | null;   // free page allowance
  used: number;
  remaining: number | null;
};

export type Consume = Quota & { allowed: boolean; message?: string };

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Current usage, for the "N of 5 free pages used" display. */
export async function getQuota(): Promise<Quota> {
  try {
    const r = await fetch(`${API}/api/statements/quota`, { headers: authHeaders() });
    if (r.ok) return (await r.json()) as Quota;
  } catch { /* fall through */ }
  // Dev / offline / backend down — assume free with the full allowance, never block.
  return { pro: false, unlimited: false, limit: 5, used: 0, remaining: 5 };
}

/** Record `pages` before an export. `allowed:false` means the free allowance is
 *  spent and enforcement is on — the caller should show the upgrade prompt instead
 *  of downloading. */
export async function consumePages(pages: number): Promise<Consume> {
  try {
    const r = await fetch(`${API}/api/statements/consume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ pages }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 402) return { allowed: false, pro: false, unlimited: false, limit: data.limit ?? 5, used: data.used ?? 0, remaining: 0, message: data.message };
    if (r.ok) return { allowed: true, pro: !!data.pro, unlimited: !!data.unlimited, limit: data.limit ?? null, used: data.used ?? 0, remaining: data.remaining ?? null };
  } catch { /* fall through */ }
  return { allowed: true, pro: false, unlimited: false, limit: 5, used: 0, remaining: 5 }; // fail-open
}
