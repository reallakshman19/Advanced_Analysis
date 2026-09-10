export const EMP1_PROFESSIONAL_WORKFLOW_SCHEMA = 'emp1-professional-workflow/v1';

export const EMP1_PROFESSIONAL_WORKFLOW_STEPS = Object.freeze([
  Object.freeze({ stepId: 'BASIS_SOURCE', ordinal: 1, label: 'Basis & Source', backingStepIds: Object.freeze(['A', 'B', 'C']), preferredBackingStageId: 'LAFEA.1', targetRole: 'source' }),
  Object.freeze({ stepId: 'GEOMETRY', ordinal: 2, label: 'Geometry', backingStepIds: Object.freeze(['A', 'C']), preferredBackingStageId: 'LAFEA.1', targetRole: 'emp1-c-run-configuration' }),
  Object.freeze({ stepId: 'LOADS', ordinal: 3, label: 'Loads', backingStepIds: Object.freeze(['A']), preferredBackingStageId: 'LAFEA.1', targetRole: 'source' }),
  Object.freeze({ stepId: 'LOAD_TRANSFER', ordinal: 4, label: 'Load Transfer', backingStepIds: Object.freeze(['A']), preferredBackingStageId: 'LAFEA.1', targetRole: 'results' }),
  Object.freeze({ stepId: 'SECTION_SCREENING', ordinal: 5, label: 'Section Screening', backingStepIds: Object.freeze(['B']), preferredBackingStageId: 'LAFEA.2', targetRole: 'results' }),
  Object.freeze({ stepId: 'LOCAL_CORRELATION', ordinal: 6, label: 'Local Correlation', backingStepIds: Object.freeze(['C']), preferredBackingStageId: null, targetRole: 'emp1-c-run-configuration' }),
  Object.freeze({ stepId: 'REVIEW_EVIDENCE', ordinal: 7, label: 'Review & Evidence', backingStepIds: Object.freeze(['A', 'B', 'C']), preferredBackingStageId: null, targetRole: 'emp1-product-execution-summary' }),
]);

const B_SOURCE_STALE_STATES = new Set([
  'AWAITING_CURRENT_A',
  'A_EVIDENCE_REQUIRED',
  'STALE_A_EVIDENCE',
]);

const AUTHORITY_REASON_CODES = new Set([
  'EMP1_WORKBENCH_C_ROUTE_AUTHORITY_SNAPSHOT_REQUIRED',
  'EMP1_WORKBENCH_C_CURRENT_ROUTE_AUTHORITY_REQUIRED',
  'EMP1_WORKBENCH_ROUTE_AUTHORITY_CHANGED',
  'EMP1_WORKBENCH_C_CURRENT_ROUTE_NOT_AUTHORIZED',
  'EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_SUSPENDED',
  'EMP1_C_BOUNDED_ROUTE_REGISTRY_ENTRY_REQUIRED',
  'EMP1_C_BOUNDED_ROUTE_NOT_REGISTERED',
  'EMP1_C_BOUNDED_ROUTE_ENGINEERING_USE_NOT_AUTHORIZED',
  'EMP1_C_BOUNDED_ROUTE_EXECUTOR_NOT_AUTHORIZED',
]);

