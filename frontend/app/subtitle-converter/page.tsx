import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { SubtitleTool } from '@/components/tools/subtitle-tool';

export const metadata: Metadata = {
  title: 'SRT to VTT — Subtitle Converter in Your Browser | DiemDesk',
  description: 'Convert subtitles between SRT and VTT, or pull out a clean transcript. Shift the timing too. On your device, nothing uploaded. Free.',
  alternates: { canonical: '/subtitle-converter' },
  // Gated (coming_soon): keep a thin "coming soon" page out of the index. Remove
  // this line the day the tool un-gates — everything else is already in place.
  robots: { index: false, follow: true },
  openGraph: {
    images: ['/og.png'],
    title: 'Subtitle converter — private, in your browser',
    description: 'SRT ↔ VTT ↔ transcript, with timing shift — converted on your device, nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop an .srt or .vtt file, or paste the cues straight in. The format is detected for you.',
  'Pick what you want out: the other subtitle format, or a clean transcript with the timings stripped.',
  'Nudge the timing if the subtitles run ahead of the audio, then copy or download. Free, no signup.',
];

const faqs = [
  { q: 'Why won’t my renamed .srt work as a .vtt?', a: 'Because it isn’t one. WebVTT needs a WEBVTT line at the top and full stops in the timestamps; SRT wants a numbered cue and commas. Renaming the file changes neither, so the player silently shows nothing. This rewrites the file properly rather than swapping the extension.' },
  { q: 'Can I fix subtitles that are out of sync?', a: 'Yes — put the offset in the timing box. Positive numbers move every cue later, negative moves them earlier, and cues can’t go before zero. It handles the common case where a rip starts a couple of seconds off.' },
  { q: 'What is the transcript option?', a: 'The words on their own: timings, cue numbers and styling tags removed, with consecutive cues joined into sentences and paragraphs. It’s what you want for pasting into notes, feeding to an AI, or reading a talk you couldn’t attend.' },
  { q: 'Are styling and positioning kept?', a: 'Cue text comes through as-is, including italics. WebVTT positioning and styling blocks are dropped — they have no equivalent in SRT, and carrying them into a transcript would just be noise.' },
  { q: 'Is my file uploaded?', a: 'No. A subtitle file is the entire script of whatever it belongs to — often something unreleased. It’s parsed and rewritten in this browser tab, and nothing is sent anywhere.' },
  { q: 'Is it free?', a: 'Yes, unlimited and no signup. It runs on your machine, so it costs us nothing to offer.' },
];

export default function SubtitleConverterPage() {
  return (
    <PdfToolPage
      title="Subtitle converter"
      description="Convert subtitles between SRT and VTT, or strip them down to a clean transcript — with a timing shift for files that run out of sync. It runs in your browser, so nothing is uploaded."
      steps={steps}
      faqs={faqs}
    >
      <SubtitleTool />
    </PdfToolPage>
  );
}
