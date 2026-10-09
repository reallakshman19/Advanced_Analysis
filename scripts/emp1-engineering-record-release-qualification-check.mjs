#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EMP1_AUTHORIZED_RELEASE_STATE_ARTIFACT,
  createEmp1EngineeringRecordReleaseQualification,
  requireEmp1EngineeringRecordReleaseQualification,
} from '../src/core/emp1/emp1-engineering-record-release-qualification.js';
import { createEmp1WorkspaceEngineeringRecordPackage } from
  '../src/workspace/emp1-engineering-record-package-workspace.js';
import { createEmp1WorkspaceEngineeringReview } from
  '../src/workspace/emp1-engineering-review-workspace.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const releasePath = EMP1_AUTHORIZED_RELEASE_STATE_ARTIFACT.path;
const releaseBytes = await readFile(resolve(root, releasePath));
const releaseState = JSON.parse(releaseBytes.toString('utf8'));
const artifact = Object.freeze({
  path: releasePath,
  gitBlobSha1: gitBlobSha1(releaseBytes),
});

assert.equal(artifact.gitBlobSha1, EMP1_AUTHORIZED_RELEASE_STATE_ARTIFACT.gitBlobSha1);
assert.equal(releaseState.currentStateSemanticHash,
  EMP1_AUTHORIZED_RELEASE_STATE_ARTIFACT.semanticHash);
assert.equal(releaseState.currentStateSemanticHash, releaseStateSemanticHash(releaseState));
assert.equal(releaseState.sequenceStatus.professionalReleaseReady, false);
assert.equal(releaseState.runtimeAuthority.releaseQualified, false);
assert.equal(releaseState.runtimeAuthority.deploymentAuthorized, false);

const acceptedPackage = engineeringRecordPackage('ACCEPTED');
const qualification = createEmp1EngineeringRecordReleaseQualification({
  packageValue: acceptedPackage,
  releaseState,
  releaseStateArtifact: artifact,
});
assert.equal(qualification.schema, 'emp1-engineering-record-release-qualification/v1');
assert.equal(qualification.state, 'RELEASE_BLOCKED_EXISTING_AUTHORITY');
assert.equal(qualification.releaseQualified, false);
assert.equal(qualification.packageIdentity.recordState, 'REVIEW_ACCEPTED');
assert.equal(qualification.handoff.compatible, true);
assert.equal(qualification.existingReleaseAuthority.professionalReleaseReady, false);
assert.equal(qualification.existingReleaseAuthority.releaseQualified, false);
assert.equal(qualification.existingReleaseAuthority.deploymentAuthorized, false);
assert.ok(qualification.blockers.includes(
  'EMP1_RELEASE_QUALIFICATION_EXISTING_PROFESSIONAL_RELEASE_NOT_READY'));
assert.ok(qualification.blockers.includes(
  'EMP1_RELEASE_QUALIFICATION_EXISTING_RELEASE_NOT_QUALIFIED'));
assert.equal(qualification.blockers.includes(
  'EMP1_RELEASE_QUALIFICATION_ACCEPTED_ENGINEERING_REVIEW_REQUIRED'), false);
assert.equal(qualification.releaseAuthorityIdentity.path, releasePath);
assert.equal(qualification.releaseAuthorityIdentity.gitBlobSha1, artifact.gitBlobSha1);
assert.equal(qualification.releaseAuthorityIdentity.currentStateSemanticHash,
  releaseState.currentStateSemanticHash);
