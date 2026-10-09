import { semanticHash } from '../../../shared-primitives/canonical-json.js';
import { validateWrc537Ed4EngineeringDatasetCandidate } from './ed4-engineering-dataset.js';

export const WRC537_ED4_CALCULATION_PLAN_SCHEMA = 'wrc537-ed4-calculation-plan/v1';
export const WRC537_ED4_QUALIFICATION_TRACE_SCHEMA = 'wrc537-ed4-qualification-calculation-trace/v1';

const PLAN_AUTHORITY = Object.freeze({
  engineeringUseAuthorized: false,
  authorizationBasis: 'SOURCE_BOUND_CALCULATION_PLAN_NOT_NUMERICAL_METHOD_QUALIFIED',
});
const TRACE_AUTHORITY = Object.freeze({
  engineeringUseAuthorized: false,
  authorizationBasis: 'QUALIFICATION_CALCULATION_EVIDENCE_NOT_ENGINEERING_RESULT',
});
const VARIABLE_ROLES = Object.freeze(['INPUT', 'DERIVED', 'COEFFICIENT', 'STRESS', 'RESULT', 'OTHER']);
const PRIMARY_SOURCE_CLASSES = Object.freeze(['PRIMARY_LICENSED', 'PRIMARY_AUTHORIZED']);

export function createWrc537Ed4CalculationPlan(datasetCandidateInput, input) {
  const datasetCandidate = validateWrc537Ed4EngineeringDatasetCandidate(datasetCandidateInput);
  requireObject(input, 'calculationPlanInput');
  exactKeys(input, [
    'schema', 'planIdentity', 'planVersion', 'datasetSemanticHash', 'sourceFamily',
    'sourceCoordinateSystem', 'sourceLoadReference', 'variables', 'equations',
    'interpolationRules', 'recoveryTargets', 'combinationRules', 'postProcessing',
  ], 'calculationPlanInput');
  if (input.schema !== WRC537_ED4_CALCULATION_PLAN_SCHEMA) {
    fail('WRC537_ED4_CALCULATION_PLAN_SCHEMA_MISMATCH', 'calculationPlanInput.schema');
  }
  requiredString(input.planIdentity, 'calculationPlanInput.planIdentity');
  requiredString(input.planVersion, 'calculationPlanInput.planVersion');
  if (input.datasetSemanticHash !== datasetCandidate.datasetSemanticHash) {
    fail('WRC537_ED4_CALCULATION_PLAN_DATASET_MISMATCH', 'calculationPlanInput.datasetSemanticHash');
  }

  const sourceLedgerById = new Map(datasetCandidate.sourceLedgerRows.map((row) => [row.record_id, row]));
  const sourceDocumentDigest = datasetCandidate.sourceBinding.sourceDocumentDigest;
  validateSourceDefinition(input.sourceFamily, 'calculationPlanInput.sourceFamily', sourceLedgerById, sourceDocumentDigest);
  validateSourceDefinition(input.sourceCoordinateSystem, 'calculationPlanInput.sourceCoordinateSystem', sourceLedgerById, sourceDocumentDigest);
  validateSourceDefinition(input.sourceLoadReference, 'calculationPlanInput.sourceLoadReference', sourceLedgerById, sourceDocumentDigest);
  validateVariables(input.variables, sourceLedgerById, sourceDocumentDigest);
  validateEquations(input.equations, input.variables, sourceLedgerById, sourceDocumentDigest);
  validateInterpolationRules(input.interpolationRules, input.variables, sourceLedgerById, sourceDocumentDigest);
  validateRecoveryTargets(input.recoveryTargets, input.variables, sourceLedgerById, sourceDocumentDigest);
  validateSourceDefinitionArray(input.combinationRules, 'calculationPlanInput.combinationRules', sourceLedgerById, sourceDocumentDigest);
  validateSourceDefinitionArray(input.postProcessing, 'calculationPlanInput.postProcessing', sourceLedgerById, sourceDocumentDigest);

  const base = {
    ...clone(input),
    authority: clone(PLAN_AUTHORITY),
  };
  return freeze({ ...base, planSemanticHash: semanticHash(base) });
}

