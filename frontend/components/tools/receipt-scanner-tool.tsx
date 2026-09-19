'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Camera, ImagePlus, Loader2, ScanLine, Check, Cloud, ReceiptText, Wallet, RotateCcw, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CATEGORIES, addExpense, budgetSignedIn, BudgetApiError } from '@/lib/budget-api';
import { ReceiptDetailPanel, type ReceiptDetail } from '@/components/tools/receipt-detail';
import { ReceiptPreview } from '@/components/tools/receipt-preview';
import { DocScanner, type ScannerCapture } from '@/components/tools/doc-scanner';

const API = process.env.NEXT_PUBLIC_API_URL || '';
type Parsed = ReceiptDetail & { merchant: string; total: number | null; date: string | null; category: string; text: string };

// The receipt states its own currency; our default was rupees, so a US Walmart
// slip showed its total against a ₹ sign.
const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥' };
const SYMBOLS = ['₹', '$', '€', '£', '¥'];

export function ReceiptScannerTool() {
  // 'preview' sits between picking a photo and reading it. A sideways receipt
  // used to go straight to the reader, and a reader that cannot make out a
  // receipt returns a plausible one rather than nothing — so the fix is partly
  // to straighten it and partly to let you see what is about to be read.
  const [phase, setPhase] = useState<'capture' | 'preview' | 'scanning' | 'review' | 'saved'>('capture');
  const [pending, setPending] = useState<File | null>(null);
  // The full-screen scanner is open. The same component /scan-to-pdf uses, so
  // a receipt gets the edge detection, the green outline and the perspective
  // correction that were already built and were sitting behind another tool.
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // editable fields after a scan
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  // What the scan actually came back with, so the review screen can say whether
  // a blank box means "we read nothing" or "you cleared it".
  const [scanFound, setScanFound] = useState<{ amount: boolean; merchant: boolean }>({ amount: false, merchant: false });
  const [category, setCategory] = useState('Other');
  const [date, setDate] = useState('');
  const [currency, setCurrency] = useState('₹');
  // Everything the receipt says beyond the single figure the Budget entry needs:
  // line items, tax lines, references, how it was paid.
  const [detail, setDetail] = useState<ReceiptDetail | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const scanBlob = useCallback(async (blob: Blob, wantCard = false) => {
    setPhase('scanning'); setError(null);
    try {
      const form = new FormData();
      form.append('image', blob, 'receipt.jpg');
      // Absent unless asked for, rather than sent and ignored.
      if (wantCard) form.append('cards', 'yes');
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
      setScanFound({ amount: p.total != null, merchant: !!p.merchant });
      setDetail(p);
      if (p.currency) {
        const sym = CURRENCY_SYMBOL[p.currency.toUpperCase()] || p.currency;
        if (SYMBOLS.includes(sym)) setCurrency(sym);
      }
      setPhase('review');
    } catch { setError('Could not reach the scanner — check your connection.'); setPhase('capture'); }
  }, []);

  /**
   * A capture from the full-screen scanner, turned back into the JPEG the
   * reader expects.
   *
   * The scanner hands over pixels that have already been straightened and cut
   * to the edges of the receipt, which matters more here than it does for a
   * PDF: the reader is charged per image and does better on a receipt filling
   * the frame than on a receipt lying in the middle of a table. When no edges
   * were found it hands over the whole frame instead — still a usable photo,
   * and the preview step is where that gets looked at.
   */
  const onScannerCapture = useCallback(({ data }: ScannerCapture) => {
    setScanning(false);
    const c = document.createElement('canvas');
    c.width = data.width; c.height = data.height;
    c.getContext('2d')!.putImageData(data, 0, 0);
    c.toBlob((b) => {
      if (b) { setPending(new File([b], 'receipt.jpg', { type: 'image/jpeg' })); setPhase('preview'); }
      c.width = c.height = 0;
    }, 'image/jpeg', 0.92);
  }, []);

  const save = useCallback(async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setError('Enter an amount greater than zero.'); return; }
    if (!budgetSignedIn()) { setError('Please sign in to save to your budget.'); return; }
    setError(null);
    try {
      // The breakdown goes WITH the expense. It used to be dropped here, so
      // an expense opened later was a bare total and everything the scan had
      // read — the line items, the tax lines, the reference numbers — was
      // gone. Extracting it and then discarding it is worse than not
      // extracting it: the work was done and the answer thrown away.
      await addExpense({
        amount: amt, category, description: merchant, merchant,
        date: date || new Date().toISOString().slice(0, 10),
        detail,
      });
      setPhase('saved');
    } catch (e) {
      if (e instanceof BudgetApiError && e.code === 'expense-cap') { setError('You’ve hit your monthly free expense limit — upgrade to Pro for unlimited.'); return; }
      setError(e instanceof BudgetApiError ? e.message : 'Could not save to your budget.');
    }
    // `detail` belongs in here with the rest: without it this callback keeps
    // whatever breakdown existed when it was last built, and a second scan in
    // the same session would file the first receipt's line items under the
    // second receipt's total.
  }, [amount, category, merchant, date, detail]);

  const reset = () => { setPhase('capture'); setPending(null); setMerchant(''); setAmount(''); setCategory('Other'); setDate(''); setError(null); setScanFound({ amount: false, merchant: false }); setDetail(null); };

  // What the review screen needs to say, derived from what the scan returned.
  const readNothing = !scanFound.amount && !scanFound.merchant;
  const missingFields = [!scanFound.amount && 'the amount', !scanFound.merchant && 'the store name'].filter(Boolean) as string[];

  return (
    <div>
      <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
        <Cloud className="mt-0.5 size-4 shrink-0" />
        <span>Reading a receipt needs our server (on-device OCR isn’t accurate enough for money). Your photo is scanned and <b>deleted immediately</b> — never stored. <Link href="/security#where-data-goes" target="_blank" className="underline">How we handle data</Link></span>
      </p>

      {phase === 'capture' && (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          {/* The camera is no longer a pane inside this card.
              "its showing only half screen" — it was: a 4:3 box capped at
              672px, so on a phone the receipt lived in the top third of the
              page with the privacy notice and two buttons around it, and a
              receipt is the one document shaped so that you need the height.
              It now opens the same full-screen scanner as /scan-to-pdf, which
              already finds the edges, draws them in green, straightens what it
              captures, and says what it is doing in the middle of the screen. */}
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <ReceiptText className="size-10 text-muted-foreground/70" />
            <p className="max-w-sm text-sm text-muted-foreground">
              Scan a receipt, or upload a photo. We’ll find its edges, straighten it, and pull out the amount, store and date.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t p-3">
            <Button size="sm" onClick={() => setScanning(true)} className="bg-primary text-primary-foreground"><Camera className="mr-1 size-4" /> Scan receipt</Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><ImagePlus className="mr-1 size-4" /> Upload photo</Button>
            {/* NO `capture` attribute. It forces the camera app instead of the
                file picker, so "Upload photo" opened the camera and gave you no
                way to reach a receipt already saved on the device — which is the
                normal case, since people photograph the receipt at the shop and
                deal with it later. Taking a picture live is what the camera
                button beside this is for. */}
            <input ref={fileRef} type="file" accept="image/*" aria-label="Choose an image file" className="dd-file-input" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPending(f); setPhase('preview'); } e.target.value = ''; }} />
          </div>
        </div>
      )}

      {phase === 'preview' && pending && (
        <ReceiptPreview
          file={pending}
          onScan={(blob, wantCard) => void scanBlob(blob, wantCard)}
          onCancel={() => { setPending(null); setPhase('capture'); }}
        />
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
          {/* The screen used to say "these are our best reads from the photo"
              over four empty boxes when the scan found nothing at all — so the
              only honest questions left were "did that work?" and "what now?",
              and the page answered neither. It now says which of the two
              happened, and what to do next in each case. */}
          {readNothing ? (
            <>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-500">
                <AlertTriangle className="size-4" /> We couldn’t read anything from that photo
              </div>
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  The scan ran, but no amount or store name came back. That is almost always the photo rather than the receipt:
                  a faded thermal till slip, glare from a flash, part of the receipt outside the frame, or a shot taken at an angle.
                  Flat, evenly lit, whole receipt in frame works best.
                </p>
                <p className="mt-2 text-xs font-medium">
                  Take another photo, or simply type the details in below — the form works either way.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><ScanLine className="size-4 text-primary" /> Check the details, then save</div>
              <p className="mb-4 text-xs text-muted-foreground">
                {missingFields.length > 0
                  ? `We read what we could. ${missingFields.join(' and ')} did not come through — add ${missingFields.length > 1 ? 'them' : 'it'} below. Nothing goes to your budget until you tap Save.`
                  : 'These are our best reads from the photo — correct anything before saving. Nothing goes to your budget until you tap Save.'}
              </p>
            </>
          )}
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
          {/* Everything else the receipt said. The Budget entry stays one
              expense — that is what a budget is — but discarding the line
              items, the tax breakdown and the reference numbers at the exact
              moment we have read them would be wasteful. This is what turns
              "an expense" into a record that stands up at tax time. */}
          {detail && (
            <ReceiptDetailPanel detail={detail} merchant={merchant} date={date} currency={currency} />
          )}

          {error && <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">{error}</p>}
          {/* When the scan read nothing, saving can only fail on an empty
              amount — so taking another photo leads, and saving stays available
              for anyone who would rather just type it in. */}
          <div className="mt-4 flex flex-wrap gap-2">
            {readNothing ? (
              <>
                <Button onClick={reset} className="bg-primary text-primary-foreground"><Camera className="mr-1.5 size-4" /> Try another photo</Button>
                <Button variant="outline" onClick={() => void save()}><Wallet className="mr-1.5 size-4" /> Save what I typed</Button>
              </>
            ) : (
              <>
                <Button onClick={() => void save()} className="bg-primary text-primary-foreground"><Wallet className="mr-1.5 size-4" /> Save to Budget</Button>
                <Button variant="outline" onClick={reset}><RotateCcw className="mr-1.5 size-4" /> Scan another</Button>
              </>
            )}
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

      {(phase === 'capture' || phase === 'preview') && error && <p className="mt-3 text-center text-sm text-amber-700 dark:text-amber-400">{error}</p>}

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-[13px] leading-relaxed text-foreground">
        <ReceiptText className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>Snap it, check it, save it — the scanned expense drops straight into your <Link href="/budget" className="font-semibold underline">Budget Tracker</Link>. The photo itself is never kept.</p>
      </div>

      {scanning && (
        <DocScanner
          onCapture={onScannerCapture}
          onClose={() => setScanning(false)}
          subject="Receipt"
          single
          pageCount={0}
          lastThumb={null}
        />
      )}
    </div>
  );
}
