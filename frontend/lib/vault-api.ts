// File Vault API client — Phase 3. Thin authed wrappers over /api/vault.
// Everything crossing this wire is ciphertext (see lib/vault-crypto.ts); these
// helpers just move sealed bytes and map errors to friendly copy.
import type { VaultHeader } from './vault-crypto';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export type VaultStatus = { exists: boolean; header: VaultHeader | null; used: number; quota: number };
export type VaultFileRow = {
  id: string; parentId: string | null; kind: 'file' | 'folder';
  sealedName: string; wrappedFk: string | null; size: number; status: 'uploading' | 'ready';
  createdAt: string; updatedAt: string;
};

export class VaultApiError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

function token(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null;
}
export function isSignedIn(): boolean { return !!token(); }

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const t = token();
  const res = await fetch(`${API}/api/vault${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  });
  if (res.status === 204) return undefined as T;
  const isJson = (res.headers.get('content-type') || '').includes('json');
  const data = isJson ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    const code = String(data.error || res.status);
    const message =
      code === 'pro-required' ? 'The File Vault is a Pro feature.'
      : res.status === 401 ? 'Please sign in to use your vault.'
      : code === 'quota' ? 'Your vault is full — free some space first.'
      : String(data.message || 'The vault is unavailable right now — please try again.');
    throw new VaultApiError(code, message);
  }
  return data as T;
}

export const getVault = () => call<VaultStatus>('');
export const createVaultRemote = (header: VaultHeader) =>
  call<{ ok: true }>('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header }) });
export const updateHeader = (header: VaultHeader) =>
  call<{ ok: true }>('/header', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header }) });
export const listFiles = () => call<{ files: VaultFileRow[] }>('/files');
export const createFolder = (sealedName: string, parentId: string | null) =>
  call<{ id: string }>('/files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'folder', sealedName, parentId }) });
export const deleteEntry = (id: string) => call<{ ok: true }>(`/files/${id}`, { method: 'DELETE' });
export const renameEntry = (id: string, sealedName: string) =>
  call<{ ok: true }>(`/files/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sealedName }) });

/** Chunked upload of already-sealed bytes, with progress on the wire phase. */
export async function uploadSealed(
  sealedName: string, wrappedFk: string, sealed: Uint8Array, parentId: string | null,
  onProgress?: (sent: number, total: number) => void,
): Promise<string> {
  const init = await call<{ id: string; chunkBytes: number }>('/files', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'file', sealedName, wrappedFk, size: sealed.length, parentId }),
  });
  const CH = init.chunkBytes || 8 * 1024 * 1024;
  for (let off = 0; off < sealed.length; off += CH) {
    const part = sealed.subarray(off, Math.min(off + CH, sealed.length));
    await call(`/files/${init.id}/chunk?offset=${off}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' },
      body: part as unknown as BodyInit,
    });
    onProgress?.(Math.min(off + CH, sealed.length), sealed.length);
  }
  await call(`/files/${init.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  return init.id;
}

/** Download the sealed bytes of a file (still ciphertext — open it locally). */
export async function downloadSealed(id: string): Promise<Uint8Array> {
  const t = token();
  const res = await fetch(`${API}/api/vault/files/${id}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  if (!res.ok) throw new VaultApiError(String(res.status), 'Could not download that file — please try again.');
  return new Uint8Array(await res.arrayBuffer());
}
