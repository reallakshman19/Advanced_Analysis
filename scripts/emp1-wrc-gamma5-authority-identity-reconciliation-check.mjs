#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const CURRENT_QUALIFICATION = '9ea591a1918175b3e415d77f1adc4398645ca0503a699cfe8139d9dd3c69b4c7';
const CURRENT_ORACLE = '60771128f8261057bf73fa6c183ace5df25f3ee98f417f58da25a6135d8b2e18';
const SUPERSEDED_QUALIFICATION = 'db477df8596e9fd3fc830fa063d90c39558ed770d4cc67b3605e325a6216d665';
const SUPERSEDED_ORACLE = '0aec3815479ea092e61bad3858519c8495f9b5cbe6ac711e76ce5bd6f80a806c';
const SOURCE_SHA = '698fcdc3e676e3bc6bbf710bc28ea8b666ac9511a81a0067a5d01088ae4c27b2';
const DATASET_HASH = 'fb440a292f8794430977f60f5365a678a9aff62a4dae3397621902964a0db73c';
const ROUTE_ID = 'EMP1.C.WRC537.CYLINDRICAL.ORIGINAL.GAMMA5.ZERO_DP';

const [
  ledger,
  oracle,
  qualification,
  authorization,
  routeSource,
  registrySource,
  releaseProfile,
  benchmarkManifest,
  currentStateDoc,
] = await Promise.all([
  readJson('validation/emp1/wrc537-2013/gamma5-authority-identity-reconciliation-v1.json'),
  readJson('validation/emp1/wrc537-2013/gamma5-post-authority-physical-oracle-v1.json'),
  readJson('validation/emp1/wrc537-2013/gamma5-zero-dp-route-qualification-v2.json'),
  readJson('validation/emp1/wrc537-2013/gamma5-zero-dp-route-authorization-v1.json'),
  readFile('src/core/emp1/emp1-wrc537-gamma5-zero-dp-route.js', 'utf8'),
  readFile('src/core/emp1/emp1-c-bounded-route-registry.js', 'utf8'),
  readJson('validation/emp1/release/emp1-wrc537-gamma5-bounded-release-profile-v1.json'),
  readJson('validation/emp1/release/emp1-wrc537-gamma5-benchmark-manifest-v1.json'),
  readFile('docs/emp1/EMP1_PROFESSIONAL_RELEASE_CURRENT_STATE.md', 'utf8'),
]);

assert.equal(ledger.schema, 'emp1-wrc537-gamma5-authority-identity-reconciliation/v1');
assert.equal(ledger.authorityCreatedByThisArtifact, false);
assert.equal(ledger.status,
  'RECONCILED_OWNER_AUTHORIZED_CHAIN_RUNTIME_REOBSERVATION_SEPARATED_STANDARD_NUMERICAL_EVIDENCE_STILL_NOT_RUN');
assert.equal(ledger.sourceCustody.wrc537_2013.sha256, SOURCE_SHA);
assert.equal(ledger.boundedDatasetHash, DATASET_HASH);
assert.equal(ledger.currentAuthorityIdentity.qualificationRecordSha256, CURRENT_QUALIFICATION);
assert.equal(ledger.currentAuthorityIdentity.postAuthorityOracleSemanticHash, CURRENT_ORACLE);
assert.equal(ledger.currentAuthorityIdentity.standardNumericalQualification, 'NOT_RUN_NOT_CLAIMED');
assert.equal(ledger.a3Disposition.requiredClassification,
  'EXECUTION_ENVIRONMENT_CANONICALIZATION_CHANGE');
assert.equal(ledger.a3Disposition.custodyOnlyCascadeSafe, false);
assert.equal(ledger.a3Disposition.newCanonicalizationPolicyAuthorized, false);
assert.equal(ledger.a3Disposition.newNumericalExpectedValuesAuthorized, false);
assert.equal(ledger.a3Disposition.toleranceChangeAuthorized, false);
assert.equal(ledger.numericalDriftClassification.exactPayloadValuesChanged, true);
assert.equal(ledger.numericalDriftClassification.sourceHashChanged, false);
assert.equal(ledger.numericalDriftClassification.datasetHashChanged, false);
assert.equal(ledger.numericalDriftClassification.toleranceChanged, false);
assert.equal(ledger.numericalDriftClassification.methodScopeChanged, false);
assert.equal(ledger.exactBeforeAfterSemanticPayloadDiff.length, 5);
assert.equal(ledger.currentSplitBrain, false);

