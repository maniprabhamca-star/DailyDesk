import type { Metadata } from 'next';

// /design/* are internal design-review pages (the brand lab, the editor-shell
// mock). Never indexed — the client pages under here can't export metadata
// themselves, so the segment layout carries the robots rule for all of them.
export const metadata: Metadata = {
  title: 'Design preview — DiemDesk',
  robots: { index: false, follow: false },
};

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  return children;
}
