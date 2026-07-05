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
  | 'helvetica' | 'inter' | 'roboto' | 'opensans' | 'lato' | 'carlito'
  | 'montserrat' | 'poppins' | 'nunito' | 'mulish' | 'worksans'
  | 'raleway' | 'rubik' | 'oswald' | 'bebas' | 'anton' | 'josefinsans' | 'comic'
  | 'times' | 'merriweather' | 'playfair' | 'lora' | 'bitter' | 'caladea'
  | 'courier' | 'robotomono'
  | 'pacifico' | 'caveat' | 'dancingscript';

export type FamilyInfo = {
  label: string;
  css: string;
  bold: boolean;
  italic: boolean;
  files?: { regular: string; bold?: string; italic?: string };
};

// NOTE: the newer families ship as VARIABLE ttf (one file covers all weights) —
// globals.css declares them @font-face with a font-weight RANGE, so canvas text
// (Annotate) gets a REAL bold from the weight axis, and pdf-lib (Watermark)
// embeds them fine (verified). For variable families we don't ship a separate
// bold file, so Watermark's bold renders at the default weight — a minor cosmetic
// limitation there only; Annotate bold is real. Poppins ships true static faces.
export const FAMILIES: Record<Family, FamilyInfo> = {
  helvetica: { label: 'Helvetica', css: 'Helvetica, Arial, sans-serif', bold: true, italic: true },
  inter: { label: 'Inter', css: "'Inter', sans-serif", bold: true, italic: true, files: { regular: '/fonts/inter.ttf', italic: '/fonts/inter-italic.ttf' } },
  roboto: { label: 'Roboto', css: 'Roboto, sans-serif', bold: true, italic: true, files: { regular: '/fonts/roboto-regular.ttf', bold: '/fonts/roboto-bold.ttf', italic: '/fonts/roboto-italic.ttf' } },
  opensans: { label: 'Open Sans', css: "'Open Sans', sans-serif", bold: true, italic: true, files: { regular: '/fonts/open-sans-regular.ttf', bold: '/fonts/open-sans-bold.ttf', italic: '/fonts/open-sans-italic.ttf' } },
  lato: { label: 'Lato', css: 'Lato, sans-serif', bold: true, italic: true, files: { regular: '/fonts/lato-regular.ttf', bold: '/fonts/lato-bold.ttf', italic: '/fonts/lato-italic.ttf' } },
  carlito: { label: 'Carlito (Calibri)', css: "'Carlito', sans-serif", bold: true, italic: true, files: { regular: '/fonts/carlito.ttf', bold: '/fonts/carlito-bold.ttf', italic: '/fonts/carlito-italic.ttf' } },
  montserrat: { label: 'Montserrat', css: "'Montserrat', sans-serif", bold: true, italic: true, files: { regular: '/fonts/montserrat.ttf', italic: '/fonts/montserrat-italic.ttf' } },
  poppins: { label: 'Poppins', css: "'Poppins', sans-serif", bold: true, italic: true, files: { regular: '/fonts/poppins-regular.ttf', bold: '/fonts/poppins-bold.ttf', italic: '/fonts/poppins-italic.ttf' } },
  nunito: { label: 'Nunito', css: "'Nunito', sans-serif", bold: true, italic: true, files: { regular: '/fonts/nunito.ttf', italic: '/fonts/nunito-italic.ttf' } },
  mulish: { label: 'Mulish', css: "'Mulish', sans-serif", bold: true, italic: true, files: { regular: '/fonts/mulish.ttf', italic: '/fonts/mulish-italic.ttf' } },
  worksans: { label: 'Work Sans', css: "'Work Sans', sans-serif", bold: true, italic: true, files: { regular: '/fonts/worksans.ttf', italic: '/fonts/worksans-italic.ttf' } },
  raleway: { label: 'Raleway', css: "'Raleway', sans-serif", bold: true, italic: true, files: { regular: '/fonts/raleway.ttf', italic: '/fonts/raleway-italic.ttf' } },
  rubik: { label: 'Rubik', css: "'Rubik', sans-serif", bold: true, italic: true, files: { regular: '/fonts/rubik.ttf', italic: '/fonts/rubik-italic.ttf' } },
  oswald: { label: 'Oswald', css: 'Oswald, sans-serif', bold: true, italic: false, files: { regular: '/fonts/oswald-regular.ttf', bold: '/fonts/oswald-bold.ttf' } },
  bebas: { label: 'Bebas Neue', css: "'Bebas Neue', sans-serif", bold: false, italic: false, files: { regular: '/fonts/bebas-neue-regular.ttf' } },
  anton: { label: 'Anton', css: "'Anton', sans-serif", bold: false, italic: false, files: { regular: '/fonts/anton.ttf' } },
  josefinsans: { label: 'Josefin Sans', css: "'Josefin Sans', sans-serif", bold: true, italic: false, files: { regular: '/fonts/josefinsans.ttf' } },
  comic: { label: 'Comic Neue', css: "'Comic Neue', cursive", bold: true, italic: true, files: { regular: '/fonts/comic-neue-regular.ttf', bold: '/fonts/comic-neue-bold.ttf', italic: '/fonts/comic-neue-italic.ttf' } },
  times: { label: 'Times', css: "'Times New Roman', Times, serif", bold: true, italic: true },
  merriweather: { label: 'Merriweather', css: 'Merriweather, serif', bold: true, italic: true, files: { regular: '/fonts/merriweather-regular.ttf', bold: '/fonts/merriweather-bold.ttf', italic: '/fonts/merriweather-italic.ttf' } },
  playfair: { label: 'Playfair Display', css: "'Playfair Display', serif", bold: true, italic: true, files: { regular: '/fonts/playfair-regular.ttf', bold: '/fonts/playfair-bold.ttf', italic: '/fonts/playfair-italic.ttf' } },
  lora: { label: 'Lora', css: "'Lora', serif", bold: true, italic: true, files: { regular: '/fonts/lora.ttf', italic: '/fonts/lora-italic.ttf' } },
  bitter: { label: 'Bitter', css: "'Bitter', serif", bold: true, italic: true, files: { regular: '/fonts/bitter.ttf', italic: '/fonts/bitter-italic.ttf' } },
  caladea: { label: 'Caladea (Cambria)', css: "'Caladea', serif", bold: true, italic: true, files: { regular: '/fonts/caladea.ttf', bold: '/fonts/caladea-bold.ttf', italic: '/fonts/caladea-italic.ttf' } },
  courier: { label: 'Courier', css: "'Courier New', Courier, monospace", bold: true, italic: true },
  robotomono: { label: 'Roboto Mono', css: "'Roboto Mono', monospace", bold: true, italic: true, files: { regular: '/fonts/robotomono.ttf', italic: '/fonts/robotomono-italic.ttf' } },
  pacifico: { label: 'Pacifico', css: 'Pacifico, cursive', bold: false, italic: false, files: { regular: '/fonts/pacifico-regular.ttf' } },
  caveat: { label: 'Caveat', css: "'Caveat', cursive", bold: false, italic: false, files: { regular: '/fonts/caveat.ttf' } },
  dancingscript: { label: 'Dancing Script', css: "'Dancing Script', cursive", bold: false, italic: false, files: { regular: '/fonts/dancingscript.ttf' } },
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
