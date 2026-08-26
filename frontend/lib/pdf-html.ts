/**
 * Rendering extracted PDF structure as one self-contained HTML page.
 *
 * We reach this through the Markdown pipeline rather than around it, because
 * that pipeline already knows how to tell a heading from a paragraph, spot a
 * list, and recognise a table — logic worth reusing rather than rewriting in a
 * second dialect that would drift.
 *
 * The vocabulary is therefore small and closed: headings, lists, GFM tables,
 * paragraphs and inline bold. That is exactly what pdfItemsToMarkdown emits, so
 * this renderer is complete for its input rather than a general Markdown
 * implementation with gaps.
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline: **bold**, *italic*, `code`. Escaped first, so no input can inject tags. */
function inline(s: string): string {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function tableRow(line: string): string[] {
  return line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
}

const isDivider = (line: string) => /^\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-');

export function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // Table: a header row, a divider, then body rows.
    if (line.includes('|') && isDivider(lines[i + 1] ?? '')) {
      const head = tableRow(line);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        body.push(tableRow(lines[i]));
        i++;
      }
      out.push(
        '<table>' +
        `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` +
        `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>` +
        '</table>',
      );
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      i++;
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = !!numbered;
      const items: string[] = [];
      while (i < lines.length) {
        const b = /^[-*]\s+(.*)$/.exec(lines[i]);
        const n = /^(\d+)[.)]\s+(.*)$/.exec(lines[i]);
        if (ordered ? !n : !b) break;
        items.push(`<li>${inline(ordered ? n![2] : b![1])}</li>`);
        i++;
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }

    // Anything else is a paragraph, running until a blank line.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|[-*]\s|\d+[.)]\s)/.test(lines[i]) && !lines[i].includes('|')) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    else i++; // a line we could not classify — do not spin on it
  }

  return out.join('\n');
}

/** Wrap the body in a complete, self-contained document. The styling is
 *  deliberately plain and readable rather than an attempt to mimic the PDF —
 *  a web page that reflows is the point of converting at all. */
export function buildHtmlDocument(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { max-width: 46rem; margin: 2rem auto; padding: 0 1.25rem;
         font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #1a1a1a; background: #fff; }
  h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 2rem 0 .6rem; }
  h1 { font-size: 1.9rem; } h2 { font-size: 1.45rem; } h3 { font-size: 1.2rem; }
  p { margin: 0 0 1rem; }
  ul, ol { margin: 0 0 1rem 1.35rem; padding: 0; }
  li { margin: .25rem 0; }
  table { border-collapse: collapse; width: 100%; margin: 0 0 1.25rem; font-size: .95rem; }
  th, td { border: 1px solid #d6d6d6; padding: .45rem .6rem; text-align: left; vertical-align: top; }
  th { background: #f4f4f4; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .92em;
         background: #f2f2f2; padding: .1em .3em; border-radius: 3px; }
  @media (prefers-color-scheme: dark) {
    body { color: #e8e8e8; background: #16181c; }
    th, td { border-color: #33363d; } th { background: #21242a; } code { background: #21242a; }
  }
</style>
</head>
<body>
${body}
</body>
</html>
`;
}
