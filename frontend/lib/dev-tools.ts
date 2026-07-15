// Registry for the Dev & CSV utilities pack. Pure data (server + client safe) —
// the actual transform logic lives in lib/dev-run.ts (client-only: uses btoa,
// crypto, etc.). Each tool is its own SEO keyword page, all rendered by the one
// shared DevToolShell so the pack stays consistent and uncluttered.

export type DevKind = 'transform' | 'generate' | 'inspect' | 'diff';
export type DevGroup = 'Encode & decode' | 'Hash & token' | 'IDs & time' | 'Data & CSV' | 'Text';

export type DevTool = {
  slug: string;            // route + run key, e.g. 'base64'
  name: string;            // short catalog/hub name
  tagline: string;         // one-line what-it-does (hub card + tool subtitle)
  group: DevGroup;
  glyph: string;           // tiny mono glyph for icons (no icon font needed)
  kind: DevKind;
  built: boolean;          // route exists (else "soon" in the hub/catalog)
  seoTitle: string;        // <=60
  seoDesc: string;         // <=155
  h1: string;
  modes?: string[];        // segmented options (e.g. ['Encode','Decode'])
  algos?: string[];        // for hash: algorithm choices
  count?: boolean;         // generate tools: show a "how many" input
  inLabel?: string; outLabel?: string; inLabelB?: string;
  sampleA?: string; sampleB?: string;
  intro: string;           // visible how-to/why paragraph (keyword depth)
  faq: { q: string; a: string }[];
};

