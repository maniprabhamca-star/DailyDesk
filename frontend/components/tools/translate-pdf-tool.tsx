'use client';

import { useCallback, useMemo, useState } from 'react';
import { Languages, Copy, Check, Download, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KeepGoing } from '@/components/app/keep-going';
import { aiPost, pagesFromChunks, AI_FALLBACK_MSG } from '@/lib/ai-doc';
import { AI_LANGUAGES } from '@/lib/ai-doc';
// Export engines (pdf-lib, jszip) are heavy — loaded on demand at export time.
import type { DocxBlock } from '@/lib/docx';
import type { PdfBlock } from '@/lib/ai-export';
import { downloadBlob } from '@/lib/download';
const exporters = () => import('@/lib/ai-export');
const docxLib = () => import('@/lib/docx');
const downloadText = (text: string, filename: string, mime = 'text/plain') =>
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
import {
  useAiDoc, AiDropzone, AiDocPanel, AiPrivacyNote, NoTextNote, Ctl, Seg, Toggle, CapChip,
} from './ai-doc-shell';

type TrPage = { page: number; translation: string; notes: string[] };
type TrResponse = { pages: TrPage[]; remaining: number | null };

const MAX_PAGES = 30;
const baseName = (n?: string) => (n || 'document').replace(/\.pdf$/i, '');

