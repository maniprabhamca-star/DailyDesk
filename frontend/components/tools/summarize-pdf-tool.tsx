'use client';

import { useCallback, useState } from 'react';
import { AlignLeft, Copy, Check, Download, Loader2, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KeepGoing } from '@/components/app/keep-going';
import { aiPost, packForContext, AI_LANGUAGES, AI_FALLBACK_MSG } from '@/lib/ai-doc';
// Export engines (pdf-lib, jszip) are heavy — loaded on demand at export time.
import type { DocxBlock } from '@/lib/docx';
import type { PdfBlock } from '@/lib/ai-export';
import { downloadBlob } from '@/lib/download';
const exporters = () => import('@/lib/ai-export');
const docxLib = () => import('@/lib/docx');
const downloadText = (text: string, filename: string, mime = 'text/plain') =>
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
import {
  useAiDoc, AiDropzone, AiDocPanel, AiPrivacyNote, NoTextNote, Ctl, Seg, Toggle, CiteText, CapChip,
} from './ai-doc-shell';

type KeyPoint = { text: string; page: number };
type SumResponse = { summary: string; keyPoints: KeyPoint[]; remaining: number | null };

const baseName = (n?: string) => (n || 'document').replace(/\.pdf$/i, '');

export function SummarizePdfTool() {
  const doc = useAiDoc();
  const [length, setLength] = useState<'tldr' | 'standard' | 'detailed'>('standard');
  const [format, setFormat] = useState<'paragraphs' | 'bullets' | 'brief' | 'sections'>('paragraphs');
  const [audience, setAudience] = useState<'general' | 'simple' | 'professional' | 'technical'>('general');
  const [language, setLanguage] = useState('Same as document');
  const [focus, setFocus] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SumResponse | null>(null);
  const [sampled, setSampled] = useState(false);
  const [copied, setCopied] = useState(false);

  const run = useCallback(async () => {
    if (doc.status !== 'ready' || doc.noText || busy) return;
    setBusy(true); setError(null); setResult(null);
    const { context, sampled: s } = packForContext(doc.chunks);
    setSampled(s);
    const r = await aiPost<SumResponse>('/api/ai/summarize', { context, length, format, audience, language, focus });
    if (r.ok && r.data) setResult(r.data); else setError(r.message || AI_FALLBACK_MSG);
    setBusy(false);
  }, [doc.status, doc.noText, doc.chunks, busy, length, format, audience, language, focus]);

  const asMarkdown = useCallback(() => {
    if (!result) return '';
    const kp = result.keyPoints.length
      ? `\n\n## Key points\n${result.keyPoints.map((k) => `- ${k.text}${k.page ? ` (p.${k.page})` : ''}`).join('\n')}`
      : '';
    return `# Summary — ${doc.file?.name || 'document'}\n\n${result.summary}${kp}\n\n*Generated with DiemDesk — the file never left the device.*`;
  }, [result, doc.file]);

  const exportDocx = useCallback(async () => {
    if (!result) return;
    const blocks: DocxBlock[] = [
      { type: 'h1', text: `Summary — ${baseName(doc.file?.name)}` },
      ...result.summary.split(/\n+/).filter(Boolean).map((t) => ({ type: 'p', text: t }) as DocxBlock),
    ];
    if (result.keyPoints.length) {
      blocks.push({ type: 'h2', text: 'Key points' });
      for (const k of result.keyPoints) blocks.push({ type: 'li', text: `${k.text}${k.page ? ` (p.${k.page})` : ''}` });
    }
    blocks.push({ type: 'note', text: 'Generated with DiemDesk — the file never left the device.' });
    const { makeDocx } = await docxLib();
    downloadBlob(await makeDocx(blocks), `${baseName(doc.file?.name)}-summary.docx`);
  }, [result, doc.file]);

  const exportPdf = useCallback(async () => {
    if (!result) return;
    const { makeTextPdf, pdfCanRender } = await exporters();
    const all = `${result.summary} ${result.keyPoints.map((k) => k.text).join(' ')}`;
    if (!pdfCanRender(all)) {
      setError('PDF export for this script is coming soon — the Word export handles it perfectly today.');
      return;
    }
    const blocks: PdfBlock[] = [
      { type: 'h1', text: `Summary — ${baseName(doc.file?.name)}` },
      ...result.summary.split(/\n+/).filter(Boolean).map((t) => ({ type: 'p', text: t }) as PdfBlock),
    ];
    if (result.keyPoints.length) {
      blocks.push({ type: 'h2', text: 'Key points' });
      for (const k of result.keyPoints) blocks.push({ type: 'li', text: `${k.text}${k.page ? ` (p.${k.page})` : ''}` });
    }
    blocks.push({ type: 'note', text: 'Generated with DiemDesk — the file never left the device.' });
    downloadBlob(await makeTextPdf('Summary', blocks), `${baseName(doc.file?.name)}-summary.pdf`);
  }, [result, doc.file]);

  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(asMarkdown()); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  }, [asMarkdown]);

  if (doc.status === 'idle') return <AiDropzone doc={doc} prompt="Drop a PDF to summarize it" />;

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <AiDocPanel doc={doc} />

        <section className="flex min-h-[440px] flex-col rounded-2xl border bg-card">
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <span className="flex size-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400"><AlignLeft className="size-4" /></span>
            <b className="text-sm">Summarize this document</b>
            <CapChip remaining={result?.remaining ?? null} />
          </header>

          <div className="flex flex-wrap items-end gap-x-5 gap-y-3 border-b bg-muted/30 px-4 py-3.5">
            <Ctl label="Length">
              <Seg value={length} onChange={setLength} disabled={busy}
                options={[{ v: 'tldr', label: 'TL;DR' }, { v: 'standard', label: 'Standard' }, { v: 'detailed', label: 'Detailed' }]} />
            </Ctl>
            <Ctl label="Format">
              <Seg value={format} onChange={setFormat} disabled={busy}
                options={[{ v: 'paragraphs', label: 'Paragraphs' }, { v: 'bullets', label: 'Bullets' }, { v: 'brief', label: 'Executive brief' }, { v: 'sections', label: 'By section' }]} />
            </Ctl>
            <Ctl label="Written for" uniq>
              <Seg value={audience} onChange={setAudience} disabled={busy}
                options={[{ v: 'general', label: 'General' }, { v: 'simple', label: 'Simple' }, { v: 'professional', label: 'Professional' }, { v: 'technical', label: 'Technical' }]} />
            </Ctl>
            <Ctl label="Summary language" uniq>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={busy}
                className="rounded-lg border bg-card px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-violet-500">
                <option>Same as document</option>
                {AI_LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
            </Ctl>
            <div className="min-w-[240px] flex-1">
              <Ctl label="Focus on… (optional)" uniq>
                <input value={focus} onChange={(e) => setFocus(e.target.value)} disabled={busy} maxLength={200}
                  placeholder="e.g. financial risks, deadlines, what changed"
                  className="w-full rounded-lg border bg-card px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-violet-500" />
              </Ctl>
            </div>
            <Button onClick={() => void run()} disabled={doc.status !== 'ready' || doc.noText || busy}
              className="ml-auto bg-violet-600 text-white hover:bg-violet-700">
              {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Play className="mr-1.5 size-4" />}
              {busy ? 'Summarizing…' : 'Summarize'}
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-auto p-4">
            {doc.status === 'reading' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Reading your document… {Math.round(doc.readPct * 100)}%</div>
            )}
            {doc.noText && <NoTextNote />}
            {error && <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">{error}</div>}
            {busy && (
              <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <Sparkles className="size-4 animate-pulse text-violet-500" /> Reading {doc.numPages} pages and writing your summary…
              </div>
            )}
            {result && (
              <>
                {sampled && (
                  <div className="rounded-xl border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
                    This is a very long document — the summary is built from excerpts sampled evenly across it.
                  </div>
                )}
                <div className="rounded-xl border bg-muted/30 p-4">
                  <h4 className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground/70">Summary</h4>
                  <div className="space-y-2.5 text-sm leading-relaxed">
                    {result.summary.split(/\n+/).filter(Boolean).map((p, i) => {
                      const m = p.match(/^\s*[-•]\s+(.*)$/);
                      return m ? (
                        <div key={i} className="flex gap-2 pl-1">
                          <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-violet-500" />
                          <span><CiteText text={m[1]} onCite={(pg) => doc.showPage(pg - 1)} /></span>
                        </div>
                      ) : (
                        <p key={i}><CiteText text={p} onCite={(pg) => doc.showPage(pg - 1)} /></p>
                      );
                    })}
                  </div>
                </div>
                {result.keyPoints.length > 0 && (
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <h4 className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground/70">Key points</h4>
                    <ul className="space-y-1.5 text-sm">
                      {result.keyPoints.map((k, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-violet-500" />
                          <span>
                            {k.text}{' '}
                            {k.page > 0 && (
                              <button onClick={() => doc.showPage(k.page - 1)}
                                className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-1.5 py-px text-[11px] font-semibold text-primary hover:bg-primary/20">
                                p.{k.page}
                              </button>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
            {!result && !busy && !doc.noText && doc.status === 'ready' && (
              <p className="text-sm text-muted-foreground">Pick your options above and hit <b>Summarize</b>. Every claim will cite the page it came from.</p>
            )}
          </div>

          {result && (
            <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
              <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground/70">Export</span>
              <Button size="sm" onClick={() => void exportPdf()} className="bg-violet-600 text-white hover:bg-violet-700"><Download className="mr-1 size-3.5" /> PDF</Button>
              <Button size="sm" variant="outline" onClick={() => void exportDocx()}>Word</Button>
              <Button size="sm" variant="outline" onClick={() => downloadText(asMarkdown(), `${baseName(doc.file?.name)}-summary.md`, 'text/markdown')}>Markdown</Button>
              <Button size="sm" variant="outline" onClick={() => downloadText(`${result.summary}\n\nKey points:\n${result.keyPoints.map((k) => `- ${k.text}`).join('\n')}`, `${baseName(doc.file?.name)}-summary.txt`)}>Text</Button>
              <Button size="sm" variant="outline" onClick={() => void copy()}>{copied ? <Check className="mr-1 size-3.5" /> : <Copy className="mr-1 size-3.5" />}{copied ? 'Copied' : 'Copy'}</Button>
              <a href="/chat-pdf" className="ml-auto text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400">Ask a follow-up → Chat with PDF</a>
            </div>
          )}
        </section>
      </div>
      <AiPrivacyNote />
      <KeepGoing exclude="/summarize-pdf" title="Do more, privately" />
    </div>
  );
}
