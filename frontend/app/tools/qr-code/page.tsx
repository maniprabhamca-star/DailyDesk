'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import JSZip from 'jszip';

type ECLevel = 'L' | 'M' | 'Q' | 'H';

// Draws the QR for `text` onto `canvas`, overlaying `logo` in the center if provided.
async function renderToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  opts: { fg: string; bg: string; size: number; margin: number; ec: ECLevel },
  logo: HTMLImageElement | null,
  logoScale: number,
) {
  await QRCode.toCanvas(canvas, text || ' ', {
    errorCorrectionLevel: opts.ec,
    margin: opts.margin,
    width: opts.size,
    color: { dark: opts.fg, light: opts.bg },
  });

  if (!logo) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const side = canvas.width * logoScale;
  const x = (canvas.width - side) / 2;
  const y = (canvas.height - side) / 2;
  const pad = side * 0.12;

  // White rounded backing so the logo never blends into dark modules.
  ctx.fillStyle = opts.bg;
  const r = side * 0.18;
  const bx = x - pad;
  const by = y - pad;
  const bw = side + pad * 2;
  const bh = side + pad * 2;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
  ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
  ctx.arcTo(bx, by + bh, bx, by, r);
  ctx.arcTo(bx, by, bx + bw, by, r);
  ctx.closePath();
  ctx.fill();

  ctx.drawImage(logo, x, y, side, side);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeFilename(text: string, fallback: string) {
  const base = text.trim().replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return (base || fallback).slice(0, 40);
}

export default function QrCodeGenerator() {
  const [text, setText] = useState('https://dailydesk.app');
  const [fg, setFg] = useState('#0f172a');
  const [bg, setBg] = useState('#ffffff');
  const [size, setSize] = useState(512);
  const [margin, setMargin] = useState(2);
  const [ec, setEc] = useState<ECLevel>('M');
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoScale, setLogoScale] = useState(0.22);

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Logo needs the strongest error correction to stay scannable through the overlay.
  const effectiveEc: ECLevel = logo ? 'H' : ec;

  const redraw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      await renderToCanvas(canvas, text, { fg, bg, size, margin, ec: effectiveEc }, logo, logoScale);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not render QR code');
    }
  }, [text, fg, bg, size, margin, effectiveEc, logo, logoScale]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  function onLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        setLogo(img);
        setLogoDataUrl(dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${safeFilename(text, 'qr-code')}.png`);
    }, 'image/png');
  }

  async function downloadSvg() {
    try {
      let svg = await QRCode.toString(text || ' ', {
        type: 'svg',
        errorCorrectionLevel: effectiveEc,
        margin,
        color: { dark: fg, light: bg },
      });
      if (logoDataUrl) {
        const vb = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) /);
        const s = vb ? parseFloat(vb[1]) : 33;
        const side = s * logoScale;
        const pos = (s - side) / 2;
        const pad = side * 0.12;
        const overlay =
          `<rect x="${pos - pad}" y="${pos - pad}" width="${side + pad * 2}" height="${side + pad * 2}" rx="${side * 0.18}" fill="${bg}"/>` +
          `<image x="${pos}" y="${pos}" width="${side}" height="${side}" href="${logoDataUrl}" />`;
        svg = svg.replace('</svg>', `${overlay}</svg>`);
      }
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${safeFilename(text, 'qr-code')}.svg`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export SVG');
    }
  }

  async function downloadBulkZip() {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setError('Add at least one line to bulk-generate.');
      return;
    }
    setBulkBusy(true);
    setError(null);
    try {
      const zip = new JSZip();
      const seen: Record<string, number> = {};
      for (let i = 0; i < lines.length; i++) {
        const dataUrl = await QRCode.toDataURL(lines[i], {
          errorCorrectionLevel: ec,
          margin,
          width: size,
          color: { dark: fg, light: bg },
        });
        let name = safeFilename(lines[i], `qr-${i + 1}`);
        seen[name] = (seen[name] ?? 0) + 1;
        if (seen[name] > 1) name = `${name}-${seen[name]}`;
        zip.file(`${name}.png`, dataUrl.split(',')[1], { base64: true });
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `qr-codes-${lines.length}.zip`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk export failed');
    } finally {
      setBulkBusy(false);
    }
  }

  const bulkCount = bulkText.split('\n').map((l) => l.trim()).filter(Boolean).length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-50 to-white py-10 px-4">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <a href="/" className="text-sm text-primary-600 hover:underline">← DailyDesk</a>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">QR Code Generator</h1>
          <p className="text-gray-600">Custom colors, center logo, and bulk export — all free, in your browser.</p>
        </header>

        <div className="mb-6 inline-flex rounded-lg border border-primary-100 bg-white p-1 shadow-sm">
          <button
            onClick={() => setBulkMode(false)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${!bulkMode ? 'bg-primary-600 text-white' : 'text-gray-600'}`}
          >
            Single
          </button>
          <button
            onClick={() => setBulkMode(true)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${bulkMode ? 'bg-primary-600 text-white' : 'text-gray-600'}`}
          >
            Bulk
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Controls */}
          <div className="space-y-5 rounded-xl border border-primary-100 bg-white p-6 shadow-sm">
            {!bulkMode ? (
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Content (URL or text)</span>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="https://example.com"
                />
              </label>
            ) : (
              <label className="block">
                <span className="text-sm font-medium text-gray-700">One entry per line ({bulkCount})</span>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={6}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder={'https://site.com/a\nhttps://site.com/b\nHello world'}
                />
              </label>
            )}

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Foreground</span>
                <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-gray-300" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Background</span>
                <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-gray-300" />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Size: {size}px</span>
              <input type="range" min={128} max={1024} step={32} value={size} onChange={(e) => setSize(Number(e.target.value))} className="mt-1 w-full accent-primary-600" />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Quiet zone: {margin}</span>
                <input type="range" min={0} max={8} value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="mt-1 w-full accent-primary-600" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Error correction</span>
                <select
                  value={effectiveEc}
                  disabled={!!logo}
                  onChange={(e) => setEc(e.target.value as ECLevel)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="L">L — 7%</option>
                  <option value="M">M — 15%</option>
                  <option value="Q">Q — 25%</option>
                  <option value="H">H — 30%</option>
                </select>
              </label>
            </div>

            <div className="rounded-lg border border-dashed border-gray-300 p-4">
              <span className="text-sm font-medium text-gray-700">Center logo (optional)</span>
              <input type="file" accept="image/*" onChange={onLogoUpload} className="mt-2 block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-primary-700 hover:file:bg-primary-100" />
              {logo && (
                <div className="mt-3 space-y-2">
                  <label className="block">
                    <span className="text-xs text-gray-500">Logo size: {Math.round(logoScale * 100)}%</span>
                    <input type="range" min={0.1} max={0.35} step={0.01} value={logoScale} onChange={(e) => setLogoScale(Number(e.target.value))} className="w-full accent-primary-600" />
                  </label>
                  <button onClick={() => { setLogo(null); setLogoDataUrl(null); }} className="text-xs text-red-600 hover:underline">
                    Remove logo
                  </button>
                  <p className="text-xs text-gray-400">Error correction locked to H so the code stays scannable.</p>
                </div>
              )}
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          </div>

          {/* Preview + export */}
          <div className="flex flex-col items-center gap-4 rounded-xl border border-primary-100 bg-white p-6 shadow-sm">
            <div className="flex aspect-square w-full max-w-sm items-center justify-center rounded-lg bg-gray-50 p-4">
              {bulkMode ? (
                <div className="text-center text-gray-400">
                  <p className="text-4xl font-bold text-primary-600">{bulkCount}</p>
                  <p className="text-sm">code{bulkCount === 1 ? '' : 's'} ready to export</p>
                </div>
              ) : (
                <canvas ref={canvasRef} className="h-auto w-full max-w-full rounded" />
              )}
            </div>

            {!bulkMode ? (
              <div className="grid w-full max-w-sm grid-cols-2 gap-3">
                <button onClick={downloadPng} className="rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white hover:bg-primary-700">
                  Download PNG
                </button>
                <button onClick={downloadSvg} className="rounded-lg border border-primary-600 px-4 py-2.5 font-medium text-primary-700 hover:bg-primary-50">
                  Download SVG
                </button>
              </div>
            ) : (
              <button
                onClick={downloadBulkZip}
                disabled={bulkBusy || bulkCount === 0}
                className="w-full max-w-sm rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkBusy ? 'Generating…' : `Download ZIP (${bulkCount})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
