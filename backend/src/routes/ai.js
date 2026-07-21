// AI — the document tools that run on Claude: Chat with PDF, Summarize,
// Translate, and the Question generator.
//
// PRIVACY (the honest exception): every other DiemDesk tool is 100% on-device.
// These aren't — but the FILE is still never uploaded. The browser extracts the
// text with pdf.js and sends only text. We forward it to Claude and return the
// result. Nothing is stored, nothing is logged as content, and we don't train
// on it.
//
// COST: this is our only per-use AI cost, so it's Pro-gated and wrapped in hard
// controls (utils/aiBudget) — a per-user monthly cap AND global daily/monthly
// USD budget kill-switches pegged to revenue. Model = Claude Haiku (cheapest
// capable). Until the owner sets ANTHROPIC_API_KEY (and flips AI_ENABLED), every
// endpoint reports "coming-soon" so the tools ship dark and turn on at Pro launch.
const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { clientKey } = require('../utils/rateLimitKey');
const { makeStore, redisDown } = require('../utils/rateLimitStore');
const { guard } = require('../utils/toolFlag');
const { isCanaryReq } = require('../utils/canary');
const { trackEvent } = require('../utils/trackEvent');
const budget = require('../utils/aiBudget');
const db = require('../db');

const router = express.Router();

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5-20251001';
const MAX_TOKENS = Number(process.env.AI_MAX_TOKENS || 700);
const MAX_CONTEXT_CHARS = Number(process.env.AI_MAX_CONTEXT_CHARS || 12000);
// Summarize/questions read much more of the document than a chat question does.
const SUM_MAX_CHARS = Number(process.env.AI_SUM_MAX_CHARS || 60000);
// Translate is the costly one (whole text in AND out) → tight page/char caps and
// it counts as 3 actions against the user's monthly allowance.
const TR_MAX_PAGES = Number(process.env.AI_TR_MAX_PAGES || 30);
const TR_MAX_CHARS = Number(process.env.AI_TR_MAX_CHARS || 90000);
const TR_BATCH_CHARS = Number(process.env.AI_TR_BATCH_CHARS || 7000);
const TR_WEIGHT = Number(process.env.AI_TR_WEIGHT || 3);
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 45000);
const AI_ENABLED = process.env.AI_ENABLED === 'true';
// Owner accounts may use AI in prod before the public flip, to test — mirrors the
// front-end PRO_EMAILS list. The owner sets the API key over their own SSH.
const OWNER_EMAILS = (process.env.AI_OWNER_EMAILS || 'maniprabhamca@gmail.com,mrmanigandan@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const hasKey = () => !!process.env.ANTHROPIC_API_KEY;

// Identify the caller: plan + whether they're the owner (for the pre-launch test path).
async function whoIs(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return { plan: null, email: null, userId: null, isOwner: false };
  try {
    const decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    const { rows } = await db.query('SELECT plan, email FROM users WHERE id = $1', [decoded.userId]);
    const email = rows[0] ? String(rows[0].email || '').toLowerCase() : null;
    return { plan: rows[0] ? rows[0].plan : null, email, userId: decoded.userId, isOwner: !!email && OWNER_EMAILS.includes(email) };
  } catch { return { plan: null, email: null, userId: null, isOwner: false }; }
}

// The shared front door for every AI endpoint: availability → Pro gate → budget.
// Returns { who, capKey, remaining } or null (response already sent).
async function preflight(req, res, { weight = 1, proMessage } = {}) {
  if (!hasKey()) { res.status(503).json({ error: 'coming-soon', message: 'AI tools are coming soon.' }); return null; }
  const who = await whoIs(req);
  if (!AI_ENABLED && !who.isOwner) { res.status(503).json({ error: 'coming-soon', message: 'AI tools are coming soon.' }); return null; }
  const isPro = who.plan === 'pro' || who.isOwner;
  if (!isPro) { res.status(402).json({ error: 'pro-required', message: proMessage || 'This is a Pro feature.' }); return null; }
  const capKey = who.userId || clientKey(req);
  const cap = await budget.check(capKey, weight);
  if (!cap.ok) { res.status(429).json({ error: cap.reason, message: cap.message, ...(cap.extra || {}) }); return null; }
  return { who, capKey, remaining: cap.remaining };
}

// One Claude call. Returns { ok, text, usage } or { ok:false }.
async function callClaude(system, messages, maxTokens) {
  const r = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    console.error('anthropic error', r.status, detail.slice(0, 300));
    return { ok: false };
  }
  const data = await r.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  return { ok: true, text, usage: data.usage || {} };
}