export function validateWrc537Ed4CalculationPlan(datasetCandidateInput, value) {
  const datasetCandidate = validateWrc537Ed4EngineeringDatasetCandidate(datasetCandidateInput);
  requireObject(value, 'calculationPlan');
  exactKeys(value, [
    'schema', 'planIdentity', 'planVersion', 'datasetSemanticHash', 'sourceFamily',
    'sourceCoordinateSystem', 'sourceLoadReference', 'variables', 'equations',
    'interpolationRules', 'recoveryTargets', 'combinationRules', 'postProcessing',
    'authority', 'planSemanticHash',
  ], 'calculationPlan');
  exactKeys(value.authority, ['engineeringUseAuthorized', 'authorizationBasis'], 'calculationPlan.authority');
  if (value.authority.engineeringUseAuthorized !== PLAN_AUTHORITY.engineeringUseAuthorized
    || value.authority.authorizationBasis !== PLAN_AUTHORITY.authorizationBasis) {
    fail('WRC537_ED4_CALCULATION_PLAN_AUTHORITY_INVALID', 'calculationPlan.authority');
  }
  const { authority, planSemanticHash, ...input } = value;
  const reconstructed = createWrc537Ed4CalculationPlan(datasetCandidate, input);
  if (semanticHash({ ...input, authority }) !== planSemanticHash) {
    fail('WRC537_ED4_CALCULATION_PLAN_HASH_MISMATCH', 'calculationPlan.planSemanticHash');
  }
  if (reconstructed.planSemanticHash !== planSemanticHash) {
    fail('WRC537_ED4_CALCULATION_PLAN_REPLAY_MISMATCH', 'calculationPlan.planSemanticHash');
  }
  return reconstructed;
}

export function createWrc537Ed4QualificationTrace(datasetCandidateInput, planInput, evidenceInput) {
  const datasetCandidate = validateWrc537Ed4EngineeringDatasetCandidate(datasetCandidateInput);
  const plan = validateWrc537Ed4CalculationPlan(datasetCandidate, planInput);
  requireObject(evidenceInput, 'qualificationEvidence');
  exactKeys(evidenceInput, [
    'schema', 'traceIdentity', 'requestIdentity', 'datasetSemanticHash', 'planSemanticHash',
    'inputValues', 'equationSteps', 'recoveryResults', 'notes',
  ], 'qualificationEvidence');
  if (evidenceInput.schema !== WRC537_ED4_QUALIFICATION_TRACE_SCHEMA) {
    fail('WRC537_ED4_QUALIFICATION_TRACE_SCHEMA_MISMATCH', 'qualificationEvidence.schema');
  }
  requiredString(evidenceInput.traceIdentity, 'qualificationEvidence.traceIdentity');
  requiredString(evidenceInput.requestIdentity, 'qualificationEvidence.requestIdentity');
  if (evidenceInput.datasetSemanticHash !== datasetCandidate.datasetSemanticHash) {
    fail('WRC537_ED4_QUALIFICATION_TRACE_DATASET_MISMATCH', 'qualificationEvidence.datasetSemanticHash');
  }
  if (evidenceInput.planSemanticHash !== plan.planSemanticHash) {
    fail('WRC537_ED4_QUALIFICATION_TRACE_PLAN_MISMATCH', 'qualificationEvidence.planSemanticHash');
  }
  validateInputValues(evidenceInput.inputValues, plan.variables);
  validateEquationSteps(evidenceInput.equationSteps, plan.equations);
  validateRecoveryResults(evidenceInput.recoveryResults, plan.recoveryTargets);
  requireArray(evidenceInput.notes, 'qualificationEvidence.notes');
  evidenceInput.notes.forEach((note, index) => requiredString(note, `qualificationEvidence.notes[${index}]`));

  const base = {
    ...clone(evidenceInput),
    authority: clone(TRACE_AUTHORITY),
  };
  return freeze({ ...base, traceSemanticHash: semanticHash(base) });
}

