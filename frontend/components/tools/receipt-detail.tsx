'use client';

import { useState } from 'react';
import { Check, AlertTriangle, ChevronDown, CreditCard, Hash, Download } from 'lucide-react';

// Everything the receipt says, beyond the one number that goes to the budget.
//
// The Budget entry stays a single expense — that is what a budget is — but the
// receipt itself holds a great deal more, and throwing it away at the moment we
// have read it is wasteful. Line items, tax lines, reference numbers: this is
// what turns "an expense" into "a record you can defend at tax time".
//
// Card details are OFF by default and the switch is per-scan. Nobody should have
// to opt OUT of us showing their card digits back to them; the last four are
// only useful when you are matching a receipt to a card statement, and that is a
// deliberate act. The server never returns more than four digits regardless.

export type ReceiptLine = { description: string; qty: number | null; unitPrice: number | null; amount: number | null };
export type LabelledAmount = { label: string; amount: number };
export type Payment = { method: string; amount: number | null; last4: string | null };
export type Identifier = { label: string; value: string };
export type Verified = { totalAddsUp: boolean | null; linesAddUp: boolean | null };

export type ReceiptDetail = {
  merchantAddress?: string | null;
  time?: string | null;
  currency?: string | null;
  lines: ReceiptLine[];
  subtotal: number | null;
  taxes: LabelledAmount[];
  discounts: LabelledAmount[];
  total: number | null;
  payments: Payment[];
  identifiers: Identifier[];
  verified: Verified;
  source?: 'vision' | 'ocr';
};

const fmt = (n: number | null, cur: string) =>
  n == null ? '—' : `${cur}${n.toFixed(2)}`;

/** CSV of the line items, for a spreadsheet or an expense claim. */
function toCsv(d: ReceiptDetail, merchant: string, date: string, cur: string, withCard: boolean) {
  const esc = (v: string | number | null) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows: (string | number | null)[][] = [
    ['Merchant', merchant],
    ['Date', date],
    ['Currency', cur],
    [],
    ['Description', 'Qty', 'Unit price', 'Amount'],
    ...d.lines.map((l) => [l.description, l.qty, l.unitPrice, l.amount]),
    [],
    ['Subtotal', '', '', d.subtotal],
    ...d.taxes.map((t) => [t.label, '', '', t.amount]),
    ...d.discounts.map((t) => [t.label, '', '', t.amount]),
    ['Total', '', '', d.total],
  ];
  if (withCard && d.payments.length) {
    rows.push([], ['Payment', 'Last 4', '', 'Amount']);
    for (const p of d.payments) rows.push([p.method, p.last4 ?? '', '', p.amount]);
  }
  if (d.identifiers.length) {
    rows.push([], ['Reference', 'Value']);
    for (const i of d.identifiers) rows.push([i.label, i.value]);
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

export function ReceiptDetailPanel({
  detail, merchant, date, currency,
}: { detail: ReceiptDetail; merchant: string; date: string; currency: string }) {
  const [open, setOpen] = useState(true);
  const [showCard, setShowCard] = useState(false);

  const cur = currency || detail.currency || '';
  const hasDetail = detail.lines.length > 0 || detail.taxes.length > 0 || detail.identifiers.length > 0 || detail.payments.length > 0;
  if (!hasDetail) return null;

  const { totalAddsUp, linesAddUp } = detail.verified;

  const download = () => {
    const csv = toCsv(detail, merchant, date, cur, showCard);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${(merchant || 'scan').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${date || 'undated'}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="mt-5 rounded-xl border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          Everything on the receipt
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {detail.lines.length} {detail.lines.length === 1 ? 'item' : 'items'}
          </span>
          {/* The arithmetic check, said out loud. Same idea as the statement
              converter: a figure the document proves beats one we read. */}
          {totalAddsUp === true && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="size-3" /> Totals check out
            </span>
          )}
          {totalAddsUp === false && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3" /> Total does not add up
            </span>
          )}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t px-4 py-4">
          {detail.lines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-1.5 pr-3 text-left font-medium">Item</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Qty</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Unit</th>
                    <th className="py-1.5 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {detail.lines.map((l, i) => (
                    <tr key={`${l.description}-${i}`} className="border-b border-border/50 last:border-0">
                      <td className="py-1.5 pr-3 text-foreground">{l.description || '—'}</td>
                      <td className="py-1.5 pr-3 text-right text-muted-foreground">{l.qty ?? ''}</td>
                      <td className="py-1.5 pr-3 text-right text-muted-foreground">{l.unitPrice == null ? '' : fmt(l.unitPrice, cur)}</td>
                      <td className="py-1.5 text-right font-medium">{fmt(l.amount, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {linesAddUp === false && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  The lines do not add up to the subtotal — an item may have been missed or misread. Worth a look before you file this.
                </p>
              )}
            </div>
          )}

          <dl className="mt-4 space-y-1 text-sm tabular-nums">
            {detail.subtotal != null && (
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{fmt(detail.subtotal, cur)}</dd></div>
            )}
            {detail.discounts.map((d, i) => (
              <div key={`d${i}`} className="flex justify-between"><dt className="text-muted-foreground">{d.label}</dt><dd>−{fmt(Math.abs(d.amount), cur)}</dd></div>
            ))}
            {detail.taxes.map((t, i) => (
              <div key={`t${i}`} className="flex justify-between"><dt className="text-muted-foreground">{t.label}</dt><dd>{fmt(t.amount, cur)}</dd></div>
            ))}
            {detail.total != null && (
              <div className="flex justify-between border-t pt-1.5 font-semibold"><dt>Total</dt><dd>{fmt(detail.total, cur)}</dd></div>
            )}
          </dl>

          {detail.identifiers.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Hash className="size-3.5" /> References
              </p>
              <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                {detail.identifiers.map((i, n) => (
                  <div key={`i${n}`} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{i.label}</dt>
                    <dd className="truncate font-medium tabular-nums">{i.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {detail.payments.length > 0 && (
            <div className="mt-4">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showCard}
                  onChange={(e) => setShowCard(e.target.checked)}
                  className="size-3.5 accent-[color:var(--primary)]"
                />
                <CreditCard className="size-3.5" /> Show how it was paid
              </label>
              {showCard ? (
                <dl className="mt-1.5 space-y-1 text-xs">
                  {detail.payments.map((pm, n) => (
                    <div key={`p${n}`} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">
                        {pm.method}{pm.last4 ? ` ···· ${pm.last4}` : ''}
                      </dt>
                      <dd className="font-medium tabular-nums">{fmt(pm.amount, cur)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Off by default. Only the last four digits are ever read — the full number is never sent to us or stored.
                </p>
              )}
            </div>
          )}

          <button
            onClick={download}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/60 hover:text-primary"
          >
            <Download className="size-3.5" /> Download as CSV
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            The CSV is built in your browser. Card details are included only while the switch above is on.
          </p>
        </div>
      )}
    </div>
  );
}
