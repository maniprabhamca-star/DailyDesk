'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Camera, ImagePlus, Loader2, ScanLine, Check, X, Cloud, CameraOff, ReceiptText, Wallet, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CATEGORIES, addExpense, budgetSignedIn, BudgetApiError } from '@/lib/budget-api';

const API = process.env.NEXT_PUBLIC_API_URL || '';
type Parsed = { merchant: string; total: number | null; date: string | null; category: string; text: string };

export function ReceiptScannerTool() {
  const [phase, setPhase] = useState<'capture' | 'scanning' | 'review' | 'saved'>('capture');
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // editable fields after a scan
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [date, setDate] = useState('');
  const [currency, setCurrency] = useState('₹');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stopCam = useCallback(() => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setCamOn(false); }, []);

  const startCam = useCallback(async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 2000 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      setCamOn(true);
    } catch { setCamError('No camera available — use “Upload photo” instead.'); }
  }, []);

  const scanBlob = useCallback(async (blob: Blob) => {
    setPhase('scanning'); setError(null);
    try {
      const form = new FormData();
      form.append('image', blob, 'receipt.jpg');
      const token = typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null;
      const res = await fetch(`${API}/api/receipts/scan`, { method: 'POST', body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error === 'pro-required' ? "The Receipt Scanner is a Pro feature — it's coming with Pro."
          : data.error === 'auth' ? 'Please sign in to use the Receipt Scanner.'
          : String(data.message || 'Could not scan this receipt.'));
        setPhase('capture');
        return;
      }
      const p = data as Parsed;
      setMerchant(p.merchant || '');
      setAmount(p.total != null ? String(p.total) : '');
      setCategory(CATEGORIES.includes(p.category as (typeof CATEGORIES)[number]) ? p.category : 'Other');
      setDate(p.date || new Date().toISOString().slice(0, 10));
      setPhase('review');
    } catch { setError('Could not reach the scanner — check your connection.'); setPhase('capture'); }
  }, []);

  const capture = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    stopCam();
    c.toBlob((b) => { if (b) void scanBlob(b); c.width = c.height = 0; }, 'image/jpeg', 0.9);
  }, [scanBlob, stopCam]);

  const save = useCallback(async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setError('Enter an amount greater than zero.'); return; }
    if (!budgetSignedIn()) { setError('Please sign in to save to your budget.'); return; }
    setError(null);
    try {
      await addExpense({ amount: amt, category, description: merchant, merchant, date: date || new Date().toISOString().slice(0, 10) });
      setPhase('saved');
    } catch (e) {
      if (e instanceof BudgetApiError && e.code === 'expense-cap') { setError('You’ve hit your monthly free expense limit — upgrade to Pro for unlimited.'); return; }
      setError(e instanceof BudgetApiError ? e.message : 'Could not save to your budget.');
    }
  }, [amount, category, merchant, date]);

  const reset = () => { setPhase('capture'); setMerchant(''); setAmount(''); setCategory('Other'); setDate(''); setError(null); };

  return (
    <div>
      <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
        <Cloud className="mt-0.5 size-4 shrink-0" />
        <span>Reading a receipt needs our server (on-device OCR isn’t accurate enough for money). Your photo is scanned and <b>deleted immediately</b> — never stored. <Link href="/security#where-data-goes" target="_blank" className="underline">How we handle data</Link></span>
      </p>

      {phase === 'capture' && (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <div className="relative aspect-[4/3] bg-black">
            {camOn ? <video ref={videoRef} playsInline muted className="size-full object-contain" />
              : (
                <div className="flex size-full flex-col items-center justify-center gap-3 text-center text-slate-300">
                  <ReceiptText className="size-10 opacity-70" />
                  <p className="text-sm">Snap a receipt, or upload a photo. We’ll pull out the amount, store and date.</p>
                  {camError && <p className="mx-6 flex items-center gap-1.5 text-xs text-amber-400"><CameraOff className="size-3.5" /> {camError}</p>}
                </div>
              )}
            {camOn && (
              <button onClick={capture} aria-label="Capture receipt"
                className="absolute bottom-4 left-1/2 flex size-16 -translate-x-1/2 items-center justify-center rounded-full border-4 border-white bg-white/20 backdrop-blur transition active:scale-95">
                <span className="size-11 rounded-full bg-white" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t p-3">
            {camOn ? <Button size="sm" variant="outline" onClick={stopCam}><CameraOff className="mr-1 size-4" /> Stop camera</Button>
              : <Button size="sm" onClick={() => void startCam()} className="bg-primary text-primary-foreground"><Camera className="mr-1 size-4" /> Use camera</Button>}
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><ImagePlus className="mr-1 size-4" /> Upload photo</Button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void scanBlob(f); e.target.value = ''; }} />
          </div>
        </div>
      )}

      {phase === 'scanning' && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card py-16 text-center">
          <Loader2 className="size-7 animate-spin text-primary" />
          <p className="text-sm font-medium">Reading your receipt…</p>
          <p className="text-xs text-muted-foreground">Pulling out the amount, store and date.</p>
        </div>
      )}

      {phase === 'review' && (
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><ScanLine className="size-4 text-primary" /> Check the details, then save</div>
          <p className="mb-4 text-xs text-muted-foreground">These are our best reads from the photo — correct anything before saving. Nothing goes to your budget until you tap Save.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted-foreground">Store / description</span>
              <input value={merchant} onChange={(e) => setMerchant(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary" /></label>
            <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted-foreground">Amount</span>
              <span className="flex">
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-l-lg border border-r-0 bg-background px-2 text-sm outline-none">{['₹', '$', '€', '£', '¥'].map((c) => <option key={c}>{c}</option>)}</select>
                <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" className="w-full rounded-r-lg border bg-background px-3 py-2 font-semibold outline-none focus:border-primary" />
              </span></label>
            <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted-foreground">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted-foreground">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary" /></label>
          </div>
          {error && <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">{error}</p>}
          <div className="mt-4 flex gap-2">
            <Button onClick={() => void save()} className="bg-primary text-primary-foreground"><Wallet className="mr-1.5 size-4" /> Save to Budget</Button>
            <Button variant="outline" onClick={reset}><RotateCcw className="mr-1.5 size-4" /> Scan another</Button>
          </div>
        </div>
      )}

      {phase === 'saved' && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card py-14 text-center shadow-soft">
          <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><Check className="size-7" /></span>
          <p className="text-lg font-bold">Saved to your budget</p>
          <p className="text-sm text-muted-foreground">{currency}{amount} · {category}{merchant ? ` · ${merchant}` : ''}</p>
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link href="/budget"><Wallet className="mr-1.5 size-4" /> Open Budget</Link></Button>
            <Button onClick={reset} className="bg-primary text-primary-foreground"><ScanLine className="mr-1.5 size-4" /> Scan another</Button>
          </div>
        </div>
      )}

      {phase === 'capture' && error && <p className="mt-3 text-center text-sm text-amber-700 dark:text-amber-400">{error}</p>}

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-[13px] leading-relaxed text-foreground">
        <ReceiptText className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>Snap it, check it, save it — the scanned expense drops straight into your <Link href="/budget" className="font-semibold underline">Budget Tracker</Link>. The photo itself is never kept.</p>
      </div>
    </div>
  );
}
