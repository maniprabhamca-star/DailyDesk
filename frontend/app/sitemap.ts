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
  { path: '/tools/qr-code', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/tools/password', priority: 0.9, changeFrequency: 'monthly' },
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
