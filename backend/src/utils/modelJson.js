/**
 * Get the JSON object out of a model's reply.
 *
 * THE BUG THIS EXISTS FOR, because it cost a whole feature silently.
 *
 * The receipt reader asked for JSON and then did this with the answer:
 *
 *     text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
 *
 * which assumes the reply is ENTIRELY JSON, give or take one fence at each
 * end. Models do not promise that, and this one did not deliver it: it
 * returned the object and then kept writing. The trailing fence was no longer
 * at the end of the string so the second replace matched nothing, the prose
 * stayed attached, and `JSON.parse` threw
 *
 *     Unexpected non-whitespace character after JSON at position 269
 *
 * — position 269 being exactly where the object closed. The catch logged it
 * and returned null, the route fell through to plain OCR, and the owner was
 * shown a $113.77 grocery receipt as "₹3, Transport, BY ae er ae", with a
 * Save to Budget button beside it. Every receipt was failing this way.
 *
 * So: do not clean the string up and hope. Find where the object actually
 * starts and ends by reading it, and ignore whatever surrounds it.
 *
 * Strings are tracked because a brace inside one ("Lot {A}", a merchant called
 * "{", an escaped quote before a brace) must not move the depth count — that
 * is the whole reason a regex cannot do this job correctly.
 */

/**
 * The first balanced `{...}` run at or after `from`, or null if the text ends
 * before it closes (a reply truncated by max_tokens does this).
 */
function balancedObject(text, from) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return text.slice(from, i + 1);
  }
  return null;
}

/**
 * Parse the JSON object a model replied with, wherever it sits in the reply.
 *
 * Tolerates a ```json fence, prose before it, prose after it, and a brace that
 * appears in prose ahead of the real object — each `{` is tried in turn, so a
 * false start costs an attempt rather than the answer.
 *
 * Throws with a reason that does NOT contain the reply, because a receipt's
 * contents are the user's and this message goes to a server log. The shape is
 * enough to tell the three failure modes apart: no object at all, an object
 * that never closed (raise max_tokens), or one that closed but was malformed.
 */
function parseModelJson(text) {
  if (typeof text !== 'string' || !text.trim()) {
    const e = new Error('model returned no text');
    e.code = 'empty';
    throw e;
  }
  let searchedAnObject = false;
  let sawUnclosed = false;
  let lastParseError = null;

  for (let i = text.indexOf('{'); i >= 0; i = text.indexOf('{', i + 1)) {
    const candidate = balancedObject(text, i);
    if (!candidate) { sawUnclosed = true; continue; }
    searchedAnObject = true;
    try {
      const out = JSON.parse(candidate);
      // An array or a bare value is not what was asked for; keep looking.
      if (out && typeof out === 'object' && !Array.isArray(out)) return out;
    } catch (err) {
      lastParseError = err.message;
    }
  }

  const e = new Error(
    sawUnclosed && !searchedAnObject
      ? `model JSON never closed (reply ${text.length} chars) — probably cut off by max_tokens`
      : searchedAnObject
        ? `model JSON malformed: ${lastParseError}`
        : `no JSON object in a ${text.length}-char reply`,
  );
  e.code = sawUnclosed && !searchedAnObject ? 'truncated' : searchedAnObject ? 'malformed' : 'absent';
  throw e;
}

module.exports = { parseModelJson, balancedObject };
