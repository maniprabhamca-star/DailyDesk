// Pure qpdf CLI argument builder — shared by the worker and the inline
// fallback WITHOUT importing the worker module on the main thread (its
// `self.onmessage` assignment must never run against `window`).
export type QpdfOp =
  | { type: 'encrypt'; password: string; allowPrint: boolean; allowCopy: boolean }
  | { type: 'decrypt'; password: string };

export function buildArgs(op: QpdfOp): string[] {
  return op.type === 'encrypt'
    ? [
        '--encrypt', op.password, op.password, '256',
        ...(op.allowPrint ? [] : ['--print=none']),
        ...(op.allowCopy ? [] : ['--extract=n']),
        '--', '/in.pdf', '/out.pdf',
      ]
    : [`--password=${op.password}`, '--decrypt', '/in.pdf', '/out.pdf'];
}
