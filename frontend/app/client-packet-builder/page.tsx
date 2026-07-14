import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { ClientPacketBuilder } from '@/components/workflows/client-packet-builder';

export const metadata: Metadata = {
  title: "Client Packet Builder — Document Workflow | DiemDesk",
  description: 'Build polished client document packets with a guided workflow for merge, cleanup, signing, share-safe checks, and compression.',
  alternates: { canonical: '/client-packet-builder' },
};

const steps = [
  'Follow the packet checklist from files to final delivery.',
  'Use the linked PDF tools at each step.',
  'Mark steps complete so every packet has the same standard.',
];

const faqs = [
  { q: 'Is this the same as Merge PDF?', a: 'No. Merge PDF joins files. Client Packet Builder is a workflow template that tells you what to do before and after merging.' },
  { q: 'Can I use it for proposals and onboarding?', a: 'Yes. It is built for proposals, agreements, invoice packets, onboarding packets, and other client-facing bundles.' },
  { q: 'Does it upload my files?', a: 'No. The linked PDF tools run in your browser when marked as on-device.' },
];

export default function ClientPacketBuilderPage() {
  return (
    <PdfToolPage
      title="Client Packet Builder"
      description="A premium workflow template for sending clean, signed, share-safe PDF packets to clients."
      steps={steps}
      faqs={faqs}
    >
      <ClientPacketBuilder />
    </PdfToolPage>
  );
}
