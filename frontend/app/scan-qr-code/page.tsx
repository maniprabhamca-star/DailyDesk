import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { ScanQrTool } from '@/components/tools/scan-qr-tool';

export const metadata: Metadata = {
  title: "QR Code Scanner — Scan a QR From an Image, Free | DiemDesk",
  description:
    "Scan a QR code from a photo or screenshot right in your browser — nothing uploaded. Reads links, Wi-Fi, contact cards, email and SMS. Free, no app needed.",
  alternates: { canonical: '/scan-qr-code' },
  openGraph: {
    images: ['/og.png'],
    title: 'QR Code Scanner — Scan a QR Code From an Image, Free | DiemDesk',
    description: 'Decode any QR code from a photo or screenshot, privately in your browser. Links, Wi-Fi, contacts, and more.',
    type: 'website',
  },
};

const steps = [
  'Drop in a photo or screenshot with a QR code — or just paste it with Ctrl+V.',
  'The code is decoded on your device and shown as readable fields, not a cryptic string.',
  'Copy what you need, save contacts as a .vcf, or open the link once you’ve checked it.',
];

const faqs = [
  { q: 'How do I scan a QR code that’s already on my phone or computer?', a: 'That’s exactly what this is for. Your camera app can’t scan a code that’s on the same screen — take a screenshot (or save the image) and drop it here, or press Ctrl+V / ⌘+V to paste it straight from the clipboard.' },
  { q: 'Is the image uploaded to a server?', a: 'No. The QR code is located and decoded entirely in your browser on your device — the photo never leaves your computer, which matters when the code holds a Wi-Fi password or contact details.' },
  { q: 'What kinds of QR codes can it read?', a: 'Links, plain text, Wi-Fi credentials (network, password, security type), contact cards (vCard and MECARD — savable as a .vcf file), email drafts, phone numbers, SMS messages, map locations and calendar events.' },
  { q: 'Why should I check a link before opening it?', a: 'Anyone can print a sticker. “Quishing” scams paste malicious QR codes over real ones on parking meters and posters. We always show you the full decoded address first and never open anything automatically — if the domain looks off, don’t open it.' },
  { q: 'The scan says no code was found — what helps?', a: 'Blur is the usual culprit. Retake the photo closer and square-on, make sure the whole code is visible with a bit of quiet space around it, or take a larger screenshot. Heavily stylized codes with logos can also fail if they pushed error correction too far.' },
  { q: 'Can it scan with my camera live?', a: 'On phones and tablets, “Take a photo of the code” opens your camera and scans the shot. Live continuous scanning in the browser is coming once our secure (HTTPS) domain is live — browsers only allow camera streams over HTTPS.' },
];

export default function ScanQrCodePage() {
  return (
    <PdfToolPage
      title="QR Code Scanner"
      description="Read any QR code from a photo or screenshot — decoded on your device, never uploaded. Get the link, Wi-Fi password or contact card as clean, copyable fields."
      steps={steps}
      faqs={faqs}
    >
      <ScanQrTool />
    </PdfToolPage>
  );
}
