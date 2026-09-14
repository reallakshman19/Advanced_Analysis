#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const RECORD_PATH = 'validation/emp1/wrc537-2013/future-scope-extension-readiness-v1.json';
const ROUTE_PATH = 'src/core/emp1/emp1-wrc537-gamma5-zero-dp-route.js';
const SOURCE_SHA = '698fcdc3e676e3bc6bbf710bc28ea8b666ac9511a81a0067a5d01088ae4c27b2';
const DATASET_HASH = 'fb440a292f8794430977f60f5365a678a9aff62a4dae3397621902964a0db73c';
const QUALIFICATION = '9ea591a1918175b3e415d77f1adc4398645ca0503a699cfe8139d9dd3c69b4c7';
const ORACLE = '60771128f8261057bf73fa6c183ace5df25f3ee98f417f58da25a6135d8b2e18';

const [record, routeSource] = await Promise.all([
  readJson(RECORD_PATH),
  readFile(ROUTE_PATH, 'utf8'),
]);

assert.equal(record.schema, 'emp1-wrc537-future-scope-extension-readiness/v1');
assert.equal(record.issue, 1777);
assert.equal(record.recordPurpose, 'PROGRAMME_READINESS_AND_ANTI_LEAKAGE_ONLY');
assert.equal(record.authorityCreatedByThisArtifact, false);
assert.equal(record.engineeringPassClaimed, false);

const bounded = record.currentBoundedRoute;
assert.equal(bounded.routeId, 'EMP1.C.WRC537.CYLINDRICAL.ORIGINAL.GAMMA5.ZERO_DP');
assert.equal(bounded.edition, '2013');
assert.equal(bounded.shellFamily, 'CYLINDRICAL');
assert.equal(bounded.attachmentShape, 'ROUND');
assert.equal(bounded.variant, 'ORIGINAL');
assert.equal(bounded.gammaSelection, 'EXACT_SOURCE_TABULATED_GAMMA_ONLY');
assert.equal(bounded.gamma, 5);
assert.equal(bounded.betaMinimum, 0.05);
assert.equal(bounded.betaMaximum, 0.5);
assert.equal(bounded.differentialPressure, 0);
assert.equal(bounded.Kn, 1);
assert.equal(bounded.Kb, 1);
assert.deepEqual(bounded.recoveryPoints, ['Au', 'Al', 'Bu', 'Bl', 'Cu', 'Cl', 'Du', 'Dl']);
assert.equal(bounded.hostShellStressOnly, true);
assert.equal(bounded.continuousJunctureSearchPerformed, false);
assert.equal(bounded.absoluteShellMaximumAssured, false);
assert.equal(bounded.offAxisLongitudinalMomentMaximumAuthorized, false);
assert.equal(bounded.globalEmp1CRouteAuthority, false);
assert.equal(bounded.codeComplianceAuthorized, false);
assert.equal(bounded.releaseQualified, false);
assert.equal(bounded.sourceDocumentSha256, SOURCE_SHA);
assert.equal(bounded.datasetHash, DATASET_HASH);
assert.equal(bounded.qualificationRecordSha256, QUALIFICATION);
assert.equal(bounded.postAuthorityOracleSemanticHash, ORACLE);

assert.deepEqual(record.tracks.map((track) => track.trackId), ['E1', 'E2', 'E3', 'E4', 'E5', 'E6']);
for (const track of record.tracks) {
  assert.equal(track.firstUnmetLifecycleBoundary, 'PRIMARY_SOURCE_QUALIFICATION',
    `EMP1_1777_FIRST_BOUNDARY_DRIFT:${track.trackId}`);
  assert.equal(track.productionAuthorization, 'NOT_AUTHORIZED',
    `EMP1_1777_EXTENSION_AUTHORITY_LEAK:${track.trackId}`);
  assert.equal(track.independentBenchmark, 'ABSENT',
    `EMP1_1777_UNFROZEN_BENCHMARK_PROMOTED:${track.trackId}`);
  assert.equal(track.numericalQualification, 'NOT_RUN',
    `EMP1_1777_NUMERICAL_QUALIFICATION_FALSE_CLAIM:${track.trackId}`);
}

