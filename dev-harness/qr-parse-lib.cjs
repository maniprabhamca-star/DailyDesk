var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// frontend/lib/qr-parse.ts
var qr_parse_exports = {};
__export(qr_parse_exports, {
  parseQrPayload: () => parseQrPayload,
  toVcf: () => toVcf
});
module.exports = __toCommonJS(qr_parse_exports);
var KIND_TITLE = {
  url: "Link",
  wifi: "Wi-Fi network",
  contact: "Contact card",
  email: "Email draft",
  phone: "Phone number",
  sms: "Text message",
  geo: "Location",
  event: "Calendar event",
  text: "Plain text"
};
var wifiUnesc = (s) => s.replace(/\\([\\;,:"])/g, "$1");
var vcardUnesc = (s) => s.replace(/\\n/gi, "\n").replace(/\\([\\,;])/g, "$1");
function splitUnescaped(s, sep) {
  const out = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length) {
      cur += c + s[i + 1];
      i++;
      continue;
    }
    if (c === sep) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}
function parseWifi(raw) {
  const body = raw.slice(5);
  const fields = [];
  let ssid = "", password = "", security = "", hidden = false;
  for (const part of splitUnescaped(body, ";")) {
    const idx = part.indexOf(":");
    if (idx < 1) continue;
    const key = part.slice(0, idx).toUpperCase();
    const val = part.slice(idx + 1);
    if (key === "S") ssid = wifiUnesc(val);
    else if (key === "P") password = wifiUnesc(val);
    else if (key === "T") security = val;
    else if (key === "H") hidden = /^true$/i.test(val);
  }
  if (ssid) fields.push({ label: "Network (SSID)", value: ssid });
  fields.push({ label: "Password", value: password || "(open network \u2014 no password)", secret: !!password });
  fields.push({ label: "Security", value: security === "nopass" ? "None (open)" : security || "WPA" });
  if (hidden) fields.push({ label: "Hidden network", value: "Yes" });
  return { kind: "wifi", title: KIND_TITLE.wifi, fields, raw };
}
var VCARD_LABELS = [
  [/^FN$/i, "Name"],
  [/^ORG$/i, "Company"],
  [/^TITLE$/i, "Job title"],
  [/^TEL/i, "Phone"],
  [/^EMAIL/i, "Email"],
  [/^URL$/i, "Website"],
  [/^ADR/i, "Address"],
  [/^NOTE$/i, "Note"]
];
function parseVcard(raw) {
  const unfolded = raw.replace(/\r?\n[ \t]/g, "");
  const fields = [];
  const seen = /* @__PURE__ */ new Map();
  for (const line of unfolded.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 1) continue;
    const prop = line.slice(0, idx).replace(/^[^.]*\./, "").split(";")[0];
    const value = line.slice(idx + 1).trim();
    if (!value) continue;
    for (const [re, label] of VCARD_LABELS) {
      if (!re.test(prop)) continue;
      const clean = prop.toUpperCase() === "ADR" ? vcardUnesc(value).split(";").filter(Boolean).join(", ") : vcardUnesc(value);
      const n = seen.get(label) || 0;
      seen.set(label, n + 1);
      fields.push({ label: n === 0 ? label : `${label} ${n + 1}`, value: clean });
      break;
    }
  }
  const order = VCARD_LABELS.map(([, l]) => l);
  fields.sort((a, b) => order.indexOf(a.label.replace(/ \d+$/, "")) - order.indexOf(b.label.replace(/ \d+$/, "")));
  return { kind: "contact", title: KIND_TITLE.contact, fields, raw };
}
function parseMecard(raw) {
  const body = raw.slice(7).replace(/;;\s*$/, "");
  const fields = [];
  for (const part of splitUnescaped(body, ";")) {
    const idx = part.indexOf(":");
    if (idx < 1) continue;
    const key = part.slice(0, idx).toUpperCase();
    const val = wifiUnesc(part.slice(idx + 1));
    if (!val) continue;
    if (key === "N") fields.push({ label: "Name", value: val.split(",").reverse().join(" ").trim() });
    else if (key === "TEL") fields.push({ label: "Phone", value: val });
    else if (key === "EMAIL") fields.push({ label: "Email", value: val });
    else if (key === "ORG") fields.push({ label: "Company", value: val });
    else if (key === "URL") fields.push({ label: "Website", value: val });
    else if (key === "ADR") fields.push({ label: "Address", value: val });
    else if (key === "NOTE") fields.push({ label: "Note", value: val });
  }
  return { kind: "contact", title: KIND_TITLE.contact, fields, raw };
}
function parseMailto(raw) {
  const rest = raw.slice(7);
  const qIdx = rest.indexOf("?");
  const to = decodeURIComponent(qIdx === -1 ? rest : rest.slice(0, qIdx));
  const fields = [{ label: "To", value: to }];
  if (qIdx !== -1) {
    for (const pair of rest.slice(qIdx + 1).split("&")) {
      const eq = pair.indexOf("=");
      if (eq < 1) continue;
      const key = pair.slice(0, eq).toLowerCase();
      const val = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, "%20"));
      if (key === "subject") fields.push({ label: "Subject", value: val });
      else if (key === "body") fields.push({ label: "Message", value: val });
      else if (key === "cc") fields.push({ label: "Cc", value: val });
    }
  }
  return { kind: "email", title: KIND_TITLE.email, fields, raw, href: raw };
}
function parseSms(raw) {
  const fields = [];
  if (/^smsto:/i.test(raw)) {
    const body = raw.slice(6);
    const idx = body.indexOf(":");
    fields.push({ label: "To", value: idx === -1 ? body : body.slice(0, idx) });
    if (idx !== -1 && body.slice(idx + 1)) fields.push({ label: "Message", value: body.slice(idx + 1) });
  } else {
    const body = raw.slice(4);
    const qIdx = body.indexOf("?");
    fields.push({ label: "To", value: qIdx === -1 ? body : body.slice(0, qIdx) });
    const m = qIdx === -1 ? null : /(?:^|&)body=([^&]*)/.exec(body.slice(qIdx + 1));
    if (m && m[1]) fields.push({ label: "Message", value: decodeURIComponent(m[1].replace(/\+/g, "%20")) });
  }
  return { kind: "sms", title: KIND_TITLE.sms, fields, raw };
}
function parseGeo(raw) {
  const m = /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i.exec(raw);
  if (!m) return null;
  const lat = m[1], lng = m[2];
  return {
    kind: "geo",
    title: KIND_TITLE.geo,
    fields: [{ label: "Latitude", value: lat }, { label: "Longitude", value: lng }],
    raw,
    href: `https://www.google.com/maps?q=${lat},${lng}`
  };
}
function icalDate(v) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/.exec(v);
  if (!m) return v;
  return `${m[1]}-${m[2]}-${m[3]}${m[4] ? ` ${m[4]}:${m[5]}${/Z$/.test(v) ? " UTC" : ""}` : ""}`;
}
function parseEvent(raw) {
  const unfolded = raw.replace(/\r?\n[ \t]/g, "");
  const fields = [];
  const grab = (prop, label, fmt) => {
    const re = new RegExp(`^${prop}[^:]*:(.+)$`, "im");
    const m = re.exec(unfolded);
    if (m && m[1].trim()) fields.push({ label, value: fmt ? fmt(m[1].trim()) : vcardUnesc(m[1].trim()) });
  };
  grab("SUMMARY", "Event");
  grab("DTSTART", "Starts", icalDate);
  grab("DTEND", "Ends", icalDate);
  grab("LOCATION", "Location");
  grab("DESCRIPTION", "Details");
  return { kind: "event", title: KIND_TITLE.event, fields, raw };
}
function parseQrPayload(raw) {
  const t = raw.trim();
  if (/^https?:\/\//i.test(t)) {
    return { kind: "url", title: KIND_TITLE.url, fields: [{ label: "Link", value: t }], raw, href: t };
  }
  if (/^www\.[^\s]+\.[^\s]{2,}$/i.test(t)) {
    const url = `https://${t}`;
    return { kind: "url", title: KIND_TITLE.url, fields: [{ label: "Link", value: t }], raw, href: url };
  }
  if (/^wifi:/i.test(t)) return parseWifi(t);
  if (/^begin:vcard/i.test(t)) return parseVcard(t);
  if (/^mecard:/i.test(t)) return parseMecard(t);
  if (/^mailto:/i.test(t)) return parseMailto(t);
  if (/^tel:/i.test(t)) {
    const num = t.slice(4);
    return { kind: "phone", title: KIND_TITLE.phone, fields: [{ label: "Number", value: num }], raw, href: t };
  }
  if (/^(smsto:|sms:)/i.test(t)) return parseSms(t);
  const geo = /^geo:/i.test(t) ? parseGeo(t) : null;
  if (geo) return geo;
  if (/begin:vevent/i.test(t)) return parseEvent(t);
  return { kind: "text", title: KIND_TITLE.text, fields: [{ label: "Text", value: raw }], raw };
}
function toVcf(parsed) {
  if (parsed.kind !== "contact") return null;
  if (/^begin:vcard/i.test(parsed.raw.trim())) return parsed.raw;
  const esc = (s) => s.replace(/([\\,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
  const get = (label) => parsed.fields.find((f) => f.label === label)?.value;
  const name = get("Name") || "Contact";
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${esc(name)}`, `N:${esc(name)};;;;`];
  const tel = get("Phone");
  if (tel) lines.push(`TEL;TYPE=CELL:${esc(tel)}`);
  const email = get("Email");
  if (email) lines.push(`EMAIL:${esc(email)}`);
  const org = get("Company");
  if (org) lines.push(`ORG:${esc(org)}`);
  const url = get("Website");
  if (url) lines.push(`URL:${esc(url)}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}
