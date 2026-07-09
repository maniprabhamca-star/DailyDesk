import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { ShareSafeCheckTool } from '@/components/pdf/share-safe-check-tool';

export const metadata: Metadata = {
  title: 'Share-Safe PDF Check - Private PDF Risk Checker | DiemDesk',
  description: 'Check a PDF for hidden metadata, risky visible text, links, and annotations before sharing. Runs privately in your browser.',
  alternates: { canonical: '/share-safe-pdf-check' },
};

const steps = [
  'Drop in the PDF you plan to send.',
  'Review metadata, visible-risk text, links, and annotations.',
  'Jump to the right cleanup tool before you share.',
];

const faqs = [
  { q: 'Does this upload my PDF?', a: 'No. The check runs in your browser, on your device.' },
  { q: 'Is this the same as removing metadata?', a: 'No. Metadata is one risk. This also checks visible/selectable text, links, and annotations.' },
  { q: 'Does it redact the PDF automatically?', a: 'No. It points out likely issues and links you to cleanup tools so you stay in control.' },
];

export default function ShareSafePdfCheckPage() {
  return (
    <PdfToolPage
      title="Share-Safe PDF Check"
      description="A private pre-flight check before sending a PDF. Spot hidden metadata, sensitive text, links, and annotations while the file stays on your device."
      steps={steps}
      faqs={faqs}
    >
      <ShareSafeCheckTool />
    </PdfToolPage>
  );
}
