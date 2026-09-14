#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateLocalAttachmentFoundation } from '../src/core/local-stress/index.js';
import { canonicalFixture } from './lafea.1-fixtures.mjs';
import {
  EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_AUTHORIZED,
  EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_QUALIFICATION_SHA256,
  EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_SUSPENSION_REASONS,
  evaluateEmp1Wrc537Gamma5ZeroDpRouteCandidate,
} from '../src/core/emp1/emp1-wrc537-gamma5-zero-dp-route.js';
import {
  EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID,
  emp1CBoundedRoute,
} from '../src/core/emp1/emp1-c-bounded-route-registry.js';
import { deriveEmp1Wrc537CylindricalAxisAuthority } from '../src/core/emp1/emp1-wrc537-cylindrical-axis-authority.js';
import {
  EMP1_WRC537_ATTACHMENT_STATION_BASIS,
  EMP1_WRC537_CYLINDER_LENGTH_BASIS,
  createEmp1Wrc537ApplicabilitySourceAuthority,
} from '../src/core/emp1/emp1-wrc537-applicability-source-authority.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const options = parseArgs(process.argv.slice(2));
const expectedHead = options.expectedHead ?? process.env.EMP1_EXPECTED_HEAD_SHA ?? null;
if (!/^[0-9a-f]{40}$/u.test(expectedHead ?? '')) throw gateError('EMP1_EXACT_HEAD_SHA_REQUIRED');
const actualHead = git(['rev-parse', 'HEAD']);
assert.equal(actualHead, expectedHead, `EMP1_EXACT_HEAD_MISMATCH:${actualHead}:${expectedHead}`);

const [oracleRecord, qualificationRecord, reconciliation] = await Promise.all([
  readJson('validation/emp1/wrc537-2013/gamma5-post-authority-physical-oracle-v1.json'),
  readJson('validation/emp1/wrc537-2013/gamma5-zero-dp-route-qualification-v2.json'),
  readJson('validation/emp1/wrc537-2013/gamma5-authority-identity-reconciliation-v1.json'),
]);
assert.equal(oracleRecord.semanticHash, '60771128f8261057bf73fa6c183ace5df25f3ee98f417f58da25a6135d8b2e18');
assert.equal(qualificationRecord.qualificationRecordSha256,
  '9ea591a1918175b3e415d77f1adc4398645ca0503a699cfe8139d9dd3c69b4c7');
assert.equal(qualificationRecord.semanticPayload.benchmarkQualification.benchmarkHash,
  oracleRecord.semanticHash);
assert.equal(qualificationRecord.reobservation.status, 'NOT_RUN_EXECUTION_ENVIRONMENT');
assert.equal(reconciliation.currentSplitBrain, false);
assert.equal(reconciliation.currentAuthorityIdentity.qualificationRecordSha256,
  qualificationRecord.qualificationRecordSha256);
assert.equal(reconciliation.currentAuthorityIdentity.postAuthorityOracleSemanticHash,
  oracleRecord.semanticHash);

assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_AUTHORIZED, true);
assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_QUALIFICATION_SHA256,
  qualificationRecord.qualificationRecordSha256);
assert.deepEqual(EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_SUSPENSION_REASONS, []);
const registry = emp1CBoundedRoute(EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID);
assert.ok(registry, 'EMP1_CURRENT_ROUTE_REGISTRY_ENTRY_REQUIRED');
assert.equal(registry.registered, true);
assert.equal(registry.engineeringUseAuthorized, true);
assert.deepEqual(registry.suspensionReasons, []);
assert.equal(registry.globalEmp1CRouteAuthority, false);
assert.equal(registry.releaseQualified, false);
assert.equal(registry.method.qualificationRecordSha256,
  qualificationRecord.qualificationRecordSha256);

const independentRun = runScript('scripts/emp1-wrc537-independent-oracle-decoupling-check.mjs');
const independentDecoupling = requireRecord(independentRun.records,
  'emp1-wrc537-independent-oracle-decoupling/v2');
