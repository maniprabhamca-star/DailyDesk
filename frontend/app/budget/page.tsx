import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { BudgetTool } from '@/components/tools/budget-tool';

export const metadata: Metadata = {
  title: 'Budget Tracker — Log Expenses, See Totals | DiemDesk',
  description: 'Log expenses in seconds and see your monthly total by category — synced to your account across devices. Simple, clean, free.',
  alternates: { canonical: '/budget' },
  openGraph: { images: ['/og.png'], title: 'Budget Tracker — see where your money goes', description: 'Quick expense logging with a monthly total and category breakdown, synced to your account. Free.', type: 'website' },
};

const steps = [
  'Sign in, pick your currency, and log an expense — amount, category, and an optional note.',
  'Watch your monthly total and the category breakdown update instantly.',
  'Step between months to review, on any device you sign in on.',
];

const faqs = [
  { q: 'Does it convert currencies?', a: 'No — you pick a display symbol and every amount is stored exactly as you enter it. It’s a simple tracker, not a multi-currency accounting tool, so nothing is silently converted.' },
  { q: 'Where is my data?', a: 'Synced to your DiemDesk account so it’s on every device you sign in on. Saved on our server (not encrypted end-to-end).' },
  { q: 'Is it free?', a: 'Yes. Free accounts log up to 50 expenses a month; Pro removes the cap. No ads.' },
  { q: 'Can I review past months?', a: 'Yes — use the arrows to step back through previous months and see each one’s total and breakdown.' },
];

export default function BudgetPage() {
  return (
    <PdfToolPage
      title="Budget Tracker"
      description="See where your money goes. Log expenses in seconds, watch your monthly total by category, and review any month — synced to your account, free and ad-free."
      steps={steps}
      faqs={faqs}
      wide
    >
      <BudgetTool />
    </PdfToolPage>
  );
}
