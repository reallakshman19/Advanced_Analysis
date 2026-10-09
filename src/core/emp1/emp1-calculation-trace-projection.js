export const EMP1_CALCULATION_TRACE_SCHEMA = 'emp1-calculation-trace/v1';

export const EMP1_TRACE_CONSISTENCY = Object.freeze({
  CONSISTENT: 'CONSISTENT_WITH_RETAINED_PARENTS',
  INCOMPLETE: 'INCOMPLETE_RETAINED_ANCESTRY',
  MISMATCH: 'RETAINED_ANCESTRY_MISMATCH',
});

const ASSESSMENT_SCHEMA = 'emp1-assessment/v1';

/**
 * Project retained EMP.1 ancestry/currentness into a compact trace.
 * No solver, hash producer, applicability gate or WRC numerical owner is called.
 */
export function projectEmp1CalculationTrace({
  sourceHash,
  result,
  authority,
  invocations,
  currentness,
  cState,
} = {}) {
  const run = record(result, 'EMP1_CALCULATION_TRACE_RESULT_REQUIRED');
  if (run.productId !== 'EMP.1') throw traceError('EMP1_CALCULATION_TRACE_PRODUCT_INVALID');
  const assessment = record(run.assessment, 'EMP1_CALCULATION_TRACE_ASSESSMENT_REQUIRED');
  if (assessment.schema !== ASSESSMENT_SCHEMA) {
    throw traceError('EMP1_CALCULATION_TRACE_ASSESSMENT_SCHEMA_INVALID');
  }
  const parents = record(assessment.parents, 'EMP1_CALCULATION_TRACE_PARENTS_REQUIRED');
  const layers = {
    loadTransfer: projectLayer('EMP.1.A', run.loadTransfer),
    sectionScreening: projectLayer('EMP.1.B', run.sectionScreening),
    localCorrelation: projectLocalLayer(run.localCorrelation, authority),
  };
  const ancestry = Object.freeze([
    relation('SOURCE', nullableHash(sourceHash), nullableHash(parents.sourceHash)),
    relation('EMP.1.A', layers.loadTransfer.resultHash,
      nullableHash(parents.loadTransferResultHash)),
    relation('EMP.1.B', layers.sectionScreening.resultHash,
      nullableHash(parents.sectionScreeningResultHash)),
    relation('EMP.1.C', layers.localCorrelation.resultHash,
      nullableHash(parents.localCorrelationResultHash)),
  ]);

  return deepFreeze({
    schema: EMP1_CALCULATION_TRACE_SCHEMA,
    productId: 'EMP.1',
    decision: nullableText(assessment.decision),
    invalidated: stringArray(run.invalidated),
    ancestry: {
      state: consistencyState(ancestry),
      relations: ancestry,
    },
    layers,
    assessment: {
      schema: assessment.schema,
      decision: nullableText(assessment.decision),
      reasons: stringArray(assessment.reasons),
      parents: {
        sourceHash: nullableHash(parents.sourceHash),
        loadTransferResultHash: nullableHash(parents.loadTransferResultHash),
        sectionScreeningResultHash: nullableHash(parents.sectionScreeningResultHash),
        localCorrelationResultHash: nullableHash(parents.localCorrelationResultHash),
      },
      passIsCodeCompliance: assessment.interpretation?.passIsCodeCompliance === true,
      releaseQualified: assessment.interpretation?.releaseQualified === true,
    },
    execution: {
      sourceHash: nullableHash(sourceHash),
      invocations: projectInvocations(invocations),
      currentness: projectCurrentness(currentness, cState),
    },
    authority: {
      boundedLocalRoutePrepared: authority?.boundedLocalRoutePrepared === true,
      boundedLocalRouteExecuted: authority?.boundedLocalRouteExecuted === true,
      executionRouteAuthorityHash: nullableHash(
        cState?.executionAuthorityHash
          ?? authority?.routeAuthorityHash
          ?? authority?.routeAuthoritySnapshot?.semanticHash,
      ),
      currentRouteAuthorityHash: nullableHash(
        cState?.currentAuthorityHash ?? cState?.currentAuthoritySnapshot?.semanticHash,
      ),
      executionAuthorityCurrent: booleanOrNull(currentness?.cAuthorityCurrent),
      currentCResultReportable: cState?.currentResultAvailable === true,
      globalEmp1CRouteAuthority: authority?.globalEmp1CRouteAuthority === true,
      codeComplianceProduced: authority?.codeComplianceProduced === true,
      releaseQualified: authority?.releaseQualified === true,
    },
    authorityBoundary: {
      projectionOnly: true,
      comparesRetainedIdentifiersOnly: true,
      computesSemanticHashes: false,
      executesEmp1: false,
      executesSolvers: false,
      evaluatesApplicability: false,
      evaluatesWrcNumerics: false,
      createsSourceAuthority: false,
      createsEngineeringAuthority: false,
      createsMethodAuthority: false,
      createsApplicabilityAuthority: false,
      createsNumericalAuthority: false,
      createsCodeCompliance: false,
      createsReleaseAuthority: false,
    },
  });
}

