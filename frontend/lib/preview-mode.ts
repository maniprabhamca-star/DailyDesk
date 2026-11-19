/**
 * How the scanner puts the camera on screen.
 *
 * Normally the <video> element IS the preview and CSS frames it. That is the
 * right default: the browser decodes and composites the frames itself, which
 * costs this code nothing and is why the picture cannot end up upside down —
 * five earlier layouts repainted every frame into a canvas, and every one of
 * them went wrong deciding which way up the picture went.
 *
 * But on some older Android hardware a <video> can composite BLACK while its
 * frames decode perfectly well. Reported on a OnePlus 5T: a blank viewfinder
 * with the scanner's green outline drawn over it — and the outline is the
 * proof, because it comes from a canvas reading those same frames through
 * drawImage. Canvas works on that device. Video does not.
 *
 * So the fallback is to draw the frames into a visible canvas and let the
 * <video> carry on as an invisible source. It costs one blit per frame, and
 * it cannot be black.
 *
 * It is NOT the default, because every other phone works today and this path
 * is the one with the bad history. It is remembered per device, because
 * whoever owns that phone should have to find it once and never again.
 */

const KEY = 'dd-scanner-preview';

export type PreviewMode = 'video' | 'canvas';

/** What this device has been told to do. 'video' unless chosen otherwise. */
export function readPreviewMode(): PreviewMode {
  try {
    return localStorage.getItem(KEY) === 'canvas' ? 'canvas' : 'video';
  } catch {
    return 'video';            // private mode, blocked storage — the default is fine
  }
}

/** Has anyone made a choice on this device yet? Decides whether to offer one. */
export function hasChosenPreviewMode(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'canvas' || v === 'video';
  } catch {
    return false;
  }
}

export function writePreviewMode(mode: PreviewMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* the setting simply will not stick; the scanner still works */
  }
}
