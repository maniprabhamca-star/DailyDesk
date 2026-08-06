// Readers for the spreadsheet pack: .xlsx, CSV, JSON and XML in — rows out.
// Writing is already handled by lib/xlsx.ts (buildXlsx / toCsv), so everything
// here is about getting foreign data into the same simple shape:
//
//     type Sheet = { name: string; rows: Cell[][] }
//
// All of it runs in the browser. The .xlsx reader is ours — a spreadsheet is a
// zip of XML, and jszip plus DOMParser is all it takes, so no multi-megabyte
// library gets shipped to read one file.

import type { Cell } from './xlsx';
import { coerce } from './xlsx';

export type Sheet = { name: string; rows: Cell[][] };

const clean = (s: string) => s.replace(/\r/g, '');

/* ─────────────────────────── CSV ─────────────────────────── */

/** Guess the separator from the first few lines. Semicolons are the norm in
 *  European exports and tabs come from copy-paste out of Excel, so assuming a
 *  comma turns those files into one useless column. */
export function sniffDelimiter(text: string): string {
  const sample = clean(text).split('\n').slice(0, 20).join('\n');
  const counts = [',', ';', '\t', '|'].map((d) => {
    // Count only separators outside quotes.
    let n = 0, q = false;
    for (let i = 0; i < sample.length; i++) {
      const c = sample[i];
      if (c === '"') q = !q;
      else if (!q && c === d) n++;
    }
    return { d, n };
  });
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ',';
}

/** RFC 4180 with the real-world bits: a BOM, quoted separators and quoted
 *  newlines, doubled quotes, and CRLF. */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const d = delimiter || sniffDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === d) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.length && !(r.length === 1 && r[0].trim() === ''));
}

export function csvToSheets(text: string, name = 'Sheet 1'): Sheet[] {
  const rows = parseCsv(text).map((r) => r.map((c) => coerce(c.trim())));
  return rows.length ? [{ name, rows }] : [];
}

/* ─────────────────────────── XLSX ─────────────────────────── */

/** "BC" → 54. Column letters are base-26 with no zero. */
export function colIndex(ref: string): number {
  const letters = ref.replace(/\d+$/, '');
  let n = 0;
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n - 1;
}

/** Excel keeps dates as a day count from 1899-12-30 (the offset absorbs the
 *  1900-leap-year bug it inherited from Lotus). Without this a date column
 *  arrives as five-digit numbers, which is the classic broken export. */