assert.equal(qualification.authorityBoundary.releaseQualificationBindingAuthority, true);
assert.equal(qualification.authorityBoundary.underlyingReleaseAuthorityCreatedByThisRecord, false);
assert.equal(qualification.authorityBoundary.callerMaySetReleaseQualified, false);
assert.equal(qualification.authorityBoundary.callerMaySubstituteReleaseStateAuthority, false);
assert.equal(qualification.authorityBoundary.requiresAcceptedEngineeringReview, true);
assert.equal(qualification.authorityBoundary.createsCodeCompliance, false);
assert.equal(qualification.authorityBoundary.createsDeploymentAuthority, false);
assert.equal(qualification.authorityBoundary.createsCryptographicSeal, false);
assert.equal(qualification.authorityBoundary.deploymentRequiresSeparateAuthority, true);
assert.equal(Object.isFrozen(qualification), true);
assert.deepEqual(requireEmp1EngineeringRecordReleaseQualification(qualification), qualification);

const rejectedPackage = engineeringRecordPackage('REJECTED');
const rejectedQualification = createEmp1EngineeringRecordReleaseQualification({
  packageValue: rejectedPackage,
  releaseState,
  releaseStateArtifact: artifact,
});
assert.equal(rejectedQualification.state, 'RELEASE_BLOCKED_ENGINEERING_REVIEW_NOT_ACCEPTED');
assert.equal(rejectedQualification.releaseQualified, false);
assert.ok(rejectedQualification.blockers.includes(
  'EMP1_RELEASE_QUALIFICATION_ACCEPTED_ENGINEERING_REVIEW_REQUIRED'));

const incompatiblePackage = engineeringRecordPackage('ACCEPTED', {
  routeId: 'EMP1.C.OTHER.ROUTE',
});
const incompatible = createEmp1EngineeringRecordReleaseQualification({
  packageValue: incompatiblePackage,
  releaseState,
  releaseStateArtifact: artifact,
});
assert.equal(incompatible.state, 'RELEASE_INCOMPATIBLE_WITH_AUTHORIZED_PROFILE');
assert.equal(incompatible.releaseQualified, false);
assert.equal(incompatible.handoff.compatible, false);
assert.ok(incompatible.handoff.blockers.includes('EMP1_RELEASE_HANDOFF_ROUTE_ID_MISMATCH'));

const forgedTrue = structuredClone(releaseState);
forgedTrue.sequenceStatus.professionalReleaseReady = true;
forgedTrue.sequenceStatus.definitionOfDoneComplete = true;
forgedTrue.releaseReady = true;
forgedTrue.state = 'READY_FOR_RELEASE';
forgedTrue.runtimeAuthority.releaseQualified = true;
forgedTrue.currentStateSemanticHash = releaseStateSemanticHash(forgedTrue);
assert.notEqual(forgedTrue.currentStateSemanticHash,
  EMP1_AUTHORIZED_RELEASE_STATE_ARTIFACT.semanticHash);
assert.throws(() => createEmp1EngineeringRecordReleaseQualification({
  packageValue: acceptedPackage,
  releaseState: forgedTrue,
  releaseStateArtifact: artifact,
}), /EMP1_RELEASE_QUALIFICATION_AUTHORIZED_STATE_DRIFT:SEMANTIC_HASH/u);

const forgedBooleanOnly = structuredClone(releaseState);
forgedBooleanOnly.runtimeAuthority.releaseQualified = true;
assert.throws(() => createEmp1EngineeringRecordReleaseQualification({
  packageValue: acceptedPackage,
  releaseState: forgedBooleanOnly,
  releaseStateArtifact: artifact,
}), /EMP1_RELEASE_QUALIFICATION_AUTHORIZED_STATE_DRIFT:RELEASE_QUALIFIED/u);

assert.throws(() => createEmp1EngineeringRecordReleaseQualification({
  packageValue: acceptedPackage,
  releaseState,
  releaseStateArtifact: { ...artifact, path: 'validation/emp1/release/forged.json' },
}), /EMP1_RELEASE_QUALIFICATION_AUTHORIZED_STATE_DRIFT:ARTIFACT_PATH/u);
assert.throws(() => createEmp1EngineeringRecordReleaseQualification({
  packageValue: acceptedPackage,
  releaseState,
  releaseStateArtifact: { ...artifact, gitBlobSha1: '0'.repeat(40) },
}), /EMP1_RELEASE_QUALIFICATION_AUTHORIZED_STATE_DRIFT:ARTIFACT_GIT_BLOB/u);

