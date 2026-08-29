// Indian statutory forms — the content family pdf.net cannot take from us,
// because they own the US set and nobody owns this one.
//
// ── The rule that shapes every page here ──────────────────────────────────────
// We do NOT host the official PDF. Government forms are revised without notice
// and a stale copy served from our domain is worse than no copy: someone files
// last year's form and finds out months later. Every page links to the issuing
// authority and says plainly that the authority's copy is the current one.
//
// ── And the honest framing ────────────────────────────────────────────────────
// Most of these are filed ONLINE now. ITRs are e-filed, EPF claims go through
// the UAN portal, GST returns are filed on the GST portal. A page that pretends
// you download a PDF and fill it in would be wrong about the main thing it is
// describing.
//
// What people actually do is work on the PDFs AROUND the filing: two Form 16s to
// combine, a 26AS to reconcile, proofs to scan and squeeze under a payroll
// portal's upload cap, a statement to turn into rows. That is where our tools
// belong, and it is what each page says.
//
// Deadlines and thresholds change every year and are extended more often than
// not, so no page states one as a fixed fact — the copy points at the portal.
// tests/unit/india-forms.test.ts enforces that.

export type IndiaForm = {
  slug: string;
  /** Full name as people write it: "Form 16", "ITR-1 (Sahaj)". */
  name: string;
  /** Short label for titles, kept inside the 60-char budget. */
  short: string;
  /** Section heading on the index page. */
  group: string;
  /** Extra search alias woven into the copy. */
  aka?: string;
  /** Who issues or governs it. */
  authority: string;
  /** Where the current version actually lives, in words. */
  officialName: string;
  /** The authority's own site — never a copy hosted by us. */
  officialUrl: string;
  what: string;
  who: string;
  when: string;
  /** The thing people get wrong. The reason the page is worth linking to. */
  gotcha: string;
  /** Catalogue tool NAMES — matched exactly, guarded by a test. */
  tools: string[];
};

