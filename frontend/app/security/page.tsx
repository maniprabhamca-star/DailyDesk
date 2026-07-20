import type { Metadata } from 'next';
import {
  ShieldCheck, CloudOff, Lock, KeyRound, Sparkles, Server, AlertTriangle, FileCheck2,
  Zap,
} from 'lucide-react';
import { LegalPage, Section, Callout, FlowStep } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Security — How DiemDesk Protects Your Files | DiemDesk',
  description:
    "How DiemDesk keeps documents safe: in-browser processing so files never leave your device, an encrypted File Vault, and how AI handles your data.",
  alternates: { canonical: '/security' },
  openGraph: {
    images: ['/og.png'],
    title: 'Security at DiemDesk',
    description: 'In-browser processing, zero-knowledge encrypted File Vault, and transparent AI handling.',
    type: 'website',
  },
};

export default function SecurityPage() {
  return (
    <LegalPage
      eyebrow="Trust & Safety"
      title="Security at DiemDesk"
      intro="We built DiemDesk around a single idea: your files are yours. Most tools run entirely inside your browser, so your documents never reach our servers in the first place. Here is exactly how everything works — in plain language."
      updated="June 2026"
    >
      {/* Motto / promise */}
      <Callout tone="success" icon={<ShieldCheck className="size-5" />} title="Our promise">
        <p>
          <strong>Your files never leave your device unless you choose — and even then, only you hold the key.</strong>{' '}
          We design every feature so that we see as little of your data as technically possible. The best way to keep
          something private is to never receive it.
        </p>
      </Callout>

      <Section id="tools" title="How our tools work">
        <p>
          Tools like Merge, Split, Compress, Convert and QR generation run <strong>100% inside your browser</strong>,
          using your own device&rsquo;s processing power. When you drop a file in, it is opened locally — it is{' '}
          <strong>never uploaded</strong> to us. When the tool finishes, the result downloads straight back to you.
        </p>
        <Callout tone="success" icon={<CloudOff className="size-5" />} title="Zero uploads for in-browser tools">
          <p>
            There is no copy of your file on our servers — not during processing, not after. Close the tab and there is
            nothing left anywhere but on your own computer. No accounts required, no watermarks, and no daily limits —
            just generous file sizes (competitors cap you at ~15 MB or a couple of tasks a day).
          </p>
        </Callout>
      </Section>

      <Section id="where-data-goes" title="Where your data goes">
        <p>
          Different tools handle your files differently — and we&rsquo;re upfront about every one. Here is exactly where your
          data goes, by tool type:
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border">
          {[
            { color: '#16a34a', label: 'In-browser tools', desc: 'Merge, split, compress, rotate, convert, add/delete pages, page numbers, QR codes, passwords and more — processed 100% in your browser, never leaving your device.' },
            { color: '#7c3aed', label: 'AI — Chat, Summarize, Translate', desc: 'Sent to our AI provider for that one request only — not stored, and never used to train models.' },
            { color: '#d97706', label: 'Office conversions & OCR', desc: 'Processed on our servers, then deleted right after — never kept.' },
            { color: '#2563eb', label: 'File Vault', desc: 'End-to-end encrypted on your device before upload — only you can read it.' },
          ].map((r) => (
            <div key={r.label} className="flex flex-col gap-1.5 border-b p-4 last:border-b-0 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex shrink-0 items-center gap-2.5 sm:w-56">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                <span className="font-semibold text-foreground">{r.label}</span>
              </div>
              <span className="text-sm leading-relaxed text-muted-foreground">{r.desc}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="technology" title="The technology we use">
        <ul className="space-y-3">
          <li className="flex gap-3"><Lock className="mt-0.5 size-5 shrink-0 text-emerald-600" /><span><strong className="text-foreground">In-browser processing.</strong> File operations run on your device using modern web technology (WebAssembly and the browser&rsquo;s native APIs) — the same engine that powers the page you&rsquo;re reading.</span></li>
          <li className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" /><span><strong className="text-foreground">AES-256 encryption.</strong> The File Vault uses AES-256-GCM — the same encryption standard trusted by banks and governments — applied <em>on your device</em>, in your browser, via the standard Web Crypto API.</span></li>
          <li className="flex gap-3"><KeyRound className="mt-0.5 size-5 shrink-0 text-emerald-600" /><span><strong className="text-foreground">Strong key derivation.</strong> Your vault key is derived from your passphrase using Argon2, a modern, deliberately slow function that makes guessing attacks impractical.</span></li>
          <li className="flex gap-3"><Server className="mt-0.5 size-5 shrink-0 text-emerald-600" /><span><strong className="text-foreground">Encrypted connections.</strong> All traffic to DiemDesk is protected with TLS (HTTPS), and our servers are hardened and kept up to date.</span></li>
        </ul>
      </Section>

      <Section id="performance" title="Built to run light on your device">
        <p>
          Because your files are processed on your device — never uploaded — the work runs on your own
          CPU and memory. We engineered everything to keep that light:
        </p>
        <ul className="space-y-3">
          <li className="flex gap-3"><Zap className="mt-0.5 size-5 shrink-0 text-emerald-600" /><span><strong className="text-foreground">Handled in chunks.</strong> Files are processed in small pieces, and memory is released as soon as each part is done — nothing piles up.</span></li>
          <li className="flex gap-3"><FileCheck2 className="mt-0.5 size-5 shrink-0 text-emerald-600" /><span><strong className="text-foreground">Fast and responsive.</strong> The heavy lifting runs on WebAssembly, and the app pauses between steps so your browser stays smooth while it works.</span></li>
          <li className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" /><span><strong className="text-foreground">Sensible limits.</strong> Caps on file size and rendering quality stop any single job from running away with your device&rsquo;s resources.</span></li>
        </ul>
        <Callout tone="default" icon={<AlertTriangle className="size-5" />} title="One thing about large files">
          <p>
            Big files use more of your own device&rsquo;s power — that&rsquo;s the price of keeping them
            off our servers and fully private. For everyday documents, you won&rsquo;t notice a thing.
          </p>
        </Callout>
      </Section>

      <Section id="offline" title="Working offline">
        <p>
          <strong className="text-foreground">Not yet — and we&rsquo;d rather say so than fudge it.</strong> Your files are
          processed on your device, and that part is true today; you can watch it in your browser&rsquo;s network tab. But
          the app itself is still loaded from the web each time you open it, so if you&rsquo;re offline you get a blank page.
        </p>
        <Callout tone="default" icon={<Zap className="size-5" />} title="Why it isn&rsquo;t on right now">
          <p>
            We shipped an offline cache in July 2026 and pulled it a few days later: it was serving some people an
            outdated copy of the site. We&rsquo;d rather ship nothing than ship something stale. It&rsquo;s being rebuilt
            properly, and this page will change the day it lands.
          </p>
          <p className="!mt-3">
            When it does return, it will be per-tool and per-browser: once you&rsquo;ve actually <em>used</em> a tool online,
            your browser keeps the pieces that tool needed, and it can run without a connection after that. A tool
            you&rsquo;ve never opened won&rsquo;t work offline, because its files were never fetched.
          </p>
        </Callout>
        <p className="text-sm text-muted-foreground">
          Worth knowing either way: Office conversions, OCR, PDF/A, Link in bio, the AI tools (Summarize, Chat with your
          PDF, Translate) and File Vault sync run on our servers and will always need a connection. Every tool in the
          catalog is labelled.
        </p>
      </Section>

      <Section id="ai" title="How we handle AI features">
        <p>
          AI tools — <strong>Summarize</strong>, <strong>Chat with your PDF</strong>, and <strong>Translate</strong> —
          do need to read the text of your document to work, so they can&rsquo;t run fully offline. Here is exactly what
          happens, and what doesn&rsquo;t:
        </p>
        <ol className="space-y-4">
          <FlowStep n={1} title="You choose to use AI">AI never runs automatically. It only happens when you click Summarize, ask a question, or request a translation.</FlowStep>
          <FlowStep n={2} title="Your document&rsquo;s text is sent for that one request">The relevant text is sent over an encrypted connection to our AI provider, processed in real time, and the answer is returned to you.</FlowStep>
          <FlowStep n={3} title="It is not stored or used to train models">We do not keep a copy of your document to power AI, and your content is not used to train AI models.</FlowStep>
        </ol>
        <Callout tone="default" icon={<Sparkles className="size-5" />} title="Where AI is different">
          <p>
            Unlike our in-browser tools, AI features <strong>do</strong> transmit your text for the moment it takes to
            answer — that&rsquo;s simply how AI works. The difference with DiemDesk is that it&rsquo;s always{' '}
            <strong>your choice</strong>, it&rsquo;s used <strong>only for your request</strong>, and it&rsquo;s{' '}
            <strong>never retained or sold</strong>.
          </p>
        </Callout>
      </Section>

      <Section id="file-vault" title="File Vault — end-to-end encrypted storage">
        <p>
          Most of DiemDesk never stores your files. The <strong>File Vault</strong> is the one exception — and it&rsquo;s
          built so that <strong>even we can never read what&rsquo;s inside it</strong>. This is called{' '}
          <em>zero-knowledge</em> (or end-to-end) encryption, the same approach used by privacy-first services like Proton
          Drive and Tresorit.
        </p>
        <ol className="space-y-4">
          <FlowStep n={1} title="Encrypted on your device, before upload">When you save a file to your Vault, your browser scrambles it with AES-256 <em>first</em>. What gets uploaded is unreadable gibberish.</FlowStep>
          <FlowStep n={2} title="We store only the gibberish">Our servers hold the encrypted version. We have no way to unscramble it — even if we were asked to, or our servers were breached, there is nothing readable to hand over.</FlowStep>
          <FlowStep n={3} title="Only you can unlock it">When you open your Vault on any device, your browser rebuilds your key from your passphrase and decrypts your files locally. The key never reaches us.</FlowStep>
        </ol>

        <Callout tone="success" icon={<FileCheck2 className="size-5" />} title="What this means for you">
          <ul className="ml-4 list-disc space-y-1">
            <li>We <strong>cannot</strong> read, scan, or share your vaulted files — it&rsquo;s technically impossible for us.</li>
            <li>A data breach of our servers would expose <strong>only encrypted gibberish</strong>, useless without your key.</li>
            <li>Your <strong>vault passphrase is separate from your login password</strong>. Logging in proves who you are; your vault passphrase unlocks your files and is <strong>never sent to us</strong>.</li>
            <li>One passphrase unlocks your whole vault — you don&rsquo;t need a separate password per file.</li>
          </ul>
        </Callout>
      </Section>

      <Section id="passphrase" title="Important: if you lose your passphrase, your files cannot be recovered">
        <Callout tone="danger" icon={<AlertTriangle className="size-5" />} title="Please read this carefully">
          <p>
            Because your File Vault is encrypted so that <strong>only you</strong> can open it, we never receive or store
            your vault passphrase. That is what makes it truly private — but it also means:
          </p>
          <p className="font-semibold text-foreground">
            If you forget your vault passphrase, we cannot reset it, and your vaulted files cannot be recovered by anyone —
            including us. They are permanently lost.
          </p>
          <p>
            This works just like a cryptocurrency wallet or a true zero-knowledge service: total privacy means
            total responsibility for your passphrase.
          </p>
        </Callout>
        <Callout tone="warning" icon={<KeyRound className="size-5" />} title="Your safety net: the recovery key">
          <p>
            When you first set up your Vault, we give you a one-time <strong>recovery key</strong> — a long code you should
            save somewhere safe (a password manager, or printed and stored offline). If you ever forget your passphrase,
            the recovery key is the <strong>only</strong> way back into your Vault. Keep it safe and never share it.
          </p>
        </Callout>
      </Section>

      <Section id="infrastructure" title="Our infrastructure">
        <p>
          Beyond in-browser privacy, we keep our own systems tight: encrypted connections (TLS) everywhere, hardened and
          regularly patched servers, restricted administrative access, and monitoring for unusual activity. Account
          passwords are stored only as salted hashes — never in plain text.
        </p>
      </Section>

      <Section id="disclosure" title="Found a security issue?">
        <p>
          We welcome responsible disclosure. If you believe you&rsquo;ve found a vulnerability, please email{' '}
          <a href="mailto:security@diemdesk.com" className="font-semibold text-primary hover:underline">security@diemdesk.com</a>{' '}
          with the details. We&rsquo;ll investigate promptly and keep you updated.
        </p>
      </Section>
    </LegalPage>
  );
}
