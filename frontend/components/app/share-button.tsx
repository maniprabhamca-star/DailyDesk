'use client';

import { useEffect, useMemo, useState } from 'react';
import { Share2, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toFile, canShareFiles, shareFiles } from '@/lib/share';

// A Share button that renders ONLY when the browser can share files (mobile
// browsers, desktop Chrome/Edge). Elsewhere it renders nothing, so Download stays
// the fallback. Files are fetched lazily via `get()` so we don't hold references
// until the moment the user taps Share.
export function ShareButton({
  get,
  title,
  label = 'Share',
  variant = 'outline',
  size = 'md',
  className,
}: {
  get: () => Array<{ blob: Blob; name: string }> | { blob: Blob; name: string };
  title?: string;
  label?: string;
  variant?: 'outline' | 'ghost' | 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(false);

  // Probe once with a placeholder — canShare validates the SHAPE, not the bytes,
  // so a generic file tells us whether this browser supports file sharing at all.
  const probe = useMemo(() => new File([new Uint8Array(1)], 'share.pdf', { type: 'application/pdf' }), []);
  useEffect(() => { setSupported(canShareFiles([probe])); }, [probe]);

  if (!supported) return null;

  const onClick = async () => {
    setBusy(true);
    try {
      const raw = get();
      const files = (Array.isArray(raw) ? raw : [raw]).map((f) => toFile(f.blob, f.name));
      const outcome = await shareFiles(files, { title });
      if (outcome === 'shared') { setShared(true); setTimeout(() => setShared(false), 2000); }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={onClick} disabled={busy}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : shared ? <Check className="size-4" /> : <Share2 className="size-4" />}
      {shared ? 'Shared' : label}
    </Button>
  );
}
