#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { semanticHash } from '../src/core/shared-primitives/canonical-json.js';
import {
  currentEmp1WorkbenchRouteAuthority,
} from '../src/workspace/emp1-workbench-product-run.js';
import {
  EMP1_WORKBENCH_EXECUTION_CURRENTNESS,
  EMP1_WORKBENCH_PRODUCT_EXECUTION_SCHEMA,
  EMP1_WORKBENCH_ROUTE_AUTHORITY_CHANGED,
  classifyEmp1WorkbenchExecutionCurrentness,
  emp1WorkbenchInputHashes,
  projectEmp1WorkbenchCState,
  projectEmp1WorkbenchRunReadiness,
} from '../src/workspace/emp1-workbench-run-state.js';
import { createEmp1WorkbenchQualificationSample } from '../src/workspace/emp1-workbench-qualification-sample.js';

const CURRENT_QUALIFICATION = '9ea591a1918175b3e415d77f1adc4398645ca0503a699cfe8139d9dd3c69b4c7';
const CURRENT_ORACLE = '60771128f8261057bf73fa6c183ace5df25f3ee98f417f58da25a6135d8b2e18';
const SUPERSEDED_QUALIFICATION = 'db477df8596e9fd3fc830fa063d90c39558ed770d4cc67b3605e325a6216d665';
const SUPERSEDED_ORACLE = '0aec3815479ea092e61bad3858519c8495f9b5cbe6ac711e76ce5bd6f80a806c';
const SOURCE_SHA = '698fcdc3e676e3bc6bbf710bc28ea8b666ac9511a81a0067a5d01088ae4c27b2';
const DATASET_HASH = 'fb440a292f8794430977f60f5365a678a9aff62a4dae3397621902964a0db73c';
const ROUTE_ID = 'EMP1.C.WRC537.CYLINDRICAL.ORIGINAL.GAMMA5.ZERO_DP';
const STALE_OCCURRENCE_POLICY =
  'validation/emp1/wrc537-2013/gamma5-authority-stale-identity-occurrences-v1.json';

const [
  ledger,
  occurrencePolicy,
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
  readJson(STALE_OCCURRENCE_POLICY),
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

const liveAuthority = currentEmp1WorkbenchRouteAuthority();
assert.equal(liveAuthority.productionUseAuthorized, true);
assert.equal(liveAuthority.snapshot.routeId, ROUTE_ID);
assert.equal(liveAuthority.snapshot.postAuthorityOracleSemanticHash, CURRENT_ORACLE);
assert.equal(liveAuthority.snapshot.registry.method.qualificationRecordSha256, CURRENT_QUALIFICATION);
assert.equal(liveAuthority.snapshot.registry.method.sourceDocumentSha256, SOURCE_SHA);
assert.equal(liveAuthority.snapshot.registry.method.datasetHash, DATASET_HASH);

const authorityMutationFalsifiers = proveAuthorityOnlyCurrentness(liveAuthority);
const staleHashSearch = await proveRoleAwareStaleHashSearch(occurrencePolicy);

const currentAuthoritySurfaces = [
  ['oracle', JSON.stringify(oracle)],
  ['qualification', JSON.stringify(qualification)],
  ['authorization', JSON.stringify(authorization)],
  ['routeSource', routeSource],
  ['registrySource', registrySource],
  ['liveRouteAuthoritySnapshot', JSON.stringify(liveAuthority.snapshot)],
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
  schema: 'emp1-wrc537-gamma5-authority-identity-reconciliation-check/v2',
  status: 'PASS_CURRENT_AUTHORITY_IDENTITIES_RECONCILED_WITH_AUTHORITY_STALENESS_AND_ROLE_AWARE_HASH_GUARDS_STANDARD_NUMERICAL_EVIDENCE_STILL_NOT_RUN',
  engineeringPassClaimed: false,
  authorityCreatedByThisCheck: false,
  sourceSha256: SOURCE_SHA,
  datasetHash: DATASET_HASH,
  currentAuthority: {
    routeId: ROUTE_ID,
    qualification: CURRENT_QUALIFICATION,
    oracle: CURRENT_ORACLE,
    routeAuthorityHash: liveAuthority.routeAuthorityHash,
    registered: true,
    boundedEngineeringUseAuthorized: true,
    globalEmp1CRouteAuthority: false,
    codeComplianceAuthorized: false,
    releaseQualified: false,
  },
  authorityMutationFalsifiers,
  staleHashSearch,
  supersededMutationProvenance: {
    qualification: SUPERSEDED_QUALIFICATION,
    oracle: SUPERSEDED_ORACLE,
    allowedInActiveAuthoritySurfaces: false,
  },
  standardNumericalQualification: 'NOT_RUN_NOT_CLAIMED',
}, null, 2));

