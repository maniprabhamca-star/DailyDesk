// Per-tool honesty data — the two blocks nobody else on the market prints:
// exactly what a tool does to your file, and where it is the wrong tool.
//
// Keyed by route. A tool with no entry simply renders neither block, so this can
// be filled in gradually without touching a single page.
//
// RULES FOR WRITING THESE
//  • Say the awkward thing. "Digital signatures are invalidated" is the whole
//    point of the block — a list of reassurances is marketing, not disclosure.
//  • Plain words. "Images are re-encoded", not "lossy transcoding applied".
//  • A limit should send the reader somewhere useful, including to a competitor
//    when they genuinely need one. `href` is optional and may be external.

export type EffectTone = 'good' | 'warn';

export type ToolEffect = {
  what: string;      // "Digital signatures"
  value: string;     // "invalidated"
  tone: EffectTone;  // good = nothing lost, warn = something changes
};

export type ToolLimit = {
  title: string;     // short, bolded
  detail: string;    // one plain sentence
  href?: string;     // where to go instead
  hrefLabel?: string;
};

export type ToolFacts = {
  effects?: ToolEffect[];
  limits?: ToolLimit[];
};

export const TOOL_FACTS: Record<string, ToolFacts> = {
  '/compress-pdf': {
    effects: [
      { what: 'Images', value: 're-encoded, smaller', tone: 'warn' },
      { what: 'Text and vector art', value: 'untouched', tone: 'good' },
      { what: 'Fonts', value: 'kept, subset', tone: 'good' },
      { what: 'Metadata and author', value: 'preserved', tone: 'good' },
      { what: 'Digital signatures', value: 'invalidated', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'A PDF that is mostly text', detail: 'There is little to squeeze out. Expect a few percent, not seventy.' },
      { title: 'Very large files on a phone', detail: 'The browser tab can run out of memory. A desktop will get through it.' },
      { title: 'Hitting an exact size', detail: 'This tool aims for a quality level, not a number.', href: '/compress-to-size', hrefLabel: 'Compress to a size' },
      { title: 'Print-shop preflight', detail: 'We do not do PDF/X colour conversion. Acrobat Pro is the right tool.' },
    ],
  },

  '/merge-pdf': {
    effects: [
      { what: 'Every page', value: 'copied as-is', tone: 'good' },
      { what: 'Quality', value: 'unchanged', tone: 'good' },
      { what: 'Form fields', value: 'kept', tone: 'good' },
      { what: 'Digital signatures', value: 'invalidated', tone: 'warn' },
      { what: 'Bookmarks and outlines', value: 'not carried over', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'Password-protected files', detail: 'Unlock them first — a locked PDF cannot be read to merge.', href: '/unlock-pdf', hrefLabel: 'Unlock PDF' },
      { title: 'Merging by page, not by file', detail: 'To pull specific pages out first, split them.', href: '/split-pdf', hrefLabel: 'Split PDF' },
    ],
  },

  '/split-pdf': {
    effects: [
      { what: 'Selected pages', value: 'copied as-is', tone: 'good' },
      { what: 'Quality', value: 'unchanged', tone: 'good' },
      { what: 'Digital signatures', value: 'invalidated', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'Splitting a scan into articles', detail: 'We split by page or size, not by understanding the content.' },
      { title: 'Password-protected files', detail: 'Unlock the file first.', href: '/unlock-pdf', hrefLabel: 'Unlock PDF' },
    ],
  },

  '/compress-image': {
    effects: [
      { what: 'Pixels', value: 're-encoded, smaller', tone: 'warn' },
      { what: 'Dimensions', value: 'unchanged', tone: 'good' },
      { what: 'EXIF and location data', value: 'removed', tone: 'good' },
      { what: 'Colour profile', value: 'kept', tone: 'good' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'An already-compressed JPEG', detail: 'Squeezing it again mostly costs quality for very little size.' },
      { title: 'Keeping every last detail', detail: 'This is lossy by design. For archival work, keep your original.' },
      { title: 'Hitting an exact size', detail: 'Aim at a number instead.', href: '/compress-to-size', hrefLabel: 'Compress to a size' },
    ],
  },

  '/pdf-to-word': {
    effects: [
      { what: 'Text', value: 'extracted, editable', tone: 'good' },
      { what: 'Layout', value: 'approximated', tone: 'warn' },
      { what: 'Your file', value: 'sent to our server', tone: 'warn' },
      { what: 'The uploaded copy', value: 'deleted right after', tone: 'good' },
    ],
    limits: [
      { title: 'A scanned page', detail: 'A scan is a picture of text with nothing to extract. Run OCR first.', href: '/ocr-pdf', hrefLabel: 'OCR a PDF' },
      { title: 'Pixel-perfect layout', detail: 'Complex columns and tables will need tidying after conversion.' },
      { title: 'Files you cannot upload', detail: 'This is one of our few server tools. If the file must not leave your device, edit it here instead.', href: '/edit-pdf', hrefLabel: 'Edit PDF' },
    ],
  },

  '/pdf-to-excel': {
    effects: [
      { what: 'Table cells', value: 'rebuilt from positions', tone: 'good' },
      { what: 'Formulas', value: 'not recovered', tone: 'warn' },
      { what: 'Merged and nested headers', value: 'flattened', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'A scanned table', detail: 'There is no text layer to read positions from. Run OCR first.', href: '/ocr-pdf', hrefLabel: 'OCR a PDF' },
      { title: 'Borderless, irregular tables', detail: 'Columns are inferred from spacing, so odd layouts need a fix in the grid before export.' },
    ],
  },

  '/pdf-to-epub': {
    effects: [
      { what: 'Text', value: 'reflows to any screen', tone: 'good' },
      { what: 'Headings, lists and tables', value: 'rebuilt from the layout', tone: 'good' },
      { what: 'Chapters and contents', value: 'built from bookmarks or headings', tone: 'good' },
      { what: 'Page one', value: 'becomes the cover', tone: 'good' },
      { what: 'Pictures', value: 'carried across, in place', tone: 'good' },
      { what: 'Right-to-left languages', value: 'laid out and paged correctly', tone: 'good' },
      { what: 'Running heads and page numbers', value: 'dropped', tone: 'warn' },
      { what: 'Repeated logos and letterheads', value: 'dropped as page furniture', tone: 'warn' },
      { what: 'Images re-encoded as JPEG', value: 'smaller, slightly lossy', tone: 'warn' },
      { what: 'The original page layout', value: 'not preserved — that is the point', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'A scanned book', detail: 'There is no selectable text to reflow. Run OCR first, then convert.', href: '/ocr-pdf', hrefLabel: 'OCR a PDF' },
      { title: 'A magazine or heavily designed page', detail: 'Multi-column art direction does not survive reflowing. Read those as a PDF.' },
      { title: 'You need the pages to look identical', detail: 'An EPUB rewraps by design. If the layout matters, keep the PDF and just shrink it.', href: '/compress-pdf', hrefLabel: 'Compress a PDF' },
      { title: 'A comic or fixed-layout picture book', detail: 'Pictures come across, but each one lands in the text flow rather than on a designed page.' },
    ],
  },

  '/svg-to-png': {
    effects: [
      { what: 'Any output size', value: 'from the vector, always sharp', tone: 'good' },
      { what: 'Transparency', value: 'kept in PNG', tone: 'good' },
      { what: 'The result', value: 'a fixed-size picture, not a vector', tone: 'warn' },
      { what: 'External fonts and images', value: 'not loaded — browsers block them', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'An SVG that links to a font or image', detail: 'Nothing outside the file can load. Convert text to outlines or embed the image first.' },
      { title: 'You need it to stay scalable', detail: 'Keep the .svg as your master — a PNG is fixed at the size you export.' },
      { title: 'Transparency in a JPG', detail: 'JPG has none, so see-through areas fill white. Use PNG.' },
    ],
  },

  '/svg-to-pdf': {
    effects: [
      { what: 'The page', value: 'sized to the drawing, not A4', tone: 'good' },
      { what: 'The artwork', value: 'embedded as a high-resolution image', tone: 'warn' },
      { what: 'Text in the drawing', value: 'becomes part of the picture', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'You need selectable text in the PDF', detail: 'The drawing is rasterised, so its text is not searchable. Place the SVG in a layout tool instead.' },
      { title: 'True vector output', detail: 'Shapes are not translated into PDF drawing commands. For press work, hand the printer the .svg or an EPS.' },
    ],
  },

  '/epub-to-pdf': {
    effects: [
      { what: 'Chapters', value: 'in the book’s own reading order', tone: 'good' },
      { what: 'Headings, paragraphs and lists', value: 'kept', tone: 'good' },
      { what: 'The publisher’s design', value: 'not reproduced', tone: 'warn' },
      { what: 'Pictures in the book', value: 'not carried across yet', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'A comic or fixed-layout book', detail: 'Those pages are images, so there is no text to lay out.' },
      { title: 'Non-Latin text in the PDF', detail: 'The built-in PDF fonts are Latin-only. Choose Word or plain text and every character survives.' },
      { title: 'You want it to reflow', detail: 'Then keep the EPUB — a PDF is a fixed page by design.' },
    ],
  },

  '/pdf-to-text': {
    effects: [
      { what: 'Text', value: 'extracted in reading order', tone: 'good' },
      { what: 'Running heads and page numbers', value: 'dropped', tone: 'good' },
      { what: 'Words hyphenated across a line', value: 'rejoined', tone: 'good' },
      { what: 'Columns, tables and layout', value: 'flattened away', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'A scanned PDF', detail: 'No text layer to extract. Run OCR first.', href: '/ocr-pdf', hrefLabel: 'OCR a PDF' },
      { title: 'You need the tables', detail: 'Plain text loses the grid.', href: '/pdf-to-excel', hrefLabel: 'PDF to Excel' },
      { title: 'You want headings and lists kept', detail: 'Markdown keeps the structure.', href: '/pdf-to-markdown', hrefLabel: 'PDF to Markdown' },
    ],
  },

  '/markdown-to-pdf': {
    effects: [
      { what: 'Headings, lists, quotes and code', value: 'laid out for reading', tone: 'good' },
      { what: 'Tables', value: 'kept in Word; flattened to lines in PDF', tone: 'warn' },
      { what: 'Bold, links and inline code', value: 'flattened to plain text', tone: 'warn' },
      { what: 'Images', value: 'alt text only, not the picture', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'Typeset output', detail: 'This is built for readable documents, not for design. Use a real typesetting tool for a book.' },
      { title: 'Non-Latin text in the PDF', detail: 'Latin-only fonts are built in. Word or plain text keeps every character.' },
      { title: 'Raw HTML in your Markdown', detail: 'It is treated as text, not rendered.' },
    ],
  },

  '/subtitle-converter': {
    effects: [
      { what: 'SRT and VTT', value: 'properly rewritten, not renamed', tone: 'good' },
      { what: 'Timing', value: 'shiftable by any offset', tone: 'good' },
      { what: 'Transcript option', value: 'timings and tags stripped', tone: 'good' },
      { what: 'Positioning and styling blocks', value: 'dropped', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'ASS/SSA with heavy styling', detail: 'Karaoke effects and positioning have no equivalent here.' },
      { title: 'Burning subtitles into a video', detail: 'That needs a video encoder — different job entirely.' },
      { title: 'Translating the subtitles', detail: 'This converts the format, not the language.', href: '/translate-pdf', hrefLabel: 'Translate a document' },
    ],
  },

  '/favicon-generator': {
    effects: [
      { what: 'Six PNG sizes', value: 'the ones browsers ask for', tone: 'good' },
      { what: 'favicon.ico', value: 'a real multi-size icon, not a renamed PNG', tone: 'good' },
      { what: 'Web manifest and HTML', value: 'included, ready to paste', tone: 'good' },
      { what: 'Non-square images', value: 'fitted and centred, never cropped', tone: 'good' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'A detailed logo at 16px', detail: 'Fine detail disappears at tab size. Check the previews — a simplified mark often reads better.' },
      { title: 'Light and dark variants', detail: 'One icon is generated. Browsers do not switch favicons by theme.' },
      { title: 'You need the source redrawn', detail: 'This resizes what you give it; it does not redesign the mark.' },
    ],
  },

  '/excel-to-csv': {
    effects: [
      { what: 'Every sheet', value: 'read, each as its own tab', tone: 'good' },
      { what: 'Dates', value: 'written as dates, not day numbers', tone: 'good' },
      { what: 'Formulas', value: 'replaced by the value they produced', tone: 'warn' },
      { what: 'Formatting, colours and merged cells', value: 'not kept — CSV has none', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'You need the formulas kept', detail: 'CSV holds values only. Keep the .xlsx for anything that has to recalculate.' },
      { title: 'Charts, pivot tables or macros', detail: 'None of these survive a conversion to CSV, by definition of the format.' },
      { title: 'A password-protected workbook', detail: 'An encrypted .xlsx cannot be unzipped without the password. Open it in Excel and save a copy first.' },
    ],
  },

  '/csv-to-excel': {
    effects: [
      { what: 'Separator', value: 'detected — comma, semicolon or tab', tone: 'good' },
      { what: 'Quoted fields with commas inside', value: 'kept in one cell', tone: 'good' },
      { what: 'Numbers', value: 'written as numbers, not text', tone: 'good' },
      { what: 'Leading zeros', value: 'lost where a value reads as a number', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'Product codes or IDs with leading zeros', detail: 'Anything that reads as a number becomes one, so 007 becomes 7. Edit the cell to add an apostrophe before it, or keep the CSV.' },
      { title: 'A file with several tables in it', detail: 'One CSV becomes one sheet. Split it first, or clean it up.', href: '/csv-cleaner', hrefLabel: 'CSV cleaner' },
    ],
  },

  '/json-to-excel': {
    effects: [
      { what: 'An array of records', value: 'becomes rows', tone: 'good' },
      { what: 'Nested objects', value: 'flattened to dotted columns', tone: 'good' },
      { what: 'Fields missing on some records', value: 'left blank, never dropped', tone: 'good' },
      { what: 'Arrays of objects inside a record', value: 'kept as JSON text in the cell', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'JSON that is not a list', detail: 'A single object has one row in it. There is nothing to lay out as a table.' },
      { title: 'Deeply nested API responses', detail: 'Flattening produces a lot of columns. Pick out the part you want first.' },
      { title: 'NDJSON / JSON Lines', detail: 'One object per line is a different format — wrap the lines in an array first.' },
    ],
  },

  '/xml-to-excel': {
    effects: [
      { what: 'The repeating element', value: 'becomes the rows', tone: 'good' },
      { what: 'Attributes', value: 'become @-prefixed columns', tone: 'good' },
      { what: 'Namespace prefixes', value: 'kept, so fields do not merge', tone: 'good' },
      { what: 'Mixed content and comments', value: 'not carried across', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'Document-shaped XML', detail: 'An article with markup through it has no repeating record, so there are no rows to build. We say so rather than guess.' },
      { title: 'e-invoice XML (Factur-X, ZUGFeRD)', detail: 'It reads as a single record. Proper e-invoice handling is a separate job on our roadmap.' },
      { title: 'Very deep hierarchies', detail: 'Only one level below the record is expanded into columns; deeper nesting is summarised.' },
    ],
  },

  '/video-to-mp3': {
    effects: [
      { what: 'The soundtrack', value: 'extracted as MP3 or WAV', tone: 'good' },
      { what: 'Your video file', value: 'untouched, never uploaded', tone: 'good' },
      { what: 'MP3 output', value: 're-encoded, slightly lossy', tone: 'warn' },
      { what: 'Sample rate', value: 'set by your device, usually 48 kHz', tone: 'warn' },
      { what: 'Chapters, tags and album art', value: 'not carried over', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'Longer than about 90 minutes', detail: 'The whole soundtrack is held in memory while it converts. Trim it into parts first.' },
      { title: 'A codec the browser cannot play', detail: 'We can only decode what your browser can. A rare codec falls back to a slower play-through capture.' },
      { title: 'You want the video smaller, not the audio', detail: 'Different job.', href: '/compress-video', hrefLabel: 'Compress video' },
    ],
  },

  '/audio-converter': {
    effects: [
      { what: 'M4A, AAC, OGG, Opus, FLAC, WAV', value: 'read directly', tone: 'good' },
      { what: 'Output', value: 'MP3 or WAV', tone: 'good' },
      { what: 'Converting to MP3', value: 'lossy — a little quality goes', tone: 'warn' },
      { what: 'Sample rate', value: 'set by your device, usually 48 kHz', tone: 'warn' },
      { what: 'Tags and cover art', value: 'not carried over', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'M4A or Opus as the OUTPUT', detail: 'Only MP3 and WAV come out for now — they are the two that open everywhere.' },
      { title: 'Longer than about 90 minutes', detail: 'Held in memory as raw audio while it converts. Trim it into sections.' },
      { title: 'Re-encoding an already-lossy file', detail: 'M4A → MP3 loses a little more each time. Convert from the original where you can.' },
    ],
  },

  '/html-to-excel': {
    effects: [
      { what: 'Every real table on the page', value: 'found and laid out', tone: 'good' },
      { what: 'Merged cells', value: 'expanded so columns line up', tone: 'good' },
      { what: 'Numbers', value: 'stay numbers in Excel', tone: 'good' },
      { what: 'Links, images and styling', value: 'not carried across — text only', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'A “table” drawn with styled boxes', detail: 'Many dashboards and pricing pages only look like tables. There is no structure to read, so we say so rather than guess.' },
      { title: 'A URL the site refuses to share', detail: 'Browsers block one page from reading another. Save the page (Ctrl+S) and drop the file — we will not proxy it through a server.' },
      { title: 'A table inside a PDF', detail: 'Different job, different engine.', href: '/pdf-to-excel', hrefLabel: 'PDF to Excel' },
      { title: 'A bank statement', detail: 'Statements need balance checking and a bank-specific reader.', href: '/bank-statement-converter', hrefLabel: 'Bank statement converter' },
    ],
  },

  '/unlock-pdf': {
    effects: [
      { what: 'Owner password', value: 'removed', tone: 'good' },
      { what: 'Page content', value: 'untouched', tone: 'good' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'A file you do not have the password for', detail: 'This removes restrictions from files you can already open. It is not a password cracker.' },
    ],
  },

  '/edit-pdf': {
    effects: [
      { what: 'Edited paragraphs', value: 'redrawn as real text', tone: 'good' },
      { what: 'The rest of the page', value: 'untouched', tone: 'good' },
      { what: 'Replaced words', value: 'covered, still in the file', tone: 'warn' },
      { what: 'Digital signatures', value: 'invalidated', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'Removing sensitive text', detail: 'Editing covers the old words; they can still be copied out of the file. Redaction actually removes them.', href: '/redact-pdf', hrefLabel: 'Redact PDF' },
      { title: 'A scanned page', detail: 'There is no selectable text to edit. Run OCR first.', href: '/ocr-pdf', hrefLabel: 'OCR a PDF' },
      { title: 'Reflowing a whole document', detail: 'A PDF is fixed-layout. Edits stay inside their own paragraph box.' },
    ],
  },

  '/remove-metadata': {
    effects: [
      { what: 'Author, title, producer', value: 'stripped', tone: 'good' },
      { what: 'Creation and edit dates', value: 'stripped', tone: 'good' },
      { what: 'Page content', value: 'untouched', tone: 'good' },
      { what: 'Text hidden in the page itself', value: 'still there', tone: 'warn' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'Hiding what the page says', detail: 'This clears file properties, not content. To remove words from the page, redact them.', href: '/redact-pdf', hrefLabel: 'Redact PDF' },
    ],
  },

  '/jpg-to-pdf': {
    effects: [
      { what: 'Images', value: 'embedded as-is', tone: 'good' },
      { what: 'Quality', value: 'unchanged', tone: 'good' },
      { what: 'EXIF and location data', value: 'dropped', tone: 'good' },
      { what: 'Runs on', value: 'your device', tone: 'good' },
    ],
    limits: [
      { title: 'Making the text searchable', detail: 'The result is a picture of your pages. Run OCR to add a text layer.', href: '/ocr-pdf', hrefLabel: 'OCR a PDF' },
    ],
  },
};

export function factsFor(pathname: string): ToolFacts | null {
  return TOOL_FACTS[pathname] ?? null;
}
