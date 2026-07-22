import { SITE_URL, SITE_NAME } from '@/lib/site';

/**
 * Page-specific structured data for content/marketing pages (the tool pages get
 * SoftwareApplication+FAQPage from PdfToolPage). Emits a WebPage node plus a
 * BreadcrumbList — the breadcrumb is what earns the Home › Page trail in search
 * results. `crumb` is the short label; defaults to `name`.
 */
export function PageJsonLd({
  name,
  path,
  description,
  crumb,
}: {
  name: string;
  path: string;
  description?: string;
  crumb?: string;
}) {
  const url = `${SITE_URL}${path}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name,
        url,
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
        ...(description ? { description } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: crumb || name, item: url },
        ],
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
