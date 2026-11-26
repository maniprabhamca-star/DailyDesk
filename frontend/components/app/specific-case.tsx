import type { ReactNode } from 'react';

// A one-line aside pointing at a page that covers ONE case of this same tool.
//
// Why it exists: an internal-link audit on 2026-11-25 found seven keyword
// landing pages — /compress-pdf-to-100kb, /fill-pdf-form-online, /remove-exif,
// /blur-image, /us-visa-photo, /wifi-qr-code, /vcard-qr-code — with no inbound
// link from anywhere on the site. They sit in the sitemap and nothing points
// at them.
//
// They are deliberately NOT in NEXT_STEPS. That rail is for the step that
// genuinely follows, and these are not a next step: someone who wants the
// 100 KB write-up wants it INSTEAD of the page they are on, not after it.
// Putting them there would turn a sequence rail into a related-links block,
// which is the one thing lib/next-steps.ts says not to do.
//
// Each parent supplies its own sentence. The component owns only the shape, so
// the copy stays specific to the pair and never reads as a generated row of
// "you might also like" links.
//
// ⚠ Pass it through PdfToolPage's `afterTool`, not as a child: `children` is
// wrapped in ToolGate, so on a gated tool an index placed there renders for
// nobody. That is exactly how the bank hub's index came to emit zero anchors.
export function SpecificCase({ children }: { children: ReactNode }) {
  return (
    <p className="mt-8 border-l-2 border-border pl-4 text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
