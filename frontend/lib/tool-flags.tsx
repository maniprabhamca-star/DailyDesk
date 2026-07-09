'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

// Per-tool status controlled from the admin dashboard. Missing = 'enabled'.
export type ToolStatus = 'enabled' | 'coming_soon' | 'pro' | 'disabled';
type FlagMap = Record<string, ToolStatus>;

const DEFAULT_TOOL_FLAGS: FlagMap = {
  '/edit-pdf': 'coming_soon',
  // Document-command-center tools: owner-only until reviewed + launched.
  '/clean-scanned-pdf': 'coming_soon',
  '/share-safe-pdf-check': 'coming_soon',
  '/compare-pdf': 'coming_soon',
  '/client-packet-builder': 'coming_soon',
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
