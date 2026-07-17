// Workflow-intent SEO pages for the Statement Converter — the "bank statement to
// Tally / QuickBooks / CSV" searches. These are OUTCOME-led (what the user wants to
// end up with) vs the bank pages which are SOURCE-led (which bank). Same converter,
// different high-intent keyword. See docs/designs/bank-statement-converter.md §5.2.

export type Workflow = {
  slug: string;
  target: string;      // "Tally", "QuickBooks", "CSV"
  short: string;       // title-budget-safe
  h1: string;
  lede: string;
  bullets: string[];
  intro: string;       // "what this does" paragraph
  steps: string[];     // outcome-specific how-to
  faqs: { q: string; a: string }[];
};

export const WORKFLOWS: Workflow[] = [
  {
    slug: 'bank-statement-to-tally',
    target: 'Tally', short: 'Tally',
    h1: 'Convert a bank statement to Tally',
    lede: 'Turn a bank statement PDF into a Tally Prime–ready import file — every transaction becomes a Payment or Receipt voucher, and every row is checked against the running balance first. It all happens in your browser; your statement is never uploaded.',
    bullets: [
      'Exports a Tally Prime <ENVELOPE> import file — vouchers, not just a spreadsheet',
      'Debits → Payment vouchers · Credits → Receipt vouchers (double-entry, balanced)',
      'Every row verified against the running balance before export',
      'Set your company, bank ledger and default contra ledger',
      'On your device — the statement never leaves your browser',
    ],
    intro: 'No competitor exports directly to Tally, yet nearly every Indian CA and small business runs it. DiemDesk reads the statement, verifies the transactions against the running balance, then builds a Tally-import XML you can load in a couple of clicks — instead of typing vouchers by hand.',
    steps: [
      'Download your statement PDF from net banking (each bank’s steps are on its page).',
      'Open the Bank Statement Converter and drop the PDF in — it’s read on your device.',
      'Check the transaction table (any row that doesn’t reconcile is flagged).',
      'Choose “Tally XML”, set your company + bank ledger names, and export.',
      'In Tally Prime: Gateway → Import → Vouchers → select the file.',
    ],
    faqs: [
      { q: 'How do I import a bank statement into Tally?', a: 'Convert the statement PDF to a Tally XML file here (choose the “Tally XML” export and set your company and bank ledger). Then in Tally Prime go to Gateway of Tally → Import → Vouchers and pick the file. Each transaction imports as a Payment or Receipt voucher.' },
      { q: 'Does it create Payment and Receipt vouchers?', a: 'Yes. Money leaving the bank becomes a Payment voucher (bank credited, contra debited); money coming in becomes a Receipt voucher (bank debited, contra credited). Both legs balance to zero, as Tally requires.' },
      { q: 'Do the ledgers need to exist in Tally already?', a: 'Yes — the bank ledger and the contra ledger you name must already exist in your Tally company, so the vouchers post to the right place.' },
      { q: 'Is my statement uploaded?', a: 'No. It’s read entirely in your browser and never uploaded, stored, or seen by us — which matters for a bank statement more than any other document.' },
    ],
  },
  {
    slug: 'bank-statement-to-quickbooks',
    target: 'QuickBooks', short: 'QuickBooks',
    h1: 'Convert a bank statement for QuickBooks',
    lede: 'Turn a bank statement PDF into a clean, balance-verified spreadsheet you can bring into QuickBooks — read entirely in your browser, never uploaded. Direct QBO/OFX export is on the way.',
    bullets: [
      'Clean Date / Description / Amount / Balance columns, verified against the running balance',
      'Export to Excel or CSV to import as bank transactions',
      'Handles Indian and Western number formats and Dr/Cr layouts',
      'QBO / OFX direct export coming next',
      'On your device — the statement never leaves your browser',
    ],
    intro: 'QuickBooks imports bank transactions from a spreadsheet or a QBO/OFX file. DiemDesk extracts your statement into a clean, arithmetically-verified table you can map straight into QuickBooks’ import — without uploading the most sensitive document you own to yet another server.',
    steps: [
      'Download your statement PDF from net banking.',
      'Open the Bank Statement Converter and drop the PDF in — it’s read on your device.',
      'Review the transaction table; fix any flagged row.',
      'Export to Excel or CSV.',
      'In QuickBooks: Banking → upload the file and map Date / Description / Amount.',
    ],
    faqs: [
      { q: 'Can I import a bank statement into QuickBooks from a PDF?', a: 'QuickBooks doesn’t import PDFs directly — convert the statement to a spreadsheet first. DiemDesk extracts a clean, balance-verified Date / Description / Amount table you can export to Excel or CSV and upload under Banking, mapping the columns as you go.' },
      { q: 'Will you support QBO / OFX directly?', a: 'Yes — direct QuickBooks Web Connect (QBO) and OFX export are planned so you can skip the column-mapping step entirely.' },
      { q: 'How accurate is the extraction?', a: 'Every row is checked against the running balance: each balance must recompute from the row above it. If it all reconciles the extraction is proven; any row that doesn’t is flagged for you to fix.' },
      { q: 'Is my statement uploaded?', a: 'No — it’s read in your browser and never uploaded. Open DevTools → Network and you’ll see zero requests leave your device.' },
    ],
  },
  {
    slug: 'bank-statement-to-csv',
    target: 'CSV', short: 'CSV',
    h1: 'Convert a bank statement to CSV',
    lede: 'Turn a bank statement PDF into a clean CSV — one row per transaction, every balance verified — ready for Excel, Google Sheets or any accounting tool. Read on your device; never uploaded.',
    bullets: [
      'One clean row per transaction: Date, Description, Debit, Credit, Balance',
      'Every row verified against the running balance',
      'UTF-8 CSV with proper quoting — opens correctly in Excel & Google Sheets',
      'Also exports Excel (.xlsx) and Tally XML',
      'On your device — the statement never leaves your browser',
    ],
    intro: 'A CSV is the universal format — it goes into Excel, Google Sheets, Zoho Books, or any importer. DiemDesk turns your statement into a tidy, correctly-quoted CSV where the numbers are already reconciled against the running balance, so you’re not cleaning up a mangled export by hand.',
    steps: [
      'Download your statement PDF from net banking.',
      'Open the Bank Statement Converter and drop the PDF in — it’s read on your device.',
      'Review the transaction table; fix any flagged row.',
      'Choose “.csv” and export.',
      'Open it in Excel or Google Sheets, or import it wherever you need.',
    ],
    faqs: [
      { q: 'How do I convert a bank statement PDF to CSV?', a: 'Open the Bank Statement Converter, drop your statement PDF in, review the extracted transactions, then choose the CSV export. The file is built in your browser and downloaded — nothing is uploaded.' },
      { q: 'Will the CSV open correctly in Excel?', a: 'Yes. It’s UTF-8 with a byte-order mark and RFC-4180 quoting, so commas inside descriptions and non-English characters open correctly in Excel and Google Sheets.' },
      { q: 'Are the numbers reliable?', a: 'Every row is checked against the running balance, so the debit/credit/balance figures are arithmetically verified rather than guessed. Any row that doesn’t reconcile is flagged before you export.' },
      { q: 'Is my statement uploaded?', a: 'No — it’s read entirely in your browser and never uploaded, stored, or seen by us.' },
    ],
  },
];

export const getWorkflow = (slug: string): Workflow | undefined => WORKFLOWS.find((w) => w.slug === slug);
