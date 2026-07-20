// Shared client plumbing for the AI document tools (Summarize / Translate /
// Questions). Extraction itself lives in lib/pdf-chat.ts — these helpers turn
// its chunks into page-level payloads, cap what we send, and talk to the API
// with consistent error mapping.
import type { Chunk } from './pdf-chat';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export type PageText = { page: number; text: string };

// Rebuild whole-page texts from the retrieval chunks.
export function pagesFromChunks(chunks: Chunk[]): PageText[] {
  const map = new Map<number, string[]>();
  for (const c of chunks) {
    const arr = map.get(c.page) || [];
    arr.push(c.text);
    map.set(c.page, arr);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([page, parts]) => ({ page, text: parts.join('\n') }));
}

// Cap the payload for summarize/questions. If the document is bigger than the
// budget, sample chunks evenly across it (and say so — `sampled` drives an
// honest note in the UI, never a silent truncation).
export function packForContext(chunks: Chunk[], maxChars = 55000): { context: PageText[]; sampled: boolean } {
  const total = chunks.reduce((n, c) => n + c.text.length, 0);
  if (total <= maxChars) return { context: pagesFromChunks(chunks), sampled: false };
  const keep: Chunk[] = [];
  let used = 0;
  const step = total / maxChars; // >1
  let acc = 0;
  for (const c of chunks) {
    acc += 1;
    if (acc >= step) {
      acc -= step;
      if (used + c.text.length > maxChars) break;
      keep.push(c);
      used += c.text.length;
    }
  }
  if (!keep.length) keep.push(...chunks.slice(0, 3));
  return { context: pagesFromChunks(keep), sampled: true };
}

export type AiResult<T> = { ok: boolean; data?: T; message?: string; code?: string };

// POST to an AI endpoint with the session token; map the well-known errors to
// friendly copy once, here, instead of in every tool.
export async function aiPost<T>(path: string, body: unknown): Promise<AiResult<T>> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null;
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = String(data.error || 'ai-failed');
      const message =
        code === 'coming-soon' ? "This AI tool isn't switched on yet — it's coming with Pro."
        : code === 'pro-required' ? 'This is a Pro feature. Upgrade to use the AI tools.'
        : String(data.message || 'The assistant is unavailable right now — please try again.');
      return { ok: false, message, code };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, message: 'Network error — please try again.', code: 'network' };
  }
}

export const AI_FALLBACK_MSG = 'The assistant is unavailable right now — please try again.';

// Target/output languages, India-first after English (matches the mockup).
export const AI_LANGUAGES = [
  'English', 'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Bengali', 'Marathi', 'Gujarati',
  'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Dutch', 'Polish', 'Turkish', 'Russian', 'Ukrainian',
  'Arabic', 'Chinese (Simplified)', 'Chinese (Traditional)', 'Japanese', 'Korean', 'Vietnamese', 'Thai',
  'Indonesian', 'Malay', 'Filipino', 'Swahili', 'Urdu', 'Punjabi',
];