export function TranslatePdfTool() {
  const doc = useAiDoc('translate');
  const [to, setTo] = useState('English');
  const [tone, setTone] = useState<'auto' | 'formal' | 'informal'>('auto');
  const [view, setView] = useState<'side' | 'only' | 'inter'>('side');
  const [glossary, setGlossary] = useState('');
  const [notes, setNotes] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const srcPages = useMemo(() => pagesFromChunks(doc.chunks), [doc.chunks]);
  const tooLong = srcPages.length > MAX_PAGES;

  const run = useCallback(async () => {
    if (doc.status !== 'ready' || doc.noText || busy || tooLong) return;
    setBusy(true); setError(null); setResult(null);
    const r = await aiPost<TrResponse>('/api/ai/translate', { pages: srcPages, to, tone, glossary, notes });
    if (r.ok && r.data) setResult(r.data); else setError(r.message || AI_FALLBACK_MSG);
    setBusy(false);
  }, [doc.status, doc.noText, busy, tooLong, srcPages, to, tone, glossary, notes]);

  const srcOf = useCallback((page: number) => srcPages.find((p) => p.page === page)?.text || '', [srcPages]);

  const translationText = useCallback(
    () => (result ? result.pages.map((p) => `[Page ${p.page}]\n${p.translation}`).join('\n\n') : ''),
    [result],
  );

  const exportDocx = useCallback(async (sideBySide: boolean) => {
    if (!result) return;
    const blocks: DocxBlock[] = [{ type: 'h1', text: `${baseName(doc.file?.name)} — ${to} translation` }];
    if (sideBySide) {
      const rows: string[][] = [['Original', `${to} translation`]];
      for (const p of result.pages) rows.push([`[p.${p.page}] ${srcOf(p.page)}`, p.translation]);
      blocks.push({ type: 'table', rows, header: true });
    } else {
      for (const p of result.pages) {
        blocks.push({ type: 'h2', text: `Page ${p.page}` });
        for (const para of p.translation.split(/\n+/).filter(Boolean)) blocks.push({ type: 'p', text: para });
        for (const n of p.notes) blocks.push({ type: 'note', text: `Translator note: ${n}` });
      }
    }
    blocks.push({ type: 'note', text: 'Translated with DiemDesk — the file never left the device. Text translation; original layout not reproduced.' });
    const { makeDocx } = await docxLib();
    downloadBlob(await makeDocx(blocks), `${baseName(doc.file?.name)}-${to.toLowerCase().replace(/[^a-z]+/g, '-')}${sideBySide ? '-side-by-side' : ''}.docx`);
  }, [result, doc.file, to, srcOf]);

  const exportPdf = useCallback(async () => {
    if (!result) return;
    const { makeTextPdf, pdfCanRender } = await exporters();
    const all = result.pages.map((p) => p.translation).join(' ');
    if (!pdfCanRender(all)) {
      setError(`PDF export for ${to} script is coming soon — the Word export handles it perfectly today.`);
      return;
    }
    const blocks: PdfBlock[] = [{ type: 'h1', text: `${baseName(doc.file?.name)} — ${to} translation` }];
    for (const p of result.pages) {
      blocks.push({ type: 'h2', text: `Page ${p.page}` });
      for (const para of p.translation.split(/\n+/).filter(Boolean)) blocks.push({ type: 'p', text: para });
      for (const n of p.notes) blocks.push({ type: 'note', text: `Translator note: ${n}` });
    }
    blocks.push({ type: 'note', text: 'Translated with DiemDesk — the file never left the device.' });
    downloadBlob(await makeTextPdf('Translation', blocks), `${baseName(doc.file?.name)}-${to.toLowerCase().replace(/[^a-z]+/g, '-')}.pdf`);
  }, [result, doc.file, to]);

  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(translationText()); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  }, [translationText]);

  if (doc.status === 'idle') return <AiDropzone doc={doc} prompt="Drop a PDF to translate it" />;

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <AiDocPanel doc={doc} />

        <section className="flex min-h-[440px] flex-col rounded-2xl border bg-card">
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <span className="flex size-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400"><Languages className="size-4" /></span>
            <b className="text-sm">Translate this document</b>
            <CapChip remaining={result?.remaining ?? null} />
          </header>

          <div className="flex flex-wrap items-end gap-x-5 gap-y-3 border-b bg-muted/30 px-4 py-3.5">
            <Ctl label="To">
              <select value={to} onChange={(e) => setTo(e.target.value)} disabled={busy}
                className="rounded-lg border bg-card px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-violet-500">
                {AI_LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
            </Ctl>
            <Ctl label="Tone" uniq>
              <Seg value={tone} onChange={setTone} disabled={busy}
                options={[{ v: 'auto', label: 'Auto' }, { v: 'formal', label: 'Formal' }, { v: 'informal', label: 'Informal' }]} />
            </Ctl>
            <Ctl label="View">
              <Seg value={view} onChange={setView}
                options={[{ v: 'side', label: 'Side by side' }, { v: 'only', label: 'Translation only' }, { v: 'inter', label: 'Interleaved' }]} />
            </Ctl>
            <div className="min-w-[240px] flex-1">
              <Ctl label="Don't translate these (names, brands, terms)" uniq>
                <input value={glossary} onChange={(e) => setGlossary(e.target.value)} disabled={busy} maxLength={300}
                  placeholder="e.g. DiemDesk, Herr Schmidt, FOB, Anlage A"
                  className="w-full rounded-lg border bg-card px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-violet-500" />
              </Ctl>
            </div>
            <Ctl label="Translator notes" uniq>
              <Toggle on={notes} onChange={setNotes} label="Flag ambiguous terms" />
            </Ctl>
            <Button onClick={() => void run()} disabled={doc.status !== 'ready' || doc.noText || busy || tooLong}
              className="ml-auto bg-violet-600 text-white hover:bg-violet-700">
              {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Play className="mr-1.5 size-4" />}
              {busy ? 'Translating…' : 'Translate'}
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-auto p-4">
            {doc.status === 'reading' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Reading your document… {Math.round(doc.readPct * 100)}%</div>
            )}
            {doc.noText && <NoTextNote />}
            {tooLong && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
                Translate handles up to {MAX_PAGES} pages per run — this document has {srcPages.length} pages with text.{' '}
                <a href="/split-pdf" className="font-semibold underline">Split it first →</a>
              </div>
            )}
            {error && <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">{error}</div>}
            {busy && (
              <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-violet-500" /> Translating {srcPages.length} {srcPages.length === 1 ? 'page' : 'pages'} into {to}… this can take a minute on long documents.
              </div>
            )}
            {result && result.pages.map((p) => (
              <div key={p.page} className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground/70">
                  <span className="h-px flex-1 bg-border" /> Page {p.page} <span className="h-px flex-1 bg-border" />
                </div>
                {view === 'side' ? (
                  <div className="grid gap-2.5 lg:grid-cols-2">
                    <div className="rounded-xl border bg-muted/30 p-3.5 text-[13px] leading-relaxed">
                      <span className="mb-1.5 inline-block rounded border bg-card px-1.5 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Original</span>
                      <p className="whitespace-pre-wrap">{srcOf(p.page)}</p>
                    </div>
                    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3.5 text-[13px] leading-relaxed">
                      <span className="mb-1.5 inline-block rounded border border-violet-500/40 bg-violet-500/10 px-1.5 text-[9.5px] font-extrabold uppercase tracking-wide text-violet-600 dark:text-violet-400">{to}</span>
                      <p className="whitespace-pre-wrap">{p.translation}</p>
                    </div>
                  </div>
                ) : view === 'inter' ? (
                  <div className="space-y-2">
                    <div className="rounded-xl border bg-muted/30 p-3.5 text-[13px] leading-relaxed"><p className="whitespace-pre-wrap">{srcOf(p.page)}</p></div>
                    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3.5 text-[13px] leading-relaxed"><p className="whitespace-pre-wrap">{p.translation}</p></div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3.5 text-[13px] leading-relaxed"><p className="whitespace-pre-wrap">{p.translation}</p></div>
                )}
                {p.notes.map((n, i) => (
                  <div key={i} className="rounded-lg border border-dashed border-violet-500/40 bg-violet-500/5 px-3 py-2 text-xs">
                    <b className="text-violet-600 dark:text-violet-400">Translator note:</b> {n}
                  </div>
                ))}
              </div>
            ))}
            {!result && !busy && !doc.noText && !tooLong && doc.status === 'ready' && (
              <p className="text-sm text-muted-foreground">
                Pick a language and hit <b>Translate</b>. You get clean, faithful translated text page by page — the original layout isn't reproduced (that's an honest v1 limit, not a bug).
              </p>
            )}
          </div>

          {result && (
            <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
              <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground/70">Export</span>
              <Button size="sm" onClick={() => void exportPdf()} className="bg-violet-600 text-white hover:bg-violet-700"><Download className="mr-1 size-3.5" /> PDF</Button>
              <Button size="sm" variant="outline" onClick={() => void exportDocx(false)}>Word</Button>
              <Button size="sm" variant="outline" onClick={() => void exportDocx(true)}>Side-by-side Word</Button>
              <Button size="sm" variant="outline" onClick={() => downloadText(translationText(), `${baseName(doc.file?.name)}-${to.toLowerCase().replace(/[^a-z]+/g, '-')}.txt`)}>Text</Button>
              <Button size="sm" variant="outline" onClick={() => void copy()}>{copied ? <Check className="mr-1 size-3.5" /> : <Copy className="mr-1 size-3.5" />}{copied ? 'Copied' : 'Copy'}</Button>
            </div>
          )}
        </section>
      </div>
      <AiPrivacyNote />
      <KeepGoing exclude="/translate-pdf" title="Do more, privately" />
    </div>
  );
}
