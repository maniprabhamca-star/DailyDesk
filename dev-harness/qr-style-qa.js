// QR styled-renderer scannability gate.
//
// Renders the REAL frontend/lib/qr-paint.ts (bundled to qr-paint-lib.cjs via
//   npx esbuild frontend/lib/qr-paint.ts --bundle --format=cjs --outfile=dev-harness/qr-paint-lib.cjs
// ) on @napi-rs/canvas across every style combination the UI offers, then
// decodes each PNG with jsQR. GATE: every combination must decode to the
// exact input payload. Run before shipping any change to qr-paint.ts.
//
// Also writes qr-style-sample-*.png files for visual eyeballing.

const { createCanvas } = require('@napi-rs/canvas');
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const fs = require('fs');
const path = require('path');
const { paintQr, svgQr, toMatrix } = require('./qr-paint-lib.cjs');

const payloads = {
  url: 'https://dailydesk.app/some/deep/path?x=1',
  wifi: 'WIFI:T:WPA;S:My\\;Cafe Guest;P:p@ss\\;word\\:1\\,2;H:true;;',
  vcard: 'BEGIN:VCARD\nVERSION:3.0\nN:Cruz;Ana;;;\nFN:Ana Cruz\nORG:ACME\\, Inc\nTITLE:CTO\nTEL;TYPE=CELL:+34600111222\nEMAIL:ana@x.es\nURL:https://acme.example\nEND:VCARD',
};

const styles = [];
for (const moduleShape of ['square', 'rounded', 'dots']) {
  for (const eyeShape of ['square', 'rounded']) {
    for (const gradient of [false, true]) {
      styles.push({
        moduleShape,
        eyeShape,
        fg: gradient ? '#4f46e5' : '#0f172a',
        fg2: gradient ? '#9333ea' : null,
        bg: '#ffffff',
      });
    }
  }
}

(async () => {
  let fails = 0;
  let runs = 0;
  for (const [pname, payload] of Object.entries(payloads)) {
    for (const style of styles) {
      for (const sizePx of pname === 'url' ? [512, 256] : [512]) {
        runs++;
        const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
        const matrix = toMatrix(qr.modules);
        const canvas = createCanvas(sizePx, sizePx);
        const ctx = canvas.getContext('2d');
        paintQr(ctx, matrix, sizePx, 2, style);
        const img = ctx.getImageData(0, 0, sizePx, sizePx);
        const res = jsQR(img.data, sizePx, sizePx);
        const ok = res && res.data === payload;
        const tag = `${pname} ${style.moduleShape}/${style.eyeShape}${style.fg2 ? '/grad' : ''} @${sizePx}`;
        if (!ok) {
          fails++;
          console.log(`FAIL ${tag} -> ${res ? 'WRONG DATA' : 'NO DECODE'}`);
          fs.writeFileSync(path.join(__dirname, `qr-style-FAIL-${pname}-${style.moduleShape}-${style.eyeShape}${style.fg2 ? '-grad' : ''}.png`), canvas.toBuffer('image/png'));
        }
      }
    }
  }

  // Visual samples (one per module shape, gradient + rounded eyes).
  for (const moduleShape of ['square', 'rounded', 'dots']) {
    const qr = QRCode.create(payloads.url, { errorCorrectionLevel: 'M' });
    const canvas = createCanvas(512, 512);
    paintQr(canvas.getContext('2d'), toMatrix(qr.modules), 512, 2, {
      moduleShape, eyeShape: 'rounded', fg: '#4f46e5', fg2: '#9333ea', bg: '#ffffff',
    });
    fs.writeFileSync(path.join(__dirname, `qr-style-sample-${moduleShape}.png`), canvas.toBuffer('image/png'));
  }

  // SVG twin sanity: emits valid markup with the right primitives per shape.
  const qr = QRCode.create(payloads.url, { errorCorrectionLevel: 'M' });
  const m = toMatrix(qr.modules);
  const svgDots = svgQr(m, 2, { moduleShape: 'dots', eyeShape: 'rounded', fg: '#4f46e5', fg2: '#9333ea', bg: '#ffffff' });
  const svgSq = svgQr(m, 2, { moduleShape: 'square', eyeShape: 'square', fg: '#0f172a', fg2: null, bg: '#ffffff' });
  const svgOk =
    svgDots.includes('<circle') && svgDots.includes('linearGradient') && /viewBox="0 0 \d+ /.test(svgDots) &&
    svgSq.includes('<path d="M') && !svgSq.includes('linearGradient');
  if (!svgOk) { fails++; console.log('FAIL svg structure'); }

  console.log(`\n${runs} decode runs + svg check: ${fails === 0 ? 'ALL PASS' : fails + ' FAILURES'}`);
  process.exit(fails ? 1 : 0);
})();
