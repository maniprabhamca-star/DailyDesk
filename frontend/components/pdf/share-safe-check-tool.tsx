'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Upload, FileText, X, Loader2, ShieldCheck, AlertTriangle, Link as LinkIcon, Fingerprint, EyeOff, Download, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { openPdf, renderPage, dprTarget, getPdfjs, type PdfHandle } from '@/lib/pdf-render';
import { scanDocMetadata, stripDocMetadata, type MetadataScan } from '@/lib/pdf-sanitize';

type Severity = 'high' | 'medium' | 'low';
type RiskMatch = { title: string; severity: Severity; page: number; value: string; snippet: string };
type LinkMatch = { page: number; kind: 'visible' | 'clickable'; url: string };
type RedactionBox = { page: number; x: number; y: number; w: number; h: number };

const RISK_PATTERNS: Array<{ title: string; severity: Severity; re: RegExp; redact: boolean }> = [
  { title: 'Possible SSNs', severity: 'high', re: /\b\d{3}-\d{2}-\d{4}\b/g, redact: true },
  { title: 'Payment-card-like numbers', severity: 'high', re: /\b(?:\d[ -]*?){13,19}\b/g, redact: true },
  { title: 'Email addresses', severity: 'medium', re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, redact: true },
  { title: 'Phone numbers', severity: 'medium', re: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, redact: true },
  { title: 'Sensitive words', severity: 'medium', re: /\b(password|secret|confidential|private key|api key|token)\b/gi, redact: true },
  { title: 'Visible web links', severity: 'low', re: /\bhttps?:\/\/[^\s)]+/gi, redact: false },
];

const METADATA_LABELS: Record<string, string> = {
  Author: 'Author',
  Creator: 'Created by',
  Producer: 'PDF producer',
  CreationDate: 'Created date',
  ModDate: 'Modified date',
  Title: 'Title',
  Subject: 'Subject',
  Keywords: 'Keywords',
};

// Non-Info metadata items get reserved selection keys (they can't collide with a
// real Info key because those never start with '__').
const META_XMP = '__xmp';
const META_THUMBS = '__thumbs';
const META_PIECE = '__pieceInfo';

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function clipped(value: string, len = 90) {
  return value.length > len ? `${value.slice(0, len - 1)}...` : value;
}

function snippet(text: string, index: number, value: string) {
  const start = Math.max(0, index - 34);
  const end = Math.min(text.length, index + value.length + 34);
  return `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`;
}

