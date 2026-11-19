/**
 * The camera click, synthesised.
 *
 * Asked for: a shutter sound when a receipt has been found and scanned
 * cleanly. It is not decoration — it is the one piece of feedback that
 * reaches you when you are not looking at the screen, which, holding a phone
 * over a receipt, is most of the time. So it carries a meaning: it fires only
 * on a capture where the edges were found and the page was straightened.
 * A shot taken with no edges detected stays silent and says so on screen
 * instead. Hearing the click means the scan was good.
 *
 * MADE OF MATHS, NOT A FILE.
 *
 * Every sample here is generated in the browser. No .mp3 to license, to host,
 * to cache, or to fail to load on a slow connection — the whole thing is
 * about 90 milliseconds of filtered noise and weighs nothing.
 *
 * A real shutter is two mechanical events, not one: the blades opening and
 * closing again. One click sounds like a UI beep; two, close together and the
 * second quieter, is the thing everybody recognises as a camera. That is the
 * only reason for the pair below.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

type WithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as WithWebkit).webkitAudioContext;
  if (!Ctor) return null;                       // no Web Audio: no sound, no error
  if (!ctx) {
    try { ctx = new Ctor(); } catch { return null; }
  }
  return ctx;
}

/** A short burst of white noise, made once and reused for every click. */
function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ac.sampleRate) return noise;
  const length = Math.ceil(ac.sampleRate * 0.12);
  const buf = ac.createBuffer(1, length, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noise = buf;
  return buf;
}

/**
 * One mechanical tap: noise through a bandpass, with an envelope fast enough
 * that the ear reads it as a click rather than a hiss. `exponentialRamp` to a
 * small value rather than to zero, which it is not allowed to reach.
 */
function tap(ac: AudioContext, at: number, level: number, hz: number, seconds: number) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);

  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = hz;
  band.Q.value = 0.9;

  // Takes the rumble off the bottom, so it reads as a shutter and not a thud
  // on a phone speaker that cannot reproduce it anyway.
  const cut = ac.createBiquadFilter();
  cut.type = 'highpass';
  cut.frequency.value = 900;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.0015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);

  src.connect(band).connect(cut).connect(gain).connect(ac.destination);
  src.start(at);
  src.stop(at + seconds + 0.02);
}

/**
 * Open the audio device while a tap is still being handled.
 *
 * Browsers only let audio start from a user gesture, and an automatic capture
 * is by definition not one — so without this the click would work when you
 * press the shutter and stay silent when the scanner fires by itself, which
 * is precisely when you most need telling. Called when the scanner opens, on
 * the tap that opened it.
 */
export function primeShutter(): void {
  try {
    const ac = audioContext();
    if (ac && ac.state === 'suspended') void ac.resume();
  } catch { /* audio is a nicety; never let it break the camera */ }
}

/** The click. Safe to call at any time; does nothing if it cannot. */
export function playShutter(): void {
  try {
    const ac = audioContext();
    if (!ac) return;
    if (ac.state === 'suspended') void ac.resume();
    const t = ac.currentTime + 0.001;
    // Open, then close: the second is quieter and a little duller, which is
    // what makes the pair sound like one mechanism rather than two noises.
    tap(ac, t, 0.22, 2600, 0.035);
    tap(ac, t + 0.055, 0.13, 1900, 0.045);
  } catch { /* ditto */ }
}

/** Let the audio device go when the scanner closes. */
export function releaseShutter(): void {
  try {
    if (ctx && ctx.state !== 'closed') void ctx.close();
  } catch { /* ignore */ }
  ctx = null;
  noise = null;
}
