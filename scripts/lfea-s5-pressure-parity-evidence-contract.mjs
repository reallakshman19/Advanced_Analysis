#!/usr/bin/env node

const SCHEMA = 'lfea-s5-pressure-parity-evidence/v1';
const SCOPES = Object.freeze([
  'BOURDON_ONLY',
  'PRESSURE_STIFFENING_ONLY',
  'BOURDON_AND_PRESSURE_STIFFENING',
]);
const Q1_FAMILIES = Object.freeze([
  'Q1_STRAIGHT_BOURDON_NONE',
  'Q1_STRAIGHT_BOURDON_TRANSLATION',
  'Q1_STRAIGHT_BOURDON_TRANSLATION_ROTATION',
]);
const Q2_FAMILIES = Object.freeze([
  'Q2_BEND_BOURDON_NONE',
  'Q2_BEND_BOURDON_TRANSLATION',
  'Q2_BEND_BOURDON_TRANSLATION_ROTATION',
]);
const BOURDON_FAMILIES = Object.freeze([
  ...Q1_FAMILIES,
  ...Q2_FAMILIES,
  'Q6_PRESSURE_THRUST_NEGATIVE_CONTROL',
]);
const Q4_FAMILIES = Object.freeze([
  'Q4_SELECTOR_NONE',
  'Q4_SELECTOR_P1',
  'Q4_SELECTOR_P2',
  'Q4_SELECTOR_PMAX',
]);
const Q5_FAMILIES = Object.freeze([
  'Q5_GLOBAL_DEFAULT_B313',
  'Q5_GLOBAL_INCLUDE_B313',
  'Q5_GLOBAL_EXCLUDE_B313',
]);
const STIFFENING_FAMILIES = Object.freeze([...Q4_FAMILIES, ...Q5_FAMILIES]);
const HASH = /^[0-9a-f]{64}$/u;

export function validateS5PressureParityEvidence(value) {
  requireRecord(value, 'evidence');
  requireEqual(value.schema, SCHEMA, 'S5_PRESSURE_EVIDENCE_SCHEMA_INVALID');
  requireEqual(value.protocolId, 'S5_Pressure_Effect_Parity_Protocol_20260824', 'S5_PRESSURE_PROTOCOL_ID_INVALID');
  requireEqual(value.evidenceClass, 'CONTROLLED_CAESAR_OBSERVATION', 'S5_PRESSURE_EVIDENCE_CLASS_INVALID');
  if (!SCOPES.includes(value.qualificationScope)) fail('S5_PRESSURE_QUALIFICATION_SCOPE_INVALID');
  requireRecord(value.tolerancePolicy, 'tolerancePolicy');
  requirePositive(value.tolerancePolicy.observationTolerance, 'tolerancePolicy.observationTolerance');
  requireText(value.tolerancePolicy.source, 'tolerancePolicy.source');
  if (value.tolerancePolicy.fittedToCaesar !== false) fail('S5_PRESSURE_TOLERANCE_FITTING_FORBIDDEN');
  requireProductionBoundary(value);

  const runs = requireArray(value.runs, 'runs');
  const runIds = runs.map((run) => requireRun(run));
  if (new Set(runIds).size !== runIds.length) fail('S5_PRESSURE_RUN_ID_DUPLICATED');
  requireUniformVersionBuild(runs);

  const bourdonRequired = value.qualificationScope !== 'PRESSURE_STIFFENING_ONLY';
  const stiffeningRequired = value.qualificationScope !== 'BOURDON_ONLY';
  if (bourdonRequired) requireBourdonEvidence(value, runs);
  if (stiffeningRequired) requireStiffeningEvidence(value, runs);
  requireIndependentReview(value.independentReview, runs);
  if (value.status !== 'QUALIFIED') fail('S5_PRESSURE_EVIDENCE_STATUS_NOT_QUALIFIED', { status: value.status });

  return Object.freeze({
    schema: 'lfea-s5-pressure-parity-intake/v1',
    status: 'QUALIFIED_PARITY_EVIDENCE_ONLY',
    qualificationScope: value.qualificationScope,
    caesarVersion: runs[0].caesarVersion,
    build: runs[0].build,
    runCount: runs.length,
    bourdonParityQualified: bourdonRequired,
    pressureStiffeningParityQualified: stiffeningRequired,
    pressureAxialThrustQualified: false,
    productionUseAuthorized: false,
    pressureBourdonAuthorized: false,
    pressureStiffeningAuthorized: false,
    pressureAxialThrustAuthorized: false,
  });
}