// Sanitize page-tagged text blocks from the client into a bounded context string.
function packContext(list, maxChars, perBlock = 4000) {
  const blocks = Array.isArray(list) ? list : [];
  let ctx = '';
  for (const s of blocks) {
    const page = Number(s && s.page) || 0;
    const text = String((s && s.text) || '').slice(0, perBlock).trim();
    if (!text) continue; // an empty page must not defeat the no-context check
    const block = `[Page ${page}]\n${text}\n\n`;
    if (ctx.length + block.length > maxChars) break;
    ctx += block;
  }
  return ctx;
}

// Claude is asked for strict JSON; be forgiving about fences/prose around it.
function parseJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}

// A short free-text option (language name, tone, focus…) — never let it become
// a prompt-injection vector or a novel: strip control chars, cap the length.
const opt = (v, max = 120) => String(v || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

const FAIL = { error: 'ai-failed', message: 'The assistant is unavailable right now — please try again.' };

// AI calls cost money — a tight per-client burst limit on top of the daily caps.
router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyGenerator: clientKey,
  store: makeStore('rl:ai:'),
  skip: (req) => redisDown() || isCanaryReq(req),
  message: { error: 'rate', message: 'Too many requests at once — give it a second.' },
}));

// ---------------------------------------------------------------------------
// Chat with PDF (unchanged behaviour, now on the shared plumbing)
// ---------------------------------------------------------------------------
const CHAT_SYSTEM = "You are DiemDesk's document assistant. Answer the user's question using ONLY the document excerpts provided below — each is tagged with the page it came from. When you use an excerpt, cite its page like \"(p.3)\". If the answer is not in the excerpts, say you couldn't find it in the document rather than guessing. Be concise, accurate and plain-spoken; never invent figures, dates or names.";

router.post('/chat', guard('/chat-pdf'), async (req, res) => {
  const { question, context, history } = req.body || {};
  if (typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'no-question', message: 'Please ask a question.' });
  }
  const ctx = packContext(context, MAX_CONTEXT_CHARS);
  if (!ctx.trim()) return res.status(400).json({ error: 'no-context', message: 'No document text was provided.' });

  const pre = await preflight(req, res, { proMessage: 'Chat with PDF is a Pro feature.' });
  if (!pre) return;

  const messages = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-4)) {
      if (h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string') {
        messages.push({ role: h.role, content: h.content.slice(0, 2000) });
      }
    }
  }
  messages.push({ role: 'user', content: `Document excerpts:\n\n${ctx}\nQuestion: ${question.trim()}` });

  try {
    const r = await callClaude(CHAT_SYSTEM, messages, MAX_TOKENS);
    if (!r.ok) return res.status(502).json(FAIL);
    await budget.record(pre.capKey, r.usage.input_tokens || 0, r.usage.output_tokens || 0);
    // Usage signal only — never the question or the answer (privacy).
    trackEvent(req, 'ai_chat', { module: '/chat-pdf', userId: pre.who.userId });
    return res.json({
      answer: r.text || "I couldn't find an answer to that in the document.",
      remaining: pre.remaining != null ? Math.max(0, pre.remaining - 1) : null,
    });
  } catch (e) {
    console.error('ai chat error:', e.message);
    return res.status(502).json(FAIL);
  }
});

// ---------------------------------------------------------------------------
// Summarize — page-cited summary + key points, with audience/language/focus
// ---------------------------------------------------------------------------
const SUM_SYSTEM = "You are DiemDesk's document summarizer. Work ONLY from the page-tagged document excerpts provided. Every claim in the summary must cite the page it came from, inline, like \"(p.3)\". Never invent figures, dates or names; if the excerpts are partial, summarize what is there without guessing the rest. Structure the summary for reading: separate paragraphs (or sections/bullets when that format is requested) with \\n\\n in the summary string — keep each paragraph to 2-4 sentences, never one unbroken wall of text. Bold the pivotal figures, names and dates with **double asterisks** (a handful per paragraph, not everything) so the summary scans at a glance. Respond with STRICT JSON only, no prose around it: {\"summary\": string, \"keyPoints\": [{\"text\": string, \"page\": number}]} — keyPoints are the 3-8 most important takeaways, each with the page number it came from.";

