import { semanticHash } from '../core/shared-primitives/canonical-json.js';

export const EMP1_WORKBENCH_RUN_INPUT_SCHEMA = 'emp1-workbench-run-input/v3';
export const EMP1_WORKBENCH_LEGACY_RUN_INPUT_SCHEMA = 'emp1-workbench-run-input/v2';
export const EMP1_WORKBENCH_PRODUCT_EXECUTION_SCHEMA = 'emp1-workbench-product-execution/v2';
export const EMP1_WORKBENCH_BOUNDED_ROUTE_REQUEST_SCHEMA =
  'emp1-wrc537-gamma5-zero-dp-orchestration-request/v2';
export const EMP1_WORKBENCH_ATTACHMENT_DIAMETER_BASIS =
  'OUTSIDE_DIAMETER_AT_SHELL_JUNCTURE';
export const EMP1_WORKBENCH_ATTACHMENT_PHYSICAL_LOCATION =
  'ATTACHMENT_SHELL_JUNCTURE';
export const EMP1_WORKBENCH_CYLINDER_LENGTH_BASIS =
  'BETWEEN_CYLINDER_END_PLANES';
export const EMP1_WORKBENCH_ATTACHMENT_STATION_BASIS =
  'FROM_CYLINDER_START_END_PLANE_TO_WRC_ATTACHMENT_REFERENCE_POINT';
export const EMP1_WORKBENCH_ROUTE_AUTHORITY_CHANGED =
  'EMP1_WORKBENCH_ROUTE_AUTHORITY_CHANGED';
export const EMP1_WORKBENCH_EXECUTION_CURRENTNESS = Object.freeze({
  NOT_RUN: 'NOT_RUN',
  CURRENT: 'CURRENT',
  STALE: 'STALE',
});
export const EMP1_WORKBENCH_C_STATE = Object.freeze({
  SOURCE_INCOMPLETE: 'SOURCE_INCOMPLETE',
  ROUTE_SUSPENDED: 'ROUTE_SUSPENDED',
  READY_TO_RUN: 'READY_TO_RUN',
  CALCULATED_CURRENT: 'CALCULATED_CURRENT',
  STALE_AUTHORITY: 'STALE_AUTHORITY',
  STALE_INPUT: 'STALE_INPUT',
});

const RUN_INPUT_KEYS = Object.freeze(['schema', 'localMethod']);
const LOCAL_METHOD_REQUIRED_KEYS = Object.freeze(['routeRequest', 'attachmentGeometry']);
const LOCAL_METHOD_ALLOWED_KEYS = Object.freeze([
  ...LOCAL_METHOD_REQUIRED_KEYS, 'applicabilityGeometry',
]);
const ATTACHMENT_GEOMETRY_KEYS = Object.freeze([
  'geometryIdentity', 'attachmentDiameter', 'diameterBasis',
  'physicalLocation', 'unit', 'sourceReference',
]);
const APPLICABILITY_GEOMETRY_KEYS = Object.freeze([
  'geometryIdentity', 'cylinderLengthBasis', 'cylinderLength',
  'attachmentStationBasis', 'attachmentStationFromCylinderStart', 'unit',
  'cylinderLengthSourceReference', 'attachmentStationSourceReference',
]);
const ROUTE_REQUEST_KEYS = Object.freeze([
  'schema', 'loadCaseIdentity', 'pressureResultIdentity',
]);
const C_AUTHORITY_CURRENTNESS_REASONS = Object.freeze([
  'EMP1_WORKBENCH_C_ROUTE_AUTHORITY_SNAPSHOT_REQUIRED',
  'EMP1_WORKBENCH_C_CURRENT_ROUTE_AUTHORITY_REQUIRED',
  EMP1_WORKBENCH_ROUTE_AUTHORITY_CHANGED,
  'EMP1_WORKBENCH_C_CURRENT_ROUTE_NOT_AUTHORIZED',
]);

