import type { LucideIcon } from 'lucide-react';
import { Scale, Stethoscope, Calculator, GraduationCap, Users, Receipt, Landmark, Building2, Home } from 'lucide-react';

// The sector pages exist for one reason: "the file never leaves your device" is
// the sentence that gets a tool past a compliance review, and no competitor
// whose product uploads files can write it. Everyone else's privacy claim is a
// RETENTION promise — "deleted after one hour", ISO 27001, an encrypted bucket —
// and every one of those concedes they received the document. That distinction
// is worth nothing to a casual user and close to everything to someone whose
// professional duty is on the line.
//
// So these are not landing pages with a job title pasted on. Each one names the
// specific rule the reader is bound by, the specific everyday task that rule
// makes awkward, and what our architecture does about it. Where we cannot help,
// they say so — a compliance-minded reader who catches one overclaim will not
// believe the rest of the page, and rightly.

export type Sector = {
  slug: string;
  icon: LucideIcon;
  /** Nav + card label. */
  name: string;
  /** <h1>. */
  headline: string;
  /** <title>: ≤60 chars including the brand suffix (XC-003). */
  title: string;
  /** <meta description>: ≤155 chars (XC-003). */
  description: string;
  /** The opening argument. Two or three sentences, no throat-clearing. */
  intro: string;
  /** The rule they actually work under. Named, not gestured at. */
  duty: { label: string; body: string };
  /** Everyday jobs, each with the reason uploading is the wrong answer. */
  jobs: { task: string; why: string; href: string; tool: string }[];
  /** The sector's working set, beyond the four headline jobs. Names must match
   *  components/app/catalog.tsx exactly — a curated list is only useful if it
   *  actually opens the tool. */
  toolkit: string[];
  /** The single highest-intent action. The CTA opens THIS, not the catalogue. */
  primary: { label: string; href: string };
  /** The honest limits. Non-negotiable: every page has real ones. */
  limits: string[];
  /** Closing line for the CTA band. */
  close: string;
};

