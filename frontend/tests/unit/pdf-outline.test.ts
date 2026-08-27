import { describe, it, expect } from 'vitest';
import {
  makeNode, flatten, countNodes, treeFromHeadings,
  updateNode, removeNode, moveNode, indentNode, outdentNode,
  type OutlineNode,
} from '@/lib/pdf-outline';

// The write path is proven against a real PDF in dev-harness/outline-check.mjs
// (17 assertions, including that Prev/Next/Parent agree — the thing that makes
// an outline render in one reader and break another).
//
// What this file covers is the half a user actually touches: the tree edits
// behind the buttons. They are pure, so they are worth testing properly rather
// than by clicking, and every one of them is a way to silently lose somebody's
// work.

const tree = (): OutlineNode[] => [
  makeNode('One', 0, [makeNode('One.a', 1), makeNode('One.b', 2)]),
  makeNode('Two', 3),
];
const titles = (t: OutlineNode[]) => flatten(t).map(({ node, depth }) => `${'  '.repeat(depth)}${node.title}`);

describe('outline tree edits', () => {
  it('flattens depth-first with the right depths', () => {
    expect(titles(tree())).toEqual(['One', '  One.a', '  One.b', 'Two']);
  });

  it('counts every node, not just the top level', () => {
    expect(countNodes(tree())).toBe(4);
  });

  it('never mutates the tree it was given — that is what makes undo work', () => {
    const before = tree();
    const snapshot = JSON.stringify(before);
    updateNode(before, before[0].id, { title: 'Changed' });
    removeNode(before, before[0].id);
    moveNode(before, before[1].id, -1);
    indentNode(before, before[1].id);
    outdentNode(before, before[0].children[0].id);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('renames and renumbers a nested node', () => {
    const t = tree();
    const id = t[0].children[1].id;
    const next = updateNode(t, id, { title: 'Renamed', page: 9 });
    expect(next[0].children[1].title).toBe('Renamed');
    expect(next[0].children[1].page).toBe(9);
  });

  it('promotes children instead of deleting the branch with the parent', () => {
    const t = tree();
    const next = removeNode(t, t[0].id);
    // One is gone; its two children survive, in its place, at the top level.
    expect(titles(next)).toEqual(['One.a', 'One.b', 'Two']);
    expect(countNodes(next)).toBe(3);
  });

  it('moves a node among its siblings and refuses to run off either end', () => {
    const t = tree();
    expect(titles(moveNode(t, t[1].id, -1))).toEqual(['Two', 'One', '  One.a', '  One.b']);
    expect(titles(moveNode(t, t[0].id, -1))).toEqual(titles(t)); // already first
    expect(titles(moveNode(t, t[1].id, 1))).toEqual(titles(t));  // already last
  });

  it('indents a node under the sibling above it', () => {
    const t = tree();
    expect(titles(indentNode(t, t[1].id))).toEqual(['One', '  One.a', '  One.b', '  Two']);
  });

  it('will not indent the first node — there is nothing above it to nest under', () => {
    const t = tree();
    expect(titles(indentNode(t, t[0].id))).toEqual(titles(t));
  });

  it('outdents a child to sit just after its former parent', () => {
    const t = tree();
    expect(titles(outdentNode(t, t[0].children[0].id))).toEqual(['One', '  One.b', 'One.a', 'Two']);
  });

  it('leaves a top-level node alone when asked to outdent it', () => {
    const t = tree();
    expect(titles(outdentNode(t, t[1].id))).toEqual(titles(t));
  });

  it('indent then outdent returns the node where it started', () => {
    const t = tree();
    const id = t[1].id;
    expect(titles(outdentNode(indentNode(t, id), id))).toEqual(titles(t));
  });
});

describe('building an outline from a document’s headings', () => {
  it('nests by heading level', () => {
    const built = treeFromHeadings([
      { title: 'Chapter 1', page: 0, level: 1 },
      { title: 'Section 1.1', page: 1, level: 2 },
      { title: 'Detail', page: 1, level: 3 },
      { title: 'Section 1.2', page: 2, level: 2 },
      { title: 'Chapter 2', page: 3, level: 1 },
    ]);
    expect(titles(built)).toEqual([
      'Chapter 1', '  Section 1.1', '    Detail', '  Section 1.2', 'Chapter 2',
    ]);
    expect(countNodes(built)).toBe(5);
  });

  it('copes with a document that opens at a deep level', () => {
    const built = treeFromHeadings([
      { title: 'Starts deep', page: 0, level: 3 },
      { title: 'Then shallow', page: 1, level: 1 },
    ]);
    expect(titles(built)).toEqual(['Starts deep', 'Then shallow']);
  });

  it('keeps the page each heading was found on', () => {
    const built = treeFromHeadings([
      { title: 'A', page: 4, level: 1 },
      { title: 'B', page: 7, level: 2 },
    ]);
    expect(built[0].page).toBe(4);
    expect(built[0].children[0].page).toBe(7);
  });

  it('returns nothing for a document with no headings', () => {
    expect(treeFromHeadings([])).toEqual([]);
  });
});
