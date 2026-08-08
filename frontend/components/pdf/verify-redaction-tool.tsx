'use client';

import { useRef, useState } from 'react';
import { BadgeCheck, TriangleAlert, FileText, FileJson, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pageRanges, verifyAgainst, type VerifyResult } from '@/lib/redaction-certificate';

export function VerifyRedactionTool() {
  const [pdf, setPdf] = useState<File | null>(null);
  const [cert, setCert] = useState<File | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const pdfRef = useRef<HTMLInputElement>(null);
  const certRef = useRef<HTMLInputElement>(null);

  async function run(p: File, c: File) {
    setBusy(true); setResult(null);
    try {
      setResult(await verifyAgainst(await c.text(), await p.arrayBuffer()));
    } catch {
      setResult({ status: 'unreadable', reason: 'Could not read one of those files.' });
    } finally { setBusy(false); }
  }

  const pick = (kind: 'pdf' | 'cert') => (f: File | undefined) => {
    if (!f) return;
    const nextPdf = kind === 'pdf' ? f : pdf;
    const nextCert = kind === 'cert' ? f : cert;
    if (kind === 'pdf') setPdf(f); else setCert(f);
    setResult(null);
    if (nextPdf && nextCert) void run(nextPdf, nextCert);
  };

  return (
    <div className="mt-8">
      <div className="grid gap-3 sm:grid-cols-2">
        <Slot
          label="The redacted PDF"
          hint="The file you were sent"
          icon={<FileText className="size-5 text-primary" />}
          file={pdf}
          onPick={() => pdfRef.current?.click()}
          onClear={() => { setPdf(null); setResult(null); }}
        />
        <Slot
          label="The certificate"
          hint="The .json that came with it"
          icon={<FileJson className="size-5 text-primary" />}
          file={cert}
          onPick={() => certRef.current?.click()}
          onClear={() => { setCert(null); setResult(null); }}
        />
      </div>

      {/* Off-screen but laid out — display:none is the documented reason a file
          picker silently refuses to open on iOS Safari (REG-015). */}
      <input
        ref={pdfRef} type="file" accept="application/pdf,.pdf" aria-label="Choose the redacted PDF"
        className="dd-file-input"
        onChange={(e) => { pick('pdf')(e.target.files?.[0]); e.currentTarget.value = ''; }}
      />
      <input
        ref={certRef} type="file" accept="application/json,.json" aria-label="Choose the certificate file"
        className="dd-file-input"
        onChange={(e) => { pick('cert')(e.target.files?.[0]); e.currentTarget.value = ''; }}
      />

      {busy && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Checking…
        </p>
      )}

      {result?.status === 'match' && (
        <div className="mt-4 rounded-xl border border-emerald-600/40 bg-emerald-500/[0.07] p-5">
          <p className="flex items-center gap-2 text-base font-semibold">
            <BadgeCheck className="size-5 text-emerald-700 dark:text-emerald-400" />
            They match
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            This is the exact file the certificate was issued for. Nothing has changed since.
          </p>
          <dl className="mt-4 space-y-1.5 border-t border-emerald-600/20 pt-3 text-[13px]">
            <Row label="Original file" value={result.cert.source.name} />
            <Row label="Pages redacted" value={pageRanges(result.cert.redaction.pages)} />
            <Row label="Areas" value={String(result.cert.redaction.areas)} />
            {result.cert.redaction.textLayer && (
              <Row
                label="Selectable text on those pages"
                value={result.cert.redaction.textLayer.removed
                  ? 'None remains'
                  : `${result.cert.redaction.textLayer.afterChars} characters still present`}
              />
            )}
            <Row label="Issued" value={new Date(result.cert.issuedAt).toLocaleString()} />
            <Row label="Processing" value={result.cert.processing === 'on-device' ? 'On the issuer’s device — not uploaded' : result.cert.processing} />
          </dl>
          {result.cert.redaction.textLayer?.removed === false && (
            <p className="mt-3 flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.08] p-3 text-[13px] leading-relaxed">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
              The certificate itself records that selectable text remained on the redacted pages. The
              file is authentic; whether it is safe to release is a different question.
            </p>
          )}
        </div>
      )}

      {result?.status === 'mismatch' && (
        <div className="mt-4 rounded-xl border border-destructive/45 bg-destructive/[0.06] p-5">
          <p className="flex items-center gap-2 text-base font-semibold text-destructive">
            <TriangleAlert className="size-5" /> They don’t match
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            This PDF is not the file this certificate was issued for. That can happen innocently —
            re-saving a PDF in another application rewrites it and changes the fingerprint even when
            it looks identical — but the certificate cannot vouch for the file you have.
          </p>
          <dl className="mt-4 space-y-1.5 border-t border-destructive/20 pt-3 text-[13px]">
            <Row label="Certificate expects" value={`${result.cert.output.sha256.slice(0, 24)}…`} mono />
            <Row label="This file is" value={`${result.actual.slice(0, 24)}…`} mono />
          </dl>
        </div>
      )}

      {result?.status === 'unreadable' && (
        <p className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/[0.07] p-4 text-sm">
          {result.reason}
        </p>
      )}
    </div>
  );
}

function Slot({ label, hint, icon, file, onPick, onClear }: {
  label: string; hint: string; icon: React.ReactNode; file: File | null;
  onPick: () => void; onClear: () => void;
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">{icon} {label}</p>
      {file ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{file.name}</span>
          <button onClick={onClear} aria-label={`Remove ${label}`} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-[13px] text-muted-foreground">{hint}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={onPick}>Choose file</Button>
        </>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right font-medium ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</dd>
    </div>
  );
}
