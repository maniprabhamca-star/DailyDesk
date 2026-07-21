// File Vault crypto core — Phase 1 of the Vault build. 100% on-device.
//
// Architecture (envelope encryption, so a passphrase change never re-encrypts
// files, and the recovery key is a true second door):
//
//   master key MK (random 32B)  ── wraps every file key and file name
//   KEK_pass = Argon2id(passphrase, salt_p)   → wrapped_MK_pass
//   KEK_rec  = Argon2id(recoveryKey, salt_r)  → wrapped_MK_rec
//   per file: FK (random 32B); ciphertext = AES-256-GCM(FK, bytes);
//             wrappedFK = AES-256-GCM(MK, FK)
//
// The server only ever stores: wrapped keys, salts, and sealed bytes — never a
// passphrase, never MK, never plaintext. GCM authenticates everything, so any
// tampering fails loudly instead of decrypting garbage.
//
// KDF: Argon2id via hash-wasm (WASM, lazy-loaded). If WASM is unavailable the
// vault falls back to PBKDF2-SHA-256 (WebCrypto native) — the header records
// which KDF sealed each wrap, so both always unlock and future upgrades are
// painless. No dead ends in any browser.

import type { IArgon2Options } from 'hash-wasm';

// ---- parameters -------------------------------------------------------------
export const VAULT_VERSION = 1;
export type KdfId = 'argon2id-v1' | 'pbkdf2-v1';

const ARGON2: Omit<IArgon2Options, 'password' | 'salt'> = {
  parallelism: 1,
  iterations: 3,
  memorySize: 65536, // 64 MB — memory-hard against GPU cracking
  hashLength: 32,
  outputType: 'binary',
};
const PBKDF2_ITERS = 600_000; // OWASP-order fallback when WASM is unavailable

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;
const rand = (n: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(n));

// ---- small binary helpers ---------------------------------------------------
export const toB64 = (u: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
};
export const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// ---- KDF ---------------------------------------------------------------------
async function argon2idAvailable(): Promise<boolean> {
  try {
    if (typeof WebAssembly === 'undefined') return false;
    await import('hash-wasm');
    return true;
  } catch { return false; }
}

export async function deriveKek(secret: string, salt: Uint8Array, kdf: KdfId): Promise<CryptoKey> {
  let raw: Uint8Array;
  if (kdf === 'argon2id-v1') {
    const { argon2id } = await import('hash-wasm');
    raw = (await argon2id({ ...ARGON2, password: secret, salt })) as unknown as Uint8Array;
  } else {
    const base = await subtle().importKey('raw', enc.encode(secret) as unknown as BufferSource, 'PBKDF2', false, ['deriveBits']);
    raw = new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as unknown as BufferSource, iterations: PBKDF2_ITERS }, base, 256));
  }
  return subtle().importKey('raw', raw as unknown as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function pickKdf(): Promise<KdfId> {
  return (await argon2idAvailable()) ? 'argon2id-v1' : 'pbkdf2-v1';
}

// ---- AES-256-GCM seal/open (12B IV prepended; GCM tag appended by WebCrypto) --
async function gcmSeal(key: CryptoKey, plain: Uint8Array, aad?: Uint8Array): Promise<Uint8Array> {
  const iv = rand(12);
  const ct = new Uint8Array(await subtle().encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource, ...(aad ? { additionalData: aad as unknown as BufferSource } : {}) },
    key,
    plain as unknown as BufferSource,
  ));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv, 0); out.set(ct, 12);
  return out;
}
async function gcmOpen(key: CryptoKey, sealed: Uint8Array, aad?: Uint8Array): Promise<Uint8Array> {
  if (sealed.length < 12 + 16) throw new Error('sealed data too short');
  const iv = sealed.subarray(0, 12);
  const ct = sealed.subarray(12);
  return new Uint8Array(await subtle().decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource, ...(aad ? { additionalData: aad as unknown as BufferSource } : {}) },
    key,
    ct as unknown as BufferSource,
  ));
}

// ---- master key + the two wraps ----------------------------------------------
export type KeyWrap = { kdf: KdfId; salt: string; wrapped: string }; // b64 fields
export type VaultHeader = {
  v: number;
  pass: KeyWrap;      // unlocked by the vault passphrase
  recovery: KeyWrap;  // unlocked by the recovery key
};

