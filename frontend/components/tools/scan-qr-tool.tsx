'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Upload, Loader2, Copy, Check, Eye, EyeOff, ExternalLink, Camera,
  ScanLine, QrCode, Contact, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { KeepGoing } from '@/components/app/keep-going';
import { downloadBlob as download } from '@/lib/download';
import { decodeQrFromImage } from '@/lib/qr-decode';
import { parseQrPayload, toVcf, type ParsedQr } from '@/lib/qr-parse';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // Clipboard API needs a secure context — fall back to the classic path.
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function SecretValue({ value }: { value: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate font-mono text-sm">{show ? value : '•'.repeat(Math.min(value.length, 14))}</span>
      <button type="button" aria-label={show ? 'Hide' : 'Show'} onClick={() => setShow(!show)}
        className="shrink-0 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </span>
  );
}

export function ScanQrTool() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParsedQr | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [touch, setTouch] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTouch(typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
  }, []);

  // Single owner of the preview URL's lifetime: the effect cleanup revokes the
  // previous URL whenever it's replaced (or on unmount) — no revokes elsewhere.
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  async function scan(f?: File | Blob | null, name = 'pasted image') {
    if (!f) return;
    if (f instanceof File && !f.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)) {
      setError('Please choose an image file (PNG, JPG, WebP, GIF or BMP).');
      return;
    }
    setError(null);
    setResult(null);
    setShowRaw(false);
    setBusy(true);
    setImageName(f instanceof File ? f.name : name);
    setImageUrl(URL.createObjectURL(f));
    try {
      const raw = await decodeQrFromImage(f);
      if (!raw) {
        setError('No QR code found in this image. Try a sharper photo, crop closer to the code, or increase the screenshot size.');
        return;
      }
      setResult(parseQrPayload(raw));
    } catch {
      setError('Could not read this image — it may be corrupted or in an unsupported format.');
    } finally {
      setBusy(false);
    }
  }

  // Ctrl/⌘+V anywhere on the page scans a screenshot straight from the clipboard.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith('image/'));
      const blob = item?.getAsFile();
      if (blob) { e.preventDefault(); void scan(blob); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const href = result?.href;

  return (
    <Card>
      <CardContent className="p-5">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void scan(e.dataTransfer.files?.[0]); }}
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
        >
          <Upload className="size-7 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Drop a photo or screenshot of a QR code, or click to choose</p>
          <p className="text-xs text-muted-foreground">Tip: you can also just press Ctrl+V (⌘+V) to paste a screenshot</p>
        </div>
        <input ref={inputRef} type="file" accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp" className="hidden"
          onChange={(e) => { void scan(e.target.files?.[0]); e.currentTarget.value = ''; }} />
        {touch && (
          <>
            <Button variant="outline" className="mt-3 w-full" onClick={() => cameraRef.current?.click()}>
              <Camera className="size-4" /> Take a photo of the code
            </Button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { void scan(e.target.files?.[0]); e.currentTarget.value = ''; }} />
          </>
        )}

        {busy && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Scanning the image…
          </p>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {result && !busy && (
          <div className="mt-5 rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <ScanLine className="size-4 text-primary" /> {result.title}
              </span>
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt={`Scanned image ${imageName}`} className="size-9 rounded-md border object-cover" />
              )}
            </div>
            <dl className="divide-y">
              {result.fields.map((f) => (
                <div key={f.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <dt className="w-28 shrink-0 text-xs font-medium text-muted-foreground">{f.label}</dt>
                  <dd className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right">
                    {f.secret ? <SecretValue value={f.value} /> : <span className="break-all text-sm">{f.value}</span>}
                    <CopyButton text={f.value} label={f.label} />
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
              {href && (
                <Button size="sm" asChild>
                  {/* Opened only on your click, in a new tab — the full address is shown above. */}
                  <a href={href} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" /> Open link</a>
                </Button>
              )}
              {result.kind === 'contact' && (
                <Button size="sm" variant="outline" onClick={() => {
                  const vcf = toVcf(result);
                  if (vcf) download(new Blob([vcf], { type: 'text/vcard' }), 'contact.vcf');
                }}>
                  <Contact className="size-4" /> Save contact (.vcf)
                </Button>
              )}
              <Button size="sm" variant="outline" asChild>
                <Link href="/qr-code-generator"><QrCode className="size-4" /> Make a code like this</Link>
              </Button>
              <button type="button" className="ml-auto text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                onClick={() => setShowRaw(!showRaw)}>
                {showRaw ? 'Hide raw content' : 'Show raw content'}
              </button>
            </div>
            {showRaw && (
              <div className="flex items-start gap-2 border-t bg-muted/40 px-4 py-3">
                <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground">{result.raw}</pre>
                <CopyButton text={result.raw} label="raw content" />
              </div>
            )}
          </div>
        )}

        {result && !busy && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              Careful with codes from posters or stickers — check the link’s address before opening it.
            </p>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); setImageUrl(null); }}>
              <X className="size-4" /> Scan another
            </Button>
          </div>
        )}

        <KeepGoing exclude="/scan-qr-code" />
      </CardContent>
    </Card>
  );
}
