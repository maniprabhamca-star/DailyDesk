// Client-side transform logic for the Dev & CSV pack. Everything runs in the
// browser — nothing is uploaded. Kept framework-free so it's trivially testable.

export type DiffLine = { t: 'same' | 'add' | 'del'; s: string };
export type DevResult = { text?: string; diff?: DiffLine[]; error?: string };
export type RunOpts = { a?: string; b?: string; mode?: string; algo?: string; count?: number; pattern?: string; flags?: string };

// ── encode / decode ──────────────────────────────────────────────────────
const b64encode = (s: string) => btoa(unescape(encodeURIComponent(s)));
const b64decode = (s: string) => decodeURIComponent(escape(atob(s.replace(/\s+/g, ''))));

const HTML_ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const htmlEscape = (s: string) => s.replace(/[&<>"']/g, (c) => HTML_ESC[c]);
function htmlUnescape(s: string): string {
  return s
    .replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|#39);/gi, (m, e) => {
      const l = e.toLowerCase();
      if (l === 'amp') return '&'; if (l === 'lt') return '<'; if (l === 'gt') return '>';
      if (l === 'quot') return '"'; if (l === 'apos' || l === '#39') return "'";
      if (l[0] === '#') { const n = l[1] === 'x' ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
      return m;
    });
}

// ── hashing ────────────────────────────────────────────────────────────────
async function shaHex(algo: string, text: string): Promise<string> {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
// Compact MD5 (public-domain algorithm) — WebCrypto doesn't provide MD5.
function md5(str: string): string {
  function toUtf8(s: string) { return unescape(encodeURIComponent(s)); }
  function rl(n: number, c: number) { return (n << c) | (n >>> (32 - c)); }
  function add(a: number, b: number) { const l = (a & 0xffff) + (b & 0xffff); return (((a >> 16) + (b >> 16) + (l >> 16)) << 16) | (l & 0xffff); }
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) { return add(rl(add(add(a, q), add(x, t)), s), b); }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
  const s = toUtf8(str);
  const n = s.length;
  const words: number[] = [];
  for (let i = 0; i < n * 8; i += 8) words[i >> 5] |= (s.charCodeAt(i / 8) & 0xff) << (i % 32);
  words[n >> 2] |= 0x80 << ((n % 4) * 8);
  words[(((n + 8) >> 6) + 1) * 16 - 2] = n * 8;
  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  for (let i = 0; i < words.length; i += 16) {
    const oa = a, ob = b, oc = c, od = d; const w = (k: number) => words[i + k] | 0;
    a = ff(a, b, c, d, w(0), 7, -680876936); d = ff(d, a, b, c, w(1), 12, -389564586); c = ff(c, d, a, b, w(2), 17, 606105819); b = ff(b, c, d, a, w(3), 22, -1044525330);
    a = ff(a, b, c, d, w(4), 7, -176418897); d = ff(d, a, b, c, w(5), 12, 1200080426); c = ff(c, d, a, b, w(6), 17, -1473231341); b = ff(b, c, d, a, w(7), 22, -45705983);
    a = ff(a, b, c, d, w(8), 7, 1770035416); d = ff(d, a, b, c, w(9), 12, -1958414417); c = ff(c, d, a, b, w(10), 17, -42063); b = ff(b, c, d, a, w(11), 22, -1990404162);
    a = ff(a, b, c, d, w(12), 7, 1804603682); d = ff(d, a, b, c, w(13), 12, -40341101); c = ff(c, d, a, b, w(14), 17, -1502002290); b = ff(b, c, d, a, w(15), 22, 1236535329);
    a = gg(a, b, c, d, w(1), 5, -165796510); d = gg(d, a, b, c, w(6), 9, -1069501632); c = gg(c, d, a, b, w(11), 14, 643717713); b = gg(b, c, d, a, w(0), 20, -373897302);
    a = gg(a, b, c, d, w(5), 5, -701558691); d = gg(d, a, b, c, w(10), 9, 38016083); c = gg(c, d, a, b, w(15), 14, -660478335); b = gg(b, c, d, a, w(4), 20, -405537848);
    a = gg(a, b, c, d, w(9), 5, 568446438); d = gg(d, a, b, c, w(14), 9, -1019803690); c = gg(c, d, a, b, w(3), 14, -187363961); b = gg(b, c, d, a, w(8), 20, 1163531501);
    a = gg(a, b, c, d, w(13), 5, -1444681467); d = gg(d, a, b, c, w(2), 9, -51403784); c = gg(c, d, a, b, w(7), 14, 1735328473); b = gg(b, c, d, a, w(12), 20, -1926607734);
    a = hh(a, b, c, d, w(5), 4, -378558); d = hh(d, a, b, c, w(8), 11, -2022574463); c = hh(c, d, a, b, w(11), 16, 1839030562); b = hh(b, c, d, a, w(14), 23, -35309556);
    a = hh(a, b, c, d, w(1), 4, -1530992060); d = hh(d, a, b, c, w(4), 11, 1272893353); c = hh(c, d, a, b, w(7), 16, -155497632); b = hh(b, c, d, a, w(10), 23, -1094730640);
    a = hh(a, b, c, d, w(13), 4, 681279174); d = hh(d, a, b, c, w(0), 11, -358537222); c = hh(c, d, a, b, w(3), 16, -722521979); b = hh(b, c, d, a, w(6), 23, 76029189);
    a = hh(a, b, c, d, w(9), 4, -640364487); d = hh(d, a, b, c, w(12), 11, -421815835); c = hh(c, d, a, b, w(15), 16, 530742520); b = hh(b, c, d, a, w(2), 23, -995338651);
    a = ii(a, b, c, d, w(0), 6, -198630844); d = ii(d, a, b, c, w(7), 10, 1126891415); c = ii(c, d, a, b, w(14), 15, -1416354905); b = ii(b, c, d, a, w(5), 21, -57434055);
    a = ii(a, b, c, d, w(12), 6, 1700485571); d = ii(d, a, b, c, w(3), 10, -1894986606); c = ii(c, d, a, b, w(10), 15, -1051523); b = ii(b, c, d, a, w(1), 21, -2054922799);
    a = ii(a, b, c, d, w(8), 6, 1873313359); d = ii(d, a, b, c, w(15), 10, -30611744); c = ii(c, d, a, b, w(6), 15, -1560198380); b = ii(b, c, d, a, w(13), 21, 1309151649);
    a = ii(a, b, c, d, w(4), 6, -145523070); d = ii(d, a, b, c, w(11), 10, -1120210379); c = ii(c, d, a, b, w(2), 15, 718787259); b = ii(b, c, d, a, w(9), 21, -343485551);
    a = add(a, oa); b = add(b, ob); c = add(c, oc); d = add(d, od);
  }
  const hex = (num: number) => { let out = ''; for (let i = 0; i < 4; i++) out += ((num >> (i * 8)) & 0xff).toString(16).padStart(2, '0'); return out; };
  return hex(a) + hex(b) + hex(c) + hex(d);
}

// ── JWT ──────────────────────────────────────────────────────────────────
function b64urlDecode(s: string): string | null {
  try { const p = s.replace(/-/g, '+').replace(/_/g, '/'); return decodeURIComponent(escape(atob(p + '==='.slice((p.length + 3) % 4)))); } catch { return null; }
}

// ── CSV ↔ JSON ─────────────────────────────────────────────────────────────
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.length && !(r.length === 1 && r[0] === ''));
}
const csvCell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

