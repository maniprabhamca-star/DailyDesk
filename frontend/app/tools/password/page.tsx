'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Check, RefreshCw, ShieldCheck } from 'lucide-react';
import { ToolHeader } from '@/components/app/tool-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  number: '0123456789',
  symbol: '!@#$%^&*()-_=+[]{};:,.<>?/',
};
const SIMILAR = /[il1Lo0O]/g;

// Unbiased random index using the crypto-secure RNG.
function randInt(max: number) {
  const arr = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / max) * max;
  let x: number;
  do {
    crypto.getRandomValues(arr);
    x = arr[0];
  } while (x >= limit);
  return x % max;
}

function shuffle(chars: string[]) {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars;
}

type Opts = {
  length: number;
  lower: boolean;
  upper: boolean;
  number: boolean;
  symbol: boolean;
  excludeSimilar: boolean;
};

function buildPools(opts: Opts) {
  const clean = (s: string) => (opts.excludeSimilar ? s.replace(SIMILAR, '') : s);
  const active: string[] = [];
  if (opts.lower) active.push(clean(SETS.lower));
  if (opts.upper) active.push(clean(SETS.upper));
  if (opts.number) active.push(clean(SETS.number));
  if (opts.symbol) active.push(clean(SETS.symbol));
  return active;
}

function generate(opts: Opts): string {
  const pools = buildPools(opts);
  if (pools.length === 0) return '';
  const all = pools.join('');
  const out: string[] = [];
  // Guarantee at least one char from each selected set.
  for (const p of pools) out.push(p[randInt(p.length)]);
  for (let i = out.length; i < opts.length; i++) out.push(all[randInt(all.length)]);
  return shuffle(out).slice(0, opts.length).join('');
}

function strength(opts: Opts) {
  const pools = buildPools(opts);
  const poolSize = pools.join('').length;
  const bits = poolSize > 0 ? Math.round(opts.length * Math.log2(poolSize)) : 0;
  let label = 'Very weak', pct = 10, color = 'bg-red-500', text = 'text-red-500';
  if (bits >= 128) { label = 'Very strong'; pct = 100; color = 'bg-emerald-500'; text = 'text-emerald-500'; }
  else if (bits >= 80) { label = 'Strong'; pct = 80; color = 'bg-emerald-500'; text = 'text-emerald-500'; }
  else if (bits >= 60) { label = 'Good'; pct = 60; color = 'bg-lime-500'; text = 'text-lime-600'; }
  else if (bits >= 40) { label = 'Fair'; pct = 40; color = 'bg-amber-500'; text = 'text-amber-500'; }
  else if (bits >= 28) { label = 'Weak'; pct = 25; color = 'bg-orange-500'; text = 'text-orange-500'; }
  return { bits, label, pct, color, text };
}

export default function PasswordGenerator() {
  const [opts, setOpts] = useState<Opts>({
    length: 16,
    lower: true,
    upper: true,
    number: true,
    symbol: true,
    excludeSimilar: false,
  });
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const noSetSelected = !opts.lower && !opts.upper && !opts.number && !opts.symbol;

  const regenerate = useCallback(() => {
    setPassword(generate(opts));
    setCopied(false);
  }, [opts]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  async function copy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  function set<K extends keyof Opts>(key: K, value: Opts[K]) {
    setOpts((o) => ({ ...o, [key]: value }));
  }

  const s = strength(opts);

  const toggles: { key: keyof Opts; label: string }[] = [
    { key: 'upper', label: 'Uppercase (A–Z)' },
    { key: 'lower', label: 'Lowercase (a–z)' },
    { key: 'number', label: 'Numbers (0–9)' },
    { key: 'symbol', label: 'Symbols (!@#$)' },
    { key: 'excludeSimilar', label: 'Exclude similar (i, l, 1, O, 0)' },
  ];

  return (
    <>
      <ToolHeader title="Password generator" subtitle="Strong, random passwords — generated in your browser" />

      <div className="mx-auto max-w-3xl animate-fade-in space-y-5 p-4 sm:p-6">
        {/* Output */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
              <code className="flex-1 select-all break-all font-mono text-lg sm:text-xl">
                {password || (noSetSelected ? 'Select at least one option' : '…')}
              </code>
              <Button variant="ghost" size="icon" aria-label="Copy password" onClick={copy} disabled={!password}>
                {copied ? <Check className="text-emerald-500" /> : <Copy />}
              </Button>
              <Button variant="ghost" size="icon" aria-label="Regenerate" onClick={regenerate} disabled={noSetSelected}>
                <RefreshCw />
              </Button>
            </div>

            {/* Strength meter */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Strength</span>
                <span className={cn('font-medium', s.text)}>
                  {s.label} · {s.bits} bits
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className={cn('h-full rounded-full transition-all duration-300', s.color)} style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardContent className="space-y-6 p-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Length</Label>
                <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-sm font-medium">{opts.length}</span>
              </div>
              <input
                type="range"
                min={4}
                max={64}
                value={opts.length}
                onChange={(e) => set('length', Number(e.target.value))}
                className="dd-range"
              />
            </div>

            <div className="space-y-1">
              {toggles.map((t) => (
                <label
                  key={t.key}
                  htmlFor={t.key}
                  className="flex cursor-pointer items-center justify-between rounded-lg px-1 py-2.5 hover:bg-accent/50"
                >
                  <span className="text-sm font-medium">{t.label}</span>
                  <Switch id={t.key} checked={opts[t.key] as boolean} onCheckedChange={(v) => set(t.key, v)} />
                </label>
              ))}
            </div>

            {noSetSelected && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Select at least one character type.
              </p>
            )}

            <Button className="w-full" size="lg" onClick={regenerate} disabled={noSetSelected}>
              <RefreshCw /> Generate new password
            </Button>
          </CardContent>
        </Card>

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Generated with your device&apos;s secure random generator — nothing is sent or stored.
        </p>
      </div>
    </>
  );
}
