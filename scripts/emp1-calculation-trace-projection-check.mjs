import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EMP1_CALCULATION_TRACE_SCHEMA,
  EMP1_TRACE_CONSISTENCY,
  projectEmp1CalculationTrace,
} from '../src/core/emp1/index.js';

const current = projectEmp1CalculationTrace(fixture());
assert.equal(current.schema, EMP1_CALCULATION_TRACE_SCHEMA);
assert.equal(current.productId, 'EMP.1');
assert.equal(current.decision, 'PASS');
assert.equal(current.ancestry.state, EMP1_TRACE_CONSISTENCY.CONSISTENT);
assert.deepEqual(
  current.ancestry.relations.map((row) => [row.id, row.state]),
  [
    ['SOURCE', 'MATCH'],
    ['EMP.1.A', 'MATCH'],
    ['EMP.1.B', 'MATCH'],
    ['EMP.1.C', 'MATCH'],
  ],
);
assert.equal(current.layers.loadTransfer.resultHash, 'A-HASH');
assert.equal(current.layers.sectionScreening.resultHash, 'B-HASH');
assert.equal(current.layers.localCorrelation.resultHash, 'C-HASH');
assert.equal(current.layers.localCorrelation.evidenceKind, 'NUMERICAL_CALCULATION');
assert.equal(current.assessment.parents.sourceHash, 'SOURCE-HASH');
assert.equal(current.assessment.passIsCodeCompliance, false);
assert.equal(current.assessment.releaseQualified, false);
assert.equal(current.execution.currentness.executionState, 'CURRENT');
assert.equal(current.execution.currentness.cReportable, true);
assert.equal(current.execution.currentness.currentCResultAvailable, true);
assert.equal(current.authority.executionRouteAuthorityHash, 'AUTH-HASH');
assert.equal(current.authority.currentRouteAuthorityHash, 'AUTH-HASH');
assert.equal(current.authority.executionAuthorityCurrent, true);
assert.equal(current.authority.currentCResultReportable, true);
assert.equal(current.authority.globalEmp1CRouteAuthority, false);
assert.equal(current.authority.codeComplianceProduced, false);
assert.equal(current.authority.releaseQualified, false);
assert.equal(current.authorityBoundary.projectionOnly, true);
assert.equal(current.authorityBoundary.comparesRetainedIdentifiersOnly, true);
assert.equal(current.authorityBoundary.computesSemanticHashes, false);
assert.equal(current.authorityBoundary.executesEmp1, false);
assert.equal(current.authorityBoundary.executesSolvers, false);
assert.equal(current.authorityBoundary.evaluatesApplicability, false);
assert.equal(current.authorityBoundary.evaluatesWrcNumerics, false);
assert.equal(current.authorityBoundary.createsEngineeringAuthority, false);
assert.equal(current.authorityBoundary.createsCodeCompliance, false);
assert.equal(current.authorityBoundary.createsReleaseAuthority, false);
assert.equal(Object.isFrozen(current), true);
assert.equal(Object.isFrozen(current.ancestry.relations), true);
assert.equal(Object.isFrozen(current.layers.localCorrelation), true);

const prepared = projectEmp1CalculationTrace(fixture({
  result: runResult({
    localCorrelation: {
      schema: 'emp1-workbench-suspended-local-correlation/v2',
      state: 'BLOCKED',
      decision: null,
      reasons: ['ROUTE_SUSPENDED'],
      resultHash: 'C-BLOCKED-HASH',
    },
    cParent: 'C-BLOCKED-HASH',
    decision: 'ESCALATE',
  }),
  authority: {
    boundedLocalRoutePrepared: true,
    boundedLocalRouteExecuted: false,
    routeAuthorityHash: 'AUTH-HASH',
    globalEmp1CRouteAuthority: false,
    codeComplianceProduced: false,
    releaseQualified: false,
  },
  currentness: {
    state: 'CURRENT', reasons: [], inputCurrent: true,
    cAuthorityCurrent: true, cReportable: false,
  },
  cState: {
    state: 'ROUTE_SUSPENDED', blockerCodes: ['ROUTE_SUSPENDED'],
    retainedResultAvailable: false, currentResultAvailable: false,
    currentAuthorityHash: 'AUTH-HASH',
  },
}));
assert.equal(prepared.layers.localCorrelation.evidenceKind, 'PREPARED_BLOCKED_EVIDENCE');
assert.equal(prepared.layers.localCorrelation.state, 'BLOCKED');
assert.equal(prepared.ancestry.state, EMP1_TRACE_CONSISTENCY.CONSISTENT);
assert.equal(prepared.authority.boundedLocalRouteExecuted, false);
assert.equal(prepared.authority.currentCResultReportable, false);