// ── line diff (LCS) ─────────────────────────────────────────────────────────
function lineDiff(aStr: string, bStr: string): DiffLine[] {
  const a = aStr.split('\n'), b = bStr.split('\n'), n = a.length, m = b.length;
  if (n * m > 4_000_000) { // fall back to a cheap index diff on huge inputs
    const out: DiffLine[] = []; const max = Math.max(n, m);
    for (let i = 0; i < max; i++) { if (a[i] === b[i]) out.push({ t: 'same', s: a[i] }); else { if (i < n) out.push({ t: 'del', s: a[i] }); if (i < m) out.push({ t: 'add', s: b[i] }); } }
    return out;
  }
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLine[] = []; let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { out.push({ t: 'same', s: a[i] }); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: 'del', s: a[i++] }); } else { out.push({ t: 'add', s: b[j++] }); } }
  while (i < n) out.push({ t: 'del', s: a[i++] });
  while (j < m) out.push({ t: 'add', s: b[j++] });
  return out;
}

// ── text helpers ────────────────────────────────────────────────────────────
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const toWords = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
function relTime(ms: number): string {
  const diff = ms - Date.now(); const abs = Math.abs(diff); const fut = diff > 0;
  const u: [number, string][] = [[31536e6, 'year'], [2592e6, 'month'], [864e5, 'day'], [36e5, 'hour'], [6e4, 'minute'], [1e3, 'second']];
  for (const [ms1, name] of u) { if (abs >= ms1) { const n = Math.round(abs / ms1); return `${n} ${name}${n === 1 ? '' : 's'} ${fut ? 'from now' : 'ago'}`; } }
  return 'just now';
}

