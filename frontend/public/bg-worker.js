/* Background-removal inference worker (classic worker, no bundler — same
   pattern as /qpdf/qpdf-worker.js: onnxruntime-web's ESM bundle breaks
   webpack worker chunks via import.meta, so the UMD build is loaded here
   with importScripts and everything stays in /public).

   Model: ISNet `isnet-general-use` (Apache-2.0, github.com/xuebinqin/DIS),
   quantized QUInt8 (~44MB) — see /models/LICENSE.txt. Runtime: ONNX Runtime
   Web (MIT) — see /ort/LICENSE.txt. WebGPU when available, WASM fallback.

   NOTE: ort's UMD loads its wasm glue via dynamic import(), which some
   browsers disallow in classic workers (older Firefox). That failure is
   caught by lib/remove-bg.ts, which falls back to main-thread inference.

   Protocol: {type:'run', data: Float32Array [1,3,1024,1024] CHW (x/255-0.5)}
   → {type:'progress', stage, pct} … → {type:'matte', alpha: Uint8ClampedArray}
   or {type:'error', message}. */

importScripts('/ort/ort.all.min.js');

var MODEL_URL = '/models/isnet-quint8.onnx';
var SIDE = 1024;
var sessionPromise = null;

function post(type, extra) {
  var m = { type: type };
  if (extra) for (var k in extra) m[k] = extra[k];
  self.postMessage(m);
}

async function fetchModel() {
  var res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error('Model download failed (' + res.status + ')');
  var total = Number(res.headers.get('Content-Length')) || 0;
  if (!res.body || !total) return new Uint8Array(await res.arrayBuffer());
  var reader = res.body.getReader();
  var buf = new Uint8Array(total);
  var off = 0;
  for (;;) {
    var r = await reader.read();
    if (r.done) break;
    buf.set(r.value, off);
    off += r.value.length;
    post('progress', { stage: 'model', pct: Math.round((off / total) * 100) });
  }
  return buf.subarray(0, off);
}

function getSession() {
  if (!sessionPromise) {
    sessionPromise = (async function () {
      ort.env.wasm.wasmPaths = '/ort/';
      ort.env.wasm.numThreads = 1; // no crossOriginIsolation on this origin
      var bytes = await fetchModel();
      post('progress', { stage: 'init', pct: 0 });
      try {
        return await ort.InferenceSession.create(bytes, { executionProviders: ['webgpu', 'wasm'] });
      } catch (e) {
        return await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
      }
    })();
    sessionPromise.catch(function () { sessionPromise = null; });
  }
  return sessionPromise;
}

self.onmessage = async function (e) {
  var msg = e.data;
  if (!msg || msg.type !== 'run') return;
  try {
    var session = await getSession();
    post('progress', { stage: 'infer', pct: 0 });
    var input = new ort.Tensor('float32', msg.data, [1, 3, SIDE, SIDE]);
    var feeds = {};
    feeds[session.inputNames[0]] = input;
    var out = await session.run(feeds);
    var matte = out[session.outputNames[0]].data;
    var mi = Infinity, ma = -Infinity, i, v;
    for (i = 0; i < matte.length; i++) { v = matte[i]; if (v < mi) mi = v; if (v > ma) ma = v; }
    var range = ma - mi || 1;
    var alpha = new Uint8ClampedArray(matte.length);
    for (i = 0; i < matte.length; i++) alpha[i] = ((matte[i] - mi) / range) * 255;
    self.postMessage({ type: 'matte', alpha: alpha }, [alpha.buffer]);
  } catch (err) {
    post('error', { message: (err && err.message) || String(err) });
  }
};
