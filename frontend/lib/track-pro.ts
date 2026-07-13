const API = process.env.NEXT_PUBLIC_API_URL || '';

// Fire-and-forget: mark that a signed-in (Pro) user actually RAN a Pro-only
// feature — e.g. on-device batch — as opposed to merely opening a tool page.
// Feeds the `pro_used` event the owner can check for refund decisions
// ("did this Pro subscriber use Pro since they paid?"). Never blocks or throws.
export function trackProUse(feature: string) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null;
    if (!token) return; // only meaningful for a signed-in subscriber
    fetch(`${API}/api/events/track`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ module: feature, pro: true }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
