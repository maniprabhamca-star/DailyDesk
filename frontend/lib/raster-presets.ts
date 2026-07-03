// Presets for Flatten PDF's "lock pages as images" mode. Kept dependency-free
// so the tool page can render the chips without pulling in pdf-lib/pdf.js —
// the heavy engine (lib/pdf-rasterize.ts) loads only when the user runs it.
export type RasterPreset = 'compact' | 'balanced' | 'sharp';

// DPI + mozjpeg quality per preset. 150 DPI is the "general sharing" sweet spot
// (matches what our PDF-to-JPG presets proved: embedded scans are ~200 PPI
// native, so >220 buys nothing). q90 keeps 4:4:4 colour for the sharp preset.
export const RASTER_PRESETS: Record<RasterPreset, { dpi: number; quality: number; label: string; hint: string }> = {
  compact: { dpi: 100, quality: 82, label: 'Compact', hint: 'Smallest file — fine for on-screen reading' },
  balanced: { dpi: 150, quality: 82, label: 'Balanced', hint: 'Sharp for sharing and everyday printing' },
  sharp: { dpi: 220, quality: 90, label: 'Sharp', hint: 'Highest detail — best for fine print' },
};
