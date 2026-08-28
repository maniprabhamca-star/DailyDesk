'use client';

import { useState } from 'react';
import { Globe, Loader2, Zap, Cloud, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';

const HREF = '/webpage-to-pdf';
const selectCls = 'rounded-md border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-primary';

// What the server is actually doing, in the order it does it. These are real
// stages reported by the renderer, not a timer pretending to be progress — the
// slow one is usually `browser`, because a cold Chrome start is most of the wait.
const STAGES: Record<string, string> = {
  checking: 'Checking the address is safe to open…',
  browser: 'Starting the browser…',
  opening: 'Opening the page…',
  settling: 'Waiting for images and fonts…',
  printing: 'Printing it to PDF…',
};

/**
 * Read a narrated capture: JSON lines, a `done` sentinel, then raw PDF bytes on
 * the same response. Returns the PDF, or null when the stream carried an error.
 *
 * The bytes after the sentinel are binary, so this scans the buffer for the
 * newline rather than decoding the whole thing as text.
 */
async function readNarratedPdf(res: Response, onStage: (s: string) => void): Promise<Blob | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let buf = new Uint8Array(0);
  let done = false;

  const append = (chunk: Uint8Array) => {
    const next = new Uint8Array(buf.length + chunk.length);
    next.set(buf); next.set(chunk, buf.length);
    buf = next;
  };

  for (;;) {
    const { value, done: finished } = await reader.read();
    if (value) append(value);

    // Consume whole lines while we are still in the narration.
    while (!done) {
      const nl = buf.indexOf(10); // '\n'
      if (nl === -1) break;
      const line = decoder.decode(buf.slice(0, nl)).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg: { stage?: string; message?: string };
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.stage === 'error') { onStage(`error:${msg.message || 'That page could not be captured.'}`); return null; }
      if (msg.stage === 'done') { done = true; break; }
      if (msg.stage) onStage(msg.stage);
    }

    if (finished) break;
  }
  // Everything left in the buffer after the sentinel is the file.
  return done ? new Blob([new Uint8Array(buf)], { type: 'application/pdf' }) : null;
}

export function WebpageToPdfTool() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('A4');
  const [landscape, setLandscape] = useState(false);
  const [background, setBackground] = useState(true);
  const [view, setView] = useState('desktop');
  const [singlePage, setSinglePage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStageRaw] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);

  // The stream carries failures as a line rather than a status code, because by
  // then the response has already gone out as 200.
  const setStage = (s: string) => {
    if (s.startsWith('error:')) { setError(s.slice(6)); setStageRaw(null); return; }
    setStageRaw(s);
  };

  async function run() {
    if (busy) return;
    const trimmed = url.trim();
    if (!trimmed) { setError('Please enter a web address.'); return; }
    // Save people the round trip for the commonest slip.
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    setBusy(true); setError(null); setStageRaw(null);
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
        // stream:true asks the server to narrate. It answers with one JSON line
        // per stage, a `done` line, then the PDF bytes on the same response.
        body: JSON.stringify({ url: withScheme, format, landscape, background, view, singlePage, stream: true }),
      });
      // A refusal (bad URL, over the daily cap) still comes back as JSON with a
      // real status — only a capture that actually started gets narrated.
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.message || 'That page could not be captured.');
        return;
      }

      const blob = res.headers.get('content-type')?.includes('x-ndjson')
        ? await readNarratedPdf(res, setStage)
        : await res.blob();
      if (!blob) return; // the stream carried an error; setStage already reported it
      let host = 'webpage';
      try { host = new URL(withScheme).hostname.replace(/^www\./, ''); } catch { /* keep the fallback */ }
      const name = `${host}.pdf`;
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
      download(blob, name);
    } catch {
      setError('Could not reach the capture service. Please try again.');
    } finally {
      setBusy(false); setStageRaw(null);
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

        {/* The two questions that decide what the PDF actually looks like, asked
            before the capture rather than discovered afterwards. */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">How it should look</span>
            <select className={`${selectCls} w-full`} value={view} onChange={(e) => setView(e.target.value)}>
              <option value="desktop">Desktop — as you see it</option>
              <option value="mobile">Mobile — the phone layout</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Pages</span>
            <select className={`${selectCls} w-full`} value={singlePage ? 'one' : 'split'} onChange={(e) => setSinglePage(e.target.value === 'one')}>
              <option value="split">Split into sheets</option>
              <option value="one">One long page, no breaks</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {singlePage
            ? 'One continuous page as tall as the site — nothing is cut across a page break. Best for reading on screen.'
            : 'The page is fitted to the sheet at full desktop width, then split where it needs to be. Best for printing.'}
        </p>

        <div className={`mt-3 grid gap-3 ${singlePage ? 'sm:grid-cols-1' : 'sm:grid-cols-3'}`}>
          <label className={`flex items-center justify-between gap-2 text-sm ${singlePage ? 'hidden' : ''}`}>
            <span className="text-muted-foreground">Paper</span>
            <select className={selectCls} value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
              <option value="Legal">Legal</option>
              <option value="A3">A3</option>
            </select>
          </label>
          {/* Orientation only means something when there are sheets to orient. */}
          <label className={`flex items-center gap-2 text-sm ${singlePage ? 'hidden' : ''}`}>
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

      {/* The button carries the current stage on its own — a separate checklist
          repeated the same five lines a second time, which is noise, not
          reassurance. One place, the place you are already looking. */}
      <Button className="w-full" size="lg" onClick={() => void run()} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
        {busy ? (stage && STAGES[stage]) || 'Starting…' : 'Capture the page as a PDF'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">3 captures a day free · unlimited on Pro</p>
    </div>
  );
}
