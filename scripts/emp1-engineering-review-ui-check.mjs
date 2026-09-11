#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createEmp1WorkspaceEngineeringReview,
  emp1EngineeringReviewEvidenceFromExecution,
  projectEmp1EngineeringReviewWorkspace,
} from '../src/workspace/emp1-engineering-review-workspace.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const execution = currentExecution();
const currentness = Object.freeze({
  state: 'CURRENT', reasons: Object.freeze([]), inputCurrent: true,
  cAuthorityCurrent: true, cReportable: true, routeAuthorityEvaluated: true,
});
const currentC = Object.freeze({
  state: 'CALCULATED_CURRENT', currentResultAvailable: true,
});

const evidence = emp1EngineeringReviewEvidenceFromExecution(execution);
assert.equal(evidence.sourceHash, 'SOURCE-1');
assert.equal(evidence.routeAuthorityHash, 'ROUTE-1');
assert.equal(evidence.routeAuthoritySnapshot.semanticHash, 'ROUTE-1');
assert.equal(evidence.result, execution.result);

const empty = projectEmp1EngineeringReviewWorkspace({
  execution, executionCurrentness: currentness, cState: currentC,
});
assert.equal(empty.schema, 'emp1-engineering-review-workspace/v1');
assert.equal(empty.canCreateReview, true);
assert.deepEqual(empty.creationBlockers, []);
assert.equal(empty.reviewState.state, 'NOT_REVIEWED');
assert.equal(empty.readinessReviewState.state, 'NOT_REVIEWED');
assert.equal(empty.retention.scope, 'WORKSPACE_SESSION_ONLY');
assert.equal(empty.retention.durableExportImplemented, false);
assert.equal(empty.authorityBoundary.uiMayAuthorEngineeringHashes, false);
assert.equal(empty.authorityBoundary.createsCodeCompliance, false);
assert.equal(empty.authorityBoundary.createsReleaseAuthority, false);
assert.equal(empty.authorityBoundary.createsCryptographicSeal, false);

const accepted = createEmp1WorkspaceEngineeringReview({
  disposition: 'ACCEPTED',
  reviewerIdentity: 'engineer:alpha',
  reviewerRole: 'ENGINEER',
  comment: 'Reviewed bounded result and limitations.',
  reviewedAt: '2026-09-01T16:45:00Z',
  execution,
  executionCurrentness: currentness,
  cState: currentC,
});
assert.equal(accepted.disposition, 'ACCEPTED');
assert.equal(accepted.reviewer.identity, 'engineer:alpha');
assert.equal(accepted.basisCode, 'EMP1_ENGINEERING_RESULT_REVIEW');
assert.equal(accepted.interpretation.acceptanceIsCodeCompliance, false);
assert.equal(accepted.interpretation.acceptanceIsReleaseQualification, false);
assert.equal(accepted.interpretation.professionalDigitalSeal, false);

const acceptedWorkspace = projectEmp1EngineeringReviewWorkspace({
  reviewRecord: accepted, execution, executionCurrentness: currentness, cState: currentC,
});
assert.equal(acceptedWorkspace.reviewState.state, 'REVIEW_ACCEPTED');
assert.equal(acceptedWorkspace.reviewState.current, true);
assert.equal(acceptedWorkspace.readinessReviewState.state, 'REVIEW_ACCEPTED');
assert.equal(acceptedWorkspace.retainedReview.reviewId, accepted.reviewId);

const rejected = createEmp1WorkspaceEngineeringReview({
  disposition: 'REJECTED',
  reviewerIdentity: 'engineer:beta',
  comment: 'Correction required.',
  reviewedAt: '2026-09-01T16:46:00Z',
  execution,
  executionCurrentness: currentness,
  cState: currentC,
});
const rejectedWorkspace = projectEmp1EngineeringReviewWorkspace({
  reviewRecord: rejected, execution, executionCurrentness: currentness, cState: currentC,
});
assert.equal(rejectedWorkspace.reviewState.state, 'REVIEW_REJECTED');
assert.equal(rejectedWorkspace.reviewState.current, true);

