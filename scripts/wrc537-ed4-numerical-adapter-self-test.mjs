import assert from 'node:assert/strict';
import {
  WRC537_ED4_ENGINEERING_DATASET_SCHEMA,
  WRC537_ED4_PROMOTION_SCHEMA,
  createWrc537Ed4EngineeringDatasetCandidate,
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-engineering-dataset.js';
import {
  WRC537_ED4_CALCULATION_PLAN_SCHEMA,
  WRC537_ED4_QUALIFICATION_TRACE_SCHEMA,
  createWrc537Ed4CalculationPlan,
  createWrc537Ed4QualificationTrace,
  requireWrc537Ed4EngineeringExecution,
  validateWrc537Ed4CalculationPlan,
  validateWrc537Ed4QualificationTrace,
  wrc537Ed4NumericalAdapterCanExecuteEngineering,
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-numerical-adapter.js';
import { createReadyWrc537Ed4SourceFixture } from './wrc537-ed4-ready-source-fixture.mjs';

const source = createReadyWrc537Ed4SourceFixture();
const datumSourceRef = 'TECH-WRC537-ED4-DATUM-FIXTURE';
const datumLocator = 'Fixture p.1 Eq. F-1; not WRC technical data';
source.sourceLedgerRows.push({
  record_id: datumSourceRef,
  record_scope: 'DATUM',
  engineering_subject: 'NUMERICAL_ADAPTER_CONTRACT_FIXTURE',
  authority_class: 'PRIMARY_LICENSED',
  publisher: 'Welding Research Council, Inc.',
  bulletin_number: '537',
  edition: '4',
  publication_date: '2026-02',
  document_digest: 'a'.repeat(64),
  locator: datumLocator,
  verification_status: 'PRIMARY_SOURCE_VERIFIED',
  notes: 'Synthetic contract fixture row only; not WRC engineering data.',
});
const dataset = createWrc537Ed4EngineeringDatasetCandidate({
  ...source,
  promotion: {
    schema: WRC537_ED4_PROMOTION_SCHEMA,
    candidateIdentity: 'WRC537-ED4-NUMERICAL-BOUNDARY-FIXTURE',
    candidateVersion: '1',
    preparedBy: 'QUALIFICATION_FIXTURE',
    preparationReference: 'WRC537-ED4-NUMERICAL-ADAPTER-SELF-TEST',
  },
});
assert.equal(dataset.schema, WRC537_ED4_ENGINEERING_DATASET_SCHEMA);

const sourceDefinition = (definition) => ({
  definition, sourceRef: datumSourceRef, sourceLocator: datumLocator,
});
const sourceVariable = (variableId, sourceSymbol, role, dimension, unitsPolicy) => ({
  variableId, sourceSymbol, role, dimension, unitsPolicy,
  sourceRef: datumSourceRef, sourceLocator: datumLocator,
});

const planInput = {
  schema: WRC537_ED4_CALCULATION_PLAN_SCHEMA,
  planIdentity: 'FIXTURE-NOT-WRC-MATH-001',
  planVersion: '1',
  datasetSemanticHash: dataset.datasetSemanticHash,
  sourceFamily: sourceDefinition('FIXTURE CYLINDRICAL FAMILY; NOT WRC TECHNICAL DATA'),
  sourceCoordinateSystem: sourceDefinition('FIXTURE LOCAL AXES; NOT WRC TECHNICAL DATA'),
  sourceLoadReference: sourceDefinition('FIXTURE LOAD REFERENCE; NOT WRC TECHNICAL DATA'),
  variables: [
    sourceVariable('P', 'FIXTURE_P', 'INPUT', 'FORCE', 'N'),
    sourceVariable('A', 'FIXTURE_A', 'INPUT', 'AREA', 'mm^2'),
    sourceVariable('SIGMA', 'FIXTURE_SIGMA', 'STRESS', 'STRESS', 'MPa'),
  ],
  equations: [{
    equationId: 'FIXTURE-EQ-1',
    outputVariableId: 'SIGMA',
    inputVariableIds: ['P', 'A'],
    sourceExpression: 'FIXTURE_ONLY: SIGMA = P / A',
    sourceRef: datumSourceRef,
    sourceLocator: datumLocator,
  }],
  interpolationRules: [],
  recoveryTargets: [{
    targetId: 'FIXTURE-TARGET-OUTER',
    resultVariableIds: ['SIGMA'],
    physicalLocation: 'FIXTURE LOCATION; NOT WRC',
    surface: 'OUTER',
    sourceRef: datumSourceRef,
    sourceLocator: datumLocator,
  }],
  combinationRules: [],
  postProcessing: [],
};

const plan = createWrc537Ed4CalculationPlan(dataset, planInput);
assert.equal(plan.authority.engineeringUseAuthorized, false);
assert.ok(plan.planSemanticHash.startsWith('fnv1a64:'));
assert.equal(validateWrc537Ed4CalculationPlan(dataset, plan).planSemanticHash, plan.planSemanticHash);

const evidenceInput = {
  schema: WRC537_ED4_QUALIFICATION_TRACE_SCHEMA,
  traceIdentity: 'FIXTURE-TRACE-001',
  requestIdentity: 'FIXTURE-REQUEST-001',
  datasetSemanticHash: dataset.datasetSemanticHash,
  planSemanticHash: plan.planSemanticHash,
  inputValues: [
    { variableId: 'P', value: 1000, units: 'N' },
    { variableId: 'A', value: 100, units: 'mm^2' },
  ],
  equationSteps: [{
    equationId: 'FIXTURE-EQ-1',
    outputVariableId: 'SIGMA',
    value: 10,
    units: 'MPa',
    sourceRef: datumSourceRef,
    sourceLocator: datumLocator,
  }],
  recoveryResults: [{
    targetId: 'FIXTURE-TARGET-OUTER',
    variableId: 'SIGMA',
    value: 10,
    units: 'MPa',
  }],
  notes: ['Contract fixture only. Numerical value is not WRC 537 engineering evidence.'],
};
const trace = createWrc537Ed4QualificationTrace(dataset, plan, evidenceInput);
assert.equal(trace.authority.engineeringUseAuthorized, false);
assert.ok(trace.traceSemanticHash.startsWith('fnv1a64:'));
assert.equal(validateWrc537Ed4QualificationTrace(dataset, plan, trace).traceSemanticHash,
  trace.traceSemanticHash);
assert.equal(wrc537Ed4NumericalAdapterCanExecuteEngineering(dataset, plan), false);
expectError('WRC537_ED4_NUMERICAL_METHOD_NOT_QUALIFIED', () =>
  requireWrc537Ed4EngineeringExecution(dataset, plan));

expectPlanError('WRC537_ED4_CALCULATION_PLAN_DATASET_MISMATCH', (copy) => {
  copy.datasetSemanticHash = 'fnv1a64:0000000000000000';
});
expectPlanError('WRC537_ED4_CALCULATION_PLAN_DATUM_SOURCE_REQUIRED', (copy) => {
  copy.sourceFamily.sourceRef = 'TECH-WRC537-ED4';
  copy.sourceFamily.sourceLocator = 'Authorized Edition 4 technical source';
});
expectPlanError('WRC537_ED4_CALCULATION_PLAN_SOURCE_NOT_PRIMARY_VERIFIED', (copy) => {
  copy.sourceFamily.sourceRef = 'CATALOG-WRC537-ED4';
  copy.sourceFamily.sourceLocator = 'Official catalog entry';
});
expectPlanError('WRC537_ED4_CALCULATION_PLAN_SOURCE_LOCATOR_MISMATCH', (copy) => {
  copy.equations[0].sourceLocator = 'Invented locator';
});
expectPlanValidationError('WRC537_ED4_CALCULATION_PLAN_AUTHORITY_INVALID', (copy) => {
  copy.authority.engineeringUseAuthorized = true;
});
expectPlanValidationError('WRC537_ED4_CALCULATION_PLAN_HASH_MISMATCH', (copy) => {
  copy.planSemanticHash = 'fnv1a64:0000000000000000';
});
expectTraceError('WRC537_ED4_QUALIFICATION_INPUT_SET_MISMATCH', (copy) => {
  copy.inputValues.pop();
});
expectTraceError('WRC537_ED4_QUALIFICATION_EQUATION_STEP_BINDING_MISMATCH', (copy) => {
  copy.equationSteps[0].sourceLocator = 'Wrong locator';
});
expectTraceError('WRC537_ED4_QUALIFICATION_RECOVERY_RESULT_SET_MISMATCH', (copy) => {
  copy.recoveryResults[0].variableId = 'OTHER';
});
expectTraceValidationError('WRC537_ED4_QUALIFICATION_TRACE_AUTHORITY_INVALID', (copy) => {
  copy.authority.engineeringUseAuthorized = true;
});
expectTraceValidationError('WRC537_ED4_QUALIFICATION_TRACE_HASH_MISMATCH', (copy) => {
  copy.traceSemanticHash = 'fnv1a64:0000000000000000';
});

console.log(JSON.stringify({
  check: 'wrc537-ed4-numerical-adapter-self-test',
  status: 'PASS',
  fixtureIsNotWrcTechnicalData: true,
  sourcePlanBoundToDataset: true,
  datumLevelPrimarySourceLedgerBindingRequired: true,
  exactSourceLocatorRequired: true,
  qualificationTraceRetainsEveryEquationStep: true,
  recoveryResultSetBoundToPlan: true,
  planAndTraceTamperRejected: true,
  engineeringExecutionBlocked: true,
}));

function expectPlanError(code, mutate) {
  const copy = structuredClone(planInput);
  mutate(copy);
  expectError(code, () => createWrc537Ed4CalculationPlan(dataset, copy));
}
function expectPlanValidationError(code, mutate) {
  const copy = structuredClone(plan);
  mutate(copy);
  expectError(code, () => validateWrc537Ed4CalculationPlan(dataset, copy));
}
function expectTraceError(code, mutate) {
  const copy = structuredClone(evidenceInput);
  mutate(copy);
  expectError(code, () => createWrc537Ed4QualificationTrace(dataset, plan, copy));
}
function expectTraceValidationError(code, mutate) {
  const copy = structuredClone(trace);
  mutate(copy);
  expectError(code, () => validateWrc537Ed4QualificationTrace(dataset, plan, copy));
}
function expectError(code, fn) {
  try {
    fn();
  } catch (error) {
    assert.equal(error.code, code);
    return error;
  }
  assert.fail(`Expected ${code}.`);
}