// ── JSON ↔ YAML (compact, common-subset) ────────────────────────────────────
function toYaml(v: unknown, ind = 0): string {
  const p = '  '.repeat(ind);
  const scalar = (x: unknown): string => {
    if (x === null || x === undefined) return 'null';
    if (typeof x === 'boolean' || typeof x === 'number') return String(x);
    const s = String(x);
    return s === '' || /[:#\-?*&!|>'"%@`,{}\[\]]/.test(s) || /^\s|\s$/.test(s) || /^(true|false|null|~|\d)/i.test(s) ? JSON.stringify(s) : s;
  };
  if (v === null || typeof v !== 'object') return scalar(v);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    return v.map((it) => {
      if (it !== null && typeof it === 'object' && Object.keys(it).length) {
        const body = toYaml(it, ind + 1);
        return body.split('\n').map((ln, i) => (i === 0 ? p + '- ' + ln.slice((ind + 1) * 2) : ln)).join('\n');
      }
      return p + '- ' + scalar(it);
    }).join('\n');
  }
  const keys = Object.keys(v as Record<string, unknown>);
  if (!keys.length) return '{}';
  return keys.map((k) => {
    const val = (v as Record<string, unknown>)[k];
    if (val !== null && typeof val === 'object' && Object.keys(val).length) return `${p}${k}:\n${toYaml(val, ind + 1)}`;
    return `${p}${k}: ${scalar(val)}`;
  }).join('\n');
}
function yScalar(s: string): unknown {
  const t = s.trim();
  if (t === '' || t === '~' || t === 'null') return null;
  if (t === 'true') return true; if (t === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if ((t[0] === '"' && t.endsWith('"')) || (t[0] === "'" && t.endsWith("'"))) { try { return JSON.parse(t[0] === "'" ? `"${t.slice(1, -1).replace(/"/g, '\\"')}"` : t); } catch { return t.slice(1, -1); } }
  return t;
}
function yamlParse(src: string): unknown {
  const lines = src.replace(/\t/g, '  ').split('\n').filter((l) => l.trim() !== '' && !/^\s*#/.test(l));
  let i = 0;
  const indentOf = (l: string) => l.length - l.trimStart().length;
  // A block's indent = the indent of its first line; siblings share it exactly,
  // and any deeper line belongs to a nested child (parsed recursively).
  function parseBlock(): unknown {
    const base = indentOf(lines[i]);
    if (lines[i].trimStart().startsWith('- ') || lines[i].trim() === '-') {
      const arr: unknown[] = [];
      while (i < lines.length && indentOf(lines[i]) === base && (lines[i].trimStart().startsWith('- ') || lines[i].trim() === '-')) {
        const rest = lines[i].trim() === '-' ? '' : lines[i].trimStart().slice(2);
        if (rest.trim() === '') { i++; arr.push(i < lines.length && indentOf(lines[i]) > base ? parseBlock() : null); }
        else if (/^[\w.$-]+:(\s|$)/.test(rest)) { lines[i] = ' '.repeat(base + 2) + rest; arr.push(parseBlock()); }
        else { i++; arr.push(yScalar(rest)); }
      }
      return arr;
    }
    const obj: Record<string, unknown> = {};
    while (i < lines.length && indentOf(lines[i]) === base && !lines[i].trimStart().startsWith('- ')) {
      const m = lines[i].trim().match(/^([^:]+):\s*(.*)$/); if (!m) { i++; continue; }
      const key = m[1].trim().replace(/^["']|["']$/g, ''); const val = m[2];
      if (val.trim() === '') { i++; obj[key] = i < lines.length && indentOf(lines[i]) > base ? parseBlock() : null; }
      else { i++; obj[key] = yScalar(val); }
    }
    return obj;
  }
  return i < lines.length ? parseBlock() : null;
}

const LOREM = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(' ');

export async function runDev(slug: string, o: RunOpts): Promise<DevResult> {
  const a = o.a ?? '';
  try {
    switch (slug) {
      case 'base64': return { text: a ? (o.mode === 'Decode' ? b64decode(a) : b64encode(a)) : '' };
      case 'url-encode': return { text: a ? (o.mode === 'Decode' ? decodeURIComponent(a) : encodeURIComponent(a)) : '' };
      case 'html-entities': return { text: a ? (o.mode === 'Unescape' ? htmlUnescape(a) : htmlEscape(a)) : '' };
      case 'hash-generator': {
        if (!a) return { text: '' };
        const algo = o.algo || 'SHA-256';
        return { text: algo === 'MD5' ? md5(a) : await shaHex(algo, a) };
      }
      case 'jwt-decoder': {
        const parts = a.trim().split('.');
        if (a.trim() === '') return { text: '' };
        if (parts.length < 2) return { error: 'Not a JWT — expected three dot-separated parts.' };
        const h = b64urlDecode(parts[0]), p = b64urlDecode(parts[1]);
        if (!h || !p) return { error: 'Could not decode — the header/payload isn’t valid Base64URL.' };
        const pretty = (s: string) => { try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; } };
        return { text: `── header ──\n${pretty(h)}\n\n── payload ──\n${pretty(p)}` };
      }
      case 'uuid-generator': {
        const n = Math.max(1, Math.min(1000, o.count || 5));
        const gen = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); }));
        return { text: Array.from({ length: n }, gen).join('\n') };
      }
      case 'csv-to-json': {
        if (!a.trim()) return { text: '' };
        if (o.mode === 'JSON → CSV') {
          const data = JSON.parse(a);
          const arr = Array.isArray(data) ? data : [data];
          const keys: string[] = []; arr.forEach((r: Record<string, unknown>) => Object.keys(r || {}).forEach((k) => { if (!keys.includes(k)) keys.push(k); }));
          const lines = [keys.map(csvCell).join(',')].concat(arr.map((r: Record<string, unknown>) => keys.map((k) => csvCell(r?.[k])).join(',')));
          return { text: lines.join('\n') };
        }
        const rows = parseCsv(a);
        if (rows.length < 1) return { text: '[]' };
        const head = rows[0];
        const objs = rows.slice(1).map((r) => { const o2: Record<string, string> = {}; head.forEach((h, i) => { o2[h] = r[i] ?? ''; }); return o2; });
        return { text: JSON.stringify(objs, null, 2) };
      }
      case 'text-diff': return { diff: lineDiff(a, o.b ?? '') };

      case 'timestamp-converter': {
        if (!a.trim()) return { text: '' };
        if (o.mode === 'Date → Unix') {
          const d = new Date(a.trim());
          if (isNaN(d.getTime())) return { error: 'Could not parse that date. Try an ISO date like 2026-07-14T18:30:00Z.' };
          return { text: `Unix (seconds):  ${Math.floor(d.getTime() / 1000)}\nUnix (millis):   ${d.getTime()}\nISO (UTC):       ${d.toISOString()}` };
        }
        const num = Number(a.trim());
        if (!Number.isFinite(num)) return { error: 'Enter a Unix timestamp (seconds or milliseconds).' };
        const ms = Math.abs(num) >= 1e12 ? num : num * 1000;
        const d = new Date(ms);
        if (isNaN(d.getTime())) return { error: 'That timestamp is out of range.' };
        return { text: `Local:     ${d.toString()}\nUTC:       ${d.toUTCString()}\nISO:       ${d.toISOString()}\nRelative:  ${relTime(ms)}` };
      }
      case 'json-to-yaml': {
        if (!a.trim()) return { text: '' };
        if (o.mode === 'YAML → JSON') return { text: JSON.stringify(yamlParse(a), null, 2) };
        return { text: toYaml(JSON.parse(a)) };
      }
      case 'csv-cleaner': {
        if (!a.trim()) return { text: '' };
        const seen = new Set<string>(); const out: string[] = [];
        for (const r of parseCsv(a)) {
          const trimmed = r.map((c) => c.trim());
          if (trimmed.every((c) => c === '')) continue;
          const key = trimmed.join(''); if (seen.has(key)) continue; seen.add(key);
          out.push(trimmed.map(csvCell).join(','));
        }
        return { text: out.join('\n') };
      }
      case 'case-converter': {
        if (!a) return { text: '' };
        const low = toWords(a).map((w) => w.toLowerCase());
        switch (o.mode) {
          case 'UPPERCASE': return { text: a.toUpperCase() };
          case 'lowercase': return { text: a.toLowerCase() };
          case 'Title Case': return { text: low.map(cap).join(' ') };
          case 'camelCase': return { text: low.map((w, i) => (i ? cap(w) : w)).join('') };
          case 'snake_case': return { text: low.join('_') };
          case 'kebab-case': return { text: low.join('-') };
          default: return { text: low.map(cap).join(' ') };
        }
      }
      case 'slugify': return { text: a.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') };
      case 'sort-lines': {
        let lines = a.split('\n');
        switch (o.mode) {
          case 'Z → A': lines = [...lines].sort((x, y) => y.localeCompare(x)); break;
          case 'Unique': { const s = new Set<string>(); lines = lines.filter((l) => (s.has(l) ? false : (s.add(l), true))); break; }
          case 'Reverse': lines = [...lines].reverse(); break;
          default: lines = [...lines].sort((x, y) => x.localeCompare(y)); break; // A → Z
        }
        return { text: lines.join('\n') };
      }
      case 'regex-tester': {
        if (!o.pattern) return { text: '' };
        let re: RegExp;
        const flags = (o.flags || '').replace(/[^gimsuy]/g, '');
        try { re = new RegExp(o.pattern, flags.includes('g') ? flags : flags + 'g'); } catch (e) { return { error: `Invalid regex: ${e instanceof Error ? e.message : ''}` }; }
        const lines: string[] = []; let m: RegExpExecArray | null; let n = 0;
        while ((m = re.exec(a)) !== null) {
          n++;
          lines.push(`Match ${n} @${m.index}: ${JSON.stringify(m[0])}${m.length > 1 ? `   groups: ${JSON.stringify(m.slice(1))}` : ''}`);
          if (m.index === re.lastIndex) re.lastIndex++;
          if (n >= 2000) break;
        }
        return { text: n ? `${n} match${n === 1 ? '' : 'es'}\n\n${lines.join('\n')}` : 'No matches.' };
      }
      case 'lorem-ipsum': {
        const n = Math.max(1, Math.min(50, o.count || 3));
        const para = () => { const len = 24 + Math.floor(Math.random() * 36); const w = Array.from({ length: len }, () => LOREM[(Math.random() * LOREM.length) | 0]); return cap(w[0]) + ' ' + w.slice(1).join(' ') + '.'; };
        return { text: Array.from({ length: n }, para).join('\n\n') };
      }

      default: return { error: 'Unknown tool.' };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not process the input.' };
  }
}
