import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PdfToAudioTool } from '@/components/tools/pdf-to-audio-tool';

export const metadata: Metadata = {
  title: 'PDF to Audio — Read PDFs Aloud Free | DiemDesk',
  description: 'Listen to any PDF read aloud — pick a voice, set the pace, follow the highlighted text. Runs in your browser with your device’s own voice; nothing uploaded.',
  alternates: { canonical: '/pdf-to-audio' },
  openGraph: {
    images: ['/og.png'],
    title: 'PDF to Audio — read aloud, privately',
    description: 'Have any PDF read aloud in your browser — pick a voice and pace, follow along. Nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop a PDF — its text is read on your device, never uploaded.',
  'Pick a voice and set the speed and pitch — then press Play and follow the highlighted sentence.',
  'Tap any sentence to jump there. It’s all in your browser, free, and works offline once the page has loaded.',
];

const faqs = [
  { q: 'How does read-aloud work without uploading my file?', a: 'Two on-device steps: your browser reads the PDF’s text locally (the same engine our other tools use), then your device’s own built-in speech voices read it out. Nothing is sent to a server — you can confirm it in your browser’s Network tab.' },
  { q: 'Which voices can I use?', a: 'Whatever voices your device and browser provide — these vary by operating system and language. You can switch voice, speed and pitch at any time, and the change takes effect from the next sentence.' },
  { q: 'Can I download an MP3?', a: 'Not in this free version — it plays the audio live in your browser rather than producing a file, because the browser’s speech engine doesn’t hand back a recordable stream. A downloadable MP3 (using higher-quality neural voices) is planned as a Pro feature.' },
  { q: 'Does it work on scanned PDFs?', a: 'A scanned PDF is an image with no selectable text, so there’s nothing to read. Run it through our OCR tool first to add a text layer, then come back.' },
  { q: 'Is it free?', a: 'Yes — it runs entirely on your device, so it costs us nothing and stays free and unlimited, no signup.' },
];

export default function PdfToAudioPage() {
  return (
    <PdfToolPage
      title="PDF to Audio"
      description="Have any PDF read aloud — pick a voice, set the pace, and follow the highlighted text as it reads. It runs entirely in your browser using your device’s own voice, so your file is never uploaded."
      steps={steps}
      faqs={faqs}
    >
      <PdfToAudioTool />
    </PdfToolPage>
  );
}
