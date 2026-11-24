import type { FormTask } from './form-tasks';

// The India half of the form finder — Phase 3 ship 3.
//
// Same shape as the US tasks, same no-advice rule, same two clocks. What is
// NOT the same is the thing these pages are mostly about, and getting that
// wrong would make them worse than nothing:
//
// ── ⚠⚠ Most of this is not a PDF you download and fill in ───────────────────
// ITRs are e-filed. EPF claims run through the UAN member portal. GST returns
// are filed on the GST portal. SPICe+ is an MCA filing. lib/india-forms.ts
// opens with that fact and these pages inherit it: a task page here that
// implied "download these four forms" would be wrong about the main thing it
// is describing, which is worse than being incomplete.
//
// So every India row carries `howFiled`, and that is the column that replaces
// the US rows' measured version strip. It is not decoration — it is the single
// most useful sentence on the page, because it answers the question people
// actually arrive with:
//
//   • Form 16, Form 16A — ISSUED TO YOU. You never fill one in.
//   • Form 26AS, the AIS — BUILT ABOUT YOU by the department. You download them.
//   • ITR-1, GSTR-3B, DIR-3 KYC — filed BY you, online.
//   • Form 12BB, Form 15G — given to a private party (payroll, your bank),
//     not to the department at all.
//
// No competitor's forms directory draws that distinction, and it is the whole
// reason somebody is confused in the first place.
//
// ── ⚠ Why there is no packet here ───────────────────────────────────────────
// The Pro packet pre-fills a set of fillable PDFs. These are portals. There is
// nothing to pre-fill, so `region: 'india'` suppresses the packet CTA, and the
// packet route is not generated for these tasks. Pinned by a test, because a
// later "why doesn't India get the Pro feature" would otherwise be answered by
// wiring up a button that cannot work.
//
// ── ⚠ Dates ────────────────────────────────────────────────────────────────
// Indian filing dates move every year and are extended more often than not.
// india-forms.ts never states one as a fact and neither does this file;
// tests/unit/india-form-tasks.test.ts runs the same no-hard-date check over
// every string here. The copy points at the portal instead.

/** The day these sets were last read against the authorities' own guidance.
 *  The human clock — see lib/form-tasks.ts. */
const REVIEWED = '2026-11-24';