const changedExecution = structuredClone(execution);
changedExecution.result.localCorrelation.resultHash = 'C-2';
changedExecution.result.assessment.parents.localCorrelationResultHash = 'C-2';
const staleWorkspace = projectEmp1EngineeringReviewWorkspace({
  reviewRecord: accepted,
  execution: changedExecution,
  executionCurrentness: currentness,
  cState: currentC,
});
assert.equal(staleWorkspace.reviewState.state, 'REVIEW_STALE');
assert.equal(staleWorkspace.reviewState.current, false);
assert.ok(staleWorkspace.reviewState.changedBindings.includes('localCorrelationResultHash'));
assert.ok(staleWorkspace.reviewState.changedBindings.includes('assessmentSemanticHash'));

const staleCurrentness = Object.freeze({
  state: 'STALE', reasons: Object.freeze(['EMP1_WORKBENCH_ATTACHMENTGEOMETRY_CHANGED']),
  inputCurrent: false, cAuthorityCurrent: true, cReportable: false,
  routeAuthorityEvaluated: true,
});
const blockedWorkspace = projectEmp1EngineeringReviewWorkspace({
  reviewRecord: accepted,
  execution,
  executionCurrentness: staleCurrentness,
  cState: Object.freeze({ state: 'STALE_INPUT', currentResultAvailable: false }),
});
assert.equal(blockedWorkspace.canCreateReview, false);
assert.ok(blockedWorkspace.creationBlockers.includes('EMP1_ENGINEERING_REVIEW_EXECUTION_NOT_CURRENT'));
assert.ok(blockedWorkspace.creationBlockers.includes('EMP1_ENGINEERING_REVIEW_INPUT_CURRENTNESS_REQUIRED'));
assert.ok(blockedWorkspace.creationBlockers.includes('EMP1_ENGINEERING_REVIEW_CURRENT_C_RESULT_REQUIRED'));
assert.equal(blockedWorkspace.reviewState.state, 'REVIEW_STALE');
assert.equal(blockedWorkspace.reviewState.current, false);
assert.equal(blockedWorkspace.readinessReviewState.state, 'REVIEW_STALE');
assert.ok(blockedWorkspace.reviewState.changedBindings.includes('executionCurrentness'));
assert.deepEqual(blockedWorkspace.reviewState.stalenessReasons,
  ['EMP1_WORKBENCH_ATTACHMENTGEOMETRY_CHANGED']);
assert.throws(
  () => createEmp1WorkspaceEngineeringReview({
    disposition: 'ACCEPTED', reviewerIdentity: 'engineer:test',
    reviewedAt: '2026-09-01T16:47:00Z', execution,
    executionCurrentness: staleCurrentness,
    cState: { state: 'STALE_INPUT', currentResultAvailable: false },
  }),
  (error) => error?.code === 'EMP1_ENGINEERING_REVIEW_CURRENT_CALCULATION_REQUIRED',
);

const routeStale = Object.freeze({
  state: 'STALE', reasons: Object.freeze(['EMP1_WORKBENCH_ROUTE_AUTHORITY_CHANGED']),
  inputCurrent: true, cAuthorityCurrent: false, cReportable: false,
  routeAuthorityEvaluated: true,
});
const routeBlocked = projectEmp1EngineeringReviewWorkspace({
  execution, executionCurrentness: routeStale,
  cState: { state: 'STALE_AUTHORITY', currentResultAvailable: false },
});
assert.equal(routeBlocked.canCreateReview, false);
assert.ok(routeBlocked.creationBlockers.includes(
  'EMP1_ENGINEERING_REVIEW_ROUTE_AUTHORITY_CURRENTNESS_REQUIRED'));

const mismatchedRoute = structuredClone(execution);
mismatchedRoute.authority.routeAuthoritySnapshot.semanticHash = 'ROUTE-OTHER';
assert.throws(
  () => emp1EngineeringReviewEvidenceFromExecution(mismatchedRoute),
  (error) => error?.code === 'EMP1_ENGINEERING_REVIEW_EXECUTION_ROUTE_AUTHORITY_MISMATCH',
);

