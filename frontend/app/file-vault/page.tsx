import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { FileVaultTool } from '@/components/tools/file-vault-tool';

export const metadata: Metadata = {
  title: 'File Vault — End-to-End Encrypted Storage | DiemDesk',
  description:
    'Store sensitive documents in a vault encrypted on your device — own passphrase, recovery key, AES-256. We store sealed boxes we cannot open. Ever.',
  alternates: { canonical: '/file-vault' },
  openGraph: { images: ['/og.png'], title: 'File Vault — storage we cannot read', description: 'Encrypted on your device before upload. Even file names are sealed. A vault only you can open.', type: 'website' },
};

const steps = [
  'Create your vault with its own passphrase (separate from your login) and save the one-time recovery key — the only fallback if you forget it.',
  'Add files: each one is sealed on your device with AES-256 before a single byte leaves it. Even the file names are encrypted.',
  'Open your vault from any device: unlock with your passphrase, and files decrypt locally as you download them.',
];

const faqs = [
  { q: 'Can DiemDesk see my vault files?', a: 'No — structurally, not just by policy. Files, file keys and even file names are encrypted on your device before upload; no key material ever exists on our servers. A full copy of our database and disks would yield ciphertext and file sizes, nothing else.' },
  { q: 'What happens if I forget my vault passphrase?', a: 'Your recovery key — the 24-character code shown once at setup — is the only way back in. We cannot reset the passphrase or recover the files, and that is precisely what makes the vault yours alone. Store the recovery key offline.' },
  { q: 'How is this different from Google Drive or Dropbox?', a: 'Mainstream cloud drives encrypt in transit and at rest, but the provider holds the keys — they can read your files, and so can anyone who compels or breaches them. The vault is end-to-end: the key is derived from your passphrase on your device and never leaves it.' },
  { q: 'What encryption does the vault use?', a: 'AES-256-GCM for the files (authenticated, so tampering is detected), with keys derived from your passphrase via Argon2id — a memory-hard function built to resist GPU cracking rigs. Each file has its own random key, wrapped by your master key.' },
  { q: 'Why is the vault a Pro feature?', a: 'Encrypted storage costs real money to keep safe and available — unlike our on-device tools, which stay free. Pro includes 10 GB of vault storage.' },
];

export default function FileVaultPage() {
  return (
    <PdfToolPage
      title="File Vault"
      description="A vault for the documents you'd never email to yourself — encrypted on your device with a passphrase we never see, before a single byte is uploaded. We store sealed boxes we cannot open."
      steps={steps}
      faqs={faqs}
      wide
    >
      <FileVaultTool />
    </PdfToolPage>
  );
}
