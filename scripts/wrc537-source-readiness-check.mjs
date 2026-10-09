import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  WRC537_READY_STATE,
  evaluateWrc537SourceReadiness,
  normalizeWrc537CoefficientRow,
} from '../src/core/local-attachment-correlation/methods/wrc537/source-readiness.js';

const ROOT = process.cwd();
const releaseMode = process.argv.includes('--release');
const manifest = readJson('docs/WRC537_SOURCE_READINESS_MANIFEST.json');
const dataset = readJson('docs/03_WRC537_DATASET.json');
const coefficientRows = parseCsv(readText('docs/04_WRC537_NUMERICAL_TABLES.csv'));

assert.equal(manifest.schema, 'wrc537-source-readiness-manifest/v1');
assert.equal(dataset.schema, 'wrc537-source-extraction/v1');
assert.ok(coefficientRows.length > 0, 'WRC537 coefficient inventory must not be empty.');

const result = evaluateWrc537SourceReadiness({ manifest, dataset, coefficientRows });
const normalizedRows = coefficientRows.map((row) =>
  normalizeWrc537CoefficientRow(row, manifest.targetEdition));
const expectedBlocking = manifest.expectedBlockingGates ?? [];

assert.equal(result.state, manifest.expectedCurrentState,
  `Expected WRC537 readiness ${manifest.expectedCurrentState}, received ${result.state}.`);
for (const gateId of expectedBlocking) {
  assert.ok(result.failedGateIds.includes(gateId), `Expected blocking gate ${gateId}.`);
}

const rawExtractedUnresolved = normalizedRows.filter((row) =>
  row.review_status === 'EXTRACTED'
  && row.normalizedValueState === 'STRUCTURE_ONLY_VALUE_UNRESOLVED');
assert.ok(rawExtractedUnresolved.length > 0,
  'PR #1203 normalization guard expects unresolved coefficient rows marked EXTRACTED.');
assert.ok(rawExtractedUnresolved.every((row) => row.normalizedEngineeringState === 'RESEARCH_ONLY'));
assert.ok(normalizedRows.every((row) =>
  row.normalizedEngineeringState !== 'ENGINEERING_DATA_CANDIDATE'
  || (row.normalizedValueState === 'NUMERIC_VALUE_PRESENT'
    && row.normalizedPrecisionState === 'SOURCE_PRECISION_PRESENT'
    && row.normalizedAuthorityState === 'TARGET_EDITION_PRIMARY_SOURCE_VERIFIED')),
'No coefficient may become an engineering-data candidate without target-edition value, precision, and primary verification.');

const report = {
  check: releaseMode ? 'wrc537-source-release-readiness' : 'wrc537-source-readiness',
  status: releaseMode && result.state !== WRC537_READY_STATE ? 'BLOCKED' : 'PASS',
  readinessState: result.state,
  targetEdition: result.targetEdition,
  failedGateIds: result.failedGateIds,
  statistics: result.statistics,
  normalization: {
    rawCoefficientRowsMarkedExtractedButValueUnresolved: rawExtractedUnresolved.length,
    engineeringDataCandidateRows: normalizedRows.filter((row) =>
      row.normalizedEngineeringState === 'ENGINEERING_DATA_CANDIDATE').length,
    researchOnlyRows: normalizedRows.filter((row) =>
      row.normalizedEngineeringState === 'RESEARCH_ONLY').length,
  },
};
console.log(JSON.stringify(report, null, 2));

if (releaseMode && result.state !== WRC537_READY_STATE) {
  process.exitCode = 1;
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}
function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}
function parseCsv(text) {
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
  assert.ok(records.length >= 2, 'CSV must contain a header and at least one data row.');
  const headers = records[0].map((value) => value.trim());
  return records.slice(1).map((values, rowIndex) => {
    assert.equal(values.length, headers.length,
      `CSV row ${rowIndex + 2} has ${values.length} fields; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((header, index) => [header, values[index].trim()]));
  });
}
