// Passport / visa / ID photo specifications by country & document. The engine is
// spec-driven: adding a country = adding a row here. Pixel sizes are the export
// target (mm converted at 300 DPI where the source spec is physical). head* is the
// head height (crown→chin) as a fraction of the photo HEIGHT — the guides + the
// "head OK" band come from these. bg is the required background. maxKB is the
// digital-upload file cap where one is commonly enforced (undefined = print, we
// just export a high-quality JPEG). Values are the widely-cited requirements;
// always tell users to check their specific portal.
export type PassportSpec = {
  id: string;
  label: string;
  group: string;
  wPx: number; hPx: number;
  wMM: number; hMM: number;
  headMin: number; headMax: number;
  bg: string; bgName: string;
  maxKB?: number;
  note?: string;
};

const mm = (v: number) => Math.round((v / 25.4) * 300); // mm → px @ 300 DPI

const WHITE = '#ffffff';
const OFFWHITE = '#f3f3f0';
const LIGHTGREY = '#e9e9e7';
const LIGHTBLUE = '#dbe7f5';

// Most Schengen states share 35×45 mm, ~70–80% head, light/neutral background.
function schengen(id: string, label: string): PassportSpec {
  return { id, label, group: 'Europe (Schengen)', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: LIGHTGREY, bgName: 'Light grey', note: '35×45 mm, neutral background' };
}

