# PR #1 — FINAL copy for EIN (supersedes pr1-revision-300w.md)

**Status:** ready to paste into the EIN Google Doc.
**Their doc:** https://docs.google.com/document/d/1vTVxSuXRq6_LPKtkHmJc_4EXADXEJjBLc0UhK2t2ig0/edit

This revision satisfies Mary's two requests (third person, ≥300 words) **and** fixes five accuracy
problems found by verifying every claim against the codebase. The earlier draft would have published
claims the product does not support.

## Accuracy fixes in this revision

| # | Problem | Verified against | Fix |
|---|---|---|---|
| 1 | Title/About claimed the whole toolkit never uploads. Four **free, publicly listed** tools upload files to a server and write them to disk. | `backend/src/routes/convert.js:91` (`multer.diskStorage`), `:32` (3/day free), `frontend/app/sitemap.ts` lists all four | Title rescoped; the server exception is now stated outright in para 1 |
| 2 | Advertised **redact**, which is not publicly available | `/redact-pdf` absent from `frontend/app/sitemap.ts`; owner-only until Pro | Removed from the tool list; moved to the Pro sentence |
| 3 | "free and **unlimited**" | `FREE_MAX_BYTES = 100 MB`, `frontend/lib/plan.ts:19` | "free, with no daily limits … on files up to 100 MB" |
| 4 | Claimed it "keeps working without a connection" | `frontend/public/sw.js` — *"caches NOTHING about the app shell"* by design | Claim removed |
| 5 | Dateline city inconsistent with the EIN Location field | EIN Location field = Marietta (`ein-submission-record.md:15`); PR #2 uses `MARIETTA, Ga.` | **Owner decided 2026-07-20: use ATLANTA.** Dateline + About stay Atlanta; the EIN Location field must be changed to match — see below |

**Word count:** body paragraphs = **352** (≥300 ✓). Zero "you"/"your" outside quotes ✓.

**Why the exception sentence stays in.** It is tempting to cut it. Keep it — the release invites
journalists to "open the browser's network tab and check." A reporter who runs that test on
`/pdf-to-word` sees an upload. Disclosing the exception first is what makes the rest of the claim
survive scrutiny.

---

## Title

DiemDesk Launches a Document Toolkit Where More Than 50 Tools Run Without Uploading a File

## Summary

More than 50 free PDF, image, and everyday tools run entirely in the browser - with no uploads, accounts, or ads.

## Body

**ATLANTA, GA -** DiemDesk today opened to the public at diemdesk.com, offering more than 50 document tools that do their work entirely inside the web browser. Unlike most online PDF and image services, which upload users' files to a company's servers, DiemDesk's in-browser tools process files on the user's own device - so those documents never leave the computer. The exceptions are a small number of tools that need a desktop engine, such as the Office file conversions, which run on DiemDesk's servers.

The toolkit covers everyday needs - from tools to compress PDF files and merge PDF documents to convert, split, rotate, edit, and e-sign - plus image resizing and conversion, QR codes, and other utilities. Every in-browser tool is free, with no daily limits, no ads, no watermarks, and no account required, on files up to 100 MB.

DiemDesk was built on a simple premise: people shouldn't have to hand contracts, IDs, or personal documents to a third-party server just to compress a PDF. With the in-browser tools, the work happens on the user's device. Nothing is uploaded, and anyone can verify that by opening the browser's network tab.

"Most people never stop to think about where a document goes when they compress it," said Jayaprabha Ranganathan, founder of DiemDesk. "It travels to a company's server, and the person simply has to trust what happens next. With the in-browser tools, that step does not exist - the file stays on the machine it started on, and anyone can check that for themselves."

Because those files are processed locally, DiemDesk suits sensitive material where uploading isn't an option. Handling files in the browser also avoids the wait of uploading large documents to a server and back. The tools use WebAssembly to run the same kinds of document engines on the user's machine that competing services run on their own servers.

DiemDesk is free to use today. A paid Pro plan is on the way, adding on-device batch processing, an encrypted file vault, redaction, OCR, and AI document assistants. Early users can join the waitlist at diemdesk.com/pricing to lock in founding-member pricing.

## About DiemDesk

DiemDesk is a privacy-first document toolkit built in Atlanta, Georgia. More than 50 of its tools run entirely in the browser, so those files stay on the user's own device. Learn more at diemdesk.com.

**Email:** support@diemdesk.com

## Media Contact

- **Company Name:** DiemDesk
- **Contact Person:** Jayaprabha Ranganathan
- **Country:** United States
- **Website:** https://diemdesk.com/

---

## ⚠ Note for the EIN form — ACTION REQUIRED

Owner chose **Atlanta** for the dateline (2026-07-20). Atlanta is the metro area for a Marietta-based
business, and a metro dateline is standard PR practice — but the EIN form has a **structured Location
field that renders on the published page**, so it must not contradict the dateline.

- **Set the EIN Location field to `Atlanta, Georgia, United States`** (it currently records
  *Marietta* at `ein-submission-record.md:15`). Update that record file when you submit.
- **PR #2 uses `MARIETTA, Ga.`** throughout (`pr2/press-release.md:24, :35, :50, :61`) and its
  submission record also says Marietta. If PR #2 has not gone out yet, switch it to Atlanta too so
  the two releases tell one story. If it has already published, leave it — a one-time metro
  difference is unremarkable, but flip-flopping on future releases is not.
