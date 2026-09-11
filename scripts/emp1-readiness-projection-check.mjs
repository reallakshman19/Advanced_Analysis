import assert from 'node:assert/strict';
import {
  EMP1_READINESS_OVERALL,
  EMP1_READINESS_SCHEMA,
  projectEmp1Readiness,
} from '../src/core/emp1/emp1-readiness-projection.js';

const current = projectEmp1Readiness(fixture());
assert.equal(current.schema, EMP1_READINESS_SCHEMA);
assert.equal(current.source.state, 'CURRENT');
assert.equal(current.method.state, 'AUTHORIZED_BOUNDED_ROUTE');
assert.equal(current.applicability.state, 'QUALIFIED_BY_CURRENT_EXECUTION_GATE');
assert.equal(current.calculation.state, 'CURRENT');
assert.equal(current.review.state, 'NOT_REVIEWED');
assert.equal(current.codeCompliance.state, 'NOT_ASSESSED');
assert.equal(current.release.state, 'NOT_QUALIFIED');
assert.equal(current.overall, EMP1_READINESS_OVERALL.READY_FOR_ENGINEERING_REVIEW);
assert.equal(current.authorityBoundary.createsEngineeringAuthority, false);
assert.equal(current.authorityBoundary.createsApplicabilityAuthority, false);
assert.equal(current.authorityBoundary.createsCodeCompliance, false);
assert.equal(current.authorityBoundary.createsReleaseAuthority, false);

const missingA = projectEmp1Readiness(fixture({
  aDocumentLoaded: false,
  aResultAvailable: false,
  cState: 'SOURCE_INCOMPLETE',
  cResultAvailable: false,
  cRetainedResultAvailable: false,
  cBlockers: ['EMP1_WORKBENCH_A_DOCUMENT_REQUIRED'],
}));
assert.equal(missingA.source.state, 'INPUT_REQUIRED');
assert.equal(missingA.overall, EMP1_READINESS_OVERALL.INPUT_REQUIRED);
assert.ok(missingA.blockers.includes('EMP1_READINESS_A_SOURCE_REQUIRED'));
assert.ok(missingA.blockers.includes('EMP1_WORKBENCH_A_DOCUMENT_REQUIRED'));

const staleB = projectEmp1Readiness(fixture({
  bState: 'STALE_A_EVIDENCE',
  bResultAvailable: false,
  custodyRefreshBlockerCode: 'EMP1_B_SOURCE_REFRESH_REQUIRED',
}));
assert.equal(staleB.source.state, 'STALE');
assert.equal(staleB.overall, EMP1_READINESS_OVERALL.SOURCE_STALE);
assert.ok(staleB.blockers.includes('EMP1_B_SOURCE_REFRESH_REQUIRED'));

const suspended = projectEmp1Readiness(fixture({
  cState: 'ROUTE_SUSPENDED',
  cResultAvailable: false,
  cRetainedResultAvailable: false,
  cBlockers: ['EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_SUSPENDED'],
}));
assert.equal(suspended.source.state, 'CURRENT');
assert.equal(suspended.method.state, 'BLOCKED');
assert.equal(suspended.applicability.state, 'NOT_ESTABLISHED');
assert.equal(suspended.calculation.state, 'BLOCKED');
assert.equal(suspended.overall, EMP1_READINESS_OVERALL.METHOD_BLOCKED);

const boundedRouteAvailable = projectEmp1Readiness(fixture({
  cState: 'BOUNDED_ROUTE_AVAILABLE',
  cResultAvailable: false,
  cRetainedResultAvailable: false,
}));
assert.equal(boundedRouteAvailable.source.state, 'CURRENT');
assert.equal(boundedRouteAvailable.method.state, 'AUTHORIZED_BOUNDED_ROUTE');
assert.equal(boundedRouteAvailable.applicability.state, 'PENDING_EXECUTION_GATE');
assert.equal(boundedRouteAvailable.calculation.state, 'READY_TO_CALCULATE');
assert.equal(boundedRouteAvailable.overall, EMP1_READINESS_OVERALL.READY_TO_CALCULATE);
assert.equal(boundedRouteAvailable.blockers.length, 0);

const ready = projectEmp1Readiness(fixture({
  cState: 'READY_TO_RUN',
  cResultAvailable: false,
  cRetainedResultAvailable: false,
}));
assert.equal(ready.method.state, 'AUTHORIZED_BOUNDED_ROUTE');
assert.equal(ready.applicability.state, 'PENDING_EXECUTION_GATE');
assert.equal(ready.calculation.state, 'READY_TO_CALCULATE');
assert.equal(ready.overall, EMP1_READINESS_OVERALL.READY_TO_CALCULATE);

