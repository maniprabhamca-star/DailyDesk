/** Anything a browser hands you when it reads a file. */
export type Bytes = Uint8Array | ArrayBuffer;

/** Normalise to the shape pdf-lib wants, without copying when we don't have to. */
export function toU8(b: Bytes): Uint8Array {
  return b instanceof Uint8Array ? b : new Uint8Array(b);
}