const SUM_LENGTH = {
  tldr: { words: 'in 2-3 sentences (a TL;DR)', tokens: 400 },
  standard: { words: 'in one solid paragraph-sized summary (~150-250 words)', tokens: 800 },
  detailed: { words: 'thoroughly (~400-600 words), covering every major section', tokens: 1600 },
};
const SUM_FORMAT = {
  paragraphs: 'flowing paragraphs',
  bullets: 'concise bullet points (one per line, starting with "- ")',
  brief: 'an executive brief: one bold opening takeaway sentence, then short paragraphs a busy executive can scan',
  sections: 'section-by-section: a short heading per document section, each followed by its 1-3 sentence summary',
};
const SUM_AUDIENCE = {
  general: 'a general reader',
  simple: 'someone with no background in the subject — plain everyday words, explain any jargon in brackets',
  professional: 'a business professional — precise, action-oriented',
  technical: 'a technical expert — keep the domain terminology and exact figures',
};

router.post('/summarize', guard('/summarize-pdf'), async (req, res) => {
  const { context, length, format, audience, language, focus } = req.body || {};
  const ctx = packContext(context, SUM_MAX_CHARS);
  if (!ctx.trim()) return res.status(400).json({ error: 'no-context', message: 'No document text was provided.' });

  const pre = await preflight(req, res, { proMessage: 'Summarize PDF is a Pro feature.' });
  if (!pre) return;

  const len = SUM_LENGTH[length] || SUM_LENGTH.standard;
  const fmt = SUM_FORMAT[format] || SUM_FORMAT.paragraphs;
  const aud = SUM_AUDIENCE[audience] || SUM_AUDIENCE.general;
  const lang = opt(language, 40);
  const foc = opt(focus, 200);

  const ask = [
    `Summarize the document ${len.words}, written as ${fmt}, for ${aud}.`,
    lang && lang.toLowerCase() !== 'same as document' ? `Write the summary and key points in ${lang}.` : '',
    foc ? `Pay special attention to: ${foc}.` : '',
  ].filter(Boolean).join(' ');

  try {
    const r = await callClaude(SUM_SYSTEM, [{ role: 'user', content: `Document excerpts:\n\n${ctx}\nTask: ${ask}` }], len.tokens);
    if (!r.ok) return res.status(502).json(FAIL);
    const parsed = parseJson(r.text);
    const summary = parsed && typeof parsed.summary === 'string' ? parsed.summary : r.text;
    const keyPoints = parsed && Array.isArray(parsed.keyPoints)
      ? parsed.keyPoints.filter((k) => k && typeof k.text === 'string').map((k) => ({ text: k.text, page: Number(k.page) || 0 })).slice(0, 10)
      : [];
    await budget.record(pre.capKey, r.usage.input_tokens || 0, r.usage.output_tokens || 0);
    trackEvent(req, 'ai_summarize', { module: '/summarize-pdf', userId: pre.who.userId });
    return res.json({ summary, keyPoints, remaining: pre.remaining != null ? Math.max(0, pre.remaining - 1) : null });
  } catch (e) {
    console.error('ai summarize error:', e.message);
    return res.status(502).json(FAIL);
  }
});

// ---------------------------------------------------------------------------
// Translate — page-by-page, tone + glossary + translator notes
// ---------------------------------------------------------------------------
const TR_SYSTEM = "You are DiemDesk's document translator. Translate each page's text faithfully — keep numbering, clause references and structure; translate meaning, never summarize or omit. PRESERVE THE LINE STRUCTURE: the input uses \\n for line breaks — labels, forms, lists and headings must keep one output line per input line (use \\n in the translation string); only join lines that are clearly one wrapped sentence. Respond with STRICT JSON only: {\"pages\": [{\"page\": number, \"translation\": string, \"notes\": [string]}]} — one entry per input page, in order. \"notes\" flags genuinely ambiguous terms where the target language forces a choice (explain the alternatives in one short sentence each); leave it an empty array when nothing is ambiguous. Do not add commentary anywhere else.";