const independentRefreeze = requireRecord(independentRun.records,
  'emp1-wrc537-gamma5-post-authority-independent-refreeze/v1');
assert.equal(independentDecoupling.status, 'PASS_INDEPENDENT_ORACLE_INTERPRETATION_DECOUPLED');
assert.equal(independentRefreeze.status, 'PASS_FROZEN_POST_AUTHORITY_PHYSICAL_TABLE5_ORACLE');
assert.equal(independentRefreeze.semanticHash, oracleRecord.semanticHash);
assert.equal(independentRefreeze.runtimeReobservationMayAuthorFrozenOracle, false);

const independentFalsifierRun = runScript('scripts/emp1-wrc-gamma5-post-authority-refreeze-falsifiers.mjs');
const independentFalsifiers = requireRecord(independentFalsifierRun.records,
  'emp1-wrc537-gamma5-post-authority-refreeze-falsifiers/v1');
assert.equal(independentFalsifiers.status, 'PASS_POST_AUTHORITY_PHYSICAL_ORACLE_FALSIFIERS');

const qualificationBindingRun = runScript('scripts/emp1-wrc-gamma5-route-requalification-candidate-check.mjs');
const qualificationBinding = requireRecord(qualificationBindingRun.records,
  'emp1-wrc537-gamma5-route-requalification-candidate-check/v1');
assert.equal(qualificationBinding.qualificationRecordSha256,
  qualificationRecord.qualificationRecordSha256);
assert.equal(qualificationBinding.oracleHash, oracleRecord.semanticHash);
assert.equal(qualificationBinding.ownerAuthorizedProductionRouteActive, true);

const reconciliationRun = runScript('scripts/emp1-wrc-gamma5-authority-identity-reconciliation-check.mjs');
const reconciliationCheck = requireRecord(reconciliationRun.records,
  'emp1-wrc537-gamma5-authority-identity-reconciliation-check/v2');
assert.equal(reconciliationCheck.status,
  'PASS_CURRENT_AUTHORITY_IDENTITIES_RECONCILED_WITH_AUTHORITY_STALENESS_AND_ROLE_AWARE_HASH_GUARDS_STANDARD_NUMERICAL_EVIDENCE_STILL_NOT_RUN');
assert.equal(reconciliationCheck.engineeringPassClaimed, false);

const oracle = oracleRecord.semanticPayload;
const model = routeFixture();
const foundationResult = calculateLocalAttachmentFoundation(model);
assert.equal(foundationResult.qualification.state, 'ACCEPTED');
const axisAuthority = deriveEmp1Wrc537CylindricalAxisAuthority({
  foundationResult,
  foundationModel: model,
  loadCaseIdentity: 'LC-1',
});
const applicabilitySourceAuthority = createEmp1Wrc537ApplicabilitySourceAuthority({
  geometryIdentity: 'ARCH-WRC-01-CURRENT-EXACT-HEAD-CYLINDER',
  cylinderLengthBasis: EMP1_WRC537_CYLINDER_LENGTH_BASIS,
  cylinderLength: oracle.case.applicability.cylinderLength,
  attachmentStationBasis: EMP1_WRC537_ATTACHMENT_STATION_BASIS,
  attachmentStationFromCylinderStart: oracle.case.applicability.attachmentStationFromCylinderStart,
  unit: 'mm',
  cylinderLengthSourceReference: 'ARCH-WRC-01/CURRENT/CYLINDER-LENGTH',
  attachmentStationSourceReference: 'ARCH-WRC-01/CURRENT/WRC-STATION',
  productionObservationUsedToSetAuthority: false,
});
const input = {
  loadTransferResult: foundationResult,
  loadCaseIdentity: 'LC-1',
  pressureResultIdentity: 'PR-1',
  wrcReferencePointGlobal: oracle.physicalBenchmark.targetPointGlobal,
  geometry: {
    meanRadius: oracle.case.geometry.meanRadius,
    shellThickness: oracle.case.geometry.shellThickness,
    attachmentOutsideRadius: oracle.case.geometry.attachmentRadius,
    gamma: oracle.case.gamma,
    beta: oracle.case.beta,
  },
  axisAuthority,
  applicabilitySourceAuthority,
  stressConcentration: structuredClone(oracle.case.stressConcentration),
};
const production = evaluateEmp1Wrc537Gamma5ZeroDpRouteCandidate(input);
assert.deepEqual(production.numerics.curveFigureMap, oracle.figureMap);
assert.deepEqual(production.numerics.wrcLoads, oracle.expectedPhysical.wrcLoads);
assert.equal(production.numerics.extremaScope.evaluatedLocationCount, 8);
assert.equal(production.numerics.extremaScope.continuousJunctureSearchPerformed, false);

