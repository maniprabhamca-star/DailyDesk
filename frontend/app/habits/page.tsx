import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { HabitsTool } from '@/components/tools/habits-tool';

export const metadata: Metadata = {
  title: 'Habit Tracker — Build Streaks, Synced | DiemDesk',
  description: 'Track daily habits and build streaks, synced to your account across every device. Simple, clean, free — no ads.',
  alternates: { canonical: '/habits' },
  openGraph: { images: ['/og.png'], title: 'Habit Tracker — build streaks that stick', description: 'Check off daily habits and grow your streaks, synced to your account. Free, no ads.', type: 'website' },
};

const steps = [
  'Sign in and add a habit — give it a name and a color.',
  'Tap to mark it done each day; your streak grows as you keep it up.',
  'See the last few weeks at a glance, on any device you sign in on.',
];

const faqs = [
  { q: 'How does the streak work?', a: 'Your streak counts consecutive days you’ve checked the habit off, up to today (or yesterday if you haven’t marked today yet). Miss a day and it resets — that’s the point.' },
  { q: 'Where is my data?', a: 'Synced to your DiemDesk account, so your habits and history are on every device you sign in on. Saved on our server (not encrypted end-to-end) — it’s habit names and checkmarks, nothing sensitive.' },
  { q: 'Is it free?', a: 'Yes. Free accounts track up to 5 habits; Pro removes the cap. No ads either way.' },
  { q: 'Can I check off past days?', a: 'Yes — tap any square in the grid to mark or unmark that day, so you can fill in one you forgot.' },
];

export default function HabitsPage() {
  return (
    <PdfToolPage
      title="Habit Tracker"
      description="Build streaks that stick. Check off your daily habits, watch the streaks grow, and pick up on any device — synced to your account, free and ad-free."
      steps={steps}
      faqs={faqs}
      wide
    >
      <HabitsTool />
    </PdfToolPage>
  );
}
