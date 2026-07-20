# AI suite build plan — ship dark now, flip at Pro launch

**Status:** approved to build gated (owner, 2026-07-20). Batch 1 mockup: `docs/artifacts/mockup-ai-doc-tools.html`.
**Why now:** the AI tier is the Pro revenue engine; building it gated means Pro launch day is a flag flip, not a build. Haiku testing costs pennies. Competitor parity check (2026-07-20): Smallpdf already ships AI chat, summarizer, translate AND a question generator; iLovePDF ships summarize + translate. Our edge = privacy (text snippets only, file never uploaded), page-cited outputs, Anki export, and the two tools nobody has (AI Auto-Redact, NL ⌘K).

## Shared architecture (settled — reuse, don't reinvent)

- **Backend:** every tool is an endpoint in `backend/src/routes/ai.js` behind the same control stack Chat with PDF proved: key/`AI_ENABLED` availability → Pro-or-owner gate (`whoIs`) → per-user daily cap + global USD kill-switch (`utils/aiBudget`) → per-tool `guard('/route')` kill-switch → burst rate limit → Haiku (`AI_MODEL`). Refactor the stack into a helper (`withAiControls`) so each new endpoint is ~40 lines of prompt+shaping, not a copy of 140.
- **Frontend:** on-device extraction stays in `lib/pdf-chat.ts` (pdf.js `getTextContent`); only text ever leaves the browser. Left document panel + on-device privacy badge shared with Chat with PDF.
- **Gating:** every tool ships `coming_soon` (owner-only via ToolGate) → `pro` at launch. SEO page live from day one (title/desc/canonical/JSON-LD/OG + **sitemap.ts entry**).
- **Per tool on ship:** `pro_used` tracking + browser-canary entry (owner-only tools need the `ddadmin` cookie path) + catalog card + /overview auto-update.

## Batch 1 — document-AI trio (one pattern, three routes)

| Tool | Route | Endpoint | Notes |
|---|---|---|---|
| Summarize PDF | `/summarize-pdf` | `POST /api/ai/summarize` | Length (TL;DR/Standard/Detailed) × format (paragraphs/bullets) × page range. **Page-cited** summary + key points. Export .md/.txt/copy. Long docs: map-reduce (chunk summaries → final pass). |
| Translate PDF | `/translate-pdf` | `POST /api/ai/translate` | Auto-detect source; side-by-side or translation-only. **Honest scope: translates text, does NOT re-typeset the PDF.** Costliest tool (full text in+out): 30 pages/run cap, tighter daily cap. Export .txt/.md. |
| Question generator | `/pdf-question-generator` | `POST /api/ai/questions` | MCQ / flashcards / open; 5-15; difficulty; page cites. **Anki/CSV export** (differentiator). Print view with answers on last page. |

## Batch 2 — AI layers inside existing tools (no new routes)

- **PDF→Excel AI cleanup** — `POST /api/ai/table-cleanup`. Pro button in `/pdf-to-excel`: sends the extracted grid (text, not file), returns fixed grid (merged title rows, split numeric columns healed). The Pro upsell on the free tool.
- **Semantic AI compare** — `POST /api/ai/compare`. Mode toggle in the existing Compare tool: "what changed in meaning" (renegotiated clauses, date/amount changes) vs the current text diff.

## Batch 3 — AI Auto-Redact PII (the unique differentiator)

- `POST /api/ai/redact-scan`: text+positions in → PII findings out (name/type/page/quote). Frontend maps quotes back to pdf.js text positions → draws the existing Redact tool's boxes → **the actual redaction burn stays 100% on-device** (the AI only points; the existing engine redacts). Human reviews/approves each box before burn — never auto-burn.
- Pairs with the redaction certificate (Pro roadmap).

## Batch 4 — NL ⌘K commands (signature feature)

- `POST /api/ai/command`: utterance → static command id + args, constrained to the palette's existing command set (never freeform actions). Static/regex commands stay free; semantic parse is the Pro layer (per the ⌘K roadmap memory/doc).

## Cost & caps (Haiku, inside existing $5/day global kill-switch)

Summarize ≈ $0.01/run · Questions ≈ $0.01 · Cleanup/Compare ≈ $0.01 · Redact-scan ≈ $0.02 (positions inflate input) · Translate $0.01–0.15 (caps above). Per-user daily caps per tool (summarize 10, translate 5, questions 10) — all env-tunable like `AI_USER_DAILY_MAX`.

## Order & verification

Build 1 → 2 → 3 → 4. Each batch: mockup approval → build → tsc/tests → live owner-path verification on prod (mint owner JWT, real run) → memory/status-board update. Batch 1 estimated ~1 session; batches 2-4 one session each.