/** Lightweight source-state contract. This module intentionally imports no WRC executor/data. */
export function normalizeEmp1WorkbenchRunInput(value) {
  const raw = requireRecord(value, 'EMP1_WORKBENCH_RUN_INPUT_REQUIRED');
  if (raw.schema === EMP1_WORKBENCH_LEGACY_RUN_INPUT_SCHEMA) {
    throw workbenchError('EMP1_WORKBENCH_V2_ATTACHMENT_GEOMETRY_REBIND_REQUIRED');
  }
  const input = exactRecord(raw, RUN_INPUT_KEYS, 'EMP1_WORKBENCH_RUN_INPUT_KEYS_INVALID');
  if (input.schema !== EMP1_WORKBENCH_RUN_INPUT_SCHEMA) {
    throw workbenchError('EMP1_WORKBENCH_RUN_INPUT_SCHEMA_INVALID');
  }
  return deepFreeze({
    schema: EMP1_WORKBENCH_RUN_INPUT_SCHEMA,
    localMethod: normalizeLocalMethod(input.localMethod),
  });
}

export function emp1WorkbenchRunInputHash(value) {
  return semanticHash(normalizeEmp1WorkbenchRunInput(value));
}

export function emp1WorkbenchInputHashes({ aDocument, bDocument, runInput } = {}) {
  const normalized = normalizeEmp1WorkbenchRunInput(runInput);
  return deepFreeze({
    loadTransferDocument: semanticHash(requireRecord(
      aDocument,
      'EMP1_WORKBENCH_A_DOCUMENT_REQUIRED',
    )),
    sectionScreeningDocument: semanticHash(requireRecord(
      bDocument,
      'EMP1_WORKBENCH_B_DOCUMENT_REQUIRED',
    )),
    attachmentGeometry: semanticHash(normalized.localMethod.attachmentGeometry),
    applicabilityGeometry: normalized.localMethod.applicabilityGeometry
      ? semanticHash(normalized.localMethod.applicabilityGeometry)
      : null,
    localRoute: semanticHash(normalized.localMethod.routeRequest),
  });
}

export function reconcileEmp1WorkbenchChangeClasses(declared, previousHashes, nextHashes) {
  const classes = new Set(Array.isArray(declared) ? declared : []);
  if (!previousHashes) classes.add('SOURCE_IDENTITY');
  else {
    if (previousHashes.loadTransferDocument !== nextHashes.loadTransferDocument) {
      classes.add('SOURCE_IDENTITY');
    }
    if (previousHashes.sectionScreeningDocument !== nextHashes.sectionScreeningDocument
      || previousHashes.attachmentGeometry !== nextHashes.attachmentGeometry) {
      classes.add('SECTION');
    }
    if (previousHashes.localRoute !== nextHashes.localRoute
      || previousHashes.applicabilityGeometry !== nextHashes.applicabilityGeometry) {
      classes.add('LOCAL_METHOD');
    }
  }
  return deepFreeze([...classes]);
}

export function projectEmp1WorkbenchRunReadiness({ aDocument, bDocument, runInput } = {}) {
  const reasons = [];
  if (!record(aDocument)) reasons.push('EMP1_WORKBENCH_A_DOCUMENT_REQUIRED');
  if (!record(bDocument)) reasons.push('EMP1_WORKBENCH_B_DOCUMENT_REQUIRED');
  try {
    const normalized = normalizeEmp1WorkbenchRunInput(runInput);
    if (!normalized.localMethod.applicabilityGeometry) {
      reasons.push('EMP1_WORKBENCH_APPLICABILITY_GEOMETRY_REQUIRED');
    }
  } catch (error) {
    reasons.push(error?.code ?? 'EMP1_WORKBENCH_RUN_INPUT_INVALID');
  }
  return deepFreeze({
    schema: 'emp1-workbench-run-readiness/v1',
    state: reasons.length ? 'BLOCKED' : 'READY',
    runAuthorized: reasons.length === 0,
    reasons: [...new Set(reasons)],
  });
}

/**
 * Classify the retained product transaction against both current source inputs
 * and, when supplied, the live bounded-C route authority. Callers that own the
 * current route state (the workbench controller/product projection) must pass it.
 * The optional form is retained for older non-UI source-currentness consumers.
 */
