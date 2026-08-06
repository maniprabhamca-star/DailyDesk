'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, Play, Plus, X, ArrowUp, ArrowDown, Save, Trash2, Download, Loader2, Check, ShieldCheck, GripVertical } from 'lucide-react';
import { downloadBlob } from '@/lib/download';
import {
  STEPS, STEP_ORDER, TEMPLATES, runWorkflow, runnableSteps, loadWorkflows, upsertWorkflow, deleteWorkflow, newWorkflowId,
  type Workflow, type WorkflowStep, type StepId, type StepState, type StepConfig, type StepField,
} from '@/lib/workflows';

// Map the engine layer's colour tokens to real hex (theme-independent accents).
const HEX: Record<string, string> = {
  '--indigo': '#4f46e5', '--green': '#16a34a', '--amber': '#d97706', '--coral': '#f4674e',
  '--cyan': '#0891b2', '--violet': '#7c3aed', '--rose': '#e11d48',
};
const colorOf = (id: StepId) => HEX[STEPS[id].color] ?? '#4f46e5';

function ConfigField({ field, value, onChange }: { field: StepField; value: string | number | undefined; onChange: (v: string | number) => void }) {
  if (field.type === 'select') {
    return (
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        {field.label}
        <select value={String(value ?? field.default)} onChange={(e) => onChange(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-sm text-foreground outline-none focus:border-primary">
          {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
    );
  }
  if (field.type === 'number') {
    return (
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        {field.label}
        <input type="number" value={Number(value ?? field.default)} min={field.min} max={field.max} step="any"
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 w-20 rounded-md border bg-background px-2 text-sm outline-none focus:border-primary" />
        {field.suffix && <span>{field.suffix}</span>}
      </label>
    );
  }
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {field.label}
      <input value={String(value ?? field.default ?? '')} placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-44 rounded-md border bg-background px-2 text-sm outline-none focus:border-primary" />
    </label>
  );
}

export function WorkflowsTool() {
  const [name, setName] = useState('Send-safe');
  const [steps, setSteps] = useState<WorkflowStep[]>(TEMPLATES[0].steps);
  const [activeTpl, setActiveTpl] = useState<string>(TEMPLATES[0].id);
  const [mine, setMine] = useState<Workflow[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [running, setRunning] = useState(false);
  const [states, setStates] = useState<StepState[]>([]);
  const [msg, setMsg] = useState('');
  const [result, setResult] = useState<{ files: File[]; from: number; to: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { setMine(loadWorkflows()); }, []);

  function loadTemplate(wf: Workflow) {
    setName(wf.name); setSteps(wf.steps.map((s) => ({ ...s, config: { ...s.config } }))); setActiveTpl(wf.id);
    setResult(null); setError(null); setStates([]);
  }
  function addStep(id: StepId) {
    setSteps((s) => [...s, { id, config: {} }]); setShowPalette(false); setActiveTpl('');
  }
  function removeStep(i: number) { setSteps((s) => s.filter((_, x) => x !== i)); setActiveTpl(''); }
  function moveStep(i: number, dir: -1 | 1) {
    setSteps((s) => { const j = i + dir; if (j < 0 || j >= s.length) return s; const n = [...s]; [n[i], n[j]] = [n[j], n[i]]; return n; });
    setActiveTpl('');
  }
  function patchConfig(i: number, key: string, val: string | number) {
    setSteps((s) => s.map((st, x) => (x === i ? { ...st, config: { ...st.config, [key]: val } } : st)));
  }
  function save() {
    const id = mine.find((w) => w.name === name)?.id ?? newWorkflowId(mine.length + 1);
    const list = upsertWorkflow({ id, name: name.trim() || 'Untitled workflow', steps });
    setMine(list); setActiveTpl(id);
  }
  function removeMine(id: string) { setMine(deleteWorkflow(id)); }

  function pick(list: FileList | null) {
    const arr = Array.from(list ?? []).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (arr.length) { setFiles(arr); setResult(null); setError(null); }
  }

  async function run() {
    if (!files.length || running) return;
    const exec = runnableSteps(steps);
    if (!exec.length) { setError('Add at least one runnable step (the “soon” steps don’t run yet).'); return; }
    setRunning(true); setError(null); setResult(null); setMsg('');
    setStates(steps.map(() => 'idle'));
    abortRef.current = new AbortController();
    const before = files.reduce((a, f) => a + f.size, 0);
    try {
      // Run each input file through the whole workflow (batch = many files).
      const out: File[] = [];
      for (const f of files) {
        const res = await runWorkflow([f], steps, {
          signal: abortRef.current.signal,
          onMsg: setMsg,
          onStep: (idx, st) => setStates((prev) => { const n = [...prev]; n[idx] = st; return n; }),
        });
        out.push(...res);
      }
      const after = out.reduce((a, f) => a + f.size, 0);
      setResult({ files: out, from: before, to: after });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The workflow could not finish. Check each step’s settings and try again.');
    } finally { setRunning(false); setMsg(''); }
  }

  async function downloadResult() {
    if (!result) return;
    if (result.files.length === 1) { downloadBlob(result.files[0], result.files[0].name); return; }
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    result.files.forEach((f) => zip.file(f.name, f));
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, 'workflow-output.zip');
  }

  const fmt = (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* On-device banner */}
      <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-2.5 text-sm">
        <ShieldCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="text-muted-foreground">Every step runs in your browser — the file never leaves your device between steps. That’s something upload-based tools can’t do.</span>
      </div>

      {/* Templates */}
      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start from a template</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => loadTemplate(t)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${activeTpl === t.id ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent'}`}>
              {t.name}
            </button>
          ))}
          <button onClick={() => { setName('Untitled workflow'); setSteps([]); setActiveTpl(''); setResult(null); }}
            className="rounded-lg border border-dashed px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            + Blank
          </button>
          {mine.map((w) => (
            <button key={w.id} onClick={() => loadTemplate(w)}
              className={`group inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${activeTpl === w.id ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent'}`}>
              ★ {w.name}
              <span onClick={(e) => { e.stopPropagation(); removeMine(w.id); }} className="opacity-0 transition-opacity group-hover:opacity-100"><X className="size-3" /></span>
            </button>
          ))}
        </div>
      </div>

      {/* Builder */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-3">
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-base font-semibold text-foreground outline-none" aria-label="Workflow name" />
          <button onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            <Save className="size-3.5" /> Save workflow
          </button>
        </div>

        {/* Pipeline */}
        <div className="p-4">
          {steps.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No steps yet — add one below.</p>}
          <ol className="space-y-2">
            {steps.map((st, i) => {
              const def = STEPS[st.id];
              const state = states[i] ?? 'idle';
              return (
                <li key={i} className={`rounded-xl border bg-background p-3 shadow-sm transition-all ${state === 'running' ? 'border-primary ring-2 ring-primary/20' : state === 'done' ? 'border-emerald-500/40' : state === 'error' ? 'border-destructive/50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-base" style={{ background: colorOf(st.id), color: '#fff' }}>{def.glyph}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{def.label}{def.soon && <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">soon</span>}</p>
                      <p className="truncate text-xs text-muted-foreground">{def.blurb}</p>
                    </div>
                    {state === 'running' && <Loader2 className="size-4 animate-spin text-primary" />}
                    {state === 'done' && <Check className="size-4 text-emerald-600 dark:text-emerald-400" />}
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => moveStep(i, -1)} disabled={i === 0} aria-label="Move up" className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
                      <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} aria-label="Move down" className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
                      <button onClick={() => removeStep(i)} aria-label="Remove step" className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="size-3.5" /></button>
                    </div>
                  </div>
                  {def.fields && def.fields.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-2.5 pl-12">
                      {def.fields.map((f) => (
                        <ConfigField key={f.key} field={f} value={st.config?.[f.key]} onChange={(v) => patchConfig(i, f.key, v)} />
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {/* Add step */}
          <div className="relative mt-3">
            <button onClick={() => setShowPalette((v) => !v)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed bg-muted/40 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
              <Plus className="size-4" /> Add a step
            </button>
            {showPalette && (
              <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border bg-card p-3 shadow-lift sm:grid-cols-3">
                {STEP_ORDER.map((id) => {
                  const d = STEPS[id];
                  return (
                    <button key={id} onClick={() => !d.soon && addStep(id)} disabled={d.soon}
                      className={`flex items-center gap-2 rounded-lg border p-2 text-left text-sm ${d.soon ? 'cursor-not-allowed opacity-50' : 'hover:border-primary/50 hover:bg-accent'}`}>
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md text-sm" style={{ background: colorOf(id), color: '#fff' }}>{d.glyph}</span>
                      <span className="min-w-0"><span className="block truncate font-medium">{d.label}</span>{d.soon && <span className="text-[10px] text-amber-600 dark:text-amber-400">soon</span>}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Run bar */}
        <div className="flex flex-wrap items-center gap-3 border-t bg-muted/40 px-4 py-3">
          <input ref={inputRef} type="file" accept="application/pdf" multiple hidden onChange={(e) => pick(e.target.files)} />
          <button onClick={() => inputRef.current?.click()}
            className="flex flex-1 items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-sm text-muted-foreground hover:bg-primary/10">
            <Upload className="size-4 text-primary" />
            {files.length === 0 ? <span><b className="text-foreground">Choose a PDF</b> — or several to run the batch</span>
              : <span><b className="text-foreground">{files.length} file{files.length > 1 ? 's' : ''}</b> ready · {fmt(files.reduce((a, f) => a + f.size, 0))}</span>}
          </button>
          {running
            ? <button onClick={() => abortRef.current?.abort()} className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent">Cancel</button>
            : <button onClick={run} disabled={!files.length || steps.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40">
                <Play className="size-4" /> Run workflow
              </button>}
        </div>

        {(running && msg) && <p className="px-4 pb-3 text-xs text-muted-foreground">{msg}…</p>}

        {error && (
          <div className="mx-4 mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
        )}

        {result && (
          <div className="mx-4 mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-4 py-3">
            <Check className="size-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm">
              <b>Done</b> — {result.files.length} file{result.files.length > 1 ? 's' : ''} ·{' '}
              <span className="font-mono text-emerald-700 dark:text-emerald-400">{fmt(result.from)} → {fmt(result.to)}</span>
            </span>
            <button onClick={downloadResult} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
              <Download className="size-4" /> Download {result.files.length > 1 ? 'zip' : 'result'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
