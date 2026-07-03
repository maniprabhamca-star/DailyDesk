import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { RemoveBackgroundTool } from '@/components/tools/remove-background-tool';

export const metadata: Metadata = {
  title: 'Remove Background from Image — Free, On Your Device | DiemDesk',
  description:
    'Remove image backgrounds with AI that runs on your device — your photo is never uploaded. Free, full resolution, transparent PNG, no signup, no watermark.',
  alternates: { canonical: '/remove-background' },
  openGraph: {
    images: ['/og.png'],
    title: 'Remove Background from Image — Free, On Your Device | DiemDesk',
    description: 'AI background removal that never uploads your photo. Free, full resolution, transparent PNG.',
    type: 'website',
  },
};

const steps = [
  'Drop in a photo — JPG, PNG, or WebP.',
  'The AI model runs on your own device to find the subject (a one-time ~44 MB download, cached for next time).',
  'Compare, then download a full-resolution transparent PNG.',
];

const faqs = [
  {
    q: 'Is my photo uploaded to a server?',
    a: 'No — and for background removal that is rare. Almost every competitor uploads your photo to their servers; here the AI model itself is downloaded to your browser (once, ~44 MB) and every pixel is processed on your own device. You can verify in the Network tab: the only download is the model, and nothing is uploaded.',
  },
  {
    q: 'What AI does it use?',
    a: 'IS-Net, a highly regarded open segmentation model (Apache 2.0 licensed, from the DIS research project) — the same model family many background-removal services run on their servers. We ship it quantized so the one-time download stays small, with no measurable quality loss.',
  },
  {
    q: 'Is the result full resolution?',
    a: 'Yes. The AI computes the cutout mask, and the mask is applied to your original pixels — a 12-megapixel photo stays 12 megapixels. Many free tools return a downscaled preview and charge for full resolution; ours is full resolution, free.',
  },
  {
    q: 'How good is it with hair and fine edges?',
    a: 'Very good for people, products, animals, and objects. The very hardest cases — wispy hair against a busy background — are where paid services with proprietary models still hold a small edge. For typical product shots, portraits, and listings you will not see a difference.',
  },
  {
    q: 'Why is there a one-time model download?',
    a: 'That download IS the privacy feature: instead of sending your photo to our server, we send the AI to your browser. It is cached after the first run, so later removals start immediately.',
  },
  {
    q: 'What formats work, and what do I get back?',
    a: 'JPG, PNG, WebP, GIF, and BMP in — a transparent PNG out, ready for slides, stores, and design tools. iPhone HEIC photos: run them through our HEIC to JPG tool first, then remove the background.',
  },
  {
    q: 'Is it really free? Any watermark or limits?',
    a: 'Free, no watermark, no signup, and no daily limit. Because the work happens on your device, it costs us nothing to let you remove as many backgrounds as you like.',
  },
];

export default function RemoveBackgroundPage() {
  return (
    <PdfToolPage
      title="Remove background from image"
      description="AI background removal that runs entirely on your device — your photo is never uploaded. Full-resolution transparent PNG, free, no watermark, no signup."
      steps={steps}
      faqs={faqs}
    >
      <RemoveBackgroundTool />
    </PdfToolPage>
  );
}
