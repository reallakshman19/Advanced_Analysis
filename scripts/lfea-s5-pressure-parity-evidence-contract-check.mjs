#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  S5_BOURDON_REQUIRED_FAMILIES,
  S5_PRESSURE_PARITY_EVIDENCE_SCHEMA,
  S5_STIFFENING_REQUIRED_FAMILIES,
  validateS5PressureParityEvidence,
} from './lfea-s5-pressure-parity-evidence-contract.mjs';

function settingsFor(family) {
  const bourdon = {
    Q1_STRAIGHT_BOURDON_NONE: 'NONE',
    Q1_STRAIGHT_BOURDON_TRANSLATION: 'TRANSLATION_ONLY',
    Q1_STRAIGHT_BOURDON_TRANSLATION_ROTATION: 'TRANSLATION_AND_ROTATION',
    Q2_BEND_BOURDON_NONE: 'NONE',
    Q2_BEND_BOURDON_TRANSLATION: 'TRANSLATION_ONLY',
    Q2_BEND_BOURDON_TRANSLATION_ROTATION: 'TRANSLATION_AND_ROTATION',
    Q6_PRESSURE_THRUST_NEGATIVE_CONTROL: 'TRANSLATION_ONLY',
  };
  const selector = {
    Q4_SELECTOR_NONE: 'NONE',
    Q4_SELECTOR_P1: 'P1',
    Q4_SELECTOR_P2: 'P2',
    Q4_SELECTOR_PMAX: 'PMAX',
    Q5_GLOBAL_DEFAULT_B313: 'P1',
    Q5_GLOBAL_INCLUDE_B313: 'P1',
    Q5_GLOBAL_EXCLUDE_B313: 'P1',
  };
  const globalMode = {
    Q5_GLOBAL_DEFAULT_B313: 'DEFAULT',
    Q5_GLOBAL_INCLUDE_B313: 'INCLUDE',
    Q5_GLOBAL_EXCLUDE_B313: 'EXCLUDE',
  };
  return {
    activateBourdonEffects: bourdon[family] ?? 'NONE',
    elbowStiffeningPressureSelector: selector[family] ?? 'NONE',
    usePressureStiffeningOnBends: globalMode[family] ?? 'DEFAULT',
  };
}

function runRecord(family, index) {
  const token = (index + 1).toString(16).padStart(2, '0');
  const hash = token.repeat(32);
  const settings = settingsFor(family);
  const record = {
    runId: family,
    family,
    caesarVersion: '14.x-CONTRACT-FIXTURE',
    build: 'CONTRACT-FIXTURE',
    jobFileHash: hash,
    inputSourceHash: hash,
    outputFileHash: hash,
    rawArtifacts: {
      jobFile: `raw/${family}/job.caesar`,
      inputSource: `raw/${family}/input.accdb`,
      outputFile: `raw/${family}/output.out`,
    },
    activePipingCode: 'B31.3_2022',
    ...settings,
    pressureFields: family.startsWith('Q4_') ? { P1: 2.0e6, P2: 4.0e6 } : { P1: 2.0e6 },
    material: { id: 'STEEL-CONTROLLED', elasticModulus: 2.0e11 },
    section: { id: 'PIPE-CONTROLLED', outerDiameter: 0.1683, wallThickness: 0.00711 },
    restraints: { id: 'CONTROLLED-RESTRAINTS' },
    mechanicalLoads: { id: family.startsWith('Q4_') || family.startsWith('Q5_') ? 'END-MOMENT' : 'NONE' },
    reportedDisplacements: { ux: (index + 1) * 1e-6 },
    reportedReactions: { fx: index + 1 },
    reportLocator: `CAESAR_REPORT:${family}`,
    artifactLocator: `external://caesar/s5/${family}`,
    observer: 'CAESAR_OPERATOR_A',
    observationDate: '2026-08-24',
  };
  if (family.startsWith('Q2_') || family.startsWith('Q4_') || family.startsWith('Q5_')) {
    record.bendGeometry = { radius: 0.4572, angleDegrees: 90 };
    record.reportedRotations = { rz: (index + 1) * 1e-7 };
  }
  if (family.startsWith('Q4_') || family.startsWith('Q5_')) {
    record.reportedBendFactors = { k: 1 + index * 0.01, ii: 1.2, io: 1.1 };
  }
  if (family === 'Q6_PRESSURE_THRUST_NEGATIVE_CONTROL') {
    record.pressureThrustMechanics = {
      genericPressureThrustApplied: false,
      effectiveAreaForceApplied: false,
    };
  }
  return record;
}