export const INDIA_FORMS: IndiaForm[] = [
  {
    slug: 'form-16', name: 'Form 16', short: 'Form 16', group: 'Income tax',
    aka: 'TDS certificate on salary',
    authority: 'Income Tax Department (CBDT)',
    officialName: 'TRACES / your employer',
    officialUrl: 'https://www.incometax.gov.in/',
    what:
      'The certificate your employer issues showing the salary paid to you and the tax deducted from it. Part A comes from TRACES and carries the quarterly TDS summary; Part B is the salary breakup and the deductions your employer allowed.',
    who:
      'Every salaried employee whose employer deducted TDS. You do not apply for it — the employer issues it.',
    when:
      'Employers generally issue it after the annual TDS return is filed, which for most people means around June for the previous financial year. Dates shift; your payroll team will confirm.',
    gotcha:
      'Two employers in one year means two Form 16s, and people file with only the second one. The second employer usually knows nothing about the first one\'s salary, so the exemption limit gets applied twice and the return under-reports tax. Combine both before you start, and reconcile against Form 26AS.',
    tools: ['Merge PDF', 'Compress to size', 'Redact PDF', 'PDF to Excel'],
  },
  {
    slug: 'form-16a', name: 'Form 16A', short: 'Form 16A', group: 'Income tax',
    aka: 'TDS certificate on income other than salary',
    authority: 'Income Tax Department (CBDT)',
    officialName: 'TRACES',
    officialUrl: 'https://www.incometax.gov.in/',
    what:
      'The TDS certificate for income that is not salary — bank interest, professional fees, rent, commission. Issued quarterly by whoever deducted the tax.',
    who:
      'Anyone who received a payment with tax deducted at source outside of salary: freelancers, consultants, landlords, and depositors whose interest crossed the TDS threshold.',
    when:
      'Issued quarterly, generally about a fortnight after the deductor\'s TDS return for that quarter. Check with the deductor rather than assuming a date.',
    gotcha:
      'A freelancer with eight clients ends up with dozens of these across four quarters, and the total in them has to agree with Form 26AS. The usual error is missing one certificate entirely, so the tax credit claimed is short and the refund shrinks.',
    tools: ['Merge PDF', 'PDF to Excel', 'Compress to size', 'Split PDF'],
  },
  {
    slug: 'form-26as', name: 'Form 26AS', short: 'Form 26AS', group: 'Income tax',
    aka: 'Annual tax statement',
    authority: 'Income Tax Department (CBDT)',
    officialName: 'the income tax e-filing portal',
    officialUrl: 'https://www.incometax.gov.in/',
    what:
      'Your consolidated tax statement: every rupee of TDS credited against your PAN, advance tax and self-assessment tax you paid, and refunds issued.',
    who:
      'Every PAN holder. You download it yourself from the e-filing portal; nobody sends it to you.',
    when:
      'Available all year and updated as deductors file their returns, so it typically keeps changing during the filing season. Download it again just before you file rather than relying on a copy you took earlier.',
    gotcha:
      'The whole point is reconciliation: what you claim as TDS must match what appears here. If a deductor filed late or used the wrong PAN, the credit is missing and the return will be short. Chase the deductor — you cannot fix it from your side.',
    tools: ['PDF to Excel', 'Compress to size', 'Redact PDF', 'Merge PDF'],
  },
  {
    slug: 'ais', name: 'Annual Information Statement (AIS)', short: 'AIS', group: 'Income tax',
    aka: 'AIS and TIS',
    authority: 'Income Tax Department (CBDT)',
    officialName: 'the income tax e-filing portal (Compliance section)',
    officialUrl: 'https://www.incometax.gov.in/',
    what:
      'A much wider statement than Form 26AS: interest, dividends, securities and mutual fund transactions, foreign remittances and more, gathered from the entities that reported them. The TIS is its summarised sibling.',
    who:
      'Every PAN holder, downloadable from the Compliance section of the e-filing portal.',
    when:
      'Available year round and revised as reporting entities submit information, including after you have already filed.',
    gotcha:
      'AIS shows what was reported about you, not what is necessarily correct. Entries do turn out to be wrong, and there is a feedback mechanism for exactly that. Ignoring a mismatch is what triggers a notice, so read it before filing rather than after.',
    tools: ['PDF to Excel', 'Compress to size', 'Redact PDF', 'PDF to Text'],
  },
  {
    slug: 'itr-1', name: 'ITR-1 (Sahaj)', short: 'ITR-1', group: 'Income tax',
    aka: 'Sahaj',
    authority: 'Income Tax Department (CBDT)',
    officialName: 'the income tax e-filing portal',
    officialUrl: 'https://www.incometax.gov.in/',
    what:
      'The simplest return form, meant for a resident individual with salary or pension, one house property, and other income such as bank interest, within the prescribed income limit.',
    who:
      'Salaried residents with straightforward affairs. It is not available if you have capital gains beyond the limited exception, more than one house property, business income, or are a director or hold unlisted shares.',
    when:
      'The return is filed after the financial year ends. Due dates are set each year and are extended more often than not — check the portal rather than a last year\'s article.',
    gotcha:
      'People pick ITR-1 because it is the shortest, then discover mid-way that a capital gain or a second property disqualifies them. Choosing the wrong form makes the return defective, and a defective return is treated as not filed if it is not corrected in time.',
    tools: ['Merge PDF', 'Compress to size', 'Sign PDF', 'Protect PDF'],
  },
  {
    slug: 'itr-2', name: 'ITR-2', short: 'ITR-2', group: 'Income tax',
    authority: 'Income Tax Department (CBDT)',
    officialName: 'the income tax e-filing portal',
    officialUrl: 'https://www.incometax.gov.in/',
    what:
      'The return for individuals and Hindu Undivided Families who do not have income from a business or profession — capital gains, more than one house property, foreign income or foreign assets all land here.',
    who:
      'Salaried people with capital gains, people with several properties, residents holding foreign assets, and directors of companies.',
    when:
      'Filed after the financial year closes, on dates notified each year and extended more often than not — check the portal rather than a previous season’s article.',
    gotcha:
      'The schedules are where returns go wrong: capital gains have to be split by asset and holding period, and foreign assets have their own schedule with serious consequences for omission. Keep the broker statements and reconcile before you start rather than during.',
    tools: ['PDF to Excel', 'Merge PDF', 'Compress to size', 'Bank statement to Excel'],
  },
  {
    slug: 'itr-3', name: 'ITR-3', short: 'ITR-3', group: 'Income tax',
    authority: 'Income Tax Department (CBDT)',
    officialName: 'the income tax e-filing portal',
    officialUrl: 'https://www.incometax.gov.in/',
    what:
      'The return for individuals and HUFs carrying on a business or profession, including partners in a firm. It carries full financial statements and, where applicable, an audit report.',
    who:
      'Professionals, proprietors and partners in a firm — anyone whose income includes receipts from a business or a profession rather than only salary.',
    when:
      'Due dates differ depending on whether an audit applies, and they are notified each year.',
    gotcha:
      'This is the form where books actually matter. The balance sheet and profit and loss schedules have to tie to your accounts, and a mismatch against GST turnover is a common trigger for questions.',
    tools: ['Bank statement to Excel', 'PDF to Excel', 'Merge PDF', 'Compress to size'],
  },
  {
    slug: 'itr-4', name: 'ITR-4 (Sugam)', short: 'ITR-4', group: 'Income tax',
    aka: 'Sugam',
    authority: 'Income Tax Department (CBDT)',
    officialName: 'the income tax e-filing portal',
    officialUrl: 'https://www.incometax.gov.in/',
    what:
      'The return for those declaring income on a presumptive basis under the relevant sections, rather than maintaining full books.',
    who:
      'Small businesses and professionals within the prescribed turnover or receipts limits who opt for presumptive taxation.',
    when:
      'Filed after the financial year ends, on dates notified annually and often extended — the portal is the place to check, not last season\u2019s guidance.',
    gotcha:
      'Presumptive taxation comes with a lock-in: opting out in a later year can bar you from opting back in for several years and can bring an audit requirement with it. That consequence is not visible on the form itself.',
    tools: ['Bank statement to Excel', 'Merge PDF', 'Compress to size', 'PDF to Excel'],
  },
  {
    slug: 'form-15g', name: 'Form 15G', short: 'Form 15G', group: 'Income tax',
    aka: 'declaration to avoid TDS on interest',
    authority: 'Income Tax Department (CBDT)',
    officialName: 'your bank, or the income tax portal',
    officialUrl: 'https://www.incometax.gov.in/',
    what:
      'A self-declaration that your total income for the year will be below the taxable limit, so the bank should not deduct tax from your interest.',
    who:
      'Residents below 60 whose estimated total income is under the taxable limit. It is a declaration, not an application — nobody approves it.',
    when:
      'Generally given to each bank near the start of the financial year; it lapses at the end of that year and has to be given again for the next one.',
    gotcha:
      'It is a declaration you sign, and a false one carries consequences under the Income-tax Act. If your income does turn out to be taxable, the tax is still due — you have only stopped it being collected at source.',
    tools: ['Fill PDF form', 'Sign PDF', 'Compress to size', 'Merge PDF'],
  },
  {
    slug: 'form-15h', name: 'Form 15H', short: 'Form 15H', group: 'Income tax',
    aka: 'senior citizen declaration to avoid TDS',
    authority: 'Income Tax Department (CBDT)',
    officialName: 'your bank, or the income tax portal',
    officialUrl: 'https://www.incometax.gov.in/',
    what:
      'The senior citizens\' version of Form 15G: a declaration that the tax on your estimated total income will be nil, so no tax should be deducted from your interest.',
    who:
      'Residents aged 60 and above. The test differs from Form 15G\'s — it turns on the tax being nil rather than on income being below the limit.',
    when:
      'Usually submitted to each bank near the start of the financial year, and generally valid only for that year, so it has to be given again for the next one.',
    gotcha:
      'One form per bank, and often per branch or per deposit — people submit it at their main branch and are surprised when another bank still deducts. Keep a copy of each one you hand in.',
    tools: ['Fill PDF form', 'Sign PDF', 'Merge PDF', 'Compress to size'],
  },
  {
    slug: 'form-10e', name: 'Form 10E', short: 'Form 10E', group: 'Income tax',
    aka: 'relief for salary arrears',
    authority: 'Income Tax Department (CBDT)',
    officialName: 'the income tax e-filing portal',
    officialUrl: 'https://www.incometax.gov.in/',
    what:
      'The form that supports a claim for relief where salary arrears or advance salary have pushed you into a higher bracket in the year you received them.',
    who:
      'Anyone claiming relief under the arrears provision — commonly government employees after a pay commission, and anyone paid a large backdated settlement.',
    when:
      'Filed on the portal before the return in which the relief is claimed — the order matters, and it is generally checked automatically.',
    gotcha:
      'The relief is disallowed if this form is not filed first. People claim it in the return, skip the form, and receive an intimation reversing the relief — which then has to be sorted out afterwards rather than avoided.',
    tools: ['Merge PDF', 'Compress to size', 'PDF to Excel', 'Sign PDF'],
  },
  {
    slug: 'form-12bb', name: 'Form 12BB', short: 'Form 12BB', group: 'Income tax',
    aka: 'employee investment declaration',
    authority: 'Income Tax Department (CBDT)',
    officialName: 'your employer\'s payroll team',
    officialUrl: 'https://www.incometax.gov.in/',
    what:
      'The statement you give your employer listing the deductions and exemptions you intend to claim — rent, home loan interest, investments, leave travel — so the right amount of TDS is deducted from your salary.',
    who:
      'Salaried employees, once a year, submitted to the employer rather than to the department.',
    when:
      'Usually collected by payroll in the last quarter of the financial year, with proofs attached.',
    gotcha:
      'This is the moment the proofs get scanned and emailed, and the attachments are rent receipts with a landlord\'s PAN, loan statements and bank details. Payroll portals cap the upload size, which is how those documents end up going through a random online compressor.',
    tools: ['Merge PDF', 'Compress to size', 'Scan to PDF', 'Redact PDF'],
  },
  {
    slug: 'form-49a', name: 'Form 49A', short: 'Form 49A', group: 'PAN & identity',
    aka: 'PAN application for Indian citizens',
    authority: 'Income Tax Department, via Protean (NSDL) and UTIITSL',
    officialName: 'Protean eGov or UTIITSL',
    officialUrl: 'https://www.incometax.gov.in/',
    what:
      'The application for a Permanent Account Number by an Indian citizen, and the same form used to request corrections to an existing PAN.',
    who:
      'Indian citizens, Indian companies and entities formed in India, applying for a new PAN or correcting one.',
    when:
      'Any time. A PAN is needed before many financial transactions, so it is usually the first form in a sequence rather than a deadline-driven one.',
    gotcha:
      'The name has to match your proof of identity exactly, including initials and their expansion. A mismatch between PAN and Aadhaar is the single most common reason a PAN later becomes inoperative, and fixing it afterwards is slower than getting it right now.',
    tools: ['Fill PDF form', 'Passport & ID photo', 'Scan to PDF', 'Compress to size'],
  },
  {
    slug: 'form-49aa', name: 'Form 49AA', short: 'Form 49AA', group: 'PAN & identity',
    aka: 'PAN application for foreign citizens',
    authority: 'Income Tax Department, via Protean (NSDL) and UTIITSL',
    officialName: 'Protean eGov or UTIITSL',
    officialUrl: 'https://www.incometax.gov.in/',
    what:
      'The PAN application for individuals and entities who are not Indian citizens, including foreign companies and certain investors.',
    who:
      'Foreign nationals, foreign entities, and NRIs where the applicable rules require this form rather than Form 49A.',
    when:
      'Any time, though it typically has to be completed before an investment or an account can be opened.',
    gotcha:
      'The documents accepted as proof are different from Form 49A\'s, and for some applicants they must be attested — by an apostille, a consulate, or a specified authority. Sending an unattested copy is the usual cause of a rejection weeks later.',
    tools: ['Passport & ID photo', 'Scan to PDF', 'Merge PDF', 'Compress to size'],
  },
  {
    slug: 'gstr-1', name: 'GSTR-1', short: 'GSTR-1', group: 'GST',
    aka: 'outward supplies return',
    authority: 'Goods and Services Tax Network (GSTN)',
    officialName: 'the GST portal',
    officialUrl: 'https://www.gst.gov.in/',
    what:
      'The return reporting your outward supplies — invoice-level sales data that flows into your buyers\' input tax credit.',
    who:
      'Registered taxpayers other than those under the composition scheme and certain specified categories.',
    when:
      'Monthly or quarterly depending on your turnover and the scheme you have opted into, on due dates published on the portal.',
    gotcha:
      'Your buyers\' credit depends on what you file here. An invoice missed or entered against the wrong GSTIN is not just your problem — the customer chases it, and correcting it in a later period is slower than getting it right.',
    tools: ['PDF to Excel', 'Merge PDF', 'Compress to size', 'CSV cleaner'],
  },
  {
    slug: 'gstr-3b', name: 'GSTR-3B', short: 'GSTR-3B', group: 'GST',
    aka: 'summary return and tax payment',
    authority: 'Goods and Services Tax Network (GSTN)',
    officialName: 'the GST portal',
    officialUrl: 'https://www.gst.gov.in/',
    what:
      'The summary return where tax is actually paid: outward supplies, input tax credit claimed, and the liability discharged for the period.',
    who:
      'Most registered taxpayers, whether or not there was any activity in the period.',
    when:
      'Monthly or quarterly depending on the scheme you are under, on due dates published on the portal. Late filing generally attracts interest and a late fee, and blocks the next period.',
    gotcha:
      'A nil return still has to be filed. Dormant registrations are where the late fees quietly accumulate, and the portal will not let you file a later period until the earlier one is done.',
    tools: ['PDF to Excel', 'Compress to size', 'Merge PDF', 'Bank statement to Excel'],
  },
  {
    slug: 'gstr-9', name: 'GSTR-9', short: 'GSTR-9', group: 'GST',
    aka: 'annual GST return',
    authority: 'Goods and Services Tax Network (GSTN)',
    officialName: 'the GST portal',
    officialUrl: 'https://www.gst.gov.in/',
    what:
      'The annual consolidation of the returns you filed during the year, reconciling outward supplies, input tax credit and tax paid.',
    who:
      'Registered taxpayers above the turnover threshold at which the annual return is required; the threshold is notified and has changed more than once.',
    when:
      'After the financial year ends, on a date notified each year and frequently extended.',
    gotcha:
      'This is a reconciliation, not a fresh return, and the differences it surfaces between GSTR-1, GSTR-3B and the books are what get asked about later. Reconcile before filing rather than explaining afterwards.',
    tools: ['PDF to Excel', 'Compare PDF', 'Merge PDF', 'Compress to size'],
  },
  {
    slug: 'epf-form-19', name: 'EPF Form 19', short: 'Form 19', group: 'EPF',
    aka: 'PF final settlement',
    authority: 'Employees\' Provident Fund Organisation (EPFO)',
    officialName: 'the EPFO member portal (UAN)',
    officialUrl: 'https://www.epfindia.gov.in/',
    what:
      'The claim to withdraw the full provident fund balance when the account is being closed — typically after leaving employment and not rejoining.',
    who:
      'Members closing their PF account. Where the UAN is seeded with Aadhaar and the bank account, the claim is made online rather than on paper.',
    when:
      'After leaving service, subject to the waiting period that applies to a final settlement.',
    gotcha:
      'Claims are rejected far more often for mismatched details than for eligibility — a name that differs between the PF record, Aadhaar and the bank, or a date of exit the employer never marked. Fix the record before claiming, not after a rejection.',
    tools: ['Scan to PDF', 'Compress to size', 'Merge PDF', 'Passport & ID photo'],
  },
  {
    slug: 'epf-form-10c', name: 'EPF Form 10C', short: 'Form 10C', group: 'EPF',
    aka: 'pension withdrawal benefit',
    authority: 'Employees\' Provident Fund Organisation (EPFO)',
    officialName: 'the EPFO member portal (UAN)',
    officialUrl: 'https://www.epfindia.gov.in/',
    what:
      'The claim relating to the pension portion of your PF — the withdrawal benefit or the scheme certificate, as opposed to the provident fund balance itself.',
    who:
      'Members whose service is below the length at which pension becomes payable, and who are claiming the withdrawal benefit or preserving service through a scheme certificate.',
    when:
      'Generally made alongside or after the final settlement claim, and the two are usually raised together on the member portal.',
    gotcha:
      'Taking the withdrawal benefit ends the service that would have counted towards pension. A scheme certificate preserves it instead, which is usually the better choice if you expect to return to covered employment — and that choice is not obvious from the form.',
    tools: ['Scan to PDF', 'Compress to size', 'Merge PDF', 'Sign PDF'],
  },
  {
    slug: 'epf-form-31', name: 'EPF Form 31', short: 'Form 31', group: 'EPF',
    aka: 'PF partial withdrawal / advance',
    authority: 'Employees\' Provident Fund Organisation (EPFO)',
    officialName: 'the EPFO member portal (UAN)',
    officialUrl: 'https://www.epfindia.gov.in/',
    what:
      'The claim for a partial withdrawal from your PF while still employed — for specified purposes such as housing, medical treatment, education or marriage.',
    who:
      'Serving members who meet the conditions for the purpose being claimed. Each purpose carries its own eligibility and its own limit.',
    when:
      'Any time the conditions for that purpose are met; there is no annual window.',
    gotcha:
      'The purpose you select decides both the limit and the documents required, and picking the wrong one is the usual reason a claim comes back. Read the conditions for that specific purpose before selecting it, not after.',
    tools: ['Scan to PDF', 'Merge PDF', 'Compress to size', 'Fill PDF form'],
  },
  {
    slug: 'epf-form-13', name: 'EPF Form 13', short: 'Form 13', group: 'EPF',
    aka: 'PF transfer on changing jobs',
    authority: 'Employees\' Provident Fund Organisation (EPFO)',
    officialName: 'the EPFO member portal (UAN)',
    officialUrl: 'https://www.epfindia.gov.in/',
    what:
      'The request to transfer a provident fund balance from a previous employer\'s account to the current one, rather than withdrawing it.',
    who:
      'Anyone changing jobs who wants continuity of service and balance. With a seeded UAN this is usually raised online.',
    when:
      'Raised after joining the new employer, once the new account is active — the sooner the better, since an unclaimed old account is easy to forget.',
    gotcha:
      'Withdrawing instead of transferring breaks continuous service, and continuous service is what decides both pension eligibility and whether the withdrawal is taxable. The convenient option is frequently the expensive one.',
    tools: ['Scan to PDF', 'Merge PDF', 'Compress to size', 'PDF viewer'],
  },
];

export const FORM_GROUPS = INDIA_FORMS.map((f) => f.group).filter((g, i, a) => a.indexOf(g) === i);
export const getForm = (slug: string) => INDIA_FORMS.find((f) => f.slug === slug);
