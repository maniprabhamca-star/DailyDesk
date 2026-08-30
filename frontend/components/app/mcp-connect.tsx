'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Terminal, Copy, Check, Trash2, Plus, Loader2, AlertTriangle, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cliCommand, desktopConfig } from '@/lib/mcp-setup';

// Connect an assistant to this account, in one click.
//
// The setup page used to say "paste your token" and show a config block reading
// `paste-your-token-here`. There was nowhere to get one: the only credential
// that existed was the login JWT in localStorage, so the real instruction was
// "open DevTools" — not something to ask a paying customer to do. And that JWT
// expires after 30 days, at which point the assistant told an actual subscriber
// "this needs a Pro account": wrong, and unactionable.
//
// So the token is minted here, shown once, and copied as a finished config
// block rather than a bare string — because the string on its own still leaves
// someone editing JSON by hand. One button, one paste, done.

const API = process.env.NEXT_PUBLIC_API_URL || '';

type TokenRow = { id: string; preview: string; label: string; lastUsedAt: string | null; createdAt: string };

const authHeaders = (): Record<string, string> => {
  try {
    const t = localStorage.getItem('dd_token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
};

function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch { /* clipboard blocked — the text is on screen and selectable */ }
  };
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <button
          onClick={() => void copy()}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors hover:border-primary/60 hover:text-primary"
        >
          {done ? <><Check className="size-3" /> Copied</> : <><Copy className="size-3" /> Copy</>}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 text-[11.5px] leading-relaxed"><code>{value}</code></pre>
    </div>
  );
}

export function McpConnect() {
  const [rows, setRows] = useState<TokenRow[] | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/user/mcp-tokens`, { headers: authHeaders() });
      if (!res.ok) { setRows([]); return; }
      const d = await res.json();
      setRows(d.tokens || []);
    } catch { setRows([]); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API}/api/user/mcp-tokens`, {
        method: 'POST',
        headers: { ...authHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify({ label: 'Claude' }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.message || 'Could not create a token.'); return; }
      setFresh(d.token);
      void load();
    } catch { setError('Could not reach the server.'); }
    finally { setBusy(false); }
  };

  const revoke = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`${API}/api/user/mcp-tokens/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) { setError('Could not revoke that token.'); return; }
      // Clear the just-created block too. Revoking while it was still on screen
      // left a dead end: the panel kept showing a token that no longer worked,
      // and both buttons are hidden while it is up, so there was no way back to
      // "Connect Claude" short of reloading the page.
      setFresh(null);
      void load();
    } catch { setError('Could not reach the server.'); }
  };

  return (
    <section className="mt-4 rounded-2xl border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Terminal className="size-4 text-primary" /> Use DiemDesk inside Claude
          </h2>
          <p className="mt-1 max-w-[58ch] text-sm text-muted-foreground">
            Ask your assistant to convert a file and it happens — on your own machine, no browser. Connecting your
            account lifts the daily limit and unlocks OCR.{' '}
            <Link href="/mcp-server" className="font-medium underline">How it works</Link>
          </p>
        </div>
        {rows !== null && rows.length === 0 && !fresh && (
          <Button size="sm" onClick={() => void create()} disabled={busy} className="bg-primary text-primary-foreground">
            {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Plus className="mr-1.5 size-4" />}
            Connect Claude
          </Button>
        )}
      </div>

      {/* Shown once. Copy targets are complete commands rather than a bare
          string, because a token alone still leaves someone hand-editing JSON. */}
      {fresh && (
        <div className="mt-4 rounded-xl border border-primary/40 bg-primary/[0.06] p-4">
          <p className="flex items-start gap-2 text-sm font-semibold">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" />
            Your token is ready — copy it now, it is not shown again
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick whichever matches your app. Both already contain the token, so there is nothing to fill in.
          </p>

          <CopyRow label="Claude Code — paste into a terminal" value={cliCommand(fresh)} />
          <CopyRow label="Claude Desktop — paste into claude_desktop_config.json" value={desktopConfig(fresh)} />

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            Restart the app completely afterwards — it reads this once, at startup. Treat the token like a password:
            it works until you revoke it below.
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setFresh(null)}>Done</Button>
        </div>
      )}

      {rows === null ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length > 0 ? (
        <ul className="mt-4 divide-y rounded-xl border">
          {rows.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5">
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{t.preview}</code>
              <span className="text-sm font-medium">{t.label}</span>
              <span className="text-xs text-muted-foreground">
                {t.lastUsedAt
                  ? `last used ${new Date(t.lastUsedAt).toLocaleDateString()}`
                  : 'never used'}
              </span>
              <button
                onClick={() => void revoke(t.id)}
                className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" /> Revoke
              </button>
            </li>
          ))}
        </ul>
      ) : !fresh ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Not connected yet. Without a token the tools still work at the free daily allowance — connecting only lifts
          the cap.
        </p>
      ) : null}

      {rows !== null && rows.length > 0 && !fresh && (
        <Button size="sm" variant="outline" className="mt-3" onClick={() => void create()} disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Plus className="mr-1.5 size-4" />}
          Add another
        </Button>
      )}

      {error && <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">{error}</p>}
    </section>
  );
}
