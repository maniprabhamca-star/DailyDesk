'use client';

// Native share via the Web Share API — the on-device answer to "email this / send
// it to someone". No upload: the browser hands the ACTUAL file to the OS share
// sheet (WhatsApp, Mail, AirDrop, Drive…). We share FILES, not a link, because a
// DiemDesk result lives on the device and has no URL to share.
//
// Self-hides where the API isn't available (desktop Firefox, older browsers), so
// Download is always the fallback and no tool ever dead-ends.

export function toFile(blob: Blob, name: string): File {
  if (blob instanceof File && blob.name) return blob;
  return new File([blob], name, { type: blob.type || 'application/octet-stream' });
}

export function canShareFiles(files: File[]): boolean {
  try {
    return typeof navigator !== 'undefined'
      && typeof navigator.canShare === 'function'
      && navigator.canShare({ files });
  } catch {
    return false;
  }
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'failed';

export async function shareFiles(files: File[], opts?: { title?: string; text?: string }): Promise<ShareOutcome> {
  if (!canShareFiles(files)) return 'unsupported';
  try {
    await navigator.share({ files, title: opts?.title, text: opts?.text });
    return 'shared';
  } catch (e) {
    // The user dismissing the share sheet throws AbortError — not an error to us.
    if (e instanceof DOMException && (e.name === 'AbortError' || e.name === 'NotAllowedError')) return 'cancelled';
    return 'failed';
  }
}