const staleInput = projectEmp1Readiness(fixture({
  cState: 'STALE_INPUT',
  cResultAvailable: false,
  cRetainedResultAvailable: true,
  cBlockers: ['EMP1_WORKBENCH_ATTACHMENTGEOMETRY_CHANGED'],
}));
assert.equal(staleInput.source.state, 'STALE');
assert.equal(staleInput.applicability.state, 'STALE_WITH_RETAINED_CALCULATION');
assert.equal(staleInput.calculation.state, 'STALE');
assert.equal(staleInput.overall, EMP1_READINESS_OVERALL.SOURCE_STALE);

const staleAuthority = projectEmp1Readiness(fixture({
  cState: 'STALE_AUTHORITY',
  cResultAvailable: false,
  cRetainedResultAvailable: true,
  cBlockers: ['EMP1_WORKBENCH_ROUTE_AUTHORITY_CHANGED'],
}));
assert.equal(staleAuthority.source.state, 'CURRENT');
assert.equal(staleAuthority.method.state, 'AUTHORIZED_BOUNDED_ROUTE');
assert.equal(staleAuthority.applicability.state, 'STALE_WITH_RETAINED_CALCULATION');
assert.equal(staleAuthority.calculation.state, 'STALE');
assert.equal(staleAuthority.overall, EMP1_READINESS_OVERALL.CALCULATION_STALE);

const existingRelease = projectEmp1Readiness(fixture({ releaseQualified: true }));
assert.equal(existingRelease.release.state, 'QUALIFIED_BY_EXISTING_RELEASE_BOUNDARY');
assert.equal(existingRelease.release.authorityEstablishedByProjection, false);
assert.equal(existingRelease.review.state, 'NOT_REVIEWED');
assert.equal(existingRelease.overall, EMP1_READINESS_OVERALL.READY_FOR_ENGINEERING_REVIEW);

const unsupported = projectEmp1Readiness(fixture({
  cState: 'UNEXPECTED_C_STATE',
  cResultAvailable: false,
  cRetainedResultAvailable: false,
}));
assert.equal(unsupported.method.state, 'BLOCKED');
assert.equal(unsupported.overall, EMP1_READINESS_OVERALL.METHOD_BLOCKED);
assert.ok(unsupported.blockers.includes('EMP1_READINESS_C_STATE_UNSUPPORTED:UNEXPECTED_C_STATE'));

assert.throws(
  () => projectEmp1Readiness({ schema: 'wrong', steps: [] }),
  (error) => error?.code === 'EMP1_READINESS_PRODUCT_PROJECTION_INVALID',
);

console.log('PASS emp1 readiness projection');

function fixture({
  aDocumentLoaded = true,
  aResultAvailable = true,
  bDocumentLoaded = true,
  bResultAvailable = true,
  bState = 'CALCULATED',
  cState = 'CALCULATED_CURRENT',
  cResultAvailable = true,
  cRetainedResultAvailable = true,
  cBlockers = [],
  custodyRefreshBlockerCode = null,
  releaseQualified = false,
} = {}) {
  return {
    schema: 'emp1-product-projection/v1',
    product: { productId: 'EMP.1' },
    steps: [
      {
        shortId: 'A', stepId: 'EMP.1.A', state: aResultAvailable ? 'CALCULATED' : 'SOURCE_LOADED',
        documentLoaded: aDocumentLoaded, resultAvailable: aResultAvailable, blockers: [],
      },
      {
        shortId: 'B', stepId: 'EMP.1.B', state: bState,
        documentLoaded: bDocumentLoaded, resultAvailable: bResultAvailable, blockers: [],
      },
      {
        shortId: 'C', stepId: 'EMP.1.C', state: cState,
        documentLoaded: false, resultAvailable: cResultAvailable,
        retainedResultAvailable: cRetainedResultAvailable,
        runAuthorized: cState !== 'ROUTE_SUSPENDED' && cState !== 'SOURCE_INCOMPLETE',
        blockers: cBlockers,
      },
    ],
    custody: {
      bSourceEvidenceState: bState === 'STALE_A_EVIDENCE' ? 'STALE_REFRESH_AVAILABLE' : 'CURRENT',
      refreshBlockerCode: custodyRefreshBlockerCode,
    },
    qualificationBoundary: {
      emp1CProductionAuthority: cState === 'ROUTE_SUSPENDED' ? 'NOT_AUTHORIZED' : 'BOUNDED_ROUTE_ONLY',
      passIsCodeCompliance: false,
      releaseQualified,
    },
  };
}