export const S5_PRESSURE_PARITY_EVIDENCE_SCHEMA = SCHEMA;
export const S5_BOURDON_REQUIRED_FAMILIES = BOURDON_FAMILIES;
export const S5_STIFFENING_REQUIRED_FAMILIES = STIFFENING_FAMILIES;

function requireRun(run) {
  requireRecord(run, 'run');
  requireText(run.runId, 'run.runId');
  const allowed = new Set([...BOURDON_FAMILIES, ...STIFFENING_FAMILIES]);
  if (!allowed.has(run.family)) fail('S5_PRESSURE_RUN_FAMILY_INVALID', { family: run.family });
  requireText(run.caesarVersion, 'run.caesarVersion');
  requireText(run.build, 'run.build');
  for (const field of ['jobFileHash', 'inputSourceHash', 'outputFileHash']) requireHash(run[field], `run.${field}`);
  requireRawArtifacts(run.rawArtifacts);
  for (const field of ['activePipingCode', 'activateBourdonEffects', 'usePressureStiffeningOnBends',
    'elbowStiffeningPressureSelector', 'reportLocator', 'artifactLocator', 'observer', 'observationDate']) {
    requireText(run[field], `run.${field}`);
  }
  for (const field of ['pressureFields', 'material', 'section', 'restraints', 'mechanicalLoads',
    'reportedDisplacements', 'reportedReactions']) requireNonEmptyRecord(run[field], `run.${field}`);
  requirePressureFields(run.pressureFields, run.family);
  if (Q2_FAMILIES.includes(run.family) || Q4_FAMILIES.includes(run.family) || Q5_FAMILIES.includes(run.family)) {
    requireNonEmptyRecord(run.bendGeometry, 'run.bendGeometry');
    requireNonEmptyRecord(run.reportedRotations, 'run.reportedRotations');
  }
  if (Q4_FAMILIES.includes(run.family) || Q5_FAMILIES.includes(run.family)) {
    requireNonEmptyRecord(run.reportedBendFactors, 'run.reportedBendFactors');
    requirePositive(run.reportedBendFactors.k, 'run.reportedBendFactors.k');
    requireOptionalPositive(run.reportedBendFactors.ii, 'run.reportedBendFactors.ii');
    requireOptionalPositive(run.reportedBendFactors.io, 'run.reportedBendFactors.io');
  }
  requireFamilySettings(run);
  return run.runId;
}

function requireRawArtifacts(value) {
  requireRecord(value, 'run.rawArtifacts');
  for (const field of ['jobFile', 'inputSource', 'outputFile']) {
    requireSafeRelativePath(value[field], `run.rawArtifacts.${field}`);
  }
}

function requireSafeRelativePath(value, field) {
  requireText(value, field);
  const normalized = value.replaceAll('\\', '/');
  const segments = normalized.split('/');
  if (normalized.startsWith('/')
    || /^[A-Za-z]:\//u.test(normalized)
    || segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    fail('S5_PRESSURE_RAW_ARTIFACT_PATH_INVALID', { field, value });
  }
}

function requirePressureFields(fields, family) {
  requirePositive(fields.P1, 'run.pressureFields.P1');
  if (Q4_FAMILIES.includes(family)) {
    requirePositive(fields.P2, 'run.pressureFields.P2');
    if (fields.P1 === fields.P2) fail('S5_PRESSURE_Q4_PRESSURES_NOT_DISCRIMINATING');
  } else if (fields.P2 !== undefined) {
    requirePositive(fields.P2, 'run.pressureFields.P2');
  }
}

