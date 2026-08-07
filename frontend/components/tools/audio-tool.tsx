'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Music, Loader2, Download, X, ShieldCheck, AlertTriangle, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { useFileHandoff } from '@/lib/file-handoff';
import {
  convertAudio, decodeAudio, clock, parseClock, MP3_BITRATES, MAX_MINUTES,
  type AudioFormat, type AudioOptions, type AudioResult, DEFAULT_AUDIO_OPTIONS,
} from '@/lib/audio-convert';

type Mode = 'extract' | 'convert';

const ACCEPT = 'audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.flac,.mp4,.mov,.webm,.mkv,.avi,.m4v';

export function AudioTool({ mode }: { mode: Mode }) {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState<'idle' | 'reading' | 'ready' | 'working' | 'done' | 'failed'>('idle');
  const [msg, setMsg] = useState('');
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AudioResult | null>(null);
  const [opts, setOpts] = useState<AudioOptions>({ ...DEFAULT_AUDIO_OPTIONS, format: mode === 'extract' ? 'mp3' : 'mp3' });
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const decoded = useRef<AudioBuffer | null>(null);

  const load = useCallback(async (f?: File) => {
    if (!f) return;
    setFile(f); setStatus('reading'); setError(null); setResult(null); setMsg('');
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const buf = await decodeAudio(f, setMsg, ac.signal);
      decoded.current = buf;
      setDuration(buf.duration);
      setStatus('ready');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') { setStatus('idle'); return; }
      setStatus('failed');
      setError('This browser couldn’t read the audio in that file. MP4, MOV, WebM, MP3, M4A, WAV, OGG and FLAC all work — a rarer codec may not.');
    } finally {
      setMsg('');
      abortRef.current = null;
    }
  }, []);

  useFileHandoff(load);
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const set = <K extends keyof AudioOptions>(k: K, v: AudioOptions[K]) => { setResult(null); setOpts((o) => ({ ...o, [k]: v })); };

  const trimmed = () => {
    const start = parseClock(startText);
    const end = parseClock(endText);
    const to = end > 0 ? Math.min(end, duration) : duration;
    return { start: Math.min(start, Math.max(0, to - 1)), end: end > 0 ? to : 0, seconds: Math.max(0, to - Math.min(start, to)) };
  };

  async function run() {
    if (!file) return;
    const t = trimmed();
    const ac = new AbortController();
    abortRef.current = ac;
    setStatus('working'); setError(null); setPct(0);
    try {
      const res = await convertAudio(file, { ...opts, trimStart: t.start, trimEnd: t.end }, {
        onMsg: setMsg,
        onProgress: (f2) => setPct(Math.round(f2 * 100)),
        signal: ac.signal,
      });
      setResult(res);
      setStatus('done');
      downloadBlob(res.blob, res.name);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') { setStatus('ready'); return; }
      setStatus('ready');
      setError(e instanceof Error ? e.message : 'Could not convert that file.');
    } finally {
      setMsg('');
      abortRef.current = null;
    }
  }

  function reset() {
    abortRef.current?.abort();
    decoded.current = null;
    setFile(null); setStatus('idle'); setResult(null); setError(null); setDuration(0);
    setStartText(''); setEndText('');
  }

  const fmt = (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);

  if (status === 'idle' || status === 'reading' || status === 'failed') {
    return (
      <div>
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void load(e.dataTransfer.files?.[0]); }}
          disabled={status === 'reading'}
          className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center transition hover:border-primary/50 hover:bg-primary/5 disabled:opacity-70"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            {status === 'reading' ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
          </span>
          <span className="mt-4 text-base font-semibold">
            {status === 'reading' ? (msg || 'Reading the audio…') : mode === 'extract' ? 'Drop a video to pull the audio out' : 'Drop an audio or video file'}
          </span>
          <span className="mt-1 text-sm text-muted-foreground">
            {mode === 'extract'
              ? 'MP4, MOV, WebM, MKV — the soundtrack comes out as MP3 or WAV, on your device'
              : 'M4A, AAC, OGG, FLAC, WAV, MP4 — converted to MP3 or WAV, on your device'}
          </span>
          <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose file</span>
        </button>
        <input ref={inputRef} type="file" accept={ACCEPT} aria-label="Choose a file" className="dd-file-input" onChange={(e) => { void load(e.target.files?.[0]); e.target.value = ''; }} />
        {status === 'failed' && error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-muted-foreground">{error}</p>
          </div>
        )}
        <PrivacyNote />
      </div>
    );
  }

  const t = trimmed();

  return (
    <div>
      <div className="rounded-2xl border bg-card shadow-soft">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <Music className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={file?.name}>{file?.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{clock(duration)} · {fmt(file?.size ?? 0)}</span>
          <button onClick={reset} aria-label="Remove file" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-background p-3.5">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Output</p>
            <div className="mb-3 inline-flex overflow-hidden rounded-lg border">
              {(['mp3', 'wav'] as AudioFormat[]).map((f) => (
                <button key={f} onClick={() => set('format', f)}
                  className={`px-3 py-1.5 text-xs font-semibold uppercase ${opts.format === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  {f}
                </button>
              ))}
            </div>
            {opts.format === 'mp3' ? (
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Quality</span>
                <select value={opts.kbps} onChange={(e) => set('kbps', Number(e.target.value))}
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:border-primary">
                  {MP3_BITRATES.map((b) => (
                    <option key={b} value={b}>{b} kbps{b === 192 ? ' — good for most things' : b === 320 ? ' — best' : b === 96 ? ' — speech, smallest' : ''}</option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-[11px] leading-snug text-muted-foreground">WAV is uncompressed — perfect quality, and a much larger file. Use it for editing, not for sending.</p>
            )}
            <label className="mt-3 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={opts.mono} onChange={(e) => set('mono', e.target.checked)} className="size-4 accent-primary" />
              Mono <span className="text-muted-foreground">— halves the size, right for speech</span>
            </label>
          </div>

          <div className="rounded-xl border bg-background p-3.5">
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Scissors className="size-3.5" /> Trim <span className="normal-case tracking-normal text-muted-foreground">(optional)</span>
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted-foreground">From</span>
                <input value={startText} onChange={(e) => { setResult(null); setStartText(e.target.value); }} placeholder="0:00"
                  className="h-9 w-24 rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted-foreground">To</span>
                <input value={endText} onChange={(e) => { setResult(null); setEndText(e.target.value); }} placeholder={clock(duration)}
                  className="h-9 w-24 rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary" />
              </label>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {t.seconds > 0 && t.seconds < duration - 0.5
                ? <>Keeping <b className="text-foreground">{clock(t.seconds)}</b> of {clock(duration)}.</>
                : <>Whole file. Type <span className="font-mono">1:30</span> to start there.</>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-4 py-3">
          {status === 'working' ? (
            <>
              <Loader2 className="size-4 animate-spin text-primary" />
              <span className="text-sm">{msg || 'Working'}{pct > 0 ? ` · ${pct}%` : '…'}</span>
              <button onClick={() => abortRef.current?.abort()} className="ml-auto rounded-xl border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-accent">Cancel</button>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">
                {duration > MAX_MINUTES * 60 ? `Longer than ${MAX_MINUTES} minutes — trim it first.` : 'Nothing is uploaded — this runs in your browser.'}
              </span>
              <Button onClick={() => void run()} className="ml-auto bg-primary text-primary-foreground">
                <Download className="mr-1.5 size-4" />
                {mode === 'extract' ? 'Extract' : 'Convert'} to {opts.format.toUpperCase()}
              </Button>
            </>
          )}
        </div>

        {error && <p className="border-t px-4 py-2.5 text-sm text-destructive">{error}</p>}

        {status === 'done' && result && (
          <div className="mx-4 mb-4 mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-4 py-3">
            <Music className="size-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm">
              <b>{result.name}</b> — {clock(result.seconds)} · {fmt(result.blob.size)} · {result.channels === 1 ? 'mono' : 'stereo'} {Math.round(result.sampleRate / 100) / 10} kHz
            </span>
            <button onClick={() => downloadBlob(result.blob, result.name)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
              <Download className="size-4" /> Download again
            </button>
          </div>
        )}
      </div>

      <PrivacyNote />
      {status === 'done' && <KeepGoing exclude={mode === 'extract' ? '/video-to-mp3' : '/audio-converter'} title="Do more, privately" />}
    </div>
  );
}

function PrivacyNote() {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <p><b>Converted on your device.</b> Your file is decoded and re-encoded in this browser tab — nothing is uploaded, which is unusual for audio and video tools.</p>
    </div>
  );
}
