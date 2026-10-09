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
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-execution-engine.js';
import {
  WRC537_ED4_NUMERICAL_QUALIFICATION_SUITE_SCHEMA,
  createWrc537Ed4NumericalQualificationSuite,
  runWrc537Ed4NumericalQualification,
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-qualification-engine.js';
import {
  WRC537_ED4_NUMERICAL_RELEASE_CANDIDATE_SCHEMA,
  createWrc537Ed4NumericalReleaseCandidate,
  validateWrc537Ed4NumericalReleaseCandidate,
  wrc537Ed4NumericalReleaseCandidateCanActivateEngineering,
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-numerical-release-candidate.js';

const fixture = createReadyWrc537Ed4SourceFixture();
const digest = fixture.sourcePackage.technicalSource.documentDigest;
const datumRef = 'TECH-WRC537-ED4-RELEASE-FIXTURE-DATUM';
const datumLocator = 'Fixture page 2 equation F-2';
const sourceBenchmarkCaseId = 'WRC537-ED4-RELEASE-SOURCE-BENCHMARK';
const independentReference = '(1000/100)*1.234 = 12.34 MPa';
fixture.sourceLedgerRows.push({
  record_id: datumRef,
  authority_class: 'PRIMARY_LICENSED',
  publisher: 'Welding Research Council, Inc.',
  bulletin_number: '537',
  edition: '4',
  publication_date: '2026-02',
  document_digest: digest,
  record_scope: 'DATUM',
  engineering_subject: 'SYNTHETIC RELEASE CONTRACT FIXTURE',
  locator: datumLocator,
  verification_status: 'PRIMARY_SOURCE_VERIFIED',
  notes: 'Synthetic software-contract fixture only; not WRC537 engineering data.',
});
fixture.sourcePackage.benchmarks = [{
  caseId: sourceBenchmarkCaseId,
  sourceRef: datumRef,
  targetEditionPrimarySourceVerified: true,
  independentlyReproduced: true,
  independentCalculationReference: independentReference,
  input: { P: 1000, A: 100 },
  inputEvidence: [
    {
      inputId: 'LOAD_P',
      benchmarkPath: ['P'],
      units: 'N',
      sourceRef: datumRef,
      sourceLocator: datumLocator,
    },
    {
      inputId: 'AREA_A',
      benchmarkPath: ['A'],
      units: 'mm2',
      sourceRef: datumRef,
      sourceLocator: datumLocator,
    },
  ],
  expectedResults: [{
    quantity: 'SIGMA',
    value: 12.34,
    units: 'MPa',
    absoluteTolerance: 1e-12,
    toleranceBasis: 'SYNTHETIC FLOATING-POINT FIXTURE',
    sourceRef: datumRef,
    sourceLocator: datumLocator,
  }],
}];

const dataset = createWrc537Ed4EngineeringDatasetCandidate({
  ...fixture,
  promotion: {
    schema: WRC537_ED4_PROMOTION_SCHEMA,
    candidateIdentity: 'WRC537-ED4-RELEASE-FIXTURE-DATASET',
    candidateVersion: '1',
    preparedBy: 'SOFTWARE_CONTRACT_FIXTURE',
    preparationReference: 'wrc537-ed4-numerical-release-candidate-self-test',
  },
});
const sourceDefinition = (definition) => ({ definition, sourceRef: datumRef, sourceLocator: datumLocator });
const sourceVariable = (variableId, sourceSymbol, role, dimension, unitsPolicy) => ({
  variableId, sourceSymbol, role, dimension, unitsPolicy, sourceRef: datumRef, sourceLocator: datumLocator,
});
const plan = createWrc537Ed4CalculationPlan(dataset, {
  schema: WRC537_ED4_CALCULATION_PLAN_SCHEMA,
  planIdentity: 'WRC537-ED4-RELEASE-FIXTURE-PLAN',
  planVersion: '1',
  datasetSemanticHash: dataset.datasetSemanticHash,
  sourceFamily: sourceDefinition('SYNTHETIC RELEASE CONTRACT FIXTURE'),
  sourceCoordinateSystem: sourceDefinition('Fixture scalar convention'),
  sourceLoadReference: sourceDefinition('Fixture scalar load'),
  variables: [
    sourceVariable('P', 'P', 'INPUT', 'FORCE', 'N'),
    sourceVariable('A', 'A', 'INPUT', 'AREA', 'mm2'),
    sourceVariable('SIGMA', 'SIGMA', 'STRESS', 'STRESS', 'MPa'),
  ],
  equations: [{
    equationId: 'EQ-FIXTURE-P-OVER-A-K',
    outputVariableId: 'SIGMA',
    inputVariableIds: ['P', 'A'],
    sourceExpression: 'SIGMA = (P/A) * K [SYNTHETIC RELEASE CONTRACT FIXTURE]',
    sourceRef: datumRef,
    sourceLocator: datumLocator,
  }],
  interpolationRules: [],
  recoveryTargets: [{
    targetId: 'FIXTURE-RELEASE-POINT',
    resultVariableIds: ['SIGMA'],
    physicalLocation: 'Synthetic release fixture point',
    surface: 'SYNTHETIC',
    sourceRef: datumRef,
    sourceLocator: datumLocator,
  }],
  combinationRules: [],
  postProcessing: [],
});
const executable = createWrc537Ed4ExecutablePlan(dataset, plan, {
  schema: WRC537_ED4_EXECUTABLE_PLAN_SCHEMA,
  implementationIdentity: 'WRC537-ED4-RELEASE-FIXTURE-EXECUTABLE',
  implementationVersion: '1',
  datasetSemanticHash: dataset.datasetSemanticHash,
  planSemanticHash: plan.planSemanticHash,
  variableMetadata: [
    { variableId: 'P', units: 'N', dimensionVector: { F: 1 } },
    { variableId: 'A', units: 'mm2', dimensionVector: { L: 2 } },
    { variableId: 'SIGMA', units: 'MPa', dimensionVector: { F: 1, L: -2 } },
  ],
  equationImplementations: [{
    equationId: 'EQ-FIXTURE-P-OVER-A-K',
    outputVariableId: 'SIGMA',
    graph: {
      op: 'MUL',
      args: [
        { op: 'DIV', args: [{ op: 'VAR', variableId: 'P' }, { op: 'VAR', variableId: 'A' }] },
        { op: 'CONST', value: 1.234 },
      ],
    },
    sourceRef: datumRef,
    sourceLocator: datumLocator,
    dimensionAudit: { verified: true, basis: '[F/L2] * [1] = [stress]' },
  }],
  interpolationImplementations: [],
  executionOrder: [{ kind: 'EQUATION', id: 'EQ-FIXTURE-P-OVER-A-K' }],
  numericalPolicy: { divisionZeroTolerance: 0, finiteOnly: true, allowExtrapolationOnlyWhenSourceRuleAllows: true },
});
const request = {
  requestIdentity: 'RELEASE-FIXTURE-REQUEST',
  inputValues: [{ variableId: 'P', value: 1000, units: 'N' }, { variableId: 'A', value: 100, units: 'mm2' }],
};
const qualificationCaseId = 'RELEASE-FIXTURE-001';
const suite = createWrc537Ed4NumericalQualificationSuite(dataset, plan, executable, {
  schema: WRC537_ED4_NUMERICAL_QUALIFICATION_SUITE_SCHEMA,
  suiteIdentity: 'WRC537-ED4-RELEASE-FIXTURE-SUITE',
  suiteVersion: '1',
  datasetSemanticHash: dataset.datasetSemanticHash,
  planSemanticHash: plan.planSemanticHash,
  executablePlanSemanticHash: executable.executablePlanSemanticHash,
  cases: [{
    caseId: qualificationCaseId,
    sourceRef: datumRef,
    sourceLocator: datumLocator,
    independentReproduction: true,
    independentCalculationReference: independentReference,
    request,
    expectedSteps: [{
      kind: 'EQUATION', id: 'EQ-FIXTURE-P-OVER-A-K', value: 12.34, units: 'MPa',
      absoluteTolerance: 1e-12, toleranceBasis: 'SYNTHETIC FLOATING-POINT FIXTURE',
      sourceRef: datumRef, sourceLocator: datumLocator,
    }],
    expectedRecovery: [{
      targetId: 'FIXTURE-RELEASE-POINT', variableId: 'SIGMA', value: 12.34, units: 'MPa',
      absoluteTolerance: 1e-12, toleranceBasis: 'SYNTHETIC FLOATING-POINT FIXTURE',
      sourceRef: datumRef, sourceLocator: datumLocator,
    }],
  }],
});
const evidence = runWrc537Ed4NumericalQualification(dataset, plan, executable, suite);
assert.equal(evidence.status, 'PASS');

const coefficient = dataset.coefficientRows.find((row) => row.coefficient_id === 'QUALIFIED_FIXTURE_COEFFICIENT_001');
const literalKey = 'EQUATION:EQ-FIXTURE-P-OVER-A-K:graph.args[1].value';
const benchmarkBindings = [{
  sourceBenchmarkCaseId,
  qualificationCaseId,
  inputBindings: [
    { variableId: 'P', benchmarkInputId: 'LOAD_P' },
    { variableId: 'A', benchmarkInputId: 'AREA_A' },
  ],
  recoveryBindings: [{
    targetId: 'FIXTURE-RELEASE-POINT',
    variableId: 'SIGMA',
    benchmarkQuantity: 'SIGMA',
  }],
}];
const candidateInput = {
  schema: WRC537_ED4_NUMERICAL_RELEASE_CANDIDATE_SCHEMA,
  candidateIdentity: 'WRC537-ED4-RELEASE-FIXTURE-CANDIDATE',
  candidateVersion: '1',
  benchmarkBindings,
  literalBindings: [{
    literalKey,
    bindingType: 'DATASET_COEFFICIENT',
    coefficientId: coefficient.coefficient_id,
    sourceRef: coefficient.source_ref,
    sourceLocator: coefficient.source_locator,
  }],
};
const candidate = createWrc537Ed4NumericalReleaseCandidate(dataset, plan, executable, suite, evidence, candidateInput);
assert.equal(candidate.benchmarkBindings.length, 1);
assert.equal(candidate.literalInventory.length, 1);
assert.equal(candidate.literalInventory[0].value, 1.234);
assert.equal(candidate.authority.engineeringUseAuthorized, false);
assert.equal(validateWrc537Ed4NumericalReleaseCandidate(dataset, plan, executable, suite, evidence, candidate)
  .candidateSemanticHash, candidate.candidateSemanticHash);
assert.equal(wrc537Ed4NumericalReleaseCandidateCanActivateEngineering(
  dataset, plan, executable, suite, evidence, candidate,
), false);

expectError('WRC537_ED4_NUMERICAL_RELEASE_LITERAL_BINDING_SET_MISMATCH', () =>
  createWrc537Ed4NumericalReleaseCandidate(dataset, plan, executable, suite, evidence, {
    ...candidateInput, literalBindings: [],
  }));
expectError('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_COVERAGE_MISMATCH', () =>
  createWrc537Ed4NumericalReleaseCandidate(dataset, plan, executable, suite, evidence, {
    ...candidateInput, benchmarkBindings: [],
  }));
expectError('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_INPUT_EVIDENCE_UNKNOWN', () => {
  const bad = structuredClone(candidateInput);
  bad.benchmarkBindings[0].inputBindings[0].benchmarkInputId = 'UNKNOWN_INPUT_EVIDENCE';
  createWrc537Ed4NumericalReleaseCandidate(dataset, plan, executable, suite, evidence, bad);
});
expectError('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_INPUT_VALUE_MISMATCH', () => {
  const badSuiteInput = structuredClone(suite);
  delete badSuiteInput.suiteSemanticHash;
  badSuiteInput.cases[0].request.inputValues.find((row) => row.variableId === 'P').value = 999;
  badSuiteInput.cases[0].expectedSteps[0].value = 12.32766;
  badSuiteInput.cases[0].expectedRecovery[0].value = 12.32766;
  const badSuite = createWrc537Ed4NumericalQualificationSuite(dataset, plan, executable, badSuiteInput);
  const badEvidence = runWrc537Ed4NumericalQualification(dataset, plan, executable, badSuite);
  assert.equal(badEvidence.status, 'PASS');
  createWrc537Ed4NumericalReleaseCandidate(dataset, plan, executable, badSuite, badEvidence, candidateInput);
});
expectError('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_RECOVERY_VALUE_MISMATCH', () => {
  const changedExecutableInput = structuredClone(executable);
  delete changedExecutableInput.authority;
  delete changedExecutableInput.executablePlanSemanticHash;
  changedExecutableInput.equationImplementations[0].graph.args[1].value = 1.2;
  const changedExecutable = createWrc537Ed4ExecutablePlan(dataset, plan, changedExecutableInput);
  const changedSuiteInput = structuredClone(suite);
  delete changedSuiteInput.suiteSemanticHash;
  changedSuiteInput.executablePlanSemanticHash = changedExecutable.executablePlanSemanticHash;
  changedSuiteInput.cases[0].expectedSteps[0].value = 12;
  changedSuiteInput.cases[0].expectedRecovery[0].value = 12;
  const changedSuite = createWrc537Ed4NumericalQualificationSuite(dataset, plan, changedExecutable, changedSuiteInput);
  const changedEvidence = runWrc537Ed4NumericalQualification(dataset, plan, changedExecutable, changedSuite);
  assert.equal(changedEvidence.status, 'PASS');
  createWrc537Ed4NumericalReleaseCandidate(
    dataset, plan, changedExecutable, changedSuite, changedEvidence, candidateInput,
  );
});
expectError('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_CASE_CUSTODY_MISMATCH', () => {
  const badSuiteInput = structuredClone(suite);
  delete badSuiteInput.suiteSemanticHash;
  badSuiteInput.cases[0].independentCalculationReference = 'SELF-CONSISTENT BUT NOT SOURCE BENCHMARK';
  const badSuite = createWrc537Ed4NumericalQualificationSuite(dataset, plan, executable, badSuiteInput);
  const badEvidence = runWrc537Ed4NumericalQualification(dataset, plan, executable, badSuite);
  createWrc537Ed4NumericalReleaseCandidate(dataset, plan, executable, badSuite, badEvidence, candidateInput);
});
expectError('WRC537_ED4_NUMERICAL_RELEASE_COEFFICIENT_SOURCE_MISMATCH', () => {
  const bad = structuredClone(candidateInput);
  bad.literalBindings[0].sourceLocator = 'Wrong coefficient locator';
  createWrc537Ed4NumericalReleaseCandidate(dataset, plan, executable, suite, evidence, bad);
});
expectError('WRC537_ED4_NUMERICAL_RELEASE_AUTHORITY_INVALID', () => {
  const forged = structuredClone(candidate);
  forged.authority.engineeringUseAuthorized = true;
  validateWrc537Ed4NumericalReleaseCandidate(dataset, plan, executable, suite, evidence, forged);
});

console.log(JSON.stringify({
  check: 'wrc537-ed4-numerical-release-candidate-self-test',
  status: 'PASS',
  fixtureOnly: true,
  retainedDatasetCoefficient: 1.234,
  fixtureExpectedMPa: 12.34,
  sourceBenchmarkCoverageRequired: true,
  sourceBenchmarkInputEvidenceRequired: true,
  sourceBenchmarkInputsAndUnitsBoundExactly: true,
  sourceBenchmarkRecoveryBoundExactly: true,
  sourceIndependentReferenceBoundExactly: true,
  coefficientLiteralBoundExactly: true,
  missingLiteralBindingRejected: true,
  engineeringActivationStillBlocked: true,
}));

function expectError(code, callback) {
  try { callback(); } catch (error) { assert.equal(error.code, code); return; }
  assert.fail(`Expected ${code}`);
}
