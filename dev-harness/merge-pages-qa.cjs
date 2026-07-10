// QA gate for the visual page-level merge op ({type:'merge-pages'}) in
// frontend/lib/pdf-rewrite-core.ts. Builds two PDFs with distinct page sizes,
// runs a cross-file plan, and asserts the output pages come out in the exact
// order + count requested (lossless page copy).
//   Run:  node dev-harness/merge-pages-qa.cjs
const path = require('path');
const FE = path.join(__dirname, '..', 'frontend');
require(path.join(FE, 'node_modules', 'sucrase', 'register'));
const { PDFDocument } = require(path.join(FE, 'node_modules', 'pdf-lib'));
const { executeRewrite } = require(path.join(FE, 'lib', 'pdf-rewrite-core.ts'));

(async () => {
  const A = await PDFDocument.create(); for (let i = 0; i < 3; i++) A.addPage([612, 792]); // Letter
  const B = await PDFDocument.create(); for (let i = 0; i < 2; i++) B.addPage([595, 842]); // A4
  const bufA = (await A.save()).buffer, bufB = (await B.save()).buffer;

  const plan = [{ src: 1, page: 1 }, { src: 0, page: 2 }, { src: 0, page: 0 }, { src: 1, page: 0 }];
  const [out] = await executeRewrite([bufA, bufB], { type: 'merge-pages', plan });
  const res = await PDFDocument.load(out);
  const got = res.getPages().map((p) => `${Math.round(p.getWidth())}x${Math.round(p.getHeight())}`);
  const want = ['595x842', '612x792', '612x792', '595x842'];
  const ok = got.length === want.length && got.every((g, i) => g === want[i]);
  console.log('got     :', got.join('  '));
  console.log('expected:', want.join('  '));
  console.log(ok ? 'PASS — merge-pages order + count correct' : 'FAIL — mismatch');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