router.post('/translate', guard('/translate-pdf'), async (req, res) => {
  const { pages, to, from, tone, glossary, notes } = req.body || {};
  const list = (Array.isArray(pages) ? pages : [])
    .map((p) => ({ page: Number(p && p.page) || 0, text: String((p && p.text) || '').slice(0, 8000) }))
    .filter((p) => p.text.trim());
  if (!list.length) return res.status(400).json({ error: 'no-context', message: 'No document text was provided.' });
  if (list.length > TR_MAX_PAGES) {
    return res.status(400).json({ error: 'too-long', message: `Translate handles up to ${TR_MAX_PAGES} pages per run — split the document first.` });
  }
  const totalChars = list.reduce((n, p) => n + p.text.length, 0);
  if (totalChars > TR_MAX_CHARS) {
    return res.status(400).json({ error: 'too-long', message: 'That document has too much text for one run — split it and translate the parts.' });
  }
  const target = opt(to, 40);
  if (!target) return res.status(400).json({ error: 'no-language', message: 'Pick a language to translate into.' });

  const pre = await preflight(req, res, { weight: TR_WEIGHT, proMessage: 'Translate PDF is a Pro feature.' });
  if (!pre) return;

  const src = opt(from, 40);
  const toneTxt = tone === 'formal' ? 'Use a formal register.' : tone === 'informal' ? 'Use an informal, natural register.' : '';
  const gl = opt(glossary, 300);
  const wantNotes = notes !== false;

  const brief = [
    `Translate ${src ? `from ${src} ` : ''}into ${target}.`,
    toneTxt,
    gl ? `Do NOT translate these terms — keep them exactly as written: ${gl}.` : '',
    wantNotes ? '' : 'Leave every "notes" array empty.',
  ].filter(Boolean).join(' ');

  // Batch pages so each Claude call stays small; sequential keeps order + lets us
  // stop on the first failure without burning the rest of the budget.
  const batches = [];
  let cur = [];
  let curChars = 0;
  for (const p of list) {
    if (cur.length && curChars + p.text.length > TR_BATCH_CHARS) { batches.push(cur); cur = []; curChars = 0; }
    cur.push(p); curChars += p.text.length;
  }
  if (cur.length) batches.push(cur);

  try {
    const out = [];
    let inTok = 0;
    let outTok = 0;
    for (const batch of batches) {
      const body = batch.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n');
      const maxT = Math.min(8000, Math.round(batch.reduce((n, p) => n + p.text.length, 0) / 2.2) + 600);
      const r = await callClaude(TR_SYSTEM, [{ role: 'user', content: `${brief}\n\nPages:\n\n${body}` }], maxT);
      if (!r.ok) return res.status(502).json(FAIL);
      inTok += r.usage.input_tokens || 0;
      outTok += r.usage.output_tokens || 0;
      const parsed = parseJson(r.text);
      const got = parsed && Array.isArray(parsed.pages) ? parsed.pages : null;
      if (!got) return res.status(502).json(FAIL);
      for (const g of got) {
        out.push({
          page: Number(g && g.page) || 0,
          translation: String((g && g.translation) || ''),
          notes: (Array.isArray(g && g.notes) ? g.notes : []).map((n) => String(n)).slice(0, 5),
        });
      }
    }
    await budget.record(pre.capKey, inTok, outTok, TR_WEIGHT);
    trackEvent(req, 'ai_translate', { module: '/translate-pdf', userId: pre.who.userId });
    return res.json({ pages: out, remaining: pre.remaining != null ? Math.max(0, pre.remaining - TR_WEIGHT) : null });
  } catch (e) {
    console.error('ai translate error:', e.message);
    return res.status(502).json(FAIL);
  }
});

