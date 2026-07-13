// Home-page "DiemDesk Editor" showcase image — a REAL pdf.js-rendered document
// page composited into a faithful editor frame (real doc, real signature/
// highlight), replacing the old synthetic CSS mockup. Run from frontend/:
//   node scripts/gen-editor-showcase.mjs   ->  public/editor-showcase.png
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const FONTS = 'C:/Mani Documents/MyBiz/DailyDesk/frontend/public/fonts/';
GlobalFonts.registerFromPath(FONTS + 'poppins-regular.ttf', 'Poppins');
GlobalFonts.registerFromPath(FONTS + 'poppins-bold.ttf', 'Poppins');
const UI = 'Poppins';
const INDIGO = '#4F46E5', SLATE900 = '#0f172a', SLATE800 = '#1e293b', SLATE700 = '#334155', SLATE400 = '#94a3b8', SLATE500 = '#64748b';

// ---------- 1) a clean, neutral one-page sample document ----------
async function buildSamplePdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // US Letter
  const H = await doc.embedFont(StandardFonts.Helvetica);
  const B = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.15, 0.2), grey = rgb(0.4, 0.44, 0.5);
  const L = 60;
  const text = (t, x, y, s, f = H, c = ink) => page.drawText(t, { x, y, size: s, font: f, color: c });

  text('MASTER SERVICES AGREEMENT', L, 732, 17, B);
  text('This Agreement is made effective as of July 15, 2026, by and between the', L, 706, 10.5, H, grey);
  text('parties identified below.', L, 691, 10.5, H, grey);

  text('1.  Scope of Services', L, 656, 11.5, B);
  const para1 = [
    'The Provider shall perform the services described in each Statement of Work',
    'agreed by the parties. Each engagement is independent and governed by the',
    'terms set out in this Agreement unless expressly amended in writing.',
  ];
  para1.forEach((ln, i) => text(ln, L, 636 - i * 15, 10.5));

  text('2.  Confidentiality', L, 574, 11.5, B);
  // This clause line (~y560) is where the highlight lands in the composite.
  text('Each party shall keep the other party’s information strictly confidential.', L, 554, 10.5);
  const para2 = [
    'Confidential information may be used only to perform this Agreement and must',
    'not be disclosed to any third party without prior written consent.',
  ];
  para2.forEach((ln, i) => text(ln, L, 539 - i * 15, 10.5));

  text('3.  Term and Termination', L, 486, 11.5, B);
  const para3 = [
    'This Agreement continues until terminated by either party on thirty (30) days’',
    'written notice. Obligations of confidentiality survive termination.',
  ];
  para3.forEach((ln, i) => text(ln, L, 466 - i * 15, 10.5));

  text('4.  Fees', L, 418, 11.5, B);
  const para4 = [
    'Fees are set out in the applicable Statement of Work and are invoiced monthly.',
    'Payment is due within thirty (30) days of the invoice date.',
  ];
  para4.forEach((ln, i) => text(ln, L, 398 - i * 15, 10.5));

  text('5.  Governing Law', L, 350, 11.5, B);
  const para5 = [
    'This Agreement is governed by the laws of the State of Georgia, without regard',
    'to its conflict-of-laws principles.',
  ];
  para5.forEach((ln, i) => text(ln, L, 330 - i * 15, 10.5));

  // Signature block (~y150 → ~81% down): the composite draws the signature here.
  page.drawLine({ start: { x: L, y: 168 }, end: { x: L + 230, y: 168 }, thickness: 0.8, color: grey });
  text('Authorized signature', L, 150, 9, H, grey);
  text('Jordan Avery · Director', L, 120, 9, H, grey);

  return await doc.save();
}

// ---------- 2) render page 1 to a canvas via pdf.js ----------
async function renderPage(bytes, targetW) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const nm = 'C:/Mani Documents/MyBiz/DailyDesk/frontend/node_modules/pdfjs-dist';
  const task = pdfjs.getDocument({
    data: bytes,
    wasmUrl: nm + '/wasm/',
    standardFontDataUrl: nm + '/standard_fonts/',
  });
  const pdf = await task.promise;
  const p = await pdf.getPage(1);
  const vp1 = p.getViewport({ scale: 1 });
  const vp = p.getViewport({ scale: targetW / vp1.width });
  const c = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  await p.render({ canvas: c, viewport: vp, background: 'rgba(255,255,255,1)' }).promise;
  return c;
}

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
// ⌘ command glyph (Poppins has no ⌘) — the square-knot of four corner rings.
function drawCmd(ctx, cx, cy, d, color) {
  const r = d * 0.2, h = d / 2 - r;
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.4, d * 0.1); ctx.lineCap = 'round';
  for (const [dx, dy] of [[-h, -h], [h, -h], [h, h], [-h, h]]) { ctx.beginPath(); ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.beginPath();
  ctx.moveTo(cx - h + r, cy - h); ctx.lineTo(cx + h - r, cy - h);
  ctx.moveTo(cx + h, cy - h + r); ctx.lineTo(cx + h, cy + h - r);
  ctx.moveTo(cx + h - r, cy + h); ctx.lineTo(cx - h + r, cy + h);
  ctx.moveTo(cx - h, cy + h - r); ctx.lineTo(cx - h, cy - h + r);
  ctx.stroke();
}
// download arrow (Poppins has no ⬇)
function drawDownload(ctx, cx, cy, s, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.55); ctx.lineTo(cx, cy + s * 0.2);
  ctx.moveTo(cx - s * 0.3, cy - s * 0.1); ctx.lineTo(cx, cy + s * 0.2); ctx.lineTo(cx + s * 0.3, cy - s * 0.1);
  ctx.moveTo(cx - s * 0.42, cy + s * 0.5); ctx.lineTo(cx + s * 0.42, cy + s * 0.5);
  ctx.stroke();
}