const REASON_COPY = Object.freeze({
  EMP1_WORKBENCH_LOADTRANSFERDOCUMENT_CHANGED:
    'Load/reference source changed after the retained EMP.1 transaction.',
  EMP1_WORKBENCH_SECTIONSCREENINGDOCUMENT_CHANGED:
    'Section-screening source changed after the retained EMP.1 transaction.',
  EMP1_WORKBENCH_ATTACHMENTGEOMETRY_CHANGED:
    'Attachment geometry or its engineering source binding changed after the retained transaction.',
  EMP1_WORKBENCH_APPLICABILITYGEOMETRY_CHANGED:
    'WRC applicability geometry changed after the retained transaction.',
  EMP1_WORKBENCH_LOCALROUTE_CHANGED:
    'Local-correlation route, load-case or pressure-result selection changed after the retained transaction.',
  EMP1_WORKBENCH_C_ROUTE_AUTHORITY_SNAPSHOT_REQUIRED:
    'The retained transaction does not carry the route-authority snapshot required for current use.',
  EMP1_WORKBENCH_C_CURRENT_ROUTE_AUTHORITY_REQUIRED:
    'Current bounded WRC route authority is unavailable.',
  EMP1_WORKBENCH_ROUTE_AUTHORITY_CHANGED:
    'Bounded WRC route authority changed after the retained transaction.',
  EMP1_WORKBENCH_C_CURRENT_ROUTE_NOT_AUTHORIZED:
    'The current bounded WRC route is not production-authorized.',
  EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_SUSPENDED:
    'The bounded WRC 537 gamma=5 zero-differential-pressure route is suspended.',
  EMP1_C_BOUNDED_ROUTE_REGISTRY_ENTRY_REQUIRED:
    'The bounded WRC route registry entry is unavailable.',
  EMP1_C_BOUNDED_ROUTE_NOT_REGISTERED:
    'The bounded WRC route is not registered for production use.',
  EMP1_C_BOUNDED_ROUTE_ENGINEERING_USE_NOT_AUTHORIZED:
    'Engineering use is not authorized for the bounded WRC route.',
  EMP1_C_BOUNDED_ROUTE_EXECUTOR_NOT_AUTHORIZED:
    'The bounded WRC route executor is not authorized.',
  EMP1_WORKBENCH_A_DOCUMENT_REQUIRED:
    'EMP.1.A load/reference source is required before the local-correlation transaction can run.',
  EMP1_WORKBENCH_B_DOCUMENT_REQUIRED:
    'EMP.1.B section-screening source is required before the local-correlation transaction can run.',
  EMP1_WORKBENCH_APPLICABILITY_GEOMETRY_REQUIRED:
    'WRC applicability geometry must be source-bound before Local Correlation can run.',
});

export function buildEmp1ProfessionalWorkflowPresentation(projection) {
  if (projection?.schema !== 'emp1-product-projection/v1') {
    throw new TypeError('EMP1_PROFESSIONAL_WORKFLOW_PROJECTION_INVALID');
  }
  const byShortId = Object.fromEntries((projection.steps ?? []).map((step) => [step.shortId, step]));
  const a = requireBacking(byShortId.A, 'A');
  const b = requireBacking(byShortId.B, 'B');
  const c = requireBacking(byShortId.C, 'C');
  const authoritySummary = buildAuthoritySummary(projection, a, b, c);
  const currentnessNotice = buildCurrentnessNotice(c);

  const statusByStep = Object.freeze({
    BASIS_SOURCE: authoritySummary.sourceCurrentness,
    GEOMETRY: geometryStatus(c, authoritySummary.sourceCurrentness),
    LOADS: authoritySummary.sourceCurrentness,
    LOAD_TRANSFER: authoritySummary.transferCurrentness,
    SECTION_SCREENING: authoritySummary.screeningCurrentness,
    LOCAL_CORRELATION: `${authoritySummary.localMethod} · ${authoritySummary.localResult}`,
    REVIEW_EVIDENCE: `${authoritySummary.localResult} · ${authoritySummary.releaseProfile}`,
  });

  return Object.freeze({
    schema: EMP1_PROFESSIONAL_WORKFLOW_SCHEMA,
    productId: projection.product?.productId ?? 'EMP.1',
    authoritySummary,
    currentnessNotice,
    steps: Object.freeze(EMP1_PROFESSIONAL_WORKFLOW_STEPS.map((definition) => Object.freeze({
      ...definition,
      statusLabel: statusByStep[definition.stepId],
      canOpen: true,
      createsEngineeringAuthority: false,
      exposesNumericalResult: false,
    }))),
    backingCalculators: Object.freeze([
      backingDisclosure(a),
      backingDisclosure(b),
      backingDisclosure(c),
    ]),
    authorityBoundary: Object.freeze({
      presentationOnly: true,
      createsEngineeringAuthority: false,
      createsRouteAuthority: false,
      createsCodeCompliance: false,
      createsReleaseAuthority: false,
      staleNumericalResultMayBecomeCurrent: false,
    }),
  });
}

function buildAuthoritySummary(projection, a, b, c) {
  return Object.freeze({
    sourceCurrentness: sourceCurrentness(a, b, c),
    transferCurrentness: transferCurrentness(a),
    screeningCurrentness: screeningCurrentness(b),
    localMethod: c.runAuthorized === true ? 'LOCAL METHOD QUALIFIED' : 'LOCAL METHOD BLOCKED',
    localResult: localResultCurrentness(c),
    releaseProfile: projection.qualificationBoundary?.releaseQualified === true
      ? 'RELEASE PROFILE QUALIFIED'
      : 'RELEASE PROFILE NOT QUALIFIED',
    codeCompliance: 'CODE COMPLIANCE NOT ASSESSED',
  });
}