const noLocal = projectEmp1CalculationTrace(fixture({
  result: runResult({ localCorrelation: null, cParent: null, decision: 'PASS' }),
  authority: {
    boundedLocalRoutePrepared: false,
    boundedLocalRouteExecuted: false,
    globalEmp1CRouteAuthority: false,
    codeComplianceProduced: false,
    releaseQualified: false,
  },
}));
assert.equal(noLocal.layers.localCorrelation.evidenceKind, 'NONE');
assert.equal(noLocal.layers.localCorrelation.resultHash, null);
assert.equal(noLocal.ancestry.relations[3].state, 'NOT_RETAINED');
assert.equal(noLocal.ancestry.state, EMP1_TRACE_CONSISTENCY.CONSISTENT);

const mismatch = projectEmp1CalculationTrace(fixture({
  result: runResult({ bParent: 'DIFFERENT-B-HASH' }),
}));
assert.equal(mismatch.ancestry.state, EMP1_TRACE_CONSISTENCY.MISMATCH);
assert.equal(
  mismatch.ancestry.relations.find((row) => row.id === 'EMP.1.B').state,
  'MISMATCH',
);

const incomplete = projectEmp1CalculationTrace(fixture({
  result: runResult({ sourceParent: null }),
}));
assert.equal(incomplete.ancestry.state, EMP1_TRACE_CONSISTENCY.INCOMPLETE);
assert.equal(incomplete.ancestry.relations[0].state, 'INCOMPLETE');

const stale = projectEmp1CalculationTrace(fixture({
  currentness: {
    state: 'STALE',
    reasons: ['EMP1_WORKBENCH_LOCALROUTE_CHANGED'],
    inputCurrent: false,
    cAuthorityCurrent: true,
    cReportable: false,
  },
  cState: {
    state: 'STALE_INPUT',
    blockerCodes: ['EMP1_WORKBENCH_LOCALROUTE_CHANGED'],
    retainedResultAvailable: true,
    currentResultAvailable: false,
    currentAuthorityHash: 'AUTH-HASH',
  },
}));
assert.equal(stale.execution.currentness.executionState, 'STALE');
assert.equal(stale.execution.currentness.currentCResultAvailable, false);
assert.equal(stale.execution.currentness.retainedCResultAvailable, true);
assert.equal(stale.ancestry.state, EMP1_TRACE_CONSISTENCY.CONSISTENT);

assert.throws(
  () => projectEmp1CalculationTrace({ result: null }),
  /EMP1_CALCULATION_TRACE_RESULT_REQUIRED/u,
);
assert.throws(
  () => projectEmp1CalculationTrace(fixture({
    result: { ...runResult(), productId: 'OTHER' },
  })),
  /EMP1_CALCULATION_TRACE_PRODUCT_INVALID/u,
);
assert.throws(
  () => projectEmp1CalculationTrace(fixture({
    result: {
      ...runResult(),
      assessment: { ...runResult().assessment, schema: 'wrong/v1' },
    },
  })),
  /EMP1_CALCULATION_TRACE_ASSESSMENT_SCHEMA_INVALID/u,
);