const retainedOnly = projectEmp1EngineeringReviewWorkspace({ reviewRecord: accepted });
assert.equal(retainedOnly.retainedReview.reviewId, accepted.reviewId);
assert.equal(retainedOnly.readinessReviewState, null,
  'a retained review without current execution evidence must not enter readiness');
assert.equal(retainedOnly.canCreateReview, false);

const adapterSource = await read('src/workspace/emp1-engineering-review-workspace.js');
assert.equal(adapterSource.includes('runEmp1('), false);
assert.equal(adapterSource.includes('stressIntensity'), false);
assert.equal(adapterSource.includes('releaseQualified: true'), false);
assert.match(adapterSource, /value\.sourceHash/u);
assert.match(adapterSource, /authority\.routeAuthorityHash/u);
assert.match(adapterSource, /authority\.routeAuthoritySnapshot/u);
assert.match(adapterSource, /value\.result/u);

const controllerSource = await read('src/workspace/lafea-workbench-controller.js');
assert.match(controllerSource, /createEmp1WorkspaceEngineeringReview/u);
assert.match(controllerSource, /classifyEmp1WorkbenchExecutionCurrentness/u);
assert.match(controllerSource, /projectEmp1WorkbenchCState/u);
assert.match(controllerSource, /getEmp1EngineeringReviewWorkspace/u);
assert.match(controllerSource, /onEmp1EngineeringReview/u);
assert.equal(controllerSource.includes('reviewRequest.sourceHash'), false);
assert.equal(controllerSource.includes('request.sourceHash'), false);
assert.equal(controllerSource.includes('request.routeAuthorityHash'), false);
assert.equal(controllerSource.includes('request.resultHash'), false);

const reviewViewSource = await read('src/workspace/emp1-engineering-review-view.js');
assert.match(reviewViewSource, /disposition,/u);
assert.match(reviewViewSource, /reviewerIdentity: identity\.input\.value/u);
assert.match(reviewViewSource, /reviewerRole: role\.input\.value/u);
assert.match(reviewViewSource, /comment: comment\.value/u);
for (const forbidden of [
  'sourceHash:', 'routeAuthorityHash:', 'resultHash:', 'semanticHash(',
  'runEmp1(', 'stressIntensity', 'releaseQualified: true', 'professionalDigitalSeal: true',
]) assert.equal(reviewViewSource.includes(forbidden), false, `review UI must not contain ${forbidden}`);
assert.match(reviewViewSource, /workspace session/u);
assert.match(reviewViewSource, /not code compliance, release qualification/u);

const workflowSource = await read('src/workspace/emp1-professional-workflow-view.js');
assert.match(workflowSource, /reviewState: reviewWorkspace\?\.readinessReviewState \?\? null/u);
assert.match(workflowSource, /renderEmp1EngineeringReviewPanel/u);
assert.equal((workflowSource.match(/projectEmp1Readiness\(/gu) ?? []).length, 1);

const analyticalSource = await read('src/workspace/lafea-analytical-calc-content.js');
assert.match(analyticalSource, /getEmp1EngineeringReviewWorkspace\?\.\(\)/u);
assert.match(analyticalSource, /onReview: options\.handlers\.onEmp1EngineeringReview/u);

console.log(JSON.stringify({
  schema: 'emp1-engineering-review-ui-check/v1',
  status: 'PASS_CURRENT_EXECUTION_GATED_REVIEW_UI_CONTRACT',
  acceptedState: acceptedWorkspace.reviewState.state,
  rejectedState: rejectedWorkspace.reviewState.state,
  staleState: staleWorkspace.reviewState.state,
  staleCurrentnessReviewState: blockedWorkspace.reviewState.state,
  staleCreationBlocked: blockedWorkspace.canCreateReview === false,
  routeAuthorityStaleCreationBlocked: routeBlocked.canCreateReview === false,
  retentionScope: empty.retention.scope,
  uiAuthoredEngineeringHashes: false,
  codeComplianceCreatedByReviewUi: false,
  releaseAuthorityCreatedByReviewUi: false,
  cryptographicSealClaimed: false,
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
      routeAuthoritySnapshot: { semanticHash: 'ROUTE-1' },
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

async function read(path) { return readFile(resolve(root, path), 'utf8'); }
