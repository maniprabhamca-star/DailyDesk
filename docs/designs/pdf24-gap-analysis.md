# PDF24 gap analysis — what they have that we don't

**Checked 2026-08-24** against [tools.pdf24.org](https://tools.pdf24.org/en/).

> **CORRECTION (2026-08-24).** The first version of this document said PDF24 had
> 24 tools. That was the landing page, not the catalogue. Their
> [all-tools page](https://tools.pdf24.org/en/all-tools) lists **~100**, which is
> comparable to ours — the owner caught the error. The gap list below has been
> rebuilt from the full catalogue and is considerably longer than it first
> appeared. Everything under "The headline" was written on the wrong premise;
> the corrected comparison is in **Full-catalogue gaps** further down.

## The headline: breadth is not the problem

| | PDF24 | DiemDesk |
|---|---|---|
| Tools | ~~24~~ **~100** | **102** |
| Processing | Uploaded to their servers, "removed after a short time" | On your device for the in-browser tools |
| Limits | "No artificial limits" — because they scale servers | 100 MB free on in-browser tools |
| Offline option | A separate Windows desktop download (PDF24 Creator) | The website itself works offline |

We are four times their size and our privacy position is structurally stronger:
their "no limits" claim is possible *because* the file goes to their machines.
Ours doesn't. That is the comparison worth making on `/compare`, not tool counts.

So this is a search for **specific missing capabilities**, not a catch-up list.

## What they have that we genuinely do not

### 1. PDF Overlay — **build this**
Stamp one PDF on top of another: company letterhead behind an invoice, a
"DRAFT"/"PAID" stamp page, a pre-printed form background, a signature block
applied to every page.

- **We have nothing like it.** Watermark does text/image; it cannot overlay a PDF.
- **Effort: LOW.** pdf-lib embeds a page from PDF B as a form XObject and draws
  it onto every page of PDF A. Entirely client-side — no server, no upload.
- **Why it is worth more to us than to them:** letterheads and stamped invoices
  are exactly the documents people are least willing to upload. This is a tool
  where "never leaves your device" sells itself.
- Naturally chains with Workflows (apply letterhead → compress → share-safe).

### 2. Webpage (URL) → PDF — **build this**
Paste a URL, get a PDF of the live page. Archiving a receipt, an order
confirmation, a policy page, a listing before it changes.

- **We do not have it.** `/html-to-pdf` takes a *file* and its own FAQ says it
  "renders the document itself, not a live web page".
- **Effort: MEDIUM.** Needs a headless browser server-side — we already run
  server conversions (`backend/src/routes/convert.js`), so the shape exists.
- **Honesty constraint:** this one genuinely cannot be on-device, so it must be
  labelled `server` like the Office conversions, and the page must say the URL
  is fetched by our server. Do not let it dilute the on-device promise.
- Strong SEO term ("webpage to pdf", "url to pdf", "save website as pdf").

### 3. Web-optimised / linearised PDF — **probably skip**
"Fast Web View": restructure a PDF so the first page renders before the whole
file has downloaded.

- **Effort: MEDIUM-HIGH.** Linearisation rewrites the xref table; pdf-lib will
  not do it. Realistically qpdf via WASM or on the server.
- **Value: low and falling.** It mattered for dial-up-era in-browser viewers.
  Modern viewers and HTTP range requests have largely removed the need, and
  almost nobody searches for it.
- Recommend **not** building it. Note it here so the decision is on record
  rather than re-litigated every time someone reads PDF24's list.

## Not real gaps

| PDF24 tool | Ours |
|---|---|
| Extract PDF pages | Covered by **Split PDF**. Possibly worth a keyword landing page at `/extract-pdf-pages` pointing at Split — an SEO play, not a build. |
| Create PDF | Covered by JPG→PDF, Markdown→PDF, Scan to PDF. A blank-PDF creator is a novelty. |
| Rearrange / Remove pages | **Reorder pages**, **Delete pages** |
| PDF Converter | We have ~20 named converters, which is better for search than one generic one |
| Compare PDFs | **Compare PDF** (currently gated) |

## What we have that PDF24 does not

Worth putting on `/compare`, because it is a long list: Bank statement → Excel,
Chat with PDF, Summarize, Translate, Question generator, PDF → Audio, PDF/A,
Bates numbering, Share-Safe check, Fill PDF form, Clean scanned PDF, Repair PDF,
Redaction certificate + `/verify-redaction`, Folder preview, Workflows, Client
packet builder, File vault — plus the entire image, video, developer and
everyday-tools sections they have nothing comparable to.

## Full-catalogue gaps (from the all-tools page)

Rebuilt after the correction above. These are **functional** absences, not
naming — the pure SEO-name gaps are listed separately at the end.

### Genuinely missing capabilities

| Tool | What it does | Effort | Verdict |
|---|---|---|---|
| **PDF Overlay** | Stamp one PDF over another — letterhead, DRAFT stamp, pre-printed background | LOW, client-side | **Build** |
| **Webpage → PDF** | Archive a live URL as PDF | MED, needs headless browser | **Build (Pro)** |
| **Halve PDF pages** | Cut each page down the middle — scanned book spreads into single pages | LOW, client-side | **Strong candidate.** Genuinely useful, and it pairs with Scan to PDF + Clean scanned PDF |
| **Pages per sheet (N-up)** | 2 or 4 pages onto one sheet for printing | LOW, client-side | Good candidate |
| **Change PDF page size** | Rescale pages A4 ↔ Letter ↔ A5 | LOW, client-side | Good candidate |
| **Change document information** | Edit title / author / subject | LOW | We only *remove* metadata; editing is a natural sibling |
| **Bookmark PDF** | Add or edit the outline / table of contents | MEDIUM | Worth it — no free competitor does this well |
| **Rasterize PDF** | Flatten every page to an image | LOW | We render already; different from our form-Flatten |
| **Create fillable PDF form** | Author AcroForm fields | HIGH | Big. Pairs with Fill PDF form. Pro material |
| **Set viewer preferences** | Open at page N, page layout | LOW | Niche |
| **Create invoice / e-invoice** | Invoice builder incl. electronic formats | HIGH | Interesting given the e-invoicing mandates already noted in the tool-expansion roadmap |

### Naming / SEO gaps only (same engines we already run)
`PNG to PDF` · `WEBP to PDF` · `HEIC to PDF` · `TIFF to PDF` · `PDF to PNG` ·
`PDF to SVG` · `PDF to HTML` · `PDF to RTF` · `HEIC to PNG` · `WEBP to JPG/PNG` ·
ODF in/out (`ODT`/`ODS`/`ODP`/`ODG`) · `PUB to PDF`.

Most are landing pages over converters we already have. `PDF to SVG` and
`PDF to HTML` are the two that need real work.

## Recommended plan

| # | Item | Effort | Do it? |
|---|---|---|---|
| 1 | **PDF Overlay** | ~1 day, client-side | **Yes — first.** Cheap, on-brand, no server |
| 2 | **URL → PDF** | ~2–3 days, server | **Yes — second.** Real search demand; must be labelled `server` |
| 3 | `/extract-pdf-pages` landing → Split | ~2 h | Yes, if the SEO backlog is being worked anyway |
| 4 | Web-optimise / linearise | ~3–4 days | **No.** Low and declining value |

**Sequencing note:** neither of these is worth starting before the two things
actually blocking money — `WAITLIST_MODE` and the Pro-launch flags. A 103rd tool
does not earn anything while nothing can be bought.
