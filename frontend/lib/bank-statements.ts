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

  // ---- second wave, 2026-08-29 -----------------------------------------------
  // Same rule as above: one page per bank people actually search for, each with
  // its own download path, password guidance and layout quirk. Nothing here is
  // stated as a hard rule — banks change password formats without notice, so the
  // copy says "commonly" and points at the covering email.
  //
  // TWO were deliberately left out rather than written from memory:
  //   • Paytm Payments Bank — the RBI cancelled its licence on 2026-04-24 and it
  //     is winding up. A page explaining how to download a statement from it
  //     would be actively wrong.
  //   • Citi India — the consumer business moved to Axis Bank and customers were
  //     migrated in 2024, so the query belongs on the Axis page, not its own.
  {
    slug: 'bank-of-india', name: 'Bank of India', short: 'Bank of India', aka: 'BOI / StarConnect',
    download: [
      'Log in to BOI StarConnect internet banking, or the BOI Mobile (Omni Neo) app.',
      'Go to Accounts → Account Statement.',
      'Pick the account and the period you need.',
      'Download it as a PDF.',
    ],
    password: 'Statements pulled from StarConnect are usually open. A BOI e-statement mailed to you is commonly locked, and the covering email states the format. If yours asks, the converter prompts for the password and unlocks the file on your device.',
    quirk: 'BOI runs long branch and instrument references inside the particulars column, which pushes rows onto a second line. DiemDesk stitches the wrapped rows back together before splitting Debit, Credit and Balance.',
  },
  {
    slug: 'indusind', name: 'IndusInd Bank', short: 'IndusInd', aka: 'IndusMobile',
    download: [
      'Log in to IndusNet internet banking, or open the IndusMobile app.',
      'Go to Accounts → Account Statement / Detailed Statement.',
      'Choose the account and a date range.',
      'Download the PDF.',
    ],
    password: 'IndusInd e-statements are commonly protected with a mix of your registered mobile number and date of birth; the covering email carries the exact rule. The converter asks for it and unlocks the file locally.',
    quirk: 'IndusInd prints a separate value date beside the transaction date, which many converters mistake for a second column of data. DiemDesk keeps both dates and still reconciles each row against the running balance.',
  },
  {
    slug: 'federal', name: 'Federal Bank', short: 'Federal Bank', aka: 'FedNet / FedMobile',
    download: [
      'Log in to FedNet internet banking, or the FedMobile app.',
      'Go to Accounts → Statement of Account.',
      'Select the account and period.',
      'Download the statement as a PDF.',
    ],
    password: 'Federal Bank e-statements are usually password-protected, most often with your customer ID or date of birth as stated in the covering email. The converter unlocks it on your device once you supply it.',
    quirk: 'Federal Bank statements carry the cheque number in its own narrow column that frequently sits empty. DiemDesk keeps the column aligned instead of letting blank cells shift the amounts one place to the left.',
  },
  {
    slug: 'rbl', name: 'RBL Bank', short: 'RBL Bank', aka: 'RBL MoBank',
    download: [
      'Log in to RBL Bank internet banking, or the RBL MoBank app.',
      'Go to Accounts → Account Statement.',
      'Pick the account and the statement period.',
      'Download the PDF.',
    ],
    password: 'RBL e-statement PDFs commonly open with a combination of your name and date of birth given in the covering email. If your file is locked the converter prompts for the password and opens it on your device.',
    quirk: 'RBL amount columns are right-aligned with the currency symbol attached, which is a common cause of a figure being read as text. DiemDesk strips the symbol and keeps the number a number.',
  },
  {
    slug: 'bandhan', name: 'Bandhan Bank', short: 'Bandhan Bank', aka: 'mBandhan',
    download: [
      'Log in to Bandhan Bank internet banking, or the mBandhan app.',
      'Go to Accounts → Account Statement.',
      'Choose the account and date range.',
      'Download it as a PDF.',
    ],
    password: 'Bandhan e-statements are often locked with your registered date of birth or customer ID; the covering email states which. The converter asks and unlocks the file without uploading it.',
    quirk: 'Bandhan repeats the account header on every page, so a naive extraction interleaves header text with transactions. DiemDesk drops the repeats and keeps one clean table.',
  },
  {
    slug: 'au-small-finance', name: 'AU Small Finance Bank', short: 'AU Small Finance', aka: 'AU 0101',
    download: [
      'Log in to AU Small Finance Bank internet banking, or the AU 0101 app.',
      'Go to Accounts → Account Statement.',
      'Select the account and period.',
      'Download the PDF.',
    ],
    password: 'AU e-statements are commonly password-protected using details from your profile, as set out in the covering email. The converter prompts for the password and unlocks it locally.',
    quirk: 'AU statements place the running balance before the credit column on some formats, the reverse of most banks. DiemDesk reads the header rather than assuming an order, so the columns land where they belong.',
  },
  {
    slug: 'idbi', name: 'IDBI Bank', short: 'IDBI Bank', aka: 'IDBI Go Mobile+',
    download: [
      'Log in to IDBI Bank internet banking, or the Go Mobile+ app.',
      'Go to Accounts → Account Statement.',
      'Pick the account and a date range.',
      'Download the statement as a PDF.',
    ],
    password: 'IDBI e-statements delivered by email are commonly locked; the covering email gives the format. The converter asks for the password and opens the file on your device.',
    quirk: 'IDBI wraps NEFT and RTGS narrations across two or three lines with the UTR on its own line. DiemDesk rejoins them so the reference stays attached to its transaction.',
  },
  {
    slug: 'central-bank', name: 'Central Bank of India', short: 'Central Bank', aka: 'Cent Mobile',
    download: [
      'Log in to Central Bank of India internet banking, or the Cent Mobile app.',
      'Go to Accounts → Account Statement.',
      'Choose the account and period.',
      'Download it as a PDF.',
    ],
    password: 'Statements downloaded from net banking are usually open; e-statements sent by email may be locked, with the format stated in that email. The converter unlocks it locally if needed.',
    quirk: 'Central Bank statements use a dense fixed-width layout where the description can run into the amount column. DiemDesk separates them on the column boundary rather than on whitespace.',
  },
  {
    slug: 'indian-bank', name: 'Indian Bank', short: 'Indian Bank', aka: 'IndOASIS',
    download: [
      'Log in to Indian Bank NetBanking, or the IndOASIS app.',
      'Go to Accounts → Account Statement.',
      'Select the account and the period.',
      'Download the PDF.',
    ],
    password: 'Indian Bank e-statements are commonly protected with your customer ID or date of birth as given in the covering email. The converter asks and unlocks the file on your device.',
    quirk: 'Since the Allahabad Bank amalgamation some accounts still produce statements in the older layout. DiemDesk detects the header for both and maps them to the same columns.',
  },
  {
    slug: 'uco', name: 'UCO Bank', short: 'UCO Bank', aka: 'UCO mBanking Plus',
    download: [
      'Log in to UCO Bank internet banking, or the UCO mBanking Plus app.',
      'Go to Accounts → Account Statement.',
      'Pick the account and date range.',
      'Download it as a PDF.',
    ],
    password: 'UCO e-statements received by email are commonly locked; the covering email states the format. The converter prompts for the password and opens it locally.',
    quirk: 'UCO prints the transaction date and posting date in adjacent columns with the same format, which converters routinely merge. DiemDesk keeps them distinct.',
  },
  {
    slug: 'south-indian-bank', name: 'South Indian Bank', short: 'South Indian Bank', aka: 'SIB Mirror+',
    download: [
      'Log in to SIBerNet internet banking, or the SIB Mirror+ app.',
      'Go to Accounts → Account Statement.',
      'Choose the account and period.',
      'Download the PDF.',
    ],
    password: 'SIB e-statements are usually password-protected with details set out in the covering email. The converter asks for the password and unlocks the file on your device.',
    quirk: 'South Indian Bank statements carry a branch code column that is blank for most rows. DiemDesk holds the column rather than letting the gaps pull the amounts out of alignment.',
  },
  {
    slug: 'karnataka-bank', name: 'Karnataka Bank', short: 'Karnataka Bank', aka: 'KBL Mobile Plus',
    download: [
      'Log in to Karnataka Bank MoneyClick internet banking, or the KBL Mobile Plus app.',
      'Go to Accounts → Account Statement.',
      'Select the account and date range.',
      'Download it as a PDF.',
    ],
    password: 'Karnataka Bank e-statements are commonly locked using details given in the covering email. The converter prompts for the password and unlocks the file locally.',
    quirk: 'Karnataka Bank splits long UPI narrations across lines and repeats the date on the continuation row. DiemDesk recognises the repeat and does not count it as a second transaction.',
  },
  {
    slug: 'csb', name: 'CSB Bank', short: 'CSB Bank', aka: 'CSB Bank Mobile',
    download: [
      'Log in to CSB Bank internet banking, or the CSB Bank mobile app.',
      'Go to Accounts → Account Statement.',
      'Pick the account and the period.',
      'Download the statement as a PDF.',
    ],
    password: 'CSB e-statements delivered by email are commonly password-protected as described in that email. The converter asks for it and opens the file on your device.',
    quirk: 'CSB statements print amounts with a trailing Dr or Cr marker instead of separate debit and credit columns. DiemDesk reads the marker and splits them into two proper columns.',
  },
  {
    slug: 'dcb', name: 'DCB Bank', short: 'DCB Bank', aka: 'DCB Mobile Banking',
    download: [
      'Log in to DCB Bank internet banking, or the DCB mobile banking app.',
      'Go to Accounts → Account Statement.',
      'Choose the account and the date range.',
      'Download the PDF.',
    ],
    password: 'DCB e-statements are commonly locked with details set out in the covering email. The converter prompts for the password and unlocks it without uploading anything.',
    quirk: 'DCB statements can span pages without repeating the column header, so page two looks like unlabelled data. DiemDesk carries the header forward across every page.',
  },
  {
    slug: 'indian-overseas-bank', name: 'Indian Overseas Bank', short: 'IOB', aka: 'Indian Overseas Bank / IOB Mobile',
    download: [
      'Log in to IOB internet banking, or the IOB Mobile app.',
      'Go to Accounts → Account Statement.',
      'Select the account and period.',
      'Download it as a PDF.',
    ],
    password: 'IOB e-statements sent by email are commonly protected; the covering email states the format. The converter asks for the password and unlocks the file locally.',
    quirk: 'IOB uses a compact particulars column that abbreviates the transaction type, which makes rows look near-identical. DiemDesk keeps the full text rather than truncating it further.',
  },
  {
    slug: 'punjab-and-sind', name: 'Punjab & Sind Bank', short: 'Punjab & Sind Bank', aka: 'PSB UnIC',
    download: [
      'Log in to Punjab & Sind Bank internet banking, or the PSB UnIC app.',
      'Go to Accounts → Account Statement.',
      'Pick the account and the period.',
      'Download the PDF.',
    ],
    password: 'PSB e-statements received by email may be locked, with the format given in that email. The converter prompts for it and opens the file on your device.',
    quirk: 'Punjab & Sind statements place the opening balance as an ordinary row rather than in a header. DiemDesk treats it as the opening figure so the running balance check starts from the right number.',
  },
  {
    slug: 'standard-chartered-india', name: 'Standard Chartered Bank India', short: 'Standard Chartered', aka: 'SC Mobile India',
    download: [
      'Log in to Standard Chartered online banking, or the SC Mobile India app.',
      'Go to Accounts → e-Statements / Account Statement.',
      'Select the account and the statement month or range.',
      'Download the PDF.',
    ],
    password: 'Standard Chartered e-statements are usually password-protected; the covering email sets out the format, commonly built from your date of birth. The converter unlocks it on your device.',
    quirk: 'Standard Chartered statements carry both a booking date and a value date and print amounts in a single signed column. DiemDesk splits the signed amounts into debit and credit.',
  },
  {
    slug: 'hsbc-india', name: 'HSBC India', short: 'HSBC India', aka: 'HSBC India mobile banking',
    download: [
      'Log in to HSBC India online banking, or the HSBC India mobile banking app.',
      'Go to Accounts → Statements / e-Statements.',
      'Choose the account and the statement period.',
      'Download the PDF.',
    ],
    password: 'HSBC e-statements are commonly password-protected using details described in the covering email. The converter asks for the password and unlocks the file locally.',
    quirk: 'HSBC statements group transactions under date sub-headings rather than repeating the date on each row. DiemDesk pushes the heading date down onto every transaction beneath it.',
  },
  {
    slug: 'fi-money', name: 'Fi Money', short: 'Fi Money', aka: 'Fi, savings account with Federal Bank',
    download: [
      'Open the Fi app and go to your account.',
      'Tap Statements (or Account → Statements).',
      'Choose the period you need.',
      'Export or email yourself the PDF.',
    ],
    password: 'Fi statements are issued on the underlying Federal Bank account and may arrive password-protected, with the format given in the covering email. The converter prompts for it and opens the file on your device.',
    quirk: 'Fi statements are app-generated and lean heavily on UPI handles in the narration, so almost every row looks alike at a glance. DiemDesk keeps the full handle, which is what makes the rows sortable once they are in a spreadsheet.',
  },
  {
    slug: 'jupiter-money', name: 'Jupiter', short: 'Jupiter', aka: 'Jupiter Money, savings account with Federal Bank',
    download: [
      'Open the Jupiter app.',
      'Go to Account → Statements.',
      'Select the month or the date range.',
      'Download or email yourself the PDF.',
    ],
    password: 'Jupiter statements come from the underlying Federal Bank account and can be password-protected, with the rule stated in the covering email. The converter unlocks it locally if needed.',
    quirk: 'Jupiter statements carry merchant names rather than raw UPI strings for many rows, which is friendlier to read and harder to parse consistently. DiemDesk keeps both where the statement prints both.',
  },
  {
    slug: 'hdfc-credit-card', name: 'HDFC Bank credit card', short: 'HDFC credit card', aka: 'HDFC card statement',
    download: [
      'Log in to HDFC NetBanking, or the HDFC Bank MobileBanking app.',
      'Go to Cards → Credit Cards → Statement / View Statement.',
      'Pick the card and the statement month.',
      'Download the PDF.',
    ],
    password: 'HDFC credit card statements commonly open with the first four letters of your name plus your card\'s last four digits, or your date of birth — the covering email carries the exact rule. The converter asks and unlocks it on your device.',
    quirk: 'A credit card statement has no running balance to reconcile against, so the balance check works differently here: DiemDesk totals the transactions and checks them against the opening balance, payments and the closing total due printed on the statement.',
  },
  {
    slug: 'sbi-card', name: 'SBI Card', short: 'SBI Card', aka: 'SBI credit card statement',
    download: [
      'Log in to sbicard.com, or open the SBI Card mobile app.',
      'Go to Statements / My Account → Statement.',
      'Choose the statement month.',
      'Download the PDF.',
    ],
    password: 'SBI Card statements are commonly locked with your date of birth in DDMMYYYY, or a combination given in the covering email. The converter prompts for the password and opens the file locally.',
    quirk: 'SBI Card prints reward points alongside the amounts, and the points column is easily read as a second figure. DiemDesk keeps the points out of the money columns and checks the transactions against the total due.',
  },
  {
    slug: 'icici-credit-card', name: 'ICICI Bank credit card', short: 'ICICI credit card', aka: 'ICICI card statement',
    download: [
      'Log in to ICICI Bank internet banking, or the iMobile Pay app.',
      'Go to Cards → Credit Card → Statement.',
      'Select the card and the statement period.',
      'Download the PDF.',
    ],
    password: 'ICICI credit card statements are commonly password-protected using your date of birth or card details as stated in the covering email. The converter unlocks it on your device.',
    quirk: 'ICICI card statements list a separate section for each cardholder on the account, so transactions appear under more than one heading. DiemDesk keeps the cardholder as a column instead of losing the distinction.',
  },
  {
    slug: 'axis-credit-card', name: 'Axis Bank credit card', short: 'Axis credit card', aka: 'Axis card statement',
    download: [
      'Log in to Axis Internet Banking, or the Axis Mobile app.',
      'Go to Cards → Credit Card → Statement.',
      'Pick the card and the statement month.',
      'Download the PDF.',
    ],
    password: 'Axis credit card statements are commonly locked with a combination of your name and date of birth given in the covering email. The converter asks for the password and unlocks it locally.',
    quirk: 'Axis card statements separate domestic and international transactions into two blocks with their own subtotals. DiemDesk merges them into one table while keeping the subtotals for the reconciliation check.',
  },
  {
    slug: 'amex-india', name: 'American Express India', short: 'Amex India', aka: 'Amex card statement',
    download: [
      'Log in to americanexpress.com/in, or the Amex mobile app.',
      'Go to Statements & Activity.',
      'Choose the statement period.',
      'Download the PDF.',
    ],
    password: 'Amex statements are commonly protected with details set out in the covering email. If your file is locked the converter prompts for the password and opens it on your device.',
    quirk: 'Amex statements print a long merchant address block under each transaction, which most converters treat as extra rows. DiemDesk folds the address into the transaction it belongs to.',
  },
  {
    slug: 'razorpay-settlements', name: 'Razorpay settlements', short: 'Razorpay', aka: 'Razorpay settlement report',
    download: [
      'Log in to the Razorpay Dashboard.',
      'Go to Transactions → Settlements.',
      'Choose the settlement period.',
      'Download the report as a PDF (or export it directly).',
    ],
    password: 'Razorpay settlement reports are downloaded from the dashboard and are not usually password-protected. If yours is, the converter prompts for the password and unlocks it on your device.',
    quirk: 'A settlement report is not a bank statement: each row is a batch of payments net of fees and tax, not a single transaction. DiemDesk keeps the gross, fee, tax and net columns separate so the figure you reconcile against your bank credit is the net one.',
  },
  {
    slug: 'zerodha-ledger', name: 'Zerodha ledger', short: 'Zerodha ledger', aka: 'Zerodha Console funds statement',
    download: [
      'Log in to Zerodha Console.',
      'Go to Account → Ledger (or Reports → Ledger).',
      'Select the financial year or a date range.',
      'Download the ledger as a PDF.',
    ],
    password: 'Zerodha ledgers downloaded from Console are not usually locked. Where a statement is emailed and protected, the covering email states the format and the converter unlocks it locally.',
    quirk: 'A broker ledger mixes fund transfers with charges, taxes and settlement obligations, so the running balance moves for reasons a bank statement never has. DiemDesk keeps the voucher type as its own column, which is what makes the ledger usable at tax time.',
  },
  {
    slug: 'phonepe-statement', name: 'PhonePe transaction history', short: 'PhonePe history', aka: 'PhonePe statement',
    download: [
      'Open the PhonePe app and go to History.',
      'Tap the statement or download icon.',
      'Choose the period you need.',
      'Download or email yourself the PDF.',
    ],
    password: 'PhonePe statements are commonly password-protected, with the format stated in the covering email or in the app. The converter prompts for the password and opens the file on your device.',
    quirk: 'A UPI history is not a bank statement — it lists payments across whichever accounts you linked, with no single running balance. DiemDesk keeps the source account as a column so you can split the rows per account once they are in a spreadsheet.',
  },
];

export const getBankPage = (slug: string): BankPage | undefined => BANK_PAGES.find((b) => b.slug === slug);
