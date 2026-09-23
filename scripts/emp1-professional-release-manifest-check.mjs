#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMP1_PROFESSIONAL_SECURITY_HEADER_POLICY_SEMANTIC_HASH } from './emp1-professional-security-header-policy.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const expectedEvidenceFiles = [
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
  '11-post-promotion-exact-head-receipt.json',
  '12-post-promotion-exact-head-falsifier-receipt.json',
];
const options = parseArgs(process.argv.slice(2));
const receiptPath = retainedReceiptPath(options.receipt);
const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
const profile = await readJson('validation/emp1/release/emp1-wrc537-gamma5-bounded-release-profile-v1.json');
const wrcSourceLedger = await readJson('validation/emp1/wrc537-2013/source-ledger.json');
const cauxSourceLedger = await readJson('validation/emp1/caux2017-wrc01f/source-ledger.json');
const authorization = await readJson('validation/emp1/wrc537-2013/gamma5-zero-dp-route-authorization-v1.json');
const currentSourceSemantics = await readJson(
  'validation/emp1/release/emp1-wrc537-gamma5-current-source-semantics-gate-v1.json',
);
const currentBenchmarkManifestPath =
  'validation/emp1/release/emp1-current-benchmark-manifest-v1.json';
const currentBenchmarkManifestBytes = await readFile(resolve(root, currentBenchmarkManifestPath));
const currentBenchmarkManifest = JSON.parse(currentBenchmarkManifestBytes.toString('utf8'));
const retainedEvidenceSets = await collectRetainedEvidenceSets(resolve(root, 'validation/emp1/wrc537-2013'));
const packageLockSha256 = sha256Bytes(await readFile(resolve(root, 'package-lock.json')));
const candidateSource = await readFile(resolve(root, 'scripts/emp1-professional-release-candidate.mjs'), 'utf8');

assert.equal(receipt.schema, 'emp1-professional-release-candidate-receipt/v1');
assert.ok(receipt.releaseManifest, 'EMP1_RELEASE_MANIFEST_REQUIRED');
const manifest = receipt.releaseManifest;
assert.equal(manifest.schema, 'emp1-release-candidate/v1');
assert.equal(manifest.semanticHash, semanticHash(manifest, ['semanticHash']),
  'EMP1_RELEASE_MANIFEST_SEMANTIC_HASH_MISMATCH');
assert.equal(receipt.receiptSemanticHash, semanticHash(receipt, ['receiptSemanticHash', 'status']),
  'EMP1_RELEASE_RECEIPT_SEMANTIC_HASH_MISMATCH');

assert.deepEqual(manifest.git, {
  head: receipt.candidate.headSha,
  tree: receipt.candidate.treeSha,
  parents: [receipt.candidate.parentSha],
});
assert.match(manifest.git.head, /^[0-9a-f]{40}$/u);
assert.match(manifest.git.tree, /^[0-9a-f]{40}$/u);
assert.deepEqual(manifest.git.parents.map((value) => /^[0-9a-f]{40}$/u.test(value)), [true]);
assert.equal(git(['rev-parse', 'HEAD']), manifest.git.head, 'EMP1_RELEASE_MANIFEST_CHECKOUT_HEAD_DRIFT');
assert.equal(git(['rev-parse', 'HEAD^{tree}']), manifest.git.tree, 'EMP1_RELEASE_MANIFEST_CHECKOUT_TREE_DRIFT');
assert.equal(git(['rev-parse', 'HEAD^']), manifest.git.parents[0], 'EMP1_RELEASE_MANIFEST_CHECKOUT_PARENT_DRIFT');

assert.equal(profile.schema, 'emp1-release-profile/v1');
assert.deepEqual(manifest.product, { id: profile.product.id, releaseProfileId: profile.releaseProfileId });
assert.equal(manifest.product.id, 'EMP.1');

assert.equal(wrcSourceLedger.custodyState, 'VERIFIED');
assert.equal(wrcSourceLedger.qualificationState, 'PASS_SOURCE_CUSTODY');
assert.equal(cauxSourceLedger.custodyState, 'VERIFIED');
assert.equal(cauxSourceLedger.qualificationState, 'PASS_SOURCE_CUSTODY');
assert.deepEqual(manifest.source, {
  wrcSha256: wrcSourceLedger.rawPdfSha256,
  cauxSha256: cauxSourceLedger.rawPdfSha256,
});
assert.equal(profile.method.sourceSha256, manifest.source.wrcSha256);

