'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, X, Download, Loader2, ShieldCheck, ScanFace, Trash2, MapPin, Camera, Clock, Sparkles, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob as download } from '@/lib/download';
import { BigFileHint } from '@/components/app/big-file-hint';
import { KeepGoing } from '@/components/app/keep-going';
import { usePlan } from '@/lib/plan';
import { readMeta, detectFaces, exportCleanImage, type BlurRect, type MetaReport } from '@/lib/photo-privacy';

const MAX_W = 560, MAX_H = 620;

export function PhotoPrivacyTool() {
  const plan = usePlan();
  const isPro = plan === 'pro';
  const [file, setFile] = useState<File | null>(null);
  const [bmp, setBmp] = useState<ImageBitmap | null>(null);
  const [srcUrl, setSrcUrl] = useState('');
  const [meta, setMeta] = useState<MetaReport | null>(null);
  const [boxes, setBoxes] = useState<BlurRect[]>([]);
  const [busy, setBusy] = useState(false);
  const [proNote, setProNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ url: string; blob: Blob; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const draw = useRef<{ x0: number; y0: number } | null>(null);
  const [ghost, setGhost] = useState<BlurRect | null>(null);

  useEffect(() => () => { if (done) URL.revokeObjectURL(done.url); }, [done]);
  useEffect(() => () => { bmp?.close?.(); }, [bmp]);

  const disp = bmp ? (() => { const s = Math.min(MAX_W / bmp.width, MAX_H / bmp.height, 1); return { w: bmp.width * s, h: bmp.height * s }; })() : null;

  async function loadFile(f?: File) {
    if (!f) return;
    if (!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)) { setError('Please choose a photo (JPG, PNG, or WebP).'); return; }
    setError(null); setDone(null); setBoxes([]);
    try {
      const b = await createImageBitmap(f);
      setSrcUrl((u) => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(f); });
      setBmp(b); setFile(f); setMeta(await readMeta(f));
    } catch { setError('Could not read that photo.'); }
  }

  function pt(e: React.PointerEvent) {
    const r = (stageRef.current as HTMLElement).getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  }
  function onDown(e: React.PointerEvent) {
    if (done) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = pt(e); draw.current = { x0: p.x, y0: p.y }; setGhost({ x: p.x, y: p.y, w: 0, h: 0 });
  }
  function onMove(e: React.PointerEvent) {
    if (!draw.current) return;
    const p = pt(e);
    setGhost({ x: Math.min(draw.current.x0, p.x), y: Math.min(draw.current.y0, p.y), w: Math.abs(p.x - draw.current.x0), h: Math.abs(p.y - draw.current.y0) });
  }
  function onUp() {
    if (ghost && ghost.w > 0.02 && ghost.h > 0.02) setBoxes((b) => [...b, ghost]);
    draw.current = null; setGhost(null);
  }

  async function autoBlur() {
    if (!isPro) { setProNote(true); return; }
    if (!bmp) return;
    setBusy(true);
    const faces = await detectFaces(bmp);
    setBusy(false);
    if (!faces.length) { setError('No faces detected. Draw a box over anything you want blurred.'); return; }
    setError(null); setBoxes((b) => [...b, ...faces]);
  }

  async function exportPhoto() {
    if (!bmp || !file) return;
    setBusy(true); setError(null);
    try {
      const blob = await exportCleanImage(bmp, boxes);
      const url = URL.createObjectURL(blob);
      setDone((d) => { if (d) URL.revokeObjectURL(d.url); return { url, blob, name: `${file.name.replace(/\.[^.]+$/, '')}-clean.jpg` }; });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not export the photo.'); } finally { setBusy(false); }
  }

  function reset() { setFile(null); setBmp(null); setMeta(null); setBoxes([]); setDone(null); setError(null); if (inputRef.current) inputRef.current.value = ''; }

  return (
    <div className="mx-auto max-w-2xl">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => loadFile(e.target.files?.[0])} />

      {!file ? (
        <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); loadFile(e.dataTransfer.files?.[0]); }}
          className="flex w-full flex-col items-center rounded-xl border-2 border-dashed bg-card px-6 py-12 text-center transition hover:border-primary/50 hover:bg-muted/30">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted"><ShieldCheck className="size-6 text-muted-foreground" /></span>
          <span className="mt-4 text-sm font-medium">Drop a photo here, or click to choose</span>
          <span className="mt-1 text-xs text-muted-foreground">Strip hidden GPS/device data + blur faces · on your device, never uploaded</span>
        </button>
      ) : (
        <>
          {meta && (
            <div className={`mb-3 rounded-lg border px-3 py-2.5 text-xs ${meta.hasExif ? 'border-red-500/30 bg-red-500/[0.06]' : 'border-emerald-500/30 bg-emerald-500/[0.06]'}`}>
              {meta.hasExif ? (
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-red-600 dark:text-red-400">Hidden data found:</b>
                  {meta.gps && <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5"><MapPin className="size-3" /> GPS location</span>}
                  {meta.camera && <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5"><Camera className="size-3" /> Device</span>}
                  {meta.date && <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5"><Clock className="size-3" /> Timestamp</span>}
                  <span className="text-muted-foreground">— all removed when you download.</span>
                </div>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400">No hidden metadata in this photo — the download stays clean too.</span>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-[1fr_190px]">
            <div>
              {disp && bmp ? (
                <div ref={stageRef} className="relative mx-auto touch-none select-none overflow-hidden rounded-lg border shadow-sm" style={{ width: disp.w, height: disp.h, cursor: done ? 'default' : 'crosshair' }}
                  onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={done ? done.url : srcUrl} alt="Photo" width={disp.w} height={disp.h} draggable={false} className="block" />
                  {!done && boxes.map((b, i) => (
                    <div key={i} className="absolute border border-primary/70" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`, backdropFilter: 'blur(7px)', background: 'rgba(120,130,150,.25)' }}>
                      <button onClick={(e) => { e.stopPropagation(); setBoxes((p) => p.filter((_, j) => j !== i)); }} className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-background text-[10px] shadow"><X className="size-2.5" /></button>
                    </div>
                  ))}
                  {ghost && <div className="absolute border border-primary bg-primary/20" style={{ left: `${ghost.x * 100}%`, top: `${ghost.y * 100}%`, width: `${ghost.w * 100}%`, height: `${ghost.h * 100}%` }} />}
                </div>
              ) : <div className="flex h-64 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}
              {!done && <p className="mt-2 text-center text-[11px] text-muted-foreground">Drag a box over any face, plate or text to blur it.</p>}
            </div>

            <div>
              {done ? (
                <div className="rounded-xl border bg-card p-3">
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">✓ Clean photo ready</p>
                  <p className="mt-1 text-xs text-muted-foreground">Metadata stripped{boxes.length ? ` · ${boxes.length} area${boxes.length === 1 ? '' : 's'} blurred` : ''}.</p>
                  <Button className="mt-3 w-full" onClick={() => download(done.blob, done.name)}><Download className="size-4" /> Download</Button>
                  <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => setDone(null)}>Back to editing</Button>
                  <Button variant="ghost" size="sm" className="w-full" onClick={reset}><Upload className="size-3.5" /> New photo</Button>
                </div>
              ) : (
                <>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Clean it up · <span className="text-emerald-600 dark:text-emerald-400">Free</span></p>
                  <div className="rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">Remove all metadata is <b className="text-foreground">always on</b> when you download.</div>
                  <div className="mt-2 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setBoxes([])} disabled={!boxes.length}><Trash2 className="size-3.5" /> Clear boxes</Button>
                  </div>

                  <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Do it for me · <span className="rounded bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-px text-[9px] font-bold uppercase text-white">Pro</span></p>
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={autoBlur} disabled={busy}>
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ScanFace className="size-3.5" />} Auto-blur faces{!isPro && <Sparkles className="ml-auto size-3 text-amber-500" />}
                  </Button>
                  <button type="button" onClick={() => !isPro && setProNote(true)} className="mt-1.5 flex w-full items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground">
                    <Layers className="size-3.5" /> Batch — scrub a folder {!isPro && <Sparkles className="ml-auto size-3 text-amber-500" />}
                  </button>
                  {proNote && !isPro && <p className="mt-1.5 text-[11px] text-muted-foreground">Auto-detect &amp; batch are <b className="text-foreground">Pro</b> — <a href="/pricing" className="text-primary underline">see plans</a>.</p>}

                  {file && <BigFileHint bytes={file.size} weight="light" />}
                  {error && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{error}</p>}

                  <Button className="mt-3 w-full" size="lg" onClick={exportPhoto} disabled={busy}>
                    {busy ? <><Loader2 className="size-4 animate-spin" /> Cleaning…</> : <><ShieldCheck className="size-4" /> Download clean photo</>}
                  </Button>
                  <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={reset}><X className="size-3.5" /> New photo</Button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      <KeepGoing />
    </div>
  );
}
