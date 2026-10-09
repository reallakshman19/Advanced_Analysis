#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createEmp1EngineeringRecordPackage,
  requireEmp1EngineeringRecordPackage,
} from '../src/core/emp1/emp1-engineering-record-package.js';
import {
  createEmp1WorkspaceEngineeringRecordPackage,
  emp1EngineeringRecordPackageFilename,
  projectEmp1EngineeringRecordPackageAvailability,
} from '../src/workspace/emp1-engineering-record-package-workspace.js';
import {
  createEmp1WorkspaceEngineeringReview,
  emp1EngineeringReviewEvidenceFromExecution,
} from '../src/workspace/emp1-engineering-review-workspace.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const currentness = Object.freeze({
  state: 'CURRENT',
  reasons: Object.freeze([]),
  inputCurrent: true,
  cAuthorityCurrent: true,
  cReportable: true,
});
const cState = Object.freeze({
  state: 'CALCULATED_CURRENT',
  currentResultAvailable: true,
});

const execution = currentExecution();
const acceptedReview = createEmp1WorkspaceEngineeringReview({
  disposition: 'ACCEPTED',
  reviewerIdentity: 'ENGINEER-01',
  reviewerRole: 'CHECKER',
  comment: 'Reviewed against retained governed evidence.',
  reviewedAt: '2026-09-01T17:30:00.000Z',
  execution,
  executionCurrentness: currentness,
  cState,
});
const acceptedAvailability = projectEmp1EngineeringRecordPackageAvailability({
  reviewRecord: acceptedReview,
  execution,
  executionCurrentness: currentness,
  cState,
});
assert.equal(acceptedAvailability.canExport, true);
assert.deepEqual(acceptedAvailability.blockers, []);
assert.equal(acceptedAvailability.reviewState, 'REVIEW_ACCEPTED');

const acceptedPackage = createEmp1WorkspaceEngineeringRecordPackage({
  reviewRecord: acceptedReview,
  execution,
  executionCurrentness: currentness,
  cState,
  packagedAt: '2026-09-01T17:35:00.000Z',
});
assert.equal(acceptedPackage.schema, 'emp1-engineering-record-package/v1');
assert.equal(acceptedPackage.productId, 'EMP.1');
assert.equal(acceptedPackage.recordState, 'REVIEW_ACCEPTED');
assert.equal(acceptedPackage.evidence.sourceHash, 'SOURCE-1');
assert.equal(acceptedPackage.evidence.loadTransferResultHash, 'A-1');
assert.equal(acceptedPackage.evidence.sectionScreeningResultHash, 'B-1');
assert.equal(acceptedPackage.evidence.localCorrelationResultHash, 'C-1');
assert.equal(acceptedPackage.evidence.routeAuthorityHash, 'ROUTE-1');
assert.equal(acceptedPackage.evidence.reviewSemanticHash, acceptedReview.semanticHash);
assert.equal(acceptedPackage.routeAuthority.semanticHash, 'ROUTE-1');
assert.equal(acceptedPackage.routeAuthority.snapshot.routeId, 'EMP1-C-WRC537-GAMMA5-ZERO-DP');
assert.deepEqual(acceptedPackage.limitations.routeLimitations, [
  'HOST_CYLINDRICAL_SHELL_ONLY',
  'NO_ATTACHMENT_OR_NOZZLE_STRESS',
]);
assert.deepEqual(acceptedPackage.limitations.remainingBlocked, [
  'GLOBAL_CONTINUOUS_MAXIMUM',
  'NON_TABULATED_GAMMA',
]);
assert.equal(acceptedPackage.limitations.method.methodIdentity,
  'WRC537_2013_CYLINDRICAL_ORIGINAL_GAMMA5_TABLE5_ZERO_DP');
assert.equal(acceptedPackage.limitations.scope.gamma, 5);
assert.equal(Object.isFrozen(acceptedPackage), true);
assert.equal(Object.isFrozen(acceptedPackage.routeAuthority.snapshot), true);
assert.equal(Object.isFrozen(acceptedPackage.review), true);
assert.equal(acceptedPackage.authorityBoundary.auditRecordOnly, true);
assert.equal(acceptedPackage.authorityBoundary.createsPackageIdentity, true);
assert.equal(acceptedPackage.authorityBoundary.createsEngineeringCalculationAuthority, false);
assert.equal(acceptedPackage.authorityBoundary.createsSourceAuthority, false);
assert.equal(acceptedPackage.authorityBoundary.createsMethodAuthority, false);
assert.equal(acceptedPackage.authorityBoundary.createsApplicabilityAuthority, false);
assert.equal(acceptedPackage.authorityBoundary.createsReviewAuthority, false);
assert.equal(acceptedPackage.authorityBoundary.createsCodeCompliance, false);
assert.equal(acceptedPackage.authorityBoundary.createsReleaseAuthority, false);
assert.equal(acceptedPackage.authorityBoundary.createsDeploymentAuthority, false);
assert.equal(acceptedPackage.authorityBoundary.createsCryptographicSeal, false);
assert.match(acceptedPackage.packageId, /^emp1-engineering-record:/u);
assert.ok(acceptedPackage.semanticHash);
assert.match(emp1EngineeringRecordPackageFilename(acceptedPackage),
  /^emp1-engineering-record-.+\.json$/u);
