'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { Download, Upload, Layers, X, Sparkles } from 'lucide-react';
import { ToolHeader } from '@/components/app/tool-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type ECLevel = 'L' | 'M' | 'Q' | 'H';

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
  ctx.fillStyle = opts.bg;
  const r = side * 0.18;
  const bx = x - pad, by = y - pad, bw = side + pad * 2, bh = side + pad * 2;
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
    if (!bulkMode) redraw();
  }, [redraw, bulkMode]);

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
    <>
      <ToolHeader title="QR code generator" subtitle="Custom colors, logo, and bulk export" />

      <div className="mx-auto max-w-5xl animate-fade-in p-4 sm:p-6">
        {/* Mode switch */}
        <div className="mb-6 inline-flex rounded-lg border bg-card p-1 shadow-soft">
          {[
            { k: false, label: 'Single' },
            { k: true, label: 'Bulk' },
          ].map((m) => (
            <button
              key={m.label}
              onClick={() => setBulkMode(m.k)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                bulkMode === m.k ? 'bg-primary text-primary-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_minmax(280px,360px)]">
          {/* Controls */}
          <Card>
            <CardContent className="space-y-5 p-5">
              {!bulkMode ? (
                <div className="space-y-2">
                  <Label htmlFor="content">Content (URL or text)</Label>
                  <Input id="content" value={text} onChange={(e) => setText(e.target.value)} placeholder="https://example.com" />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="bulk">One entry per line · {bulkCount}</Label>
                  <textarea
                    id="bulk"
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows={6}
                    placeholder={'https://site.com/a\nhttps://site.com/b\nHello world'}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Foreground</Label>
                  <div className="flex items-center gap-2 rounded-md border border-input p-1.5">
                    <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="size-8 cursor-pointer rounded border-0 bg-transparent p-0" />
                    <span className="font-mono text-xs uppercase text-muted-foreground">{fg}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Background</Label>
                  <div className="flex items-center gap-2 rounded-md border border-input p-1.5">
                    <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="size-8 cursor-pointer rounded border-0 bg-transparent p-0" />
                    <span className="font-mono text-xs uppercase text-muted-foreground">{bg}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Size · {size}px</Label>
                <input type="range" min={128} max={1024} step={32} value={size} onChange={(e) => setSize(Number(e.target.value))} className="dd-range" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quiet zone · {margin}</Label>
                  <input type="range" min={0} max={8} value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="dd-range" />
                </div>
                <div className="space-y-2">
                  <Label>Error correction</Label>
                  <Select value={effectiveEc} disabled={!!logo} onChange={(e) => setEc(e.target.value as ECLevel)}>
                    <option value="L">L — 7%</option>
                    <option value="M">M — 15%</option>
                    <option value="Q">Q — 25%</option>
                    <option value="H">H — 30%</option>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border border-dashed p-4">
                <Label className="mb-2 block">Center logo (optional)</Label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onLogoUpload}
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
                />
                {logo && (
                  <div className="mt-3 space-y-2">
                    <Label className="text-xs text-muted-foreground">Logo size · {Math.round(logoScale * 100)}%</Label>
                    <input type="range" min={0.1} max={0.35} step={0.01} value={logoScale} onChange={(e) => setLogoScale(Number(e.target.value))} className="dd-range" />
                    <button onClick={() => { setLogo(null); setLogoDataUrl(null); }} className="inline-flex items-center gap-1 text-xs font-medium text-destructive hover:underline">
                      <X className="size-3" /> Remove logo
                    </button>
                    <p className="text-xs text-muted-foreground">Error correction locked to H so the code stays scannable.</p>
                  </div>
                )}
              </div>

              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
              )}
            </CardContent>
          </Card>

          {/* Preview + export */}
          <Card className="lg:sticky lg:top-20 h-fit">
            <CardContent className="flex flex-col items-center gap-5 p-5">
              <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted/50 p-5">
                {bulkMode ? (
                  <div className="text-center">
                    <Layers className="mx-auto mb-2 size-8 text-primary" />
                    <p className="text-3xl font-semibold text-primary">{bulkCount}</p>
                    <p className="text-sm text-muted-foreground">code{bulkCount === 1 ? '' : 's'} ready</p>
                  </div>
                ) : (
                  <canvas ref={canvasRef} className="h-auto w-full max-w-[260px] rounded-md" />
                )}
              </div>

              {!bulkMode ? (
                <div className="grid w-full grid-cols-2 gap-3">
                  <Button onClick={downloadPng}>
                    <Download /> PNG
                  </Button>
                  <Button variant="outline" onClick={downloadSvg}>
                    <Download /> SVG
                  </Button>
                </div>
              ) : (
                <Button className="w-full" onClick={downloadBulkZip} disabled={bulkBusy || bulkCount === 0}>
                  {bulkBusy ? 'Generating…' : (<><Upload /> Download ZIP ({bulkCount})</>)}
                </Button>
              )}

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="size-3.5" /> Free · runs entirely in your browser
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
