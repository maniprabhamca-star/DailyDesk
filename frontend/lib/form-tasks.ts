// Form tasks — the finder half of Phase 3.
//
// ── What this is ─────────────────────────────────────────────────────────────
// People arrive with a task, not a form number. "I am hiring someone." "A client
// wants my tax number." "I cannot pay the IRS." Each entry below composes forms
// we ALREADY verify (lib/us-forms.ts) into the ordered set that task involves,
// and prints the one column no competitor prints: who fills each form in, and
// where it goes. Not always the agency — the W-9 goes to the payer, the W-4
// stays with payroll, and the WH-381 runs the other way, from the employer to
// the employee.
//
// No new forms. Nothing here adds verification load; it adds an index over work
// already done. Spec: docs/designs/forms-finder-phase3.md.
//
// ── ⚠⚠ THE CONSTRAINT THAT SHAPES EVERY STRING IN THIS FILE ─────────────────
// A page answering "what forms do I need to hire an employee" is one step from
// practising law and tax. We are a tool, not a preparer, and the competitors
// blur exactly this line.
//
// So: a task page NEVER says "you need". It states which forms are involved,
// who fills each one in, and where it goes — and every line traces back to a
// sentence already read at source for that form. This file COMPOSES verified
// facts into an order. It does not generate new claims.
//
// Enforced, not intended. tests/unit/form-tasks.test.ts fails the build on the
// words "required", "you must" and "you need to file" anywhere in task copy,
// requires a `condition` on anything not marked 'always', and requires a
// non-empty `notCovered`. There is deliberately no 'required' value in the
// `applies` union — the vocabulary itself cannot express the claim.
//
// ── ⚠ THE TRAP: a SET goes stale invisibly ──────────────────────────────────
// .github/workflows/forms-sync.yml checks revisions, field counts and page
// counts. It cannot check that a set is still the RIGHT set. Retire a form at
// an agency and a page here is wrong while every number on it still verifies
// `drifts=0` on a green run.
//
// Hence two clocks, stated separately on the page and never merged:
//   • the forms' CHECKED_ON — moved by the weekly job; "these revisions are
//     current";
//   • a task's own `reviewedOn` — moved only by a human; "this set was last
//     read against the agencies' guidance".
// A page with fresh forms and a year-old reviewedOn is telling the reader
// something true. One combined date would not be.

import { US_FORMS, type UsForm } from './us-forms';

/** How relevant a form is to a task.
 *
 *  There is no 'required' member, and that is the point — see the header. The
 *  three values describe how often a form turns up in this task, which is an
 *  observation; "required" would be a conclusion about the reader's own
 *  circumstances, which we are not in a position to reach. */
export type Applies = 'always' | 'usually' | 'sometimes';

export type TaskForm = {
  /** Must exist in US_FORMS. A test fails the build if it does not, so deleting
   *  a form breaks the build instead of rendering a dead row. */
  slug: string;
  /** Why this form is in this set. */
  role: string;
  /** Who puts the pen to it. */
  filedBy: string;
  /** Where it ends up. Frequently NOT the issuing agency, which is the most
   *  useful and least-published fact on the whole page. */
  goesTo: string;
  applies: Applies;
  /** Mandatory whenever `applies` is not 'always'. Enforced by a test: an
   *  unconditional "sometimes" tells the reader nothing they can act on. */
  condition?: string;
};

export type FormTask = {
  slug: string;
  /** Phrased the way the reader would say it, not the way an agency would. */
  title: string;
  /** Only where `title` is too long to sit inside the ~60-character title
   *  budget alongside the brand. Omitted everywhere it fits, so there is one
   *  string to keep right rather than two. */
  seoTitle?: string;
  /** Other phrasings, for the ⌘K matcher and the search index. */
  aka: string[];
  /** Who the page is for. One short phrase. */
  audience: string;
  /** What the task is. One honest paragraph, no instructions. */
  what: string;
  /** Why the order below is the order. */
  order: string;
  forms: TaskForm[];
  /** ⚠ Mandatory, and rendered ABOVE the fold rather than as a footer
   *  disclaimer. Naming what is missing is the honest half of a page like
   *  this, and on a hiring page it is also the clearest demand signal we will
   *  get for which state matrix to build first. */
  notCovered: string;
  /** The mistake the SET produces, as opposed to the per-form gotchas already
   *  on each form's own page. */
  gotcha: string;
  /** The human clock. See the header. */
  reviewedOn: string;
};

