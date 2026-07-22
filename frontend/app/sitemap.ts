import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { PASSPORT_SPECS } from '@/lib/passport-specs';
import { DEV_TOOLS } from '@/lib/dev-tools';
import { BANK_PAGES } from '@/lib/bank-statements';
import { WORKFLOWS } from '@/lib/statement-workflows';

// Every indexable route. Add new tool pages here when they ship (part of the
// per-task SEO checklist). /login and /register are noindex → not listed.
const ROUTES: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/pdf-viewer', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/merge-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/split-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/compress-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/compress-to-size', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/fill-pdf-form', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/rotate-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/delete-pages-from-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/add-page-numbers-to-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/jpg-to-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/pdf-to-jpg', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/pdf-to-word', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/pdf-to-excel', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/word-to-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/excel-to-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/powerpoint-to-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/extract-images-from-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/remove-pdf-metadata', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/sign-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/protect-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/unlock-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/watermark-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/flatten-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/repair-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/scan-to-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/pdf-to-powerpoint', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/pdf-to-pdfa', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/scan-qr-code', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/reorder-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/compress-image', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/heic-to-jpg', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/resize-image', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/crop-image', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/convert-image', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/passport-photo', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/photo-privacy', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/remove-background', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/video-to-gif', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/compress-video', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/word-counter', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/json-formatter', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/unit-converter', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/color-picker', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/qr-code-generator', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/wifi-qr-code', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/vcard-qr-code', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/password-generator', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/chat-pdf', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/summarize-pdf', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/translate-pdf', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/pdf-question-generator', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/file-vault', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/tools', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/pricing', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/overview', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/why-diemdesk', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/changelog', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/compare', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/smallpdf-alternative', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/ilovepdf-alternative', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/sejda-alternative', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/adobe-acrobat-alternative', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/free', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/feedback', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/security', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/refund-policy', priority: 0.3, changeFrequency: 'yearly' },
  // Keyword SEO landing pages (link into the tools).
  { path: '/compress-pdf-to-100kb', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/us-visa-photo', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/remove-exif', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/blur-image', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/fill-pdf-form-online', priority: 0.8, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const staticRoutes = ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path === '/' ? '' : r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
  // Dev & CSV pack — the hub + every built tool (auto-adds as tools ship).
  const devRoutes = [
    { url: `${SITE_URL}/developer-tools`, lastModified, changeFrequency: 'monthly' as const, priority: 0.7 },
    ...DEV_TOOLS.filter((t) => t.built).map((t) => ({
      url: `${SITE_URL}/${t.slug}`, lastModified, changeFrequency: 'monthly' as const, priority: 0.8,
    })),
  ];
  // Bank-specific Statement Converter landing pages — the flagship's SEO engine.
  // (The converter tool itself is owner-gated until launch and stays out of the
  // sitemap, like /edit-pdf; these content pages seed ranking in the meantime.)
  const bankRoutes = BANK_PAGES.map((b) => ({
    url: `${SITE_URL}/bank-statement-converter/${b.slug}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));
  // Outcome-led Statement Converter workflow pages (to Tally / QuickBooks / CSV).
  const workflowRoutes = WORKFLOWS.map((w) => ({
    url: `${SITE_URL}/${w.slug}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));
  // Per-country passport/visa photo landing pages (one per spec).
  const countryRoutes = PASSPORT_SPECS.map((s) => ({
    url: `${SITE_URL}/passport-photo/${s.id}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));
  return [...staticRoutes, ...devRoutes, ...bankRoutes, ...workflowRoutes, ...countryRoutes];
}
