import type { Metadata } from 'next';
import Link from 'next/link';
import { Terminal, CloudOff, Cloud, ShieldCheck, ArrowRight, CircleHelp, Wrench, Clock } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { Button } from '@/components/ui/button';
import { CopyBlock } from '@/components/app/copy-block';

export const metadata: Metadata = {
  title: 'MCP Server — DiemDesk Tools in Claude | DiemDesk',
  description:
    'Use DiemDesk from inside Claude. Convert Office files and PDFs, OCR a scan, capture a web page — set up in two minutes, step by step.',
  alternates: { canonical: '/mcp-server' },
  openGraph: {
    images: ['/og.png'],
    title: 'DiemDesk inside Claude',
    description: 'Document tools in your assistant — set up in two minutes.',
    type: 'website',
  },
};

const CONFIG = `{
  "mcpServers": {
    "diemdesk": {
      "command": "npx",
      "args": ["-y", "diemdesk-mcp"]
    }
  }
}`;

const CONFIG_PRO = `{
  "mcpServers": {
    "diemdesk": {
      "command": "npx",
      "args": ["-y", "diemdesk-mcp"],
      "env": {
        "DIEMDESK_TOKEN": "paste-your-token-here"
      }
    }
  }
}`;

const CLI = 'claude mcp add diemdesk -- npx -y diemdesk-mcp';

// The package is not on npm yet, so every command on this page fails with a
// 404 for anyone who follows it today. Saying so is not an apology — it is the
// difference between "not out yet" and "their instructions are broken", and
// only one of those is recoverable for a developer deciding whether to trust
// us. FLIP THIS TO true THE MOMENT `npm publish` succeeds; that is the only
// edit needed, the notices below disappear with it.
const PUBLISHED = false;

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

const TROUBLE = [
  {
    q: 'Claude does not show the tools',
    a: 'Restart it completely — Claude Desktop reads the config once at startup, so a reload is not enough. On a Mac, quit from the menu bar rather than closing the window. If they still do not appear, the config file almost certainly has a JSON syntax error: a trailing comma or a missing brace stops the whole file being read, silently.',
  },
  {
    q: '"npx: command not found"',
    a: 'Node.js is not installed, or not on the PATH your assistant sees. Install Node 18 or newer from nodejs.org and restart. On a Mac, if you installed Node through Homebrew, you may need the full path to npx — run "which npx" in a terminal and use that instead of "npx" in the config.',
  },
  {
    q: 'It says a tool needs Pro',
    a: 'OCR is a Pro tool. Add your token to the config as shown above. The conversions work on the free daily allowance without one.',
  },
  {
    q: 'It converted the file but I cannot find it',
    a: 'Results are written next to the input file, with the same name and a new extension. Ask for a specific location and it will use that instead — "convert ~/Desktop/report.docx to PDF and put it in ~/Documents".',
  },
];

