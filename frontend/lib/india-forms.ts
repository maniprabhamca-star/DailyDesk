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
    officialUrl: 'https://www.epfo.gov.in/',
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
    officialUrl: 'https://www.epfo.gov.in/',
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
    officialUrl: 'https://www.epfo.gov.in/',
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
    officialUrl: 'https://www.epfo.gov.in/',
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

  // ---- second tranche, 2026-08-29 --------------------------------------------
  // Aadhaar, the MCA company filings, GST registration and the banking
  // declarations. Same two rules: no hosted copies, no deadline stated as fact.
  {
    slug: 'aadhaar-enrolment', name: 'Aadhaar enrolment form', short: 'Aadhaar enrolment', group: 'PAN & identity',
    aka: 'new Aadhaar application',
    authority: 'Unique Identification Authority of India (UIDAI)',
    officialName: 'an authorised enrolment centre',
    officialUrl: 'https://uidai.gov.in/',
    what:
      'The application for a new Aadhaar number, completed at an enrolment centre where your photograph, fingerprints and iris scan are captured on the spot.',
    who:
      'Residents applying for Aadhaar for the first time, including children, who are enrolled with a parent as the introducer where required.',
    when:
      'Any time, at an enrolment centre. Biometrics are captured there, so it generally cannot be completed entirely online.',
    gotcha:
      'The name and date of birth you give here become the reference every other record is checked against for the rest of your life — bank KYC, PAN, EPF, passport. A spelling that seemed unimportant at the counter turns into a mismatch you spend years correcting.',
    tools: ['Passport & ID photo', 'Scan to PDF', 'Compress to size', 'Merge PDF'],
  },
  {
    slug: 'aadhaar-correction', name: 'Aadhaar update / correction form', short: 'Aadhaar update', group: 'PAN & identity',
    aka: 'Aadhaar name, address or date of birth change',
    authority: 'Unique Identification Authority of India (UIDAI)',
    officialName: 'the myAadhaar portal or an enrolment centre',
    officialUrl: 'https://uidai.gov.in/',
    what:
      'The request to change details already recorded against your Aadhaar — name, address, date of birth, gender, mobile number or email.',
    who:
      'Anyone whose recorded details are wrong or have changed. Some fields can be updated online; others generally require a visit because biometrics have to be re-verified.',
    when:
      'Any time. UIDAI periodically asks holders to refresh supporting documents, so check the portal rather than assuming your record is current.',
    gotcha:
      'Certain fields can only be changed a limited number of times in a lifetime, and name and date of birth are usually among them. People burn one of those attempts on a small correction, then find the second, real correction refused.',
    tools: ['Scan to PDF', 'Compress to size', 'Merge PDF', 'Redact PDF'],
  },
  {
    slug: 'gst-reg-01', name: 'GST REG-01', short: 'GST REG-01', group: 'GST',
    aka: 'GST registration application',
    authority: 'Goods and Services Tax Network (GSTN)',
    officialName: 'the GST portal',
    officialUrl: 'https://www.gst.gov.in/',
    what:
      'The application for GST registration: business details, place of business, bank account, and the authorised signatory, with documents uploaded in support.',
    who:
      'Businesses crossing the registration threshold for their category and state, and anyone required to register regardless of turnover, such as those making inter-state supplies or selling through an e-commerce operator.',
    when:
      'Generally within the period prescribed after becoming liable to register. Registering late usually means tax is still due from the date liability began.',
    gotcha:
      'Applications are rejected on the address proof far more often than on eligibility. The proof has to match the premises exactly, and a rent agreement without the owner\'s consent letter or a mismatched electricity bill is the usual reason for a query that stalls the whole thing.',
    tools: ['Scan to PDF', 'Compress to size', 'Merge PDF', 'Fill PDF form'],
  },
  {
    slug: 'spice-plus', name: 'SPICe+ (INC-32)', short: 'SPICe+', group: 'Company & MCA',
    aka: 'company incorporation form',
    authority: 'Ministry of Corporate Affairs (MCA)',
    officialName: 'the MCA portal',
    officialUrl: 'https://www.mca.gov.in/',
    what:
      'The integrated form that incorporates a company and, in the same filing, reserves the name and applies for PAN, TAN, EPFO and ESIC registration, a bank account and, where applicable, professional tax.',
    who:
      'Anyone incorporating a company in India. It is filed by or through the proposed directors, usually with a professional certifying it.',
    when:
      'Any time, though a reserved name is valid only for a limited period, so the incorporation has to follow within it.',
    gotcha:
      'Because it bundles so many registrations, one bad detail fails several at once. The objects clause and the name are checked against existing companies and trade marks, and a rejected name means starting the sequence again rather than fixing one field.',
    tools: ['Merge PDF', 'Sign PDF', 'Compress to size', 'Scan to PDF'],
  },
  {
    slug: 'dir-3-kyc', name: 'DIR-3 KYC', short: 'DIR-3 KYC', group: 'Company & MCA',
    aka: 'annual director KYC',
    authority: 'Ministry of Corporate Affairs (MCA)',
    officialName: 'the MCA portal',
    officialUrl: 'https://www.mca.gov.in/',
    what:
      'The annual confirmation of a director\'s own details against their Director Identification Number, filed by the individual rather than by the company.',
    who:
      'Every person holding a DIN, whether or not they are currently a director of anything, and whether or not the company traded.',
    when:
      'Annually, by a date notified each year. There is generally a fee for filing late, and it applies per DIN.',
    gotcha:
      'Miss it and the DIN is deactivated, which blocks every other filing that needs your signature — not just yours, the company\'s. People discover it at the moment they are trying to file something urgent, and reactivation costs a fee and time.',
    tools: ['Sign PDF', 'Compress to size', 'Merge PDF', 'Scan to PDF'],
  },
  {
    slug: 'aoc-4', name: 'AOC-4', short: 'AOC-4', group: 'Company & MCA',
    aka: 'annual filing of financial statements',
    authority: 'Ministry of Corporate Affairs (MCA)',
    officialName: 'the MCA portal',
    officialUrl: 'https://www.mca.gov.in/',
    what:
      'The filing of a company\'s financial statements with the Registrar — balance sheet, profit and loss, the auditor\'s report and the board\'s report as attachments.',
    who:
      'Every company registered in India, including one that did not trade during the year.',
    when:
      'Generally within a period after the annual general meeting, on dates notified each year.',
    gotcha:
      'The late fee here accrues per day with no ceiling in the way people expect, so a filing forgotten for a year becomes an expensive one. Dormant companies are where this happens, because nobody is watching a company that is not doing anything.',
    tools: ['Merge PDF', 'Compress to size', 'PDF to Excel', 'Sign PDF'],
  },
  {
    slug: 'mgt-7', name: 'MGT-7 / MGT-7A', short: 'MGT-7', group: 'Company & MCA',
    aka: 'annual return',
    authority: 'Ministry of Corporate Affairs (MCA)',
    officialName: 'the MCA portal',
    officialUrl: 'https://www.mca.gov.in/',
    what:
      'The company\'s annual return: shareholding, directors, meetings held and changes during the year. MGT-7A is the abridged version for small companies and one-person companies.',
    who:
      'Every registered company. Which of the two versions applies depends on the company\'s category.',
    when:
      'Generally within a period after the annual general meeting, separate from the AOC-4 deadline — the two are frequently confused.',
    gotcha:
      'The shareholding and directorship details must agree with what has actually been filed during the year. If a share transfer or a director change was never filed, this return either contradicts the register or repeats the omission, and both are visible on the public record.',
    tools: ['Merge PDF', 'Compare PDF', 'Compress to size', 'Sign PDF'],
  },
  {
    slug: 'bank-kyc-update', name: 'Bank KYC update form', short: 'Bank KYC update', group: 'Banking',
    aka: 're-KYC / periodic KYC',
    authority: 'Reserve Bank of India (RBI) direction, applied by your bank',
    officialName: 'your bank',
    officialUrl: 'https://www.rbi.org.in/',
    what:
      'The periodic re-confirmation of your identity and address that banks are required to carry out on existing customers, with fresh proof where anything has changed.',
    who:
      'Existing account holders. How often it is required generally depends on the risk category the bank has assigned to the account.',
    when:
      'Periodically, on the bank\'s cycle. You are usually notified in advance, and the notice is easy to mistake for marketing.',
    gotcha:
      'An account that misses re-KYC can be frozen for debits, and that is discovered at the worst possible moment — a payment failing, or a salary credit that cannot be withdrawn. Restoring it takes a branch visit that a returned form would have avoided.',
    tools: ['Scan to PDF', 'Compress to size', 'Merge PDF', 'Redact PDF'],
  },
  {
    slug: 'fatca-crs-declaration', name: 'FATCA / CRS declaration', short: 'FATCA / CRS', group: 'Banking',
    aka: 'tax residency self-certification',
    authority: 'Central Board of Direct Taxes (CBDT), applied by banks and fund houses',
    officialName: 'your bank, fund house or depository',
    officialUrl: 'https://www.incometax.gov.in/',
    what:
      'A self-certification of where you are tax resident, so financial institutions can report accounts to the right jurisdiction under the international exchange-of-information arrangements.',
    who:
      'Holders of bank accounts, mutual fund folios and demat accounts. It is asked at account opening and again when something suggests the position has changed.',
    when:
      'Generally at account opening, and again whenever your circumstances change — moving abroad being the obvious trigger. Institutions ask again periodically, so check with yours.',
    gotcha:
      'Folios are frozen for transactions when this is outstanding, and people find out when a redemption will not go through. Tax residency is also not the same as citizenship or where you currently live, and guessing at that box is how a wrong declaration gets signed.',
    tools: ['Fill PDF form', 'Sign PDF', 'Scan to PDF', 'Compress to size'],
  },
  {
    slug: 'bank-nomination-form', name: 'Bank nomination form', short: 'Bank nomination', group: 'Banking',
    aka: 'DA-1 / nomination in a bank account',
    authority: 'Reserve Bank of India (RBI) direction, applied by your bank',
    officialName: 'your bank',
    officialUrl: 'https://www.rbi.org.in/',
    what:
      'The form recording who receives the balance in an account, deposit or locker if the holder dies, so the bank can release it without a court process.',
    who:
      'Any account or deposit holder. It can be added at opening or later, and changed at any time.',
    when:
      'Any time. Banks have been running campaigns to collect nominations on older accounts that never had one.',
    gotcha:
      'A nominee is a receiver, not an heir — the money is paid to them, but who is legally entitled is decided by succession law or a will. Families assume the nomination settles ownership, and it does not, which is exactly the misunderstanding that turns into a dispute.',
    tools: ['Fill PDF form', 'Sign PDF', 'Scan to PDF', 'Merge PDF'],
  },
  {
    slug: 'form-15ca', name: 'Form 15CA', short: 'Form 15CA', group: 'Income tax',
    aka: 'declaration for a foreign remittance',
    authority: 'Income Tax Department (CBDT)',
    officialName: 'the income tax e-filing portal',
    officialUrl: 'https://www.incometax.gov.in/',
    what:
      'The declaration filed before money is remitted to a non-resident, stating the nature of the payment and the tax deducted on it.',
    who:
      'Anyone making a payment to a non-resident that is chargeable to tax in India, whether an individual paying a foreign vendor or a company paying overseas fees.',
    when:
      'Before the remittance is made. Banks generally will not process it without the acknowledgement.',
    gotcha:
      'Which parts you complete depends on the amount and whether a Chartered Accountant certificate on Form 15CB is required first. People fill the wrong part, the bank rejects it, and the payment misses its date.',
    tools: ['Merge PDF', 'Compress to size', 'Sign PDF', 'PDF to Excel'],
  },
];