function evidence(scope) {
  const families = scope === 'BOURDON_ONLY'
    ? [...S5_BOURDON_REQUIRED_FAMILIES]
    : scope === 'PRESSURE_STIFFENING_ONLY'
      ? [...S5_STIFFENING_REQUIRED_FAMILIES]
      : [...S5_BOURDON_REQUIRED_FAMILIES, ...S5_STIFFENING_REQUIRED_FAMILIES];
  return {
    schema: S5_PRESSURE_PARITY_EVIDENCE_SCHEMA,
    protocolId: 'S5_Pressure_Effect_Parity_Protocol_20260824',
    evidenceClass: 'CONTROLLED_CAESAR_OBSERVATION',
    qualificationScope: scope,
    status: 'QUALIFIED',
    tolerancePolicy: {
      observationTolerance: 1e-6,
      source: 'CONTRACT_FIXTURE_PREDECLARED_NOT_CAESAR_FITTED',
      fittedToCaesar: false,
    },
    productionAuthorizationRequested: false,
    pressureBourdonRequested: false,
    pressureStiffeningRequested: false,
    pressureAxialThrustRequested: false,
    expectedValuesRebaselined: false,
    tolerancesWidenedToFitCaesar: false,
    runs: families.map(runRecord),
    bourdonComparisons: {
      straightTranslationVsTranslationRotationError: 1e-7,
      straightLfeaClosedEndStrainError: 2e-7,
      bendTranslationOnlyError: 3e-7,
      bendTranslationRotationError: 4e-7,
      pressureThrustForceAdded: false,
    },
    subdivisionEvidence: {
      chordCounts: [4, 6, 8],
      samePhysicalInitialBasis: true,
      terminalFreeStateNormalizedDelta: 2e-7,
    },
    stiffeningComparisons: {
      p1SelectedPressureError: 1e-7,
      p2SelectedPressureError: 2e-7,
      pmaxSelectedPressureError: 3e-7,
      p1P2ResponseDistinct: true,
      factorAppliedExactlyOnce: true,
      curvedCenterlineRetained: true,
      defaultMatchesActiveCodeMethod: true,
      includeOverrideObserved: true,
      excludeOverrideObserved: true,
    },
    independentReview: {
      status: 'APPROVED',
      reviewer: 'INDEPENDENT_REVIEWER_B',
      reviewDate: '2026-08-24',
      reviewLocator: 'CONTRACT_FIXTURE_REVIEW',
    },
  };
}

function expectCode(scope, mutator, expectedCode) {
  const record = structuredClone(evidence(scope));
  mutator(record);
  assert.throws(
    () => validateS5PressureParityEvidence(record),
    (error) => error?.code === expectedCode,
    expectedCode,
  );
}

const both = validateS5PressureParityEvidence(evidence('BOURDON_AND_PRESSURE_STIFFENING'));
assert.equal(both.status, 'QUALIFIED_PARITY_EVIDENCE_ONLY');
assert.equal(both.runCount, 14);
assert.equal(both.bourdonParityQualified, true);
assert.equal(both.pressureStiffeningParityQualified, true);
assert.equal(both.pressureAxialThrustQualified, false);
assert.equal(both.productionUseAuthorized, false);
assert.equal(both.pressureBourdonAuthorized, false);
assert.equal(both.pressureStiffeningAuthorized, false);

const bourdon = validateS5PressureParityEvidence(evidence('BOURDON_ONLY'));
assert.equal(bourdon.runCount, 7);
assert.equal(bourdon.bourdonParityQualified, true);
assert.equal(bourdon.pressureStiffeningParityQualified, false);

const stiffening = validateS5PressureParityEvidence(evidence('PRESSURE_STIFFENING_ONLY'));
assert.equal(stiffening.runCount, 7);
assert.equal(stiffening.bourdonParityQualified, false);
assert.equal(stiffening.pressureStiffeningParityQualified, true);

