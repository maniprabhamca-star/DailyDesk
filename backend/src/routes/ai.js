// AI — "Chat with PDF": answer questions about a document the user is reading.
//
// PRIVACY (the honest exception): every other DiemDesk tool is 100% on-device.
// This one isn't — but the FILE is still never uploaded. The browser extracts the
// text with pdf.js and sends only the SNIPPETS relevant to each question. We
// forward those to Claude and return the answer. Nothing is stored, nothing is
// logged as content, and we don't train on it.
//
// COST: this is our only per-use AI cost, so it's Pro-gated and wrapped in hard
// controls (utils/aiBudget) — a per-user daily cap AND a global daily USD budget
// kill-switch pegged to revenue. Model = Claude Haiku (cheapest capable). Until the
// owner sets ANTHROPIC_API_KEY (and flips AI_ENABLED), the endpoint reports
// "coming-soon" so the feature can ship dark and be turned on at Pro launch.
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
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 45000);
const AI_ENABLED = process.env.AI_ENABLED === 'true';
// Owner accounts may use AI in prod before the public flip, to test — mirrors the
// front-end PRO_EMAILS list. The owner sets the API key over their own SSH.
const OWNER_EMAILS = (process.env.AI_OWNER_EMAILS || 'maniprabhamca@gmail.com,mrmanigandan@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const hasKey = () => !!process.env.ANTHROPIC_API_KEY;

const SYSTEM = "You are DiemDesk's document assistant. Answer the user's question using ONLY the document excerpts provided below — each is tagged with the page it came from. When you use an excerpt, cite its page like \"(p.3)\". If the answer is not in the excerpts, say you couldn't find it in the document rather than guessing. Be concise, accurate and plain-spoken; never invent figures, dates or names.";

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

// AI calls cost money — a tight per-client burst limit on top of the daily caps.
router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyGenerator: clientKey,
  store: makeStore('rl:ai:'),
  skip: (req) => redisDown() || isCanaryReq(req),
  message: { error: 'rate', message: 'Too many questions at once — give it a second.' },
}));

// Admin kill-switch for the tool (matches the hidden front-end button).
router.use(guard('/chat-pdf'));

router.post('/chat', async (req, res) => {
  // 1) Availability — dark until the owner provides a key (+ flips AI_ENABLED for public).
  if (!hasKey()) return res.status(503).json({ error: 'coming-soon', message: 'AI chat is coming soon.' });
  const who = await whoIs(req);
  if (!AI_ENABLED && !who.isOwner) return res.status(503).json({ error: 'coming-soon', message: 'AI chat is coming soon.' });

  // 2) Pro gate (owner bypasses for pre-launch testing).
  const isPro = who.plan === 'pro' || who.isOwner;
  if (!isPro) return res.status(402).json({ error: 'pro-required', message: 'Chat with PDF is a Pro feature.' });

  // 3) Validate input — only text snippets, never a file.
  const { question, context, history } = req.body || {};
  if (typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'no-question', message: 'Please ask a question.' });
  }
  const snippets = Array.isArray(context) ? context : [];
  let ctx = '';
  for (const s of snippets) {
    const page = Number(s && s.page) || 0;
    const text = String((s && s.text) || '').slice(0, 4000);
    const block = `[Page ${page}]\n${text}\n\n`;
    if (ctx.length + block.length > MAX_CONTEXT_CHARS) break;
    ctx += block;
  }
  if (!ctx.trim()) return res.status(400).json({ error: 'no-context', message: 'No document text was provided.' });

  // 4) Cost controls — per-user daily cap + global budget kill-switch.
  const capKey = who.userId || clientKey(req);
  const cap = await budget.check(capKey);
  if (!cap.ok) return res.status(429).json({ error: cap.reason, message: cap.message, ...(cap.extra || {}) });

  // 5) Build the messages (short prior history for follow-ups) and call Claude.
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
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM, messages }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('anthropic error', r.status, detail.slice(0, 300));
      return res.status(502).json({ error: 'ai-failed', message: 'The assistant is unavailable right now — please try again.' });
    }
    const data = await r.json();
    const answer = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    const usage = data.usage || {};
    await budget.record(capKey, usage.input_tokens || 0, usage.output_tokens || 0);
    // Usage signal only — never the question or the answer (privacy).
    trackEvent(req, 'ai_chat', { module: '/chat-pdf', userId: who.userId });
    return res.json({
      answer: answer || "I couldn't find an answer to that in the document.",
      remaining: cap.remaining != null ? Math.max(0, cap.remaining - 1) : null,
    });
  } catch (e) {
    console.error('ai chat error:', e.message);
    return res.status(502).json({ error: 'ai-failed', message: 'The assistant is unavailable right now — please try again.' });
  }
});

module.exports = router;
