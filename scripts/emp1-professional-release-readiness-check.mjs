#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_AUTHORIZED,
} from '../src/core/emp1/emp1-wrc537-gamma5-zero-dp-route.js';
import {
  EMP1_C_BOUNDED_PRODUCTION_ROUTES,
  EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID,
} from '../src/core/emp1/emp1-c-bounded-route-registry.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const requireRelease = process.argv.slice(2).includes('--require-release');
const unknown = process.argv.slice(2).filter((value) => value !== '--require-release');
if (unknown.length) throw gateError(`EMP1_RELEASE_READINESS_UNKNOWN_ARGUMENT:${unknown[0]}`);

const contract = await readJson('validation/emp1/release/emp1-professional-release-readiness-v1.json');
const profile = await readJson('validation/emp1/release/emp1-wrc537-gamma5-bounded-release-profile-v1.json');
const p0 = await readJson('validation/emp1/release/emp1-wrc537-gamma5-p0-source-semantics-gate-v1.json');
const caux = await readJson(
  'validation/emp1/caux2017-wrc01f/caux-pp24-31-benchmark-qualification-v3.json',
);
const currentBenchmarks = await readJson(
  'validation/emp1/release/emp1-current-benchmark-manifest-v1.json',
);
const sourceLedger = await readJson('validation/emp1/wrc537-2013/source-ledger.json');

const expectedPre = [
  '01-observation.json',
  '02-replay-receipt.json',
  '03-falsifier-receipt.json',
  '04-evidence-manifest.json',
  '05-local-execution-receipt.json',
  '06-independent-review-receipt.json',
  '07-independent-review-falsifier-receipt.json',
  '08-bounded-authorization-proposal.json',
  '09-bounded-authorization-proposal-check-receipt.json',
  '10-bounded-authorization-proposal-falsifier-receipt.json',
];
const expectedPost = [
  '11-post-promotion-exact-head-receipt.json',
  '12-post-promotion-exact-head-falsifier-receipt.json',
];
const expectedCommands = [
  'node scripts/emp1-source-custody-reconciliation-check.mjs',
  'node scripts/emp1-professional-p0-source-semantics-check.mjs --require-ready',
  'node scripts/emp1-caux-pp24-31-benchmark-check.mjs --require-direct-pdf',
  'node scripts/emp1-wrc-gamma5-zero-dp-orchestration-qualification.mjs',
  'node scripts/emp1-workbench-route-authority-currentness-falsifiers.mjs',
  'npm run build',
  'node scripts/run-playwright.mjs e2e/emp1-professional-release.spec.js',
];
const locations = ['Au', 'Al', 'Bu', 'Bl', 'Cu', 'Cl', 'Du', 'Dl'];

assert.equal(contract.schema, 'emp1-professional-release-readiness/v1');
assert.equal(contract.issue, 1389);
assert.equal(contract.releaseProfileId, 'EMP1_WRC537_2013_CYLINDRICAL_GAMMA5_ZERO_DP_V1');
assert.equal(contract.releaseProfileId, profile.releaseProfileId);
assert.equal(contract.methodIdentity, profile.method.identity);
assert.equal(contract.sourceSha256, profile.method.sourceSha256);
assert.equal(contract.datasetHash, profile.method.datasetHash);
assert.equal(contract.physicalOracleHash, profile.benchmark.physicalOracleHash);
assert.equal(contract.candidateQualificationHash,
  '9ea591a1918175b3e415d77f1adc4398645ca0503a699cfe8139d9dd3c69b4c7');
assert.deepEqual(contract.evidenceInventory.preAuthorization, expectedPre);
assert.deepEqual(contract.evidenceInventory.postPromotion, expectedPost);
assert.deepEqual(contract.requiredExecutionGates.map((gate) => gate.command), expectedCommands);
assert.ok(contract.requiredExecutionGates.every((gate) => gate.executionRequired === true));

