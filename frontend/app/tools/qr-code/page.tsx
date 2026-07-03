import { permanentRedirect } from 'next/navigation';

// The QR generator moved to its keyword URL when it joined the shared site
// shell. Permanent redirect keeps old links working.
export default function LegacyQrCodePage() {
  permanentRedirect('/qr-code-generator');
}
