/**
 * Reading and writing a PDF's bookmark outline — the collapsible table of
 * contents down the side of a reader.
 *
 * Two engines, because neither does both halves. pdf.js reads an outline
 * (`getOutline`) and can resolve a destination to a page number, which is
 * fiddly enough that reimplementing it would be silly. pdf-lib writes, but has
 * no outline API at all, so the object tree is built here by hand: an
 * /Outlines root, one dictionary per item, each carrying Parent/Prev/Next and
 * a /Dest pointing at a page.
 *
 * The linked-list shape is the part worth being careful about. Every item
 * points at its parent, its previous and next siblings, and its first and last
 * child, so the refs have to exist before the dictionaries that mention them —
 * hence the two passes below.
 */

export type OutlineNode = {
  /** Stable id for React keys and drag targets; not written to the file. */
  id: string;
  title: string;
  /** 0-based page index this bookmark jumps to. */
  page: number;
  children: OutlineNode[];
};

let idSeq = 0;
export const newNodeId = () => `n${++idSeq}`;

export function makeNode(title: string, page: number, children: OutlineNode[] = []): OutlineNode {
  return { id: newNodeId(), title, page, children };
}

/** Depth-first count of every node in a tree. */
export function countNodes(nodes: OutlineNode[]): number {
  return nodes.reduce((n, x) => n + 1 + countNodes(x.children), 0);
}

// ---------------------------------------------------------------- reading ---

type PdfjsOutlineItem = {
  title: string;
  dest: unknown;
  items?: PdfjsOutlineItem[];
};

/**
 * The existing outline, or an empty array when the file has none.
 *
 * `doc` is the pdf.js PDFDocumentProxy from openPdf(). Destinations come in
 * three flavours — a named destination (a string), an explicit array, or null
 * for a bookmark that points nowhere — and all three have to be handled,
 * because real files contain all three.
 */
export async function readOutline(doc: {
  getOutline: () => Promise<PdfjsOutlineItem[] | null>;
  getDestination: (name: string) => Promise<unknown[] | null>;
  getPageIndex: (ref: unknown) => Promise<number>;
}): Promise<OutlineNode[]> {
  const raw = await doc.getOutline().catch(() => null);
  if (!raw || !raw.length) return [];

  const pageOf = async (dest: unknown): Promise<number> => {
    try {
      const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
      if (!Array.isArray(explicit) || !explicit.length) return 0;
      const ref = explicit[0];
      // A page can be given as a ref (the normal case) or as a bare index.
      if (typeof ref === 'number') return ref;
      const idx = await doc.getPageIndex(ref);
      return Number.isFinite(idx) && idx >= 0 ? idx : 0;
    } catch {
      return 0; // a bookmark pointing nowhere still deserves to survive editing
    }
  };

  const walk = async (items: PdfjsOutlineItem[]): Promise<OutlineNode[]> => {
    const out: OutlineNode[] = [];
    for (const it of items) {
      out.push({
        id: newNodeId(),
        title: (it.title || '').trim() || 'Untitled',
        page: await pageOf(it.dest),
        children: it.items?.length ? await walk(it.items) : [],
      });
    }
    return out;
  };

  return walk(raw);
}

// ---------------------------------------------------------------- writing ---

/**
 * Replace the document's outline with `tree` and return the new bytes.
 * An empty tree removes the outline entirely, which is a legitimate thing to
 * want — a file can arrive with somebody else's bookmarks in it.
 */