function proveAuthorityOnlyCurrentness(currentAuthority) {
  const sample = createEmp1WorkbenchQualificationSample();
  const { aDocument, bDocument, runInput } = sample;
  const readiness = projectEmp1WorkbenchRunReadiness({ aDocument, bDocument, runInput });
  assert.equal(readiness.state, 'READY');
  const retained = retainedNumericalExecution(
    currentAuthority.snapshot,
    aDocument,
    bDocument,
    runInput,
  );
  const current = classifyEmp1WorkbenchExecutionCurrentness({
    execution: retained,
    aDocument,
    bDocument,
    runInput,
    currentRouteAuthority: currentAuthority,
  });
  assert.equal(current.state, EMP1_WORKBENCH_EXECUTION_CURRENTNESS.CURRENT);
  assert.equal(current.inputCurrent, true);
  assert.equal(current.cAuthorityCurrent, true);
  assert.equal(current.cReportable, true);

  const qualificationChanged = mutateAuthority(currentAuthority, (snapshot) => {
    snapshot.registry.method.qualificationRecordSha256 = 'f'.repeat(64);
  });
  const qualificationState = classifyEmp1WorkbenchExecutionCurrentness({
    execution: retained,
    aDocument,
    bDocument,
    runInput,
    currentRouteAuthority: qualificationChanged,
  });
  const qualificationView = projectEmp1WorkbenchCState({
    readiness,
    execution: retained,
    currentness: qualificationState,
    routeAuthority: qualificationChanged,
  });
  assertAuthorityOnlyStale({
    retained,
    currentAuthority: qualificationChanged,
    currentness: qualificationState,
    view: qualificationView,
    label: 'qualification',
  });

  const oracleChanged = mutateAuthority(currentAuthority, (snapshot) => {
    snapshot.postAuthorityOracleSemanticHash = 'e'.repeat(64);
  });
  const oracleState = classifyEmp1WorkbenchExecutionCurrentness({
    execution: retained,
    aDocument,
    bDocument,
    runInput,
    currentRouteAuthority: oracleChanged,
  });
  const oracleView = projectEmp1WorkbenchCState({
    readiness,
    execution: retained,
    currentness: oracleState,
    routeAuthority: oracleChanged,
  });
  assertAuthorityOnlyStale({
    retained,
    currentAuthority: oracleChanged,
    currentness: oracleState,
    view: oracleView,
    label: 'oracle',
  });

  return {
    initialAuthorityHash: currentAuthority.routeAuthorityHash,
    qualificationMutationAuthorityHash: qualificationChanged.routeAuthorityHash,
    oracleMutationAuthorityHash: oracleChanged.routeAuthorityHash,
    unchangedInputsRemainCurrent: qualificationState.inputCurrent && oracleState.inputCurrent,
    qualificationMutationRetainedCReportable: qualificationState.cReportable,
    oracleMutationRetainedCReportable: oracleState.cReportable,
    rerunRequiredForBothMutations:
      qualificationView.buttonEnabled === true && oracleView.buttonEnabled === true,
    oldAuthorityHashRetainedForAudit:
      qualificationView.executionAuthorityHash === currentAuthority.routeAuthorityHash
      && oracleView.executionAuthorityHash === currentAuthority.routeAuthorityHash,
  };
}

function assertAuthorityOnlyStale({ retained, currentAuthority, currentness, view, label }) {
  assert.equal(currentness.state, EMP1_WORKBENCH_EXECUTION_CURRENTNESS.STALE,
    `EMP1_1762_${label.toUpperCase()}_AUTHORITY_MUTATION_MUST_STALE_C`);
  assert.equal(currentness.inputCurrent, true,
    `EMP1_1762_${label.toUpperCase()}_AUTHORITY_MUTATION_MUST_NOT_STALE_INPUTS`);
  assert.equal(currentness.cAuthorityCurrent, false);
  assert.equal(currentness.cReportable, false);
  assert.ok(currentness.reasons.includes(EMP1_WORKBENCH_ROUTE_AUTHORITY_CHANGED));
  assert.equal(view.state, 'STALE_AUTHORITY');
  assert.equal(view.currentResultAvailable, false);
  assert.equal(view.reportableResult, null);
  assert.equal(view.retainedResultAvailable, true);
  assert.equal(view.buttonEnabled, true);
  assert.equal(view.executionAuthorityHash, retained.authority.routeAuthorityHash);
  assert.equal(view.currentAuthorityHash, currentAuthority.routeAuthorityHash);
  assert.notEqual(view.executionAuthorityHash, view.currentAuthorityHash);
  assert.equal(view.currentExecutionEvidence.stresses.Au, 72.67281563686576);
}

