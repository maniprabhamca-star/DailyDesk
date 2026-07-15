// Minimal .xlsx writer built on jszip (already a dependency; MIT). An .xlsx is an
// OOXML package — a zip of a few XML parts. We only need plain cells (text or
// number), so we inline strings (t="inlineStr") and skip sharedStrings/styles
// entirely. Keeps us dependency-light and license-clean (no SheetJS/ExcelJS).

import JSZip from 'jszip';

export type Cell = string | number;
export type Sheet = { name: string; rows: Cell[][] };

const escXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A1-style column letter for a 0-based column index.
function colLetter(i: number): string {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Excel sheet names: <=31 chars, none of []:*?/\ , and can't be blank.
function safeSheetName(name: string, fallback: string): string {
  const cleaned = (name || '').replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31);
  return cleaned || fallback;
}

function cellXml(r: number, c: number, v: Cell): string {
  const ref = `${colLetter(c)}${r + 1}`;
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
  const s = v == null ? '' : String(v);
  if (s === '') return `<c r="${ref}"/>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escXml(s)}</t></is></c>`;
}

function sheetXml(sheet: Sheet): string {
  const rows = sheet.rows
    .map((row, r) => `<row r="${r + 1}">${row.map((v, c) => cellXml(r, c, v)).join('')}</row>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
}

function contentTypes(n: number): string {
  const overrides = Array.from({ length: n }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`;
}

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

function workbookXml(sheets: Sheet[]): string {
  const entries = sheets
    .map((s, i) => `<sheet name="${escXml(safeSheetName(s.name, `Sheet${i + 1}`))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${entries}</sheets></workbook>`;
}

function workbookRels(n: number): string {
  const rels = Array.from({ length: n }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

// Build an .xlsx workbook (one worksheet per sheet) as a Blob.
export async function buildXlsx(sheets: Sheet[]): Promise<Blob> {
  const list = sheets.length ? sheets : [{ name: 'Sheet1', rows: [] as Cell[][] }];
  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypes(list.length));
  zip.file('_rels/.rels', ROOT_RELS);
  zip.file('xl/workbook.xml', workbookXml(list));
  zip.file('xl/_rels/workbook.xml.rels', workbookRels(list.length));
  list.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// Serialize rows to RFC-4180 CSV (quote when needed).
export function toCsv(rows: Cell[][]): string {
  const cell = (v: Cell) => {
    const s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

// If a string is a clean number (optionally with thousands commas), return it as a
// Number so Excel treats it numerically; otherwise leave it as text (preserves
// currency symbols, unicode minus, dates, etc. exactly as they appear).
export function coerce(s: string): Cell {
  const t = s.trim();
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t) || /^[-+]?\d+(\.\d+)?$/.test(t)) {
    const n = Number(t.replace(/,/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return s;
}
