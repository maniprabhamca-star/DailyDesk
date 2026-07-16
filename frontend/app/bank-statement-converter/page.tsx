import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { StatementConverterTool } from '@/components/tools/statement-converter-tool';

// Privacy leads the title and the H1 deliberately: for a bank statement it isn't a
// bonus feature, it's the reason to choose us — every competitor uploads the file.
export const metadata: Metadata = {
  title: 'Bank Statement to Excel — Private, In Your Browser | DiemDesk',
  description: 'Convert a bank statement PDF to Excel or CSV with every row checked against the running balance. Processed on your device — your statement is never uploaded.',
  alternates: { canonical: '/bank-statement-converter' },
  openGraph: {
    images: ['/og.png'],
    title: 'Bank Statement Converter — never uploaded',
    description: 'Statement PDF → verified transaction table → Excel/CSV. Processed entirely in your browser.',
    type: 'website',
  },
};

const steps = [
  'Drop your statement PDF in — it’s read on your device, and nothing is uploaded.',
  'We detect the bank, rebuild the transaction table, and check every row against the running balance.',
  'Review any flagged rows, then export to Excel or CSV (Tally XML coming next).',
];

const faqs = [
  { q: 'Is my bank statement uploaded?', a: 'No. It is read entirely in your browser — never uploaded, stored, or seen by us. You can verify it yourself: open DevTools → Network and watch zero requests leave while it converts. This is the difference between us and every other statement converter, which upload the most sensitive document you own to their servers.' },
  { q: 'How do I know the numbers are right?', a: 'Every row is checked against the running balance: each balance must recompute exactly from the row above it. If all rows reconcile, the extraction is arithmetically proven rather than guessed. Any row that does not reconcile is highlighted, showing what the balance should have been so you can fix it.' },
  { q: 'Which banks work?', a: 'It reads the layout rather than relying on a hard-coded template per bank, so most statements with a normal transaction table work — including formats we have never seen. We recognise the major Indian banks by their IFSC and letterhead to improve accuracy further.' },
  { q: 'What about scanned or password-protected statements?', a: 'A scanned statement has no selectable text — run it through OCR first. For password-protected e-statements, unlock it first; the password is used on your device and never sent anywhere.' },
  { q: 'Is this accounting or tax advice?', a: 'No. It is a conversion aid — always check the output before filing anything, and treat your bank’s own statement as the record. DiemDesk is not affiliated with, endorsed by, or connected to any bank; bank names are used only to describe which statement formats we read.' },
];

export default function BankStatementConverterPage() {
  return (
    <PdfToolPage
      title="Bank statement to Excel — without uploading it"
      description="Turn a statement PDF into a clean transaction table where every row is verified against the running balance, then export to Excel or CSV. Read entirely on your device — the one document you should never upload."
      steps={steps}
      faqs={faqs}
      wide
    >
      <StatementConverterTool />
    </PdfToolPage>
  );
}
