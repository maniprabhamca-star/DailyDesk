import type { Metadata } from 'next';
import Link from 'next/link';
import { FileCheck2, Server, AlertTriangle, ShieldCheck, Users } from 'lucide-react';
import { LegalPage, Section, Callout } from '@/components/legal/legal-page';
import { SUBPROCESSORS } from '@/lib/subprocessors';

export const metadata: Metadata = {
  title: 'Data Processing Agreement (DPA) | DiemDesk',
  description:
    'Our GDPR Article 28 processor terms: what we process, why almost nothing reaches us, our subprocessors, breach notice, and deletion on request.',
  alternates: { canonical: '/dpa' },
  openGraph: {
    images: ['/og.png'],
    title: 'DiemDesk Data Processing Agreement',
    description: 'Article 28 processor terms — and why the list of what we process is unusually short.',
    type: 'website',
  },
};

export default function DpaPage() {
  return (
    <LegalPage
      path="/dpa"
      crumb="DPA"
      eyebrow="Trust & Safety"
      title="Data Processing Agreement"
      intro="If you use DiemDesk at work, your organisation is the controller of any personal data involved and we are a processor. GDPR Article 28 says a controller may not use a processor without a contract on these terms. This page sets ours out in plain language — and explains why the list of things we actually process is much shorter than you are used to reading."
      updated="August 2026"
    >
      <Callout tone="warning" icon={<AlertTriangle className="size-5" />} title="Read this part first">
        <p>
          This page is a plain-English statement of how we operate, published so a reviewer can assess us quickly. It is
          not a signed contract and it has not been through outside counsel. If your organisation needs an executed DPA
          on your own paper, or standard contractual clauses for a transfer, write to{' '}
          <a href="mailto:support@diemdesk.com" className="font-medium text-primary underline underline-offset-2">
            support@diemdesk.com
          </a>{' '}
          and say so — that is a normal request and we would rather sign yours than argue about ours.
        </p>
      </Callout>

      <Section id="scope" title="1. What this covers">
        <p>
          It applies where you use DiemDesk in the course of your work and personal data belonging to other people —
          your clients, your patients, your staff, your candidates — passes through the product. You decide what that
          data is and why it is being handled; that makes you the controller. We act only on your instructions, which
          for a self-serve product means: the tool you chose, doing the job you asked it to do.
        </p>
      </Section>

      <Section id="what-we-process" title="2. What we actually process">
        <p>
          This is the part that differs from most vendors, so it is worth being precise rather than reassuring.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4 text-left font-semibold">Where it runs</th>
                <th className="py-2 pr-4 text-left font-semibold">Does your file reach us?</th>
                <th className="py-2 text-left font-semibold">What we hold</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b">
                <td className="py-2 pr-4 font-medium text-foreground">In-browser tools (most of the catalogue)</td>
                <td className="py-2 pr-4">No. It is opened and rebuilt on your device.</td>
                <td className="py-2">Nothing. There is no upload to retain.</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4 font-medium text-foreground">Office conversions, OCR, webpage capture</td>
                <td className="py-2 pr-4">Yes — they cannot run in a browser.</td>
                <td className="py-2">The file, for as long as the conversion takes, then deleted.</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4 font-medium text-foreground">AI tools</td>
                <td className="py-2 pr-4">The text it needs, not the file.</td>
                <td className="py-2">Nothing after the answer is returned.</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4 font-medium text-foreground">File Vault</td>
                <td className="py-2 pr-4">Yes, but encrypted on your device first.</td>
                <td className="py-2">Ciphertext we cannot read. We do not hold the key.</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-foreground">Account</td>
                <td className="py-2 pr-4">—</td>
                <td className="py-2">Name, email, plan status.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Callout tone="success" icon={<ShieldCheck className="size-5" />} title="Why the first row matters to a reviewer">
          <p>
            Most privacy assurances are <em>retention</em> promises: we received your document and we promise to delete
            it. That is a promise about our conduct. For the in-browser tools there is no transfer to justify, no
            retention period to audit and no copy to breach, because the document never arrived. Your Article 30 record
            has nothing to add for those tools.
          </p>
        </Callout>
      </Section>

      <Section id="instructions" title="3. Our obligations">
        <ul className="mt-2 space-y-2.5 text-sm">
          <li>
            <b className="text-foreground">Only on your instructions.</b> We process personal data to provide the tool
            you used and for nothing else. We do not sell data, we do not build advertising profiles, and we do not
            train models on your documents.
          </li>
          <li>
            <b className="text-foreground">Confidentiality.</b> Anyone with access is bound to keep it confidential.
          </li>
          <li>
            <b className="text-foreground">Security.</b> Encryption in transit throughout; encryption at rest for
            anything stored; end-to-end encryption for File Vault, where the key never leaves your device.
          </li>
          <li>
            <b className="text-foreground">Subprocessors.</b> Named below. We tell you before adding one.
          </li>
          <li>
            <b className="text-foreground">Helping you answer people.</b> If someone asks you for access, correction or
            erasure, we will help you respond within the time you have to respond.
          </li>
          <li>
            <b className="text-foreground">Breach notice.</b> If personal data we hold is breached, we notify you
            without undue delay and in any event within 72 hours of becoming aware, with what we know at the time.
          </li>
          <li>
            <b className="text-foreground">Deletion.</b> On request, or when you close your account, we delete what we
            hold. Server-side conversions are already deleted immediately after the job.
          </li>
          <li>
            <b className="text-foreground">Audit.</b> We will answer a security questionnaire and provide the
            information you reasonably need to satisfy Article 28.
          </li>
        </ul>
      </Section>

      <Section id="subprocessors" title="4. Subprocessors">
        <p>
          Everyone outside DiemDesk who may handle personal data on our behalf. It is a short list, and it is short for
          a structural reason rather than a modest one — most of the product never sends anything anywhere.
        </p>
        <p className="mt-2 text-sm">
          The current list, with what each one is for, is on the{' '}
          <Link href="/subprocessors" className="font-medium text-primary underline underline-offset-2">
            subprocessors page
          </Link>
          . There are {SUBPROCESSORS.length}.
        </p>
      </Section>

      <Section id="transfers" title="5. Where data goes">
        <p>
          DiemDesk is operated from the United States and our servers are in the United States. Where a transfer of
          personal data out of the UK or EEA takes place, it is made on the basis of the appropriate safeguards
          available to us at the time, and we will complete standard contractual clauses on request. Server-side work is
          transient in every case: a conversion runs and the file is deleted.
        </p>
      </Section>

      <Section id="duration" title="6. How long this lasts">
        <p>
          For as long as you use DiemDesk. When you stop, we delete the personal data we hold unless we are required to
          keep something — payment records exist because tax law says they must, and they sit with our payment
          processor rather than with us.
        </p>
      </Section>

      <Callout icon={<Users className="size-5" />} title="Signing something on your paper">
        <p>
          Legal, healthcare, financial and HR teams frequently cannot buy without an executed DPA, and often have their
          own template they would rather use. Send it to{' '}
          <a href="mailto:support@diemdesk.com" className="font-medium text-primary underline underline-offset-2">
            support@diemdesk.com
          </a>
          . Related reading: <Link href="/privacy" className="text-primary underline underline-offset-2">Privacy</Link>,{' '}
          <Link href="/security" className="text-primary underline underline-offset-2">Security</Link>,{' '}
          <Link href="/subprocessors" className="text-primary underline underline-offset-2">Subprocessors</Link>,{' '}
          <Link href="/terms" className="text-primary underline underline-offset-2">Terms</Link>.
        </p>
      </Callout>

      <Callout tone="default" icon={<Server className="size-5" />} title="Check it yourself">
        <p>
          Every claim about the in-browser tools is verifiable in thirty seconds. Open a tool, open your browser&rsquo;s
          Network tab, and process a file. No request carries it. That is the kind of assurance a questionnaire cannot
          give you and a Network tab can.
        </p>
      </Callout>

      <Callout tone="default" icon={<FileCheck2 className="size-5" />} title="Contact">
        <p>
          Data protection enquiries:{' '}
          <a href="mailto:support@diemdesk.com" className="font-medium text-primary underline underline-offset-2">
            support@diemdesk.com
          </a>
        </p>
      </Callout>
    </LegalPage>
  );
}
