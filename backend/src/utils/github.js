// Auto-DRAFT step of self-healing: when a tool breaks, open a GitHub Issue with
// the diagnostic so there's a tracked, actionable ticket (not just an email).
//
// Dormant until GITHUB_TOKEN + GITHUB_REPO are set — so this ships safely and
// activates when the owner adds a fine-grained token (Issues: read+write).
// It NEVER writes code or opens a PR — a human does the fix. Dedupes so a tool
// that stays down doesn't pile up duplicate issues. Never throws.

const TOKEN = process.env.GITHUB_TOKEN || '';
const REPO = process.env.GITHUB_REPO || 'maniprabhamca-star/DailyDesk';
const API = 'https://api.github.com';

async function gh(pathname, opts = {}) {
  const r = await fetch(`${API}${pathname}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'diemdesk-canary',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`github ${r.status}: ${(await r.text()).slice(0, 150)}`);
  return r.json();
}

/** Open an incident issue for a tool, unless one is already open. Returns a
 * status string: 'opened' | 'exists' | 'skip-no-token' | 'error'. */
async function openIncidentIssue(tool, title, body) {
  if (!TOKEN) return 'skip-no-token';
  try {
    const q = encodeURIComponent(`repo:${REPO} is:issue is:open label:canary-incident ${tool} in:title`);
    const found = await gh(`/search/issues?q=${q}`);
    if (found.total_count > 0) return 'exists'; // don't pile up dupes while it's down
    await gh(`/repos/${REPO}/issues`, {
      method: 'POST',
      body: JSON.stringify({ title, body, labels: ['canary-incident'] }),
    });
    return 'opened';
  } catch (e) {
    console.error('[github] issue failed:', e.message);
    return 'error';
  }
}

module.exports = { openIncidentIssue };
