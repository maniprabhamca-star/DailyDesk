/**
 * Proves the outline writer against a real PDF, without a browser.
 *
 * Outlines are a linked list of dictionaries, so the failure mode is not "no
 * bookmarks" — it is bookmarks that render in one reader and crash another
 * because Prev/Next/Parent disagree. These assertions walk the structure the
 * way a reader does.
 */
import fs from 'fs';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFNumber, PDFHexString, PDFNull } from 'pdf-lib';

const SRC = process.argv[2] || 'dev-harness/ftp.pdf';

// --- the writer, transliterated from lib/pdf-outline.ts ----------------------
async function writeOutline(bytes, tree) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const ctx = doc.context;
  const pages = doc.getPages();
  const catalog = doc.catalog;

  if (!tree.length) {
    catalog.delete(PDFName.of('Outlines'));
    if (String(catalog.get(PDFName.of('PageMode')) ?? '') === '/UseOutlines') catalog.delete(PDFName.of('PageMode'));
    return doc.save({ useObjectStreams: true });
  }

  const rootRef = ctx.nextRef();
  const prepare = (nodes) => nodes.map((node) => ({ node, ref: ctx.nextRef(), kids: prepare(node.children || []) }));
  const prepared = prepare(tree);

  const destFor = (pageIndex) => {
    const page = pages[Math.max(0, Math.min(pages.length - 1, pageIndex))];
    const arr = PDFArray.withContext(ctx);
    arr.push(page.ref);
    arr.push(PDFName.of('XYZ'));
    arr.push(PDFNull); arr.push(PDFNull); arr.push(PDFNull);
    return arr;
  };
  const visibleCount = (items) => items.reduce((n, p) => n + 1 + visibleCount(p.kids), 0);

  const emit = (items, parentRef) => {
    items.forEach((p, i) => {
      const dict = ctx.obj({});
      dict.set(PDFName.of('Title'), PDFHexString.fromText(p.node.title || 'Untitled'));
      dict.set(PDFName.of('Parent'), parentRef);
      dict.set(PDFName.of('Dest'), destFor(p.node.page));
      if (i > 0) dict.set(PDFName.of('Prev'), items[i - 1].ref);
      if (i < items.length - 1) dict.set(PDFName.of('Next'), items[i + 1].ref);
      if (p.kids.length) {
        dict.set(PDFName.of('First'), p.kids[0].ref);
        dict.set(PDFName.of('Last'), p.kids[p.kids.length - 1].ref);
        dict.set(PDFName.of('Count'), PDFNumber.of(visibleCount(p.kids)));
      }
      ctx.assign(p.ref, dict);
      if (p.kids.length) emit(p.kids, p.ref);
    });
  };
  emit(prepared, rootRef);

  const root = ctx.obj({});
  root.set(PDFName.of('Type'), PDFName.of('Outlines'));
  root.set(PDFName.of('First'), prepared[0].ref);
  root.set(PDFName.of('Last'), prepared[prepared.length - 1].ref);
  root.set(PDFName.of('Count'), PDFNumber.of(visibleCount(prepared)));
  ctx.assign(rootRef, root);
  catalog.set(PDFName.of('Outlines'), rootRef);
  catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
  return doc.save({ useObjectStreams: true });
}

