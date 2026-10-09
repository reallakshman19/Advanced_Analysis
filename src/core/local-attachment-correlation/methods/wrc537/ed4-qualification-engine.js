import { semanticHash } from '../../../shared-primitives/canonical-json.js';
import { validateWrc537Ed4EngineeringDatasetCandidate } from './ed4-engineering-dataset.js';
import { validateWrc537Ed4CalculationPlan } from './ed4-numerical-adapter.js';
import {
  executeWrc537Ed4QualificationCase,
  validateWrc537Ed4ExecutablePlan,
} from './ed4-execution-engine.js';

export const WRC537_ED4_NUMERICAL_QUALIFICATION_SUITE_SCHEMA = 'wrc537-ed4-numerical-qualification-suite/v1';
export const WRC537_ED4_NUMERICAL_QUALIFICATION_EVIDENCE_SCHEMA = 'wrc537-ed4-numerical-qualification-evidence/v1';
export const WRC537_ED4_NUMERICAL_QUALIFICATION_PASS = 'PASS';
export const WRC537_ED4_NUMERICAL_QUALIFICATION_FAIL = 'FAIL';

const EVIDENCE_AUTHORITY = Object.freeze({
  engineeringUseAuthorized: false,
  authorizationBasis: 'NUMERICAL_QUALIFICATION_EVIDENCE_REQUIRES_SEPARATE_APPROVAL_AND_TRUST',
});
const PRIMARY_SOURCE_CLASSES = Object.freeze(['PRIMARY_LICENSED', 'PRIMARY_AUTHORIZED']);

export function createWrc537Ed4NumericalQualificationSuite(datasetInput, calculationPlanInput, executablePlanInput, input) {
  const dataset = validateWrc537Ed4EngineeringDatasetCandidate(datasetInput);
  const calculationPlan = validateWrc537Ed4CalculationPlan(dataset, calculationPlanInput);
  const executablePlan = validateWrc537Ed4ExecutablePlan(dataset, calculationPlan, executablePlanInput);
  requireObject(input, 'qualificationSuiteInput');
  exactKeys(input, [
    'schema', 'suiteIdentity', 'suiteVersion', 'datasetSemanticHash', 'planSemanticHash',
    'executablePlanSemanticHash', 'cases',
  ], 'qualificationSuiteInput');
  if (input.schema !== WRC537_ED4_NUMERICAL_QUALIFICATION_SUITE_SCHEMA) {
    fail('WRC537_ED4_QUALIFICATION_SUITE_SCHEMA_MISMATCH', 'qualificationSuiteInput.schema');
  }
  requiredString(input.suiteIdentity, 'qualificationSuiteInput.suiteIdentity');
  requiredString(input.suiteVersion, 'qualificationSuiteInput.suiteVersion');
  if (input.datasetSemanticHash !== dataset.datasetSemanticHash
    || input.planSemanticHash !== calculationPlan.planSemanticHash
    || input.executablePlanSemanticHash !== executablePlan.executablePlanSemanticHash) {
    fail('WRC537_ED4_QUALIFICATION_SUITE_BINDING_MISMATCH', 'qualificationSuiteInput');
  }
  requireArray(input.cases, 'qualificationSuiteInput.cases');
  if (!input.cases.length) fail('WRC537_ED4_QUALIFICATION_CASES_REQUIRED', 'qualificationSuiteInput.cases');
  unique(input.cases, 'caseId', 'qualificationSuiteInput.cases');

  const ledger = new Map(dataset.sourceLedgerRows.map((row) => [row.record_id, row]));
  const expectedStepKeys = executablePlan.executionOrder.map((row) => `${row.kind}:${row.id}`);
  const expectedRecoveryKeys = calculationPlan.recoveryTargets.flatMap((target) =>
    target.resultVariableIds.map((variableId) => `${target.targetId}:${variableId}`));

  const cases = input.cases.map((row, index) => validateCase(
    row,
    `qualificationSuiteInput.cases[${index}]`,
    ledger,
    dataset.sourceBinding.sourceDocumentDigest,
    expectedStepKeys,
    expectedRecoveryKeys,
  ));
  const base = {
    schema: WRC537_ED4_NUMERICAL_QUALIFICATION_SUITE_SCHEMA,
    suiteIdentity: input.suiteIdentity,
    suiteVersion: input.suiteVersion,
    datasetSemanticHash: dataset.datasetSemanticHash,
    planSemanticHash: calculationPlan.planSemanticHash,
    executablePlanSemanticHash: executablePlan.executablePlanSemanticHash,
    cases,
  };
  return freeze({ ...base, suiteSemanticHash: semanticHash(base) });
}

