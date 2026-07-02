'use client';

import { useMemo, useRef, useState } from 'react';
import { Copy, Eraser, Upload, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { KeepGoing } from '@/components/app/keep-going';

// Everything computes LIVE on your device as you type — nothing is sent
// anywhere, which matters when people paste drafts, essays, and work emails.

const STOPWORDS = new Set(
  'the,a,an,and,or,but,if,then,else,for,nor,so,yet,to,of,in,on,at,by,with,from,as,is,are,was,were,be,been,being,am,do,does,did,have,has,had,will,would,can,could,shall,should,may,might,must,this,that,these,those,it,its,he,she,they,them,his,her,their,we,us,our,you,your,i,me,my,mine,not,no,about,into,over,after,before,between,out,up,down,off,than,too,very,just,also,there,here,what,when,where,which,who,whom,how,why,all,each,both,few,more,most,other,some,such,only,own,same,s,t,don,now'.split(','),
);

type Stats = {
  words: number; chars: number; charsNoSpace: number; sentences: number; paragraphs: number;
  lines: number; unique: number; avgWordLen: number; avgSentenceWords: number;
  readMin: number; speakMin: number; keywords: Array<{ word: string; count: number; pct: number }>;
};

function analyze(text: string): Stats {
  const trimmed = text.trim();
  const wordList = trimmed ? trimmed.split(/\s+/) : [];
  const words = wordList.length;
  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, '').length;
  const sentences = trimmed ? (trimmed.match(/[^.!?…]+[.!?…]+(\s|$)|[^.!?…]+$/g) || []).length : 0;
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter((p) => p.trim()).length : 0;
  const lines = trimmed ? text.split('\n').filter((l) => l.trim()).length : 0;
  // es5-safe "strip punctuation from the edges" (letters incl. Latin accents + digits stay)
  const EDGE = /^[^a-z0-9À-ɏ]+|[^a-z0-9À-ɏ]+$/g;
  const normalized = wordList.map((w) => w.toLowerCase().replace(EDGE, '')).filter(Boolean);
  const unique = new Set(normalized).size;
  const freq = new Map<string, number>();
  for (const w of normalized) {
    if (w.length < 3 || STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const keywords = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count, pct: words ? Math.round((count / words) * 1000) / 10 : 0 }));
  return {
    words, chars, charsNoSpace, sentences, paragraphs, lines, unique,
    avgWordLen: words ? Math.round((charsNoSpace / words) * 10) / 10 : 0,
    avgSentenceWords: sentences ? Math.round((words / sentences) * 10) / 10 : 0,
    readMin: words / 200, // average silent reading speed
    speakMin: words / 130, // average speaking speed
    keywords,
  };
}

function fmtTime(min: number): string {
  if (min <= 0) return '0 sec';
  if (min < 1) return `${Math.max(1, Math.round(min * 60))} sec`;
  const m = Math.floor(min);
  const s = Math.round((min - m) * 60);
  return s ? `${m} min ${s} sec` : `${m} min`;
}

function toTitleCase(t: string) {
  return t.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
function toSentenceCase(t: string) {
  return t.toLowerCase().replace(/(^\s*[a-zÀ-ɏ]|[.!?]\s+[a-zÀ-ɏ])/gm, (c) => c.toUpperCase());
}

export function WordCounterTool() {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const s = useMemo(() => analyze(text), [text]);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  }

  function uploadTxt(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    void f.text().then(setText);
  }

  const bigStats: Array<[string, string | number]> = [
    ['Words', s.words], ['Characters', s.chars], ['No spaces', s.charsNoSpace],
    ['Sentences', s.sentences], ['Paragraphs', s.paragraphs], ['Lines', s.lines],
    ['Unique words', s.unique], ['Reading time', fmtTime(s.readMin)], ['Speaking time', fmtTime(s.speakMin)],
  ];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type or paste your text here — everything counts live, and nothing leaves your browser…"
              className="h-72 w-full resize-y rounded-xl border bg-background p-3 text-sm leading-relaxed outline-none focus:border-primary"
              autoFocus
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="size-4" /> Open .txt</Button>
              <input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => { uploadTxt(e.target.files); e.currentTarget.value = ''; }} />
              <Button size="sm" variant="outline" onClick={copyText} disabled={!text}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copy</Button>
              <Button size="sm" variant="outline" onClick={() => setText('')} disabled={!text}><Eraser className="size-4" /> Clear</Button>
              <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
              <Button size="sm" variant="ghost" onClick={() => setText((t) => t.toUpperCase())} disabled={!text}>UPPER</Button>
              <Button size="sm" variant="ghost" onClick={() => setText((t) => t.toLowerCase())} disabled={!text}>lower</Button>
              <Button size="sm" variant="ghost" onClick={() => setText(toTitleCase)} disabled={!text}>Title Case</Button>
              <Button size="sm" variant="ghost" onClick={() => setText(toSentenceCase)} disabled={!text}>Sentence case</Button>
            </div>
          </div>

          <div>
            <div className="grid grid-cols-3 gap-2">
              {bigStats.map(([label, value]) => (
                <div key={label} className="rounded-xl border bg-card px-2 py-2.5 text-center">
                  <p className="truncate text-base font-bold tabular-nums">{value}</p>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl border bg-card px-2 py-2">
                <p className="text-sm font-semibold tabular-nums">{s.avgWordLen || '—'}</p>
                <p className="text-[11px] text-muted-foreground">Avg word length</p>
              </div>
              <div className="rounded-xl border bg-card px-2 py-2">
                <p className="text-sm font-semibold tabular-nums">{s.avgSentenceWords || '—'}</p>
                <p className="text-[11px] text-muted-foreground">Words / sentence</p>
              </div>
            </div>

            {s.keywords.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Keyword density (top {s.keywords.length})</p>
                <ul className="divide-y rounded-xl border bg-card text-sm">
                  {s.keywords.map((k) => (
                    <li key={k.word} className="flex items-center justify-between px-3 py-1.5">
                      <span className="truncate font-medium">{k.word}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{k.count} · {k.pct}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <KeepGoing exclude="/word-counter" />
      </CardContent>
    </Card>
  );
}
