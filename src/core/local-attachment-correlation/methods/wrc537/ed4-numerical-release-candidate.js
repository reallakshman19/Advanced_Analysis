import { semanticHash } from '../../../shared-primitives/canonical-json.js';
import { validateWrc537Ed4EngineeringDatasetCandidate } from './ed4-engineering-dataset.js';
import { validateWrc537Ed4CalculationPlan } from './ed4-numerical-adapter.js';
import { validateWrc537Ed4ExecutablePlan } from './ed4-execution-engine.js';
import {
  WRC537_ED4_NUMERICAL_QUALIFICATION_PASS,
  validateWrc537Ed4NumericalQualificationEvidence,
  validateWrc537Ed4NumericalQualificationSuite,
} from './ed4-qualification-engine.js';

export const WRC537_ED4_NUMERICAL_RELEASE_CANDIDATE_SCHEMA = 'wrc537-ed4-numerical-release-candidate/v1';
const AUTHORITY = Object.freeze({
  engineeringUseAuthorized: false,
  authorizationBasis: 'NUMERICALLY_QUALIFIED_CANDIDATE_AWAITING_INDEPENDENT_APPROVAL_AND_TRUST',
});
const BINDING_TYPES = Object.freeze(['DATASET_COEFFICIENT', 'SOURCE_LITERAL']);

export function createWrc537Ed4NumericalReleaseCandidate(
  datasetInput, calculationPlanInput, executablePlanInput, suiteInput, evidenceInput, input,
) {
  const dataset = validateWrc537Ed4EngineeringDatasetCandidate(datasetInput);
  const calculationPlan = validateWrc537Ed4CalculationPlan(dataset, calculationPlanInput);
  const executablePlan = validateWrc537Ed4ExecutablePlan(dataset, calculationPlan, executablePlanInput);
  const suite = validateWrc537Ed4NumericalQualificationSuite(dataset, calculationPlan, executablePlan, suiteInput);
  const evidence = validateWrc537Ed4NumericalQualificationEvidence(
    dataset, calculationPlan, executablePlan, suite, evidenceInput,
  );
  if (evidence.status !== WRC537_ED4_NUMERICAL_QUALIFICATION_PASS) {
    fail('WRC537_ED4_NUMERICAL_RELEASE_QUALIFICATION_NOT_PASS', 'evidence.status');
  }
  validateGraphInputCustody(calculationPlan, executablePlan);
  requireObject(input, 'releaseCandidateInput');
  exactKeys(input, [
    'schema', 'candidateIdentity', 'candidateVersion', 'benchmarkBindings', 'literalBindings',
  ], 'releaseCandidateInput');
  if (input.schema !== WRC537_ED4_NUMERICAL_RELEASE_CANDIDATE_SCHEMA) {
    fail('WRC537_ED4_NUMERICAL_RELEASE_SCHEMA_MISMATCH', 'releaseCandidateInput.schema');
  }
  requiredString(input.candidateIdentity, 'releaseCandidateInput.candidateIdentity');
  requiredString(input.candidateVersion, 'releaseCandidateInput.candidateVersion');
  const benchmarkBindings = validateSourceBenchmarkBindings(input.benchmarkBindings, dataset, suite);
  const literalInventory = executableLiteralInventory(executablePlan);
  const literalBindings = validateLiteralBindings(input.literalBindings, literalInventory, dataset);

  const base = {
    schema: WRC537_ED4_NUMERICAL_RELEASE_CANDIDATE_SCHEMA,
    candidateIdentity: input.candidateIdentity,
    candidateVersion: input.candidateVersion,
    datasetSemanticHash: dataset.datasetSemanticHash,
    planSemanticHash: calculationPlan.planSemanticHash,
    executablePlanSemanticHash: executablePlan.executablePlanSemanticHash,
    suiteSemanticHash: suite.suiteSemanticHash,
    evidenceSemanticHash: evidence.evidenceSemanticHash,
    benchmarkBindings,
    literalInventory,
    literalBindings,
    authority: clone(AUTHORITY),
  };
  return freeze({ ...base, candidateSemanticHash: semanticHash(base) });
}

