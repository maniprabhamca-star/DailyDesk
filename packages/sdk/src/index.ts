/**
 * @diemdesk/pdf — PDF operations that run where the file already is.
 *
 * Every other PDF API in this space is a REST endpoint: your user's document
 * travels to a third party, gets processed, and comes back. That is a fine
 * design until the document is a medical record, a client's bank statement or
 * an unreleased contract — at which point "we delete it after an hour" is a
 * promise about someone's conduct rather than a limit on their access, and your
 * compliance review has to reason about a vendor you did not choose.
 *
 * This runs in the browser tab. There is no endpoint, no API key and no upload,
 * which means there is nothing for you to indemnify, no data-processing
 * agreement to negotiate on our behalf, and no per-call bill — the work happens
 * on hardware your user already paid for.
 *
 * The trade, stated plainly: browser memory is not infinite, and everything here
 * is synchronous work on the main thread unless you move it to a Worker. For
 * files in the tens of megabytes that is a non-issue. For a 500MB scan it is
 * not, and you should say so in your own UI.
 */

export const VERSION = '0.1.0';

export {
  info,
  merge,
  extractPages,
  deletePages,
  rotate,
  removeMetadata,
  splitEvery,
  type PdfInfo,
  type RotateOptions,
  type PageSelection,
} from './pdf.js';

export { parsePageSelection, PdfError } from './pages.js';
export type { Bytes } from './types.js';