const tolerancePolicy = Object.freeze({
  absolute: 1e-12,
  relative: 1e-11,
  formula: 'max(abs, max(1, |expected|) * rel)',
});
const comparisons = [];
for (const family of ['circumferential', 'longitudinal', 'shear', 'stressIntensity']) {
  const actual = production.stresses[family];
  const expected = oracle.expected[family];
  assert.equal(actual.length, 8);
  assert.equal(expected.length, 8);
  actual.forEach((value, index) => {
    const target = expected[index];
    const tolerance = Math.max(tolerancePolicy.absolute,
      Math.max(1, Math.abs(target)) * tolerancePolicy.relative);
    const absoluteDelta = Math.abs(value - target);
    const relativeDelta = absoluteDelta / Math.max(1, Math.abs(target));
    const toleranceRatio = absoluteDelta / tolerance;
    assert.ok(toleranceRatio <= 1,
      `EMP1_CURRENT_HEAD_STRESS_DRIFT:${family}:${oracle.expected.locations[index]}`);
    comparisons.push({ family, location: oracle.expected.locations[index], actual: value,
      expected: target, absoluteDelta, relativeDelta, tolerance, toleranceRatio });
  });
}
assert.equal(comparisons.length, 32);
const physicalWrcLoadComparisons = Object.keys(oracle.expectedPhysical.wrcLoads).map((component) => ({
  component,
  actual: production.numerics.wrcLoads[component],
  expected: oracle.expectedPhysical.wrcLoads[component],
  absoluteDelta: Math.abs(production.numerics.wrcLoads[component] - oracle.expectedPhysical.wrcLoads[component]),
}));
assert.equal(physicalWrcLoadComparisons.length, 6);
assert.ok(physicalWrcLoadComparisons.every((row) => row.absoluteDelta === 0));
const governing = comparisons.reduce((a, b) => b.toleranceRatio > a.toleranceRatio ? b : a,
  comparisons[0]);

const payload = {
  schema: 'emp1-wrc537-gamma5-current-authority-exact-head-reobservation/v2',
  observedHeadSha: actualHead,
  qualificationRecordSha256: qualificationRecord.qualificationRecordSha256,
  oracleSemanticHash: oracleRecord.semanticHash,
  sourceDocumentSha256: qualificationRecord.semanticPayload.sourceDocumentSha256,
  datasetHash: qualificationRecord.semanticPayload.datasetHash,
  loadProducerQualificationSha256: qualificationRecord.semanticPayload.loadProducerQualificationSha256,
  tolerancePolicy,
  physicalWrcLoadComparisons,
  stressComparisonsRequired: 32,
  stressComparisonsPassed: comparisons.length,
  stressComparisons: comparisons,
  maxToleranceRatio: governing.toleranceRatio,
  governingComparison: governing,
  subordinateEvidence: {
    independentDecoupling: evidenceRef(independentRun, independentDecoupling),
    independentRefreeze: evidenceRef(independentRun, independentRefreeze),
    independentFalsifiers: evidenceRef(independentFalsifierRun, independentFalsifiers),
    qualificationBinding: evidenceRef(qualificationBindingRun, qualificationBinding),
    authorityIdentityReconciliation: evidenceRef(reconciliationRun, reconciliationCheck),
  },
  currentAuthority: {
    productionRouteAuthorized: true,
    registryRegistered: true,
    boundedEngineeringUseAuthorized: true,
    globalEmp1CRouteAuthority: false,
    codeComplianceAuthorized: false,
    releaseQualified: false,
  },
  authorityBoundary: {
    authorityCreatedByThisObservation: false,
    frozenOracleMayBeRewrittenByThisObservation: false,
    toleranceMayBeChangedByThisObservation: false,
    standardHistoricalEvidenceCreatedByThisObservation: false,
  },
  standardHistoricalQualification: {
    files01Through10: 'NOT_GENERATED',
    numericalQualification: 'NOT_RUN_NOT_CLAIMED',
    files11Through12: 'NOT_GENERATED',
  },
};
const record = {
  ...payload,
  observationSemanticHash: sha256Canonical(payload),
  status: 'PASS_CURRENT_AUTHORITY_EXACT_HEAD_REOBSERVATION_STANDARD_01_TO_12_STILL_NOT_RUN',
};
if (options.writeRecord) await writeFile(resolve(root, options.writeRecord), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(record, null, 2));

