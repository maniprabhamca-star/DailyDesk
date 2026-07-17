'use client';

import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Download, FileSearch, FileText, Loader2, Plus, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';
import { downloadBlob as download } from '@/lib/download';
import { openPdf, renderPage, dprTarget, type PdfHandle, type RenderedPage } from '@/lib/pdf-render';
import { KeepGoing } from '@/components/app/keep-going';

type Side = 'left' | 'right';
type PdfSummary = {
  file: File;
  pages: number;
  textByPage: string[];
  words: string[];
  thumb: RenderedPage | null;
};
type WordDelta = { word: string; count: number };
type PageDelta = {
  page: number;
  status: 'same' | 'changed' | 'added' | 'removed';
  similarity: number;
  left: string;
  right: string;
};

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function normalize(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function words(text: string) {
  return normalize(text).toLowerCase().match(/[a-z0-9][a-z0-9'.-]*/g) || [];
}

function countWords(list: string[]) {
  const counts = new Map<string, number>();
  for (const word of list) counts.set(word, (counts.get(word) || 0) + 1);
  return counts;
}

function topDeltas(primary: string[], compare: string[], limit = 18): WordDelta[] {
  const a = countWords(primary);
  const b = countWords(compare);
  const out: WordDelta[] = [];
  a.forEach((count, word) => {
    const delta = count - (b.get(word) || 0);
    if (delta > 0 && word.length > 2) out.push({ word, count: delta });
  });
  return out.sort((x, y) => y.count - x.count || x.word.localeCompare(y.word)).slice(0, limit);
}

function similarity(a: string[], b: string[]) {
  if (!a.length && !b.length) return 1;
  const ca = countWords(a);
  const cb = countWords(b);
  let overlap = 0;
  ca.forEach((n, word) => { overlap += Math.min(n, cb.get(word) || 0); });
  return overlap / Math.max(a.length, b.length, 1);
}

function clip(text: string, len = 210) {
  const n = normalize(text);
  return n.length > len ? `${n.slice(0, len - 1)}...` : n || 'No selectable text on this page.';
}

async function cloneRenderedPage(page: RenderedPage): Promise<RenderedPage> {
  const blob = await (await fetch(page.url)).blob();
  return { url: URL.createObjectURL(blob), w: page.w, h: page.h };
}

function revokeSummary(summary: PdfSummary | null) {
  if (summary?.thumb) URL.revokeObjectURL(summary.thumb.url);
}

async function analyzePdf(file: File): Promise<PdfSummary> {
  let handle: PdfHandle | null = null;
  try {
    handle = await openPdf(file);
    const textByPage: string[] = [];
    for (let i = 1; i <= handle.numPages; i++) {
      const page = await handle.doc.getPage(i);
      const content = await page.getTextContent();
      textByPage.push(content.items.map((it: unknown) => (it as { str?: string }).str || '').join(' '));
    }
    let thumb: RenderedPage | null = null;
    if (handle.numPages > 0) {
      const rendered = await renderPage(handle, 0, dprTarget(380, 1.8, 620));
      thumb = await cloneRenderedPage(rendered);
    }
    return { file, pages: handle.numPages, textByPage, words: words(textByPage.join(' ')), thumb };
  } finally {
    if (handle) void handle.destroy();
  }
}

function buildComparison(left: PdfSummary | null, right: PdfSummary | null) {
  if (!left || !right) return null;
  const maxPages = Math.max(left.pages, right.pages);
  const pages: PageDelta[] = [];
  for (let i = 0; i < maxPages; i++) {
    const l = left.textByPage[i] || '';
    const r = right.textByPage[i] || '';
    const sim = similarity(words(l), words(r));
    let status: PageDelta['status'] = 'same';
    if (i >= left.pages) status = 'added';
    else if (i >= right.pages) status = 'removed';
    else if (normalize(l) !== normalize(r) && sim < 0.995) status = 'changed';
    pages.push({ page: i + 1, status, similarity: sim, left: clip(l), right: clip(r) });
  }
  const changed = pages.filter((p) => p.status !== 'same');
  return {
    similarity: similarity(left.words, right.words),
    addedWords: topDeltas(right.words, left.words),
    removedWords: topDeltas(left.words, right.words),
    changedPages: changed,
    pages,
  };
}

export function ComparePdfTool() {
  const [left, setLeft] = useState<PdfSummary | null>(null);
  const [right, setRight] = useState<PdfSummary | null>(null);
  const [busy, setBusy] = useState<Side | null>(null);
  const [error, setError] = useState<string | null>(null);
  const leftInput = useRef<HTMLInputElement>(null);
  const rightInput = useRef<HTMLInputElement>(null);
  const comparison = useMemo(() => buildComparison(left, right), [left, right]);

  async function pick(side: Side, file?: File) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError(wrongTypeError(file.name));
      return;
    }
    setBusy(side);
    setError(null);
    try {
      const result = await analyzePdf(file);
      if (side === 'left') setLeft((prev) => { revokeSummary(prev); return result; });
      else setRight((prev) => { revokeSummary(prev); return result; });
    } catch {
      setError('Could not compare that PDF. It may be encrypted or corrupted.');
    } finally {
      setBusy(null);
    }
  }

  function clear(side: Side) {
    if (side === 'left') setLeft((prev) => { revokeSummary(prev); return null; });
    else setRight((prev) => { revokeSummary(prev); return null; });
  }

  function downloadReport() {
    if (!left || !right || !comparison) return;
    const lines = [
      'DiemDesk Compare PDF report',
      '',
      `Original: ${left.file.name} (${left.pages} page${left.pages === 1 ? '' : 's'})`,
      `Updated: ${right.file.name} (${right.pages} page${right.pages === 1 ? '' : 's'})`,
      `Text similarity: ${Math.round(comparison.similarity * 100)}%`,
      `Changed pages: ${comparison.changedPages.length}`,
      '',
      'Added words:',
      comparison.addedWords.map((w) => `+ ${w.word} (${w.count})`).join('\n') || 'None detected',
      '',
      'Removed words:',
      comparison.removedWords.map((w) => `- ${w.word} (${w.count})`).join('\n') || 'None detected',
      '',
      'Page changes:',
      comparison.changedPages.map((p) => `Page ${p.page}: ${p.status}, ${Math.round(p.similarity * 100)}% similar`).join('\n') || 'No text changes detected',
    ];
    download(new Blob([lines.join('\n')], { type: 'text/plain' }), 'compare-pdf-report.txt');
  }

  const drop = (side: Side, label: string, summary: PdfSummary | null, input: React.RefObject<HTMLInputElement>) => (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); void pick(side, e.dataTransfer.files?.[0]); }}
      onClick={() => input.current?.click()}
      className="min-h-48 cursor-pointer rounded-xl border-2 border-dashed border-border bg-muted/20 p-4 transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { void pick(side, e.target.files?.[0]); e.currentTarget.value = ''; }} />
      {summary ? (
        <div className="flex gap-3">
          {summary.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={summary.thumb.url} alt="" className="h-32 w-24 rounded-md border bg-white object-contain shadow-soft" />
          ) : (
            <span className="flex h-32 w-24 items-center justify-center rounded-md border bg-card text-primary"><FileText className="size-6" /></span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</p>
            <p className="mt-1 truncate text-sm font-semibold">{summary.file.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{fmt(summary.file.size)} - {summary.pages} page{summary.pages === 1 ? '' : 's'} - {summary.words.length.toLocaleString()} words</p>
            <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={(e) => { e.stopPropagation(); clear(side); }}>
              <X className="size-4" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-40 flex-col items-center justify-center text-center">
          {busy === side ? <Loader2 className="size-7 animate-spin text-primary" /> : <Upload className="size-7 text-muted-foreground" />}
          <p className="mt-2 text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">Drop a PDF here, or click to choose</p>
          <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
        </div>
      )}
    </div>
  );

  return (
    <>
    <Card>
      <CardContent className="p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          {drop('left', 'Original PDF', left, leftInput)}
          <div className="hidden size-11 items-center justify-center rounded-full border bg-card text-primary md:flex">
            <ArrowLeftRight className="size-5" />
          </div>
          {drop('right', 'Updated PDF', right, rightInput)}
        </div>

        {error && <UploadError error={error} />}

        {comparison && left && right && (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">Text similarity</p>
                <p className="mt-1 text-2xl font-bold">{Math.round(comparison.similarity * 100)}%</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">Page count</p>
                <p className="mt-1 text-2xl font-bold">{left.pages} {'->'} {right.pages}</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">Changed pages</p>
                <p className="mt-1 text-2xl font-bold">{comparison.changedPages.length}</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">Word delta</p>
                <p className="mt-1 text-2xl font-bold">{right.words.length - left.words.length >= 0 ? '+' : ''}{(right.words.length - left.words.length).toLocaleString()}</p>
              </div>
            </div>

            <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 ${comparison.changedPages.length ? 'border-amber-500/30 bg-amber-500/10 text-amber-800' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800'}`}>
              {comparison.changedPages.length ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
              <p className="text-sm">
                {comparison.changedPages.length
                  ? `${comparison.changedPages.length} page${comparison.changedPages.length === 1 ? '' : 's'} changed. Review the page list below before sending.`
                  : 'No selectable-text differences detected between these PDFs.'}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <section className="rounded-xl border bg-card p-3">
                <p className="flex items-center gap-2 text-sm font-semibold"><Plus className="size-4 text-emerald-600" /> Added words</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {comparison.addedWords.length ? comparison.addedWords.map((w) => (
                    <span key={w.word} className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">{w.word} +{w.count}</span>
                  )) : <span className="text-xs text-muted-foreground">No meaningful additions detected.</span>}
                </div>
              </section>
              <section className="rounded-xl border bg-card p-3">
                <p className="flex items-center gap-2 text-sm font-semibold"><X className="size-4 text-red-600" /> Removed words</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {comparison.removedWords.length ? comparison.removedWords.map((w) => (
                    <span key={w.word} className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-700">{w.word} -{w.count}</span>
                  )) : <span className="text-xs text-muted-foreground">No meaningful removals detected.</span>}
                </div>
              </section>
            </div>

            <section className="rounded-xl border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold"><FileSearch className="size-4 text-primary" /> Page-by-page changes</p>
                <Button size="sm" variant="outline" onClick={downloadReport}><Download className="size-4" /> Download report</Button>
              </div>
              <div className="mt-3 max-h-80 overflow-auto rounded-lg border">
                {(comparison.changedPages.length ? comparison.changedPages : comparison.pages.slice(0, 3)).map((p) => (
                  <div key={p.page} className="border-b px-3 py-2 last:border-b-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">Page {p.page}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.status === 'same' ? 'bg-emerald-500/10 text-emerald-700' : p.status === 'added' ? 'bg-emerald-500/10 text-emerald-700' : p.status === 'removed' ? 'bg-red-500/10 text-red-700' : 'bg-amber-500/10 text-amber-700'}`}>
                        {p.status}
                      </span>
                      <span className="text-xs text-muted-foreground">{Math.round(p.similarity * 100)}% similar</span>
                    </div>
                    {p.status !== 'same' && (
                      <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                        <p className="rounded-md bg-muted/40 p-2"><strong>Original:</strong> {p.left}</p>
                        <p className="rounded-md bg-muted/40 p-2"><strong>Updated:</strong> {p.right}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">This preview compares selectable text and page counts on-device. A pixel-level visual diff can be added next for image-only/scanned PDFs.</p>
            </section>
          </div>
        )}
      </CardContent>
    </Card>
    <KeepGoing exclude="/compare-pdf" title="Do more, privately" />
    </>
  );
}