assert.equal(record.antiLeakageRules.boundedV1MutableInPlace, false);
assert.equal(record.antiLeakageRules.productionOutputMayChooseDefinition, false);
assert.equal(record.antiLeakageRules.externalSoftwareMayCreateMethodAuthority, false);
assert.equal(record.antiLeakageRules.comparisonEvidenceMayCreateProductionAuthority, false);
assert.equal(record.antiLeakageRules.crossCapabilityLeakageAuthorized, false);
assert.equal(record.antiLeakageRules.sourceQualifiedImpliesProductionAuthorized, false);
assert.equal(record.antiLeakageRules.extensionOverlapImpliesAuthority, false);
assert.equal(record.antiLeakageRules.editionMixingAuthorized, false);
assert.equal(record.currentDependencyTruth.thisProgrammeMayBypassP0, false);

const routeAssertions = [
  [new RegExp(QUALIFICATION), 'bounded qualification identity'],
  [new RegExp(ORACLE), 'bounded oracle identity'],
  [new RegExp(SOURCE_SHA), 'bounded source identity'],
  [new RegExp(DATASET_HASH), 'bounded dataset identity'],
  [/gammaSelectionPolicy:\s*'EXACT_SOURCE_TABULATED_GAMMA_ONLY'/u, 'exact gamma selection'],
  [/nonTabulatedGamma:\s*'BLOCKED'/u, 'non-tabulated gamma block'],
  [/interpolationAllowed:\s*false/u, 'interpolation block'],
  [/crossVariantFallbackAllowed:\s*false/u, 'cross-variant block'],
  [/shellFamily:\s*'CYLINDRICAL'/u, 'cylindrical shell family'],
  [/attachmentShape:\s*'ROUND'/u, 'round attachment family'],
  [/variant:\s*'ORIGINAL'/u, 'Original variant'],
  [/gamma:\s*5,/u, 'gamma 5'],
  [/betaMinimum:\s*0\.05/u, 'beta lower bound'],
  [/betaMaximum:\s*0\.5/u, 'beta upper bound'],
  [/offAxisLongitudinalMomentMaximumAuthorized:\s*false/u, 'off-axis maximum block'],
  [/attachmentStressCalculated:\s*false/u, 'attachment stress block'],
  [/nozzleStressCalculated:\s*false/u, 'nozzle stress block'],
  [/value\.Kn !== 1 \|\| value\.Kb !== 1/u, 'unity SCF enforcement'],
];
for (const [pattern, label] of routeAssertions) {
  assert.match(routeSource, pattern, `EMP1_1777_BOUNDED_ROUTE_GUARD_DRIFT:${label}`);
}

const prohibitedAuthorizationTokens = [
  'NON_UNITY_AUTHORIZED',
  'NONZERO_DP_AUTHORIZED',
  'OFF_AXIS_MAXIMUM_AUTHORIZED',
  'NON_TABULATED_GAMMA_AUTHORIZED',
  'NONROUND_AUTHORIZED',
  'SPHERICAL_AUTHORIZED',
  'WRC297_AUTHORIZED',
  'EDITION4_AUTHORIZED',
];
const serializedRecord = JSON.stringify(record);
for (const token of prohibitedAuthorizationTokens) {
  assert(!serializedRecord.includes(token), `EMP1_1777_PROHIBITED_AUTHORITY_TOKEN:${token}`);
}

console.log(JSON.stringify({
  schema: 'emp1-wrc537-future-scope-extension-readiness-check/v1',
  status: 'PASS_PROGRAMME_READINESS_GUARD_NO_EXTENSION_AUTHORITY_CREATED',
  authorityCreatedByThisCheck: false,
  engineeringPassClaimed: false,
  boundedRouteGuarded: true,
  extensionTracks: record.tracks.map(({ trackId, productionAuthorization, firstUnmetLifecycleBoundary }) => ({
    trackId,
    productionAuthorization,
    firstUnmetLifecycleBoundary,
  })),
  extensionNumericalQualification: 'NOT_RUN',
}, null, 2));

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
