// QA for Protect/Unlock PDF (qpdf-wasm): AES-256 encrypt -> verify pdf.js
// opens ONLY with the password; decrypt round-trip -> opens freely; wrong
// password -> clean failure with a readable stderr message; permission flags.
// Usage: node qpdf-qa.js
const fs = require('fs');
const path = require('path');
const createModule = require(path.join(__dirname, '../frontend/node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.js'));

let pass = true;
const ok = (cond, label) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`); if (!cond) pass = false; };

async function makeQpdf(stderrSink) {
  return createModule({
    locateFile: () => path.join(__dirname, '../frontend/node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm'),
    print: () => {},
    printErr: (s) => stderrSink.push(s),
    noInitialRun: true,
  });
}

(async () => {
  const input = new Uint8Array(fs.readFileSync(path.join(__dirname, 'jobber.pdf')));
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const tryOpen = async (bytes, password) => {
    try {
      const t = pdfjs.getDocument({ data: new Uint8Array(bytes), password });
      const doc = await t.promise;
      const n = doc.numPages;
      await t.destroy();
      return { ok: true, pages: n };
    } catch (e) {
      return { ok: false, name: e && e.name, msg: String(e && e.message).slice(0, 60) };
    }
  };

  // ---- encrypt (AES-256) ----
  let err = [];
  let q = await makeQpdf(err);
  q.FS.writeFile('/in.pdf', input);
  let code = q.callMain(['--encrypt', 'secret123', 'secret123', '256', '--', '/in.pdf', '/out.pdf']);
  ok(code === 0, `encrypt exit code ${code} ${err.join(' ').slice(0, 80)}`);
  const encrypted = q.FS.readFile('/out.pdf');
  ok(encrypted.length > 1000, `encrypted output ${encrypted.length} B`);
  const noPw = await tryOpen(encrypted);
  ok(!noPw.ok && /password/i.test(noPw.name + noPw.msg), `no password -> rejected (${noPw.name})`);
  const wrongPw = await tryOpen(encrypted, 'nope');
  ok(!wrongPw.ok, `wrong password -> rejected (${wrongPw.name})`);
  const rightPw = await tryOpen(encrypted, 'secret123');
  ok(rightPw.ok && rightPw.pages === 5, `correct password -> opens, ${rightPw.pages} pages`);

  // ---- encrypt with restrictions (no print, no copy) ----
  err = [];
  q = await makeQpdf(err);
  q.FS.writeFile('/in.pdf', input);
  code = q.callMain(['--encrypt', 'u1', 'u1', '256', '--print=none', '--extract=n', '--', '/in.pdf', '/out2.pdf']);
  ok(code === 0, `encrypt+permissions exit ${code} ${err.join(' ').slice(0, 80)}`);

  // ---- decrypt round-trip ----
  err = [];
  q = await makeQpdf(err);
  q.FS.writeFile('/enc.pdf', encrypted);
  code = q.callMain(['--password=secret123', '--decrypt', '/enc.pdf', '/dec.pdf']);
  ok(code === 0, `decrypt exit ${code}`);
  const dec = q.FS.readFile('/dec.pdf');
  const open = await tryOpen(dec);
  ok(open.ok && open.pages === 5, `decrypted opens WITHOUT password, ${open.pages} pages`);

  // ---- wrong password unlock -> readable failure ----
  err = [];
  q = await makeQpdf(err);
  q.FS.writeFile('/enc.pdf', encrypted);
  let threw = false;
  try {
    code = q.callMain(['--password=wrong', '--decrypt', '/enc.pdf', '/bad.pdf']);
  } catch { threw = true; code = -1; }
  ok(code !== 0 || threw, `wrong password fails (code ${code}, threw=${threw})`);
  // NOTE: this emscripten build routes qpdf's stderr to console directly (the
  // printErr option isn't honored for it) — so the UI maps EXIT CODES instead:
  // unlock with code!==0 => "that password didn't unlock this PDF".

  console.log(pass ? 'PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
