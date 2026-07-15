// Registry for the Dev & CSV utilities pack. Pure data (server + client safe) —
// the actual transform logic lives in lib/dev-run.ts (client-only: uses btoa,
// crypto, etc.). Each tool is its own SEO keyword page, all rendered by the one
// shared DevToolShell so the pack stays consistent and uncluttered.

export type DevKind = 'transform' | 'generate' | 'inspect' | 'diff' | 'regex';
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
  pattern?: string; flags?: string; // regex kind: default pattern + flags
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

  {
    slug: 'timestamp-converter', name: 'Timestamp', tagline: 'Unix epoch ↔ date', group: 'IDs & time', glyph: '⏱',
    kind: 'transform', built: true, modes: ['Unix → Date', 'Date → Unix'], inLabel: 'Input', outLabel: 'Result', sampleA: '1716239022',
    seoTitle: 'Unix Timestamp Converter — Epoch ↔ Date | DiemDesk',
    seoDesc: 'Convert a Unix timestamp (epoch) to a human date, or a date back to epoch — seconds or milliseconds — free in your browser. Nothing uploaded.',
    h1: 'Unix timestamp converter',
    intro: 'A Unix timestamp counts the seconds (or milliseconds) since 1 Jan 1970 UTC. Paste an epoch to see it as a local, UTC and ISO date, or paste a date to get the epoch back — all on your device.',
    faq: [
      { q: 'Seconds or milliseconds?', a: 'Both — it auto-detects: 13-digit or longer values are treated as milliseconds, shorter ones as seconds.' },
      { q: 'Which timezone?', a: 'It shows your local time plus UTC and ISO 8601, so there’s no ambiguity.' },
    ],
  },
  {
    slug: 'json-to-yaml', name: 'JSON ↔ YAML', tagline: 'Convert JSON and YAML', group: 'Data & CSV', glyph: 'Y',
    kind: 'transform', built: true, modes: ['JSON → YAML', 'YAML → JSON'], inLabel: 'Input', outLabel: 'Output',
    sampleA: '{\n  "name": "DiemDesk",\n  "private": true,\n  "tools": ["pdf", "image", "dev"]\n}',
    seoTitle: 'JSON to YAML Converter — Both Ways, Free | DiemDesk',
    seoDesc: 'Convert JSON to YAML or YAML to JSON, free in your browser. Handles nested objects, arrays and quoted strings. Your data is never uploaded.',
    h1: 'JSON ↔ YAML converter',
    intro: 'YAML and JSON describe the same data in different styles — YAML is indentation-based and easy to read, JSON is compact and everywhere. Paste one to get the other; conversion runs entirely in your browser.',
    faq: [
      { q: 'Does it handle nested data?', a: 'Yes — nested objects and arrays, booleans, numbers, null and quoted strings all convert both ways.' },
      { q: 'Is my data uploaded?', a: 'No — it converts on your device, so it’s safe for config that contains secrets.' },
    ],
  },
  {
    slug: 'csv-cleaner', name: 'CSV cleaner', tagline: 'Trim, drop blanks & dedupe', group: 'Data & CSV', glyph: '▦',
    kind: 'transform', built: true, inLabel: 'Messy CSV', outLabel: 'Cleaned', sampleA: 'name , city\n Sam , Austin \n\nSam,Austin\n Lee ,Denver',
    seoTitle: 'CSV Cleaner — Trim, Dedupe & Tidy CSV, Free | DiemDesk',
    seoDesc: 'Clean up a messy CSV — trim whitespace, drop blank rows and remove duplicate rows — free in your browser. Your spreadsheet data is never uploaded.',
    h1: 'CSV cleaner',
    intro: 'Real-world CSVs arrive with stray spaces, blank lines and duplicate rows. This trims every cell, drops empty rows and removes exact duplicates to give you a clean CSV — all on your device.',
    faq: [
      { q: 'What does it remove?', a: 'Leading/trailing spaces in each cell, fully-blank rows, and rows that exactly duplicate an earlier one.' },
      { q: 'Are quoted fields safe?', a: 'Yes — fields quoted because they contain commas are parsed correctly and re-quoted only when needed.' },
    ],
  },
  {
    slug: 'case-converter', name: 'Case converter', tagline: 'camelCase, snake_case, Title…', group: 'Text', glyph: 'Aa',
    kind: 'transform', built: true, modes: ['lowercase', 'UPPERCASE', 'Title Case', 'camelCase', 'snake_case', 'kebab-case'],
    inLabel: 'Input', outLabel: 'Output', sampleA: 'Hello World — example text',
    seoTitle: 'Case Converter — camelCase, snake_case & More | DiemDesk',
    seoDesc: 'Convert text between lowercase, UPPERCASE, Title Case, camelCase, snake_case and kebab-case, free in your browser. Nothing is uploaded.',
    h1: 'Case converter',
    intro: 'Switch text between the naming styles you actually use — lowercase, UPPERCASE, Title Case, camelCase, snake_case and kebab-case. Pick a style and paste your text; it converts instantly, on your device.',
    faq: [
      { q: 'How are words detected?', a: 'It splits on spaces, underscores, hyphens and camelCase humps, so even mixed input converts cleanly.' },
      { q: 'Is it uploaded?', a: 'No — conversion runs entirely in your browser.' },
    ],
  },
  {
    slug: 'slugify', name: 'Slugify', tagline: 'Text → clean url-slug', group: 'Text', glyph: '-',
    kind: 'transform', built: true, inLabel: 'Text', outLabel: 'Slug', sampleA: 'Hello World! My First Post (2024)',
    seoTitle: 'Slugify — Text to URL Slug, Free Online | DiemDesk',
    seoDesc: 'Turn any text into a clean url-slug — lowercase, hyphenated, accents and symbols stripped — free in your browser. Nothing is uploaded.',
    h1: 'Slugify — text to URL slug',
    intro: 'A slug is the readable, hyphenated part of a URL. This lowercases your text, strips accents and punctuation, and joins words with hyphens to make a clean, SEO-friendly slug — instantly, on your device.',
    faq: [
      { q: 'What happens to accents?', a: 'They’re normalized to plain ASCII (é → e), and any character that isn’t a letter or number becomes a hyphen.' },
      { q: 'Uploaded anywhere?', a: 'No — it runs in your browser.' },
    ],
  },
  {
    slug: 'sort-lines', name: 'Sort / dedupe lines', tagline: 'Order & unique lines', group: 'Text', glyph: '↕',
    kind: 'transform', built: true, modes: ['A → Z', 'Z → A', 'Unique', 'Reverse'], inLabel: 'Lines', outLabel: 'Result',
    sampleA: 'banana\napple\ncherry\napple\ndate',
    seoTitle: 'Sort & Dedupe Lines Online — Free | DiemDesk',
    seoDesc: 'Sort lines A→Z or Z→A, remove duplicate lines, or reverse them — free in your browser. Handy for lists and logs. Your text is never uploaded.',
    h1: 'Sort & dedupe lines',
    intro: 'Paste a list to sort it alphabetically (A→Z or Z→A), remove duplicate lines, or reverse the order. Useful for tidying lists, logs and word sets — and it all runs on your device.',
    faq: [
      { q: 'Is the sort case-sensitive?', a: 'It uses locale-aware comparison, so it sorts naturally (a, B, c) rather than by raw character codes.' },
      { q: 'Uploaded?', a: 'No — everything happens in your browser.' },
    ],
  },
  {
    slug: 'regex-tester', name: 'Regex tester', tagline: 'Live matches & capture groups', group: 'Text', glyph: '.*',
    kind: 'regex', built: true, inLabel: 'Test string', outLabel: 'Matches',
    sampleA: 'Contact jordan@example.com or sam@diemdesk.com today.', pattern: '(\\w+)@(\\w+\\.\\w+)', flags: 'g',
    seoTitle: 'Regex Tester — Test & Debug Regex Online | DiemDesk',
    seoDesc: 'Test a regular expression against your text and see every match and capture group live, free in your browser. Nothing is uploaded.',
    h1: 'Regex tester',
    intro: 'Write a regular expression and see, live, every place it matches in your text along with the capture groups. Enter your pattern and flags, paste a test string, and iterate — the matching runs entirely in your browser.',
    faq: [
      { q: 'Which flags are supported?', a: 'g, i, m, s, u and y — the standard JavaScript RegExp flags. g is always applied so you see every match.' },
      { q: 'Is my text uploaded?', a: 'No — the regex runs on your device, so test strings with real data stay private.' },
    ],
  },
  {
    slug: 'lorem-ipsum', name: 'Lorem ipsum', tagline: 'Placeholder text, by paragraph', group: 'Text', glyph: '¶',
    kind: 'generate', built: true, count: true, outLabel: 'Lorem ipsum',
    seoTitle: 'Lorem Ipsum Generator — Placeholder Text, Free | DiemDesk',
    seoDesc: 'Generate lorem ipsum placeholder text — choose how many paragraphs — free in your browser. Copy with one click for mockups and designs.',
    h1: 'Lorem ipsum generator',
    intro: 'Lorem ipsum is the classic placeholder text for mockups and layouts. Choose how many paragraphs you need and generate — then copy it in a click. Runs entirely on your device.',
    faq: [
      { q: 'How much can I generate?', a: 'From 1 up to 50 paragraphs at a time, each a realistic length.' },
      { q: 'Is it always the same?', a: 'No — each run is randomized, so you get fresh filler every time.' },
    ],
  },
];

export const DEV_GROUPS: DevGroup[] = ['Encode & decode', 'Hash & token', 'IDs & time', 'Data & CSV', 'Text'];
export const GROUP_COLOR: Record<DevGroup, string> = {
  'Encode & decode': '#2563eb', 'Hash & token': '#7c3aed', 'IDs & time': '#0d9488', 'Data & CSV': '#b45309', 'Text': '#be123c',
};
export const getDevTool = (slug: string) => DEV_TOOLS.find((t) => t.slug === slug);
export const builtDevTools = () => DEV_TOOLS.filter((t) => t.built);