assert.equal(profile.scope.shellFamily, 'CYLINDRICAL');
assert.equal(profile.scope.attachmentShape, 'ROUND');
assert.equal(profile.scope.variant, 'ORIGINAL');
assert.equal(profile.scope.gamma, 5);
assert.deepEqual(profile.scope.beta, { min: 0.05, max: 0.5, inclusive: true });
assert.equal(profile.scope.differentialPressure, 0);
assert.equal(profile.scope.Kn, 1);
assert.equal(profile.scope.Kb, 1);
assert.deepEqual(profile.scope.recoveryLocations, locations);
assert.equal(profile.scope.hostShellStressOnly, true);
assert.equal(profile.scope.attachmentStressCalculated, false);
assert.equal(profile.scope.nozzleStressCalculated, false);
assert.equal(profile.scope.absoluteMaximumAssured, false);
assert.equal(profile.scope.continuousJunctureSearchPerformed, false);
assert.equal(profile.scope.interpolationAllowed, false);
assert.equal(profile.scope.crossVariantFallbackAllowed, false);
assert.equal(profile.scope.offAxisMaximumAuthorized, false);
assert.equal(profile.codeCompliance.performed, false);
assert.equal(profile.codeCompliance.authorized, false);

assert.deepEqual(contract.securityBoundary, {
  scope: 'EMP1_RELEASE_BOUNDARY_ONLY',
  requiresStrictSourceAndCurrentnessValidation: true,
  uiAuthoredEngineeringAuthorityAllowed: false,
  staleNumericalEvidenceMayBeCurrentResult: false,
  broaderApplicationSecurityCertificationClaimed: false,
});
assert.deepEqual(contract.replayAndExportBoundary, {
  persistedReloadCurrentnessCoveredBy: 'scripts/emp1-workbench-route-authority-currentness-falsifiers.mjs',
  separateEmp1CNumericalExportConsumerFound: false,
  workbenchExportExportsActiveSourceDocumentNotRetainedCNumerics: true,
  futureNumericExportMustConsumeReportableProjection: true,
});
assert.equal(contract.policy.encodedGateIsExecutionPass, false);
assert.equal(contract.policy.notRunMayBePromotedToPass, false);
assert.equal(contract.policy.productionOutputMayRegenerateOracle, false);
assert.equal(contract.policy.toleranceMayBeWidenedAfterMismatch, false);
assert.equal(contract.policy.releaseMayProceedWithMissingEvidence, false);
assert.equal(contract.policy.suspendedOnlyCheckMayBeUsedAsPostPromotionReleaseGate, false);
assert.equal(contract.policy.releaseModeExitCodeWhenBlocked, 2);

assert.equal(sourceLedger.rawPdfSha256, contract.sourceSha256);
assert.equal(sourceLedger.custodyState, 'VERIFIED');
assert.equal(sourceLedger.qualificationState, 'PASS_SOURCE_CUSTODY');
assert.equal(sourceLedger.reconciliation.productionObservationUsedToSetAuthority, false);
assert.equal(
  currentBenchmarks.caux.currentQualification.semanticHash,
  caux.semanticHash,
);
assert.equal(
  currentBenchmarks.caux.currentQualification.qualificationId,
  caux.qualificationId,
);
assert.equal(currentBenchmarks.caux.currentQualification.directPdfPageReobservation, 'PASS');
assert.equal(
  currentBenchmarks.caux.currentQualification.gammaRadiusBasisForThisBenchmark,
  'PASS_RECONCILED',
);
assert.equal(currentBenchmarks.caux.routeRelationship.engineeringUseAuthorized, false);
assert.equal(currentBenchmarks.caux.routeRelationship.comparisonQualificationAvailable, true);

const evidenceDirectories = await findEvidenceDirectories(
  resolve(root, 'validation/emp1/wrc537-2013'),
);
const evidenceInventory = [];
for (const directory of evidenceDirectories) {
  const present = [];
  for (const file of [...expectedPre, ...expectedPost]) {
    if (await exists(join(directory, file))) present.push(file);
  }
  const complete01To10 = expectedPre.every((file) => present.includes(file));
  const complete01To12 = [...expectedPre, ...expectedPost].every((file) => present.includes(file));
  const postPromotion = complete01To12
    ? await verifyPostPromotionReceipts(directory)
    : { verified: false, authorizationHeadSha: null, reasons: ['EVIDENCE_01_TO_12_INCOMPLETE'] };
  evidenceInventory.push({
    directory: portableRelative(directory),
    preAuthorizationCount: expectedPre.filter((file) => present.includes(file)).length,
    postPromotionCount: expectedPost.filter((file) => present.includes(file)).length,
    complete01To10,
    complete01To12,
    postPromotionReceiptsVerified: postPromotion.verified,
    authorizationHeadSha: postPromotion.authorizationHeadSha,
    receiptVerificationReasons: postPromotion.reasons,
  });
}
const complete01To10 = evidenceInventory.find((entry) => entry.complete01To10) ?? null;
const qualified01To12 = evidenceInventory.find((entry) =>
  entry.complete01To12 && entry.postPromotionReceiptsVerified) ?? null;

