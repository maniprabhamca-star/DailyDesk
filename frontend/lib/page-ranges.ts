// Parse "1-3, 5, 8-10" into ordered 1-based page numbers; throws a clear error
// on invalid input. Lives in lib/ so both UI components and the pdf-rewrite
// core (worker side) can use it. Re-exported by components/pdf/split-tool for
// the existing importers.
export function parseRanges(input: string, total: number): number[] {
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) throw new Error('Enter at least one page or range.');
  const out: number[] = [];
  for (const p of parts) {
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = +m[1];
      let b = +m[2];
      if (a < 1 || b < 1 || a > total || b > total) throw new Error(`Pages must be between 1 and ${total}.`);
      if (a > b) [a, b] = [b, a];
      for (let i = a; i <= b; i++) out.push(i);
    } else if (/^\d+$/.test(p)) {
      const n = +p;
      if (n < 1 || n > total) throw new Error(`Page ${n} is out of range (1–${total}).`);
      out.push(n);
    } else {
      throw new Error(`“${p}” isn’t a valid page or range.`);
    }
  }
  return out;
}
