import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { KeywordLanding } from '@/components/app/keyword-landing';
import { BANK_PAGES, getBankPage } from '@/lib/bank-statements';

export function generateStaticParams() {
  return BANK_PAGES.map((b) => ({ bank: b.slug }));
}

export function generateMetadata({ params }: { params: { bank: string } }): Metadata {
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

export default function Page({ params }: { params: { bank: string } }) {
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