export function validateWrc537Ed4QualificationTrace(datasetCandidateInput, planInput, value) {
  const datasetCandidate = validateWrc537Ed4EngineeringDatasetCandidate(datasetCandidateInput);
  const plan = validateWrc537Ed4CalculationPlan(datasetCandidate, planInput);
  requireObject(value, 'qualificationTrace');
  exactKeys(value, [
    'schema', 'traceIdentity', 'requestIdentity', 'datasetSemanticHash', 'planSemanticHash',
    'inputValues', 'equationSteps', 'recoveryResults', 'notes', 'authority', 'traceSemanticHash',
  ], 'qualificationTrace');
  exactKeys(value.authority, ['engineeringUseAuthorized', 'authorizationBasis'], 'qualificationTrace.authority');
  if (value.authority.engineeringUseAuthorized !== TRACE_AUTHORITY.engineeringUseAuthorized
    || value.authority.authorizationBasis !== TRACE_AUTHORITY.authorizationBasis) {
    fail('WRC537_ED4_QUALIFICATION_TRACE_AUTHORITY_INVALID', 'qualificationTrace.authority');
  }
  const { authority, traceSemanticHash, ...evidence } = value;
  const reconstructed = createWrc537Ed4QualificationTrace(datasetCandidate, plan, evidence);
  if (semanticHash({ ...evidence, authority }) !== traceSemanticHash) {
    fail('WRC537_ED4_QUALIFICATION_TRACE_HASH_MISMATCH', 'qualificationTrace.traceSemanticHash');
  }
  if (reconstructed.traceSemanticHash !== traceSemanticHash) {
    fail('WRC537_ED4_QUALIFICATION_TRACE_REPLAY_MISMATCH', 'qualificationTrace.traceSemanticHash');
  }
  return reconstructed;
}

export function wrc537Ed4NumericalAdapterCanExecuteEngineering(datasetCandidateInput, planInput) {
  const datasetCandidate = validateWrc537Ed4EngineeringDatasetCandidate(datasetCandidateInput);
  validateWrc537Ed4CalculationPlan(datasetCandidate, planInput);
  return false;
}

export function requireWrc537Ed4EngineeringExecution(datasetCandidateInput, planInput) {
  const datasetCandidate = validateWrc537Ed4EngineeringDatasetCandidate(datasetCandidateInput);
  validateWrc537Ed4CalculationPlan(datasetCandidate, planInput);
  fail('WRC537_ED4_NUMERICAL_METHOD_NOT_QUALIFIED', 'engineeringExecution');
}