assert.deepEqual(manifest.method, {
  identity: profile.method.identity,
  datasetHash: profile.method.datasetHash,
  routeQualificationHash: authorization.authorizedIdentity.qualificationRecordSha256,
  independentOracleHash: authorization.authorizedIdentity.postAuthorityOracleSemanticHash,
  sourceSemanticsProfileHash: currentSourceSemantics.profile.semanticHash,
  sourceSemanticsGateHash: currentSourceSemantics.semanticHash,
});
assert.deepEqual(manifest.benchmark, {
  currentManifestPath: currentBenchmarkManifestPath,
  currentManifestSha256: sha256Bytes(currentBenchmarkManifestBytes),
  gamma5HandcalcTraceGitBlobSha1:
    currentBenchmarkManifest.gamma5.independentHandCalculationTrace.gitBlobSha1,
  cauxBenchmarkSemanticHash: currentBenchmarkManifest.caux.benchmark.semanticHash,
  cauxCurrentQualificationSemanticHash:
    currentBenchmarkManifest.caux.currentQualification.semanticHash,
  cauxComparisonState:
    currentBenchmarkManifest.caux.retainedComparisonCustody.comparisonState,
  cauxComparisonRouteEngineeringUseAuthorized:
    currentBenchmarkManifest.caux.routeRelationship.engineeringUseAuthorized,
  pvEliteReferenceState: currentBenchmarkManifest.pvElite.state,
});
assert.equal(authorization.authorizedIdentity.sourceDocumentSha256, manifest.source.wrcSha256);
assert.equal(authorization.authorizedIdentity.datasetHash, manifest.method.datasetHash);
assert.equal(profile.benchmark.physicalOracleHash, manifest.method.independentOracleHash);
assert.equal(currentSourceSemantics.profile.methodSourceSemanticsReady, true);
assert.equal(currentSourceSemantics.profile.unresolvedPrimaryMethodSemanticCount, 0);
assert.equal(currentSourceSemantics.authority.caseEngineeringUseAuthorizedByThisGate, false);
assert.equal(currentSourceSemantics.authority.releaseAuthorityGranted, false);
assert.equal(currentBenchmarkManifest.gamma5.independentHandCalculationTrace.status,
  'FROZEN_INDEPENDENT_H1_TRACE');
assert.equal(currentBenchmarkManifest.caux.currentQualification.directPdfPageReobservation, 'PASS');
assert.equal(currentBenchmarkManifest.caux.retainedComparisonCustody.comparisonState,
  'COMPARISON_QUALIFIED');
assert.equal(currentBenchmarkManifest.caux.routeRelationship.engineeringUseAuthorized, false);
assert.equal(currentBenchmarkManifest.pvElite.state, 'REFERENCE_NOT_AVAILABLE');
for (const value of Object.values(currentBenchmarkManifest.authority)) assert.equal(value, false);

assert.deepEqual(manifest.evidence.expectedRetainedFiles, expectedEvidenceFiles,
  'EMP1_RELEASE_MANIFEST_EXPECTED_EVIDENCE_INVENTORY_DRIFT');
assert.deepEqual(manifest.evidence.retainedEvidenceSets, retainedEvidenceSets,
  'EMP1_RELEASE_MANIFEST_RETAINED_EVIDENCE_HASH_DRIFT');
const expectedGateEvidence = Object.fromEntries(receipt.executions.map((item) => [item.gateId, {
  status: item.status,
  exitCode: item.exitCode,
  stdoutSha256: item.stdoutSha256,
  stderrSha256: item.stderrSha256,
}]));
assert.deepEqual(manifest.evidence.gates, expectedGateEvidence,
  'EMP1_RELEASE_MANIFEST_EXECUTION_EVIDENCE_DRIFT');
assert.equal(manifest.evidence.buildArtifactSha256, receipt.candidate.buildArtifactSha256);

const currentCustody = manifest.currentReleaseCustody;
assert.deepEqual(currentCustody.dependencySecurity, receipt.candidate.dependencySecurity,
  'EMP1_RELEASE_MANIFEST_DEPENDENCY_CUSTODY_DRIFT');
