# Passport / ID photo spec sources

Sourcing pass for `frontend/lib/passport-specs.ts` (2026-07-14). Specs in
`VERIFIED_SPECS` have their size, head-height and background checked against an
official or widely-cited source below. The tool shows **"✓ Spec checked against an
official source"** for these, and **"Standard ICAO spec — double-check your portal"**
for the rest. Nothing here guarantees acceptance — every office is strict its own way.

## Verified

| Spec | Size | Head | Background | Digital cap | Source |
|---|---|---|---|---|---|
| **US visa (DS-160)** | 2×2 in (600–1200 px) | 50–69% | White | ≤240 KB ⚠ unsourced | [9 FAM 303.6-2(A)(1)](https://fam.state.gov/fam/09fam/09fam030306.html) (CT:VISA-2036, 07-29-2024; read 2026-11-26) — covers the size, background and head height. **Not the 240 KB cap**, see below |
| **US passport** | 2×2 in | 50–69% | White | — | US State Dept |

> **⚠ The DS-160 240 KB figure has no source, and the row above used to cite a
> competitor's blog for it.** Corrected 2026-11-26 during the
> `/compress-to-size` sourcing pass, which found the same figure asserted in
> four places across the site.
>
> What is now sourced: **9 FAM 303.6-2(A)(1)**, the Foreign Affairs Manual's own
> photo standards, readable at `fam.state.gov` with no bot check. It gives
> "2 inches square (roughly 50 mm square)", "white or off-white background",
> the head at "at least half, but no more than two thirds, of the picture" and
> "about one inch (33 mm) from the chin to the top of the hair", plus the
> eyeglasses rule (no glasses for applications filed on or after 1 November
> 2016) and the head-covering rule.
>
> What is still unsourced: **the 240 KB byte cap**. It is not in the FAM at all
> — the FAM governs the photograph, not the CEAC upload form. The cap is
> published only on `travel.state.gov`, which serves a Cloudflare interstitial
> ("Just a moment…", HTTP 403) to automated requests. We do not work around a
> bot check, so the figure stays unverified and
> `frontend/lib/size-limits.ts` records it as such.
>
> **Two things to settle, both touching user-facing copy** — see
> `docs/designs/pdf-tools-top10-plan-2026-11-25.md` §4:
> 1. `/us-visa-photo` states "JPEG under 240 KB" as a rule in its description,
>    lede, a feature bullet and an FAQ answer. Soften to the figure the form
>    asks for, or leave it and accept that we cannot show where it came from.
> 2. Our `headMax` is **0.69**; the FAM says **two thirds** (0.667). Ours is
>    marginally more permissive than the manual. Small, but it is a number we
>    publish and it disagrees with the source we now cite.
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

---

## Tier 1 sourcing pass — 2026-08-29

The editorial scope's Tier 1 is the traffic tier: the countries people actually
search for. Each entry below was read on the authority's own page on the date
shown, and replaces an aggregator citation in the table at the top of this file.

| Spec | Authority page read | What changed in `passport-specs.ts` |
|---|---|---|
| **UK passport** | [GOV.UK — photo requirements](https://www.gov.uk/photos-for-passports/photo-requirements) + [digital photos](https://www.gov.uk/photos-for-passports/digital-photos) | Head band tightened from the rounded `0.64–0.76` to the published **29–34 mm on a 45 mm photo** (`29/45`–`34/45`). `bgName` corrected to **"Cream or light grey"** — GOV.UK says "plain cream or light grey", and white is the most common UK rejection. Editorial written. |
| **Canada passport** | [IRCC — Passport photo requirements](https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports/photos.html) | Spec confirmed correct (50×70 mm, 31–36 mm chin to crown). Editorial written, including the second, different **online-renewal digital spec** (3:2 portrait, 1800×1200–4500×3000 px, 200 KB–5 MB, chin-to-crown **45–50%**). |
| **Australia passport** | [Australian Passport Office — Passport photos](https://www.passports.gov.au/getting-passport-how-it-works/photo-guidelines) | Was cited as "standard ICAO + national guides". APO publishes a **range**: 35–40 × 45–50 mm, face **32–36 mm**. Head band set to `32/45`–`36/45`; `bg` changed from off-white to **white**, `bgName` to "White or light grey" — off-white is not one of the two options APO states. Editorial written. |

### Two findings worth carrying forward

**Canada and Australia both refuse edited photos, and define editing broadly.**
Canada lists cropping around the head and shoulders, pasting the subject onto a
white background, and any change to colour, brightness, contrast or sharpness —
filters and AI tools named explicitly. Australia refuses retouching and edited
backgrounds. Our country pages for both now say so plainly: use the tool to
check the crop and the measurements, not to manufacture a compliant photo out of
a non-compliant one. Saying otherwise would sell a rejected application.

**The Australian Passport Office warns against online photo services by name** —
they "may put you in danger of identity fraud". That warning is about services
that upload a face to a server, which is precisely what we do not do, so the
page answers it directly rather than omitting it.

### Blocked — could not be read automatically

| Spec | Authority | Obstacle |
|---|---|---|
| **US passport / US visa** | Bureau of Consular Affairs, `travel.state.gov` | Cloudflare bot interstitial on every request. Not bypassed. Needs a manual read. |
| **Japan** | MOFA, `mofa.go.jp` | The spec itself is a 10.8 MB PDF (`/mofaj/files/100171389.pdf`) linked from [ic_photo.html](https://www.mofa.go.jp/mofaj/toko/passport/ic_photo.html). The HTML page carries no measurements; direct download is blocked outside the browser and the PDF's text did not extract. Needs a manual read. |

Both remain on the generic values they already had. Neither has editorial, so
neither page claims anything unsourced — they show the "double-check your
portal" banner as before.

### Measured effect of the Tier 1 pass — 2026-08-29

4-gram overlap between rendered pages, dev server, nav/header/footer stripped.
The bar in the [editorial scope](designs/passport-photo-editorial-scope.md) is
**under 60%**.

| Pair | Overlap | |
|---|---|---|
| Canada vs Australia | **33.9%** | ✅ |
| UK vs Australia | **41.6%** | ✅ |
| UK vs Japan | **52.4%** | ✅ |
| Germany vs Poland | **57.9%** | ✅ (fixed in the 2026-08-23 pass) |
| Poland vs Nepal | **68.2%** | ❌ Nepal has no editorial |
| Japan vs Nepal | **70.7%** | ❌ neither has editorial |

Word counts rose from the 643–721 band to 908–975 for the pages with editorial;
the two without are still 466 (Japan) and 607 (Nepal).

**Every remaining failure is a page with no editorial.** The mechanism works —
what is left is the writing, and the writing is gated on being able to read the
authority's own page. Japan, the US and Nepal could not be read automatically
(Cloudflare interstitial, a 10.8 MB PDF, and a page whose body does not render
without its scripts). They are the next three to do by hand, and doing them
clears the last two failing pairs.

---

## Americas tranche — read 2026-11-19

Five countries, and the headline is not a measurement: **four of the five do not
ask for a photograph at all.** Our rows described prints that those authorities
never request, with no hint on the page that turning up with them is a wasted
trip to the photo shop.

| Country | Authority page read | Outcome |
|---|---|---|
| **Brazil** | [Polícia Federal — Documentação necessária](https://www.gov.br/pf/pt-br/assuntos/passaporte/documentacao/lista-brasileiro) | Size **confirmed** (5×7 cm, white) — but the list asks for it **only for applicants under five**, who must still attend in person. Everyone else is photographed at the appointment. Marked verified; editorial written; `photographedOnSite` added. |
| **Argentina** | [Decreto 749/2019, arts. 30–31](https://www.argentina.gob.ar/normativa/nacional/decreto-749-2019-330996/texto) | Size **confirmed** in law (4×4 cm, *fondo uniforme blanco y liso*). Marked verified. The decree frames it as **“medio busto”**, head and upper chest, which is looser than any crown-to-chin band — `headCaveat` added rather than converting by guesswork. Art. 31 gives real exceptions: hair covered for religious or medical reasons, and a private room with same-sex staff where religion covers the face. |
| **Mexico** | [SRE — Trámite de Pasaporte](https://www.gob.mx/sre/acciones-y-programas/tramite-de-pasaporte-8014) | **No size published at all.** Requirement 5 is to allow the SRE to take your photograph, fingerprints, irises and signature. It publishes rules about *you*, not the picture: **no glasses**, head completely uncovered, nothing covering the face. Left **unverified** — our 2×2 in is generic and is now labelled as such. |
| **Chile** | [ChileAtiende / Registro Civil — Pasaporte](https://www.chileatiende.gob.cl/fichas/3445-pasaporte) (page updated 19 Jan 2026) | The requirement list has **one item on it**: a valid *cédula de identidad*. No photograph, no size, no background. Left **unverified**; the 35×45 mm is now labelled generic. |
| **Colombia** | ❌ **blocked** | Resolución 10829 de 2024 is reported to publish **4×5 cm**, against the 35×45 mm we ship — so this row may be wrong. The Cancillería's own site (including its normograma) serves a **Cloudflare bot interstitial**, which we do not bypass. Decreto 1067 de 2015 on Función Pública's gestor normativo carries a 4×5 cm figure but for a refugee procedure, not the passport. **Row left unchanged and flagged in code** rather than edited on the strength of a search summary. |

**Why four countries with no photo spec is a feature, not a gap.** A page that
prints a confident 35×45 mm for Chile is worse than one that says the Registro
Civil does not ask for a photograph, because the first sends someone to a photo
booth for nothing. The `photographedOnSite` field already existed for Sweden,
Norway and India; it now carries the four Americas cases too, and each says what
the tool *is* still good for there — visas and the other paperwork that does ask.

**Still to do in this item:** Colombia (needs a human to open the Cancillería
page), plus the 23 remaining unverified specs in Asia, the Middle East and
Africa. The guard test's countdown moved **24 → 20**.

---

## Asia tranche (part 1) — read 2026-11-19

Three countries, **two live spec errors found and fixed**.

| Country | Authority page read | Outcome |
|---|---|---|
| **Singapore** | [ICA — Photo Guidelines](https://www.ica.gov.sg/photo-guidelines) (updated 30 Oct 2026) + the [passport application form IMM(E)11](https://www.ica.gov.sg/docs/default-source/ica/forms/forms_form_imme_11_os.pdf) | ⚠ **FIXED.** ICA publishes the face as **25–35 mm chin to crown** on a 45 mm photo (0.556–0.778). We shipped **0.66–0.80** — the floor stricter than ICA asks and the ceiling **above its maximum**. Background corrected to “white, light grey if your hair is white”. Upload cap 1 MB → 8 MB. Marked verified. |
| **Malaysia** | [Immigration Department — Passport Photo Requirements](https://esd.imi.gov.my/portal/photo-requirements/) | ⚠ **FIXED.** Published head height is **30–35 mm on 50 mm** (0.60–0.70); we shipped 0.66–0.80, overshooting the maximum. Background corrected from **“BLUE” to plain white** — blue appears only as an alternative for one visa category. Malaysia is also the only country on the list publishing explicit **margins** (≈5 mm above the head, 5–10 mm below the chin). Marked verified. |
| **Philippines** | [DFA Office of Consular Affairs — Passport FAQs](https://consular.dfa.gov.ph/passport-faq/) | The DFA answers it directly: **“No. You do not need to bring a passport-sized photo… The DFA Consular Office will digitally capture your photo and biometrics.”** No size published. Left unverified, row relabelled generic, `photographedOnSite` added. |

**South Korea was attempted and left alone.** Every page the search reached was
an embassy or visa-category page on MOFA's overseas site, not a domestic
passport-issuance specification. 3.5×4.5 cm is consistent across them but none
is the issuing authority's own passport page, so nothing was changed.

**Malaysia's blue background is worth recording as a pattern.** It is the kind
of fact that is true enough to be repeated everywhere and wrong as a default —
the same shape as Greece's size and the UK's “light grey”. Specs that came from
aggregators drift toward the memorable version of the rule.

Guard countdown **20 → 19**.

---

## Asia pt.2 + Oceania — read 2026-11-19

| Country | Authority page read | Outcome |
|---|---|---|
| **New Zealand** | [DIA — Passport photos](https://www.passports.govt.nz/passport-photos) (updated 4 Mar 2026) | ⚠ **FIXED.** Background was **White**; the DIA asks for a **plain, light-coloured** background contrasting strongly with the face, and the PAS205 form says **light but NOT white**. We were pointing people at the one colour the form excludes. Also: the digital photo is specified by **aspect ratio (3:4)** and pixel bounds, not millimetres — 900–4500 × 1200–6000 px, 250 KB–5 MB. No chin-to-crown figure is published on that page → `headCaveat`. Marked verified. |
| **Indonesia** | [Direktorat Jenderal Imigrasi — Kantor Imigrasi Karawang](https://karawang.imigrasi.go.id/fakta-penting-yang-harus-kamu-ketahui-saat-foto-paspor-di-kantor-imigrasi/) (14 Jul 2026) | Photographed at the immigration office during the interview and fingerprinting. Left unverified, row relabelled generic, `photographedOnSite` added. **Carries the single most missable rule found so far: no contact lenses, even natural-coloured** — immigration treats them as altering the eye profile. Also: do not wear white, because the backdrop is white. |

**Three background errors in one day — this is now the dominant failure mode.**
Malaysia (we said blue, it is white), New Zealand (we said white, it must not be
white), on top of Spain, Poland, Australia and the UK from the earlier passes.
**Background is wrong more often than size is.** It is a single word on a page,
so nobody re-checks it, and the aggregators all copy each other.

**On the Indonesian source.** `karawang.imigrasi.go.id` is a Kantor Imigrasi —
a Directorate General of Immigration office, so an authority rather than an
aggregator — but it is a *regional* office, not the central ministry. Recorded
here so the next person knows the standing of the citation.

Guard countdown **19 → 17**.

### Running tally for the 2026-11-19 pass
11 countries read. **5 live spec errors fixed** (Singapore head band, Malaysia
head band + background, New Zealand background, and 4 rows relabelled generic).
**7 countries found to photograph you at the counter** and now say so.

---

## Colombia — UNBLOCKED and FIXED, 2026-11-20

⚠ **It was wrong.** We shipped **35×45 mm**. Resolución 10829 de 2024,
parágrafo 4º: *“Tamaño de cuatro por cinco centímetros (4.0 cm x 5.0 cm) a
color”* — **40×50 mm**. Wrong SIZE, the same class of error as Greece.

**How it was read.** The Cancillería serves a Cloudflare interstitial to
automated readers, which we do not bypass, so this row sat flagged-but-unchanged
from 2026-11-19. **The owner opened the page in their own browser on
2026-11-20** and sent the text. That is the intended fallback, and it worked:
the row was wrong, and it was wrong in a way no amount of careful searching
would have settled — the aggregator consensus was the figure we already had.

The resolution states the list is the **ICAO minimum**, not the whole rule:

| | |
|---|---|
| a | 4.0 cm × 5.0 cm, colour |
| b | taken at most **six months** before the application |
| c | the face in the foreground (“en primer plano”) — **no chin-to-crown figure** → `headCaveat` |
| d | frontal pose, looking into the camera, neutral expression |
| e | if glasses are worn, the eyes must show clearly with no light reflections |
| f | **fondo blanco** — white (the one thing we already had right) |
| g | no accessory or facial ornament that hides the face |

For an online application the photograph is **digitised during the application**.

Marked verified. Guard countdown **17 → 16**.

### Lesson for the remaining 16
Holding the row rather than editing it on a search summary was right — but
holding it meant shipping a wrong size for another day. **Where a spec is
flagged as possibly wrong and the source is unreadable, ask the owner
immediately rather than at the end of the tranche.**

---

## Tranche 4 — Asia pt.2 + Gulf + Africa, read 2026-11-20

| Country | Source | Outcome |
|---|---|---|
| South Korea | [사진기준 — 여교비자과](https://www.passport.go.kr/) | **Head band fixed** 32–36 mm; 413×531 px for the online form |
| Thailand | Dept. of Consular Affairs | **`photographedOnSite`** — staff photograph you, take fingerprints and measure your height |
| Vietnam | Immigration Dept. | `headCaveat` — face sized as **~75% of the photo AREA**, plus an eye-line rule; not convertible to chin-to-crown |
| UAE | ICP ICAO spec (read via pdf.js) | ⚠ **Unresolved** — the ICP's own documents disagree on the size. Left generic behind a caveat; needs a human |
| South Africa | [DHA passport photo requirements (PDF)](https://www.dirco.gov.za/uk/wp-content/uploads/sites/5/2024/04/Passport_Photo_Requirements.pdf) | **Head band fixed** 29–34 mm; background **light grey or cream, not white** |

## Tranche 5 — Türkiye, Nigeria, Kenya, Sri Lanka, read 2026-11-20

| Country | Source | Outcome |
|---|---|---|
| Türkiye | [NVİ — Biyometrik Fotoğraf Özellikleri](https://www.nvi.gov.tr/istanbul/biyometrik-fotograf-nasil-olmalidir) (17.01.2020) | Size **confirmed** 50×60 white. No head measurement published → `headCaveat`. Marked verified |
| Nigeria | [NIS — How to Apply for Standard Passport](https://immigration.gov.ng/info-center/how-to-apply-for-standard-passport/) | Hybrid: upload an “ICAO compliant picture”, then attend for biometrics. **No millimetres published** → `headCaveat` |
| Kenya | [DIS photo requirements (eCitizen)](https://immigration.ecitizen.go.ke/index.php?id=9) | ⚠ **Wrong size AND wrong band.** We had 2×2 inch / 0.55–0.75. It is **5.5×5.5 cm (207×207 px), face 70–80%**. Relabelled **“Kenya visa”** — the published guideline is the visa one |
| Sri Lanka | [Dept. of Immigration & Emigration](https://www.immigration.gov.lk/pages_e.php?id=7) | ⚠ **A printed photograph is not accepted at all** since 10 Aug 2015. Authorised-studio digital upload + Studio Acknowledgement Note. `photographedOnSite` |

### Türkiye is worth quoting
NVİ is the only authority in this whole audit that tells the applicant what to
say to the photographer: **do not cut the biometric photo to 35×45 mm.** That is
the default setting on every photo-shop guillotine in Europe, and NVİ also spells
out the consequence — either the application cannot be completed, or the card is
cancelled later at quality control. Our size was already right; the page now
carries the warning.

### Kenya's square is not America's square
5.5 cm vs 2 inches (5.08 cm). Four millimetres. Close enough to look correct in
the hand, far enough to be refused — exactly the Greece/Colombia failure mode,
one more time.

### Still unresolved after five tranches
`pakistan`, `bangladesh`, `nepal`, `saudi`, `qatar`, `india-evisa`, and `uae`
(size conflict in the ICP's own documents). Per the Colombia lesson, these go to
the owner now rather than at the end: each needs a page opened in a human
browser, not more searching.

Guard countdown **16 → 11 → 7**.

---

## Tranche 6 — the blocked list, mostly unblocked, 2026-11-21

| Country | Source | Outcome |
|---|---|---|
| **Pakistan** | [DGI&P online MRP photo requirements](https://onlinemrp.dgip.gov.pk/photo-requirements) — owner's browser | Size **confirmed** 35×45 white. New: **20 KB file ceiling** (tightest on the list) and an explicit “not edited in other software” instruction. Head given only as a diagram → `headCaveat` |
| **Bangladesh** | [DIP e-Passport form instructions](https://www.epassport.gov.bd/instructions/instructions) (updated 3 Aug 2026) | ⚠ **Wrong on both counts.** Instruction 3: no photo is attached to the form at all. Instruction 21: under-6s submit a **3R lab print on GREY**. We shipped 45×55 white |
| **Nepal** | [Dept. of Passports — How to apply](https://nepalpassport.gov.np/en/process/process-7) | **`photographedOnSite`.** Step 3 of the appointment is “live enrolment (taking photograph and providing biometric information)”. No spec published |
| **India e-Visa** | [Bureau of Immigration instructions](https://indianvisaonline.gov.in/evisa/tvoa.html) | Re-read and **confirmed**: JPEG 10 KB–1 MB, height = width, **plain light coloured OR white**, **no spectacles**. No pixel or mm size published → `headCaveat`; `bgName` corrected from “White” |
| **Saudi Arabia** | visa.mofa.gov.sa + visa.visitsaudi.com incl. FAQ | ⚠ **No photo specification published anywhere.** The tourist eVisa asks for no photograph. Our 2×2 in is the Enjaz convention → said so in a `headCaveat` rather than presenting it as a rule |
| Qatar | portal.moi.gov.qa, hukoomi.gov.qa | ❌ **Still unreadable** — MOI portal has no photo page; Hukoomi returns HTTP 500 |
| UAE | ICP documents | ❌ **Still unresolved** — the ICP's own documents disagree on the size |

### Bangladesh is the strongest "no photo" finding yet
Instruction 3, verbatim: *ই-পাসপোর্ট ফরমে কোন ছবি সংযোজন এবং তা সত্যায়নের প্রয়োজন হবে না — no photograph
needs to be attached to the e-passport form, and no attestation of one is
required. Instruction 21 is the single exception: under-6s, 3R size, lab print,
**grey background**. A white print is refused.

### A real bug, found by a data fix
Pakistan's 20 KB is below what `encodeToCap` could reach: the binary search
floored at JPEG quality 40 and, if that was still over the cap, returned the
oversized file while the UI said “meets Pakistan”. Floor lowered to 10 and the
result line now warns instead of asserting when the cap genuinely cannot be hit.
**A spec audit found an engine bug — worth remembering as an argument for doing
these at source.**

### Honest copy, by request
DGI&P tells applicants the photo must be professionally taken, not cropped from
a larger picture, and *not edited in other software like photoshop*. We are
other software. The Pakistan page now says so and frames the tool as a check on
the crop and the file size, not a way to manufacture the photograph. The owner
asked for this line explicitly.

Guard countdown **7 → 4**. The four left — `us-visa` `us-passport`
`schengen-visa` `biometric` — are the generic presets and share their clusters
legitimately.

### Qatar — now labelled unverified on the page, 2026-11-21
Qatar is the only country in this audit we never read at source. Rather than
leave it sitting among the twenty-five verified entries looking equally settled,
the spec now carries a `headCaveat` saying plainly that we could not find a
Qatari source, that 35×45 mm on white is the regional convention, and that the
applicant should confirm with whoever receives the application. The `note` reads
“35×45 mm (unverified)”.

**The rule this sets:** an entry we could not verify gets labelled, not quietly
shipped looking like the ones we could. A tool that cannot tell you which of its
numbers it stands behind is worth less than one that admits the gap.
