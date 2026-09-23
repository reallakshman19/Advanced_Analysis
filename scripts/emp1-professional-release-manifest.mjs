#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentEmp1WorkbenchRouteAuthority } from
  '../src/workspace/emp1-workbench-product-run.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

export const EMP1_RELEASE_EXPECTED_EVIDENCE_FILES = Object.freeze([
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
]);

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
const packageMetadata = await readJson('package.json');
const stageCPreflight = await readJson(
  'validation/emp1/wrc537-2013/gamma5-stagec-preflight-v1.json',
);
const currentRouteAuthority = currentEmp1WorkbenchRouteAuthority();
const retainedEvidenceSets = await collectRetainedEvidenceSets(resolve(root, 'validation/emp1/wrc537-2013'));

assertAuthorityInputs();

export function createEmp1ReleaseManifest(input) {
  const currentCustody = normalizeCurrentCustody(input.currentCandidateProvenance);
  const gates = executionEvidence(input.executions);
  const caseReview = currentCustody.caseEngineeringEvidence;
  const caseSpecificHumanReviewAsserted =
    caseReview?.reviewAcceptedCurrent === true
    && caseReview?.reviewState === 'REVIEW_ACCEPTED'
    && caseReview?.reviewDisposition === 'ACCEPTED'
    && gates.CASE_ENGINEERING_EVIDENCE?.status === 'PASS';
  if (input.releaseCandidateQualified === true && !caseSpecificHumanReviewAsserted) {
    throw manifestError('EMP1_RELEASE_MANIFEST_QUALIFIED_CASE_REVIEW_REQUIRED');
  }
  const payload = {
    schema: 'emp1-release-candidate/v3',
    git: {
      head: input.candidateHead,
      tree: input.candidateTree,
      parents: [input.candidateParent],
    },
    product: {
      id: profile.product.id,
      version: packageMetadata.version,
      releaseProfileId: profile.releaseProfileId,
      releaseProfileSchema: profile.schema,
    },
    source: {
      wrcSha256: wrcSourceLedger.rawPdfSha256,
      cauxSha256: cauxSourceLedger.rawPdfSha256,
    },
    method: {
      identity: profile.method.identity,
      datasetHash: profile.method.datasetHash,
      routeQualificationHash: authorization.authorizedIdentity.qualificationRecordSha256,
      independentOracleHash: authorization.authorizedIdentity.postAuthorityOracleSemanticHash,
      sourceSemanticsProfileHash: currentSourceSemantics.profile.semanticHash,
      sourceSemanticsGateHash: currentSourceSemantics.semanticHash,
      routeAuthorityHash: currentRouteAuthority.routeAuthorityHash,
      routeAuthoritySnapshot: structuredClone(currentRouteAuthority.snapshot),
    },
    qualificationCustody: {
      authorizationSemanticHash: authorization.authorizationRecordSemanticHash,
      stageCPreflight: {
        status: stageCPreflight.status,
        basisMainSha: stageCPreflight.basisMain.sha,
        historicalStageBHeadSha: stageCPreflight.historicalChain.stageB.headSha,
        staticConclusion: stageCPreflight.stageCStaticClassification.conclusion,
        blockers: [...stageCPreflight.blockers],
        engineeringPassClaimed: stageCPreflight.executionState.engineeringPassClaimed,
      },
      currentExecutionGateId: 'WRC03_CURRENT_EXACT_HEAD',
      currentExecutionGateStatus:
        gates.WRC03_CURRENT_EXACT_HEAD?.status ?? 'NOT_RUN_EXECUTION_ENVIRONMENT',
    },
    benchmark: {
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
    },
    evidence: {
      expectedRetainedFiles: EMP1_RELEASE_EXPECTED_EVIDENCE_FILES,
      retainedEvidenceSets,
      gates,
      buildArtifactSha256: input.buildArtifactSha256,
    },
    professionalReviewCapability: {
      durableEvidencePackageSchema: 'emp1-evidence-export/v1',
      evidenceExportGateId: 'ENGINEERING_EVIDENCE_EXPORT',
      evidenceExportGateStatus:
        gates.ENGINEERING_EVIDENCE_EXPORT?.status ?? 'NOT_RUN_EXECUTION_ENVIRONMENT',
      reviewRecordGateId: 'ENGINEERING_REVIEW_CONTRACT',
      reviewRecordGateStatus:
        gates.ENGINEERING_REVIEW_CONTRACT?.status ?? 'NOT_RUN_EXECUTION_ENVIRONMENT',
      reviewReadinessGateId: 'ENGINEERING_REVIEW_READINESS',
      reviewReadinessGateStatus:
        gates.ENGINEERING_REVIEW_READINESS?.status ?? 'NOT_RUN_EXECUTION_ENVIRONMENT',
      caseSpecificHumanReviewGateId: 'CASE_ENGINEERING_EVIDENCE',
      caseSpecificHumanReviewGateStatus:
        gates.CASE_ENGINEERING_EVIDENCE?.status ?? 'NOT_PROVIDED',
      caseSpecificHumanReviewAsserted,
      caseSpecificHumanReview: caseReview ? structuredClone(caseReview) : null,
      caseSpecificHumanReviewRequiredForEngineeringDisposition: true,
      reviewAcceptanceCreatesReleaseAuthority: false,
      reviewAcceptanceCreatesCodeCompliance: false,
    },
    readiness: {
      gateId: 'RELEASE_READINESS_POLICY',
      gateStatus: gates.RELEASE_READINESS_POLICY?.status ?? 'NOT_RUN_EXECUTION_ENVIRONMENT',
      currentSourceSemanticsGateHash: currentSourceSemantics.semanticHash,
      stageCStaticPreflightStatus: stageCPreflight.status,
      missingHistoricalEvidenceMayBePromotedToPass: false,
    },
    currentReleaseCustody: currentCustody,
    authority: {
      boundedEngineeringUse: authorization.authorityBoundary.boundedEngineeringUseAuthorized === true,
      boundedProductionUse: authorization.authorityBoundary.boundedProductionRouteAuthorized === true,
      globalEmp1C: authorization.authorityBoundary.globalEmp1CRouteAuthority === true,
      codeCompliance: authorization.authorityBoundary.codeComplianceAuthorized === true,
      releaseQualifiedByUnderlyingRoute: authorization.authorityBoundary.releaseQualified === true,
      releaseCandidateQualified: input.releaseCandidateQualified === true,
      deploymentAuthorityGrantedByManifest: false,
      rollbackExecutionObservedByManifest: false,
      rollbackSuccessAuthorizedByManifest: false,
    },
    retention: {
      releaseModeRequiresRetainedReceipt: true,
      timestampsParticipateInSemanticAuthority: false,
      randomIdentifiersParticipateInSemanticAuthority: false,
    },
  };
  return Object.freeze({
    ...payload,
    semanticHash: sha256Canonical(payload),
  });
}

