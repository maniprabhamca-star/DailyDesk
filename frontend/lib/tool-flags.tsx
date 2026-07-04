'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

// Per-tool status controlled from the admin dashboard. Missing = 'enabled'.
export type ToolStatus = 'enabled' | 'coming_soon' | 'pro' | 'disabled';
type FlagMap = Record<string, ToolStatus>;

const Ctx = createContext<FlagMap>({});

// Fetches the (small) flag map once and shares it site-wide. Fail-open: on any
// error the map stays empty → every tool renders enabled, so this can never take
// the site down.
export function ToolFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FlagMap>({});
  useEffect(() => {
    api.get('/api/tools/flags').then((r) => setFlags((r?.flags as FlagMap) || {})).catch(() => {});
  }, []);
  return <Ctx.Provider value={flags}>{children}</Ctx.Provider>;
}

export function useToolStatus(slug?: string | null): ToolStatus {
  const flags = useContext(Ctx);
  if (!slug) return 'enabled';
  return flags[slug] || 'enabled';
}
