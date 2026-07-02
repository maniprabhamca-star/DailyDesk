'use client';

import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { KeepGoing } from '@/components/app/keep-going';

// Factor-based conversion (factor = how many BASE units one unit is), with
// temperature special-cased. All math runs locally, instantly, both ways.

type Unit = { label: string; factor: number };
type Category = { label: string; units: Record<string, Unit>; defaults: [string, string] };

const CATEGORIES: Record<string, Category> = {
  length: {
    label: 'Length', defaults: ['m', 'ft'],
    units: {
      mm: { label: 'Millimeters (mm)', factor: 0.001 },
      cm: { label: 'Centimeters (cm)', factor: 0.01 },
      m: { label: 'Meters (m)', factor: 1 },
      km: { label: 'Kilometers (km)', factor: 1000 },
      in: { label: 'Inches (in)', factor: 0.0254 },
      ft: { label: 'Feet (ft)', factor: 0.3048 },
      yd: { label: 'Yards (yd)', factor: 0.9144 },
      mi: { label: 'Miles (mi)', factor: 1609.344 },
    },
  },
  weight: {
    label: 'Weight', defaults: ['kg', 'lb'],
    units: {
      mg: { label: 'Milligrams (mg)', factor: 0.000001 },
      g: { label: 'Grams (g)', factor: 0.001 },
      kg: { label: 'Kilograms (kg)', factor: 1 },
      t: { label: 'Metric tons (t)', factor: 1000 },
      oz: { label: 'Ounces (oz)', factor: 0.028349523125 },
      lb: { label: 'Pounds (lb)', factor: 0.45359237 },
      st: { label: 'Stone (st)', factor: 6.35029318 },
    },
  },
  temperature: {
    label: 'Temperature', defaults: ['c', 'f'],
    units: { c: { label: 'Celsius (°C)', factor: 1 }, f: { label: 'Fahrenheit (°F)', factor: 1 }, k: { label: 'Kelvin (K)', factor: 1 } },
  },
  area: {
    label: 'Area', defaults: ['m2', 'ft2'],
    units: {
      cm2: { label: 'Square centimeters (cm²)', factor: 0.0001 },
      m2: { label: 'Square meters (m²)', factor: 1 },
      km2: { label: 'Square kilometers (km²)', factor: 1e6 },
      ft2: { label: 'Square feet (ft²)', factor: 0.09290304 },
      ac: { label: 'Acres (ac)', factor: 4046.8564224 },
      ha: { label: 'Hectares (ha)', factor: 10000 },
    },
  },
  volume: {
    label: 'Volume', defaults: ['l', 'gal'],
    units: {
      ml: { label: 'Milliliters (mL)', factor: 0.001 },
      l: { label: 'Liters (L)', factor: 1 },
      m3: { label: 'Cubic meters (m³)', factor: 1000 },
      floz: { label: 'Fluid ounces US (fl oz)', factor: 0.0295735295625 },
      cup: { label: 'Cups US', factor: 0.2365882365 },
      pt: { label: 'Pints US (pt)', factor: 0.473176473 },
      qt: { label: 'Quarts US (qt)', factor: 0.946352946 },
      gal: { label: 'Gallons US (gal)', factor: 3.785411784 },
    },
  },
  speed: {
    label: 'Speed', defaults: ['kmh', 'mph'],
    units: {
      ms: { label: 'Meters/second (m/s)', factor: 1 },
      kmh: { label: 'Kilometers/hour (km/h)', factor: 1 / 3.6 },
      mph: { label: 'Miles/hour (mph)', factor: 0.44704 },
      kn: { label: 'Knots (kn)', factor: 0.514444444 },
    },
  },
  time: {
    label: 'Time', defaults: ['h', 'min'],
    units: {
      ms2: { label: 'Milliseconds (ms)', factor: 0.001 },
      s: { label: 'Seconds (s)', factor: 1 },
      min: { label: 'Minutes (min)', factor: 60 },
      h: { label: 'Hours (h)', factor: 3600 },
      d: { label: 'Days', factor: 86400 },
      wk: { label: 'Weeks', factor: 604800 },
      yr: { label: 'Years', factor: 31557600 },
    },
  },
  data: {
    label: 'Data size', defaults: ['mb', 'gb'],
    units: {
      b: { label: 'Bytes (B)', factor: 1 },
      kb: { label: 'Kilobytes (KB)', factor: 1e3 },
      mb: { label: 'Megabytes (MB)', factor: 1e6 },
      gb: { label: 'Gigabytes (GB)', factor: 1e9 },
      tb: { label: 'Terabytes (TB)', factor: 1e12 },
      kib: { label: 'Kibibytes (KiB)', factor: 1024 },
      mib: { label: 'Mebibytes (MiB)', factor: 1048576 },
      gib: { label: 'Gibibytes (GiB)', factor: 1073741824 },
    },
  },
};

