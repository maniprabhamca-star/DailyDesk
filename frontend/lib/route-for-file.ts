// Which tool suits the file someone just picked?
//
// The app bar's centre button opens a file picker from any page, and the worst
// possible answer to "I picked a photo" is a generic uploader that then asks
// what they wanted. The extension already says most of it, so send them
// somewhere that can actually do something with it.
//
// Deliberately conservative: where a file type has several sensible tools, this
// picks the one people overwhelmingly want and the destination page offers the
// rest. A PDF goes to the viewer rather than, say, compress — because opening
// it is the only thing that is right regardless of intent.

const EXT = (name: string) => {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : '';
};

const BY_EXT: Record<string, string> = {
  // PDFs — open it. Every other action starts from looking at it.
  pdf: '/pdf-viewer',

  // Images — the overwhelmingly common intent is "make this a PDF".
  jpg: '/jpg-to-pdf', jpeg: '/jpg-to-pdf', png: '/jpg-to-pdf', webp: '/jpg-to-pdf',
  gif: '/jpg-to-pdf', bmp: '/jpg-to-pdf', tif: '/jpg-to-pdf', tiff: '/jpg-to-pdf', avif: '/jpg-to-pdf',
  // …except HEIC, where the reason someone is stuck is almost always that
  // nothing will open it.
  heic: '/heic-to-jpg', heif: '/heic-to-jpg',

  // Office and text — to PDF.
  doc: '/word-to-pdf', docx: '/word-to-pdf', rtf: '/word-to-pdf', txt: '/word-to-pdf', odt: '/odf-to-pdf',
  xls: '/excel-to-pdf', xlsx: '/excel-to-pdf', ods: '/excel-to-pdf',
  ppt: '/powerpoint-to-pdf', pptx: '/powerpoint-to-pdf', pps: '/powerpoint-to-pdf', ppsx: '/powerpoint-to-pdf', odp: '/powerpoint-to-pdf',
  html: '/html-to-pdf', htm: '/html-to-pdf',
  epub: '/epub-to-pdf',
  md: '/markdown-to-pdf',
  svg: '/svg-to-pdf',

  // Data — cleaning is the usual first move, and the page offers the converters.
  csv: '/csv-cleaner',
  json: '/json-formatter',

  // Media.
  mp4: '/compress-video', mov: '/compress-video', webm: '/compress-video', avi: '/compress-video', mkv: '/compress-video',
  mp3: '/audio-converter', wav: '/audio-converter', m4a: '/audio-converter', ogg: '/audio-converter', flac: '/audio-converter',
  srt: '/subtitle-converter', vtt: '/subtitle-converter',
};

/** A tool route for this filename. Falls back to the catalogue. */
export function routeForFile(filename: string): string {
  return BY_EXT[EXT(filename)] || '/tools';
}

export { BY_EXT as ROUTE_BY_EXT };
