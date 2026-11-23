// Verify the sector data against the three things its own type comments promise:
// title <= 60, description <= 155, toolkit names that actually open a tool.
import { readFileSync, existsSync } from 'node:fs';

const src = readFileSync('lib/sectors.ts', 'utf8');
const cat = readFileSync('components/app/catalog.tsx', 'utf8');

const catNames = new Set([...cat.matchAll(/name: '([^']+)'/g)].map((m) => m[1]));
const catHrefs = new Set([...cat.matchAll(/href: '([^']+)'/g)].map((m) => m[1]));

// Split the SECTORS array into per-sector blocks on the slug boundary.
const blocks = src.split(/\n  \{\n    slug: '/).slice(1);
let bad = 0;
const seen = new Set();

for (const b of blocks) {
  const slug = b.slice(0, b.indexOf("'"));
  if (seen.has(slug)) { console.log(`DUPLICATE SLUG  ${slug}`); bad++; }
  seen.add(slug);

  const title = (b.match(/title: '([^']+)'/) || [])[1];
  const desc = (b.match(/description:\s*\n?\s*'([^']+)'/) || [])[1];
  const limits = (b.match(/limits: \[([\s\S]*?)\n    \]/) || [])[1] || '';
  const nLimits = [...limits.matchAll(/\n      '/g)].length;

  if (!title || title.length > 60) { console.log(`TITLE ${title?.length} > 60   ${slug}  "${title}"`); bad++; }
  if (!desc || desc.length > 155) { console.log(`DESC  ${desc?.length} > 155  ${slug}`); bad++; }
  if (nLimits < 3) { console.log(`LIMITS only ${nLimits}   ${slug}  (every page must have real ones)`); bad++; }

  // toolkit names must match the catalog exactly
  const toolkit = (b.match(/toolkit: \[([^\]]+)\]/) || [])[1] || '';
  for (const m of toolkit.matchAll(/'([^']+)'/g)) {
    if (!catNames.has(m[1])) { console.log(`TOOLKIT not in catalog  ${slug}: "${m[1]}"`); bad++; }
  }

  // every job + primary href must be a route the catalog knows AND a real page dir.
  //
  // The `forms` href is the one exception and it is deliberately narrow: it
  // points at a FORM LIBRARY, which is a page, not a tool, so it can never be
  // in the catalogue. It is held to the other half of the rule (a real page)
  // plus an allowlist, so the exception cannot quietly become "any href".
  const FORM_LIBRARIES = new Set(['/us-forms', '/india-forms']);
  const formsHref = (b.match(/forms: \{[^}]*href: '([^']+)'/) || [])[1];
  const hrefs = [...b.matchAll(/href: '([^']+)'/g)].map((m) => m[1]);
  for (const h of new Set(hrefs)) {
    const isLibrary = h === formsHref;
    if (isLibrary && !FORM_LIBRARIES.has(h)) { console.log(`FORMS href unknown      ${slug}: ${h}`); bad++; }
    if (!isLibrary && !catHrefs.has(h)) { console.log(`HREF not in catalog     ${slug}: ${h}`); bad++; }
    if (!existsSync(`app${h}/page.tsx`)) { console.log(`HREF has no page.tsx    ${slug}: app${h}/page.tsx`); bad++; }
  }

  // job tool labels must match the catalog too
  for (const m of b.matchAll(/tool: '([^']+)'/g)) {
    if (!catNames.has(m[1])) { console.log(`JOB TOOL not in catalog ${slug}: "${m[1]}"`); bad++; }
  }
}

console.log(`\nsectors=${blocks.length} problems=${bad}`);
process.exit(bad ? 1 : 0);
