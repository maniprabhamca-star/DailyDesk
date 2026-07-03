// QA for the Scan QR tool: generate QR codes for every payload type (with the
// REAL lib/qr-payload.ts builders where they exist), decode them with jsQR the
// way the app does (inversionAttempts both), then classify+parse with the REAL
// lib/qr-parse.ts and assert the structured fields round-trip — including
// escaping-heavy Wi-Fi/vCard values, inverted (dark-mode) codes, and a QR
// embedded small inside a large "screenshot" with surrounding UI noise.
// Rebuild bundles after lib changes:
//   npx esbuild frontend/lib/qr-parse.ts --bundle --format=cjs --outfile=dev-harness/qr-parse-lib.cjs
//   npx esbuild frontend/lib/qr-payload.ts --bundle --format=cjs --outfile=dev-harness/qr-payload-lib.cjs
// Usage: node scan-qr-qa.js
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const { parseQrPayload, toVcf } = require('./qr-parse-lib.cjs');
const { buildPayload, EMPTY_FIELDS } = require('./qr-payload-lib.cjs');

let pass = true;
const ok = (cond, label) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`); if (!cond) pass = false; };

async function qrPixels(payload, size = 512, invert = false) {
  const buf = await QRCode.toBuffer(payload, {
    width: size, margin: 4, errorCorrectionLevel: 'M',
    color: invert ? { dark: '#ffffff', light: '#111111' } : undefined,
  });
  const img = await loadImage(buf);
  const canvas = createCanvas(img.width, img.height);
  const cx = canvas.getContext('2d');
  cx.drawImage(img, 0, 0);
  return cx.getImageData(0, 0, canvas.width, canvas.height);
}

function decode(imageData) {
  const hit = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
  return hit ? hit.data : null;
}

const field = (parsed, label) => (parsed.fields.find((f) => f.label === label) || {}).value;

(async () => {
  const F = JSON.parse(JSON.stringify(EMPTY_FIELDS));

  // ---- URL ----
  let raw = decode(await qrPixels('https://dailydesk.app/compress-pdf?x=1&y=2'));
  let p = parseQrPayload(raw);
  ok(p.kind === 'url' && p.href === 'https://dailydesk.app/compress-pdf?x=1&y=2', `url round-trip (${p.kind})`);

  // ---- bare www link ----
  p = parseQrPayload(decode(await qrPixels('www.example.com')));
  ok(p.kind === 'url' && p.href === 'https://www.example.com', `www link gets https href (${p.href})`);

  // ---- plain text incl. unicode ----
  p = parseQrPayload(decode(await qrPixels('Héllo wörld — Zürich ✓')));
  ok(p.kind === 'text' && p.raw === 'Héllo wörld — Zürich ✓', `unicode text round-trip`);

  // ---- Wi-Fi with escaping-heavy SSID + password (real builder) ----
  F.wifi = { ssid: 'Café; "Nord": 5G', password: 'p;a,s:s"w\\d', security: 'WPA', hidden: true };
  const wifiPayload = buildPayload('wifi', F);
  p = parseQrPayload(decode(await qrPixels(wifiPayload)));
  ok(p.kind === 'wifi', `wifi kind (${p.kind})`);
  ok(field(p, 'Network (SSID)') === F.wifi.ssid, `wifi SSID unescaped (${field(p, 'Network (SSID)')})`);
  ok(field(p, 'Password') === F.wifi.password, `wifi password unescaped`);
  ok((p.fields.find((f) => f.label === 'Password') || {}).secret === true, `wifi password flagged secret`);
  ok(field(p, 'Hidden network') === 'Yes', `wifi hidden flag`);

  // ---- open Wi-Fi (nopass) ----
  F.wifi = { ssid: 'FreeAirport', password: '', security: 'nopass', hidden: false };
  p = parseQrPayload(decode(await qrPixels(buildPayload('wifi', F))));
  ok(p.kind === 'wifi' && /open/i.test(field(p, 'Security') || ''), `open wifi shows no password needed`);

  // ---- vCard with commas/semicolons + multiple phones (real builder) ----
  F.vcard = { firstName: 'Ana, María', lastName: 'de la; Cruz', phone: '+1 (404) 555-0100', email: 'ana@corp.example', org: 'Cruz; Sons, LLC', title: 'VP, Ops', url: 'https://cruz.example' };
  const vcardPayload = buildPayload('vcard', F);
  p = parseQrPayload(decode(await qrPixels(vcardPayload)));
  ok(p.kind === 'contact', `vcard kind (${p.kind})`);
  ok(field(p, 'Name') === 'Ana, María de la; Cruz', `vcard FN unescaped (${field(p, 'Name')})`);
  ok(field(p, 'Company') === 'Cruz; Sons, LLC', `vcard ORG unescaped`);
  ok(field(p, 'Phone') === F.vcard.phone, `vcard phone`);
  ok(toVcf(p) === p.raw, `real vCard .vcf is a pass-through`);

  // ---- MECARD (other generators emit this) ----
  p = parseQrPayload('MECARD:N:Doe,John;TEL:+15550111;EMAIL:j@d.example;ORG:Doe Co;;');
  ok(p.kind === 'contact' && field(p, 'Name') === 'John Doe', `mecard name reversed (${field(p, 'Name')})`);
  const vcf = toVcf(p);
  ok(vcf && vcf.indexOf('BEGIN:VCARD') === 0 && vcf.indexOf('TEL;TYPE=CELL:+15550111') !== -1, `mecard converts to .vcf`);

  // ---- email (real builder, subject+body with spaces/unicode) ----
  F.email = { to: 'sam@x.example', subject: 'Hi there & hello', body: 'Line one\nLine two ü' };
  p = parseQrPayload(decode(await qrPixels(buildPayload('email', F))));
  ok(p.kind === 'email' && field(p, 'To') === F.email.to, `mailto to`);
  ok(field(p, 'Subject') === F.email.subject, `mailto subject decoded (${field(p, 'Subject')})`);
  ok(field(p, 'Message') === F.email.body, `mailto body decoded`);

  // ---- phone / SMSTO (real builders) + sms:?body= variant ----
  F.phone = '+1 (555) 010-4477';
  p = parseQrPayload(decode(await qrPixels(buildPayload('phone', F))));
  ok(p.kind === 'phone' && field(p, 'Number') === '+15550104477', `tel number (${field(p, 'Number')})`);
  F.sms = { number: '+1 555 010 9999', message: 'On my way!' };
  p = parseQrPayload(decode(await qrPixels(buildPayload('sms', F))));
  ok(p.kind === 'sms' && field(p, 'To') === '+15550109999' && field(p, 'Message') === 'On my way!', `SMSTO round-trip`);
  p = parseQrPayload('sms:+15550101?body=See%20you%20at%205');
  ok(p.kind === 'sms' && field(p, 'Message') === 'See you at 5', `sms:?body= variant`);

  // ---- geo + VEVENT ----
  p = parseQrPayload('geo:33.7756,-84.3963');
  ok(p.kind === 'geo' && p.href === 'https://www.google.com/maps?q=33.7756,-84.3963', `geo href`);
  p = parseQrPayload('BEGIN:VEVENT\nSUMMARY:Team offsite\nDTSTART:20260810T140000Z\nLOCATION:Atlanta HQ\nEND:VEVENT');
  ok(p.kind === 'event' && field(p, 'Event') === 'Team offsite', `vevent summary`);
  ok(field(p, 'Starts') === '2026-08-10 14:00 UTC', `vevent date formatted (${field(p, 'Starts')})`);

  // ---- inverted (dark-mode) code still decodes ----
  raw = decode(await qrPixels('https://dailydesk.app', 512, true));
  ok(raw === 'https://dailydesk.app', `inverted (light-on-dark) code decodes`);

  // ---- QR embedded small in a big noisy "screenshot" ----
  {
    const qrBuf = await QRCode.toBuffer('https://dailydesk.app/scan-qr-code', { width: 260, margin: 4 });
    const qrImg = await loadImage(qrBuf);
    const shot = createCanvas(1920, 1080);
    const cx = shot.getContext('2d');
    cx.fillStyle = '#e8eaf0';
    cx.fillRect(0, 0, 1920, 1080);
    cx.fillStyle = '#4b5563';
    for (let i = 0; i < 40; i++) cx.fillRect(60, 40 + i * 26, 700 + (i * 137) % 500, 10); // fake text lines
    cx.drawImage(qrImg, 1500, 700);
    const data = cx.getImageData(0, 0, 1920, 1080);
    const hit = decode(data);
    ok(hit === 'https://dailydesk.app/scan-qr-code', `QR inside a 1920×1080 screenshot decodes (${hit ? 'hit' : 'miss'})`);
  }

  // ---- styled QR from OUR generator decodes through the scanner path ----
  {
    const paint = require('./qr-paint-lib.cjs');
    const QRLib = require('qrcode');
    const qr = QRLib.create('https://dailydesk.app/qr-code-generator', { errorCorrectionLevel: 'M' });
    const size = 480;
    const canvas = createCanvas(size, size);
    paint.paintQr(canvas.getContext('2d'), paint.toMatrix(qr.modules), size, 2, {
      moduleShape: 'rounded', eyeShape: 'rounded', fg: '#4f46e5', fg2: '#0ea5e9', bg: '#ffffff',
    });
    const hit = decode(canvas.getContext('2d').getImageData(0, 0, size, size));
    const p2 = hit ? parseQrPayload(hit) : null;
    ok(p2 && p2.kind === 'url' && p2.href === 'https://dailydesk.app/qr-code-generator', `our styled (rounded+gradient) QR scans back`);
  }

  console.log(pass ? 'PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
