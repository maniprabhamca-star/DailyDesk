// Classify + parse a decoded QR payload into structured, human-readable fields.
// The exact inverse of lib/qr-payload.ts builders (WIFI:, vCard 3.0, mailto:,
// tel:, SMSTO:) plus formats other generators emit (MECARD:, geo:, sms:,
// VCALENDAR/VEVENT, bare www. links). Pure string functions — shared by the
// Scan QR tool UI and testable in Node (gate: dev-harness/scan-qr-qa.js).

export type QrKind = 'url' | 'wifi' | 'contact' | 'email' | 'phone' | 'sms' | 'geo' | 'event' | 'text';

export type QrField = { label: string; value: string; secret?: boolean };

export type ParsedQr = {
  kind: QrKind;
  /** Short human name for the result card, e.g. “Wi-Fi network”. */
  title: string;
  fields: QrField[];
  /** The full decoded payload, always shown/copyable. */
  raw: string;
  /** A safe-to-open link when the payload is one (never auto-opened). */
  href?: string;
};

const KIND_TITLE: Record<QrKind, string> = {
  url: 'Link',
  wifi: 'Wi-Fi network',
  contact: 'Contact card',
  email: 'Email draft',
  phone: 'Phone number',
  sms: 'Text message',
  geo: 'Location',
  event: 'Calendar event',
  text: 'Plain text',
};

// ---- per-format helpers ------------------------------------------------------