function requireFamilySettings(run) {
  const bourdonMode = new Map([
    ['Q1_STRAIGHT_BOURDON_NONE', 'NONE'],
    ['Q1_STRAIGHT_BOURDON_TRANSLATION', 'TRANSLATION_ONLY'],
    ['Q1_STRAIGHT_BOURDON_TRANSLATION_ROTATION', 'TRANSLATION_AND_ROTATION'],
    ['Q2_BEND_BOURDON_NONE', 'NONE'],
    ['Q2_BEND_BOURDON_TRANSLATION', 'TRANSLATION_ONLY'],
    ['Q2_BEND_BOURDON_TRANSLATION_ROTATION', 'TRANSLATION_AND_ROTATION'],
  ]);
  if (bourdonMode.has(run.family) && run.activateBourdonEffects !== bourdonMode.get(run.family)) {
    fail('S5_PRESSURE_BOURDON_MODE_MISMATCH', { family: run.family, actual: run.activateBourdonEffects });
  }
  if (run.family === 'Q6_PRESSURE_THRUST_NEGATIVE_CONTROL') {
    if (run.activateBourdonEffects !== 'TRANSLATION_ONLY') {
      fail('S5_PRESSURE_Q6_BOURDON_MODE_INVALID', { actual: run.activateBourdonEffects });
    }
    requireNonEmptyRecord(run.pressureThrustMechanics, 'run.pressureThrustMechanics');
    if (run.pressureThrustMechanics.genericPressureThrustApplied !== false
      || run.pressureThrustMechanics.effectiveAreaForceApplied !== false) {
      fail('S5_PRESSURE_Q6_THRUST_EXCLUSION_FAILED');
    }
  }

  const selector = new Map([
    ['Q4_SELECTOR_NONE', 'NONE'],
    ['Q4_SELECTOR_P1', 'P1'],
    ['Q4_SELECTOR_P2', 'P2'],
    ['Q4_SELECTOR_PMAX', 'PMAX'],
  ]);
  if (selector.has(run.family)) {
    if (run.activateBourdonEffects !== 'NONE') fail('S5_PRESSURE_Q4_BOURDON_MUST_BE_NONE', { family: run.family });
    if (run.elbowStiffeningPressureSelector !== selector.get(run.family)) {
      fail('S5_PRESSURE_SELECTOR_MISMATCH', { family: run.family, actual: run.elbowStiffeningPressureSelector });
    }
  }

  const globalMode = new Map([
    ['Q5_GLOBAL_DEFAULT_B313', 'DEFAULT'],
    ['Q5_GLOBAL_INCLUDE_B313', 'INCLUDE'],
    ['Q5_GLOBAL_EXCLUDE_B313', 'EXCLUDE'],
  ]);
  if (globalMode.has(run.family)) {
    if (run.activateBourdonEffects !== 'NONE') fail('S5_PRESSURE_Q5_BOURDON_MUST_BE_NONE', { family: run.family });
    if (run.activePipingCode !== 'B31.3_2022') fail('S5_PRESSURE_Q5_ACTIVE_CODE_INVALID', { family: run.family });
    if (run.elbowStiffeningPressureSelector !== 'P1') {
      fail('S5_PRESSURE_Q5_SELECTOR_MUST_BE_P1', {
        family: run.family,
        actual: run.elbowStiffeningPressureSelector,
      });
    }
    if (run.usePressureStiffeningOnBends !== globalMode.get(run.family)) {
      fail('S5_PRESSURE_GLOBAL_MODE_MISMATCH', { family: run.family, actual: run.usePressureStiffeningOnBends });
    }
  }
}

