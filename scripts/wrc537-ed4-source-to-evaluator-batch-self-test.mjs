import assert from 'node:assert/strict';
import { createReadyWrc537Ed4SourceFixture } from './wrc537-ed4-ready-source-fixture.mjs';
import {
  WRC537_ED4_PROMOTION_SCHEMA,
  createWrc537Ed4EngineeringDatasetCandidate,
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-engineering-dataset.js';
import {
  WRC537_ED4_CALCULATION_PLAN_SCHEMA,
  createWrc537Ed4CalculationPlan,
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-numerical-adapter.js';
import {
  WRC537_ED4_EXECUTABLE_PLAN_SCHEMA,
  createWrc537Ed4ExecutablePlan,
  executeWrc537Ed4QualificationCase,
  validateWrc537Ed4ExecutionTrace,
  wrc537Ed4ExecutablePlanCanActivateEngineering,
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-execution-engine.js';
import {
  WRC537_ED4_NUMERICAL_QUALIFICATION_SUITE_SCHEMA,
  WRC537_ED4_NUMERICAL_QUALIFICATION_PASS,
  createWrc537Ed4NumericalQualificationSuite,
  runWrc537Ed4NumericalQualification,
  validateWrc537Ed4NumericalQualificationEvidence,
  wrc537Ed4NumericalQualificationCanActivateEngineering,
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-qualification-engine.js';

const fixture = createReadyWrc537Ed4SourceFixture();
const digest = fixture.sourcePackage.technicalSource.documentDigest;
const datumRef = 'TECH-WRC537-ED4-DATUM-FIXTURE';
const datumLocator = 'Fixture page 1 equation F-1';
fixture.sourceLedgerRows.push({
  record_id: datumRef,
  authority_class: 'PRIMARY_LICENSED',
  publisher: 'Welding Research Council, Inc.',
  bulletin_number: '537',
  edition: '4',
  publication_date: '2026-02',
  document_digest: digest,
  record_scope: 'DATUM',
  engineering_subject: 'SYNTHETIC CONTRACT FIXTURE P OVER A',
  locator: datumLocator,
  verification_status: 'PRIMARY_SOURCE_VERIFIED',
  notes: 'Synthetic software-contract fixture only; not WRC537 engineering data.',
});

const dataset = createWrc537Ed4EngineeringDatasetCandidate({
  ...fixture,
  promotion: {
    schema: WRC537_ED4_PROMOTION_SCHEMA,
    candidateIdentity: 'WRC537-ED4-BATCH-FIXTURE-DATASET',
    candidateVersion: '1',
    preparedBy: 'SOFTWARE_CONTRACT_FIXTURE',
    preparationReference: 'wrc537-ed4-source-to-evaluator-batch-self-test',
  },
});

const sourceDefinition = (definition) => ({ definition, sourceRef: datumRef, sourceLocator: datumLocator });
const sourceVariable = (variableId, sourceSymbol, role, dimension, unitsPolicy) => ({
  variableId, sourceSymbol, role, dimension, unitsPolicy, sourceRef: datumRef, sourceLocator: datumLocator,
});
const calculationPlan = createWrc537Ed4CalculationPlan(dataset, {
  schema: WRC537_ED4_CALCULATION_PLAN_SCHEMA,
  planIdentity: 'WRC537-ED4-BATCH-FIXTURE-PLAN',
  planVersion: '1',
  datasetSemanticHash: dataset.datasetSemanticHash,
  sourceFamily: sourceDefinition('SYNTHETIC CONTRACT FIXTURE ONLY'),
  sourceCoordinateSystem: sourceDefinition('Fixture scalar coordinate convention'),
  sourceLoadReference: sourceDefinition('Fixture direct scalar load'),
  variables: [
    sourceVariable('P', 'P', 'INPUT', 'FORCE', 'N'),
    sourceVariable('A', 'A', 'INPUT', 'AREA', 'mm2'),
    sourceVariable('SIGMA', 'SIGMA', 'STRESS', 'STRESS', 'MPa'),
  ],
  equations: [{
    equationId: 'EQ-FIXTURE-P-OVER-A',
    outputVariableId: 'SIGMA',
    inputVariableIds: ['P', 'A'],
    sourceExpression: 'SIGMA = P / A [SYNTHETIC CONTRACT FIXTURE ONLY]',
    sourceRef: datumRef,
    sourceLocator: datumLocator,
  }],
  interpolationRules: [],
  recoveryTargets: [{
    targetId: 'FIXTURE-POINT-A',
    resultVariableIds: ['SIGMA'],
    physicalLocation: 'Synthetic fixture recovery location',
    surface: 'SYNTHETIC',
    sourceRef: datumRef,
    sourceLocator: datumLocator,
  }],
  combinationRules: [],
  postProcessing: [],
});

const implementationInput = {
  schema: WRC537_ED4_EXECUTABLE_PLAN_SCHEMA,
  implementationIdentity: 'WRC537-ED4-BATCH-FIXTURE-EXECUTABLE',
  implementationVersion: '1',
  datasetSemanticHash: dataset.datasetSemanticHash,
  planSemanticHash: calculationPlan.planSemanticHash,
  variableMetadata: [
    { variableId: 'P', units: 'N', dimensionVector: { F: 1 } },
    { variableId: 'A', units: 'mm2', dimensionVector: { L: 2 } },
    { variableId: 'SIGMA', units: 'MPa', dimensionVector: { F: 1, L: -2 } },
  ],
  equationImplementations: [{
    equationId: 'EQ-FIXTURE-P-OVER-A',
    outputVariableId: 'SIGMA',
    graph: { op: 'DIV', args: [{ op: 'VAR', variableId: 'P' }, { op: 'VAR', variableId: 'A' }] },
    sourceRef: datumRef,
    sourceLocator: datumLocator,
    dimensionAudit: { verified: true, basis: '[F] / [L^2] = [stress]' },
  }],
  interpolationImplementations: [],
  executionOrder: [{ kind: 'EQUATION', id: 'EQ-FIXTURE-P-OVER-A' }],
  numericalPolicy: {
    divisionZeroTolerance: 0,
    finiteOnly: true,
    allowExtrapolationOnlyWhenSourceRuleAllows: true,
  },
};
const executablePlan = createWrc537Ed4ExecutablePlan(dataset, calculationPlan, implementationInput);
assert.equal(executablePlan.authority.engineeringUseAuthorized, false);
assert.equal(wrc537Ed4ExecutablePlanCanActivateEngineering(dataset, calculationPlan, executablePlan), false);

const request = {
  requestIdentity: 'FIXTURE-REQUEST-1',
  inputValues: [
    { variableId: 'P', value: 1000, units: 'N' },
    { variableId: 'A', value: 100, units: 'mm2' },
  ],
};
const trace = executeWrc537Ed4QualificationCase(dataset, calculationPlan, executablePlan, request);
assert.equal(trace.steps.length, 1);
assert.equal(trace.steps[0].value, 10);
assert.equal(trace.steps[0].units, 'MPa');
assert.equal(trace.recoveryResults[0].value, 10);
assert.equal(validateWrc537Ed4ExecutionTrace(dataset, calculationPlan, executablePlan, trace).traceSemanticHash,
  trace.traceSemanticHash);

const suite = createWrc537Ed4NumericalQualificationSuite(dataset, calculationPlan, executablePlan, {
  schema: WRC537_ED4_NUMERICAL_QUALIFICATION_SUITE_SCHEMA,
  suiteIdentity: 'WRC537-ED4-BATCH-FIXTURE-SUITE',
  suiteVersion: '1',
  datasetSemanticHash: dataset.datasetSemanticHash,
  planSemanticHash: calculationPlan.planSemanticHash,
  executablePlanSemanticHash: executablePlan.executablePlanSemanticHash,
  cases: [{
    caseId: 'FIXTURE-P-OVER-A-001',
    sourceRef: datumRef,
    sourceLocator: datumLocator,
    independentReproduction: true,
    independentCalculationReference: '1000 N / 100 mm2 = 10 N/mm2 = 10 MPa',
    request,
    expectedSteps: [{
      kind: 'EQUATION', id: 'EQ-FIXTURE-P-OVER-A', value: 10, units: 'MPa',
      absoluteTolerance: 0, toleranceBasis: 'EXACT SYNTHETIC INTEGER ARITHMETIC',
      sourceRef: datumRef, sourceLocator: datumLocator,
    }],
    expectedRecovery: [{
      targetId: 'FIXTURE-POINT-A', variableId: 'SIGMA', value: 10, units: 'MPa',
      absoluteTolerance: 0, toleranceBasis: 'EXACT SYNTHETIC INTEGER ARITHMETIC',
      sourceRef: datumRef, sourceLocator: datumLocator,
    }],
  }],
});
const evidence = runWrc537Ed4NumericalQualification(dataset, calculationPlan, executablePlan, suite);
assert.equal(evidence.status, WRC537_ED4_NUMERICAL_QUALIFICATION_PASS);
assert.equal(evidence.authority.engineeringUseAuthorized, false);
assert.equal(validateWrc537Ed4NumericalQualificationEvidence(dataset, calculationPlan, executablePlan, suite, evidence)
  .evidenceSemanticHash, evidence.evidenceSemanticHash);
assert.equal(wrc537Ed4NumericalQualificationCanActivateEngineering(
  dataset, calculationPlan, executablePlan, suite, evidence,
), false);

expectError('WRC537_ED4_EXECUTION_DIVISION_BY_ZERO', () => executeWrc537Ed4QualificationCase(
  dataset, calculationPlan, executablePlan,
  { requestIdentity: 'ZERO-A', inputValues: [{ variableId: 'P', value: 1000, units: 'N' }, { variableId: 'A', value: 0, units: 'mm2' }] },
));
expectError('WRC537_ED4_EXECUTION_INPUT_UNITS_MISMATCH', () => executeWrc537Ed4QualificationCase(
  dataset, calculationPlan, executablePlan,
  { requestIdentity: 'BAD-UNIT', inputValues: [{ variableId: 'P', value: 1000, units: 'kN' }, { variableId: 'A', value: 100, units: 'mm2' }] },
));
expectError('WRC537_ED4_EXECUTABLE_PLAN_DIMENSION_MISMATCH', () => {
  const bad = structuredClone(implementationInput);
  bad.variableMetadata.find((row) => row.variableId === 'SIGMA').dimensionVector = { F: 1, L: -1 };
  createWrc537Ed4ExecutablePlan(dataset, calculationPlan, bad);
});
expectError('WRC537_ED4_EXECUTABLE_PLAN_OPERATOR_UNSUPPORTED', () => {
  const bad = structuredClone(implementationInput);
  bad.equationImplementations[0].graph = { op: 'EVAL', expression: 'P/A' };
  createWrc537Ed4ExecutablePlan(dataset, calculationPlan, bad);
});
expectError('WRC537_ED4_EXECUTABLE_PLAN_EXTRAPOLATION_POLICY_MISMATCH', () => {
  const bad = structuredClone(implementationInput);
  bad.equationImplementations[0].graph = {
    op: 'LINEAR_INTERPOLATE',
    x: { op: 'VAR', variableId: 'A' },
    x0: { op: 'VAR', variableId: 'A' },
    x1: { op: 'VAR', variableId: 'A' },
    y0: { op: 'DIV', args: [{ op: 'VAR', variableId: 'P' }, { op: 'VAR', variableId: 'A' }] },
    y1: { op: 'DIV', args: [{ op: 'VAR', variableId: 'P' }, { op: 'VAR', variableId: 'A' }] },
    sourceAllowsExtrapolation: true,
  };
  createWrc537Ed4ExecutablePlan(dataset, calculationPlan, bad);
});
expectError('WRC537_ED4_EXECUTABLE_PLAN_DIMENSION_AUDIT_REQUIRED', () => {
  const bad = structuredClone(implementationInput);
  bad.equationImplementations[0].dimensionAudit.verified = false;
  createWrc537Ed4ExecutablePlan(dataset, calculationPlan, bad);
});

const failingSuiteInput = structuredClone(suite);
delete failingSuiteInput.suiteSemanticHash;
failingSuiteInput.cases[0].expectedSteps[0].value = 11;
const failingSuite = createWrc537Ed4NumericalQualificationSuite(dataset, calculationPlan, executablePlan, failingSuiteInput);
const failingEvidence = runWrc537Ed4NumericalQualification(dataset, calculationPlan, executablePlan, failingSuite);
assert.equal(failingEvidence.status, 'FAIL');
assert.equal(failingEvidence.cases[0].stepComparisons[0].absoluteError, 1);

expectError('WRC537_ED4_QUALIFICATION_SOURCE_DATUM_INVALID', () => {
  const bad = structuredClone(suite);
  delete bad.suiteSemanticHash;
  bad.cases[0].expectedSteps[0].sourceRef = 'CATALOG-WRC537-ED4';
  createWrc537Ed4NumericalQualificationSuite(dataset, calculationPlan, executablePlan, bad);
});

console.log(JSON.stringify({
  check: 'wrc537-ed4-source-to-evaluator-batch-self-test',
  status: 'PASS',
  fixtureOnly: true,
  fixtureRelation: 'P/A',
  fixtureExpectedMPa: 10,
  safeDeclarativeEvaluator: true,
  dimensionAuditEnforced: true,
  exactInputUnitsEnforced: true,
  divisionByZeroRejected: true,
  unsupportedEvaluatorRejected: true,
  extrapolationPolicyBoundToSourcePackage: true,
  termCompleteQualification: true,
  sourceDatumToleranceCustody: true,
  numericalQualificationCanActivateEngineering: false,
}));

function expectError(code, callback) {
  try { callback(); } catch (error) { assert.equal(error.code, code); return; }
  assert.fail(`Expected ${code}`);
}
