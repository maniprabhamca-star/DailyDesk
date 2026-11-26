import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KeywordLanding } from '@/components/app/keyword-landing';
import { BANK_PAGES, getBankPage, siblingBanks } from '@/lib/bank-statements';

export function generateStaticParams() {
  return BANK_PAGES.map((b) => ({ bank: b.slug }));
}

export async function generateMetadata(props: { params: Promise<{ bank: string }> }): Promise<Metadata> {
  const params = await props.params;
  const b = getBankPage(params.bank);
  if (!b) return {};
  return {
    // Kept within the 60 / 155-char budgets (Tally lives in the description/body).
    title: `${b.short} Statement PDF to Excel — Free | DiemDesk`,
    description: `Convert your ${b.short} statement PDF to Excel, CSV or Tally — every row checked against the running balance. Read in your browser; never uploaded.`,
    alternates: { canonical: `/bank-statement-converter/${b.slug}` },
    openGraph: {
      images: ['/og.png'],
      title: `${b.short} Statement to Excel & Tally — private`,
      description: `Turn a ${b.name} statement into a balance-verified spreadsheet, on your device.`,
      type: 'website',
    },
  };
}

export default async function Page(props: { params: Promise<{ bank: string }> }) {
  const params = await props.params;
  const b = getBankPage(params.bank);
  if (!b) notFound();

  return (
    <KeywordLanding
      h1={`Convert ${b.short} statement to Excel & Tally`}
      lede={`Turn your ${b.name} statement PDF into a clean transaction table where every row is checked against the running balance — then export to Excel, CSV or Tally. It’s read entirely in your browser, so your ${b.short} statement is never uploaded.`}
      ctaHref="/bank-statement-converter"
      ctaLabel={`Convert my ${b.short} statement`}
      bullets={[
        'Every row verified against the running balance — proven, not guessed',
        `Read on your device — your ${b.short} statement is never uploaded`,
        'Export to Excel (.xlsx), CSV, or Tally XML for Tally Prime',
        'Password-protected e-statement? It unlocks locally — the password never leaves your device',
        `Understands ${b.name}’s exact column layout automatically`,
      ]}
      body={
        <>
          <h2 className="mt-8 text-xl font-bold tracking-tight">How to download your {b.name} statement (PDF)</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            {b.download.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>

          <h2 className="mt-8 text-xl font-bold tracking-tight">Is your {b.short} statement password-protected?</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{b.password}</p>

          <h2 className="mt-8 text-xl font-bold tracking-tight">What we handle for {b.name}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{b.quirk}</p>

          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4 text-sm leading-relaxed text-muted-foreground">
            <b className="text-foreground">Why on-device matters for a bank statement:</b> it’s the most sensitive
            document you own, and every other converter uploads it to their servers. DiemDesk reads the page in your
            browser — open DevTools → Network and you’ll see zero requests leave. <b className="text-foreground">DiemDesk
            is not affiliated with, endorsed by, or connected to {b.name}</b>; the bank’s name is used only to describe
            the statement format we read. Always check the output before filing.
          </div>

          {/* ⚠ The only internal links these pages have.
              A link audit on 2026-11-25 found all 38 bank pages with zero
              inbound links from anywhere on the site — the hub listed none of
              them, and the hub is `soon` in the catalogue so the Tools menu
              emits no anchor for it either. They rank anyway (sbi-card 2.4,
              bandhan 6.5, rbl 7.0), which is the argument for giving them a
              link graph rather than leaving it to the sitemap.

              The slice rotates from this bank's own index, so each page passes
              its links to a different set and every bank receives roughly the
              same number. The same twelve links on all 38 pages would be a
              footer in disguise, and would concentrate the signal on twelve. */}
          <h2 className="mt-10 text-xl font-bold tracking-tight">Statements from other banks</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            The converter reads the layout rather than a per-bank template, so a statement from a
            bank not listed here usually works too. These are the ones with their own write-up —
            where to download the PDF, the password format, and the column quirk we handle.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {siblingBanks(b.slug).map((o) => (
              <li key={o.slug}>
                <Link
                  href={`/bank-statement-converter/${o.slug}`}
                  className="inline-flex rounded-lg border px-2.5 py-1 text-[13px] font-medium transition-colors hover:border-primary/60 hover:text-primary"
                >
                  {o.short} statement
                </Link>
              </li>
            ))}
          </ul>
          {/* ⚠ These three had zero inbound links from any INDEXED page. The
              hub lists them, but the hub is robots:index=false while the tool
              is gated and is kept out of the sitemap, so its links carry
              nothing. These 39 bank pages are indexed, and the export format
              is what the reader is here for. */}
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Where the rows end up is written up separately:{' '}
            <Link href="/bank-statement-to-tally" className="font-medium text-primary underline-offset-4 hover:underline">statement to Tally XML</Link>,{' '}
            <Link href="/bank-statement-to-quickbooks" className="font-medium text-primary underline-offset-4 hover:underline">to QuickBooks</Link>, or{' '}
            <Link href="/bank-statement-to-csv" className="font-medium text-primary underline-offset-4 hover:underline">to CSV</Link>.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            <Link
              href="/bank-statement-converter"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              All {BANK_PAGES.length} banks, and the converter itself
            </Link>
          </p>
        </>
      }
      faqs={[
        { q: `How do I convert a ${b.short} statement to Excel?`, a: `Download your ${b.name} statement as a PDF (steps above), open the DiemDesk Bank Statement Converter, drop the file in, and export to Excel, CSV or Tally. Everything happens in your browser — the file is never uploaded.` },
        { q: `Can I convert a ${b.short} statement to Tally?`, a: `Yes. After the transactions are extracted and balance-verified, choose “Tally XML” and set your company and bank ledger names. It produces a Tally Prime–ready import file — something generic converters don’t offer.` },
        { q: `Is my ${b.short} statement uploaded anywhere?`, a: `No. It is read entirely in your browser and never uploaded, stored, or seen by us. A password-protected PDF is unlocked on your device too — the password never leaves the page.` },
        { q: `How do I know the numbers are right?`, a: `Every row is checked against the running balance: each balance must recompute from the row above it. If everything reconciles, the extraction is arithmetically proven. Any row that doesn’t is highlighted so you can fix it before exporting.` },
        { q: `What about a scanned ${b.short} statement?`, a: `A scanned image has no selectable text — run it through OCR first, then convert it. Statements downloaded from net banking already have a text layer and work directly.` },
      ]}
    />
  );
}
