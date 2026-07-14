import type { Metadata } from 'next';

// Internal design-review page — hard noindex (the page comment always intended
// this, but without its own metadata it was inheriting the indexable root/home
// metadata). Off the sitemap and out of the index.
export const metadata: Metadata = {
  title: 'Editor preview (internal) | DiemDesk',
  alternates: { canonical: '/design/editor' },
  robots: { index: false, follow: false },
};

export default function EditorPreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
