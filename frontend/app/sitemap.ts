import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Every indexable route. Add new tool pages here when they ship (part of the
// per-task SEO checklist). /login and /register are noindex → not listed.
const ROUTES: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/merge-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/split-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/compress-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/rotate-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/delete-pages-from-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/add-page-numbers-to-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/jpg-to-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/pdf-to-jpg', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/pdf-to-word', priority: 0.9, changeFrequency: 'monthly' },
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
  { path: '/scan-qr-code', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/reorder-pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/compress-image', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/heic-to-jpg', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/resize-image', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/crop-image', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/convert-image', priority: 0.9, changeFrequency: 'monthly' },
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
  { path: '/pricing', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/security', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/refund-policy', priority: 0.3, changeFrequency: 'yearly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path === '/' ? '' : r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