assert.equal(sha256(canonical(oracle.semanticPayload)), CURRENT_ORACLE,
  'EMP1_1762_FROZEN_ORACLE_CANONICAL_HASH_DRIFT');
assert.equal(oracle.semanticHash, CURRENT_ORACLE);
assert.equal(oracle.semanticPayload.sourceDocumentSha256, SOURCE_SHA);
assert.equal(qualification.semanticPayload.sourceDocumentSha256, SOURCE_SHA);
assert.equal(qualification.semanticPayload.datasetHash, DATASET_HASH);
assert.equal(qualification.semanticPayload.benchmarkQualification.benchmarkHash, CURRENT_ORACLE);
assert.equal(sha256(canonical(qualification.semanticPayload)), CURRENT_QUALIFICATION,
  'EMP1_1762_QUALIFICATION_CANONICAL_HASH_DRIFT');
assert.equal(qualification.qualificationRecordSha256, CURRENT_QUALIFICATION);
assert.equal(qualification.reobservation.status, 'NOT_RUN_EXECUTION_ENVIRONMENT');
assert.equal(qualification.reobservation.stressComparisonsPassed, 0);
assert.equal(qualification.authorization.releaseQualified, false);

assert.equal(authorization.authorizedIdentity.qualificationRecordSha256, CURRENT_QUALIFICATION);
assert.equal(authorization.authorizedIdentity.postAuthorityOracleSemanticHash, CURRENT_ORACLE);
assert.equal(authorization.authorizedScope.routeId, ROUTE_ID);
assert.equal(authorization.standardEvidenceContract.numericalQualification, 'NOT_RUN_NOT_CLAIMED');
assert.equal(authorization.standardEvidenceContract.engineeringPassClaimed, false);
assert.equal(authorization.postPromotionQualification.completed, false);
assert.equal(authorization.authorityBoundary.globalEmp1CRouteAuthority, false);
assert.equal(authorization.authorityBoundary.codeComplianceAuthorized, false);
assert.equal(authorization.authorityBoundary.releaseQualified, false);

assert.match(routeSource, new RegExp(CURRENT_QUALIFICATION));
assert.match(routeSource, new RegExp(CURRENT_ORACLE));
assert.doesNotMatch(routeSource, new RegExp(SUPERSEDED_QUALIFICATION));
assert.doesNotMatch(routeSource, new RegExp(SUPERSEDED_ORACLE));
assert.match(routeSource, /EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_AUTHORIZED = true/u);
assert.match(routeSource, /EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_SUSPENSION_REASONS = Object\.freeze\(\[\]\)/u);

assert.match(registrySource, new RegExp(CURRENT_QUALIFICATION));
assert.doesNotMatch(registrySource, new RegExp(SUPERSEDED_QUALIFICATION));
assert.doesNotMatch(registrySource, new RegExp(SUPERSEDED_ORACLE));
assert.match(registrySource, new RegExp(ROUTE_ID.replaceAll('.', '\\.')));
assert.match(registrySource, /registered: true/u);
assert.match(registrySource, /engineeringUseAuthorized: true/u);
assert.match(registrySource, /globalEmp1CRouteAuthority: false/u);
assert.match(registrySource, /releaseQualified: false/u);

