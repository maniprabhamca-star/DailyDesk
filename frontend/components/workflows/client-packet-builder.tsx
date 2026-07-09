'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Circle, FilePlus2, ListChecks, ShieldCheck, Sparkles, ArrowRight, Upload, X, FileText, Loader2, Download, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { stripDocMetadata } from '@/lib/pdf-sanitize';
import { PdfDone } from '@/components/app/pdf-done';

const STEPS = [
  { title: 'Collect source files', body: 'Add proposal, agreement, invoice, IDs, and reference PDFs.', href: '/merge-pdf', cta: 'Merge files' },
  { title: 'Remove extras', body: 'Delete blank or accidental pages before final delivery.', href: '/delete-pages-from-pdf', cta: 'Clean pages' },
  { title: 'Add signatures or initials', body: 'Place signatures, initials, or required acknowledgements.', href: '/sign-pdf', cta: 'Sign PDF' },
  { title: 'Run Share-Safe check', body: 'Check metadata, visible risky text, links, and annotations.', href: '/share-safe-pdf-check', cta: 'Check risk' },
  { title: 'Compress for delivery', body: 'Shrink the packet while keeping pages readable.', href: '/compress-pdf', cta: 'Compress' },
];

const PACKET_TYPES = [
  { name: 'Client onboarding', detail: 'Agreement, ID, intake form, payment authorization.', required: ['Agreement', 'ID', 'Intake form'] },
  { name: 'Sales proposal', detail: 'Proposal, scope, quote, terms, signature page.', required: ['Proposal', 'Quote', 'Terms'] },
  { name: 'Invoice packet', detail: 'Invoice, receipt, supporting docs, share-safe check.', required: ['Invoice', 'Receipt', 'Support docs'] },
];

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ClientPacketBuilder() {
  const [done, setDone] = useState<boolean[]>(() => STEPS.map(() => false));
  const [packetType, setPacketType] = useState(PACKET_TYPES[0].name);
  const [files, setFiles] = useState<File[]>([]);
  const [clientName, setClientName] = useState('');
  const [coverPage, setCoverPage] = useState(true);
  const [cleanMeta, setCleanMeta] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneFile, setDoneFile] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const completed = done.filter(Boolean).length + (files.length ? 1 : 0) + (doneFile ? 1 : 0);
  const pct = useMemo(() => Math.min(100, Math.round((completed / (STEPS.length + 2)) * 100)), [completed, doneFile, files.length]);
  const nextStepIndex = done.findIndex((v) => !v);
  const nextStep = files.length === 0 ? STEPS[0] : nextStepIndex >= 0 ? STEPS[nextStepIndex] : null;
  const selectedPacket = PACKET_TYPES.find((p) => p.name === packetType) || PACKET_TYPES[0];
  const totalBytes = files.reduce((n, f) => n + f.size, 0);

  function addFiles(list: FileList | null) {
    const pdfs = Array.from(list || []).filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!pdfs.length) return;
    setFiles((cur) => [...cur, ...pdfs]);
    setDoneFile(null);
    setError(null);
    setDone((cur) => cur.map((v, i) => (i === 0 ? true : v)));
  }

  function removeFile(index: number) {
    setFiles((cur) => cur.filter((_, i) => i !== index));
    setDoneFile(null);
  }

  function moveFile(index: number, dir: -1 | 1) {
    setFiles((cur) => {
      const next = [...cur];
      const target = index + dir;
      if (target < 0 || target >= next.length) return cur;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function buildPacket() {
    if (!files.length) return;
    setBusy(true);
    setError(null);
    setDoneFile(null);
    const t0 = performance.now();
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
      const out = await PDFDocument.create();
      const font = await out.embedFont(StandardFonts.Helvetica);
      const bold = await out.embedFont(StandardFonts.HelveticaBold);

      if (coverPage) {
        const page = out.addPage([612, 792]);
        page.drawText('Client Packet', { x: 72, y: 682, size: 28, font: bold, color: rgb(0.08, 0.1, 0.18) });
        page.drawText(clientName.trim() || selectedPacket.name, { x: 72, y: 640, size: 16, font, color: rgb(0.32, 0.34, 0.42) });
        page.drawText('Prepared with DiemDesk', { x: 72, y: 104, size: 11, font, color: rgb(0.45, 0.47, 0.55) });
        selectedPacket.required.forEach((item, i) => {
          page.drawText(`${i + 1}. ${item}`, { x: 92, y: 560 - i * 28, size: 13, font, color: rgb(0.08, 0.1, 0.18) });
        });
      }

      for (const f of files) {
        const src = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
        const copied = await out.copyPages(src, src.getPageIndices());
        copied.forEach((p) => out.addPage(p));
      }

      if (cleanMeta) {
        await stripDocMetadata(out);
      } else {
        out.setTitle(clientName.trim() ? `${clientName.trim()} - ${selectedPacket.name}` : selectedPacket.name);
        out.setCreator('DiemDesk');
        out.setProducer('DiemDesk');
      }
      const bytes = await out.save({ useObjectStreams: true });
      const safeName = (clientName.trim() || selectedPacket.name).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
      const name = `${safeName || 'client'}-packet.pdf`;
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      download(blob, name);
      setDoneFile({ blob, name, secs: (performance.now() - t0) / 1000 });
      setDone(() => STEPS.map(() => true));
    } catch {
      setError('Could not build this packet. One of the PDFs may be encrypted or corrupted.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ''; }} />

        <div className="rounded-2xl border bg-gradient-to-br from-primary/10 to-background p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><FilePlus2 className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Client Packet workflow</p>
              <p className="text-xs text-muted-foreground">Build one polished, signed, share-safe PDF packet from source documents.</p>
            </div>
            <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-primary shadow-soft">{pct}% ready</span>
          </div>
          <div className="mt-4 h-2 rounded-full bg-background">
            <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {PACKET_TYPES.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => { setPacketType(p.name); setDoneFile(null); }}
              aria-pressed={packetType === p.name}
              className={`rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft ${packetType === p.name ? 'border-primary bg-primary/10 text-foreground' : 'bg-card'}`}
            >
              <span className="text-sm font-semibold">{p.name}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{p.detail}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.72fr]">
          <div className="grid gap-3">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              onClick={() => inputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-5 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
            >
              <Upload className="size-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Add source PDFs</p>
              <p className="text-xs text-muted-foreground">Drag files here, or click to choose. They stay on this device.</p>
            </div>

            {files.length > 0 && (
              <div className="rounded-xl border bg-card">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <p className="text-sm font-semibold">{files.length} source file{files.length === 1 ? '' : 's'}</p>
                  <span className="text-xs text-muted-foreground">{fmt(totalBytes)}</span>
                </div>
                <div className="divide-y">
                  {files.map((f, i) => (
                    <div key={`${f.name}-${f.lastModified}-${i}`} className="flex items-center gap-2 px-3 py-2">
                      <GripVertical className="size-4 text-muted-foreground" />
                      <FileText className="size-4 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{fmt(f.size)}</p>
                      </div>
                      <button type="button" className="rounded-md px-2 py-1 text-xs hover:bg-accent" onClick={() => moveFile(i, -1)} disabled={i === 0}>Up</button>
                      <button type="button" className="rounded-md px-2 py-1 text-xs hover:bg-accent" onClick={() => moveFile(i, 1)} disabled={i === files.length - 1}>Down</button>
                      <button type="button" className="rounded-md p-1.5 text-destructive hover:bg-destructive/10" onClick={() => removeFile(i)} aria-label={`Remove ${f.name}`}><X className="size-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {STEPS.map((s, i) => (
              <div key={s.title} className="flex flex-wrap items-start gap-3 rounded-xl border bg-card p-3">
                <button
                  type="button"
                  onClick={() => setDone((cur) => cur.map((v, idx) => (idx === i ? !v : v)))}
                  className="mt-0.5 text-primary"
                  aria-label={done[i] ? `Mark ${s.title} incomplete` : `Mark ${s.title} complete`}
                >
                  {done[i] ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{s.body}</p>
                </div>
                <Button asChild size="sm" variant={nextStepIndex === i ? 'primary' : 'outline'}><Link href={s.href}>{s.cta}</Link></Button>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border bg-muted/30 p-4">
            <p className="text-sm font-semibold">Packet settings</p>
            <label className="mt-3 block text-xs font-medium text-muted-foreground">Client or packet name</label>
            <input value={clientName} onChange={(e) => { setClientName(e.target.value); setDoneFile(null); }} placeholder="Acme proposal, July 2026" className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary" />

            <div className="mt-3 grid gap-2 text-sm">
              <label className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                <input type="checkbox" checked={coverPage} onChange={(e) => setCoverPage(e.target.checked)} className="accent-primary" />
                Add a clean cover page
              </label>
              <label className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                <input type="checkbox" checked={cleanMeta} onChange={(e) => setCleanMeta(e.target.checked)} className="accent-primary" />
                Remove hidden metadata from packet
              </label>
            </div>

            <div className="mt-4 rounded-xl border bg-card p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next best action</p>
              {nextStep ? (
                <>
                  <p className="mt-2 text-sm font-semibold">{nextStep.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{nextStep.body}</p>
                  <Button asChild className="mt-3 w-full" size="sm"><Link href={nextStep.href}>{nextStep.cta} <ArrowRight className="size-3.5" /></Link></Button>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm font-semibold">Packet is ready to build</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Merge, clean, and export one client-ready PDF.</p>
                </>
              )}
            </div>

            {error && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
            <Button className="mt-4 w-full" size="lg" onClick={buildPacket} disabled={busy || files.length === 0}>
              {busy ? <><Loader2 className="size-4 animate-spin" /> Building...</> : <><Download className="size-4" /> Build packet PDF</>}
            </Button>
            {doneFile && <PdfDone blob={doneFile.blob} name={doneFile.name} secs={doneFile.secs} currentHref="/client-packet-builder" fromLabel="Client Packet Builder" hideBanner />}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-muted/30 p-3">
            <ListChecks className="size-4 text-primary" />
            <p className="mt-2 text-sm font-medium">Repeatable</p>
            <p className="text-xs text-muted-foreground">Same delivery standard every time.</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <ShieldCheck className="size-4 text-primary" />
            <p className="mt-2 text-sm font-medium">Safer sharing</p>
            <p className="text-xs text-muted-foreground">Metadata cleanup built into export.</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <Sparkles className="size-4 text-primary" />
            <p className="mt-2 text-sm font-medium">Premium finish</p>
            <p className="text-xs text-muted-foreground">Cover page, order, merge, and download.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