export function validateWrc537Ed4NumericalReleaseCandidate(
  datasetInput, calculationPlanInput, executablePlanInput, suiteInput, evidenceInput, value,
) {
  requireObject(value, 'releaseCandidate');
  exactKeys(value, [
    'schema', 'candidateIdentity', 'candidateVersion', 'datasetSemanticHash', 'planSemanticHash',
    'executablePlanSemanticHash', 'suiteSemanticHash', 'evidenceSemanticHash', 'benchmarkBindings',
    'literalInventory', 'literalBindings', 'authority', 'candidateSemanticHash',
  ], 'releaseCandidate');
  exactKeys(value.authority, ['engineeringUseAuthorized', 'authorizationBasis'], 'releaseCandidate.authority');
  if (value.authority.engineeringUseAuthorized !== false || value.authority.authorizationBasis !== AUTHORITY.authorizationBasis) {
    fail('WRC537_ED4_NUMERICAL_RELEASE_AUTHORITY_INVALID', 'releaseCandidate.authority');
  }
  const recreated = createWrc537Ed4NumericalReleaseCandidate(
    datasetInput, calculationPlanInput, executablePlanInput, suiteInput, evidenceInput,
    {
      schema: value.schema,
      candidateIdentity: value.candidateIdentity,
      candidateVersion: value.candidateVersion,
      benchmarkBindings: value.benchmarkBindings,
      literalBindings: value.literalBindings,
    },
  );
  if (semanticHash(value.benchmarkBindings) !== semanticHash(recreated.benchmarkBindings)
    || semanticHash(value.literalInventory) !== semanticHash(recreated.literalInventory)
    || recreated.candidateSemanticHash !== value.candidateSemanticHash) {
    fail('WRC537_ED4_NUMERICAL_RELEASE_REPLAY_MISMATCH', 'releaseCandidate.candidateSemanticHash');
  }
  return recreated;
}

export function wrc537Ed4NumericalReleaseCandidateCanActivateEngineering(
  datasetInput, calculationPlanInput, executablePlanInput, suiteInput, evidenceInput, candidateInput,
) {
  validateWrc537Ed4NumericalReleaseCandidate(
    datasetInput, calculationPlanInput, executablePlanInput, suiteInput, evidenceInput, candidateInput,
  );
  return false;
}

export function executableLiteralInventory(executablePlanInput) {
  requireObject(executablePlanInput, 'executablePlan');
  const rows = [];
  executablePlanInput.equationImplementations.forEach((implementation) => {
    collectGraphLiterals(
      implementation.graph,
      `EQUATION:${implementation.equationId}:graph`,
      implementation.sourceRef,
      implementation.sourceLocator,
      rows,
    );
  });
  executablePlanInput.interpolationImplementations.forEach((implementation) => {
    collectGraphLiterals(
      implementation.graph,
      `INTERPOLATION:${implementation.ruleId}:graph`,
      implementation.sourceRef,
      implementation.sourceLocator,
      rows,
    );
  });
  rows.sort((a, b) => a.literalKey.localeCompare(b.literalKey));
  return freeze(rows);
}

function validateGraphInputCustody(calculationPlan, executablePlan) {
  const equationById = new Map(calculationPlan.equations.map((row) => [row.equationId, row]));
  executablePlan.equationImplementations.forEach((implementation) => {
    const sourceEquation = equationById.get(implementation.equationId);
    const expected = sourceEquation.inputVariableIds.slice().sort();
    const actual = [...graphVariableRefs(implementation.graph)].sort();
    if (actual.join('|') !== expected.join('|')) {
      fail('WRC537_ED4_NUMERICAL_RELEASE_EQUATION_INPUT_CUSTODY_MISMATCH', implementation.equationId);
    }
  });
  const interpolationById = new Map(calculationPlan.interpolationRules.map((row) => [row.ruleId, row]));
  executablePlan.interpolationImplementations.forEach((implementation) => {
    const sourceRule = interpolationById.get(implementation.ruleId);
    const expected = sourceRule.inputVariableIds.slice().sort();
    const actual = [...graphVariableRefs(implementation.graph)].sort();
    if (actual.join('|') !== expected.join('|')) {
      fail('WRC537_ED4_NUMERICAL_RELEASE_INTERPOLATION_INPUT_CUSTODY_MISMATCH', implementation.ruleId);
    }
  });
}

