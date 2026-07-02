'use client';

import { useState } from 'react';
import { Copy, Check, Pipette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { KeepGoing } from '@/components/app/keep-going';

// Pick, convert, and copy colors — HEX/RGB/HSL, shades & tints, and a WCAG
// contrast check. The eyedropper (pick any color on screen) uses the browser's
// EyeDropper API where available; everywhere else the swatch picker still works.

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb | null {
  const m = hex.trim().replace(/^#/, '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) };
}
function rgbToHex({ r, g, b }: Rgb): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}
function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}
function mix(c: Rgb, target: number, t: number): Rgb {
  return { r: c.r + (target - c.r) * t, g: c.g + (target - c.g) * t, b: c.b + (target - c.b) * t };
}
// WCAG relative luminance + contrast ratio.
function luminance({ r, g, b }: Rgb): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: Rgb, b: Rgb): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        <code className="text-xs font-semibold">{value}</code>
        <Button size="icon" variant="ghost" className="size-7" aria-label={`Copy ${label}`}
          onClick={() => { void navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }); }}>
          {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
        </Button>
      </span>
    </div>
  );
}

export function ColorPickerTool() {
  const [hex, setHex] = useState('#7c3aed');
  const [typed, setTyped] = useState('#7c3aed');
  const rgb = hexToRgb(hex)!;
  const hsl = rgbToHsl(rgb);
  const canEyedrop = typeof window !== 'undefined' && 'EyeDropper' in window;

  function setColor(h: string) {
    setHex(h);
    setTyped(h);
  }

  function onType(v: string) {
    setTyped(v);
    const parsed = hexToRgb(v);
    if (parsed) setHex(rgbToHex(parsed));
    else {
      const m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      if (m) setHex(rgbToHex({ r: +m[1], g: +m[2], b: +m[3] }));
    }
  }

  async function eyedrop() {
    try {
      const ed = new (window as unknown as { EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper();
      const res = await ed.open();
      setColor(res.sRGBHex);
    } catch { /* user cancelled */ }
  }

  const steps = [0.15, 0.3, 0.45, 0.6, 0.75];
  const shades = steps.map((t) => rgbToHex(mix(rgb, 0, t)));
  const tints = steps.map((t) => rgbToHex(mix(rgb, 255, t)));
  const complementary = rgbToHex(hexToRgb(`#${((0xffffff ^ parseInt(hex.slice(1), 16)) >>> 0).toString(16).padStart(6, '0')}`)!);
  const onWhite = contrast(rgb, { r: 255, g: 255, b: 255 });
  const onBlack = contrast(rgb, { r: 0, g: 0, b: 0 });

  const Badge = ({ ratio }: { ratio: number }) => (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${ratio >= 7 ? 'bg-emerald-500/15 text-emerald-600' : ratio >= 4.5 ? 'bg-emerald-500/15 text-emerald-600' : ratio >= 3 ? 'bg-amber-500/15 text-amber-600' : 'bg-red-500/15 text-red-600'}`}>
      {ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large' : 'Fail'}
    </span>
  );

  return (
    <Card>
      <CardContent className="p-5">
        <div className="grid gap-5 md:grid-cols-[auto_1fr]">
          <div className="mx-auto flex flex-col items-center gap-3">
            <div className="size-40 rounded-2xl border shadow-inner" style={{ backgroundColor: hex }} aria-label={`Current color ${hex}`} />
            <div className="flex items-center gap-2">
              <input type="color" value={hex} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border bg-card p-1" aria-label="Pick a color" />
              <input value={typed} onChange={(e) => onType(e.target.value)} spellCheck={false}
                className="h-10 w-32 rounded-lg border bg-background px-2 text-center font-mono text-sm outline-none focus:border-primary" aria-label="Hex or RGB value" />
              {canEyedrop && (
                <Button variant="outline" size="icon" onClick={eyedrop} aria-label="Pick a color from the screen" title="Pick any color on your screen">
                  <Pipette className="size-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div className="divide-y rounded-xl border bg-card">
              <CopyRow label="HEX" value={hex} />
              <CopyRow label="RGB" value={`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`} />
              <CopyRow label="HSL" value={`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`} />
              <CopyRow label="Complementary" value={complementary} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
                <span className="font-semibold" style={{ color: hex }}>On white</span>
                <span className="flex items-center gap-1.5 text-xs tabular-nums text-gray-500">{onWhite}:1 <Badge ratio={onWhite} /></span>
              </div>
              <div className="flex items-center justify-between rounded-xl border bg-black px-3 py-2">
                <span className="font-semibold" style={{ color: hex }}>On black</span>
                <span className="flex items-center gap-1.5 text-xs tabular-nums text-gray-400">{onBlack}:1 <Badge ratio={onBlack} /></span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Shades — click to use</p>
          <div className="grid grid-cols-5 overflow-hidden rounded-xl border">
            {shades.map((c) => (
              <button key={c} onClick={() => setColor(c)} className="group h-12 transition-transform hover:scale-[1.04]" style={{ backgroundColor: c }} aria-label={`Use ${c}`}>
                <span className="text-[10px] font-mono text-white/0 group-hover:text-white/90">{c}</span>
              </button>
            ))}
          </div>
          <p className="mb-1.5 mt-3 text-xs font-semibold text-muted-foreground">Tints — click to use</p>
          <div className="grid grid-cols-5 overflow-hidden rounded-xl border">
            {tints.map((c) => (
              <button key={c} onClick={() => setColor(c)} className="group h-12 transition-transform hover:scale-[1.04]" style={{ backgroundColor: c }} aria-label={`Use ${c}`}>
                <span className="text-[10px] font-mono text-black/0 group-hover:text-black/70">{c}</span>
              </button>
            ))}
          </div>
        </div>

        <KeepGoing exclude="/color-picker" />
      </CardContent>
    </Card>
  );
}