export function classifyEmp1WorkbenchExecutionCurrentness({
  execution,
  aDocument,
  bDocument,
  runInput,
  currentRouteAuthority,
} = {}) {
  if (!execution) {
    return deepFreeze({
      state: EMP1_WORKBENCH_EXECUTION_CURRENTNESS.NOT_RUN,
      reasons: [],
      inputCurrent: false,
      cAuthorityCurrent: false,
      cReportable: false,
      routeAuthorityEvaluated: currentRouteAuthority != null,
    });
  }
  if (execution.schema !== EMP1_WORKBENCH_PRODUCT_EXECUTION_SCHEMA || !execution.inputHashes) {
    return deepFreeze({
      state: EMP1_WORKBENCH_EXECUTION_CURRENTNESS.STALE,
      reasons: ['EMP1_WORKBENCH_EXECUTION_SCHEMA_OR_HASHES_INVALID'],
      inputCurrent: false,
      cAuthorityCurrent: false,
      cReportable: false,
      routeAuthorityEvaluated: currentRouteAuthority != null,
    });
  }
  try {
    const current = emp1WorkbenchInputHashes({ aDocument, bDocument, runInput });
    const inputReasons = Object.keys(current)
      .filter((key) => current[key] !== execution.inputHashes[key])
      .map((key) => `EMP1_WORKBENCH_${key.toUpperCase()}_CHANGED`);
    const authorityReasons = currentRouteAuthority == null
      ? []
      : routeAuthorityCurrentnessReasons(execution, currentRouteAuthority);
    const reasons = [...inputReasons, ...authorityReasons];
    const inputCurrent = inputReasons.length === 0;
    const cAuthorityCurrent = currentRouteAuthority == null
      ? true
      : authorityReasons.length === 0;
    const numericalC = execution.authority?.boundedLocalRouteExecuted === true;
    return deepFreeze({
      state: reasons.length
        ? EMP1_WORKBENCH_EXECUTION_CURRENTNESS.STALE
        : EMP1_WORKBENCH_EXECUTION_CURRENTNESS.CURRENT,
      reasons,
      inputCurrent,
      cAuthorityCurrent,
      cReportable: numericalC
        && inputCurrent
        && cAuthorityCurrent
        && (currentRouteAuthority == null || currentRouteAuthority.productionUseAuthorized === true),
      routeAuthorityEvaluated: currentRouteAuthority != null,
    });
  } catch (error) {
    return deepFreeze({
      state: EMP1_WORKBENCH_EXECUTION_CURRENTNESS.STALE,
      reasons: [error?.code ?? 'EMP1_WORKBENCH_CURRENTNESS_INPUT_INVALID'],
      inputCurrent: false,
      cAuthorityCurrent: false,
      cReportable: false,
      routeAuthorityEvaluated: currentRouteAuthority != null,
    });
  }
}

/**
 * Single C-state source of truth for button enablement, stage badge, current
 * numerical result projection and retained historical evidence. Views must not
 * re-read the route registry or render execution.result.localCorrelation as a
 * current stress result without passing through this projection.
 */
