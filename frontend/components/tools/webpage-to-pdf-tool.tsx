'use client';

import { useState } from 'react';
import { Globe, Loader2, Zap, Cloud, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';

const HREF = '/webpage-to-pdf';
const selectCls = 'rounded-md border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-primary';

export function WebpageToPdfTool() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('A4');
  const [landscape, setLandscape] = useState(false);
  const [background, setBackground] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);

  async function run() {
    if (busy) return;
    const trimmed = url.trim();
    if (!trimmed) { setError('Please enter a web address.'); return; }
    // Save people the round trip for the commonest slip.
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    setBusy(true); setError(null);
    const t0 = performance.now();
    try {
      // Same rule as every other server tool: send the session token, or a Pro
      // subscriber is metered as an anonymous visitor and capped at three a day.
      const token = typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null;
      const res = await fetch('/api/convert/webpage-to-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: withScheme, format, landscape, background }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.message || 'That page could not be captured.');
        return;
      }
      const blob = await res.blob();
      let host = 'webpage';
      try { host = new URL(withScheme).hostname.replace(/^www\./, ''); } catch { /* keep the fallback */ }
      const name = `${host}.pdf`;
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
      download(blob, name);
    } catch {
      setError('Could not reach the capture service. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref={HREF} fromLabel="Webpage to PDF" onStartOver={() => { setDone(null); setUrl(''); }} />;
  }

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
        <Cloud className="mt-0.5 size-4 shrink-0" />
        <span>
          Unlike our in-browser tools, this one needs our server — a page has to be visited by a real browser to be captured.
          We open the address you give us, print it, and keep nothing.{' '}
          <Link href="/security#where-data-goes" target="_blank" rel="noopener noreferrer" className="underline">How we handle data</Link>
        </span>
      </p>

      <div className="rounded-xl border bg-card p-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Web address</span>
          <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 focus-within:border-primary">
            <Globe className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void run(); }}
              placeholder="example.com/article"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Web address to capture"
              className="w-full bg-transparent py-2 text-sm outline-none"
            />
          </div>
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Paper</span>
            <select className={selectCls} value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
              <option value="Legal">Legal</option>
              <option value="A3">A3</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={landscape} onChange={(e) => setLandscape(e.target.checked)} className="size-4" />
            <span className="text-muted-foreground">Landscape</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={background} onChange={(e) => setBackground(e.target.checked)} className="size-4" />
            <span className="text-muted-foreground">Keep backgrounds</span>
          </label>
        </div>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          {error}
        </p>
      )}

      <Button className="w-full" size="lg" onClick={() => void run()} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
        {busy ? 'Opening the page…' : 'Capture the page as a PDF'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">3 captures a day free · unlimited on Pro</p>
    </div>
  );
}