export async function writeOutline(bytes: ArrayBuffer | Uint8Array, tree: OutlineNode[]): Promise<Uint8Array> {
  const { PDFDocument, PDFName, PDFNumber, PDFHexString, PDFArray, PDFNull } = await import('pdf-lib');

  const doc = await PDFDocument.load(bytes as never, { ignoreEncryption: true, updateMetadata: false });
  const ctx = doc.context;
  const pages = doc.getPages();
  const catalog = doc.catalog;

  if (!tree.length) {
    catalog.delete(PDFName.of('Outlines'));
    // /PageMode UseOutlines with no outline tells the reader to open a side
    // panel that would then be empty.
    if (String(catalog.get(PDFName.of('PageMode')) ?? '') === '/UseOutlines') {
      catalog.delete(PDFName.of('PageMode'));
    }
    return doc.save({ useObjectStreams: true });
  }

  const rootRef = ctx.nextRef();

  // Pass one: a ref for every node, so siblings and children can be wired up
  // before any dictionary is written.
  type Prepared = { node: OutlineNode; ref: ReturnType<typeof ctx.nextRef>; kids: Prepared[] };
  const prepare = (nodes: OutlineNode[]): Prepared[] =>
    nodes.map((node) => ({ node, ref: ctx.nextRef(), kids: prepare(node.children) }));
  const prepared = prepare(tree);

  const destFor = (pageIndex: number) => {
    const page = pages[Math.max(0, Math.min(pages.length - 1, pageIndex))];
    const arr = PDFArray.withContext(ctx);
    arr.push(page.ref);
    // XYZ with nulls = "go to this page, keep the reader's current zoom", which
    // is what every other tool produces and what people expect. /Fit would
    // rescale the view on every click.
    arr.push(PDFName.of('XYZ'));
    arr.push(PDFNull);
    arr.push(PDFNull);
    arr.push(PDFNull);
    return arr;
  };

  // Visible descendants, used for /Count. Positive because we write every item
  // expanded; a negative Count is how a PDF says "this branch starts collapsed".
  const visibleCount = (items: Prepared[]): number =>
    items.reduce((n, p) => n + 1 + visibleCount(p.kids), 0);

  // Pass two: the dictionaries.
  const emit = (items: Prepared[], parentRef: ReturnType<typeof ctx.nextRef>) => {
    items.forEach((p, i) => {
      // ctx.obj({}) is already a PDFDict — it has .set, no cast needed.
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
  // Ask the reader to actually show the panel. Without this a reader that
  // defaults to "no panel" hides the bookmarks somebody just spent time making,
  // and they conclude the tool did nothing.
  catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));

  return doc.save({ useObjectStreams: true });
}

// ------------------------------------------------------------- tree edits ---
// All pure: they take a tree and return a new one, so the component can keep an
// undo stack by holding on to the previous value.

const clone = (nodes: OutlineNode[]): OutlineNode[] =>
  nodes.map((n) => ({ ...n, children: clone(n.children) }));

/** Find a node's parent list and index within it. */
function locate(nodes: OutlineNode[], id: string): { list: OutlineNode[]; index: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) return { list: nodes, index: i };
    const inner = locate(nodes[i].children, id);
    if (inner) return inner;
  }
  return null;
}

export function updateNode(tree: OutlineNode[], id: string, patch: Partial<Pick<OutlineNode, 'title' | 'page'>>): OutlineNode[] {
  const next = clone(tree);
  const at = locate(next, id);
  if (at) Object.assign(at.list[at.index], patch);
  return next;
}

export function removeNode(tree: OutlineNode[], id: string): OutlineNode[] {
  const next = clone(tree);
  const at = locate(next, id);
  if (!at) return next;
  // Children are promoted rather than deleted with the parent — losing a whole
  // branch to one wrong click is the kind of thing people do not forgive.
  const [gone] = at.list.splice(at.index, 1);
  at.list.splice(at.index, 0, ...gone.children);
  return next;
}

export function moveNode(tree: OutlineNode[], id: string, dir: -1 | 1): OutlineNode[] {
  const next = clone(tree);
  const at = locate(next, id);
  if (!at) return next;
  const j = at.index + dir;
  if (j < 0 || j >= at.list.length) return next;
  const [n] = at.list.splice(at.index, 1);
  at.list.splice(j, 0, n);
  return next;
}

/** Make this node a child of the sibling above it. */
export function indentNode(tree: OutlineNode[], id: string): OutlineNode[] {
  const next = clone(tree);
  const at = locate(next, id);
  if (!at || at.index === 0) return next;
  const [n] = at.list.splice(at.index, 1);
  at.list[at.index - 1].children.push(n);
  return next;
}

/** Move this node up a level, to sit after its former parent. */
export function outdentNode(tree: OutlineNode[], id: string): OutlineNode[] {
  const next = clone(tree);
  const parentOf = (nodes: OutlineNode[], target: string, parent: OutlineNode | null): OutlineNode | null => {
    for (const n of nodes) {
      if (n.id === target) return parent;
      const found = parentOf(n.children, target, n);
      if (found !== null) return found;
    }
    return null;
  };
  const parent = parentOf(next, id, null);
  if (!parent) return next; // already top level
  const grand = locate(next, parent.id);
  if (!grand) return next;
  const i = parent.children.findIndex((c) => c.id === id);
  const [n] = parent.children.splice(i, 1);
  grand.list.splice(grand.index + 1, 0, n);
  return next;
}

/** Flatten for display: each node with its depth, in reading order. */
export function flatten(tree: OutlineNode[], depth = 0): Array<{ node: OutlineNode; depth: number }> {
  return tree.flatMap((n) => [{ node: n, depth }, ...flatten(n.children, depth + 1)]);
}

/** Build a tree from a flat heading list, nesting by heading level. */
export function treeFromHeadings(items: Array<{ title: string; page: number; level: 1 | 2 | 3 }>): OutlineNode[] {
  const root: OutlineNode[] = [];
  const stack: Array<{ level: number; node: OutlineNode }> = [];
  for (const h of items) {
    const node = makeNode(h.title, h.page);
    while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
    if (stack.length) stack[stack.length - 1].node.children.push(node);
    else root.push(node);
    stack.push({ level: h.level, node });
  }
  return root;
}
