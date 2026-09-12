#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const AUTHORIZED_QUALIFICATION = '9ea591a1918175b3e415d77f1adc4398645ca0503a699cfe8139d9dd3c69b4c7';
const AUTHORIZED_ORACLE = '60771128f8261057bf73fa6c183ace5df25f3ee98f417f58da25a6135d8b2e18';
const MUTATED_QUALIFICATION = 'db477df8596e9fd3fc830fa063d90c39558ed770d4cc67b3605e325a6216d665';
const MUTATED_ORACLE = '0aec3815479ea092e61bad3858519c8495f9b5cbe6ac711e76ce5bd6f80a806c';
const SOURCE_SHA = '698fcdc3e676e3bc6bbf710bc28ea8b666ac9511a81a0067a5d01088ae4c27b2';
const DATASET_HASH = 'fb440a292f8794430977f60f5365a678a9aff62a4dae3397621902964a0db73c';

const [ledger, oracle, qualification, authorization, routeSource, registrySource, releaseProfile, benchmarkManifest] =
  await Promise.all([
    readJson('validation/emp1/wrc537-2013/gamma5-authority-identity-reconciliation-v1.json'),
    readJson('validation/emp1/wrc537-2013/gamma5-post-authority-physical-oracle-v1.json'),
    readJson('validation/emp1/wrc537-2013/gamma5-zero-dp-route-qualification-v2.json'),
    readJson('validation/emp1/wrc537-2013/gamma5-zero-dp-route-authorization-v1.json'),
    readFile('src/core/emp1/emp1-wrc537-gamma5-zero-dp-route.js', 'utf8'),
    readFile('src/core/emp1/emp1-c-bounded-route-registry.js', 'utf8'),
    readJson('validation/emp1/release/emp1-wrc537-gamma5-bounded-release-profile-v1.json'),
    readJson('validation/emp1/release/emp1-wrc537-gamma5-benchmark-manifest-v1.json'),
  ]);

assert.equal(ledger.schema, 'emp1-wrc537-gamma5-authority-identity-reconciliation/v1');
assert.equal(ledger.authorityCreatedByThisArtifact, false);
assert.equal(ledger.status, 'BLOCKED_A3_NUMERICAL_PAYLOAD_DRIFT_REQUIRES_GOVERNED_DISPOSITION');
assert.equal(ledger.sourceCustody.wrc537_2013.sha256, SOURCE_SHA);
assert.equal(ledger.boundedDatasetHash, DATASET_HASH);
assert.equal(ledger.authorizedIdentity.qualificationRecordSha256, AUTHORIZED_QUALIFICATION);
assert.equal(ledger.authorizedIdentity.postAuthorityOracleSemanticHash, AUTHORIZED_ORACLE);
assert.equal(ledger.mutatedCurrentArtifacts.qualificationRecordSha256, MUTATED_QUALIFICATION);
assert.equal(ledger.mutatedCurrentArtifacts.postAuthorityOracleSemanticHash, MUTATED_ORACLE);
assert.equal(ledger.a3NumericalDrift.present, true);
assert.equal(ledger.a3NumericalDrift.sourceHashChanged, false);
assert.equal(ledger.a3NumericalDrift.datasetHashChanged, false);
assert.equal(ledger.a3NumericalDrift.toleranceChanged, false);
assert.equal(ledger.a3NumericalDrift.methodScopeChanged, false);
assert.equal(ledger.currentSplitBrain.splitBrain, true);

assert.equal(oracle.semanticHash, MUTATED_ORACLE,
  'EMP1_1762_EXPECT_CURRENT_MUTATED_ORACLE_FOR_DIAGNOSTIC');
assert.equal(qualification.qualificationRecordSha256, MUTATED_QUALIFICATION,
  'EMP1_1762_EXPECT_CURRENT_MUTATED_QUALIFICATION_FOR_DIAGNOSTIC');
assert.equal(qualification.semanticPayload.benchmarkQualification.benchmarkHash, MUTATED_ORACLE);
assert.equal(qualification.semanticPayload.sourceDocumentSha256, SOURCE_SHA);
assert.equal(qualification.semanticPayload.datasetHash, DATASET_HASH);

assert.equal(authorization.authorizedIdentity.qualificationRecordSha256, AUTHORIZED_QUALIFICATION);
assert.equal(authorization.authorizedIdentity.postAuthorityOracleSemanticHash, AUTHORIZED_ORACLE);
assert.equal(authorization.standardEvidenceContract.numericalQualification, 'NOT_RUN_NOT_CLAIMED');
assert.equal(authorization.standardEvidenceContract.engineeringPassClaimed, false);
assert.equal(authorization.postPromotionQualification.completed, false);
assert.equal(authorization.authorityBoundary.codeComplianceAuthorized, false);
assert.equal(authorization.authorityBoundary.releaseQualified, false);

assert.match(routeSource, new RegExp(AUTHORIZED_QUALIFICATION));
assert.match(routeSource, new RegExp(AUTHORIZED_ORACLE));
assert.doesNotMatch(routeSource, new RegExp(MUTATED_QUALIFICATION));
assert.doesNotMatch(routeSource, new RegExp(MUTATED_ORACLE));
assert.match(registrySource, new RegExp(AUTHORIZED_QUALIFICATION));
assert.doesNotMatch(registrySource, new RegExp(MUTATED_QUALIFICATION));

assert.equal(releaseProfile.method.sourceSha256, SOURCE_SHA);
assert.equal(releaseProfile.method.datasetHash, DATASET_HASH);
assert.equal(releaseProfile.benchmark.physicalOracleHash, AUTHORIZED_ORACLE);
assert.equal(releaseProfile.releaseAuthority.releaseQualified, false);
assert.equal(benchmarkManifest.method.sourceSha256, SOURCE_SHA);
assert.equal(benchmarkManifest.method.datasetHash, DATASET_HASH);
assert.equal(benchmarkManifest.physicalOracle.semanticHash, AUTHORIZED_ORACLE);
assert.equal(benchmarkManifest.physicalOracle.productionObservationUsed, false);

assert.notEqual(oracle.semanticHash, authorization.authorizedIdentity.postAuthorityOracleSemanticHash,
  'EMP1_1762_ORACLE_SPLIT_BRAIN_MUST_REMAIN_VISIBLE_UNTIL_GOVERNED_DISPOSITION');
assert.notEqual(qualification.qualificationRecordSha256,
  authorization.authorizedIdentity.qualificationRecordSha256,
  'EMP1_1762_QUALIFICATION_SPLIT_BRAIN_MUST_REMAIN_VISIBLE_UNTIL_GOVERNED_DISPOSITION');

console.log(JSON.stringify({
  schema: 'emp1-wrc537-gamma5-authority-identity-reconciliation-check/v1',
  status: 'PASS_DIAGNOSTIC_SPLIT_BRAIN_CONFIRMED_A3_BLOCKED',
  engineeringPassClaimed: false,
  authorityCreatedByThisCheck: false,
  sourceSha256: SOURCE_SHA,
  datasetHash: DATASET_HASH,
  authorized: {
    qualification: AUTHORIZED_QUALIFICATION,
    oracle: AUTHORIZED_ORACLE,
  },
  mutatedCurrentArtifacts: {
    qualification: MUTATED_QUALIFICATION,
    oracle: MUTATED_ORACLE,
  },
  nextAuthorityBearingDecisionRequired: true,
}, null, 2));

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
