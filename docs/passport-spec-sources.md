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

Still unverified and therefore still suspect: `portugal` `austria` `sweden`
`norway` `greece`, plus every entry outside Europe that was never in
`VERIFIED_SPECS`.

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
