#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_AUTHORIZED,
  EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_QUALIFICATION_SHA256,
  EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_SUSPENSION_REASONS,
} from '../src/core/emp1/emp1-wrc537-gamma5-zero-dp-route.js';
import {
  EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID,
  emp1CBoundedRoute,
} from '../src/core/emp1/emp1-c-bounded-route-registry.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const options = parseArgs(process.argv.slice(2));
if (!options.recordPath) throw gateError('EMP1_CURRENT_REOBSERVATION_RECORD_REQUIRED');
const [record, qualification, oracle] = await Promise.all([
  readJson(options.recordPath),
  readJson('validation/emp1/wrc537-2013/gamma5-zero-dp-route-qualification-v2.json'),
  readJson('validation/emp1/wrc537-2013/gamma5-post-authority-physical-oracle-v1.json'),
]);
assert.equal(record.schema, 'emp1-wrc537-gamma5-current-authority-exact-head-reobservation/v2');
assert.equal(record.status,
  'PASS_CURRENT_AUTHORITY_EXACT_HEAD_REOBSERVATION_STANDARD_01_TO_12_STILL_NOT_RUN');
assert.match(record.observedHeadSha, /^[0-9a-f]{40}$/u);
if (options.expectedObservedHead) assert.equal(record.observedHeadSha, options.expectedObservedHead,
  'EMP1_CURRENT_REOBSERVATION_HEAD_MISMATCH');
assertCommitExists(record.observedHeadSha);
const { observationSemanticHash, status, ...payload } = record;
assert.equal(sha256Canonical(payload), observationSemanticHash,
  'EMP1_CURRENT_REOBSERVATION_SEMANTIC_HASH_DRIFT');

assert.equal(record.qualificationRecordSha256, qualification.qualificationRecordSha256);
assert.equal(record.qualificationRecordSha256,
  '9ea591a1918175b3e415d77f1adc4398645ca0503a699cfe8139d9dd3c69b4c7');
assert.equal(record.oracleSemanticHash, oracle.semanticHash);
assert.equal(record.oracleSemanticHash,
  '60771128f8261057bf73fa6c183ace5df25f3ee98f417f58da25a6135d8b2e18');
assert.equal(record.sourceDocumentSha256, qualification.semanticPayload.sourceDocumentSha256);
assert.equal(record.datasetHash, qualification.semanticPayload.datasetHash);
assert.equal(record.loadProducerQualificationSha256,
  qualification.semanticPayload.loadProducerQualificationSha256);

assert.deepEqual(record.tolerancePolicy, {
  absolute: 1e-12,
  relative: 1e-11,
  formula: 'max(abs, max(1, |expected|) * rel)',
});
const loadComponents = ['P', 'Vc', 'Vl', 'Mc', 'Ml', 'Mt'];
assert.equal(record.physicalWrcLoadComparisons.length, 6);
record.physicalWrcLoadComparisons.forEach((row, index) => {
  const component = loadComponents[index];
  assert.equal(row.component, component);
  assert.equal(row.expected, oracle.semanticPayload.expectedPhysical.wrcLoads[component]);
  assert.equal(row.absoluteDelta, Math.abs(row.actual - row.expected));
  assert.equal(row.absoluteDelta, 0);
});
const locations = ['Au', 'Al', 'Bu', 'Bl', 'Cu', 'Cl', 'Du', 'Dl'];
const families = ['circumferential', 'longitudinal', 'shear', 'stressIntensity'];
assert.equal(record.stressComparisonsRequired, 32);
assert.equal(record.stressComparisonsPassed, 32);
assert.equal(record.stressComparisons.length, 32);
let rowIndex = 0;
for (const family of families) {
  for (let locationIndex = 0; locationIndex < locations.length; locationIndex += 1) {
    const row = record.stressComparisons[rowIndex++];
    const expected = oracle.semanticPayload.expected[family][locationIndex];
    assert.equal(row.family, family);
    assert.equal(row.location, locations[locationIndex]);
    assert.equal(row.expected, expected);
    const tolerance = Math.max(1e-12, Math.max(1, Math.abs(expected)) * 1e-11);
    const absoluteDelta = Math.abs(row.actual - expected);
    const relativeDelta = absoluteDelta / Math.max(1, Math.abs(expected));
    const toleranceRatio = absoluteDelta / tolerance;
    assert.equal(row.tolerance, tolerance);
    assert.equal(row.absoluteDelta, absoluteDelta);
    assert.equal(row.relativeDelta, relativeDelta);
    assert.equal(row.toleranceRatio, toleranceRatio);
    assert.ok(toleranceRatio <= 1,
      `EMP1_CURRENT_REOBSERVATION_OUTSIDE_TOLERANCE:${family}:${locations[locationIndex]}`);
  }
}
const governing = record.stressComparisons.reduce((a, b) => b.toleranceRatio > a.toleranceRatio ? b : a,
  record.stressComparisons[0]);