assert.deepEqual(requireEmp1EngineeringRecordPackage(acceptedPackage), acceptedPackage);

const rejectedReview = createEmp1WorkspaceEngineeringReview({
  disposition: 'REJECTED',
  reviewerIdentity: 'ENGINEER-02',
  comment: 'Correction required.',
  reviewedAt: '2026-09-01T17:40:00.000Z',
  execution,
  executionCurrentness: currentness,
  cState,
});
const rejectedPackage = createEmp1WorkspaceEngineeringRecordPackage({
  reviewRecord: rejectedReview,
  execution,
  executionCurrentness: currentness,
  cState,
  packagedAt: '2026-09-01T17:41:00.000Z',
});
assert.equal(rejectedPackage.recordState, 'REVIEW_REJECTED');
assert.equal(rejectedPackage.review.disposition, 'REJECTED');

const noReview = projectEmp1EngineeringRecordPackageAvailability({
  reviewRecord: null,
  execution,
  executionCurrentness: currentness,
  cState,
});
assert.equal(noReview.canExport, false);
assert.ok(noReview.blockers.includes('EMP1_ENGINEERING_RECORD_REVIEW_REQUIRED'));
assert.ok(noReview.blockers.includes('EMP1_ENGINEERING_RECORD_CURRENT_REVIEW_REQUIRED'));

const changedExecution = withChangedLocalResult(execution);
const staleReview = projectEmp1EngineeringRecordPackageAvailability({
  reviewRecord: acceptedReview,
  execution: changedExecution,
  executionCurrentness: currentness,
  cState,
});
assert.equal(staleReview.canExport, false);
assert.equal(staleReview.reviewState, 'REVIEW_STALE');
assert.ok(staleReview.blockers.includes('EMP1_ENGINEERING_RECORD_CURRENT_REVIEW_REQUIRED'));
assert.throws(() => createEmp1WorkspaceEngineeringRecordPackage({
  reviewRecord: acceptedReview,
  execution: changedExecution,
  executionCurrentness: currentness,
  cState,
  packagedAt: '2026-09-01T17:45:00.000Z',
}), /EMP1_ENGINEERING_RECORD_PACKAGE_NOT_AVAILABLE/u);

const staleInputAvailability = projectEmp1EngineeringRecordPackageAvailability({
  reviewRecord: acceptedReview,
  execution,
  executionCurrentness: {
    ...currentness,
    state: 'STALE',
    inputCurrent: false,
    reasons: ['EMP1_WORKBENCH_ATTACHMENTGEOMETRY_CHANGED'],
  },
  cState: { state: 'STALE_INPUT', currentResultAvailable: false },
});
assert.equal(staleInputAvailability.canExport, false);
assert.ok(staleInputAvailability.blockers.includes('EMP1_ENGINEERING_RECORD_CURRENT_EXECUTION_REQUIRED'));

const evidence = emp1EngineeringReviewEvidenceFromExecution(execution);
assert.throws(() => createEmp1EngineeringRecordPackage({
  reviewRecord: acceptedReview,
  evidence: { ...evidence, routeAuthorityHash: 'ROUTE-TAMPERED' },
  packagedAt: '2026-09-01T17:50:00.000Z',
}), /ROUTE_AUTHORITY/u);

const tamperedEvidence = structuredClone(acceptedPackage);
tamperedEvidence.evidence.localCorrelationResultHash = 'C-TAMPERED';
assert.throws(() => requireEmp1EngineeringRecordPackage(tamperedEvidence),
  /EMP1_ENGINEERING_RECORD_REVIEW_BINDING_MISMATCH:localCorrelationResultHash/u);

const tamperedLimitations = structuredClone(acceptedPackage);
tamperedLimitations.limitations.routeLimitations.push('INVENTED_LIMITATION');
assert.throws(() => requireEmp1EngineeringRecordPackage(tamperedLimitations),
  /EMP1_ENGINEERING_RECORD_LIMITATIONS_MISMATCH/u);

const tamperedIdentity = structuredClone(acceptedPackage);
tamperedIdentity.packagedAt = '2026-09-01T18:00:00.000Z';
assert.throws(() => requireEmp1EngineeringRecordPackage(tamperedIdentity),
  /EMP1_ENGINEERING_RECORD_PACKAGE_IDENTITY_MISMATCH/u);

const coreSource = await read('src/core/emp1/emp1-engineering-record-package.js');
assert.equal(coreSource.includes('runEmp1('), false,
  'record package must not execute EMP.1');