export const SECTORS: Sector[] = [
  {
    slug: 'legal',
    icon: Scale,
    name: 'Legal',
    headline: 'Client files that never leave your desk',
    title: 'PDF Tools for Law Firms | DiemDesk',
    description:
      'Redact, Bates-number and combine client PDFs without uploading them anywhere. Runs in your browser — verify it in the Network tab.',
    intro:
      'Privilege does not survive a careless upload. Most online PDF tools take a copy of the document, process it on their servers and promise to delete it later — which is a promise about their conduct, not a limit on their access. These tools never receive the file at all, so there is nothing to promise.',
    duty: {
      label: 'ABA Model Rule 1.6(c) and the duty of technology competence',
      body:
        'You must make reasonable efforts to prevent unauthorised disclosure of client information, and Comment [8] extends competence to the benefits and risks of the technology you use. Sending a privileged exhibit through a third-party server is a decision you have to be able to defend. Not sending it is easier to defend.',
    },
    jobs: [
      { task: 'Redacting before production', why: 'A redaction that only draws a black box leaves the text underneath. Ours removes the content, and the file never leaves the machine while you do it.', href: '/redact-pdf', tool: 'Redact PDF' },
      { task: 'Bates numbering a production set', why: 'Number a whole set continuously — file two picks up where file one ended — without a single page reaching a server.', href: '/bates-numbering', tool: 'Bates numbering' },
      { task: 'Combining exhibits', why: 'Assemble an exhibit bundle from a dozen PDFs on your own machine, at whatever size it comes to.', href: '/merge-pdf', tool: 'Merge PDF' },
      { task: 'Stripping metadata before filing', why: 'Author names, revision history and comments travel with a PDF. Remove them before the other side reads them.', href: '/remove-pdf-metadata', tool: 'Remove metadata' },
    ],
    toolkit: ['Redact PDF', 'Bates numbering', 'Merge PDF', 'Split PDF', 'Remove metadata', 'Share-Safe PDF Check', 'Sign PDF', 'Compare PDF', 'PDF to Text', 'Protect PDF', 'Flatten PDF', 'OCR'],
    primary: { label: 'Start redacting', href: '/redact-pdf' },
    limits: [
      'We are not a document management system and do not pretend to be one — there is no matter numbering, no conflicts check, no retention schedule.',
      'We cannot certify a redaction as legally sufficient. The tool removes the content; reviewing the result is still your job.',
      'Court-specific formatting rules vary by jurisdiction and we do not encode them.',
    ],
    close: 'Open any tool and watch the Network tab. Nothing uploads — that is the whole argument.',
  },
  {
    slug: 'accountants',
    icon: Calculator,
    name: 'Accounting',
    headline: 'Client financials that stay on your machine',
    title: 'PDF Tools for Accountants | DiemDesk',
    description:
      'Convert statements, merge working papers and strip metadata without uploading client financials to anyone. Runs in your browser.',
    intro:
      'A bank statement is a list of everything your client did with their money. Putting one through a free converter means handing that list to a company you have not done diligence on, for a task that takes four seconds. These tools do the same job without the handover.',
    duty: {
      label: 'Client confidentiality and the safeguarding of financial data',
      body:
        'Professional bodies require you to keep client information confidential and secure, and in the United States the FTC Safeguards Rule applies to tax preparers directly. Whichever regime binds you, the analysis is the same: a document you never transmit is a document that cannot be intercepted, retained or breached at the other end.',
    },
    jobs: [
      { task: 'Bank statement to a spreadsheet', why: 'Convert a statement PDF into rows you can reconcile, with the totals checked against the balance — on your machine.', href: '/pdf-to-excel', tool: 'PDF to Excel' },
      { task: 'Merging working papers', why: 'Combine a year of schedules into one file without any of it passing through somebody else’s server.', href: '/merge-pdf', tool: 'Merge PDF' },
      { task: 'Compressing for e-filing', why: 'Portal size limits are a daily nuisance. Compress to a target size locally, at any starting size.', href: '/compress-to-size', tool: 'Compress to size' },
      { task: 'Cleaning metadata before sending', why: 'Spreadsheet exports carry author and path information that names your client and your folder structure.', href: '/remove-pdf-metadata', tool: 'Remove metadata' },
    ],
    toolkit: ['PDF to Excel', 'Bank statement to Excel', 'Merge PDF', 'Compress to size', 'Remove metadata', 'Split PDF', 'Excel to PDF', 'PDF to Text', 'Sign PDF', 'Protect PDF', 'Page numbers', 'OCR'],
    primary: { label: 'Convert a statement', href: '/pdf-to-excel' },
    limits: [
      'We do not do bookkeeping, tax calculation or filing — these are document tools, not an accounting package.',
      'Statement conversion accuracy depends on the statement. Ours checks its own totals against the closing balance and tells you when they disagree, but you should still read the result.',
      'We hold no audit trail of what you converted, which is the point, and also means we cannot reconstruct it for you later.',
    ],
    close: 'Convert one statement and watch the Network tab stay silent. Then decide.',
  },
  {
    slug: 'healthcare',
    icon: Stethoscope,
    name: 'Healthcare',
    headline: 'Patient documents that are never transmitted',
    title: 'PDF Tools for Healthcare | DiemDesk',
    description:
      'Handle patient PDFs without transmitting them. Processing happens in your browser, so no third party receives the document at all.',
    intro:
      'Most online file tools cannot lawfully touch protected health information, because using one means disclosing PHI to a vendor. The usual workaround is a Business Associate Agreement. The better answer is not to disclose it: these tools run inside your browser, so no third party receives the document.',
    duty: {
      label: 'HIPAA, and what a Business Associate Agreement is actually for',
      body:
        'A BAA exists to govern a vendor that receives PHI on your behalf. Software that processes a file entirely on your own device is not receiving it — the same way a BAA is not required for the PDF reader already installed on your computer. Note the boundary carefully: this reasoning covers our in-browser tools only, and stops at anything that touches our servers.',
    },
    jobs: [
      { task: 'Redacting records for release', why: 'Remove identifiers properly rather than covering them, without the record leaving the workstation.', href: '/redact-pdf', tool: 'Redact PDF' },
      { task: 'Combining a patient file', why: 'Merge referrals, results and correspondence into one document locally.', href: '/merge-pdf', tool: 'Merge PDF' },
      { task: 'Compressing for a portal', why: 'Meet a portal’s size limit without emailing the file to a compression service first.', href: '/compress-to-size', tool: 'Compress to size' },
      { task: 'Splitting a scanned bundle', why: 'Separate a long scan into per-episode documents on your own machine.', href: '/split-pdf', tool: 'Split PDF' },
    ],
    toolkit: ['Redact PDF', 'Merge PDF', 'Split PDF', 'Compress to size', 'Remove metadata', 'Scan to PDF', 'Clean scanned PDF', 'Protect PDF', 'Flatten PDF', 'Fill PDF form', 'Sign PDF', 'OCR'],
    primary: { label: 'Start redacting', href: '/redact-pdf' },
    limits: [
      'This is not legal advice and not a compliance certification. Your privacy officer decides what your organisation may use, and they should read this page before you rely on it.',
      'The reasoning covers our in-browser tools only. Anything that runs on our servers — the AI features, server-side Office conversion, OCR — is a disclosure and is out of scope. Those tools say so on their own pages.',
      'We do not offer a BAA today. If your policy requires one regardless of architecture, we are not yet the right fit.',
    ],
    close: 'The strongest privacy control is not transmitting the file. That is the default here.',
  },
  {
    slug: 'schools',
    icon: GraduationCap,
    name: 'Education',
    headline: 'Student work, handled without an upload',
    title: 'PDF Tools for Schools | DiemDesk',
    description:
      'Free PDF tools for teachers and school IT. No signup, no ads, no uploads — student records never reach a third-party server.',
    intro:
      'School IT has a hard time approving free online tools, and it is usually the right call: the free ones are ad-funded, and student records are exactly the data you should not trade for a page of advertising. These tools have no ads, need no account, and never receive the file.',
    duty: {
      label: 'FERPA, and why "free" is usually the problem',
      body:
        'Student education records may only be disclosed under specific conditions, and an ad-supported free tool has a commercial reason to know things about the people using it. Because processing happens in the browser, there is no disclosure to evaluate here — and no advertising business behind it that would want one.',
    },
    jobs: [
      { task: 'Combining marked work', why: 'Merge a class set into one file for records, without uploading student names anywhere.', href: '/merge-pdf', tool: 'Merge PDF' },
      { task: 'Compressing for the VLE', why: 'Get a resource under the upload limit without a round trip through a compression site.', href: '/compress-to-size', tool: 'Compress to size' },
      { task: 'Splitting a scanned register', why: 'Break a long scan into per-pupil documents locally.', href: '/split-pdf', tool: 'Split PDF' },
      { task: 'Removing metadata before sharing', why: 'Strip the author name and file path before a worksheet goes home with a class.', href: '/remove-pdf-metadata', tool: 'Remove metadata' },
    ],
    toolkit: ['Merge PDF', 'Split PDF', 'Compress to size', 'Remove metadata', 'JPG to PDF', 'Scan to PDF', 'Word to PDF', 'PDF to JPG', 'Page numbers', 'Watermark', 'Fill PDF form', 'QR generator'],
    primary: { label: 'Merge a class set', href: '/merge-pdf' },
    limits: [
      'We are not a student information system and hold no records.',
      'Tools that run on our servers are a different matter and are labelled as such on their own pages.',
      'On school-managed devices, an old locked-down browser may lack the features some tools need. Every tool degrades to something that still works, but the fastest path is a current browser.',
    ],
    close: 'No account, no ads, no upload. Try it on a device you already have.',
  },
  {
    slug: 'hr',
    icon: Users,
    name: 'HR & recruitment',
    headline: 'CVs and case files that stay in the room',
    title: 'PDF Tools for HR Teams | DiemDesk',
    description:
      'Redact CVs, strip metadata and combine case files without uploading them. Runs in your browser — check the Network tab yourself.',
    intro:
      'An HR inbox is one of the densest concentrations of special-category data in any organisation: health notes in a sickness case, a grievance naming beliefs or sexual orientation, a right-to-work document carrying ethnicity. Most online PDF tools process that on a server and promise deletion afterwards. These do not receive it at all.',
    duty: {
      label: 'GDPR Article 5(1)(f), and why Article 9 raises the stakes',
      body:
        'Personal data must be "processed in a manner that ensures appropriate security … including protection against unauthorised or unlawful processing", using appropriate technical measures — and under Article 5(2) you must be able to demonstrate you did. Article 9 then singles out health, racial or ethnic origin, religious or philosophical beliefs, trade union membership, biometric and sex-life data as prohibited to process by default. HR handles all of those routinely. A tool that never transmits the file is the easiest technical measure to demonstrate, because there is no transfer to justify and no processor to add to your Article 30 record.',
    },
    jobs: [
      { task: 'Redacting a CV before the panel sees it', why: 'Name, address, age and photograph removed for the sift, with the text genuinely gone rather than covered by a rectangle — and the candidate’s file never leaves your machine.', href: '/redact-pdf', tool: 'Redact PDF' },
      { task: 'Stripping metadata from an offer letter', why: 'A PDF exported from Word carries the author, the file path and often the template it came from. That is your salary-band folder structure, sent to a candidate.', href: '/remove-pdf-metadata', tool: 'Remove metadata' },
      { task: 'Assembling a grievance or disciplinary bundle', why: 'Combine statements, notes and correspondence into one paginated file, on your own machine, however sensitive the contents.', href: '/merge-pdf', tool: 'Merge PDF' },
      { task: 'Getting a file under an ATS upload limit', why: 'Applicant systems cap attachments. Compress to a target size locally instead of routing a CV through a converter you have not assessed.', href: '/compress-to-size', tool: 'Compress to size' },
    ],
    toolkit: ['Redact PDF', 'Remove metadata', 'Merge PDF', 'Split PDF', 'Compress to size', 'Sign PDF', 'Protect PDF', 'PDF to Text', 'Share-Safe PDF Check', 'Flatten PDF', 'Bates numbering', 'OCR'],
    primary: { label: 'Redact a CV', href: '/redact-pdf' },
    limits: [
      'These are document tools, not an HR system. There is no applicant tracking, no case management and no retention schedule — you keep running those where you run them now.',
      'Redaction removes what you select. It cannot know that a reference number on page 9 identifies someone; a human still has to read the document.',
      'We keep no log of what you processed. That is the point, and it also means we cannot produce one if your retention policy expects a trail.',
      'Tools that genuinely need a server — Office conversions, and OCR — are labelled on their own pages. Treat those as you would any processor.',
    ],
    close: 'Redact one CV and watch the Network tab stay empty. Then decide whether it belongs in your process.',
  },
  {
    slug: 'tax-practitioners',
    icon: Receipt,
    name: 'Tax practitioners',
    headline: 'Client returns that never touch a stranger’s server',
    title: 'PDF Tools for Tax Preparers | DiemDesk',
    description:
      'Convert statements, redact and combine client tax documents without uploading them. In-browser, so there is no transfer to safeguard.',
    intro:
      'A tax file is the most complete financial portrait of a person that exists outside a bank. The IRS is blunt about what that means for the people who hold it, and about the fact that preparers are now a target in their own right. These tools do the everyday document work without the file leaving your machine.',
    duty: {
      label: 'IRS Publication 4557 and the FTC Safeguards Rule',
      body:
        'Publication 4557 states it plainly — protecting taxpayer data is the law. Federal law gives the FTC authority to set data safeguard regulations for professional tax return preparers, and under the Safeguards Rule preparers must create and enact a written security plan to protect client data; failure to do so may result in an FTC investigation. The same guide tells you to encrypt sensitive files, limit access to taxpayer data to those who need to know, and treat data theft at preparers’ offices as a rising risk rather than a hypothetical. A document that is never transmitted is the simplest way to satisfy a plan you have to be able to show someone.',
    },
    jobs: [
      { task: 'Turning a bank statement into rows', why: 'Convert a statement PDF into a spreadsheet with the totals checked against the closing balance — without handing a full year of a client’s spending to a free converter.', href: '/pdf-to-excel', tool: 'PDF to Excel' },
      { task: 'Redacting an SSN or PAN before it circulates', why: 'Remove the number itself rather than drawing over it, so it does not survive a copy-paste out of the finished PDF.', href: '/redact-pdf', tool: 'Redact PDF' },
      { task: 'Assembling the return package', why: 'Combine schedules, statements and signature pages into one file at whatever size it comes to, on your own machine.', href: '/merge-pdf', tool: 'Merge PDF' },
      { task: 'Meeting a portal’s size limit', why: 'E-filing portals cap uploads. Compress to a target size locally instead of routing the return through a third party first.', href: '/compress-to-size', tool: 'Compress to size' },
    ],
    toolkit: ['PDF to Excel', 'Bank statement to Excel', 'Redact PDF', 'Merge PDF', 'Compress to size', 'Remove metadata', 'Split PDF', 'Protect PDF', 'Sign PDF', 'PDF to Text', 'Share-Safe PDF Check', 'OCR'],
    primary: { label: 'Convert a statement', href: '/pdf-to-excel' },
    limits: [
      'We do not prepare, calculate or file returns. These are document tools that sit beside your tax software, not a replacement for it.',
      'Statement conversion checks its own totals against the closing balance and tells you when they disagree. It does not remove the need to read the result.',
      'A written information security plan is still yours to write — see IRS Publication 5708. Using on-device tools is one control within it, not the plan.',
      'We keep no record of what you converted, which means we also cannot reconstruct it for an audit trail.',
    ],
    close: 'Convert one statement with the Network tab open. The absence of a request is the whole argument.',
  },
  {
    slug: 'finance',
    icon: Landmark,
    name: 'Lenders & finance firms',
    headline: 'Customer files that never reach a third party',
    title: 'PDF Tools for Finance Firms | DiemDesk',
    description:
      'Redact, combine and convert customer documents without uploading them. In-browser, so there is no service provider to oversee.',
    intro:
      'The Safeguards Rule reaches much further than banks. If you broker mortgages, service accounts, collect debts, advise on investments or prepare returns, you are a financial institution under it — and the paperwork you handle every day is exactly the “customer information” it names.',
    duty: {
      label: 'The FTC Safeguards Rule, 16 CFR Part 314',
      body:
        'Covered firms must “develop, implement, and maintain an information security program with administrative, technical, and physical safeguards designed to protect customer information” — written down, and proportionate to the size of the business and the sensitivity of what it holds. The Rule defines customer information as any record containing nonpublic personal information about a customer, “whether in paper, electronic, or other form”, and it covers records other institutions passed to you as well as your own. Section 314.2(h) lists thirteen worked examples, including mortgage lenders and brokers, account servicers, collection agencies, credit counselors, tax preparation firms and investment advisers who need not register with the SEC. Section 314.4 then sets out nine required elements, one of which is overseeing your service providers. A tool that never receives the document is the one place in that programme where there is no provider to oversee.',
    },
    jobs: [
      { task: 'Redacting an account or Social Security number', why: 'Take the digits out of the file rather than drawing a box over them, so they cannot be copied back out of the PDF you send on.', href: '/redact-pdf', tool: 'Redact PDF' },
      { task: 'Turning a statement into rows', why: 'Convert a customer statement into a spreadsheet with the totals checked against the closing balance, without routing a year of their spending through a converter you have not assessed.', href: '/pdf-to-excel', tool: 'PDF to Excel' },
      { task: 'Assembling a file for underwriting or audit', why: 'Combine application, statements and correspondence into one paginated file, on your own machine, at whatever size it comes to.', href: '/merge-pdf', tool: 'Merge PDF' },
      { task: 'Checking what is hidden before it leaves', why: 'Metadata, tracked comments and layered content survive a PDF export and travel with the file to whoever you send it to.', href: '/share-safe-pdf-check', tool: 'Share-Safe PDF Check' },
    ],
    toolkit: ['Redact PDF', 'PDF to Excel', 'Bank statement to Excel', 'Merge PDF', 'Split PDF', 'Compress to size', 'Remove metadata', 'Share-Safe PDF Check', 'Protect PDF', 'Sign PDF', 'Flatten PDF', 'OCR'],
    primary: { label: 'Redact a document', href: '/redact-pdf' },
    limits: [
      'These are document tools. They are one control inside a written information security program, not the program — Section 314.4 asks for eight other things we cannot do for you.',
      'Redaction removes what you select. It cannot know that a reference number elsewhere in the file identifies the same customer.',
      'We keep no record of what you processed, which is the point and also means we cannot produce an access log if your program expects one.',
      'Office conversions and OCR run on our servers and are labelled on their own pages. Treat those as you would any service provider.',
    ],
    close: 'Open the Network tab and redact one document. The absence of a request is the whole argument.',
  },
  {
    slug: 'public-sector',
    icon: Building2,
    name: 'Public sector',
    headline: 'Redaction you can defend, before release',
    title: 'PDF Tools for Government Teams | DiemDesk',
    description:
      'Redact records for FOIA release so the text is genuinely removed, not covered. Runs in your browser — nothing is uploaded.',
    intro:
      'A records request ends with someone deciding what has to come out before the file goes public. That decision is reviewable, the released document is permanent, and the failure mode is famous: a black rectangle drawn over text that is still sitting underneath it, waiting to be copied out.',
    duty: {
      label: 'FOIA and its Exemption 6',
      body:
        'The Freedom of Information Act has let the public request federal agency records since 1967, and agencies must disclose them unless the material falls within one of nine exemptions. Exemption 6 covers “information that, if disclosed, would invade another individual’s personal privacy” — the reason most releases are redacted rather than withheld outright. That makes the quality of the redaction the whole of the job: a released record is public permanently and cannot be recalled. It also makes the redaction tool part of the release process, which is a poor argument for uploading an unredacted record to a third party in order to redact it.',
    },
    jobs: [
      { task: 'Redacting before release', why: 'The content is removed from the file, not hidden behind a shape, so it cannot be selected, copied or recovered from the released PDF.', href: '/redact-pdf', tool: 'Redact PDF' },
      { task: 'Numbering a release package', why: 'Number a set continuously across files so a released package can be cited page by page in correspondence and in court.', href: '/bates-numbering', tool: 'Bates numbering' },
      { task: 'Checking a file before it goes public', why: 'Author names, tracked comments and revision history survive a PDF export. On a released record they become public too.', href: '/share-safe-pdf-check', tool: 'Share-Safe PDF Check' },
      { task: 'Making a scanned record searchable', why: 'Older records arrive as images. Text recognition makes them searchable so a reviewer can find what has to be withheld.', href: '/ocr-pdf', tool: 'OCR' },
    ],
    toolkit: ['Redact PDF', 'Bates numbering', 'Share-Safe PDF Check', 'Remove metadata', 'Merge PDF', 'Split PDF', 'OCR', 'Flatten PDF', 'PDF to Text', 'Compress to size', 'PDF to PDF/A', 'Add bookmarks'],
    primary: { label: 'Redact a record', href: '/redact-pdf' },
    limits: [
      'We do not decide what is exempt. The tool removes what a reviewer marks; the judgement about what falls under an exemption is entirely yours.',
      'These are not a records management system. There is no case file, no review queue and no release log.',
      'We keep no audit trail of what was redacted, which is deliberate and is also the opposite of what a release process usually wants to record. Keep that trail where you keep the rest of the file.',
      'OCR runs on our servers and is labelled as such. For a record that has not yet been reviewed, that distinction matters.',
    ],
    close: 'Redact one page and try to select the text underneath. There is nothing there to select.',
  },
  {
    slug: 'real-estate',
    icon: Home,
    name: 'Property & conveyancing',
    headline: 'Completion files that stay off other people’s servers',
    title: 'PDF Tools for Property Firms | DiemDesk',
    description:
      'Combine, redact and sign completion documents without uploading them. In-browser, so bank details never sit on a server.',
    intro:
      'A conveyancing file is an identity document, a bank statement and a set of account details, moving between several parties on a deadline. It is the highest-value document bundle most people will ever email, and criminals know exactly what it is worth.',
    duty: {
      label: 'Why property transactions are targeted, in the FBI’s own numbers',
      body:
        'The FBI’s Internet Crime Complaint Center recorded a record $16.6 billion in reported losses in 2024. Business email compromise — the category that covers a fraudulent change of payment details mid-transaction — accounted for $2,770,151,146 of it, and real estate for a further $173,586,820. The IC3 Recovery Asset Team ran the Financial Fraud Kill Chain on 3,020 complaints that year, freezing funds in about two thirds of cases, which is another way of saying that a third of the time the money is gone. Every additional copy of a completion file, on every additional server, is another place those details can be read and another inbox that can be watched.',
    },
    jobs: [
      { task: 'Redacting account details before forwarding', why: 'Take the digits out of the document rather than covering them, so a forwarded file cannot give up the numbers a fraudster is waiting for.', href: '/redact-pdf', tool: 'Redact PDF' },
      { task: 'Assembling the completion pack', why: 'Combine contract, searches, ID and statements into one paginated file on your own machine, however large the bundle grows.', href: '/merge-pdf', tool: 'Merge PDF' },
      { task: 'Signing and returning a document', why: 'Sign on your device and send it back, without the signed contract passing through a third party on the way.', href: '/sign-pdf', tool: 'Sign PDF' },
      { task: 'Getting a bundle under an email limit', why: 'Portals and mail servers cap attachments. Compress to a target size locally instead of uploading the pack to a file service to shrink it.', href: '/compress-to-size', tool: 'Compress to size' },
    ],
    toolkit: ['Merge PDF', 'Redact PDF', 'Sign PDF', 'Compress to size', 'Split PDF', 'Remove metadata', 'Share-Safe PDF Check', 'Protect PDF', 'Fill PDF form', 'Flatten PDF', 'Scan to PDF', 'OCR'],
    primary: { label: 'Build a completion pack', href: '/merge-pdf' },
    limits: [
      'We do not verify identity, run searches or check a title. These are document tools that sit beside your case management system.',
      'Nothing here prevents business email compromise on its own. It removes copies of the details; it cannot stop someone acting on an email that looks like it came from you.',
      'We keep no copy of the bundle, which is the point, and means there is nothing to retrieve from us later if you lose your own.',
      'Office conversions and OCR run on our servers and say so on their own pages.',
    ],
    close: 'Build one pack with the Network tab open. Nothing about the transaction leaves the machine.',
  },
];

export const sectorBySlug = (slug: string) => SECTORS.find((s) => s.slug === slug);
