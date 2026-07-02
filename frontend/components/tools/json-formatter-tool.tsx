'use client';

import { useRef, useState } from 'react';
import { Copy, Check, Download, Upload, Eraser, Braces, Minimize2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';

// Format, minify, and validate JSON — entirely on your device. That matters:
// people paste API responses full of tokens and customer data into JSON tools.

type Indent = '2' | '4' | 'tab';
const INDENTS: Record<Indent, string | number> = { '2': 2, '4': 4, tab: '\t' };

// Character offset -> line/column for friendly error messages.
function lineCol(text: string, pos: number): { line: number; col: number } {
  const upTo = text.slice(0, pos);
  const line = (upTo.match(/\n/g) || []).length + 1;
  const col = pos - upTo.lastIndexOf('\n');
  return { line, col };
}

function sortKeysDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = sortKeysDeep((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}

function countNodes(v: unknown): number {
  if (Array.isArray(v)) return 1 + v.reduce((a: number, x) => a + countNodes(x), 0);
  if (v && typeof v === 'object') return 1 + Object.values(v).reduce((a: number, x) => a + countNodes(x), 0);
  return 1;
}

// Lightweight syntax colouring (skipped for very large outputs).
const HL_LIMIT = 300 * 1024;
function highlight(json: string): React.ReactNode {
  if (json.length > HL_LIMIT) return json;
  const parts: React.ReactNode[] = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(json))) {
    if (m.index > last) parts.push(json.slice(last, m.index));
    if (m[1] && m[2]) {
      parts.push(<span key={key++} className="text-sky-600 dark:text-sky-400">{m[1]}</span>, m[2]);
    } else if (m[1]) {
      parts.push(<span key={key++} className="text-emerald-600 dark:text-emerald-400">{m[1]}</span>);
    } else if (m[3]) {
      parts.push(<span key={key++} className="text-violet-600 dark:text-violet-400">{m[3]}</span>);
    } else {
      parts.push(<span key={key++} className="text-amber-600 dark:text-amber-400">{m[0]}</span>);
    }
    last = m.index + m[0].length;
  }
  parts.push(json.slice(last));
  return parts;
}

const SAMPLE = `{
  "product": "DailyDesk",
  "tools": 23,
  "private": true,
  "features": ["merge", "split", "compress"],
  "pricing": { "free": 0, "pro": 4 }
}`;

export function JsonFormatterTool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [indent, setIndent] = useState<Indent>('2');
  const [sortKeys, setSortKeys] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ nodes: number; bytes: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function run(mode: 'format' | 'minify') {
    setError(null);
    setStats(null);
    setOutput('');
    if (!input.trim()) { setError('Paste some JSON first.'); return; }
    try {
      let value: unknown = JSON.parse(input);
      if (sortKeys) value = sortKeysDeep(value);
      const out = mode === 'format' ? JSON.stringify(value, null, INDENTS[indent]) : JSON.stringify(value);
      setOutput(out);
      setStats({ nodes: countNodes(value), bytes: new Blob([out]).size });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON.';
      const at = msg.match(/position (\d+)/);
      if (at) {
        const { line, col } = lineCol(input, Number(at[1]));
        setError(`${msg.replace(/ in JSON at position \d+.*/, '')} — line ${line}, column ${col}`);
      } else {
        setError(msg);
      }
    }
  }

  async function copyOut() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }

  function upload(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    void f.text().then(setInput);
  }

  const selectCls = 'h-8 rounded-lg border bg-card px-2 text-xs font-medium outline-none focus:border-primary';

  return (
    <Card>
      <CardContent className="p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => run('format')}><Braces className="size-4" /> Format</Button>
              <Button size="sm" variant="outline" onClick={() => run('minify')}><Minimize2 className="size-4" /> Minify</Button>
              <select className={selectCls} value={indent} onChange={(e) => setIndent(e.target.value as Indent)} aria-label="Indentation">
                <option value="2">2 spaces</option>
                <option value="4">4 spaces</option>
                <option value="tab">Tabs</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs font-medium">
                <input type="checkbox" checked={sortKeys} onChange={(e) => setSortKeys(e.target.checked)} className="accent-[hsl(var(--primary))]" /> Sort keys
              </label>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Paste JSON here — e.g. {"hello": "world"}'
              spellCheck={false}
              className="h-80 w-full resize-y rounded-xl border bg-background p-3 font-mono text-xs leading-relaxed outline-none focus:border-primary"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="size-4" /> Open .json</Button>
              <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { upload(e.target.files); e.currentTarget.value = ''; }} />
              <Button size="sm" variant="ghost" onClick={() => setInput(SAMPLE)}>Sample</Button>
              <Button size="sm" variant="ghost" onClick={() => { setInput(''); setOutput(''); setError(null); setStats(null); }} disabled={!input}><Eraser className="size-4" /> Clear</Button>
            </div>
          </div>

          <div>
            <div className="mb-2 flex min-h-8 flex-wrap items-center gap-2">
              {stats && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" /> Valid JSON · {stats.nodes.toLocaleString()} nodes · {(stats.bytes / 1024).toFixed(1)} KB
                </span>
              )}
              {output && (
                <span className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={copyOut}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copy</Button>
                  <Button size="sm" variant="outline" onClick={() => download(new Blob([output], { type: 'application/json' }), 'formatted.json')}><Download className="size-4" /> Download</Button>
                </span>
              )}
            </div>
            {error ? (
              <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
              </p>
            ) : (
              <pre className="h-80 overflow-auto rounded-xl border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
                {output ? highlight(output) : <span className="text-muted-foreground">Formatted output appears here…</span>}
              </pre>
            )}
          </div>
        </div>

        <KeepGoing exclude="/json-formatter" />
      </CardContent>
    </Card>
  );
}