function requireBourdonEvidence(value, runs) {
  requireExactCoverage(runs, BOURDON_FAMILIES);
  requireControlGroup(runs, Q1_FAMILIES, [
    'pressureFields', 'material', 'section', 'restraints', 'mechanicalLoads',
    'activePipingCode', 'usePressureStiffeningOnBends', 'elbowStiffeningPressureSelector',
  ], 'S5_PRESSURE_Q1_CONTROL_STATE_MISMATCH');
  requireControlGroup(runs, Q2_FAMILIES, [
    'pressureFields', 'material', 'section', 'bendGeometry', 'restraints', 'mechanicalLoads',
    'activePipingCode', 'usePressureStiffeningOnBends', 'elbowStiffeningPressureSelector',
  ], 'S5_PRESSURE_Q2_CONTROL_STATE_MISMATCH');

  requireRecord(value.bourdonComparisons, 'bourdonComparisons');
  const tolerance = value.tolerancePolicy.observationTolerance;
  requireWithin(value.bourdonComparisons.straightTranslationVsTranslationRotationError, tolerance,
    'S5_PRESSURE_Q1_TRANSLATION_MODE_PARITY_FAILED');
  requireWithin(value.bourdonComparisons.straightLfeaClosedEndStrainError, tolerance,
    'S5_PRESSURE_Q1_LFEA_PARITY_FAILED');
  requireWithin(value.bourdonComparisons.bendTranslationOnlyError, tolerance,
    'S5_PRESSURE_Q2_TRANSLATION_PARITY_FAILED');
  requireWithin(value.bourdonComparisons.bendTranslationRotationError, tolerance,
    'S5_PRESSURE_Q2_ROTATION_PARITY_FAILED');
  if (value.bourdonComparisons.pressureThrustForceAdded !== false) fail('S5_PRESSURE_Q6_THRUST_EXCLUSION_FAILED');
  requireRecord(value.subdivisionEvidence, 'subdivisionEvidence');
  const chordCounts = value.subdivisionEvidence.chordCounts;
  if (!Array.isArray(chordCounts) || chordCounts.join(',') !== '4,6,8') fail('S5_PRESSURE_Q3_CHORD_COUNTS_INVALID');
  if (value.subdivisionEvidence.samePhysicalInitialBasis !== true) fail('S5_PRESSURE_Q3_INITIAL_BASIS_INVALID');
  requireWithin(value.subdivisionEvidence.terminalFreeStateNormalizedDelta, tolerance,
    'S5_PRESSURE_Q3_SUBDIVISION_INVARIANCE_FAILED');
}

function requireStiffeningEvidence(value, runs) {
  requireExactCoverage(runs, STIFFENING_FAMILIES);
  requireControlGroup(runs, Q4_FAMILIES, [
    'pressureFields', 'material', 'section', 'bendGeometry', 'restraints', 'mechanicalLoads',
    'activePipingCode', 'activateBourdonEffects', 'usePressureStiffeningOnBends',
  ], 'S5_PRESSURE_Q4_CONTROL_STATE_MISMATCH');
  requireControlGroup(runs, Q5_FAMILIES, [
    'pressureFields', 'material', 'section', 'bendGeometry', 'restraints', 'mechanicalLoads',
    'activePipingCode', 'activateBourdonEffects', 'elbowStiffeningPressureSelector',
  ], 'S5_PRESSURE_Q5_CONTROL_STATE_MISMATCH');

  requireRecord(value.stiffeningComparisons, 'stiffeningComparisons');
  const tolerance = value.tolerancePolicy.observationTolerance;
  requireWithin(value.stiffeningComparisons.p1SelectedPressureError, tolerance, 'S5_PRESSURE_Q4_P1_PARITY_FAILED');
  requireWithin(value.stiffeningComparisons.p2SelectedPressureError, tolerance, 'S5_PRESSURE_Q4_P2_PARITY_FAILED');
  requireWithin(value.stiffeningComparisons.pmaxSelectedPressureError, tolerance, 'S5_PRESSURE_Q4_PMAX_PARITY_FAILED');
  if (value.stiffeningComparisons.p1P2ResponseDistinct !== true) fail('S5_PRESSURE_Q4_SELECTOR_DISCRIMINATION_FAILED');
  if (value.stiffeningComparisons.factorAppliedExactlyOnce !== true) fail('S5_PRESSURE_Q4_FACTOR_OWNERSHIP_FAILED');
  if (value.stiffeningComparisons.curvedCenterlineRetained !== true) fail('S5_PRESSURE_Q4_CURVED_GEOMETRY_REQUIRED');
  if (value.stiffeningComparisons.defaultMatchesActiveCodeMethod !== true
    || value.stiffeningComparisons.includeOverrideObserved !== true
    || value.stiffeningComparisons.excludeOverrideObserved !== true) {
    fail('S5_PRESSURE_Q5_GLOBAL_ARBITRATION_FAILED');
  }
}