function toC(v: number, u: string): number {
  return u === 'f' ? ((v - 32) * 5) / 9 : u === 'k' ? v - 273.15 : v;
}
function fromC(c: number, u: string): number {
  return u === 'f' ? (c * 9) / 5 + 32 : u === 'k' ? c + 273.15 : c;
}

function convert(cat: string, v: number, from: string, to: string): number {
  if (cat === 'temperature') return fromC(toC(v, from), to);
  const units = CATEGORIES[cat].units;
  return (v * units[from].factor) / units[to].factor;
}

// Show enough precision to be useful, without float noise (0.30000000000004).
function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '';
  const s = Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-9 && n !== 0) ? n.toExponential(6) : n.toPrecision(12);
  return String(Number(s));
}

const selectCls = 'h-10 w-full rounded-lg border bg-card px-2 text-sm font-medium outline-none focus:border-primary';
const inputCls = 'h-12 w-full rounded-lg border bg-background px-3 text-lg font-semibold tabular-nums outline-none focus:border-primary';

export function UnitConverterTool() {
  const [cat, setCat] = useState('length');
  const [from, setFrom] = useState(CATEGORIES.length.defaults[0]);
  const [to, setTo] = useState(CATEGORIES.length.defaults[1]);
  const [val, setVal] = useState('1');

  const num = parseFloat(val);
  const result = Number.isFinite(num) ? convert(cat, num, from, to) : NaN;

  function pickCat(c: string) {
    setCat(c);
    setFrom(CATEGORIES[c].defaults[0]);
    setTo(CATEGORIES[c].defaults[1]);
  }

  function swap() {
    setFrom(to);
    setTo(from);
    if (Number.isFinite(result)) setVal(fmtNum(result));
  }

  const units = CATEGORIES[cat].units;
  const one = convert(cat, 1, from, to);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORIES).map(([id, c]) => (
            <button key={id} onClick={() => pickCat(id)} aria-pressed={cat === id}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${cat === id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:border-primary/40'}`}>
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div>
            <label className="mb-1.5 block text-sm font-medium">From</label>
            <input className={inputCls} value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal" aria-label="Value to convert" />
            <select className={`${selectCls} mt-2`} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From unit">
              {Object.entries(units).map(([id, u]) => <option key={id} value={id}>{u.label}</option>)}
            </select>
          </div>
          <Button variant="outline" size="icon" className="mx-auto mb-12 sm:mb-0 sm:self-center" onClick={swap} aria-label="Swap units">
            <ArrowLeftRight className="size-4" />
          </Button>
          <div>
            <label className="mb-1.5 block text-sm font-medium">To</label>
            <div className={`${inputCls} flex items-center overflow-x-auto bg-primary/5 text-primary`} aria-live="polite">
              {Number.isFinite(result) ? fmtNum(result) : '—'}
            </div>
            <select className={`${selectCls} mt-2`} value={to} onChange={(e) => setTo(e.target.value)} aria-label="To unit">
              {Object.entries(units).map(([id, u]) => <option key={id} value={id}>{u.label}</option>)}
            </select>
          </div>
        </div>

        <p className="mt-4 rounded-lg border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
          1 {units[from].label.replace(/\s*\(.+\)/, '')} = {fmtNum(one)} {units[to].label.replace(/\s*\(.+\)/, '')}
        </p>

        <KeepGoing exclude="/unit-converter" />
      </CardContent>
    </Card>
  );
}
