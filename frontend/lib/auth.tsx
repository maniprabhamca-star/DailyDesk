'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

export type User = { id: string; name: string; email: string; plan: string };

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Restore session from localStorage on first load.
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dd_user');
      if (stored) setUser(JSON.parse(stored));
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  // Stable identities: these are consumed inside effect dependency lists
  // (e.g. the account page's refreshUser-on-load), so a fresh reference every
  // render would loop the effect and hammer the API.
  const persist = useCallback((token: string, u: User) => {
    localStorage.setItem('dd_token', token);
    localStorage.setItem('dd_user', JSON.stringify(u));
    setUser(u);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password });
    persist(res.token, res.user);
  }, [persist]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.post('/api/auth/register', { name, email, password });
    persist(res.token, res.user);
  }, [persist]);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const res = await api.post('/api/auth/google', { credential });
    persist(res.token, res.user);
  }, [persist]);

  // Signing out must SAY it worked. Clearing state silently left people on
  // whatever page they were on (or bounced to /login by the /account guard) with
  // no idea whether they'd logged out or been kicked out.
  const logout = useCallback(() => {
    localStorage.removeItem('dd_token');
    localStorage.removeItem('dd_user');
    // Tells auth guards this is a deliberate sign-out, so they don't race us to
    // /login. The /logged-out page clears it on arrival.
    try { sessionStorage.setItem('dd_signed_out', '1'); } catch { /* ignore */ }
    setUser(null);
    router.replace('/logged-out');
  }, [router]);

  // Re-read the account from the server (fresh token + plan). Used after a Stripe
  // upgrade so the new plan takes effect without re-login. Silent on failure.
  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/api/user/me');
      if (res?.token && res?.user) persist(res.token, res.user);
    } catch {
      /* not logged in or transient — leave the cached user as-is */
    }
  }, [persist]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