function graphVariableRefs(node, refs = new Set()) {
  if (node.op === 'VAR') refs.add(node.variableId);
  if (node.arg) graphVariableRefs(node.arg, refs);
  if (Array.isArray(node.args)) node.args.forEach((child) => graphVariableRefs(child, refs));
  if (node.x) graphVariableRefs(node.x, refs);
  ['x0', 'x1', 'y0', 'y1'].forEach((key) => { if (node[key]) graphVariableRefs(node[key], refs); });
  return refs;
}

function validateSourceBenchmarkBindings(rows, dataset, suite) {
  requireArray(rows, 'releaseCandidateInput.benchmarkBindings');
  const benchmarks = dataset.sourcePackage?.benchmarks;
  if (!Array.isArray(benchmarks) || !benchmarks.length) {
    fail('WRC537_ED4_NUMERICAL_RELEASE_SOURCE_BENCHMARKS_REQUIRED', 'dataset.sourcePackage.benchmarks');
  }
  const benchmarkById = new Map(benchmarks.map((row) => [row.caseId, row]));
  const caseById = new Map(suite.cases.map((row) => [row.caseId, row]));
  const ledgerById = new Map(dataset.sourceLedgerRows.map((row) => [row.record_id, row]));

  const benchmarkIds = rows.map((row, index) =>
    requiredString(row.sourceBenchmarkCaseId, `releaseCandidateInput.benchmarkBindings[${index}].sourceBenchmarkCaseId`));
  const expectedBenchmarkIds = benchmarks.map((row) => row.caseId).slice().sort();
  if (new Set(benchmarkIds).size !== benchmarkIds.length
    || benchmarkIds.slice().sort().join('|') !== expectedBenchmarkIds.join('|')) {
    fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_COVERAGE_MISMATCH', 'releaseCandidateInput.benchmarkBindings');
  }

  const qualificationCaseIds = new Set();
  const normalized = rows.map((row, index) => {
    const path = `releaseCandidateInput.benchmarkBindings[${index}]`;
    requireObject(row, path);
    exactKeys(row, [
      'sourceBenchmarkCaseId', 'qualificationCaseId', 'inputBindings', 'recoveryBindings',
    ], path);
    const benchmark = benchmarkById.get(row.sourceBenchmarkCaseId);
    const qualificationCaseId = requiredString(row.qualificationCaseId, `${path}.qualificationCaseId`);
    if (qualificationCaseIds.has(qualificationCaseId)) {
      fail('WRC537_ED4_NUMERICAL_RELEASE_QUALIFICATION_CASE_REUSED', `${path}.qualificationCaseId`);
    }
    qualificationCaseIds.add(qualificationCaseId);
    const qualificationCase = caseById.get(qualificationCaseId);
    if (!qualificationCase) {
      fail('WRC537_ED4_NUMERICAL_RELEASE_QUALIFICATION_CASE_UNKNOWN', `${path}.qualificationCaseId`);
    }

    const benchmarkLocator = ledgerById.get(benchmark.sourceRef)?.locator;
    if (qualificationCase.sourceRef !== benchmark.sourceRef
      || qualificationCase.sourceLocator !== benchmarkLocator
      || qualificationCase.independentReproduction !== true
      || qualificationCase.independentCalculationReference !== benchmark.independentCalculationReference) {
      fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_CASE_CUSTODY_MISMATCH', path);
    }

    const inputBindings = validateBenchmarkInputBindings(
      row.inputBindings,
      benchmark.input,
      benchmark.inputEvidence,
      qualificationCase.request.inputValues,
      `${path}.inputBindings`,
    );
    const recoveryBindings = validateBenchmarkRecoveryBindings(
      row.recoveryBindings, benchmark.expectedResults, qualificationCase.expectedRecovery,
      `${path}.recoveryBindings`,
    );
    return {
      sourceBenchmarkCaseId: row.sourceBenchmarkCaseId,
      qualificationCaseId,
      inputBindings,
      recoveryBindings,
    };
  });
  normalized.sort((a, b) => a.sourceBenchmarkCaseId.localeCompare(b.sourceBenchmarkCaseId));
  return freeze(normalized);
}

