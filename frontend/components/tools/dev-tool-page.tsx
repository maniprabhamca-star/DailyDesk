import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { DevToolShell } from '@/components/tools/dev-tool-shell';
import { getDevTool, type DevKind } from '@/lib/dev-tools';

// Generic, kind-based how-to steps so every tool reads consistently without
// per-tool boilerplate.
function stepsFor(kind: DevKind): string[] {
  switch (kind) {
    case 'inspect': return ['Paste your token or input.', 'Read the decoded result on the right.', 'Copy anything you need — it never leaves your browser.'];
    case 'generate': return ['Choose how many you need.', 'Hit Generate.', 'Copy the results with one click — nothing is uploaded.'];
    case 'diff': return ['Paste the original on the left, the changed version on the right.', 'Added lines show green, removed lines red.', 'Copy the diff — both texts stay on your device.'];
    default: return ['Paste your input on the left.', 'Pick a mode if the tool has one — the result updates instantly.', 'Copy the output with one click. Nothing is ever uploaded.'];
  }
}

// Metadata helper so each route file stays a 3-line stub.
export function devMeta(slug: string): Metadata {
  const t = getDevTool(slug);
  if (!t) return {};
  return {
    title: t.seoTitle,
    description: t.seoDesc,
    alternates: { canonical: `/${t.slug}` },
    openGraph: { images: ['/og.png'], title: t.seoTitle, description: t.seoDesc, type: 'website' },
  };
}

export function DevToolPage({ slug }: { slug: string }) {
  const tool = getDevTool(slug);
  if (!tool) return null;
  return (
    <PdfToolPage title={tool.h1} description={tool.intro} steps={stepsFor(tool.kind)} faqs={tool.faq}>
      <DevToolShell tool={tool} />
    </PdfToolPage>
  );
}
