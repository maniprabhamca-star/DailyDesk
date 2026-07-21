'use client';

import { useCallback, useState } from 'react';
import { HelpCircle, Copy, Check, Download, Loader2, Play, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KeepGoing } from '@/components/app/keep-going';
import { aiPost, packForContext, AI_FALLBACK_MSG } from '@/lib/ai-doc';
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

type Q = {
  type: 'mcq' | 'tf' | 'blank' | 'flash' | 'open';
  q: string;
  options?: string[];
  answerIndex?: number;
  answer: string;
  explanation: string;
  bloom: 'recall' | 'understand' | 'apply' | 'analyze';
  page: number;
};
type QResponse = { questions: Q[]; remaining: number | null };

const LETTERS = ['A', 'B', 'C', 'D'];
const baseName = (n?: string) => (n || 'document').replace(/\.pdf$/i, '');

const answerOf = (q: Q): string => (q.type === 'mcq' && q.options ? q.options[q.answerIndex ?? 0] : q.answer);

export function PdfQuestionGeneratorTool() {
  const doc = useAiDoc('questions');
  const [type, setType] = useState<'mcq' | 'tf' | 'blank' | 'flash' | 'open' | 'mixed'>('mcq');
  const [count, setCount] = useState<'5' | '10' | '20' | '30'>('10');
  const [difficulty, setDifficulty] = useState<'easy' | 'mixed' | 'hard'>('mixed');
  const [bloom, setBloom] = useState<'any' | 'recall' | 'understand' | 'apply' | 'analyze'>('any');
  const [explain, setExplain] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QResponse | null>(null);
  const [shown, setShown] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  const run = useCallback(async () => {
    if (doc.status !== 'ready' || doc.noText || busy) return;
    setBusy(true); setError(null); setResult(null); setShown(new Set());
    const { context } = packForContext(doc.chunks);
    const r = await aiPost<QResponse>('/api/ai/questions', { context, type, count: Number(count), difficulty, bloom, explanations: explain });
    if (r.ok && r.data) setResult(r.data); else setError(r.message || AI_FALLBACK_MSG);
    setBusy(false);
  }, [doc.status, doc.noText, doc.chunks, busy, type, count, difficulty, bloom, explain]);

  const toggle = (i: number) => setShown((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  const asMarkdown = useCallback(() => {
    if (!result) return '';
    const qs = result.questions.map((q, i) => {
      const opts = q.type === 'mcq' && q.options ? `\n${q.options.map((o, j) => `   ${LETTERS[j]}. ${o}`).join('\n')}` : '';
      return `${i + 1}. ${q.q}${opts}\n   → ${answerOf(q)}${q.explanation ? ` — ${q.explanation}` : ''} (p.${q.page})`;
    }).join('\n\n');
    return `# Questions — ${doc.file?.name || 'document'}\n\n${qs}\n\n*Generated with DiemDesk — the file never left the device.*`;
  }, [result, doc.file]);

  const exportPdf = useCallback(async () => {
    if (!result) return;
    const { makeTextPdf, pdfCanRender } = await exporters();
    const all = result.questions.map((q) => `${q.q} ${answerOf(q)} ${(q.options || []).join(' ')}`).join(' ');
    if (!pdfCanRender(all)) {
      setError('PDF export for this script is coming soon — the Word export handles it perfectly today.');
      return;
    }
    const blocks: PdfBlock[] = [{ type: 'h1', text: `Quiz — ${baseName(doc.file?.name)}` }];
    result.questions.forEach((q, i) => {
      blocks.push({ type: 'p', text: `${i + 1}. ${q.q}` });
      if (q.type === 'mcq' && q.options) q.options.forEach((o, j) => blocks.push({ type: 'li', text: `${LETTERS[j]}. ${o}` }));
    });
    blocks.push({ type: 'pagebreak' });
    blocks.push({ type: 'h1', text: 'Answer key' });
    result.questions.forEach((q, i) => {
      blocks.push({ type: 'p', text: `${i + 1}. ${answerOf(q)}${q.page ? ` (p.${q.page})` : ''}` });
      if (q.explanation) blocks.push({ type: 'note', text: q.explanation });
    });
    blocks.push({ type: 'note', text: 'Generated with DiemDesk — the file never left the device.' });
    downloadBlob(await makeTextPdf('Quiz', blocks), `${baseName(doc.file?.name)}-quiz.pdf`);
  }, [result, doc.file]);

  const exportDocx = useCallback(async () => {
    if (!result) return;
    const blocks: DocxBlock[] = [{ type: 'h1', text: `Quiz — ${baseName(doc.file?.name)}` }];
    result.questions.forEach((q, i) => {
      blocks.push({ type: 'p', text: `${i + 1}. ${q.q}` });
      if (q.type === 'mcq' && q.options) q.options.forEach((o, j) => blocks.push({ type: 'li', text: `${LETTERS[j]}. ${o}` }));
    });
    blocks.push({ type: 'h1', text: 'Answer key' });
    result.questions.forEach((q, i) => {
      blocks.push({ type: 'p', text: `${i + 1}. ${answerOf(q)}${q.page ? ` (p.${q.page})` : ''}${q.explanation ? ` — ${q.explanation}` : ''}` });
    });
    blocks.push({ type: 'note', text: 'Generated with DiemDesk — the file never left the device.' });
    const { makeDocx } = await docxLib();
    downloadBlob(await makeDocx(blocks), `${baseName(doc.file?.name)}-quiz.docx`);
  }, [result, doc.file]);

  const exportAnki = useCallback(async () => {
    if (!result) return;
    const { makeAnkiCsv } = await exporters();
    const cards = result.questions.map((q) => ({
      front: q.type === 'mcq' && q.options ? `${q.q}\n${q.options.map((o, j) => `${LETTERS[j]}. ${o}`).join('\n')}` : q.q,
      back: `${answerOf(q)}${q.explanation ? ` — ${q.explanation}` : ''}`,
    }));
    downloadBlob(makeAnkiCsv(cards), `${baseName(doc.file?.name)}-flashcards.csv`);
  }, [result, doc.file]);

  const exportGift = useCallback(async () => {
    if (!result) return;
    const { makeGift } = await exporters();
    downloadBlob(makeGift(result.questions.map((q) => ({ ...q, answer: answerOf(q) }))), `${baseName(doc.file?.name)}-moodle.gift.txt`);
  }, [result, doc.file]);

  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(asMarkdown()); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  }, [asMarkdown]);

  if (doc.status === 'idle') return <AiDropzone doc={doc} prompt="Drop a PDF to make questions from it" hint="study notes, a textbook chapter, a report — or click to choose" />;

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <AiDocPanel doc={doc} />

        <section className="flex min-h-[440px] flex-col rounded-2xl border bg-card">
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <span className="flex size-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400"><HelpCircle className="size-4" /></span>
            <b className="text-sm">Generate questions</b>
            <CapChip remaining={result?.remaining ?? null} />
          </header>

          <div className="flex flex-wrap items-end gap-x-5 gap-y-3 border-b bg-muted/30 px-4 py-3.5">
            <Ctl label="Type">
              <Seg value={type} onChange={setType} disabled={busy}
                options={[{ v: 'mcq', label: 'Quiz (MCQ)' }, { v: 'tf', label: 'True/False' }, { v: 'blank', label: 'Fill-in-blank' }, { v: 'flash', label: 'Flashcards' }, { v: 'open', label: 'Open' }, { v: 'mixed', label: 'Mixed' }]} />
            </Ctl>
            <Ctl label="How many">
              <Seg value={count} onChange={setCount} disabled={busy}
                options={[{ v: '5', label: '5' }, { v: '10', label: '10' }, { v: '20', label: '20' }, { v: '30', label: '30' }]} />
            </Ctl>
            <Ctl label="Difficulty">
              <Seg value={difficulty} onChange={setDifficulty} disabled={busy}
                options={[{ v: 'easy', label: 'Easy' }, { v: 'mixed', label: 'Mixed' }, { v: 'hard', label: 'Hard' }]} />
            </Ctl>
            <Ctl label="Thinking level" uniq>
              <Seg value={bloom} onChange={setBloom} disabled={busy}
                options={[{ v: 'any', label: 'Any' }, { v: 'recall', label: 'Recall' }, { v: 'understand', label: 'Understand' }, { v: 'apply', label: 'Apply' }, { v: 'analyze', label: 'Analyze' }]} />
            </Ctl>
            <Ctl label="Explanations">
              <Toggle on={explain} onChange={setExplain} label="Why each answer is right" />
            </Ctl>
            <Button onClick={() => void run()} disabled={doc.status !== 'ready' || doc.noText || busy}
              className="ml-auto bg-violet-600 text-white hover:bg-violet-700">
              {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Play className="mr-1.5 size-4" />}
              {busy ? 'Generating…' : 'Generate'}
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
                <Loader2 className="size-4 animate-spin text-violet-500" /> Writing {count} questions from {doc.numPages} pages…
              </div>
            )}
            {result && result.questions.map((q, i) => (
              <div key={i} className="rounded-xl border bg-muted/30 p-3.5">
                <div className="flex flex-wrap items-baseline gap-2 text-sm font-semibold">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-violet-500/40 bg-violet-500/10 text-[11px] font-extrabold text-violet-600 dark:text-violet-400">{i + 1}</span>
                  <span className="min-w-0 flex-1">{q.q}</span>
                  <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 text-[9.5px] font-extrabold uppercase tracking-wide text-amber-700 dark:text-amber-400">{q.bloom}</span>
                  {q.page > 0 && (
                    <button onClick={() => doc.showPage(q.page - 1)}
                      className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-px text-[11px] font-semibold text-primary hover:bg-primary/20">p.{q.page}</button>
                  )}
                </div>
                {q.type === 'mcq' && q.options && (
                  <div className="ml-8 mt-2 grid gap-1 text-[13px]">
                    {q.options.map((o, j) => (
                      <span key={j} className={shown.has(i) && j === (q.answerIndex ?? 0) ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                        {LETTERS[j]}. {o}{shown.has(i) && j === (q.answerIndex ?? 0) ? ' ✓' : ''}
                      </span>
                    ))}
                  </div>
                )}
                <button onClick={() => toggle(i)} className="ml-8 mt-2 flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-400">
                  {shown.has(i) ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {shown.has(i) ? 'Hide answer' : 'Show answer'}
                </button>
                {shown.has(i) && (
                  <div className="ml-8 mt-1.5 text-[13px]">
                    {q.type !== 'mcq' && <p><b className="text-emerald-600 dark:text-emerald-400">Answer:</b> {q.answer}</p>}
                    {q.explanation && <p className="mt-0.5 italic text-muted-foreground">{q.explanation}</p>}
                  </div>
                )}
              </div>
            ))}
            {!result && !busy && !doc.noText && doc.status === 'ready' && (
              <p className="text-sm text-muted-foreground">Pick the question style above and hit <b>Generate</b>. Every question carries the page its answer comes from.</p>
            )}
          </div>

          {result && (
            <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
              <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground/70">Export</span>
              <Button size="sm" onClick={() => void exportPdf()} className="bg-violet-600 text-white hover:bg-violet-700"><Download className="mr-1 size-3.5" /> Quiz sheet (PDF)</Button>
              <Button size="sm" variant="outline" onClick={() => void exportDocx()}>Word</Button>
              <Button size="sm" variant="outline" onClick={() => void exportAnki()}>Anki / Quizlet</Button>
              <Button size="sm" variant="outline" onClick={() => void exportGift()}>Moodle GIFT</Button>
              <Button size="sm" variant="outline" onClick={() => downloadText(asMarkdown(), `${baseName(doc.file?.name)}-questions.md`, 'text/markdown')}>Markdown</Button>
              <Button size="sm" variant="outline" onClick={() => void copy()}>{copied ? <Check className="mr-1 size-3.5" /> : <Copy className="mr-1 size-3.5" />}{copied ? 'Copied' : 'Copy'}</Button>
            </div>
          )}
        </section>
      </div>
      <AiPrivacyNote />
      <KeepGoing exclude="/pdf-question-generator" title="Do more, privately" />
    </div>
  );
}
