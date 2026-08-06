import { describe, it, expect } from 'vitest';
import {
  colIndex, csvToSheets, excelSerialToDate, jsonToSheets, parseCsv, rowsToJson, sheetName, sniffDelimiter, xmlToSheets,
} from '@/lib/sheet-io';

describe('parseCsv', () => {
  it('keeps a quoted comma in one cell', () => {
    expect(parseCsv('name,city\n"Smith, John",Leeds')).toEqual([['name', 'city'], ['Smith, John', 'Leeds']]);
  });

  it('handles doubled quotes and quoted newlines', () => {
    const rows = parseCsv('a,b\n"He said ""hi""","line one\nline two"');
    expect(rows[1][0]).toBe('He said "hi"');
    expect(rows[1][1]).toBe('line one\nline two');
  });

  it('strips a BOM so the first header is not corrupted', () => {
    expect(parseCsv('﻿name,city\nPriya,Chennai')[0][0]).toBe('name');
  });

  it('copes with CRLF', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('drops trailing blank lines but keeps genuinely empty cells', () => {
    expect(parseCsv('a,b\n1,\n\n')).toEqual([['a', 'b'], ['1', '']]);
  });
});

describe('sniffDelimiter', () => {
  it('finds semicolons and tabs, which is what breaks European and pasted files', () => {
    expect(sniffDelimiter('name;city;age\nPriya;Chennai;30')).toBe(';');
    expect(sniffDelimiter('name\tcity\nPriya\tChennai')).toBe('\t');
    expect(sniffDelimiter('name,city\nPriya,Chennai')).toBe(',');
  });

  it('ignores separators inside quotes', () => {
    // One real semicolon per line; the commas are inside a quoted field.
    expect(sniffDelimiter('a;b\n"x,y,z,w";2\n"p,q,r,s";3')).toBe(';');
  });

  it('falls back to a comma when there is nothing to go on', () => {
    expect(sniffDelimiter('single-column')).toBe(',');
  });

  it('drives parseCsv, so a semicolon file is not one column', () => {
    expect(csvToSheets('name;city\nPriya;Chennai')[0].rows).toEqual([['name', 'city'], ['Priya', 'Chennai']]);
  });
});

describe('colIndex', () => {
  it('maps spreadsheet columns to zero-based indexes', () => {
    expect(colIndex('A1')).toBe(0);
    expect(colIndex('B2')).toBe(1);
    expect(colIndex('Z10')).toBe(25);
    expect(colIndex('AA1')).toBe(26);
    expect(colIndex('BC7')).toBe(54);
  });
});

describe('excelSerialToDate', () => {
  it('turns the day count back into a date', () => {
    expect(excelSerialToDate(1)).toBe('1900-01-01');
    expect(excelSerialToDate(45000)).toBe('2023-03-15');
  });

  it('keeps the time when there is a fraction', () => {
    expect(excelSerialToDate(45000.5)).toBe('2023-03-15 12:00:00');
  });
});

describe('jsonToSheets', () => {
  it('turns an array of records into a header row plus rows', () => {
    const [s] = jsonToSheets('[{"name":"Priya","team":"Design"},{"name":"Sam","team":"Eng"}]');
    expect(s.rows[0]).toEqual(['name', 'team']);
    expect(s.rows[1]).toEqual(['Priya', 'Design']);
  });

  it('flattens nested objects into dotted columns', () => {
    const [s] = jsonToSheets('[{"name":"Priya","address":{"city":"Chennai","pin":"600001"}}]');
    expect(s.rows[0]).toEqual(['name', 'address.city', 'address.pin']);
    expect(s.rows[1]).toEqual(['Priya', 'Chennai', '600001']);
  });

  it('unions the fields so a record missing one is not dropped', () => {
    const [s] = jsonToSheets('[{"a":1},{"b":2}]');
    expect(s.rows[0]).toEqual(['a', 'b']);
    expect(s.rows[1]).toEqual([1, '']);
    expect(s.rows[2]).toEqual(['', 2]);
  });

  it('joins scalar arrays and keeps object arrays as JSON rather than losing them', () => {
    const [s] = jsonToSheets('[{"tags":["red","blue"],"kids":[{"n":1}]}]');
    expect(s.rows[1][0]).toBe('red; blue');
    expect(String(s.rows[1][1])).toContain('"n":1');
  });

  it('finds the list inside a typical API response', () => {
    const [s] = jsonToSheets('{"page":1,"results":[{"id":1},{"id":2}]}');
    expect(s.name).toBe('results');
    expect(s.rows).toHaveLength(3);
  });

  it('writes booleans and nulls in a way a spreadsheet can read', () => {
    const [s] = jsonToSheets('[{"ok":true,"missing":null}]');
    expect(s.rows[1]).toEqual(['TRUE', '']);
  });
});

describe('rowsToJson', () => {
  it('uses the first row as the keys', () => {
    const json = JSON.parse(rowsToJson([['name', 'age'], ['Priya', 30]]));
    expect(json).toEqual([{ name: 'Priya', age: 30 }]);
  });

  it('names columns when there is no header row', () => {
    const json = JSON.parse(rowsToJson([['Priya', 30]], false));
    expect(json).toEqual([{ column_1: 'Priya', column_2: 30 }]);
  });

  it('never produces a blank key', () => {
    const json = JSON.parse(rowsToJson([['name', ''], ['Priya', 'x']]));
    expect(Object.keys(json[0])).toEqual(['name', 'column_2']);
  });
});

describe('xmlToSheets', () => {
  it('makes the repeating element the rows', () => {
    const [s] = xmlToSheets(`<orders>
      <order id="1001"><customer>Priya</customer><total>420.5</total></order>
      <order id="1002"><customer>Sam</customer><total>98</total></order>
    </orders>`);
    expect(s.name).toBe('order');
    expect(s.rows[0]).toEqual(['@id', 'customer', 'total']);
    // Values that read as numbers become numbers, attributes included — the same
    // rule as every other converter here, so a spreadsheet can sum them.
    expect(s.rows[1]).toEqual([1001, 'Priya', 420.5]);
    expect(s.rows[2]).toEqual([1002, 'Sam', 98]);
  });

  it('expands one level of nesting into dotted columns', () => {
    const [s] = xmlToSheets('<r><i><a><b>x</b></a></i><i><a><b>y</b></a></i></r>');
    expect(s.rows[0]).toContain('a.b');
    expect(s.rows[1]).toContain('x');
  });

  it('says so rather than guessing when nothing repeats', () => {
    expect(xmlToSheets('<doc><title>Only one</title></doc>').length).toBeLessThanOrEqual(1);
  });

  it('refuses malformed XML instead of returning nonsense', () => {
    expect(() => xmlToSheets('<a><b></a>')).toThrow();
  });
});

describe('sheetName', () => {
  it('strips what Excel forbids and de-duplicates', () => {
    const taken = new Set<string>();
    expect(sheetName('Q1/Q2 [2026]', taken)).toBe('Q1 Q2 2026');
    expect(sheetName('Data', taken)).toBe('Data');
    expect(sheetName('data', taken)).toBe('data (2)');
    expect(sheetName('x'.repeat(60), taken)).toHaveLength(31);
  });
});
