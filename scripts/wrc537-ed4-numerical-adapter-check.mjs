import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateWrc537Ed4SourcePackage, WRC537_ED4_PACKAGE_BLOCKED } from '../src/core/local-attachment-correlation/methods/wrc537/ed4-source-package.js';

const root = resolve(import.meta.dirname, '..');
const sourcePackagePath = resolve(root, 'docs/wrc537/ed4/WRC537_ED4_SOURCE_PACKAGE.json');
const sourceLedgerPath = resolve(root, 'docs/wrc537/ed4/WRC537_ED4_SOURCE_LEDGER.csv');
const coefficientPath = resolve(root, 'docs/wrc537/ed4/WRC537_ED4_COEFFICIENTS.csv');
const engineeringDatasetPath = resolve(root, 'docs/wrc537/ed4/WRC537_ED4_ENGINEERING_DATASET.json');
const calculationPlanPath = resolve(root, 'docs/wrc537/ed4/WRC537_ED4_CALCULATION_PLAN.json');
const qualificationTracePath = resolve(root, 'docs/wrc537/ed4/WRC537_ED4_QUALIFICATION_TRACE.json');
const adapterPath = resolve(root, 'src/core/local-attachment-correlation/methods/wrc537/ed4-numerical-adapter.js');

const sourcePackage = JSON.parse(readFileSync(sourcePackagePath, 'utf8'));
const sourceLedgerRows = parseCsv(readFileSync(sourceLedgerPath, 'utf8'));
const coefficientRows = parseCsv(readFileSync(coefficientPath, 'utf8'));
const readiness = evaluateWrc537Ed4SourcePackage({ sourcePackage, sourceLedgerRows, coefficientRows });

assert.equal(readiness.state, WRC537_ED4_PACKAGE_BLOCKED,
  'Current real WRC537 Ed4 source package must remain BLOCKED until authorized technical data are filled.');
assert.equal(existsSync(engineeringDatasetPath), false,
  'A real Ed4 engineering dataset must not exist while source package is blocked.');
assert.equal(existsSync(calculationPlanPath), false,
  'A real Ed4 calculation plan must not exist before a source-qualified dataset exists.');
assert.equal(existsSync(qualificationTracePath), false,
  'A real Ed4 qualification trace must not exist before the calculation plan exists.');

const adapterText = readFileSync(adapterPath, 'utf8');
const forbiddenGenericAssumptions = [
  'FORCE_OVER_D_T',
  'MOMENT_OVER_D2_T',
  'BILINEAR_NO_EXTRAPOLATION',
  'calculateLocalAttachmentCorrelation(',
  'engineeringUseAuthorized: true',
];
for (const token of forbiddenGenericAssumptions) {
  assert.equal(adapterText.includes(token), false,
    `WRC537 numerical adapter boundary must not embed generic correlation assumption: ${token}`);
}
assert.ok(adapterText.includes('WRC537_ED4_NUMERICAL_METHOD_NOT_QUALIFIED'),
  'Engineering execution must remain explicitly fail-closed.');

console.log(JSON.stringify({
  check: 'wrc537-ed4-numerical-adapter-current-state',
  status: 'PASS',
  currentSourcePackageState: readiness.state,
  sourceFailedGateIds: readiness.failedGateIds,
  engineeringDatasetAbsent: true,
  calculationPlanAbsent: true,
  qualificationTraceAbsent: true,
  genericSyntheticCorrelationBasisNotImported: true,
  engineeringExecutionFailClosed: true,
}));

function parseCsv(text) {
  const lines = text.trimEnd().split(/\r?\n/u);
  if (lines.length <= 1) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter((line) => line.trim()).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}
function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { current += '"'; i += 1; } else { quoted = !quoted; }
    } else if (char === ',' && !quoted) {
      values.push(current); current = '';
    } else current += char;
  }
  values.push(current);
  return values;
}
