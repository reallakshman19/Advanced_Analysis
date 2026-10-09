import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { canonicalPrettyStringify } from '../src/core/shared-primitives/canonical-json.js';
import {
  WRC537_ED4_PROMOTION_SCHEMA,
  createWrc537Ed4EngineeringDatasetCandidate,
  validateWrc537Ed4EngineeringDatasetCandidate,
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-engineering-dataset.js';

const ROOT = process.cwd();
const args = parseArgs(process.argv.slice(2));
const sourcePackage = readJson('docs/wrc537/ed4/WRC537_ED4_SOURCE_PACKAGE.json');
const sourceLedgerRows = parseCsv(readText('docs/wrc537/ed4/WRC537_ED4_SOURCE_LEDGER.csv'));
const coefficientRows = parseCsv(readText('docs/wrc537/ed4/WRC537_ED4_COEFFICIENTS.csv'), { allowHeaderOnly: true });
const promotion = {
  schema: WRC537_ED4_PROMOTION_SCHEMA,
  candidateIdentity: requiredArg(args, 'candidate-id'),
  candidateVersion: requiredArg(args, 'candidate-version'),
  preparedBy: requiredArg(args, 'prepared-by'),
  preparationReference: requiredArg(args, 'preparation-reference'),
};

const candidate = createWrc537Ed4EngineeringDatasetCandidate({
  sourcePackage,
  sourceLedgerRows,
  coefficientRows,
  promotion,
});
const verified = validateWrc537Ed4EngineeringDatasetCandidate(candidate);
assert.equal(verified.datasetSemanticHash, candidate.datasetSemanticHash);

const output = args.out ?? 'docs/wrc537/ed4/WRC537_ED4_ENGINEERING_DATASET.json';
const absoluteOutput = path.resolve(ROOT, output);
if (!args.write) {
  console.log(canonicalPrettyStringify(candidate));
  console.error(JSON.stringify({
    status: 'READY_NOT_WRITTEN',
    datasetSemanticHash: candidate.datasetSemanticHash,
    output: absoluteOutput,
    instruction: 'Re-run with --write to materialize the verified candidate.',
  }, null, 2));
} else {
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  fs.writeFileSync(absoluteOutput, canonicalPrettyStringify(candidate), 'utf8');
  const reread = validateWrc537Ed4EngineeringDatasetCandidate(JSON.parse(fs.readFileSync(absoluteOutput, 'utf8')));
  assert.equal(reread.datasetSemanticHash, candidate.datasetSemanticHash,
    'Materialized WRC537 Ed4 dataset must round-trip with identical semantic hash.');
  console.log(JSON.stringify({
    status: 'WRITTEN_AND_ROUND_TRIP_VERIFIED',
    datasetSemanticHash: candidate.datasetSemanticHash,
    output: absoluteOutput,
  }, null, 2));
}

function parseArgs(argv) {
  const result = { write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--write') {
      result.write = true;
      continue;
    }
    if (!token.startsWith('--')) throw new Error(`Unexpected argument ${token}.`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Argument --${key} requires a value.`);
    result[key] = value;
    index += 1;
  }
  return result;
}
function requiredArg(argsObject, key) {
  const value = argsObject[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing required --${key}.`);
  return value.trim();
}
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
