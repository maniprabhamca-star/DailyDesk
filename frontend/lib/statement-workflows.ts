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
    lede: 'Turn a bank statement PDF into a balance-verified OFX, .qbo, Excel or CSV file for QuickBooks — built entirely in your browser, never uploaded.',
    bullets: [
      'Clean Date / Description / Amount / Balance columns, verified against the running balance',
      'Export OFX for QuickBooks Online, or .qbo for Web Connect — no column mapping',
      'Handles Indian and Western number formats and Dr/Cr layouts',
      'Excel and CSV too, if you would rather map the columns yourself',
      'On your device — the statement never leaves your browser',
    ],
    intro: 'QuickBooks imports bank transactions from a spreadsheet or from an OFX/QBO file. DiemDesk builds any of them from your statement, arithmetically verified row by row, without uploading the most sensitive document you own to yet another server. One thing to know before you pick .qbo: that format carries the Intuit id of the bank it came from, and QuickBooks checks it. We will not write another bank’s id into your file, so you supply yours — and if your bank is not in Intuit’s directory, which is the case for most Indian banks, OFX does the same job without one.',
    steps: [
      'Download your statement PDF from net banking.',
      'Open the Bank Statement Converter and drop the PDF in — it’s read on your device.',
      'Review the transaction table; fix any flagged row.',
      'Export OFX, or .qbo if you have your bank’s Intuit id — Excel and CSV are there too.',
      'In QuickBooks: Banking → upload the file. An OFX or .qbo carries the columns already; a spreadsheet asks you to map Date / Description / Amount.',
    ],
    faqs: [
      { q: 'Can I import a bank statement into QuickBooks from a PDF?', a: 'QuickBooks doesn’t import PDFs directly — the statement has to become a file it reads. DiemDesk builds one on your device: OFX or .qbo, which carry the columns already, or Excel and CSV if you would rather map them yourself. Every row is checked against the running balance before anything is written.' },
      { q: 'Why does the .qbo export ask for an id?', a: 'A QuickBooks Web Connect file carries the Intuit identifier of the institution it came from, and QuickBooks checks it against Intuit’s own directory before it reads a transaction. Converters often default that field to some real bank’s id so the button always works, which files your statement under a bank it did not come from. We don’t: you take the id from a .qbo your own bank gives you. Most Indian banks are not in that directory at all, and for them OFX imports just as well without one.' },
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