export function validateWrc537Ed4NumericalQualificationSuite(datasetInput, calculationPlanInput, executablePlanInput, value) {
  requireObject(value, 'qualificationSuite');
  exactKeys(value, [
    'schema', 'suiteIdentity', 'suiteVersion', 'datasetSemanticHash', 'planSemanticHash',
    'executablePlanSemanticHash', 'cases', 'suiteSemanticHash',
  ], 'qualificationSuite');
  const { suiteSemanticHash, ...input } = value;
  const reconstructed = createWrc537Ed4NumericalQualificationSuite(
    datasetInput, calculationPlanInput, executablePlanInput, input,
  );
  if (suiteSemanticHash !== reconstructed.suiteSemanticHash) {
    fail('WRC537_ED4_QUALIFICATION_SUITE_HASH_MISMATCH', 'qualificationSuite.suiteSemanticHash');
  }
  return reconstructed;
}

export function runWrc537Ed4NumericalQualification(datasetInput, calculationPlanInput, executablePlanInput, suiteInput) {
  const dataset = validateWrc537Ed4EngineeringDatasetCandidate(datasetInput);
  const calculationPlan = validateWrc537Ed4CalculationPlan(dataset, calculationPlanInput);
  const executablePlan = validateWrc537Ed4ExecutablePlan(dataset, calculationPlan, executablePlanInput);
  const suite = validateWrc537Ed4NumericalQualificationSuite(dataset, calculationPlan, executablePlan, suiteInput);

  const caseEvidence = suite.cases.map((qualificationCase) => {
    const trace = executeWrc537Ed4QualificationCase(dataset, calculationPlan, executablePlan, qualificationCase.request);
    const stepByKey = new Map(trace.steps.map((row) => [`${row.kind}:${row.id}`, row]));
    const recoveryByKey = new Map(trace.recoveryResults.map((row) => [`${row.targetId}:${row.variableId}`, row]));
    const stepComparisons = qualificationCase.expectedSteps.map((expected) => compareExpected(
      expected,
      stepByKey.get(`${expected.kind}:${expected.id}`),
      `${expected.kind}:${expected.id}`,
    ));
    const recoveryComparisons = qualificationCase.expectedRecovery.map((expected) => compareExpected(
      expected,
      recoveryByKey.get(`${expected.targetId}:${expected.variableId}`),
      `${expected.targetId}:${expected.variableId}`,
    ));
    const all = [...stepComparisons, ...recoveryComparisons];
    return freeze({
      caseId: qualificationCase.caseId,
      trace,
      stepComparisons,
      recoveryComparisons,
      status: all.every((row) => row.status === WRC537_ED4_NUMERICAL_QUALIFICATION_PASS)
        ? WRC537_ED4_NUMERICAL_QUALIFICATION_PASS : WRC537_ED4_NUMERICAL_QUALIFICATION_FAIL,
    });
  });

  const base = {
    schema: WRC537_ED4_NUMERICAL_QUALIFICATION_EVIDENCE_SCHEMA,
    datasetSemanticHash: dataset.datasetSemanticHash,
    planSemanticHash: calculationPlan.planSemanticHash,
    executablePlanSemanticHash: executablePlan.executablePlanSemanticHash,
    suiteSemanticHash: suite.suiteSemanticHash,
    cases: caseEvidence,
    status: caseEvidence.every((row) => row.status === WRC537_ED4_NUMERICAL_QUALIFICATION_PASS)
      ? WRC537_ED4_NUMERICAL_QUALIFICATION_PASS : WRC537_ED4_NUMERICAL_QUALIFICATION_FAIL,
    authority: clone(EVIDENCE_AUTHORITY),
  };
  return freeze({ ...base, evidenceSemanticHash: semanticHash(base) });
}

