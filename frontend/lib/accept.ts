/**
 * What each file picker will accept — in one place.
 *
 * These were hand-written per tool, and two independent bugs came out of that
 * single habit: `.ppsx` was missing from the presentation converter, and eleven
 * image inputs listed `image/jpeg,image/png,image/webp` while we shipped a HEIC
 * decoder. Same cause, so one fix.
 *
 * ── The rule for images ──────────────────────────────────────────────────────
 * A NARROW image accept list is a bug, not a safety feature.
 *
 * `accept` is a convenience filter for the OS picker, not validation — every
 * tool sniffs the real format from the file's magic bytes anyway (sniffFormat
 * in lib/image-for-pdf.ts), because the name and the MIME type both lie:
 * Android hands you a HEIF image called `photo.jpg` with type `image/jpeg`.
 *
 * So a narrow list buys nothing and costs real files. It greys out photos the
 * tool could open, on the one device where people have the most photos. Always
 * start from `image/*` and append extensions for the formats a picker is likely
 * to mislabel or omit.
 */

/** Extensions worth naming explicitly: pickers mislabel or omit these. */
const IMAGE_EXTS = '.heic,.heif,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.tif,.tiff';

export const ACCEPT = {
  /** A PDF and nothing else. */
  pdf: 'application/pdf,.pdf',

  /**
   * Any image. Permissive on purpose — see the rule above. Only use this on a
   * tool that decodes through decodeImage(), which handles HEIC; a tool doing
   * its own createImageBitmap() will accept an iPhone photo and then fail on it,
   * which is a worse experience than not accepting it.
   */
  image: `image/*,${IMAGE_EXTS}`,

  /** Tools that take either — compress-to-size, scan-to-pdf. */
  pdfOrImage: `application/pdf,.pdf,image/*,${IMAGE_EXTS}`,

  /** Word processing, including the OpenDocument and legacy equivalents. */
  documents:
    '.doc,.docx,.odt,.rtf,.fodt,application/msword,' +
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
    'application/vnd.oasis.opendocument.text,application/rtf',

  /** Spreadsheets. */
  spreadsheets:
    '.xls,.xlsx,.ods,.csv,.fods,application/vnd.ms-excel,' +
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
    'application/vnd.oasis.opendocument.spreadsheet,text/csv',

  /**
   * Presentations. `.ppsx`/`.pps` are PowerPoint SHOW files — the same content
   * saved to open straight into the slideshow. LibreOffice has always converted
   * them; they were simply missing from the list, so anyone who had saved a
   * deck that way was told their file was unsupported.
   */
  presentations:
    '.ppt,.pptx,.pps,.ppsx,.odp,.fodp,application/vnd.ms-powerpoint,' +
    'application/vnd.openxmlformats-officedocument.presentationml.presentation,' +
    'application/vnd.openxmlformats-officedocument.presentationml.slideshow,' +
    'application/vnd.oasis.opendocument.presentation',

  /** Every OpenDocument type we hand to LibreOffice. */
  opendocument:
    '.odt,.ods,.odp,.odg,.fodt,.fods,.fodp,' +
    'application/vnd.oasis.opendocument.text,' +
    'application/vnd.oasis.opendocument.spreadsheet,' +
    'application/vnd.oasis.opendocument.presentation,' +
    'application/vnd.oasis.opendocument.graphics',

  /** Markup and plain text that converts to PDF. */
  markup: '.html,.htm,.xhtml,.txt,.md,.markdown,.rtf,.odt,text/html,text/plain,text/markdown,application/rtf',

  video: 'video/*,.mp4,.webm,.mov,.m4v,.avi,.mkv,.ogg',
  audio: 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.weba',

  json: 'application/json,.json',
  csv: 'text/csv,.csv',
  svg: 'image/svg+xml,.svg',
  epub: 'application/epub+zip,.epub',
  subtitles: '.srt,.vtt,.sbv,.ass,.ssa,text/vtt,text/plain',
} as const;

/** Everything a "drop anything" surface should take. Keep in sync by union. */
export const ACCEPT_ANY = [
  ACCEPT.pdf, ACCEPT.image, ACCEPT.documents, ACCEPT.spreadsheets,
  ACCEPT.presentations, ACCEPT.markup, ACCEPT.epub,
].join(',');
