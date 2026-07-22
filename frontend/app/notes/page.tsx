import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { NotesTool } from '@/components/tools/notes-tool';

export const metadata: Metadata = {
  title: 'Smart Notes — Quick Notes, Synced | DiemDesk',
  description: 'Fast, clean notes that sync to your account across every device. Search, tag, and pick up where you left off. Free, no ads.',
  alternates: { canonical: '/notes' },
  openGraph: { images: ['/og.png'], title: 'Smart Notes — synced across your devices', description: 'Quick, searchable notes synced to your DiemDesk account. Free, no ads.', type: 'website' },
};

const steps = [
  'Sign in — your notes sync to your account, so they’re on your laptop and your phone.',
  'Tap + to write. Title, text and tags save automatically as you type.',
  'Search across everything, tag to organize, and open any note to keep writing.',
];

const faqs = [
  { q: 'Where are my notes stored?', a: 'They sync to your DiemDesk account so they’re available on every device you sign in on. They’re saved on our server (not encrypted end-to-end) — for files that even we can’t read, use the File Vault instead.' },
  { q: 'Is it free?', a: 'Yes. Free accounts keep up to 10 notes; Pro removes the cap for unlimited notes. No ads either way.' },
  { q: 'Do notes save automatically?', a: 'Yes — the title, text and tags save a moment after you stop typing. You’ll see a “Saved” indicator.' },
  { q: 'Can I search and organize?', a: 'Search runs across titles, text and tags instantly. Add tags to any note to group related ones.' },
];

export default function NotesPage() {
  return (
    <PdfToolPage
      title="Smart Notes"
      description="Fast, clean notes that follow you across devices — synced to your account, searchable, and saved as you type. Free, no ads."
      steps={steps}
      faqs={faqs}
      wide
    >
      <NotesTool />
    </PdfToolPage>
  );
}
