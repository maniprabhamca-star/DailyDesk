import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { VideoToGifTool } from '@/components/tools/video-to-gif-tool';

export const metadata: Metadata = {
  title: "Video to GIF — Convert MP4 to GIF, Free | DiemDesk",
  description:
    "Turn a video into an animated GIF free, on your device — nothing uploaded. Trim, set the frame rate and size, loop it. Works with MP4, WebM and MOV.",
  alternates: { canonical: '/video-to-gif' },
  openGraph: {
    images: ['/og.png'],
    title: 'Video to GIF — Convert MP4 to GIF Free, In Your Browser | DiemDesk',
    description: 'Make an animated GIF from any video, privately in your browser. Trim, set fps and size, loop — nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop in a video — it plays right here so you can pick the moment.',
  'Trim to the clip you want, then choose frame rate, width and looping.',
  'Make the GIF — built on your device and saved straight to your downloads.',
];

const faqs = [
  { q: 'Is my video uploaded anywhere?', a: 'No. Your browser decodes the video and builds the GIF entirely on your device — other converters upload your file to their servers; here it never leaves your computer.' },
  { q: 'What video formats work?', a: 'Whatever your browser can play — in practice MP4 (H.264), WebM and most MOV files, which covers nearly everything from phones and screen recorders. If a rare format won’t open, convert it first or try another browser.' },
  { q: 'How do I keep the GIF small?', a: 'GIF size grows fast with length, frame rate and dimensions. A short clip (2–5 seconds) at 10–12 fps and 320–480px wide usually looks great and stays small. The tool shows the frame count live so you can gauge it.' },
  { q: 'Why is there a frame limit?', a: 'GIF is an old format that balloons with too many frames — a long clip at high fps can be tens of megabytes and freeze any browser. We cap the frames and nudge you toward a shorter clip or lower fps so the result stays usable.' },
  { q: 'Can I make it loop, or play once?', a: 'Both. “Loop forever” is on by default (the classic GIF behaviour); turn it off and the animation plays a single time and stops on the last frame.' },
  { q: 'Does the GIF have sound?', a: 'No — the GIF format has no audio at all. If you need sound, keep it as a video. GIFs are silent by design, which is exactly why they autoplay everywhere.' },
  { q: 'Is there a file size limit?', a: 'No server limit — the video never leaves your device. Because only the trimmed clip is sampled (not the whole file), even large source videos work fine; a very long clip at a high frame rate is what to avoid, not a big file.' },
];

export default function VideoToGifPage() {
  return (
    <PdfToolPage
      title="Video to GIF"
      description="Turn any video into an animated GIF — trimmed, resized and looping — built entirely on your device, so the video is never uploaded. Free and instant."
      steps={steps}
      faqs={faqs}
    >
      <VideoToGifTool />
    </PdfToolPage>
  );
}