expectCode(
  'BOURDON_ONLY',
  (record) => record.runs.splice(record.runs.findIndex((run) => run.family === 'Q2_BEND_BOURDON_TRANSLATION'), 1),
  'S5_PRESSURE_REQUIRED_CASE_MISSING_OR_DUPLICATED',
);
expectCode(
  'BOURDON_ONLY',
  (record) => { record.runs[0].rawArtifacts.outputFile = '../../outside.out'; },
  'S5_PRESSURE_RAW_ARTIFACT_PATH_INVALID',
);
expectCode(
  'BOURDON_ONLY',
  (record) => { record.runs.find((run) => run.family === 'Q1_STRAIGHT_BOURDON_TRANSLATION').material.id = 'OTHER-MATERIAL'; },
  'S5_PRESSURE_Q1_CONTROL_STATE_MISMATCH',
);
expectCode(
  'BOURDON_ONLY',
  (record) => { record.bourdonComparisons.straightLfeaClosedEndStrainError = 2e-6; },
  'S5_PRESSURE_Q1_LFEA_PARITY_FAILED',
);
expectCode(
  'BOURDON_ONLY',
  (record) => { record.subdivisionEvidence.samePhysicalInitialBasis = false; },
  'S5_PRESSURE_Q3_INITIAL_BASIS_INVALID',
);
expectCode(
  'BOURDON_ONLY',
  (record) => { record.runs.find((run) => run.family === 'Q6_PRESSURE_THRUST_NEGATIVE_CONTROL').pressureThrustMechanics.effectiveAreaForceApplied = true; },
  'S5_PRESSURE_Q6_THRUST_EXCLUSION_FAILED',
);
expectCode(
  'PRESSURE_STIFFENING_ONLY',
  (record) => { record.runs.find((run) => run.family === 'Q4_SELECTOR_P1').elbowStiffeningPressureSelector = 'P2'; },
  'S5_PRESSURE_SELECTOR_MISMATCH',
);
expectCode(
  'PRESSURE_STIFFENING_ONLY',
  (record) => { record.runs.find((run) => run.family === 'Q4_SELECTOR_P2').section.outerDiameter = 0.2; },
  'S5_PRESSURE_Q4_CONTROL_STATE_MISMATCH',
);
expectCode(
  'PRESSURE_STIFFENING_ONLY',
  (record) => { record.runs.find((run) => run.family === 'Q4_SELECTOR_P2').pressureFields.P2 = 2.0e6; },
  'S5_PRESSURE_Q4_PRESSURES_NOT_DISCRIMINATING',
);
expectCode(
  'PRESSURE_STIFFENING_ONLY',
  (record) => { record.stiffeningComparisons.p1P2ResponseDistinct = false; },
  'S5_PRESSURE_Q4_SELECTOR_DISCRIMINATION_FAILED',
);
expectCode(
  'PRESSURE_STIFFENING_ONLY',
  (record) => { record.stiffeningComparisons.factorAppliedExactlyOnce = false; },
  'S5_PRESSURE_Q4_FACTOR_OWNERSHIP_FAILED',
);
expectCode(
  'PRESSURE_STIFFENING_ONLY',
  (record) => { record.runs.find((run) => run.family === 'Q5_GLOBAL_DEFAULT_B313').elbowStiffeningPressureSelector = 'NONE'; },
  'S5_PRESSURE_Q5_SELECTOR_MUST_BE_P1',
);
expectCode(
  'PRESSURE_STIFFENING_ONLY',
  (record) => { record.runs.find((run) => run.family === 'Q5_GLOBAL_INCLUDE_B313').material.id = 'OTHER-MATERIAL'; },
  'S5_PRESSURE_Q5_CONTROL_STATE_MISMATCH',
);
expectCode(
  'BOURDON_AND_PRESSURE_STIFFENING',
  (record) => { record.pressureAxialThrustRequested = true; },
  'S5_PRESSURE_EVIDENCE_CANNOT_AUTHORIZE_PRODUCTION',
);
expectCode(
  'BOURDON_AND_PRESSURE_STIFFENING',
  (record) => { record.tolerancePolicy.fittedToCaesar = true; },
  'S5_PRESSURE_TOLERANCE_FITTING_FORBIDDEN',
);
expectCode(
  'BOURDON_AND_PRESSURE_STIFFENING',
  (record) => { record.independentReview.reviewer = 'CAESAR_OPERATOR_A'; },
  'S5_PRESSURE_REVIEWER_NOT_INDEPENDENT',
);

console.log('LFEA S5 pressure parity evidence contract check PASS');