export const PASSPORT_SPECS: PassportSpec[] = [
  // ---- Popular ----
  { id: 'us-visa', label: 'US visa (DS-160)', group: 'Popular', wPx: 600, hPx: 600, wMM: 51, hMM: 51, headMin: 0.50, headMax: 0.69, bg: WHITE, bgName: 'White', maxKB: 240, note: '2×2 in, 600–1200 px, ≤240 KB' },
  { id: 'us-passport', label: 'US passport', group: 'Popular', wPx: 600, hPx: 600, wMM: 51, hMM: 51, headMin: 0.50, headMax: 0.69, bg: WHITE, bgName: 'White', note: '2×2 in, white background' },
  { id: 'schengen-visa', label: 'Schengen visa', group: 'Popular', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: LIGHTGREY, bgName: 'Light grey', note: '35×45 mm' },
  { id: 'uk-passport', label: 'UK passport', group: 'Popular', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.64, headMax: 0.76, bg: LIGHTGREY, bgName: 'Light grey', maxKB: 10240, note: '35×45 mm, 600×750 px min' },
  { id: 'india-passport', label: 'India passport (Seva)', group: 'Popular', wPx: 630, hPx: 810, wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', maxKB: 250, note: '630×810 px, ≤250 KB' },
  { id: 'india-evisa', label: 'India e-Visa', group: 'Popular', wPx: 600, hPx: 600, wMM: 51, hMM: 51, headMin: 0.60, headMax: 0.80, bg: WHITE, bgName: 'White', maxKB: 1024, note: 'square, 350–1000 px, ≤1 MB' },
  { id: 'canada', label: 'Canada passport/visa', group: 'Popular', wPx: mm(50), hPx: mm(70), wMM: 50, hMM: 70, headMin: 0.44, headMax: 0.52, bg: WHITE, bgName: 'White', note: '50×70 mm, head 31–36 mm' },
  { id: 'australia', label: 'Australia passport', group: 'Popular', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: OFFWHITE, bgName: 'Off-white', note: '35×45 mm' },
  { id: 'china-visa', label: 'China visa', group: 'Popular', wPx: 354, hPx: 472, wMM: 33, hMM: 48, headMin: 0.60, headMax: 0.72, bg: WHITE, bgName: 'White', maxKB: 1024, note: '33×48 mm, 354×472 px' },
  { id: 'biometric', label: 'Biometric (generic)', group: 'Popular', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: LIGHTGREY, bgName: 'Light grey', note: 'ICAO 35×45 mm' },

  // ---- Americas ----
  { id: 'brazil', label: 'Brazil', group: 'Americas', wPx: mm(50), hPx: mm(70), wMM: 50, hMM: 70, headMin: 0.50, headMax: 0.70, bg: WHITE, bgName: 'White', note: '5×7 cm' },
  { id: 'mexico', label: 'Mexico', group: 'Americas', wPx: 600, hPx: 600, wMM: 51, hMM: 51, headMin: 0.50, headMax: 0.69, bg: WHITE, bgName: 'White', note: '2×2 in' },
  { id: 'argentina', label: 'Argentina', group: 'Americas', wPx: mm(40), hPx: mm(40), wMM: 40, hMM: 40, headMin: 0.60, headMax: 0.80, bg: WHITE, bgName: 'White', note: '4×4 cm' },
  { id: 'chile', label: 'Chile', group: 'Americas', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm' },
  { id: 'colombia', label: 'Colombia', group: 'Americas', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '3.5×4.5 cm' },

  // ---- Europe (Schengen 35×45) ----
  schengen('germany', 'Germany'),
  schengen('france', 'France'),
  schengen('italy', 'Italy'),
  schengen('spain', 'Spain'),
  schengen('netherlands', 'Netherlands'),
  schengen('portugal', 'Portugal'),
  schengen('belgium', 'Belgium'),
  schengen('switzerland', 'Switzerland'),
  schengen('austria', 'Austria'),
  schengen('sweden', 'Sweden'),
  schengen('norway', 'Norway'),
  schengen('poland', 'Poland'),
  schengen('greece', 'Greece'),
  { id: 'ireland', label: 'Ireland passport', group: 'Europe (Schengen)', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.68, headMax: 0.80, bg: OFFWHITE, bgName: 'Off-white', note: '35×45 mm' },

  // ---- Asia ----
  { id: 'japan', label: 'Japan', group: 'Asia', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm' },
  { id: 'south-korea', label: 'South Korea', group: 'Asia', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm' },
  { id: 'singapore', label: 'Singapore', group: 'Asia', wPx: 400, hPx: 514, wMM: 35, hMM: 45, headMin: 0.66, headMax: 0.80, bg: WHITE, bgName: 'White', maxKB: 1024, note: '35×45 mm, 400×514 px' },
  { id: 'malaysia', label: 'Malaysia', group: 'Asia', wPx: mm(35), hPx: mm(50), wMM: 35, hMM: 50, headMin: 0.66, headMax: 0.80, bg: LIGHTBLUE, bgName: 'Light blue', note: '35×50 mm, BLUE background' },
  { id: 'philippines', label: 'Philippines', group: 'Asia', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm' },
  { id: 'indonesia', label: 'Indonesia', group: 'Asia', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '3×4 / 4×6 cm variants' },
  { id: 'thailand', label: 'Thailand', group: 'Asia', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm' },
  { id: 'pakistan', label: 'Pakistan', group: 'Asia', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm' },
  { id: 'bangladesh', label: 'Bangladesh', group: 'Asia', wPx: mm(45), hPx: mm(55), wMM: 45, hMM: 55, headMin: 0.62, headMax: 0.78, bg: WHITE, bgName: 'White', note: '45×55 mm' },
  { id: 'vietnam', label: 'Vietnam', group: 'Asia', wPx: mm(40), hPx: mm(60), wMM: 40, hMM: 60, headMin: 0.50, headMax: 0.70, bg: WHITE, bgName: 'White', note: '4×6 cm' },
  { id: 'srilanka', label: 'Sri Lanka', group: 'Asia', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm' },
  { id: 'nepal', label: 'Nepal', group: 'Asia', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm' },

  // ---- Middle East & Africa ----
  { id: 'uae', label: 'UAE visa', group: 'Middle East & Africa', wPx: mm(43), hPx: mm(55), wMM: 43, hMM: 55, headMin: 0.62, headMax: 0.78, bg: WHITE, bgName: 'White', maxKB: 1024, note: '43×55 mm, white' },
  { id: 'saudi', label: 'Saudi Arabia', group: 'Middle East & Africa', wPx: 600, hPx: 600, wMM: 51, hMM: 51, headMin: 0.55, headMax: 0.75, bg: WHITE, bgName: 'White', note: '2×2 in, white' },
  { id: 'qatar', label: 'Qatar', group: 'Middle East & Africa', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm' },
  { id: 'turkey', label: 'Türkiye', group: 'Middle East & Africa', wPx: 500, hPx: 600, wMM: 50, hMM: 60, headMin: 0.55, headMax: 0.75, bg: WHITE, bgName: 'White', note: '50×60 mm' },
  { id: 'egypt', label: 'Egypt', group: 'Middle East & Africa', wPx: mm(40), hPx: mm(60), wMM: 40, hMM: 60, headMin: 0.50, headMax: 0.70, bg: WHITE, bgName: 'White', note: '4×6 cm' },
  { id: 'nigeria', label: 'Nigeria', group: 'Middle East & Africa', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm' },
  { id: 'southafrica', label: 'South Africa', group: 'Middle East & Africa', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm' },
  { id: 'kenya', label: 'Kenya', group: 'Middle East & Africa', wPx: 600, hPx: 600, wMM: 51, hMM: 51, headMin: 0.55, headMax: 0.75, bg: WHITE, bgName: 'White', note: 'square, white' },

  // ---- Oceania ----
  { id: 'newzealand', label: 'New Zealand', group: 'Oceania', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm' },
];

export const SPEC_GROUPS = ['Popular', 'Americas', 'Europe (Schengen)', 'Asia', 'Middle East & Africa', 'Oceania'];

export function getSpec(id: string): PassportSpec | undefined {
  return PASSPORT_SPECS.find((s) => s.id === id);
}