function projectLayer(stepId, value) {
  const layer = record(value, `EMP1_CALCULATION_TRACE_${stepId}_RESULT_REQUIRED`);
  return Object.freeze({
    stepId,
    schema: nullableText(layer.schema),
    qualification: nullableText(layer.qualification?.state ?? layer.qualification),
    decision: nullableText(layer.decision),
    state: nullableText(layer.state),
    resultHash: nullableHash(layer.resultHash),
    reasons: stringArray(layer.reasons),
  });
}

function projectLocalLayer(value, authority) {
  if (value == null) {
    return Object.freeze({
      stepId: 'EMP.1.C', schema: null, qualification: null, decision: null,
      state: 'NOT_RETAINED', resultHash: null, reasons: [], evidenceKind: 'NONE',
    });
  }
  const layer = projectLayer('EMP.1.C', value);
  const evidenceKind = authority?.boundedLocalRouteExecuted === true
    ? 'NUMERICAL_CALCULATION'
    : authority?.boundedLocalRoutePrepared === true
      ? 'PREPARED_BLOCKED_EVIDENCE'
      : 'GATE_OR_BLOCKED_EVIDENCE';
  return Object.freeze({ ...layer, evidenceKind });
}

function relation(id, retainedHash, parentHash) {
  let state = 'NOT_RETAINED';
  if (retainedHash != null || parentHash != null) {
    if (retainedHash == null || parentHash == null) state = 'INCOMPLETE';
    else state = retainedHash === parentHash ? 'MATCH' : 'MISMATCH';
  }
  return Object.freeze({ id, retainedHash, assessmentParentHash: parentHash, state });
}

function consistencyState(relations) {
  if (relations.some((item) => item.state === 'MISMATCH')) {
    return EMP1_TRACE_CONSISTENCY.MISMATCH;
  }
  if (relations.some((item) => item.state === 'INCOMPLETE')) {
    return EMP1_TRACE_CONSISTENCY.INCOMPLETE;
  }
  return EMP1_TRACE_CONSISTENCY.CONSISTENT;
}

function projectInvocations(value) {
  const row = value && typeof value === 'object' ? value : {};
  return Object.freeze({
    loadTransfer: nonNegativeIntegerOrNull(row.loadTransfer),
    sectionScreening: nonNegativeIntegerOrNull(row.sectionScreening),
    localPreparation: nonNegativeIntegerOrNull(row.localPreparation),
    localCorrelation: nonNegativeIntegerOrNull(row.localCorrelation),
  });
}

function projectCurrentness(currentness, cState) {
  return Object.freeze({
    executionState: nullableText(currentness?.state),
    reasons: stringArray(currentness?.reasons),
    inputCurrent: booleanOrNull(currentness?.inputCurrent),
    cAuthorityCurrent: booleanOrNull(currentness?.cAuthorityCurrent),
    cReportable: booleanOrNull(currentness?.cReportable),
    cState: nullableText(cState?.state),
    cBlockers: stringArray(cState?.blockerCodes),
    retainedCResultAvailable: cState?.retainedResultAvailable === true,
    currentCResultAvailable: cState?.currentResultAvailable === true,
  });
}

function record(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw traceError(code);
  return value;
}
function nullableText(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}
function nullableHash(value) { return nullableText(value); }
function booleanOrNull(value) { return typeof value === 'boolean' ? value : null; }
function nonNegativeIntegerOrNull(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}
function stringArray(value) {
  return Object.freeze(Array.isArray(value) ? [...new Set(value.map(String))] : []);
}
function traceError(code) { const error = new TypeError(code); error.code = code; return error; }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