const route = EMP1_C_BOUNDED_PRODUCTION_ROUTES.find(
  (entry) => entry.routeId === EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID,
);
assert.ok(route, 'EMP1_RELEASE_READINESS_BOUNDED_ROUTE_REQUIRED');
const sourceReady = sourceLedger.qualificationState === 'PASS_SOURCE_CUSTODY';
const p0Ready = p0.blockerCount === 0
  && p0.state !== 'BLOCKED_P0_SOURCE_SEMANTICS'
  && p0.gates.every((gate) => !String(gate.currentStatus).startsWith('BLOCKED'));
const cauxDirectPdfReady = caux.source.directPdfPageReobservation === 'PASS'
  || caux.source.directPdfPageReobservation === 'PASS_DIRECT_PDF_PAGE_REOBSERVATION';
const boundedAuthorizationReady = EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_AUTHORIZED === true
  && route.registered === true
  && route.engineeringUseAuthorized === true;

const prerequisiteStates = {
  sourceCustody: sourceReady ? 'PASS' : 'BLOCKED',
  p0SourceSemantics: p0Ready ? 'PASS' : 'BLOCKED',
  cauxDirectPdfReobservation: cauxDirectPdfReady ? 'PASS' : 'NOT_RUN',
  evidence01To10: complete01To10 ? 'PASS' : 'NOT_GENERATED',
  boundedAuthorization: boundedAuthorizationReady ? 'PASS' : 'NOT_AUTHORIZED',
  evidence11To12: qualified01To12 ? 'PASS' : 'NOT_GENERATED_OR_UNVERIFIED',
};
const dynamicBlockers = [];
if (!sourceReady) dynamicBlockers.push('SOURCE_CUSTODY_NOT_READY');
if (!p0Ready) dynamicBlockers.push('P0_SOURCE_SEMANTICS_NOT_READY');
if (!cauxDirectPdfReady) dynamicBlockers.push('CAUX_DIRECT_PDF_REOBSERVATION_NOT_RUN');
if (!complete01To10) dynamicBlockers.push('PR_D_EVIDENCE_01_TO_10_NOT_GENERATED');
if (!boundedAuthorizationReady) dynamicBlockers.push('PR_E_BOUNDED_AUTHORIZATION_NOT_EXECUTED');
if (!qualified01To12) dynamicBlockers.push('PR_F_EVIDENCE_11_TO_12_NOT_GENERATED_OR_UNVERIFIED');

const prerequisitesReady = dynamicBlockers.length === 0;
const currentFrozenSnapshotMatchesBlockedState = contract.state === 'BLOCKED_FAIL_CLOSED'
  && contract.releaseReady === false
  && contract.authority.productionRouteAuthorized === false
  && contract.authority.registryRegistered === false
  && contract.authority.engineeringUseAuthorized === false
  && contract.authority.globalEmp1CRouteAuthority === false
  && contract.authority.codeComplianceAuthorized === false
  && contract.authority.releaseQualified === false
  && contract.authority.deploymentAuthorized === false;
assert.equal(currentFrozenSnapshotMatchesBlockedState, true,
  'EMP1_RELEASE_READINESS_FROZEN_BLOCKED_SNAPSHOT_MUST_REMAIN_FAIL_CLOSED');

