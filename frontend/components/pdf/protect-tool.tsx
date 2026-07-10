'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2, Lock, Eye, EyeOff, CheckCircle2, Zap, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { UploadError, wrongTypeError, isWrongType } from '@/components/app/upload-error';
import { takeHandoff } from '@/lib/handoff';
import { runQpdf } from '@/lib/qpdf';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const inputCls = 'h-10 w-full rounded-lg border bg-background px-3 pr-10 text-sm outline-none focus:border-primary';

// Quick, honest strength hint — length matters most.
function strength(pw: string): { label: string; color: string; width: string } {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((r) => r.test(pw)).length;
  const score = Math.min(4, Math.floor(pw.length / 4) + (classes >= 3 ? 1 : 0));
  return [
    { label: 'Too short', color: 'bg-red-500', width: 'w-1/5' },
    { label: 'Weak', color: 'bg-orange-500', width: 'w-2/5' },
    { label: 'Okay', color: 'bg-amber-500', width: 'w-3/5' },
    { label: 'Good', color: 'bg-emerald-500', width: 'w-4/5' },
    { label: 'Strong', color: 'bg-emerald-600', width: 'w-full' },
  ][score];
}

export function ProtectTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [allowPrint, setAllowPrint] = useState(true);
  const [allowCopy, setAllowCopy] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError(wrongTypeError(f.name));
      return;
    }
    if (!canProcessSize(f.size, plan)) { setError(null); setTooBig({ name: f.name, size: f.size }); return; }
    setTooBig(null);
    setError(null);
    setDone(null);
    setFile(f);
  }
  function pick(files: FileList | null) { loadOne(files?.[0]); }

  useEffect(() => {
    const h = takeHandoff();
    const pdf = h?.files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (h && pdf) {
      setHandoffNote(`PDF brought straight over from ${h.from} — no re-upload needed.`);
      loadOne(pdf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    if (!file) return;
    if (pw.length < 4) { setError('Use a password of at least 4 characters (longer is stronger).'); return; }
    if (pw !== pw2) { setError('The passwords don’t match.'); return; }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const out = await runQpdf(file, { type: 'encrypt', password: pw, allowPrint, allowCopy });
      const name = `${file.name.replace(/\.pdf$/i, '')}-protected.pdf`;
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      download(blob, name);
      setDone({ blob, name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not protect the PDF.');
    } finally {
      setBusy(false);
    }
  }

  const s = strength(pw);

  return (
    <Card>
      <CardContent className="p-5">
        {handoffNote && (
          <p className="mb-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm text-foreground">
            <Zap className="size-4 shrink-0 text-primary" /> {handoffNote}
          </p>
        )}
        {tooBig ? (
          <UpgradeNotice fileName={tooBig.name} sizeText={fmtBytes(tooBig.size)} limitText={fmtBytes(FREE_MAX_BYTES)} onReset={() => { setTooBig(null); inputRef.current?.click(); }} />
        ) : !file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">AES-256 password protection — file and password never leave your device</p>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fmt(file.size)}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { setFile(null); setDone(null); setError(null); }}><X className="size-4" /></Button>
          </div>
        )}
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />

        {file && !done && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">Password</span>
                <span className="relative block">
                  <input className={inputCls} type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
                  <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </span>
                {pw && (
                  <span className="mt-1.5 block">
                    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <span className={`block h-full rounded-full transition-all ${s.color} ${s.width}`} />
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{s.label}</span>
                  </span>
                )}
              </label>
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">Repeat password</span>
                <input className={inputCls} type={show ? 'text' : 'password'} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
                {pw2 && pw !== pw2 && <span className="mt-1 block text-[11px] text-destructive">Doesn’t match yet</span>}
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
                <input type="checkbox" checked={allowPrint} onChange={(e) => setAllowPrint(e.target.checked)} className="accent-[hsl(var(--primary))]" />
                Allow printing
              </label>
              <label className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
                <input type="checkbox" checked={allowCopy} onChange={(e) => setAllowCopy(e.target.checked)} className="accent-[hsl(var(--primary))]" />
                Allow copying text
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Heads up: there’s no “forgot password” — we never see your password, so nobody (including us) can recover it. Keep it somewhere safe.
            </p>
          </div>
        )}

        {error && (isWrongType(error) ? <UploadError error={error} /> : (
          <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}{/already has a password|Unlock PDF/i.test(error) && <> <Link href="/unlock-pdf" className="font-medium underline">Open Unlock PDF</Link></>}
          </p>
        ))}

        {file && !done && (
          <Button className="mt-5 w-full" size="lg" onClick={run} disabled={busy || !pw || !pw2}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Encrypting…</> : <><Lock className="size-4" /> Protect &amp; download</>}
          </Button>
        )}

        {done && (
          <>
            <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Protected — {done.name} saved</p>
                <p className="text-xs text-muted-foreground">AES-256 encrypted · opens only with your password, in any PDF reader</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => download(done.blob, done.name)}><Download className="size-4" /> Again</Button>
            </div>
            <p className="mt-3 flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <span>Test it now: open the downloaded file — it should ask for your password before showing anything.</span>
            </p>
            {/* No "Keep moving" chain here on purpose: the output is encrypted,
                so other tools can't open it without the password. */}
            <KeepGoing exclude="/protect-pdf" />
          </>
        )}
      </CardContent>
    </Card>
  );
}
