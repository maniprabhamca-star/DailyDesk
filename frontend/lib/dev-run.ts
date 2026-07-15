// Client-side transform logic for the Dev & CSV pack. Everything runs in the
// browser — nothing is uploaded. Kept framework-free so it's trivially testable.

export type DiffLine = { t: 'same' | 'add' | 'del'; s: string };
export type DevResult = { text?: string; diff?: DiffLine[]; error?: string };
export type RunOpts = { a?: string; b?: string; mode?: string; algo?: string; count?: number };

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
      default: return { error: 'Unknown tool.' };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not process the input.' };
  }
}
