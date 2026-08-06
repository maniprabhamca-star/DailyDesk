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
