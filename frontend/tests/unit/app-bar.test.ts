import { describe, expect, it, beforeEach } from 'vitest';
import { routeForFile, ROUTE_BY_EXT } from '@/lib/route-for-file';
import { getPinned, pin, unpin, togglePin, isPinned, MAX_PINS } from '@/lib/pinned-tools';
import { stashFile, takeFile, hasPendingFile } from '@/lib/pending-file';
import { catalog } from '@/components/app/catalog';

const TOOL_HREFS = new Set(catalog.flatMap((g) => g.tools).map((t) => t.href).filter(Boolean) as string[]);

describe('routing a picked file', () => {
  it('sends every mapped extension to a real tool', () => {
    for (const [ext, href] of Object.entries(ROUTE_BY_EXT)) {
      expect(TOOL_HREFS.has(href), `.${ext} → ${href}, which is not a catalogue tool`).toBe(true);
    }
  });

  it('routes the types people actually pick on a phone', () => {
    expect(routeForFile('scan.pdf')).toBe('/pdf-viewer');
    expect(routeForFile('IMG_4021.HEIC')).toBe('/heic-to-jpg');
    expect(routeForFile('photo.jpg')).toBe('/jpg-to-pdf');
    expect(routeForFile('report.docx')).toBe('/word-to-pdf');
    expect(routeForFile('accounts.xlsx')).toBe('/excel-to-pdf');
    expect(routeForFile('deck.pptx')).toBe('/powerpoint-to-pdf');
  });

  it('is case-insensitive, because phones shout their extensions', () => {
    expect(routeForFile('A.PDF')).toBe(routeForFile('a.pdf'));
    expect(routeForFile('B.HeIc')).toBe('/heic-to-jpg');
  });

  it('falls back to the catalogue rather than guessing', () => {
    expect(routeForFile('mystery.xyz')).toBe('/tools');
    expect(routeForFile('noextension')).toBe('/tools');
    expect(routeForFile('')).toBe('/tools');
  });

  it('sends HEIC somewhere different from other images', () => {
    // The reason someone is stuck with a HEIC is that nothing opens it — that is
    // a different problem from "turn my photos into a PDF".
    expect(routeForFile('a.heic')).not.toBe(routeForFile('a.jpg'));
  });
});

describe('pinned tools', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty', () => {
    expect(getPinned()).toEqual([]);
  });

  it('pins, reports and unpins', () => {
    pin('/merge-pdf');
    expect(getPinned()).toEqual(['/merge-pdf']);
    expect(isPinned('/merge-pdf')).toBe(true);
    unpin('/merge-pdf');
    expect(getPinned()).toEqual([]);
    expect(isPinned('/merge-pdf')).toBe(false);
  });

  it('toggles both ways and says which it did', () => {
    expect(togglePin('/sign-pdf')).toBe(true);
    expect(isPinned('/sign-pdf')).toBe(true);
    expect(togglePin('/sign-pdf')).toBe(false);
    expect(isPinned('/sign-pdf')).toBe(false);
  });

  it('never stores the same tool twice, and re-pinning moves it to the front', () => {
    pin('/a-one'); pin('/b-two'); pin('/a-one');
    expect(getPinned()).toEqual(['/a-one', '/b-two']);
  });

  it('stops at the cap instead of growing without limit', () => {
    for (let i = 0; i < MAX_PINS + 5; i++) pin(`/tool-${i}`);
    expect(getPinned().length).toBe(MAX_PINS);
    // The most recent survive — pinning something is a statement about now.
    expect(getPinned()[0]).toBe(`/tool-${MAX_PINS + 4}`);
  });

  it('survives corrupt storage rather than throwing', () => {
    localStorage.setItem('dd-pinned-tools-v1', 'not json at all');
    expect(getPinned()).toEqual([]);
    localStorage.setItem('dd-pinned-tools-v1', '{"not":"an array"}');
    expect(getPinned()).toEqual([]);
    localStorage.setItem('dd-pinned-tools-v1', '[1,2,null,"/ok"]');
    expect(getPinned()).toEqual(['/ok']);
  });
});

describe('carrying a file across a navigation', () => {
  const fake = (name: string) => new File(['x'], name, { type: 'application/pdf' });

  it('hands the file over exactly once', () => {
    stashFile(fake('a.pdf'));
    expect(hasPendingFile()).toBe(true);
    expect(takeFile()?.name).toBe('a.pdf');
    // A second consumer must not get it — otherwise a later route would load
    // the same document again out of nowhere.
    expect(takeFile()).toBeNull();
    expect(hasPendingFile()).toBe(false);
  });

  it('returns null when nothing was stashed', () => {
    expect(takeFile()).toBeNull();
  });

  it('replaces an earlier file rather than queueing', () => {
    stashFile(fake('first.pdf'));
    stashFile(fake('second.pdf'));
    expect(takeFile()?.name).toBe('second.pdf');
  });
});