export function projectEmp1WorkbenchCState({
  readiness,
  execution,
  currentness,
  routeAuthority,
} = {}) {
  const sourceReady = readiness?.state === 'READY';
  const productionUseAuthorized = routeAuthority?.productionUseAuthorized === true;
  const numericalC = execution?.authority?.boundedLocalRouteExecuted === true;
  const executionBlockedAndCurrent = execution?.status === 'BLOCKED'
    && currentness?.state === EMP1_WORKBENCH_EXECUTION_CURRENTNESS.CURRENT;
  // A route can be perfectly sound while these inputs fall outside the domain it
  // is qualified for. That refusal is carried by the local-correlation result
  // rather than by the route, so without it the engineer is offered a run that
  // returns BLOCKED every time and is never told which bound it missed.
  const executionScopeBlockReasons = executionBlockedAndCurrent
    && execution?.result?.localCorrelation?.state === 'BLOCKED'
    ? unique(execution.result.localCorrelation.reasons ?? [])
    : [];
  const executionRouteSuspensionReasons = unique([
    ...(executionBlockedAndCurrent ? (execution?.authority?.routeSuspensionReasons ?? []) : []),
    ...executionScopeBlockReasons,
  ]);
  const executionRouteSuspended = executionRouteSuspensionReasons.length > 0;
  const reportable = numericalC
    && currentness?.cReportable === true
    && productionUseAuthorized;
  const authorityStale = (currentness?.reasons ?? [])
    .some((reason) => C_AUTHORITY_CURRENTNESS_REASONS.includes(reason));
  const retainedHistory = Array.isArray(execution?.retainedLocalCorrelationHistory)
    ? execution.retainedLocalCorrelationHistory
    : [];

  let state;
  let buttonEnabled;
  let buttonLabel;
  let stageBadge;
  if (!sourceReady) {
    state = EMP1_WORKBENCH_C_STATE.SOURCE_INCOMPLETE;
    buttonEnabled = false;
    buttonLabel = 'Complete C source binding';
    stageBadge = 'SOURCE INCOMPLETE';
  } else if (!productionUseAuthorized || executionRouteSuspended) {
    state = EMP1_WORKBENCH_C_STATE.ROUTE_SUSPENDED;
    buttonEnabled = false;
    buttonLabel = executionRouteSuspended ? 'C blocked by current inputs' : 'C route suspended';
    stageBadge = executionRouteSuspended ? 'BLOCKED · ROUTE LIMIT' : 'PREPARED · ROUTE SUSPENDED';
  } else if (numericalC && currentness?.state === EMP1_WORKBENCH_EXECUTION_CURRENTNESS.STALE) {
    state = authorityStale
      ? EMP1_WORKBENCH_C_STATE.STALE_AUTHORITY
      : EMP1_WORKBENCH_C_STATE.STALE_INPUT;
    buttonEnabled = true;
    buttonLabel = authorityStale ? 'Re-run C under current authority' : 'Re-run C';
    stageBadge = authorityStale ? 'STALE · AUTHORITY CHANGED' : 'STALE · INPUT CHANGED';
  } else if (reportable) {
    state = EMP1_WORKBENCH_C_STATE.CALCULATED_CURRENT;
    buttonEnabled = true;
    buttonLabel = 'Re-run C';
    stageBadge = 'CALCULATED · CURRENT';
  } else {
    state = EMP1_WORKBENCH_C_STATE.READY_TO_RUN;
    buttonEnabled = true;
    buttonLabel = 'Run C';
    stageBadge = 'READY · AUTHORIZED';
  }

  const blockerCodes = unique([
    ...(!sourceReady ? (readiness?.reasons ?? []) : []),
    ...(!productionUseAuthorized ? (routeAuthority?.reasons ?? []) : []),
    ...(executionRouteSuspended ? executionRouteSuspensionReasons : []),
    ...(state === EMP1_WORKBENCH_C_STATE.STALE_AUTHORITY
      || state === EMP1_WORKBENCH_C_STATE.STALE_INPUT
      ? (currentness?.reasons ?? [])
      : []),
  ]);
  const executionAuthorityHash = execution?.authority?.routeAuthorityHash
    ?? execution?.authority?.routeAuthoritySnapshot?.semanticHash
    ?? null;
  const currentAuthorityHash = routeAuthority?.routeAuthorityHash
    ?? routeAuthority?.snapshot?.semanticHash
    ?? null;
  return deepFreeze({
    schema: 'emp1-workbench-c-state/v1',
    state,
    sourceReady,
    productionUseAuthorized,
    buttonEnabled,
    buttonLabel,
    stageBadge,
    blockerCodes,
    retainedResultAvailable: numericalC || retainedHistory.length > 0,
    currentResultAvailable: reportable,
    reportableResult: reportable ? execution.result.localCorrelation : null,
    currentExecutionEvidence: execution?.result?.localCorrelation ?? null,
    retainedHistoricalEvidence: retainedHistory,
    currentAuthorityHash,
    executionAuthorityHash,
    currentAuthoritySnapshot: routeAuthority?.snapshot ?? null,
    executionAuthoritySnapshot: execution?.authority?.routeAuthoritySnapshot ?? null,
  });
}

