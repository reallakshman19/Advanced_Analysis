import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';
import { parseMasterFile, parseThreeRowLineList } from '../src/workspace/master-data-events-handler.js';

const file = 'AML-91-PDFEED-PX-2345-00001-0000 BC4.xlsx';
const bytes = readFileSync(new URL(`../public/fixtures/${file}`, import.meta.url));
const original = XLSX.read(bytes, { type: 'buffer' });
const sheet = original.Sheets.LineList;
const before = JSON.stringify(sheet);
const parsed = await parseMasterFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), file, 'lineList');
assert.equal(parsed.sourceMetadata.sourceHash, createHash('sha256').update(bytes).digest('hex'));
const expected = { S8810101: 313, S8810103: 318, S8811951: 319, S8810111: 325, S8810112: 326 };
for (const [line, rowNumber] of Object.entries(expected)) {
  const matches = parsed.rawRows.filter(row => Object.values(row).includes(line));
  assert.equal(matches.length, 1, line);
  const row = matches[0]; assert.equal(row._sourceRowNumber, rowNumber, line); assert.equal(row._sourceSheet, 'LineList');
  assert.equal(Number(row['AT WORKING CONDITIONS | Temp. ºC']), 309);
  assert.equal(Number(row['DESIGN CONDITIONS | Temp Max ºC']), 325);
  // Address belongs to the actual worksheet, independent of reader's indexed array.
  const cells = Object.entries(sheet).filter(([address]) => !address.startsWith('!') && XLSX.utils.decode_cell(address).r === rowNumber - 1);
  assert.ok(cells.some(([, cell]) => cell.v === line));
}
assert.equal(JSON.stringify(sheet), before);
const shifted = XLSX.utils.aoa_to_sheet([
  ['Line number', 'AT WORKING CONDITIONS'], ['', 'Temp. ºC'], ['', ''], ['S1', 0], [], ['S2', -5],
], { origin: 'A10' });
const rows = parseThreeRowLineList(shifted, 'Shifted');
assert.deepEqual(rows.map(row => row._sourceRowNumber), [13, 15]);
assert.equal(rows[0]['AT WORKING CONDITIONS | Temp. ºC'], '0');
assert.equal(rows[1]['AT WORKING CONDITIONS | Temp. ºC'], '-5');
console.log('PASS line-list provenance: actual hashed workbook, all five exact Excel rows, operating/design cell values, shifted used range, blank-row retention, zero/negative temperatures and worksheet immutability.');