export const DEV_TOOLS: DevTool[] = [
  {
    slug: 'base64', name: 'Base64', tagline: 'Encode / decode text to Base64', group: 'Encode & decode', glyph: '64',
    kind: 'transform', built: true, modes: ['Encode', 'Decode'],
    seoTitle: 'Base64 Encode & Decode — Free Online | DiemDesk',
    seoDesc: 'Encode text to Base64 or decode it back, free and instantly in your browser. Nothing is uploaded — your data never leaves your device.',
    h1: 'Base64 encode & decode', sampleA: 'DiemDesk — private by design',
    intro: 'Base64 turns text (or binary) into a plain-ASCII string that is safe to drop into URLs, JSON, data-URIs and emails. Paste your text to encode it, or paste a Base64 string to decode it back — it runs entirely in your browser, so nothing is ever uploaded.',
    faq: [
      { q: 'Is my data uploaded?', a: 'No. Encoding and decoding happen entirely in your browser with the built-in atob/btoa — your text never leaves your device.' },
      { q: 'Does it handle Unicode / emoji?', a: 'Yes. Text is UTF-8 encoded first, so accented characters and emoji round-trip correctly.' },
    ],
  },
  {
    slug: 'url-encode', name: 'URL encode', tagline: 'Percent-encode / decode URLs', group: 'Encode & decode', glyph: '%',
    kind: 'transform', built: true, modes: ['Encode', 'Decode'],
    seoTitle: 'URL Encode & Decode Online — Free | DiemDesk',
    seoDesc: 'Percent-encode a URL or query string, or decode one back, free in your browser. Handles spaces, &, ? and Unicode. Nothing is uploaded.',
    h1: 'URL encode & decode', sampleA: 'https://diemdesk.com/search?q=free pdf tools & more',
    intro: 'URL-encoding (percent-encoding) escapes characters that have special meaning in a URL — spaces, &, ?, # and non-ASCII text — so links and query strings stay valid. Paste a URL to encode it, or an encoded string to decode it, all on your device.',
    faq: [
      { q: 'encodeURIComponent or encodeURI?', a: 'This tool uses encodeURIComponent, which escapes query-string values fully (including & = ? /). It is the right choice for encoding a single parameter value.' },
      { q: 'Is anything sent to a server?', a: 'No — it runs in your browser, so the URL you paste never leaves your device.' },
    ],
  },
  {
    slug: 'html-entities', name: 'HTML entities', tagline: 'Escape / unescape HTML', group: 'Encode & decode', glyph: '&',
    kind: 'transform', built: true, modes: ['Escape', 'Unescape'],
    seoTitle: 'HTML Entity Encode & Decode — Free | DiemDesk',
    seoDesc: 'Escape HTML special characters (< > & " ’) to entities, or unescape them back, free in your browser. Prevent broken markup and XSS. Nothing uploaded.',
    h1: 'HTML entity encode & decode', sampleA: '<a href="?a=1&b=2">Tom & "Jerry"</a>',
    intro: 'Escaping converts characters that browsers treat as markup — <, >, &, " and ’ — into safe HTML entities so they display as text instead of breaking your page (or enabling injection). Paste markup to escape it, or entities to turn them back into characters.',
    faq: [
      { q: 'When do I need this?', a: 'Whenever you show user-supplied text inside HTML — escaping &, < and > prevents broken layout and cross-site-scripting (XSS).' },
      { q: 'Does it run offline?', a: 'Yes, it is 100% in-browser, so it works offline and never uploads your text.' },
    ],
  },
  {
    slug: 'hash-generator', name: 'Hash generator', tagline: 'MD5, SHA-1, SHA-256, SHA-512', group: 'Hash & token', glyph: '#',
    kind: 'transform', built: true, algos: ['MD5', 'SHA-1', 'SHA-256', 'SHA-512'],
    seoTitle: 'Hash Generator — MD5, SHA-1, SHA-256 Free | DiemDesk',
    seoDesc: 'Generate MD5, SHA-1, SHA-256 and SHA-512 hashes of any text, free and in your browser. Computed on your device — your input is never uploaded.',
    h1: 'Hash generator (MD5 & SHA)', sampleA: 'hash me',
    intro: 'A hash is a fixed-length fingerprint of your input — the same text always produces the same hash, and any change produces a completely different one. Pick an algorithm and type your text to get its MD5, SHA-1, SHA-256 or SHA-512 digest, computed locally with the browser’s WebCrypto (MD5 in pure JS).',
    faq: [
      { q: 'Is my input sent anywhere?', a: 'No. SHA hashes use the browser’s built-in WebCrypto and MD5 runs in pure JavaScript — everything stays on your device.' },
      { q: 'Which should I use?', a: 'Use SHA-256 for integrity checks. MD5 and SHA-1 are fine for non-security checksums but are considered broken for cryptographic use.' },
    ],
  },
  {
    slug: 'jwt-decoder', name: 'JWT decoder', tagline: 'Read a JWT’s header & payload', group: 'Hash & token', glyph: 'JW',
    kind: 'inspect', built: true,
    seoTitle: 'JWT Decoder — Read a JWT Online, Free | DiemDesk',
    seoDesc: 'Decode a JSON Web Token to read its header and payload, free and in your browser. Your token is never uploaded — safe to inspect real tokens.',
    h1: 'JWT decoder', inLabel: 'Paste a JWT', outLabel: 'Decoded',
    sampleA: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvcmRhbiBSaXZlcmEiLCJwcm8iOnRydWUsImlhdCI6MTcxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30',
    intro: 'A JWT (JSON Web Token) has three dot-separated parts: a header, a payload of claims, and a signature. This decoder Base64URL-decodes the header and payload so you can read what a token contains. It does not verify the signature — and critically, it never sends your token anywhere, so it is safe to paste real tokens.',
    faq: [
      { q: 'Is it safe to paste a real token?', a: 'Yes. Decoding happens entirely in your browser — the token is never uploaded or logged.' },
      { q: 'Does it verify the signature?', a: 'No. It only decodes the header and payload for inspection. Verifying a signature requires the secret/key and should be done server-side.' },
    ],
  },
  {
    slug: 'uuid-generator', name: 'UUID generator', tagline: 'Random v4 UUIDs, one or many', group: 'IDs & time', glyph: 'ID',
    kind: 'generate', built: true, count: true, outLabel: 'UUIDs',
    seoTitle: 'UUID Generator — Random v4 UUIDs, Free | DiemDesk',
    seoDesc: 'Generate random version-4 UUIDs (one or many at once) free in your browser, using a cryptographically-strong source. Copy with one click.',
    h1: 'UUID generator (v4)',
    intro: 'A UUID is a 128-bit identifier that is practically guaranteed to be unique without a central authority. This generator produces cryptographically-random version-4 UUIDs using the browser’s crypto API — generate one or a whole batch and copy them in a click.',
    faq: [
      { q: 'Are these random enough for production?', a: 'Yes. They use crypto.randomUUID (a cryptographically-strong source), the same standard used server-side.' },
      { q: 'Do they repeat?', a: 'A v4 UUID has 122 random bits, so a collision is astronomically unlikely — you can treat them as unique.' },
    ],
  },
  {
    slug: 'csv-to-json', name: 'CSV ↔ JSON', tagline: 'Convert CSV to JSON and back', group: 'Data & CSV', glyph: '⇄',
    kind: 'transform', built: true, modes: ['CSV → JSON', 'JSON → CSV'],
    seoTitle: 'CSV to JSON Converter — Free Online | DiemDesk',
    seoDesc: 'Convert CSV to a clean JSON array, or JSON back to CSV, free in your browser. Quoted fields and commas handled. Your data is never uploaded.',
    h1: 'CSV ↔ JSON converter', inLabel: 'Input', outLabel: 'Output',
    sampleA: 'name,role,city\nJordan Rivera,Founder,Atlanta\nSam Lee,Design,"Austin, TX"',
    intro: 'Turn CSV rows into a JSON array of objects (using the first row as keys), or convert a JSON array back into CSV. Quoted fields, embedded commas and newlines are handled. Everything runs in your browser, so your spreadsheet data never leaves your device.',
    faq: [
      { q: 'Does it handle quoted commas?', a: 'Yes. Fields wrapped in double quotes can contain commas, quotes and line breaks — they are parsed correctly per RFC 4180.' },
      { q: 'Is my data uploaded?', a: 'No — parsing happens entirely in your browser, so your CSV/JSON never leaves your device.' },
    ],
  },
  {
    slug: 'text-diff', name: 'Text diff', tagline: 'Compare two texts line by line', group: 'Text', glyph: '±',
    kind: 'diff', built: true, inLabel: 'Original', inLabelB: 'Changed', outLabel: 'Diff',
    seoTitle: 'Text Diff — Compare Two Texts Online, Free | DiemDesk',
    seoDesc: 'Compare two blocks of text and see added and removed lines highlighted, free in your browser. Nothing is uploaded — compare private text safely.',
    h1: 'Text diff — compare two texts',
    sampleA: 'alpha\nbeta\ngamma\ndelta', sampleB: 'alpha\nbeta 2\ngamma\nepsilon\ndelta',
    intro: 'Paste two versions of a text to see what changed — removed lines are marked in red, added lines in green, unchanged lines stay plain. It is handy for config files, copy revisions or code snippets, and it runs entirely on your device.',
    faq: [
      { q: 'Is it line-based or character-based?', a: 'This is a line-by-line diff — it shows which whole lines were added or removed, which is ideal for config and prose.' },
      { q: 'Is my text uploaded?', a: 'No. The comparison runs in your browser, so both texts stay private.' },
    ],
  },

  // ── planned (hub shows them, routes land in the next batch) ──
  { slug: 'timestamp-converter', name: 'Timestamp', tagline: 'Unix epoch ↔ date', group: 'IDs & time', glyph: '⏱', kind: 'transform', built: false, seoTitle: '', seoDesc: '', h1: '', intro: '', faq: [] },
  { slug: 'json-to-yaml', name: 'JSON ↔ YAML', tagline: 'Convert JSON and YAML', group: 'Data & CSV', glyph: 'Y', kind: 'transform', built: false, seoTitle: '', seoDesc: '', h1: '', intro: '', faq: [] },
  { slug: 'csv-cleaner', name: 'CSV cleaner', tagline: 'Trim, dedupe, re-delimit', group: 'Data & CSV', glyph: '▦', kind: 'transform', built: false, seoTitle: '', seoDesc: '', h1: '', intro: '', faq: [] },
  { slug: 'case-converter', name: 'Case converter', tagline: 'camelCase, snake_case, Title', group: 'Text', glyph: 'Aa', kind: 'transform', built: false, seoTitle: '', seoDesc: '', h1: '', intro: '', faq: [] },
  { slug: 'slugify', name: 'Slugify', tagline: 'Text → url-slug', group: 'Text', glyph: '-', kind: 'transform', built: false, seoTitle: '', seoDesc: '', h1: '', intro: '', faq: [] },
  { slug: 'sort-lines', name: 'Sort / dedupe lines', tagline: 'Order & unique lines', group: 'Text', glyph: '↕', kind: 'transform', built: false, seoTitle: '', seoDesc: '', h1: '', intro: '', faq: [] },
  { slug: 'regex-tester', name: 'Regex tester', tagline: 'Live match & groups', group: 'Text', glyph: '.*', kind: 'transform', built: false, seoTitle: '', seoDesc: '', h1: '', intro: '', faq: [] },
  { slug: 'lorem-ipsum', name: 'Lorem ipsum', tagline: 'Placeholder text', group: 'Text', glyph: '¶', kind: 'generate', built: false, seoTitle: '', seoDesc: '', h1: '', intro: '', faq: [] },
];

export const DEV_GROUPS: DevGroup[] = ['Encode & decode', 'Hash & token', 'IDs & time', 'Data & CSV', 'Text'];
export const GROUP_COLOR: Record<DevGroup, string> = {
  'Encode & decode': '#2563eb', 'Hash & token': '#7c3aed', 'IDs & time': '#0d9488', 'Data & CSV': '#b45309', 'Text': '#be123c',
};
export const getDevTool = (slug: string) => DEV_TOOLS.find((t) => t.slug === slug);
export const builtDevTools = () => DEV_TOOLS.filter((t) => t.built);
