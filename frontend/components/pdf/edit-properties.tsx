'use client';

import React from 'react';
import {
  Pilcrow, TextCursorInput, ImageIcon, Stamp as StampIcon, Highlighter,
  Layers as LayersIcon, Trash2, MousePointer2,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
} from 'lucide-react';

// Edit PDF — right-hand properties panel.
//
// PRESENTATION ONLY. Every value comes in as a prop and every change goes back
// out through a callback that edit-tool already owned (patchSel / setBlockLayout
// / patchAdded / setImages). Nothing here reaches into the editing engine, which
// is the whole point: the Codex-stabilised core in edit-tool.tsx is untouched.
//
// Coordinates are PERCENTAGES OF THE PAGE, not points. The editor's whole model
// is fractional (x/y/w/h are 0..1 of the page box), so a percentage is the
// honest unit — converting to pt would mean plumbing the page's real point size
// through render and rounding twice. Percentages also stay correct if the page
// box differs per page, which it can in a mixed-size PDF.

export type EditSelKind = 'none' | 'paragraph' | 'word' | 'text' | 'image';

/** All fractions of the page (0..1). `w`/`h` are omitted for selections whose
 *  model has no width/height — an added text box is positioned + sized by font,
 *  not by a rectangle. */
export type EditBox = { x: number; y: number; w?: number; h?: number };

export type EditLayer = {
  key: string;
  kind: 'paragraph' | 'text' | 'image' | 'stamp' | 'markup';
  label: string;
  selected: boolean;
  edited?: boolean;
  onSelect: () => void;
};

export type AlignTo = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

const KIND_META: Record<Exclude<EditSelKind, 'none'>, { Icon: typeof Pilcrow; name: string; hint: string }> = {
  paragraph: {
    Icon: Pilcrow,
    name: 'Paragraph',
    hint: 'Type freely — the text wraps and stays in the PDF’s own font. Drag its edges to reflow it.',
  },
  word: {
    Icon: TextCursorInput,
    name: 'Word',
    hint: 'Retype or restyle this word. Everything around it keeps its original pixels.',
  },
  text: {
    Icon: TextCursorInput,
    name: 'Text box',
    hint: 'Drag the corner grip to resize, or the pill above to move it. Delete removes the box.',
  },
  image: {
    Icon: ImageIcon,
    name: 'Image',
    hint: 'Drag to move, the corner to scale, the handle above to rotate. Double-click it for a clean 90°.',
  },
};

const LAYER_ICON: Record<EditLayer['kind'], typeof Pilcrow> = {
  paragraph: Pilcrow,
  text: TextCursorInput,
  image: ImageIcon,
  stamp: StampIcon,
  markup: Highlighter,
};

const ALIGN_BUTTONS: { to: AlignTo; Icon: typeof Pilcrow; label: string }[] = [
  { to: 'left', Icon: AlignStartVertical, label: 'Align left edge to page' },
  { to: 'hcenter', Icon: AlignCenterVertical, label: 'Centre horizontally on page' },
  { to: 'right', Icon: AlignEndVertical, label: 'Align right edge to page' },
  { to: 'top', Icon: AlignStartHorizontal, label: 'Align top edge to page' },
  { to: 'vcenter', Icon: AlignCenterHorizontal, label: 'Centre vertically on page' },
  { to: 'bottom', Icon: AlignEndHorizontal, label: 'Align bottom edge to page' },
];

const card = 'rounded-xl border bg-card p-3 shadow-sm';
const label = 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

