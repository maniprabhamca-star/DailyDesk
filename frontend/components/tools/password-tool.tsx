'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Check, RefreshCw, ShieldCheck, Timer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { KeepGoing } from '@/components/app/keep-going';
import { cn } from '@/lib/utils';

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  number: '0123456789',
  symbol: '!@#$%^&*()-_=+[]{};:,.<>?/',
};
const SIMILAR = /[il1Lo0O]/g;
const WORDLIST_SIZE = 7776; // EFF large wordlist

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

type PpOpts = {
  words: number;
  separator: string;
  capitalize: boolean;
  includeNumber: boolean;
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

function generatePassphrase(pp: PpOpts, words: string[]): string {
  const picked: string[] = [];
  for (let i = 0; i < pp.words; i++) {
    let w = words[randInt(words.length)];
    if (pp.capitalize) w = w.charAt(0).toUpperCase() + w.slice(1);
    picked.push(w);
  }
  if (pp.includeNumber) {
    const at = randInt(picked.length);
    picked[at] = picked[at] + randInt(10);
  }
  return picked.join(pp.separator);
}

function labelFor(bits: number) {
  let label = 'Very weak', pct = 10, color = 'bg-red-500', text = 'text-red-500';
  if (bits >= 128) { label = 'Very strong'; pct = 100; color = 'bg-emerald-500'; text = 'text-emerald-500'; }
  else if (bits >= 80) { label = 'Strong'; pct = 80; color = 'bg-emerald-500'; text = 'text-emerald-500'; }
  else if (bits >= 60) { label = 'Good'; pct = 60; color = 'bg-lime-500'; text = 'text-lime-600'; }
  else if (bits >= 40) { label = 'Fair'; pct = 40; color = 'bg-amber-500'; text = 'text-amber-500'; }
  else if (bits >= 28) { label = 'Weak'; pct = 25; color = 'bg-orange-500'; text = 'text-orange-500'; }
  return { bits, label, pct, color, text };
}

function strength(opts: Opts) {
  const pools = buildPools(opts);
  const poolSize = pools.join('').length;
  const bits = poolSize > 0 ? Math.round(opts.length * Math.log2(poolSize)) : 0;
  return labelFor(bits);
}

function ppStrength(pp: PpOpts) {
  let bits = pp.words * Math.log2(WORDLIST_SIZE);
  if (pp.includeNumber) bits += Math.log2(pp.words * 10);
  return labelFor(Math.round(bits));
}

// Average time to exhaust half the keyspace at 10 billion guesses/second —
// a fast offline attack against a weak (unsalted, fast) hash. Real online
// attacks are millions of times slower, so this is the conservative bound.
function crackTime(bits: number): string {
  const secs = Math.pow(2, bits - 1) / 1e10;
  if (secs < 1) return 'instantly';
  if (secs < 60) return `${Math.round(secs)} seconds`;
  const mins = secs / 60;
  if (mins < 60) return `${Math.round(mins)} minutes`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.round(hrs)} hours`;
  const days = hrs / 24;
  if (days < 365) return `${Math.round(days)} days`;
  const years = days / 365;
  if (years < 1000) return `${Math.round(years).toLocaleString()} years`;
  if (years < 1e6) return `${Math.round(years / 1e3).toLocaleString()} thousand years`;
  if (years < 1e9) return `${Math.round(years / 1e6).toLocaleString()} million years`;
  if (years < 13.8e9) return `${Math.round(years / 1e9).toLocaleString()} billion years`;
  return 'longer than the age of the universe';
}

export function PasswordTool() {
  const [mode, setMode] = useState<'password' | 'passphrase'>('password');
  const [opts, setOpts] = useState<Opts>({
    length: 16,
    lower: true,
    upper: true,
    number: true,
    symbol: true,
    excludeSimilar: false,
  });
  const [pp, setPp] = useState<PpOpts>({ words: 5, separator: '-', capitalize: false, includeNumber: false });
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const wordsRef = useRef<string[] | null>(null);

  const noSetSelected = mode === 'password' && !opts.lower && !opts.upper && !opts.number && !opts.symbol;

  const regenerate = useCallback(async () => {
    setCopied(false);
    if (mode === 'password') {
      setPassword(generate(opts));
      return;
    }
    if (!wordsRef.current) {
      // Lazy-load the 7,776-word EFF list only when passphrase mode is used.
      wordsRef.current = (await import('@/lib/eff-wordlist')).WORDS;
    }
    setPassword(generatePassphrase(pp, wordsRef.current));
  }, [mode, opts, pp]);

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
  function setP<K extends keyof PpOpts>(key: K, value: PpOpts[K]) {
    setPp((o) => ({ ...o, [key]: value }));
  }

  const s = mode === 'password' ? strength(opts) : ppStrength(pp);

  const toggles: { key: keyof Opts; label: string }[] = [
    { key: 'upper', label: 'Uppercase (A–Z)' },
    { key: 'lower', label: 'Lowercase (a–z)' },
    { key: 'number', label: 'Numbers (0–9)' },
    { key: 'symbol', label: 'Symbols (!@#$)' },
    { key: 'excludeSimilar', label: 'Exclude similar (i, l, 1, O, 0)' },
  ];

  return (
    <div className="animate-fade-in space-y-5">
      {/* Mode switch */}
      <div className="inline-flex rounded-lg border bg-card p-1 shadow-soft">
        {([
          { k: 'password', label: 'Password' },
          { k: 'passphrase', label: 'Passphrase' },
        ] as const).map((m) => (
          <button
            key={m.k}
            onClick={() => setMode(m.k)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              mode === m.k ? 'bg-primary text-primary-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Output */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
            <code className={cn('flex-1 select-all break-all font-mono', mode === 'passphrase' ? 'text-base sm:text-lg' : 'text-lg sm:text-xl')}>
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
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Timer className="size-3.5" />
              Time to crack at 10 billion guesses/second: <span className="font-medium text-foreground">{crackTime(s.bits)}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardContent className="space-y-6 p-5">
          {mode === 'password' ? (
            <>
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
            </>
          ) : (
            <>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>Words</Label>
                  <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-sm font-medium">{pp.words}</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={pp.words}
                  onChange={(e) => setP('words', Number(e.target.value))}
                  className="dd-range"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">Each word adds ~13 bits of strength — 5+ words is a strong master password.</p>
              </div>

              <div className="space-y-2">
                <Label>Separator</Label>
                <Select value={pp.separator} onChange={(e) => setP('separator', e.target.value)}>
                  <option value="-">Dash (correct-horse-battery)</option>
                  <option value=".">Period (correct.horse.battery)</option>
                  <option value="_">Underscore (correct_horse_battery)</option>
                  <option value=" ">Space (correct horse battery)</option>
                </Select>
              </div>

              <div className="space-y-1">
                <label htmlFor="pp-cap" className="flex cursor-pointer items-center justify-between rounded-lg px-1 py-2.5 hover:bg-accent/50">
                  <span className="text-sm font-medium">Capitalize words</span>
                  <Switch id="pp-cap" checked={pp.capitalize} onCheckedChange={(v) => setP('capitalize', v)} />
                </label>
                <label htmlFor="pp-num" className="flex cursor-pointer items-center justify-between rounded-lg px-1 py-2.5 hover:bg-accent/50">
                  <span className="text-sm font-medium">Include a number</span>
                  <Switch id="pp-num" checked={pp.includeNumber} onCheckedChange={(v) => setP('includeNumber', v)} />
                </label>
              </div>
            </>
          )}

          <Button className="w-full" size="lg" onClick={regenerate} disabled={noSetSelected}>
            <RefreshCw /> Generate new {mode}
          </Button>
        </CardContent>
      </Card>

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" /> Generated with your device&apos;s secure random generator — nothing is sent or stored.
      </p>

      <KeepGoing exclude="/password-generator" />
    </div>
  );
}
