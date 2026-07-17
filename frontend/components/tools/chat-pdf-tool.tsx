'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X, Loader2, Send, Sparkles, ShieldCheck, Lock, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openPdf, renderPage, dprTarget, type PdfHandle } from '@/lib/pdf-render';
import { extractChunks, retrieve, type Chunk } from '@/lib/pdf-chat';
import { useFileHandoff } from '@/lib/file-handoff';
import { KeepGoing } from '@/components/app/keep-going';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const STARTERS = [
  { label: 'Summarize it', q: 'Summarize this document in a few sentences.' },
  { label: 'Key points', q: 'What are the key points?' },
  { label: 'Any dates?', q: 'What are the important dates in this document?' },
  { label: 'Any amounts?', q: 'What amounts, totals or figures are mentioned?' },
];

type Msg = { role: 'user' | 'assistant'; content: string; pending?: boolean; error?: boolean };

// Turn "(p.3)" citations in an answer into clickable page chips.
function Answer({ text, onCite }: { text: string; onCite: (p: number) => void }) {
  const parts = text.split(/(\(p\.?\s*\d+\))/gi);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/\(p\.?\s*(\d+)\)/i);
        if (m) {
          return (
            <button key={i} onClick={() => onCite(Number(m[1]))}
              className="mx-0.5 inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-1.5 py-px align-baseline text-[11px] font-semibold text-primary hover:bg-primary/20">
              p.{m[1]}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function ChatPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [preview, setPreview] = useState<{ url: string; w: number; h: number } | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [status, setStatus] = useState<'idle' | 'reading' | 'ready'>('idle');
  const [readPct, setReadPct] = useState(0);
  const [noText, setNoText] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { handle?.destroy?.(); }, [handle]);
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight }); }, [msgs]);

  const showPage = useCallback(async (h: PdfHandle, idx: number) => {
    try {
      const img = await renderPage(h, Math.max(0, Math.min(idx, h.numPages - 1)), dprTarget(360, 2, 1000));
      setPreview({ url: img.url, w: img.w, h: img.h });
    } catch { /* ignore */ }
  }, []);

  const loadFile = useCallback(async (f?: File) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setError('Please choose a PDF.'); return; }
    setError(null); setNoText(false); setMsgs([]); setChunks([]); setRemaining(null);
    setStatus('reading'); setReadPct(0);
    try {
      const h = await openPdf(f);
      setHandle(h); setNumPages(h.numPages); setFile(f);
      void showPage(h, 0);
      const { chunks: cx, hasText } = await extractChunks(f, setReadPct);
      setChunks(cx);
      setNoText(!hasText);
      setStatus('ready');
      setMsgs([{ role: 'assistant', content: hasText
        ? `I've read **${f.name}** (${h.numPages} ${h.numPages === 1 ? 'page' : 'pages'}). Ask me anything — I'll point you to the page each answer comes from.`
        : `I opened **${f.name}**, but it has no selectable text — it looks like a scan. Run it through OCR first, then I can read it.` }]);
    } catch {
      setError('Could not open that PDF. It may be corrupt or password-protected.');
      setStatus('idle');
    }
  }, [showPage]);

  useFileHandoff(loadFile);

  const reset = () => {
    handle?.destroy?.();
    setFile(null); setHandle(null); setPreview(null); setChunks([]); setNumPages(0);
    setStatus('idle'); setMsgs([]); setInput(''); setNoText(false); setError(null); setRemaining(null);
  };

  const ask = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q || busy || status !== 'ready' || noText) return;
    setInput('');
    const history = msgs.filter((m) => !m.pending && !m.error).map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: 'user', content: q }, { role: 'assistant', content: '', pending: true }]);
    setBusy(true);
    try {
      const context = retrieve(chunks, q, 6, 6000);
      const token = typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null;
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ question: q, context, history: history.slice(-4) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error === 'coming-soon' ? "The AI assistant isn't switched on yet — it's coming with Pro."
          : data.error === 'pro-required' ? 'Chat with PDF is a Pro feature. Upgrade to ask your documents.'
          : data.message || 'The assistant is unavailable right now — please try again.';
        setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { role: 'assistant', content: msg, error: true } : x)));
        return;
      }
      if (typeof data.remaining === 'number') setRemaining(data.remaining);
      setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { role: 'assistant', content: data.answer || "I couldn't find that in the document." } : x)));
    } catch {
      setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { role: 'assistant', content: 'Network error — please try again.', error: true } : x)));
    } finally {
      setBusy(false);
    }
  }, [busy, status, noText, msgs, chunks]);

  const goToCited = useCallback((p: number) => { if (handle) void showPage(handle, p - 1); }, [handle, showPage]);

  // ---- empty state ---------------------------------------------------------
  if (status === 'idle') {
    return (
      <div>
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void loadFile(e.dataTransfer.files?.[0]); }}
          className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center transition hover:border-primary/50 hover:bg-primary/5"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Upload className="size-6" /></span>
          <span className="mt-4 text-base font-semibold">Drop a PDF to chat with it</span>
          <span className="mt-1 text-sm text-muted-foreground">or click to choose — it opens on your device, never uploaded</span>
        </button>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden"
          onChange={(e) => { void loadFile(e.target.files?.[0]); e.target.value = ''; }} />
        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
        <PrivacyNote />
      </div>
    );
  }

  // ---- loaded: document + chat --------------------------------------------
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        {/* document */}
        <aside className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="size-4 shrink-0 text-primary" />
            <span className="truncate" title={file?.name}>{file?.name}</span>
          </div>
          <div className="text-xs text-muted-foreground">{numPages} {numPages === 1 ? 'page' : 'pages'}</div>
          <div className="overflow-hidden rounded-lg border bg-muted/40">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt="Page preview" className="w-full object-contain" draggable={false} />
            ) : (
              <div className="flex aspect-[1/1.3] items-center justify-center text-muted-foreground/40"><Loader2 className="size-5 animate-spin" /></div>
            )}
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] leading-snug text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="mt-px size-3.5 shrink-0" />
            <span>Text read <b>on your device</b>. Only the snippets needed for your question go to the AI — never the file.</span>
          </div>
          <Button variant="outline" size="sm" onClick={reset} className="mt-auto"><X className="mr-1 size-3.5" /> New file</Button>
        </aside>

        {/* chat */}
        <section className="flex min-h-[440px] flex-col rounded-2xl border bg-card">
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <span className="flex size-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400"><Sparkles className="size-4" /></span>
            <b className="text-sm">Ask this document</b>
            {remaining != null && <span className="ml-auto rounded-full border bg-muted/40 px-2.5 py-0.5 text-[11px] text-muted-foreground">{remaining} left this month</span>}
          </header>

          <div ref={threadRef} className="flex-1 space-y-3.5 overflow-auto p-4" style={{ maxHeight: 360 }}>
            {status === 'reading' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Reading your document… {Math.round(readPct * 100)}%</div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${m.role === 'user' ? 'bg-primary/10 text-primary' : 'bg-violet-500/10 text-violet-600 dark:text-violet-400'}`}>
                  {m.role === 'user' ? 'You' : <Sparkles className="size-3.5" />}
                </span>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${m.role === 'user' ? 'bg-primary text-primary-foreground' : m.error ? 'border border-amber-500/40 bg-amber-500/10 text-foreground' : 'bg-muted/50'}`}>
                  {m.pending ? (
                    <span className="flex gap-1 py-1"><Dot /><Dot d={0.2} /><Dot d={0.4} /></span>
                  ) : m.role === 'assistant' && !m.error ? (
                    <RichText text={m.content} onCite={goToCited} />
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
          </div>

          {status === 'ready' && !noText && msgs.length <= 1 && (
            <div className="flex flex-wrap gap-2 px-4 pb-3">
              {STARTERS.map((s) => (
                <button key={s.label} onClick={() => void ask(s.q)}
                  className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium transition hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400">
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {noText ? (
            <div className="flex items-center gap-2 border-t px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-4 shrink-0" /> This PDF has no text layer. <a href="/ocr-pdf" className="font-semibold underline">Run OCR first →</a>
            </div>
          ) : (
            <div className="flex items-end gap-2 border-t p-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(input); } }}
                rows={1}
                placeholder={status === 'reading' ? 'Reading…' : 'Ask about this PDF…'}
                disabled={status !== 'ready' || busy}
                className="max-h-24 flex-1 resize-none rounded-xl border bg-muted/40 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 disabled:opacity-60"
              />
              <button onClick={() => void ask(input)} disabled={status !== 'ready' || busy || !input.trim()}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-40">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </div>
          )}
        </section>
      </div>
      <PrivacyNote />
      <KeepGoing exclude="/chat-pdf" title="Do more, privately" />
    </div>
  );
}

function RichText({ text, onCite }: { text: string; onCite: (p: number) => void }) {
  // Render **bold** and (p.N) citations; everything else is plain text.
  const bolded = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {bolded.map((seg, i) => {
        const b = seg.match(/^\*\*([^*]+)\*\*$/);
        if (b) return <b key={i}>{b[1]}</b>;
        return <Answer key={i} text={seg} onCite={onCite} />;
      })}
    </>
  );
}

function Dot({ d = 0 }: { d?: number }) {
  return <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/60" style={{ animationDelay: `${d}s` }} />;
}

function PrivacyNote() {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
      <Lock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p>
        <b>Straight talk on privacy:</b> AI is the one DiemDesk feature where something leaves your device. We read the PDF's
        text <b>in your browser</b>, then send only the <b>relevant snippets</b> — never the file — to our server, which asks
        Claude. We don't store it or train on it. Everything else on DiemDesk stays 100% on your device.
      </p>
    </div>
  );
}