function retainedNumericalExecution(routeAuthoritySnapshot, aDocument, bDocument, runInput) {
  return {
    schema: EMP1_WORKBENCH_PRODUCT_EXECUTION_SCHEMA,
    productId: 'EMP.1',
    sourceHash: 'emp1-1762-retained-source',
    inputHashes: emp1WorkbenchInputHashes({ aDocument, bDocument, runInput }),
    authority: {
      boundedLocalRouteExecuted: true,
      routeAuthorityHash: routeAuthoritySnapshot.semanticHash,
      routeAuthoritySnapshot,
      globalEmp1CRouteAuthority: false,
      codeComplianceProduced: false,
      releaseQualified: false,
    },
    result: {
      localCorrelation: {
        schema: 'emp1-local-correlation-result/v1',
        productionRouteAuthority: true,
        resultHash: 'emp1-1762-retained-q1-result',
        stresses: { Au: 72.67281563686576 },
      },
    },
    retainedLocalCorrelationHistory: [],
  };
}

function mutateAuthority(authority, mutate) {
  const semanticPayload = structuredClone(authority.snapshot);
  delete semanticPayload.semanticHash;
  mutate(semanticPayload);
  const snapshot = {
    ...semanticPayload,
    semanticHash: semanticHash(semanticPayload),
  };
  return {
    ...structuredClone(authority),
    routeAuthorityHash: snapshot.semanticHash,
    snapshot,
  };
}

async function proveRoleAwareStaleHashSearch(policyRecord) {
  assert.equal(policyRecord.schema,
    'emp1-wrc537-gamma5-authority-stale-identity-occurrences/v1');
  assert.equal(policyRecord.authorityCreatedByThisArtifact, false);
  assert.equal(policyRecord.supersededIdentities.qualificationRecordSha256,
    SUPERSEDED_QUALIFICATION);
  assert.equal(policyRecord.supersededIdentities.postAuthorityOracleSemanticHash,
    SUPERSEDED_ORACLE);
  const allowedClassifications = new Set(policyRecord.allowedClassifications);
  const policy = policyRecord.policy ?? [];
  for (const row of policy) {
    assert.ok(allowedClassifications.has(row.classification),
      `EMP1_1762_STALE_HASH_POLICY_CLASSIFICATION_INVALID:${row.path}`);
    assert.equal(row.activeCurrentAuthority, false,
      `EMP1_1762_SUPERSEDED_HASH_POLICY_CANNOT_AUTHORIZE_CURRENT_SURFACE:${row.path}`);
    assert.ok(typeof row.semanticRole === 'string' && row.semanticRole.length > 0);
  }

  const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0').filter(Boolean);
  const identities = [SUPERSEDED_QUALIFICATION, SUPERSEDED_ORACLE];
  const occurrences = [];
  for (const path of tracked) {
    const bytes = await readFile(path);
    for (const identity of identities) {
      const count = countBufferOccurrences(bytes, Buffer.from(identity));
      if (!count) continue;
      const role = policy.find((row) =>
        row.path === path && row.identityValues?.includes(identity));
      assert.ok(role,
        `EMP1_1762_UNCLASSIFIED_SUPERSEDED_IDENTITY:${identity}:${path}`);
      assert.notEqual(role.classification, 'ACTIVE_CURRENT_AUTHORITY',
        `EMP1_1762_SUPERSEDED_IDENTITY_ACTIVE:${identity}:${path}`);
      assert.notEqual(role.classification, 'INVALID_STALE_REFERENCE',
        `EMP1_1762_INVALID_STALE_REFERENCE_REMAINS:${identity}:${path}`);
      occurrences.push({
        path,
        identity,
        count,
        classification: role.classification,
        semanticRole: role.semanticRole,
      });
    }
  }
  assert.ok(occurrences.some((row) => row.identity === SUPERSEDED_QUALIFICATION));
  assert.ok(occurrences.some((row) => row.identity === SUPERSEDED_ORACLE));
  assert.ok(occurrences.every((row) => row.classification !== 'ACTIVE_CURRENT_AUTHORITY'));
  return {
    schema: policyRecord.schema,
    trackedFilesScanned: tracked.length,
    classifiedSupersededIdentityFiles: occurrences.length,
    classifiedSupersededIdentityOccurrences:
      occurrences.reduce((sum, row) => sum + row.count, 0),
    unclassifiedOccurrences: 0,
    activeCurrentAuthorityOccurrences: 0,
  };
}

function countBufferOccurrences(buffer, needle) {
  let count = 0;
  let offset = 0;
  while ((offset = buffer.indexOf(needle, offset)) !== -1) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

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
