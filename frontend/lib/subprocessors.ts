// Everyone outside DiemDesk who can handle personal data on our behalf.
//
// GDPR Article 28(2) expects a controller to know who else is involved before
// they hand you anything, so this is published rather than sent on request.
//
// It is a SHORT list, and the reason is structural rather than modest: most of
// the catalogue runs inside the browser, so there is no processing to delegate.
// A competitor whose every tool uploads has a subprocessor for storage, one for
// the conversion pipeline, one for the CDN in front of it, and usually an
// analytics vendor watching the whole thing. Keep this list short on purpose —
// every addition is a promise to notify customers.

export type Subprocessor = {
  name: string;
  purpose: string;
  /** What personal data it can actually see. Be specific; "user data" is not an answer. */
  data: string;
  location: string;
  url: string;
};

export const SUBPROCESSORS: Subprocessor[] = [
  {
    name: 'Stripe',
    purpose: 'Payments and subscription billing',
    data: 'Name, email and billing details of paying customers. Card numbers go to Stripe directly and are never seen by DiemDesk.',
    location: 'United States, with global processing',
    url: 'https://stripe.com/privacy',
  },
  {
    name: 'Anthropic',
    purpose: 'The AI tools — chat, summarise, translate, question generator, AI find-and-redact',
    data: 'Only the text a request needs, and only when you invoke an AI tool. Never the file itself, and nothing at all if you do not use those tools.',
    location: 'United States',
    url: 'https://www.anthropic.com/legal/privacy',
  },
  {
    name: 'Hostinger',
    purpose: 'Server hosting for the site, the API and the server-side conversions',
    data: 'Account records, and any file passing through a server-side tool for the seconds the conversion takes.',
    location: 'European Union',
    url: 'https://www.hostinger.com/privacy-policy',
  },
  {
    name: 'Cloudflare',
    purpose: 'DNS, TLS termination and protection against attack traffic',
    data: 'Connection metadata such as IP address, as any network provider sees. No file contents.',
    location: 'Global edge network',
    url: 'https://www.cloudflare.com/privacypolicy/',
  },
];