function requireControlGroup(runs, families, fields, code) {
  const rows = families.map((family) => runs.find((run) => run.family === family));
  const baseline = rows[0];
  for (const row of rows.slice(1)) {
    for (const field of fields) {
      if (canonicalValue(row[field]) !== canonicalValue(baseline[field])) {
        fail(code, { field, baselineFamily: baseline.family, comparedFamily: row.family });
      }
    }
  }
}

function canonicalValue(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalValue(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function requireExactCoverage(runs, families) {
  for (const family of families) {
    const count = runs.filter((run) => run.family === family).length;
    if (count !== 1) fail('S5_PRESSURE_REQUIRED_CASE_MISSING_OR_DUPLICATED', { family, count });
  }
}

function requireUniformVersionBuild(runs) {
  const identities = new Set(runs.map((run) => `${run.caesarVersion}::${run.build}`));
  if (identities.size !== 1) fail('S5_PRESSURE_MIXED_CAESAR_VERSION_BUILD');
}

function requireProductionBoundary(value) {
  const fields = [
    'productionAuthorizationRequested', 'pressureBourdonRequested',
    'pressureStiffeningRequested', 'pressureAxialThrustRequested',
  ];
  for (const field of fields) {
    if (value[field] !== false) fail('S5_PRESSURE_EVIDENCE_CANNOT_AUTHORIZE_PRODUCTION', { field });
  }
  if (value.expectedValuesRebaselined !== false || value.tolerancesWidenedToFitCaesar !== false) {
    fail('S5_PRESSURE_ACCEPTANCE_GAMING_FORBIDDEN');
  }
}

function requireIndependentReview(value, runs) {
  requireRecord(value, 'independentReview');
  requireEqual(value.status, 'APPROVED', 'S5_PRESSURE_INDEPENDENT_REVIEW_REQUIRED');
  requireText(value.reviewer, 'independentReview.reviewer');
  requireText(value.reviewDate, 'independentReview.reviewDate');
  requireText(value.reviewLocator, 'independentReview.reviewLocator');
  const observers = new Set(runs.map((run) => run.observer));
  if (observers.has(value.reviewer)) fail('S5_PRESSURE_REVIEWER_NOT_INDEPENDENT', { reviewer: value.reviewer });
}

function requireWithin(value, tolerance, code) { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > tolerance) fail(code, { value, tolerance }); }
function requireHash(value, field) { if (!HASH.test(String(value ?? ''))) fail('S5_PRESSURE_HASH_INVALID', { field }); }
function requireRecord(value, field) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail('S5_PRESSURE_RECORD_REQUIRED', { field }); }
function requireNonEmptyRecord(value, field) { requireRecord(value, field); if (Object.keys(value).length === 0) fail('S5_PRESSURE_RECORD_EMPTY', { field }); }
function requireArray(value, field) { if (!Array.isArray(value) || value.length === 0) fail('S5_PRESSURE_ARRAY_REQUIRED', { field }); return value; }
function requireText(value, field) { if (typeof value !== 'string' || value.trim() === '') fail('S5_PRESSURE_TEXT_REQUIRED', { field }); }
function requirePositive(value, field) { if (typeof value !== 'number' || !Number.isFinite(value) || !(value > 0)) fail('S5_PRESSURE_POSITIVE_NUMBER_REQUIRED', { field }); }
function requireOptionalPositive(value, field) { if (value !== undefined) requirePositive(value, field); }
function requireEqual(actual, expected, code) { if (actual !== expected) fail(code, { actual, expected }); }
function fail(code, evidence) { const error = new Error(code); error.code = code; error.evidence = evidence ?? null; throw error; }