const faqs = [
  {
    q: 'What is MCP, in plain terms?',
    a: 'A standard way for an AI assistant to use outside tools. Without it, Claude can talk about your PDF but cannot do anything to it. With this installed, you can say "convert this to PDF" and it actually happens, on your own machine, to a real file.',
  },
  {
    q: 'Why nine tools and not 114?',
    a: 'Because almost everything DiemDesk does runs inside your browser — the file is opened and rebuilt on your own machine and never reaches us. An MCP server cannot reach those tools, and we are not going to build server copies just to have a longer list, because that would mean uploading files that currently never move. What you get here is exactly the set that already ran on our servers.',
  },
  {
    q: 'Why are the AI tools not included?',
    a: 'Summarise, chat and translate exist to bring AI to people on our website. Inside an assistant they are circular — you would be asking Claude to ask us to do something Claude already does. The tools here are the ones an assistant genuinely cannot do on its own.',
  },
  {
    q: 'So what happens to a file I pass it?',
    a: 'These are the server-side tools, so the file does go to our server, is converted, and is deleted immediately afterwards. Same tier as the Office conversions on the website, labelled the same way. If that is not what you want for a particular document, use the in-browser tool on diemdesk.com — ask the assistant to run list_local_tools and it will tell you which those are.',
  },
  {
    q: 'Does it work with anything other than Claude?',
    a: 'Yes. It speaks the Model Context Protocol over stdio with no dependencies, so any MCP-capable client can run it.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [...faqs, ...TROUBLE].map((f) => ({
    '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="relative pl-11">
      <span className="absolute left-0 top-0 flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {n}
      </span>
      <h3 className="pt-1 text-base font-semibold">{title}</h3>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

export default function McpServerPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <Terminal className="size-3.5" /> Model Context Protocol
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Use DiemDesk inside Claude</h1>
          <p className="mt-3 text-muted-foreground">
            Say &ldquo;convert this to PDF&rdquo; and it happens — to a real file, on your own machine, without opening a
            browser. Two minutes to set up.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link href="#setup">Set it up <ArrowRight className="size-4" /></Link></Button>
          </div>
          {!PUBLISHED && (
            <p className="mx-auto mt-5 flex max-w-lg items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 text-left text-sm text-amber-800 dark:text-amber-300">
              <Clock className="mt-0.5 size-4 shrink-0" />
              <span>
                <b className="font-semibold">Coming shortly.</b> The server is built and tested — it is not on npm yet, so
                the commands below will not resolve for a day or so. Everything on this page is what you will run;
                nothing about it changes when it lands.
              </span>
            </p>
          )}
        </div>

        {/* What it feels like, before any config. Someone deciding whether this is
            worth two minutes needs to see the point, not a JSON blob. */}
        <section className="mt-14">
          <h2 className="text-xl font-bold tracking-tight">What it looks like</h2>
          <div className="mt-4 space-y-3 rounded-2xl border bg-card p-5">
            <p className="rounded-xl bg-primary/10 px-4 py-2.5 text-sm">
              <b className="text-foreground">You:</b> Turn the invoice on my desktop into a PDF and make it searchable.
            </p>
            <p className="rounded-xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
              <b className="text-foreground">Claude:</b> Converted <code className="rounded bg-background px-1 py-0.5 text-xs">invoice.docx</code> to{' '}
              <code className="rounded bg-background px-1 py-0.5 text-xs">invoice.pdf</code>, then ran OCR. The text layer is in;
              you can search it now.
            </p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            No upload dialog, no tab switch. It reads the file from your disk and writes the result back beside it.
          </p>
        </section>

        <section id="setup" className="mt-14 scroll-mt-24">
          <h2 className="text-xl font-bold tracking-tight">Set it up</h2>
          {!PUBLISHED && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <Clock className="mt-0.5 size-4 shrink-0" />
              <span>
                Worth knowing before you copy anything: <code className="rounded bg-background/70 px-1 py-0.5 text-xs">diemdesk-mcp</code>{' '}
                is not published yet, so these will fail with a <b>404</b> today. Bookmark the page — the steps are final.
              </span>
            </p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            You need <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">Node.js 18 or newer</a>.
            Nothing else is installed permanently — <code className="rounded bg-muted px-1 py-0.5 text-xs">npx</code> fetches the
            server when Claude starts it.
          </p>

          <div className="mt-6 space-y-8">
            <Step n={1} title="Open your config file">
              <p>The file may not exist yet. If it does not, create it — the folder is already there.</p>
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full min-w-[440px] border-collapse text-xs">
                  <tbody>
                    <tr className="border-b">
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-foreground">Claude Desktop · macOS</td>
                      <td className="px-3 py-2 font-mono">~/Library/Application Support/Claude/claude_desktop_config.json</td>
                    </tr>
                    <tr className="border-b">
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-foreground">Claude Desktop · Windows</td>
                      <td className="px-3 py-2 font-mono">%APPDATA%\Claude\claude_desktop_config.json</td>
                    </tr>
                    <tr>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-foreground">Claude Code</td>
                      <td className="px-3 py-2 font-mono">.mcp.json, in your project folder</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                In Claude Desktop you can also reach it from <b className="text-foreground">Settings → Developer → Edit
                config</b>, which opens the right file for you.
              </p>
            </Step>

            <Step n={2} title="Paste this in">
              <p>
                If the file already has an <code className="rounded bg-muted px-1 py-0.5 text-xs">mcpServers</code> block,
                add just the <code className="rounded bg-muted px-1 py-0.5 text-xs">&quot;diemdesk&quot;</code> entry inside it
                rather than replacing the whole thing.
              </p>
              <CopyBlock code={CONFIG} label="claude_desktop_config.json" />
              <p>
                Prefer a terminal? In Claude Code this one line does the same job:
              </p>
              <CopyBlock code={CLI} label="Claude Code" />
            </Step>

            <Step n={3} title="Restart Claude — fully">
              <p>
                The config is read once at startup. Closing the window is not enough: quit the application properly
                (<b className="text-foreground">Cmd&nbsp;+&nbsp;Q</b> on a Mac, or right-click the tray icon on Windows) and open it again.
              </p>
            </Step>

            <Step n={4} title="Check it worked">
              <p>
                Ask it: <b className="text-foreground">&ldquo;What DiemDesk tools do you have?&rdquo;</b> It should list nine.
                In Claude Desktop they also appear under the tools icon in the message box.
              </p>
              <p>Then try the real thing, with a file you actually have:</p>
              <div className="rounded-xl bg-primary/10 px-4 py-2.5 text-sm text-foreground">
                &ldquo;Convert ~/Desktop/report.docx to PDF.&rdquo;
              </div>
            </Step>

            <Step n={5} title="Optional — connect a Pro account">
              <p>
                The conversions run on the free daily allowance without any account. Add your token to lift the cap and
                reach the Pro tools such as OCR.
              </p>
              <CopyBlock code={CONFIG_PRO} label="With a Pro token" />
            </Step>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-bold tracking-tight">The nine tools</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[460px] border-collapse text-sm">
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
          <p className="mt-3 text-sm text-muted-foreground">
            You never type these names. Ask for what you want in your own words and the assistant picks the right one.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-bold tracking-tight">Why nine and not a hundred</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-5">
              <CloudOff className="size-5 text-emerald-600" />
              <p className="mt-2.5 text-sm font-semibold">Most tools cannot be here, and that is the point</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Merge, split, compress, redact, sign, bank statement to Excel and about a hundred others run inside your
                browser. The file never reaches us. An MCP server has no way to touch those, and building server copies
                purely to lengthen this list would mean uploading files that currently never move.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <Cloud className="size-5 text-amber-600" />
              <p className="mt-2.5 text-sm font-semibold">These nine already ran on our servers</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Office conversions, OCR and webpage capture genuinely cannot run in a browser, and never could. Exposing
                them here changes nothing about where your file goes — same tier, same labelling, deleted immediately
                after the job.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4 text-sm leading-relaxed text-muted-foreground">
            <ShieldCheck className="mb-1.5 size-5 text-emerald-600" />
            <b className="text-foreground">A shorter list that tells the truth beats a longer one that quietly changes
            the answer.</b>{' '}
            Ask the assistant to run <code className="rounded bg-muted px-1 py-0.5 text-xs">list_local_tools</code> and it
            will tell you which jobs to do at{' '}
            <Link href="/" className="text-primary underline underline-offset-2">diemdesk.com</Link> instead, where nothing
            is uploaded at all.
          </div>
        </section>

        <section className="mt-14">
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Wrench className="size-5 text-muted-foreground" /> If something goes wrong
          </h2>
          <dl className="mt-4 space-y-3">
            {TROUBLE.map((t) => (
              <div key={t.q} className="rounded-xl border bg-card p-4">
                <dt className="text-sm font-semibold">{t.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-14">
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <CircleHelp className="size-5 text-muted-foreground" /> Questions
          </h2>
          <dl className="mt-4 space-y-3">
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
