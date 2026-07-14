'use client';

import { useState } from 'react';
import {
  Type, Highlighter, Pen, Square, StickyNote, ImagePlus, Stamp,
  PenTool, Eraser, TextCursorInput, ScanText, Layers, FileText,
} from 'lucide-react';
import { EditorShell } from '@/components/pdf/editor-shell';
import { ProBadge, ProUpsell } from '@/components/pdf/pro-gate';

// Internal design-review page (noindex, off the sitemap): a live mock of the
// shared premium EditorShell for Edit / Annotate / Redact, so the shell's look,
// layout and free/Pro gating can be validated WITHOUT touching any real editor.
// This page renders placeholder content only — it drives no editing logic.

type Tool = {
  id: string; label: string; icon: typeof Type;
  pro?: boolean; hint: string;
};

const ANNOTATE: Tool[] = [
  { id: 'text', label: 'Text', icon: Type, hint: 'Click anywhere to drop a text box.' },
  { id: 'highlight', label: 'Highlight', icon: Highlighter, hint: 'Drag over text to highlight it.' },
  { id: 'draw', label: 'Draw', icon: Pen, hint: 'Freehand pen — great for a quick markup.' },
  { id: 'shape', label: 'Shape', icon: Square, hint: 'Rectangles, lines and arrows.' },
  { id: 'note', label: 'Note', icon: StickyNote, hint: 'Pin a sticky note comment.' },
  { id: 'image', label: 'Image', icon: ImagePlus, hint: 'Drop in a logo, photo or signature.' },
  { id: 'stamp', label: 'Stamp', icon: Stamp, hint: 'Approved / Draft / custom stamps.' },
  { id: 'sign', label: 'Sign', icon: PenTool, hint: 'Draw, type or upload your signature.' },
  { id: 'edit-text', label: 'Edit text', icon: TextCursorInput, pro: true, hint: 'Click existing text and retype it in place.' },
  { id: 'redact', label: 'Redact', icon: Eraser, pro: true, hint: 'Permanently black out and remove content.' },
  { id: 'ocr', label: 'OCR', icon: ScanText, pro: true, hint: 'Make a scan searchable & editable.' },
];

const COLORS = ['#111827', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

export default function EditorShellDemo() {
  const [active, setActive] = useState('text');
  const [zoom, setZoom] = useState(100);
  const [color, setColor] = useState('#111827');
  const [page, setPage] = useState(1);
  const tool = ANNOTATE.find((t) => t.id === active)!;
  const pages = [1, 2, 3, 4, 5];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Design review · not deployed</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Shared editor shell</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One premium frame for Edit, Annotate &amp; Redact. Placeholder content — click a tool to see the contextual bar and panel react. Amber-locked tools are Pro-only.
        </p>
      </div>

      <EditorShell
        toolName="Annotate"
        toolIcon={<Highlighter className="size-4 text-primary" />}
        fileName="contract-final.pdf"
        pageInfo={`Page ${page} of ${pages.length}`}
        onUndo={() => {}} onRedo={() => {}} canUndo canRedo={false}
        zoomLabel={`${zoom}%`}
        onZoomIn={() => setZoom((z) => Math.min(300, z + 25))}
        onZoomOut={() => setZoom((z) => Math.max(50, z - 25))}
        onExport={() => {}} exportLabel="Download"
        toolbar={ANNOTATE.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`relative flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors ${on ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent'}`}
            >
              <t.icon className="size-4" /> {t.label}
              {t.pro && <span className="absolute -right-1 -top-1"><ProBadge /></span>}
            </button>
          );
        })}
        contextBar={
          <>
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Colour ${c}`}
                  className={`size-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-foreground' : 'border-transparent'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <span className="mx-1 h-5 w-px bg-border" />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Size
              <input type="range" min={1} max={48} defaultValue={16} className="h-1 w-24 accent-primary" />
            </label>
          </>
        }
        thumbnails={pages.map((p) => (
          <button
            key={p}
            onClick={() => setPage(p)}
            className={`mb-2 flex aspect-[3/4] w-full items-center justify-center rounded-lg border text-[10px] font-medium transition-colors ${p === page ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/40'}`}
          >
            {p}
          </button>
        ))}
        properties={
          tool.pro ? (
            <ProUpsell feature={tool.label} blurb={tool.hint} />
          ) : (
            <div className="space-y-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold"><tool.icon className="size-4 text-primary" /> {tool.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{tool.hint}</p>
              </div>
              <div className="rounded-lg border bg-card p-2.5">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Properties</p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between"><span>Opacity</span><span className="tabular-nums text-foreground">100%</span></div>
                  <div className="flex items-center justify-between"><span>Layer</span><span className="text-foreground">Front</span></div>
                </div>
              </div>
            </div>
          )
        }
      >
        {/* Placeholder canvas */}
        <div className="mx-auto flex aspect-[3/4] w-full max-w-md items-center justify-center rounded-lg border-2 border-dashed bg-card shadow-soft">
          <div className="text-center text-muted-foreground">
            <FileText className="mx-auto size-10 opacity-30" />
            <p className="mt-2 text-sm">Page {page} · {zoom}%</p>
            <p className="mt-0.5 text-xs">Canvas renders here (unchanged per-tool engine)</p>
          </div>
        </div>
      </EditorShell>

      <div className="mt-6 flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Layers className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          <b className="text-foreground">Free</b> gets the full add-on-top kit (text, highlight, draw, shapes, notes, images, stamps, sign). <b className="text-foreground">Pro</b> unlocks edit-existing-text, true redaction and OCR — matching how Adobe/Smallpdf split it, but in one nicer frame.
        </span>
      </div>
    </div>
  );
}
