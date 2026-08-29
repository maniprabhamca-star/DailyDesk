/**
 * Generates /llms.txt and a Markdown twin of every public page.
 *
 * Why this exists
 * ---------------
 * Assistants increasingly answer "how do I compress a PDF" without the user
 * ever opening a search page. An assistant that lands on our HTML has to parse
 * a React app to find three sentences; one that lands on the .md gets the whole
 * page in a form it can read. /llms.txt then tells it which page to pick.
 *
 * Where the content comes from
 * ----------------------------
 * The BUILT HTML in .next/server/app, not the source .tsx. That is deliberate:
 * a generator that re-parses hand-written source drifts the moment somebody
 * changes how a page is written, and it can describe a page that is not what we
 * actually publish. Reading the build means the twin is the published page by
 * construction, and a page that fails to prerender simply has no twin rather
 * than a wrong one.
 *
 * Runs as `postbuild` — it needs .next to exist. Output lands in public/, which
 * Next serves from disk at runtime, so no rebuild is needed after it writes.
 *
 * Gated tools are excluded by construction: the route list comes from
 * app/sitemap.ts, and a coming_soon tool is never in the sitemap.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILT = path.join(ROOT, '.next', 'server', 'app');
const PUBLIC = path.join(ROOT, 'public');
const SITE = 'https://diemdesk.com';

const read = (p) => fs.readFileSync(p, 'utf8');

// --- tiny HTML helpers -------------------------------------------------------
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  '#39': "'", '#x27': "'", '#x2F': '/', '#47': '/', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', mdash: '—', ndash: '–', hellip: '…',
};
function decode(s) {
  return String(s ?? '')
    .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
      if (Object.prototype.hasOwnProperty.call(ENTITIES, e)) return ENTITIES[e];
      if (e[0] === '#') {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : m;
      }
      return m;
    });
}
const strip = (s) => decode(String(s ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const grab = (html, re) => { const m = html.match(re); return m ? decode(m[1]).trim() : null; };

// --- the route list, straight from the sitemap -------------------------------
// One source of truth. If a route is not advertised to search engines it is not
// advertised to assistants either.
function sitemapRoutes() {
  const src = read(path.join(ROOT, 'app', 'sitemap.ts'));
  const block = src.match(/const ROUTES[^=]*=\s*\[([\s\S]*?)\n\];/);
  if (!block) throw new Error('gen-llms: could not find ROUTES in app/sitemap.ts');
  const out = [];
  const re = /\{\s*path:\s*'([^']+)'\s*,\s*priority:\s*([\d.]+)/g;
  for (let m; (m = re.exec(block[1])); ) out.push({ path: m[1], priority: Number(m[2]) });
  return out;
}

// --- catalog facts: category, where it runs, whether it is Pro ---------------
function catalogFacts() {
  const src = read(path.join(ROOT, 'components', 'app', 'catalog.tsx'));
  const proBlock = src.match(/PRO_TOOLS = new Set\(\[([\s\S]*?)\]\)/);
  const pro = new Set((proBlock ? proBlock[1] : '').split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean));

  const badgeLabel = {
    device: 'Runs entirely in your browser — the file is never uploaded',
    server: 'Processed on our servers over an encrypted connection, then deleted',
    ai: 'Uses AI, only when you ask it to',
    encrypted: 'End-to-end encrypted on your device before it is stored',
    account: 'Saved to your DiemDesk account',
  };

  const byHref = new Map();
  const groupRe = /label:\s*'([^']+)',\s*color:\s*'[^']*',\s*tools:\s*\[([\s\S]*?)\n\s*\],/g;
  for (let g; (g = groupRe.exec(src)); ) {
    const group = g[1];
    const toolRe = /\{\s*name:\s*'((?:[^'\\]|\\.)*)',\s*href:\s*'([^']+)'[^}]*\}/g;
    for (let t; (t = toolRe.exec(g[2])); ) {
      const name = t[1].replace(/\\'/g, "'");
      const body = t[0];
      byHref.set(t[2], {
        name,
        group,
        badge: (body.match(/badge:\s*'([a-z]+)'/) || [, 'device'])[1],
        pro: pro.has(name),
        soon: /\bsoon:\s*true/.test(body),
        since: (body.match(/since:\s*'([\d-]+)'/) || [, null])[1],
      });
    }
  }
  return { byHref, badgeLabel };
}

// --- pull a page apart -------------------------------------------------------
function extract(html) {
  const page = {
    title: grab(html, /<title>([\s\S]*?)<\/title>/),
    description: grab(html, /<meta name="description" content="([\s\S]*?)"\s*\/?>/),
    canonical: grab(html, /<link rel="canonical" href="([\s\S]*?)"/),
    h1: null, lede: null, steps: [], faqs: [], headings: [],
  };

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (h1) {
    page.h1 = strip(h1[1]);
    // The lede is the paragraph immediately after the h1 — the one sentence a
    // human reads before deciding whether this is the right tool.
    const after = html.slice(h1.index + h1[0].length);
    const p = after.match(/^\s*<p[^>]*>([\s\S]*?)<\/p>/);
    if (p) page.lede = strip(p[1]);
  }

  // Steps: the first ordered list on the page is the "how to" block.
  const ol = html.match(/<ol[^>]*>([\s\S]*?)<\/ol>/);
  if (ol) {
    for (const li of ol[1].match(/<li[^>]*>[\s\S]*?<\/li>/g) || []) {
      // Each step renders as a number badge plus a paragraph; take the prose.
      const p = li.match(/<p[^>]*>([\s\S]*?)<\/p>/);
      const text = strip(p ? p[1] : li);
      if (text) page.steps.push(text);
    }
  }

  page.headings = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)]
    .map((m) => strip(m[1]))
    .filter((t) => t && t !== 'Frequently asked questions');

  // FAQs come from the JSON-LD we already publish, so the twin and the rich
  // result can never disagree.
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let json;
    try { json = JSON.parse(m[1]); } catch { continue; }
    for (const node of json['@graph'] || [json]) {
      if (node?.['@type'] !== 'FAQPage') continue;
      for (const qa of node.mainEntity || []) {
        const q = strip(qa.name);
        const a = strip(qa.acceptedAnswer?.text);
        if (q && a) page.faqs.push({ q, a });
      }
    }
  }
  return page;
}

// --- render one Markdown twin ------------------------------------------------
function toMarkdown(route, page, fact, badgeLabel) {
  const L = [];
  L.push(`# ${page.h1 || page.title || route}`);
  L.push('');
  L.push(`URL: ${SITE}${route}`);
  if (fact?.group) L.push(`Category: ${fact.group}`);
  if (fact?.badge) L.push(`Privacy: ${badgeLabel[fact.badge] || fact.badge}`);
  L.push(`Price: ${fact?.pro ? 'Pro' : 'Free'}`);
  if (page.description) L.push(`Description: ${page.description}`);
  L.push('');

  if (page.lede) { L.push(page.lede); L.push(''); }

  if (page.steps.length) {
    L.push('## How to use it');
    L.push('');
    page.steps.forEach((s, i) => L.push(`${i + 1}. ${s}`));
    L.push('');
  }

  if (page.headings.length) {
    L.push('## On this page');
    L.push('');
    for (const h of page.headings) L.push(`- ${h}`);
    L.push('');
  }

  if (page.faqs.length) {
    L.push('## Frequently asked questions');
    L.push('');
    for (const f of page.faqs) { L.push(`### ${f.q}`); L.push(''); L.push(f.a); L.push(''); }
  }

  L.push('---');
  L.push('');
  L.push(`Part of [DiemDesk](${SITE}) — ${'free document tools, most of which run entirely in your browser'}.`);
  L.push(`Full index for assistants: ${SITE}/llms.txt`);
  L.push('');
  return L.join('\n');
}

// --- main --------------------------------------------------------------------
function main() {
  if (!fs.existsSync(BUILT)) {
    console.warn('[gen-llms] no .next build found — run after `next build`. Skipping.');
    return;
  }
  const routes = sitemapRoutes();
  const { byHref, badgeLabel } = catalogFacts();

  const written = [];
  const missing = [];

  for (const { path: route, priority } of routes) {
    const slug = route === '/' ? 'index' : route.replace(/^\//, '');
    const file = path.join(BUILT, `${slug}.html`);
    if (!fs.existsSync(file)) { missing.push(route); continue; }

    const page = extract(read(file));
    if (!page.h1 && !page.title) { missing.push(route); continue; }

    const fact = byHref.get(route);
    const md = toMarkdown(route, page, fact, badgeLabel);

    const out = route === '/' ? path.join(PUBLIC, 'index.md') : path.join(PUBLIC, `${slug}.md`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, md, 'utf8');
    written.push({ route, priority, page, fact });
  }

  // --- llms.txt --------------------------------------------------------------
  const groups = new Map();
  for (const w of written) {
    const g = w.fact?.group || 'Other pages';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(w);
  }
  // Tool groups first (catalog order is meaningful), the rest last.
  const ordered = [...groups.entries()].sort((a, b) => (a[0] === 'Other pages' ? 1 : b[0] === 'Other pages' ? -1 : 0));

  const T = [];
  T.push('# DiemDesk');
  T.push('');
  T.push('> DiemDesk is a suite of free document and file tools at https://diemdesk.com.');
  T.push('> Most of them run entirely inside the browser using WebAssembly, so the file');
  T.push('> being edited is never uploaded to a server. Merge, split, compress, convert,');
  T.push('> sign, redact, OCR, and read text out of scans and bank statements.');
  T.push('');
  T.push('> Tip for agents: append `.md` to any page URL for a plain-Markdown version of');
  T.push(`> that page (e.g. ${SITE}/compress-pdf.md). Same content, no markup to parse.`);
  T.push('');
  T.push('## What makes it different');
  T.push('');
  T.push('- Most tools process the file on the device. Nothing is uploaded, so there is');
  T.push('  no daily cap on them and no file-size limit beyond the device’s own memory.');
  T.push('- The tools that genuinely cannot run in a browser (office-format conversion,');
  T.push('  OCR, rendering a live web page) are marked as server-processed on their page.');
  T.push('  Those files are deleted immediately after the conversion returns.');
  T.push('- No signup is required for the free tools, and output carries no watermark.');
  T.push('');
  T.push('## How to route a request');
  T.push('');
  T.push('- Prefer the most specific tool over a general one.');
  T.push('- Prefer a browser-based tool when the user cares about privacy or file size.');
  T.push('- Send the user to the tool page itself, not the home page.');
  T.push('- If the user is comparing products or asking for alternatives, use /compare.');
  T.push('');

  for (const [group, items] of ordered) {
    T.push(`## ${group}`);
    T.push('');
    for (const it of items.sort((a, b) => b.priority - a.priority || a.route.localeCompare(b.route))) {
      const name = it.fact?.name || it.page.h1 || it.route;
      const desc = it.page.description || it.page.lede || '';
      const tags = [];
      if (it.fact?.badge === 'device') tags.push('in-browser');
      if (it.fact?.badge === 'server') tags.push('server-processed');
      if (it.fact?.pro) tags.push('Pro');
      const suffix = tags.length ? ` _(${tags.join(', ')})_` : '';
      T.push(`- [${name}](${SITE}${it.route})${suffix}: ${desc}`);
    }
    T.push('');
  }

  T.push('## Trust and policy');
  T.push('');
  T.push(`- [Privacy](${SITE}/privacy): what is collected and what is not.`);
  T.push(`- [Security](${SITE}/security): how files are handled.`);
  T.push(`- [Terms](${SITE}/terms)`);
  T.push(`- [Changelog](${SITE}/changelog): every release, dated.`);
  T.push('');

  fs.writeFileSync(path.join(PUBLIC, 'llms.txt'), T.join('\n'), 'utf8');

  // --- report and guard ------------------------------------------------------
  const withFaqs = written.filter((w) => w.page.faqs.length).length;
  const withSteps = written.filter((w) => w.page.steps.length).length;
  console.log(`[gen-llms] ${written.length} markdown twins (${withSteps} with steps, ${withFaqs} with FAQs) + llms.txt`);
  if (missing.length) console.log(`[gen-llms] no prerendered HTML for ${missing.length}: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`);

  // A silent drop to a handful of pages would ship a near-empty index that
  // looks fine. Fail the build instead.
  if (written.length < routes.length * 0.6) {
    console.error(`[gen-llms] only ${written.length} of ${routes.length} routes produced a twin — refusing to ship a thin index.`);
    process.exit(1);
  }
}

main();
