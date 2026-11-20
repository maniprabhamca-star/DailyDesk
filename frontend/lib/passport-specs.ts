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

// Most Schengen states share 35×45 mm, ~70–80% head, light/neutral background.
function schengen(id: string, label: string): PassportSpec {
  return { id, label, group: 'Europe (Schengen)', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: LIGHTGREY, bgName: 'Light grey', note: '35×45 mm, neutral background' };
}

export const PASSPORT_SPECS: PassportSpec[] = [
  // ---- Popular ----
  { id: 'us-visa', label: 'US visa (DS-160)', group: 'Popular', wPx: 600, hPx: 600, wMM: 51, hMM: 51, headMin: 0.50, headMax: 0.69, bg: WHITE, bgName: 'White', maxKB: 240, note: '2×2 in, 600–1200 px, ≤240 KB' },
  { id: 'us-passport', label: 'US passport', group: 'Popular', wPx: 600, hPx: 600, wMM: 51, hMM: 51, headMin: 0.50, headMax: 0.69, bg: WHITE, bgName: 'White', note: '2×2 in, white background' },
  { id: 'schengen-visa', label: 'Schengen visa', group: 'Popular', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: LIGHTGREY, bgName: 'Light grey', note: '35×45 mm' },
    // UK: HMPO publishes the head as 29-34 mm on a 45 mm photo — 64.4-75.6%, not the
  // rounded 64-76% this row used to carry. Background is "plain cream or light grey",
  // NOT white; a white wall is the single most common UK rejection.
  { id: 'uk-passport', label: 'UK passport', group: 'Popular', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 29 / 45, headMax: 34 / 45, bg: LIGHTGREY, bgName: 'Cream or light grey', maxKB: 10240, note: '35×45 mm, head 29–34 mm, 600×750 px min' },
  { id: 'india-passport', label: 'India passport (Seva)', group: 'Popular', wPx: 630, hPx: 810, wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', maxKB: 250, note: '3.5×4.5 cm printed, white background',
    photographedOnSite: 'At a Passport Seva Kendra or POPSK no photograph is required — you are photographed there. Printed photos are for the routes that still ask for them: two colour copies, 3.5×4.5 cm, white background.' },
  { id: 'india-evisa', label: 'India e-Visa', group: 'Popular', wPx: 600, hPx: 600, wMM: 51, hMM: 51, headMin: 0.60, headMax: 0.80, bg: WHITE, bgName: 'White', maxKB: 1024, note: 'square, JPEG 10 KB–1 MB' },
  { id: 'canada', label: 'Canada passport/visa', group: 'Popular', wPx: mm(50), hPx: mm(70), wMM: 50, hMM: 70, headMin: 0.443, headMax: 0.514, bg: WHITE, bgName: 'White', note: '50×70 mm, head 31–36 mm' },
  // Australia publishes a RANGE, not a fixed size: 35–40 mm wide by 45–50 mm high,
  // with the face 32–36 mm chin to crown. We target the smallest valid rectangle
  // (35×45), where 32–36 mm is 71.1–80%. Background is "plain white or light grey";
  // the off-white this row used to carry was not one of the two stated options.
  { id: 'australia', label: 'Australia passport', group: 'Popular', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 32 / 45, headMax: 36 / 45, bg: WHITE, bgName: 'White or light grey', note: '35–40 × 45–50 mm, face 32–36 mm' },
  { id: 'china-visa', label: 'China visa', group: 'Popular', wPx: 354, hPx: 472, wMM: 33, hMM: 48, headMin: 0.583, headMax: 0.688, bg: WHITE, bgName: 'White', maxKB: 1024, note: '33×48 mm, head 28–33 mm' },
  { id: 'biometric', label: 'Biometric (generic)', group: 'Popular', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: LIGHTGREY, bgName: 'Light grey', note: 'ICAO 35×45 mm' },

  // ---- Americas ----
  // Brazil: the 5×7 cm print is ONLY for applicants under five. Everyone else is
  // photographed at the Polícia Federal appointment — see docs/passport-spec-sources.md.
  { id: 'brazil', label: 'Brazil', group: 'Americas', wPx: mm(50), hPx: mm(70), wMM: 50, hMM: 70, headMin: 0.50, headMax: 0.70, bg: WHITE, bgName: 'White', note: '5×7 cm, under‑5s only',
    photographedOnSite: 'For a Brazilian passport you are photographed at the Polícia Federal appointment — you do not bring a photo. The 5×7 cm print is required only for an applicant under five years old, who still has to attend in person.',
    headCaveat: 'The Polícia Federal publishes the size and the background but no head measurement, because this print is for infants. The band shown is a generic one.' },
  // Mexico: the SRE takes the photograph with its own equipment at the appointment
  // and publishes no size for a supplied one. This row is a generic 2×2 in.
  { id: 'mexico', label: 'Mexico', group: 'Americas', wPx: 600, hPx: 600, wMM: 51, hMM: 51, headMin: 0.50, headMax: 0.69, bg: WHITE, bgName: 'White', note: '2×2 in (generic)',
    photographedOnSite: 'For a Mexican passport the SRE photographs you at the appointment, along with your fingerprints, irises and signature. No photograph is brought and none is charged for. Use this only for a visa or another document that does ask for a supplied photo.',
    headCaveat: 'The SRE publishes rules for how you must look — no glasses, head uncovered — but no size or head band, because it takes the picture itself. The numbers shown are a generic 2×2 inch.' },
  // Argentina: Decreto 749/2019 art. 30 gives the size (4×4 cm) and the background
  // (uniform white, plain) but frames it as "medio busto" — head and upper chest —
  // which is looser than any crown-to-chin band, so the band below stays generic.
  { id: 'argentina', label: 'Argentina', group: 'Americas', wPx: mm(40), hPx: mm(40), wMM: 40, hMM: 40, headMin: 0.60, headMax: 0.80, bg: WHITE, bgName: 'White', note: '4×4 cm, white',
    photographedOnSite: 'For an Argentine passport or DNI the photograph is taken by RENAPER staff when you attend — the decree describes the image as captured at the moment the document is applied for. Use this for a visa or another document that does ask you to supply one.',
    headCaveat: 'The decree frames the photo as “medio busto” — head and upper chest — rather than giving a chin-to-crown measurement. The band shown is the generic one and is tighter than the words require.' },
  // Chile: the Registro Civil's own service page lists exactly one requirement for
  // a passport — a valid cédula de identidad. No photograph is asked for at all.
  { id: 'chile', label: 'Chile', group: 'Americas', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm (generic)',
    photographedOnSite: 'For a Chilean passport you book an appointment and attend the Registro Civil; the only thing its service page asks you to bring is a valid cédula de identidad. No photograph appears on the list. Use this for a visa or another document that does ask for one.',
    headCaveat: 'Chile publishes no photo specification for the passport, because it does not ask for a supplied photo. The 35×45 mm shown here is the generic international size, not a Chilean rule.' },
  // Colombia: Resolución 10829 de 2024, parágrafo 4º — "Tamaño de cuatro por
  // cinco centímetros (4.0 cm x 5.0 cm) a color". We shipped 35×45 mm, which was
  // simply the wrong photo, the same class of error as Greece. The resolution is
  // behind a Cloudflare bot check we do not bypass; the owner read it and sent
  // the text on 2026-11-20. It gives no head measurement, only "el rostro debe
  // quedar en primer plano", so the band stays generic behind a caveat.
  { id: 'colombia', label: 'Colombia', group: 'Americas', wPx: mm(40), hPx: mm(50), wMM: 40, hMM: 50, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '4×5 cm, colour, white background',
    headCaveat: 'The resolution asks only that the face be in the foreground — “el rostro debe quedar en primer plano” — and publishes no chin-to-crown measurement. The band shown is the generic one.' },

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
  // South Korea: MOFA publishes head length (crown to chin) as 3.2–3.6 cm on a
  // 4.5 cm photo — 0.711–0.80. Our floor was a shade loose. Online 413×531 px.
  { id: 'south-korea', label: 'South Korea', group: 'Asia', wPx: 413, hPx: 531, wMM: 35, hMM: 45, headMin: 3.2 / 4.5, headMax: 3.6 / 4.5, bg: WHITE, bgName: 'White', note: '35×45 mm, head 32–36 mm, 413×531 px online' },
  // Singapore: ICA's own application form gives the face as 25–35 mm chin to
  // crown on a 45 mm photo — 0.556–0.778. We shipped 0.66–0.80, so the floor was
  // stricter than ICA requires AND the ceiling sat above its maximum. Background
  // is plain white, with light grey reserved for white hair. The 1 MB cap was
  // ours; the current guidelines page allows 8 MB.
  { id: 'singapore', label: 'Singapore', group: 'Asia', wPx: 400, hPx: 514, wMM: 35, hMM: 45, headMin: 25 / 45, headMax: 35 / 45, bg: WHITE, bgName: 'White (light grey if your hair is white)', maxKB: 8192, note: '35×45 mm, face 25–35 mm, 400×514 px' },
  // Malaysia: the Immigration Department's published specification is 35×50 mm
  // with the head 30–35 mm chin to crown — 0.60–0.70, where we shipped 0.66–0.80,
  // overshooting its maximum. The background is PLAIN WHITE; blue appears only as
  // an alternative for one visa category, and the flat "BLUE background" this row
  // used to carry is not what the department publishes.
  { id: 'malaysia', label: 'Malaysia', group: 'Asia', wPx: mm(35), hPx: mm(50), wMM: 35, hMM: 50, headMin: 30 / 50, headMax: 35 / 50, bg: WHITE, bgName: 'White (blue accepted for some visa types)', note: '35×50 mm, head 30–35 mm' },
  // Philippines: the DFA captures your photo and biometrics at the Consular
  // Office and says in as many words not to bring one. No size is published.
  { id: 'philippines', label: 'Philippines', group: 'Asia', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm (generic)',
    photographedOnSite: 'For a Philippine passport the DFA says plainly that you do not need to bring a passport-sized photo — the Consular Office captures your photo and biometrics at the appointment. Use this for a visa or another document that does ask for a supplied photo.',
    headCaveat: 'The DFA publishes no photo specification, because it does not ask for a supplied photo. The 35×45 mm shown here is the generic international size, not a Philippine rule.' },
  // Indonesia: the photo is taken at the immigration office during the interview,
  // alongside fingerprints. The background there is white — which is why the
  // office tells you NOT to wear white clothing.
  { id: 'indonesia', label: 'Indonesia', group: 'Asia', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm (generic)',
    photographedOnSite: 'For an Indonesian passport your face is photographed at the immigration office, during the interview and fingerprinting — you do not supply one. Use this for a visa or another document that does ask for a photo.',
    headCaveat: 'Indonesian immigration publishes how you must look rather than a photo size, because it takes the picture itself. The 35×45 mm shown here is the generic international size.' },
  // Thailand: the MFA captures your picture and fingerprints at the office —
  // and measures your height while you are there. No supplied photo, no spec.
  { id: 'thailand', label: 'Thailand', group: 'Asia', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm (generic)',
    photographedOnSite: 'For a Thai e-passport you must apply in person because your biometric data is captured there — staff photograph you, take your fingerprints and measure your height. Use this for a visa or another document that does ask for a supplied photo.',
    headCaveat: 'Thailand publishes no photo size for the passport, because it takes the picture itself. The 35×45 mm shown here is the generic international size.' },
  { id: 'pakistan', label: 'Pakistan', group: 'Asia', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm' },
  { id: 'bangladesh', label: 'Bangladesh', group: 'Asia', wPx: mm(45), hPx: mm(55), wMM: 45, hMM: 55, headMin: 0.62, headMax: 0.78, bg: WHITE, bgName: 'White', note: '45×55 mm' },
  // Vietnam: confirmed 4×6 cm on a white background by the Ministry of Public
  // Security. Its framing rule is given as a share of AREA and as an eye
  // position, not as a chin-to-crown band, so the band here stays generic.
  { id: 'vietnam', label: 'Vietnam', group: 'Asia', wPx: mm(40), hPx: mm(60), wMM: 40, hMM: 60, headMin: 0.50, headMax: 0.70, bg: WHITE, bgName: 'White', note: '4×6 cm, white background',
    headCaveat: 'Vietnam sizes the face as a share of the photograph’s AREA — about 75% — and separately by where the eyes sit, rather than by a chin-to-crown height. The band shown is the generic one.' },
  // ⚠ Sri Lanka does not accept a printed photograph for a passport AT ALL.
  // Since 10 Aug 2015 the digital photo must come from a Department-authorised
  // studio, which uploads it directly. Nothing you print is usable.
  { id: 'srilanka', label: 'Sri Lanka', group: 'Asia', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm (visa only)',
    photographedOnSite: 'For a Sri Lankan passport a printed photograph is not accepted at all. Since 2015 the digital photo must be taken by a studio authorised by the Department, which uploads it directly and gives you a Studio Acknowledgement Note to hand in. Use this for a visa or another document that does take a supplied photo.',
    headCaveat: 'The Department publishes no size, because the authorised studio supplies the photograph directly. The 35×45 mm shown here is the size its VISA form asks for.' },
  { id: 'nepal', label: 'Nepal', group: 'Asia', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm' },

  // ---- Middle East & Africa ----
  // ⚠ UAE: the ICP's own two documents DISAGREE. Its Personal Photo
  // Specifications sheet says 35–40 mm wide on a "plain light-coloured"
  // background; its FAQ says 3.5×4.5 cm white; and 43×55 is what the visa
  // centres have long asked for. The one thing both ICP documents state is the
  // framing: the face takes up 70–80%. That is fixed here (it was 0.62–0.78);
  // the SIZE is left alone, because changing it on a conflict is how wrong
  // numbers get in. Needs a human to settle — see docs/passport-spec-sources.md.
  { id: 'uae', label: 'UAE visa', group: 'Middle East & Africa', wPx: mm(43), hPx: mm(55), wMM: 43, hMM: 55, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', maxKB: 1024, note: '43×55 mm, white',
    headCaveat: 'The ICP’s own documents disagree on the size: its photo specification sheet says 35–40 mm wide on a plain light-coloured background, while its FAQ says 3.5×4.5 cm on white, and 43×55 mm is what visa centres have long asked for. Both ICP documents agree the face should fill 70–80%, which is what this page uses. Check with whoever is receiving your application before printing.' },
  { id: 'saudi', label: 'Saudi Arabia', group: 'Middle East & Africa', wPx: 600, hPx: 600, wMM: 51, hMM: 51, headMin: 0.55, headMax: 0.75, bg: WHITE, bgName: 'White', note: '2×2 in, white' },
  { id: 'qatar', label: 'Qatar', group: 'Middle East & Africa', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm' },
  // Türkiye: 50×60 mm on plain white CONFIRMED by NVİ. It publishes no head
  // measurement — only that the face is centred and fully visible with the hair.
  { id: 'turkey', label: 'Türkiye', group: 'Middle East & Africa', wPx: 500, hPx: 600, wMM: 50, hMM: 60, headMin: 0.55, headMax: 0.75, bg: WHITE, bgName: 'White, plain, no pattern', note: '50×60 mm — do NOT cut to 35×45',
    headCaveat: 'NVİ publishes no chin-to-crown measurement, only that the face is centred and fully visible together with the hair. The band shown is the generic one.' },
  { id: 'egypt', label: 'Egypt', group: 'Middle East & Africa', wPx: mm(40), hPx: mm(60), wMM: 40, hMM: 60, headMin: 0.50, headMax: 0.70, bg: WHITE, bgName: 'White', note: '4×6 cm' },
  // Nigeria: a hybrid — you upload an "ICAO compliant picture" to the portal AND
  // attend an Immigration Office for biometric capture. No millimetres published.
  { id: 'nigeria', label: 'Nigeria', group: 'Middle East & Africa', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '35×45 mm (generic, ICAO)',
    headCaveat: 'The Nigeria Immigration Service asks for an “ICAO compliant picture” uploaded to its portal and publishes no millimetre size of its own. The figures shown are the generic ICAO ones.' },
  // ⚠ South Africa: the Department of Home Affairs photographic template gives
  // the head as "at least 29mm, no more than 34mm" on a 45 mm photo —
  // 0.644–0.756. Our ceiling of 0.80 sat ABOVE their maximum. And the
  // background is "light grey or plain cream", not the white we shipped.
  { id: 'southafrica', label: 'South Africa', group: 'Middle East & Africa', wPx: mm(35), hPx: mm(45), wMM: 35, hMM: 45, headMin: 29 / 45, headMax: 34 / 45, bg: OFFWHITE, bgName: 'Light grey or plain cream', note: '35×45 mm, head 29–34 mm' },
  // ⚠ Kenya: the Directorate of Immigration Services publishes 5.5×5.5 cm
  // (207×207 px) with the face at 70–80%. We shipped a 2×2 inch square at
  // 0.55–0.75 — the wrong square and the wrong band. Note this guideline is the
  // one issued for VISA registration; the label says so rather than implying it
  // covers the passport route too.
  { id: 'kenya', label: 'Kenya visa', group: 'Middle East & Africa', wPx: 207, hPx: 207, wMM: 55, hMM: 55, headMin: 0.70, headMax: 0.80, bg: WHITE, bgName: 'White', note: '5.5×5.5 cm, 207×207 px' },

  // ---- Oceania ----
  // ⚠ New Zealand's background is NOT white. The DIA asks for a plain,
  // light-coloured background with strong contrast against the face, and its
  // application form says plainly: light, but not white. The digital photo is
  // specified by ASPECT RATIO (3:4) and pixel bounds rather than millimetres.
  { id: 'newzealand', label: 'New Zealand', group: 'Oceania', wPx: 1200, hPx: 1600, wMM: 35, hMM: 45, headMin: 0.70, headMax: 0.80, bg: LIGHTGREY, bgName: 'Plain light colour, NOT white', maxKB: 5120, note: '3:4 digital, 900–4500 × 1200–6000 px, 250 KB–5 MB',
    headCaveat: 'The DIA’s photo page gives the aspect ratio, the pixel bounds and the file size but no chin-to-crown measurement; it asks instead for a clear gap above and beside your head with your shoulders and upper chest in frame. The band shown is the generic one.' },
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
  'brazil', 'argentina', 'colombia', 'singapore', 'malaysia', 'newzealand',
  'south-korea', 'vietnam', 'southafrica', 'turkey', 'kenya',
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
  /** How old the photograph may be. Differs widely and is rarely on the size chart. */
  recency?: string;
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
    exceptions:
      'Polismyndigheten sets out the counter visit step by step, and two details are worth knowing before you go. You must bring a valid PHYSICAL Swedish identity document \u2014 the digital ID card in BankID is not accepted for any form of identification at the police, which surprises people who now carry nothing else. If you have no valid ID at all, you may bring an approved intygsgivare who vouches for your identity and shows their own. At the counter you take a numbered ticket and measure your height, pay the fee, and the case officer takes the photograph and two fingerprints. You are then shown how the finished passport will look and approve the details before signing.',
    recency:
      'Not applicable in the usual sense \u2014 the photograph is taken during the appointment, so it is minutes old. Collection is separate: roughly a week after approval, drop-in with no appointment, at whichever passport office in Sweden you nominated or at a Swedish embassy abroad. That choice cannot be changed once the application is registered.',
    sourceName: 'Polismyndigheten \u2014 Pass och nationellt id-kort, Bes\u00F6k passexpedition',
    sourceUrl: 'https://polisen.se/tjanster-tillstand/pass-och-nationellt-id-kort/besok-passexpedition/',
    checkedOn: '2026-08-29',
  },

  'india-evisa': {
    authority:
      'The e-Visa photograph is checked by the Bureau of Immigration through the government’s own portal at indianvisaonline.gov.in. It is uploaded rather than printed, so the rules are about the file as much as the face.',
    quirk:
      'No spectacles. The portal states the photo must show the face "eyes open and without spectacles" — so unlike a British or Italian photo, you take your glasses off even if you wear them daily. The image must also be a perfect square: "the height and width of the Photo must be equal". A standard 35×45 mm passport photo is the wrong shape and will be rejected on upload.',
    background:
      'Plain light-coloured or white, with no shadow on the face or on the background, and no border around the image.',
    expression:
      'Full face, front view, eyes open. Centre the head in the frame and show the whole head, from the top of the hair to the bottom of the chin.',
    exceptions:
      'JPEG only, between 10 KB and 1 MB. Files outside that range are refused by the upload form rather than by a person, so it is worth checking before you start the application.',
    sourceName: 'Bureau of Immigration — Indian e-Visa portal, photograph specifications',
    sourceUrl: 'https://indianvisaonline.gov.in/evisa/tvoa.html',
    checkedOn: '2026-08-24',
  },

  'india-passport': {
    authority:
      'Indian passports are issued by the Ministry of External Affairs through Passport Seva. How — and whether — you supply a photograph depends entirely on where you apply.',
    quirk:
      'At a Passport Seva Kendra or a Post Office PSK you do not bring a photograph at all: they photograph you at the counter. Printed photos are only for the routes that still ask for them, and there you need two identical colour copies at 3.5 × 4.5 cm on a white background. People routinely pay for photos they never hand over.',
    background:
      'Plain white, with the face clearly identifiable.',
    expression:
      'Front-facing with a neutral expression, the full face visible.',
    exceptions:
      'The clearest published photo specification on the Passport Seva FAQ is the one for the Diplomatic and Official application form, and it is worth reading as the template for any route that still asks for prints: two coloured photographs, 4.5 \u00D7 3.5 cm, white background. The first is affixed to page one of the printed form with no signature or stamp on it. The second goes on page three and is then stamped across, over the photograph, with the office stamp and the signature of the Head of Office \u2014 so it must be pasted before it is stamped, not after.',
    recency:
      'Passport Seva does not publish a maximum age for the photograph the way the UK or Canada do. The operative test is the one applied at the counter: the photograph has to look like the person standing there. Anything old enough to be argued about is worth retaking.',
    children:
      'The same photo specification applies; there is no separate size for children.',
    sourceName: 'Passport Seva, Ministry of External Affairs \u2014 application form FAQ',
    sourceUrl: 'https://www.passportindia.gov.in/psp/FaqApplicationForm',
    checkedOn: '2026-08-29',
  },

  'uk-passport': {
    authority:
      'UK passports are issued by His Majesty\u2019s Passport Office, and the photo rules are published as two separate sets \u2014 one for the digital photo you upload when applying online, one for the printed pair you send with a paper form. They are not interchangeable, and the printed set is the stricter of the two.',
    quirk:
      'The background is the thing people get wrong. HMPO asks for \u201Cplain cream or light grey\u201D \u2014 not white. A white wall is the default assumption everywhere else and it is the wrong answer here, because the standard is contrast against your face and hair rather than brightness for its own sake.',
    background:
      'Printed photos: a plain cream or light grey background, colour, on plain white photographic paper with no border. Digital photos: a plain light-coloured background, in colour, with your face in clear contrast to it and no other objects or people in frame.',
    expression:
      'Face forward, look straight at the camera, neutral expression, mouth closed. Eyes open, visible, and not covered by hair.',
    glasses:
      'Do not wear glasses at all unless you have to. If you must, they cannot be sunglasses or tinted, the frames must not cover your eyes, and there must be no glare on the lenses.',
    headCovering:
      'No head coverings unless worn for religious or medical reasons, and no face coverings in any circumstance. No shadows across the face.',
    children:
      'Children have to appear alone in the picture \u2014 no supporting hands in frame \u2014 and babies cannot hold a toy or use a dummy. Under 6, they do not have to look directly at the camera or hold a plain expression. Under 1, their eyes do not have to be open, and the practical route is to lay the baby on a plain light-coloured sheet and shoot from directly above.',
    exceptions:
      'Printed: two identical photos, 45 mm high by 35 mm wide, with the head measuring between 29 mm and 34 mm from chin to crown, unmarked on both sides unless the application needs countersigning. Digital: at least 600 \u00D7 750 pixels, between 50 KB and 10 MB, and unaltered by computer software.',
    recency:
      'Taken within the last month.',
    sourceName: 'HM Passport Office \u2014 Get a passport photo (photo requirements and digital photos)',
    sourceUrl: 'https://www.gov.uk/photos-for-passports/photo-requirements',
    checkedOn: '2026-08-29',
  },

  canada: {
    authority:
      'Canadian passport photos are set by Immigration, Refugees and Citizenship Canada, and the page opens by warning that they differ from other countries\u2019 \u2014 which is true, and the reason people arrive with a photo that is the wrong shape. There are two separate specifications: printed photos for applications made in person or by mail, and a digital photo used only for online renewals.',
    quirk:
      'Canada rejects edited photos outright, and defines editing more broadly than almost anyone else. Cropping around the head and shoulders counts. Cutting your image out and pasting it onto a white background counts. Adjusting colour, brightness, contrast or sharpness counts, as do filters and AI tools. Use this page and this tool to check a photographer\u2019s photo against the numbers before you submit it \u2014 do not use background removal or retouching on a photo destined for a Canadian passport application.',
    background:
      'Plain white or light-coloured, with a clear difference between your face and the background and no shadows around the ears or behind you. Avoid wearing white clothing, which blends into the background and gets the photo rejected.',
    expression:
      'Neutral: eyes open and clearly visible, looking straight at the camera, mouth closed, neither smiling nor frowning. Face and shoulders centred and squared to the camera, not tilted.',
    glasses:
      'Ordinary glasses are accepted provided the eyes are clearly visible and there is no glare on the lenses. Sunglasses and tinted lenses are refused \u2014 explicitly including tinted prescription lenses, even where the eyes can be seen through them.',
    headCovering:
      'Hats and head coverings are accepted only where worn daily for religious belief or medical reasons, with the full face clearly visible and no shadow cast on it. Medical headwear or a nasal cannula needs a signed letter of explanation, and IRCC may ask for one from your doctor.',
    children:
      'The size rules are identical for children, and two identical photos are required as for adults. Newborns are the one relaxation: they may show a range of facial expressions.',
    exceptions:
      'Printed route: two identical photos, 50 \u00D7 70 mm, head 31\u201336 mm chin to crown, taken by a commercial photographer and professionally printed \u2014 home printing is refused. The photographer writes or stamps the date and the studio\u2019s name and address on the back of one, and where a guarantor is needed they write \u201CI certify this to be a true likeness of (name)\u201D and sign beneath it. Online renewal is a different photo entirely: JPEG, 3:2 portrait, at least 1800 \u00D7 1200 px and at most 4500 \u00D7 3000, between 200 KB and 5 MB, with chin-to-crown at 45\u201350% of the image height \u2014 a noticeably smaller head than the printed spec.',
    recency:
      'Taken no more than six months before the date you submit the application.',
    sourceName: 'Immigration, Refugees and Citizenship Canada \u2014 Passport photo requirements',
    sourceUrl: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports/photos.html',
    checkedOn: '2026-08-29',
  },

  australia: {
    authority:
      'The Australian Passport Office, part of DFAT, sets these rules, and it is one of the few authorities that publishes the size as a range rather than a single rectangle: 35\u201340 mm wide by 45\u201350 mm high, with the face 32\u201336 mm from chin to crown. Two photos are required with every application.',
    quirk:
      'The APO says plainly that it does not recommend online passport photo services or mobile apps, because they \u201Cmay put you in danger of identity fraud\u201D. That is a fair warning about services that upload your face to a server, and it is worth reading carefully rather than ignoring. This page and this tool run entirely inside your browser \u2014 the photo is never uploaded anywhere, and there is no account and no server copy \u2014 so the risk being described does not arise here. The rest of the warning still stands: Australia also refuses retouched images and edited backgrounds, so use this to get the crop and the measurements right and have the photo itself taken and printed properly.',
    background:
      'Plain white or light grey, contrasting with your face, with uniform lighting and no shadows or reflections. The edges of your face must be clearly visible against it.',
    expression:
      'Anyone over three faces the camera straight on, eyes open, neutral expression, head not tilted in any direction and hair not obscuring the edges of the face. Under three, the mouth may be open \u2014 but nobody else may appear in the photo, and a parent\u2019s steadying hand in frame is a rejection.',
    glasses:
      'Do not wear glasses at all unless you cannot remove them for a medical reason. The APO states specifically that vision impairment on its own is not an acceptable reason. Where glasses are unavoidable, the frames must not obscure the eyes and there must be no reflection.',
    headCovering:
      'A religious head covering worn habitually is accepted, but it must be plain \u2014 no patterns, including small ones \u2014 and worn so the entire face from the bottom of the chin to the top of the forehead, and both edges of the face, remain visible.',
    children:
      'Under three, an open mouth is tolerated and a relaxed expression is not held against the child. Everyone else follows the adult rule. In every case the child must be alone in the frame.',
    exceptions:
      'Hearing aids may be worn, by adults and infants alike; wireless earbuds are explicitly not hearing aids and must come out. Jewellery and piercings are allowed only where they obscure no part of the face and throw no reflection. Where a medical condition makes a rule impossible, supply a medical certificate or a completed B\u201111 form. Prints must be dye\u2011sublimation on heavyweight glossy paper of at least 200 gsm \u2014 an inkjet print is refused however good it looks.',
    recency:
      'Less than six months old.',
    sourceName: 'Australian Passport Office \u2014 Passport photos',
    sourceUrl: 'https://www.passports.gov.au/getting-passport-how-it-works/photo-guidelines',
    checkedOn: '2026-08-29',
  },

  brazil: {
    authority:
      'The Brazilian passport is issued by the Polícia Federal, and its document list makes the photograph part of the appointment rather than part of the paperwork. You book a slot, attend in person, and your face is captured there. A printed photograph appears on the list exactly once, for applicants under five years old.',
    quirk:
      'That one exception is the whole story for Brazil. A child under five must bring a recent 5×7 cm print on a white background — and must still attend the appointment in person anyway, because the print does not replace being there. Everyone five and over brings nothing: turning up with photographs is a wasted trip to the photo shop, not a rejected application.',
    background:
      'White, for the under-five print. The Polícia Federal states the background and the size and leaves it there — there is no published head measurement, because the subject is an infant.',
    expression:
      'A photograph with the eyes closed is refused, with one exception: a newborn. For every other age the eyes must be open.',
    children:
      'The face may not be covered, even partly, by accessories, trinkets or ornaments — the list names hair clips and bows. A photograph is also refused if enough time has passed that the image no longer identifies the child, which for a small child can be a matter of months rather than years.',
    recency:
      'Recent, with no fixed window given. Brazil replaces the usual “not older than six months” with a test of whether the child still looks like the picture.',
    sourceName: 'Polícia Federal — Documentação necessária (Fotografia 5x7)',
    sourceUrl: 'https://www.gov.br/pf/pt-br/assuntos/passaporte/documentacao/lista-brasileiro',
    checkedOn: '2026-11-19',
  },

  mexico: {
    authority:
      'Mexican passports are issued by the Secretaría de Relaciones Exteriores. Its published requirements run to five numbered items, and the fifth is to allow your biometrics to be taken: photograph, fingerprints, iris scan and signature. The photograph is taken there, with the SRE’s own equipment, which is why no size, resolution or file format is published anywhere.',
    quirk:
      'So Mexico is a country where getting the photo right means arriving looking right, not printing something correctly. The rules describe you rather than the picture, and two of them catch people out on the day: take your glasses off, and uncover your head. Both are absolute in the text — glasses are named, not merely discouraged.',
    glasses:
      'The photograph is taken without glasses. The SRE states it flatly, with no reflection or frame-thickness carve-out to work around, so remove them before you sit down.',
    headCovering:
      'The head must be completely uncovered, facing forward, with nothing covering the face.',
    background:
      'White, where a photograph is supplied — the regulation describes the picture the SRE takes as front-facing, in colour, on a white background, with the head uncovered.',
    children:
      'Minors follow the same route: an appointment through Mexitel, the same documents, and the same capture on the day.',
    exceptions:
      'There is no published exceptions list, because there is no supplied photograph to make exceptions about. Anything you cannot comply with is a conversation with the officer at the counter.',
    sourceName: 'Secretaría de Relaciones Exteriores — Trámite de Pasaporte',
    sourceUrl: 'https://www.gob.mx/sre/acciones-y-programas/tramite-de-pasaporte-8014',
    checkedOn: '2026-11-19',
  },

  argentina: {
    authority:
      'Argentina writes its photo rule into law rather than a guidance page: article 30 of Decreto 749/2019 governs the image that goes into the passport and into RENAPER’s records. That makes it unusually precise and unusually brief — one paragraph covering size, framing, background and what may not be altered.',
    quirk:
      'The framing is the part worth knowing. The decree asks for “medio busto” — head and upper chest — on a 4×4 cm square, which is looser than the tight chin-to-crown crop most countries specify. Crop as hard as you would for a European 35×45 photo and you have gone past what Argentina describes.',
    background:
      'Uniform white and plain. The decree says fondo uniforme blanco y liso, and gives no alternative shade.',
    expression:
      'Current, facing forward, in colour, with the head entirely uncovered, and showing the face fully and faithfully. The eyes must be open in every case, and no third party’s hands may be visible holding the subject — a rule aimed squarely at photographs of babies.',
    headCovering:
      'The head must be uncovered, with two exceptions in article 31. Hair may be covered for religious reasons or because of medical treatment, provided the main features of the face stay visible. And where religion means the face is partly or wholly covered, you may ask for the whole appointment and the photograph to be taken in a private room by staff of the same sex.',
    exceptions:
      'Article 30 also forbids altering or falsifying facial characteristics — while saying in the same sentence that this must not infringe the right to identity in its gender, cultural or religious aspects. Retouching a face is out; being yourself is not.',
    sourceName: 'Decreto 749/2019, arts. 30–31 (RENAPER)',
    sourceUrl: 'https://www.argentina.gob.ar/normativa/nacional/decreto-749-2019-330996/texto',
    checkedOn: '2026-11-19',
  },

  chile: {
    authority:
      'The Chilean passport is issued by the Servicio de Registro Civil e Identificación, and its official service page is unusually short. You book an appointment online with your ClaveÚnica, you attend the office you booked, and the list of what to bring has one item on it.',
    quirk:
      'That item is your cédula de identidad, valid and in good condition. There is no photograph on the list, no size, no background colour and no file format — the picture is part of what happens at the counter. If you have no cédula you give your RUN and apply for both documents together. The 35×45 mm shown on this page is the generic international size, kept because people do need Chilean-sized photos for visas and other paperwork, and it is not a rule the Registro Civil publishes.',
    children:
      'Under-14s are booked differently: the same site, but the “Menores de edad” option, and one appointment per child. There are separate requirements for collecting a child’s passport afterwards.',
    exceptions:
      'None are published, for the same reason there are no photo rules — nothing is supplied. Anything unusual is handled at the appointment.',
    recency:
      'Not applicable to a supplied photo. The passport itself runs for ten years, which is the longest gap between pictures of any of the countries on this list.',
    sourceName: 'ChileAtiende / Registro Civil — Pasaporte',
    sourceUrl: 'https://www.chileatiende.gob.cl/fichas/3445-pasaporte',
    checkedOn: '2026-11-19',
  },

  singapore: {
    authority:
      'The Immigration & Checkpoints Authority sets the rules, and unusually for this list it publishes them in two places that do not quite agree in tone: a guidelines page for the online upload, and the passport application form itself for the printed photograph. The form is the stricter document and the one worth reading, because it carries the measurement everyone gets wrong.',
    quirk:
      'That measurement is the face: between 25 mm and 35 mm from chin to crown on a 45 mm photo. That is a notably smaller head than the 70–80% most of Europe asks for, and cropping a Singapore photo to European proportions overshoots the maximum. Both edges of your face and the top of your shoulders have to be visible, which is the same rule stated from the other direction — crop in far enough to lose your shoulders and the photo is wrong.',
    background:
      'Plain white, with one exception that is easy to miss: if your hair is white, the background must be light grey instead. Printed photos need a matte or semi-matte, non-reflective finish.',
    expression:
      'Full face, looking straight at the camera, head straight, eyes open, mouth closed, neutral expression, and no hair across or covering the eyes.',
    glasses:
      'Glasses are allowed as long as the frames cover no part of your eyes and there is no flash or reflection off the lenses. Tinted glasses and sunglasses are refused outright.',
    headCovering:
      'Only headgear habitually worn for religious or racial custom is permitted — and ICA adds a condition almost nobody else does: it must not be white.',
    exceptions:
      'ICA permits resizing a digital photo with image editing software and forbids altering it in any other way, naming photo filters and changes to facial features. Cropping and resizing to the stated dimensions is the sanctioned use; retouching is not. It also warns that phone selfies usually fail its requirements and will delay the application, and recommends asking someone else to take the picture.',
    recency:
      'Taken within the last three months — shorter than the six months most countries allow.',
    sourceName: 'ICA — Photo Guidelines and the passport application form (IMM(E)11)',
    sourceUrl: 'https://www.ica.gov.sg/photo-guidelines',
    checkedOn: '2026-11-19',
  },

  malaysia: {
    authority:
      'The Immigration Department of Malaysia publishes a photo specification that is more precise than most, and precise in an unusual way: alongside the size and the head height it gives you the margins. That makes it one of the few countries where you can check a photo with a ruler and know before you submit it.',
    quirk:
      'The numbers are 35 mm wide by 50 mm high, with the head 30 to 35 mm from chin to crown, about 5 mm of space above the head and 5 to 10 mm below the chin. The 50 mm height is the thing to watch — Malaysia is taller than the 45 mm used across Europe and Asia, so a photo cut to a generic 35×45 is the wrong shape here, not merely the wrong crop.',
    background:
      'Plain white, with no border or frame around the photo. Plain blue appears as an accepted alternative for one category of application, which is where the idea that Malaysia wants a blue background comes from — white is what the department publishes for the rest.',
    expression:
      'Full face, front view, eyes open, neutral expression. The image must be sharp and correctly framed: not blurred, not tilted, not taken too far away and not too small.',
    headCovering:
      'No head covering, except where worn for religious reasons, and then only if the face remains fully visible.',
    exceptions:
      'Uploads to the department’s online service are capped at 25 KB, which is small enough that a photo straight from a phone will not fit and has to be resized properly rather than merely compressed until it passes. The department also offers its own photo check tool to verify an image before you submit it.',
    sourceName: 'Immigration Department of Malaysia — Passport Photo Requirements',
    sourceUrl: 'https://esd.imi.gov.my/portal/photo-requirements/',
    checkedOn: '2026-11-19',
  },

  philippines: {
    authority:
      'The Department of Foreign Affairs issues the Philippine passport, and its Office of Consular Affairs answers the photo question directly in its FAQ: no, you do not need to bring a passport-sized photo. The Consular Office captures your photo and biometrics when you attend.',
    quirk:
      'So there is no Philippine photo specification to match, and the 35×45 mm on this page is the generic international size rather than a rule the DFA publishes. What matters instead is getting to the appointment. Applications are by appointment, booked free of charge through the DFA — and the department warns openly about people selling earlier slots, saying that dealing with fixers is at your own risk and expense. Appointments cost nothing; anyone charging you for one is not the DFA.',
    children:
      'Minors aged seven and below may walk in without an appointment, as may senior citizens and persons with disability, on proof of special lane eligibility. A court-appointed guardian may accompany a minor whose parents are absent or deemed unsuitable.',
    exceptions:
      'Escorts are not allowed inside Consular Offices at all, unless the applicant is a senior citizen, a minor or a person with a disability — so plan to attend alone. Documents do not need to be in an envelope, and a renewed passport is handed back to you along with the old one.',
    recency:
      'Not applicable to a supplied photo. Regular processing runs about ten working days in the National Capital Region and twelve outside it.',
    sourceName: 'DFA Office of Consular Affairs — Passport FAQs',
    sourceUrl: 'https://consular.dfa.gov.ph/passport-faq/',
    checkedOn: '2026-11-19',
  },

  newzealand: {
    authority:
      'New Zealand passports are issued by the Department of Internal Affairs, and its photo page is written for someone holding a phone rather than someone standing in a photo booth. It specifies the digital file — 3:4 aspect ratio, JPEG, 250 KB to 5 MB, 900–4500 pixels wide and 1200–6000 high — and gives no millimetre measurement at all for the head.',
    quirk:
      'The background is the thing to get right, and it is the opposite of what most people assume: plain and light-coloured, with strong contrast against your face, and the application form says in as many words that it must not be white. There must be no shadow and nothing behind your head, which is why the DIA tells you to stand at least half a metre in front of the wall rather than against it.',
    background:
      'Plain and light-coloured, not white, with a strong contrast between it and your face. No shadows and no objects behind your head. Stand at least half a metre clear of it.',
    expression:
      'Neutral, no smiling, mouth closed, eyes open, face fully visible and neither tilted nor turned. Hair out of your eyes and away from your face. Your head is centred with a clear gap above and beside it, and your shoulders and upper chest are in the frame.',
    glasses:
      'Prescription glasses are allowed if they are neither tinted nor thick-framed, with a clear gap between your eyes and the frames and no glare on the lenses. Sunglasses are refused.',
    headCovering:
      'Hats, hoods and headbands come off. A head covering is allowed only for religious or medical reasons, and then your face must be fully visible.',
    children:
      'Babies are photographed lying down: put the child on a plain, light-coloured sheet and shoot from directly above, showing the whole face with the eyes open and nobody and nothing else in the frame.',
    exceptions:
      'Selfies are rejected outright, and so is any edited image — the DIA names filters and AI tools specifically and asks for your natural appearance. It wants the photographer 1.5 m away holding the camera at your eye level, because a photo taken too close enlarges the nose and forehead and hides the ears. A scan of a printed photo is not accepted either; the file has to be the original digital one.',
    recency:
      'Less than six months old.',
    sourceName: 'Department of Internal Affairs — Passport photos',
    sourceUrl: 'https://www.passports.govt.nz/passport-photos',
    checkedOn: '2026-11-19',
  },

  indonesia: {
    authority:
      'Indonesian passports are issued by the Directorate General of Immigration, and the photograph is taken at the immigration office itself — you are called up by queue number for the interview, the face photograph and the fingerprints together. So the rules Indonesian immigration publishes are about how you turn up, not about a file you bring.',
    quirk:
      'The most useful of them is about your clothes. The passport photo background there is white, so the office asks you not to wear white — wear something that contrasts with it, and formal rather than casual, because this picture becomes your identity document abroad. It is a small thing that nobody thinks about until they are sitting in front of the camera in a white shirt.',
    background:
      'White, applied by the office. Your clothing is what has to contrast with it.',
    expression:
      'Sit upright, face the camera, neutral expression, face clearly visible so the officer can match the photo against the holder.',
    glasses:
      'Glasses are not worn for the photograph. Nor are hats, masks or any accessory that covers the face — and nor are contact lenses, even natural-coloured ones, because immigration treats them as altering the profile of the eye. That last rule is close to unique on this list and is easy to overlook if you wear lenses daily.',
    headCovering:
      'A hijab may be worn, provided it does not cover the face — the forehead, the eyebrows and the chin all have to stay visible.',
    exceptions:
      'Original documents must be brought with A4 photocopies that are not cut off at the edges, and the interviewing officer may suspend the process if anything about the identity does not check out.',
    sourceName: 'Direktorat Jenderal Imigrasi — Kantor Imigrasi Karawang',
    sourceUrl: 'https://karawang.imigrasi.go.id/fakta-penting-yang-harus-kamu-ketahui-saat-foto-paspor-di-kantor-imigrasi/',
    checkedOn: '2026-11-19',
  },

  colombia: {
    authority:
      'Colombia puts its photo rule in a resolution rather than a help page: Resolución 10829 de 2024 of the Ministerio de Relaciones Exteriores. Parágrafo 4º lists what the photograph must meet, and says the list is the ICAO minimum rather than the whole of it — so treat these as the floor, not the ceiling.',
    quirk:
      'The size is the thing to get right, and it is not the one most people assume. Colombia asks for four by five centimetres — 40×50 mm — which is neither the European 35×45 nor the American two-inch square. A photo cut to 35×45 is the wrong shape here, not merely the wrong crop, and it is the single most common mistake because almost every neighbouring country uses something else. For an online application the photograph is digitised during the application itself.',
    background:
      'White. The resolution says fondo blanco and offers no alternative.',
    expression:
      'Frontal pose, looking directly into the camera, with a neutral expression, and the face in the foreground.',
    glasses:
      'Glasses may be worn, but the photograph has to show the eyes clearly with no light reflecting off the lenses.',
    headCovering:
      'No accessory or facial ornament that hides the face is permitted.',
    recency:
      'Taken no more than six months before the application.',
    sourceName: 'Resolución 10829 de 2024, parágrafo 4º — Ministerio de Relaciones Exteriores',
    sourceUrl: 'https://www.cancilleria.gov.co/normograma/compilacion/docs/resolucion_minrelaciones_10829_2024.htm',
    checkedOn: '2026-11-20',
  },

  'south-korea': {
    authority:
      'The Ministry of Foreign Affairs publishes one of the most detailed photo standards anywhere — thirteen numbered sections covering everything from the shoulder line to what an infant may do with its mouth. It is worth reading in full if you are applying, because several of its rules appear on no other country’s list.',
    quirk:
      'Two stand out. **Both ears must be visible**, so that the outline of the face is clear — a fringe over the eyebrows or hair over the ears is a rejection, and the only exception is for someone whose ears genuinely do not show from the front. And **you may not wear white**: uniforms, military dress and white clothing are all refused, because white disappears into the white background. School uniforms, oddly, are fine for students.',
    background:
      'A uniform white background with nothing behind you, no border, no objects in shot, no outdoor settings, and no shadows or reflections.',
    expression:
      'As natural an expression as possible, mouth closed naturally, facing straight ahead with the head not tilted. Only the upper body to the shoulders is in frame, and the shoulder line should be horizontal.',
    glasses:
      'No tinted glasses. Thick horn-rimmed frames are discouraged outright — MOFA says they can be mistaken for a disguise and cause trouble at immigration. No reflections off the lenses, and the frames must not cover the eyes. Coloured contact lenses are refused, as is red-eye from the flash; an eye patch is allowed only for someone who always wears one or has an eye condition.',
    headCovering:
      'No hats and no scarves. Head coverings for religious or medical reasons are allowed if the whole face from forehead to chin is exposed, and the same goes for religious dress, which must be something worn every day rather than put on for the photograph. Wigs are allowed only for people who always wear one.',
    children:
      'Under sevens follow the adult rules, with the head measured at 2.3–3.6 cm instead. The child must be alone — no chairs, toys or parents in shot — with eyes open and looking forward. Under threes may show a little tooth if they cannot keep their mouth closed, and a newborn who cannot sit up may be photographed lying on a white blanket.',
    exceptions:
      'Copied photographs and anything retouched in Photoshop are refused, and the print itself must be on proper photographic paper — not creased, not damaged, not a low-quality or uneven surface.',
    recency:
      'Taken within the last six months.',
    sourceName: 'Ministry of Foreign Affairs — 신규 여권사진 표준규격 안내 (30 Dec 2024)',
    sourceUrl: 'https://www.mofa.go.kr/cn-xian-ko/brd/m_753/view.do?seq=1035220&page=1',
    checkedOn: '2026-11-20',
  },

  thailand: {
    authority:
      'Thai e-passports are issued by the Ministry of Foreign Affairs, and the photograph is not something you bring. The Ministry sets out the application as three steps, and the second is simply biodata capture: an authorised member of staff photographs you and scans your fingerprints, right and left index fingers twice each.',
    quirk:
      'They also measure your height. It is the only passport process on this list that records how tall you are, and it happens at the same counter as the photograph. The consequence for anyone looking for a photo size is that there is not one — you must apply in person precisely because the biometric data has to go into the chip, so there is nothing to print and nothing to match.',
    background:
      'Applied by the office. Nothing is supplied.',
    expression:
      'Directed by the member of staff taking the picture.',
    exceptions:
      'What you do need to bring is your Thai Citizenship ID card carrying the 13-digit personal number. Without that number, bring your house registration together with other official documents instead. You take a queue number and fill in your name in English along with your date and place of birth before being called.',
    recency:
      'Not applicable to a supplied photo. Outside Bangkok the finished passport can be sent by EMS, which takes five to seven working days.',
    children:
      'The same rule applies — the applicant attends in person, whatever their age, because the biometrics have to be captured from the person themselves.',
    sourceName: 'Ministry of Foreign Affairs, Kingdom of Thailand — Electronic Passport',
    sourceUrl: 'https://www.mfa.go.th/en/publicservice/5d5bcc3415e39c306000a69e',
    checkedOn: '2026-11-20',
  },

  vietnam: {
    authority:
      'Vietnamese passports are issued by the Ministry of Public Security, and its own guidance for applying through the national public service portal states the photograph plainly: a 4×6 cm portrait on a white background, uploaded with the front and back of your citizen identity card.',
    quirk:
      'The 4×6 centimetre size is the thing to get right. It is taller and wider than the 35×45 mm used across most of Asia and Europe, so a photo cut to the usual size is the wrong shape here rather than a slightly wrong crop — and 4×6 is a standard Vietnamese photo-shop size, so asking for it by name gets you the right thing.',
    background:
      'White. The Ministry states fence-plain white and offers no alternative.',
    expression:
      'Face square to the camera, head bare, looking straight ahead.',
    children:
      'A child under nine travelling on a parent’s passport is photographed at 3×4 cm rather than 4×6.',
    exceptions:
      'The whole application can be done through the national public service portal: you upload the photograph and your identity card, pay online once immigration has accepted the file, and choose whether to collect the passport or have it posted to you. If your current passport is still valid you have to hand it in — in person or by post — to the immigration office handling the application.',
    recency:
      'Newly taken, within six months of the application.',
    sourceName: 'Bộ Công an — guidance for passport applications on the national public service portal',
    sourceUrl: 'https://bocongan.gov.vn/bai-viet/huong-dan-dang-ky-ho-so-de-nghi-cap-ho-chieu-pho-thong-tren-cong-dich-vu-cong-quoc-gia-d3-t797',
    checkedOn: '2026-11-20',
  },

  southafrica: {
    authority:
      'The Department of Home Affairs publishes a photographic template rather than a list, with the measurements drawn onto the picture: 35 mm wide, 45 mm high, and the head between 29 mm and 34 mm. The same template covers passports and ID documents, which is why it mentions black and white photographs at all — those are allowed for IDs, never for a passport.',
    quirk:
      'Two things catch people out. The background is **light grey or plain cream**, not white — and a white background is the single most common thing people turn up with. And the photographs must be **no more than one month old**, which is the shortest window of any country on this list; most allow six months. A photo that was fine for something else in the spring is not fine for this in the summer.',
    background:
      'Light grey or plain cream, with a strong definition between your face and the background behind it, lit evenly and with no shadows or flash reflections.',
    expression:
      'Looking directly at the camera with a neutral expression and your mouth closed — no obvious grinning, frowning or raised eyebrows. Square on to the camera rather than over one shoulder, head not tilted, both edges of the face clearly shown, no hair across your face.',
    glasses:
      'No dark-tinted lenses and no heavy frames, no flash reflecting off the lenses, and the frames must not cover any part of your eyes.',
    headCovering:
      'Not permitted except for religious reasons, and then your features from the bottom of the chin to the top of the forehead, and both edges of your face, must be clearly shown.',
    exceptions:
      'Two identical colour photographs are needed for a passport. They have to be printed professionally — the Department says in as many words that photographs printed at home are not likely to be of acceptable quality — on high-quality photo paper, with no ink marks, creases or damage.',
    recency:
      'Not more than one month old.',
    sourceName: 'Department of Home Affairs — Passport & ID Photograph Specifications',
    sourceUrl: 'https://www.dirco.gov.za/uk/wp-content/uploads/sites/5/2024/04/Passport_Photo_Requirements.pdf',
    checkedOn: '2026-11-20',
  },

  turkey: {
    authority:
      'Türkiye’s photo rule comes from the Directorate General of Civil Registration and Nationality (NVİ), and it is the most emphatic on this list about one thing: the size. Fifty millimetres by sixty, on a plain white background with no pattern, no shadows behind you, taken within the last six months.',
    quirk:
      'NVİ spells out what happens if you get it wrong, which almost nobody else does. Bring a photo at a different size or on a different background and either the application cannot be completed, or it goes through and the card is then cancelled at quality control — and you start again. It goes further and tells you what to say to the photographer: **remind them not to cut your biometric photos to 35×45 mm.** That is the default on every photo-shop guillotine in Europe, and it is the single most likely way a Turkish application fails.',
    background:
      'Plain white with no pattern and no shadows falling on it.',
    expression:
      'The face centred and fully visible together with the hair, eyes open and clearly visible with hair not covering them, looking straight into the camera. Even lighting with no reflections or shadows, no red-eye, good contrast and sharp detail. No stains or creases on the print, and colours neutral and true to the face.',
    glasses:
      'The eyes must be clearly visible with no reflection on the lenses. No tinted lenses and no sunglasses. The rim or frame must not cover the eyes or be thick enough to.',
    headCovering:
      'No hat, cap, pipe or similar object, apart from glasses and comparable items worn out of necessity. In a photograph with a headscarf the face must be visible from the tip of the chin up to the forehead, with no shadows across it.',
    children:
      'A small child’s photograph must contain no other people and no objects.',
    exceptions:
      'Any photographer can take a biometric photograph — NVİ says so explicitly, so there is no approved-studio list to track down.',
    recency:
      'Taken within the last six months.',
    sourceName: 'Nüfus ve Vatandaşlık İşleri Genel Müdürlüğü — Biyometrik Fotoğraf Özellikleri',
    sourceUrl: 'https://www.nvi.gov.tr/istanbul/biyometrik-fotograf-nasil-olmalidir',
    checkedOn: '2026-11-20',
  },

  srilanka: {
    authority:
      'The Department of Immigration and Emigration changed how Sri Lankan passport photographs work in August 2015, and the change is more interesting than any measurement: **printed photographs are no longer accepted at all.**',
    quirk:
      'The digital photograph has to come from a studio authorised by the Department — there are authorised studios island-wide, plus the Head Office and the regional offices in Kandy, Matara, Vavuniya, Kurunegala and Jaffna. The studio uploads your photograph straight into the Department’s system and hands you a Studio Acknowledgement Note, and it is that note, not a photograph, that you submit with your application. So for a Sri Lankan passport there is nothing to print and nothing to crop. This tool is useful to you for a visa or for other paperwork, and honestly not for the passport itself.',
    background:
      'Set by the authorised studio.',
    children:
      'Children need their own digital photograph from an authorised studio too, and can no longer be included on a parent’s passport — every child is issued a separate one.',
    exceptions:
      'Fingerprints are collected in person at the Head Office or a regional office from applicants aged 16 to 60. Applications submitted through a Sri Lankan diplomatic mission overseas are the exception to all of this: they can be made without fingerprints and without the digital photograph.',
    recency:
      'Only photographs taken within six months are valid.',
    sourceName: 'Department of Immigration and Emigration — General Information on Passports',
    sourceUrl: 'https://www.immigration.gov.lk/pages_e.php?id=7',
    checkedOn: '2026-11-20',
  },

  kenya: {
    authority:
      'The Directorate of Immigration Services publishes its photo requirements on the eCitizen portal, and the specification there is for registration on a Kenyan visa application. It is unusually precise about the file as well as the print: 5.5 cm by 5.5 cm, or 207 by 207 pixels.',
    quirk:
      'A square, but not the square most people reach for. Kenya’s 5.5 cm is larger than the 2×2 inch (about 5.1 cm) used by the United States and India, so an American-sized photo is close enough to look right and small enough to be refused. The face should fill 70–80% of it.',
    background:
      'White, with the photograph in colour, showing your skin tone naturally and with appropriate brightness and contrast.',
    expression:
      'A close-up of your head and the top of your shoulders, in sharp focus, looking directly at the camera.',
    headCovering:
      'To be taken without headgear, and without a hat or cap. Headgear worn on religious grounds may be considered case by case, provided the main characteristics of the face are apparent — the chin, nose, eyes and eyebrows uncovered, and the forehead uncovered far enough that the shape of the face is clear.',
    exceptions:
      'Your hair must be tucked behind your ears. The photograph must carry no ink marks, no creases and no staple marks — and scanned images and colour photocopies are explicitly refused, so a copy of a photograph you already have will not do.',
    recency:
      'Not more than six months old.',
    sourceName: 'Directorate of Immigration Services — Photo requirements and guidelines (eCitizen)',
    sourceUrl: 'https://immigration.ecitizen.go.ke/index.php?id=9',
    checkedOn: '2026-11-20',
  },

  nigeria: {
    authority:
      'The Nigeria Immigration Service runs its passport process as a portal application followed by an office visit, and the photograph belongs to the first half. You verify your NIN, pick a processing centre and a booklet size, and upload what the Service calls an “ICAO compliant picture”.',
    quirk:
      'Then you attend. The Service’s own instruction is plain — applicants are required to appear at the chosen Immigration Office for biometric data capture — so Nigeria is a hybrid: the photograph is supplied by you, the biometrics are taken there. The practical consequence is that the Service never publishes a size in millimetres; it points at the ICAO standard and leaves it there, which is why the figures on this page are the generic ones rather than a Nigerian rule.',
    background:
      'White, per the Service’s image compliance check on its application portal.',
    expression:
      'The ICAO standard: facing the camera, face centred, eyes open and clearly visible.',
    children:
      'Relaxed rules apply to children under five, though the child still needs to look at the camera with the face centred.',
    exceptions:
      'The portal has an image compliance checker you can run against your photograph before submitting it, which is worth using given that the written specification is a pointer to a standard rather than a list of numbers. Booklets come in 32 and 64 pages, chosen during the application, and payment and the biometric appointment are booked at the end of it.',
    sourceName: 'Nigeria Immigration Service — How to Apply for Standard Passport',
    sourceUrl: 'https://immigration.gov.ng/info-center/how-to-apply-for-standard-passport/',
    checkedOn: '2026-11-20',
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
