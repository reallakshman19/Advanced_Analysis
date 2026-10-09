#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createEmp1EngineeringRecordDeploymentAuthorization,
  requireEmp1EngineeringRecordDeploymentAuthorization,
} from '../src/core/emp1/emp1-engineering-record-deployment-authorization.js';
import {
  EMP1_AUTHORIZED_RELEASE_STATE_ARTIFACT,
  createEmp1EngineeringRecordReleaseQualification,
} from '../src/core/emp1/emp1-engineering-record-release-qualification.js';
import { createEmp1WorkspaceEngineeringRecordPackage } from
  '../src/workspace/emp1-engineering-record-package-workspace.js';
import { createEmp1WorkspaceEngineeringReview } from
  '../src/workspace/emp1-engineering-review-workspace.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const releasePath = EMP1_AUTHORIZED_RELEASE_STATE_ARTIFACT.path;
const releaseBytes = await readFile(resolve(root, releasePath));
const releaseState = JSON.parse(releaseBytes.toString('utf8'));
const releaseArtifact = Object.freeze({
  path: releasePath,
  gitBlobSha1: gitBlobSha1(releaseBytes),
});

assert.equal(releaseArtifact.gitBlobSha1, EMP1_AUTHORIZED_RELEASE_STATE_ARTIFACT.gitBlobSha1);
assert.equal(releaseState.currentStateSemanticHash,
  EMP1_AUTHORIZED_RELEASE_STATE_ARTIFACT.semanticHash);
assert.equal(releaseState.runtimeAuthority.releaseQualified, false);
assert.equal(releaseState.runtimeAuthority.deploymentAuthorized, false);

const acceptedQualification = releaseQualification('ACCEPTED');
assert.equal(acceptedQualification.packageIdentity.recordState, 'REVIEW_ACCEPTED');
assert.equal(acceptedQualification.releaseQualified, false);
assert.equal(acceptedQualification.existingReleaseAuthority.deploymentAuthorized, false);

const blocked = createEmp1EngineeringRecordDeploymentAuthorization({
  releaseQualification: acceptedQualification,
});
assert.equal(blocked.schema, 'emp1-engineering-record-deployment-authorization/v1');
assert.equal(blocked.productId, 'EMP.1');
assert.equal(blocked.state, 'DEPLOYMENT_BLOCKED_RELEASE_NOT_QUALIFIED');
assert.equal(blocked.deploymentAuthorized, false);
assert.equal(blocked.releaseQualificationIdentity.qualificationId,
  acceptedQualification.qualificationId);
assert.equal(blocked.releaseQualificationIdentity.semanticHash,
  acceptedQualification.semanticHash);
assert.equal(blocked.releaseQualificationIdentity.packageId,
  acceptedQualification.packageIdentity.packageId);
assert.equal(blocked.existingAuthority.professionalReleaseReady, false);
assert.equal(blocked.existingAuthority.releaseQualified, false);
assert.equal(blocked.existingAuthority.deploymentAuthorized, false);
assert.ok(blocked.blockers.includes('EMP1_DEPLOYMENT_RELEASE_QUALIFICATION_REQUIRED'));
assert.ok(blocked.blockers.includes('EMP1_DEPLOYMENT_EXISTING_AUTHORITY_REQUIRED'));
assert.equal(blocked.blockers.includes(
  'EMP1_DEPLOYMENT_ACCEPTED_ENGINEERING_REVIEW_REQUIRED'), false);
assert.equal(blocked.authorityBoundary.deploymentAuthorizationBindingAuthority, true);
assert.equal(blocked.authorityBoundary.underlyingDeploymentAuthorityCreatedByThisRecord, false);
assert.equal(blocked.authorityBoundary.callerMaySetDeploymentAuthorized, false);
assert.equal(blocked.authorityBoundary.callerMaySubstituteReleaseQualification, false);
assert.equal(blocked.authorityBoundary.requiresAcceptedEngineeringReview, true);
assert.equal(blocked.authorityBoundary.requiresReleaseQualifiedEngineeringRecord, true);
assert.equal(blocked.authorityBoundary.requiresExistingDeploymentAuthority, true);
assert.equal(blocked.authorityBoundary.executesDeployment, false);
assert.equal(blocked.authorityBoundary.mutatesDeploymentTarget, false);
assert.equal(blocked.authorityBoundary.observesRollbackExecution, false);
assert.equal(blocked.authorityBoundary.authorizesRollbackSuccess, false);
assert.equal(blocked.authorityBoundary.createsCodeCompliance, false);
assert.equal(blocked.authorityBoundary.createsReleaseAuthority, false);
assert.equal(blocked.authorityBoundary.createsUnderlyingDeploymentAuthority, false);
assert.equal(blocked.authorityBoundary.createsCryptographicSeal, false);
assert.equal(Object.isFrozen(blocked), true);
assert.equal(Object.isFrozen(blocked.releaseQualification), true);
assert.deepEqual(requireEmp1EngineeringRecordDeploymentAuthorization(blocked), blocked);

const rejectedQualification = releaseQualification('REJECTED');
const rejected = createEmp1EngineeringRecordDeploymentAuthorization({
  releaseQualification: rejectedQualification,
});
assert.equal(rejected.deploymentAuthorized, false);
assert.equal(rejected.state, 'DEPLOYMENT_BLOCKED_RELEASE_NOT_QUALIFIED');
assert.ok(rejected.blockers.includes(
  'EMP1_DEPLOYMENT_ACCEPTED_ENGINEERING_REVIEW_REQUIRED'));
