#!/usr/bin/env node
/**
 * #1768 / WRC-03 Stage-C static historical-to-current drift check.
 *
 * This is intentionally not a numerical qualification engine. It proves that
 * the exact-gamma5 production dependency closure and frozen authority identities
 * at the historical promoted head remain byte-identical at the observed current
 * head, while preserving the historical truth that standard evidence 01-12 was
 * never generated.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const HISTORICAL_STAGE_B = '14c648d485cf386f28c6817a068b7eb5da1f7689';
const PREFLIGHT_PATH =
  'validation/emp1/wrc537-2013/gamma5-stagec-preflight-v1.json';
const AUTHORIZATION_PATH =
  'validation/emp1/wrc537-2013/gamma5-zero-dp-route-authorization-v1.json';
const QUALIFICATION_PATH =
  'validation/emp1/wrc537-2013/gamma5-zero-dp-route-qualification-v2.json';
const ORACLE_PATH =
  'validation/emp1/wrc537-2013/gamma5-post-authority-physical-oracle-v1.json';
const RECONCILIATION_PATH =
  'validation/emp1/wrc537-2013/gamma5-authority-identity-reconciliation-v1.json';
const SOURCE_PROFILE_PATH =
  'validation/emp1/wrc537-2013/bounded-source-semantics-v1.json';
const H1_TRACE_PATH =
  'validation/emp1/wrc537-2013/gamma5-independent-handcalc-trace-v1.json';
const REGISTRY_PATH = 'src/core/emp1/emp1-c-bounded-route-registry.js';

const options = parseArgs(process.argv.slice(2));
const actualHead = git(['rev-parse', 'HEAD']);
if (options.expectedHead) {
  assert.match(options.expectedHead, /^[0-9a-f]{40}$/u, 'expected head SHA');
  assert.equal(actualHead, options.expectedHead,
    `EMP1_STAGEC_EXACT_HEAD_MISMATCH:${actualHead}:${options.expectedHead}`);
}
assert.equal(
  spawnSync('git', ['merge-base', '--is-ancestor', HISTORICAL_STAGE_B, actualHead],
    { cwd: root }).status,
  0,
  'EMP1_STAGEC_HISTORICAL_STAGE_B_MUST_BE_ANCESTOR',
);

const [
  preflight,
  authorization,
  qualification,
  oracle,
  reconciliation,
  sourceProfile,
  h1Trace,
  currentRegistry,
] = await Promise.all([
  readJson(PREFLIGHT_PATH),
  readJson(AUTHORIZATION_PATH),
  readJson(QUALIFICATION_PATH),
  readJson(ORACLE_PATH),
  readJson(RECONCILIATION_PATH),
  readJson(SOURCE_PROFILE_PATH),
  readJson(H1_TRACE_PATH),
  readText(REGISTRY_PATH),
]);

assert.equal(preflight.schema, 'emp1-wrc537-gamma5-stagec-preflight/v1');
assert.equal(preflight.issue, 1768);
assert.equal(preflight.parentIssue, 1760);
assert.equal(preflight.historicalChain.stageB.headSha, HISTORICAL_STAGE_B);
assert.equal(preflight.status,
  'PASS_STATIC_STAGEC_PREFLIGHT_STANDARD_EXECUTABLE_EVIDENCE_STILL_MISSING');

// Historical owner-override truth is still byte-identical and still explicitly
// records missing standard evidence. This checker may not turn those fields green.
assert.equal(
  gitBlob(HISTORICAL_STAGE_B, AUTHORIZATION_PATH),
  preflight.historicalChain.authorizationRecord.gitBlobSha1AtStageB,
);
assert.equal(
  gitBlob('HEAD', AUTHORIZATION_PATH),
  preflight.historicalChain.authorizationRecord.gitBlobSha1AtCurrent,
);
assert.equal(
  preflight.historicalChain.authorizationRecord.gitBlobSha1AtStageB,
  preflight.historicalChain.authorizationRecord.gitBlobSha1AtCurrent,
);
assert.equal(authorization.authorizationRecordSemanticHash,
  preflight.historicalChain.authorizationRecord.semanticHash);
assert.equal(authorization.standardEvidenceContract.satisfied, false);
assert.equal(authorization.standardEvidenceContract.files01Through10, 'NOT_GENERATED');
assert.equal(authorization.standardEvidenceContract.numericalQualification,
  'NOT_RUN_NOT_CLAIMED');
assert.equal(authorization.standardEvidenceContract.engineeringPassClaimed, false);
assert.equal(authorization.postPromotionQualification.completed, false);
assert.equal(authorization.postPromotionQualification.currentExecutionState, 'NOT_RUN');
assert.equal(preflight.historicalChain.stageA.files01Through10, 'NOT_GENERATED');
assert.equal(preflight.historicalChain.stageB.files11Through12, 'NOT_GENERATED');

// Frozen current authority identities remain the exact historical Stage-B bytes.
assert.equal(qualification.qualificationRecordSha256,
  preflight.protectedCurrentIdentities.routeQualificationSha256);
assert.equal(oracle.semanticHash,
  preflight.protectedCurrentIdentities.postAuthorityOracleSemanticHash);
assert.equal(
  qualification.semanticPayload.benchmarkQualification.benchmarkHash,
  oracle.semanticHash,
);
assert.equal(
  qualification.semanticPayload.loadProducerQualificationSha256,
  preflight.protectedCurrentIdentities.loadProducerQualificationSha256,
);
assert.equal(
  qualification.semanticPayload.sourceDocumentSha256,
  preflight.protectedCurrentIdentities.sourceDocumentSha256,
);
assert.equal(
  qualification.semanticPayload.datasetHash,
  preflight.protectedCurrentIdentities.datasetHash,
);

// Complete bounded exact-gamma5 dependency closure must have the same Git blob
// at Stage B and the current observed head.
for (const item of preflight.byteIdentityFromStageBToCurrent) {
  const historicalBlob = gitBlob(HISTORICAL_STAGE_B, item.path);
  const currentBlob = gitBlob('HEAD', item.path);
  assert.equal(historicalBlob, item.gitBlobSha1,
    `EMP1_STAGEC_HISTORICAL_BLOB_DRIFT:${item.path}`);
  assert.equal(currentBlob, item.gitBlobSha1,
    `EMP1_STAGEC_CURRENT_BLOB_DRIFT:${item.path}`);
  assert.equal(currentBlob, historicalBlob,
    `EMP1_STAGEC_ACTIVE_DEPENDENCY_CHANGED:${item.path}`);
}

// Registry changed structurally to add a separate interpolated comparison route.
// Prove the exact gamma5 route object itself is textually identical after
// stripping comments/formatting; the new interpolated route cannot silently
// rewrite the original gamma5 entry.
const historicalRegistry = gitShow(HISTORICAL_STAGE_B, REGISTRY_PATH);
assert.equal(gitBlob(HISTORICAL_STAGE_B, REGISTRY_PATH),
  preflight.registryDrift.stageBGitBlobSha1);
assert.equal(gitBlob('HEAD', REGISTRY_PATH),
  preflight.registryDrift.currentGitBlobSha1);
assert.notEqual(
  preflight.registryDrift.stageBGitBlobSha1,
  preflight.registryDrift.currentGitBlobSha1,
);
const historicalGamma5Object = extractObjectAfter(
  historicalRegistry,
  'export const EMP1_C_BOUNDED_PRODUCTION_ROUTES = Object.freeze([Object.freeze(',
);
const currentGamma5Object = extractObjectAfter(
  currentRegistry,
  'const EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE = Object.freeze(',
);
assert.equal(
  normalizeJs(historicalGamma5Object),
  normalizeJs(currentGamma5Object),
  'EMP1_STAGEC_GAMMA5_REGISTRY_OBJECT_SEMANTIC_TEXT_DRIFT',
);
assert.match(currentRegistry,
  /EMP1_C_WRC537_INTERPOLATED_GAMMA_ROUTE_ID/u);
assert.match(currentRegistry,
  /engineeringUseAuthorized:\s*false/u);
assert.equal(preflight.registryDrift.classification, 'PRODUCT_PATH_ONLY');
assert.equal(preflight.registryDrift.interpolatedRouteEngineeringUseAuthorized, false);

// Current evidence additions bind but do not mutate historical production bytes.
assert.equal(sourceProfile.semanticHash,
  preflight.protectedCurrentIdentities.wrc02SourceSemanticsProfileSemanticHash);
assert.equal(sourceProfile.authorityModel.methodSourceSemanticsReady, true);
assert.equal(sourceProfile.authorityModel.caseApplicabilityRequiresEvidence, true);
assert.equal(sourceProfile.authorityModel.releaseAuthorityGranted, false);
assert.equal(gitBlob('HEAD', H1_TRACE_PATH),
  preflight.protectedCurrentIdentities.h1Trace.gitBlobSha1);
assert.equal(h1Trace.status, preflight.protectedCurrentIdentities.h1Trace.status);
assert.deepEqual(h1Trace.authority.productionImports, []);
assert.equal(h1Trace.authority.productionObservationUsed, false);
assert.equal(h1Trace.authority.productionAuthority, false);
assert.equal(h1Trace.authority.releaseAuthority, false);

// Preserve the already-reviewed transient ULP incident as historical provenance;
// active current identities are restored and no split brain exists.
assert.equal(reconciliation.a3Disposition.requiredClassification,
  preflight.transientHistory.classification);
assert.equal(reconciliation.driftOrigin.oracleMutationCommit,
  preflight.transientHistory.observedTransientOracleMutationCommit);
assert.equal(reconciliation.driftOrigin.qualificationCascadeCommit,
  preflight.transientHistory.observedTransientQualificationCascadeCommit);
assert.equal(reconciliation.currentSplitBrain, false);
assert.equal(reconciliation.currentAuthorityIdentity.qualificationRecordSha256,
  qualification.qualificationRecordSha256);
assert.equal(reconciliation.currentAuthorityIdentity.postAuthorityOracleSemanticHash,
  oracle.semanticHash);

// Static drift result must remain fail-closed with respect to executable
// qualification: byte identity is not a substitute for Stage A/B receipts or
// current numerical re-observation.
assert.deepEqual(preflight.stageCStaticClassification, {
  sourceSemanticChange: false,
  datasetChange: false,
  loadProducerChange: false,
  table5MechanicsChange: false,
  signRecoveryChange: false,
  stressIntensityChange: false,
  toleranceChange: false,
  applicabilityChange: false,
  exactGamma5AuthorityIdentityChange: false,
  productPathOnlyChange: true,
  evidenceOnlyAdditions: true,
  conclusion: 'PASS_STATIC_NO_ACTIVE_BOUNDED_GAMMA5_METHOD_DRIFT_FROM_STAGE_B',
});
assert.deepEqual(preflight.blockers, [
  'GENUINE_STAGE_A_FILES_01_TO_10_MISSING',
  'GENUINE_STAGE_B_FILES_11_TO_12_MISSING',
  'CURRENT_EXACT_HEAD_NUMERICAL_REOBSERVATION_NOT_RUN',
]);
assert.equal(preflight.authorityBoundary.staticDriftPreflightIsNumericalQualification, false);
assert.equal(preflight.authorityBoundary.staticByteIdentityMaySubstituteForHistoricalEvidence, false);
assert.equal(preflight.authorityBoundary.h1TraceMaySubstituteForHistoricalEvidence, false);
assert.equal(preflight.executionState.engineeringPassClaimed, false);

const record = {
  schema: 'emp1-wrc537-gamma5-stagec-drift-check/v1',
  observedHeadSha: actualHead,
  historicalStageBHeadSha: HISTORICAL_STAGE_B,
  byteIdenticalProtectedDependencies:
    preflight.byteIdentityFromStageBToCurrent.length,
  gamma5RegistryObjectSemantics: 'IDENTICAL',
  registryOverallChangeClassification: preflight.registryDrift.classification,
  staticDriftClassification: preflight.stageCStaticClassification,
  historicalEvidence: {
    files01Through10: authorization.standardEvidenceContract.files01Through10,
    numericalQualification: authorization.standardEvidenceContract.numericalQualification,
    files11Through12: authorization.postPromotionQualification.completed
      ? 'GENERATED' : 'NOT_GENERATED',
  },
  currentExecutionRequired: true,
  currentNumericalPassClaimed: false,
  authorityCreatedByThisCheck: false,
  globalEmp1CAuthority: false,
  codeComplianceAuthorized: false,
  releaseQualified: false,
  status: 'PASS_STATIC_NO_ACTIVE_GAMMA5_METHOD_DRIFT_EXECUTABLE_QUALIFICATION_STILL_REQUIRED',
};
if (options.writeRecord) {
  await writeFile(resolve(root, options.writeRecord),
    `${JSON.stringify(record, null, 2)}\n`, 'utf8');
}
console.log(JSON.stringify(record, null, 2));

function parseArgs(args) {
  const out = { expectedHead: null, writeRecord: null };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--expected-head') out.expectedHead = args[++index] ?? null;
    else if (args[index] === '--write-record' || args[index] === '--record') {
      out.writeRecord = args[++index] ?? null;
    } else {
      throw new TypeError(`EMP1_STAGEC_UNKNOWN_ARGUMENT:${args[index]}`);
    }
  }
  return out;
}
function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}
function gitBlob(ref, path) {
  return git(['rev-parse', `${ref}:${path}`]);
}
function gitShow(ref, path) {
  return execFileSync('git', ['show', `${ref}:${path}`],
    { cwd: root, encoding: 'utf8' });
}
function extractObjectAfter(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert.ok(markerIndex >= 0, `EMP1_STAGEC_REGISTRY_MARKER_MISSING:${marker}`);
  const start = source.indexOf('{', markerIndex + marker.length);
  assert.ok(start >= 0, 'EMP1_STAGEC_REGISTRY_OBJECT_START_MISSING');
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; index += 1; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; index += 1; continue; }
    if (char === '/' && next === '*') { blockComment = true; index += 1; continue; }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new TypeError('EMP1_STAGEC_REGISTRY_OBJECT_UNTERMINATED');
}
function normalizeJs(source) {
  let out = '';
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; index += 1; }
      continue;
    }
    if (quote) {
      out += char;
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; index += 1; continue; }
    if (char === '/' && next === '*') { blockComment = true; index += 1; continue; }
    if (char === "'" || char === '"' || char === '`') { quote = char; out += char; continue; }
    if (/\s/u.test(char)) continue;
    out += char;
  }
  return out;
}
async function readJson(path) { return JSON.parse(await readText(path)); }
async function readText(path) { return readFile(resolve(root, path), 'utf8'); }
