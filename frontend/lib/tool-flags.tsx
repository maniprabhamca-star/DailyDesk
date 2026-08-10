'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

// Per-tool status controlled from the admin dashboard. Missing = 'enabled'.
export type ToolStatus = 'enabled' | 'coming_soon' | 'pro' | 'disabled';
type FlagMap = Record<string, ToolStatus>;

// Exported so the E2E suite can derive the gated-route list from the app itself
// rather than a hand-maintained copy that drifts (see REG-111).
export const DEFAULT_TOOL_FLAGS: FlagMap = {
  '/edit-pdf': 'coming_soon',
  // Saved Workflows — Pro, owner-only until Pro launch.
  '/workflows': 'coming_soon',
  // Premium editors + OCR: owner-only until Pro launch (they were reachable by
  // direct URL though the catalog marks them "coming soon" — this closes that gap).
  '/annotate-pdf': 'coming_soon',
  '/folder-preview': 'coming_soon',
  '/redact-pdf': 'coming_soon',
  '/ocr-pdf': 'coming_soon',
  // The AI (Pro) tools ship dark: owner-only until the ANTHROPIC_API_KEY is set
  // + Pro billing goes live, then flip each to 'pro'.
  '/chat-pdf': 'coming_soon',
  '/summarize-pdf': 'coming_soon',
  '/translate-pdf': 'coming_soon',
  '/pdf-question-generator': 'coming_soon',
  '/file-vault': 'coming_soon',
  '/link-in-bio': 'coming_soon',
  '/receipt-scanner': 'coming_soon',
  // Bank Statement Converter — the paid flagship. Owner-only until it's been
  // validated against real statements and the Statements pricing/quota is live.
  '/bank-statement-converter': 'coming_soon',
  // Document-command-center tools: owner-only until reviewed + launched.
  '/clean-scanned-pdf': 'coming_soon',
  '/share-safe-pdf-check': 'coming_soon',
  '/compare-pdf': 'coming_soon',
  '/client-packet-builder': 'coming_soon',
  '/html-to-pdf': 'coming_soon',
  '/crop-pdf': 'coming_soon',
  // Shipped 2026-08-06, held owner-only until the owner has click-tested them.
  // Un-gating is three edits: remove the line here, drop `soon: true` in the
  // catalog, and add the route back to sitemap.ts (gated routes stay out).
  '/pdf-to-epub': 'coming_soon',
  '/html-to-excel': 'coming_soon',
  '/video-to-mp3': 'coming_soon',
  '/audio-converter': 'coming_soon',
  // The spreadsheet pack.
  '/excel-to-csv': 'coming_soon',
  '/csv-to-excel': 'coming_soon',
  '/json-to-excel': 'coming_soon',
  '/xml-to-excel': 'coming_soon',
  // The rest of the converter queue.
  '/svg-to-png': 'coming_soon',
  '/svg-to-pdf': 'coming_soon',
  '/epub-to-pdf': 'coming_soon',
  '/pdf-to-text': 'coming_soon',
  '/markdown-to-pdf': 'coming_soon',
  '/subtitle-converter': 'coming_soon',
  '/favicon-generator': 'coming_soon',
};

const Ctx = createContext<FlagMap>(DEFAULT_TOOL_FLAGS);

// Fetches the small flag map once and shares it site-wide. Edit PDF stays hidden
// by default until Pro launch; the admin flag can still enable it when ready.
export function ToolFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FlagMap>(DEFAULT_TOOL_FLAGS);
  useEffect(() => {
    api.get('/api/tools/flags')
      .then((r) => setFlags({ ...DEFAULT_TOOL_FLAGS, ...((r?.flags as FlagMap) || {}) }))
      .catch(() => {});
  }, []);
  return <Ctx.Provider value={flags}>{children}</Ctx.Provider>;
}

export function useToolStatus(slug?: string | null): ToolStatus {
  const flags = useContext(Ctx);
  if (!slug) return 'enabled';
  return flags[slug] || 'enabled';
}
