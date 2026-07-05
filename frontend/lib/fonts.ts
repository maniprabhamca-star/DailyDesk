// Single source of truth for the font-family picker used across tools
// (Watermark, Annotate, and any future text tool) so the list stays identical
// everywhere. One record drives: the dropdown label (rendered in its real face
// via the @font-face rules in globals.css), the CSS stack for canvas/preview,
// bold/italic availability, and which bundled TTF to embed (pdf-lib tools).
// Built-ins (Helvetica/Times/Courier) ship inside pdf-lib; the other nine are
// OFL-licensed TTFs in public/fonts/ (see LICENSES.txt). globals.css declares
// @font-face for regular + bold + italic of every bundled family, so canvas
// text renders the REAL weight/slant (not faux) for the families that have them.

export type Family =
  | 'helvetica' | 'opensans' | 'roboto' | 'lato'
  | 'times' | 'merriweather' | 'playfair'
  | 'oswald' | 'bebas' | 'comic' | 'pacifico' | 'courier';

export type FamilyInfo = {
  label: string;
  css: string;
  bold: boolean;
  italic: boolean;
  files?: { regular: string; bold?: string; italic?: string };
};

export const FAMILIES: Record<Family, FamilyInfo> = {
  helvetica: { label: 'Helvetica', css: 'Helvetica, Arial, sans-serif', bold: true, italic: true },
  opensans: { label: 'Open Sans', css: "'Open Sans', sans-serif", bold: true, italic: true, files: { regular: '/fonts/open-sans-regular.ttf', bold: '/fonts/open-sans-bold.ttf', italic: '/fonts/open-sans-italic.ttf' } },
  roboto: { label: 'Roboto', css: 'Roboto, sans-serif', bold: true, italic: true, files: { regular: '/fonts/roboto-regular.ttf', bold: '/fonts/roboto-bold.ttf', italic: '/fonts/roboto-italic.ttf' } },
  lato: { label: 'Lato', css: 'Lato, sans-serif', bold: true, italic: true, files: { regular: '/fonts/lato-regular.ttf', bold: '/fonts/lato-bold.ttf', italic: '/fonts/lato-italic.ttf' } },
  times: { label: 'Times', css: "'Times New Roman', Times, serif", bold: true, italic: true },
  merriweather: { label: 'Merriweather', css: 'Merriweather, serif', bold: true, italic: true, files: { regular: '/fonts/merriweather-regular.ttf', bold: '/fonts/merriweather-bold.ttf', italic: '/fonts/merriweather-italic.ttf' } },
  playfair: { label: 'Playfair Display', css: "'Playfair Display', serif", bold: true, italic: true, files: { regular: '/fonts/playfair-regular.ttf', bold: '/fonts/playfair-bold.ttf', italic: '/fonts/playfair-italic.ttf' } },
  oswald: { label: 'Oswald', css: 'Oswald, sans-serif', bold: true, italic: false, files: { regular: '/fonts/oswald-regular.ttf', bold: '/fonts/oswald-bold.ttf' } },
  bebas: { label: 'Bebas Neue', css: "'Bebas Neue', sans-serif", bold: false, italic: false, files: { regular: '/fonts/bebas-neue-regular.ttf' } },
  comic: { label: 'Comic Neue', css: "'Comic Neue', cursive", bold: true, italic: true, files: { regular: '/fonts/comic-neue-regular.ttf', bold: '/fonts/comic-neue-bold.ttf', italic: '/fonts/comic-neue-italic.ttf' } },
  pacifico: { label: 'Pacifico', css: 'Pacifico, cursive', bold: false, italic: false, files: { regular: '/fonts/pacifico-regular.ttf' } },
  courier: { label: 'Courier', css: "'Courier New', Courier, monospace", bold: true, italic: true },
};

export const FAMILY_KEYS = Object.keys(FAMILIES) as Family[];

const fontBytesCache = new Map<string, Promise<Uint8Array>>();
/** Fetch a bundled TTF as bytes (for pdf-lib embedding), cached; failures aren't cached. */
export function loadFontBytes(url: string): Promise<Uint8Array> {
  let p = fontBytesCache.get(url);
  if (!p) {
    p = fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(`font ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    });
    p.catch(() => fontBytesCache.delete(url));
    fontBytesCache.set(url, p);
  }
  return p;
}