assert.equal(releaseProfile.method.sourceSha256, SOURCE_SHA);
assert.equal(releaseProfile.method.datasetHash, DATASET_HASH);
assert.equal(releaseProfile.benchmark.physicalOracleHash, CURRENT_ORACLE);
assert.equal(releaseProfile.releaseAuthority.globalEmp1CRouteAuthority, false);
assert.equal(releaseProfile.releaseAuthority.releaseQualified, false);
assert.equal(benchmarkManifest.method.sourceSha256, SOURCE_SHA);
assert.equal(benchmarkManifest.method.datasetHash, DATASET_HASH);
assert.equal(benchmarkManifest.physicalOracle.semanticHash, CURRENT_ORACLE);
assert.equal(benchmarkManifest.physicalOracle.productionObservationUsed, false);

assert.match(currentStateDoc, new RegExp(CURRENT_QUALIFICATION));
assert.match(currentStateDoc, new RegExp(CURRENT_ORACLE));
assert.doesNotMatch(currentStateDoc, new RegExp(SUPERSEDED_QUALIFICATION));
assert.doesNotMatch(currentStateDoc, new RegExp(SUPERSEDED_ORACLE));
assert.match(currentStateDoc, /global EMP\.1\.C authority\s*= false/u);
assert.match(currentStateDoc, /code compliance authorized\s*= false/u);
assert.match(currentStateDoc, /release qualified\s*= false/u);

const currentAuthoritySurfaces = [
  ['oracle', JSON.stringify(oracle)],
  ['qualification', JSON.stringify(qualification)],
  ['authorization', JSON.stringify(authorization)],
  ['routeSource', routeSource],
  ['registrySource', registrySource],
  ['releaseProfile', JSON.stringify(releaseProfile)],
  ['benchmarkManifest', JSON.stringify(benchmarkManifest)],
  ['currentStateDoc', currentStateDoc],
];
for (const [name, content] of currentAuthoritySurfaces) {
  assert(!content.includes(SUPERSEDED_QUALIFICATION),
    `EMP1_1762_SUPERSEDED_QUALIFICATION_IN_ACTIVE_SURFACE:${name}`);
  assert(!content.includes(SUPERSEDED_ORACLE),
    `EMP1_1762_SUPERSEDED_ORACLE_IN_ACTIVE_SURFACE:${name}`);
}

const supersededRoles = ledger.identityLedger.filter((entry) =>
  entry.identityValue === SUPERSEDED_QUALIFICATION || entry.identityValue === SUPERSEDED_ORACLE);
assert.equal(supersededRoles.length, 2);
assert.ok(supersededRoles.every((entry) => entry.status === 'SUPERSEDED_CURRENT_STATE'));
assert.ok(supersededRoles.every((entry) =>
  entry.replacementRule === 'MUST_NOT_APPEAR_IN_ACTIVE_CURRENT_AUTHORITY_SURFACE'));
const immutableHistory = ledger.identityLedger.filter((entry) =>
  entry.status === 'HISTORICAL_IMMUTABLE_EVIDENCE');
assert.ok(immutableHistory.length >= 2);
assert.ok(immutableHistory.every((entry) => entry.replacementRule === 'NEVER_REWRITE_HISTORY'));

console.log(JSON.stringify({
  schema: 'emp1-wrc537-gamma5-authority-identity-reconciliation-check/v1',
  status: 'PASS_CURRENT_AUTHORITY_IDENTITIES_RECONCILED_STANDARD_NUMERICAL_EVIDENCE_STILL_NOT_RUN',
  engineeringPassClaimed: false,
  authorityCreatedByThisCheck: false,
  sourceSha256: SOURCE_SHA,
  datasetHash: DATASET_HASH,
  currentAuthority: {
    routeId: ROUTE_ID,
    qualification: CURRENT_QUALIFICATION,
    oracle: CURRENT_ORACLE,
    registered: true,
    boundedEngineeringUseAuthorized: true,
    globalEmp1CRouteAuthority: false,
    codeComplianceAuthorized: false,
    releaseQualified: false,
  },
  supersededMutationProvenance: {
    qualification: SUPERSEDED_QUALIFICATION,
    oracle: SUPERSEDED_ORACLE,
    allowedInActiveAuthoritySurfaces: false,
  },
  standardNumericalQualification: 'NOT_RUN_NOT_CLAIMED',
}, null, 2));

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}
