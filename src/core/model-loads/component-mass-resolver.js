import { deepFreeze } from '../shared-piping-model/index.js';
import { AUDIT_CODES, NEGLIGIBLE_MASS_TYPES } from './constants.js';
import { classifyLoadComponent } from './composition-profile.js';
import {
  fluidMassPerLength,
  insulationMassPerLength,
  pipeMetalMassPerLength,
} from './formulas.js';
import { evidenceNumber } from './units.js';

export function resolveComponentCaseMass(component, loadCaseId, compositionProfile, options = {}) {
  const projectionBlocker = blockingProjectionCode(component.diagnostics);
  if (projectionBlocker) return blocked(projectionBlocker);
  // An approved zero-mass waiver is the engineer's answer for this component,
  // so it resolves exactly as a gasket does: zero self-weight, and no
  // application point demanded for a mass that is zero. Without this the
  // waiver satisfies the coverage checker and then blocks here with
  // MISSING_COMPONENT_MASS, which is the same evidence answered in one place
  // and unanswered in another.
  if (options.zeroMassWaived === true) {
    return resolveNegligibleMass(component, AUDIT_CODES.EXCLUDED_ZERO_MASS_WAIVER);
  }
  if (NEGLIGIBLE_MASS_TYPES.includes(String(component.type || '').trim().toUpperCase())) {
    return resolveNegligibleMass(component);
  }
  const classification = classifyLoadComponent(component.type, compositionProfile);
  if (classification === 'LINEAR') return resolveLinear(component, loadCaseId);
  if (classification === 'LUMPED') return resolveLumped(component);
  return resolveUnknown(component);
}

/**
 * Gasket-type components default to zero self-weight rather than blocking on
 * missing evidence. Explicit source evidence, if present, still wins and is
 * never overridden, and a non-zero mass still requires its application point
 * so it is placed correctly rather than silently dropped.
 */
function resolveNegligibleMass(component, exclusionCode = AUDIT_CODES.EXCLUDED_NEGLIGIBLE_MASS) {
  const evidence = component.engineeringProperties;
  const pointMass = evidenceNumber(evidence.componentWeightKg);
  if (isNegative(pointMass)) return blocked(AUDIT_CODES.INVALID_NEGATIVE_VALUE);
  const massKg = pointMass ?? 0;
  if (massKg > 0 && !component.geometry.applicationPoint) return blocked(AUDIT_CODES.MISSING_COMPONENT_COG);
  return deepFreeze({
    ok: true,
    mode: 'POINT',
    pointMassKg: massKg,
    applicationPoint: component.geometry.applicationPoint || null,
    sourceEvidence: evidence.componentWeightKg || null,
    diagnostics: [diagnostic(exclusionCode)],
  });
}

function resolveLinear(component, loadCaseId) {
  if (!validLinearGeometry(component)) return blocked(AUDIT_CODES.MISSING_GEOMETRY);
  const evidence = component.engineeringProperties;
  const directPointMass = evidenceNumber(evidence.componentWeightKg);
  const directLinear = evidenceNumber(evidence.unitPipeWeightKgPerM);
  if (isNegative(directPointMass) || isNegative(directLinear)) return blocked(AUDIT_CODES.INVALID_NEGATIVE_VALUE);
  if ((directPointMass ?? 0) > 0 && hasLinearMassEvidence(evidence)) return blocked(AUDIT_CODES.DOUBLE_COUNT_CONFLICT);
  if ((directPointMass ?? 0) > 0) return blocked(AUDIT_CODES.DOUBLE_COUNT_CONFLICT);
  const metal = resolveMetal(component, directLinear);
  const insulation = resolveInsulation(component);
  const fluid = resolveFluid(component, loadCaseId);
  const blockers = [metal, insulation, fluid].filter((row) => !row.ok).map((row) => row.code);
  if (blockers.length) return blocked(blockers);
  const sources = [metal, insulation, fluid].filter((row) => row.include);
  return deepFreeze({
    ok: true,
    mode: 'DISTRIBUTED',
    massPerLengthKgM: sources.reduce((sum, row) => sum + row.massPerLengthKgM, 0),
    massSourceBreakdown: sources.map(sourceBreakdown),
    formulaTrace: sources.flatMap((row) => row.trace ? [row.trace] : []),
    diagnostics: [],
  });
}