function validateBenchmarkInputBindings(rows, benchmarkInput, benchmarkInputEvidence, requestInputValues, path) {
  requireArray(rows, path);
  requireObject(benchmarkInput, `${path}.benchmarkInput`);
  requireArray(benchmarkInputEvidence, `${path}.benchmarkInputEvidence`);

  const evidenceById = new Map();
  benchmarkInputEvidence.forEach((row, index) => {
    const evidencePath = `${path}.benchmarkInputEvidence[${index}]`;
    const inputId = requiredString(row.inputId, `${evidencePath}.inputId`);
    if (evidenceById.has(inputId)) {
      fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_INPUT_EVIDENCE_DUPLICATE', evidencePath);
    }
    requiredString(row.units, `${evidencePath}.units`);
    const benchmarkValue = benchmarkNumericPath(benchmarkInput, row.benchmarkPath, `${evidencePath}.benchmarkPath`);
    evidenceById.set(inputId, { ...row, benchmarkValue });
  });

  const requestById = new Map();
  requestInputValues.forEach((row, index) => {
    const requestPath = `${path}.requestInputValues[${index}]`;
    requireObject(row, requestPath);
    exactKeys(row, ['variableId', 'value', 'units'], requestPath);
    const variableId = requiredString(row.variableId, `${requestPath}.variableId`);
    if (requestById.has(variableId)) {
      fail('WRC537_ED4_NUMERICAL_RELEASE_DUPLICATE_QUALIFICATION_INPUT', requestPath);
    }
    if (!Number.isFinite(row.value)) {
      fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_INPUT_VALUE_INVALID', `${requestPath}.value`);
    }
    requiredString(row.units, `${requestPath}.units`);
    requestById.set(variableId, row);
  });

  const bindingIds = [];
  const evidenceIds = [];
  const normalized = rows.map((row, index) => {
    const itemPath = `${path}[${index}]`;
    requireObject(row, itemPath);
    exactKeys(row, ['variableId', 'benchmarkInputId'], itemPath);
    const variableId = requiredString(row.variableId, `${itemPath}.variableId`);
    const benchmarkInputId = requiredString(row.benchmarkInputId, `${itemPath}.benchmarkInputId`);
    const request = requestById.get(variableId);
    if (!request) fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_INPUT_VARIABLE_UNKNOWN', itemPath);
    const evidence = evidenceById.get(benchmarkInputId);
    if (!evidence) fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_INPUT_EVIDENCE_UNKNOWN', itemPath);
    if (request.value !== evidence.benchmarkValue) {
      fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_INPUT_VALUE_MISMATCH', itemPath);
    }
    if (request.units !== evidence.units) {
      fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_INPUT_UNITS_MISMATCH', itemPath);
    }
    bindingIds.push(variableId);
    evidenceIds.push(benchmarkInputId);
    return { variableId, benchmarkInputId };
  });

  const expectedRequestIds = [...requestById.keys()].sort();
  const expectedEvidenceIds = [...evidenceById.keys()].sort();
  if (new Set(bindingIds).size !== bindingIds.length
    || bindingIds.slice().sort().join('|') !== expectedRequestIds.join('|')) {
    fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_INPUT_BINDING_SET_MISMATCH', path);
  }
  if (new Set(evidenceIds).size !== evidenceIds.length
    || evidenceIds.slice().sort().join('|') !== expectedEvidenceIds.join('|')) {
    fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_INPUT_EVIDENCE_SET_MISMATCH', path);
  }
  normalized.sort((a, b) => a.variableId.localeCompare(b.variableId));
  return freeze(normalized);
}

