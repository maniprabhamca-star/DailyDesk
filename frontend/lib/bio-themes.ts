// Shared visual themes for Link in Bio — used by both the editor preview and the
// public page so what you build is exactly what visitors see. Each theme is a
// self-contained set of CSS values (no dependency on the app's tokens, since the
// public page renders standalone).
export type BioTheme = {
  id: string;
  name: string;
  pageBg: string;      // full-page background (can be a gradient)
  cardText: string;    // name/bio color
  subText: string;     // muted color
  linkBg: string;
  linkText: string;
  linkBorder: string;
  linkHoverBg: string;
  avatarRing: string;
};

export const BIO_THEMES: Record<string, BioTheme> = {
  slate: {
    id: 'slate', name: 'Slate',
    pageBg: '#0f172a', cardText: '#f8fafc', subText: '#94a3b8',
    linkBg: 'rgba(255,255,255,0.06)', linkText: '#f1f5f9', linkBorder: 'rgba(255,255,255,0.12)',
    linkHoverBg: 'rgba(255,255,255,0.12)', avatarRing: 'rgba(255,255,255,0.15)',
  },
  ocean: {
    id: 'ocean', name: 'Ocean',
    pageBg: 'linear-gradient(160deg,#0c4a6e,#0e7490 60%,#155e75)', cardText: '#f0f9ff', subText: '#bae6fd',
    linkBg: 'rgba(255,255,255,0.12)', linkText: '#ffffff', linkBorder: 'rgba(255,255,255,0.22)',
    linkHoverBg: 'rgba(255,255,255,0.2)', avatarRing: 'rgba(255,255,255,0.3)',
  },
  sunset: {
    id: 'sunset', name: 'Sunset',
    pageBg: 'linear-gradient(160deg,#7c2d12,#c2410c 55%,#b91c1c)', cardText: '#fff7ed', subText: '#fed7aa',
    linkBg: 'rgba(255,255,255,0.14)', linkText: '#ffffff', linkBorder: 'rgba(255,255,255,0.25)',
    linkHoverBg: 'rgba(255,255,255,0.24)', avatarRing: 'rgba(255,255,255,0.35)',
  },
  forest: {
    id: 'forest', name: 'Forest',
    pageBg: 'linear-gradient(160deg,#14532d,#15803d 60%,#166534)', cardText: '#f0fdf4', subText: '#bbf7d0',
    linkBg: 'rgba(255,255,255,0.12)', linkText: '#ffffff', linkBorder: 'rgba(255,255,255,0.22)',
    linkHoverBg: 'rgba(255,255,255,0.2)', avatarRing: 'rgba(255,255,255,0.3)',
  },
  grape: {
    id: 'grape', name: 'Grape',
    pageBg: 'linear-gradient(160deg,#4c1d95,#7c3aed 60%,#6d28d9)', cardText: '#faf5ff', subText: '#ddd6fe',
    linkBg: 'rgba(255,255,255,0.13)', linkText: '#ffffff', linkBorder: 'rgba(255,255,255,0.24)',
    linkHoverBg: 'rgba(255,255,255,0.22)', avatarRing: 'rgba(255,255,255,0.32)',
  },
  rose: {
    id: 'rose', name: 'Rose',
    pageBg: 'linear-gradient(160deg,#831843,#be185d 60%,#9d174d)', cardText: '#fff1f2', subText: '#fecdd3',
    linkBg: 'rgba(255,255,255,0.14)', linkText: '#ffffff', linkBorder: 'rgba(255,255,255,0.25)',
    linkHoverBg: 'rgba(255,255,255,0.24)', avatarRing: 'rgba(255,255,255,0.35)',
  },
  mono: {
    id: 'mono', name: 'Mono',
    pageBg: '#fafafa', cardText: '#18181b', subText: '#71717a',
    linkBg: '#ffffff', linkText: '#18181b', linkBorder: '#e4e4e7',
    linkHoverBg: '#f4f4f5', avatarRing: '#e4e4e7',
  },
};

export const THEME_LIST = Object.values(BIO_THEMES);
export const getTheme = (id?: string): BioTheme => BIO_THEMES[id || 'slate'] || BIO_THEMES.slate;

export type BioLink = { label: string; url: string };
export type BioConfig = {
  displayName: string;
  bio: string;
  avatar: string | null; // data URL
  theme: string;
  links: BioLink[];
};

export const EMPTY_BIO: BioConfig = { displayName: '', bio: '', avatar: null, theme: 'slate', links: [] };

// The visitor-facing initials fallback when there's no avatar.
export const initials = (name: string): string =>
  (name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2) || '·').toUpperCase();