export function validateWrc537Ed4NumericalQualificationEvidence(
  datasetInput, calculationPlanInput, executablePlanInput, suiteInput, value,
) {
  requireObject(value, 'qualificationEvidence');
  exactKeys(value, [
    'schema', 'datasetSemanticHash', 'planSemanticHash', 'executablePlanSemanticHash',
    'suiteSemanticHash', 'cases', 'status', 'authority', 'evidenceSemanticHash',
  ], 'qualificationEvidence');
  exactKeys(value.authority, ['engineeringUseAuthorized', 'authorizationBasis'], 'qualificationEvidence.authority');
  if (value.schema !== WRC537_ED4_NUMERICAL_QUALIFICATION_EVIDENCE_SCHEMA
    || value.authority.engineeringUseAuthorized !== false
    || value.authority.authorizationBasis !== EVIDENCE_AUTHORITY.authorizationBasis) {
    fail('WRC537_ED4_QUALIFICATION_EVIDENCE_AUTHORITY_OR_SCHEMA_INVALID', 'qualificationEvidence');
  }
  const reproduced = runWrc537Ed4NumericalQualification(
    datasetInput, calculationPlanInput, executablePlanInput, suiteInput,
  );
  if (reproduced.evidenceSemanticHash !== value.evidenceSemanticHash) {
    fail('WRC537_ED4_QUALIFICATION_EVIDENCE_REPLAY_MISMATCH', 'qualificationEvidence.evidenceSemanticHash');
  }
  return reproduced;
}

export function wrc537Ed4NumericalQualificationCanActivateEngineering(
  datasetInput, calculationPlanInput, executablePlanInput, suiteInput, evidenceInput,
) {
  const evidence = validateWrc537Ed4NumericalQualificationEvidence(
    datasetInput, calculationPlanInput, executablePlanInput, suiteInput, evidenceInput,
  );
  if (evidence.status !== WRC537_ED4_NUMERICAL_QUALIFICATION_PASS) return false;
  return false;
}

function validateCase(row, path, ledger, digest, expectedStepKeys, expectedRecoveryKeys) {
  requireObject(row, path);
  exactKeys(row, [
    'caseId', 'sourceRef', 'sourceLocator', 'independentReproduction',
    'independentCalculationReference', 'request', 'expectedSteps', 'expectedRecovery',
  ], path);
  requiredString(row.caseId, `${path}.caseId`);
  sourceDatum(row.sourceRef, row.sourceLocator, ledger, digest, path);
  if (row.independentReproduction !== true) fail('WRC537_ED4_QUALIFICATION_INDEPENDENT_REPRODUCTION_REQUIRED', `${path}.independentReproduction`);
  requiredString(row.independentCalculationReference, `${path}.independentCalculationReference`);
  requireObject(row.request, `${path}.request`);
  exactKeys(row.request, ['requestIdentity', 'inputValues'], `${path}.request`);
  requiredString(row.request.requestIdentity, `${path}.request.requestIdentity`);
  requireArray(row.request.inputValues, `${path}.request.inputValues`);
  requireArray(row.expectedSteps, `${path}.expectedSteps`);
  requireArray(row.expectedRecovery, `${path}.expectedRecovery`);
  validateExpectedSet(row.expectedSteps, expectedStepKeys, `${path}.expectedSteps`, true, ledger, digest);
  validateExpectedSet(row.expectedRecovery, expectedRecoveryKeys, `${path}.expectedRecovery`, false, ledger, digest);
  return freeze(clone(row));
}

