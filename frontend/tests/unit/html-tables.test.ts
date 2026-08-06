import { describe, it, expect } from 'vitest';
import { tablesFromHtml, sheetName } from '@/lib/html-tables';

const page = (body: string) => `<!doctype html><html><body>${body}</body></html>`;

describe('tablesFromHtml', () => {
  it('reads a plain table, header row included', () => {
    const [t] = tablesFromHtml(page(`
      <table><thead><tr><th>City</th><th>Population</th></tr></thead>
      <tbody><tr><td>Chennai</td><td>7088000</td></tr><tr><td>Madurai</td><td>1017865</td></tr></tbody></table>`));
    expect(t.rows).toEqual([['City', 'Population'], ['Chennai', 7088000], ['Madurai', 1017865]]);
    expect(t.cols).toBe(2);
  });

  it('keeps columns aligned under a rowspan — the thing copy-paste gets wrong', () => {
    const [t] = tablesFromHtml(page(`
      <table>
        <tr><td rowspan="2">Asia</td><td>India</td><td>1400</td></tr>
        <tr><td>Japan</td><td>124</td></tr>
        <tr><td>Europe</td><td>France</td><td>68</td></tr>
      </table>`));
    // Without rowspan handling the second row would read ['Japan', 124, ''].
    expect(t.rows[1]).toEqual(['Asia', 'Japan', 124]);
    expect(t.rows[2]).toEqual(['Europe', 'France', 68]);
    expect(t.cols).toBe(3);
  });

  it('spreads a colspan across the columns it covers', () => {
    const [t] = tablesFromHtml(page(`
      <table>
        <tr><td colspan="2">Q1 total</td><td>500</td></tr>
        <tr><td>Jan</td><td>Feb</td><td>200</td></tr>
      </table>`));
    expect(t.rows[0]).toEqual(['Q1 total', 'Q1 total', 500]);
    expect(t.rows[1]).toEqual(['Jan', 'Feb', 200]);
  });

  it('names a table from its caption, then from the heading above it', () => {
    const [a] = tablesFromHtml(page('<table><caption>Rainfall 2026</caption><tr><td>a</td><td>1</td></tr><tr><td>b</td><td>2</td></tr></table>'));
    expect(a.name).toBe('Rainfall 2026');
    const [b] = tablesFromHtml(page('<h2>Quarterly results</h2><table><tr><td>a</td><td>1</td></tr><tr><td>b</td><td>2</td></tr></table>'));
    expect(b.name).toBe('Quarterly results');
  });

  it('finds every table on the page', () => {
    const one = '<table><tr><td>a</td><td>1</td></tr><tr><td>b</td><td>2</td></tr></table>';
    expect(tablesFromHtml(page(one + one + one))).toHaveLength(3);
  });

  it('ignores layout shells and keeps the data table inside', () => {
    const found = tablesFromHtml(page(`
      <table><tr><td>
        <table><tr><td>Item</td><td>Cost</td></tr><tr><td>Pen</td><td>3</td></tr></table>
      </td></tr></table>`));
    expect(found).toHaveLength(1);
    expect(found[0].rows[0]).toEqual(['Item', 'Cost']);
  });

  it('skips one-column and near-empty tables', () => {
    expect(tablesFromHtml(page('<table><tr><td>only</td></tr><tr><td>column</td></tr></table>'))).toHaveLength(0);
    expect(tablesFromHtml(page('<table><tr><td>a</td><td>b</td></tr></table>'))).toHaveLength(0);
  });

  it('never lets script or style text land in a cell', () => {
    const [t] = tablesFromHtml(page(`
      <table><tr><td>Name<script>alert(1)</script></td><td>Value</td></tr>
      <tr><td>x<style>.a{color:red}</style></td><td>2</td></tr></table>`));
    const flat = t.rows.flat().join(' ');
    expect(flat).not.toContain('alert');
    expect(flat).not.toContain('color:red');
    expect(t.rows[0][0]).toBe('Name');
  });

  it('collapses the whitespace real pages are full of', () => {
    const [t] = tablesFromHtml(page('<table><tr><td>\n   Total\n  due  </td><td>10</td></tr><tr><td>b</td><td>2</td></tr></table>'));
    expect(t.rows[0][0]).toBe('Total due');
  });

  it('returns nothing when the page has no tables', () => {
    expect(tablesFromHtml(page('<div class="table"><div>looks like a table</div></div>'))).toEqual([]);
  });
});

describe('sheetName', () => {
  it('strips the characters Excel forbids and trims to 31', () => {
    const taken = new Set<string>();
    expect(sheetName('Sales [2026]: Q1/Q2*', taken)).toBe('Sales 2026 Q1 Q2');
    expect(sheetName('x'.repeat(50), taken)).toHaveLength(31);
  });

  it('never repeats a name', () => {
    const taken = new Set<string>();
    expect(sheetName('Results', taken)).toBe('Results');
    expect(sheetName('Results', taken)).toBe('Results (2)');
    expect(sheetName('results', taken)).toBe('results (3)');
  });

  it('falls back when the name is empty', () => {
    expect(sheetName('', new Set())).toBe('Table');
  });
});
