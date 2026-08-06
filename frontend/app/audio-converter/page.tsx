import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { AudioTool } from '@/components/tools/audio-tool';

export const metadata: Metadata = {
  title: 'Audio Converter — M4A, AAC, OGG, FLAC to MP3 | DiemDesk',
  description: 'Convert audio to MP3 or WAV in your browser — M4A, AAC, OGG, FLAC, WAV and more. Nothing uploaded. Free, no signup.',
  alternates: { canonical: '/audio-converter' },
  openGraph: {
    images: ['/og.png'],
    title: 'Audio converter — private, in your browser',
    description: 'M4A, AAC, OGG, FLAC → MP3 or WAV, converted on your device — nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop an audio file — M4A, AAC, OGG, Opus, FLAC, WAV, or a video you want the sound from.',
  'Choose MP3 (with a quality) or WAV, switch to mono for speech, and trim if you only need part of it.',
  'Convert, and the file downloads. It all happens in your browser — nothing is uploaded.',
];

const faqs = [
  { q: 'Which formats can it read?', a: 'Anything your browser can play, which covers M4A, AAC, MP3, OGG, Opus, FLAC, WAV, WebM and the audio inside MP4 or MOV video. If a file uses a codec the browser can’t decode directly, we play it through once and capture the sound instead, so you still get a result.' },
  { q: 'Why only MP3 and WAV out?', a: 'They’re the two that open everywhere — MP3 for sending and playing, WAV for editing. Adding M4A and Opus output means bundling more encoders, so they’re a later addition rather than something half-done now.' },
  { q: 'Does converting lose quality?', a: 'Going to WAV doesn’t — it’s uncompressed. Going to MP3 does, because MP3 is lossy, and re-encoding an already-lossy file (an M4A, say) loses a little more. At 192 kbps or above most people can’t hear it. If the source is FLAC or WAV and you want to keep every bit, convert to WAV.' },
  { q: 'Is my file uploaded?', a: 'No. Decoding and encoding both happen in this browser tab, so the audio never leaves your device. Most online converters upload to a server and keep the file for hours; there is nothing to keep here.' },
  { q: 'Does it keep the original sample rate?', a: 'Not exactly. Decoding goes through your browser’s audio engine, which resamples everything to whatever your device runs at — usually 48 kHz. So a 44.1 kHz source comes out at 48 kHz. It’s inaudible, but if you need the original rate preserved bit-for-bit, use a desktop editor.' },
  { q: 'How long can a file be?', a: 'Up to about 90 minutes. The whole thing is held in memory as raw audio while it converts, so longer than that risks running the tab out of room. Trim long recordings into sections.' },
  { q: 'Is it free?', a: 'Yes — unlimited, no signup, no watermark. It runs on your computer, so it costs us nothing to offer.' },
];

export default function AudioConverterPage() {
  return (
    <PdfToolPage
      title="Audio converter"
      description="Convert M4A, AAC, OGG, FLAC and more to MP3 or WAV — with optional trimming. It runs in your browser, so your audio is never uploaded."
      steps={steps}
      faqs={faqs}
    >
      <AudioTool mode="convert" />
    </PdfToolPage>
  );
}