function normalizeCurrentCustody(value) {
  const dependency = value?.dependencySecurity;
  const headers = value?.deployedSecurityHeaders;
  const deployment = value?.deploymentEvidence;
  const operations = value?.deploymentOperations;
  const caseEngineeringEvidence = value?.caseEngineeringEvidence ?? null;
  requireHash(dependency?.packageLockSha256, 'EMP1_RELEASE_MANIFEST_DEPENDENCY_LOCK_HASH_INVALID');
  requireHash(headers?.policySemanticHash, 'EMP1_RELEASE_MANIFEST_SECURITY_HEADER_POLICY_HASH_INVALID');
  if (deployment?.deploymentReceiptSha256 != null) {
    requireHash(deployment.deploymentReceiptSha256,
      'EMP1_RELEASE_MANIFEST_DEPLOYMENT_RECEIPT_HASH_INVALID');
  }
  if (deployment?.gateId !== 'DEPLOYMENT_EVIDENCE') {
    throw manifestError('EMP1_RELEASE_MANIFEST_DEPLOYMENT_EVIDENCE_CUSTODY_INVALID');
  }
  if (operations?.deploymentOperationsReceiptSha256 != null) {
    requireHash(operations.deploymentOperationsReceiptSha256,
      'EMP1_RELEASE_MANIFEST_DEPLOYMENT_OPERATIONS_RECEIPT_HASH_INVALID');
  }
  if (dependency?.advisoryAuditLevel !== 'HIGH' || dependency?.liveAdvisoryGateId !== 'DEPENDENCY_ADVISORY') {
    throw manifestError('EMP1_RELEASE_MANIFEST_DEPENDENCY_CUSTODY_INVALID');
  }
  if (headers?.liveObservationGateId !== 'DEPLOYMENT_SECURITY_HEADERS'
    || headers?.browserCompatibilityEstablishedByHeaderPolicy !== false) {
    throw manifestError('EMP1_RELEASE_MANIFEST_DEPLOYED_HEADER_CUSTODY_INVALID');
  }
  if (operations?.gateId !== 'DEPLOYMENT_OPERATIONS'
    || operations?.rollbackExecutionObservedByThisHarness !== false
    || operations?.rollbackSuccessAuthorizedByThisHarness !== false) {
    throw manifestError('EMP1_RELEASE_MANIFEST_DEPLOYMENT_OPERATIONS_CUSTODY_INVALID');
  }
  if (caseEngineeringEvidence != null) {
    requireHash(caseEngineeringEvidence.packageSha256,
      'EMP1_RELEASE_MANIFEST_CASE_ENGINEERING_EVIDENCE_HASH_INVALID');
    for (const field of [
      'packageSemanticHash',
      'productVersion',
      'releaseProfileId',
      'releaseProfileVersion',
      'routeAuthorityHash',
      'reviewId',
      'reviewSemanticHash',
      'reviewedAt',
      'reviewerIdentity',
    ]) {
      if (typeof caseEngineeringEvidence[field] !== 'string'
        || !caseEngineeringEvidence[field].trim()) {
        throw manifestError(
          `EMP1_RELEASE_MANIFEST_CASE_ENGINEERING_EVIDENCE_FIELD_INVALID:${field}`,
        );
      }
    }
    if (caseEngineeringEvidence.packageSchema !== 'emp1-evidence-export/v1'
      || caseEngineeringEvidence.reviewAcceptedCurrent !== true
      || caseEngineeringEvidence.reviewState !== 'REVIEW_ACCEPTED'
      || caseEngineeringEvidence.reviewDisposition !== 'ACCEPTED'
      || caseEngineeringEvidence.productVersion !== packageMetadata.version
      || caseEngineeringEvidence.releaseProfileId !== profile.releaseProfileId
      || caseEngineeringEvidence.releaseProfileVersion !== profile.schema
      || caseEngineeringEvidence.routeAuthorityHash
        !== currentRouteAuthority.routeAuthorityHash) {
      throw manifestError('EMP1_RELEASE_MANIFEST_CASE_ENGINEERING_EVIDENCE_CUSTODY_INVALID');
    }
  }
  return Object.freeze({
    dependencySecurity: Object.freeze({ ...dependency }),
    deployedSecurityHeaders: Object.freeze({ ...headers }),
    deploymentEvidence: Object.freeze({ ...deployment }),
    deploymentOperations: Object.freeze({ ...operations }),
    caseEngineeringEvidence: caseEngineeringEvidence == null
      ? null
      : Object.freeze({ ...caseEngineeringEvidence }),
  });
}