export const INDIA_TASKS: FormTask[] = [
  // ── Income tax, salaried ──────────────────────────────────────────────────
  {
    slug: 'file-your-income-tax-return',
    title: 'File your income tax return',
    region: 'india',
    aka: [
      'itr filing documents',
      'what do i need to file my itr',
      'income tax return documents india',
      'salaried itr checklist',
      'form 16 and itr',
      'itr-1 sahaj documents',
    ],
    audience: 'Salaried employees and pensioners in India',
    what:
      'A salaried return is assembled from documents that arrive from three different directions: one your employer issues to you, two the department builds about you, and one you file yourself. Almost all of the confusion comes from treating them as four forms to fill in, when only the last one is.',
    order:
      'Payroll first, because what you declare there decides what the certificate says; then the two statements, which are how the return gets checked; then the return itself.',
    forms: [
      {
        slug: 'form-12bb',
        library: 'india',
        role:
          'The statement you give payroll listing the deductions and exemptions you intend to claim, so the tax deducted from your salary reflects them.',
        filedBy: 'You',
        goesTo: 'Your employer’s payroll team — not the department',
        howFiled: 'Given to payroll, usually with proofs attached',
        applies: 'usually',
        condition:
          'Payroll collects it during the year. Where it was never collected, the deductions are claimed in the return instead and the refund arrives later.',
      },
      {
        slug: 'form-16',
        library: 'india',
        role:
          'Your employer’s certificate of the salary paid and the tax deducted from it. Part A is the quarterly TDS summary from TRACES; Part B is the salary breakup.',
        filedBy: 'Your employer',
        goesTo: 'You',
        howFiled: 'Issued to you — there is nothing here for you to fill in',
        applies: 'always',
      },
      {
        slug: 'form-26as',
        library: 'india',
        role:
          'The consolidated tax statement against your PAN: every rupee of TDS credited, the advance and self-assessment tax paid, and refunds issued.',
        filedBy: 'Nobody — the department assembles it from deductors’ returns',
        goesTo: 'You download it',
        howFiled: 'Downloaded from the e-filing portal',
        applies: 'always',
      },
      {
        slug: 'ais',
        library: 'india',
        role:
          'The wider statement: interest, dividends, securities and mutual fund transactions, foreign remittances — gathered from the entities that reported them.',
        filedBy: 'Nobody — reporting entities feed it',
        goesTo: 'You download it',
        howFiled: 'Downloaded from the Compliance section of the e-filing portal',
        applies: 'always',
      },
      {
        slug: 'form-10e',
        library: 'india',
        role:
          'Supports a claim for relief where salary arrears or advance salary pushed income into a higher bracket in the year it was received.',
        filedBy: 'You',
        goesTo: 'The Income Tax Department',
        howFiled: 'Filed on the e-filing portal, before the return that claims the relief',
        applies: 'sometimes',
        condition:
          'Where arrears or a backdated settlement landed in one year. The order matters: the relief claim rests on this being on the portal first.',
      },
      {
        slug: 'itr-1',
        library: 'india',
        role: 'The simplest return form, and the one most salaried filers end up on.',
        filedBy: 'You',
        goesTo: 'The Income Tax Department',
        howFiled: 'E-filed on the income tax portal',
        applies: 'usually',
        condition:
          'Open to a resident with salary or pension, one house property and other income inside the prescribed limit, which is set by the department rather than by us.',
      },
      {
        slug: 'itr-2',
        library: 'india',
        role: 'The return for individuals and HUFs without business or professional income.',
        filedBy: 'You',
        goesTo: 'The Income Tax Department',
        howFiled: 'E-filed on the income tax portal',
        applies: 'sometimes',
        condition:
          'Capital gains beyond the limited exception, more than one house property, foreign income or foreign assets all take a return out of ITR-1 and into this one.',
      },
    ],
    notCovered:
      'Nothing here works out which return form fits your year, what your taxable income is, or which regime leaves you better off. Those turn on circumstances a page cannot see, and they are tax advice. Filing dates and income limits are notified each year and extended more often than not, so the portal is the place to read them.',
    gotcha:
      'The AIS keeps changing after you file, because reporting entities keep submitting. People reconcile against Form 26AS alone, file, and then get a mismatch notice months later about interest or a mutual fund sale that only ever appeared in the AIS.',
    reviewedOn: REVIEWED,
  },

  // ── Income tax, self-employed ─────────────────────────────────────────────
  {
    slug: 'file-a-return-as-a-freelancer',
    title: 'File a return as a freelancer',
    region: 'india',
    aka: [
      'freelancer itr india',
      'itr for consultants',
      'presumptive taxation itr-4',
      'self employed tax return india',
      'professional income itr',
    ],
    audience: 'Freelancers, consultants and proprietors in India',
    what:
      'Without an employer there is no Form 16, and the paperwork changes shape: your clients issue certificates for whatever they deducted, the department’s two statements become the way you find the payments you forgot, and the return itself moves to one of two forms depending on whether you declare income on a presumptive basis or from books.',
    order:
      'Client certificates first, because they are the ones that arrive on somebody else’s schedule; then the statements that show what nobody told you about; then the return.',
    forms: [
      {
        slug: 'form-16a',
        library: 'india',
        role:
          'The TDS certificate for income that is not salary — professional fees, rent, commission, interest. Issued quarterly by whoever deducted the tax.',
        filedBy: 'Each client or payer who deducted tax',
        goesTo: 'You',
        howFiled: 'Issued to you from TRACES, one per deductor per quarter',
        applies: 'usually',
        condition:
          'One arrives from every client who deducted tax at source. A client who deducted nothing issues none, and that payment still belongs in the return.',
      },
      {
        slug: 'form-26as',
        library: 'india',
        role:
          'Where all of those deductions land in one place, against your PAN, whether or not the certificate ever reached you.',
        filedBy: 'Nobody — the department assembles it',
        goesTo: 'You download it',
        howFiled: 'Downloaded from the e-filing portal',
        applies: 'always',
      },
      {
        slug: 'ais',
        library: 'india',
        role:
          'Wider than Form 26AS, and for self-employed filers usually the more revealing of the two: interest, dividends, securities transactions and remittances reported by third parties.',
        filedBy: 'Nobody — reporting entities feed it',
        goesTo: 'You download it',
        howFiled: 'Downloaded from the Compliance section of the e-filing portal',
        applies: 'always',
      },
      {
        slug: 'itr-4',
        library: 'india',
        role: 'The return for income declared on a presumptive basis rather than from full books.',
        filedBy: 'You',
        goesTo: 'The Income Tax Department',
        howFiled: 'E-filed on the income tax portal',
        applies: 'usually',
        condition:
          'Open to small businesses and professionals inside the prescribed turnover or receipts limits who opt for presumptive taxation.',
      },
      {
        slug: 'itr-3',
        library: 'india',
        role:
          'The return for a business or profession carried on with full financial statements, and for partners in a firm.',
        filedBy: 'You',
        goesTo: 'The Income Tax Department',
        howFiled: 'E-filed on the income tax portal, with an audit report where one applies',
        applies: 'sometimes',
        condition:
          'Where books are kept rather than a presumptive basis, or where an audit applies, the return moves here — and the dates differ from the ones that apply without an audit.',
      },
    ],
    notCovered:
      'Nothing here decides whether presumptive taxation suits you, whether an audit applies, or what counts as a business expense. Those are tax advice and they depend on your own numbers. GST is a separate registration with its own returns, and it is on its own page rather than folded in here.',
    gotcha:
      'Freelancers reconcile against the Form 16A certificates that arrived and stop there. The certificates that never arrived are the problem: the income is still reported, the credit sits unclaimed in Form 26AS, and the two numbers disagree.',
    reviewedOn: REVIEWED,
  },

  // ── EPF ───────────────────────────────────────────────────────────────────
  {
    slug: 'move-or-withdraw-your-pf',
    title: 'Move or withdraw your PF',
    region: 'india',
    aka: [
      'pf transfer after changing jobs',
      'epf withdrawal forms',
      'form 19 and form 10c',
      'uan pf claim',
      'provident fund claim forms',
    ],
    audience: 'Anyone changing jobs or leaving employment in India',
    what:
      'Four claims cover everything people do with a provident fund balance, and they split along one line: whether the money moves to a new account or leaves the system. The pension portion is a separate claim from the balance itself, which is the single most common surprise.',
    order:
      'Transfer first, because it is what happens when another job follows; the two settlement claims next, which are usually raised together; the in-service withdrawal last, since it belongs to a job nobody has left.',
    forms: [
      {
        slug: 'epf-form-13',
        library: 'india',
        role:
          'The request to move a balance from a previous employer’s account into the current one, keeping continuity of service rather than cashing out.',
        filedBy: 'You, through the member portal',
        goesTo: 'EPFO, via both employers',
        howFiled: 'Raised online on the UAN member portal once the new account is active',
        applies: 'usually',
        condition:
          'Where the next job also runs PF. A seeded UAN carries the balance across rather than leaving an old account sitting idle.',
      },
      {
        slug: 'epf-form-19',
        library: 'india',
        role: 'The claim to withdraw the full provident fund balance when the account is being closed.',
        filedBy: 'You',
        goesTo: 'EPFO',
        howFiled: 'Raised online where the UAN is seeded with Aadhaar and a bank account; on paper where it is not',
        applies: 'sometimes',
        condition:
          'Where the account is being closed instead of moved, and after the waiting period that applies to a final settlement has run.',
      },
      {
        slug: 'epf-form-10c',
        library: 'india',
        role:
          'The pension side: the withdrawal benefit, or a scheme certificate that preserves the service instead of paying it out.',
        filedBy: 'You',
        goesTo: 'EPFO',
        howFiled: 'Raised on the member portal, usually alongside the settlement claim',
        applies: 'sometimes',
        condition:
          'Where service is below the length at which pension becomes payable. The balance claim does not cover this, which is why the two are normally raised together.',
      },
      {
        slug: 'epf-form-31',
        library: 'india',
        role:
          'A partial withdrawal while still employed, for one of the specified purposes — housing, medical treatment, education, marriage.',
        filedBy: 'You',
        goesTo: 'EPFO',
        howFiled: 'Raised on the member portal; there is no annual window',
        applies: 'sometimes',
        condition:
          'While still in service, where the conditions for the particular purpose are met. Each purpose carries its own eligibility and its own limit.',
      },
    ],
    notCovered:
      'Nothing here works out whether moving or withdrawing leaves you better off, what tax applies to a withdrawal, or how long your service counts for pension — all of which are advice, and all of which turn on dates in your own record. Employer attestation and KYC seeding happen in the EPFO portal, not here.',
    gotcha:
      'The pension portion is a separate claim. People raise the balance claim on its own, see the money arrive, and assume the account is closed — then find years later that the pension side was never settled and the service was never preserved either.',
    reviewedOn: REVIEWED,
  },

  // ── GST ───────────────────────────────────────────────────────────────────
  {
    slug: 'register-for-gst-and-file-returns',
    title: 'Register for GST and file returns',
    seoTitle: 'Register for GST and file',
    region: 'india',
    aka: [
      'gst registration documents',
      'gstr-1 and gstr-3b',
      'new gst registration forms',
      'gst return filing india',
      'gst annual return',
    ],
    audience: 'Businesses registering for GST in India',
    what:
      'One registration application, then a recurring pair of returns, then an annual consolidation above a turnover threshold. The pair is where people come unstuck: one of them reports your invoices and the other is where tax is actually paid, and they are not interchangeable.',
    order:
      'Registration, then the two periodic returns in the order they interact — invoices before payment — then the annual return that reconciles them.',
    forms: [
      {
        slug: 'gst-reg-01',
        library: 'india',
        role:
          'The registration application: business details, place of business, bank account and authorised signatory, with documents uploaded in support.',
        filedBy: 'You, or a professional on your behalf',
        goesTo: 'The GST authorities, through the portal',
        howFiled: 'Submitted on the GST portal with supporting documents',
        applies: 'always',
      },
      {
        slug: 'gstr-1',
        library: 'india',
        role:
          'Reports your outward supplies at invoice level. What you file here flows into your buyers’ input tax credit, which is why they chase you about it.',
        filedBy: 'You',
        goesTo: 'The GST portal — and onward to your customers’ credit',
        howFiled: 'Filed on the GST portal, monthly or quarterly depending on the scheme',
        applies: 'always',
      },
      {
        slug: 'gstr-3b',
        library: 'india',
        role:
          'The summary return where the liability is actually discharged: outward supplies, credit claimed, tax paid for the period.',
        filedBy: 'You',
        goesTo: 'The GST portal',
        howFiled: 'Filed on the GST portal, including for a period with no activity',
        applies: 'always',
      },
      {
        slug: 'gstr-9',
        library: 'india',
        role: 'The annual consolidation of the returns filed during the year.',
        filedBy: 'You, or a professional on your behalf',
        goesTo: 'The GST portal',
        howFiled: 'Filed on the GST portal after the financial year closes',
        applies: 'sometimes',
        condition:
          'Above the turnover threshold at which the annual return applies — a threshold that has been notified and changed more than once, so the portal is where it is read.',
      },
    ],
    notCovered:
      'Nothing here decides whether you have crossed a registration threshold, which state you register in, what rate applies to what you sell, or whether a credit is available. Those are tax advice. Thresholds and due dates are notified and revised, and the GST portal is the place that carries the current ones.',
    gotcha:
      'The two periodic returns get treated as one job. Filing the summary return and paying the tax does not report your invoices, so your customers find the credit missing — and filing invoices without the summary return leaves the tax unpaid while everything looks filed.',
    reviewedOn: REVIEWED,
  },

  // ── MCA ───────────────────────────────────────────────────────────────────
  {
    slug: 'register-a-private-limited-company',
    title: 'Register a private limited company',
    seoTitle: 'Register a company in India',
    region: 'india',
    aka: [
      'company incorporation forms india',
      'spice+ incorporation',
      'mca annual filing forms',
      'private limited company registration',
      'roc annual return',
    ],
    audience: 'Founders and directors incorporating in India',
    what:
      'Incorporation is one integrated filing that does several jobs at once. What follows it is an annual cycle that catches people out, because two of the three filings are the company’s and one belongs to each director personally — and that one applies whether or not the company ever traded.',
    order:
      'Incorporation first, then the annual cycle in the order it recurs: the director’s own confirmation, the financial statements, and the annual return.',
    forms: [
      {
        slug: 'spice-plus',
        library: 'india',
        role:
          'The integrated incorporation filing. In one submission it reserves the name and applies for PAN, TAN, EPFO and ESIC registration and a bank account.',
        filedBy: 'The proposed directors, usually through a professional who certifies it',
        goesTo: 'The Ministry of Corporate Affairs',
        howFiled: 'Filed on the MCA portal; a reserved name is only valid for a limited period',
        applies: 'always',
      },
      {
        slug: 'dir-3-kyc',
        library: 'india',
        role:
          'The annual confirmation of a director’s own details against their Director Identification Number. It belongs to the individual, not to the company.',
        filedBy: 'Each DIN holder personally',
        goesTo: 'The Ministry of Corporate Affairs',
        howFiled: 'Filed on the MCA portal annually, per DIN',
        applies: 'always',
      },
      {
        slug: 'aoc-4',
        library: 'india',
        role:
          'The company’s financial statements filed with the Registrar — balance sheet, profit and loss, the auditor’s report and the board’s report as attachments.',
        filedBy: 'The company',
        goesTo: 'The Registrar of Companies',
        howFiled: 'Filed on the MCA portal after the annual general meeting',
        applies: 'always',
      },
      {
        slug: 'mgt-7',
        library: 'india',
        role:
          'The annual return: shareholding, directors, meetings held and the changes during the year. MGT-7A is the abridged version for small and one-person companies.',
        filedBy: 'The company',
        goesTo: 'The Registrar of Companies',
        howFiled: 'Filed on the MCA portal, on its own timetable separate from the financial statements',
        applies: 'always',
      },
    ],
    notCovered:
      'Nothing here chooses a company structure for you, drafts a constitution, or works out which category your company falls into for the abridged annual return. Those are legal advice. Professional certification is part of several of these filings and that is a role we do not perform.',
    gotcha:
      'The director KYC filing is personal and annual, and it applies to anyone holding a DIN whether or not the company traded or they are still a director anywhere. Dormant companies get struck off the mental list and the per-DIN late fee arrives anyway.',
    reviewedOn: REVIEWED,
  },

  // ── PAN & Aadhaar ─────────────────────────────────────────────────────────
  {
    slug: 'get-a-pan-card',
    title: 'Get a PAN card',
    region: 'india',
    aka: [
      'pan card application form',
      'form 49a',
      'new pan apply india',
      'pan aadhaar mismatch',
      'pan correction form',
    ],
    audience: 'Anyone applying for a PAN in India',
    what:
      'Which application form applies turns on citizenship rather than on where you live. The reason this is more than a one-form job is that the application is checked against Aadhaar, so a record that disagrees with itself turns a simple application into two.',
    order:
      'The application that fits, then — where the identity record behind it does not match — the Aadhaar side that has to agree with it.',
    forms: [
      {
        slug: 'form-49a',
        library: 'india',
        role:
          'The PAN application for an Indian citizen, and the same form used to request corrections to an existing PAN.',
        filedBy: 'You, or an entity formed in India',
        goesTo: 'The Income Tax Department, through Protean eGov or UTIITSL',
        howFiled: 'Submitted online or on paper through either service provider',
        applies: 'usually',
        condition:
          'The route for Indian citizens, Indian companies and entities formed in India, whether the application is new or a correction.',
      },
      {
        slug: 'form-49aa',
        library: 'india',
        role: 'The PAN application for applicants who are not Indian citizens, including foreign entities.',
        filedBy: 'You, or the foreign entity applying',
        goesTo: 'The Income Tax Department, through Protean eGov or UTIITSL',
        howFiled: 'Submitted through either service provider',
        applies: 'sometimes',
        condition:
          'Where the applicant is a foreign national, a foreign entity, or an NRI whose case falls under the rules that point to this form rather than Form 49A.',
      },
      {
        slug: 'aadhaar-enrolment',
        library: 'india',
        role:
          'Enrolment for a new Aadhaar number, done at a centre because the photograph, fingerprints and iris scan are captured on the spot.',
        filedBy: 'You, in person',
        goesTo: 'UIDAI, through an authorised enrolment centre',
        howFiled: 'At an enrolment centre — biometrics mean it generally cannot be finished online',
        applies: 'sometimes',
        condition:
          'Where there is no Aadhaar yet. The PAN application asks for it, so enrolment tends to come first in practice.',
      },
      {
        slug: 'aadhaar-correction',
        library: 'india',
        role:
          'The request to change details already recorded against Aadhaar — name, address, date of birth, gender, mobile or email.',
        filedBy: 'You',
        goesTo: 'UIDAI',
        howFiled: 'Some fields on the myAadhaar portal; others at a centre, where biometrics are re-verified',
        applies: 'sometimes',
        condition:
          'Where the name or date of birth on Aadhaar differs from what the PAN application carries, because the two records are checked against each other.',
      },
    ],
    notCovered:
      'Nothing here tells you whether you fall under the citizen or the non-citizen route, nor gives advice on residency. Linking PAN to Aadhaar, and any fee or consequence attached to it, is a rule the department notifies and revises — the e-filing portal carries the current position, not this page.',
    gotcha:
      'A spelling that differs between Aadhaar and the application is the usual reason a PAN application stalls, and it is the one thing that cannot be fixed on the PAN side alone. Correcting Aadhaar first turns one slow application into one fast one.',
    reviewedOn: REVIEWED,
  },

  // ── Banking ───────────────────────────────────────────────────────────────
  {
    slug: 'open-and-keep-a-bank-account',
    title: 'Open and keep a bank account',
    region: 'india',
    aka: [
      'bank account opening forms india',
      'fatca crs declaration bank',
      'bank kyc update form',
      'nomination form bank account',
      're-kyc bank india',
    ],
    audience: 'Account holders and new customers at Indian banks',
    what:
      'Three pieces of paper follow an Indian bank account around. One is asked at opening, one can be added at any point and usually never is, and one comes back around on the bank’s own cycle for as long as the account exists.',
    order:
      'What is asked at opening, then what is easiest to add while you are already there, then the one that returns on its own schedule.',
    forms: [
      {
        slug: 'fatca-crs-declaration',
        library: 'india',
        role:
          'Your self-certification of where you are tax resident, so the institution reports the account to the right jurisdiction.',
        filedBy: 'You',
        goesTo: 'Your bank, fund house or depository',
        howFiled: 'Given to the institution, often inside the account-opening form itself',
        applies: 'always',
      },
      {
        slug: 'bank-nomination-form',
        library: 'india',
        role:
          'Records who receives the balance in an account, deposit or locker if the holder dies, so the bank can release it without a court process.',
        filedBy: 'The account holder',
        goesTo: 'Your bank',
        howFiled: 'Given to the branch or, at many banks, added through net banking',
        applies: 'usually',
        condition:
          'Added at opening or at any point afterwards, and changeable later. Banks have been running campaigns on older accounts that never carried one.',
      },
      {
        slug: 'bank-kyc-update',
        library: 'india',
        role:
          'The periodic re-confirmation of your identity and address that banks carry out on existing customers, with fresh proof where something has changed.',
        filedBy: 'You',
        goesTo: 'Your bank',
        howFiled: 'At the branch, or online where the bank allows it for an unchanged address',
        applies: 'always',
      },
    ],
    notCovered:
      'Nothing here is advice about your tax residence, and that declaration is the one place on this page where a wrong answer has consequences beyond the account. How often re-verification comes round depends on a risk category your bank assigns and does not publish, so the bank is the only source for it.',
    gotcha:
      'The re-verification notice reads exactly like marketing, so it gets ignored, and the first real sign is a transaction being refused on an account nobody knew was restricted. The declaration about tax residence also goes stale quietly the moment somebody moves abroad.',
    reviewedOn: REVIEWED,
  },

  // ── TDS on interest ───────────────────────────────────────────────────────
  {
    slug: 'stop-tds-on-your-interest',
    title: 'Stop TDS on your interest',
    region: 'india',
    aka: [
      'form 15g or 15h',
      'avoid tds on fd interest',
      'no tds declaration bank',
      'senior citizen interest tds',
      'form 15h for pensioners',
    ],
    audience: 'Depositors and pensioners whose bank deducts TDS',
    what:
      'Two declarations, one for each side of age sixty, given to the bank rather than to the department. Neither is an application and nobody approves either of them — which is exactly why the one that goes wrong goes wrong quietly.',
    order:
      'The declaration that fits your age goes to each bank at the start of the year; the statement afterwards is how you find out whether it worked.',
    forms: [
      {
        slug: 'form-15g',
        library: 'india',
        role:
          'A self-declaration that total income for the year will be below the taxable limit, so tax is not deducted from your interest.',
        filedBy: 'You',
        goesTo: 'Each bank separately — not the department',
        howFiled: 'Given to the bank, generally near the start of the financial year, and it lapses with that year',
        applies: 'sometimes',
        condition:
          'For a resident below sixty whose estimated total income for the year is under the taxable limit, which is a figure the department sets.',
      },
      {
        slug: 'form-15h',
        library: 'india',
        role:
          'The senior citizens’ version: a declaration that the tax on estimated total income will be nil, so nothing is deducted from interest.',
        filedBy: 'You',
        goesTo: 'Each bank separately',
        howFiled: 'Given to the bank, generally near the start of the financial year',
        applies: 'sometimes',
        condition:
          'For a resident aged sixty and above. The test is not the same as the younger form’s — it turns on the tax being nil, not on income being under a limit.',
      },
      {
        slug: 'form-26as',
        library: 'india',
        role:
          'Where any tax that was deducted anyway shows up against your PAN, which is the only reliable way to check whether a declaration took effect.',
        filedBy: 'Nobody — the department assembles it',
        goesTo: 'You download it',
        howFiled: 'Downloaded from the e-filing portal',
        applies: 'always',
      },
    ],
    notCovered:
      'Nothing here estimates your income for the year or tells you which declaration fits, and getting that judgement wrong is a declaration that is not true rather than a form filled in badly — so it is advice we do not give. Age tests and income limits are set by the department and the portal carries the current ones.',
    gotcha:
      'These are given to each bank separately, and they lapse at the end of the financial year. One declaration at your main bank leaves every other deposit deducting tax, and last year’s declaration does nothing for this year even at the same branch.',
    reviewedOn: REVIEWED,
  },

  // ── Outward remittance ────────────────────────────────────────────────────
  {
    slug: 'send-money-out-of-india',
    title: 'Send money out of India',
    region: 'india',
    aka: [
      'form 15ca remittance',
      'paying a foreign vendor from india',
      'outward remittance forms',
      'foreign payment tax declaration india',
    ],
    audience: 'Anyone remitting money to a non-resident',
    what:
      'A payment to a non-resident carries a declaration that goes to the department before the money moves, and banks generally will not release the remittance without the acknowledgement. Two pieces of account paperwork that are easy to forget stop it just as effectively.',
    order:
      'The declaration before the remittance, then the two account-level things a bank checks at the same moment.',
    forms: [
      {
        slug: 'form-15ca',
        library: 'india',
        role:
          'The declaration filed before money is remitted to a non-resident, stating the nature of the payment and the tax deducted on it.',
        filedBy: 'The remitter — you, or your company',
        goesTo: 'The Income Tax Department, then the acknowledgement to your bank',
        howFiled: 'Filed on the e-filing portal before the remittance; the bank asks for the acknowledgement',
        applies: 'always',
      },
      {
        slug: 'fatca-crs-declaration',
        library: 'india',
        role:
          'Your self-certification of tax residence, which the bank holds against the account the money is leaving.',
        filedBy: 'You',
        goesTo: 'Your bank',
        howFiled: 'Given to the bank, and refreshed when circumstances change',
        applies: 'sometimes',
        condition:
          'Where the bank’s record of your tax residence is out of date — moving abroad being the obvious trigger — the remittance tends to stop until it is refreshed.',
      },
      {
        slug: 'bank-kyc-update',
        library: 'india',
        role:
          'The bank’s periodic re-verification of the account the remittance leaves from.',
        filedBy: 'You',
        goesTo: 'Your bank',
        howFiled: 'At the branch, or online where the bank allows it',
        applies: 'sometimes',
        condition:
          'Where re-verification is pending on the account. Outward remittances are commonly among the first things held while it is outstanding.',
      },
    ],
    notCovered:
      'Nothing here works out whether a payment is chargeable to tax in India, what rate applies, or whether a treaty changes it — and the accountant’s certificate that often accompanies the declaration is a professional opinion, which is advice rather than a document. The limits on what an individual may remit in a year are set by the regulator.',
    gotcha:
      'The declaration goes in before the money moves, not with it. People arrange the transfer first, the bank asks for the acknowledgement at the counter, and the whole remittance waits on a portal filing that could have been done a week earlier.',
    reviewedOn: REVIEWED,
  },
];