/** The day the sets below were last read against the agencies' own guidance.
 *
 *  Deliberately separate from us-forms' CHECKED_ON, which a robot moves. This
 *  one only moves when a person re-reads the sets, which is why it is written
 *  out per task rather than as a shared constant — they will diverge as they
 *  are individually revisited, and a single constant would quietly claim that
 *  all thirteen were reviewed on the day one of them was. */
const REVIEWED = '2026-11-24';

export const FORM_TASKS: FormTask[] = [
  // ── Employing people ──────────────────────────────────────────────────────
  {
    slug: 'hire-your-first-employee',
    title: 'Hire your first employee',
    aka: [
      'new hire paperwork',
      'forms for hiring an employee',
      'what forms do i need to hire someone',
      'new employee onboarding forms',
      'first employee federal forms',
    ],
    audience: 'Employers taking on their first member of staff',
    what:
      'Six federal forms turn up in a first hire, and they belong to three different agencies on three different clocks. Two are done before the first paycheck and stay in your own records or with payroll. Two repeat for as long as you have staff. One happens after the year ends. Only one of the six is sent to the IRS on the day you hire.',
    order:
      'The two the hire itself produces come first, then the number every payroll filing is made under, then the returns that repeat, then the year-end statement.',
    forms: [
      {
        slug: 'form-i-9',
        role:
          'Establishes that the person you hired may legally work in the United States. The employee completes one part and the employer the other.',
        filedBy: 'Employee, then the employer',
        goesTo: 'Nobody — the employer keeps it and produces it if inspected',
        applies: 'always',
      },
      {
        slug: 'form-w-4',
        role:
          'Tells payroll how much federal income tax to take out of each paycheck. It is not filed with the IRS.',
        filedBy: 'Employee',
        goesTo: 'Your payroll — not the IRS',
        applies: 'always',
      },
      {
        slug: 'form-ss-4',
        role:
          'Gets the employer identification number that the payroll returns further down this list are filed under.',
        filedBy: 'The employer',
        goesTo: 'IRS',
        applies: 'usually',
        condition:
          'Only if the business does not already have an EIN. Payroll and bank onboarding both stop without one, so it comes before the returns rather than after.',
      },
      {
        slug: 'form-941',
        role:
          'Reports the wages paid and the tax withheld, once a quarter, for as long as there is an employee.',
        filedBy: 'The employer or their payroll provider',
        goesTo: 'IRS, quarterly',
        applies: 'usually',
        condition:
          'Most employers who withhold payroll tax. Some very small employers file annually on Form 944 instead, and the IRS tells them so rather than the other way round.',
      },
      {
        slug: 'form-940',
        role:
          'The annual federal unemployment return. Separate from, and no substitute for, a state unemployment filing.',
        filedBy: 'The employer or their payroll provider',
        goesTo: 'IRS, once a year',
        applies: 'usually',
        condition:
          'Employers who paid wages above the FUTA threshold or had staff for enough weeks in the year. The thresholds are low enough that most employers with staff are inside them.',
      },
      {
        slug: 'form-w-2',
        role:
          'The wage statement the employee uses to file their own return. The employee never files the W-2 itself.',
        filedBy: 'The employer',
        goesTo: 'The employee and the Social Security Administration',
        applies: 'always',
      },
    ],
    notCovered:
      'State and local forms. That includes your state’s own withholding certificate, where your state publishes one, along with new-hire reporting and unemployment-insurance registration — none of which are in our library yet. It also excludes deadlines, dollar thresholds, eligibility, and anything specific to your industry or your state. This page says which federal forms are involved and who fills each one in. It is not legal or tax advice, and we file nothing on anyone’s behalf.',
    gotcha:
      'USCIS returns a form filed on a superseded edition. The I-9 is the only form in this set issued by USCIS, and it is the one where using last year’s copy is not merely untidy — the IRS generally still accepts an older revision of its own forms, USCIS does not. That is why every page here prints the agency’s own word for its version marker, Edition date against Rev. against Form year, instead of flattening all three into “version”.',
    reviewedOn: REVIEWED,
  },
  {
    slug: 'pay-a-contractor',
    title: 'Pay a contractor',
    aka: [
      'forms for paying a freelancer',
      'contractor paperwork for business',
      '1099 forms for contractors',
      'what do i need from a contractor',
      'hiring a 1099 contractor',
    ],
    audience: 'Businesses and landlords paying people who are not employees',
    what:
      'Paying someone who is not an employee produces no withholding and no payroll return, but it does produce a reporting duty, and that duty runs on information you collect before you pay rather than after. One form comes in from the contractor; one or two go out at the end of the year.',
    order:
      'Collect the taxpayer number first — chasing it in January, after the payments, is the mistake this set exists to prevent. The reporting forms follow at year end.',
    forms: [
      {
        slug: 'form-w-9',
        role:
          'The contractor’s statement of their legal name, tax classification and taxpayer identification number, which is what the year-end reporting is made out to.',
        filedBy: 'The contractor',
        goesTo: 'You, the payer — never the IRS',
        applies: 'always',
      },
      {
        slug: 'form-1099-nec',
        role: 'Reports what you paid a non-employee for services during the year.',
        filedBy: 'You, the payer',
        goesTo: 'The IRS, and a copy to the contractor',
        applies: 'usually',
        condition:
          'Where the payments for services passed the reporting threshold for the year. The contractor receives their copy and does not file it.',
      },
      {
        slug: 'form-1099-misc',
        role:
          'The other reporting form, for payments that are not services — rent and prizes among them.',
        filedBy: 'You, the payer',
        goesTo: 'The IRS, and a copy to the recipient',
        applies: 'sometimes',
        condition:
          'Where you made payments of a kind that belong on MISC rather than NEC, above their own thresholds. The two are not interchangeable and their deadlines differ.',
      },
      {
        slug: 'form-ss-8',
        role:
          'Asks the IRS to determine whether a worker is an employee or a contractor.',
        filedBy: 'Either the firm or the worker',
        goesTo: 'IRS',
        applies: 'sometimes',
        condition:
          'Where the classification is genuinely unclear and a firm would rather have the question settled than have a payroll audit settle it. There is no deadline, and determinations take a long time.',
      },
    ],
    notCovered:
      'State reporting, backup withholding mechanics, dollar thresholds and deadlines, and the classification question itself — whether a particular worker is an employee or a contractor depends on facts no page can see. Nothing here is legal or tax advice, and we file nothing on anyone’s behalf.',
    gotcha:
      'NEC and MISC are not two names for the same form. Services go on the NEC; rent, prizes and several other categories go on the MISC, their deadlines differ, and the deadline for the MISC itself changes depending on which boxes are filled in. The second half of the trap is timing: the W-9 is the cheapest form in this set to collect before the first payment and the most expensive to chase after the last one.',
    reviewedOn: REVIEWED,
  },
  {
    slug: 'get-paid-as-a-contractor',
    title: 'Get paid as a contractor',
    aka: [
      'freelancer tax forms',
      'what form does a client need from me',
      'self employed tax forms',
      'w9 for freelancers',
      'independent contractor forms',
    ],
    audience: 'Freelancers, consultants, independent contractors and landlords',
    what:
      'Working for yourself moves the paperwork from your employer to you. One form goes out to each client who pays you, one or more arrive back in January, and they meet on your own return. The most-requested form in American business is in this set, and most people fill in several a year.',
    order:
      'The form a client asks for comes first, because it is the one with a decision in it. What arrives in January follows from it.',
    forms: [
      {
        slug: 'form-w-9',
        role:
          'Your statement of legal name, tax classification and taxpayer identification number, given to a business that pays you so it can report what it paid.',
        filedBy: 'You',
        goesTo: 'The client who asked for it — never the IRS',
        applies: 'always',
      },
      {
        slug: 'form-ss-4',
        role:
          'Gets an employer identification number, which can go on the W-9 in place of a Social Security number.',
        filedBy: 'You',
        goesTo: 'IRS',
        applies: 'sometimes',
        condition:
          'Where you would rather not write a bare Social Security number on a document you hand to every client. Sole proprietors with no employees often get one anyway, because banks and payers ask.',
      },
      {
        slug: 'form-1099-nec',
        role: 'What a client sends you reporting what they paid you for services.',
        filedBy: 'The client',
        goesTo: 'You receive a copy; the client files theirs',
        applies: 'usually',
        condition:
          'Where a client’s payments to you passed the reporting threshold. You never file this one — it arrives, and you reconcile it against your own records.',
      },
      {
        slug: 'form-1040',
        role: 'The return the whole year ends up on.',
        filedBy: 'You',
        goesTo: 'IRS',
        applies: 'usually',
        condition:
          'Where your income is above the filing threshold — and worth filing even below it if tax was already withheld and you want it back.',
      },
    ],
    notCovered:
      'Quarterly estimated payments, the schedules that go with a self-employed return, deductions, state and city filings, thresholds and deadlines. Nothing here is legal or tax advice, and we file nothing on anyone’s behalf.',
    gotcha:
      'The W-9 carries a bare taxpayer identification number on a document you hand to a business rather than to the IRS, often to an address you have never written to before — and you fill in several a year. That is the single widest exposure of a freelancer’s identity data, and it has a cheap fix: get an EIN and give that instead of your Social Security number. The classification box catches single-member LLCs out separately, because ticking individual or sole proprietor means giving the owner’s number, not the company’s.',
    reviewedOn: REVIEWED,
  },
  {
    slug: 'employee-or-contractor',
    title: 'Settle whether someone is an employee or a contractor',
    seoTitle: 'Employee or contractor: the IRS form',
    aka: [
      'worker misclassification form',
      'employee vs contractor irs',
      'ss-8 determination',
      'am i an employee or contractor',
      'misclassified as 1099',
    ],
    audience: 'Workers who think they are misclassified, and the firms that pay them',
    what:
      'The classification decides which of two entirely different sets of paperwork applies, and the two sides of a working relationship do not always read it the same way. There is a form that asks the IRS to decide, and the answer binds both sides — which is why the form that follows it depends on the answer.',
    order:
      'The determination first. Which of the two certificates follows is the answer to it, not a choice.',
    forms: [
      {
        slug: 'form-ss-8',
        role:
          'Asks the IRS to determine the worker’s status for federal employment tax purposes.',
        filedBy: 'The worker or the firm — either side can ask',
        goesTo: 'IRS',
        applies: 'always',
      },
      {
        slug: 'form-w-4',
        role: 'The withholding certificate that belongs to an employment relationship.',
        filedBy: 'The worker',
        goesTo: 'The firm’s payroll',
        applies: 'sometimes',
        condition: 'Where the determination is that the worker is an employee.',
      },
      {
        slug: 'form-w-9',
        role: 'The taxpayer-number certificate that belongs to a contractor relationship.',
        filedBy: 'The worker',
        goesTo: 'The firm',
        applies: 'sometimes',
        condition: 'Where the determination is that the worker is a contractor.',
      },
    ],
    notCovered:
      'The classification test itself, state law — which can reach a different answer from the federal one — back pay, back tax, penalties, and anything about how a particular relationship should be characterised. That depends on facts no page can see, and it is the sort of question a professional is for. Nothing here is legal or tax advice.',
    gotcha:
      'Filing the determination tells the IRS the question is open, and the answer applies to both sides of the relationship rather than only to the side that asked. There is no deadline and determinations typically take a long time, so it is a poor fit for anyone who needs the answer this month.',
    reviewedOn: REVIEWED,
  },

  // ── Numbers and authority ─────────────────────────────────────────────────
  {
    slug: 'get-a-us-taxpayer-number',
    title: 'Get a US taxpayer number',
    aka: [
      'itin application',
      'ein application form',
      'ssn vs itin vs ein',
      'apply for tax id number',
      'get a tax identification number',
    ],
    audience: 'People and businesses that need a number before they can file or get paid',
    what:
      'Three different numbers exist for three different purposes, and they are issued by two different agencies on three different forms. Most unsuccessful applications are the wrong form rather than a wrong entry on the right one, so the useful thing a page can do here is say plainly which is which.',
    order:
      'No order — these are alternatives, not steps. Which one applies depends on who is asking for the number and what for.',
    forms: [
      {
        slug: 'form-ss-5',
        role:
          'A Social Security number: the number for a person who is eligible for one, and the card itself.',
        filedBy: 'The individual',
        goesTo: 'Social Security Administration',
        applies: 'sometimes',
        condition:
          'For a first number, a replacement card, or a correction after a marriage, divorce or legal name change.',
      },
      {
        slug: 'form-w-7',
        role:
          'An individual taxpayer identification number: the number for a person with a US filing obligation who cannot get a Social Security number.',
        filedBy: 'The individual',
        goesTo: 'IRS, normally attached to the return that needs the number',
        applies: 'sometimes',
        condition:
          'For non-resident filers, and for spouses and dependants being claimed on a US return, where an SSN is not available.',
      },
      {
        slug: 'form-ss-4',
        role:
          'An employer identification number: the number for a business, an estate or a trust.',
        filedBy: 'The entity, or whoever administers it',
        goesTo: 'IRS',
        applies: 'sometimes',
        condition:
          'For forming an entity, hiring staff, opening a business bank account, or administering an estate or trust — and often for a sole proprietor with no employees, because banks and payers ask.',
      },
    ],
    notCovered:
      'Eligibility for any of the three, the documents each agency asks to see, processing times, and immigration status — which is a separate matter from a taxpayer number and is not decided by one. Nothing here is legal or tax advice.',
    gotcha:
      'The W-7 is normally submitted attached to the return that needs the number rather than on its own, which surprises people who expect to get the number first and file afterwards. And the EIN is the quiet answer to a privacy problem rather than only a business formality: it is what goes on a W-9 instead of a Social Security number.',
    reviewedOn: REVIEWED,
  },
  {
    slug: 'let-someone-handle-the-irs-for-you',
    title: 'Let someone handle the IRS for you',
    aka: [
      'irs power of attorney form',
      'authorize accountant with irs',
      'form 2848 vs 8821',
      'tax information authorization',
      'let my cpa talk to the irs',
    ],
    audience: 'Taxpayers handing a matter to a CPA, enrolled agent or attorney — and their advisers',
    what:
      'Two forms sit next to each other here and they do materially different things. One lets a third party read your records. The other lets them speak and act for you on the matters it names. People file the one they did not mean, and the mistake is only discovered when the adviser tries to do something the form does not cover.',
    order:
      'Not a sequence. Which one applies depends on whether the third party needs to look or to act.',
    forms: [
      {
        slug: 'form-8821',
        role:
          'Authorises a third party to inspect or receive your confidential tax information. It does not authorise them to act.',
        filedBy: 'The taxpayer',
        goesTo: 'IRS',
        applies: 'sometimes',
        condition:
          'Where a lender, accountant or payroll provider needs to read transcripts or notices, or where you want someone kept informed without handing over authority to act.',
      },
      {
        slug: 'form-2848',
        role:
          'Authorises a representative to speak to the IRS and act for you on the matters and periods it names.',
        filedBy: 'The taxpayer, and signed by the representative',
        goesTo: 'IRS',
        applies: 'sometimes',
        condition:
          'Where a matter is being handed to a CPA, enrolled agent or attorney — typically an audit, a collection case or an appeal.',
      },
    ],
    notCovered:
      'Who may represent you, what a representative may do once authorised, state authorisations — which are separate forms to separate agencies — and revocation mechanics. Nothing here is legal or tax advice.',
    gotcha:
      'Both of these keep working until they are revoked or replaced, and a new one generally supersedes an earlier authorisation for the same matter. So the first thing worth knowing is what is already on file: an old authorisation naming an adviser you no longer use is still live, and a new form filed without checking can quietly cancel one you meant to keep.',
    reviewedOn: REVIEWED,
  },

  // ── Returns, corrections, collections ─────────────────────────────────────
  {
    slug: 'set-up-an-irs-payment-plan',
    title: 'Set up an IRS payment plan',
    aka: [
      'cannot pay my taxes',
      'irs installment agreement form',
      'form 9465 payment plan',
      'owe the irs and cannot pay',
      'irs collection financial statement',
    ],
    audience: 'Anyone who owes the IRS more than they can pay now',
    what:
      'One form asks for the arrangement. Which financial statement goes with it, if any, depends on who at the IRS is handling the case rather than on anything you choose. The request form itself is unusually honest about when not to use it.',
    order:
      'The request first. The statement that accompanies it depends on who picks up the case, and the transcript is for anyone rebuilding a year they no longer have papers for.',
    forms: [
      {
        slug: 'form-9465',
        role: 'Asks the IRS for an instalment arrangement for a balance due.',
        filedBy: 'The taxpayer',
        goesTo: 'IRS, with the return or after a bill arrives',
        applies: 'always',
      },
      {
        slug: 'form-433-f',
        role: 'The shorter collection information statement.',
        filedBy: 'The taxpayer',
        goesTo: 'IRS',
        applies: 'usually',
        condition:
          'Where the case is being worked through the automated system or a call centre rather than by an assigned revenue officer.',
      },
      {
        slug: 'form-433-a',
        role: 'The long collection information statement.',
        filedBy: 'The taxpayer',
        goesTo: 'IRS',
        applies: 'sometimes',
        condition:
          'Where a revenue officer or a notice asks for it — commonly an arrangement the IRS will not grant automatically, a currently-not-collectible status, or an offer in compromise. The deadline is whatever the letter states.',
      },
      {
        slug: 'form-4506-t',
        role: 'Gets a transcript of what was actually filed and assessed.',
        filedBy: 'The taxpayer',
        goesTo: 'IRS',
        applies: 'sometimes',
        condition:
          'Where you are reconstructing a year you no longer have papers for, or want the balance confirmed by the IRS rather than by a notice.',
      },
    ],
    notCovered:
      'Thresholds, fees, how interest and penalties accrue, whether an arrangement will be granted, and the state equivalent — which is a separate process with a separate agency. Nothing here is legal or tax advice, and we negotiate nothing on anyone’s behalf.',
    gotcha:
      'Page 1 of the request form argues against itself: it says that under $50,000 the IRS’s own online payment agreement application is the cheaper route. A forms library that will not tell you when not to use the form is just chasing traffic, so that is on our page for this form too. The second point is timing rather than paperwork — interest and penalties generally keep accruing while an arrangement is in place, so applying early costs less than applying late.',
    reviewedOn: REVIEWED,
  },
  {
    slug: 'fix-a-return-you-already-filed',
    title: 'Fix a return you already filed',
    aka: [
      'amend my tax return',
      'form 1040-x amended return',
      'i made a mistake on my taxes',
      'forgot a 1099 on my return',
      'change a filed tax return',
    ],
    audience: 'Anyone who filed and then found something wrong',
    what:
      'Amending is a separate form from the original return, and the sequence matters more than the form does: the amendment is made against what was actually filed and assessed, which is not always what anyone remembers filing.',
    order:
      'Get the record of what was filed, then amend against it. Doing it the other way round is how a second correction becomes necessary.',
    forms: [
      {
        slug: 'form-4506-t',
        role: 'Gets a transcript of the return as filed and as assessed.',
        filedBy: 'The taxpayer',
        goesTo: 'IRS',
        applies: 'usually',
        condition:
          'Where you no longer have a complete copy of what was filed, or want it confirmed by the IRS rather than from your own files.',
      },
      {
        slug: 'form-1040-x',
        role: 'The amended individual return.',
        filedBy: 'The taxpayer',
        goesTo: 'IRS',
        applies: 'always',
      },
    ],
    notCovered:
      'How far back an amendment can reach, the limits on claiming a refund for an old year, state amendments — separate forms to separate agencies — and whether a particular change is worth making. Nothing here is legal or tax advice.',
    gotcha:
      'An amendment goes in after the original return has been processed, not while it is still in flight, and there is a limit on how far back you can go to claim a refund. Both of those are rules worth checking at the IRS for the year in question rather than assuming, because an amendment filed too early and one filed too late fail in completely different ways.',
    reviewedOn: REVIEWED,
  },
  {
    slug: 'change-your-address-with-the-irs',
    title: 'Change your address with the IRS',
    aka: [
      'irs change of address form',
      'moved house tell the irs',
      'form 8822 address change',
      'update address with irs',
    ],
    audience: 'Anyone who has moved and files a US return',
    what:
      'There is a dedicated form, and there is also a thing that happens on its own. Knowing both is the whole content of this task, because one of them is free and most people have to do it anyway.',
    order: 'The form, where you want the change made now rather than at the next filing.',
    forms: [
      {
        slug: 'form-8822',
        role: 'Notifies the IRS of a new home mailing address.',
        filedBy: 'The taxpayer — separated couples can each file their own',
        goesTo: 'IRS',
        applies: 'always',
      },
      {
        slug: 'form-1040',
        role:
          'A return filed with the new address on it does some of the same work without a separate form.',
        filedBy: 'The taxpayer',
        goesTo: 'IRS',
        applies: 'sometimes',
        condition:
          'Where a return is due anyway and the timing suits. The IRS generally takes several weeks to process the dedicated form, so the two routes are not interchangeable if something is in flight.',
      },
    ],
    notCovered:
      'Business address changes, state agencies, the Social Security Administration and the Postal Service — each of which is told separately and none of which learns from the others. Nothing here is legal or tax advice.',
    gotcha:
      'Nothing forwards between agencies. Telling the IRS does not tell the SSA, a state revenue department, or anybody else, and a mail-forwarding order is not a notification to any of them. The quieter case is a separated couple who need correspondence sent to two different addresses: that is two filings, not one.',
    reviewedOn: REVIEWED,
  },

  // ── Immigration and citizenship ───────────────────────────────────────────
  {
    slug: 'sponsor-a-relative-to-immigrate',
    title: 'Sponsor a relative to immigrate',
    aka: [
      'family green card forms',
      'petition for a relative uscis',
      'i-130 i-485 i-864 forms',
      'sponsor my spouse green card',
      'bring a family member to the us',
    ],
    audience: 'US citizens and permanent residents petitioning for family',
    what:
      'Four USCIS forms appear in a family case, filed by two different people, and the one that trips cases up most is not a form at all but a date: whether a visa number is available in the category. Approval of the petition is step one of several.',
    order:
      'The petition establishes the relationship. The financial support form accompanies the application it supports. The adjustment application depends on a visa number being available, and work authorisation is a question only once that is filed.',
    forms: [
      {
        slug: 'form-i-130',
        role: 'Establishes the qualifying family relationship.',
        filedBy: 'The US citizen or permanent resident, as petitioner',
        goesTo: 'USCIS — the relative is the beneficiary and does not file it',
        applies: 'always',
      },
      {
        slug: 'form-i-864',
        role: 'The commitment to support the immigrant financially.',
        filedBy: 'The petitioning relative, and a joint sponsor as well where needed',
        goesTo: 'USCIS, with the application it supports',
        applies: 'always',
      },
      {
        slug: 'form-i-485',
        role: 'The application to become a permanent resident from inside the United States.',
        filedBy: 'The beneficiary',
        goesTo: 'USCIS',
        applies: 'usually',
        condition:
          'Where the beneficiary is already in the US and a visa number is available in their category. Filing before a number is available generally gets the application rejected, and the monthly visa bulletin is what says.',
      },
      {
        slug: 'form-i-765',
        role: 'Asks for permission to work while the application is pending.',
        filedBy: 'The beneficiary',
        goesTo: 'USCIS',
        applies: 'sometimes',
        condition:
          'Where the beneficiary’s category permits work with authorisation. Processing times move a great deal, and renewals are their own filing.',
      },
    ],
    notCovered:
      'Eligibility, category and priority dates, consular processing — the route for a beneficiary outside the US, which is a different set of forms to a different agency — fees, medical examinations, and the income table behind the support form, which is republished annually. Nothing here is legal advice, and immigration law is the area where that sentence carries the most weight on this whole site.',
    gotcha:
      'USCIS rejects a form filed on a superseded edition, and this set has four of them with four different edition dates that move independently. The expensive version of the mistake is not a rejected form but a rejected filing window: the adjustment application depends on a visa number being available in the category, which the monthly visa bulletin states, and filing ahead of it generally gets the application returned.',
    reviewedOn: REVIEWED,
  },
  {
    slug: 'apply-for-us-citizenship',
    title: 'Apply for US citizenship',
    aka: [
      'naturalization application form',
      'n-400 citizenship',
      'become a us citizen forms',
      'apply for naturalization',
    ],
    audience: 'Lawful permanent residents applying to naturalise',
    what:
      'One application carries the whole thing. The second form here is the one people forget afterwards, because a certificate of naturalisation does not update any other record on its own.',
    order: 'The application, then the records that do not update themselves.',
    forms: [
      {
        slug: 'form-n-400',
        role: 'The application for naturalisation.',
        filedBy: 'The applicant',
        goesTo: 'USCIS',
        applies: 'always',
      },
      {
        slug: 'form-ss-5',
        role: 'Corrects the Social Security record after a legal name change.',
        filedBy: 'The individual',
        goesTo: 'Social Security Administration',
        applies: 'sometimes',
        condition:
          'Where a name changed as part of naturalising. The card does not update itself, and the SSA limits how many replacement cards it will issue.',
      },
    ],
    notCovered:
      'Eligibility and the residence requirement, the early-filing window, the civics and English tests, fees and waivers, and anything about a particular history. Nothing here is legal advice.',
    gotcha:
      'The residence requirement is the thing most worth checking at source rather than counting from memory — commonly five years, or three for the spouse of a citizen, with a short early-filing window before the anniversary. Counting it wrong by a few weeks is a rejected application rather than a delayed one.',
    reviewedOn: REVIEWED,
  },

  // ── Leave and benefits ────────────────────────────────────────────────────
  {
    slug: 'take-family-or-medical-leave',
    title: 'Take family or medical leave',
    aka: [
      'fmla forms',
      'fmla certification form',
      'medical leave paperwork',
      'wh-380 fmla certification',
      'leave to care for a family member',
    ],
    audience: 'Employees requesting FMLA leave, and the HR teams handling it',
    what:
      'Three Department of Labor forms cover this, and they do not all travel in the same direction. Two are certifications an employee returns when the employer asks for one. The third is the employer’s notice to the employee, which is where this set catches people out.',
    order:
      'In practice the employer’s notice usually comes first and the certification answers it. Which certification applies depends on whose health condition the leave is for.',
    forms: [
      {
        slug: 'form-wh-381',
        role:
          'The employer’s notice to the employee about eligibility and rights. It runs the opposite way from the other two.',
        filedBy: 'The employer',
        goesTo: 'The employee — who does not complete it',
        applies: 'always',
      },
      {
        slug: 'form-wh-380-e',
        role: 'Certification of the employee’s own serious health condition.',
        filedBy: 'The employee and their health-care provider',
        goesTo: 'The employer',
        applies: 'sometimes',
        condition: 'Where the leave is for the employee’s own health condition and the employer has asked for certification, which it is entitled to do.',
      },
      {
        slug: 'form-wh-380-f',
        role: 'Certification of a family member’s serious health condition.',
        filedBy: 'The family member’s health-care provider, with the employee',
        goesTo: 'The employer',
        applies: 'sometimes',
        condition: 'Where the leave is to care for a qualifying family member and the employer has asked for certification.',
      },
    ],
    notCovered:
      'Eligibility, which employers are covered, how much leave is available, pay, job protection, the notice periods, and state leave laws — several of which are more generous than the federal one and use entirely different forms. Nothing here is legal advice, and these are explainers rather than HR policy.',
    gotcha:
      'The WH-381 is not yours to fill in. It is the employer’s notice to the employee, and an employee who sits down to complete it has misread the direction of the set — while an employer who never issues it has missed the step that starts the clock on everything else. The certifications have a short window after the employer requests them, and the employer’s own notice is what states the period.',
    reviewedOn: REVIEWED,
  },
  {
    slug: 'claim-va-disability-compensation',
    title: 'Claim VA disability compensation',
    aka: [
      'va disability claim form',
      '21-526ez disability compensation',
      'veterans disability application',
      'increase my va rating',
    ],
    audience: 'Veterans claiming or increasing disability compensation',
    what:
      'One application covers both a first claim and a request to increase an existing rating. The thing worth knowing before filing is not on the form itself: there is a separate step that can preserve an earlier effective date while evidence is gathered.',
    order: 'One form.',
    forms: [
      {
        slug: 'form-21-526ez',
        role:
          'The application for disability compensation, for a condition incurred in or aggravated by service, and for an increase in an existing rating.',
        filedBy: 'The veteran',
        goesTo: 'Department of Veterans Affairs',
        applies: 'always',
      },
    ],
    notCovered:
      'Eligibility, the evidence the VA looks for, how ratings are decided, effective dates, appeals, and accredited representation — which is free through several organisations and is worth knowing about before filing alone. Nothing here is legal advice.',
    gotcha:
      'Filing an intent to file first generally preserves an earlier effective date while evidence is gathered, which is a separate step from this form and worth checking before submitting. Effective dates are money, and this is the one point in the process where a few minutes of reading changes the amount.',
    reviewedOn: REVIEWED,
  },
];

