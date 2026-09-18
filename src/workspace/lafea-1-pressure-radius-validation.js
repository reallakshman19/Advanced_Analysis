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
  const assessmentThickness = resolveAssessmentThickness(documentValue.thicknessBasis);
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
  const recoveryAction = `Edit the pressure evaluation radii under Loads to lie within ${formatNumber(innerRadius)}–${formatNumber(outerRadius)}${unitSuffix}, or use "Set radii to current wall" to place them on the bore and outer surface. Undo restores the previous geometry if the earlier basis was intended.`;
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

export const LAFEA1_PRESSURE_RADIUS_REFIT_SCHEMA =
  'lafea1-pressure-radius-refit/v1';

/**
 * Governed edits that place the two declared evaluation radii on the current
 * bore and outer surface.
 *
 * This is the same convention a retained LAFEA.1 source is generated with, so
 * the recovery restates the source's own basis rather than inventing a mapping.
 * It is offered, never applied automatically: the radii are declared engineering
 * intent, and the edits travel through the ordinary descriptor seam so custody
 * and downstream invalidation behave exactly as a hand edit would.
 *
 * Radii beyond the declared editable pair are reported as unaddressed rather
 * than silently left broken.
 */
export function projectLafea1PressureRadiusRefit(documentValue) {
  const validation = projectLafea1PressureRadiusValidation(documentValue);
  if (validation.state !== 'OUTSIDE_WALL') {
    return deepFreeze({
      schema: LAFEA1_PRESSURE_RADIUS_REFIT_SCHEMA,
      state: 'NOT_REQUIRED',
      edits: [],
      unaddressed: [],
      innerRadius: validation.innerRadius,
      outerRadius: validation.outerRadius,
      unit: validation.unit,
    });
  }
  const { innerRadius, outerRadius, unit } = validation;
  const targets = [innerRadius, outerRadius];
  const edits = [];
  const unaddressed = [];
  // A retained request keeps its radii sorted ascending, and the sort is
  // reapplied after every single edit, so a positional edit can land on the
  // neighbouring row. The targets are ascending, so assigning the highest index
  // first keeps each intermediate state already sorted and every edit lands
  // where it was aimed.
  const rows = [...validation.invalidRequestedRadii].sort((left, right) => right.index - left.index);
  for (const row of rows) {
    if (row.index >= targets.length || typeof row.requestIdentity !== 'string') {
      unaddressed.push(row);
      continue;
    }
    edits.push(Object.freeze({
      descriptorId: `LAFEA.1.pressure.requestedRadius.${row.index + 1}`,
      entityId: row.requestIdentity,
      rawText: formatNumber(targets[row.index]),
    }));
  }
  return deepFreeze({
    schema: LAFEA1_PRESSURE_RADIUS_REFIT_SCHEMA,
    state: edits.length ? 'AVAILABLE' : 'UNAVAILABLE',
    edits,
    unaddressed,
    innerRadius,
    outerRadius,
    unit,
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

/**
 * Assessment wall thickness for this preflight.
 *
 * thicknessBasis.assessmentPipeThickness is a derived value, and the editable
 * stage projection deliberately strips it whenever the policy recomputes it
 * from nominal and corrosion. Reading that field alone therefore leaves the
 * preflight unevaluated precisely after a geometry edit — the moment it exists
 * to guard. Fall back to the document's own declared policy, matching the
 * canonical model's NOMINAL_MINUS_CORROSION derivation rather than inventing a
 * second thickness rule.
 */
function resolveAssessmentThickness(thicknessBasis) {
  const supplied = thicknessBasis?.assessmentPipeThickness?.value;
  if (Number.isFinite(supplied)) return supplied;
  if (thicknessBasis?.policy !== 'NOMINAL_MINUS_CORROSION') return null;
  const nominal = thicknessBasis?.nominalPipeThickness?.value;
  const corrosion = thicknessBasis?.corrosionAllowance?.value ?? 0;
  if (!Number.isFinite(nominal) || !Number.isFinite(corrosion)) return null;
  const derived = nominal - corrosion;
  return derived > 0 ? derived : null;
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
