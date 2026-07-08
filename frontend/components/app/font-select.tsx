'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { FAMILIES, FAMILY_KEYS, type Family } from '@/lib/fonts';

// Shared font dropdown (iLovePDF-style): every option is rendered in its actual
// typeface. Used by Watermark, Annotate, and any future text tool so the font
// list + look stays identical everywhere. The bundled families are declared
// @font-face in globals.css, so the browser lazy-loads each face when shown.
export function FontSelect({ value, onChange, className, menuPlacement = 'down' }: { value: Family; onChange: (f: Family) => void; className?: string; menuPlacement?: 'down' | 'up' }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div ref={boxRef} className={`relative ${className ?? ''}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label="Font family"
        className="flex h-10 w-full items-center justify-between rounded-lg border bg-card px-3 text-sm transition-colors hover:border-primary/40 focus:border-primary focus:outline-none">
        <span style={{ fontFamily: FAMILIES[value].css }}>{FAMILIES[value].label}</span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul role="listbox" aria-label="Font families" className={`absolute z-50 max-h-64 w-full overflow-auto rounded-lg border bg-card py-1 shadow-lg ${menuPlacement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          {FAMILY_KEYS.map((f) => (
            <li key={f} role="option" aria-selected={f === value}>
              <button type="button" onClick={() => { onChange(f); setOpen(false); }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[15px] transition-colors hover:bg-accent ${f === value ? 'bg-primary/5 text-primary' : ''}`}
                style={{ fontFamily: FAMILIES[f].css }}>
                {FAMILIES[f].label}
                {f === value && <Check className="size-4 shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
