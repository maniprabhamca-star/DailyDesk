// Per-bank content for the Statement Converter SEO landing pages
// (/bank-statement-converter/<slug>). Each bank gets UNIQUE, genuinely useful
// content — how to download that bank's e-statement, its password format, and the
// layout quirk our engine handles — so the pages aren't thin duplicates. This is
// the growth engine: "SBI bank statement to Excel" has commercial intent and weak
// competition (see docs/designs/bank-statement-converter.md §5.2).
//
// Password/step details are written as guidance ("commonly…, check the covering
// email") because banks change them — never stated as a hard rule.

export type BankPage = {
  slug: string;        // URL segment + fingerprint id
  name: string;        // "State Bank of India"
  short: string;       // used in title/description (kept < 60/155 char budgets)
  aka?: string;        // extra search alias woven into copy
  download: string[];  // how to get the e-statement PDF from that bank
  password: string;    // password-format guidance
  quirk: string;       // the layout detail our engine handles for this bank
};

export const BANK_PAGES: BankPage[] = [
  {
    slug: 'sbi', name: 'State Bank of India', short: 'SBI', aka: 'OnlineSBI / YONO',
    download: [
      'Log in to OnlineSBI (Personal Banking), or open the YONO SBI app.',
      'Go to “Account Statement” under My Accounts.',
      'Pick the account and a date range (or a full month).',
      'Choose PDF and download it to your phone or computer.',
    ],
    password: 'SBI net-banking PDFs are usually not locked. An SBI e-statement received by email can be password-protected — the password is shown in the covering email. If yours asks for one, the converter prompts for it and unlocks the file on your device.',
    quirk: 'SBI packs UPI / NEFT / IMPS details into one long description that wraps across lines. DiemDesk rejoins those lines and separates the Debit, Credit and Balance columns cleanly.',
  },
  {
    slug: 'hdfc', name: 'HDFC Bank', short: 'HDFC', aka: 'HDFC NetBanking',
    download: [
      'Log in to HDFC NetBanking (or the HDFC Bank MobileBanking app).',
      'Go to Accounts → Enquire → Account Statement.',
      'Select the account and the statement period.',
      'Download the statement as a PDF.',
    ],
    password: 'HDFC statement PDFs commonly open with your Customer ID, or the first four letters of your name plus your date of birth (DDMM). The exact rule is in the covering email — the converter will ask and unlock it locally.',
    quirk: 'HDFC uses Withdrawal Amt. / Deposit Amt. / Closing Balance with a separate Narration column. DiemDesk maps these automatically and checks every row against the running balance.',
  },
  {
    slug: 'icici', name: 'ICICI Bank', short: 'ICICI', aka: 'iMobile Pay',
    download: [
      'Log in to ICICI Bank internet banking, or the iMobile Pay app.',
      'Go to Bank Accounts → Statement (Detailed Statement).',
      'Choose the account and date range.',
      'Download or email yourself the PDF.',
    ],
    password: 'ICICI e-statement PDFs are often password-protected; the password is shown in the email that delivered it. The converter prompts for it and unlocks the file entirely on your device.',
    quirk: 'ICICI’s Transaction Remarks / Withdrawal Amount / Deposit Amount / Balance columns and Indian lakh formatting (1,23,456.78) are recognised and reconciled automatically.',
  },
  {
    slug: 'axis', name: 'Axis Bank', short: 'Axis', aka: 'Axis Mobile',
    download: [
      'Log in to Axis Internet Banking, or the Axis Mobile app.',
      'Go to Accounts → Account Statement / Download Statement.',
      'Select the account and period.',
      'Download the PDF.',
    ],
    password: 'Axis statement PDFs commonly open with the first four letters of your name (in capitals) followed by your date of birth (DDMM). Confirm the exact format in the covering email; the converter will prompt and unlock locally.',
    quirk: 'Axis prints a tight layout with the branch code appended after the balance and multi-line particulars. DiemDesk separates the branch code, rejoins the particulars, and verifies each row — the exact case a real Axis statement broke before we fixed it.',
  },
  {
    slug: 'kotak', name: 'Kotak Mahindra Bank', short: 'Kotak', aka: 'Kotak 811',
    download: [
      'Log in to Kotak Net Banking, or the Kotak mobile app.',
      'Go to Accounts → Statement / e-Statement.',
      'Select the account and period.',
      'Download the PDF.',
    ],
    password: 'Kotak e-statements are usually password-protected; the format (often your CRN, or name + date of birth) is stated in the delivery email. The converter asks for it and unlocks the file on your device.',
    quirk: 'Kotak uses a Withdrawal(Dr) / Deposit(Cr) layout. DiemDesk recognises the Dr/Cr columns and reconciles the running balance.',
  },
  {
    slug: 'pnb', name: 'Punjab National Bank', short: 'PNB', aka: 'PNB ONE',
    download: [
      'Log in to the PNB ONE app, or PNB Retail Internet Banking.',
      'Go to Accounts → Statement of Account.',
      'Choose the account and period.',
      'Download the PDF.',
    ],
    password: 'PNB statement PDFs can be password-protected — check the covering email for the format. If yours is locked, the converter prompts for the password and unlocks it locally.',
    quirk: 'PNB’s Instrument No. / Debit / Credit / Balance columns and the headers repeated on every page are handled automatically, so nothing from the letterhead leaks into your rows.',
  },
  {
    slug: 'bank-of-baroda', name: 'Bank of Baroda', short: 'Bank of Baroda', aka: 'bob World',
    download: [
      'Log in to bob World Internet, or the bob World app.',
      'Go to Accounts → Account Statement.',
      'Select the account and period.',
      'Download the PDF.',
    ],
    password: 'Bank of Baroda e-statements may be locked; use the password shown in the delivery email. The converter prompts for it and unlocks the file on your device.',
    quirk: 'Bank of Baroda’s Withdrawals / Deposits / Balance columns and lakh grouping are mapped and verified automatically.',
  },
  {
    slug: 'canara', name: 'Canara Bank', short: 'Canara', aka: 'Canara ai1',
    download: [
      'Log in to the Canara ai1 app, or Canara Net Banking.',
      'Go to Accounts → Statement.',
      'Choose the account and date range.',
      'Download the PDF.',
    ],
    password: 'Canara statement PDFs may need a password shown in the covering email. If so, the converter prompts for it and unlocks the file locally.',
    quirk: 'Canara’s Post Date / Value Date / Cheque No / Debit / Credit / Balance columns are recognised automatically.',
  },
  {
    slug: 'union-bank', name: 'Union Bank of India', short: 'Union Bank', aka: 'Union Vyom',
    download: [
      'Log in to the Union Bank Vyom app, or Union Net Banking.',
      'Go to Accounts → Statement.',
      'Select the account and period.',
      'Download the PDF.',
    ],
    password: 'Union Bank e-statements can be password-protected — check the delivery email. The converter prompts for the password and unlocks the file on your device.',
    quirk: 'Union Bank’s Transaction Date / Remarks / Debit / Credit / Balance layout is mapped and reconciled automatically.',
  },
  {
    slug: 'idfc-first', name: 'IDFC FIRST Bank', short: 'IDFC FIRST', aka: 'IDFC FIRST app',
    download: [
      'Log in to the IDFC FIRST Bank app, or Net Banking.',
      'Go to Accounts → Statement / e-Statement.',
      'Choose the account and period.',
      'Download the PDF.',
    ],
    password: 'IDFC FIRST statement PDFs may be locked; use the password from the covering email. The converter prompts for it and unlocks the file locally.',
    quirk: 'IDFC FIRST’s Particulars / Debit / Credit / Balance columns are handled automatically and reconciled row by row.',
  },
  {
    slug: 'yes-bank', name: 'YES Bank', short: 'YES Bank', aka: 'YES BANK iris',
    download: [
      'Log in to the YES BANK app (iris), or Net Banking.',
      'Go to Accounts → Statement.',
      'Select the account and period.',
      'Download the PDF.',
    ],
    password: 'YES BANK e-statements are commonly password-protected; the format is in the delivery email. The converter asks for the password and unlocks the file on your device.',
    quirk: 'YES BANK’s Description / Withdrawals / Deposits / Balance columns are mapped and verified automatically.',
  },
];

export const getBankPage = (slug: string): BankPage | undefined => BANK_PAGES.find((b) => b.slug === slug);