assert.ok(rejected.blockers.includes('EMP1_DEPLOYMENT_RELEASE_QUALIFICATION_REQUIRED'));
assert.ok(rejected.blockers.includes('EMP1_DEPLOYMENT_EXISTING_AUTHORITY_REQUIRED'));

const forgedDeploymentFlag = structuredClone(blocked);
forgedDeploymentFlag.deploymentAuthorized = true;
assert.throws(
  () => requireEmp1EngineeringRecordDeploymentAuthorization(forgedDeploymentFlag),
  /EMP1_DEPLOYMENT_AUTHORIZATION_FLAG_INVALID/u,
);

const forgedReleaseQualification = structuredClone(blocked);
forgedReleaseQualification.releaseQualification.releaseQualified = true;
assert.throws(
  () => requireEmp1EngineeringRecordDeploymentAuthorization(forgedReleaseQualification),
  /EMP1_RELEASE_QUALIFICATION_RELEASE_FLAG_INVALID/u,
);

const forgedExistingDeploymentAuthority = structuredClone(blocked);
forgedExistingDeploymentAuthority.releaseQualification
  .existingReleaseAuthority.deploymentAuthorized = true;
assert.throws(
  () => requireEmp1EngineeringRecordDeploymentAuthorization(
    forgedExistingDeploymentAuthority,
  ),
  /EMP1_RELEASE_QUALIFICATION_AUTHORIZED_STATE_DRIFT:RECORD_EXISTING_AUTHORITY_deploymentAuthorized/u,
);

const forgedBoundary = structuredClone(blocked);
forgedBoundary.authorityBoundary.executesDeployment = true;
assert.throws(
  () => requireEmp1EngineeringRecordDeploymentAuthorization(forgedBoundary),
  /EMP1_DEPLOYMENT_AUTHORIZATION_BOUNDARY_INVALID:executesDeployment/u,
);

const forgedIdentity = structuredClone(blocked);
forgedIdentity.authorizationId = 'emp1-engineering-record-deployment:forged';
assert.throws(
  () => requireEmp1EngineeringRecordDeploymentAuthorization(forgedIdentity),
  /EMP1_DEPLOYMENT_AUTHORIZATION_IDENTITY_MISMATCH/u,
);

const source = await readFile(resolve(root,
  'src/core/emp1/emp1-engineering-record-deployment-authorization.js'), 'utf8');
assert.equal(source.includes('runEmp1('), false);
assert.equal(source.includes('stressIntensity'), false);
assert.equal(source.includes('emp1-c-bounded-route-registry'), false);
assert.equal(source.includes('emp1-wrc537-gamma5-zero-dp-route'), false);
assert.equal(source.includes('emp1-professional-release-state-authority'), false,
  'deployment binding must consume release authority only through validated release qualification');
assert.equal(source.includes('deploymentOperationsReceiptSha256'), false,
  'operations receipt is evidence custody, not deployment authority');
assert.equal(source.includes('.github/workflows'), false);
assert.equal(source.includes('fetch('), false);
assert.match(source, /callerMaySetDeploymentAuthorized: false/u);
assert.match(source, /requiresReleaseQualifiedEngineeringRecord: true/u);
assert.match(source, /requiresExistingDeploymentAuthority: true/u);
assert.match(source, /executesDeployment: false/u);
assert.match(source, /createsUnderlyingDeploymentAuthority: false/u);
assert.match(source, /createsCryptographicSeal: false/u);

console.log(JSON.stringify({
  schema: 'emp1-engineering-record-deployment-authorization-check/v1',
  status: 'PASS_DEPLOYMENT_BINDING_FAIL_CLOSED_EXISTING_AUTHORITY_ONLY',
  currentReleaseQualificationState: acceptedQualification.state,
  currentReleaseQualified: acceptedQualification.releaseQualified,
  currentDeploymentState: blocked.state,
  currentDeploymentAuthorized: blocked.deploymentAuthorized,
  rejectedReviewDeploymentBlocked: rejected.deploymentAuthorized === false,
  forgedReleaseQualificationRejected: true,
  forgedDeploymentAuthorityRejected: true,
  callerMaySetDeploymentAuthorized: false,
  deploymentExecuted: false,
  underlyingDeploymentAuthorityCreatedByBinding: false,
  cryptographicSealCreated: false,
}, null, 2));

function releaseQualification(disposition) {
  const execution = currentExecution();
  const currentness = Object.freeze({
    state: 'CURRENT', reasons: Object.freeze([]), inputCurrent: true,
    cAuthorityCurrent: true, cReportable: true,
  });
  const cState = Object.freeze({ state: 'CALCULATED_CURRENT', currentResultAvailable: true });
  const review = createEmp1WorkspaceEngineeringReview({
    disposition,
    reviewerIdentity: `engineer:${disposition.toLowerCase()}`,
    reviewerRole: 'ENGINEER',
    comment: disposition === 'ACCEPTED'
      ? 'Accepted bounded engineering record.'
      : 'Correction required.',
    reviewedAt: '2026-09-02T02:10:00.000Z',
    execution,
    executionCurrentness: currentness,
    cState,
  });
  const packageValue = createEmp1WorkspaceEngineeringRecordPackage({
    reviewRecord: review,
    execution,
    executionCurrentness: currentness,
    cState,
    packagedAt: '2026-09-02T02:11:00.000Z',
  });
  return createEmp1EngineeringRecordReleaseQualification({
    packageValue,
    releaseState,
    releaseStateArtifact: releaseArtifact,
  });
}

function currentExecution() {
  const routeId = 'EMP1.C.WRC537.CYLINDRICAL.ORIGINAL.GAMMA5.ZERO_DP';
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

function gitBlobSha1(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}