function benchmarkNumericPath(root, segments, path) {
  requireArray(segments, path);
  if (!segments.length) fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_PATH_REQUIRED', path);
  let value = root;
  segments.forEach((segment, index) => {
    const segmentPath = `${path}[${index}]`;
    const validString = typeof segment === 'string' && segment.trim().length > 0;
    const validIndex = Number.isInteger(segment) && segment >= 0;
    if (!validString && !validIndex) {
      fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_PATH_SEGMENT_INVALID', segmentPath);
    }
    if (value === null || value === undefined || typeof value !== 'object' || !(segment in value)) {
      fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_PATH_NOT_FOUND', segmentPath);
    }
    value = value[segment];
  });
  if (!Number.isFinite(value)) {
    fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_INPUT_VALUE_INVALID', path);
  }
  return value;
}

function validateBenchmarkRecoveryBindings(rows, benchmarkResults, expectedRecovery, path) {
  requireArray(rows, path);
  requireArray(benchmarkResults, `${path}.benchmarkResults`);
  const recoveryByKey = new Map(expectedRecovery.map((row) => [`${row.targetId}:${row.variableId}`, row]));
  const benchmarkByQuantity = new Map();
  benchmarkResults.forEach((row, index) => {
    const resultPath = `${path}.benchmarkResults[${index}]`;
    const quantity = requiredString(row.quantity, `${resultPath}.quantity`);
    if (benchmarkByQuantity.has(quantity)) {
      fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_RESULT_QUANTITY_DUPLICATE', resultPath);
    }
    benchmarkByQuantity.set(quantity, row);
  });

  const recoveryKeys = [];
  const benchmarkQuantities = [];
  const normalized = rows.map((row, index) => {
    const itemPath = `${path}[${index}]`;
    requireObject(row, itemPath);
    exactKeys(row, ['targetId', 'variableId', 'benchmarkQuantity'], itemPath);
    const targetId = requiredString(row.targetId, `${itemPath}.targetId`);
    const variableId = requiredString(row.variableId, `${itemPath}.variableId`);
    const benchmarkQuantity = requiredString(row.benchmarkQuantity, `${itemPath}.benchmarkQuantity`);
    const recoveryKey = `${targetId}:${variableId}`;
    const expected = recoveryByKey.get(recoveryKey);
    if (!expected) fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_RECOVERY_UNKNOWN', itemPath);
    const benchmarkResult = benchmarkByQuantity.get(benchmarkQuantity);
    if (!benchmarkResult) fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_RESULT_UNKNOWN', itemPath);
    if (expected.value !== benchmarkResult.value
      || expected.units !== benchmarkResult.units
      || expected.absoluteTolerance !== benchmarkResult.absoluteTolerance
      || expected.toleranceBasis !== benchmarkResult.toleranceBasis
      || expected.sourceRef !== benchmarkResult.sourceRef
      || expected.sourceLocator !== benchmarkResult.sourceLocator) {
      fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_RECOVERY_VALUE_MISMATCH', itemPath);
    }
    recoveryKeys.push(recoveryKey);
    benchmarkQuantities.push(benchmarkQuantity);
    return { targetId, variableId, benchmarkQuantity };
  });

  const expectedRecoveryKeys = [...recoveryByKey.keys()].sort();
  const expectedBenchmarkQuantities = [...benchmarkByQuantity.keys()].sort();
  if (new Set(recoveryKeys).size !== recoveryKeys.length
    || recoveryKeys.slice().sort().join('|') !== expectedRecoveryKeys.join('|')
    || new Set(benchmarkQuantities).size !== benchmarkQuantities.length
    || benchmarkQuantities.slice().sort().join('|') !== expectedBenchmarkQuantities.join('|')) {
    fail('WRC537_ED4_NUMERICAL_RELEASE_BENCHMARK_RECOVERY_BINDING_SET_MISMATCH', path);
  }
  normalized.sort((a, b) => `${a.targetId}:${a.variableId}`.localeCompare(`${b.targetId}:${b.variableId}`));
  return freeze(normalized);
}