// ---------------------------------------------------------------------------
// Question generator — types, difficulty, Bloom's level, explanations
// ---------------------------------------------------------------------------
const Q_SYSTEM = "You are DiemDesk's study-question generator. Create questions STRICTLY from the page-tagged document excerpts — every question must be answerable from them and must carry the page number its answer comes from. Respond with STRICT JSON only: {\"questions\": [{\"type\": \"mcq\"|\"tf\"|\"blank\"|\"flash\"|\"open\", \"q\": string, \"options\": [string] (mcq only, exactly 4), \"answerIndex\": number (mcq only, 0-3), \"answer\": string (all other types; for tf exactly \"True\" or \"False\"), \"explanation\": string (one sentence: why this answer is right), \"bloom\": \"recall\"|\"understand\"|\"apply\"|\"analyze\", \"page\": number}]}. For fill-in-the-blank, write the sentence with ____ for the missing term. Never invent facts not in the excerpts.";

const Q_TYPES = new Set(['mcq', 'tf', 'blank', 'flash', 'open', 'mixed']);
const Q_BLOOM = new Set(['any', 'recall', 'understand', 'apply', 'analyze']);

router.post('/questions', guard('/pdf-question-generator'), async (req, res) => {
  const { context, type, count, difficulty, bloom, explanations } = req.body || {};
  const ctx = packContext(context, SUM_MAX_CHARS);
  if (!ctx.trim()) return res.status(400).json({ error: 'no-context', message: 'No document text was provided.' });

  const pre = await preflight(req, res, { proMessage: 'The question generator is a Pro feature.' });
  if (!pre) return;

  const qType = Q_TYPES.has(type) ? type : 'mcq';
  const n = Math.max(1, Math.min(30, Number(count) || 10));
  const diff = difficulty === 'easy' ? 'easy' : difficulty === 'hard' ? 'hard' : 'mixed difficulty';
  const bl = Q_BLOOM.has(bloom) ? bloom : 'any';
  const wantWhy = explanations !== false;

  const typeTxt = {
    mcq: 'multiple-choice questions (4 options each, exactly one correct)',
    tf: 'true/false statements',
    blank: 'fill-in-the-blank sentences',
    flash: 'flashcards (a prompt on the front, the answer on the back — use "q" for front, "answer" for back)',
    open: 'open questions that need a short written answer',
    mixed: 'a varied mix of multiple-choice, true/false, fill-in-the-blank and open questions',
  }[qType];

  const ask = [
    `Create ${n} ${diff} ${typeTxt} from the document.`,
    bl !== 'any' ? `Target the "${bl}" thinking level (Bloom's taxonomy) for every question.` : 'Vary the thinking level across recall, understand, apply and analyze.',
    wantWhy ? 'Include the one-sentence explanation for every question.' : 'Set every "explanation" to an empty string.',
  ].join(' ');

  try {
    const r = await callClaude(Q_SYSTEM, [{ role: 'user', content: `Document excerpts:\n\n${ctx}\nTask: ${ask}` }], Math.min(6000, 300 + n * 180));
    if (!r.ok) return res.status(502).json(FAIL);
    const parsed = parseJson(r.text);
    const raw = parsed && Array.isArray(parsed.questions) ? parsed.questions : null;
    if (!raw || !raw.length) return res.status(502).json(FAIL);
    const questions = raw.slice(0, n).map((it) => {
      const t = Q_TYPES.has(it && it.type) && it.type !== 'mixed' ? it.type : 'open';
      const q = {
        type: t,
        q: String((it && it.q) || '').slice(0, 600),
        answer: String((it && it.answer) || '').slice(0, 600),
        explanation: String((it && it.explanation) || '').slice(0, 400),
        bloom: Q_BLOOM.has(it && it.bloom) ? it.bloom : 'recall',
        page: Number(it && it.page) || 0,
      };
      if (t === 'mcq') {
        q.options = (Array.isArray(it.options) ? it.options : []).map((o) => String(o).slice(0, 300)).slice(0, 4);
        q.answerIndex = Math.max(0, Math.min(3, Number(it.answerIndex) || 0));
        if (q.options.length !== 4) return null; // malformed → drop
      }
      return q.q ? q : null;
    }).filter(Boolean);
    if (!questions.length) return res.status(502).json(FAIL);
    await budget.record(pre.capKey, r.usage.input_tokens || 0, r.usage.output_tokens || 0);
    trackEvent(req, 'ai_questions', { module: '/pdf-question-generator', userId: pre.who.userId });
    return res.json({ questions, remaining: pre.remaining != null ? Math.max(0, pre.remaining - 1) : null });
  } catch (e) {
    console.error('ai questions error:', e.message);
    return res.status(502).json(FAIL);
  }
});

