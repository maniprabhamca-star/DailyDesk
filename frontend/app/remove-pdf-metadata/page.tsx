import type { Metadata } from 'next';
import Link from 'next/link';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { MetadataTool } from '@/components/pdf/metadata-tool';
import { ThirdPartyNotice } from '@/components/app/third-party-notice';

export const metadata: Metadata = {
  title: "Remove PDF Metadata — Clean Hidden Info, Free | DiemDesk",
  description:
    "See and remove the hidden metadata in a PDF — author, editing software, timestamps, XMP history — free in your browser. Nothing uploaded, pages untouched.",
  alternates: { canonical: '/remove-pdf-metadata' },
  openGraph: {
    images: ['/og/remove-pdf-metadata.png'],
    title: 'Remove PDF Metadata — Clean Author & Hidden Info Free | DiemDesk',
    description: 'Wipe author names, software traces and timestamps from a PDF, privately in your browser. Free, no signup.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF in — it is scanned instantly, right in your browser.',
  'Review the hidden info it carries: author, software, dates, XMP history.',
  'Click Remove all metadata and download the cleaned PDF.',
];

const faqs = [
  { q: 'What metadata does a PDF contain?', a: 'Most PDFs quietly carry the author’s name, the software that created them, creation and modification timestamps, and an XMP data packet with editing history. Files exported from Word, for example, usually embed the Windows account name of whoever wrote them.' },
  { q: 'Is my PDF uploaded to a server?', a: 'No. Both the scan and the cleaning run entirely inside your browser on your device — the file never leaves your computer, which matters when the whole point is privacy.' },
  { q: 'What exactly gets removed?', a: 'The document Info dictionary (Title, Author, Subject, Keywords, Creator, Producer, dates and any custom fields), the XMP metadata stream, embedded page thumbnails, and private application data (/PieceInfo). The visible pages are not modified at all.' },
  { q: 'Does this redact the content of my pages?', a: 'No — this cleans hidden document metadata only. Anything visible on the pages (names in the text, headers, scanned signatures) stays exactly as it is. A redaction tool is on our roadmap for that.' },
  { q: 'Will the file still look the same?', a: 'Yes, pixel for pixel. Metadata lives outside the page content, so removing it never changes how the document renders or prints.' },
  { q: 'Why is the cleaned file smaller?', a: 'The XMP packet and thumbnails take real bytes — a few KB in a typical office PDF. Removing them plus repacking usually makes the file slightly smaller, never larger.' },
  { q: 'Is it really free?', a: 'Yes — scanning and cleaning PDF metadata is completely free, with no signup and no watermark.' },
  { q: 'Why do some tools say they removed it when the author name is still there?', a: 'Because a PDF can store the same fact in two places — the trailer Info dictionary and an XMP packet attached to the document catalogue — and a tool that clears one leaves the other sitting in the file. Which copy a given reader shows you is not settled by one universal rule, so the only reliable answer is to clear both. That is what this tool does, and the section below the tool explains how to check it for yourself.' },
  { q: 'Does this remove EXIF and GPS data from photos inside the PDF?', a: 'A photo placed in a PDF is re-encoded as a PDF image object, so the camera’s EXIF block does not usually survive into the file. If what you are holding is the photo itself rather than a PDF of it, use Remove EXIF & GPS instead — it is built for that and shows you what was in there.' },
];

// ── The body, added 2026-11-25 ───────────────────────────────────────────────
//
// Why: this page carries 72 impressions in 92 days at average position 66.6 —
// the largest tool-page demand on the site — across eight phrasings of the same
// question ("remove metadata from pdf" 29, "pdf metadata remover" 8, "how to
// remove metadata from pdf" 5, "remove pdf metadata" 3, "strip metadata from
// pdf" 3, "remove metadata pdf" 3, "delete metadata pdf" 3, "removing metadata
// from pdf" 2). The exact phrase was already in the title and it still ranked
// 66th, so the gap was never relevance — it was 401 words against competitors
// running four times that. Plan: docs/designs/pdf-tools-top10-plan-2026-11-25.md
//
// ⚠ Every factual claim here is either our own measurement or read at source:
//
//  - The two-copies problem and what we clear: our own engine, lib/pdf-docinfo.ts,
//    with dev-harness/docinfo-check.mjs building a fixture that deliberately
//    disagrees with itself (19 assertions). See the memory note
//    dailydesk-metadata-and-converters.
//  - Adobe's LiveCycle XMP Utilities service resolving a disagreement by which
//    copy is newer: read at help.adobe.com on 2026-11-25. It is quoted as what
//    that one service documents, NOT as how readers in general behave, because
//    the page itself scopes it that way.
//  - ⛔ Deliberately NOT claimed: that the PDF specification makes XMP
//    authoritative. Secondary sources say ISO 32000-2 deprecates most Info
//    entries in favour of XMP, and that PDF/A requires the two to agree, but
//    neither was read at source — pdfa.org returns 403 to automated fetches and
//    we do not work around a bot check. "No single rule you can rely on" is the
//    strongest statement the evidence actually supports, and it happens to be
//    the one that matters to the reader.
function MetadataExplainer() {
  return (
    <section className="mt-12 space-y-10 border-t pt-10">
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          How to remove metadata from a PDF &mdash; and the second copy most tools miss
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The short version is the three steps above: drop the file in, look at what it was carrying,
          press Remove all metadata. The rest of this page is for anyone who wants to know what was in
          there, why a PDF metadata remover can report success and leave the author&rsquo;s name sitting
          in the file, and how to satisfy yourself afterwards that it is genuinely gone.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A PDF has two places to write down who made it. One is the <b className="text-foreground">Info
          dictionary</b>, a short list of key-value pairs in the file&rsquo;s trailer that has been there
          since the format&rsquo;s early days. The other is an <b className="text-foreground">XMP
          packet</b> — a block of XML attached to the document catalogue, which can also carry editing
          history, rights statements and whatever else the producing application felt like recording.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Both can hold your name at the same time, and nothing forces them to agree. Strip the Info
          dictionary alone and the file&rsquo;s bytes change, the properties panel may well look empty —
          and the XMP packet is still sitting in there with the original author in it. That is the single
          most common reason a tool appears to have worked and has not.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          There is no universal rule you can lean on for which copy wins when they disagree. Adobe
          documents its own LiveCycle XMP Utilities service as settling it by recency — &ldquo;If the Info
          dictionary is newer, the Info dictionary properties are used to update the XMP metadata&rdquo;,
          and the reverse when the XMP is newer. That is one product&rsquo;s documented behaviour, not a
          law about readers in general, which is rather the point: if the tie-break is per-implementation,
          the only answer that holds everywhere is to empty both.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-bold tracking-tight">What is actually in there, and what it gives away</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-4 font-bold">What it holds</th>
                <th className="py-2 pr-4 font-bold">Where it lives</th>
                <th className="py-2 font-bold">What it tends to reveal</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border/60">
                <td className="py-2.5 pr-4 font-medium text-foreground">Author</td>
                <td className="py-2.5 pr-4">Info · XMP (<code className="text-xs">dc:creator</code>)</td>
                <td className="py-2.5">Usually the operating-system account name of whoever saved it, not a name they chose</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2.5 pr-4 font-medium text-foreground">Creator</td>
                <td className="py-2.5 pr-4">Info · XMP (<code className="text-xs">xmp:CreatorTool</code>)</td>
                <td className="py-2.5">The application the document was written in, often with its version</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2.5 pr-4 font-medium text-foreground">Producer</td>
                <td className="py-2.5 pr-4">Info · XMP (<code className="text-xs">pdf:Producer</code>)</td>
                <td className="py-2.5">The library or printer driver that wrote the PDF out — which is how a file announces it passed through a particular converter</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2.5 pr-4 font-medium text-foreground">Title, Subject, Keywords</td>
                <td className="py-2.5 pr-4">Info · XMP (<code className="text-xs">dc:*</code>)</td>
                <td className="py-2.5">Frequently an internal filename or a draft title nobody meant to publish</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2.5 pr-4 font-medium text-foreground">Created and modified dates</td>
                <td className="py-2.5 pr-4">Info · XMP</td>
                <td className="py-2.5">When it was written and last touched, to the second, with a timezone offset that narrows down where</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2.5 pr-4 font-medium text-foreground">Editing history</td>
                <td className="py-2.5 pr-4">XMP only</td>
                <td className="py-2.5">A chain of earlier save events — tools used, document ids, sometimes a path</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2.5 pr-4 font-medium text-foreground">Custom fields</td>
                <td className="py-2.5 pr-4">Info</td>
                <td className="py-2.5">Whatever the originating system wrote: matter numbers, client codes, template ids</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2.5 pr-4 font-medium text-foreground">Page thumbnails</td>
                <td className="py-2.5 pr-4">Page objects</td>
                <td className="py-2.5">Small images of pages, which can survive a page being deleted from the document</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium text-foreground">Private application data</td>
                <td className="py-2.5 pr-4"><code className="text-xs">/PieceInfo</code></td>
                <td className="py-2.5">A scratch area applications use for their own state, with no rules about what goes in it</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          This tool empties every row of that table. The page content is not touched, which is why the
          document still renders and prints identically.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-bold tracking-tight">How to check it actually worked</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Worth doing once on a file you care about, with any tool — including this one. Three ways,
          cheapest first:
        </p>
        <ol className="mt-4 max-w-2xl list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            <b className="text-foreground">Put the cleaned file back in above.</b> The scan reads both
            copies, so every row should come back empty. If a value reappears, the file still has it
            somewhere.
          </li>
          <li>
            <b className="text-foreground">Open the document properties panel in whichever reader you
            use.</b> Note that this only tells you what that reader chose to display, which is the
            weakness of checking this way and the reason it is not first on the list.
          </li>
          <li>
            <b className="text-foreground">Search the raw bytes.</b> On a Mac or Linux box,{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">strings cleaned.pdf | grep -i
            &apos;your name&apos;</code> returns nothing when the file is genuinely clear. This is the
            check that catches a leftover XMP packet, because it does not care what any reader thinks.
          </li>
        </ol>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Our own engine is held to the same standard: the regression harness builds a PDF whose Info
          dictionary and XMP packet deliberately contradict each other, then asserts nineteen things
          about what comes out the other side. A fixture that agrees with itself cannot catch the bug
          this whole page is about.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-bold tracking-tight">What this does not do</h2>
        <ul className="mt-3 max-w-2xl space-y-2.5 text-sm leading-relaxed text-muted-foreground">
          <li>
            <b className="text-foreground">It does not change anything visible.</b> A name in the body
            text, a letterhead, a signature on a scan — all still there. Metadata is the hidden layer
            only.
          </li>
          <li>
            <b className="text-foreground">It deletes rather than rewrites.</b> If you need the fields
            to say something specific instead of nothing — a title for a document going into a
            library, a producer you are happy to admit to — use{' '}
            <Link href="/edit-pdf-metadata" className="font-medium text-primary underline-offset-4 hover:underline">
              Edit PDF details
            </Link>
            , which writes both copies so they agree.
          </li>
          <li>
            <b className="text-foreground">It is not for photographs.</b> A JPEG straight off a phone
            carries its own hidden block, including where the shot was taken. That is{' '}
            <Link href="/remove-exif" className="font-medium text-primary underline-offset-4 hover:underline">
              Remove EXIF &amp; GPS
            </Link>
            .
          </li>
        </ul>
      </div>

      <ThirdPartyNotice
        subject="Adobe"
        because="Adobe's own documentation is quoted above as a published example of how one product settles a disagreement between a PDF's two copies of its metadata, and the quotation is scoped to that service rather than to readers in general"
      />
    </section>
  );
}

export default function RemovePdfMetadataPage() {
  return (
    <PdfToolPage
      title="Remove PDF metadata"
      description="See what your PDF quietly says about you — author, software, timestamps, editing history — and wipe it in one click. Free, instant, and private: nothing leaves your browser."
      steps={steps}
      faqs={faqs}
      // ⚠ afterTool, not a child: children are wrapped in ToolGate, so anything
      // meant to be crawled must sit outside it. See
      // tests/unit/orphan-links.test.ts for how that bit us on the bank hub.
      afterTool={<MetadataExplainer />}
    >
      <MetadataTool />
    </PdfToolPage>
  );
}