function routeFixture() {
  return canonicalFixture((source) => {
    source.loadCases[0].force.value = [-400, 250, 1000];
    source.loadCases[0].moment.value = [-250000, -200000, 700000];
    source.pressureDefinitions.forEach((row) => {
      row.internalPressure.value = 0;
      row.externalPressure.value = 0;
    });
  });
}
function runScript(path) {
  const completed = spawnSync(process.execPath, [path], { cwd: root, encoding: 'utf8',
    env: { ...process.env, EMP1_EXACT_HEAD_PARENT_SHA: expectedHead } });
  assert.equal(completed.status, 0,
    `EMP1_CURRENT_HEAD_SUBORDINATE_FAILED:${path}\nSTDOUT:\n${completed.stdout ?? ''}\nSTDERR:\n${completed.stderr ?? ''}`);
  const stdout = completed.stdout ?? '';
  return { path, records: extractJsonObjects(stdout), stdoutSha256: sha256(stdout) };
}
function extractJsonObjects(text) {
  const records = [];
  let start = -1, depth = 0, inString = false, escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) { if (escaped) escaped = false; else if (char === '\\') escaped = true;
      else if (char === '"') inString = false; continue; }
    if (char === '"') { inString = true; continue; }
    if (char === '{') { if (depth === 0) start = index; depth += 1; continue; }
    if (char === '}') { depth -= 1; if (depth === 0 && start >= 0) {
      try { records.push(JSON.parse(text.slice(start, index + 1))); } catch {}
      start = -1;
    } }
  }
  return records;
}
function requireRecord(records, schema) {
  const record = records.find((item) => item?.schema === schema);
  assert.ok(record, `EMP1_CURRENT_HEAD_JSON_RECORD_REQUIRED:${schema}`);
  return record;
}
function evidenceRef(run, record) {
  return { script: run.path, schema: record.schema, status: record.status, stdoutSha256: run.stdoutSha256 };
}
function parseArgs(args) {
  const out = { expectedHead: null, writeRecord: null };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--expected-head') out.expectedHead = args[++index] ?? null;
    else if (args[index] === '--record' || args[index] === '--write-record') out.writeRecord = args[++index] ?? null;
    else throw gateError(`EMP1_CURRENT_HEAD_UNKNOWN_ARGUMENT:${args[index]}`);
  }
  return out;
}
async function readJson(path) { return JSON.parse(await readFile(resolve(root, path), 'utf8')); }
function git(args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim(); }
function sha256(text) { return createHash('sha256').update(text, 'utf8').digest('hex'); }
function sha256Canonical(value) {
  return createHash('sha256').update(JSON.stringify(sortValue(value)), 'utf8').digest('hex');
}
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  return value;
}
function gateError(code) { const error = new TypeError(code); error.code = code; return error; }
