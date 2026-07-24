'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Upload } from 'lucide-react';

// The live upload counter — the privacy claim, measured instead of asserted.
//
// WHY IT IS NOT A REQUEST COUNTER: the site legitimately makes same-origin
// requests while you work (page chunks, the WASM engines, a usage beacon). A
// badge reading "0 requests" would simply be false, and a privacy claim that is
// wrong once costs more than this whole component earns. So it counts one
// specific, honest thing: BYTES OF FILE DATA leaving the tab.
//
// PerformanceObserver cannot help here — resource timings expose response
// sizes, never request-body sizes. So we wrap fetch and XHR.send and measure the
// outgoing body: a Blob/File/FormData/ArrayBuffer is file data, a JSON string is
// not. On a server-backed tool (Office conversions, OCR) this correctly counts
// UP, and says so, rather than quietly disappearing.

type Body = unknown;

function fileBytes(body: Body): number {
  if (!body) return 0;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body as ArrayBufferView)) return (body as ArrayBufferView).byteLength;
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    let n = 0;
    body.forEach((v) => { if (typeof Blob !== 'undefined' && v instanceof Blob) n += v.size; });
    return n; // only the file parts — text fields are not "your file"
  }
  return 0; // strings, URLSearchParams, null: not file data
}

function fmt(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadWatch() {
  const [sent, setSent] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as {
      fetch: typeof fetch;
      XMLHttpRequest: typeof XMLHttpRequest;
    };
    const origFetch = w.fetch;
    const origSend = w.XMLHttpRequest?.prototype?.send;
    let alive = true;
    const add = (n: number) => { if (alive && n > 0) setSent((s) => s + n); };

    w.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
      try {
        // A Request object carries its own body; an init body is the common case.
        if (init?.body) add(fileBytes(init.body));
        else if (typeof Request !== 'undefined' && input instanceof Request && input.body) {
          // Body is a stream here — size is not knowable without consuming it,
          // which would break the request. Counted as unknown, never as zero.
        }
      } catch { /* never let the meter break a request */ }
      return origFetch.call(this, input as RequestInfo, init);
    } as typeof fetch;

    if (origSend) {
      w.XMLHttpRequest.prototype.send = function patchedSend(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
        try { add(fileBytes(body)); } catch { /* ignore */ }
        return origSend.call(this, body as XMLHttpRequestBodyInit | null);
      };
    }

    return () => {
      alive = false;
      w.fetch = origFetch;
      if (origSend) w.XMLHttpRequest.prototype.send = origSend;
    };
  }, []);

  const clean = sent === 0;

  return (
    <div
      className={`mt-4 flex items-start gap-2.5 rounded-xl border p-3 text-sm ${
        clean
          ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
          : 'border-amber-500/30 bg-amber-500/[0.06]'
      }`}
    >
      {clean ? (
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Upload className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      )}
      <p className="leading-relaxed text-muted-foreground">
        {clean ? (
          <>
            <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">0 bytes</span>
            {' '}of your file have left this device. Counted live in this tab, not claimed —{' '}
            <span className="text-foreground">open your browser&rsquo;s Network tab and watch.</span>
          </>
        ) : (
          <>
            <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">{fmt(sent)}</span>
            {' '}uploaded — this tool does part of its work on our server. The copy is deleted as soon as it is done.
          </>
        )}
      </p>
    </div>
  );
}