function collectGraphLiterals(node, path, sourceRef, sourceLocator, rows) {
  if (node.op === 'CONST') rows.push({ literalKey: `${path}.value`, value: node.value, sourceRef, sourceLocator });
  if (node.op === 'POLYNOMIAL') {
    node.coefficients.forEach((value, index) => rows.push({
      literalKey: `${path}.coefficients[${index}]`, value, sourceRef, sourceLocator,
    }));
  }
  if (node.arg) collectGraphLiterals(node.arg, `${path}.arg`, sourceRef, sourceLocator, rows);
  if (Array.isArray(node.args)) node.args.forEach((child, index) =>
    collectGraphLiterals(child, `${path}.args[${index}]`, sourceRef, sourceLocator, rows));
  if (node.x) collectGraphLiterals(node.x, `${path}.x`, sourceRef, sourceLocator, rows);
  ['x0', 'x1', 'y0', 'y1'].forEach((key) => {
    if (node[key]) collectGraphLiterals(node[key], `${path}.${key}`, sourceRef, sourceLocator, rows);
  });
}

function validateLiteralBindings(rows, inventory, dataset) {
  requireArray(rows, 'releaseCandidateInput.literalBindings');
  const expected = inventory.map((row) => row.literalKey).sort();
  const actual = rows.map((row, index) => requiredString(row.literalKey, `releaseCandidateInput.literalBindings[${index}].literalKey`));
  if (new Set(actual).size !== actual.length || actual.slice().sort().join('|') !== expected.join('|')) {
    fail('WRC537_ED4_NUMERICAL_RELEASE_LITERAL_BINDING_SET_MISMATCH', 'releaseCandidateInput.literalBindings');
  }
  const inventoryByKey = new Map(inventory.map((row) => [row.literalKey, row]));
  const coefficientById = new Map(dataset.coefficientRows.map((row) => [row.coefficient_id, row]));
  const bindings = rows.map((row, index) => {
    const path = `releaseCandidateInput.literalBindings[${index}]`;
    exactKeys(row, ['literalKey', 'bindingType', 'coefficientId', 'sourceRef', 'sourceLocator'], path);
    if (!BINDING_TYPES.includes(row.bindingType)) fail('WRC537_ED4_NUMERICAL_RELEASE_BINDING_TYPE_INVALID', `${path}.bindingType`);
    const literal = inventoryByKey.get(row.literalKey);
    if (row.bindingType === 'DATASET_COEFFICIENT') {
      requiredString(row.coefficientId, `${path}.coefficientId`);
      const coefficient = coefficientById.get(row.coefficientId);
      if (!coefficient) fail('WRC537_ED4_NUMERICAL_RELEASE_COEFFICIENT_UNKNOWN', `${path}.coefficientId`);
      const value = Number(coefficient.coefficient_value);
      if (!Number.isFinite(value) || value !== literal.value) {
        fail('WRC537_ED4_NUMERICAL_RELEASE_COEFFICIENT_VALUE_MISMATCH', path);
      }
      if (row.sourceRef !== coefficient.source_ref || row.sourceLocator !== coefficient.source_locator) {
        fail('WRC537_ED4_NUMERICAL_RELEASE_COEFFICIENT_SOURCE_MISMATCH', path);
      }
    } else {
      if (row.coefficientId !== null) {
        fail('WRC537_ED4_NUMERICAL_RELEASE_SOURCE_LITERAL_COEFFICIENT_MUST_BE_NULL', `${path}.coefficientId`);
      }
      if (row.sourceRef !== literal.sourceRef || row.sourceLocator !== literal.sourceLocator) {
        fail('WRC537_ED4_NUMERICAL_RELEASE_SOURCE_LITERAL_BINDING_MISMATCH', path);
      }
    }
    return clone(row);
  });
  bindings.sort((a, b) => a.literalKey.localeCompare(b.literalKey));
  return freeze(bindings);
}

function exactKeys(value, expected, path) {
  requireObject(value, path);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    fail('WRC537_ED4_EXACT_KEYS_MISMATCH', path);
  }
}
function requiredString(value, path) {
  if (typeof value !== 'string' || !value.trim()) fail('WRC537_ED4_STRING_REQUIRED', path);
  return value;
}
function requireObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('WRC537_ED4_OBJECT_REQUIRED', path);
}
function requireArray(value, path) {
  if (!Array.isArray(value)) fail('WRC537_ED4_ARRAY_REQUIRED', path);
}
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
