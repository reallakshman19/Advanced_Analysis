import {
  EMP1_METHOD_AUTHORITY_STATE,
  projectEmp1MethodAuthority,
} from './emp1-method-authority-projection.js';

export const EMP1_READINESS_SCHEMA = 'emp1-readiness/v1';

export const EMP1_READINESS_OVERALL = Object.freeze({
  INPUT_REQUIRED: 'INPUT_REQUIRED',
  SOURCE_STALE: 'SOURCE_STALE',
  METHOD_BLOCKED: 'METHOD_BLOCKED',
  READY_TO_CALCULATE: 'READY_TO_CALCULATE',
  CALCULATION_REQUIRED: 'CALCULATION_REQUIRED',
  CALCULATION_STALE: 'CALCULATION_STALE',
  READY_FOR_ENGINEERING_REVIEW: 'READY_FOR_ENGINEERING_REVIEW',
});

const B_SOURCE_STALE_STATES = new Set([
  'AWAITING_CURRENT_A',
  'A_EVIDENCE_REQUIRED',
  'STALE_A_EVIDENCE',
]);

const C_SOURCE_INCOMPLETE = 'SOURCE_INCOMPLETE';
const C_ROUTE_SUSPENDED = 'ROUTE_SUSPENDED';
const C_READY_TO_RUN = 'READY_TO_RUN';
const C_CALCULATED_CURRENT = 'CALCULATED_CURRENT';
const C_STALE_AUTHORITY = 'STALE_AUTHORITY';
const C_STALE_INPUT = 'STALE_INPUT';
const SUPPORTED_C_STATES = new Set([
  C_SOURCE_INCOMPLETE,
  C_ROUTE_SUSPENDED,
  C_READY_TO_RUN,
  C_CALCULATED_CURRENT,
  C_STALE_AUTHORITY,
  C_STALE_INPUT,
]);

/**
 * Compose existing EMP.1 product/currentness evidence into one governance view.
 * This projection does not calculate WRC applicability, method authority,
 * code compliance, review approval, or release authority.
 */
export function projectEmp1Readiness(productProjection) {
  const projection = requireProjection(productProjection);
  const steps = stepsByShortId(projection.steps);
  const a = requireStep(steps.A, 'A');
  const b = requireStep(steps.B, 'B');
  const c = requireStep(steps.C, 'C');

  const source = projectSource(projection, a, b, c);
  const methodAuthority = projectEmp1MethodAuthority(projection);
  const method = projectMethod(methodAuthority, c);
  const applicability = projectApplicability(c);
  const calculation = projectCalculation(a, b, c);
  const review = Object.freeze({ state: 'NOT_REVIEWED', authorityEstablished: false });
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
    overall: resolveOverall({ source, method, calculation }),
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

function projectMethod(methodAuthority, c) {
  const shared = {
    productionAuthority: methodAuthority.productionAuthority,
    authorityProjection: methodAuthority,
  };
  if (!SUPPORTED_C_STATES.has(c.state)) {
    return Object.freeze({
      ...shared,
      state: 'BLOCKED',
      blockers: [`EMP1_READINESS_C_STATE_UNSUPPORTED:${String(c.state)}`],
    });
  }
  if (c.state === C_ROUTE_SUSPENDED) {
    return Object.freeze({
      ...shared,
      state: 'BLOCKED',
      blockers: unique([...methodAuthority.blockers, ...array(c.blockers)]),
    });
  }
  if (c.state === C_SOURCE_INCOMPLETE) {
    return Object.freeze({
      ...shared,
      state: 'NOT_ESTABLISHED',
      blockers: methodAuthority.blockers,
    });
  }
  if (methodAuthority.state === EMP1_METHOD_AUTHORITY_STATE.AUTHORIZED_BOUNDED_ROUTE) {
    return Object.freeze({ ...shared, state: 'AUTHORIZED_BOUNDED_ROUTE', blockers: [] });
  }
  if (methodAuthority.state === EMP1_METHOD_AUTHORITY_STATE.QUALIFIED_METHOD_AUTHORITY) {
    return Object.freeze({ ...shared, state: 'QUALIFIED_METHOD_AUTHORITY', blockers: [] });
  }
  return Object.freeze({
    ...shared,
    state: 'BLOCKED',
    blockers: methodAuthority.blockers.length > 0
      ? methodAuthority.blockers
      : Object.freeze(['EMP1_READINESS_METHOD_AUTHORITY_NOT_AUTHORIZED']),
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
  if (c.state === C_READY_TO_RUN) {
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
  if (c.state === C_READY_TO_RUN) {
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

function projectRelease(projection) {
  const qualified = projection.qualificationBoundary?.releaseQualified === true;
  return Object.freeze({
    state: qualified ? 'QUALIFIED_BY_EXISTING_RELEASE_BOUNDARY' : 'NOT_QUALIFIED',
    releaseQualified: qualified,
    authorityEstablishedByProjection: false,
  });
}

function resolveOverall({ source, method, calculation }) {
  if (source.state === 'INPUT_REQUIRED') return EMP1_READINESS_OVERALL.INPUT_REQUIRED;
  if (source.state === 'STALE') return EMP1_READINESS_OVERALL.SOURCE_STALE;
  if (method.state === 'BLOCKED') return EMP1_READINESS_OVERALL.METHOD_BLOCKED;
  if (calculation.state === 'STALE') return EMP1_READINESS_OVERALL.CALCULATION_STALE;
  if (calculation.state === 'CURRENT') {
    return EMP1_READINESS_OVERALL.READY_FOR_ENGINEERING_REVIEW;
  }
  if (calculation.state === 'READY_TO_CALCULATE') {
    return EMP1_READINESS_OVERALL.READY_TO_CALCULATE;
  }
  return EMP1_READINESS_OVERALL.CALCULATION_REQUIRED;
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
