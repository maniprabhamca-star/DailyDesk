'use client';

import { useRef, useState } from 'react';
import { Upload, FileText, X, Loader2, ShieldCheck, AlertTriangle, Link as LinkIcon, Fingerprint, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { openPdf, type PdfHandle } from '@/lib/pdf-render';
import { scanDocMetadata } from '@/lib/pdf-sanitize';

type Severity = 'high' | 'medium' | 'low';
type Finding = { severity: Severity; title: string; detail: string; action?: { label: string; href: string } };

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const PATTERNS: Array<{ title: string; severity: Severity; re: RegExp }> = [
  { title: 'Email addresses', severity: 'medium', re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { title: 'Phone numbers', severity: 'medium', re: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g },
  { title: 'Possible SSNs', severity: 'high', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { title: 'Payment-card-like numbers', severity: 'high', re: /\b(?:\d[ -]*?){13,19}\b/g },
  { title: 'Sensitive words', severity: 'medium', re: /\b(password|secret|confidential|private key|api key|token)\b/gi },
  { title: 'Visible web links', severity: 'low', re: /\bhttps?:\/\/[^\s)]+/gi },
];

function score(findings: Finding[]) {
  if (findings.some((f) => f.severity === 'high')) return { label: 'High risk', tone: 'text-red-700 bg-red-500/10 border-red-500/30' };
  if (findings.some((f) => f.severity === 'medium')) return { label: 'Review before sharing', tone: 'text-amber-700 bg-amber-500/10 border-amber-500/30' };
  if (findings.length) return { label: 'Low risk', tone: 'text-sky-700 bg-sky-500/10 border-sky-500/30' };
  return { label: 'Looks share-safe', tone: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/30' };
}

export function ShareSafeCheckTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function analyze(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    setFile(f);
    setFindings(null);
    setError(null);
    setBusy(true);
    let handle: PdfHandle | null = null;
    try {
      const { PDFDocument } = await import('pdf-lib');
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
      const meta = await scanDocMetadata(doc);
      const next: Finding[] = [];
      if (meta.fields.length || meta.xmpBytes || meta.thumbs || meta.pieceInfo) {
        next.push({
          severity: 'medium',
          title: 'Hidden metadata found',
          detail: `${meta.fields.length} document field${meta.fields.length === 1 ? '' : 's'}${meta.xmpBytes ? ', XMP packet' : ''}${meta.thumbs ? ', thumbnails' : ''}.`,
          action: { label: 'Remove metadata', href: '/remove-pdf-metadata' },
        });
      }

      handle = await openPdf(f);
      setPageCount(handle.numPages);
      let linkAnnots = 0;
      const counts = new Map<string, { severity: Severity; n: number }>();
      for (let i = 1; i <= handle.numPages; i++) {
        const page = await handle.doc.getPage(i);
        const text = (await page.getTextContent()).items.map((it: unknown) => (it as { str?: string }).str || '').join(' ');
        for (const p of PATTERNS) {
          const n = (text.match(p.re) || []).length;
          if (n) {
            const cur = counts.get(p.title) || { severity: p.severity, n: 0 };
            cur.n += n;
            counts.set(p.title, cur);
          }
        }
        try {
          const annots = await page.getAnnotations({ intent: 'display' }) as Array<{ subtype?: string }>;
          linkAnnots += annots.filter((a) => a.subtype === 'Link').length;
          const other = annots.filter((a) => a.subtype && a.subtype !== 'Link').length;
          if (other) next.push({ severity: 'low', title: `Page ${i} annotations`, detail: `${other} non-link annotation${other === 1 ? '' : 's'} may be visible or editable in some viewers.` });
        } catch { /* annotations are optional */ }
      }
      counts.forEach((v, title) => {
        next.push({
          severity: v.severity,
          title,
          detail: `${v.n} match${v.n === 1 ? '' : 'es'} found in visible/selectable text.`,
          action: v.severity === 'high' || title === 'Sensitive words' ? { label: 'Redact PDF', href: '/redact-pdf' } : undefined,
        });
      });
      if (linkAnnots) next.push({ severity: 'low', title: 'Clickable links', detail: `${linkAnnots} link annotation${linkAnnots === 1 ? '' : 's'} found. Check that URLs are safe to share.`, action: { label: 'Edit PDF', href: '/edit-pdf' } });
      setFindings(next);
    } catch {
      setError('Could not scan this PDF. It may be corrupted or password-protected.');
      setFile(null);
    } finally {
      if (handle) void handle.destroy();
      setBusy(false);
    }
  }

  function clear() {
    setFile(null);
    setFindings(null);
    setPageCount(0);
    setError(null);
  }

  const result = findings ? score(findings) : null;

  return (
    <Card>
      <CardContent className="p-5">
        {!file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void analyze(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">Find hidden metadata, risky text, links, and annotations before sharing</p>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { void analyze(e.target.files?.[0]); e.currentTarget.value = ''; }} />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fmt(file.size)}{pageCount ? ` · ${pageCount} page${pageCount === 1 ? '' : 's'}` : ''}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={clear}><X className="size-4" /></Button>
          </div>
        )}

        {busy && <p className="mt-4 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Checking your PDF on this device...</p>}
        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {result && findings && (
          <div className="mt-4 space-y-3">
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-3 ${result.tone}`}>
              {findings.length ? <AlertTriangle className="size-5 shrink-0" /> : <ShieldCheck className="size-5 shrink-0" />}
              <div>
                <p className="text-sm font-semibold">{result.label}</p>
                <p className="text-xs opacity-80">{findings.length ? `${findings.length} thing${findings.length === 1 ? '' : 's'} to review before sharing.` : 'No obvious metadata, risky text, links, or annotations found.'}</p>
              </div>
            </div>
            {findings.length > 0 && (
              <div className="divide-y rounded-xl border bg-card">
                {findings.map((f, i) => (
                  <div key={`${f.title}-${i}`} className="flex flex-wrap items-start gap-3 px-3 py-3">
                    <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${f.severity === 'high' ? 'bg-red-500/10 text-red-600' : f.severity === 'medium' ? 'bg-amber-500/10 text-amber-600' : 'bg-sky-500/10 text-sky-600'}`}>
                      {f.title.includes('metadata') ? <Fingerprint className="size-4" /> : f.title.includes('Link') || f.title.includes('link') ? <LinkIcon className="size-4" /> : <EyeOff className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{f.title}</p>
                      <p className="text-xs leading-5 text-muted-foreground">{f.detail}</p>
                    </div>
                    {f.action && <Button asChild size="sm" variant="outline"><Link href={f.action.href}>{f.action.label}</Link></Button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
