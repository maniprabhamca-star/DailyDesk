'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

export type User = { id: string; name: string; email: string; plan: string };

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  function persist(token: string, u: User) {
    localStorage.setItem('dd_token', token);
    localStorage.setItem('dd_user', JSON.stringify(u));
    setUser(u);
  }

  async function login(email: string, password: string) {
    const res = await api.post('/api/auth/login', { email, password });
    persist(res.token, res.user);
  }

  async function register(name: string, email: string, password: string) {
    const res = await api.post('/api/auth/register', { name, email, password });
    persist(res.token, res.user);
  }

  function logout() {
    localStorage.removeItem('dd_token');
    localStorage.removeItem('dd_user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
