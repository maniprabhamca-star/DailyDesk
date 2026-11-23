// US federal forms — tranche 1, the dozen that carry the most personal data.
//
// ── Why this family exists, and how it differs from the India one ─────────────
// The India library (lib/india-forms.ts) is about filings that happen ONLINE:
// the PDFs are the things AROUND the filing. These are the opposite. Every form
// here is a fillable PDF that someone sits down and types into, and what they
// type is an SSN, an EIN, a passport number, or a complete list of every bank
// account and vehicle they own. That is the whole argument for the page: you
// can fill it on your own device instead of in somebody's cloud editor.
//
// ── The rule we do not bend ───────────────────────────────────────────────────
// We never host the form. Federal forms are revised without notice and a stale
// copy served from our domain is worse than no copy, because it looks current.
// Every page links to the issuing authority's own page and states the revision
// we checked, with the date we checked it.
//
// This is the thing pdf.net's pages get wrong: theirs carry an "Official IRS
// form" badge and link to irs.gov zero times. We link, and we show our work.
//
// ── Every number below was measured, not remembered ───────────────────────────
// `revision` comes off the IRS product table
// (irs.gov/forms-instructions-and-publications?find=<form>), `fields` and
// `pages` off the real PDF with pdf-lib, all on `CHECKED_ON`. The script at
// scripts/verify-us-forms.mjs re-checks the revisions against the IRS and
// tests/unit/us-forms.test.ts fails when anything here drifts out of contract.

/** The day every `revision`, `fields` and `pages` value here was verified at source. */
export const CHECKED_ON = '2026-11-23';

/** CHECKED_ON as prose, e.g. "November 23, 2026".
 *
 * Built from the parts rather than `new Date(CHECKED_ON)`, because a bare
 * `YYYY-MM-DD` parses as UTC midnight and then formats in the viewer's own
 * zone — which rendered this date as the 22nd for anyone west of UTC. A
 * verification date that is off by one undermines the exact thing it is there
 * to establish. tests/unit/us-forms.test.ts guards it. */
export const CHECKED_ON_LABEL = (() => {
  const [y, m, d] = CHECKED_ON.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
})();

export type UsForm = {
  slug: string;
  /** Full name as people write it: "Form W-9". */
  name: string;
  /** Short label for titles, kept inside the 60-char budget. */
  short: string;
  /** Section heading on the index page. */
  group: string;
  /** What people actually search for. */
  aka?: string;
  /** Who issues it. */
  authority: string;
  /** Where the current version lives, in words. */
  officialName: string;
  /** The authority's own page — never a copy hosted by us, never a direct PDF. */
  officialUrl: string;
  /** What the issuing agency CALLS its version marker. Not cosmetic: the IRS
   *  says "Rev.", USCIS says "Edition date" and rejects a form filed on an
   *  out-of-date edition, the DOL says "Revised". Printing the agency's own
   *  term is the difference between a useful page and a vaguely official one. */
  revisionLabel: 'Rev.' | 'Form year' | 'Edition date' | 'Revised' | 'Form date';
  /** The marker exactly as the agency prints it: "Mar 2024", "2026", "04/01/24". */
  revision: string;
  /** The agency's own PDF. Used ONLY by /forms-api/file/<slug>, which fetches it
   *  live when someone clicks "get this form" — we never store a copy, which
   *  is why `officialUrl` (the human page) stays separate and a test forbids
   *  it from pointing at a PDF. */
  pdfUrl: string;
  /** Fillable form fields, counted on the real PDF. */
  fields: number;
  /** Page count of the published PDF, instructions included. */
  pages: number;
  /** The specific personal data this form carries. The privacy argument, per form. */
  sensitive: string;
  what: string;
  who: string;
  when: string;
  /** The thing people get wrong. The reason the page is worth linking to. */
  gotcha: string;
  /** Catalogue tool NAMES — matched exactly, guarded by a test. */
  tools: string[];
};

