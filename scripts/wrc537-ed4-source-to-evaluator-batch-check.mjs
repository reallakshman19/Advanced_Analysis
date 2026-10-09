import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateWrc537Ed4SourcePackage } from '../src/core/local-attachment-correlation/methods/wrc537/ed4-source-package.js';

const root = process.cwd();
const ed4 = path.join(root, 'docs', 'wrc537', 'ed4');
const sourcePackage = JSON.parse(fs.readFileSync(path.join(ed4, 'WRC537_ED4_SOURCE_PACKAGE.json'), 'utf8'));
const ledger = parseCsv(fs.readFileSync(path.join(ed4, 'WRC537_ED4_SOURCE_LEDGER.csv'), 'utf8'));
const coefficients = parseCsv(fs.readFileSync(path.join(ed4, 'WRC537_ED4_COEFFICIENTS.csv'), 'utf8'));
const readiness = evaluateWrc537Ed4SourcePackage({ sourcePackage, sourceLedgerRows: ledger, coefficientRows: coefficients });

assert.equal(readiness.state, 'BLOCKED');
assert.ok(readiness.failedGateIds.includes('PRIMARY_TECHNICAL_SOURCE'));
assert.ok(readiness.failedGateIds.includes('COEFFICIENTS_COMPLETE'));
assert.ok(readiness.failedGateIds.includes('BENCHMARKS_COMPLETE'));

for (const name of [
  'WRC537_ED4_ENGINEERING_DATASET.json',
  'WRC537_ED4_CALCULATION_PLAN.json',
  'WRC537_ED4_EXECUTABLE_PLAN.json',
  'WRC537_ED4_QUALIFICATION_SUITE.json',
  'WRC537_ED4_QUALIFICATION_EVIDENCE.json',
  'WRC537_ED4_BENCHMARK_BINDINGS.json',
  'WRC537_ED4_LITERAL_BINDINGS.json',
  'WRC537_ED4_NUMERICAL_RELEASE_CANDIDATE.json',
]) {
  assert.equal(fs.existsSync(path.join(ed4, name)), false, `${name} must remain absent while real Ed4 source package is blocked.`);
}

for (const file of [
  'src/core/local-attachment-correlation/methods/wrc537/ed4-execution-engine.js',
  'src/core/local-attachment-correlation/methods/wrc537/ed4-qualification-engine.js',
  'src/core/local-attachment-correlation/methods/wrc537/ed4-numerical-release-candidate.js',
]) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert.equal(/\beval\s*\(/u.test(source), false, `${file} must not use eval().`);
  assert.equal(/\bnew\s+Function\b/u.test(source), false, `${file} must not construct executable source text.`);
  assert.equal(source.includes('FORCE_OVER_D_T'), false, `${file} must not import the synthetic force basis.`);
  assert.equal(source.includes('MOMENT_OVER_D2_T'), false, `${file} must not import the synthetic moment basis.`);
  assert.equal(source.includes('BILINEAR_NO_EXTRAPOLATION'), false, `${file} must not hard-code the synthetic interpolation policy.`);
  assert.equal(source.includes('calculateLocalAttachmentCorrelation('), false, `${file} must not delegate WRC537 to the generic synthetic calculator.`);
  assert.equal(source.includes('engineeringUseAuthorized: true'), false, `${file} must not activate engineering authority.`);
}

console.log(JSON.stringify({
  check: 'wrc537-ed4-source-to-evaluator-batch-check',
  status: 'PASS',
  currentEngineeringState: 'BLOCKED_AS_DESIGNED',
  failedGateIds: readiness.failedGateIds,
  realEngineeringArtifactsAbsent: true,
  benchmarkBindingArtifactAbsent: true,
  literalBindingArtifactAbsent: true,
  numericalReleaseCandidateAbsent: true,
  textEvaluationAbsent: true,
  syntheticCorrelationAssumptionsAbsent: true,
  engineeringAuthorityActivationAbsent: true,
}));

function parseCsv(text) {
  const rows = parseCsvRows(text.replace(/^\uFEFF/u, ''));
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).filter((row) => row.some((value) => value !== '')).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}
function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/u, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field !== '' || row.length) { row.push(field.replace(/\r$/u, '')); rows.push(row); }
  return rows;
}
