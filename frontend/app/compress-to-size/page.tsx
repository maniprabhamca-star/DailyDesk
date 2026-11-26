import type { Metadata } from 'next';
import Link from 'next/link';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { SpecificCase } from '@/components/app/specific-case';
import { CompressTargetTool } from '@/components/tools/compress-target-tool';
import { ThirdPartyNotice } from '@/components/app/third-party-notice';
import { PUBLISHED_LIMITS, UNVERIFIED_COUNT, SIZE_LIMITS } from '@/lib/size-limits';

export const metadata: Metadata = {
  title: "Compress PDF or Image to a Target Size (KB/MB) | DiemDesk",
  description:
    "Compress a PDF or image to an exact size — 50 KB, 100 KB, 200 KB, 500 KB, 1 MB or 2 MB — for exam, visa and portal uploads. Free, on your device.",
  alternates: { canonical: '/compress-to-size' },
  openGraph: {
    images: ['/og/compress-to-size.png'],
    title: 'Compress to a Target Size — PDF & Image | DiemDesk',
    description: 'Hit an exact KB/MB limit for exam, visa and portal uploads. PDF & image, on your device, no upload.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF or image in, or click to choose it.',
  'Pick a target size — a round preset, one of the exam, passport or visa caps the tool fills for you, or a custom KB value.',
  'Compress, then download a file that fits under your limit.',
];

const faqs = [
  { q: 'How do I compress a PDF to under 100 KB?', a: 'Drop the PDF in, tap the “100 KB” preset (or type a custom value), and press Compress. We reduce the resolution and quality just enough to land under your limit, then you download it — ready to upload to the portal.' },
  { q: 'Can I compress a photo to exactly 50 KB for an exam form?', a: 'Yes. Switch to Image, choose 50 KB or type the exact cap the form asks for, and we shrink the photo to fit under that size while keeping it as sharp as the limit allows.' },
  { q: 'Is my file uploaded anywhere?', a: 'No. Everything runs inside your browser on your own device — the file never leaves your computer. You can verify in your browser’s Network tab.' },
  { q: 'What if it can’t reach my target?', a: 'If the target is smaller than the file can physically go without falling apart, we hand back the smallest version we could make and tell you — so you can pick a slightly larger target. For multi-page PDFs, splitting first often helps.' },
  { q: 'Will the PDF text stay selectable?', a: 'For small over-limits we optimize losslessly and text stays selectable. To hit very small targets we render pages as images (like every aggressive compressor does), which trades selectable text for meeting the limit.' },
  { q: 'Is there a size or daily limit?', a: 'No daily limit and no watermark. Because it runs on your device there’s no server cap — only your device’s memory, which we warn you about before very large files.' },
];

// ── The upload limits, and only the ones we have actually read ──────────────
//
// The tool offers every preset in lib/size-limits.ts. This table publishes only
// the rows carrying a source, because a preset and a published claim are not
// the same act — the reasoning is at the top of that file.
//
// The counts come from the data, so the sentence cannot drift away from the
// table the way a hand-typed "we have checked 14 of these" would.
//
// ⚠ Passed through `afterTool`, which renders outside ToolGate. A table whose
// whole purpose is to be crawled must never sit in `children`.
function SourcedLimits() {
  return (
    <section className="mt-10 border-t pt-8">
      <h2 className="text-xl font-bold tracking-tight">Upload limits, read at source</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        The tool fills {SIZE_LIMITS.length} caps with one tap. These are the ones we have opened the
        authority&rsquo;s own page for, with the date we read it and the sentence it says. A file-size
        cap is only a fact until the portal changes it, so a figure without a date is not worth much
        — which is also why the other {UNVERIFIED_COUNT} are offered in the tool as a starting number
        and are not written up here as anybody&rsquo;s rule.
      </p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-4 font-bold">Cap</th>
              <th className="py-2 pr-4 font-bold">What it applies to</th>
              <th className="py-2 pr-4 font-bold">Authority</th>
              <th className="py-2 font-bold">Read</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {PUBLISHED_LIMITS.map((l) => (
              <tr key={l.label} className="border-b border-border/60 align-top">
                <td className="py-3 pr-4 font-medium text-foreground">
                  {l.label}
                  <span className="ml-2 font-mono text-xs tabular-nums text-muted-foreground">{l.note}</span>
                </td>
                <td className="py-3 pr-4">
                  {l.applies}
                  <span className="mt-1 block text-xs italic">&ldquo;{l.source.quote}&rdquo;</span>
                </td>
                <td className="py-3 pr-4">
                  <a
                    href={l.source.url}
                    rel="nofollow noopener"
                    className="underline-offset-4 hover:text-primary hover:underline"
                  >
                    {l.source.authority}
                  </a>
                </td>
                <td className="py-3 font-mono text-xs tabular-nums">{l.source.checked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Two of these were unreadable to us rather than unchecked, and the distinction is worth
        stating: the US visa photo requirements sit behind a bot check and Discord&rsquo;s help centre
        refuses automated requests. We do not work around either, so those rows stay out of the table
        until the pages can be read another way.
      </p>

      <ThirdPartyNotice
        className="mt-6"
        subject="Google, Immigration, Refugees and Citizenship Canada, and the examination boards and passport offices named in this tool"
        because="Each is named only to say which upload cap a preset fills, and every figure in the table above links to the page it was read on, so you can check it against the current one yourself"
      >
        A cap can change the day after we read it. The authority&rsquo;s own page is the record, not
        ours.
      </ThirdPartyNotice>
    </section>
  );
}

export default function CompressToSizePage() {
  return (
    <PdfToolPage
      title="Compress to a target size"
      description="Hit an exact file-size limit — under 100 KB, 200 KB, 1 MB, whatever the portal demands — for exam and visa forms, government uploads, or email. Works for PDFs and images, right in your browser. Your file never leaves your device."
      steps={steps}
      faqs={faqs}
      afterTool={
        <>
          <SpecificCase>
            100 KB is the number portals ask for most often, and it has a page of its own —{' '}
            <Link href="/compress-pdf-to-100kb" className="font-medium text-primary underline-offset-4 hover:underline">
              compress a PDF to 100 KB
            </Link>{' '}
            — if that is the limit you were given.
          </SpecificCase>
          <SourcedLimits />
        </>
      }
    >
      <CompressTargetTool />
    </PdfToolPage>
  );
}
