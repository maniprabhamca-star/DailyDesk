'use client';

// Recently-used tools, stored locally (per browser). Powers the "Recent" section
// of the command palette. Nothing leaves the device.

const KEY = 'dd_recent';
const CAP = 5;

export function getRecent(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function pushRecent(href: string) {
  if (typeof localStorage === 'undefined' || !href) return;
  try {
    const next = [href, ...getRecent().filter((h) => h !== href)].slice(0, CAP);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