function resolveLumped(component) {
  const evidence = component.engineeringProperties;
  const pointMass = evidenceNumber(evidence.componentWeightKg);
  const directLinear = evidenceNumber(evidence.unitPipeWeightKgPerM);
  if (isNegative(pointMass) || isNegative(directLinear)) return blocked(AUDIT_CODES.INVALID_NEGATIVE_VALUE);
  if (directLinear !== null && directLinear !== 0) {
    return blocked(pointMass !== null
      ? AUDIT_CODES.DOUBLE_COUNT_CONFLICT
      : AUDIT_CODES.LUMPED_LINEAR_MASS_CONFLICT);
  }
  if (pointMass === null) return blocked(AUDIT_CODES.MISSING_COMPONENT_MASS);
  if (!component.geometry.applicationPoint) return blocked(AUDIT_CODES.MISSING_COMPONENT_COG);
  return deepFreeze({
    ok: true,
    mode: 'POINT',
    pointMassKg: pointMass,
    applicationPoint: component.geometry.applicationPoint,
    sourceEvidence: evidence.componentWeightKg,
    diagnostics: [],
  });
}

function resolveUnknown(component) {
  const evidence = component.engineeringProperties;
  const pointMass = evidenceNumber(evidence.componentWeightKg);
  const directLinear = evidenceNumber(evidence.unitPipeWeightKgPerM);
  if (isNegative(pointMass) || isNegative(directLinear)) return blocked(AUDIT_CODES.INVALID_NEGATIVE_VALUE);
  if (pointMass !== null && directLinear !== null && directLinear !== 0) return blocked(AUDIT_CODES.DOUBLE_COUNT_CONFLICT);
  if (pointMass !== null) {
    if (!component.geometry.applicationPoint) return blocked(AUDIT_CODES.MISSING_COMPONENT_COG);
    return deepFreeze({ ok: true, mode: 'POINT', pointMassKg: pointMass, applicationPoint: component.geometry.applicationPoint,
      sourceEvidence: evidence.componentWeightKg, diagnostics: [diagnostic(AUDIT_CODES.UNSUPPORTED_COMPONENT_TYPE)] });
  }
  if (directLinear !== null) return validLinearGeometry(component)
    ? explicitLinear(directLinear, evidence.unitPipeWeightKgPerM)
    : blocked(AUDIT_CODES.MISSING_GEOMETRY);
  return blocked(AUDIT_CODES.UNSUPPORTED_COMPONENT_TYPE);
}

function resolveMetal(component, directMass) {
  const evidence = component.engineeringProperties;
  if (directMass !== null) return sourceMass('PIPE_METAL', directMass, evidence.unitPipeWeightKgPerM);
  const odMm = evidenceNumber(evidence.outerDiameterMm);
  const wallMm = evidenceNumber(evidence.wallThicknessMm);
  const density = evidenceNumber(evidence.materialDensityKgM3);
  if ([odMm, wallMm, density].some(isNegative)) return blocked(AUDIT_CODES.INVALID_NEGATIVE_VALUE);
  if (odMm === null || wallMm === null || density === null) return blocked(AUDIT_CODES.MISSING_PIPE_MASS_INPUT);
  if (!(odMm > 0) || !(wallMm > 0) || wallMm >= odMm / 2) return blocked(AUDIT_CODES.INVALID_SECTION_DIMENSIONS);
  const result = pipeMetalMassPerLength(odMm / 1000, wallMm / 1000, density, [
    evidence.outerDiameterMm, evidence.wallThicknessMm, evidence.materialDensityKgM3,
  ]);
  return derivedMass('PIPE_METAL', result);
}