export function excelSerialToDate(serial: number): string {
  // Excel counts a 29th of February 1900 that never happened (a Lotus 1-2-3
  // bug it kept for compatibility), so serials below 60 are a day out from the
  // straight arithmetic. Real data sits well above that, but getting it right
  // costs one line.
  const adjusted = serial < 60 ? serial + 1 : serial;
  const ms = Math.round((adjusted - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return String(serial);
  const iso = d.toISOString();
  const hasTime = Math.abs(serial % 1) > 1e-6;
  return hasTime ? iso.slice(0, 19).replace('T', ' ') : iso.slice(0, 10);
}

const BUILTIN_DATE_FMTS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
const looksLikeDateFormat = (code: string) => /(^|[^\\])[dmyhs]/i.test(code.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, ''));

const textOf = (el: Element | null) => (el ? el.textContent || '' : '');

/** One .xlsx → every sheet in it, in workbook order. */
export async function readXlsx(file: File | Blob): Promise<Sheet[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const parser = new DOMParser();
  const xml = async (path: string) => {
    const f = zip.file(path);
    if (!f) return null;
    return parser.parseFromString(await f.async('string'), 'application/xml');
  };

  // Shared strings: cells of type "s" hold an index into this table.
  const shared: string[] = [];
  const sst = await xml('xl/sharedStrings.xml');
  if (sst) {
    for (const si of Array.from(sst.getElementsByTagName('si'))) {
      // Rich text splits a value across several <t> runs.
      shared.push(Array.from(si.getElementsByTagName('t')).map((t) => t.textContent || '').join(''));
    }
  }

  // Which style indexes mean "this is a date".
  const dateStyles = new Set<number>();
  const styles = await xml('xl/styles.xml');
  if (styles) {
    const custom = new Map<number, string>();
    for (const nf of Array.from(styles.getElementsByTagName('numFmt'))) {
      custom.set(Number(nf.getAttribute('numFmtId')), nf.getAttribute('formatCode') || '');
    }
    const cellXfs = styles.getElementsByTagName('cellXfs')[0];
    if (cellXfs) {
      Array.from(cellXfs.getElementsByTagName('xf')).forEach((xf, i) => {
        const id = Number(xf.getAttribute('numFmtId') || 0);
        if (BUILTIN_DATE_FMTS.has(id) || looksLikeDateFormat(custom.get(id) || '')) dateStyles.add(i);
      });
    }
  }

  // Sheet name + file path, in the order the workbook lists them.
  const wb = await xml('xl/workbook.xml');
  const rels = await xml('xl/_rels/workbook.xml.rels');
  const relTarget = new Map<string, string>();
  if (rels) {
    for (const r of Array.from(rels.getElementsByTagName('Relationship'))) {
      relTarget.set(r.getAttribute('Id') || '', (r.getAttribute('Target') || '').replace(/^\/?xl\//, '').replace(/^\//, ''));
    }
  }
  const wanted: { name: string; path: string }[] = [];
  if (wb) {
    Array.from(wb.getElementsByTagName('sheet')).forEach((s, i) => {
      const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || '';
      const target = relTarget.get(rid) || `worksheets/sheet${i + 1}.xml`;
      wanted.push({ name: s.getAttribute('name') || `Sheet ${i + 1}`, path: `xl/${target}` });
    });
  }
  if (!wanted.length) {
    // A workbook we couldn't read the index of — fall back to whatever sheets exist.
    Object.keys(zip.files)
      .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p))
      .sort()
      .forEach((p, i) => wanted.push({ name: `Sheet ${i + 1}`, path: p }));
  }

  const out: Sheet[] = [];
  for (const { name, path } of wanted) {
    const doc = await xml(path);
    if (!doc) continue;
    const rows: Cell[][] = [];
    let width = 0;
    for (const rowEl of Array.from(doc.getElementsByTagName('row'))) {
      const cells: Cell[] = [];
      for (const c of Array.from(rowEl.getElementsByTagName('c'))) {
        const at = colIndex(c.getAttribute('r') || '');
        const type = c.getAttribute('t') || 'n';
        const styleIdx = Number(c.getAttribute('s') || -1);
        let value: Cell = '';
        if (type === 's') value = shared[Number(textOf(c.getElementsByTagName('v')[0]))] ?? '';
        else if (type === 'inlineStr') value = Array.from(c.getElementsByTagName('t')).map((t) => t.textContent || '').join('');
        else if (type === 'str') value = textOf(c.getElementsByTagName('v')[0]);
        else if (type === 'b') value = textOf(c.getElementsByTagName('v')[0]) === '1' ? 'TRUE' : 'FALSE';
        else if (type === 'e') value = textOf(c.getElementsByTagName('v')[0]);
        else {
          const raw = textOf(c.getElementsByTagName('v')[0]);
          if (raw === '') value = '';
          else if (dateStyles.has(styleIdx)) value = excelSerialToDate(Number(raw));
          else value = Number.isFinite(Number(raw)) ? Number(raw) : raw;
        }
        const idx = at >= 0 ? at : cells.length;
        while (cells.length < idx) cells.push('');
        cells[idx] = value;
      }
      width = Math.max(width, cells.length);
      rows.push(cells);
    }
    const padded = rows.map((r) => { const copy = [...r]; while (copy.length < width) copy.push(''); return copy; });
    const filled = padded.filter((r) => r.some((c) => String(c).trim() !== ''));
    if (filled.length) out.push({ name, rows: filled });
  }
  return out;
}

/* ─────────────────────────── JSON ─────────────────────────── */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Nested objects become dotted columns (address.city), because a spreadsheet
 *  has no second dimension to put them in. Arrays of scalars join with "; ";
 *  arrays of objects are left as JSON so nothing is silently lost. */
function flatten(value: unknown, prefix = '', out: Record<string, Cell> = {}): Record<string, Cell> {
  if (isObj(value)) {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (Array.isArray(value)) {
    const scalars = value.every((v) => v === null || typeof v !== 'object');
    out[prefix] = scalars ? value.map((v) => (v == null ? '' : String(v))).join('; ') : JSON.stringify(value);
  } else if (value == null) {
    out[prefix] = '';
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    out[prefix] = typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : value;
  } else {
    out[prefix] = String(value);
  }
  return out;
}

/** Find the list in a JSON document: the top level if it's an array, otherwise
 *  the longest array hanging off the root (`{ data: [...] }`, `{ results: [...] }`). */
function findRecords(parsed: unknown): { records: unknown[]; name: string } {
  if (Array.isArray(parsed)) return { records: parsed, name: 'Sheet 1' };
  if (isObj(parsed)) {
    let best: { key: string; arr: unknown[] } | null = null;
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v) && (!best || v.length > best.arr.length)) best = { key: k, arr: v };
    }
    if (best && best.arr.length) return { records: best.arr, name: best.key.slice(0, 31) };
    return { records: [parsed], name: 'Sheet 1' };
  }
  return { records: [], name: 'Sheet 1' };
}

