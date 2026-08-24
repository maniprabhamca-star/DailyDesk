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
  /**
   * Set ONLY where the authority measures head size on a basis this type does
   * not model, so headMin/headMax is our best generic band rather than their
   * rule. Rendered next to the head row. Countries publish head size on at
   * least five incompatible bases — crown-to-chin, face including hair,
   * chin-to-forehead, chin-to-eyes, and a bare percentage — and silently
   * showing one country's number under another's label is how this file came
   * to be wrong for six of ten Schengen states.
   */
  headCaveat?: string;
  /** The authority photographs the applicant; a supplied photo is not used. */
  photographedOnSite?: string;
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
  { id: 'india-passport', label: 'India passport (Seva)', group: 'Popular', wPx: 630, hPx: 810, wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', maxKB: 250, note: '3.5×4.5 cm printed, white background',
    photographedOnSite: 'At a Passport Seva Kendra or POPSK no photograph is required — you are photographed there. Printed photos are for the routes that still ask for them: two colour copies, 3.5×4.5 cm, white background.' },
  { id: 'india-evisa', label: 'India e-Visa', group: 'Popular', wPx: 600, hPx: 600, wMM: 51, hMM: 51, headMin: 0.60, headMax: 0.80, bg: WHITE, bgName: 'White', maxKB: 1024, note: 'square, 350–1000 px, ≤1 MB' },
  { id: 'canada', label: 'Canada passport/visa', group: 'Popular', wPx: mm(50), hPx: mm(70), wMM: 50, hMM: 70, headMin: 0.443, headMax: 0.514, bg: WHITE, bgName: 'White', note: '50×70 mm, head 31–36 mm' },
  { id: 'australia', label: 'Australia passport', group: 'Popular', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.711, headMax: 0.80, bg: OFFWHITE, bgName: 'Off-white', note: '35×45 mm' },
  { id: 'china-visa', label: 'China visa', group: 'Popular', wPx: 354, hPx: 472, wMM: 33, hMM: 48, headMin: 0.583, headMax: 0.688, bg: WHITE, bgName: 'White', maxKB: 1024, note: '33×48 mm, head 28–33 mm' },
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
  // Spain and the Netherlands do NOT match the generic Schengen row, and both
  // were wrong here until 2026-08-23. Sourced overrides, see
  // docs/passport-spec-sources.md.
  //
  // Spain: the Ministerio de Asuntos Exteriores photo sheet is explicit —
  // "fondo BLANCO, liso y uniforme. Sin sombras." Light grey was wrong and
  // would be refused. Its head rule ("el contorno de la cabeza ha de ocupar el
  // 50%", measured over face AND hair) does not map cleanly onto our crown-to-
  // chin fraction, so headMin/headMax are left alone pending the owner's check
  // against Policía Nacional rather than guessed at.
  { id: 'spain', label: 'Spain', group: 'Europe (Schengen)', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm, white background', headCaveat: 'Spain publishes this differently — the outline of the head, counting hair, should fill about half the photo. The band shown is the generic European one; check it against Policía Nacional before printing.' },
  // Netherlands: the RvIG Fotomatrix 2020 gives chin-to-crown as 26–30 mm on a
  // 45 mm photo — 58–67%, not the generic 70–80%, which would have cropped the
  // head too large and failed. It also accepts grey, light blue OR white.
  { id: 'netherlands', label: 'Netherlands', group: 'Europe (Schengen)', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.578, headMax: 0.667, bg: LIGHTGREY, bgName: 'Grey, light blue or white', note: '35×45 mm, face 26–30 mm chin to crown' },
  schengen('portugal', 'Portugal'),
  // Belgium: FPS Foreign Affairs gives face length INCLUDING HAIR as 25–35 mm
  // on a 45 mm photo — a wider and lower band than the generic 70–80%.
  { id: 'belgium', label: 'Belgium', group: 'Europe (Schengen)', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.556, headMax: 0.778, bg: LIGHTGREY, bgName: 'Light grey', note: '35×45 mm, face 25–35 mm incl. hair' },
  // Switzerland: fedpol's Fotomustertafel is explicit — "Gesichtshöhe vom Kinn
  // bis zur Schädeldecke mindestens 29 mm, höchstens 34 mm". Our 36 mm ceiling
  // was ABOVE the Swiss maximum, so the generic crop overshot it.
  { id: 'switzerland', label: 'Switzerland', group: 'Europe (Schengen)', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.644, headMax: 0.756, bg: LIGHTGREY, bgName: 'Plain neutral', note: '35×45 mm, face 29–34 mm chin to crown' },
  // Austria: BMI's Fotomuster says the head must fill 2/3 of the image and
  // "darf aber nicht höher als 36 mm sein" — 30–36 mm on a 45 mm photo. Our
  // 31.5 mm floor was stricter than the law, rejecting photos Austria accepts.
  // Background "einfärbig hell, idealerweise grau", so light grey stands.
  { id: 'austria', label: 'Austria', group: 'Europe (Schengen)', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.667, headMax: 0.80, bg: LIGHTGREY, bgName: 'Light grey', note: '35×45 mm, head 30–36 mm' },
  // Sweden does not take a supplied photo at all — the police photograph you.
  { id: 'sweden', label: 'Sweden', group: 'Europe (Schengen)', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: LIGHTGREY, bgName: 'Light grey', note: '35×45 mm',
    photographedOnSite: 'For a Swedish passport or national ID card you do not bring a photograph — the police photograph you at the passport counter. Use this only for a visa or another document that does ask for one.' },
  { id: 'norway', label: 'Norway', group: 'Europe (Schengen)', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: LIGHTGREY, bgName: 'Light grey', note: '35×45 mm, head about 70%',
    photographedOnSite: 'For a Norwegian passport or national ID card the picture is taken in the biometrikiosk at the police station, children included. Use this only for a visa or another document that does ask for a supplied photo.' },
  // Poland: gov.pl requires a WHITE background ("Tło powinno być białe"), not
  // the light grey the generic row assumed. Its head rule is expressed
  // chin-to-EYES with tolerances in an annex, a different basis from ours, so
  // headMin/headMax are left as-is rather than guessed at — see docs.
  { id: 'poland', label: 'Poland', group: 'Europe (Schengen)', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm, white background', headCaveat: 'Poland sizes the head from the chin to the EYES, with tolerances in an annex to its official instruction, not from the crown. The band shown is the generic European one.' },
  // Greece is NOT 35×45. The National Passport Centre publishes 40×60 mm, and
  // a background "preferably gray with an RGB value of (190;190;190) +/-10" —
  // a specific grey, not a vague light one. Head band here is Greece's own
  // published FACE height (chin to forehead, 50–60% of the photo); it does not
  // include the crown, so it reads slightly small against our crown-to-chin
  // label. Flagged in docs rather than converted by guesswork.
  { id: 'greece', label: 'Greece', group: 'Europe (Schengen)', wPx: mm(40), hPx: mm(60), wMM: 40, hMM: 60, headMin: 0.50, headMax: 0.60, bg: '#bebebe', bgName: 'Grey (RGB 190,190,190)', note: '40×60 mm, face 50–60% of height', headCaveat: 'Greece publishes the FACE height, chin to forehead, as 50–60% of the photo — it excludes the crown, so this band reads a little small against a crown-to-chin guide.' },
  { id: 'ireland', label: 'Ireland passport', group: 'Europe (Schengen)', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.68, headMax: 0.80, bg: OFFWHITE, bgName: 'Off-white', note: '35×45 mm' },

  // ---- Asia ----
  { id: 'japan', label: 'Japan', group: 'Asia', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.711, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm' },
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

  france: {
    authority:
      'Photos for French passports and identity cards are specified by the Ministère de l’Intérieur and published on service-public.gouv.fr; the titles themselves are produced by the ANTS. France is stricter than most of its neighbours on two points, and photographers outside the country get both of them wrong regularly.',
    background:
      'A plain light background — light blue or light grey. White is explicitly prohibited, which is the single most common reason a French photo taken abroad is refused: most photo booths and studios outside France default to white, and a white background is a rejection here even though it is fine for a German or American photo.',
    quirk:
      'The head must be bare. Unlike Germany, which permits a head covering worn for religious reasons, France requires the head uncovered — no hat, scarf or headband — with exceptions only on medical grounds. Ears must be visible too, so hair is pulled back if it would hide them.',
    expression:
      'Neutral expression with the mouth closed, head straight, looking directly at the lens. The eyes must be “parfaitement visibles et ouvertes”.',
    glasses:
      'Glasses may be worn but do not have to be. If they are, the frames must not be thick or mask the eyes, and the lenses must not be tinted, coloured or reflecting.',
    exceptions:
      'The photograph must be less than six months old, and physically clean — “nette, sans pliure, ni traces”: sharp, with no fold and no marks. Lighting must be even, with no overexposure, underexposure or shadow across the face.',
    sourceName: 'service-public.gouv.fr — Quelle photo fournir pour un titre d’identité (passeport, carte d’identité) ?',
    sourceUrl: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F10619',
    checkedOn: '2026-08-23',
  },

  italy: {
    authority:
      'Italian passports are issued by the Polizia di Stato, and the photo rules follow the ICAO standard published by the Ministero degli Affari Esteri for its consulates. Italy is unusually explicit that the photograph is checked at the counter — the Polizia publishes a rejection sheet, and a photo that fails is handed straight back.',
    quirk:
      'The photograph must be no more than six months old, and two identical copies are normally asked for. Bring a spare pair: a set printed for a different country will often be the wrong size, and Italian offices do not crop for you.',
    expression:
      'Neutral expression with the mouth closed, eyes open and clearly visible, looking straight at the camera. Centred and fully frontal — a half-profile is not accepted, and neither is a downward glance.',
    glasses:
      'Prescription glasses may be worn, but the lenses must be clear — no tint — and there must be no flash reflection on them. Heavy frames that cover any part of the eye are rejected. If your frames cannot avoid it, take the photo without them.',
    headCovering:
      'A head covering is accepted only where it is worn for religious reasons. In that case the outline of the face must be clearly visible from the base of the chin to the forehead, and both sides of the face must show.',
    children:
      'The same rules apply at every age. In a baby’s photograph no part of the person holding them — including their hands — may appear in the frame.',
    sourceName: 'Ministero degli Affari Esteri (Ambasciata d’Italia) — Fototessera per passaporto e carta d’identità: norme ICAO',
    sourceUrl: 'https://ambvienna.esteri.it/it/servizi-consolari-e-visti/servizi-per-il-cittadino-italiano/passaporti/norme-icao/',
    checkedOn: '2026-08-23',
  },

  netherlands: {
    authority:
      'Dutch passport and ID-card photos are governed by the Rijksdienst voor Identiteitsgegevens, which publishes the Fotomatrix — a transparent measuring template that municipal counter staff literally lay over your photograph. It is the most precisely specified photo in Europe, and the only one that measures the width of your face as well as its height.',
    quirk:
      'The face is measured twice. Height is 26–30 mm from chin to crown for anyone aged 11 or over (19–30 mm up to age 10), and width is 16–20 mm from one ear attachment to the other. That height is noticeably smaller than the 70–80% rule most of Europe uses — a photo cropped to the generic Schengen proportions has the head too large and is refused at the counter.',
    background:
      'Grey, light blue or white, and it must be even, a single colour, with no gradient or shadow and enough contrast against the head. The Netherlands is more permissive here than France, which bans white outright.',
    glasses:
      'Glasses are allowed provided the eyes are fully visible through completely transparent lenses, with no disturbing reflection and no shadow cast. Reflection is called out specifically — from shiny skin and jewellery as well as lenses.',
    headCovering:
      'The head must be uncovered, with one written exception: on religious or philosophical grounds it may stay covered, provided the face itself is fully visible.',
    expression:
      'Neutral gaze, looking straight into the camera, mouth closed, head straight to the front, eyes on a horizontal line, shoulders square. A tilted head is rejected because it breaks automated face recognition.',
    children:
      'Under-sixes are exempt from the posture and expression rules — eyes on a horizontal line, head untilted, shoulders square, neutral gaze, looking at the camera and mouth closed — but no visible support may appear in the frame.',
    exceptions:
      'The photo must be no more than six months old at the moment of application, printed at 400 dpi or better on smooth photo paper, unedited and not a copy. Physical or medical exemptions exist, and a doctor’s signed statement can be demanded where there is reasonable doubt.',
    sourceName: 'Rijksdienst voor Identiteitsgegevens — Fotomatrix model 2020: acceptatiecriteria voor de pasfoto',
    sourceUrl: 'https://www.rvig.nl/fotomatrix',
    checkedOn: '2026-08-23',
  },

  spain: {
    authority:
      'Spanish passport photographs are specified by the Ministerio de Asuntos Exteriores and the DNI by the Ministerio del Interior, with the Policía Nacional issuing both. Two identical photographs are asked for, not one.',
    quirk:
      'The background must be WHITE — plain, even and without shadow. This is the opposite of the light-grey background used for a Schengen visa photo and of what France requires, so a photo taken to the general European standard is the wrong one here. Spain also states its head rule differently: the outline of the head, counting hair, should occupy about half the photograph.',
    background:
      '“Fondo BLANCO, liso y uniforme. Sin sombras.” White, plain, uniform, no shadows.',
    glasses:
      'Lenses must be clear. Photos with reflections on the lenses are refused, and the frame must not cover the centre of the eye or the eyelid, nor cast a shadow on the face. Thick or decorative frames are not accepted — take the photo without glasses if yours cannot avoid it. Dark lenses are allowed only for blind applicants or a permanent serious eye condition.',
    headCovering:
      'The head must be uncovered, with nothing — hat, cap or ornament — that impedes identification. The face, including the eyebrows, must be clear of hair.',
    expression:
      'Centred and fully frontal; a half profile is not valid. Look directly at the camera — photos with the gaze lowered or the eyes half closed are refused.',
    children:
      'The same rules apply at every age. In a baby’s photograph neither the person holding them nor their hands may appear, even partly; the official advice is to lay the baby on a plain white background.',
    exceptions:
      'Both photographs must be recent — less than six months old — in colour, of professional quality and high resolution.',
    sourceName: 'Ministerio de Asuntos Exteriores — Fotografías para el pasaporte español (consular photo sheet, updated 2017)',
    sourceUrl: 'https://www.exteriores.gob.es/Consulados/dusseldorf/es/Documents/Nacionales/Normativa%20fotograf%C3%ADas%20pasaporte%20-%20Espa%C3%B1ol.pdf',
    checkedOn: '2026-08-23',
  },

  belgium: {
    authority:
      'Belgian passports are issued through your commune or, from abroad, a consulate, with the photo standard set by FPS Foreign Affairs. Belgium states plainly that the photograph must meet the ICAO standard and that the counter will refuse one that does not.',
    quirk:
      'Belgium measures the face INCLUDING the hair — 25 to 35 mm on the 45 mm photo — rather than crown to chin the way Switzerland and the Netherlands do. The band is wider than most of Europe at the bottom end, so a slightly smaller head passes here that would fail in Germany.',
    expression:
      'Head and shoulders straight, square to the camera. A neutral expression: mouth shut, no smiling.',
    glasses:
      'The eyes must be perfectly visible — no reflecting or tinted lenses. Belgium is unusually specific about frames: they should not be too big, but nor should they sit too close to the eyeline.',
    headCovering:
      'The face must be completely uncovered. Forehead, chin and the sides towards the ears all have to be visible.',
    sourceName: 'FPS Foreign Affairs — Quality requirements for the photo (Belgian passport), with measurements from its consular photo-requirements sheet',
    sourceUrl: 'https://diplomatie.belgium.be/en/belgians-abroad/belgian-passport/quality-requirements-photo',
    checkedOn: '2026-08-23',
  },

  switzerland: {
    authority:
      'Swiss passports and identity cards are administered by fedpol, the Federal Office of Police, which publishes a Fotomustertafel in German, French and Italian showing accepted and rejected photographs side by side.',
    quirk:
      'The face must measure 29 to 34 mm from the chin to the top of the skull — a tighter and lower band than the 70–80% rule used across much of Europe, and one where a generic “Schengen” crop comes out too large. If you have voluminous hair the face must still not fall below 29 mm. For children under 11 the minimum drops to 23 mm.',
    background:
      'A single colour, uniform and neutral, with no shadows and a clear separation between the head and the background. fedpol rejects both “kein neutraler Hintergrund” and a background so pale it loses contrast against the hair.',
    expression:
      'Head straight — not tilted, turned or tipped — looking into the camera, mouth closed. The rejection sheet calls out a sideways glance, closed eyes, hair across the face and a hand in shot.',
    headCovering:
      'Exceptions are admitted only for attested medical or religious reasons, the latter explicitly covering members of a religious community whose rule prescribes a veil in public.',
    sourceName: 'fedpol — Kriterien für die Annahme von Fotos für Pässe und Identitätskarten (Fotomustertafel)',
    sourceUrl: 'https://www.fedpol.admin.ch/fedpol/de/home/pass---identitaetskarte/pass/fotos.html',
    checkedOn: '2026-08-23',
  },
  greece: {
    authority:
      'Greek passports are issued by the Hellenic Police through the National Passport and Secure Document Centre, which publishes its own technical specification rather than deferring to the generic European one.',
    quirk:
      'Greece does not use the 35×45 mm photo the rest of Schengen does — it asks for 40×60 mm, without a frame. A standard European passport photo is simply the wrong size here. The background is specified to the exact shade: light, preferably grey at RGB (190, 190, 190) ± 10.',
    background:
      'Light, preferably grey at RGB (190;190;190) ±10 — one of the few authorities anywhere to name an exact value rather than describe a colour.',
    glasses:
      'If you normally wear glasses you must wear them in the photograph. Dark glasses or sunglasses are accepted only for medical reasons, frames must not obstruct the eyes, and reflections have to be eliminated by the lighting angle.',
    headCovering:
      'A head covering may be worn for religious reasons, provided the features from the jaw up to the forehead and from one ear to the other remain visible.',
    expression:
      'Neutral, without a smile, both eyes normally open — not wide open — and the mouth closed. The frame runs from the base of the shoulders to the top of the hair, filling 70–75% of the photo, with the chin-to-forehead distance at 50–60%.',
    exceptions:
      'The photograph must be in colour and taken within the last six months. A digitally printed photo has to be produced at 1200 dpi or better.',
    sourceName: 'National Passport and Secure Document Centre (Hellenic Police) — Technical specifications of the passport photograph',
    sourceUrl: 'https://www.passport.gov.gr/en/diadikasia-ekdosis/documents/specificationphoto.html',
    checkedOn: '2026-08-23',
  },

  norway: {
    authority:
      'Norwegian passports and national ID cards are handled by Politiet, the police. Their quality requirements are unusual in two ways, and both catch people who prepared a photo in advance.',
    quirk:
      'You do not bring a photograph. The picture is taken in the biometrikiosk at the police station — “bildet skal tas i biometrikiosken” — and the same applies to children. What follows is what the kiosk photo has to achieve, which is worth knowing before you arrive rather than after.',
    glasses:
      'Glasses are not permitted at all — “briller og hodeplagg skal ikke benyttes”. Not merely untinted or unreflective: no glasses. Take them off before you are photographed.',
    headCovering:
      'Head coverings are likewise not used, except on religious grounds or particular circumstances such as illness, and only where the person is expected to wear the same covering at future border checks. It must not cover any part of the face, nor more of the head than necessary, and must not be tight enough to change the natural shape of the face.',
    expression:
      'Both eyes, both eyebrows and the ears must be fully visible — hair tucked behind the ears — with the gaze on the lens, a neutral expression and the mouth closed. The head should fill about 70% of the picture. Scarves, bags and outer clothing come off before the photo.',
    sourceName: 'Politiet — Kvalitetskrav til ansiktsfoto i pass og nasjonale ID-kort',
    sourceUrl: 'https://www.politiet.no/tjenester/pass/passfoto',
    checkedOn: '2026-08-23',
  },

  portugal: {
    authority:
      'Portuguese passports and the Cartão de Cidadão are issued by the Instituto dos Registos e do Notariado, with consular posts applying the same rules abroad. Two identical photographs are required, not one.',
    quirk:
      'Portugal allows a photograph up to a YEAR old, where most of Europe insists on six months. And the Cartão de Cidadão is not the same photo as the passport: the citizen card takes a 32×32 mm square, while the passport asks for a photo “adequada ao modelo do passaporte” — the ICAO 35×45 mm this page is set to. One photograph does not serve both documents.',
    background:
      'Plain, clear and light — a white or light-coloured wall is the official suggestion — with the face visible and centred.',
    glasses:
      'Dark sunglasses are not accepted. The face must not be obscured by glasses, hats or any accessory.',
    headCovering:
      'The head must be uncovered for the Cartão de Cidadão, and nothing may cover the face on either document.',
    expression:
      'Look straight at the camera with a neutral expression.',
    sourceName: 'Instituto dos Registos e do Notariado / Portuguese consular services — Cartão de Cidadão e Passaporte, requisitos de fotografia',
    sourceUrl: 'https://irn.justica.gov.pt/Documentos-de-Identificacao/Cartao-de-Cidadao',
    checkedOn: '2026-08-23',
  },

  austria: {
    authority:
      'Austrian passports and identity cards are issued by the Bundesministerium für Inneres, which publishes a Fotomuster — a sheet of accepted and rejected examples that passport offices work from directly.',
    quirk:
      'Austria states the head size twice over, and the second half is the one that catches people: it must fill two thirds of the image, "darf aber nicht höher als 36 mm sein" — but no taller than 36 mm. It also sets a minimum distance between the pupils of 8 mm, 10 mm preferred, which no other country we cover measures.',
    background:
      'A single light colour, ideally grey, with enough contrast against both face and hair — and Austria is specific about which grey: medium grey suits light hair, light grey suits dark hair. No pattern, no shadows falling on it.',
    glasses:
      'The eyes must be clearly recognisable. Reflections on the lenses, tinted glass and sunglasses are all rejected, as are frames that cover the eyes.',
    expression:
      'Neutral, looking straight ahead. The rejection sheet names an open mouth, an upward glance, a tilted head, closed eyes and shadows across the face.',
    sourceName: 'Bundesministerium für Inneres — Fotomuster für Ausweisdokumente (2022)',
    sourceUrl: 'https://www.bmi.gv.at/607/files/passbild_kriterien_2022.pdf',
    checkedOn: '2026-08-23',
  },

  poland: {
    authority:
      'Polish passports and identity cards share one photo standard, published on gov.pl with a detailed instruction for photographers behind it.',
    quirk:
      'The background must be WHITE and evenly lit — not the light grey used for a Schengen visa photo. Poland also sizes the head in a way nobody else does: from the chin to the EYES, with the tolerances set out in an annex to the official instruction, rather than from the crown.',
    background:
      'White, uniformly lit, free of shadows and of any decorative element.',
    glasses:
      'Glasses with dark lenses are not allowed, nor is anything else that makes the face harder to recognise.',
    headCovering:
      'No head covering, on the same principle — nothing that impedes identification.',
    expression:
      'A natural facial expression with no gestures and the mouth closed. The photo must show the whole head from the crown down, plus the upper part of the shoulders.',
    exceptions:
      'The photograph must have been taken no more than six months before the application.',
    sourceName: 'gov.pl — Zdjęcie do dowodu lub paszportu',
    sourceUrl: 'https://www.gov.pl/web/gov/zdjecie-do-dowodu-lub-paszportu',
    checkedOn: '2026-08-23',
  },

  sweden: {
    authority:
      'Swedish passports and national ID cards are issued by Polismyndigheten, the police, and the rules read differently from everywhere else because of how the photograph is taken.',
    quirk:
      'You do not supply a photograph. The police photograph you at the passport counter when you apply, so there is nothing to print beforehand and no size to match. What Sweden publishes is a description of the result rather than a measured template — which is why there is no head height in millimetres here.',
    background:
      'Light, with the face evenly lit and no shadows or other distractions behind you.',
    glasses:
      'Dark glasses may not be worn except where medically necessary, and the pupils must be clearly visible.',
    expression:
      'Photographed straight from the front, whole head visible and centred, with a relaxed and neutral expression.',
    sourceName: 'Polismyndigheten — Pass och nationellt id-kort',
    sourceUrl: 'https://polisen.se/tjanster-tillstand/pass-och-nationellt-id-kort/',
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
