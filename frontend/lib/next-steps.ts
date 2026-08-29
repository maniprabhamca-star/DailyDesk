// "What usually comes next" — the follow-on tool, and WHY.
//
// This replaces the instinct to show a recents row. Recency tells someone what
// they already know they opened; sequence tells them the step they were about
// to go looking for, and it works on a first visit, which a recents row never
// can. Most of our traffic lands on one tool page from a search and has never
// seen the home page.
//
// The rule for an entry: it must be the step that genuinely follows, with a
// reason a stranger would recognise. "You might also like Merge PDF" is a
// related-links block, and related-links blocks are ignored. "Lock the
// signature in so it cannot be moved" is a next step.
//
// Where nothing genuinely follows a tool, it gets no entry. An empty dock is
// better than a filled one nobody believes.

export type NextStep = {
  /** Tool route. Must exist — tests/unit/next-steps.test.ts checks. */
  href: string;
  /** The tool's name, as the catalogue writes it. */
  label: string;
  /** Why THIS follows THAT. Written as the reason, not as a description. */
  why: string;
};

export const NEXT_STEPS: Record<string, NextStep[]> = {
  '/compress-pdf': [
    { href: '/share-safe-pdf-check', label: 'Share-Safe check', why: 'You compressed it to send it. Check what is hidden in it first.' },
    { href: '/compress-to-size', label: 'Compress to size', why: 'Still too big for the portal? Hit an exact KB limit instead.' },
  ],
  '/compress-to-size': [
    { href: '/share-safe-pdf-check', label: 'Share-Safe check', why: 'Before it goes to whoever set that limit.' },
  ],
  '/merge-pdf': [
    { href: '/add-page-numbers-to-pdf', label: 'Page numbers', why: 'A merged bundle numbers from one to the end, so it can be cited.' },
    { href: '/compress-pdf', label: 'Compress PDF', why: 'Combining files adds up fast. This brings it back down.' },
  ],
  '/split-pdf': [
    { href: '/merge-pdf', label: 'Merge PDF', why: 'Put the pages you kept back together in a new order.' },
  ],
  '/sign-pdf': [
    { href: '/flatten-pdf', label: 'Flatten PDF', why: 'Locks the signature into the page so it cannot be dragged off.' },
    { href: '/compress-to-size', label: 'Compress to size', why: 'A photographed signature is a photo. It makes the file heavy.' },
  ],
  '/fill-pdf-form': [
    { href: '/sign-pdf', label: 'Sign PDF', why: 'A filled form usually needs signing before it is sent.' },
    { href: '/flatten-pdf', label: 'Flatten PDF', why: 'Stops the fields being edited after you send it.' },
  ],
  '/redact-pdf': [
    { href: '/flatten-pdf', label: 'Flatten PDF', why: 'Belt and braces on a document you are about to release.' },
    { href: '/share-safe-pdf-check', label: 'Share-Safe check', why: 'Redaction handles what you selected. This finds what you did not.' },
  ],
  '/remove-pdf-metadata': [
    { href: '/share-safe-pdf-check', label: 'Share-Safe check', why: 'Metadata is one hiding place. This checks the others.' },
  ],
  '/edit-pdf': [
    { href: '/flatten-pdf', label: 'Flatten PDF', why: 'Fixes your edits in place so they render the same everywhere.' },
    { href: '/sign-pdf', label: 'Sign PDF', why: 'The usual last step once the wording is right.' },
  ],
  '/watermark-pdf': [
    { href: '/flatten-pdf', label: 'Flatten PDF', why: 'A flattened watermark cannot be selected and deleted.' },
  ],
  '/scan-to-pdf': [
    { href: '/ocr-pdf', label: 'OCR', why: 'A photo of text is not text. This makes it searchable.' },
    { href: '/compress-to-size', label: 'Compress to size', why: 'Phone photos are large. Portals rarely accept them as they are.' },
  ],
  '/ocr-pdf': [
    { href: '/pdf-to-text', label: 'PDF to Text', why: 'Now that there is a text layer, you can pull the words out.' },
    { href: '/pdf-to-excel', label: 'PDF to Excel', why: 'If the scan was a table, it can become rows now.' },
  ],
  '/clean-scanned-pdf': [
    { href: '/ocr-pdf', label: 'OCR', why: 'Straightened pages recognise far better than skewed ones.' },
  ],
  '/jpg-to-pdf': [
    { href: '/compress-to-size', label: 'Compress to size', why: 'Photos into a PDF is the fastest way to exceed an upload cap.' },
    { href: '/merge-pdf', label: 'Merge PDF', why: 'Add the new PDF to the rest of the bundle.' },
  ],
  '/heic-to-jpg': [
    { href: '/jpg-to-pdf', label: 'JPG to PDF', why: 'Most places that refused the HEIC want a PDF anyway.' },
    { href: '/compress-image', label: 'Compress image', why: 'iPhone photos are big before anything else touches them.' },
  ],
  '/compress-image': [
    { href: '/jpg-to-pdf', label: 'JPG to PDF', why: 'One PDF is easier to send than eight attachments.' },
  ],
  '/pdf-to-jpg': [
    { href: '/compress-image', label: 'Compress image', why: 'Page images come out large at print resolution.' },
  ],
  '/rotate-pdf': [
    { href: '/merge-pdf', label: 'Merge PDF', why: 'Pages the right way up are usually pages about to be combined.' },
  ],
  '/crop-pdf': [
    { href: '/compress-pdf', label: 'Compress PDF', why: 'Cropping hides the margins; compressing removes the weight.' },
  ],
  '/unlock-pdf': [
    { href: '/edit-pdf', label: 'Edit PDF', why: 'The usual reason for removing the password.' },
    { href: '/compress-pdf', label: 'Compress PDF', why: 'Locked files are often locked scans, and scans are heavy.' },
  ],
  '/pdf-to-excel': [
    { href: '/csv-cleaner', label: 'CSV cleaner', why: 'Extracted tables often need the delimiters and blank rows tidied.' },
  ],
  '/bank-statement-converter': [
    { href: '/pdf-to-excel', label: 'PDF to Excel', why: 'For the invoices and bills that came with the statement.' },
    { href: '/redact-pdf', label: 'Redact PDF', why: 'Take the account number out before the statement goes to anyone.' },
  ],
  '/passport-photo': [
    { href: '/compress-to-size', label: 'Compress to size', why: 'Visa portals cap the photo, often at a few hundred KB.' },
    { href: '/photo-privacy', label: 'Photo privacy', why: 'A phone photo carries the GPS location of where it was taken.' },
  ],
  '/word-to-pdf': [
    { href: '/remove-pdf-metadata', label: 'Remove metadata', why: 'A PDF from Word carries the author and the file path.' },
    { href: '/compress-pdf', label: 'Compress PDF', why: 'Office exports are heavier than they need to be.' },
  ],
  '/excel-to-pdf': [
    { href: '/add-page-numbers-to-pdf', label: 'Page numbers', why: 'A long sheet becomes many pages, and they need numbering.' },
  ],
  '/protect-pdf': [
    { href: '/share-safe-pdf-check', label: 'Share-Safe check', why: 'A password protects the file, not what is hidden inside it.' },
  ],
  '/flatten-pdf': [
    { href: '/compress-pdf', label: 'Compress PDF', why: 'Flattening can grow a file. This brings it back.' },
  ],
  '/add-page-numbers-to-pdf': [
    { href: '/compress-pdf', label: 'Compress PDF', why: 'Last step before it goes out.' },
  ],
  '/bates-numbering': [
    { href: '/share-safe-pdf-check', label: 'Share-Safe check', why: 'A production set is the worst place to leave hidden content.' },
  ],
};

export const nextStepsFor = (path: string): NextStep[] => NEXT_STEPS[path] ?? [];