export function normalizeEmp1AttachmentGeometry(value) {
  const source = exactRecord(value, ATTACHMENT_GEOMETRY_KEYS,
    'EMP1_WORKBENCH_ATTACHMENT_GEOMETRY_KEYS_INVALID');
  if (source.diameterBasis !== EMP1_WORKBENCH_ATTACHMENT_DIAMETER_BASIS) {
    throw workbenchError('EMP1_WORKBENCH_ATTACHMENT_OUTSIDE_DIAMETER_BASIS_REQUIRED');
  }
  if (source.physicalLocation !== EMP1_WORKBENCH_ATTACHMENT_PHYSICAL_LOCATION) {
    throw workbenchError('EMP1_WORKBENCH_ATTACHMENT_SHELL_JUNCTURE_LOCATION_REQUIRED');
  }
  return deepFreeze({
    geometryIdentity: requiredText(
      source.geometryIdentity,
      'EMP1_WORKBENCH_GEOMETRY_IDENTITY_REQUIRED',
    ),
    attachmentDiameter: positive(
      source.attachmentDiameter,
      'EMP1_WORKBENCH_ATTACHMENT_DIAMETER_INVALID',
    ),
    diameterBasis: EMP1_WORKBENCH_ATTACHMENT_DIAMETER_BASIS,
    physicalLocation: EMP1_WORKBENCH_ATTACHMENT_PHYSICAL_LOCATION,
    unit: requiredText(source.unit, 'EMP1_WORKBENCH_ATTACHMENT_UNIT_REQUIRED'),
    sourceReference: requiredText(
      source.sourceReference,
      'EMP1_WORKBENCH_ATTACHMENT_SOURCE_REFERENCE_REQUIRED',
    ),
  });
}

export function normalizeEmp1ApplicabilityGeometry(value) {
  const source = exactRecord(value, APPLICABILITY_GEOMETRY_KEYS,
    'EMP1_WORKBENCH_APPLICABILITY_GEOMETRY_KEYS_INVALID');
  if (source.cylinderLengthBasis !== EMP1_WORKBENCH_CYLINDER_LENGTH_BASIS) {
    throw workbenchError('EMP1_WORKBENCH_CYLINDER_LENGTH_BASIS_REQUIRED');
  }
  if (source.attachmentStationBasis !== EMP1_WORKBENCH_ATTACHMENT_STATION_BASIS) {
    throw workbenchError('EMP1_WORKBENCH_ATTACHMENT_STATION_BASIS_REQUIRED');
  }
  const cylinderLength = positive(source.cylinderLength,
    'EMP1_WORKBENCH_CYLINDER_LENGTH_INVALID');
  const station = nonNegative(source.attachmentStationFromCylinderStart,
    'EMP1_WORKBENCH_ATTACHMENT_STATION_INVALID');
  if (station > cylinderLength) {
    throw workbenchError('EMP1_WORKBENCH_ATTACHMENT_STATION_OUTSIDE_CYLINDER');
  }
  return deepFreeze({
    geometryIdentity: requiredText(source.geometryIdentity,
      'EMP1_WORKBENCH_APPLICABILITY_GEOMETRY_IDENTITY_REQUIRED'),
    cylinderLengthBasis: EMP1_WORKBENCH_CYLINDER_LENGTH_BASIS,
    cylinderLength,
    attachmentStationBasis: EMP1_WORKBENCH_ATTACHMENT_STATION_BASIS,
    attachmentStationFromCylinderStart: station,
    unit: requiredText(source.unit, 'EMP1_WORKBENCH_APPLICABILITY_UNIT_REQUIRED'),
    cylinderLengthSourceReference: requiredText(source.cylinderLengthSourceReference,
      'EMP1_WORKBENCH_CYLINDER_LENGTH_SOURCE_REFERENCE_REQUIRED'),
    attachmentStationSourceReference: requiredText(source.attachmentStationSourceReference,
      'EMP1_WORKBENCH_ATTACHMENT_STATION_SOURCE_REFERENCE_REQUIRED'),
  });
}

