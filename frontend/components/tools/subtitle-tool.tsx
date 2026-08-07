'use client';

import { useMemo, useRef, useState } from 'react';
import { Upload, Captions, Download, AlertTriangle, X, ShieldCheck, Copy, Check, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import {
  detectFormat, formatTime, MIME, parseSubtitles, shiftCues, write, type Cue, type SubtitleFormat,
} from '@/lib/subtitles';

const LABEL: Record<SubtitleFormat, string> = { srt: '.srt', vtt: '.vtt', txt: 'Transcript .txt' };

export function SubtitleTool() {
  const [cues, setCues] = useState<Cue[] | null>(null);
  const [name, setName] = useState('subtitles');
  const [from, setFrom] = useState<SubtitleFormat>('srt');
  const [fmt, setFmt] = useState<SubtitleFormat>('vtt');
  const [shift, setShift] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'file' | 'paste'>('file');
  const [paste, setPaste] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function ingest(text: string, filename: string) {
    const parsed = parseSubtitles(text);
    if (!parsed.length) {
      setCues(null);
      setError('No subtitle cues in that file. An .srt or .vtt has lines like 00:00:01,000 --> 00:00:04,000 with the caption underneath.');
      return;
    }
    setFrom(detectFormat(text, filename));
    setFmt(detectFormat(text, filename) === 'vtt' ? 'srt' : 'vtt');
    setCues(parsed);
    setName(filename.replace(/\.[^.]+$/, '') || 'subtitles');
    setError(null);
  }

  async function pick(f?: File) {
    if (!f) return;
    ingest(await f.text(), f.name);
  }

  const shifted = useMemo(() => (cues ? shiftCues(cues, shift) : []), [cues, shift]);
  const output = useMemo(() => (cues ? write(shifted, fmt) : ''), [cues, shifted, fmt]);

  function save() {
    downloadBlob(new Blob([output], { type: MIME[fmt] }), `${name}.${fmt}`);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* blocked */ }
  }
  function reset() { setCues(null); setError(null); setPaste(''); setShift(0); }

  if (!cues) {
    return (
      <div>
        <div className="mb-3 inline-flex rounded-xl border p-0.5 text-xs">
          {([['file', 'Drop a file', Upload], ['paste', 'Paste subtitles', Code2]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => { setTab(id); setError(null); }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>

        {tab === 'file' ? (
          <button
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files?.[0]); }}
            className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center transition hover:border-primary/50 hover:bg-primary/5"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Upload className="size-6" /></span>
            <span className="mt-4 text-base font-semibold">Drop a subtitle file</span>
            <span className="mt-1 text-sm text-muted-foreground">.srt or .vtt — converted on your device, never uploaded</span>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose file</span>
          </button>
        ) : (
          <div className="rounded-2xl border bg-card p-4">
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)}
              placeholder={'1\n00:00:01,000 --> 00:00:04,000\nThe first caption goes here.'}
              className="h-44 w-full resize-y rounded-xl border bg-background p-3 font-mono text-xs outline-none focus:border-primary" />
            <div className="mt-3 flex justify-end">
              <button onClick={() => ingest(paste, 'subtitles.srt')} disabled={!paste.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40">
                <Captions className="size-4" /> Convert
              </button>
            </div>
          </div>
        )}

        <input ref={inputRef} type="file" accept=".srt,.vtt,.sbv,text/vtt,text/plain" className="dd-file-input" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-muted-foreground">{error}</p>
          </div>
        )}
        <PrivacyNote />
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-2xl border bg-card shadow-soft">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <Captions className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}.{from}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {cues.length} cues · {formatTime(shifted[shifted.length - 1]?.end ?? 0, 'srt').slice(0, 8)}
          </span>
          <button onClick={reset} aria-label="Start over" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        <div className="flex flex-wrap items-end gap-4 border-b px-4 py-3">
          <div>
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Convert to</span>
            <div className="inline-flex overflow-hidden rounded-lg border">
              {(['srt', 'vtt', 'txt'] as SubtitleFormat[]).map((f) => (
                <button key={f} onClick={() => setFmt(f)}
                  className={`px-3 py-1.5 text-xs font-semibold ${fmt === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  {LABEL[f]}
                </button>
              ))}
            </div>
          </div>
          {fmt !== 'txt' && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Shift timing</span>
              <div className="flex items-center gap-1.5">
                <input type="number" step="0.5" value={shift} onChange={(e) => setShift(Number(e.target.value) || 0)}
                  className="h-9 w-24 rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary" />
                <span className="text-xs text-muted-foreground">seconds</span>
              </div>
            </label>
          )}
          <p className="text-[11px] leading-snug text-muted-foreground">
            {fmt === 'txt'
              ? 'A clean transcript — timings and tags removed, sentences joined into paragraphs.'
              : shift
                ? `Every cue moves ${shift > 0 ? 'later' : 'earlier'} by ${Math.abs(shift)}s.`
                : 'Subtitles running ahead of the audio? Nudge them here.'}
          </p>
        </div>

        <pre className="max-h-[340px] overflow-auto whitespace-pre-wrap bg-muted/20 p-4 font-mono text-[12px] leading-relaxed">{output.slice(0, 12000)}{output.length > 12000 ? '\n…' : ''}</pre>

        <div className="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-4 py-3">
          <span className="text-xs text-muted-foreground">Converted in this tab — nothing uploaded.</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => void copy()} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
              {copied ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy</>}
            </button>
            <Button onClick={save} className="bg-primary text-primary-foreground">
              <Download className="mr-1.5 size-4" /> Download {LABEL[fmt]}
            </Button>
          </div>
        </div>
      </div>

      <PrivacyNote />
      <KeepGoing title="Do more, privately" />
    </div>
  );
}

function PrivacyNote() {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <p><b>Converted on your device.</b> Subtitle files carry the whole script of whatever they belong to — this one is parsed and rewritten in your browser, and never uploaded.</p>
    </div>
  );
}
