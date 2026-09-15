import { describe, it, expect } from 'vitest';
import { hasReceiptDetail } from '@/components/tools/receipt-detail';
import type { ReceiptDetail } from '@/components/tools/receipt-detail';

/**
 * The budget list offers a "Receipt" button on any expense that has a
 * breakdown behind it. ReceiptDetailPanel independently decides to render
 * nothing when there is no breakdown to show.
 *
 * Those two decisions must be the same decision, or a button appears that
 * opens onto an empty box — which is exactly the shape of the complaint that
 * started this work ("it shows only the plain total"), just moved one click
 * later. Both call hasReceiptDetail; this pins what it means.
 */

const base: ReceiptDetail = {
  lines: [], subtotal: null, taxes: [], discounts: [], total: null,
  payments: [], identifiers: [], verified: { totalAddsUp: null, linesAddUp: null },
};

describe('hasReceiptDetail', () => {
  it('says no to a missing breakdown', () => {
    expect(hasReceiptDetail(null)).toBe(false);
    expect(hasReceiptDetail(undefined)).toBe(false);
  });

  it('says no to a total with nothing behind it', () => {
    // The row already shows the amount. A breakdown that is only the amount
    // again is not worth a button.
    expect(hasReceiptDetail({ ...base, total: 441, subtotal: 420 })).toBe(false);
  });

  it('says no when only metadata survived the read', () => {
    expect(hasReceiptDetail({ ...base, currency: '₹', time: '18:42', merchantAddress: 'MG Road' })).toBe(false);
  });

  it('says yes to any of the four things it can actually show', () => {
    expect(hasReceiptDetail({ ...base, lines: [{ description: 'Tea', qty: 1, unitPrice: 8, amount: 8 }] })).toBe(true);
    expect(hasReceiptDetail({ ...base, taxes: [{ label: 'CGST', amount: 10.5 }] })).toBe(true);
    expect(hasReceiptDetail({ ...base, payments: [{ method: 'Card', amount: 441, last4: '4021' }] })).toBe(true);
    expect(hasReceiptDetail({ ...base, identifiers: [{ label: 'Bill No', value: '100234' }] })).toBe(true);
  });
});
