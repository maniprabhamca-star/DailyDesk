import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { ReceiptScannerTool } from '@/components/tools/receipt-scanner-tool';

export const metadata: Metadata = {
  title: 'Receipt Scanner — Snap to Budget | DiemDesk',
  description: 'Photograph a receipt and it reads the amount, store and date — then saves straight to your budget. A Pro tool; the photo is scanned and deleted.',
  alternates: { canonical: '/receipt-scanner' },
  openGraph: { images: ['/og.png'], title: 'Receipt Scanner — snap a receipt into your budget', description: 'Reads the amount, store and date from a receipt photo and saves it to your budget. The photo is never kept.', type: 'website' },
};

const steps = [
  'Snap a receipt with your camera, or upload a photo.',
  'We read the amount, store and date — you check and correct anything.',
  'Save it and the expense lands in your Budget Tracker. The photo is deleted right away.',
];

const faqs = [
  { q: 'How accurate is it?', a: 'It reads clearly-printed receipts well and always shows you the amount, store and date to confirm before saving — we never commit a guessed number to your budget without your check. A crisp, well-lit photo of the whole receipt reads best.' },
  { q: 'Is my receipt photo stored?', a: 'No. Reading a receipt needs our server (on-device OCR isn’t accurate enough for money), so the photo is uploaded over an encrypted connection, scanned, and deleted immediately — never stored, never read by anyone.' },
  { q: 'Where does the expense go?', a: 'Straight into your Budget Tracker, so your monthly total and category breakdown update instantly.' },
  { q: 'Why is this a Pro feature?', a: 'It runs OCR on our server for every scan — a real running cost — so it’s part of Pro. The Budget Tracker itself is free.' },
];

export default function ReceiptScannerPage() {
  return (
    <PdfToolPage
      title="Receipt Scanner"
      description="Snap a receipt and it reads the amount, store and date — then drops the expense straight into your Budget Tracker. The photo is scanned on our server and deleted immediately."
      steps={steps}
      faqs={faqs}
      wide
    >
      <ReceiptScannerTool />
    </PdfToolPage>
  );
}
