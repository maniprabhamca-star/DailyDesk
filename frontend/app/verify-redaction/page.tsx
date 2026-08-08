import type { Metadata } from 'next';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { VerifyRedactionTool } from '@/components/pdf/verify-redaction-tool';

export const metadata: Metadata = {
  title: 'Check a Redaction Certificate | DiemDesk',
  description:
    'Drop in a redacted PDF and its certificate to confirm they match. Runs in your browser — neither file is uploaded.',
  alternates: { canonical: '/verify-redaction' },
  openGraph: {
    images: ['/og.png'],
    title: 'Check a redaction certificate',
    description: 'Confirm a redacted PDF is the exact file its certificate describes. Nothing is uploaded.',
    type: 'website',
  },
};

// The other half of the certificate. A receipt only means something if the
// person who receives it can check it without taking your word for anything —
// including ours. This page needs no account, works on a file we have never
// seen, and does the comparison on the reader's own machine.
export default function VerifyRedactionPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-10 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight">Check a redaction certificate</h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Someone sent you a redacted PDF and a certificate. This confirms the two belong together —
            that the file in your hands is the exact one the certificate describes, unchanged since it
            was made.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            You don’t need an account, and you don’t need to trust us: the check is a SHA-256
            comparison that happens in this tab. Neither file is uploaded — open your Network tab and
            watch if you like.
          </p>

          <VerifyRedactionTool />

          <section className="mt-12 border-t pt-6">
            <h2 className="text-lg font-bold tracking-tight">What a match does and doesn’t prove</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                <b className="text-foreground">It proves</b> the PDF you have is byte-for-byte the file
                the certificate was issued for, and it shows what was redacted from it — which pages,
                how many areas, and whether any selectable text survived on those pages.
              </p>
              <p>
                <b className="text-foreground">It doesn’t prove</b> when the redaction happened or who
                did it. The time comes from the issuing device’s clock, and there is no third-party
                signature, because obtaining one would mean sending something about the document to a
                server. That was the trade we made deliberately.
              </p>
              <p>
                A mismatch is worth taking seriously but isn’t automatically sinister — re-saving a PDF
                in another application rewrites the file and changes its fingerprint, even when the
                visible content is identical.
              </p>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
