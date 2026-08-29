import type { Metadata } from 'next';
import Link from 'next/link';
import { Terminal, CloudOff, Cloud, ShieldCheck, ArrowRight } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'MCP Server — DiemDesk Tools in Claude | DiemDesk',
  description:
    'Connect Claude, ChatGPT or any MCP client to DiemDesk. Convert Office files and PDFs, OCR a scan, capture a web page — from inside your assistant.',
  alternates: { canonical: '/mcp-server' },
  openGraph: {
    images: ['/og.png'],
    title: 'DiemDesk MCP server',
    description: 'Document tools inside your assistant — and an honest answer about which ones cannot be.',
    type: 'website',
  },
};

const TOOLS = [
  { name: 'office_to_pdf', what: 'Word, Excel, PowerPoint, OpenDocument, RTF, CSV or HTML → PDF' },
  { name: 'pdf_to_word', what: 'PDF → editable .docx' },
  { name: 'pdf_to_powerpoint', what: 'PDF → editable .pptx' },
  { name: 'pdf_to_rtf', what: 'PDF → rich text' },
  { name: 'pdf_to_odt', what: 'PDF → OpenDocument text' },
  { name: 'pdf_to_pdfa', what: 'PDF → PDF/A, the archival format' },
  { name: 'ocr_pdf', what: 'Scanned PDF → searchable, plus the recognised text' },
  { name: 'webpage_to_pdf', what: 'A live URL → PDF' },
  { name: 'list_local_tools', what: 'Asks what is deliberately NOT here, and why' },
];

const CONFIG = `{
  "mcpServers": {
    "diemdesk": {
      "command": "npx",
      "args": ["-y", "@diemdesk/mcp"]
    }
  }
}`;

const faqs = [
  {
    q: 'Why are there nine tools and not 114?',
    a: 'Because almost everything DiemDesk does runs inside your browser — the file is opened and rebuilt on your own machine and never reaches us. An MCP server cannot reach those tools, and we are not going to build server copies of them just to have a longer list, because that would mean uploading files that currently never move. What you get here is exactly the set that already ran on our servers.',
  },
  {
    q: 'So what happens to a file I pass it?',
    a: 'These nine are the server-side tools, so the file does go to our server, is converted, and is deleted immediately afterwards. That is the same tier as the Office conversions on the website, and it is labelled the same way. If that is not what you want for a particular document, use the in-browser tool on diemdesk.com instead — ask the assistant to run list_local_tools and it will tell you which ones those are.',
  },
  {
    q: 'Do I need an account?',
    a: 'Not for the free daily allowance. Set DIEMDESK_TOKEN in the server config to lift the cap on a Pro account, and to reach the Pro-only tools.',
  },
  {
    q: 'Which clients does it work with?',
    a: 'Any MCP client. It speaks the protocol over stdio with no dependencies, so npx can run it without installing anything permanently — Claude Desktop, Claude Code, and other MCP-capable assistants.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
};

export default function McpServerPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <Terminal className="size-3.5" /> Model Context Protocol
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">DiemDesk inside your assistant</h1>
          <p className="mt-3 text-muted-foreground">
            Convert a document, OCR a scan or capture a web page without leaving Claude. Nine tools, and a straight
            answer about why it is nine and not a hundred.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link href="#install">Set it up <ArrowRight className="size-4" /></Link></Button>
          </div>
        </div>

        <section id="install" className="mt-14 scroll-mt-24">
          <h2 className="text-xl font-bold tracking-tight">Set it up</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Add this to your MCP client&rsquo;s config — <code className="rounded bg-muted px-1 py-0.5 text-xs">claude_desktop_config.json</code> for
            Claude Desktop, or <code className="rounded bg-muted px-1 py-0.5 text-xs">.mcp.json</code> for Claude Code — then restart it.
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border bg-card">
            <pre className="p-4 text-xs leading-relaxed"><code>{CONFIG}</code></pre>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            To use a Pro account, add{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">&quot;env&quot;: &#123; &quot;DIEMDESK_TOKEN&quot;: &quot;your-token&quot; &#125;</code>{' '}
            alongside <code className="rounded bg-muted px-1 py-0.5 text-xs">args</code>.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight">What it can do</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <tbody>
                {TOOLS.map((t) => (
                  <tr key={t.name} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-medium text-primary">{t.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{t.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight">Why nine and not a hundred</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-5">
              <CloudOff className="size-5 text-emerald-600" />
              <p className="mt-2.5 text-sm font-semibold">Most tools cannot be here, and that is the point</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Merge, split, compress, redact, sign, watermark, bank statement to Excel and about a hundred others run
                inside your browser. The file never reaches us. An MCP server has no way to touch those, and building
                server copies purely to lengthen this list would mean uploading files that currently never move.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <Cloud className="size-5 text-amber-600" />
              <p className="mt-2.5 text-sm font-semibold">These nine already ran on our servers</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Office conversions, OCR and webpage capture genuinely cannot run in a browser, and never could. Exposing
                them here changes nothing about where your file goes — it is the same tier, labelled the same way, with
                the file deleted immediately after the job.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4 text-sm leading-relaxed text-muted-foreground">
            <ShieldCheck className="mb-1.5 size-5 text-emerald-600" />
            <b className="text-foreground">A shorter list that tells the truth beats a longer one that quietly
            changes the answer.</b>{' '}
            Ask your assistant to run <code className="rounded bg-muted px-1 py-0.5 text-xs">list_local_tools</code> and
            it will tell you which jobs to do at{' '}
            <Link href="/" className="text-primary underline underline-offset-2">diemdesk.com</Link> instead, where
            nothing is uploaded at all.
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight">Questions</h2>
          <dl className="mt-4 space-y-4">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-xl border bg-card p-4">
                <dt className="text-sm font-semibold">{f.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