const tamperedReleaseFlag = structuredClone(qualification);
tamperedReleaseFlag.releaseQualified = true;
assert.throws(() => requireEmp1EngineeringRecordReleaseQualification(tamperedReleaseFlag),
  /EMP1_RELEASE_QUALIFICATION_RELEASE_FLAG_INVALID/u);
const tamperedIdentity = structuredClone(qualification);
tamperedIdentity.releaseAuthorityIdentity.currentStateSemanticHash = '0'.repeat(64);
assert.throws(() => requireEmp1EngineeringRecordReleaseQualification(tamperedIdentity),
  /EMP1_RELEASE_QUALIFICATION_AUTHORIZED_STATE_DRIFT:RECORD_RELEASE_AUTHORITY_currentStateSemanticHash/u);
const tamperedPackage = structuredClone(qualification);
tamperedPackage.packageIdentity.packageId = 'emp1-engineering-record:tampered';
assert.throws(() => requireEmp1EngineeringRecordReleaseQualification(tamperedPackage),
  /EMP1_RELEASE_QUALIFICATION_IDENTITY_MISMATCH/u);

const source = await readFile(resolve(root,
  'src/core/emp1/emp1-engineering-record-release-qualification.js'), 'utf8');
const authoritySource = await readFile(resolve(root,
  'src/core/emp1/emp1-professional-release-state-authority.js'), 'utf8');
assert.equal(source.includes('runEmp1('), false);
assert.equal(source.includes('stressIntensity'), false);
assert.equal(source.includes('emp1-c-bounded-route-registry'), false);
assert.equal(source.includes('emp1-wrc537-gamma5-zero-dp-route'), false);
assert.equal(source.includes('.github/workflows'), false);
assert.equal(source.includes('releaseCandidateQualified = true'), false);
assert.match(source, /callerMaySetReleaseQualified: false/u);
assert.match(source, /callerMaySubstituteReleaseStateAuthority: false/u);
assert.match(source, /requiresAcceptedEngineeringReview: true/u);
assert.match(source, /deploymentRequiresSeparateAuthority: true/u);
assert.match(authoritySource, new RegExp(EMP1_AUTHORIZED_RELEASE_STATE_ARTIFACT.gitBlobSha1, 'u'));
assert.match(authoritySource, new RegExp(EMP1_AUTHORIZED_RELEASE_STATE_ARTIFACT.semanticHash, 'u'));
assert.equal(authoritySource.includes('releaseQualified: true'), false);
assert.equal(authoritySource.includes('deploymentAuthorized: true'), false);

console.log(JSON.stringify({
  schema: 'emp1-engineering-record-release-qualification-check/v1',
  status: 'PASS_FROZEN_RELEASE_AUTHORITY_BINDING_FAIL_CLOSED',
  authorizedReleaseStateGitBlobSha1: artifact.gitBlobSha1,
  authorizedReleaseStateSemanticHash: releaseState.currentStateSemanticHash,
  currentQualificationState: qualification.state,
  currentReleaseQualified: qualification.releaseQualified,
  rejectedReviewReleaseBlocked: rejectedQualification.releaseQualified === false,
  forgedReleaseStateRejected: true,
  callerMaySetReleaseQualified: false,
  underlyingReleaseAuthorityCreatedByBinding: false,
  deploymentAuthorityCreated: false,
  cryptographicSealCreated: false,
}, null, 2));

