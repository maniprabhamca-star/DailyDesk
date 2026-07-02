// Classic (non-bundled) worker for qpdf: keeps the emscripten glue out of the
// webpack build entirely (its guarded `fs` reference breaks bundlers) and runs
// the SYNCHRONOUS qpdf CLI off the main thread. Loaded via
// `new Worker('/qpdf/qpdf-worker.js')` from lib/qpdf.ts.
/* global Module */
importScripts('/qpdf/qpdf.js');

self.onmessage = async (e) => {
  try {
    const { buffer, args } = e.data;
    const qpdf = await Module({ locateFile: () => '/qpdf/qpdf.wasm', noInitialRun: true });
    qpdf.FS.writeFile('/in.pdf', new Uint8Array(buffer));
    let code = 0;
    try {
      code = qpdf.callMain(args);
    } catch (err) {
      code = -1;
    }
    if (code !== 0) {
      self.postMessage({ ok: false, code });
      return;
    }
    const out = qpdf.FS.readFile('/out.pdf');
    self.postMessage({ ok: true, bytes: out }, [out.buffer]);
  } catch (err) {
    self.postMessage({ ok: false, code: -1, error: String((err && err.message) || err) });
  }
};