const source = readFileSync(
  new URL('../src/core/emp1/emp1-calculation-trace-projection.js', import.meta.url),
  'utf8',
);
const indexSource = readFileSync(new URL('../src/core/emp1/index.js', import.meta.url), 'utf8');
for (const forbidden of [
  'runEmp1(',
  'semanticHash(',
  'reconstructResultHashes',
  'evaluateEmp1Wrc537CylindricalApplicability',
  'requireEmp1Wrc537QualifiedCylindricalApplicability',
  'runEmp1Wrc537Gamma5ZeroDpRoute',
]) {
  assert.equal(source.includes(forbidden), false, `forbidden trace dependency: ${forbidden}`);
}
assert.equal(source.includes('Math.abs('), false);
assert.equal(source.includes('0.5'), false);
assert.equal(source.includes('0.875'), false);
assert.equal(indexSource.includes("export * from './emp1-calculation-trace-projection.js';"), true);

console.log(JSON.stringify({
  schema: 'emp1-calculation-trace-projection-check/v1',
  status: 'PASS_RETAINED_ANCESTRY_PROJECTION',
  currentConsistency: current.ancestry.state,
  preparedEvidenceKind: prepared.layers.localCorrelation.evidenceKind,
  noLocalRelation: noLocal.ancestry.relations[3].state,
  mismatchDetected: mismatch.ancestry.state,
  incompleteDetected: incomplete.ancestry.state,
  staleCurrentnessPreserved: stale.execution.currentness.executionState,
  semanticHashesComputed: false,
  emp1ExecutedByProjection: false,
  solversExecutedByProjection: false,
  applicabilityEvaluatedByProjection: false,
  wrcNumericsEvaluatedByProjection: false,
  engineeringAuthorityCreatedByProjection: false,
  codeComplianceCreatedByProjection: false,
  releaseAuthorityCreatedByProjection: false,
}, null, 2));

function fixture(overrides = {}) {
  return {
    sourceHash: 'SOURCE-HASH',
    result: runResult(),
    authority: {
      boundedLocalRoutePrepared: true,
      boundedLocalRouteExecuted: true,
      routeAuthorityHash: 'AUTH-HASH',
      globalEmp1CRouteAuthority: false,
      codeComplianceProduced: false,
      releaseQualified: false,
    },
    invocations: {
      loadTransfer: 1,
      sectionScreening: 1,
      localPreparation: 1,
      localCorrelation: 1,
    },
    currentness: {
      state: 'CURRENT', reasons: [], inputCurrent: true,
      cAuthorityCurrent: true, cReportable: true,
    },
    cState: {
      state: 'CALCULATED_CURRENT', blockerCodes: [],
      retainedResultAvailable: true, currentResultAvailable: true,
      currentAuthorityHash: 'AUTH-HASH',
    },
    ...overrides,
  };
}

function runResult({
  localCorrelation = {
    schema: 'emp1-local-correlation-result/v1',
    qualification: 'PASS',
    decision: 'PASS',
    state: 'CALCULATED',
    reasons: [],
    resultHash: 'C-HASH',
  },
  sourceParent = 'SOURCE-HASH',
  aParent = 'A-HASH',
  bParent = 'B-HASH',
  cParent = localCorrelation?.resultHash ?? null,
  decision = 'PASS',
} = {}) {
  return {
    productId: 'EMP.1',
    invalidated: ['EMP.1.A', 'EMP.1.B', 'EMP.1.C'],
    loadTransfer: {
      schema: 'emp1-a-retained-foundation-layer/v1',
      qualification: 'PASS', reasons: [], resultHash: 'A-HASH',
    },
    sectionScreening: {
      schema: 'emp1-b-retained-screening-layer/v1',
      qualification: 'PASS', decision: 'ESCALATE', reasons: [], resultHash: 'B-HASH',
    },
    localCorrelation,
    assessment: {
      schema: 'emp1-assessment/v1',
      productId: 'EMP.1',
      decision,
      reasons: [],
      parents: {
        sourceHash: sourceParent,
        loadTransferResultHash: aParent,
        sectionScreeningResultHash: bParent,
        localCorrelationResultHash: cParent,
      },
      interpretation: {
        passIsCodeCompliance: false,
        releaseQualified: false,
        localCorrelationRequiredWhenScreeningEscalates: true,
      },
    },
  };
}
