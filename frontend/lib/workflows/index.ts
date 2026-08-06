// Saved Workflows — types, runner, templates, and local persistence.
export * from './steps';
import { STEPS, type StepId, type WorkflowStep } from './steps';

export type Workflow = { id: string; name: string; steps: WorkflowStep[] };
export type StepState = 'idle' | 'running' | 'done' | 'error';

/** Run a workflow over one or more files, entirely on-device, step by step.
 *  Each step's output File(s) feed the next. Reports progress per step. */
export async function runWorkflow(
  files: File[],
  steps: WorkflowStep[],
  cb?: { onStep?: (index: number, state: StepState) => void; onMsg?: (m: string) => void; signal?: AbortSignal },
): Promise<File[]> {
  let cur = files;
  for (let i = 0; i < steps.length; i++) {
    const def = STEPS[steps[i].id];
    if (!def?.run) { cb?.onStep?.(i, 'done'); continue; } // not-yet-wired step: skip, don't break the chain
    cb?.onStep?.(i, 'running');
    try {
      cur = await def.run(cur, steps[i].config ?? {}, cb?.signal, cb?.onMsg);
      cb?.onStep?.(i, 'done');
    } catch (e) {
      cb?.onStep?.(i, 'error');
      throw e;
    }
  }
  return cur;
}

/** Only steps that actually execute today. */
export function runnableSteps(steps: WorkflowStep[]): WorkflowStep[] {
  return steps.filter((s) => !STEPS[s.id]?.soon);
}

// ---- starter templates (wired steps only) ----------------------------------
export const TEMPLATES: Workflow[] = [
  { id: 'tpl-sendsafe', name: 'Send-safe', steps: [
    { id: 'remove-metadata' }, { id: 'compress-size', config: { targetMb: 2 } } ] },
  { id: 'tpl-email', name: 'Email-ready', steps: [
    { id: 'flatten' }, { id: 'compress-size', config: { targetMb: 5 } } ] },
  { id: 'tpl-packet', name: 'Client packet', steps: [
    { id: 'merge' }, { id: 'delete', config: { pages: '' } }, { id: 'compress-size', config: { targetMb: 3 } } ] },
  { id: 'tpl-number', name: 'Number & lock', steps: [
    { id: 'page-numbers', config: { template: '{n}', pos: 'bc' } }, { id: 'protect', config: { password: '' } } ] },
];

// ---- local persistence (on-device; account sync is a fast-follow) ----------
const KEY = 'dd-workflows-v1';

export function loadWorkflows(): Workflow[] {
  if (typeof localStorage === 'undefined') return [];
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Workflow[]) : []; } catch { return []; }
}
export function saveWorkflows(list: Workflow[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* private mode / quota */ }
}
export function upsertWorkflow(wf: Workflow): Workflow[] {
  const list = loadWorkflows();
  const i = list.findIndex((w) => w.id === wf.id);
  if (i >= 0) list[i] = wf; else list.unshift(wf);
  saveWorkflows(list);
  return list;
}
export function deleteWorkflow(id: string): Workflow[] {
  const list = loadWorkflows().filter((w) => w.id !== id);
  saveWorkflows(list);
  return list;
}
export function newWorkflowId(seed: number): string {
  // Deterministic-ish id without Date.now()/Math.random (sandbox-safe); the
  // caller passes a monotonic seed (e.g. list length + a counter).
  return `wf-${seed.toString(36)}-${(seed * 2654435761 % 1e9).toString(36)}`;
}