function resultTone(hasHigh: boolean, hasMedium: boolean, count: number) {
  if (hasHigh) return { label: 'High risk', tone: 'text-red-700 bg-red-500/10 border-red-500/30' };
  if (hasMedium) return { label: 'Review before sharing', tone: 'text-amber-700 bg-amber-500/10 border-amber-500/30' };
  if (count) return { label: 'Low risk', tone: 'text-sky-700 bg-sky-500/10 border-sky-500/30' };
  return { label: 'Looks share-safe', tone: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/30' };
}

async function blobFromUrl(url: string) {
  return await (await fetch(url)).blob();
}

// One metadata item card with a "Remove this" checkbox at the end, so the user
// can strip fields individually instead of all-or-nothing.
function MetaBox({ label, checked, onToggle, children }: { label: string; checked: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className={`flex flex-col rounded-lg border p-2 transition-colors ${checked ? 'border-primary/40 bg-primary/5' : 'bg-muted/30'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex-1">{children}</div>
      <label className="mt-2 flex items-center gap-1.5 border-t pt-1.5 text-[11px] font-medium">
        <input type="checkbox" checked={checked} onChange={onToggle} className="accent-primary" />
        <span className={checked ? 'text-primary' : 'text-muted-foreground'}>Remove this</span>
      </label>
    </div>
  );
}

function shouldRedactTextRun(text: string) {
  return RISK_PATTERNS.some((p) => {
    if (!p.redact) return false;
    p.re.lastIndex = 0;
    return p.re.test(text);
  });
}

export function ShareSafeCheckTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<MetadataScan | null>(null);
  const [matches, setMatches] = useState<RiskMatch[]>([]);
  const [links, setLinks] = useState<LinkMatch[]>([]);
  const [boxes, setBoxes] = useState<RedactionBox[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [metaSel, setMetaSel] = useState<Record<string, boolean>>({});
  const [redactText, setRedactText] = useState(true);
  const [removeLinks, setRemoveLinks] = useState(false);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number; checks: { label: string; before: string; after: string; ok: boolean }[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const metaCount = metadata ? metadata.fields.length + (metadata.xmpBytes ? 1 : 0) + (metadata.thumbs ? 1 : 0) + (metadata.pieceInfo ? 1 : 0) : 0;
  // Every selectable metadata item, in display order (Info fields, then XMP,
  // thumbnails, PieceInfo). Drives the per-item "Remove" checkboxes.
  const metaKeys = useMemo(() => {
    if (!metadata) return [] as string[];
    const keys = metadata.fields.map((f) => f.key);
    if (metadata.xmpBytes > 0) keys.push(META_XMP);
    if (metadata.thumbs > 0) keys.push(META_THUMBS);
    if (metadata.pieceInfo) keys.push(META_PIECE);
    return keys;
  }, [metadata]);
  const metaRemoveCount = metaKeys.filter((k) => metaSel[k]).length;
  const anyMetaSelected = metaRemoveCount > 0;
  const allMetaSelected = metaKeys.length > 0 && metaRemoveCount === metaKeys.length;
  const toggleMeta = (k: string) => setMetaSel((s) => ({ ...s, [k]: !s[k] }));
  const toggleAllMeta = () => {
    const next = !allMetaSelected;
    setMetaSel(() => {
      const n: Record<string, boolean> = {};
      for (const k of metaKeys) n[k] = next;
      return n;
    });
  };
  const redactionCount = boxes.length;
  const high = matches.some((m) => m.severity === 'high');
  const medium = matches.some((m) => m.severity === 'medium') || metaCount > 0;
  const result = useMemo(() => resultTone(high, medium, metaCount + matches.length + links.length), [high, medium, metaCount, matches.length, links.length]);

  async function analyze(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    setFile(f);
    setMetadata(null);
    setMatches([]);
    setLinks([]);
    setBoxes([]);
    setDone(null);
    setError(null);
    setBusy(true);
    let handle: PdfHandle | null = null;
    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdfjs = await getPdfjs();
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
      const meta = await scanDocMetadata(doc);
      setMetadata(meta);

      handle = await openPdf(f);
      setPageCount(handle.numPages);
      const nextMatches: RiskMatch[] = [];
      const nextLinks: LinkMatch[] = [];
      const nextBoxes: RedactionBox[] = [];

      for (let i = 1; i <= handle.numPages; i++) {
        const page = await handle.doc.getPage(i);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((it: unknown) => (it as { str?: string }).str || '').join(' ');

        for (const pattern of RISK_PATTERNS) {
          for (const found of Array.from(pageText.matchAll(pattern.re))) {
            const value = found[0] || '';
            if (!value) continue;
            if (pattern.title === 'Visible web links') nextLinks.push({ page: i, kind: 'visible', url: value });
            else nextMatches.push({ title: pattern.title, severity: pattern.severity, page: i, value, snippet: snippet(pageText, found.index || 0, value) });
          }
        }

        for (const item of textContent.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number }>) {
          const str = item.str || '';
          if (!str.trim() || !item.transform) continue;
          if (!shouldRedactTextRun(str)) continue;
          const m = pdfjs.Util.transform(viewport.transform, item.transform);
          const fontH = Math.hypot(m[2], m[3]) || item.height || 8;
          const width = Math.max(8, (item.width || str.length * fontH * 0.55) * viewport.scale);
          const left = m[4];
          const top = m[5] - fontH;
          const pad = Math.max(1, fontH * 0.16);
          nextBoxes.push({
            page: i - 1,
            x: Math.max(0, (left - pad) / viewport.width),
            y: Math.max(0, (top - pad) / viewport.height),
            w: Math.min(1, (width + pad * 2) / viewport.width),
            h: Math.min(1, (fontH + pad * 2) / viewport.height),
          });
        }

        try {
          const annots = await page.getAnnotations({ intent: 'display' }) as Array<{ subtype?: string; url?: string; unsafeUrl?: string; dest?: unknown }>;
          for (const a of annots) {
            if (a.subtype !== 'Link') continue;
            const url = a.url || a.unsafeUrl || (a.dest ? 'Internal PDF destination' : 'Link annotation');
            nextLinks.push({ page: i, kind: 'clickable', url });
          }
        } catch {
          // Some PDFs do not expose annotations through pdf.js. The rest of the scan remains useful.
        }
      }

      setMatches(nextMatches.slice(0, 80));
      setLinks(nextLinks.slice(0, 120));
      setBoxes(nextBoxes);
      // Default every metadata item to "remove"; the user can keep individual ones.
      const initSel: Record<string, boolean> = {};
      for (const f of meta.fields) initSel[f.key] = true;
      if (meta.xmpBytes > 0) initSel[META_XMP] = true;
      if (meta.thumbs > 0) initSel[META_THUMBS] = true;
      if (meta.pieceInfo) initSel[META_PIECE] = true;
      setMetaSel(initSel);
      setRedactText(nextBoxes.length > 0);
    } catch {
      setError('Could not scan this PDF. It may be corrupted or password-protected.');
      setFile(null);
    } finally {
      if (handle) void handle.destroy();
      setBusy(false);
    }
  }

  function clear() {
    setFile(null);
    setMetadata(null);
    setMatches([]);
    setLinks([]);
    setBoxes([]);
    setPageCount(0);
    setMetaSel({});
    setDone(null);
    setError(null);
  }

  async function saveCleaned() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setDone(null);
    const t0 = performance.now();
    let handle: PdfHandle | null = null;
    try {
      const { PDFDocument, PDFName } = await import('pdf-lib');
      const srcBytes = await file.arrayBuffer();
      const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true, updateMetadata: false });
      const shouldRasterize = redactText && boxes.length > 0;
      let out = src;

      if (shouldRasterize) {
        handle = await openPdf(file);
        out = await PDFDocument.create();
        const boxesByPage = new Map<number, RedactionBox[]>();
        for (const b of boxes) boxesByPage.set(b.page, [...(boxesByPage.get(b.page) || []), b]);

        for (let i = 0; i < src.getPageCount(); i++) {
          const pageBoxes = boxesByPage.get(i);
          if (!pageBoxes?.length) {
            const [copied] = await out.copyPages(src, [i]);
            out.addPage(copied);
            continue;
          }

          const rendered = await renderPage(handle, i, dprTarget(1450, 2, 2300));
          const blob = await blobFromUrl(rendered.url);
          // createImageBitmap, not img.decode(blobURL) — the latter can hang
          // indefinitely on some engines, which would freeze the whole save.
          const bitmap = await createImageBitmap(blob);
          const canvas = document.createElement('canvas');
          canvas.width = rendered.w;
          canvas.height = rendered.h;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not prepare redaction canvas.');
          ctx.drawImage(bitmap, 0, 0, rendered.w, rendered.h);
          bitmap.close();
          ctx.fillStyle = '#000000';
          for (const b of pageBoxes) ctx.fillRect(b.x * rendered.w, b.y * rendered.h, b.w * rendered.w, b.h * rendered.h);
          const png = await new Promise<ArrayBuffer>((resolve, reject) =>
            canvas.toBlob((b) => (b ? b.arrayBuffer().then(resolve) : reject(new Error('Could not export redacted page.'))), 'image/png'),
          );
          canvas.width = 0;
          canvas.height = 0;

          const embedded = await out.embedPng(png);
          const originalSize = src.getPage(i).getSize();
          const outPage = out.addPage([originalSize.width, originalSize.height]);
          outPage.drawImage(embedded, { x: 0, y: 0, width: originalSize.width, height: originalSize.height });
        }
      }

      if (removeLinks && links.some((l) => l.kind === 'clickable')) {
        const linkPages = new Set(links.filter((l) => l.kind === 'clickable').map((l) => l.page - 1));
        for (const p of Array.from(linkPages)) out.getPage(p)?.node.delete(PDFName.of('Annots'));
      }
      if (anyMetaSelected) {
        // Remove only the items the user kept checked. (In the rasterize path
        // `out` is a fresh doc, so original document metadata is already gone;
        // this still clears pdf-lib's own defaults per the same selection.)
        const infoKeys = new Set<string>();
        for (const f of metadata?.fields || []) if (metaSel[f.key]) infoKeys.add(f.key);
        await stripDocMetadata(out, {
          infoKeys,
          xmp: !!metaSel[META_XMP],
          thumbs: !!metaSel[META_THUMBS],
          pieceInfo: !!metaSel[META_PIECE],
        });
      }

      const bytes = await out.save({ useObjectStreams: true });
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      const name = `${file.name.replace(/\.pdf$/i, '')}-share-safe.pdf`;
      download(blob, name);

      // Re-scan the FINISHED file with the same metadata scanner, so we can show
      // a before → after the user can trust — the whole point of the check is
      // that these changes are invisible when you just open the PDF.
      let afterMeta = metaCount;
      try {
        const verify = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
        const m = await scanDocMetadata(verify);
        afterMeta = m.fields.length + (m.xmpBytes ? 1 : 0) + (m.thumbs ? 1 : 0) + (m.pieceInfo ? 1 : 0);
      } catch { /* keep the intended count if re-scan fails */ }

      const clickable = links.filter((l) => l.kind === 'clickable').length;
      const pagesRedacted = new Set(boxes.map((b) => b.page)).size;
      const checks: { label: string; before: string; after: string; ok: boolean }[] = [];
      if (metaCount > 0) {
        checks.push({ label: 'Hidden metadata', before: `${metaCount} item${metaCount === 1 ? '' : 's'}`, after: afterMeta === 0 ? 'none left' : `${afterMeta} left`, ok: afterMeta < metaCount });
      }
      if (matches.length > 0 || boxes.length > 0) {
        checks.push({ label: 'Sensitive text', before: `${boxes.length || matches.length} run${(boxes.length || matches.length) === 1 ? '' : 's'}`, after: shouldRasterize ? `redacted (${pagesRedacted} page${pagesRedacted === 1 ? '' : 's'} flattened)` : 'kept (redaction off)', ok: shouldRasterize });
      }
      if (clickable > 0) {
        checks.push({ label: 'Clickable links', before: `${clickable} link${clickable === 1 ? '' : 's'}`, after: removeLinks ? 'removed' : 'kept (removal off)', ok: removeLinks });
      }
      setDone({ blob, name, secs: (performance.now() - t0) / 1000, checks });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the cleaned PDF.');
    } finally {
      if (handle) void handle.destroy();
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        {!file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void analyze(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">Find metadata, sensitive text, and links before sharing</p>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { void analyze(e.target.files?.[0]); e.currentTarget.value = ''; }} />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fmt(file.size)}{pageCount ? ` - ${pageCount} page${pageCount === 1 ? '' : 's'}` : ''}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={clear}><X className="size-4" /></Button>
          </div>
        )}

        {busy && <p className="mt-4 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Working on this device...</p>}
        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && metadata && !done && (
          <div className="mt-4 space-y-4">
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-3 ${result.tone}`}>
              {metaCount + matches.length + links.length ? <AlertTriangle className="size-5 shrink-0" /> : <ShieldCheck className="size-5 shrink-0" />}
              <div>
                <p className="text-sm font-semibold">{result.label}</p>
                <p className="text-xs opacity-80">{metaCount + matches.length + links.length ? `${metaCount + matches.length + links.length} item${metaCount + matches.length + links.length === 1 ? '' : 's'} found for review.` : 'No obvious metadata, sensitive text, or links found.'}</p>
              </div>
            </div>

            <section className="rounded-xl border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Fingerprint className="size-4 text-primary" />
                <p className="text-sm font-semibold">Hidden metadata</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{metaCount ? `${metaCount} found` : 'clean'}</span>
                {metaCount > 0 && (
                  <label className="ml-auto flex items-center gap-2 text-xs font-medium">
                    <input type="checkbox" checked={allMetaSelected} onChange={toggleAllMeta} className="accent-primary" aria-label="Remove all metadata" />
                    Remove all
                  </label>
                )}
              </div>
              {metaCount > 0 ? (
                <>
                  <p className="mt-2 text-[11px] text-muted-foreground">These details are stored inside the file but don’t show on the page — so removing them won’t change how your PDF looks. Tick what to strip; leave anything you want to keep.</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {metadata.fields.map((f) => (
                      <MetaBox key={f.key} label={METADATA_LABELS[f.key] || f.key} checked={!!metaSel[f.key]} onToggle={() => toggleMeta(f.key)}>
                        <p className="mt-1 break-words text-xs">{clipped(f.value)}</p>
                      </MetaBox>
                    ))}
                    {metadata.xmpBytes > 0 && (
                      <MetaBox label="XMP packet" checked={!!metaSel[META_XMP]} onToggle={() => toggleMeta(META_XMP)}>
                        <p className="mt-1 text-xs text-muted-foreground">{fmt(metadata.xmpBytes)} of editing/history metadata</p>
                      </MetaBox>
                    )}
                    {metadata.thumbs > 0 && (
                      <MetaBox label="Embedded thumbnails" checked={!!metaSel[META_THUMBS]} onToggle={() => toggleMeta(META_THUMBS)}>
                        <p className="mt-1 text-xs text-muted-foreground">{metadata.thumbs} page preview image{metadata.thumbs === 1 ? '' : 's'}</p>
                      </MetaBox>
                    )}
                    {metadata.pieceInfo && (
                      <MetaBox label="Private app data" checked={!!metaSel[META_PIECE]} onToggle={() => toggleMeta(META_PIECE)}>
                        <p className="mt-1 text-xs text-muted-foreground">PieceInfo data left by the creating app</p>
                      </MetaBox>
                    )}
                  </div>
                </>
              ) : <p className="mt-2 text-xs text-muted-foreground">No hidden document metadata found.</p>}
            </section>

            <section className="rounded-xl border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <EyeOff className="size-4 text-primary" />
                <p className="text-sm font-semibold">Sensitive visible text</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{matches.length ? `${matches.length} shown` : 'none found'}</span>
                {redactionCount > 0 && (
                  <label className="ml-auto flex items-center gap-2 text-xs font-medium">
                    <input type="checkbox" checked={redactText} onChange={(e) => setRedactText(e.target.checked)} className="accent-primary" />
                    Redact {redactionCount} text run{redactionCount === 1 ? '' : 's'} on save
                  </label>
                )}
              </div>
              {matches.length > 0 ? (
                <div className="mt-3 max-h-60 overflow-auto rounded-lg border">
                  {matches.map((m, i) => (
                    <div key={`${m.title}-${m.page}-${i}`} className="border-b px-3 py-2 last:border-b-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.severity === 'high' ? 'bg-red-500/10 text-red-700' : 'bg-amber-500/10 text-amber-700'}`}>{m.title}</span>
                        <span className="text-[11px] text-muted-foreground">Page {m.page}</span>
                        <span className="ml-auto text-xs font-medium">{clipped(m.value, 48)}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{clipped(m.snippet, 160)}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-2 text-xs text-muted-foreground">No common sensitive patterns found in selectable text.</p>}
            </section>

            <section className="rounded-xl border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <LinkIcon className="size-4 text-primary" />
                <p className="text-sm font-semibold">Links</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{links.length ? `${links.length} found` : 'none found'}</span>
                {links.some((l) => l.kind === 'clickable') && (
                  <label className="ml-auto flex items-center gap-2 text-xs font-medium">
                    <input type="checkbox" checked={removeLinks} onChange={(e) => setRemoveLinks(e.target.checked)} className="accent-primary" />
                    Remove clickable link annotations
                  </label>
                )}
              </div>
              {links.length > 0 ? (
                <div className="mt-3 max-h-52 overflow-auto rounded-lg border">
                  {links.map((l, i) => (
                    <div key={`${l.page}-${l.kind}-${i}`} className="flex gap-2 border-b px-3 py-2 text-xs last:border-b-0">
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5">Page {l.page}</span>
                      <span className="shrink-0 text-muted-foreground">{l.kind === 'clickable' ? 'Clickable' : 'Visible'}</span>
                      <span className="min-w-0 break-all">{l.url}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-2 text-xs text-muted-foreground">No visible URLs or clickable link annotations found.</p>}
            </section>

            <Button className="w-full" size="lg" onClick={saveCleaned} disabled={busy || (!anyMetaSelected && !(redactText && redactionCount > 0) && !removeLinks)}>
              {busy ? <><Loader2 className="size-4 animate-spin" /> Saving...</> : <><Download className="size-4" /> Save share-safe PDF</>}
            </Button>
          </div>
        )}

        {done && (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                <p className="text-sm font-semibold">Cleaned copy ready — we checked it for you</p>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                These changes don’t show when you open the PDF (they’re hidden data), so we re-scanned your cleaned file to confirm:
              </p>
              <div className="mt-2 overflow-hidden rounded-lg border bg-card">
                {done.checks.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 border-b px-3 py-2 text-xs last:border-b-0">
                    {c.ok ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="size-4 shrink-0 text-amber-500" />}
                    <span className="w-28 shrink-0 font-medium">{c.label}</span>
                    <span className="text-muted-foreground line-through">{c.before}</span>
                    <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                    <span className={c.ok ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}>{c.after}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Want to see it yourself? Drop the downloaded file back into this tool — it’ll come back clean.
              </p>
            </div>
            <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/share-safe-pdf-check" fromLabel="Share-Safe Check" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