const result = {
  schema: 'emp1-professional-release-readiness-check/v1',
  status: prerequisitesReady
    ? 'PASS_RELEASE_PREREQUISITES_READY_FOR_EXACT_CANDIDATE_EXECUTION'
    : 'PASS_RELEASE_POLICY_FAIL_CLOSED_CURRENTLY_BLOCKED',
  releaseProfileId: contract.releaseProfileId,
  prerequisiteStates,
  dynamicBlockers,
  evidenceInventory,
  currentRuntimeAuthority: {
    productionRouteAuthorized: EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_AUTHORIZED,
    registryRegistered: route.registered === true,
    engineeringUseAuthorized: route.engineeringUseAuthorized === true,
    globalEmp1CRouteAuthority: route.globalEmp1CRouteAuthority === true,
    releaseQualified: route.releaseQualified === true,
  },
  exactCandidateExecutionRequiredAfterPrerequisites: true,
  promotionCompatibleProductGateRequired: true,
  persistedReloadReplayRequired: true,
  deploymentEvidenceRequiredAfterCandidateExecution: true,
  codeComplianceAuthorizedByThisGate: false,
  deploymentAuthorizedByThisGate: false,
};
console.log(JSON.stringify(result, null, 2));
if (requireRelease && !prerequisitesReady) process.exit(2);

async function verifyPostPromotionReceipts(directory) {
  const reasons = [];
  try {
    const eleven = JSON.parse(await readFile(join(directory, expectedPost[0]), 'utf8'));
    const twelve = JSON.parse(await readFile(join(directory, expectedPost[1]), 'utf8'));
    if (eleven.status !==
      'PASS_POST_PROMOTION_EXACT_HEAD_BOUNDED_ROUTE_AUTHORIZATION_QUALIFIED_GLOBAL_C_STILL_BLOCKED') {
      reasons.push('RECEIPT_11_STATUS_INVALID');
    }
    if (twelve.status !== 'PASS_POST_PROMOTION_EXACT_HEAD_GATE_ANTI_FORGERY_FALSIFIERS') {
      reasons.push('RECEIPT_12_STATUS_INVALID');
    }
    if (!/^[0-9a-f]{40}$/u.test(eleven.observedAuthorizationHeadSha ?? '')) {
      reasons.push('RECEIPT_11_AUTHORIZATION_HEAD_INVALID');
    }
    if (eleven.observedAuthorizationHeadSha !== twelve.observedAuthorizationHeadSha) {
      reasons.push('POST_PROMOTION_AUTHORIZATION_HEAD_MISMATCH');
    }
    if (eleven.authority?.productionRouteAuthorizedOnObservedHead !== true
      || eleven.authority?.globalEmp1CRouteAuthority !== false
      || eleven.authority?.codeComplianceAuthorized !== false
      || eleven.authority?.releaseQualified !== false) {
      reasons.push('RECEIPT_11_AUTHORITY_BOUNDARY_INVALID');
    }
    if (twelve.authorization?.productionRouteAuthorizedOnObservedHead !== true
      || twelve.authorization?.globalEmp1CRouteAuthority !== false
      || twelve.authorization?.codeComplianceAuthorized !== false
      || twelve.authorization?.releaseQualified !== false) {
      reasons.push('RECEIPT_12_AUTHORITY_BOUNDARY_INVALID');
    }
    if (eleven.gateSemanticHash !== semanticHash(eleven, 'gateSemanticHash')) {
      reasons.push('RECEIPT_11_SEMANTIC_HASH_INVALID');
    }
    if (twelve.falsifierSemanticHash !== semanticHash(twelve, 'falsifierSemanticHash')) {
      reasons.push('RECEIPT_12_SEMANTIC_HASH_INVALID');
    }
    return {
      verified: reasons.length === 0,
      authorizationHeadSha: eleven.observedAuthorizationHeadSha ?? null,
      reasons,
    };
  } catch (error) {
    return {
      verified: false,
      authorizationHeadSha: null,
      reasons: [`POST_PROMOTION_RECEIPT_READ_FAILED:${error?.code ?? 'UNKNOWN'}`],
    };
  }
}

async function findEvidenceDirectories(start) {
  const out = [];
  await walk(start, 0);
  return out.sort();

  async function walk(directory, depth) {
    if (depth > 3) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    const names = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
    if (names.has('01-observation.json')) out.push(directory);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      await walk(join(directory, entry.name), depth + 1);
    }
  }
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), 'utf8'));
}
function portableRelative(path) {
  return relative(root, path).replaceAll('\\', '/');
}
function semanticHash(value, hashField) {
  const { [hashField]: _hash, status: _status, ...payload } = value;
  return sha256Canonical(payload);
}
function sha256Canonical(value) {
  return createHash('sha256').update(JSON.stringify(sortValue(value)), 'utf8').digest('hex');
}
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value;
}
function gateError(code) {
  const error = new TypeError(code);
  error.code = code;
  return error;
}
