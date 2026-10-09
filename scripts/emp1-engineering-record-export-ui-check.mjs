#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createEmp1WorkspaceEngineeringReview,
  projectEmp1EngineeringReviewWorkspace,
} from '../src/workspace/emp1-engineering-review-workspace.js';
import {
  createEmp1EngineeringRecordPackage,
  requireEmp1EngineeringRecordPackage,
} from '../src/core/emp1/emp1-engineering-record-package.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const execution = currentExecution();
const currentness = Object.freeze({
  state: 'CURRENT', reasons: Object.freeze([]), inputCurrent: true,
  cAuthorityCurrent: true, cReportable: true, routeAuthorityEvaluated: true,
});
const currentC = Object.freeze({ state: 'CALCULATED_CURRENT', currentResultAvailable: true });

const noReview = projectEmp1EngineeringReviewWorkspace({
  execution, executionCurrentness: currentness, cState: currentC,
});
assert.equal(noReview.engineeringRecordExport.canExport, false);
assert.ok(noReview.engineeringRecordExport.blockers.includes('EMP1_ENGINEERING_RECORD_REVIEW_REQUIRED'));
assert.equal(noReview.engineeringRecordExport.packageInput, null);

const accepted = createEmp1WorkspaceEngineeringReview({
  disposition: 'ACCEPTED', reviewerIdentity: 'engineer:alpha',
  reviewedAt: '2026-09-01T17:58:00Z', execution,
  executionCurrentness: currentness, cState: currentC,
});
const acceptedWorkspace = projectEmp1EngineeringReviewWorkspace({
  reviewRecord: accepted, execution, executionCurrentness: currentness, cState: currentC,
});
assert.equal(acceptedWorkspace.engineeringRecordExport.canExport, true);
assert.deepEqual(acceptedWorkspace.engineeringRecordExport.blockers, []);
assert.equal(acceptedWorkspace.engineeringRecordExport.packageInput.reviewRecord, accepted);
assert.equal(acceptedWorkspace.engineeringRecordExport.packageInput.evidence.sourceHash, 'SOURCE-1');
assert.equal(acceptedWorkspace.retention.durableExportImplemented, true);
assert.equal(acceptedWorkspace.authorityBoundary.uiMayAuthorEngineeringHashes, false);
assert.equal(acceptedWorkspace.authorityBoundary.uiMayCreateAuditPackageIdentity, true);

const packageValue = createEmp1EngineeringRecordPackage({
  ...acceptedWorkspace.engineeringRecordExport.packageInput,
  packagedAt: '2026-09-01T17:59:00Z',
});
assert.equal(requireEmp1EngineeringRecordPackage(packageValue).packageId, packageValue.packageId);
assert.equal(packageValue.recordState, 'REVIEW_ACCEPTED');
assert.equal(packageValue.authorityBoundary.createsReleaseAuthority, false);
assert.equal(packageValue.authorityBoundary.createsCryptographicSeal, false);

const rejected = createEmp1WorkspaceEngineeringReview({
  disposition: 'REJECTED', reviewerIdentity: 'engineer:beta',
  reviewedAt: '2026-09-01T17:58:10Z', execution,
  executionCurrentness: currentness, cState: currentC,
});
const rejectedWorkspace = projectEmp1EngineeringReviewWorkspace({
  reviewRecord: rejected, execution, executionCurrentness: currentness, cState: currentC,
});
assert.equal(rejectedWorkspace.engineeringRecordExport.canExport, true,
  'rejected current review remains exportable as truthful audit custody');

const changedExecution = structuredClone(execution);
changedExecution.result.localCorrelation.resultHash = 'C-2';
changedExecution.result.assessment.parents.localCorrelationResultHash = 'C-2';
const stale = projectEmp1EngineeringReviewWorkspace({
  reviewRecord: accepted, execution: changedExecution,
  executionCurrentness: currentness, cState: currentC,
});
assert.equal(stale.reviewState.state, 'REVIEW_STALE');
assert.equal(stale.engineeringRecordExport.canExport, false);
assert.ok(stale.engineeringRecordExport.blockers.includes('EMP1_ENGINEERING_RECORD_CURRENT_REVIEW_REQUIRED'));
assert.equal(stale.engineeringRecordExport.packageInput, null);

