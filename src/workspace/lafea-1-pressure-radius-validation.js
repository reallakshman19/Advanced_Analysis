import { toleranceFor } from '../core/local-stress/numeric.js';

export const LAFEA1_PRESSURE_RADIUS_VALIDATION_SCHEMA =
  'lafea1-pressure-radius-validation/v1';
export const LAFEA1_PRESSURE_RADIUS_OUTSIDE_WALL =
  'EMP1_WORKBENCH_LAFEA_1_REQUESTED_RADIUS_OUTSIDE_WALL';

/**
 * Workspace preflight for the exact pressure-radius invariant enforced by the
 * qualified LAFEA.1 pressure solver. This projection never mutates source data
 * and deliberately reuses the solver tolerance function instead of inventing a
 * UI-only numerical tolerance.
 */
export function projectLafea1PressureRadiusValidation(documentValue) {
  if (!record(documentValue)) return notEvaluated('LAFEA_1_DOCUMENT_REQUIRED');
  const outsideDiameter = documentValue.pipeGeometry?.outsideDiameter?.value;
  const assessmentThickness = documentValue.thicknessBasis?.assessmentPipeThickness?.value;
  const profile = documentValue.qualificationProfile;
  if (!Number.isFinite(outsideDiameter)
    || !Number.isFinite(assessmentThickness)
    || !record(profile?.tolerances?.length)) {
    return notEvaluated('LAFEA_1_PRESSURE_RADIUS_BASIS_UNAVAILABLE');
  }

  const outerRadius = outsideDiameter / 2;
  const innerRadius = outerRadius - assessmentThickness;
  if (!(innerRadius > 0 && outerRadius > innerRadius)) {
    return notEvaluated('LAFEA_1_PIPE_RADII_INVALID');
  }

  const invalidRequestedRadii = [];
  for (const request of documentValue.resultRequests?.pressure ?? []) {
    for (let index = 0; index < (request?.requestedRadii ?? []).length; index += 1) {
      const value = request.requestedRadii[index]?.value;
      if (!Number.isFinite(value)) continue;
      const tolerance = toleranceFor(profile, 'length', value, innerRadius, outerRadius);
      if (value < innerRadius - tolerance || value > outerRadius + tolerance) {
        invalidRequestedRadii.push(Object.freeze({
          requestIdentity: request.identity ?? null,
          index,
          value,
          tolerance,
        }));
      }
    }
  }

  const unit = documentValue.units?.length ?? null;
  if (!invalidRequestedRadii.length) {
    return deepFreeze({
      schema: LAFEA1_PRESSURE_RADIUS_VALIDATION_SCHEMA,
      state: 'VALID',
      runAuthorized: true,
      reasonCodes: [],
      innerRadius,
      outerRadius,
      unit,
      invalidRequestedRadii: [],
      message: null,
      recoveryAction: null,
    });
  }

  const invalidValues = invalidRequestedRadii.map((row) => formatNumber(row.value)).join(', ');
  const unitSuffix = unit ? ` ${unit}` : '';
  const message = `Pressure evaluation radius ${invalidValues}${unitSuffix} lies outside the current pipe wall (${formatNumber(innerRadius)}–${formatNumber(outerRadius)}${unitSuffix}).`;
  const recoveryAction = 'Use Undo to restore the previous geometry, or import a coordinated source document with every requested pressure radius inside the current pipe wall.';
  return deepFreeze({
    schema: LAFEA1_PRESSURE_RADIUS_VALIDATION_SCHEMA,
    state: 'OUTSIDE_WALL',
    runAuthorized: false,
    reasonCodes: [LAFEA1_PRESSURE_RADIUS_OUTSIDE_WALL],
    innerRadius,
    outerRadius,
    unit,
    invalidRequestedRadii,
    message,
    recoveryAction,
  });
}

export function requireLafea1PressureRadiusRunAuthorized(documentValue) {
  const projection = projectLafea1PressureRadiusValidation(documentValue);
  if (projection.runAuthorized !== false) return projection;
  const error = new TypeError(`${projection.message} ${projection.recoveryAction}`);
  error.code = LAFEA1_PRESSURE_RADIUS_OUTSIDE_WALL;
  error.path = 'resultRequests.pressure.requestedRadii';
  error.validation = projection;
  throw error;
}

function notEvaluated(reason) {
  return deepFreeze({
    schema: LAFEA1_PRESSURE_RADIUS_VALIDATION_SCHEMA,
    state: 'NOT_EVALUATED',
    runAuthorized: true,
    reasonCodes: [reason],
    innerRadius: null,
    outerRadius: null,
    unit: null,
    invalidRequestedRadii: [],
    message: null,
    recoveryAction: null,
  });
}

function formatNumber(value) {
  return Number(value).toLocaleString('en-US', {
    useGrouping: false,
    maximumFractionDigits: 9,
  });
}
function record(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