assert.equal(currentCustody.dependencySecurity.packageLockSha256, packageLockSha256,
  'EMP1_RELEASE_MANIFEST_PACKAGE_LOCK_HASH_DRIFT');
assert.equal(currentCustody.dependencySecurity.advisoryAuditLevel, 'HIGH');
assert.equal(currentCustody.dependencySecurity.liveAdvisoryGateId, 'DEPENDENCY_ADVISORY');
assert.deepEqual(currentCustody.deployedSecurityHeaders, receipt.candidate.deployedSecurityHeaders,
  'EMP1_RELEASE_MANIFEST_DEPLOYED_HEADER_CUSTODY_DRIFT');
assert.equal(currentCustody.deployedSecurityHeaders.policySemanticHash,
  EMP1_PROFESSIONAL_SECURITY_HEADER_POLICY_SEMANTIC_HASH,
  'EMP1_RELEASE_MANIFEST_SECURITY_HEADER_POLICY_DRIFT');
assert.equal(currentCustody.deployedSecurityHeaders.liveObservationGateId, 'DEPLOYMENT_SECURITY_HEADERS');
assert.equal(currentCustody.deployedSecurityHeaders.browserCompatibilityEstablishedByHeaderPolicy, false);
assert.deepEqual(currentCustody.deploymentOperations, receipt.candidate.deploymentOperations,
  'EMP1_RELEASE_MANIFEST_DEPLOYMENT_OPERATIONS_CUSTODY_DRIFT');
assert.equal(currentCustody.deploymentOperations.gateId, 'DEPLOYMENT_OPERATIONS');
assert.equal(currentCustody.deploymentOperations.rollbackExecutionObservedByThisHarness, false);
assert.equal(currentCustody.deploymentOperations.rollbackSuccessAuthorizedByThisHarness, false);
if (currentCustody.deploymentOperations.deploymentOperationsReceiptSha256 != null) {
  assert.match(currentCustody.deploymentOperations.deploymentOperationsReceiptSha256, /^[0-9a-f]{64}$/u);
}

assert.deepEqual(manifest.authority, {
  boundedEngineeringUse: true,
  boundedProductionUse: true,
  globalEmp1C: false,
  codeCompliance: false,
  releaseQualifiedByUnderlyingRoute: false,
  releaseCandidateQualified: receipt.releaseCandidateQualified === true,
  deploymentAuthorityGrantedByManifest: false,
  rollbackExecutionObservedByManifest: false,
  rollbackSuccessAuthorizedByManifest: false,
});
assert.deepEqual(manifest.retention, {
  releaseModeRequiresRetainedReceipt: true,
  timestampsParticipateInSemanticAuthority: false,
  randomIdentifiersParticipateInSemanticAuthority: false,
});
assert.match(candidateSource, /EMP1_RELEASE_CANDIDATE_RETAINED_RECEIPT_REQUIRED/u,
  'EMP1_RELEASE_MANIFEST_RETAINED_RECEIPT_ENFORCEMENT_MISSING');

if (receipt.releaseCandidateQualified === true) {
  assert.equal(receipt.mode, 'RELEASE');
  assert.equal(receipt.candidate.cleanWorktree, true);
  assert.match(receipt.candidate.buildArtifactSha256 ?? '', /^[0-9a-f]{64}$/u);
  assert.match(receipt.candidate.deploymentOperations.deploymentOperationsReceiptSha256 ?? '', /^[0-9a-f]{64}$/u);
  assert.ok(receipt.executions.every((item) => item.status === 'PASS'),
    'EMP1_RELEASE_QUALIFIED_RECEIPT_REQUIRES_ALL_EXECUTIONS_PASS');
  for (const gateId of [
    'DEPENDENCY_LOCK_CUSTODY',
    'DEPENDENCY_ADVISORY',
    'BUILD_ARTIFACT_SECURITY',
    'EMP1_RELEASE_CHROMIUM',
    'DEPLOYMENT_EVIDENCE',
    'DEPLOYMENT_SECURITY_HEADERS',
    'DEPLOYMENT_OPERATIONS',
  ]) {
    assert.ok(receipt.executions.some((item) => item.gateId === gateId && item.status === 'PASS'),
      `EMP1_RELEASE_QUALIFIED_RECEIPT_GATE_REQUIRED:${gateId}`);
  }
  assert.equal(receipt.status, 'PASS_EMP1_PROFESSIONAL_RELEASE_CANDIDATE_AND_DEPLOYMENT_EVIDENCE');
}

