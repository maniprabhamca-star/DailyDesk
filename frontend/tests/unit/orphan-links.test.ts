import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// ───────────────────────────────────────────────────────────────────────────
// The pages nothing linked to.
// ───────────────────────────────────────────────────────────────────────────
//
// An internal-link audit on 2026-11-25 (crawl every sitemap URL on the built
// site, strip header/footer/nav, count inbound links per URL) found 79 pages
// with no editorial inbound link at all. This file pins the last repairs so a
// tidy-up cannot quietly re-orphan them.
//
// ⚠ The trap this file exists to catch: PdfToolPage wraps `children` in
// ToolGate, and NOT `afterTool`. A link placed in `children` on a gated tool
// renders for nobody — the public page says "Coming soon" and emits zero
// anchors. The bank hub's index was written as a child first, and the audit
// still reported all 39 bank pages at zero afterwards. So it is not enough to
// assert the href is in the file; it has to be in the half that renders.

/** Is `href` inside the `afterTool` prop — i.e. outside ToolGate? */
function insideAfterTool(src: string, href: string): boolean {
  const open = src.indexOf('afterTool={');
  if (open < 0) return false;
  // The prop closes on the line that also opens `children`: `      }\n    >`.
  const close = src.indexOf('\n      }\n    >', open);
  if (close < 0) return false;
  const at = src.indexOf(`href="${href}"`);
  return at > open && at < close;
}

// Only pages whose tool is `coming_soon` in lib/tool-flags.tsx are gated, but
// every one of these uses afterTool anyway: a link that renders regardless of
// the gate survives the tool later being gated for a launch.
const GATED_SAFE: [string, string[]][] = [
  ['app/compress-to-size/page.tsx', ['/compress-pdf-to-100kb']],
  ['app/compress-image/page.tsx', ['/remove-exif', '/blur-image']],
  ['app/qr-code-generator/page.tsx', ['/wifi-qr-code', '/vcard-qr-code']],
];

// /passport-photo is not gated and its country index is a child, so the
// DS-160 link sits beside it rather than in afterTool.
const PLAIN: [string, string[]][] = [
  ['app/passport-photo/page.tsx', ['/us-visa-photo']],
  ['app/bank-statement-converter/[bank]/page.tsx', [
    '/bank-statement-to-tally',
    '/bank-statement-to-quickbooks',
    '/bank-statement-to-csv',
  ]],
];

describe('orphan repairs — the link is on the page', () => {
  for (const [file, hrefs] of [...GATED_SAFE, ...PLAIN]) {
    for (const href of hrefs) {
      it(`${file} links ${href}`, () => {
        const src = readFileSync(file, 'utf8');
        expect(src, `${href} is gone from ${file}`).toContain(`href="${href}"`);
      });
    }
  }
});

describe('orphan repairs — and it renders outside the gate', () => {
  for (const [file, hrefs] of GATED_SAFE) {
    for (const href of hrefs) {
      it(`${href} is in afterTool, not children`, () => {
        expect(insideAfterTool(readFileSync(file, 'utf8'), href)).toBe(true);
      });
    }
  }

  it('⚠ proof the check bites: a link written as a child fails it', () => {
    // Without this, insideAfterTool could return true for everything — which
    // is exactly the shape of bug that let the bank hub ship rendering to
    // nobody while every assertion about it passed.
    const asChild = [
      '    <PdfToolPage',
      '      steps={steps}',
      '      faqs={faqs}',
      '      afterTool={',
      '        <SpecificCase>nothing here</SpecificCase>',
      '      }',
      '    >',
      '      <Tool />',
      '      <Link href="/remove-exif">Remove EXIF</Link>',
      '    </PdfToolPage>',
    ].join('\n');
    expect(insideAfterTool(asChild, '/remove-exif')).toBe(false);

    const noProp = '    <PdfToolPage>\n      <Link href="/remove-exif" />\n    </PdfToolPage>';
    expect(insideAfterTool(noProp, '/remove-exif')).toBe(false);
  });
});

describe('the three export-format pages have an INDEXED carrier', () => {
  it('⚠ not the hub — it is noindex and out of the sitemap', () => {
    // The hub lists them, but /bank-statement-converter is
    // `robots: { index: false }` while the tool is gated, and the sitemap
    // leaves it out. Links from it pass nothing, which is why the audit still
    // showed these three at zero after the hub index shipped. The 39 bank
    // pages are indexed; they are the carrier.
    const hub = readFileSync('app/bank-statement-converter/page.tsx', 'utf8');
    expect(hub, 'the hub is noindex — if that changed, revisit this').toContain('index: false');

    const tmpl = readFileSync('app/bank-statement-converter/[bank]/page.tsx', 'utf8');
    expect(tmpl).not.toContain('index: false');
    for (const href of ['/bank-statement-to-tally', '/bank-statement-to-quickbooks', '/bank-statement-to-csv']) {
      expect(tmpl, `${href} has no indexed page linking it`).toContain(`href="${href}"`);
    }
  });
});