function validateVariables(rows, ledger, digest) {
  requireArray(rows, 'calculationPlanInput.variables');
  if (rows.length === 0) fail('WRC537_ED4_CALCULATION_PLAN_VARIABLES_REQUIRED', 'calculationPlanInput.variables');
  unique(rows, 'variableId', 'calculationPlanInput.variables');
  rows.forEach((row, index) => {
    const path = `calculationPlanInput.variables[${index}]`;
    exactKeys(row, ['variableId', 'sourceSymbol', 'role', 'dimension', 'unitsPolicy', 'sourceRef', 'sourceLocator'], path);
    requiredString(row.variableId, `${path}.variableId`);
    requiredString(row.sourceSymbol, `${path}.sourceSymbol`);
    if (!VARIABLE_ROLES.includes(row.role)) fail('WRC537_ED4_VARIABLE_ROLE_UNSUPPORTED', `${path}.role`);
    requiredString(row.dimension, `${path}.dimension`);
    requiredString(row.unitsPolicy, `${path}.unitsPolicy`);
    validateSourceBinding(row, path, ledger, digest);
  });
}
function validateEquations(rows, variables, ledger, digest) {
  requireArray(rows, 'calculationPlanInput.equations');
  if (rows.length === 0) fail('WRC537_ED4_CALCULATION_PLAN_EQUATIONS_REQUIRED', 'calculationPlanInput.equations');
  unique(rows, 'equationId', 'calculationPlanInput.equations');
  const variableIds = new Set(variables.map((row) => row.variableId));
  rows.forEach((row, index) => {
    const path = `calculationPlanInput.equations[${index}]`;
    exactKeys(row, ['equationId', 'outputVariableId', 'inputVariableIds', 'sourceExpression', 'sourceRef', 'sourceLocator'], path);
    requiredString(row.equationId, `${path}.equationId`);
    if (!variableIds.has(row.outputVariableId)) fail('WRC537_ED4_EQUATION_OUTPUT_VARIABLE_UNKNOWN', `${path}.outputVariableId`);
    requireArray(row.inputVariableIds, `${path}.inputVariableIds`);
    row.inputVariableIds.forEach((id, inputIndex) => {
      requiredString(id, `${path}.inputVariableIds[${inputIndex}]`);
      if (!variableIds.has(id)) fail('WRC537_ED4_EQUATION_INPUT_VARIABLE_UNKNOWN', `${path}.inputVariableIds[${inputIndex}]`);
    });
    requiredString(row.sourceExpression, `${path}.sourceExpression`);
    validateSourceBinding(row, path, ledger, digest);
  });
}
function validateInterpolationRules(rows, variables, ledger, digest) {
  requireArray(rows, 'calculationPlanInput.interpolationRules');
  unique(rows, 'ruleId', 'calculationPlanInput.interpolationRules');
  const variableIds = new Set(variables.map((row) => row.variableId));
  rows.forEach((row, index) => {
    const path = `calculationPlanInput.interpolationRules[${index}]`;
    exactKeys(row, ['ruleId', 'inputVariableIds', 'outputVariableId', 'algorithm', 'boundaryBehavior', 'sourceRef', 'sourceLocator'], path);
    requiredString(row.ruleId, `${path}.ruleId`);
    requireArray(row.inputVariableIds, `${path}.inputVariableIds`);
    row.inputVariableIds.forEach((id) => { if (!variableIds.has(id)) fail('WRC537_ED4_INTERPOLATION_VARIABLE_UNKNOWN', path); });
    if (!variableIds.has(row.outputVariableId)) fail('WRC537_ED4_INTERPOLATION_VARIABLE_UNKNOWN', `${path}.outputVariableId`);
    requiredString(row.algorithm, `${path}.algorithm`);
    requiredString(row.boundaryBehavior, `${path}.boundaryBehavior`);
    validateSourceBinding(row, path, ledger, digest);
  });
}
function validateRecoveryTargets(rows, variables, ledger, digest) {
  requireArray(rows, 'calculationPlanInput.recoveryTargets');
  if (rows.length === 0) fail('WRC537_ED4_RECOVERY_TARGETS_REQUIRED', 'calculationPlanInput.recoveryTargets');
  unique(rows, 'targetId', 'calculationPlanInput.recoveryTargets');
  const variableIds = new Set(variables.map((row) => row.variableId));
  rows.forEach((row, index) => {
    const path = `calculationPlanInput.recoveryTargets[${index}]`;
    exactKeys(row, ['targetId', 'resultVariableIds', 'physicalLocation', 'surface', 'sourceRef', 'sourceLocator'], path);
    requiredString(row.targetId, `${path}.targetId`);
    requireArray(row.resultVariableIds, `${path}.resultVariableIds`);
    if (row.resultVariableIds.length === 0) fail('WRC537_ED4_RECOVERY_RESULT_VARIABLES_REQUIRED', `${path}.resultVariableIds`);
    row.resultVariableIds.forEach((id) => { if (!variableIds.has(id)) fail('WRC537_ED4_RECOVERY_VARIABLE_UNKNOWN', path); });
    requiredString(row.physicalLocation, `${path}.physicalLocation`);
    requiredString(row.surface, `${path}.surface`);
    validateSourceBinding(row, path, ledger, digest);
  });
}
function validateSourceDefinition(value, path, ledger, digest) {
  requireObject(value, path);
  exactKeys(value, ['definition', 'sourceRef', 'sourceLocator'], path);
  requiredString(value.definition, `${path}.definition`);
  validateSourceBinding(value, path, ledger, digest);
}
function validateSourceDefinitionArray(rows, path, ledger, digest) {
  requireArray(rows, path);
  rows.forEach((row, index) => validateSourceDefinition(row, `${path}[${index}]`, ledger, digest));
}
function validateSourceBinding(value, path, ledger, digest) {
  const sourceRef = requiredString(value.sourceRef, `${path}.sourceRef`);
  const sourceLocator = requiredString(value.sourceLocator, `${path}.sourceLocator`);
  const source = ledger.get(sourceRef);
  if (!source) fail('WRC537_ED4_CALCULATION_PLAN_SOURCE_REF_UNKNOWN', `${path}.sourceRef`);
  if (!PRIMARY_SOURCE_CLASSES.includes(source.authority_class)
    || source.verification_status !== 'PRIMARY_SOURCE_VERIFIED') {
    fail('WRC537_ED4_CALCULATION_PLAN_SOURCE_NOT_PRIMARY_VERIFIED', `${path}.sourceRef`);
  }
  if (source.record_scope !== 'DATUM'
    || typeof source.engineering_subject !== 'string' || !source.engineering_subject.trim()) {
    fail('WRC537_ED4_CALCULATION_PLAN_DATUM_SOURCE_REQUIRED', `${path}.sourceRef`);
  }
  if (source.document_digest !== digest) {
    fail('WRC537_ED4_CALCULATION_PLAN_SOURCE_DOCUMENT_MISMATCH', `${path}.sourceRef`);
  }
  if (source.locator !== sourceLocator) {
    fail('WRC537_ED4_CALCULATION_PLAN_SOURCE_LOCATOR_MISMATCH', `${path}.sourceLocator`);
  }
}
function validateInputValues(rows, variables) {
  requireArray(rows, 'qualificationEvidence.inputValues');
  const requiredInputs = variables.filter((row) => row.role === 'INPUT').map((row) => row.variableId).sort();
  const actualInputs = rows.map((row, index) => {
    const path = `qualificationEvidence.inputValues[${index}]`;
    exactKeys(row, ['variableId', 'value', 'units'], path);
    requiredString(row.variableId, `${path}.variableId`);
    validateValueRow(row, path);
    return row.variableId;
  });
  if (new Set(actualInputs).size !== actualInputs.length
    || actualInputs.slice().sort().join('|') !== requiredInputs.join('|')) {
    fail('WRC537_ED4_QUALIFICATION_INPUT_SET_MISMATCH', 'qualificationEvidence.inputValues');
  }
}
function validateEquationSteps(rows, equations) {
  requireArray(rows, 'qualificationEvidence.equationSteps');
  if (rows.length !== equations.length) fail('WRC537_ED4_QUALIFICATION_EQUATION_STEP_COUNT_MISMATCH', 'qualificationEvidence.equationSteps');
  equations.forEach((equation, index) => {
    const row = rows[index];
    const path = `qualificationEvidence.equationSteps[${index}]`;
    exactKeys(row, ['equationId', 'outputVariableId', 'value', 'units', 'sourceRef', 'sourceLocator'], path);
    if (row.equationId !== equation.equationId || row.outputVariableId !== equation.outputVariableId
      || row.sourceRef !== equation.sourceRef || row.sourceLocator !== equation.sourceLocator) {
      fail('WRC537_ED4_QUALIFICATION_EQUATION_STEP_BINDING_MISMATCH', path);
    }
    validateValueRow(row, path);
  });
}
function validateRecoveryResults(rows, targets) {
  requireArray(rows, 'qualificationEvidence.recoveryResults');
  const expected = [];
  targets.forEach((target) => target.resultVariableIds.forEach((variableId) => expected.push(`${target.targetId}:${variableId}`)));
  const actual = rows.map((row, index) => {
    const path = `qualificationEvidence.recoveryResults[${index}]`;
    exactKeys(row, ['targetId', 'variableId', 'value', 'units'], path);
    requiredString(row.targetId, `${path}.targetId`);
    requiredString(row.variableId, `${path}.variableId`);
    validateValueRow(row, path);
    return `${row.targetId}:${row.variableId}`;
  });
  if (new Set(actual).size !== actual.length || actual.length !== expected.length
    || actual.slice().sort().join('|') !== expected.slice().sort().join('|')) {
    fail('WRC537_ED4_QUALIFICATION_RECOVERY_RESULT_SET_MISMATCH', 'qualificationEvidence.recoveryResults');
  }
}
function validateValueRow(row, path) {
  if (!Number.isFinite(row.value)) fail('WRC537_ED4_QUALIFICATION_FINITE_VALUE_REQUIRED', `${path}.value`);
  requiredString(row.units, `${path}.units`);
}
function unique(rows, key, path) {
  const values = rows.map((row, index) => requiredString(row?.[key], `${path}[${index}].${key}`));
  if (new Set(values).size !== values.length) fail('WRC537_ED4_UNIQUE_ID_REQUIRED', path);
}
function requiredString(value, path) {
  if (typeof value !== 'string' || !value.trim()) fail('WRC537_ED4_STRING_REQUIRED', path);
  return value;
}
function exactKeys(value, expected, path) {
  requireObject(value, path);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(required)) fail('WRC537_ED4_EXACT_KEYS_MISMATCH', path);
}
function requireObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('WRC537_ED4_OBJECT_REQUIRED', path);
}
function requireArray(value, path) { if (!Array.isArray(value)) fail('WRC537_ED4_ARRAY_REQUIRED', path); }
function clone(value) { return structuredClone(value); }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
function fail(code, path) {
  const error = new Error(code);
  error.code = code;
  error.path = path;
  throw error;
}
