# pdf.net — full site scan and gap analysis

**Scanned:** 2026-08-29 · **Method:** sitemap.xml (471 English URLs), `/llms.txt`,
`.md` twin of every tool page, `/release-notes`, live page reads.

Companion to the standing rule in memory: review the equivalent competitor tool
before every ship, match it and exceed it.

---

## 1. The headline numbers

| | pdf.net | DiemDesk |
|---|---|---|
| Tools | ~35 | **114** |
| Tool/product pages | 47 | 175 routes |
| Forms library pages | **225** | 0 |
| Blog / guide pages | **198** | 0 |
| Languages | **7** (en, es, ja, ar, pt, ko, ms) | 1 |
| Total indexable EN pages | ~471 | ~175 |
| Processing | All server-side upload | Mostly on-device |

**The most important line in this table is not the tool count — it is the two
below it.** We beat them 114 to 35 on tools and they still out-page us 471 to
175, because 423 of their pages are *content*, not tools. Their SEO strategy is
a forms library and a blog. Ours is tools. That is the real finding.

---

## 2. What they have that we do not

Ranked by what it would actually be worth to us.

### A. Forms Library + AI Form Filler ⭐ biggest gap

- 225 pages of fillable templates: 131 tax, 16 immigration, 15 legal, 15
  healthcare, 11 military, 10 business, 7 financial, 6 education, 5 real
  estate, 4 employment, 4 administrative.
- Each form page is a real content asset: what the form is, who files it, when
  it is due, the penalties, where to file, step-by-step completion, versions
  with a downloadable official PDF, and related forms. (See `/pdf-forms/tax-forms/form-w-9`.)
- **AI Form Filler** (`/pdf-forms/ai-form-filler`): upload your supporting
  documents, the AI extracts the details and places them in the right fields.
  Wired into the library on 2026-08-11 — open any form, fill it with AI.

**Where we stand:** `/fill-pdf-form` exists but is manual only, and there is no
library at all.

**Why it matters:** "form W-9" style queries are enormous, recurring, and have
commercial intent. This is their retention loop AND their SEO engine in one.

**Caveat that needs an owner decision:** their library is US-centric (IRS, USCIS,
military). Our flagship is India-first. An Indian equivalent (ITR forms, Form
16, GST, PAN/Aadhaar, EPFO) is a genuinely open field — nobody owns it the way
pdf.net owns the US set.

### B. MCP server ⭐ pure distribution, low cost

- `/mcp-server` — connect Claude or ChatGPT to their tools. Live on the OpenAI
  Apps Marketplace since 2026-07-06. Explicitly supports Claude Code.
- Free, deliberately: it is a distribution channel, not a product.
- Anything their tools do, the assistant can do — edit, merge, split, compress,
  convert, translate, generate, organize.

**Where we stand:** nothing.

**Why it matters:** it puts them inside the assistant where the user already is.
This is the cheapest new-channel item on the list and it aligns with our own
architecture — our server tools already have clean endpoints.

### C. Request Signature (send-to-others e-signature)

- `/request-signature-pdf` — send a PDF to recipients, mark where each must
  sign, invite by email, track progress, receive the signed document back.

**Where we stand:** `/sign-pdf` signs a document yourself. The multi-party
workflow does not exist.

**Cost:** heavy. Needs email delivery, recipient identity, an audit trail, and
legal review of what "legally binding" claims we can make. This is DocuSign
territory, not a weekend.

### D. AI PDF Generator

- `/ai-pdf-generator` — describe a document (invoice, resume, agreement) and get
  a formatted PDF back.

**Where we stand:** nothing. We have Chat with PDF and Summarize, both of which
read; nothing that writes.

### E. Cloud document workspace ("My Documents")

- A logged-in dashboard where files persist: "Organize all your documents in one
  workspace, access from any device, share or keep private."
- Share link copyable in one click from the editor or the dashboard (2026-08-18).

**Where we stand:** `/file-vault` is the better version of this — end-to-end
encrypted, so we cannot read the contents and they can. It is built but gated.

**Recommendation: do not copy theirs.** Finish ours. Their pitch is convenience;
ours can be convenience *and* a guarantee they cannot make.