export const FORM_GROUPS = INDIA_FORMS.map((f) => f.group).filter((g, i, a) => a.indexOf(g) === i);
export const getForm = (slug: string) => INDIA_FORMS.find((f) => f.slug === slug);

// ═══════════════════════════════════════════════════════════════════════════
// Per-form search titles and descriptions.
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠ WHY THIS EXISTS, AND WHY IT IS NOT A TEMPLATE
//
// Until 2026-11-25 every page here was titled from one string:
//     `${f.short} — What It Is & Who Files It | DiemDesk`
// The Search Console export for the preceding 92 days showed what that cost.
//
//   • `/india-forms/epf-form-19` drew 241 impressions at average position
//     46.6 — the single biggest page on the site — for the queries
//     "form 19" (27), "epf form 19" (23), "pf form 19" (22) and
//     "form 19 in epfo" (22). Its title said only "Form 19". The data already
//     held `name: 'EPF Form 19'`; the template simply picked the wrong field.
//     Same for 10C, 31 and 13.
//   • Thirty-two pages shared one phrasing, so none of them read as the best
//     answer to anything.
//   • The words people actually type — download, format, online, full form —
//     appeared in no title at all. "ais full form" (17), "gstr-9a format" (8,
//     and already ranking position 2.9), "epf form 10c online" (7).
//
// So these are written one at a time against real queries. A template is what
// produced the problem; replacing it with a cleverer template would too.
//
// ⚠ NO " | DiemDesk" SUFFIX, deliberately. It costs 11 characters of a ~60
// character budget, and at average position 46.8 nobody is searching for the
// brand — the one brand query in the whole export is "dimesk", misspelled,
// with 2 impressions. The characters are worth more spent on the question the
// reader typed. Revisit when the brand is actually searched for.
//
// Budgets are enforced by tests/unit/india-forms.test.ts, not by hoping.
export type IndiaSeo = { title: string; description: string };

