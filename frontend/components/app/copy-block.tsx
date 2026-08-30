'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

// A code block you can copy in one tap.
//
// Setup instructions are the one place where "select the text carefully" is a
// real failure mode: a config file breaks on a single missing brace, and on a
// phone selecting nine lines of JSON accurately is close to impossible. The
// copy button is not a flourish here, it is the difference between the guide
// working and not.

export function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard access can be refused (an insecure origin, a locked-down
      // browser). Fall back to the old selection trick rather than failing
      // silently and leaving the button looking broken.
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* nothing else to try */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-3 py-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">{label || 'config'}</span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={copied ? 'Copied' : 'Copy to clipboard'}
        >
          {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed"><code>{code}</code></pre>
    </div>
  );
}
