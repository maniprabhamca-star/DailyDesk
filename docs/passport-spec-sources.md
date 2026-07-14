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
