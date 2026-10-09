import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  WRC537_ED4_PROMOTION_SCHEMA,
  createWrc537Ed4EngineeringDatasetCandidate,
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-engineering-dataset.js';

const ROOT = process.cwd();
const sourcePackage = readJson('docs/wrc537/ed4/WRC537_ED4_SOURCE_PACKAGE.json');
const sourceLedgerRows = parseCsv(readText('docs/wrc537/ed4/WRC537_ED4_SOURCE_LEDGER.csv'));
const coefficientRows = parseCsv(readText('docs/wrc537/ed4/WRC537_ED4_COEFFICIENTS.csv'), { allowHeaderOnly: true });
const promotion = {
  schema: WRC537_ED4_PROMOTION_SCHEMA,
  candidateIdentity: 'WRC537-ED4-CURRENT-SOURCE-PACKAGE',
  candidateVersion: 'CURRENT',
  preparedBy: 'REPOSITORY_STATE_CHECK',
  preparationReference: 'scripts/wrc537-ed4-engineering-dataset-check.mjs',
};

let blockedError = null;
try {
  createWrc537Ed4EngineeringDatasetCandidate({ sourcePackage, sourceLedgerRows, coefficientRows, promotion });
} catch (error) {
  blockedError = error;
}

assert.ok(blockedError, 'Current incomplete WRC537 Ed4 source package must not promote.');
assert.equal(blockedError.code, 'WRC537_ED4_SOURCE_PACKAGE_NOT_READY');
const failed = blockedError.failedGateIds ?? [];
for (const gateId of [
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
]) {
  assert.ok(failed.includes(gateId), `Current package must remain blocked by ${gateId}.`);
}
assert.equal(coefficientRows.length, 0,
  'Edition 4 coefficient intake must remain header-only until primary technical extraction begins.');
assert.equal(fs.existsSync(path.join(ROOT, 'docs/wrc537/ed4/WRC537_ED4_ENGINEERING_DATASET.json')), false,
  'A blocked source package must not have a committed engineering dataset artifact.');

console.log(JSON.stringify({
  check: 'wrc537-ed4-engineering-dataset-state',
  status: 'PASS',
  promotionState: 'BLOCKED_AS_REQUIRED',
  failedGateIds: failed,
  coefficientRows: coefficientRows.length,
  engineeringDatasetArtifactPresent: false,
}, null, 2));

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
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field);
      field = '';
      if (row.some((value) => value.length > 0)) records.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((value) => value.length > 0)) records.push(row);
  }
  assert.ok(records.length >= 1, 'CSV must contain a header.');
  const headers = records[0].map((value) => value.trim());
  if (!options.allowHeaderOnly) assert.ok(records.length >= 2, 'CSV must contain at least one data row.');
  return records.slice(1).map((values, rowIndex) => {
    assert.equal(values.length, headers.length,
      `CSV row ${rowIndex + 2} has ${values.length} fields; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((header, index) => [header, values[index].trim()]));
  });
}