const wifiUnesc = (s: string) => s.replace(/\\([\\;,:"])/g, '$1');
const vcardUnesc = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([\\,;])/g, '$1');

/** Split on `sep` but not on backslash-escaped separators. */
function splitUnescaped(s: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) { cur += c + s[i + 1]; i++; continue; }
    if (c === sep) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

function parseWifi(raw: string): ParsedQr {
  const body = raw.slice(5); // after WIFI:
  const fields: QrField[] = [];
  let ssid = '', password = '', security = '', hidden = false;
  for (const part of splitUnescaped(body, ';')) {
    const idx = part.indexOf(':');
    if (idx < 1) continue;
    const key = part.slice(0, idx).toUpperCase();
    const val = part.slice(idx + 1);
    if (key === 'S') ssid = wifiUnesc(val);
    else if (key === 'P') password = wifiUnesc(val);
    else if (key === 'T') security = val;
    else if (key === 'H') hidden = /^true$/i.test(val);
  }
  if (ssid) fields.push({ label: 'Network (SSID)', value: ssid });
  fields.push({ label: 'Password', value: password || '(open network — no password)', secret: !!password });
  fields.push({ label: 'Security', value: security === 'nopass' ? 'None (open)' : security || 'WPA' });
  if (hidden) fields.push({ label: 'Hidden network', value: 'Yes' });
  return { kind: 'wifi', title: KIND_TITLE.wifi, fields, raw };
}

// vCard property -> friendly label (order = display order).
const VCARD_LABELS: Array<[RegExp, string]> = [
  [/^FN$/i, 'Name'],
  [/^ORG$/i, 'Company'],
  [/^TITLE$/i, 'Job title'],
  [/^TEL/i, 'Phone'],
  [/^EMAIL/i, 'Email'],
  [/^URL$/i, 'Website'],
  [/^ADR/i, 'Address'],
  [/^NOTE$/i, 'Note'],
];

function parseVcard(raw: string): ParsedQr {
  // Unfold RFC line continuations (a line starting with space/tab continues the
  // previous one), then read properties, ignoring group prefixes and params.
  const unfolded = raw.replace(/\r?\n[ \t]/g, '');
  const fields: QrField[] = [];
  const seen = new Map<string, number>();
  for (const line of unfolded.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx < 1) continue;
    const prop = line.slice(0, idx).replace(/^[^.]*\./, '').split(';')[0];
    const value = line.slice(idx + 1).trim();
    if (!value) continue;
    for (const [re, label] of VCARD_LABELS) {
      if (!re.test(prop)) continue;
      const clean = prop.toUpperCase() === 'ADR'
        ? vcardUnesc(value).split(';').filter(Boolean).join(', ')
        : vcardUnesc(value);
      const n = seen.get(label) || 0;
      seen.set(label, n + 1);
      fields.push({ label: n === 0 ? label : `${label} ${n + 1}`, value: clean });
      break;
    }
  }
  // Keep display order stable: as listed in VCARD_LABELS.
  const order = VCARD_LABELS.map(([, l]) => l);
  fields.sort((a, b) => order.indexOf(a.label.replace(/ \d+$/, '')) - order.indexOf(b.label.replace(/ \d+$/, '')));
  return { kind: 'contact', title: KIND_TITLE.contact, fields, raw };
}

function parseMecard(raw: string): ParsedQr {
  const body = raw.slice(7).replace(/;;\s*$/, ''); // after MECARD:
  const fields: QrField[] = [];
  for (const part of splitUnescaped(body, ';')) {
    const idx = part.indexOf(':');
    if (idx < 1) continue;
    const key = part.slice(0, idx).toUpperCase();
    const val = wifiUnesc(part.slice(idx + 1)); // MECARD escapes like WIFI:
    if (!val) continue;
    if (key === 'N') fields.push({ label: 'Name', value: val.split(',').reverse().join(' ').trim() });
    else if (key === 'TEL') fields.push({ label: 'Phone', value: val });
    else if (key === 'EMAIL') fields.push({ label: 'Email', value: val });
    else if (key === 'ORG') fields.push({ label: 'Company', value: val });
    else if (key === 'URL') fields.push({ label: 'Website', value: val });
    else if (key === 'ADR') fields.push({ label: 'Address', value: val });
    else if (key === 'NOTE') fields.push({ label: 'Note', value: val });
  }
  return { kind: 'contact', title: KIND_TITLE.contact, fields, raw };
}

function parseMailto(raw: string): ParsedQr {
  const rest = raw.slice(7);
  const qIdx = rest.indexOf('?');
  const to = decodeURIComponent(qIdx === -1 ? rest : rest.slice(0, qIdx));
  const fields: QrField[] = [{ label: 'To', value: to }];
  if (qIdx !== -1) {
    for (const pair of rest.slice(qIdx + 1).split('&')) {
      const eq = pair.indexOf('=');
      if (eq < 1) continue;
      const key = pair.slice(0, eq).toLowerCase();
      const val = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, '%20'));
      if (key === 'subject') fields.push({ label: 'Subject', value: val });
      else if (key === 'body') fields.push({ label: 'Message', value: val });
      else if (key === 'cc') fields.push({ label: 'Cc', value: val });
    }
  }
  return { kind: 'email', title: KIND_TITLE.email, fields, raw, href: raw };
}

function parseSms(raw: string): ParsedQr {
  // SMSTO:number:message  |  sms:number?body=message
  const fields: QrField[] = [];
  if (/^smsto:/i.test(raw)) {
    const body = raw.slice(6);
    const idx = body.indexOf(':');
    fields.push({ label: 'To', value: idx === -1 ? body : body.slice(0, idx) });
    if (idx !== -1 && body.slice(idx + 1)) fields.push({ label: 'Message', value: body.slice(idx + 1) });
  } else {
    const body = raw.slice(4);
    const qIdx = body.indexOf('?');
    fields.push({ label: 'To', value: qIdx === -1 ? body : body.slice(0, qIdx) });
    const m = qIdx === -1 ? null : /(?:^|&)body=([^&]*)/.exec(body.slice(qIdx + 1));
    if (m && m[1]) fields.push({ label: 'Message', value: decodeURIComponent(m[1].replace(/\+/g, '%20')) });
  }
  return { kind: 'sms', title: KIND_TITLE.sms, fields, raw };
}

