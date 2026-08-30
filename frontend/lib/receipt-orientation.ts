// Which way up is this receipt?
//
// Pulled out of the preview component so it can be tested without a canvas.
// The rule is worth stating plainly: a till receipt is printed on a roll, so it
// is far taller than it is wide. An image that is not is almost certainly the
// same receipt lying on its side.
//
// This matters more than a tidy preview. A reader handed a receipt it cannot
// make out does not return nothing — it returns a plausible receipt. One real
// scan came back with five identical apple juices and a beef roast that were
// never on the slip, and the invented figures were self-consistent enough that
// the arithmetic check passed and put a green tick on them.

/** A little slack, so a nearly-square crop is left alone rather than spun. */
const WIDE = 1.15;

export function isWide(w: number, h: number): boolean {
  return w > 0 && h > 0 && w > h * WIDE;
}

/** The rotation to open the preview at, so the common case needs no tap. */
export function initialRotation(w: number, h: number): 0 | 90 {
  return isWide(w, h) ? 90 : 0;
}

/** Whether it still reads sideways on screen — what the warning is about. */
export function looksSideways(w: number, h: number, rotation: number): boolean {
  const quarter = rotation === 90 || rotation === 270;
  return quarter ? !isWide(w, h) : isWide(w, h);
}