async function importMk(raw: Uint8Array): Promise<CryptoKey> {
  return subtle().importKey('raw', raw as unknown as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function makeWrap(secret: string, mkRaw: Uint8Array, kdf: KdfId): Promise<KeyWrap> {
  const salt = rand(16);
  const kek = await deriveKek(secret, salt, kdf);
  const wrapped = await gcmSeal(kek, mkRaw, enc.encode('ddvault-mk'));
  return { kdf, salt: toB64(salt), wrapped: toB64(wrapped) };
}

async function openWrap(secret: string, wrap: KeyWrap): Promise<Uint8Array> {
  const kek = await deriveKek(secret, fromB64(wrap.salt), wrap.kdf);
  return gcmOpen(kek, fromB64(wrap.wrapped), enc.encode('ddvault-mk'));
}

/** One-time vault creation: returns the header to store server-side and the
 * recovery key to show the user ONCE. MK never leaves this function unwrapped. */
export async function createVault(passphrase: string): Promise<{ header: VaultHeader; recoveryKey: string; mk: CryptoKey }> {
  if (passphrase.length < 8) throw new Error('Vault passphrase must be at least 8 characters.');
  const kdf = await pickKdf();
  const mkRaw = rand(32);
  const recoveryKey = generateRecoveryKey();
  const header: VaultHeader = {
    v: VAULT_VERSION,
    pass: await makeWrap(passphrase, mkRaw, kdf),
    recovery: await makeWrap(normalizeRecoveryKey(recoveryKey), mkRaw, kdf),
  };
  const mk = await importMk(mkRaw);
  mkRaw.fill(0);
  return { header, recoveryKey, mk };
}

/** Unlock with the passphrase (normal path). Throws on a wrong passphrase. */
export async function unlockWithPassphrase(header: VaultHeader, passphrase: string): Promise<CryptoKey> {
  const raw = await openWrap(passphrase, header.pass);
  const mk = await importMk(raw); raw.fill(0); return mk;
}

/** Unlock with the recovery key (forgot-passphrase path). */
export async function unlockWithRecovery(header: VaultHeader, recoveryKey: string): Promise<CryptoKey> {
  const raw = await openWrap(normalizeRecoveryKey(recoveryKey), header.recovery);
  const mk = await importMk(raw); raw.fill(0); return mk;
}

/** Change the passphrase: re-wrap MK only — files are untouched. Needs the
 * current passphrase (or a prior recovery unlock giving raw MK is phase-4). */
export async function rewrapPassphrase(header: VaultHeader, currentPassphrase: string, newPassphrase: string): Promise<VaultHeader> {
  if (newPassphrase.length < 8) throw new Error('Vault passphrase must be at least 8 characters.');
  const raw = await openWrap(currentPassphrase, header.pass);
  const next = { ...header, pass: await makeWrap(newPassphrase, raw, await pickKdf()) };
  raw.fill(0);
  return next;
}

// ---- recovery key format ------------------------------------------------------
// 24 chars of Crockford-ish base32 (no 0/O/1/I ambiguity), grouped in 4s:
// R7KD-2MXQ-9TFA-HB4N-WSE8-PLC3 → 120 bits of entropy.
const RK_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
export function generateRecoveryKey(): string {
  const bytes = rand(24);
  let out = '';
  for (let i = 0; i < 24; i++) {
    out += RK_ALPHABET[bytes[i] % RK_ALPHABET.length];
    if (i % 4 === 3 && i < 23) out += '-';
  }
  return out;
}
export function normalizeRecoveryKey(rk: string): string {
  return rk.toUpperCase().replace(/[^A-Z2-9]/g, '');
}

// ---- files & names --------------------------------------------------------------
export type SealedFile = {
  wrappedFk: string; // b64: FK sealed by MK
  sealed: Uint8Array; // iv + ciphertext + tag — the only bytes uploaded
};

/** Seal file bytes: random per-file key, wrapped by the master key. */
export async function sealFile(mk: CryptoKey, bytes: Uint8Array): Promise<SealedFile> {
  const fkRaw = rand(32);
  const fk = await subtle().importKey('raw', fkRaw as unknown as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const sealed = await gcmSeal(fk, bytes);
  const wrappedFk = toB64(await gcmSeal(mk, fkRaw, enc.encode('ddvault-fk')));
  fkRaw.fill(0);
  return { wrappedFk, sealed };
}

/** Open a sealed file. Throws (GCM auth) on tamper or wrong key. */
export async function openFile(mk: CryptoKey, file: SealedFile): Promise<Uint8Array> {
  const fkRaw = await gcmOpen(mk, fromB64(file.wrappedFk), enc.encode('ddvault-fk'));
  const fk = await subtle().importKey('raw', fkRaw as unknown as BufferSource, 'AES-GCM', false, ['decrypt', 'encrypt']);
  fkRaw.fill(0);
  return gcmOpen(fk, file.sealed);
}

/** File names are sealed too — the server never sees "PAN-card.pdf". */
export async function sealName(mk: CryptoKey, name: string): Promise<string> {
  return toB64(await gcmSeal(mk, enc.encode(name), enc.encode('ddvault-name')));
}
export async function openName(mk: CryptoKey, sealedName: string): Promise<string> {
  return dec.decode(await gcmOpen(mk, fromB64(sealedName), enc.encode('ddvault-name')));
}
