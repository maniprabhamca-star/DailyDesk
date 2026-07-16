import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { ColorPickerTool } from '@/components/tools/color-picker-tool';

export const metadata: Metadata = {
  title: 'Color Picker — HEX, RGB, HSL, Shades & Contrast | DiemDesk',
  description:
    "Pick any color and get HEX, RGB and HSL with one-click copy — plus shades, tints, an eyedropper and WCAG contrast checks. Free, in your browser.",
  alternates: { canonical: '/color-picker' },
  openGraph: {
    images: ['/og/color-picker.png'],
    title: 'Color Picker — HEX, RGB, HSL, Shades & Contrast | DiemDesk',
    description: 'HEX/RGB/HSL conversion, shades and tints, eyedropper, and WCAG contrast — free in your browser.',
    type: 'website',
  },
};

const steps = [
  'Pick a color with the swatch, type a HEX/RGB value, or grab one off your screen with the eyedropper.',
  'Copy the HEX, RGB, or HSL value with one click.',
  'Explore shades, tints, and the complementary color — and check WCAG contrast for text.',
];

const faqs = [
  { q: 'What formats do I get?', a: 'HEX (#7c3aed), RGB (rgb(124, 58, 237)), and HSL (hsl(263, 83%, 58%)) — each with a one-click copy button, plus the complementary color.' },
  { q: 'How does the eyedropper work?', a: 'In browsers that support the EyeDropper API (Chrome and Edge), one click lets you pick any color from anything visible on your screen — even outside the browser window. Elsewhere, the swatch picker and text input work everywhere.' },
  { q: 'What are shades and tints?', a: 'Shades mix your color toward black, tints toward white — five of each, clickable to keep exploring. Handy for building hover states and backgrounds around a brand color.' },
  { q: 'What do the AA and AAA badges mean?', a: 'They’re WCAG accessibility contrast grades for using your color as text on white or black: 4.5:1 passes AA for normal text, 7:1 passes the stricter AAA, and 3:1 is enough only for large headlines.' },
  { q: 'Is anything sent to a server?', a: 'No — the picker, conversions, and contrast math all run in your browser.' },
];

export default function ColorPickerPage() {
  return (
    <PdfToolPage
      title="Color picker"
      description="Pick a color, copy it as HEX, RGB, or HSL, explore shades and tints, and check WCAG contrast — with a screen eyedropper in supported browsers. Free, in your browser."
      steps={steps}
      faqs={faqs}
    >
      <ColorPickerTool />
    </PdfToolPage>
  );
}
