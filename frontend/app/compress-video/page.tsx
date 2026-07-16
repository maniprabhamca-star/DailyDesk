import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { CompressVideoTool } from '@/components/tools/compress-video-tool';

export const metadata: Metadata = {
  title: 'Compress Video — Shrink MP4 Free, In Your Browser | DiemDesk',
  description:
    "Compress a video free on your device — nothing uploaded. Pick MP4 or WebM, choose quality and resolution, and get a much smaller file in seconds.",
  alternates: { canonical: '/compress-video' },
  openGraph: {
    images: ['/og/compress-video.png'],
    title: 'Compress Video — Shrink MP4 Free, In Your Browser | DiemDesk',
    description: 'Make videos smaller privately in your browser — MP4 or WebM, your choice of quality. Nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop in a video — it plays here so you can check it first.',
  'Choose MP4 (plays everywhere) or WebM (smallest), plus quality and resolution.',
  'Compress — done on your device and saved straight to your downloads.',
];

const faqs = [
  { q: 'Is my video uploaded?', a: 'No. The compression happens entirely on your device using your browser’s own video encoder — other tools upload your file to a server; here it never leaves your computer, no matter how big it is.' },
  { q: 'Should I pick MP4 or WebM?', a: 'MP4 (H.264) plays literally everywhere — phones, TVs, editors, social uploads — so it’s the safe default. WebM (VP9/AV1) squeezes roughly 30% smaller at the same quality and plays in any modern browser and most players; pick it when the smallest possible file matters more than universal compatibility.' },
  { q: 'How much smaller will it get?', a: 'It depends on the source. Videos straight from phones and cameras are usually recorded at high bitrates, so “Balanced” often shrinks them a lot with no visible loss. Already-compressed downloads have less room. The result screen shows the exact before → after and percentage saved.' },
  { q: 'Why does it take about as long as the video?', a: 'To stay private and on-device, we re-encode the video as it plays through once, so processing time is roughly the clip’s length. It’s the honest trade for never uploading your file. A quick way to speed things up and shrink more is to drop the resolution.' },
  { q: 'Does it keep the sound?', a: 'This first version re-encodes the video track for maximum shrink; audio handling depends on your browser. If keeping the original audio is essential, test a short clip first — and tell us, since audio passthrough is on our list.' },
  { q: 'Can it beat the big online compressors?', a: 'On raw ratio, tuned server-side tools can still edge ahead — but they upload your video. Our win is privacy (nothing leaves your device), no server size limits, it’s free, and we use modern codecs (VP9/AV1) that compress far better than the H.264 most tools output.' },
  { q: 'Is there a file size limit?', a: 'No server limit — nothing is uploaded. But compressing runs in your browser’s memory, and video is heavy (frames decode to raw pixels), so very large or long videos can be slow or run out of memory. Short-to-medium clips and a lower resolution work best; huge multi-gigabyte files are the one job genuinely better suited to a desktop or a server.' },
];

export default function CompressVideoPage() {
  return (
    <PdfToolPage
      title="Compress Video"
      description="Make a video smaller right in your browser — choose MP4 or WebM, quality and resolution. Compressed on your device, so it’s never uploaded. Free."
      steps={steps}
      faqs={faqs}
    >
      <CompressVideoTool />
    </PdfToolPage>
  );
}