export const INDIA_SEO: Record<string, IndiaSeo> = {
  'form-16': {
    title: 'Form 16: Your Salary TDS Certificate, Explained',
    description: 'Form 16 is the TDS certificate an employer issues after the year ends. What it contains, who hands it over, and the part people misread.',
  },
  'form-16a': {
    title: 'What Is Form 16A? TDS on Income That Is Not Salary',
    description: 'Form 16A covers TDS on interest, rent and commission rather than salary. Who issues it, where it comes from, and what to check against Form 26AS.',
  },
  'form-26as': {
    title: 'Form 26AS: The Annual Tax Statement, Explained',
    description: 'Form 26AS is the statement the department assembles about you from what everyone else reported. What appears on it, and why it may not match your records.',
  },
  'ais': {
    title: 'AIS Full Form: Registration and How to Download It',
    description: 'The Annual Information Statement: what AIS stands for, how to register and download it on the income tax portal, and how it differs from Form 26AS.',
  },
  'itr-1': {
    title: 'ITR-1 (Sahaj): Who Can File It, and Who Cannot',
    description: 'ITR-1 is the simplest Indian return and not everyone may use it. What Sahaj means, which income it covers, and the conditions that rule a filer out.',
  },
  'itr-2': {
    title: 'ITR-2: Who Files It, and How It Differs from ITR-1',
    description: 'ITR-2 is for filers with capital gains, more than one house, or foreign income. What it covers, and the point at which ITR-1 stops being an option.',
  },
  'itr-3': {
    title: 'ITR-3: The Return for Business and Profession Income',
    description: 'ITR-3 is for income from a business or profession, including a partner in a firm. What it covers and how it differs from the presumptive ITR-4.',
  },
  'itr-4': {
    title: 'ITR-4 (Sugam): Filing Under the Presumptive Scheme',
    description: 'ITR-4 is the presumptive-taxation return. What Sugam means, which businesses and professionals it is meant for, and where its limits sit.',
  },
  'form-15g': {
    title: 'Form 15G: The Declaration That Stops TDS on Interest',
    description: 'Form 15G is a declaration that income falls below the taxable limit, so a bank does not deduct TDS on interest. Who may give one, and when it is refused.',
  },
  'form-15h': {
    title: 'What Is Form 15H? The Senior Citizen TDS Declaration',
    description: 'Form 15H is the declaration a senior citizen gives a bank so TDS is not deducted on interest. How it differs from Form 15G, and who qualifies.',
  },
  'form-10e': {
    title: 'Form 10E: Claiming Relief on Salary Arrears',
    description: 'Form 10E supports a section 89 relief claim when salary arrears land in one year. What it is for, and why a claim is disallowed without it.',
  },
  'form-12bb': {
    title: 'Form 12BB: The Investment Declaration You Give Payroll',
    description: 'Form 12BB is the statement of claimed deductions an employee hands their own payroll team. What goes on it, and why it never reaches the department.',
  },
  'form-49a': {
    title: 'Form 49A: The PAN Card Application for Indian Citizens',
    description: 'Form 49A is the PAN application for Indian citizens. What it asks for, who processes it, and how it differs from Form 49AA for foreign applicants.',
  },
  'form-49aa': {
    title: 'Form 49AA: PAN Card Application for Foreign Citizens',
    description: 'Form 49AA is the PAN application used by foreign citizens and entities. What it asks for, and the point at which Form 49A applies instead.',
  },
  'gstr-1': {
    title: 'GSTR-1: The Outward Supplies Return, Explained',
    description: 'GSTR-1 reports outward supplies — the sales side of a GST registration. What it carries, who files it, and how it feeds the recipient’s credit.',
  },
  'gstr-3b': {
    title: 'GSTR-3B: The Summary Return and Tax Payment',
    description: 'GSTR-3B is the summary return where GST is actually paid. What it carries, how it sits against GSTR-1, and the mismatch that causes trouble.',
  },
  'gstr-9': {
    title: 'GSTR-9 and GSTR-9A: The Annual GST Return Format',
    description: 'The annual GST return: what GSTR-9 contains, who files it, how GSTR-9A differed for composition dealers, and where the official format lives.',
  },
  'gst-reg-01': {
    title: 'GST REG-01: The GST Registration Application',
    description: 'GST REG-01 is the application that starts a GST registration. What it asks for, what follows it, and which documents the portal expects.',
  },
  'epf-form-19': {
    title: 'EPF Form 19: PF Final Settlement Withdrawal',
    description: 'EPF Form 19 is the final settlement claim that withdraws a PF balance after leaving a job. Who files it, how it is filed online, and what holds it up.',
  },
  'epf-form-10c': {
    title: 'EPF Form 10C: The Pension Withdrawal Benefit Claim',
    description: 'EPF Form 10C claims the pension withdrawal benefit from the EPS. How it differs from Form 19, who may file it, and why the two are usually filed together.',
  },
  'epf-form-31': {
    title: 'EPF Form 31: PF Partial Withdrawal and Advance',
    description: 'EPF Form 31 claims an advance against a PF balance without leaving the job. What it may be claimed for, and how it differs from a final settlement.',
  },
  'epf-form-13': {
    title: 'EPF Form 13: Transferring PF When You Change Jobs',
    description: 'EPF Form 13 moves a PF balance from an old employer to a new one. How the transfer runs through the UAN portal, and what makes a transfer fail.',
  },
  'aadhaar-enrolment': {
    title: 'Aadhaar Enrolment Form: Applying for a New Aadhaar',
    description: 'The Aadhaar enrolment form starts a new Aadhaar application. What it asks for, which documents establish identity and address, and what happens next.',
  },
  'aadhaar-correction': {
    title: 'Aadhaar Update Form: Change a Name, Address or DOB',
    description: 'The Aadhaar update form corrects a name, address or date of birth. What may be changed, how often, and which documents each change asks for.',
  },
  'spice-plus': {
    title: 'SPICe+ Full Form: Company Incorporation (INC-32)',
    description: 'SPICe+ is the MCA form that incorporates a company in one filing. What the acronym stands for, what Part A and Part B each do, and what comes bundled.',
  },
  'dir-3-kyc': {
    title: 'What Is DIR-3 KYC? The Annual Director KYC Filing',
    description: 'DIR-3 KYC is the yearly KYC every director with a DIN files. Who it applies to, what the web form asks, and what happens when the deadline passes.',
  },
  'aoc-4': {
    title: 'AOC-4: Annual Filing of Financial Statements',
    description: 'AOC-4 files a company’s financial statements with the MCA. What it carries, which companies file which variant, and how it sits beside MGT-7.',
  },
  'mgt-7': {
    title: 'MGT-7 and MGT-7A: The Annual Return, Explained',
    description: 'MGT-7 is a company’s annual return to the MCA. What it reports, which small companies file MGT-7A instead, and how it differs from AOC-4.',
  },
  'bank-kyc-update': {
    title: 'Bank KYC Update Form: Periodic Re-KYC Explained',
    description: 'Banks re-run KYC on a cycle and ask for a form when they do. What re-KYC checks, which documents are accepted, and what freezes an account.',
  },
  'fatca-crs-declaration': {
    title: 'FATCA Full Form: The CRS Declaration Banks Ask For',
    description: 'What FATCA stands for, why an Indian bank or fund asks for a tax-residency self-certification, and what the CRS declaration actually asks you to state.',
  },
  'bank-nomination-form': {
    title: 'Bank Nomination Form: Adding a Nominee to an Account',
    description: 'The nomination form names who receives a bank balance. What a nominee is and is not, how DA-1 works, and why a nominee is not the same as an heir.',
  },
  'form-15ca': {
    title: 'Form 15CA: The Declaration for a Foreign Remittance',
    description: 'Form 15CA is the declaration filed before money is sent abroad. When it is needed, which part applies, and when a Form 15CB certificate goes with it.',
  },
};
