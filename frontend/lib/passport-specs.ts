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

// Specs whose size, head-height and background were checked against an official or
// widely-cited source (see docs/passport-spec-sources.md, 2026-07-14). The rest use
// standard ICAO 35×45 values and should be double-checked against the portal.
export const VERIFIED_SPECS = new Set<string>([
  'us-visa', 'us-passport', 'uk-passport', 'schengen-visa', 'india-passport', 'india-evisa',
  'canada', 'australia', 'china-visa', 'japan', 'biometric',
  'germany', 'france', 'italy', 'spain', 'netherlands', 'portugal', 'belgium', 'switzerland', 'austria', 'sweden', 'norway', 'poland', 'greece', 'ireland',
]);
export const isVerified = (id: string): boolean => VERIFIED_SPECS.has(id);

// ---- per-country editorial ---------------------------------------------------
// The one thing derived numbers CANNOT do: separate two countries that publish
// the same photo size. Germany, France, Poland and a dozen others are all
// 35×45 mm with a 70–80% head, so every generated sentence about them is
// identical and Google treats the pages as duplicates of one another.
//
// Every field here must come from the issuing authority's own page, with the
// URL and the date it was read recorded in docs/passport-spec-sources.md.
// Aggregator sites are fine for FINDING a rule and unacceptable as the source
// of one. If a fact is not on the cited page, it does not go in.
export type CountryEditorial = {
  authority: string;
  glasses?: string;
  headCovering?: string;
  expression?: string;
  background?: string;
  children?: string;
  exceptions?: string;
  /** The thing people most often get wrong for this country. */
  quirk?: string;
  sourceName: string;
  sourceUrl: string;
  checkedOn: string; // ISO date
};

export const EDITORIAL: Record<string, CountryEditorial> = {
  germany: {
    authority:
      'Photos for German passports and ID cards are governed by the Bundesministerium des Innern (BMI), which publishes a one-page chart — the Fotomustertafel — showing exactly what passes and what gets rejected. The underlying quality standard is BSI TR-03121, “Biometrie in hoheitlichen Anwendungen”, which is why the same photo has to work at an airport eGate as well as on the page.',
    background:
      'The background must be shadow-free and a single colour, and it has to contrast clearly with both your face and your hair. That last part catches people out: a white background behind grey or blonde hair is a rejection, and the chart lists “Hintergrund ohne Kontrast” as a failure alongside patterned and shadowed backgrounds.',
    expression:
      'Neutral expression, looking straight into the camera, mouth closed. Smiling with the mouth open is shown as a rejection, as is any grimace.',
    glasses:
      'Glasses are allowed, but the chart rejects two specific things: frames that cover the eyes, and lenses that are tinted too dark or catching a reflection. The eyes must be clearly visible and unobscured.',
    headCovering:
      'Head coverings are permitted for religious reasons only. Where one is worn, the face must be visible from the lower edge of the chin to the forehead, with no shadow falling across it. Caps are shown as a rejection.',
    children:
      'For children the face may fill 50–80% of the photo height rather than 70–80%. Up to the age of 10 minor deviations are accepted, and up to the age of 6 there are further allowances on head position, expression and whether the eyes are fully visible.',
    exceptions:
      'Exceptions are granted only for long-term or permanent medical reasons — the chart names facial paralysis, asymmetry, and being unable to hold the mouth closed at rest.',
    quirk:
      'The head-height rule is expressed as a proportion, not a measurement: the face must occupy 70 to 80% of the photo height, measured from the tip of the chin to the top of the head. On a 45 mm photo that is 31.5–36 mm. Photos are rejected for the head being too large as often as too small.',
    sourceName: 'BMI — Fotomustertafel: Qualitätsmerkmale biometrischer Fotos für Dokumente (Stand Juli 2025, BMI24037)',
    sourceUrl: 'https://www.bmi.bund.de/SharedDocs/downloads/DE/publikationen/themen/moderne-verwaltung/BMI24037-fotomustertafel.html',
    checkedOn: '2026-08-23',
  },
};

export const getEditorial = (id: string): CountryEditorial | undefined => EDITORIAL[id];

// ---- derived facts -----------------------------------------------------------
// Everything below is COMPUTED from the verified numbers above. Nothing here is
// authored or looked up, so it cannot drift from the spec table or invent a
// requirement that no authority actually publishes.

export type DerivedSpec = {
  headMinMM: number; headMaxMM: number;
  wIn: string; hIn: string;
  px600: string;
  aspect: string;
  perSheet: number;        // copies that fit on a 4x6 in / 10x15 cm print
  isSquare: boolean;
};

export function derive(s: PassportSpec): DerivedSpec {
  const r = (v: number) => Math.round(v * 10) / 10;
  // A 4x6 in print is 152x102 mm; count both orientations and take the better.
  const fit = (pw: number, ph: number) => Math.floor(152 / pw) * Math.floor(102 / ph);
  return {
    headMinMM: r(s.headMin * s.hMM),
    headMaxMM: r(s.headMax * s.hMM),
    wIn: r(s.wMM / 25.4).toFixed(1),
    hIn: r(s.hMM / 25.4).toFixed(1),
    px600: `${Math.round((s.wMM / 25.4) * 600)}×${Math.round((s.hMM / 25.4) * 600)}`,
    aspect: `${r(s.hMM / s.wMM)}:1`,
    perSheet: Math.max(fit(s.wMM, s.hMM), fit(s.hMM, s.wMM)),
    isSquare: s.wMM === s.hMM,
  };
}

// Other countries that publish EXACTLY this size, head range and background.
// This is what makes each country page genuinely different from its neighbours:
// the list excludes the page it appears on, so no two pages carry the same text,
// and it gives the reader something true and useful — 35×45 mm is shared by
// dozens of states, and knowing that one photo covers several trips is the point.
export function sharesSpecWith(s: PassportSpec, limit = 8): PassportSpec[] {
  return PASSPORT_SPECS.filter((o) =>
    o.id !== s.id &&
    o.wMM === s.wMM && o.hMM === s.hMM &&
    o.headMin === s.headMin && o.headMax === s.headMax &&
    o.bgName === s.bgName,
  ).slice(0, limit);
}