const staleInput = projectEmp1EngineeringReviewWorkspace({
  reviewRecord: accepted,
  execution,
  executionCurrentness: {
    state: 'STALE', reasons: ['EMP1_WORKBENCH_ATTACHMENTGEOMETRY_CHANGED'],
    inputCurrent: false, cAuthorityCurrent: true,
  },
  cState: { state: 'STALE_INPUT', currentResultAvailable: false },
});
assert.equal(staleInput.engineeringRecordExport.canExport, false);
assert.ok(staleInput.engineeringRecordExport.blockers.includes('EMP1_ENGINEERING_RECORD_CURRENT_EXECUTION_REQUIRED'));

const workspaceSource = await read('src/workspace/emp1-engineering-review-workspace.js');
assert.match(workspaceSource, /engineeringRecordExport/u);
assert.match(workspaceSource, /uiMayAuthorEngineeringHashes: false/u);
assert.equal(workspaceSource.includes('runEmp1('), false);
assert.equal(workspaceSource.includes('stressIntensity'), false);
assert.equal(workspaceSource.includes('releaseQualified = true'), false);

const viewSource = await read('src/workspace/emp1-engineering-review-view.js');
assert.match(viewSource, /Download Engineering Record/u);
assert.match(viewSource, /createEmp1EngineeringRecordPackage/u);
assert.match(viewSource, /emp1EngineeringRecordPackageFilename/u);
assert.match(viewSource, /downloadLafeaJson/u);
assert.match(viewSource, /descriptor\?\.canExport !== true/u);
assert.match(viewSource, /not code compliance, release qualification/u);
assert.equal(viewSource.includes('runEmp1('), false);
assert.equal(viewSource.includes('stressIntensity'), false);
assert.equal(viewSource.includes('routeAuthorityHash:'), false,
  'DOM must not author a route-authority hash');
assert.equal(viewSource.includes('sourceHash:'), false,
  'DOM must not author a source hash');

console.log(JSON.stringify({
  schema: 'emp1-engineering-record-export-ui-check/v1',
  status: 'PASS_GOVERNED_ENGINEERING_RECORD_EXPORT_UI_CONTRACT',
  acceptedExportAvailable: acceptedWorkspace.engineeringRecordExport.canExport,
  rejectedExportAvailable: rejectedWorkspace.engineeringRecordExport.canExport,
  noReviewExportBlocked: !noReview.engineeringRecordExport.canExport,
  staleReviewExportBlocked: !stale.engineeringRecordExport.canExport,
  staleInputExportBlocked: !staleInput.engineeringRecordExport.canExport,
  uiAuthoredEngineeringHashes: false,
  releaseAuthorityCreatedByExportUi: false,
  cryptographicSealCreatedByExportUi: false,
}, null, 2));

function currentExecution() {
  const parents = {
    sourceHash: 'SOURCE-1', loadTransferResultHash: 'A-1',
    sectionScreeningResultHash: 'B-1', localCorrelationResultHash: 'C-1',
  };
  return {
    schema: 'emp1-workbench-product-execution/v2', productId: 'EMP.1', sourceHash: 'SOURCE-1',
    authority: {
      boundedLocalRouteExecuted: true,
      routeAuthorityHash: 'ROUTE-1',
      routeAuthoritySnapshot: {
        schema: 'emp1-workbench-route-authority-snapshot/v1', semanticHash: 'ROUTE-1',
        registry: {
          method: { methodIdentity: 'WRC537_GAMMA5', methodEdition: '2013' },
          scope: { gamma: 5, shellFamily: 'CYLINDRICAL' },
          limitations: ['HOST_SHELL_ONLY'], remainingBlocked: ['GLOBAL_MAXIMUM'],
        },
      },
      codeComplianceProduced: false, releaseQualified: false,
    },
    result: {
      productId: 'EMP.1',
      loadTransfer: { resultHash: 'A-1' },
      sectionScreening: { resultHash: 'B-1' },
      localCorrelation: { resultHash: 'C-1' },
      assessment: {
        schema: 'emp1-assessment/v1', productId: 'EMP.1', decision: 'PASS', reasons: [], parents,
        authority: { wrcEngineeringUseAuthorizedByScaffold: false, codeComplianceProduced: false, releaseQualified: false },
        interpretation: { passIsCodeCompliance: false, releaseQualified: false, localCorrelationRequiredWhenScreeningEscalates: true },
      },
    },
  };
}

async function read(path) { return readFile(resolve(root, path), 'utf8'); }