// ---------------------------------------------------------------------------
// PDF→Excel AI clean-up — fixes the grid's STRUCTURE, never its values
// ---------------------------------------------------------------------------
const CLEAN_SYSTEM = "You are DiemDesk's table-structure fixer. You receive a table extracted from a PDF as JSON rows (arrays of cell strings). The extraction sometimes merges a title line into a single-cell row, splits one logical column in two, merges two columns into one cell, or misaligns cells. Fix ONLY the structure: every VALUE must be preserved exactly as given — never invent, drop, translate, reformat or recalculate data. Keep a heading row as the first row if one exists; remove pure title/caption lines that are not part of the table. Make every row the same number of columns. Respond with STRICT JSON only: {\"rows\": [[string]]}.";

router.post('/table-cleanup', guard('/pdf-to-excel'), async (req, res) => {
  const raw = Array.isArray(req.body && req.body.rows) ? req.body.rows : null;
  if (!raw || !raw.length) return res.status(400).json({ error: 'no-table', message: 'No table data was provided.' });
  const rows = raw.slice(0, 300).map((r) => (Array.isArray(r) ? r.slice(0, 30).map((c) => String(c == null ? '' : c).slice(0, 300)) : []));
  const payload = JSON.stringify(rows);
  if (payload.length > 30000) {
    return res.status(400).json({ error: 'too-long', message: 'That table is too large for AI clean-up — export it as-is or split the document first.' });
  }

  const pre = await preflight(req, res, { proMessage: 'AI clean-up is a Pro feature.' });
  if (!pre) return;

  try {
    const r = await callClaude(CLEAN_SYSTEM, [{ role: 'user', content: `Table rows:\n${payload}` }], Math.min(8000, Math.round(payload.length / 2) + 600));
    if (!r.ok) return res.status(502).json(FAIL);
    const parsed = parseJson(r.text);
    const out = parsed && Array.isArray(parsed.rows)
      ? parsed.rows.filter(Array.isArray).map((rw) => rw.map((c) => String(c == null ? '' : c))).filter((rw) => rw.length)
      : null;
    if (!out || !out.length) return res.status(502).json(FAIL);
    await budget.record(pre.capKey, r.usage.input_tokens || 0, r.usage.output_tokens || 0);
    trackEvent(req, 'ai_table_cleanup', { module: '/pdf-to-excel', userId: pre.who.userId });
    return res.json({ rows: out, remaining: pre.remaining != null ? Math.max(0, pre.remaining - 1) : null });
  } catch (e) {
    console.error('ai cleanup error:', e.message);
    return res.status(502).json(FAIL);
  }
});

// ---------------------------------------------------------------------------
// Natural-language ⌘K — maps a typed phrase to ONE existing command or tool.
// Strictly constrained: the model may only answer with ids/hrefs the client
// listed, the server re-validates, and the client runs NOTHING without a
// further explicit user activation of the resolved row.
// ---------------------------------------------------------------------------
const CMD_SYSTEM = "You are DiemDesk's command interpreter. The user typed a natural-language request into the app's command palette. You get the available in-tool COMMANDS (id — label) and TOOLS (href — name). Pick the SINGLE best match for the request. Respond with STRICT JSON only: {\"kind\": \"cmd\"|\"tool\"|\"none\", \"id\": string|null, \"why\": string (under 10 words, plain-spoken)} — for kind cmd, id is the command id; for kind tool, id is the tool href; use kind \"none\" when nothing genuinely matches. NEVER output an id that is not in the lists. Prefer an in-tool command over switching tools when both fit.";

