import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { AudioTool } from '@/components/tools/audio-tool';

export const metadata: Metadata = {
  title: 'Video to MP3 — Extract Audio in Your Browser | DiemDesk',
  description: 'Pull the audio out of a video and save it as MP3 or WAV. Runs on your device — the video is never uploaded. Free, no signup.',
  alternates: { canonical: '/video-to-mp3' },
  // Gated (coming_soon): keep a thin "coming soon" page out of the index. Remove
  // this line the day the tool un-gates — everything else is already in place.
  robots: { index: false, follow: true },
  openGraph: {
    images: ['/og.png'],
    title: 'Video to MP3 — private, in your browser',
    description: 'Extract the soundtrack from any video as MP3 or WAV, on your device — nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop a video — MP4, MOV, WebM, MKV. It’s decoded in your browser, never uploaded.',
  'Pick MP3 (and a quality) or WAV, mono if it’s speech, and trim to just the part you want.',
  'Extract, and the audio downloads. Free, unlimited, no signup.',
];

const faqs = [
  { q: 'Is my video uploaded?', a: 'No — and that’s the point. Nearly every other “video to MP3” site uploads your file to a server, converts it there and emails you a link. This decodes and re-encodes the audio inside your browser tab, so the video never leaves your device. You can watch the Network tab and see nothing go out.' },
  { q: 'What quality should I pick?', a: '192 kbps is right for almost everything and is the default. Use 320 kbps for music you care about, or 96 kbps with Mono for a lecture or podcast — that makes the file about a fifth of the size and speech still sounds fine. WAV is uncompressed: perfect quality, very large, and the right choice only if you’re editing it afterwards.' },
  { q: 'Which video formats work?', a: 'Anything your browser can play — MP4, MOV, WebM, MKV and M4V in practice. If a file uses an unusual codec the browser can’t decode directly, we fall back to playing it through once and capturing the sound, so it still works; it just takes as long as the video runs.' },
  { q: 'Can I take just one section?', a: 'Yes. Put a start and end time in the Trim boxes — type them as minutes and seconds, like 1:30. Only that stretch is encoded, so it’s quicker as well as smaller.' },
  { q: 'How long a video can it handle?', a: 'Up to about 90 minutes. Decoding holds the whole soundtrack in memory as raw audio, so beyond that a browser tab runs out of room. For a long recording, trim it into parts.' },
  { q: 'Is it really free?', a: 'Yes. It costs us nothing to run — the work happens on your computer, not our servers — so there’s no cap, no watermark and no signup.' },
];

export default function VideoToMp3Page() {
  return (
    <PdfToolPage
      title="Video to MP3"
      description="Pull the soundtrack out of a video and save it as MP3 or WAV. It runs in your browser, so the video is never uploaded — unlike almost every other converter."
      steps={steps}
      faqs={faqs}
    >
      <AudioTool mode="extract" />
    </PdfToolPage>
  );
}