const result = {
  schema: 'emp1-professional-release-manifest-check/v2',
  status: receipt.releaseCandidateQualified
    ? 'PASS_QUALIFIED_RELEASE_CANDIDATE_MANIFEST_CUSTODY'
    : 'PASS_RELEASE_CANDIDATE_MANIFEST_CUSTODY_RELEASE_NOT_QUALIFIED',
  candidateHeadSha: manifest.git.head,
  candidateTreeSha: manifest.git.tree,
  releaseProfileId: manifest.product.releaseProfileId,
  manifestSemanticHash: manifest.semanticHash,
  retainedEvidenceSetCount: manifest.evidence.retainedEvidenceSets.length,
  sourceSemanticsProfileHash: manifest.method.sourceSemanticsProfileHash,
  currentBenchmarkManifestSha256: manifest.benchmark.currentManifestSha256,
  pvEliteReferenceState: manifest.benchmark.pvEliteReferenceState,
  executionGateCount: Object.keys(manifest.evidence.gates).length,
  releaseCandidateQualified: receipt.releaseCandidateQualified === true,
  currentDependencyCustodyBound: true,
  currentSecurityHeaderCustodyBound: true,
  currentDeploymentOperationsCustodyBound: true,
  codeComplianceAuthorizedByManifest: false,
  globalEmp1CAuthorizedByManifest: false,
  deploymentAuthorityGrantedByManifest: false,
  rollbackExecutionObservedByManifest: false,
};
console.log(JSON.stringify(result, null, 2));
if (options.requireQualified && receipt.releaseCandidateQualified !== true) process.exit(2);

async function collectRetainedEvidenceSets(start) {
  const directories = [];
  await walk(start, 0);
  const sets = [];
  for (const directory of directories.sort()) {
    const files = [];
    for (const name of expectedEvidenceFiles) {
      const path = join(directory, name);
      try {
        const bytes = await readFile(path);
        files.push({ name, path: portableRelative(path), state: 'PRESENT', sha256: sha256Bytes(bytes) });
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
        files.push({ name, path: portableRelative(path), state: 'NOT_PRESENT', sha256: null });
      }
    }
    sets.push({ directory: portableRelative(directory), files });
  }
  return sets;

  async function walk(directory, depth) {
    if (depth > 3) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    const names = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
    if (names.has('01-observation.json')) directories.push(directory);
    for (const entry of entries) if (entry.isDirectory()) await walk(join(directory, entry.name), depth + 1);
  }
}

function parseArgs(args) {
  const out = { receipt: null, requireQualified: false };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--receipt') out.receipt = args[++index] ?? null;
    else if (args[index] === '--require-qualified') out.requireQualified = true;
    else throw checkError(`EMP1_RELEASE_MANIFEST_CHECK_UNKNOWN_ARGUMENT:${args[index]}`);
  }
  if (!out.receipt) throw checkError('EMP1_RELEASE_MANIFEST_CHECK_RECEIPT_REQUIRED');
  return out;
}
function retainedReceiptPath(path) {
  const resolved = resolve(root, path);
  const allowedRoot = resolve(root, 'validation/emp1/release');
  if (resolved !== allowedRoot && !resolved.startsWith(`${allowedRoot}/`)) {
    throw checkError('EMP1_RELEASE_MANIFEST_CHECK_RECEIPT_PATH_OUTSIDE_RELEASE_VALIDATION');
  }
  return resolved;
}
async function readJson(path) { return JSON.parse(await readFile(resolve(root, path), 'utf8')); }
function portableRelative(path) { return relative(root, path).replaceAll('\\', '/'); }
function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw checkError(`EMP1_RELEASE_MANIFEST_CHECK_GIT_REQUIRED:${args.join('_')}`);
  }
  return String(result.stdout ?? '').trim();
}
function semanticHash(value, excluded) {
  const omitted = new Set(excluded);
  const payload = Object.fromEntries(Object.entries(value).filter(([key]) => !omitted.has(key)));
  return sha256Bytes(Buffer.from(JSON.stringify(sortValue(payload)), 'utf8'));
}
function sha256Bytes(value) { return createHash('sha256').update(value).digest('hex'); }
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value;
}
function checkError(code) { const error = new TypeError(code); error.code = code; return error; }
