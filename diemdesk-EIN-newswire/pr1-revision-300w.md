# PR #1 — revision for EIN press team (Mary), 2026-07-17

> ⚠ **SUPERSEDED by [pr1-FINAL.md](pr1-FINAL.md).** A claim-verification pass against the codebase
> found five accuracy problems in the copy below (categorical no-upload claim vs. the four server-side
> Office conversions, "redact" advertised while owner-gated, "unlimited" vs. the 100 MB cap, a false
> offline claim, and an Atlanta dateline that contradicts the Marietta EIN Location field).
> **Do not paste from this file.** It is kept only as the record of the 300-word revision.

**Why:** EIN's press team rebuilt the release in their own Google Doc and asked for two changes:

1. *(informational — they already did it)* Non-quoted instances of "your" were removed for third-person consistency, to avoid publishing restrictions.
2. **(action required)** The body must be **≥300 words**; theirs counted **274**.

**Their doc:** https://docs.google.com/document/d/1vTVxSuXRq6_LPKtkHmJc_4EXADXEJjBLc0UhK2t2ig0/edit

## What changed in this revision

| Change | Detail |
|---|---|
| **+86 words** | A founder quote (new paragraph) + one sentence on WebAssembly in the "processed locally" paragraph |
| **Word count** | Body paragraphs alone = **328** (passes even if About/email are excluded). With About + email ≈ **361**. Note: the quote alone only reached 301 — one word over the limit — which is why the WebAssembly sentence stayed in. |
| **"more than 40" → "more than 50"** | The site has **57 live tools** (verified from the catalog) — the release was underselling by ~30%. Appears in the summary *and* the first paragraph. |
| **Third person kept inside the quote too** | EIN only requires it outside quotes, but keeping it throughout removes any risk of another review round. |
| **Verified** | 0 "your" / 0 "you"; no AI-tell words; hyphens not em-dashes (matches their formatting). |

## ✅ Two owner decisions — both applied 2026-07-18

1. **Quote attribution** — owner confirmed the title; the quote now reads "said Jayaprabha Ranganathan, **founder** of DiemDesk."
2. **Scope of the privacy claim** — paragraph 1 previously stated without qualification that "DiemDesk processes files on the user's own device." A few tools (Office conversions, OCR, AI) *do* use a server, and diemdesk.com/overview says so openly ("the honest exception"). Paragraph 1 now reads **"DiemDesk's in-browser tools process files on the user's own device"**. The quote was already scoped ("With the in-browser tools").

> **Still open:** the same unscoped claim also appears in the **title** ("Never Uploads Files"), the **summary** ("run entirely in the browser"), body para 3 ("Nothing is uploaded"), and **About** ("Its tools run entirely in the browser"). Scoping para 1 alone leaves those inconsistent — see the verification pass below before publishing.

---

## Final body copy (paste into their doc)

**ATLANTA, GA -** DiemDesk today opened to the public at diemdesk.com, offering more than 50 document tools that do their work entirely inside the web browser. Unlike most online PDF and image services, which upload users' files to a company's servers, DiemDesk's in-browser tools process files on the user's own device - so users' documents never leave their computer.

The toolkit covers everyday needs - from tools to compress PDF files and merge PDF documents to convert, split, rotate, edit, e-sign, and redact - plus image resizing and conversion, QR codes, and other utilities. Every in-browser tool is free and unlimited, with no ads, watermarks, or account required.

DiemDesk was built on a simple premise: people shouldn't have to hand contracts, IDs, or personal documents to a third-party server just to compress a PDF. With DiemDesk, the work happens on the user's device. Nothing is uploaded, and anyone can verify that by opening the browser's network tab.

"Most people never stop to think about where a document goes when they compress it," said Jayaprabha Ranganathan, founder of DiemDesk. "It travels to a company's server, and the person simply has to trust what happens next. With the in-browser tools, that step does not exist - the file stays on the machine it started on, and anyone can check that for themselves."

Because files are processed locally, DiemDesk suits sensitive material where uploading isn't an option, and it keeps working without a connection once a page has loaded. Handling files in the browser also avoids the wait of uploading large documents to a server and back. The tools use WebAssembly to run the same kinds of document engines on the user's machine that competing services run on their own servers.

DiemDesk is free to use today. A paid Pro plan is on the way, adding on-device batch processing, an encrypted file vault, OCR, and AI document assistants. Early users can join the waitlist at diemdesk.com/pricing to lock in founding-member pricing.

**About DiemDesk**

DiemDesk is a privacy-first document toolkit built in Atlanta, Georgia. Its tools run entirely in the browser, so users' files stay on their own devices. Learn more at diemdesk.com.
