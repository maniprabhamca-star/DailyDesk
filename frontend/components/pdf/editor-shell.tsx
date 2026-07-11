'use client';

import type { ReactNode } from 'react';
import { Undo2, Redo2, Minus, Plus, Download, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Shared, PRESENTATION-ONLY editor shell for Edit / Annotate / Redact — the
// premium app-like layout (top action bar + tool toolbar + contextual sub-bar +
// page-thumbnail rail + canvas + contextual properties panel). It owns NO editing
// logic: every region is a slot the tool fills with its own (unchanged) handlers
// and state. This gives all three editors one uniform, high-class frame.
export function EditorShell({
  toolName,
  toolIcon,
  fileName,
  pageInfo,
  onClose,        // optional "remove file / start over" — renders an × by the name
  // top-bar actions (all optional — pass what the tool supports)
  onUndo, onRedo, canUndo, canRedo,
  zoomLabel, onZoomIn, onZoomOut,
  onExport, exportLabel = 'Export', exporting, exportDisabled,
  // regions
  toolbar,        // the tool's icon buttons (its own components/handlers)
  contextBar,     // contextual controls (font / size / colour …), shown when relevant
  thumbnails,     // page rail (e.g. <PageStrip>)
  properties,     // contextual properties panel — only rendered when provided
  children,       // the canvas
}: {
  toolName: string;
  toolIcon: ReactNode;
  fileName?: string;
  pageInfo?: string;
  onClose?: () => void;
  onUndo?: () => void; onRedo?: () => void; canUndo?: boolean; canRedo?: boolean;
  zoomLabel?: string; onZoomIn?: () => void; onZoomOut?: () => void;
  onExport?: () => void; exportLabel?: string; exporting?: boolean; exportDisabled?: boolean;
  toolbar: ReactNode;
  contextBar?: ReactNode;
  thumbnails?: ReactNode;
  properties?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="isolate overflow-hidden rounded-2xl border bg-card shadow-lift">
      {/* Top action bar */}
      <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
        <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-foreground">{toolIcon} {toolName}</span>
        {fileName && <span className="hidden min-w-0 truncate text-xs text-muted-foreground sm:block">{fileName}{pageInfo ? ` · ${pageInfo}` : ''}</span>}
        {onClose && <button onClick={onClose} aria-label="Remove file" className="hidden size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:flex"><X className="size-3.5" /></button>}
        <div className="ml-auto flex items-center gap-1.5">
          {(onUndo || onRedo) && (
            <div className="flex items-center overflow-hidden rounded-lg border">
              {onUndo && <button onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo" className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"><Undo2 className="size-4" /></button>}
              {onUndo && onRedo && <span className="h-5 w-px bg-border" />}
              {onRedo && <button onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo" className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"><Redo2 className="size-4" /></button>}
            </div>
          )}
          {zoomLabel && (
            <div className="flex items-center gap-0.5 rounded-lg border px-1">
              <button onClick={onZoomOut} aria-label="Zoom out" className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"><Minus className="size-3.5" /></button>
              <span className="min-w-[3ch] text-center text-xs font-medium tabular-nums text-muted-foreground">{zoomLabel}</span>
              <button onClick={onZoomIn} aria-label="Zoom in" className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"><Plus className="size-3.5" /></button>
            </div>
          )}
          {onExport && (
            <Button size="sm" onClick={onExport} disabled={exportDisabled || exporting}>
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} {exportLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Tool toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b bg-card px-2 py-1.5">{toolbar}</div>
      {/* Contextual sub-bar (colour / size / font …) — its own row so rich
          controls have room and never crowd the tool buttons */}
      {contextBar && <div className="flex flex-wrap items-center gap-1.5 border-b bg-muted/20 px-2.5 py-1.5">{contextBar}</div>}

      {/* Body: thumbnail rail | canvas | properties panel.
          Flex (not grid) so a hidden rail/panel reserves NO width on small
          screens — the canvas gets it all. The body GROWS with content so the
          whole thing scrolls as one page (no nested panel scroll). The rail is
          bounded + self-start so a long document doesn't grow the page.
          The column dividers live on the CANVAS (which is full-height), not on the
          short rail/panel — so the lines run top-to-bottom instead of hanging. */}
      <div className="flex">
        {thumbnails && <aside className="hidden w-20 shrink-0 self-start overflow-y-auto bg-muted/20 p-2 [scrollbar-width:thin] sm:block sm:max-h-[42rem]">{thumbnails}</aside>}
        <div className="min-w-0 flex-1 bg-muted/10 p-3 sm:border-l sm:p-4 lg:border-r">{children}</div>
        {properties && <aside className="hidden w-[236px] shrink-0 self-start bg-gradient-to-b from-muted/50 via-muted/25 to-transparent p-3 lg:block">{properties}</aside>}
      </div>
    </div>
  );
}
