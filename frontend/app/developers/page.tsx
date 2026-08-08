import type { Metadata } from 'next';
import Link from 'next/link';
import { Terminal, ShieldOff, Zap, Ban, Code2, ArrowRight } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';

export const metadata: Metadata = {
  title: 'PDF SDK for Developers | DiemDesk',
  description:
    'Run PDF operations in your users’ browser. No endpoint, no API key, no upload — so there is no subprocessor to declare and nothing to meter.',
  alternates: { canonical: '/developers' },
  openGraph: {
    images: ['/og.png'],
    title: 'A PDF SDK with no server in it',
    description: 'Merge, split, rotate and strip metadata in the browser. The file never reaches a server — not ours, not yours.',
    type: 'website',
  },
};

const API = [
  { sig: 'info(bytes)', what: 'page count, page sizes, title / author / producer' },
  { sig: 'merge(files[])', what: 'join documents in the order given' },
  { sig: 'extractPages(bytes, sel)', what: 'keep only the pages you select' },
  { sig: 'deletePages(bytes, sel)', what: 'drop the pages you select' },
  { sig: 'rotate(bytes, opts)', what: 'turn pages, relative to their current rotation' },
  { sig: 'removeMetadata(bytes)', what: 'clear title, author, producer, timestamps' },
  { sig: 'splitEvery(bytes, n)', what: 'cut into fixed-size chunks' },
  { sig: 'parsePageSelection(spec, n)', what: '"1-3, 7, 12-" → page indices' },
];

const NOT = [
  ['Bookmarks and form fields through merge', 'pdf-lib copies pages, not the document-level structures that point at them. A half-copied outline is worse than none.'],
  ['Encryption or password removal', 'Not supported. We would rather say so than ship something that half-works.'],
  ['OCR, rasterisation, Office conversion', 'These need heavy WASM or a server. Including them quietly would betray the whole point of the package.'],
  ['removeMetadata does not touch the page', 'It clears the information dictionary. Text visible on the page stays visible — removing that is redaction, a far more careful operation.'],
];

export default function DevelopersPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-10 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Code2 className="size-3.5" /> Developer preview
          </span>
          <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            A PDF SDK with no server in it
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            Every other PDF API in this space is a REST endpoint: your user’s document travels to a
            third party, is processed, and comes back. That is a fine design until the document is a
            medical record, a client’s bank statement or an unsigned contract — at which point
            “deleted after an hour” is a promise about someone’s conduct, not a limit on their
            access, and your compliance review has to reason about a vendor your user never chose.
          </p>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            This runs in the browser tab. No endpoint, no key, no upload.
          </p>

          <pre className="mt-8 overflow-x-auto rounded-xl border bg-muted/40 p-4 font-mono text-[13px] leading-relaxed">
{`npm i @diemdesk/pdf pdf-lib

import { merge, extractPages, info } from '@diemdesk/pdf';

const file = await input.files[0].arrayBuffer();
const { pages } = await info(file);            // 12
const firstThree = await extractPages(file, '1-3');
const combined   = await merge([fileA, fileB]);`}
          </pre>

          <section className="mt-12 grid gap-3 sm:grid-cols-3">
            {[
              { icon: ShieldOff, title: 'Nothing to declare', body: 'No subprocessor in your DPA, because there is no processor.' },
              { icon: Zap, title: 'Nothing to meter', body: 'It runs on hardware your user already paid for.' },
              { icon: Ban, title: 'No plan limit', body: 'File size is bounded by their memory, not our pricing.' },
            ].map((c) => (
              <div key={c.title} className="rounded-xl border p-4">
                <c.icon className="size-5 text-primary" />
                <p className="mt-2 text-sm font-semibold">{c.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{c.body}</p>
              </div>
            ))}
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-bold tracking-tight">What it does</h2>
            <div className="mt-4 overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y">
                  {API.map((r) => (
                    <tr key={r.sig}>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12.5px] font-medium">{r.sig}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Page selections take either a string a person would type (<code className="font-mono text-[12.5px]">&apos;1-3, 7&apos;</code>,{' '}
              <code className="font-mono text-[12.5px]">&apos;12-&apos;</code>, <code className="font-mono text-[12.5px]">&apos;all&apos;</code>) or
              explicit one-based numbers. One-based going in, because that is what is printed on the
              page; zero-based internally, because that is what the PDF wants. That boundary lives in
              one tested function instead of being re-derived at every call site.
            </p>
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-bold tracking-tight">What it doesn’t do, on purpose</h2>
            <dl className="mt-4 space-y-3">
              {NOT.map(([t, d]) => (
                <div key={t} className="rounded-xl border p-4">
                  <dt className="text-sm font-semibold">{t}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-12 rounded-2xl border border-amber-500/35 bg-amber-500/[0.05] p-5 sm:p-6">
            <h2 className="text-sm font-bold">The honest trade</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Browser memory is not infinite, and this is synchronous work on the main thread unless
              you move it into a Worker. For files in the tens of megabytes that is a non-issue; for a
              500MB scan it is not, and your UI should say so. We would rather you knew that before
              you shipped than after.
            </p>
          </section>

          <section className="mt-12 rounded-2xl border border-primary/30 bg-primary/[0.05] p-6">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Terminal className="size-4 text-primary" /> Not on npm yet
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The package is built and tested, and the licence is still being settled — publishing
              under terms we would want to change later is the one mistake you cannot take back,
              because everyone who installed it keeps the terms they got. If you want it, say so and
              we will tell you the day it lands.
            </p>
            <Link
              href="/feedback"
              className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-soft transition hover:bg-primary/90"
            >
              Tell us what you need <ArrowRight className="size-4" />
            </Link>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
