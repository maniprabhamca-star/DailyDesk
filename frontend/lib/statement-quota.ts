'use client';

// Client side of the Statement Converter page-quota. It sends only a PAGE COUNT to
// the server — never the statement — so the on-device privacy promise holds while
// the allowance is still enforced server-side (a client-only counter would reset on
// refresh). Fails OPEN on any network/backend trouble so a metering hiccup never
// blocks a conversion.
//
// Every tier has a ceiling now except the owner's: 5 free · 20 Pro · 300 Business,
// the numbers /pricing prints. `unlimited` used to be true for anyone who had paid
// anything, which made the 300 on the pricing page decorative.

const API = process.env.NEXT_PUBLIC_API_URL || '';

export type Tier = 'free' | 'pro' | 'business' | 'owner';

export type Quota = {
  pro: boolean;            // pays us something — drives the upgrade prompt only
  tier: Tier;
  unlimited: boolean;      // owner only. Pro and Business both have a ceiling now.
  limit: number | null;    // the month's allowance: included + credits
  included: number | null; // what the plan includes
  credits: number;         // bought top-up pages (0 until the pack ships)
  used: number;
  remaining: number | null;
  /** false when the server could not read the meter (Redis down) and is
   *  reporting the full allowance rather than a figure it does not have. */
  metered?: boolean;
};

export type Consume = Quota & { allowed: boolean; message?: string; upgradeTo?: 'pro' | 'business' | null };

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
  return { pro: false, tier: 'free', unlimited: false, limit: 5, included: 5, credits: 0, used: 0, remaining: 5, metered: false };
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
    if (r.status === 402) {
      return {
        allowed: false, pro: !!data.pro, tier: (data.tier as Tier) ?? 'free', unlimited: false,
        limit: data.limit ?? 5, included: data.included ?? null, credits: data.credits ?? 0,
        used: data.used ?? 0, remaining: 0, message: data.message, upgradeTo: data.upgradeTo ?? null,
      };
    }
    if (r.ok) {
      return {
        allowed: true, pro: !!data.pro, tier: (data.tier as Tier) ?? 'free', unlimited: !!data.unlimited,
        limit: data.limit ?? null, included: data.included ?? null, credits: data.credits ?? 0,
        used: data.used ?? 0, remaining: data.remaining ?? null, metered: data.metered,
      };
    }
  } catch { /* fall through */ }
  // fail-open
  return { allowed: true, pro: false, tier: 'free', unlimited: false, limit: 5, included: 5, credits: 0, used: 0, remaining: 5, metered: false };
}
