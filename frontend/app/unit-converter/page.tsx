import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { UnitConverterTool } from '@/components/tools/unit-converter-tool';

export const metadata: Metadata = {
  title: 'Unit Converter — Length, Weight, Temperature & More | DailyDesk',
  description:
    'Convert length, weight, temperature, area, volume, speed, time, and data sizes instantly — precise factors, both directions, free and offline-friendly in your browser.',
  alternates: { canonical: '/unit-converter' },
  openGraph: {
    images: ['/og.png'],
    title: 'Unit Converter — Length, Weight, Temperature & More | DailyDesk',
    description: 'Instant, precise unit conversion across 8 categories — right in your browser.',
    type: 'website',
  },
};

const steps = [
  'Pick a category — length, weight, temperature, area, volume, speed, time, or data.',
  'Type a value and choose the units on each side.',
  'Read the result instantly — or hit swap to convert the other way.',
];

const faqs = [
  { q: 'Which units are supported?', a: 'Eight categories: length (mm to miles), weight (mg to stone), temperature (°C, °F, K), area (cm² to acres and hectares), volume (mL to US gallons), speed (m/s to knots), time (milliseconds to years), and data size (bytes to terabytes, including KiB/MiB/GiB).' },
  { q: 'How precise are the conversions?', a: 'Factors use the exact international definitions (for example 1 inch = 25.4 mm and 1 pound = 0.45359237 kg), with results shown to 12 significant digits without floating-point noise.' },
  { q: 'What about KB versus KiB?', a: 'Both: KB/MB/GB use the decimal definition (1 KB = 1000 bytes) that drive makers use, and KiB/MiB/GiB use the binary definition (1 KiB = 1024 bytes) that operating systems often report.' },
  { q: 'Does it work offline?', a: 'The math runs entirely in your browser — once the page is open, conversions need no internet at all.' },
];

export default function UnitConverterPage() {
  return (
    <PdfToolPage
      title="Unit converter"
      description="Convert length, weight, temperature, area, volume, speed, time, and data sizes instantly — exact factors, both directions, right in your browser."
      steps={steps}
      faqs={faqs}
    >
      <UnitConverterTool />
    </PdfToolPage>
  );
}