// --- walk the produced outline the way a reader would ------------------------
async function readBack(bytes) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const ctx = doc.context;
  const outlinesRef = doc.catalog.get(PDFName.of('Outlines'));
  if (!outlinesRef) return null;
  const root = ctx.lookup(outlinesRef);
  const pageIndexOf = (ref) => doc.getPages().findIndex((p) => p.ref === ref);

  const walkSiblings = (firstRef, parentRef) => {
    const out = [];
    let ref = firstRef;
    let guard = 0;
    while (ref && guard++ < 5000) {
      const d = ctx.lookup(ref);
      if (!(d instanceof PDFDict)) break;
      const title = d.get(PDFName.of('Title'));
      const dest = ctx.lookup(d.get(PDFName.of('Dest')));
      const parentOk = d.get(PDFName.of('Parent')) === parentRef;
      const firstChild = d.get(PDFName.of('First'));
      out.push({
        title: title?.decodeText ? title.decodeText() : String(title),
        page: dest instanceof PDFArray ? pageIndexOf(dest.get(0)) : -1,
        destKind: dest instanceof PDFArray ? String(dest.get(1)) : null,
        parentOk,
        prev: d.get(PDFName.of('Prev')) || null,
        ref,
        children: firstChild ? walkSiblings(firstChild, ref) : [],
      });
      ref = d.get(PDFName.of('Next'));
    }
    return out;
  };

  return {
    count: ctx.lookup(root.get(PDFName.of('Count'))),
    pageMode: String(doc.catalog.get(PDFName.of('PageMode')) ?? ''),
    items: walkSiblings(root.get(PDFName.of('First')), outlinesRef),
    lastRef: root.get(PDFName.of('Last')),
  };
}

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  — ${d}` : ''}`); };

const src = fs.readFileSync(SRC);
const pageCount = (await PDFDocument.load(src)).getPageCount();

// A nested tree with unicode and an out-of-range page, on purpose.
const TREE = [
  { title: 'Cover', page: 0, children: [] },
  {
    title: 'Setup — étape 1 & "notes"', page: 1, children: [
      { title: 'Credentials', page: 1, children: [] },
      { title: 'Deep child', page: 0, children: [{ title: 'Third level', page: 1, children: [] }] },
    ],
  },
  { title: 'Past the end', page: 999, children: [] },
];

{
  const out = await writeOutline(src, TREE);

  const back = await readBack(out);

  check('outline exists', !!back);
  check('valid PDF', Buffer.from(out.slice(0, 5)).toString() === '%PDF-');
  check('root Count = every visible item (6)', Number(back.count?.asNumber?.() ?? back.count) === 6, String(back.count?.asNumber?.() ?? back.count));
  check('reader is told to open the panel', back.pageMode === '/UseOutlines', back.pageMode);
  check('three top-level items', back.items.length === 3, String(back.items.length));
  check('titles survive unicode and quotes', back.items[1].title === 'Setup — étape 1 & "notes"', back.items[1].title);
  check('first item has no Prev', back.items[0].prev === null);
  check('every item points at the right Parent', back.items.every((i) => i.parentOk && i.children.every((c) => c.parentOk)));
  check('root Last really is the last sibling', back.lastRef === back.items[2].ref);
  check('nesting preserved (2 children, then 1 grandchild)',
    back.items[1].children.length === 2 && back.items[1].children[1].children.length === 1);
  check('destinations resolve to real pages', back.items[0].page === 0 && back.items[1].page === 1);
  check('destination keeps the reader zoom (XYZ)', back.items[0].destKind === '/XYZ', String(back.items[0].destKind));
  check('a page past the end is clamped, not broken',
    back.items[2].page === pageCount - 1, `page ${back.items[2].page} of ${pageCount}`);
  check('pages are untouched', (await PDFDocument.load(out)).getPageCount() === pageCount);
}

// Replacing an existing outline must not leave the old one behind.
{
  const once = await writeOutline(src, TREE);
  const twice = await writeOutline(once, [{ title: 'Only me', page: 0, children: [] }]);
  const back = await readBack(twice);
  check('rewriting replaces rather than appends', back.items.length === 1 && back.items[0].title === 'Only me',
    back.items.map((i) => i.title).join(', '));
}

// An empty tree removes the outline entirely.
{
  const once = await writeOutline(src, TREE);
  const cleared = await writeOutline(once, []);
  const back = await readBack(cleared);
  check('empty tree removes the outline', back === null);
  const doc = await PDFDocument.load(cleared);
  check('and stops asking the reader to open an empty panel',
    String(doc.catalog.get(PDFName.of('PageMode')) ?? '') !== '/UseOutlines');
}


console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