router.post('/command', guard('/ai-command'), async (req, res) => {
  const utterance = opt(req.body && req.body.utterance, 200);
  if (!utterance) return res.status(400).json({ error: 'no-utterance', message: 'Type what you want to do.' });
  const cmds = (Array.isArray(req.body && req.body.commands) ? req.body.commands : []).slice(0, 40)
    .map((c) => ({ id: opt(c && c.id, 60), label: opt(c && c.label, 90), keywords: opt(c && c.keywords, 90) }))
    .filter((c) => c.id && c.label);
  const toolList = (Array.isArray(req.body && req.body.tools) ? req.body.tools : []).slice(0, 100)
    .map((t) => ({ href: opt(t && t.href, 60), name: opt(t && t.name, 60) }))
    .filter((t) => t.href && t.name);

  const pre = await preflight(req, res, { proMessage: 'Natural-language commands are a Pro feature.' });
  if (!pre) return;

  try {
    const listing = `COMMANDS:\n${cmds.map((c) => `${c.id} — ${c.label}${c.keywords ? ` (${c.keywords})` : ''}`).join('\n') || '(none)'}\n\nTOOLS:\n${toolList.map((t) => `${t.href} — ${t.name}`).join('\n') || '(none)'}`;
    const r = await callClaude(CMD_SYSTEM, [{ role: 'user', content: `${listing}\n\nUser request: ${utterance}` }], 200);
    if (!r.ok) return res.status(502).json(FAIL);
    const parsed = parseJson(r.text) || {};
    let kind = parsed.kind === 'cmd' || parsed.kind === 'tool' ? parsed.kind : 'none';
    let id = typeof parsed.id === 'string' ? parsed.id : null;
    if (kind === 'cmd' && !cmds.some((c) => c.id === id)) { kind = 'none'; id = null; }
    if (kind === 'tool' && !toolList.some((t) => t.href === id)) { kind = 'none'; id = null; }
    await budget.record(pre.capKey, r.usage.input_tokens || 0, r.usage.output_tokens || 0);
    trackEvent(req, 'ai_command', { module: '/ai-command', userId: pre.who.userId });
    return res.json({ kind, id, why: String(parsed.why || '').slice(0, 120), remaining: pre.remaining != null ? Math.max(0, pre.remaining - 1) : null });
  } catch (e) {
    console.error('ai command error:', e.message);
    return res.status(502).json(FAIL);
  }
});

// ---------------------------------------------------------------------------
// AI redact-scan — FINDS personal info; the browser draws the boxes and the
// on-device engine burns them. The AI only points, it never redacts.
// ---------------------------------------------------------------------------
const RED_SYSTEM = "You are DiemDesk's personal-information finder. Scan the page-tagged document text for PII: person names, email addresses, phone numbers, physical addresses, government IDs (SSN, passport, Aadhaar, PAN, driver's licence), bank/card/account numbers, dates of birth, and login credentials. Respond with STRICT JSON only: {\"findings\": [{\"page\": number, \"quote\": string, \"type\": \"name\"|\"email\"|\"phone\"|\"address\"|\"id\"|\"account\"|\"dob\"|\"credential\"|\"other\", \"reason\": string (short phrase)}]}. CRITICAL: each \"quote\" must be COPIED VERBATIM from the text (exact characters, 1-8 words) so software can locate it on the page — never paraphrase, never merge two occurrences. List each distinct value once per page it appears on. Do not flag generic role words (\"the customer\") or company names acting as businesses.";

const RED_TYPES = new Set(['name', 'email', 'phone', 'address', 'id', 'account', 'dob', 'credential', 'other']);

