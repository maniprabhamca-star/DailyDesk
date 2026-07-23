'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload, FileText, Loader2, Play, Pause, Square, X, Volume2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { extractSpeechText } from '@/lib/pdf-speech';
import { splitSegments } from '@/lib/speech-core';

type Seg = { text: string; page: number };

export function PdfToAudioTool() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'ready' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<Seg[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>('');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const stopRef = useRef(false);
  const activeRef = useRef<HTMLSpanElement | null>(null);

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Load the browser's voices (populated asynchronously in some browsers).
  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const vs = window.speechSynthesis.getVoices();
      if (vs.length) {
        setVoices(vs);
        setVoiceURI((cur) => cur || (vs.find((v) => v.default) || vs.find((v) => /^en/i.test(v.lang)) || vs[0]).voiceURI);
      }
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [supported]);

  // Stop speech if the component unmounts or the tab is closed.
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);

  const voice = useMemo(() => voices.find((v) => v.voiceURI === voiceURI) || null, [voices, voiceURI]);

  const run = useCallback(async (f?: File) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setError('Please choose a PDF.'); return; }
    setFile(f); setStatus('working'); setError(null);
    try {
      const { pages, hasText } = await extractSpeechText(f);
      if (!hasText) { setStatus('failed'); setError('scanned'); return; }
      const segs: Seg[] = [];
      pages.forEach((text, p) => splitSegments(text).forEach((t) => segs.push({ text: t, page: p + 1 })));
      setSegments(segs); setNumPages(pages.length); setIndex(0); setStatus('ready');
    } catch {
      setStatus('failed'); setError('read');
    }
  }, []);

  // Speak segment `i`, then chain to the next unless stopped.
  const speakFrom = useCallback((i: number) => {
    if (!supported || i >= segments.length) { setPlaying(false); setPaused(false); return; }
    const u = new SpeechSynthesisUtterance(segments[i].text);
    if (voice) u.voice = voice;
    u.rate = rate; u.pitch = pitch;
    u.onstart = () => setIndex(i);
    u.onend = () => { if (!stopRef.current) speakFrom(i + 1); };
    window.speechSynthesis.speak(u);
  }, [supported, segments, voice, rate, pitch]);

  const play = useCallback(() => {
    if (!supported || !segments.length) return;
    if (paused) { window.speechSynthesis.resume(); setPaused(false); setPlaying(true); return; }
    stopRef.current = true; window.speechSynthesis.cancel();
    stopRef.current = false; setPlaying(true); setPaused(false);
    speakFrom(index);
  }, [supported, segments, paused, index, speakFrom]);

  const pause = () => { if (!supported) return; window.speechSynthesis.pause(); setPaused(true); };
  const stop = () => { if (!supported) return; stopRef.current = true; window.speechSynthesis.cancel(); setPlaying(false); setPaused(false); setIndex(0); };

  const jump = (i: number) => {
    setIndex(i);
    if (playing) { stopRef.current = true; window.speechSynthesis.cancel(); stopRef.current = false; setPaused(false); speakFrom(i); }
  };

  // Re-start from the current segment when voice/rate/pitch changes mid-read so the
  // new setting takes effect immediately.
  const restartIfPlaying = () => {
    if (playing && !paused) { stopRef.current = true; window.speechSynthesis.cancel(); stopRef.current = false; speakFrom(index); }
  };

  // Keep the segment being read in view.
  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [index]);

  const reset = () => { stop(); setFile(null); setStatus('idle'); setSegments([]); setError(null); };

  if (status === 'idle') {
    return (
      <div>
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void run(e.dataTransfer.files?.[0]); }}
          className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center transition hover:border-primary/50 hover:bg-primary/5"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Upload className="size-6" /></span>
          <span className="mt-4 text-base font-semibold">Drop a PDF to have it read aloud</span>
          <span className="mt-1 text-sm text-muted-foreground">pick a voice and pace, follow the highlight — all in your browser, never uploaded</span>
          <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
        </button>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { void run(e.target.files?.[0]); e.target.value = ''; }} />
        {error && error !== 'scanned' && error !== 'read' && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
        {!supported && <p className="mt-3 text-center text-sm text-amber-600 dark:text-amber-400">Your browser doesn’t support read-aloud. Try the latest Chrome, Edge or Safari.</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-2xl border bg-card shadow-soft">
        <div className="flex items-center gap-3 border-b p-4">
          <FileText className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={file?.name}>{file?.name}</span>
          <button onClick={reset} aria-label="Remove file" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        {status === 'working' && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="text-sm font-medium">Reading the document…</p>
            <p className="text-xs text-muted-foreground">Extracting text on your device — nothing is uploaded.</p>
          </div>
        )}

        {status === 'failed' && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400"><AlertTriangle className="size-7" /></span>
            <p className="text-base font-bold">{error === 'scanned' ? 'This looks like a scanned PDF' : 'Couldn’t read this PDF'}</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {error === 'scanned'
                ? <>There’s no selectable text to read — it’s an image of a page. Run it through <a href="/ocr-pdf" className="font-semibold text-primary hover:underline">OCR</a> first to add a text layer, then come back.</>
                : 'It may be password-protected or damaged. Try another PDF.'}
            </p>
            <Button variant="outline" onClick={reset} className="mt-2">Try another PDF</Button>
          </div>
        )}

        {status === 'ready' && (
          <div className="p-4">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {!playing || paused ? (
                <Button onClick={play} className="bg-[#0891b2] text-white hover:bg-[#0891b2]/90"><Play className="mr-1.5 size-4" /> {paused ? 'Resume' : 'Play'}</Button>
              ) : (
                <Button onClick={pause} className="bg-[#0891b2] text-white hover:bg-[#0891b2]/90"><Pause className="mr-1.5 size-4" /> Pause</Button>
              )}
              <Button variant="outline" onClick={stop} disabled={!playing && index === 0}><Square className="mr-1.5 size-4" /> Stop</Button>
              <span className="ml-auto text-xs text-muted-foreground">Page {segments[index]?.page || 1} of {numPages}</span>
            </div>

            {/* Voice + sliders */}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Voice</span>
                <select value={voiceURI} onChange={(e) => { setVoiceURI(e.target.value); restartIfPlaying(); }} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
                  {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                  {!voices.length && <option>Default</option>}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Speed <span className="font-mono">{rate.toFixed(1)}×</span></span>
                <input type="range" min={0.5} max={2} step={0.1} value={rate} onChange={(e) => setRate(+e.target.value)} onMouseUp={restartIfPlaying} onTouchEnd={restartIfPlaying} className="w-full accent-[#0891b2]" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Pitch <span className="font-mono">{pitch.toFixed(1)}</span></span>
                <input type="range" min={0.5} max={1.5} step={0.1} value={pitch} onChange={(e) => setPitch(+e.target.value)} onMouseUp={restartIfPlaying} onTouchEnd={restartIfPlaying} className="w-full accent-[#0891b2]" />
              </label>
            </div>

            {/* Follow-along text */}
            <div className="mt-4 max-h-[360px] overflow-auto rounded-xl border bg-background p-4 text-[15px] leading-8">
              {segments.map((s, i) => (
                <span
                  key={i}
                  ref={i === index ? activeRef : null}
                  onClick={() => jump(i)}
                  className={`cursor-pointer rounded px-0.5 transition ${i === index ? 'bg-[#0891b2]/20 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {s.text}{' '}
                </span>
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">Tap any sentence to jump there. A downloadable MP3 is coming with Pro.</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p><b>Read on your device.</b> The PDF’s text is extracted in your browser and spoken by your device’s own voice engine — nothing is uploaded or sent to any server.</p>
      </div>
    </div>
  );
}
