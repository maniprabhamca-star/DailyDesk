// RFC 9116 security.txt — the file a researcher looks for before they email
// anyone. Served from a route rather than /public so Expires can be generated
// rather than hand-maintained: a security.txt whose Expires date has passed is
// treated as stale, and hand-written dates are exactly the kind that rot.

export const dynamic = 'force-static';
export const revalidate = 86400;

const SITE = 'https://diemdesk.com';

export function GET() {
  // A year out, rounded to the day so the response is stable across rebuilds
  // within the same day rather than changing on every request.
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  expires.setUTCHours(0, 0, 0, 0);

  const body = [
    '# DiemDesk — security contact',
    '# Full policy, scope and safe-harbour terms:',
    `# ${SITE}/vulnerability-disclosure`,
    '',
    'Contact: mailto:security@diemdesk.com',
    `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, 'Z')}`,
    'Preferred-Languages: en',
    `Canonical: ${SITE}/.well-known/security.txt`,
    `Policy: ${SITE}/vulnerability-disclosure`,
    '',
    '# The report we most want: evidence that an in-browser tool transmits file',
    '# content anywhere. That is our central claim, and we treat a break of it',
    '# as critical.',
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
