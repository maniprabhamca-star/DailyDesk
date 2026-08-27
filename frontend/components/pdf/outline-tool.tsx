'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Upload, FileText, X, Loader2, Zap, Plus, Trash2, ChevronUp, ChevronDown,
  IndentIncrease, IndentDecrease, Wand2, Undo2, ListTree,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';
import { useFileSession } from '@/lib/editor-session';
import { openPdf, type PdfHandle } from '@/lib/pdf-render';
import { extractPages } from '@/lib/pdf-markdown';
import { pdfItemsToHeadings } from '@/lib/pdf-markdown-core';
import {
  readOutline, writeOutline, makeNode, flatten, countNodes, treeFromHeadings,
  updateNode, removeNode, moveNode, indentNode, outdentNode, type OutlineNode,
} from '@/lib/pdf-outline';

const HREF = '/add-bookmarks-to-pdf';

export function OutlineTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [tree, setTree] = useState<OutlineNode[]>([]);
  const [history, setHistory] = useState<OutlineNode[][]>([]);
  const [hadOutline, setHadOutline] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleRef = useRef<PdfHandle | null>(null);

  useFileSession('addbookmarkstopdf', file, (f) => void load(f));
  const tooBig = !!file && !canProcessSize(file.size, plan);

  // Every edit goes through here so Undo is one stack rather than something
  // each button has to remember to do.
  function apply(next: OutlineNode[]) {
    setHistory((h) => [...h.slice(-49), tree]);
    setTree(next);
  }
  function undo() {
    setHistory((h) => {
      if (!h.length) return h;
      setTree(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }

  async function load(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setError(wrongTypeError(f.name)); return; }
    setError(null); setDone(null); setNote(null); setFile(f); setReading(true); setHistory([]);
    try {
      if (handleRef.current) void handleRef.current.destroy();
      const h = await openPdf(f);
      handleRef.current = h;
      setPageCount(h.numPages);
      const existing = await readOutline(h.doc as never);
      setTree(existing);
      setHadOutline(existing.length ? countNodes(existing) : 0);
    } catch {
      setError('Could not read that PDF. It may be corrupted, or password-protected — unlock it first.');
      setFile(null);
    } finally {
      setReading(false);
    }
  }

  useEffect(() => () => { if (handleRef.current) void handleRef.current.destroy(); }, []);

  function reset() {
    setFile(null); setTree([]); setHistory([]); setPageCount(0); setHadOutline(null);
    setDone(null); setError(null); setNote(null);
    if (handleRef.current) { void handleRef.current.destroy(); handleRef.current = null; }
  }

  /** The one nobody else offers: read the document's own headings and build the
   *  outline from them, so a 200-page report is one click rather than an hour. */
  async function generate() {
    if (!file || scanning) return;
    setScanning(true); setError(null); setNote(null);
    try {
      const { pages, hasText } = await extractPages(file);
      if (!hasText) {
        setNote('This looks like a scanned PDF — there is no text to find headings in. Run it through OCR first, or add bookmarks by hand below.');
        return;
      }
      const headings = pdfItemsToHeadings(pages);
      if (!headings.length) {
        setNote('No headings stood out in this document — its text is all one size. Add bookmarks by hand below.');
        return;
      }
      apply(treeFromHeadings(headings));
      setNote(`Found ${headings.length} heading${headings.length === 1 ? '' : 's'}. Edit anything that is wrong before saving — this is a starting point, not a verdict.`);
    } catch {
      setError('Could not scan this PDF for headings.');
    } finally {
      setScanning(false);
    }
  }

  async function save() {
    if (!file || busy) return;
    setBusy(true); setError(null);
    const t0 = performance.now();
    try {
      const out = await writeOutline(await file.arrayBuffer(), tree);
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      const name = `${file.name.replace(/\.pdf$/i, '')}-bookmarks.pdf`;
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
      download(blob, name);
    } catch {
      setError('Could not write the bookmarks into this PDF.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const n = countNodes(tree);
    return (
      <div>
        <p className="mb-3 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
          {n === 0
            ? 'The bookmarks are gone and the reader will no longer open a panel for them.'
            : `${n} bookmark${n === 1 ? '' : 's'} written in. Open the file and your reader should show the panel straight away.`}
        </p>
        <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref={HREF} fromLabel="Add bookmarks" onStartOver={reset} />
      </div>
    );
  }

  if (!file) {
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void load(e.dataTransfer.files?.[0]); }}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
      >
        <Upload className="size-7 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
        <p className="text-xs text-muted-foreground">Existing bookmarks are loaded so you can edit them</p>
        <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" aria-label="Choose a PDF file" className="dd-file-input" onChange={(e) => { void load(e.target.files?.[0]); e.currentTarget.value = ''; }} />
        {error && <div className="mt-3 w-full"><UploadError error={error} /></div>}
      </div>
    );
  }

  const rows = flatten(tree);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
        <FileText className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate">{file.name}</span>
        {pageCount > 0 && <span className="shrink-0 text-xs text-muted-foreground">{pageCount} page{pageCount === 1 ? '' : 's'}</span>}
        <button onClick={reset} aria-label="Remove file" className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
      </div>

      {tooBig && (
        <UpgradeNotice fileName={file.name} sizeText={fmtBytes(file.size)} limitText={fmtBytes(FREE_MAX_BYTES)} onReset={() => { reset(); inputRef.current?.click(); }} />
      )}

      {reading ? (
        <div className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Reading the bookmarks this file already has…
        </div>
      ) : (
        <>
          {hadOutline !== null && (
            <p className="text-xs text-muted-foreground">
              {hadOutline > 0
                ? `This PDF already has ${hadOutline} bookmark${hadOutline === 1 ? '' : 's'} — edit them below, or start again from its headings.`
                : 'This PDF has no bookmarks yet.'}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void generate()} disabled={scanning || busy}>
              {scanning ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              {scanning ? 'Reading the document…' : 'Build from the document’s headings'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => apply([...tree, makeNode('New bookmark', 0)])} disabled={busy}>
              <Plus className="size-4" /> Add bookmark
            </Button>
            <Button variant="ghost" size="sm" onClick={undo} disabled={!history.length || busy}>
              <Undo2 className="size-4" /> Undo
            </Button>
            {rows.length > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">{rows.length} bookmark{rows.length === 1 ? '' : 's'}</span>
            )}
          </div>

          {note && <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{note}</p>}

          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
              <ListTree className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No bookmarks yet</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Build them from the document’s own headings, or add them one at a time. Saving with none removes any the file had.
              </p>
            </div>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {rows.map(({ node, depth }) => (
                <li key={node.id} className="flex items-center gap-2 p-2" style={{ paddingLeft: `${8 + depth * 18}px` }}>
                  <input
                    value={node.title}
                    onChange={(e) => apply(updateNode(tree, node.id, { title: e.target.value }))}
                    aria-label="Bookmark title"
                    className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
                  />
                  <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <span className="hidden sm:inline">page</span>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, pageCount)}
                      value={node.page + 1}
                      onChange={(e) => {
                        const p = Math.max(1, Math.min(pageCount || 1, Number(e.target.value) || 1));
                        apply(updateNode(tree, node.id, { page: p - 1 }));
                      }}
                      aria-label={`Page for ${node.title}`}
                      className="w-16 rounded-md border bg-background px-1.5 py-1 text-sm outline-none focus:border-primary"
                    />
                  </label>
                  <div className="flex shrink-0 items-center">
                    <IconBtn label="Move up" onClick={() => apply(moveNode(tree, node.id, -1))}><ChevronUp className="size-4" /></IconBtn>
                    <IconBtn label="Move down" onClick={() => apply(moveNode(tree, node.id, 1))}><ChevronDown className="size-4" /></IconBtn>
                    <IconBtn label="Make it a sub-bookmark" onClick={() => apply(indentNode(tree, node.id))}><IndentIncrease className="size-4" /></IconBtn>
                    <IconBtn label="Move it up a level" onClick={() => apply(outdentNode(tree, node.id))}><IndentDecrease className="size-4" /></IconBtn>
                    <IconBtn label="Delete" danger onClick={() => apply(removeNode(tree, node.id))}><Trash2 className="size-4" /></IconBtn>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {error && <UploadError error={error} />}

      <Button className="w-full" size="lg" onClick={() => void save()} disabled={busy || reading || tooBig}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
        {busy ? 'Saving…' : rows.length ? `Save ${rows.length} bookmark${rows.length === 1 ? '' : 's'} into the PDF` : 'Save with no bookmarks'}
      </Button>
    </div>
  );
}

function IconBtn({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent ${danger ? 'hover:text-destructive' : 'hover:text-foreground'}`}
    >
      {children}
    </button>
  );
}
