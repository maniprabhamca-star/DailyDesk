'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Send, Check, Bug, Lightbulb, Heart, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { api } from '@/lib/api';

const categories = [
  { id: 'idea', label: 'Idea', icon: Lightbulb },
  { id: 'bug', label: 'Bug', icon: Bug },
  { id: 'praise', label: 'Praise', icon: Heart },
  { id: 'other', label: 'Other', icon: HelpCircle },
] as const;

export default function FeedbackPage() {
  const [category, setCategory] = useState<string>('idea');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 3) { setError('Please share a little more detail.'); return; }
    setBusy(true); setError(null);
    try {
      await api.post('/api/feedback', {
        category, message: message.trim(), email: email.trim() || undefined,
        page: typeof window !== 'undefined' ? window.location.pathname : undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send — please try again.');
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-4 py-14 sm:px-6">
        <div className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><MessageSquare className="size-6" /></span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Tell us what you think</h1>
          <p className="mt-2 text-muted-foreground">
            We&rsquo;re in launch and building with your input. Which tools do you love? What would you want in
            <strong className="text-foreground"> Pro</strong> — OCR, batch, bigger files, AI? What&rsquo;s missing?
          </p>
        </div>

        {done ? (
          <div className="mt-10 rounded-2xl border bg-card p-8 text-center shadow-soft">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="size-6" strokeWidth={3} /></span>
            <h2 className="mt-4 text-lg font-bold">Thank you! 🙌</h2>
            <p className="mt-2 text-sm text-muted-foreground">Your feedback went straight to the team — it genuinely shapes what we build next.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild variant="outline"><Link href="/#tools">Back to the tools</Link></Button>
              <Button onClick={() => { setDone(false); setMessage(''); }}>Send more feedback</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-10 space-y-5 rounded-2xl border bg-card p-6 shadow-soft sm:p-7">
            <div className="space-y-2">
              <Label>What kind of feedback?</Label>
              <div className="grid grid-cols-4 gap-2">
                {categories.map((c) => {
                  const Icon = c.icon; const active = category === c.id;
                  return (
                    <button type="button" key={c.id} onClick={() => setCategory(c.id)}
                      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}`}>
                      <Icon className="size-5" /> {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="message">Your feedback</Label>
              <textarea id="message" required value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={5000}
                placeholder="Tell us anything — the tools you love, a feature you'd pay for in Pro (OCR, batch, bigger files, AI…), a bug, or what you think so far…"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email <span className="font-normal text-muted-foreground">(optional — if you&rsquo;d like a reply)</span></Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>

            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? 'Sending…' : <><Send className="size-4" /> Send feedback</>}
            </Button>
            <p className="text-center text-xs text-muted-foreground">No account needed. We only use this to improve DiemDesk.</p>
          </form>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
