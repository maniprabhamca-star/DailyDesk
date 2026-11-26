import type { Metadata } from 'next';
import Link from 'next/link';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { StatementConverterTool } from '@/components/tools/statement-converter-tool';
import { BANK_PAGES } from '@/lib/bank-statements';

// Privacy leads the title and the H1 deliberately: for a bank statement it isn't a
// bonus feature, it's the reason to choose us — every competitor uploads the file.
export const metadata: Metadata = {
  title: 'Bank Statement to Excel — In Your Browser | DiemDesk',
  description: 'Convert a bank statement PDF to Excel, CSV, Tally XML, OFX or QuickBooks .qbo, every row checked against the running balance. Processed on your device — never uploaded.',
  alternates: { canonical: '/bank-statement-converter' },
  // Gated (coming_soon): a thin "coming soon" page must not be indexed — it
  // would rank, convert nobody, and have to earn its way back after launch.
  // Remove this line the day the tool un-gates.
  robots: { index: false, follow: true },
  openGraph: {
    images: ['/og.png'],
    title: 'Bank Statement Converter — never uploaded',
    description: 'Statement PDF → verified transaction table → Excel, CSV, Tally, OFX or QuickBooks. Processed entirely in your browser.',
    type: 'website',
  },
};

const steps = [
  'Drop your statement PDF in — it’s read on your device, and nothing is uploaded.',
  'We detect the bank, rebuild the transaction table, and check every row against the running balance.',
  'Review any flagged rows, then export: Excel, CSV, Tally XML, OFX, or a QuickBooks .qbo.',
];

const faqs = [
  { q: 'Is my bank statement uploaded?', a: 'No. It is read entirely in your browser — never uploaded, stored, or seen by us. You can verify it yourself: open DevTools → Network and watch zero requests leave while it converts. This is the difference between us and every other statement converter, which upload the most sensitive document you own to their servers.' },
  { q: 'How do I know the numbers are right?', a: 'Every row is checked against the running balance: each balance must recompute exactly from the row above it. If all rows reconcile, the extraction is arithmetically proven rather than guessed. Any row that does not reconcile is highlighted, showing what the balance should have been so you can fix it.' },
  { q: 'Which banks work?', a: 'It reads the layout rather than relying on a hard-coded template per bank, so most statements with a normal transaction table work — including formats we have never seen. We recognise the major Indian banks by their IFSC and letterhead to improve accuracy further.' },
  { q: 'Why does the .qbo export ask me for an id?', a: 'A .qbo file carries the Intuit institution id of the bank it came from, and QuickBooks checks it. Other converters default that field to some real bank’s id so the button always works — which files your statement under a bank it did not come from. We will not do that, so you supply your own: open a .qbo your bank gives you in a text editor and copy the number after INTU.BID. Most Indian banks are not in Intuit’s directory at all; if yours is one of them, export OFX, Excel or Tally instead — QuickBooks Online, Xero and Zoho Books all read OFX.' },
  { q: 'What about scanned or password-protected statements?', a: 'A scanned statement has no selectable text — run it through OCR first. For password-protected e-statements, unlock it first; the password is used on your device and never sent anywhere.' },
  { q: 'Is this accounting or tax advice?', a: 'No. It is a conversion aid — always check the output before filing anything, and treat your bank’s own statement as the record. DiemDesk is not affiliated with, endorsed by, or connected to any bank; bank names are used only to describe which statement formats we read.' },
];

// The three pages that describe what comes OUT of the converter. They also had
// no inbound link from anywhere, and the converter's own page is where they
// belong.
const EXPORT_PAGES: [string, string][] = [
  ['/bank-statement-to-tally', 'Statement to Tally XML'],
  ['/bank-statement-to-quickbooks', 'Statement to QuickBooks'],
  ['/bank-statement-to-csv', 'Statement to CSV'],
];

// Every bank page, and those three export-format pages, in one block.
//
// ⚠⚠ THIS IS PASSED AS `afterTool`, NOT AS A CHILD, AND THAT MATTERS.
// ToolGate wraps only PdfToolPage's `children`, and this tool is
// `coming_soon`, so an index placed inside it renders for nobody: the public
// page shows "Coming soon" and emits zero anchors. The first version of this
// block was a child, and the link audit still reported all 38 bank pages at
// zero inbound links afterwards — which is how it was caught. `afterTool`
// renders outside the gate. tests/unit/bank-links.test.ts pins it there.
//
// ⚠ Why the index exists at all: on 2026-11-25 an internal-link audit found
// every one of these pages with no inbound link from anywhere on the site,
// while being the best-ranking family we have — sbi-card at position 2.4,
// bandhan 6.5, rbl 7.0, amex-india 8.0, axis 8.7, phonepe-statement 8.7. The
// hub listed none of them, and because the hub is `soon: true` in the
// catalogue the Tools menu renders it as plain text with no anchor either.
//
// This page is `robots: index:false, follow:true` while the tool is gated, so
// it passes no indexing signal of its own — but `follow` means a crawler that
// reaches it walks these links, and a reader who lands here can get to their
// own bank. The load-bearing half is the rotating sibling block on the bank
// pages themselves, which ARE indexed; this is the completeness half.
function BankIndex() {
  return (
    <section className="mt-12 border-t pt-8">
      <h2 className="text-xl font-bold tracking-tight">Written up bank by bank</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        The converter reads a statement&rsquo;s layout rather than a per-bank template, so a bank
        that is not listed here usually works anyway. These {BANK_PAGES.length} have a page of
        their own — where to download the PDF, the password format that bank uses, and the column
        quirk we handle for it.
      </p>
      <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
        {BANK_PAGES.map((b) => (
          <li key={b.slug}>
            <Link
              href={`/bank-statement-converter/${b.slug}`}
              className="block truncate text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
              title={b.name}
            >
              {b.short} statement
            </Link>
          </li>
        ))}
      </ul>

      {/* These three also had no inbound link from anywhere. They describe
          what comes OUT of the converter, so the converter's own page is
          where they belong. */}
      <h3 className="mt-8 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Where the rows end up
      </h3>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {EXPORT_PAGES.map(([href, label]) => (
          <li key={href}>
            <Link
              href={href}
              className="text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}


export default function BankStatementConverterPage() {
  return (
    <PdfToolPage
      title="Bank statement to Excel — without uploading it"
      description="Turn a statement PDF into a clean transaction table where every row is verified against the running balance, then export it to Excel, CSV, Tally, OFX or QuickBooks. Read entirely on your device — the one document you should never upload."
      steps={steps}
      faqs={faqs}
      wide
      afterTool={<BankIndex />}
    >
      <StatementConverterTool />
    </PdfToolPage>
  );
}
