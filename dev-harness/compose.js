// Composition analyzer: where do a PDF's bytes live? (images / fonts / content
// streams / metadata / other) — to target compression work at the real weight.
// Usage: node compose.js file.pdf
const fs = require('fs');
const { PDFDocument, PDFName, PDFRawStream, PDFDict, PDFArray } = require('pdf-lib');

(async () => {
  const bytes = new Uint8Array(fs.readFileSync(process.argv[2] || 'jobber.pdf'));
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const ctx = doc.context;
  const buckets = {};
  const add = (k, n) => { buckets[k] = (buckets[k] || 0) + n; };
  let total = 0;
  const rows = [];
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const d = obj.dict;
    const len = obj.contents.length;
    total += len;
    const subtype = String(d.get(PDFName.of('Subtype')) || '');
    const type = String(d.get(PDFName.of('Type')) || '');
    let k = 'other-stream';
    if (subtype === '/Image') k = `image ${d.get(PDFName.of('Filter'))}`;
    else if (type === '/XObject' || subtype === '/Form') k = 'form-xobject';
    else if (type === '/Metadata' || subtype === '/XML') k = 'xmp-metadata';
    else if (type === '/ObjStm') k = 'object-stream';
    else if (type === '/XRef') k = 'xref-stream';
    else if (d.has(PDFName.of('FontFile')) || d.has(PDFName.of('FontFile2')) || d.has(PDFName.of('FontFile3'))) k = 'fontfile?';
    else if (String(d.get(PDFName.of('Subtype1')) || '') || d.has(PDFName.of('Length1'))) k = 'fontfile(Length1)';
    else k = 'other-stream';
    add(k, len);
    rows.push({ ref: String(ref), k, len, dict: String(d).slice(0, 160) });
  }
  // content streams: reachable via page /Contents
  let content = 0;
  for (const page of doc.getPages()) {
    const c = page.node.Contents();
    const streams = c instanceof PDFArray ? c.asArray().map((r) => ctx.lookup(r)) : [ctx.lookup(c) ?? c];
    for (const s of streams) if (s instanceof PDFRawStream) content += s.contents.length;
  }
  console.log(`file: ${bytes.length} bytes, streams total: ${total}, page content streams: ${content}`);
  console.log(Object.entries(buckets).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k}: ${v}`).join('\n'));
  console.log('\ntop 15 streams:');
  rows.sort((a, b) => b.len - a.len).slice(0, 15).forEach((r) => console.log(`  ${r.len}\t${r.k}\t${r.ref}\t${r.dict.replace(/\n/g, ' ')}`));
  // info dict
  console.log('\ntrailer Info:', String(doc.getTitle()), '|', doc.getProducer(), '|', doc.getCreator(), '|', doc.getAuthor());
})();
