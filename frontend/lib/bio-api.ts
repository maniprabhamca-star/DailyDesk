import type { BioConfig } from './bio-themes';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export type BioState = { exists: boolean; slug?: string; config?: BioConfig; views?: number; published?: boolean };

export class BioApiError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

const token = () => (typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null);
export const bioSignedIn = () => !!token();

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const t = token();
  const res = await fetch(`${API}/api/bio${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = String(data.error || res.status);
    const message =
      code === 'pro-required' ? 'Link in Bio is a Pro feature.'
      : res.status === 401 ? 'Please sign in to build your page.'
      : String(data.message || 'Something went wrong — please try again.');
    throw new BioApiError(code, message);
  }
  return data as T;
}

export const getBio = () => call<BioState>('');
export const createBio = (slug: string, config: BioConfig) =>
  call<{ slug: string; config: BioConfig }>('', { method: 'POST', body: JSON.stringify({ slug, config }) });
export const updateBio = (config: BioConfig, slug?: string, published?: boolean) =>
  call<{ slug: string; config: BioConfig }>('', { method: 'PUT', body: JSON.stringify({ config, slug, published }) });
export const deleteBio = () => call<{ ok: true }>('', { method: 'DELETE' });
export const checkHandle = (slug: string) => call<{ available: boolean; reason: string | null }>(`/check/${encodeURIComponent(slug)}`);
