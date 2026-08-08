'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Download, Loader2, FileJson, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/download';
import { certificateToPdf, pageRanges, type RedactionCertificate } from '@/lib/redaction-certificate';

// Shown after a redaction. Deliberately below the download, not above it: the
// file is what someone came for, and a certificate offered before the result
// reads as a upsell rather than as evidence.
export function RedactionCertificatePanel({ cert }: { cert: RedactionCertificate }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const removed = cert.redaction.textLayer?.removed;

  async function downloadPdf() {
    setBusy(true);
    try {
      const bytes = await certificateToPdf(cert);
      downloadBlob(
        new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }),
        cert.output.name.replace(/\.pdf$/i, '') + '-certificate.pdf',
      );
    } finally { setBusy(false); }
  }

  function downloadJson() {
    downloadBlob(
      new Blob([JSON.stringify(cert, null, 2)], { type: 'application/json' }),
      cert.output.name.replace(/\.pdf$/i, '') + '-certificate.json',
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-emerald-600/30 bg-emerald-500/[0.05] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <BadgeCheck className="size-4 text-emerald-700 dark:text-emerald-400" />
            Redaction certificate
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            A receipt you can hand over with the file: which pages were redacted,
            {removed === true && ' that no selectable text remains,'}
            {removed === false && ' that text still remains (worth another look),'}
            {' '}and the fingerprint of this exact PDF — so anyone can confirm they were sent the file
            this describes. Generated here, like everything else.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void downloadPdf()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Certificate
          </Button>
          <Button size="sm" variant="outline" onClick={downloadJson} title="Machine-readable, for the verifier">
            <FileJson className="size-4" /> .json
          </Button>
        </div>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        {open ? 'Hide what it says' : 'See what it says'}
      </button>

      {open && (
        <dl className="mt-3 space-y-1.5 border-t border-emerald-600/20 pt-3 text-[13px]">
          <Row label="Pages redacted" value={pageRanges(cert.redaction.pages)} />
          <Row label="Areas" value={String(cert.redaction.areas)} />
          {cert.redaction.textLayer && (
            <Row
              label="Selectable text"
              value={`${cert.redaction.textLayer.beforeChars} characters before → ${cert.redaction.textLayer.afterChars} after`}
            />
          )}
          <Row label="Processing" value="On this device — neither file was uploaded" />
          <Row label="Fingerprint" value={`${cert.output.sha256.slice(0, 24)}…`} mono />
        </dl>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        It records your device’s clock, not a trusted timestamp — which is the trade for never
        having to send the document anywhere.{' '}
        <Link href="/verify-redaction" className="font-medium text-primary underline underline-offset-2">
          Check a certificate
        </Link>
      </p>
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
