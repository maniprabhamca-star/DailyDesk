# Passport / ID photo spec sources

Sourcing pass for `frontend/lib/passport-specs.ts` (2026-07-14). Specs in
`VERIFIED_SPECS` have their size, head-height and background checked against an
official or widely-cited source below. The tool shows **"✓ Spec checked against an
official source"** for these, and **"Standard ICAO spec — double-check your portal"**
for the rest. Nothing here guarantees acceptance — every office is strict its own way.

## Verified

| Spec | Size | Head | Background | Digital cap | Source |
|---|---|---|---|---|---|
| **US visa (DS-160)** | 2×2 in (600–1200 px) | 50–69% | White | ≤240 KB | [Passlens US visa](https://passlens.com/blog/us-visa-photo-guide), US State Dept |
| **US passport** | 2×2 in | 50–69% | White | — | US State Dept |
| **UK passport** | 35×45 mm (≥600×750 px) | 29–34 mm (≈70–80%) | **Light grey / cream — not white** | 50 KB–10 MB | [GOV.UK photo rules](https://www.passport.service.gov.uk/help/photo-rules) |
| **Schengen visa** | 35×45 mm | 32–36 mm (70–80%) | Light grey / off-white | — | [AXA Schengen photo](https://www.axa-schengen.com/en/visa/requirements/documents/photo-requirements), [schengenvisainfo](https://schengenvisainfo.com/photo/) |
| **Canada passport/PR** | 50×70 mm | 31–36 mm | White / light | — | [Canada.ca passport photos](https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports/photos.html) |
| **India passport (Seva)** | 630×810 px | 70–80% | White | ≤250 KB | [Passport Seva upload instructions](https://simplevisa.com/file-specs-for-evisa-uploads-photos-pdfs-and-size-limits-explained/) |
| **India e-Visa** | 350–1000 px sq | — | White | ≤1 MB | India e-Visa portal |
| **China visa** | 33×48 mm (354×472 px) | 60–72% | White | ≤1 MB | China visa application (widely cited) |
| **Australia / Japan / Ireland + Schengen states** | 35×45 mm | 70–80% | White / off-white / light grey | — | Standard ICAO 35×45; individual national guides |

Schengen member specs (Germany, France, Italy, Spain, Netherlands, Portugal, Belgium,
Switzerland, Austria, Sweden, Norway, Poland, Greece) share the verified Schengen
35×45 / light-neutral spec.

## Standard (not individually verified — flagged in the UI)
Brazil, Mexico, Argentina, Chile, Colombia, South Korea, Singapore, Malaysia (blue bg),
Philippines, Indonesia, Thailand, Pakistan, Bangladesh, Vietnam, Sri Lanka, Nepal, UAE,
Saudi Arabia, Qatar, Türkiye, Egypt, Nigeria, South Africa, Kenya, New Zealand. These use
each country's commonly-published dimensions; verify head-size %, background and file caps
against the official portal before submitting. **TODO:** deepen sourcing for these over time.

## 2026-08-23 — re-sourcing pass planned

Google Search Console flags five `/passport-photo/*` URLs as duplicates. The cause
is measured content similarity, not missing canonicals — full analysis, priority
tiers, the per-country fields to write and the acceptance criteria are in
**[designs/passport-photo-editorial-scope.md](designs/passport-photo-editorial-scope.md)**.

Two rules that change how this table gets filled in from here:

1. **One official government source per country.** Two rows above cite aggregators
   (Passlens for the US visa, AXA/schengenvisainfo for Schengen, simplevisa for
   India Seva). They are fine for *finding* a rule and unacceptable as the citation.
   Replace each with the issuing authority's own page as that country is rewritten.
2. **Record the full URL and the date checked.** A spec moves into `VERIFIED_SPECS`
   only once someone has opened the page — not because the number looks familiar.

### Editorial sources (Tier 2 pass)

| Country | Source | Read on | Notes |
|---|---|---|---|
| **Germany** | [BMI — *Fotomustertafel: Qualitätsmerkmale biometrischer Fotos für Dokumente*](https://www.bmi.bund.de/SharedDocs/downloads/DE/publikationen/themen/moderne-verwaltung/BMI24037-fotomustertafel.html), **Stand Juli 2025**, Artikelnummer BMI24037 | 2026-08-23 | Text extracted from the official PDF. Confirms face = **70–80% of photo height** (50–80% for children; smaller deviations under 10, further exceptions under 6); background single-colour, shadow-free, must contrast with **hair as well as face**; head coverings religious reasons only; neutral expression, mouth closed; glasses allowed but frames must not cover the eyes and lenses must not be dark or reflecting; exceptions only for long-term medical reasons. Underlying standard: **BSI TR-03121**. The 35×45 mm dimension is set by the Passverordnung, not this chart. |

| **France** | [service-public.gouv.fr — *Quelle photo fournir pour un titre d'identité ?*](https://www.service-public.gouv.fr/particuliers/vosdroits/F10619) | 2026-08-23 | 35×45 mm; face 32–36 mm **from chin to top of skull, excluding hair**; background light blue or light grey — **white is explicitly prohibited**; head must be **bare** (medical exceptions only — note this differs from Germany, which permits religious head coverings); ears visible; neutral expression, mouth closed; photo **under 6 months old**, "nette, sans pliure, ni traces"; glasses allowed but frames not thick and lenses not tinted or reflecting. |
| **Italy** | [Ministero degli Affari Esteri (Ambasciata d'Italia) — *Fototessera: norme ICAO*](https://ambvienna.esteri.it/it/servizi-consolari-e-visti/servizi-per-il-cittadino-italiano/passaporti/norme-icao/) | 2026-08-23 | 35×45 mm; **not more than 6 months old**; face 70–80% of the photo; neutral expression, mouth closed, fully frontal (half-profile invalid); glasses with clear lenses only, no flash reflection, no heavy frames covering the eye; head covering for religious reasons only with chin-to-forehead and both sides of the face visible; babies' photos must not show any part of the person holding them. The Polizia di Stato's own PDF is a scanned image with no text layer, so the Farnesina consular page was used instead — both are official. |

| **Netherlands** | [RvIG — *Fotomatrix model 2020*](https://www.rvig.nl/fotomatrix) (text extracted from the official PDF) | 2026-08-23 | 35×45 mm; **face height chin-to-crown 26–30 mm from age 11** (19–30 mm to age 10) and **face width 16–20 mm ear-attachment to ear-attachment** — the only country we cover that measures width; background grey, light blue **or** white, even and single-coloured; photo ≤6 months old, ≥400 dpi on smooth photo paper, unedited, not a copy; glasses with fully transparent lenses, no reflection or shadow; head uncovered except on religious/philosophical grounds; neutral gaze, mouth closed, head untilted, shoulders square; under-6s exempt from posture/expression rules but no visible support in frame. |

### ✅ SPEC CORRECTIONS APPLIED 2026-08-23

Two `schengen()` presets were wrong. Both would have produced a refused photo.

| Country | Field | Was | Now | Source |
|---|---|---|---|---|
| **Netherlands** | head height | 70–80% (31.5–36 mm) | **57.8–66.7%** (26–30 mm) | Fotomatrix 2020 |
| **Netherlands** | background | Light grey | **Grey, light blue or white** | Fotomatrix 2020 |
| **Spain** | background | Light grey | **White** | MAEC photo sheet |

### Head-range audit, 2026-08-23 — the generic 70–80% is wrong about half the time

Every Schengen preset checked against its own authority. **Five of the nine
verified disagreed with the shared `schengen()` row.**

| Country | Official rule | vs 70–80% | Action |
|---|---|---|---|
| Germany | 70–80% of photo height | ✅ matches | none |
| Italy | 70–80% of photo | ✅ matches | none |
| Ireland | 70–80% of frame, chin to crown | ✅ matches | none |
| France | 32–36 mm chin to crown (excl. hair) | ✅ ≈ matches | none |
| **Netherlands** | **26–30 mm chin to crown** (58–67%) | ❌ far too big | **fixed** |
| **Switzerland** | **29–34 mm chin to crown** (64–76%) | ❌ our 36 mm ceiling exceeded theirs | **fixed** |
| **Belgium** | **25–35 mm face incl. hair** (56–78%) | ❌ different basis, wider band | **fixed** |
| **Spain** | head outline ≈ **50%** incl. hair | ❌ but basis differs | bg fixed; head left, flagged |
| **Poland** | chin-to-**eyes** with annexed tolerances | ❌ different basis | bg fixed; head left, flagged |
| Portugal | **not found on an official source** | ❓ unknown | untouched |
| Austria, Sweden, Norway, Greece | not yet checked | ❓ unknown | untouched |

Background was wrong more often than head height: **Spain and Poland both
require WHITE**, and the Netherlands accepts grey, light blue or white. The
generic "Light grey" came from the Schengen *visa* spec, which is not the same
thing as a member state's own passport spec.

**Rule going forward: never add a country by calling `schengen()`.** It encodes
the visa standard, not any particular country's, and it has now been wrong for
five of the nine states examined. Add an explicit row with a cited source.

### Audit round 2 — 2026-08-23

| Country | Official rule | Action |
|---|---|---|
| **Austria** | Head fills 2/3 of the image, *"darf aber nicht höher als 36 mm sein"* → **30–36 mm** (66.7–80%). Background *"einfärbig hell, idealerweise grau"*. Minimum eye separation **8 mm** (10 mm optimal). [BMI Fotomuster 2022](https://www.bmi.gv.at/607/files/passbild_kriterien_2022.pdf) | **fixed** — our 31.5 mm floor was *stricter than the law* and rejected valid photos. Background confirmed correct. |
| **Sweden** | **You do not supply a photo for a passport — the police photograph you at the counter.** Published rules cover only light background, face square on, relaxed neutral expression, pupils clearly visible, no dark glasses except on medical grounds. No mm head height is published. [Polismyndigheten](https://polisen.se/tjanster-tillstand/pass-och-nationellt-id-kort/) | left as-is; the preset is only meaningful for visa/other uses, and the page should probably say so |
| **Portugal** | Every result was an aggregator (visafoto, idphotodiy, cantinhodoemprego). No official figure obtained. | untouched, still unverified |
| **Norway, Greece** | not yet attempted | untouched, still unverified |

Running total: **six presets corrected** (Netherlands, Switzerland, Belgium,
Austria head ranges; Spain, Poland backgrounds) out of ten Schengen states
examined. Only Germany, Italy, Ireland and France matched the generic row
unchanged.

### Audit round 3 — 2026-08-23 (Europe complete)

| Country | Official rule | Action |
|---|---|---|
| **Greece** | **40 × 60 mm**, not 35×45. Background light, *"preferably gray with an RGB value of (190;190;190) +/-10"*. Shoulders-to-top-of-hair 70–75% of the photo; **chin-to-forehead 50–60%**. Glasses must be worn if normally worn. Colour, ≤6 months, printed ≥1200 dpi. [National Passport Centre](https://www.passport.gov.gr/en/diadikasia-ekdosis/documents/specificationphoto.html) | **fixed — the size was completely wrong.** Head band set to Greece's published *face* height (chin-to-forehead), which excludes the crown and so reads slightly small against our crown-to-chin label. Flagged. |
| **Norway** | **You are photographed in the biometrikiosk at the police station** — *"bildet skal tas i biometrikiosken"*, children included. **Glasses are banned outright**: *"briller og hodeplagg skal ikke benyttes"*. Ears, both eyebrows and both eyes fully visible; head ≈70% of the picture. [Politiet](https://www.politiet.no/tjenester/pass/passfoto) | preset left (≈70% sits inside our band); editorial written |
| **Portugal** | Passport: two identical photos, colour, plain background, **up to a YEAR old**, size *"adequada ao modelo do passaporte"* — no mm published. **Cartão de Cidadão is 32 × 32 mm**, head uncovered, no dark sunglasses. [IRN](https://irn.justica.gov.pt/Documentos-de-Identificacao/Cartao-de-Cidadao) | preset left at ICAO 35×45 for the passport; editorial explains the CC is a different photo |

**Europe is now fully audited.** Final score across the twelve Schengen entries:

- **Correct as inherited (4):** Germany, Italy, Ireland, France
- **Corrected (7):** Netherlands, Switzerland, Belgium, Austria (head) · Spain, Poland (background) · **Greece (size — 35×45 → 40×60)**
- **Left with a flag (3):** Spain and Poland head bands (different measurement bases), Greece head band (face vs crown-to-chin)
- **Not applicable (2):** Sweden and Norway photograph you at the counter

Head height is expressed on **five incompatible bases** across these countries:
crown-to-chin (DE, CH, NL), face including hair (BE, ES), chin-to-forehead (GR),
chin-to-eyes (PL), and a bare percentage (IT, IE). `headMin`/`headMax` models
only the first. That is the root cause of most of what was wrong here, and it is
worth deciding whether the type should carry the basis explicitly.

### Audit round 4 — 2026-08-23, the eight commercial specs

These were already in `VERIFIED_SPECS`, and unlike the Schengen set they held up.

| Spec | Official | Ours was | Action |
|---|---|---|---|
| **US passport / US visa** | 2×2 in, head **25–35 mm** chin to top of head, white, ≤6 months. [travel.state.gov](https://travel.state.gov/content/travel/en/passports/how-apply/photos.html) | 25.5–35.2 mm | ✅ correct |
| **Canada** | 50×70 mm, face **31–36 mm** chin to crown, plain white, **two identical photos**, colour or B&W. [canada.ca](https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports/photos.html) | 30.8–36.4 mm | tightened |
| **Australia** | 35×45 mm, face **32–36 mm** chin to crown; head coverings allowed if habitually worn for religious reasons; under-3s may have the mouth open. [passports.gov.au](https://www.passports.gov.au/PhotoGuidelines) | 31.5–36 mm | tightened |
| **Japan** | 35×45 mm, **34 ± 2 mm** crown to chin (32–36), with 4±2 mm above the head and 7±2 mm below the chin. Derived from ICAO. [MOFA](https://www.mofa.go.jp/mofaj/toko/passport/ic_photo.html) | 31.5–36 mm | tightened |
| **China visa** | **48×33 mm**, head height **28–33 mm**, head width 15–22 mm, white background, **ears visible**, bare head, tilt ≤20° sideways / ≤25° up-down, ≤6 months. Notably: **do not wear a white top** — it merges with the background. [visaforchina.cn](https://www.visaforchina.cn/SYD3_EN/qianzhengyewu/jichuzhishi/changjianwenti/355135188537315328.html) | 28.8–34.6 mm | **fixed** — our ceiling exceeded China's 33 mm maximum, the same fault as Switzerland |
| **India passport (Seva)** | **3.5 × 4.5 cm, white background, two colour photos.** No photo is required at all at a Passport Seva Kendra or POPSK — they photograph you there. [passportindia.gov.in](https://www.passportindia.gov.in/psp/FaqApplicationForm) | 35×45 mm, white | ✅ correct. The `630×810 px, ≤250 KB` note belongs to an online-upload route, not this printed spec — worth re-labelling. |
| **India e-Visa** | **✅ verified 2026-08-24.** JPEG, **10 KB–1 MB**; *"the height and width of the Photo must be equal"* (square); *"full face, front view, eyes open and **without spectacles**"*; whole head from top of hair to bottom of chin, centred; plain light or white background, no shadows, no border. **Pixel dimensions are NOT published** — our old "350–1000 px" note was unsourced and has been removed. [indianvisaonline.gov.in](https://indianvisaonline.gov.in/evisa/tvoa.html) | 600×600, ≤1 MB | ✅ correct; note corrected |

**Verdict: the commercial specs were sound.** Four were exactly right, three had
floors ~0.5 mm loose (widening the "head OK" band rather than producing a wrong
crop), and only the China visa had a real ceiling error. That is what a sourced
row looks like, versus the `schengen()` guesses.

### Countries that photograph you themselves

A pattern worth surfacing in the UI: **Sweden, Norway and India (at a PSK)** do
not accept a supplied passport photo — you are photographed at the counter or in
a biometric kiosk. Their pages currently imply you should bring one.

Still unverified: the Americas rows (Brazil, Mexico, Argentina, Chile,
Colombia), most of Asia, the Middle East, Africa and Oceania — plus India e-Visa
above.

### ⚠ Still open — SPAIN head height

The Ministerio de Asuntos Exteriores' passport photo sheet
([consular PDF, updated 2017](https://www.exteriores.gob.es/Consulados/dusseldorf/es/Documents/Nacionales/Normativa%20fotograf%C3%ADas%20pasaporte%20-%20Espa%C3%B1ol.pdf))
disagrees with our spec table on two points that would get a photo refused:

| | `passport-specs.ts` says | The source says |
|---|---|---|
| Background | Light grey | **"fondo BLANCO, liso y uniforme. Sin sombras."** — white |
| Head height | 70–80% of photo height | **head outline (face + hair) = 50% of the photo**, 5 mm margins at sides and top |
| Size | 35×45 mm | 30–40 mm wide × 40–53 mm tall — 35×45 is inside this range, so not wrong |

Spain currently inherits the generic `schengen()` preset. **Nothing has been
changed**: `headMin`/`headMax` drive the crop guide in the tool itself, and the
source is a 2017 consular document rather than Policía Nacional's current page.
Verify against Policía Nacional / interior.gob.es before altering the preset,
and write Spain's editorial only once the table agrees with it — prose saying
"white, 50%" above a table saying "light grey, 70–80%" is worse than no prose.
Separately: the **DNI** photo (32×26 mm) is a different size from the passport
photo, so the page may need to say which document it covers.

Written into `EDITORIAL` in `frontend/lib/passport-specs.ts`. Measured effect on
the duplicate problem: Germany vs Poland fell from **79.8% → 57.5%** 4-gram
overlap, France 57.9%, Italy 57.8%, Japan 53.5%, Nepal 50.3% — all under the
60% bar in the [editorial scope](designs/passport-photo-editorial-scope.md).
Two pages that still lack editorial (Poland vs Nepal) remain at **74.0%**.