function executionEvidence(executions) {
  return Object.fromEntries(executions.map((item) => [item.gateId, {
    status: item.status,
    exitCode: item.exitCode,
    stdoutSha256: item.stdoutSha256,
    stderrSha256: item.stderrSha256,
  }]));
}

function assertAuthorityInputs() {
  if (profile.schema !== 'emp1-release-profile/v1' || profile.product?.id !== 'EMP.1') {
    throw manifestError('EMP1_RELEASE_MANIFEST_PROFILE_IDENTITY_INVALID');
  }
  if (wrcSourceLedger.qualificationState !== 'PASS_SOURCE_CUSTODY'
    || wrcSourceLedger.custodyState !== 'VERIFIED') {
    throw manifestError('EMP1_RELEASE_MANIFEST_WRC_SOURCE_CUSTODY_NOT_VERIFIED');
  }
  if (cauxSourceLedger.qualificationState !== 'PASS_SOURCE_CUSTODY'
    || cauxSourceLedger.custodyState !== 'VERIFIED') {
    throw manifestError('EMP1_RELEASE_MANIFEST_CAUX_SOURCE_CUSTODY_NOT_VERIFIED');
  }
  if (profile.method.sourceSha256 !== wrcSourceLedger.rawPdfSha256
    || authorization.authorizedIdentity.sourceDocumentSha256 !== wrcSourceLedger.rawPdfSha256) {
    throw manifestError('EMP1_RELEASE_MANIFEST_WRC_SOURCE_IDENTITY_DRIFT');
  }
  if (authorization.authorizedIdentity.datasetHash !== profile.method.datasetHash) {
    throw manifestError('EMP1_RELEASE_MANIFEST_DATASET_IDENTITY_DRIFT');
  }
  if (authorization.authorizedIdentity.postAuthorityOracleSemanticHash !== profile.benchmark.physicalOracleHash) {
    throw manifestError('EMP1_RELEASE_MANIFEST_ORACLE_IDENTITY_DRIFT');
  }
  if (currentSourceSemantics.state
      !== 'PASS_BOUNDED_METHOD_SOURCE_SEMANTICS_CASE_PREREQUISITES_DECLARED'
    || currentSourceSemantics.profile.methodSourceSemanticsReady !== true
    || currentSourceSemantics.profile.unresolvedPrimaryMethodSemanticCount !== 0
    || currentSourceSemantics.authority.caseEngineeringUseAuthorizedByThisGate !== false
    || currentSourceSemantics.authority.releaseAuthorityGranted !== false) {
    throw manifestError('EMP1_RELEASE_MANIFEST_WRC02_SOURCE_SEMANTICS_INVALID');
  }
  if (packageMetadata.name !== 'advanced-analysis'
    || typeof packageMetadata.version !== 'string'
    || !packageMetadata.version.trim()) {
    throw manifestError('EMP1_RELEASE_MANIFEST_PRODUCT_VERSION_INVALID');
  }
  if (currentRouteAuthority.productionUseAuthorized !== true
    || !currentRouteAuthority.routeAuthorityHash
    || currentRouteAuthority.snapshot?.semanticHash !== currentRouteAuthority.routeAuthorityHash) {
    throw manifestError('EMP1_RELEASE_MANIFEST_CURRENT_ROUTE_AUTHORITY_INVALID');
  }
  if (stageCPreflight.status
      !== 'PASS_STATIC_STAGEC_PREFLIGHT_STANDARD_EXECUTABLE_EVIDENCE_STILL_MISSING'
    || stageCPreflight.executionState.engineeringPassClaimed !== false
    || stageCPreflight.authorityBoundary.staticDriftPreflightIsNumericalQualification !== false) {
    throw manifestError('EMP1_RELEASE_MANIFEST_STAGEC_PREFLIGHT_INVALID');
  }
  if (currentBenchmarkManifest.issue !== 1772
    || currentBenchmarkManifest.state !== 'CURRENT_BENCHMARK_EVIDENCE_INDEX'
    || currentBenchmarkManifest.gamma5.independentHandCalculationTrace.status
      !== 'FROZEN_INDEPENDENT_H1_TRACE'
    || currentBenchmarkManifest.caux.currentQualification.directPdfPageReobservation !== 'PASS'
    || currentBenchmarkManifest.caux.retainedComparisonCustody.comparisonState
      !== 'COMPARISON_QUALIFIED'
    || currentBenchmarkManifest.caux.routeRelationship.engineeringUseAuthorized !== false
    || currentBenchmarkManifest.pvElite.state !== 'REFERENCE_NOT_AVAILABLE') {
    throw manifestError('EMP1_RELEASE_MANIFEST_WRC04_BENCHMARK_EVIDENCE_INVALID');
  }
  for (const value of Object.values(currentBenchmarkManifest.authority)) {
    if (value !== false) {
      throw manifestError('EMP1_RELEASE_MANIFEST_EXTERNAL_BENCHMARK_AUTHORITY_INVALID');
    }
  }
  requireHash(cauxSourceLedger.rawPdfSha256, 'EMP1_RELEASE_MANIFEST_CAUX_SOURCE_HASH_INVALID');
  if (authorization.authorityBoundary.boundedEngineeringUseAuthorized !== true
    || authorization.authorityBoundary.boundedProductionRouteAuthorized !== true
    || authorization.authorityBoundary.globalEmp1CRouteAuthority !== false
    || authorization.authorityBoundary.codeComplianceAuthorized !== false
    || authorization.authorityBoundary.releaseQualified !== false) {
    throw manifestError('EMP1_RELEASE_MANIFEST_AUTHORITY_BOUNDARY_INVALID');
  }
}

async function collectRetainedEvidenceSets(start) {
  const directories = [];
  await walk(start, 0);
  const sets = [];
  for (const directory of directories.sort()) {
    const files = [];
    for (const name of EMP1_RELEASE_EXPECTED_EVIDENCE_FILES) {
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
    for (const entry of entries) {
      if (entry.isDirectory()) await walk(join(directory, entry.name), depth + 1);
    }
  }
}

async function readJson(path) { return JSON.parse(await readFile(resolve(root, path), 'utf8')); }
function portableRelative(path) { return relative(root, path).replaceAll('\\', '/'); }
function sha256Bytes(value) { return createHash('sha256').update(value).digest('hex'); }
function sha256Canonical(value) { return sha256Bytes(Buffer.from(JSON.stringify(sortValue(value)), 'utf8')); }
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value;
}
function requireHash(value, code) { if (!/^[0-9a-f]{64}$/u.test(value ?? '')) throw manifestError(code); }
function manifestError(code) { const error = new TypeError(code); error.code = code; return error; }