router.post('/redact-scan', guard('/redact-pdf'), async (req, res) => {
  const ctx = packContext(req.body && req.body.pages, Number(process.env.AI_RED_MAX_CHARS || 40000));
  if (!ctx.trim()) return res.status(400).json({ error: 'no-context', message: 'No document text was provided.' });

  const pre = await preflight(req, res, { proMessage: 'AI find-personal-info is a Pro feature.' });
  if (!pre) return;

  try {
    const r = await callClaude(RED_SYSTEM, [{ role: 'user', content: `Document text:\n\n${ctx}` }], 3000);
    if (!r.ok) return res.status(502).json(FAIL);
    const parsed = parseJson(r.text);
    // Dedupe on (page + normalized quote) — the model sometimes lists a value
    // once per OCCURRENCE despite the once-per-page instruction, which showed
    // the owner a list full of repeated names.
    const seen = new Set();
    const findings = (parsed && Array.isArray(parsed.findings) ? parsed.findings : [])
      .map((f) => ({
        page: Number(f && f.page) || 0,
        quote: String((f && f.quote) || '').slice(0, 200),
        type: RED_TYPES.has(f && f.type) ? f.type : 'other',
        reason: String((f && f.reason) || '').slice(0, 120),
      }))
      .filter((f) => {
        if (!(f.page > 0 && f.quote.trim().length >= 2)) return false;
        const k = `${f.page}:${f.quote.toLowerCase().replace(/\s+/g, ' ').trim()}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 80);
    await budget.record(pre.capKey, r.usage.input_tokens || 0, r.usage.output_tokens || 0);
    trackEvent(req, 'ai_redact_scan', { module: '/redact-pdf', userId: pre.who.userId });
    return res.json({ findings, remaining: pre.remaining != null ? Math.max(0, pre.remaining - 1) : null });
  } catch (e) {
    console.error('ai redact-scan error:', e.message);
    return res.status(502).json(FAIL);
  }
});

// ---------------------------------------------------------------------------
// Semantic compare — what changed in MEANING between two versions
// ---------------------------------------------------------------------------
const CMP_SYSTEM = "You are DiemDesk's document comparer. You get two versions of a document (A = original, B = updated) as page-tagged text. Report what changed IN MEANING — renegotiated amounts, shifted dates, added or removed obligations, changed parties, scope or conditions — not cosmetic rewording. Work ONLY from the provided text; never invent. Respond with STRICT JSON only: {\"verdict\": string (one plain-spoken sentence: what happened overall), \"differences\": [{\"kind\": \"added\"|\"removed\"|\"changed\", \"topic\": string (2-5 words), \"detail\": string (one sentence; quote the old and new value when relevant), \"pageA\": number|null, \"pageB\": number|null, \"severity\": \"minor\"|\"notable\"|\"critical\"}]} — most important first. If the versions are effectively identical in meaning, return an empty differences array.";

const CMP_KINDS = new Set(['added', 'removed', 'changed']);
const CMP_SEV = new Set(['minor', 'notable', 'critical']);

router.post('/compare', guard('/compare-pdf'), async (req, res) => {
  const a = packContext(req.body && req.body.a, 20000);
  const b = packContext(req.body && req.body.b, 20000);
  if (!a.trim() || !b.trim()) return res.status(400).json({ error: 'no-context', message: 'Both documents need selectable text.' });

  // Two documents in one call — counts as 2 actions, like translate's weighting.
  const pre = await preflight(req, res, { weight: 2, proMessage: 'AI meaning compare is a Pro feature.' });
  if (!pre) return;

  try {
    const r = await callClaude(CMP_SYSTEM, [{ role: 'user', content: `DOCUMENT A (original):\n\n${a}\nDOCUMENT B (updated):\n\n${b}` }], 2500);
    if (!r.ok) return res.status(502).json(FAIL);
    const parsed = parseJson(r.text);
    if (!parsed || typeof parsed.verdict !== 'string') return res.status(502).json(FAIL);
    const differences = (Array.isArray(parsed.differences) ? parsed.differences : []).map((d) => ({
      kind: CMP_KINDS.has(d && d.kind) ? d.kind : 'changed',
      topic: String((d && d.topic) || '').slice(0, 80),
      detail: String((d && d.detail) || '').slice(0, 500),
      pageA: Number(d && d.pageA) || null,
      pageB: Number(d && d.pageB) || null,
      severity: CMP_SEV.has(d && d.severity) ? d.severity : 'notable',
    })).filter((d) => d.detail).slice(0, 30);
    await budget.record(pre.capKey, r.usage.input_tokens || 0, r.usage.output_tokens || 0, 2);
    trackEvent(req, 'ai_compare', { module: '/compare-pdf', userId: pre.who.userId });
    return res.json({ verdict: parsed.verdict.slice(0, 400), differences, remaining: pre.remaining != null ? Math.max(0, pre.remaining - 2) : null });
  } catch (e) {
    console.error('ai compare error:', e.message);
    return res.status(502).json(FAIL);
  }
});

module.exports = router;
