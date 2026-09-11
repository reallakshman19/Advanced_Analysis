export const EMP1_READINESS_SCHEMA = 'emp1-readiness/v1';

export const EMP1_READINESS_OVERALL = Object.freeze({
  INPUT_REQUIRED: 'INPUT_REQUIRED',
  SOURCE_STALE: 'SOURCE_STALE',
  METHOD_BLOCKED: 'METHOD_BLOCKED',
  READY_TO_CALCULATE: 'READY_TO_CALCULATE',
  CALCULATION_REQUIRED: 'CALCULATION_REQUIRED',
  CALCULATION_STALE: 'CALCULATION_STALE',
  READY_FOR_ENGINEERING_REVIEW: 'READY_FOR_ENGINEERING_REVIEW',
  REVIEW_ACCEPTED: 'REVIEW_ACCEPTED',
  REVIEW_REJECTED: 'REVIEW_REJECTED',
  REVIEW_STALE: 'REVIEW_STALE',
});

const B_SOURCE_STALE_STATES = new Set([
  'AWAITING_CURRENT_A',
  'A_EVIDENCE_REQUIRED',
  'STALE_A_EVIDENCE',
]);

const C_SOURCE_INCOMPLETE = 'SOURCE_INCOMPLETE';
const C_ROUTE_SUSPENDED = 'ROUTE_SUSPENDED';
const C_BOUNDED_ROUTE_AVAILABLE = 'BOUNDED_ROUTE_AVAILABLE';
const C_READY_TO_RUN = 'READY_TO_RUN';
const C_CALCULATED_CURRENT = 'CALCULATED_CURRENT';
const C_STALE_AUTHORITY = 'STALE_AUTHORITY';
const C_STALE_INPUT = 'STALE_INPUT';
const SUPPORTED_C_STATES = new Set([
  C_SOURCE_INCOMPLETE,
  C_ROUTE_SUSPENDED,
  C_BOUNDED_ROUTE_AVAILABLE,
  C_READY_TO_RUN,
  C_CALCULATED_CURRENT,
  C_STALE_AUTHORITY,
  C_STALE_INPUT,
]);
const REVIEW_STATE_SCHEMA = 'emp1-engineering-review-state/v1';
const REVIEW_STATES = new Set(['NOT_REVIEWED', 'REVIEW_ACCEPTED', 'REVIEW_REJECTED', 'REVIEW_STALE']);

/**
 * Compose existing EMP.1 product/currentness evidence into one governance view.
 * An optional existing review-state projection may be included; this module does
 * not create/re-evaluate the review record, WRC applicability, method authority,
 * code compliance, or release authority.
 */
export function projectEmp1Readiness(productProjection, options = {}) {
  const projection = requireProjection(productProjection);
  const steps = stepsByShortId(projection.steps);
  const a = requireStep(steps.A, 'A');
  const b = requireStep(steps.B, 'B');
  const c = requireStep(steps.C, 'C');

  const source = projectSource(projection, a, b, c);
  const method = projectMethod(projection, c);
  const applicability = projectApplicability(c);
  const calculation = projectCalculation(a, b, c);
  const review = projectReview(options?.reviewState);
  const codeCompliance = Object.freeze({ state: 'NOT_ASSESSED', authorityEstablished: false });
  const release = projectRelease(projection);
  const blockers = unique([
    ...source.blockers,
    ...method.blockers,
    ...calculation.blockers,
  ]);

  return deepFreeze({
    schema: EMP1_READINESS_SCHEMA,
    productId: projection.product?.productId ?? 'EMP.1',
    source,
    method,
    applicability,
    calculation,
    review,
    codeCompliance,
    release,
    overall: resolveOverall({ source, method, calculation, review }),
    blockers,
    authorityBoundary: {
      projectionOnly: true,
      createsEngineeringAuthority: false,
      createsMethodAuthority: false,
      createsApplicabilityAuthority: false,
      createsReviewAuthority: false,
      createsCodeCompliance: false,
      createsReleaseAuthority: false,
    },
  });
}

