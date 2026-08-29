// Pinned tools — option C from docs/designs/mobile-app-bar.html.
//
// Recents answer "take me back to what I was just doing". Pins answer something
// different and more durable: "these four are the reason I come here". Someone
// who scans receipts every week does not want that buried under whatever they
// happened to open yesterday, which is exactly what a recency list does to it.
//
// Local to the device on purpose. A pin is a convenience, not an account
// setting, and syncing it would mean an account is required before the feature
// does anything — which is the wrong trade for something this small.

const KEY = 'dd-pinned-tools-v1';
const MAX = 8;

/** Fires when pins change, so an open sheet updates without a reload. */
export const PINS_CHANGED = 'dd-pins-changed';

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((h) => typeof h === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event(PINS_CHANGED));
  } catch {
    /* private mode, quota — a pin that cannot be saved is not worth an error */
  }
}

export function getPinned(): string[] {
  return read();
}

export function isPinned(href: string): boolean {
  return read().includes(href);
}

/** Adds, or moves an existing pin to the front. Returns the new list. */
export function pin(href: string): string[] {
  const next = [href, ...read().filter((h) => h !== href)].slice(0, MAX);
  write(next);
  return next;
}

export function unpin(href: string): string[] {
  const next = read().filter((h) => h !== href);
  write(next);
  return next;
}

/** Returns true if it is now pinned, false if it was just removed. */
export function togglePin(href: string): boolean {
  if (isPinned(href)) { unpin(href); return false; }
  pin(href);
  return true;
}

export const MAX_PINS = MAX;