function resolveInsulation(component) {
  const evidence = component.engineeringProperties;
  const direct = evidenceNumber(evidence.insulationWeightKgPerM);
  const thicknessMm = evidenceNumber(evidence.insulationThicknessMm);
  const density = evidenceNumber(evidence.insulationDensityKgM3);
  const odMm = evidenceNumber(evidence.outerDiameterMm);
  if ([direct, thicknessMm, density, odMm].some(isNegative)) return blocked(AUDIT_CODES.INVALID_NEGATIVE_VALUE);
  if (direct !== null) return sourceMass('INSULATION', direct, evidence.insulationWeightKgPerM);
  if (thicknessMm === 0) return sourceMass('INSULATION', 0, evidence.insulationThicknessMm);
  if (thicknessMm === null || density === null || odMm === null) return blocked(AUDIT_CODES.MISSING_INSULATION_INPUT);
  const result = insulationMassPerLength(odMm / 1000, thicknessMm / 1000, density, [
    evidence.outerDiameterMm, evidence.insulationThicknessMm, evidence.insulationDensityKgM3,
  ]);
  return derivedMass('INSULATION', result);
}

function resolveFluid(component, loadCaseId) {
  if (loadCaseId === 'EMPTY') return deepFreeze({ ok: true, include: false });
  const evidence = component.engineeringProperties;
  const directField = loadCaseId === 'OPE' ? 'fluidWeightOpeKgPerM' : 'fluidWeightHydKgPerM';
  const densityField = loadCaseId === 'OPE' ? 'fluidDensityOpeKgM3' : 'fluidDensityHydKgM3';
  const direct = evidenceNumber(evidence[directField]);
  const density = evidenceNumber(evidence[densityField]);
  if (isNegative(direct) || isNegative(density)) return blocked(AUDIT_CODES.INVALID_NEGATIVE_VALUE);
  if (direct !== null) return sourceMass(`${loadCaseId}_FLUID`, direct, evidence[directField]);
  if (density === null) return blocked(loadCaseId === 'OPE' ? AUDIT_CODES.MISSING_OPE_FLUID_INPUT : AUDIT_CODES.MISSING_HYD_FLUID_INPUT);
  const odMm = evidenceNumber(evidence.outerDiameterMm);
  const wallMm = evidenceNumber(evidence.wallThicknessMm);
  if (!(odMm > 0) || !(wallMm >= 0) || wallMm >= odMm / 2) return blocked(AUDIT_CODES.INVALID_SECTION_DIMENSIONS);
  const result = fluidMassPerLength((odMm - (2 * wallMm)) / 1000, density, [
    evidence.outerDiameterMm, evidence.wallThicknessMm, evidence[densityField],
  ]);
  return derivedMass(`${loadCaseId}_FLUID`, result);
}

function blockingProjectionCode(diagnostics = []) {
  return diagnostics.find((row) => [
    AUDIT_CODES.UNIT_BLOCKED,
    AUDIT_CODES.GEOMETRY_LENGTH_CONFLICT,
  ].includes(row.code))?.code || null;
}
function explicitLinear(value, evidence) {
  return deepFreeze({ ok: true, mode: 'DISTRIBUTED', massPerLengthKgM: value,
    massSourceBreakdown: [{ sourceId: 'EXPLICIT_LINEAR_MASS', massPerLengthKgM: value, sourceEvidence: evidence }],
    formulaTrace: [], diagnostics: [diagnostic(AUDIT_CODES.UNSUPPORTED_COMPONENT_TYPE)] });
}
function sourceMass(sourceId, value, sourceEvidence) { return deepFreeze({ ok: true, include: true, sourceId, massPerLengthKgM: value, sourceEvidence, trace: null }); }
function derivedMass(sourceId, result) { return deepFreeze({ ok: true, include: true, sourceId, massPerLengthKgM: result.value, sourceEvidence: null, trace: result.trace }); }
function sourceBreakdown(row) { return { sourceId: row.sourceId, massPerLengthKgM: row.massPerLengthKgM, sourceEvidence: row.sourceEvidence || null }; }
function blocked(code) { const blockers = Array.isArray(code) ? code : [code]; return deepFreeze({ ok: false, blockers, code: blockers[0], diagnostics: blockers.map(diagnostic) }); }
function diagnostic(code) { return deepFreeze({ code, severity: 'WARNING' }); }
function isNegative(value) { return value !== null && value < 0; }
function validLinearGeometry(component) {
  return Boolean(component.geometry?.start && component.geometry?.end && component.geometry?.sourceLengthM > 0);
}
function hasLinearMassEvidence(evidence) { return ['unitPipeWeightKgPerM', 'outerDiameterMm', 'wallThicknessMm', 'materialDensityKgM3'].some((key) => evidence[key]); }