function routeAuthorityCurrentnessReasons(execution, currentRouteAuthority) {
  const retainedSnapshot = execution.authority?.routeAuthoritySnapshot ?? null;
  const currentSnapshot = currentRouteAuthority?.snapshot ?? null;
  const retainedHash = execution.authority?.routeAuthorityHash
    ?? retainedSnapshot?.semanticHash
    ?? null;
  const currentHash = currentRouteAuthority?.routeAuthorityHash
    ?? currentSnapshot?.semanticHash
    ?? null;
  const reasons = [];
  if (!retainedSnapshot?.semanticHash) {
    reasons.push('EMP1_WORKBENCH_C_ROUTE_AUTHORITY_SNAPSHOT_REQUIRED');
  }
  if (!currentSnapshot?.semanticHash) {
    reasons.push('EMP1_WORKBENCH_C_CURRENT_ROUTE_AUTHORITY_REQUIRED');
  }
  if (retainedHash && currentHash && retainedHash !== currentHash) {
    reasons.push(EMP1_WORKBENCH_ROUTE_AUTHORITY_CHANGED);
  }
  if (execution.authority?.boundedLocalRouteExecuted === true
    && currentRouteAuthority?.productionUseAuthorized !== true) {
    reasons.push('EMP1_WORKBENCH_C_CURRENT_ROUTE_NOT_AUTHORIZED');
  }
  return reasons;
}

function normalizeLocalMethod(value) {
  const source = allowedRecord(value, LOCAL_METHOD_REQUIRED_KEYS, LOCAL_METHOD_ALLOWED_KEYS,
    'EMP1_WORKBENCH_LOCAL_METHOD_KEYS_INVALID');
  const routeRequest = exactRecord(source.routeRequest, ROUTE_REQUEST_KEYS,
    'EMP1_WORKBENCH_ROUTE_REQUEST_KEYS_INVALID');
  if (routeRequest.schema !== EMP1_WORKBENCH_BOUNDED_ROUTE_REQUEST_SCHEMA) {
    throw workbenchError('EMP1_WORKBENCH_ROUTE_REQUEST_SCHEMA_INVALID');
  }
  const normalized = {
    routeRequest: deepFreeze({
      schema: EMP1_WORKBENCH_BOUNDED_ROUTE_REQUEST_SCHEMA,
      loadCaseIdentity: requiredText(
        routeRequest.loadCaseIdentity,
        'EMP1_WORKBENCH_LOAD_CASE_IDENTITY_REQUIRED',
      ),
      pressureResultIdentity: requiredText(
        routeRequest.pressureResultIdentity,
        'EMP1_WORKBENCH_PRESSURE_RESULT_IDENTITY_REQUIRED',
      ),
    }),
    attachmentGeometry: normalizeEmp1AttachmentGeometry(source.attachmentGeometry),
  };
  if (source.applicabilityGeometry != null) {
    normalized.applicabilityGeometry = normalizeEmp1ApplicabilityGeometry(
      source.applicabilityGeometry,
    );
  }
  return normalized;
}

function allowedRecord(value, requiredKeys, allowedKeys, code) {
  requireRecord(value, code);
  const actual = Object.keys(value);
  if (requiredKeys.some((key) => !actual.includes(key))
    || actual.some((key) => !allowedKeys.includes(key))) {
    throw workbenchError(code);
  }
  return structuredClone(value);
}
function exactRecord(value, keys, code) {
  requireRecord(value, code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw workbenchError(code);
  return structuredClone(value);
}
function requireRecord(value, code) {
  if (!record(value)) throw workbenchError(code);
  return value;
}
function record(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function requiredText(value, code) {
  if (typeof value !== 'string' || !value.trim()) throw workbenchError(code);
  return value.trim();
}
function positive(value, code) {
  if (!Number.isFinite(value) || value <= 0) throw workbenchError(code);
  return Number(value);
}
function nonNegative(value, code) {
  if (!Number.isFinite(value) || value < 0) throw workbenchError(code);
  return Number(value);
}
function unique(values) { return [...new Set(values ?? [])]; }
function workbenchError(code) { const error = new TypeError(code); error.code = code; return error; }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}