function buildCurrentnessNotice(c) {
  const reasonCodes = Object.freeze(uniqueReasonCodes(c.blockers));
  const stale = c.retainedResultAvailable === true && c.resultAvailable !== true;
  if (!stale && c.runAuthorized === true) return null;

  const authorityReason = reasonCodes.some(isAuthorityReason);
  const reasons = Object.freeze(reasonCodes.length
    ? reasonCodes.map(reasonCopy)
    : [stale
      ? 'The retained local result is stale, but this projection does not carry a specific currentness reason.'
      : 'Local Correlation is blocked, but this projection does not carry a specific blocker reason.']);

  if (stale) {
    return Object.freeze({
      state: 'STALE',
      title: 'Retained Local Correlation result requires rerun',
      reasonCodes,
      reasons,
      action: staleAction({ authorityReason, runAuthorized: c.runAuthorized === true }),
    });
  }

  return Object.freeze({
    state: 'BLOCKED',
    title: 'Local Correlation cannot run under the current source/authority state',
    reasonCodes,
    reasons,
    action: authorityReason
      ? 'Resolve the listed bounded WRC route-authority blocker before running Local Correlation.'
      : 'Complete the listed source or geometry binding before running Local Correlation.',
  });
}

function isAuthorityReason(code) {
  return AUTHORITY_REASON_CODES.has(code)
    || /^WRC_GAMMA5_ROUTE_/u.test(code)
    || /^EMP1_C_BOUNDED_ROUTE_/u.test(code);
}

function staleAction({ authorityReason, runAuthorized }) {
  if (!runAuthorized && authorityReason) {
    return 'Restore or qualify the current bounded WRC route authority, then rerun Local Correlation before using the retained result.';
  }
  if (!runAuthorized) {
    return 'Complete the current source or geometry binding, then rerun the governed EMP.1 transaction before using the retained Local Correlation result.';
  }
  if (authorityReason) {
    return 'Re-run Local Correlation under the current qualified route authority before using the retained result.';
  }
  return 'Re-run the governed EMP.1 transaction from the affected upstream step before using the retained Local Correlation result.';
}

function sourceCurrentness(a, b, c) {
  if (a.documentLoaded === false && b.documentLoaded === false) return 'SOURCE INPUT REQUIRED';
  if (a.documentLoaded === false || b.documentLoaded === false) return 'SOURCE INCOMPLETE';
  if (B_SOURCE_STALE_STATES.has(b.state)) return 'SOURCE STALE';
  if (c.state === 'SOURCE_INCOMPLETE') return 'SOURCE INCOMPLETE';
  return 'SOURCE CURRENT';
}

function transferCurrentness(a) {
  if (a.resultAvailable === true) return 'TRANSFER CURRENT';
  if (a.documentLoaded === false) return 'TRANSFER INPUT REQUIRED';
  return 'TRANSFER NOT CALCULATED';
}

function screeningCurrentness(b) {
  if (b.resultAvailable === true) return 'SCREENING CURRENT';
  if (b.retainedResultAvailable === true || B_SOURCE_STALE_STATES.has(b.state)) return 'SCREENING STALE';
  if (b.documentLoaded === false) return 'SCREENING INPUT REQUIRED';
  return 'SCREENING NOT CALCULATED';
}

function localResultCurrentness(c) {
  if (c.resultAvailable === true) return 'LOCAL RESULT CURRENT';
  if (c.retainedResultAvailable === true) return 'LOCAL RESULT STALE';
  return 'LOCAL RESULT NOT CALCULATED';
}

function geometryStatus(c, sourceStatus) {
  if (c.state === 'SOURCE_INCOMPLETE') return 'SOURCE INCOMPLETE';
  return sourceStatus;
}

function reasonCopy(code) {
  return REASON_COPY[code] ?? String(code).replaceAll('_', ' ');
}

function uniqueReasonCodes(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((code) => typeof code === 'string' && code.trim()).map((code) => code.trim()))];
}

function backingDisclosure(step) {
  return Object.freeze({
    shortId: step.shortId,
    stepId: step.stepId,
    label: step.label,
    state: step.currentnessBadge ?? step.state,
    backingStageId: step.backingStageId ?? null,
    runAuthorized: step.runAuthorized === true,
  });
}

function requireBacking(step, shortId) {
  if (!step || step.shortId !== shortId) {
    throw new TypeError(`EMP1_PROFESSIONAL_WORKFLOW_BACKING_STEP_REQUIRED:${shortId}`);
  }
  return step;
}
