// Minimal .docx writer on jszip — same philosophy as lib/xlsx.ts: no new
// dependency, license-clean, generated entirely on-device. Supports what the AI
// tools need: headings, paragraphs, bullet items, bold lead-ins, and a simple
// bordered table (for side-by-side translations). Word/LibreOffice handle fonts
// and Unicode themselves, so non-Latin scripts (Hindi/Tamil/Arabic/CJK) just work.
import JSZip from 'jszip';

export type DocxBlock =
  | { type: 'h1' | 'h2' | 'p' | 'li' | 'note'; text: string; bold?: string }
  | { type: 'table'; rows: string[][]; header?: boolean };

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A run with optional bold; splits out a "Bold lead: rest" pattern when `bold` given.
function runs(text: string, bold?: string): string {
  const r = (t: string, b = false) =>
    `<w:r><w:rPr>${b ? '<w:b/>' : ''}</w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
  if (bold && text.startsWith(bold)) return r(bold, true) + r(text.slice(bold.length));
  return r(text);
}

function para(block: Extract<DocxBlock, { text: string }>): string {
  const sz = block.type === 'h1' ? 32 : block.type === 'h2' ? 26 : 22; // half-points
  const boldAll = block.type === 'h1' || block.type === 'h2';
  const color = block.type === 'note' ? '666666' : '000000';
  const text = block.type === 'li' ? `•  ${block.text}` : block.text;
  const ind = block.type === 'li' ? '<w:ind w:left="360"/>' : '';
  const spacing = block.type === 'h1' ? '<w:spacing w:before="240" w:after="120"/>'
    : block.type === 'h2' ? '<w:spacing w:before="200" w:after="80"/>'
    : '<w:spacing w:after="120"/>';
  const rpr = `<w:rPr>${boldAll ? '<w:b/>' : ''}<w:sz w:val="${sz}"/><w:color w:val="${color}"/>${block.type === 'note' ? '<w:i/>' : ''}</w:rPr>`;
  const body = boldAll || block.type === 'note'
    ? `<w:r>${rpr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
    : runs(text, block.bold);
  return `<w:p><w:pPr>${spacing}${ind}</w:pPr>${body}</w:p>`;
}

function table(rows: string[][], header?: boolean): string {
  const cell = (t: string, b: boolean) =>
    `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/><w:tcBorders><w:top w:val="single" w:sz="4" w:color="CCCCCC"/><w:left w:val="single" w:sz="4" w:color="CCCCCC"/><w:bottom w:val="single" w:sz="4" w:color="CCCCCC"/><w:right w:val="single" w:sz="4" w:color="CCCCCC"/></w:tcBorders></w:tcPr><w:p><w:r><w:rPr>${b ? '<w:b/>' : ''}<w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p></w:tc>`;
  const tr = (r: string[], b: boolean) => `<w:tr>${r.map((c) => cell(c, b)).join('')}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="autofit"/></w:tblPr>${rows
    .map((r, i) => tr(r, !!header && i === 0)).join('')}</w:tbl><w:p/>`;
}

export async function makeDocx(blocks: DocxBlock[]): Promise<Blob> {
  const body = blocks
    .map((b) => (b.type === 'table' ? table(b.rows, b.header) : para(b)))
    .join('');
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file('word/document.xml', documentXml);
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