assert.equal(coreSource.includes('stressIntensity'), false,
  'record package must not reconstruct WRC stress intensity');
assert.equal(coreSource.includes('qualifiedApplicability'), false,
  'record package must not re-evaluate WRC applicability');
assert.equal(coreSource.includes('emp1-wrc537-gamma5-zero-dp-route'), false,
  'record package must not import the WRC route owner');
assert.equal((coreSource.match(/semanticHash\(/gu) ?? []).length, 2,
  'semanticHash is reserved for package create/validate identity in this module');
assert.match(coreSource, /RETAINED_ROUTE_AUTHORITY_SNAPSHOT_ONLY/u);
assert.match(coreSource, /createsReleaseAuthority: false/u);
assert.match(coreSource, /createsCryptographicSeal: false/u);

const workspaceSource = await read('src/workspace/emp1-engineering-record-package-workspace.js');
assert.equal(workspaceSource.includes('semanticHash('), false,
  'workspace adapter must not create engineering/package hashes directly');
assert.equal(workspaceSource.includes('stressIntensity'), false);
assert.equal(workspaceSource.includes('releaseQualified'), false);
assert.match(workspaceSource, /emp1EngineeringReviewEvidenceFromExecution\(execution\)/u);
assert.match(workspaceSource, /EXPORTED_JSON_ONLY/u);

console.log(JSON.stringify({
  schema: 'emp1-engineering-record-package-check/v1',
  status: 'PASS_HASH_BOUND_AUDIT_PACKAGE_CONTRACT',
  acceptedRecordState: acceptedPackage.recordState,
  rejectedRecordState: rejectedPackage.recordState,
  staleReviewExportBlocked: staleReview.canExport === false,
  staleInputExportBlocked: staleInputAvailability.canExport === false,
  sourceIdentity: acceptedPackage.evidence.sourceHash,
  calculationIdentities: {
    A: acceptedPackage.evidence.loadTransferResultHash,
    B: acceptedPackage.evidence.sectionScreeningResultHash,
    C: acceptedPackage.evidence.localCorrelationResultHash,
  },
  routeAuthorityIdentity: acceptedPackage.evidence.routeAuthorityHash,
  reviewIdentity: acceptedPackage.evidence.reviewSemanticHash,
  routeLimitationsRetained: acceptedPackage.limitations.routeLimitations.length,
  remainingBlockedRetained: acceptedPackage.limitations.remainingBlocked.length,
  engineeringCalculationAuthorityCreated: false,
  codeComplianceCreated: false,
  releaseAuthorityCreated: false,
  cryptographicSealCreated: false,
}, null, 2));

function currentExecution() {
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
      routeAuthorityHash: 'ROUTE-1',
      routeAuthoritySnapshot: {
        schema: 'emp1-workbench-route-authority-snapshot/v1',
        semanticHash: 'ROUTE-1',
        routeId: 'EMP1-C-WRC537-GAMMA5-ZERO-DP',
        productionUseAuthorized: true,
        routeModuleAuthorized: true,
        registry: {
          schema: 'emp1-c-bounded-route/v1',
          routeId: 'EMP1-C-WRC537-GAMMA5-ZERO-DP',
          registered: true,
          engineeringUseAuthorized: true,
          method: {
            methodIdentity: 'WRC537_2013_CYLINDRICAL_ORIGINAL_GAMMA5_TABLE5_ZERO_DP',
            methodEdition: '2013',
            sourceDocumentSha256: 'SOURCE-DOC-1',
            datasetHash: 'DATASET-1',
          },
          scope: {
            type: 'CYLINDRICAL_ORIGINAL_GAMMA5_TABLE5_BOUNDED',
            gamma: 5,
            betaMinimum: 0.05,
            betaMaximum: 0.5,
            stressOutputDomain: 'HOST_CYLINDRICAL_SHELL_AT_ATTACHMENT_SHELL_JUNCTURE',
            attachmentStressCalculated: false,
            nozzleStressCalculated: false,
          },
          limitations: [
            'HOST_CYLINDRICAL_SHELL_ONLY',
            'NO_ATTACHMENT_OR_NOZZLE_STRESS',
          ],
          remainingBlocked: [
            'GLOBAL_CONTINUOUS_MAXIMUM',
            'NON_TABULATED_GAMMA',
          ],
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
      assessment: assessment(parents),
    },
  };
}

function withChangedLocalResult(executionValue) {
  const changed = structuredClone(executionValue);
  changed.result.localCorrelation.resultHash = 'C-2';
  changed.result.assessment = assessment({
    ...changed.result.assessment.parents,
    localCorrelationResultHash: 'C-2',
  });
  return changed;
}

function assessment(parents) {
  return {
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
  };
}

async function read(path) { return readFile(resolve(root, path), 'utf8'); }