export const US_FORMS: UsForm[] = [
  // ── A. Identity, TIN and authority to act ──────────────────────────────────
  {
    slug: 'form-w-9',
    name: 'Form W-9',
    short: 'W-9',
    group: 'Identity, TIN and authority to act',
    aka: 'request for taxpayer identification number and certification',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS page for Form W-9',
    officialUrl: 'https://www.irs.gov/forms-pubs/about-form-w-9',
    revisionLabel: 'Rev.',
    revision: 'Mar 2024',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/fw9.pdf',
    fields: 23,
    pages: 6,
    sensitive:
      'your Social Security number or EIN, in plain text, on a document you hand to a business rather than to the IRS',
    what:
      'The certificate you give a business that pays you, stating your legal name, your tax classification and your taxpayer identification number, so the payer can report what they paid you and knows whether it has to withhold.',
    who:
      'Independent contractors, freelancers, consultants, landlords and any business a client has asked for a TIN. It is the most-requested form in American business, and most people fill in several a year.',
    when:
      'Whenever a payer asks, which is usually before your first payment from them, and again after your name, address or tax classification changes. Payers generally re-request them annually.',
    gotcha:
      'It goes to the payer, never to the IRS, and that is exactly where the risk sits: people email a document carrying a bare Social Security number to whoever asked, often an address they have never written to before. The classification box catches single-member LLCs out too — you tick individual or sole proprietor and give the owner’s number, not the company’s, or the 1099 lands under the wrong TIN.',
    tools: ['Fill PDF form', 'Sign PDF', 'Redact PDF', 'Compress to size'],
  },
  {
    slug: 'form-w-4',
    name: 'Form W-4',
    short: 'W-4',
    group: 'Identity, TIN and authority to act',
    aka: 'employee’s withholding certificate',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS page for Form W-4',
    officialUrl: 'https://www.irs.gov/forms-pubs/about-form-w-4',
    revisionLabel: 'Form year',
    revision: '2026',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/fw4.pdf',
    fields: 48,
    pages: 5,
    sensitive:
      'your Social Security number, your marital status, and enough about your other income and dependants to sketch your household finances',
    what:
      'The form that tells your employer how much federal income tax to take out of each paycheck. It is not filed with the IRS — your payroll department keeps it and applies it.',
    who:
      'Everyone starting a job, and anyone whose withholding has stopped matching their situation: a second job, a working spouse, a new child, a large freelance year alongside employment.',
    when:
      'On starting a job, and any time your circumstances change. Employers generally apply a new one from the next payroll run, and the IRS publishes a fresh revision each year.',
    gotcha:
      'The form assumes each job is your only job unless you complete Step 2, so a two-earner household that leaves it blank has both employers withholding as though the other salary did not exist, and the shortfall arrives as a bill the following spring. The quieter problem is that payroll keeps whatever you last filed — a W-4 from three jobs and two children ago is still the one being applied until you replace it.',
    tools: ['Fill PDF form', 'Sign PDF', 'Compress to size', 'Merge PDF'],
  },
  {
    slug: 'form-w-7',
    name: 'Form W-7',
    short: 'W-7',
    group: 'Identity, TIN and authority to act',
    aka: 'ITIN application',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS page for Form W-7',
    officialUrl: 'https://www.irs.gov/forms-pubs/about-form-w-7',
    revisionLabel: 'Rev.',
    revision: 'Dec 2024',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/fw7.pdf',
    fields: 69,
    pages: 1,
    sensitive:
      'your passport number, country of birth, immigration status and visa details — and the application travels with the passport itself or a certified copy of it',
    what:
      'The application for an Individual Taxpayer Identification Number, the number the IRS issues to people who have a US filing obligation but are not eligible for a Social Security number.',
    who:
      'Non-resident filers, spouses and dependants being claimed on a US return, and people with US-source income who cannot get an SSN. It is normally submitted attached to the tax return it is needed for.',
    when:
      'Generally filed together with the return that needs the number, rather than on its own. Processing takes a while, so check the IRS’s current guidance before counting on a date.',
    gotcha:
      'The documents sink more applications than the form does. W-7 wants original identity documents or copies certified by the agency that issued them, and a photocopy notarised at a high-street shop is not that — people post their only passport, or send an uncertified copy and hear nothing for months. A Certifying Acceptance Agent or an appointment at an IRS Taxpayer Assistance Center verifies the document in person so it never goes in the mail.',
    tools: ['Fill PDF form', 'Scan to PDF', 'Merge PDF', 'Compress to size'],
  },
  {
    slug: 'form-ss-4',
    name: 'Form SS-4',
    short: 'SS-4',
    group: 'Identity, TIN and authority to act',
    aka: 'EIN application',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS page for Form SS-4',
    officialUrl: 'https://www.irs.gov/forms-pubs/about-form-ss-4',
    revisionLabel: 'Rev.',
    revision: 'Dec 2025',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/fss4.pdf',
    fields: 89,
    pages: 2,
    sensitive:
      'the responsible party’s own Social Security number or ITIN, alongside the business address and the trade name',
    what:
      'The application for an Employer Identification Number — the number a business, estate, trust or non-profit uses to open bank accounts, run payroll and file returns.',
    who:
      'Anyone forming an entity, hiring an employee, opening a business bank account, or administering an estate or trust. Sole proprietors with no employees often need one anyway, because banks and payers ask.',
    when:
      'Before you need the number rather than after — payroll and bank onboarding both stop without it. The IRS generally issues immediately through its own online application and more slowly by mail or fax.',
    gotcha:
      'The responsible party has to be a human being with a taxpayer identification number, not a parent company, and naming an entity there is a straightforward rejection. The IRS also limits you to one EIN per responsible party per day, which surprises anyone setting up several entities at once. And a change of address or a new trading name does not need a new EIN — applying for a second one when the first still applies leaves two live numbers and a mess to unwind.',
    tools: ['Fill PDF form', 'Sign PDF', 'Compress to size', 'PDF to Excel'],
  },
  {
    slug: 'form-2848',
    name: 'Form 2848',
    short: '2848',
    group: 'Identity, TIN and authority to act',
    aka: 'IRS power of attorney',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS page for Form 2848',
    officialUrl: 'https://www.irs.gov/forms-pubs/about-form-2848',
    revisionLabel: 'Rev.',
    revision: 'Jan 2021',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/f2848.pdf',
    fields: 92,
    pages: 2,
    sensitive:
      'your taxpayer identification number together with a standing authorisation for a named person to act on your tax affairs',
    what:
      'The power of attorney that lets a named representative act for you with the IRS: receive your notices, argue your case, and sign certain things on your behalf.',
    who:
      'Anyone handing a tax matter to a CPA, enrolled agent or attorney — typically an audit, a collection case or an appeal.',
    when:
      'Before the representative needs to speak to the IRS for you. It stays in force for the matters and periods it names until it is revoked or replaced, so check what is already on file first.',
    gotcha:
      'It only covers the specific tax matters and specific periods written in its boxes. Writing "all years" or "all taxes" does not broaden it — it invalidates it. The half people miss entirely is that filing a new 2848 revokes earlier ones for the same matter and period unless you tick the box to keep them, so bringing in a second adviser quietly removes the first one’s authority at the moment you most need both.',
    tools: ['Fill PDF form', 'Sign PDF', 'Merge PDF', 'Redact PDF'],
  },
  {
    slug: 'form-8821',
    name: 'Form 8821',
    short: '8821',
    group: 'Identity, TIN and authority to act',
    aka: 'tax information authorization',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS page for Form 8821',
    officialUrl: 'https://www.irs.gov/forms-pubs/about-form-8821',
    revisionLabel: 'Rev.',
    revision: 'Jan 2021',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/f8821.pdf',
    fields: 45,
    pages: 1,
    sensitive:
      'your taxpayer identification number and permission for a third party — often a lender — to read your tax records',
    what:
      'The authorisation that lets a named person or firm inspect and receive your confidential tax information. It grants sight of your records and nothing more.',
    who:
      'People whose lender, accountant or payroll provider needs to read transcripts or notices, and anyone who wants a third party kept informed without handing over authority to act.',
    when:
      'Whenever someone needs access to your records. It can name a specific expiry, and a new one generally replaces an earlier authorisation for the same matter, so check what is already filed.',
    gotcha:
      'This form lets someone see; it does not let them do. People file an 8821 when they meant a 2848 and then discover their representative cannot argue the case or sign anything — and just as often it runs the other way, with a 2848 signed for a mortgage lender that only ever needed to read a transcript, handing a stranger far more authority than the job called for.',
    tools: ['Fill PDF form', 'Sign PDF', 'Redact PDF', 'Compress to size'],
  },
  {
    slug: 'form-8822',
    name: 'Form 8822',
    short: '8822',
    group: 'Identity, TIN and authority to act',
    aka: 'change of address',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS page for Form 8822',
    officialUrl: 'https://www.irs.gov/forms-pubs/about-form-8822',
    revisionLabel: 'Rev.',
    revision: 'Feb 2021',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/f8822.pdf',
    fields: 25,
    pages: 2,
    sensitive:
      'your Social Security number, your spouse’s, and both your old and new home addresses on one page',
    what:
      'The notification that updates the home address the IRS holds for you, so refunds and notices go to where you now live.',
    who:
      'Anyone who has moved and files a US return, and separated couples who need correspondence sent to different addresses.',
    when:
      'As soon after moving as you can manage. The IRS generally takes several weeks to process it, and a return filed with the new address does some of the work on its own.',
    gotcha:
      'Telling the post office is not telling the IRS. Notices keep going to the old address, and the clock on a notice runs from when it was sent, not from when it reached you — people lose response windows they never knew had opened. A business address change is a different form, 8822-B, which also carries its own obligation to report a change of responsible party.',
    tools: ['Fill PDF form', 'Sign PDF', 'Merge PDF', 'Compress to size'],
  },
  {
    slug: 'form-4506-t',
    name: 'Form 4506-T',
    short: '4506-T',
    group: 'Identity, TIN and authority to act',
    aka: 'request for transcript of tax return',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS page for Form 4506-T',
    officialUrl: 'https://www.irs.gov/forms-pubs/about-form-4506-t',
    revisionLabel: 'Rev.',
    revision: 'Apr 2025',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/f4506t.pdf',
    fields: 29,
    pages: 2,
    sensitive:
      'your Social Security number and an instruction to send your tax transcript to a third party you name, usually a lender',
    what:
      'The request that has the IRS send a transcript of your return — the line items rather than a copy of the return itself — either to you or to a third party you name.',
    who:
      'Mortgage applicants and small-business borrowers, mostly, because underwriters want income confirmed by the IRS rather than by the documents you hand over. Also anyone reconstructing a year they no longer have papers for.',
    when:
      'Whenever an underwriter or adviser asks. Processing depends on how it is submitted and how busy the IRS is, so confirm the current turnaround before promising a closing date.',
    gotcha:
      'It gets rejected for things that look trivial. The form says in its own first line not to sign it unless every applicable line is complete, and the name and address have to match the return being requested — the address on the filed return, not the one you live at now. That single mismatch is the commonest bounce in mortgage underwriting. If the transcript is for you rather than a lender, the IRS’s own Get Transcript service skips the form entirely.',
    tools: ['Fill PDF form', 'Sign PDF', 'Redact PDF', 'PDF to Excel'],
  },
  {
    slug: 'form-ss-8',
    name: 'Form SS-8',
    short: 'SS-8',
    group: 'Identity, TIN and authority to act',
    aka: 'worker classification determination',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS page for Form SS-8',
    officialUrl: 'https://www.irs.gov/forms-pubs/about-form-ss-8',
    revisionLabel: 'Rev.',
    revision: 'Dec 2023',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/fss8.pdf',
    fields: 299,
    pages: 5,
    sensitive:
      'a long narrative account of how you are actually managed, paid and supervised — and the form says on page one that it may be shown to the firm you are describing',
    what:
      'The request for an IRS determination on whether a worker is an employee or an independent contractor, decided on the facts of how the work is really controlled rather than on what the contract calls it.',
    who:
      'Workers who believe they have been misclassified as contractors, and firms that want the question settled before a payroll audit settles it for them.',
    when:
      'Any time the question is live. There is no filing deadline, and the determination typically takes a long time, so check where the IRS’s processing stands rather than planning around it.',
    gotcha:
      'Page one says it outright: what you write may be disclosed to the firm, worker or payer named on the form. A worker filing to challenge their classification should expect their employer to read the submission, which is not what most people assume when they describe a working relationship candidly. It also changes nothing while it is pending — returns still have to be filed and tax still has to be paid on the old basis.',
    tools: ['Fill PDF form', 'Merge PDF', 'Redact PDF', 'Compress to size'],
  },

  // ── B. Collection and hardship ─────────────────────────────────────────────
  {
    slug: 'form-433-a',
    name: 'Form 433-A',
    short: '433-A',
    group: 'Collection and hardship',
    aka: 'collection information statement for wage earners and the self-employed',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS forms search — the IRS publishes no "About Form 433-A" page',
    officialUrl: 'https://www.irs.gov/forms-instructions-and-publications?find=433-A&items_per_page=25',
    revisionLabel: 'Rev.',
    revision: 'Jun 2026',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/f433a.pdf',
    fields: 515,
    pages: 8,
    sensitive:
      'every bank account, investment, vehicle, property and source of income you have, with balances — the most complete financial portrait of a person the IRS collects',
    what:
      'The full financial disclosure the IRS uses to decide what you can actually afford to pay: assets, income, expenses, and what it believes it could collect from each.',
    who:
      'Individuals and self-employed people negotiating with IRS collections — an instalment agreement it will not grant automatically, a currently-not-collectible status, or an offer in compromise.',
    when:
      'When a revenue officer or a notice asks for it. The deadline is whatever the letter states, and extensions are usually negotiable if you ask before it passes rather than after.',
    gotcha:
      'Which sections apply depends on who you are, and the form says so on page one: wage earners complete sections 1, 2, 3, 4 and 5; self-employed people complete 1, 3, 4, 5, 6 and 7. Filling all seven, or the wrong set, is the usual mistake. The signature line also sits on page 6 of eight, so forms get mailed unsigned by anyone who skimmed to the end and stopped. Publication 1854 is the IRS’s own guide to preparing it.',
    tools: ['Fill PDF form', 'Redact PDF', 'Merge PDF', 'PDF to Excel'],
  },
  {
    slug: 'form-433-f',
    name: 'Form 433-F',
    short: '433-F',
    group: 'Collection and hardship',
    aka: 'the short collection information statement',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS forms search — the IRS publishes no "About Form 433-F" page',
    officialUrl: 'https://www.irs.gov/forms-instructions-and-publications?find=433-F&items_per_page=25',
    revisionLabel: 'Rev.',
    revision: 'Jul 2024',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/f433f.pdf',
    fields: 214,
    pages: 4,
    sensitive:
      'your Social Security number and your spouse’s, side by side on page one, above a summary of the household’s accounts and income',
    what:
      'The shorter collection information statement. It asks the same kind of questions as 433-A across four pages instead of eight, and is what most automated and telephone collection cases use.',
    who:
      'People working out a payment arrangement with IRS collections through the automated system or a call centre, rather than with an assigned revenue officer.',
    when:
      'When the IRS asks for it. Which of the two statements it wants depends on who is handling the case, so confirm before you start filling one in.',
    gotcha:
      'Sending the one the IRS did not ask for restarts the wait. A revenue officer who asked for 433-A will not accept 433-F, and the case sits while that gets sorted out. Page one is also the single most exposed page in this set: it asks for your Social Security number and your spouse’s together, so a joint household ends up with two SSNs on a document that then gets faxed or emailed to a collections office.',
    tools: ['Fill PDF form', 'Redact PDF', 'Compress to size', 'Scan to PDF'],
  },
  {
    slug: 'form-9465',
    name: 'Form 9465',
    short: '9465',
    group: 'Collection and hardship',
    aka: 'payment plan request, formerly the installment agreement request',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS page for Form 9465',
    officialUrl: 'https://www.irs.gov/forms-pubs/about-form-9465',
    revisionLabel: 'Rev.',
    revision: 'Dec 2026',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/f9465.pdf',
    fields: 32,
    pages: 1,
    sensitive:
      'your Social Security number together with your bank’s routing and account numbers, if you set up direct debit on the form',
    what:
      'The request to pay a tax balance in monthly instalments instead of all at once. One page, and it can be attached to the front of the return it relates to.',
    who:
      'Anyone who owes more than they can pay at filing time, and anyone whose balance is too large or whose situation too complicated for the IRS’s online application to handle.',
    when:
      'With the return, or after a bill arrives. Interest and penalties generally keep accruing while a plan is in place, so applying earlier costs less than applying later.',
    gotcha:
      'Two things. The IRS renamed it: the current revision is titled Payment Plan Request, while the IRS’s own "About Form 9465" page still says Installment Agreement Request, so a search turns up the old name and you cannot tell whether you have the current form. And the form opens by telling you not to use it — a tip at the top of page one says that if you owe $50,000 or less in combined tax, penalties and interest, you can usually set the plan up through the Online Payment Agreement application instead, for a lower user fee.',
    tools: ['Fill PDF form', 'Sign PDF', 'Merge PDF', 'Compress to size'],
  },

  // ── C. Returns and information returns ─────────────────────────────────────
  {
    slug: 'form-1040',
    name: 'Form 1040',
    short: '1040',
    group: 'Returns and information returns',
    aka: 'the individual income tax return',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS page for Form 1040',
    officialUrl: 'https://www.irs.gov/forms-pubs/about-form-1040',
    revisionLabel: 'Form year',
    revision: '2025',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/f1040.pdf',
    fields: 199,
    pages: 2,
    sensitive:
      'your Social Security number, your spouse’s and every dependant’s, alongside your income, your bank details for the refund and whatever the schedules add',
    what:
      'The annual individual income tax return: what you earned, what is deductible, what you already paid, and whether the difference is a refund or a bill.',
    who:
      'Most people with US income above the filing threshold, plus anyone who wants a refund of tax already withheld even when they are not required to file.',
    when:
      'For the previous calendar year, generally in the spring, with an extension available on request. Dates move and are occasionally extended, so confirm the current one with the IRS.',
    gotcha:
      'The two-page form is almost never the whole return. Anything beyond the simplest situation pulls in schedules — 1 for additional income and adjustments, 2 for additional taxes, 3 for credits, plus C, D, E or SE depending on what you do — and each is a separate PDF. The filing is the assembly job: people submit the 1040 and leave out the schedule that carries the number it refers to.',
    tools: ['Fill PDF form', 'Merge PDF', 'Redact PDF', 'PDF to Excel'],
  },
  {
    slug: 'form-1040-x',
    name: 'Form 1040-X',
    short: '1040-X',
    group: 'Returns and information returns',
    aka: 'amended individual return',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS page for Form 1040-X',
    officialUrl: 'https://www.irs.gov/forms-pubs/about-form-1040x',
    revisionLabel: 'Rev.',
    revision: 'Dec 2025',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/f1040x.pdf',
    fields: 166,
    pages: 2,
    sensitive:
      'the same identifiers as the original return, next to an explicit written explanation of what you got wrong the first time',
    what:
      'The amendment to a return you have already filed: three columns showing the original figure, the change, and the corrected figure, with a written explanation of why.',
    who:
      'Anyone who filed and then found something wrong — a missing 1099, the wrong filing status, a credit they were entitled to and did not claim.',
    when:
      'After the original return has been processed, not while it is in flight. There is a limit on how far back you can go to claim a refund, so check the current rule before assuming an old year is still open.',
    gotcha:
      'Column A is what you originally reported, not what you now think it should have been — people fill all three columns with corrected figures and the arithmetic of column B stops meaning anything. You also need the original return in front of you to complete it at all, which is the practical reason this one is so often started twice.',
    tools: ['Fill PDF form', 'Merge PDF', 'Compare PDF', 'Redact PDF'],
  },
  {
    slug: 'form-1099-nec',
    name: 'Form 1099-NEC',
    short: '1099-NEC',
    group: 'Returns and information returns',
    aka: 'non-employee compensation',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS page for Form 1099-NEC',
    officialUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-nec',
    revisionLabel: 'Rev.',
    revision: 'Dec 2026',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/f1099nec.pdf',
    fields: 140,
    pages: 6,
    sensitive:
      'the contractor’s taxpayer identification number and the total you paid them, which is why the W-9 you collected earlier exists',
    what:
      'The information return a business files to report what it paid an independent contractor, with a copy to the contractor so they can report the same figure.',
    who:
      'Businesses that paid a non-employee for services above the reporting threshold during the year. The contractor receives a copy; they do not file it.',
    when:
      'Early in the year following the payments, and the copy to the contractor is generally due before the copy to the IRS. Confirm the current dates — this one has moved.',
    gotcha:
      'Do not file the copy you downloaded. Copy A is printed in red for optical scanning, and the PDF on the IRS website is marked informational only — filing a printout of it can draw a penalty. Download it to see the layout, prepare your figures and give the contractor their copy; file the official one electronically or on the scannable stock. The second trap is timing: the IRS publishes these a year ahead, so check the year in the corner matches the year you are reporting.',
    tools: ['Fill PDF form', 'Merge PDF', 'Split PDF', 'PDF to Excel'],
  },
  {
    slug: 'form-1099-misc',
    name: 'Form 1099-MISC',
    short: '1099-MISC',
    group: 'Returns and information returns',
    aka: 'miscellaneous information',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS page for Form 1099-MISC',
    officialUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-misc',
    revisionLabel: 'Rev.',
    revision: 'Dec 2026',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/f1099msc.pdf',
    fields: 179,
    pages: 6,
    sensitive:
      'the recipient’s taxpayer identification number beside rent, royalty, prize or settlement amounts that say a good deal about the relationship',
    what:
      'The catch-all information return for payments that are not wages and not contractor fees: rent, royalties, prizes, medical payments, certain legal settlements.',
    who:
      'Businesses and landlords making those payments above the reporting thresholds. Recipients get a copy to reconcile against their own records.',
    when:
      'Early in the year after the payments. The deadline differs depending on which boxes you have filled in, so check rather than assuming it matches the NEC.',
    gotcha:
      'Contractor payments moved off this form onto the 1099-NEC, and people still reach for the MISC out of habit — it is the single commonest misfiling in this pair. Box 7 on the MISC no longer means non-employee compensation. The same red-ink warning applies: the downloaded Copy A is informational and is not scannable.',
    tools: ['Fill PDF form', 'Merge PDF', 'Split PDF', 'PDF to Excel'],
  },
  {
    slug: 'form-w-2',
    name: 'Form W-2',
    short: 'W-2',
    group: 'Returns and information returns',
    aka: 'wage and tax statement',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS page for Form W-2',
    officialUrl: 'https://www.irs.gov/forms-pubs/about-form-w-2',
    revisionLabel: 'Form year',
    revision: '2026',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/fw2.pdf',
    fields: 568,
    pages: 11,
    sensitive:
      'an employee’s Social Security number next to their full annual pay and every deduction taken from it — a complete picture of one person’s year',
    what:
      'The statement an employer issues to each employee and files with the Social Security Administration: wages paid and tax withheld for the year.',
    who:
      'Employers, for every employee. Employees receive it and use it to file; they never file the W-2 itself.',
    when:
      'Employers generally issue it to employees early in the new year and file their copies around the same time. Confirm the current dates with the IRS or the SSA.',
    gotcha:
      'The downloaded file carries a warning in its own text: Copy A appears in red like the official form but does not meet the SSA’s requirements for scanning, and filing a printout of it can draw a penalty. Use it to check the layout, not to file — the SSA’s Business Services Online will produce a fileable copy for free. The PDF is also eleven pages because it is the whole multi-copy package, not one form, which is why it has 568 fields.',
    tools: ['Fill PDF form', 'Split PDF', 'Redact PDF', 'Merge PDF'],
  },
  {
    slug: 'form-941',
    name: 'Form 941',
    short: '941',
    group: 'Returns and information returns',
    aka: 'quarterly federal tax return',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS page for Form 941',
    officialUrl: 'https://www.irs.gov/forms-pubs/about-form-941',
    revisionLabel: 'Rev.',
    revision: 'Mar 2026',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/f941.pdf',
    fields: 116,
    pages: 3,
    sensitive:
      'your employer identification number with the quarter’s full payroll and the tax deposited against it — the figures a payroll audit starts from',
    what:
      'The quarterly return reporting wages paid, tips reported, and the income tax and Social Security and Medicare tax withheld and owed for the quarter.',
    who:
      'Employers who withhold payroll tax, which is most of them. Some very small employers file annually on Form 944 instead, by IRS notification.',
    when:
      'Once a quarter, generally in the month after the quarter closes, with a short extra window if every deposit was made on time. Check the current calendar.',
    gotcha:
      'Filing the 941 is not paying the tax. Deposits run on their own schedule — monthly or semi-weekly depending on your lookback period — and the penalty for depositing late is separate from, and often larger than, anything to do with the return. The other trap is the revision: this form is revised mid-year more often than most, and the quarter you are reporting has to match the revision you are filing on.',
    tools: ['Fill PDF form', 'Merge PDF', 'PDF to Excel', 'Compare PDF'],
  },
  {
    slug: 'form-940',
    name: 'Form 940',
    short: '940',
    group: 'Returns and information returns',
    aka: 'annual FUTA return',
    authority: 'Internal Revenue Service',
    officialName: 'the IRS page for Form 940',
    officialUrl: 'https://www.irs.gov/forms-pubs/about-form-940',
    revisionLabel: 'Form year',
    revision: '2025',
    pdfUrl: 'https://www.irs.gov/pub/irs-pdf/f940.pdf',
    fields: 97,
    pages: 3,
    sensitive:
      'your employer identification number with the year’s total payroll and the state unemployment accounts you pay into',
    what:
      'The annual federal unemployment tax return. FUTA is paid by the employer alone — nothing comes out of anyone’s wages — and it funds unemployment benefits alongside the state schemes.',
    who:
      'Employers who paid wages above the FUTA threshold or had employees for enough weeks in the year. The thresholds are low enough that most employers with staff are in scope.',
    when:
      'Once a year, generally early in the following year, with a short extra window if the tax was deposited on time. Confirm the current date.',
    gotcha:
      'The credit for state unemployment tax is what makes the effective rate small, and it only applies to amounts you actually paid, on time, to the state. Pay the state late and the federal bill rises, which is a surprise nobody budgets for. Some states are also credit-reduction states in a given year, which raises the rate for employers there — that list changes annually and is published with the form.',
    tools: ['Fill PDF form', 'Merge PDF', 'PDF to Excel', 'Compress to size'],
  },

  // ── D. Immigration ─────────────────────────────────────────────────────────
  {
    slug: 'form-i-9',
    name: 'Form I-9',
    short: 'I-9',
    group: 'Immigration',
    aka: 'employment eligibility verification',
    authority: 'U.S. Citizenship and Immigration Services',
    officialName: 'the USCIS page for Form I-9',
    officialUrl: 'https://www.uscis.gov/i-9',
    revisionLabel: 'Edition date',
    revision: '01/20/25',
    pdfUrl: 'https://www.uscis.gov/sites/default/files/document/forms/i-9.pdf',
    fields: 128,
    pages: 4,
    sensitive:
      'an employee’s date of birth, Social Security number and immigration status, plus the identity documents an employer examined to verify them',
    what:
      'The form every US employer completes with every new hire to verify identity and authorisation to work. The employee fills section 1, the employer examines documents and completes section 2.',
    who:
      'Every employer and every employee hired in the United States, citizens included. It is not filed with any agency — the employer keeps it and produces it if inspected.',
    when:
      'Section 1 by the employee no later than their first day, section 2 by the employer within the first few days of work. Check the current rule, which depends on the length of the engagement.',
    gotcha:
      'It is never filed, and that is what people get wrong in both directions: new employers post it to USCIS, where nothing happens to it, and established ones store it inside the personnel file. It belongs in a separate I-9 file, because an inspection entitles the inspector to the I-9s and not to the rest of the personnel record. Retention runs from the later of three years after hire or one year after the employment ends, so a binder you never purge grows liability rather than protection.',
    tools: ['Fill PDF form', 'Sign PDF', 'Scan to PDF', 'Merge PDF'],
  },
  {
    slug: 'form-i-130',
    name: 'Form I-130',
    short: 'I-130',
    group: 'Immigration',
    aka: 'petition for alien relative',
    authority: 'U.S. Citizenship and Immigration Services',
    officialName: 'the USCIS page for Form I-130',
    officialUrl: 'https://www.uscis.gov/i-130',
    revisionLabel: 'Edition date',
    revision: '04/01/24',
    pdfUrl: 'https://www.uscis.gov/sites/default/files/document/forms/i-130.pdf',
    fields: 450,
    pages: 12,
    sensitive:
      'two people’s full identity and address histories and the evidence of their relationship — for a marriage petition, the private details of a marriage',
    what:
      'The petition that establishes a qualifying family relationship between a US citizen or permanent resident and a relative, which is the first step before that relative can apply for a visa or a green card.',
    who:
      'The US citizen or permanent resident, as petitioner, on behalf of a spouse, parent, child or sibling. The relative is the beneficiary and does not file it.',
    when:
      'Whenever the relationship exists and you want to start the process. Approval is only step one, and how long the rest takes depends on the category and the beneficiary’s country, so check the current visa bulletin rather than planning around a date.',
    gotcha:
      'Approval of the I-130 does not give anyone status, a visa or the right to enter — it establishes the relationship and puts the beneficiary in a queue, which for some categories and countries is years long. Families treat the approval notice as the finish line. Separately, the twelve pages ask for every address and employer for several years, and a gap in those histories is a very common reason for a request for evidence.',
    tools: ['Fill PDF form', 'Merge PDF', 'Compress to size', 'Scan to PDF'],
  },
  {
    slug: 'form-i-485',
    name: 'Form I-485',
    short: 'I-485',
    group: 'Immigration',
    aka: 'adjustment of status, the green card application',
    authority: 'U.S. Citizenship and Immigration Services',
    officialName: 'the USCIS page for Form I-485',
    officialUrl: 'https://www.uscis.gov/i-485',
    revisionLabel: 'Edition date',
    revision: '09/18/26',
    pdfUrl: 'https://www.uscis.gov/sites/default/files/document/forms/i-485.pdf',
    fields: 730,
    pages: 24,
    sensitive:
      'twenty-four pages covering your entire immigration history, every address and job, your medical examination and a long list of questions about arrests, affiliations and conduct',
    what:
      'The application to become a lawful permanent resident without leaving the United States. At 730 fields it is the longest form in this library by a distance.',
    who:
      'People already in the US with an approved or concurrently filed petition and a visa number available to them.',
    when:
      'Once a visa number is available in your category, which is what the monthly visa bulletin tells you. Filing before that generally gets the application rejected, so confirm the current bulletin.',
    gotcha:
      'Leaving the country while it is pending can be treated as abandoning it, unless advance parole was granted first — people take a family emergency trip and lose years of waiting. The form is also long enough that it is assembled over weeks across several sittings, which is precisely when the edition date slips: USCIS rejects an application filed on a superseded edition, so check the date in the footer against the USCIS page before you post it, not when you started.',
    tools: ['Fill PDF form', 'Merge PDF', 'Compress to size', 'Split PDF'],
  },
  {
    slug: 'form-i-765',
    name: 'Form I-765',
    short: 'I-765',
    group: 'Immigration',
    aka: 'employment authorization document application',
    authority: 'U.S. Citizenship and Immigration Services',
    officialName: 'the USCIS page for Form I-765',
    officialUrl: 'https://www.uscis.gov/i-765',
    revisionLabel: 'Edition date',
    revision: '08/21/25',
    pdfUrl: 'https://www.uscis.gov/sites/default/files/document/forms/i-765.pdf',
    fields: 161,
    pages: 7,
    sensitive:
      'your immigration status, your most recent entry details and your Social Security number, supporting an application that decides whether you may work',
    what:
      'The application for an Employment Authorization Document — the card that lets someone who is not a citizen or permanent resident work legally in the United States.',
    who:
      'People in a category that permits work with authorisation: adjustment-of-status applicants, certain students and dependants, asylum seekers after the waiting period, and others.',
    when:
      'As early as your category allows, and renewals well before the current card expires. Processing times move a great deal, so check the current USCIS estimate for your category.',
    gotcha:
      'The eligibility category code on the form decides nearly everything — the filing fee, whether a renewal is automatically extended while it is pending, and what evidence must come with it. Entering the wrong code is the commonest reason these come back. The gap between an expired card and a new one also stops employment on the day the card expires, not on the day the decision arrives, which is why the filing window matters more here than almost anywhere else.',
    tools: ['Fill PDF form', 'Passport & ID photo', 'Merge PDF', 'Compress to size'],
  },
  {
    slug: 'form-n-400',
    name: 'Form N-400',
    short: 'N-400',
    group: 'Immigration',
    aka: 'application for naturalization',
    authority: 'U.S. Citizenship and Immigration Services',
    officialName: 'the USCIS page for Form N-400',
    officialUrl: 'https://www.uscis.gov/n-400',
    revisionLabel: 'Edition date',
    revision: '01/20/25',
    pdfUrl: 'https://www.uscis.gov/sites/default/files/document/forms/n-400.pdf',
    fields: 440,
    pages: 14,
    sensitive:
      'every trip you have taken outside the country, your marital and tax history, and a long series of questions about conduct and affiliation going back years',
    what:
      'The application to become a US citizen by naturalisation, covering residence, physical presence, good moral character and the civics and English requirements.',
    who:
      'Lawful permanent residents who meet the residence requirement — commonly five years, or three for the spouse of a citizen — and the other eligibility conditions.',
    when:
      'Once you meet the residence requirement, with a short early-filing window before the anniversary. Confirm the current rule rather than counting from memory.',
    gotcha:
      'The trips list is where this one goes wrong. The form asks for every departure from the United States over the qualifying period, and long absences can break continuous residence even when the total days present still look sufficient. People reconstruct the list from memory, the passport stamps say something different at interview, and it becomes a question about candour rather than about travel.',
    tools: ['Fill PDF form', 'Passport & ID photo', 'Merge PDF', 'Compress to size'],
  },
  {
    slug: 'form-i-864',
    name: 'Form I-864',
    short: 'I-864',
    group: 'Immigration',
    aka: 'affidavit of support',
    authority: 'U.S. Citizenship and Immigration Services',
    officialName: 'the USCIS page for Form I-864',
    officialUrl: 'https://www.uscis.gov/i-864',
    revisionLabel: 'Edition date',
    revision: '08/24/26',
    pdfUrl: 'https://www.uscis.gov/sites/default/files/document/forms/i-864.pdf',
    fields: 219,
    pages: 12,
    sensitive:
      'the sponsor’s income, household size and tax returns or transcripts — a full financial disclosure by somebody who is not the applicant',
    what:
      'The legally enforceable promise by a sponsor to support an intending immigrant financially, so that the immigrant is not found likely to become a public charge.',
    who:
      'The petitioning relative, and a joint sponsor as well where the petitioner’s income does not reach the required level for their household size.',
    when:
      'With the immigrant visa or adjustment application it supports. The income threshold is republished annually, so check the current table rather than last year’s.',
    gotcha:
      'It is a contract, not a formality. The obligation is enforceable by the immigrant and by any agency that provides them a means-tested benefit, and it does not end at divorce — it runs until the immigrant works enough qualifying quarters, naturalises, leaves permanently, or dies. Sponsors sign it understanding it as a character reference. The supporting evidence also trips people: the most recent tax return or an IRS transcript is required, which is where Form 4506-T usually comes in.',
    tools: ['Fill PDF form', 'Merge PDF', 'Redact PDF', 'Compress to size'],
  },

  // ── E. Employment, leave and veterans ──────────────────────────────────────
  {
    slug: 'form-wh-380-e',
    name: 'Form WH-380-E',
    short: 'WH-380-E',
    group: 'Employment, leave and veterans',
    aka: 'FMLA certification, your own health condition',
    authority: 'U.S. Department of Labor',
    officialName: 'the Department of Labor’s FMLA forms page',
    officialUrl: 'https://www.dol.gov/agencies/whd/fmla/forms',
    revisionLabel: 'Revised',
    revision: 'June 2020',
    pdfUrl: 'https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/WH-380-E.pdf',
    fields: 60,
    pages: 4,
    sensitive:
      'a doctor’s written description of your medical condition, its treatment and what it stops you doing — handed to your employer',
    what:
      'The medical certification supporting leave under the Family and Medical Leave Act for an employee’s own serious health condition. The health care provider completes the clinical part.',
    who:
      'Employees requesting FMLA leave for themselves, where the employer has asked for certification — which it is entitled to do.',
    when:
      'Generally within a short window after the employer requests it, with more notice expected when the leave is foreseeable. The employer’s own notice states the period, so check it.',
    gotcha:
      'This is the most medically revealing document most people ever hand an employer, and the rules on who may see it are specific: it is a confidential medical record, kept separately from the personnel file, and your direct manager is generally not among the people entitled to read it. Employees hand it to their line manager because that is who asked. Send it to HR or whoever the employer’s notice names, and redact anything the form does not actually ask for.',
    tools: ['Fill PDF form', 'Redact PDF', 'Scan to PDF', 'Compress to size'],
  },
  {
    slug: 'form-wh-380-f',
    name: 'Form WH-380-F',
    short: 'WH-380-F',
    group: 'Employment, leave and veterans',
    aka: 'FMLA certification, a family member’s condition',
    authority: 'U.S. Department of Labor',
    officialName: 'the Department of Labor’s FMLA forms page',
    officialUrl: 'https://www.dol.gov/agencies/whd/fmla/forms',
    revisionLabel: 'Revised',
    revision: 'June 2020',
    pdfUrl: 'https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/WH-380-F.pdf',
    fields: 66,
    pages: 4,
    sensitive:
      'somebody else’s medical condition and the care they need — a relative’s private health information travelling through your employer',
    what:
      'The certification supporting FMLA leave taken to care for a spouse, child or parent with a serious health condition, completed by that person’s health care provider.',
    who:
      'Employees taking leave to care for a qualifying family member, where the employer has requested certification.',
    when:
      'Generally within a short window after the request, with advance notice expected where the need is foreseeable. The employer’s notice states the period — check it rather than assuming.',
    gotcha:
      'Which relatives count is narrower than families expect: spouse, parent and child, with the child generally under eighteen unless incapable of self-care. A parent-in-law, a grandparent or a sibling does not qualify, and people discover this after the leave has been taken. The form also describes a third party’s health, so the person whose condition it is should see what is written on it before it reaches an employer.',
    tools: ['Fill PDF form', 'Redact PDF', 'Scan to PDF', 'Merge PDF'],
  },
  {
    slug: 'form-wh-381',
    name: 'Form WH-381',
    short: 'WH-381',
    group: 'Employment, leave and veterans',
    aka: 'FMLA notice of eligibility and rights',
    authority: 'U.S. Department of Labor',
    officialName: 'the Department of Labor’s FMLA forms page',
    officialUrl: 'https://www.dol.gov/agencies/whd/fmla/forms',
    revisionLabel: 'Revised',
    revision: 'June 2020',
    pdfUrl: 'https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/WH-381.pdf',
    fields: 72,
    pages: 4,
    sensitive:
      'the employee’s leave entitlement and the conditions attached to it, which is the written record if the handling of that leave is ever disputed',
    what:
      'The notice an employer gives an employee who has requested FMLA leave: whether they are eligible, what their rights and responsibilities are, and what the employer requires of them.',
    who:
      'Employers, to the employee. It runs the other way from the certifications — the employee does not complete it.',
    when:
      'Generally within a few business days of the employer learning that leave may be FMLA-qualifying. Check the current rule, which also covers what happens when circumstances change.',
    gotcha:
      'It says in capitals on page one not to send it to the Department of Labor, because it is given to the employee. Employers post it anyway. The substantive risk is different: failing to give this notice, or giving it late, can itself interfere with the employee’s rights regardless of how the leave was eventually handled — the notice is not paperwork around the decision, it is part of the decision.',
    tools: ['Fill PDF form', 'Sign PDF', 'Merge PDF', 'Compress to size'],
  },
  {
    slug: 'form-21-526ez',
    name: 'VA Form 21-526EZ',
    short: '21-526EZ',
    group: 'Employment, leave and veterans',
    aka: 'VA disability compensation claim',
    authority: 'U.S. Department of Veterans Affairs',
    officialName: 'the VA page for Form 21-526EZ',
    officialUrl: 'https://www.va.gov/find-forms/about-form-21-526ez/',
    revisionLabel: 'Form date',
    revision: 'Jan 2026',
    pdfUrl: 'https://www.vba.va.gov/pubs/forms/VBA-21-526EZ-ARE.pdf',
    fields: 345,
    pages: 15,
    sensitive:
      'your service history alongside the medical conditions you are claiming and the treatment you have had for them, including mental health care',
    what:
      'The application for VA disability compensation: the conditions claimed, how they connect to service, and the treatment records that support them.',
    who:
      'Veterans claiming compensation for a condition incurred in or aggravated by service, and those filing for an increase in an existing rating.',
    when:
      'Any time after service. Filing an intent to file first generally preserves an earlier effective date while you gather evidence, which is worth checking before you submit.',
    gotcha:
      'The effective date is usually worth more than anything else on the form, and it is set by when the VA received a claim or an intent to file — not by when the condition began. Veterans spend months assembling records and lose months of backdated compensation they could have preserved with an intent to file on day one. The Fully Developed Claim route is also faster only if the evidence really is complete; submitting as fully developed without it is slower than filing normally.',
    tools: ['Fill PDF form', 'Merge PDF', 'Compress to size', 'Redact PDF'],
  },
  {
    slug: 'form-ss-5',
    name: 'Form SS-5',
    short: 'SS-5',
    group: 'Employment, leave and veterans',
    aka: 'application for a Social Security card',
    authority: 'Social Security Administration',
    officialName: 'the SSA page for Form SS-5',
    officialUrl: 'https://www.ssa.gov/forms/ss-5.html',
    revisionLabel: 'Form date',
    revision: '12-2024',
    pdfUrl: 'https://www.ssa.gov/forms/ss-5.pdf',
    fields: 70,
    pages: 5,
    sensitive:
      'your place of birth, your parents’ names and their Social Security numbers — the answers to half the security questions ever asked',
    what:
      'The application for a Social Security number and card: a first card, a replacement, or a change of name or other detail on the record.',
    who:
      'People applying for a first number, replacing a lost card, or correcting the record after a marriage, divorce or legal name change.',
    when:
      'Whenever one of those applies. The SSA generally limits how many replacement cards it will issue, so check before requesting one you do not need.',
    gotcha:
      'The card is free and always has been, which is worth knowing because a search for it returns paid services that charge to pass the same form along. The documents are what matter: the SSA wants originals or copies certified by the issuing agency, not photocopies or notarised copies, and it returns them. Many changes also need two documents — one proving identity in the new name and one in the old — which is the detail that sends people home from the office.',
    tools: ['Fill PDF form', 'Scan to PDF', 'Merge PDF', 'Redact PDF'],
  },
];

/** The version marker as a readable clause, because the five agencies do not
 *  mean the same thing by it. "The rev. the IRS publishes today" is not
 *  English; "the edition date USCIS publishes today" is, and it is also the
 *  fact that decides whether a USCIS form is accepted at all. */
export function revisionSentence(f: UsForm): string {
  switch (f.revisionLabel) {
    case 'Form year':
      return `This is the ${f.revision} form`;
    case 'Edition date':
      return `The edition ${f.authority} publishes today is dated ${f.revision}, and an application filed on a superseded edition is rejected`;
    case 'Revised':
      return `It was last revised in ${f.revision}`;
    case 'Form date':
      return `The version ${f.authority} publishes today is dated ${f.revision}`;
    default:
      return `The revision ${f.authority} publishes today is ${f.revision}`;
  }
}

/** Heading for the provenance strip — the agency's own noun, no trailing dot. */
export const revisionHeading = (f: UsForm): string => (f.revisionLabel === 'Rev.' ? 'Revision' : f.revisionLabel);

export const US_FORM_GROUPS = US_FORMS.map((f) => f.group).filter((g, i, a) => a.indexOf(g) === i);
export const getUsForm = (slug: string) => US_FORMS.find((f) => f.slug === slug);
