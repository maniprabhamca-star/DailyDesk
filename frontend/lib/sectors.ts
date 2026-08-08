import type { LucideIcon } from 'lucide-react';
import { Scale, Stethoscope, Calculator, GraduationCap } from 'lucide-react';

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
    limits: [
      'We are not a student information system and hold no records.',
      'Tools that run on our servers are a different matter and are labelled as such on their own pages.',
      'On school-managed devices, an old locked-down browser may lack the features some tools need. Every tool degrades to something that still works, but the fastest path is a current browser.',
    ],
    close: 'No account, no ads, no upload. Try it on a device you already have.',
  },
];

export const sectorBySlug = (slug: string) => SECTORS.find((s) => s.slug === slug);
