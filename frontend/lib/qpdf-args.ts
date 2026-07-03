// Pure qpdf CLI argument builder — shared by the worker and the inline
// fallback WITHOUT importing the worker module on the main thread (its
// `self.onmessage` assignment must never run against `window`).
export type QpdfOp =
  | { type: 'encrypt'; password: string; allowPrint: boolean; allowCopy: boolean }
  | { type: 'decrypt'; password: string }
  | { type: 'flatten' };

export function buildArgs(op: QpdfOp): string[] {
  switch (op.type) {
    case 'encrypt':
      return [
        '--encrypt', op.password, op.password, '256',
        ...(op.allowPrint ? [] : ['--print=none']),
        ...(op.allowCopy ? [] : ['--extract=n']),
        '--', '/in.pdf', '/out.pdf',
      ];
    case 'decrypt':
      return [`--password=${op.password}`, '--decrypt', '/in.pdf', '/out.pdf'];
    case 'flatten':
      // --generate-appearances first: fields filled by other apps may lack
      // appearance streams; without it their values would vanish on flatten.
      // No `--` separator — that's specific to --encrypt's key list (with it,
      // some paths report "unknown argument /out.pdf"). Gate: dev-harness/flatten-qa.js.
      return ['--generate-appearances', '--flatten-annotations=all', '/in.pdf', '/out.pdf'];
  }
}