// ---------- 3) composite the editor frame ----------
async function main() {
  const bytes = await buildSamplePdf();
  const pageC = await renderPage(bytes, 1160); // 2x-ish render for crispness

  const W = 1536, Hc = 980;
  const c = createCanvas(W, Hc);
  const ctx = c.getContext('2d');
  ctx.fillStyle = SLATE900; ctx.fillRect(0, 0, W, Hc);

  // top bar
  ctx.strokeStyle = SLATE800; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 70); ctx.lineTo(W, 70); ctx.stroke();
  rr(ctx, 28, 18, 36, 36, 10); ctx.fillStyle = INDIGO; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `bold 20px ${UI}`; ctx.textAlign = 'center'; ctx.fillText('D', 46, 44); ctx.textAlign = 'left';
  ctx.fillStyle = '#e2e8f0'; ctx.font = `600 21px ${UI}`; ctx.fillText('Editor', 78, 44);
  // right: ⌘K pill + Export
  ctx.font = `15px ${UI}`; ctx.textAlign = 'left';
  const w1 = ctx.measureText('Do anything').width, wK = ctx.measureText('K').width;
  const pillW = w1 + 12 + 14 + 5 + wK + 32;
  const exBtnX = W - 158, pillX = exBtnX - 14 - pillW;
  rr(ctx, pillX, 22, pillW, 32, 9); ctx.fillStyle = 'rgba(30,41,59,0.7)'; ctx.fill();
  ctx.strokeStyle = SLATE700; ctx.lineWidth = 1.5; rr(ctx, pillX, 22, pillW, 32, 9); ctx.stroke();
  ctx.fillStyle = SLATE400; ctx.fillText('Do anything', pillX + 16, 43);
  drawCmd(ctx, pillX + 16 + w1 + 12 + 7, 37, 15, SLATE400);
  ctx.fillStyle = SLATE400; ctx.fillText('K', pillX + 16 + w1 + 12 + 14 + 5, 43);
  rr(ctx, exBtnX, 20, 136, 36, 9); ctx.fillStyle = INDIGO; ctx.fill();
  drawDownload(ctx, exBtnX + 28, 38, 14, '#fff');
  ctx.fillStyle = '#fff'; ctx.font = `600 15px ${UI}`; ctx.fillText('Export', exBtnX + 46, 43);

  // toolbar
  ctx.beginPath(); ctx.moveTo(0, 134); ctx.lineTo(W, 134); ctx.stroke();
  ctx.font = `600 15px ${UI}`;
  const selW = ctx.measureText('Select').width + 46;
  rr(ctx, 28, 88, selW, 34, 8); ctx.fillStyle = INDIGO; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText('Select', 28 + 34, 110);
  // cursor glyph
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(46, 98); ctx.lineTo(46, 114); ctx.lineTo(50.5, 109.5); ctx.lineTo(56, 109); ctx.closePath(); ctx.fill();
  let tx = 28 + selW + 12; ctx.font = `500 15px ${UI}`; ctx.fillStyle = SLATE400;
  for (const t of ['Text', 'Sign', 'Shape', 'Highlight']) { ctx.fillText(t, tx + 14, 110); tx += ctx.measureText(t).width + 28; }

  // left thumbnail rail
  ctx.beginPath(); ctx.moveTo(130, 134); ctx.lineTo(130, Hc); ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const ty = 158 + i * 128;
    rr(ctx, 24, ty, 82, 108, 7);
    ctx.fillStyle = i === 0 ? '#1e293b' : 'rgba(30,41,59,0.5)'; ctx.fill();
    ctx.strokeStyle = i === 0 ? INDIGO : SLATE700; ctx.lineWidth = i === 0 ? 2.5 : 1.5; rr(ctx, 24, ty, 82, 108, 7); ctx.stroke();
  }

  // right properties panel
  ctx.beginPath(); ctx.moveTo(W - 260, 134); ctx.lineTo(W - 260, Hc); ctx.stroke();
  const px0 = W - 236;
  ctx.fillStyle = SLATE500; ctx.font = `600 13px ${UI}`; ctx.fillText('S I G N A T U R E', px0, 180);
  const field = (lbl, val, x, y) => {
    rr(ctx, x, y, 96, 34, 7); ctx.fillStyle = 'rgba(30,41,59,0.6)'; ctx.fill();
    ctx.strokeStyle = SLATE700; ctx.lineWidth = 1.5; rr(ctx, x, y, 96, 34, 7); ctx.stroke();
    ctx.fillStyle = SLATE500; ctx.font = `13px ${UI}`; ctx.fillText(lbl, x + 12, y + 22);
    ctx.fillStyle = '#cbd5e1'; ctx.font = `600 13px ${UI}`; ctx.fillText(val, x + 34, y + 22);
  };
  field('X', '150', px0, 200); field('Y', '250', px0 + 108, 200);
  ctx.fillStyle = SLATE500; ctx.font = `600 13px ${UI}`; ctx.fillText('O P A C I T Y', px0, 272);
  rr(ctx, px0, 284, 204, 8, 4); ctx.fillStyle = SLATE700; ctx.fill();
  rr(ctx, px0, 284, 150, 8, 4); ctx.fillStyle = INDIGO; ctx.fill();
  ctx.fillStyle = SLATE500; ctx.font = `600 13px ${UI}`; ctx.fillText('I N K', px0, 336);
  const inks = [INDIGO, '#f1f5f9', '#94a3b8', '#0f172a'];
  inks.forEach((col, i) => {
    const cx = px0 + 14 + i * 40;
    ctx.beginPath(); ctx.arc(cx, 360, 11, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
    if (i === 0) { ctx.strokeStyle = INDIGO; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, 360, 15, 0, Math.PI * 2); ctx.stroke(); }
    if (i === 3) { ctx.strokeStyle = SLATE700; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, 360, 11, 0, Math.PI * 2); ctx.stroke(); }
  });

  // center: the REAL page with a soft shadow
  const centerL = 130, centerR = W - 260, cw = centerR - centerL;
  const ph = Hc - 134 - 96, pw = ph * (pageC.width / pageC.height);
  const px = centerL + (cw - pw) / 2, py = 134 + 48;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 48; ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#fff'; rr(ctx, px, py, pw, ph, 8); ctx.fill(); ctx.restore();
  ctx.save(); rr(ctx, px, py, pw, ph, 8); ctx.clip(); ctx.drawImage(pageC, px, py, pw, ph); ctx.restore();

  // highlight over the confidentiality clause (~ real line at 792-554 → 30% down)
  const yFrac = (yPdf) => py + ph * (1 - yPdf / 792);
  ctx.fillStyle = 'rgba(250,204,21,0.42)';
  ctx.fillRect(px + pw * 0.098, yFrac(566), pw * 0.66, ph * 0.02);

  // signature on the signature line (~y168 in pdf)
  const sigX = px + pw * 0.10, sigY = yFrac(178), sigW = pw * 0.34;
  ctx.strokeStyle = INDIGO; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(sigX, sigY);
  ctx.bezierCurveTo(sigX + sigW * 0.10, sigY - 34, sigX + sigW * 0.16, sigY + 20, sigX + sigW * 0.24, sigY - 4);
  ctx.bezierCurveTo(sigX + sigW * 0.30, sigY - 22, sigX + sigW * 0.36, sigY + 16, sigX + sigW * 0.44, sigY - 2);
  ctx.bezierCurveTo(sigX + sigW * 0.52, sigY - 20, sigX + sigW * 0.60, sigY + 18, sigX + sigW * 0.70, sigY - 6);
  ctx.bezierCurveTo(sigX + sigW * 0.80, sigY - 26, sigX + sigW * 0.92, sigY + 10, sigX + sigW * 1.04, sigY - 12);
  ctx.stroke();

  // selection box + corner handles around the signature
  const bx = sigX - 14, by = sigY - 42, bw = sigW * 1.2, bh = 62;
  ctx.strokeStyle = INDIGO; ctx.lineWidth = 2; rr(ctx, bx, by, bw, bh, 6); ctx.stroke();
  for (const [hx, hy] of [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]]) {
    ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = INDIGO; ctx.lineWidth = 2.5; ctx.stroke();
  }
  // mini floating toolbar above the selection
  const mt = bx + bw / 2 - 34;
  rr(ctx, mt, by - 34, 68, 24, 6); ctx.fillStyle = SLATE900; ctx.fill();
  ctx.strokeStyle = SLATE700; ctx.lineWidth = 1; rr(ctx, mt, by - 34, 68, 24, 6); ctx.stroke();
  [INDIGO, '#94a3b8', '#475569'].forEach((col, i) => { rr(ctx, mt + 12 + i * 16, by - 27, 10, 10, 2); ctx.fillStyle = col; ctx.fill(); });

  writeFileSync('C:/Mani Documents/MyBiz/DailyDesk/frontend/public/editor-showcase.png', c.toBuffer('image/png'));
  console.log('wrote public/editor-showcase.png', c.width + 'x' + c.height);
}
main().catch((e) => { console.error(e); process.exit(1); });
