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
  /** The revision as the authority states it, e.g. "Mar 2024", "2026". */
  revision: string;
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
    revision: 'Mar 2024',
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
    revision: '2026',
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
    revision: 'Dec 2024',
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
    revision: 'Dec 2025',
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
    revision: 'Jan 2021',
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
    revision: 'Jan 2021',
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
    revision: 'Feb 2021',
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
    revision: 'Apr 2025',
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
    revision: 'Dec 2023',
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
    revision: 'Jun 2026',
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
    revision: 'Jul 2024',
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
    revision: 'Dec 2026',
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
];

export const US_FORM_GROUPS = US_FORMS.map((f) => f.group).filter((g, i, a) => a.indexOf(g) === i);
export const getUsForm = (slug: string) => US_FORMS.find((f) => f.slug === slug);
