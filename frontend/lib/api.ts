// Empty default = same-origin: requests go to /api/... and nginx proxies them
// to the backend. Override with NEXT_PUBLIC_API_URL for split-origin setups.
import { isAuthEndpoint, reportSessionExpired } from './session';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// The status used to be thrown away, which made "your session has expired" look
// exactly like "the network hiccupped" — so callers treated a dead session as a
// transient failure and carried on showing a signed-in page whose every control
// silently failed. Callers need to be able to tell the two apart.
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** A 401 means the session is over — not that something went briefly wrong. */
export const isAuthError = (e: unknown): boolean => e instanceof ApiError && e.status === 401;

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    // A 401 from sign-in means "wrong password" — don't treat it as an expiry.
    if (res.status === 401 && !isAuthEndpoint(path)) reportSessionExpired();
    throw new ApiError(err.error || 'Request failed', res.status);
  }

  return res.json();
}

export const api = {
  get: (path: string) => apiFetch(path),
  post: (path: string, body: unknown) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path: string, body: unknown) => apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path: string) => apiFetch(path, { method: 'DELETE' }),
};
