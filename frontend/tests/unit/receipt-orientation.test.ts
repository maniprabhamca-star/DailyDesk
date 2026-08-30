import { describe, it, expect } from 'vitest';
import { isWide, initialRotation, looksSideways } from '@/lib/receipt-orientation';

// Guards the fix for the worst failure this tool has had: a sideways photo went
// to the reader unrotated and came back as an entirely different receipt, with
// totals consistent enough to pass the arithmetic check.
describe('receipt orientation', () => {
  it('treats a landscape photo as a receipt on its side', () => {
    expect(isWide(2000, 900)).toBe(true);
    expect(initialRotation(2000, 900)).toBe(90);
  });

  it('leaves an upright receipt alone', () => {
    expect(isWide(900, 2000)).toBe(false);
    expect(initialRotation(900, 2000)).toBe(0);
  });

  it('leaves a near-square crop alone rather than spinning it', () => {
    // 1.1 ratio is inside the slack; 1.2 is outside it.
    expect(isWide(1100, 1000)).toBe(false);
    expect(isWide(1200, 1000)).toBe(true);
  });

  it('warns only while the receipt still reads sideways on screen', () => {
    expect(looksSideways(2000, 900, 0)).toBe(true);    // landscape, untouched
    expect(looksSideways(2000, 900, 90)).toBe(false);  // landscape, turned up
    expect(looksSideways(2000, 900, 270)).toBe(false);
    expect(looksSideways(900, 2000, 0)).toBe(false);   // portrait, untouched
    expect(looksSideways(900, 2000, 90)).toBe(true);   // portrait, turned onto its side
  });

  it('does not divide by zero on a broken image', () => {
    expect(isWide(0, 0)).toBe(false);
    expect(initialRotation(0, 0)).toBe(0);
  });
});
