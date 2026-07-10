'use client';

import type { ReactNode } from 'react';
import { Undo2, Redo2, Minus, Plus, Download, Loader2 } from 'lucide-react';
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
    <div className="overflow-hidden rounded-2xl border bg-card shadow-lift">
      {/* Top action bar */}
      <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">{toolIcon} {toolName}</span>
        {fileName && <span className="hidden min-w-0 truncate text-xs text-muted-foreground sm:block">{fileName}{pageInfo ? ` · ${pageInfo}` : ''}</span>}
        <div className="ml-auto flex items-center gap-1.5">
          {(onUndo || onRedo) && (
            <div className="flex items-center rounded-lg border">
              <button onClick={onUndo} disabled={!canUndo} aria-label="Undo" className="flex size-8 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"><Undo2 className="size-4" /></button>
              <span className="h-5 w-px bg-border" />
              <button onClick={onRedo} disabled={!canRedo} aria-label="Redo" className="flex size-8 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"><Redo2 className="size-4" /></button>
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

      {/* Tool toolbar + contextual sub-bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b bg-card px-2 py-1.5">
        {toolbar}
        {contextBar && (
          <>
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
            <div className="flex flex-wrap items-center gap-1.5">{contextBar}</div>
          </>
        )}
      </div>

      {/* Body: thumbnail rail | canvas | properties panel.
          Flex (not grid) so a hidden rail/panel reserves NO width on small
          screens — the canvas gets it all. */}
      <div className="flex">
        {thumbnails && <aside className="hidden w-[58px] shrink-0 overflow-y-auto border-r bg-muted/20 p-2 sm:block">{thumbnails}</aside>}
        <div className="min-w-0 flex-1 overflow-auto bg-muted/10 p-3 sm:p-4">{children}</div>
        {properties && <aside className="hidden w-[220px] shrink-0 overflow-y-auto border-l bg-muted/20 p-3 lg:block">{properties}</aside>}
      </div>
    </div>
  );
}