assert.equal(record.maxToleranceRatio, governing.toleranceRatio);
assert.deepEqual(record.governingComparison, governing);

assertSubordinate(record.subordinateEvidence.independentDecoupling,
  'scripts/emp1-wrc537-independent-oracle-decoupling-check.mjs',
  'PASS_INDEPENDENT_ORACLE_INTERPRETATION_DECOUPLED');
assertSubordinate(record.subordinateEvidence.independentRefreeze,
  'scripts/emp1-wrc537-independent-oracle-decoupling-check.mjs',
  'PASS_FROZEN_POST_AUTHORITY_PHYSICAL_TABLE5_ORACLE');
assertSubordinate(record.subordinateEvidence.independentFalsifiers,
  'scripts/emp1-wrc-gamma5-post-authority-refreeze-falsifiers.mjs',
  'PASS_POST_AUTHORITY_PHYSICAL_ORACLE_FALSIFIERS');
assertSubordinate(record.subordinateEvidence.qualificationBinding,
  'scripts/emp1-wrc-gamma5-route-requalification-candidate-check.mjs');
assertSubordinate(record.subordinateEvidence.authorityIdentityReconciliation,
  'scripts/emp1-wrc-gamma5-authority-identity-reconciliation-check.mjs',
  'PASS_CURRENT_AUTHORITY_IDENTITIES_RECONCILED_STANDARD_NUMERICAL_EVIDENCE_STILL_NOT_RUN');

assert.deepEqual(record.currentAuthority, {
  productionRouteAuthorized: true,
  registryRegistered: true,
  boundedEngineeringUseAuthorized: true,
  globalEmp1CRouteAuthority: false,
  codeComplianceAuthorized: false,
  releaseQualified: false,
});
assert.deepEqual(record.authorityBoundary, {
  authorityCreatedByThisObservation: false,
  frozenOracleMayBeRewrittenByThisObservation: false,
  toleranceMayBeChangedByThisObservation: false,
  standardHistoricalEvidenceCreatedByThisObservation: false,
});
assert.deepEqual(record.standardHistoricalQualification, {
  files01Through10: 'NOT_GENERATED',
  numericalQualification: 'NOT_RUN_NOT_CLAIMED',
  files11Through12: 'NOT_GENERATED',
});

assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_AUTHORIZED, true);
assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_QUALIFICATION_SHA256,
  record.qualificationRecordSha256);
assert.deepEqual(EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_SUSPENSION_REASONS, []);
const registry = emp1CBoundedRoute(EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID);
assert.equal(registry.registered, true);
assert.equal(registry.engineeringUseAuthorized, true);
assert.equal(registry.globalEmp1CRouteAuthority, false);
assert.equal(registry.releaseQualified, false);

console.log(JSON.stringify({
  schema: 'emp1-wrc537-gamma5-current-authority-reobservation-check/v1',
  status: 'PASS_CURRENT_AUTHORITY_REOBSERVATION_FULL_MATRIX_INTEGRITY',
  observedHeadSha: record.observedHeadSha,
  observationSemanticHash,
  qualificationRecordSha256: record.qualificationRecordSha256,
  oracleSemanticHash: record.oracleSemanticHash,
  physicalWrcLoadsPassed: 6,
  stressComparisonsPassed: 32,
  maxToleranceRatio: record.maxToleranceRatio,
  productionRouteAuthorized: true,
  authorityCreatedByThisCheck: false,
  standardHistoricalQualification: 'NOT_RUN_NOT_CLAIMED',
}, null, 2));

function assertSubordinate(value, script, expectedStatus = null) {
  assert.ok(value && typeof value === 'object');
  assert.equal(value.script, script);
  assert.match(value.stdoutSha256, /^[0-9a-f]{64}$/u);
  assert.equal(typeof value.schema, 'string');
  if (expectedStatus) assert.equal(value.status, expectedStatus);
  else assert.match(value.status ?? '', /^PASS/u);
}
function assertCommitExists(sha) {
  try { execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: root, stdio: 'ignore' }); }
  catch { throw gateError(`EMP1_CURRENT_REOBSERVATION_HEAD_NOT_IN_REPOSITORY:${sha}`); }
}
async function readJson(path) { return JSON.parse(await readFile(resolve(root, path), 'utf8')); }
function parseArgs(args) {
  const out = { recordPath: null, expectedObservedHead: null };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--record') out.recordPath = args[++index] ?? null;
    else if (args[index] === '--expected-observed-head') out.expectedObservedHead = args[++index] ?? null;
    else if (args[index] === '--require-observed-head-parent') { /* legacy no-op for current v2 */ }
    else throw gateError(`EMP1_CURRENT_REOBSERVATION_UNKNOWN_ARGUMENT:${args[index]}`);
  }
  return out;
}
function sha256Canonical(value) {
  return createHash('sha256').update(JSON.stringify(sortValue(value)), 'utf8').digest('hex');
}
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  return value;
}
function gateError(code) { const error = new TypeError(code); error.code = code; return error; }