### F. Share PDF by secure link

- `/share-pdf` — upload, set view/edit permissions, send by link or email.

**Conflicts with our position.** Sharing requires storing. Only worth doing
inside the File Vault, where it is encrypted, never as a general tool.

### G. Signature Background Remover

- `/signature-background-remover` — makes a photographed signature transparent
  so it does not paste as a white box.

**Where we stand:** `/remove-background` does this already but is framed for
photos. **This is a preset and a landing page, not a feature.** Cheapest win on
the whole list.

### H. `llms.txt` + `.md` twin of every page ⭐ cheap

- `/llms.txt` is a routing file written *for AI assistants*: key terms, task
  categories, explicit "if the user wants X → send them to page Y" rules, and a
  full page index.
- Append `.md` to any tool, blog or forms URL and you get a clean Markdown
  version, served as `text/markdown`.
- Their robots.txt carries `Content-Signal: search=yes, ai-train=yes, ai-input=yes`.

**Where we stand:** nothing. Worse — per memory, Cloudflare's managed robots.txt
is currently serving `Disallow: /` to GPTBot, ClaudeBot and Google-Extended, so
we are actively invisible to the channel they are actively courting.

**This is days of work, not months, and it is the highest ratio on the list.**

### I. Multi-language

Seven languages with full hreflang alternates on every URL. Roughly 7× the
indexable surface for the same tools.

### J. Blog (198 posts)

Includes the money pages: "Adobe Acrobat alternative", "pdfFiller alternative",
"DocuSign alternatives", "Foxit alternatives", "best PDF editor for Mac".

We have `/compare` and `*-alternative` pages, but no blog.

---

## 3. What we have that they do not

They have **no equivalent at all** for roughly 80 of our tools:

- **Document intelligence:** OCR, redaction + redaction certificate, PDF repair,
  PDF/A archival, translate, clean scanned PDF, PDF question generator,
  receipt scanner, share-safe PDF check
- **Page geometry:** crop, watermark, flatten, N-up, page size, rasterize,
  split-in-half, overlay, bookmarks, metadata editing
- **Formats they do not touch:** EPUB both ways, RTF, ODT/ODF, HTML, Markdown
  out, text, audio (PDF→audio), subtitle conversion
- **Images:** compress to a target KB, convert, crop, resize, HEIC→JPG,
  background removal, EXIF/photo privacy, passport photo, favicon generator
- **Video/audio:** compress video, video→GIF, video→MP3, audio converter
- **Developer + data:** JSON/YAML/CSV/XML/HTML converters, base64, hash, JWT,
  regex, diff, timestamps, UUID
- **Ours alone:** Saved Workflows (tool chaining), File Vault (E2E), folder
  preview, client packet builder, budget/habits/notes

Plus the architectural difference: **most of our tools never upload the file.**
Every single one of theirs does. Their own FAQ says files go to their servers
and are deleted after.

---

## 4. Recommendation

**Do now — cheap, high ratio:**

1. **`llms.txt` + `.md` twins + unblock the AI crawlers.** Days of work. Right
   now we are locked out of a channel a competitor is actively winning. The
   Cloudflare robots.txt block has to be lifted first — it is a dashboard
   setting, not code.
2. **Signature background preset + landing page.** Hours. The engine exists.

**Decide, then build:**

3. **Forms library — India-first.** The biggest gap and the biggest opportunity,
   but the wrong copy of it is worthless. Their 131 US tax pages are not our
   market. Needs an owner call on scope before any build.
4. **MCP server.** Real distribution, moderate cost, fits our existing endpoints.

**Deliberately not copying:**

5. **Cloud workspace and share links** — finish File Vault instead. Their version
   requires them to hold readable copies; ours does not. That is a selling
   point, not a shortfall.

**Park:**

6. **Request Signature** — genuinely valuable and genuinely expensive. Email,
   identity, audit trail and legal review. Not until Pro is earning.
7. **AI PDF generator** — cheap to build on the existing AI plumbing, but it is
   a commodity; every assistant already does it.
8. **Multi-language and blog** — high value, high ongoing cost. Both are
   content-team commitments, not one-off ships.