function projectSource(projection, a, b, c) {
  const blockers = [];
  if (a.documentLoaded !== true) blockers.push('EMP1_READINESS_A_SOURCE_REQUIRED');
  if (b.documentLoaded !== true) blockers.push('EMP1_READINESS_B_SOURCE_REQUIRED');
  if (c.state === C_SOURCE_INCOMPLETE) blockers.push(...array(c.blockers));
  if (projection.custody?.refreshBlockerCode) blockers.push(projection.custody.refreshBlockerCode);

  const stale = B_SOURCE_STALE_STATES.has(b.state) || c.state === C_STALE_INPUT;
  const inputRequired = a.documentLoaded !== true
    || b.documentLoaded !== true
    || c.state === C_SOURCE_INCOMPLETE;
  return Object.freeze({
    state: inputRequired ? 'INPUT_REQUIRED' : stale ? 'STALE' : 'CURRENT',
    a: stepSnapshot(a),
    b: stepSnapshot(b),
    c: stepSnapshot(c),
    blockers: unique(blockers),
  });
}

function projectMethod(projection, c) {
  const productionAuthority = projection.qualificationBoundary?.emp1CProductionAuthority ?? null;
  if (!SUPPORTED_C_STATES.has(c.state)) {
    return Object.freeze({
      state: 'BLOCKED',
      productionAuthority,
      blockers: [`EMP1_READINESS_C_STATE_UNSUPPORTED:${String(c.state)}`],
    });
  }
  if (c.state === C_ROUTE_SUSPENDED) {
    return Object.freeze({
      state: 'BLOCKED',
      productionAuthority,
      blockers: unique(array(c.blockers)),
    });
  }
  if (c.state === C_SOURCE_INCOMPLETE) {
    return Object.freeze({ state: 'NOT_ESTABLISHED', productionAuthority, blockers: [] });
  }
  return Object.freeze({
    state: 'AUTHORIZED_BOUNDED_ROUTE',
    productionAuthority,
    blockers: [],
  });
}

function projectApplicability(c) {
  if (c.state === C_CALCULATED_CURRENT && c.resultAvailable === true) {
    return Object.freeze({
      state: 'QUALIFIED_BY_CURRENT_EXECUTION_GATE',
      basis: 'CURRENT_REPORTABLE_BOUNDED_C_EXECUTION',
    });
  }
  if ((c.state === C_STALE_INPUT || c.state === C_STALE_AUTHORITY)
    && c.retainedResultAvailable === true) {
    return Object.freeze({ state: 'STALE_WITH_RETAINED_CALCULATION', basis: null });
  }
  if (c.state === C_READY_TO_RUN || c.state === C_BOUNDED_ROUTE_AVAILABLE) {
    return Object.freeze({ state: 'PENDING_EXECUTION_GATE', basis: null });
  }
  return Object.freeze({ state: 'NOT_ESTABLISHED', basis: null });
}

function projectCalculation(a, b, c) {
  if (c.state === C_STALE_INPUT || c.state === C_STALE_AUTHORITY) {
    return Object.freeze({
      state: 'STALE',
      aResultCurrent: a.resultAvailable === true,
      bResultCurrent: b.resultAvailable === true,
      cResultCurrent: false,
      retainedCResultAvailable: c.retainedResultAvailable === true,
      blockers: unique(array(c.blockers)),
    });
  }
  if (c.state === C_CALCULATED_CURRENT && c.resultAvailable === true) {
    return calculationState('CURRENT', a, b, c, []);
  }
  if (c.state === C_READY_TO_RUN || c.state === C_BOUNDED_ROUTE_AVAILABLE) {
    return calculationState('READY_TO_CALCULATE', a, b, c, []);
  }
  if (c.state === C_ROUTE_SUSPENDED) {
    return calculationState('BLOCKED', a, b, c, array(c.blockers));
  }
  return calculationState('NOT_READY', a, b, c, array(c.blockers));
}

function calculationState(state, a, b, c, blockers) {
  return Object.freeze({
    state,
    aResultCurrent: a.resultAvailable === true,
    bResultCurrent: b.resultAvailable === true,
    cResultCurrent: c.resultAvailable === true,
    retainedCResultAvailable: c.retainedResultAvailable === true,
    blockers: unique(blockers),
  });
}