/** One editable percentage field. Commits on blur or Enter, reverts on Escape. */
function NumField({
  name, value, onCommit, disabled,
}: {
  name: string;
  value: number;          // 0..1 fraction
  onCommit?: (frac: number) => void;
  disabled?: boolean;
}) {
  const shown = (value * 100).toFixed(1);
  const [draft, setDraft] = React.useState<string | null>(null);

  function commit(raw: string) {
    setDraft(null);
    if (!onCommit) return;
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) return;
    const frac = Math.max(0, Math.min(1, n / 100));
    if (Math.abs(frac - value) > 1e-6) onCommit(frac);
  }

  const editable = !!onCommit && !disabled;
  return (
    <label className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 ${editable ? 'focus-within:border-primary' : 'opacity-60'}`}>
      <span className="text-[10px] font-semibold uppercase text-muted-foreground">{name}</span>
      <input
        value={draft ?? shown}
        readOnly={!editable}
        inputMode="decimal"
        aria-label={`${name} — percent of page`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).blur(); }
          else if (e.key === 'Escape') { e.preventDefault(); setDraft(null); (e.target as HTMLInputElement).blur(); }
        }}
        className="ml-auto w-[5ch] bg-transparent text-right text-xs tabular-nums outline-none"
      />
      <span className="text-[10px] text-muted-foreground">%</span>
    </label>
  );
}

export function EditProperties({
  kind,
  box,
  onBox,
  fontLabel,
  fontMatch,
  fontExact,
  layers,
  onAlign,
  onDelete,
  pageLabel,
  sizeLabel,
}: {
  kind: EditSelKind;
  box?: EditBox | null;
  /** Overrides the "H" field's name — an added text box's height is its font size. */
  sizeLabel?: string;
  /** Present only for selections whose geometry edit-tool can actually write back. */
  onBox?: (patch: Partial<EditBox>) => void;
  fontLabel?: string;
  fontMatch?: string;
  /** false = we're drawing in an OS fallback rather than a bundled twin. */
  fontExact?: boolean;
  layers: EditLayer[];
  onAlign?: (to: AlignTo) => void;
  onDelete?: () => void;
  pageLabel?: string;
}) {
  const meta = kind === 'none' ? null : KIND_META[kind];

  return (
    <div className="space-y-2.5 text-sm">
      {/* Active object */}
      {meta ? (
        <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/[0.09] via-card to-card p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm ring-1 ring-inset ring-white/15">
              <meta.Icon className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{meta.name}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">Selected</p>
            </div>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">{meta.hint}</p>
        </div>
      ) : (
        <div className={card}>
          <div className="flex items-center gap-2">
            <MousePointer2 className="size-4 shrink-0 text-muted-foreground" />
            <p className="text-[12px] font-medium text-foreground">Nothing selected</p>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
            Click a paragraph to edit its text, or place something with the toolbar. Its properties show up here.
          </p>
        </div>
      )}

      {/* Position & size */}
      {box && (
        <div className={card}>
          <div className="mb-2 flex items-center gap-1.5">
            <span className={label}>Position &amp; size</span>
            {pageLabel && <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">{pageLabel}</span>}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <NumField name="X" value={box.x} onCommit={onBox && ((v) => onBox({ x: v }))} />
            <NumField name="Y" value={box.y} onCommit={onBox && ((v) => onBox({ y: v }))} />
            {box.w !== undefined && <NumField name="W" value={box.w} onCommit={onBox && ((v) => onBox({ w: v }))} />}
            {box.h !== undefined && <NumField name={sizeLabel ?? 'H'} value={box.h} onCommit={onBox && ((v) => onBox({ h: v }))} />}
          </div>
          {!onBox && <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">Read-only for this selection — drag it on the page to move it.</p>}
        </div>
      )}

      {/* Font match */}
      {fontLabel && (
        <div className={card}>
          <div className="mb-2"><span className={label}>Font match</span></div>
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="truncate">{fontLabel}</span>
            {fontMatch && (
              <span className={`ml-auto rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${fontExact === false ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'}`}>
                {fontMatch}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
            {fontExact === false
              ? 'Drawn in your system’s font — it may sit a little differently from the rest of the page.'
              : 'Bundled twin — matches what the page was drawn with.'}
          </p>
        </div>
      )}

      {/* Align to page */}
      {onAlign && box && (
        <div className={card}>
          <div className="mb-2"><span className={label}>Align to page</span></div>
          <div className="grid grid-cols-6 gap-1">
            {ALIGN_BUTTONS.map(({ to, Icon, label: title }) => (
              <button
                key={to}
                type="button"
                title={title}
                aria-label={title}
                onClick={() => onAlign(to)}
                className="flex h-7 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Layers */}
      {layers.length > 0 && (
        <div className="rounded-xl border bg-card p-2 shadow-sm">
          <div className="mb-1.5 flex items-center gap-1.5 px-1">
            <LayersIcon className="size-3.5 text-primary" />
            <span className={label}>On this page</span>
            <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">{layers.length}</span>
          </div>
          <div className="max-h-44 space-y-0.5 overflow-y-auto">
            {layers.map((L) => {
              const Icon = LAYER_ICON[L.kind];
              return (
                <button
                  key={L.key}
                  type="button"
                  onClick={L.onSelect}
                  className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors ${L.selected ? 'bg-primary/10 ring-1 ring-primary/25' : 'hover:bg-accent'}`}
                >
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-xs">{L.label}</span>
                  {L.edited && <span className="size-1.5 shrink-0 rounded-full bg-primary" title="Changed" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <Trash2 className="size-3.5" /> Delete selection
        </button>
      )}
    </div>
  );
}