function engineeringRecordPackage(disposition, overrides = {}) {
  const execution = currentExecution(overrides);
  const currentness = Object.freeze({
    state: 'CURRENT', reasons: Object.freeze([]), inputCurrent: true,
    cAuthorityCurrent: true, cReportable: true,
  });
  const cState = Object.freeze({ state: 'CALCULATED_CURRENT', currentResultAvailable: true });
  const review = createEmp1WorkspaceEngineeringReview({
    disposition,
    reviewerIdentity: `engineer:${disposition.toLowerCase()}`,
    reviewerRole: 'ENGINEER',
    comment: disposition === 'ACCEPTED' ? 'Accepted bounded engineering record.' : 'Correction required.',
    reviewedAt: '2026-09-02T01:15:00.000Z',
    execution,
    executionCurrentness: currentness,
    cState,
  });
  return createEmp1WorkspaceEngineeringRecordPackage({
    reviewRecord: review,
    execution,
    executionCurrentness: currentness,
    cState,
    packagedAt: '2026-09-02T01:16:00.000Z',
  });
}

function currentExecution(overrides = {}) {
  const routeId = overrides.routeId
    ?? 'EMP1.C.WRC537.CYLINDRICAL.ORIGINAL.GAMMA5.ZERO_DP';
  const parents = {
    sourceHash: 'SOURCE-1',
    loadTransferResultHash: 'A-1',
    sectionScreeningResultHash: 'B-1',
    localCorrelationResultHash: 'C-1',
  };
  return {
    schema: 'emp1-workbench-product-execution/v2',
    productId: 'EMP.1',
    sourceHash: 'SOURCE-1',
    authority: {
      boundedLocalRouteExecuted: true,
      routeAuthorityHash: `ROUTE-${routeId}`,
      routeAuthoritySnapshot: {
        schema: 'emp1-workbench-route-authority-snapshot/v1',
        semanticHash: `ROUTE-${routeId}`,
        routeId,
        productionUseAuthorized: true,
        routeModuleAuthorized: true,
        registry: {
          schema: 'emp1-c-bounded-route/v1',
          routeId,
          registered: true,
          engineeringUseAuthorized: true,
          method: {
            methodIdentity: 'WRC537_2013_CYLINDRICAL_ORIGINAL_GAMMA5_TABLE5_ZERO_DP',
            methodEdition: '2013',
            sourceDocumentSha256:
              '698fcdc3e676e3bc6bbf710bc28ea8b666ac9511a81a0067a5d01088ae4c27b2',
            datasetHash: 'fb440a292f8794430977f60f5365a678a9aff62a4dae3397621902964a0db73c',
          },
          scope: {
            type: 'CYLINDRICAL_ORIGINAL_GAMMA5_TABLE5_BOUNDED',
            shellFamily: 'CYLINDRICAL',
            attachmentShape: 'ROUND',
            gamma: 5,
            betaMinimum: 0.05,
            betaMaximum: 0.5,
            stressOutputDomain: 'HOST_CYLINDRICAL_SHELL_AT_ATTACHMENT_SHELL_JUNCTURE',
            attachmentStressCalculated: false,
            nozzleStressCalculated: false,
          },
          limitations: ['HOST_CYLINDRICAL_SHELL_ONLY'],
          remainingBlocked: ['GLOBAL_CONTINUOUS_MAXIMUM'],
        },
      },
      codeComplianceProduced: false,
      releaseQualified: false,
    },
    result: {
      productId: 'EMP.1',
      loadTransfer: { resultHash: 'A-1' },
      sectionScreening: { resultHash: 'B-1' },
      localCorrelation: { resultHash: 'C-1' },
      assessment: {
        schema: 'emp1-assessment/v1',
        productId: 'EMP.1',
        decision: 'PASS',
        reasons: [],
        parents,
        authority: {
          wrcEngineeringUseAuthorizedByScaffold: false,
          codeComplianceProduced: false,
          releaseQualified: false,
        },
        interpretation: {
          passIsCodeCompliance: false,
          releaseQualified: false,
          localCorrelationRequiredWhenScreeningEscalates: true,
        },
      },
    },
  };
}

function releaseStateSemanticHash(value) {
  const { currentStateSemanticHash: _hash, status: _status, ...payload } = value;
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
function gitBlobSha1(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}
