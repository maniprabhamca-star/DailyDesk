import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PasswordTool } from '@/components/tools/password-tool';

export const metadata: Metadata = {
  title: "Strong Password Generator & Passphrase Maker | DiemDesk",
  description:
    "Generate strong random passwords or memorable passphrases free, with a strength meter and time-to-crack estimate. On-device — nothing is sent or stored.",
  alternates: { canonical: '/password-generator' },
  openGraph: {
    images: ['/og/password-generator.png'],
    title: 'Strong Password Generator — Free, No Signup | DiemDesk',
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
    q: 'Does DiemDesk see or store my passwords?',
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
  {
    q: 'What is a passphrase, and when should I use one?',
    a: 'A passphrase strings random words together (correct-horse-battery style). Each word adds about 13 bits of strength, and 5+ words rivals a long random password — while being far easier to remember and type. Ideal for master passwords and anything you type by hand.',
  },
  {
    q: 'Where do the passphrase words come from?',
    a: 'The EFF Large Wordlist — 7,776 carefully chosen, easy-to-type words published by the Electronic Frontier Foundation (CC-BY 3.0), the same list used by leading password managers. It ships inside the app, so words are picked on your device.',
  },
  {
    q: 'How is the time-to-crack estimated?',
    a: 'From the entropy bits, assuming a fast offline attack at 10 billion guesses per second — a deliberately pessimistic scenario. Real website logins are rate-limited and millions of times slower, so the shown time is a conservative lower bound.',
  },
];

export default function PasswordGeneratorPage() {
  return (
    <PdfToolPage
      title="Password generator"
      description="Strong random passwords and easy-to-remember passphrases, with a live strength meter and time-to-crack estimate — created with your device’s secure random generator. Nothing is ever sent or stored."
      steps={steps}
      faqs={faqs}
    >
      <PasswordTool />
    </PdfToolPage>
  );
}
