import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  WRC537_ED4_PACKAGE_BLOCKED,
  WRC537_ED4_PACKAGE_READY,
  evaluateWrc537Ed4SourcePackage,
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-source-package.js';

const ROOT = process.cwd();
const releaseMode = process.argv.includes('--release');
const sourcePackage = readJson('docs/wrc537/ed4/WRC537_ED4_SOURCE_PACKAGE.json');
const sourceLedgerRows = parseCsv(readText('docs/wrc537/ed4/WRC537_ED4_SOURCE_LEDGER.csv'));
const coefficientRows = parseCsv(readText('docs/wrc537/ed4/WRC537_ED4_COEFFICIENTS.csv'), { allowHeaderOnly: true });

const result = evaluateWrc537Ed4SourcePackage({ sourcePackage, sourceLedgerRows, coefficientRows });
assert.equal(sourcePackage.expectedCurrentState, WRC537_ED4_PACKAGE_BLOCKED);
assert.equal(result.state, sourcePackage.expectedCurrentState,
  `Expected Ed4 source package state ${sourcePackage.expectedCurrentState}, received ${result.state}.`);

for (const expectedGate of [
  'PRIMARY_TECHNICAL_SOURCE',
  'GEOMETRY_COMPLETE',
  'PARAMETERS_COMPLETE',
  'LOAD_CONVENTIONS_COMPLETE',
  'STRESS_RECOVERY_COMPLETE',
  'INTERPOLATION_POLICY_COMPLETE',
  'COEFFICIENT_INVENTORY_DECLARED',
  'COEFFICIENTS_COMPLETE',
  'BENCHMARKS_COMPLETE',
  'LAFEA_MAPPING_COMPLETE',
  'NO_UNRESOLVED_TECHNICAL_FIELDS',
]) {
  assert.ok(result.failedGateIds.includes(expectedGate), `Expected blocking gate ${expectedGate}.`);
}

for (const expectedPass of ['PACKAGE_SCHEMA', 'EDITION_IDENTITY', 'CATALOG_IDENTITY_SOURCE']) {
  const gate = result.gates.find((row) => row.gateId === expectedPass);
  assert.equal(gate?.status, 'PASS', `Expected ${expectedPass} to pass on public identity metadata.`);
}

const report = {
  check: releaseMode ? 'wrc537-ed4-source-package-release' : 'wrc537-ed4-source-package',
  status: releaseMode && result.state !== WRC537_ED4_PACKAGE_READY ? 'BLOCKED' : 'PASS',
  packageState: result.state,
  failedGateIds: result.failedGateIds,
  statistics: result.statistics,
};
console.log(JSON.stringify(report, null, 2));

if (releaseMode && result.state !== WRC537_ED4_PACKAGE_READY) process.exitCode = 1;

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}
function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}
function parseCsv(text, options = {}) {
  const records = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field);
      field = '';
      if (row.some((value) => value.length > 0)) records.push(row);
      row = [];
    } else field += char;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((value) => value.length > 0)) records.push(row);
  }
  assert.ok(records.length >= 1, 'CSV must contain a header.');
  if (!options.allowHeaderOnly) assert.ok(records.length >= 2, 'CSV must contain at least one data row.');
  const headers = records[0].map((value) => value.trim());
  return records.slice(1).map((values, rowIndex) => {
    assert.equal(values.length, headers.length,
      `CSV row ${rowIndex + 2} has ${values.length} fields; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((header, index) => [header, values[index].trim()]));
  });
}
