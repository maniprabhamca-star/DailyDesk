// Carrying a picked file across a navigation.
//
// The app bar's centre button opens a file picker from any page and then routes
// to the tool that suits the file. The first version routed and DROPPED the
// file, so the tool opened with an empty picker and the tap achieved nothing —
// which is worse than no button, because it looks like it worked.
//
// A File cannot go in a URL and does not survive a reload, so it is held in
// module memory for the moment between the tap and the destination mounting.
// Deliberately not sessionStorage: a File is not serialisable, and a stale one
// surviving a refresh would silently load yesterday's document into a tool.
//
// The handoff itself reuses the contract every tool already has — a hidden
// `input.dd-file-input` it listens to for `change`. Setting that input's files
// and firing the event means the tool receives it exactly as if the user had
// picked it there, so no tool needed changing for this to work.

let pending: File | null = null;
let stashedAt = 0;

/** How long a pending file stays valid. Long enough for a slow route, short
 *  enough that a file can never be applied to a page opened much later. */
const TTL_MS = 30_000;

export function stashFile(f: File) {
  pending = f;
  stashedAt = Date.now();
}

/** Returns the file once, then forgets it. */
export function takeFile(): File | null {
  if (!pending) return null;
  const stale = Date.now() - stashedAt > TTL_MS;
  const f = stale ? null : pending;
  pending = null;
  return f;
}

export function hasPendingFile() {
  return !!pending && Date.now() - stashedAt <= TTL_MS;
}

/**
 * Hand `file` to the tool on the current page.
 *
 * Waits for the tool's file input to exist, because the destination mounts
 * after the navigation resolves. Returns true if it was delivered.
 */
export function deliverTo(file: File, timeoutMs = 6000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();

    const tryOnce = (): boolean => {
      // The visible tool's own input. Several may exist on a page (a tool plus
      // the layout's rescue input), so prefer one that accepts this file.
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"].dd-file-input'));
      if (inputs.length === 0) return false;

      const accepts = (el: HTMLInputElement) => {
        const acc = (el.getAttribute('accept') || '').trim();
        if (!acc) return true;
        const name = file.name.toLowerCase();
        const type = (file.type || '').toLowerCase();
        return acc.split(',').map((s) => s.trim().toLowerCase()).some((rule) => {
          if (!rule) return false;
          if (rule.startsWith('.')) return name.endsWith(rule);
          if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
          return type === rule;
        });
      };

      const target = inputs.find(accepts) || inputs[0];
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        target.files = dt.files;
        target.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      } catch {
        // DataTransfer is unavailable in a few older engines. Failing here is
        // survivable: the user sees the tool with its own picker, which is the
        // behaviour they had before the button existed.
        return false;
      }
    };

    if (tryOnce()) return resolve(true);

    const observer = new MutationObserver(() => {
      if (tryOnce()) { observer.disconnect(); resolve(true); }
      else if (Date.now() - start > timeoutMs) { observer.disconnect(); resolve(false); }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => { observer.disconnect(); resolve(false); }, timeoutMs);
  });
}
