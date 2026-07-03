import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PasswordTool } from '@/components/tools/password-tool';

export const metadata: Metadata = {
  title: 'Strong Password Generator — Free, No Signup | DailyDesk',
  description:
    'Generate strong random passwords free, with a live strength meter. Uses your device’s secure random generator — nothing is sent or stored, ever.',
  alternates: { canonical: '/password-generator' },
  openGraph: {
    images: ['/og.png'],
    title: 'Strong Password Generator — Free, No Signup | DailyDesk',
    description: 'Strong random passwords with a strength meter — generated on your device, never sent anywhere.',
    type: 'website',
  },
};

const steps = [
  'Pick a length and the character types you want — a password appears instantly.',
  'Check the live strength meter; regenerate until you like what you see.',
  'Copy it with one click — it was created on your device and is never sent or stored.',
];

const faqs = [
  {
    q: 'Is it safe to generate a password on a website?',
    a: 'Here, yes — the password is created on your own device with the browser’s cryptographically secure random generator (crypto.getRandomValues) and never sent anywhere. You can even switch off Wi-Fi after the page loads and it keeps working, which would be impossible if passwords went to a server.',
  },
  {
    q: 'Does DailyDesk see or store my passwords?',
    a: 'No. Generation, display, and copying all happen locally in your browser. Nothing is transmitted, logged, or stored — check your browser’s Network tab while generating to confirm.',
  },
  {
    q: 'How long should my password be?',
    a: 'Use 16 characters or more for anything that matters — length strengthens a password faster than extra symbols do. 12 is a reasonable minimum; go longer for email, banking, and your password manager’s master password.',
  },
  {
    q: 'What do the “bits” in the strength meter mean?',
    a: 'Bits of entropy — a measure of how many guesses an attacker would need. Each extra bit doubles the guesswork. 60+ bits is good, 80+ is strong, and 128 bits is beyond any realistic cracking attempt.',
  },
  {
    q: 'Why exclude similar characters?',
    a: 'Characters like i, l, 1, O, and 0 are easy to confuse when a password is read, printed, or typed by hand. Excluding them costs a little entropy but avoids lockouts from misread characters.',
  },
  {
    q: 'Should I reuse a generated password on multiple sites?',
    a: 'No — use a unique password for every account, so one leaked site can’t unlock the others. A password manager makes that effortless: generate here, store it there.',
  },
];

export default function PasswordGeneratorPage() {
  return (
    <PdfToolPage
      title="Password generator"
      description="Strong, random passwords with a live strength meter — created with your device’s secure random generator. Nothing is ever sent or stored."
      steps={steps}
      faqs={faqs}
    >
      <PasswordTool />
    </PdfToolPage>
  );
}