export function jsonToSheets(text: string): Sheet[] {
  const parsed = JSON.parse(text) as unknown;
  const { records, name } = findRecords(parsed);
  if (!records.length) return [];

  const flatRows = records.map((r) => (isObj(r) || Array.isArray(r) ? flatten(r) : { value: String(r) as Cell }));
  // Column order = first appearance, so the spreadsheet reads like the JSON.
  const columns: string[] = [];
  for (const row of flatRows) for (const k of Object.keys(row)) if (!columns.includes(k)) columns.push(k);

  const rows: Cell[][] = [columns];
  for (const row of flatRows) rows.push(columns.map((c) => (c in row ? row[c] : '')));
  return [{ name, rows }];
}

/** Rows → an array of objects, using the first row as the keys. */
export function rowsToJson(rows: Cell[][], header = true): string {
  if (!rows.length) return '[]';
  const keys = header ? rows[0].map((c, i) => String(c).trim() || `column_${i + 1}`) : rows[0].map((_, i) => `column_${i + 1}`);
  const body = header ? rows.slice(1) : rows;
  const objs = body.map((r) => {
    const o: Record<string, Cell> = {};
    keys.forEach((k, i) => { o[k] = r[i] ?? ''; });
    return o;
  });
  return JSON.stringify(objs, null, 2);
}

/* ─────────────────────────── XML ─────────────────────────── */

/** The rows in an XML document are whichever element repeats most — <row> in an
 *  Excel export, <item> in an RSS feed, <record> in a database dump. Picking it
 *  by frequency beats asking the user to name it. */
function repeatingElement(root: Element): Element[] {
  const byPath = new Map<string, Element[]>();
  const walk = (el: Element, path: string) => {
    for (const child of Array.from(el.children)) {
      const p = `${path}/${child.tagName}`;
      const list = byPath.get(p) ?? [];
      list.push(child);
      byPath.set(p, list);
      walk(child, p);
    }
  };
  walk(root, '');
  let best: Element[] = [];
  for (const list of Array.from(byPath.values())) {
    // Prefer the most repeated; break ties toward the shallower group.
    if (list.length > best.length && list.length > 1) best = list;
  }
  return best;
}

export function xmlToSheets(text: string): Sheet[] {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('That XML could not be parsed — check it opens and closes cleanly.');
  const root = doc.documentElement;
  if (!root) return [];
  const records = repeatingElement(root);
  if (!records.length) return [];

  const rowObjs = records.map((rec) => {
    const o: Record<string, Cell> = {};
    for (const a of Array.from(rec.attributes)) o[`@${a.name}`] = a.value;
    const children = Array.from(rec.children);
    if (!children.length) o.value = rec.textContent?.trim() || '';
    for (const child of children) {
      const key = child.tagName;
      const grand = Array.from(child.children);
      if (grand.length) {
        for (const g of grand) o[`${key}.${g.tagName}`] = g.textContent?.trim() || '';
      } else {
        o[key] = child.textContent?.trim() || '';
      }
      for (const a of Array.from(child.attributes)) o[`${key}@${a.name}`] = a.value;
    }
    return o;
  });

  const columns: string[] = [];
  for (const r of rowObjs) for (const k of Object.keys(r)) if (!columns.includes(k)) columns.push(k);
  const rows: Cell[][] = [columns];
  for (const r of rowObjs) rows.push(columns.map((c) => (c in r ? coerce(String(r[c])) : '')));
  return [{ name: records[0].tagName.slice(0, 31) || 'Sheet 1', rows }];
}

/* ─────────────────────── sheet names ─────────────────────── */

/** Excel sheet names: 31 characters, none of []:*?/\, and no duplicates. */
export function sheetName(raw: string, taken: Set<string>): string {
  let base = (raw || 'Sheet').replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sheet';
  let name = base;
  let n = 2;
  while (taken.has(name.toLowerCase())) {
    const suffix = ` (${n++})`;
    base = base.slice(0, 31 - suffix.length);
    name = base + suffix;
  }
  taken.add(name.toLowerCase());
  return name;
}