function validateExpectedSet(rows, expectedKeys, path, step, ledger, digest) {
  const actualKeys = rows.map((row, index) => {
    const itemPath = `${path}[${index}]`;
    if (step) {
      exactKeys(row, ['kind', 'id', 'value', 'units', 'absoluteTolerance', 'toleranceBasis', 'sourceRef', 'sourceLocator'], itemPath);
    } else {
      exactKeys(row, ['targetId', 'variableId', 'value', 'units', 'absoluteTolerance', 'toleranceBasis', 'sourceRef', 'sourceLocator'], itemPath);
    }
    finite(row.value, `${itemPath}.value`);
    requiredString(row.units, `${itemPath}.units`);
    if (!Number.isFinite(row.absoluteTolerance) || row.absoluteTolerance < 0) {
      fail('WRC537_ED4_QUALIFICATION_TOLERANCE_INVALID', `${itemPath}.absoluteTolerance`);
    }
    requiredString(row.toleranceBasis, `${itemPath}.toleranceBasis`);
    sourceDatum(row.sourceRef, row.sourceLocator, ledger, digest, itemPath);
    return step ? `${row.kind}:${row.id}` : `${row.targetId}:${row.variableId}`;
  });
  if (new Set(actualKeys).size !== actualKeys.length
    || actualKeys.slice().sort().join('|') !== expectedKeys.slice().sort().join('|')) {
    fail('WRC537_ED4_QUALIFICATION_EXPECTED_SET_MISMATCH', path);
  }
}

function compareExpected(expected, actual, identity) {
  if (!actual) fail('WRC537_ED4_QUALIFICATION_ACTUAL_VALUE_MISSING', identity);
  if (actual.units !== expected.units) {
    return freeze({ identity, expected: expected.value, actual: actual.value, units: actual.units,
      absoluteError: Number.POSITIVE_INFINITY, absoluteTolerance: expected.absoluteTolerance,
      toleranceBasis: expected.toleranceBasis, status: WRC537_ED4_NUMERICAL_QUALIFICATION_FAIL });
  }
  const absoluteError = Math.abs(actual.value - expected.value);
  return freeze({
    identity,
    expected: expected.value,
    actual: actual.value,
    units: actual.units,
    absoluteError,
    absoluteTolerance: expected.absoluteTolerance,
    toleranceBasis: expected.toleranceBasis,
    status: absoluteError <= expected.absoluteTolerance
      ? WRC537_ED4_NUMERICAL_QUALIFICATION_PASS : WRC537_ED4_NUMERICAL_QUALIFICATION_FAIL,
  });
}

function sourceDatum(sourceRef, sourceLocator, ledger, digest, path) {
  requiredString(sourceRef, `${path}.sourceRef`);
  requiredString(sourceLocator, `${path}.sourceLocator`);
  const source = ledger.get(sourceRef);
  if (!source || !PRIMARY_SOURCE_CLASSES.includes(source.authority_class)
    || source.record_scope !== 'DATUM' || source.verification_status !== 'PRIMARY_SOURCE_VERIFIED'
    || source.document_digest !== digest || source.locator !== sourceLocator) {
    fail('WRC537_ED4_QUALIFICATION_SOURCE_DATUM_INVALID', path);
  }
}
function unique(rows, key, path) {
  const values = rows.map((row, index) => requiredString(row[key], `${path}[${index}].${key}`));
  if (new Set(values).size !== values.length) fail('WRC537_ED4_QUALIFICATION_DUPLICATE_ID', path);
}
function exactKeys(value, expected, path) {
  requireObject(value, path);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) fail('WRC537_ED4_EXACT_KEYS_MISMATCH', path);
}
function requiredString(value, path) { if (typeof value !== 'string' || !value.trim()) fail('WRC537_ED4_STRING_REQUIRED', path); return value; }
function requireObject(value, path) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail('WRC537_ED4_OBJECT_REQUIRED', path); }
function requireArray(value, path) { if (!Array.isArray(value)) fail('WRC537_ED4_ARRAY_REQUIRED', path); }
function finite(value, path) { if (!Number.isFinite(value)) fail('WRC537_ED4_FINITE_NUMBER_REQUIRED', path); return value; }
function clone(value) { return structuredClone(value); }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.values(value).forEach(freeze); return Object.freeze(value); }
function fail(code, path) { const error = new Error(code); error.code = code; error.path = path; throw error; }