function projectReview(value) {
  if (value == null) return Object.freeze({
    state: 'NOT_REVIEWED', reviewed: false, current: false, disposition: null,
    reviewId: null, reviewSemanticHash: null, changedBindings: Object.freeze([]),
    authorityEstablished: false, authorityEstablishedByProjection: false,
  });
  const review = requireReviewState(value);
  return Object.freeze({
    state: review.state, reviewed: review.reviewed, current: review.current,
    disposition: review.disposition, reviewId: review.reviewId ?? null,
    reviewSemanticHash: review.reviewSemanticHash ?? null,
    changedBindings: unique(array(review.changedBindings)),
    authorityEstablished: false, authorityEstablishedByProjection: false,
  });
}

function projectRelease(projection) {
  const qualified = projection.qualificationBoundary?.releaseQualified === true;
  return Object.freeze({
    state: qualified ? 'QUALIFIED_BY_EXISTING_RELEASE_BOUNDARY' : 'NOT_QUALIFIED',
    releaseQualified: qualified,
    authorityEstablishedByProjection: false,
  });
}

function resolveOverall({ source, method, calculation, review }) {
  if (source.state === 'INPUT_REQUIRED') return EMP1_READINESS_OVERALL.INPUT_REQUIRED;
  if (source.state === 'STALE') return EMP1_READINESS_OVERALL.SOURCE_STALE;
  if (method.state === 'BLOCKED') return EMP1_READINESS_OVERALL.METHOD_BLOCKED;
  if (calculation.state === 'STALE') return EMP1_READINESS_OVERALL.CALCULATION_STALE;
  if (calculation.state === 'CURRENT') {
    if (review.state === 'REVIEW_ACCEPTED') return EMP1_READINESS_OVERALL.REVIEW_ACCEPTED;
    if (review.state === 'REVIEW_REJECTED') return EMP1_READINESS_OVERALL.REVIEW_REJECTED;
    if (review.state === 'REVIEW_STALE') return EMP1_READINESS_OVERALL.REVIEW_STALE;
    return EMP1_READINESS_OVERALL.READY_FOR_ENGINEERING_REVIEW;
  }
  if (calculation.state === 'READY_TO_CALCULATE') {
    return EMP1_READINESS_OVERALL.READY_TO_CALCULATE;
  }
  return EMP1_READINESS_OVERALL.CALCULATION_REQUIRED;
}

function requireReviewState(value) {
  if (!record(value) || value.schema !== REVIEW_STATE_SCHEMA || value.productId !== 'EMP.1'
    || !REVIEW_STATES.has(value.state)) {
    throw readinessError('EMP1_READINESS_REVIEW_STATE_INVALID');
  }
  const valid = value.state === 'NOT_REVIEWED'
    ? value.reviewed === false && value.current === false && value.disposition == null
    : value.state === 'REVIEW_ACCEPTED' ? value.reviewed === true && value.current === true
      && value.disposition === 'ACCEPTED'
      : value.state === 'REVIEW_REJECTED' ? value.reviewed === true && value.current === true
        && value.disposition === 'REJECTED'
        : value.reviewed === true && value.current === false
          && ['ACCEPTED', 'REJECTED'].includes(value.disposition)
          && Array.isArray(value.changedBindings) && value.changedBindings.length > 0;
  if (!valid) throw readinessError('EMP1_READINESS_REVIEW_STATE_INCONSISTENT');
  return value;
}

function stepSnapshot(step) {
  return Object.freeze({
    stepId: step.stepId,
    state: step.state,
    documentLoaded: step.documentLoaded === true,
    resultAvailable: step.resultAvailable === true,
    retainedResultAvailable: step.retainedResultAvailable === true,
  });
}

function requireProjection(value) {
  if (!record(value) || value.schema !== 'emp1-product-projection/v1') {
    throw readinessError('EMP1_READINESS_PRODUCT_PROJECTION_INVALID');
  }
  if (!Array.isArray(value.steps)) throw readinessError('EMP1_READINESS_STEPS_REQUIRED');
  return value;
}

function stepsByShortId(steps) {
  return Object.fromEntries(steps.map((step) => [step?.shortId, step]));
}

function requireStep(value, shortId) {
  if (!record(value) || value.shortId !== shortId) {
    throw readinessError(`EMP1_READINESS_STEP_REQUIRED:${shortId}`);
  }
  return value;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return Object.freeze([...new Set(values.filter((value) => value != null).map(String))]);
}

function record(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readinessError(code) {
  const error = new TypeError(code);
  error.code = code;
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