// ── derived accessors ───────────────────────────────────────────────────────

export const TASK_COUNT = FORM_TASKS.length;

export const getFormTask = (slug: string) => FORM_TASKS.find((t) => t.slug === slug);

/** The UsForm behind a TaskForm. Non-null in practice — a test fails the build
 *  on any `slug` that does not resolve — but typed honestly so callers handle
 *  it rather than asserting. */
export const formFor = (tf: TaskForm): UsForm | undefined =>
  US_FORMS.find((f) => f.slug === tf.slug);

/** Which tasks a given form appears in. Used on the form pages to link back up
 *  into the finder, so the two directions stay connected without a second
 *  hand-maintained list. */
export const tasksForForm = (formSlug: string) =>
  FORM_TASKS.filter((t) => t.forms.some((f) => f.slug === formSlug));

/** The distinct issuing authorities a task touches, in the order the forms
 *  appear.
 *
 *  This IS the task's source list. The spec called for a `sources` field of
 *  agency URLs; populating one by hand would have meant typing in URLs that are
 *  not in our verified dataset, on pages whose entire argument is that every
 *  claim was read at source. So the provenance a task page shows is derived from
 *  the forms' own verified `authority` and `officialUrl` values instead, and
 *  there is nothing here for a human to get wrong. */
export const authoritiesFor = (t: FormTask): string[] => {
  const seen: string[] = [];
  for (const tf of t.forms) {
    const f = formFor(tf);
    if (f && !seen.includes(f.authority)) seen.push(f.authority);
  }
  return seen;
};

/** Join a list the way a sentence needs it: "A", "A and B", "A, B and C".
 *
 *  Not decoration. A task touches between one and three agencies, so a plain
 *  `.join(', ')` renders "the authorities here are USCIS, Internal Revenue
 *  Service" — which reads as a truncated list and, in the affiliation notice,
 *  as a sentence that lost its verb. Shipped once before being caught by
 *  reading the page. */
export function listJoin(items: string[], conjunction = 'and'): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
}

/** `reviewedOn` as prose, e.g. "November 24, 2026".
 *
 *  Built from the parts rather than `new Date(iso)`, for exactly the reason
 *  us-forms' CHECKED_ON_LABEL is: a bare YYYY-MM-DD parses as UTC midnight and
 *  then formats in the viewer's own zone, rendering the day before for anyone
 *  west of UTC. A date that is off by one undermines the thing it is there to
 *  establish. */
export function reviewedOnLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** How the three `applies` values are worded to a reader. Kept here rather than
 *  in the page so the test that forbids advice vocabulary can see them. */
export const APPLIES_LABEL: Record<Applies, string> = {
  always: 'Always',
  usually: 'Usually',
  sometimes: 'Sometimes',
};
