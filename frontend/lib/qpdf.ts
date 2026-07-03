// Main-thread entry for qpdf operations (Protect/Unlock PDF). qpdf runs as
// WebAssembly served from /public/qpdf/ (Apache-2.0, LICENSE.txt alongside) —
// NOT bundled: the emscripten glue fights webpack, so the worker is a classic
// script (/qpdf/qpdf-worker.js) and the inline fallback loads the same glue via
// a script tag. callMain is synchronous wasm, so the worker path matters: on
// the main thread a big file would freeze the tab. Failures map exit codes to
// friendly messages; for decrypt, non-zero almost always means wrong password.
import { buildArgs, type QpdfOp } from './qpdf-args';

export type { QpdfOp };

/** Thrown with a user-presentable message. `wrongPassword` lets the unlock UI
 * keep the file loaded so the user can simply retype. */
export class QpdfError extends Error {
  wrongPassword: boolean;
  constructor(message: string, wrongPassword = false) {
    super(message);
    this.wrongPassword = wrongPassword;
  }
}

function friendly(op: QpdfOp, code: number): QpdfError {
  if (op.type === 'decrypt') {
    return new QpdfError('That password didn’t unlock this PDF — double-check it and try again.', true);
  }
  if (op.type === 'flatten') {
    return new QpdfError(
      code === 2
        ? 'This PDF is password-protected — remove the password first with Unlock PDF, then flatten it.'
        : 'Could not flatten this PDF — it may be corrupted.',
    );
  }
  return new QpdfError(
    code === 2
      ? 'Could not protect this PDF. If it already has a password, remove it first with Unlock PDF.'
      : 'Could not protect this PDF — it may be corrupted.',
  );
}

function runInWorker(buffer: ArrayBuffer, op: QpdfOp): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker('/qpdf/qpdf-worker.js');
    } catch (e) {
      reject(e);
      return;
    }
    worker.onmessage = (e: MessageEvent<{ ok: boolean; bytes?: Uint8Array; code?: number }>) => {
      worker.terminate();
      if (e.data.ok && e.data.bytes) resolve(e.data.bytes);
      else reject(friendly(op, e.data.code ?? -1));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('worker-failed'));
    };
    worker.postMessage({ buffer, args: buildArgs(op) }, [buffer]);
  });
}

// ---- inline fallback (no worker support): same glue via a script tag --------
type QpdfInstance = {
  callMain: (args: string[]) => number;
  FS: { writeFile: (p: string, d: Uint8Array) => void; readFile: (p: string) => Uint8Array };
};
type QpdfFactory = (opts: { locateFile: () => string; noInitialRun: boolean }) => Promise<QpdfInstance>;

async function loadFactory(): Promise<QpdfFactory> {
  const w = window as unknown as { Module?: QpdfFactory };
  if (typeof w.Module === 'function') return w.Module;
  await new Promise<void>((res, rej) => {
    const s = document.createElement('script');
    s.src = '/qpdf/qpdf.js';
    s.onload = () => res();
    s.onerror = () => rej(new Error('Could not load the PDF encryption engine.'));
    document.head.appendChild(s);
  });
  if (typeof w.Module !== 'function') throw new Error('Could not start the PDF encryption engine.');
  return w.Module;
}

async function runInline(buffer: ArrayBuffer, op: QpdfOp): Promise<Uint8Array> {
  const factory = await loadFactory();
  const qpdf = await factory({ locateFile: () => '/qpdf/qpdf.wasm', noInitialRun: true });
  qpdf.FS.writeFile('/in.pdf', new Uint8Array(buffer));
  let code = 0;
  try {
    code = qpdf.callMain(buildArgs(op));
  } catch {
    code = -1;
  }
  if (code !== 0) throw friendly(op, code);
  return qpdf.FS.readFile('/out.pdf');
}

export async function runQpdf(src: File | Blob, op: QpdfOp): Promise<Uint8Array> {
  try {
    // Buffer is TRANSFERRED to the worker — re-read the file on fallback.
    return await runInWorker(await src.arrayBuffer(), op);
  } catch (e) {
    if (e instanceof QpdfError) throw e; // real qpdf failure — don't retry inline
    return runInline(await src.arrayBuffer(), op);
  }
}
