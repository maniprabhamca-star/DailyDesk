'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { Download, Upload, Layers, X, Sparkles, Link2, Type, Wifi, Mail, Phone, MessageSquareText, UserRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { KeepGoing } from '@/components/app/keep-going';
import { downloadBlob } from '@/lib/download';
import { buildPayload, payloadLabel, missingHint, EMPTY_FIELDS, type QrType, type QrFields } from '@/lib/qr-payload';
import { paintQr, svgQr, toMatrix, type ModuleShape, type EyeShape, type QrStyle } from '@/lib/qr-paint';
import { cn } from '@/lib/utils';

type ECLevel = 'L' | 'M' | 'Q' | 'H';

const TYPES: { id: QrType; label: string; icon: typeof Link2 }[] = [
  { id: 'link', label: 'Link', icon: Link2 },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'wifi', label: 'Wi-Fi', icon: Wifi },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'phone', label: 'Call', icon: Phone },
  { id: 'sms', label: 'SMS', icon: MessageSquareText },
  { id: 'vcard', label: 'Contact', icon: UserRound },
];

function renderToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  opts: { size: number; margin: number; ec: ECLevel; style: QrStyle },
  logo: HTMLImageElement | null,
  logoScale: number,
) {
  const qr = QRCode.create(text || ' ', { errorCorrectionLevel: opts.ec });
  canvas.width = opts.size;
  canvas.height = opts.size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  paintQr(ctx, toMatrix(qr.modules), opts.size, opts.margin, opts.style);
  if (!logo) return;
  const side = canvas.width * logoScale;
  const x = (canvas.width - side) / 2;
  const y = (canvas.height - side) / 2;
  const pad = side * 0.12;
  ctx.fillStyle = opts.style.bg;
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

function safeFilename(text: string, fallback: string) {
  const base = text.trim().replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return (base || fallback).slice(0, 40);
}

export function QrCodeTool({ initialType = 'link', excludeFromRail = '/qr-code-generator' }: { initialType?: QrType; excludeFromRail?: string }) {
  const [qrType, setQrType] = useState<QrType>(initialType);
  const [fields, setFields] = useState<QrFields>(EMPTY_FIELDS);
  const [fg, setFg] = useState('#0f172a');
  const [bg, setBg] = useState('#ffffff');
  const [moduleShape, setModuleShape] = useState<ModuleShape>('square');
  const [eyeShape, setEyeShape] = useState<EyeShape>('square');
  const [gradientOn, setGradientOn] = useState(false);
  const [fg2, setFg2] = useState('#7c3aed');
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
  const payload = useMemo(() => buildPayload(qrType, fields), [qrType, fields]);
  const hint = payload ? null : missingHint(qrType);
  const style: QrStyle = useMemo(
    () => ({ fg, fg2: gradientOn ? fg2 : null, bg, moduleShape, eyeShape }),
    [fg, fg2, gradientOn, bg, moduleShape, eyeShape],
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      renderToCanvas(canvas, payload, { size, margin, ec: effectiveEc, style }, logo, logoScale);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not render QR code');
    }
  }, [payload, size, margin, effectiveEc, style, logo, logoScale]);

  useEffect(() => {
    if (!bulkMode) redraw();
  }, [redraw, bulkMode]);

  function patch<K extends keyof QrFields>(key: K, value: QrFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

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
    if (!canvas || !payload) return;
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${safeFilename(payloadLabel(qrType, fields), 'qr-code')}.png`);
    }, 'image/png');
  }

  async function downloadSvg() {
    if (!payload) return;
    try {
      const qr = QRCode.create(payload, { errorCorrectionLevel: effectiveEc });
      let svg = svgQr(toMatrix(qr.modules), margin, style);
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
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${safeFilename(payloadLabel(qrType, fields), 'qr-code')}.svg`);
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
      const oc = document.createElement('canvas');
      const octx = oc.getContext('2d');
      if (!octx) throw new Error('Canvas unavailable');
      oc.width = oc.height = size;
      for (let i = 0; i < lines.length; i++) {
        // Same styled renderer as the preview, so bulk output matches.
        const qr = QRCode.create(lines[i], { errorCorrectionLevel: ec });
        paintQr(octx, toMatrix(qr.modules), size, margin, style);
        const dataUrl = oc.toDataURL('image/png');
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

  const inputCls = 'space-y-2';

  return (
    <div className="animate-fade-in">
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

      <div className="grid gap-5 md:grid-cols-[1fr_minmax(260px,300px)]">
        {/* Controls */}
        <Card>
          <CardContent className="space-y-5 p-5">
            {!bulkMode ? (
              <>
                {/* Content type */}
                <div className="flex flex-wrap gap-1.5">
                  {TYPES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setQrType(t.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                        qrType === t.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-input text-muted-foreground hover:border-primary/40 hover:text-foreground',
                      )}
                    >
                      <t.icon className="size-3.5" /> {t.label}
                    </button>
                  ))}
                </div>

                {qrType === 'link' && (
                  <div className={inputCls}>
                    <Label htmlFor="content">Link (URL)</Label>
                    <Input id="content" value={fields.link} onChange={(e) => patch('link', e.target.value)} placeholder="https://example.com" />
                  </div>
                )}

                {qrType === 'text' && (
                  <div className={inputCls}>
                    <Label htmlFor="qr-text">Text</Label>
                    <textarea
                      id="qr-text"
                      value={fields.text}
                      onChange={(e) => patch('text', e.target.value)}
                      rows={3}
                      placeholder="Any text — notes, serial numbers, a message…"
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                )}

                {qrType === 'wifi' && (
                  <div className="space-y-4">
                    <div className={inputCls}>
                      <Label htmlFor="wifi-ssid">Network name (SSID)</Label>
                      <Input id="wifi-ssid" value={fields.wifi.ssid} onChange={(e) => patch('wifi', { ...fields.wifi, ssid: e.target.value })} placeholder="MyHomeWiFi" />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className={inputCls}>
                        <Label htmlFor="wifi-pass">Password</Label>
                        <Input id="wifi-pass" value={fields.wifi.password} onChange={(e) => patch('wifi', { ...fields.wifi, password: e.target.value })} placeholder="Network password" disabled={fields.wifi.security === 'nopass'} />
                      </div>
                      <div className={inputCls}>
                        <Label>Security</Label>
                        <Select value={fields.wifi.security} onChange={(e) => patch('wifi', { ...fields.wifi, security: e.target.value as 'WPA' | 'WEP' | 'nopass' })}>
                          <option value="WPA">WPA / WPA2 / WPA3</option>
                          <option value="WEP">WEP (legacy)</option>
                          <option value="nopass">Open — no password</option>
                        </Select>
                      </div>
                    </div>
                    <label htmlFor="wifi-hidden" className="flex cursor-pointer items-center justify-between rounded-lg px-1 py-1">
                      <span className="text-sm font-medium">Hidden network</span>
                      <Switch id="wifi-hidden" checked={fields.wifi.hidden} onCheckedChange={(v) => patch('wifi', { ...fields.wifi, hidden: v })} />
                    </label>
                    <p className="text-xs text-muted-foreground">Scanning joins the network — the password stays inside the code, never uploaded.</p>
                  </div>
                )}

                {qrType === 'email' && (
                  <div className="space-y-4">
                    <div className={inputCls}>
                      <Label htmlFor="em-to">To (email address)</Label>
                      <Input id="em-to" type="email" value={fields.email.to} onChange={(e) => patch('email', { ...fields.email, to: e.target.value })} placeholder="hello@example.com" />
                    </div>
                    <div className={inputCls}>
                      <Label htmlFor="em-sub">Subject (optional)</Label>
                      <Input id="em-sub" value={fields.email.subject} onChange={(e) => patch('email', { ...fields.email, subject: e.target.value })} placeholder="Inquiry" />
                    </div>
                    <div className={inputCls}>
                      <Label htmlFor="em-body">Message (optional)</Label>
                      <textarea id="em-body" value={fields.email.body} onChange={(e) => patch('email', { ...fields.email, body: e.target.value })} rows={2}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
                    </div>
                  </div>
                )}

                {qrType === 'phone' && (
                  <div className={inputCls}>
                    <Label htmlFor="ph-num">Phone number</Label>
                    <Input id="ph-num" type="tel" value={fields.phone} onChange={(e) => patch('phone', e.target.value)} placeholder="+1 555 123 4567" />
                    <p className="text-xs text-muted-foreground">Scanning opens the dialer with this number ready to call.</p>
                  </div>
                )}

                {qrType === 'sms' && (
                  <div className="space-y-4">
                    <div className={inputCls}>
                      <Label htmlFor="sms-num">Phone number</Label>
                      <Input id="sms-num" type="tel" value={fields.sms.number} onChange={(e) => patch('sms', { ...fields.sms, number: e.target.value })} placeholder="+1 555 123 4567" />
                    </div>
                    <div className={inputCls}>
                      <Label htmlFor="sms-msg">Pre-filled message (optional)</Label>
                      <Input id="sms-msg" value={fields.sms.message} onChange={(e) => patch('sms', { ...fields.sms, message: e.target.value })} placeholder="Hi! I scanned your code." />
                    </div>
                  </div>
                )}

                {qrType === 'vcard' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className={inputCls}>
                        <Label htmlFor="vc-first">First name</Label>
                        <Input id="vc-first" value={fields.vcard.firstName} onChange={(e) => patch('vcard', { ...fields.vcard, firstName: e.target.value })} />
                      </div>
                      <div className={inputCls}>
                        <Label htmlFor="vc-last">Last name</Label>
                        <Input id="vc-last" value={fields.vcard.lastName} onChange={(e) => patch('vcard', { ...fields.vcard, lastName: e.target.value })} />
                      </div>
                      <div className={inputCls}>
                        <Label htmlFor="vc-phone">Phone</Label>
                        <Input id="vc-phone" type="tel" value={fields.vcard.phone} onChange={(e) => patch('vcard', { ...fields.vcard, phone: e.target.value })} />
                      </div>
                      <div className={inputCls}>
                        <Label htmlFor="vc-email">Email</Label>
                        <Input id="vc-email" type="email" value={fields.vcard.email} onChange={(e) => patch('vcard', { ...fields.vcard, email: e.target.value })} />
                      </div>
                      <div className={inputCls}>
                        <Label htmlFor="vc-org">Company (optional)</Label>
                        <Input id="vc-org" value={fields.vcard.org} onChange={(e) => patch('vcard', { ...fields.vcard, org: e.target.value })} />
                      </div>
                      <div className={inputCls}>
                        <Label htmlFor="vc-title">Job title (optional)</Label>
                        <Input id="vc-title" value={fields.vcard.title} onChange={(e) => patch('vcard', { ...fields.vcard, title: e.target.value })} />
                      </div>
                    </div>
                    <div className={inputCls}>
                      <Label htmlFor="vc-url">Website (optional)</Label>
                      <Input id="vc-url" value={fields.vcard.url} onChange={(e) => patch('vcard', { ...fields.vcard, url: e.target.value })} placeholder="https://…" />
                    </div>
                    <p className="text-xs text-muted-foreground">Scanning opens “Add contact” with everything filled in — works on iPhone and Android, no app needed.</p>
                  </div>
                )}
              </>
            ) : (
              <div className={inputCls}>
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

            {/* Style: module shape, eye shape, gradient */}
            <div className="space-y-3">
              <Label>Style</Label>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Modules</span>
                  {(['square', 'rounded', 'dots'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setModuleShape(s)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                        moduleShape === s ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground hover:border-primary/40 hover:text-foreground',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Eyes</span>
                  {(['square', 'rounded'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setEyeShape(s)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                        eyeShape === s ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground hover:border-primary/40 hover:text-foreground',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Gradient</span>
                <div className="flex items-center gap-2.5">
                  {gradientOn && (
                    <span className="flex items-center gap-1.5 rounded-md border border-input p-1">
                      <input type="color" value={fg2} onChange={(e) => setFg2(e.target.value)} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" aria-label="Gradient end color" />
                      <span className="pr-1 font-mono text-[10px] uppercase text-muted-foreground">{fg2}</span>
                    </span>
                  )}
                  <Switch id="qr-grad" checked={gradientOn} onCheckedChange={setGradientOn} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Size · {size}px</Label>
              <input type="range" min={128} max={2048} step={32} value={size} onChange={(e) => setSize(Number(e.target.value))} className="dd-range" />
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
                onChange={(e) => { onLogoUpload(e); e.currentTarget.value = ''; }}
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
        <Card className="h-fit md:sticky md:top-20">
          <CardContent className="flex flex-col items-center gap-5 p-5">
            <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted/50 p-5">
              {bulkMode ? (
                <div className="text-center">
                  <Layers className="mx-auto mb-2 size-8 text-primary" />
                  <p className="text-3xl font-semibold text-primary">{bulkCount}</p>
                  <p className="text-sm text-muted-foreground">code{bulkCount === 1 ? '' : 's'} ready</p>
                </div>
              ) : (
                <canvas ref={canvasRef} className={cn('h-auto w-full max-w-[260px] rounded-md', !payload && 'opacity-30')} />
              )}
            </div>

            {!bulkMode && hint && (
              <p className="text-center text-xs text-muted-foreground">{hint}</p>
            )}

            {!bulkMode ? (
              <div className="grid w-full grid-cols-2 gap-3">
                <Button onClick={downloadPng} disabled={!payload}>
                  <Download /> PNG
                </Button>
                <Button variant="outline" onClick={downloadSvg} disabled={!payload}>
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

      <KeepGoing exclude={excludeFromRail} />
    </div>
  );
}