function parseGeo(raw: string): ParsedQr | null {
  const m = /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i.exec(raw);
  if (!m) return null;
  const lat = m[1], lng = m[2];
  return {
    kind: 'geo',
    title: KIND_TITLE.geo,
    fields: [{ label: 'Latitude', value: lat }, { label: 'Longitude', value: lng }],
    raw,
    href: `https://www.google.com/maps?q=${lat},${lng}`,
  };
}

function icalDate(v: string): string {
  // 20260703T140000Z / 20260703 -> readable; leave odd values as-is.
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/.exec(v);
  if (!m) return v;
  return `${m[1]}-${m[2]}-${m[3]}${m[4] ? ` ${m[4]}:${m[5]}${/Z$/.test(v) ? ' UTC' : ''}` : ''}`;
}

function parseEvent(raw: string): ParsedQr {
  const unfolded = raw.replace(/\r?\n[ \t]/g, '');
  const fields: QrField[] = [];
  const grab = (prop: string, label: string, fmt?: (v: string) => string) => {
    const re = new RegExp(`^${prop}[^:]*:(.+)$`, 'im');
    const m = re.exec(unfolded);
    if (m && m[1].trim()) fields.push({ label, value: fmt ? fmt(m[1].trim()) : vcardUnesc(m[1].trim()) });
  };
  grab('SUMMARY', 'Event');
  grab('DTSTART', 'Starts', icalDate);
  grab('DTEND', 'Ends', icalDate);
  grab('LOCATION', 'Location');
  grab('DESCRIPTION', 'Details');
  return { kind: 'event', title: KIND_TITLE.event, fields, raw };
}

// ---- entry -------------------------------------------------------------------

export function parseQrPayload(raw: string): ParsedQr {
  const t = raw.trim();
  if (/^https?:\/\//i.test(t)) {
    return { kind: 'url', title: KIND_TITLE.url, fields: [{ label: 'Link', value: t }], raw, href: t };
  }
  if (/^www\.[^\s]+\.[^\s]{2,}$/i.test(t)) {
    const url = `https://${t}`;
    return { kind: 'url', title: KIND_TITLE.url, fields: [{ label: 'Link', value: t }], raw, href: url };
  }
  if (/^wifi:/i.test(t)) return parseWifi(t);
  if (/^begin:vcard/i.test(t)) return parseVcard(t);
  if (/^mecard:/i.test(t)) return parseMecard(t);
  if (/^mailto:/i.test(t)) return parseMailto(t);
  if (/^tel:/i.test(t)) {
    const num = t.slice(4);
    return { kind: 'phone', title: KIND_TITLE.phone, fields: [{ label: 'Number', value: num }], raw, href: t };
  }
  if (/^(smsto:|sms:)/i.test(t)) return parseSms(t);
  const geo = /^geo:/i.test(t) ? parseGeo(t) : null;
  if (geo) return geo;
  if (/begin:vevent/i.test(t)) return parseEvent(t);
  return { kind: 'text', title: KIND_TITLE.text, fields: [{ label: 'Text', value: raw }], raw };
}

/** vCard file content for a contact result — pass-through for real vCards,
 * a minimal generated vCard 3.0 for MECARD payloads. */
export function toVcf(parsed: ParsedQr): string | null {
  if (parsed.kind !== 'contact') return null;
  if (/^begin:vcard/i.test(parsed.raw.trim())) return parsed.raw;
  const esc = (s: string) => s.replace(/([\\,;])/g, '\\$1').replace(/\r?\n/g, '\\n');
  const get = (label: string) => parsed.fields.find((f) => f.label === label)?.value;
  const name = get('Name') || 'Contact';
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${esc(name)}`, `N:${esc(name)};;;;`];
  const tel = get('Phone'); if (tel) lines.push(`TEL;TYPE=CELL:${esc(tel)}`);
  const email = get('Email'); if (email) lines.push(`EMAIL:${esc(email)}`);
  const org = get('Company'); if (org) lines.push(`ORG:${esc(org)}`);
  const url = get('Website'); if (url) lines.push(`URL:${esc(url)}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}
