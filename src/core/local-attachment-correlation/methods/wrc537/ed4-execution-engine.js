import { semanticHash } from '../../../shared-primitives/canonical-json.js';
import { validateWrc537Ed4EngineeringDatasetCandidate } from './ed4-engineering-dataset.js';
import { validateWrc537Ed4CalculationPlan } from './ed4-numerical-adapter.js';

export const WRC537_ED4_EXECUTABLE_PLAN_SCHEMA = 'wrc537-ed4-executable-plan/v1';
export const WRC537_ED4_EXECUTION_TRACE_SCHEMA = 'wrc537-ed4-execution-trace/v1';

const PLAN_AUTHORITY = Object.freeze({
  engineeringUseAuthorized: false,
  authorizationBasis: 'SOURCE_BOUND_EXECUTABLE_PLAN_NOT_NUMERICALLY_QUALIFIED',
});
const TRACE_AUTHORITY = Object.freeze({
  engineeringUseAuthorized: false,
  authorizationBasis: 'EXECUTION_TRACE_FOR_QUALIFICATION_ONLY',
});
const STEP_KINDS = Object.freeze(['EQUATION', 'INTERPOLATION']);
const OPS = Object.freeze([
  'VAR', 'CONST', 'ADD', 'SUB', 'MUL', 'DIV', 'NEG', 'ABS', 'SQRT', 'POW',
  'MIN', 'MAX', 'POLYNOMIAL', 'LINEAR_INTERPOLATE',
]);

export function createWrc537Ed4ExecutablePlan(datasetInput, calculationPlanInput, implementationInput) {
  const dataset = validateWrc537Ed4EngineeringDatasetCandidate(datasetInput);
  const calculationPlan = validateWrc537Ed4CalculationPlan(dataset, calculationPlanInput);
  requireObject(implementationInput, 'implementationInput');
  exactKeys(implementationInput, [
    'schema', 'implementationIdentity', 'implementationVersion', 'datasetSemanticHash',
    'planSemanticHash', 'variableMetadata', 'equationImplementations',
    'interpolationImplementations', 'executionOrder', 'numericalPolicy',
  ], 'implementationInput');
  if (implementationInput.schema !== WRC537_ED4_EXECUTABLE_PLAN_SCHEMA) {
    fail('WRC537_ED4_EXECUTABLE_PLAN_SCHEMA_MISMATCH', 'implementationInput.schema');
  }
  requiredString(implementationInput.implementationIdentity, 'implementationInput.implementationIdentity');
  requiredString(implementationInput.implementationVersion, 'implementationInput.implementationVersion');
  if (implementationInput.datasetSemanticHash !== dataset.datasetSemanticHash) {
    fail('WRC537_ED4_EXECUTABLE_PLAN_DATASET_MISMATCH', 'implementationInput.datasetSemanticHash');
  }
  if (implementationInput.planSemanticHash !== calculationPlan.planSemanticHash) {
    fail('WRC537_ED4_EXECUTABLE_PLAN_PLAN_MISMATCH', 'implementationInput.planSemanticHash');
  }
  if (calculationPlan.combinationRules.length || calculationPlan.postProcessing.length) {
    fail('WRC537_ED4_EXECUTABLE_PLAN_UNCOMPILED_SOURCE_RULES', 'calculationPlan');
  }
  const sourceInterpolationPolicy = dataset?.sourcePackage?.interpolation;
  if (calculationPlan.interpolationRules.length && sourceInterpolationPolicy?.interpolationAuthorized !== true) {
    fail('WRC537_ED4_EXECUTABLE_PLAN_INTERPOLATION_RULE_NOT_SOURCE_AUTHORIZED', 'calculationPlan.interpolationRules');
  }

  const variableMetadata = validateVariableMetadata(implementationInput.variableMetadata, calculationPlan.variables);
  const equations = validateEquationImplementations(
    implementationInput.equationImplementations,
    calculationPlan.equations,
    variableMetadata,
    sourceInterpolationPolicy,
  );
  const interpolations = validateInterpolationImplementations(
    implementationInput.interpolationImplementations,
    calculationPlan.interpolationRules,
    variableMetadata,
    sourceInterpolationPolicy,
  );
  const executionOrder = validateExecutionOrder(
    implementationInput.executionOrder,
    calculationPlan,
    equations,
    interpolations,
    variableMetadata,
  );
  const numericalPolicy = validateNumericalPolicy(implementationInput.numericalPolicy);

  const base = {
    schema: WRC537_ED4_EXECUTABLE_PLAN_SCHEMA,
    implementationIdentity: implementationInput.implementationIdentity,
    implementationVersion: implementationInput.implementationVersion,
    datasetSemanticHash: dataset.datasetSemanticHash,
    planSemanticHash: calculationPlan.planSemanticHash,
    variableMetadata,
    equationImplementations: equations,
    interpolationImplementations: interpolations,
    executionOrder,
    numericalPolicy,
    authority: clone(PLAN_AUTHORITY),
  };
  return freeze({ ...base, executablePlanSemanticHash: semanticHash(base) });
}

export function validateWrc537Ed4ExecutablePlan(datasetInput, calculationPlanInput, value) {
  const dataset = validateWrc537Ed4EngineeringDatasetCandidate(datasetInput);
  const calculationPlan = validateWrc537Ed4CalculationPlan(dataset, calculationPlanInput);
  requireObject(value, 'executablePlan');
  exactKeys(value, [
    'schema', 'implementationIdentity', 'implementationVersion', 'datasetSemanticHash',
    'planSemanticHash', 'variableMetadata', 'equationImplementations',
    'interpolationImplementations', 'executionOrder', 'numericalPolicy', 'authority',
    'executablePlanSemanticHash',
  ], 'executablePlan');
  exactKeys(value.authority, ['engineeringUseAuthorized', 'authorizationBasis'], 'executablePlan.authority');
  if (value.authority.engineeringUseAuthorized !== false
    || value.authority.authorizationBasis !== PLAN_AUTHORITY.authorizationBasis) {
    fail('WRC537_ED4_EXECUTABLE_PLAN_AUTHORITY_INVALID', 'executablePlan.authority');
  }
  const { authority, executablePlanSemanticHash, ...input } = value;
  const reconstructed = createWrc537Ed4ExecutablePlan(dataset, calculationPlan, input);
  if (semanticHash({ ...input, authority }) !== executablePlanSemanticHash
    || reconstructed.executablePlanSemanticHash !== executablePlanSemanticHash) {
    fail('WRC537_ED4_EXECUTABLE_PLAN_HASH_MISMATCH', 'executablePlan.executablePlanSemanticHash');
  }
  return reconstructed;
}

export function executeWrc537Ed4QualificationCase(datasetInput, calculationPlanInput, executablePlanInput, request) {
  const dataset = validateWrc537Ed4EngineeringDatasetCandidate(datasetInput);
  const calculationPlan = validateWrc537Ed4CalculationPlan(dataset, calculationPlanInput);
  const executablePlan = validateWrc537Ed4ExecutablePlan(dataset, calculationPlan, executablePlanInput);
  requireObject(request, 'request');
  exactKeys(request, ['requestIdentity', 'inputValues'], 'request');
  requiredString(request.requestIdentity, 'request.requestIdentity');
  requireArray(request.inputValues, 'request.inputValues');

  const metadataById = new Map(executablePlan.variableMetadata.map((row) => [row.variableId, row]));
  const inputVariables = calculationPlan.variables.filter((row) => row.role === 'INPUT').map((row) => row.variableId).sort();
  const inputIds = request.inputValues.map((row, index) => {
    const path = `request.inputValues[${index}]`;
    exactKeys(row, ['variableId', 'value', 'units'], path);
    const variableId = requiredString(row.variableId, `${path}.variableId`);
    finite(row.value, `${path}.value`);
    const metadata = metadataById.get(variableId);
    if (!metadata) fail('WRC537_ED4_EXECUTION_INPUT_VARIABLE_UNKNOWN', `${path}.variableId`);
    if (row.units !== metadata.units) fail('WRC537_ED4_EXECUTION_INPUT_UNITS_MISMATCH', `${path}.units`);
    return variableId;
  });
  if (new Set(inputIds).size !== inputIds.length || inputIds.slice().sort().join('|') !== inputVariables.join('|')) {
    fail('WRC537_ED4_EXECUTION_INPUT_SET_MISMATCH', 'request.inputValues');
  }

  const values = new Map();
  request.inputValues.forEach((row) => values.set(row.variableId, row.value));
  const steps = [];
  const equationById = new Map(executablePlan.equationImplementations.map((row) => [row.equationId, row]));
  const interpolationById = new Map(executablePlan.interpolationImplementations.map((row) => [row.ruleId, row]));

  executablePlan.executionOrder.forEach((step, index) => {
    const implementation = step.kind === 'EQUATION' ? equationById.get(step.id) : interpolationById.get(step.id);
    const value = evaluateGraph(implementation.graph, values, executablePlan.numericalPolicy, `executionOrder[${index}]`);
    finite(value, `executionOrder[${index}].value`);
    values.set(implementation.outputVariableId, value);
    const metadata = metadataById.get(implementation.outputVariableId);
    steps.push(freeze({
      sequence: index + 1,
      kind: step.kind,
      id: step.id,
      outputVariableId: implementation.outputVariableId,
      value,
      units: metadata.units,
      sourceRef: implementation.sourceRef,
      sourceLocator: implementation.sourceLocator,
    }));
  });

  const recoveryResults = [];
  calculationPlan.recoveryTargets.forEach((target) => {
    target.resultVariableIds.forEach((variableId) => {
      if (!values.has(variableId)) fail('WRC537_ED4_EXECUTION_RECOVERY_VALUE_UNAVAILABLE', `${target.targetId}:${variableId}`);
      recoveryResults.push(freeze({
        targetId: target.targetId,
        variableId,
        value: values.get(variableId),
        units: metadataById.get(variableId).units,
      }));
    });
  });

  const base = {
    schema: WRC537_ED4_EXECUTION_TRACE_SCHEMA,
    requestIdentity: request.requestIdentity,
    datasetSemanticHash: dataset.datasetSemanticHash,
    planSemanticHash: calculationPlan.planSemanticHash,
    executablePlanSemanticHash: executablePlan.executablePlanSemanticHash,
    inputValues: clone(request.inputValues),
    steps,
    recoveryResults,
    authority: clone(TRACE_AUTHORITY),
  };
  return freeze({ ...base, traceSemanticHash: semanticHash(base) });
}

export function validateWrc537Ed4ExecutionTrace(datasetInput, calculationPlanInput, executablePlanInput, value) {
  const dataset = validateWrc537Ed4EngineeringDatasetCandidate(datasetInput);
  const calculationPlan = validateWrc537Ed4CalculationPlan(dataset, calculationPlanInput);
  const executablePlan = validateWrc537Ed4ExecutablePlan(dataset, calculationPlan, executablePlanInput);
  requireObject(value, 'executionTrace');
  exactKeys(value, [
    'schema', 'requestIdentity', 'datasetSemanticHash', 'planSemanticHash',
    'executablePlanSemanticHash', 'inputValues', 'steps', 'recoveryResults', 'authority',
    'traceSemanticHash',
  ], 'executionTrace');
  exactKeys(value.authority, ['engineeringUseAuthorized', 'authorizationBasis'], 'executionTrace.authority');
  if (value.schema !== WRC537_ED4_EXECUTION_TRACE_SCHEMA
    || value.authority.engineeringUseAuthorized !== false
    || value.authority.authorizationBasis !== TRACE_AUTHORITY.authorizationBasis) {
    fail('WRC537_ED4_EXECUTION_TRACE_AUTHORITY_OR_SCHEMA_INVALID', 'executionTrace');
  }
  const reproduced = executeWrc537Ed4QualificationCase(dataset, calculationPlan, executablePlan, {
    requestIdentity: value.requestIdentity,
    inputValues: value.inputValues,
  });
  if (reproduced.traceSemanticHash !== value.traceSemanticHash || semanticHash({
    schema: value.schema,
    requestIdentity: value.requestIdentity,
    datasetSemanticHash: value.datasetSemanticHash,
    planSemanticHash: value.planSemanticHash,
    executablePlanSemanticHash: value.executablePlanSemanticHash,
    inputValues: value.inputValues,
    steps: value.steps,
    recoveryResults: value.recoveryResults,
    authority: value.authority,
  }) !== value.traceSemanticHash) {
    fail('WRC537_ED4_EXECUTION_TRACE_REPLAY_MISMATCH', 'executionTrace.traceSemanticHash');
  }
  return reproduced;
}

export function wrc537Ed4ExecutablePlanCanActivateEngineering(datasetInput, calculationPlanInput, executablePlanInput) {
  const dataset = validateWrc537Ed4EngineeringDatasetCandidate(datasetInput);
  const calculationPlan = validateWrc537Ed4CalculationPlan(dataset, calculationPlanInput);
  validateWrc537Ed4ExecutablePlan(dataset, calculationPlan, executablePlanInput);
  return false;
}

function validateVariableMetadata(rows, variables) {
  requireArray(rows, 'implementationInput.variableMetadata');
  unique(rows, 'variableId', 'implementationInput.variableMetadata');
  const requiredIds = variables.map((row) => row.variableId).sort();
  const actualIds = rows.map((row) => row.variableId).sort();
  if (actualIds.join('|') !== requiredIds.join('|')) {
    fail('WRC537_ED4_EXECUTABLE_PLAN_VARIABLE_METADATA_SET_MISMATCH', 'implementationInput.variableMetadata');
  }
  const normalized = rows.map((row, index) => {
    const path = `implementationInput.variableMetadata[${index}]`;
    exactKeys(row, ['variableId', 'units', 'dimensionVector'], path);
    requiredString(row.variableId, `${path}.variableId`);
    requiredString(row.units, `${path}.units`);
    const dimensionVector = validateDimensionVector(row.dimensionVector, `${path}.dimensionVector`);
    return { variableId: row.variableId, units: row.units, dimensionVector };
  });
  normalized.sort((a, b) => a.variableId.localeCompare(b.variableId));
  return freeze(normalized);
}

function validateEquationImplementations(rows, equations, metadata, sourceInterpolationPolicy) {
  requireArray(rows, 'implementationInput.equationImplementations');
  unique(rows, 'equationId', 'implementationInput.equationImplementations');
  const expected = equations.map((row) => row.equationId).sort();
  const actual = rows.map((row) => row.equationId).sort();
  if (actual.join('|') !== expected.join('|')) fail('WRC537_ED4_EXECUTABLE_PLAN_EQUATION_SET_MISMATCH', 'implementationInput.equationImplementations');
  const equationById = new Map(equations.map((row) => [row.equationId, row]));
  const metadataById = new Map(metadata.map((row) => [row.variableId, row]));
  return freeze(rows.map((row, index) => {
    const path = `implementationInput.equationImplementations[${index}]`;
    exactKeys(row, ['equationId', 'outputVariableId', 'graph', 'sourceRef', 'sourceLocator', 'dimensionAudit'], path);
    const equation = equationById.get(row.equationId);
    if (row.outputVariableId !== equation.outputVariableId || row.sourceRef !== equation.sourceRef || row.sourceLocator !== equation.sourceLocator) {
      fail('WRC537_ED4_EXECUTABLE_PLAN_EQUATION_BINDING_MISMATCH', path);
    }
    validateDimensionAudit(row.dimensionAudit, `${path}.dimensionAudit`);
    validateGraph(row.graph, metadataById, `${path}.graph`);
    validateGraphSourceInterpolationPolicy(row.graph, sourceInterpolationPolicy, `${path}.graph`);
    const actualDimension = graphDimension(row.graph, metadataById, `${path}.graph`);
    const expectedDimension = metadataById.get(row.outputVariableId).dimensionVector;
    if (!sameDimension(actualDimension, expectedDimension)) fail('WRC537_ED4_EXECUTABLE_PLAN_DIMENSION_MISMATCH', `${path}.graph`);
    return clone(row);
  }));
}

function validateInterpolationImplementations(rows, rules, metadata, sourceInterpolationPolicy) {
  requireArray(rows, 'implementationInput.interpolationImplementations');
  unique(rows, 'ruleId', 'implementationInput.interpolationImplementations');
  const expected = rules.map((row) => row.ruleId).sort();
  const actual = rows.map((row) => row.ruleId).sort();
  if (actual.join('|') !== expected.join('|')) fail('WRC537_ED4_EXECUTABLE_PLAN_INTERPOLATION_SET_MISMATCH', 'implementationInput.interpolationImplementations');
  const ruleById = new Map(rules.map((row) => [row.ruleId, row]));
  const metadataById = new Map(metadata.map((row) => [row.variableId, row]));
  return freeze(rows.map((row, index) => {
    const path = `implementationInput.interpolationImplementations[${index}]`;
    exactKeys(row, ['ruleId', 'outputVariableId', 'graph', 'sourceRef', 'sourceLocator', 'dimensionAudit'], path);
    const rule = ruleById.get(row.ruleId);
    if (row.outputVariableId !== rule.outputVariableId || row.sourceRef !== rule.sourceRef || row.sourceLocator !== rule.sourceLocator) {
      fail('WRC537_ED4_EXECUTABLE_PLAN_INTERPOLATION_BINDING_MISMATCH', path);
    }
    validateDimensionAudit(row.dimensionAudit, `${path}.dimensionAudit`);
    validateGraph(row.graph, metadataById, `${path}.graph`);
    validateGraphSourceInterpolationPolicy(row.graph, sourceInterpolationPolicy, `${path}.graph`);
    if (!sameDimension(graphDimension(row.graph, metadataById, `${path}.graph`), metadataById.get(row.outputVariableId).dimensionVector)) {
      fail('WRC537_ED4_EXECUTABLE_PLAN_DIMENSION_MISMATCH', `${path}.graph`);
    }
    return clone(row);
  }));
}

function validateExecutionOrder(rows, calculationPlan, equations, interpolations, metadata) {
  requireArray(rows, 'implementationInput.executionOrder');
  const expected = [
    ...equations.map((row) => `EQUATION:${row.equationId}`),
    ...interpolations.map((row) => `INTERPOLATION:${row.ruleId}`),
  ].sort();
  const actual = rows.map((row, index) => {
    const path = `implementationInput.executionOrder[${index}]`;
    exactKeys(row, ['kind', 'id'], path);
    if (!STEP_KINDS.includes(row.kind)) fail('WRC537_ED4_EXECUTABLE_PLAN_STEP_KIND_UNSUPPORTED', `${path}.kind`);
    requiredString(row.id, `${path}.id`);
    return `${row.kind}:${row.id}`;
  });
  if (new Set(actual).size !== actual.length || actual.slice().sort().join('|') !== expected.join('|')) {
    fail('WRC537_ED4_EXECUTABLE_PLAN_EXECUTION_ORDER_SET_MISMATCH', 'implementationInput.executionOrder');
  }

  const equationById = new Map(equations.map((row) => [row.equationId, row]));
  const interpolationById = new Map(interpolations.map((row) => [row.ruleId, row]));
  const available = new Set(calculationPlan.variables.filter((row) => row.role === 'INPUT' || row.role === 'COEFFICIENT')
    .map((row) => row.variableId));
  calculationPlan.variables.filter((row) => row.role === 'COEFFICIENT').forEach((row) => {
    if (!metadata.find((meta) => meta.variableId === row.variableId)) fail('WRC537_ED4_EXECUTABLE_PLAN_VARIABLE_METADATA_MISSING', row.variableId);
  });
  rows.forEach((step, index) => {
    const implementation = step.kind === 'EQUATION' ? equationById.get(step.id) : interpolationById.get(step.id);
    const refs = graphVariableRefs(implementation.graph);
    refs.forEach((variableId) => {
      if (!available.has(variableId)) fail('WRC537_ED4_EXECUTABLE_PLAN_FORWARD_OR_UNBOUND_REFERENCE', `implementationInput.executionOrder[${index}]:${variableId}`);
    });
    available.add(implementation.outputVariableId);
  });
  return freeze(clone(rows));
}

function validateNumericalPolicy(value) {
  requireObject(value, 'implementationInput.numericalPolicy');
  exactKeys(value, ['divisionZeroTolerance', 'finiteOnly', 'allowExtrapolationOnlyWhenSourceRuleAllows'], 'implementationInput.numericalPolicy');
  if (!Number.isFinite(value.divisionZeroTolerance) || value.divisionZeroTolerance < 0) {
    fail('WRC537_ED4_EXECUTABLE_PLAN_DIVISION_TOLERANCE_INVALID', 'implementationInput.numericalPolicy.divisionZeroTolerance');
  }
  if (value.finiteOnly !== true || value.allowExtrapolationOnlyWhenSourceRuleAllows !== true) {
    fail('WRC537_ED4_EXECUTABLE_PLAN_NUMERICAL_POLICY_UNSAFE', 'implementationInput.numericalPolicy');
  }
  return freeze(clone(value));
}

function validateDimensionAudit(value, path) {
  requireObject(value, path);
  exactKeys(value, ['verified', 'basis'], path);
  if (value.verified !== true) fail('WRC537_ED4_EXECUTABLE_PLAN_DIMENSION_AUDIT_REQUIRED', `${path}.verified`);
  requiredString(value.basis, `${path}.basis`);
}

function validateGraph(node, metadataById, path) {
  requireObject(node, path);
  if (!OPS.includes(node.op)) fail('WRC537_ED4_EXECUTABLE_PLAN_OPERATOR_UNSUPPORTED', `${path}.op`);
  switch (node.op) {
    case 'VAR':
      exactKeys(node, ['op', 'variableId'], path);
      if (!metadataById.has(node.variableId)) fail('WRC537_ED4_EXECUTABLE_PLAN_GRAPH_VARIABLE_UNKNOWN', `${path}.variableId`);
      break;
    case 'CONST':
      exactKeys(node, ['op', 'value'], path);
      finite(node.value, `${path}.value`);
      break;
    case 'NEG': case 'ABS': case 'SQRT':
      exactKeys(node, ['op', 'arg'], path);
      validateGraph(node.arg, metadataById, `${path}.arg`);
      break;
    case 'ADD': case 'SUB': case 'MUL': case 'DIV': case 'POW': case 'MIN': case 'MAX':
      exactKeys(node, ['op', 'args'], path);
      requireArray(node.args, `${path}.args`);
      if (node.args.length !== 2) fail('WRC537_ED4_EXECUTABLE_PLAN_BINARY_OPERATOR_ARITY', `${path}.args`);
      node.args.forEach((child, index) => validateGraph(child, metadataById, `${path}.args[${index}]`));
      break;
    case 'POLYNOMIAL':
      exactKeys(node, ['op', 'x', 'coefficients'], path);
      validateGraph(node.x, metadataById, `${path}.x`);
      requireArray(node.coefficients, `${path}.coefficients`);
      if (!node.coefficients.length) fail('WRC537_ED4_EXECUTABLE_PLAN_POLYNOMIAL_COEFFICIENTS_REQUIRED', `${path}.coefficients`);
      node.coefficients.forEach((coefficient, index) => finite(coefficient, `${path}.coefficients[${index}]`));
      break;
    case 'LINEAR_INTERPOLATE':
      exactKeys(node, ['op', 'x', 'x0', 'x1', 'y0', 'y1', 'sourceAllowsExtrapolation'], path);
      ['x', 'x0', 'x1', 'y0', 'y1'].forEach((key) => validateGraph(node[key], metadataById, `${path}.${key}`));
      if (typeof node.sourceAllowsExtrapolation !== 'boolean') fail('WRC537_ED4_EXECUTABLE_PLAN_EXTRAPOLATION_FLAG_REQUIRED', `${path}.sourceAllowsExtrapolation`);
      break;
    default: break;
  }
}

function validateGraphSourceInterpolationPolicy(node, policy, path) {
  if (typeof policy?.interpolationAuthorized !== 'boolean'
    || typeof policy?.extrapolationAuthorized !== 'boolean') {
    fail('WRC537_ED4_EXECUTABLE_PLAN_SOURCE_INTERPOLATION_POLICY_MISSING', path);
  }
  if (node.op === 'LINEAR_INTERPOLATE') {
    if (policy.interpolationAuthorized !== true) {
      fail('WRC537_ED4_EXECUTABLE_PLAN_INTERPOLATION_NOT_SOURCE_AUTHORIZED', path);
    }
    if (node.sourceAllowsExtrapolation !== policy.extrapolationAuthorized) {
      fail('WRC537_ED4_EXECUTABLE_PLAN_EXTRAPOLATION_POLICY_MISMATCH', `${path}.sourceAllowsExtrapolation`);
    }
  }
  if (node.arg) validateGraphSourceInterpolationPolicy(node.arg, policy, `${path}.arg`);
  if (Array.isArray(node.args)) node.args.forEach((child, index) =>
    validateGraphSourceInterpolationPolicy(child, policy, `${path}.args[${index}]`));
  if (node.x) validateGraphSourceInterpolationPolicy(node.x, policy, `${path}.x`);
  ['x0', 'x1', 'y0', 'y1'].forEach((key) => {
    if (node[key]) validateGraphSourceInterpolationPolicy(node[key], policy, `${path}.${key}`);
  });
}

function graphDimension(node, metadataById, path) {
  switch (node.op) {
    case 'VAR': return metadataById.get(node.variableId).dimensionVector;
    case 'CONST': return {};
    case 'NEG': case 'ABS': return graphDimension(node.arg, metadataById, `${path}.arg`);
    case 'SQRT': return scaleDimension(graphDimension(node.arg, metadataById, `${path}.arg`), 0.5);
    case 'ADD': case 'SUB': case 'MIN': case 'MAX': {
      const a = graphDimension(node.args[0], metadataById, `${path}.args[0]`);
      const b = graphDimension(node.args[1], metadataById, `${path}.args[1]`);
      if (!sameDimension(a, b)) fail('WRC537_ED4_EXECUTABLE_PLAN_ADD_DIMENSION_MISMATCH', path);
      return a;
    }
    case 'MUL': return combineDimension(graphDimension(node.args[0], metadataById, path), graphDimension(node.args[1], metadataById, path), 1);
    case 'DIV': return combineDimension(graphDimension(node.args[0], metadataById, path), graphDimension(node.args[1], metadataById, path), -1);
    case 'POW': {
      const exponentNode = node.args[1];
      if (exponentNode.op !== 'CONST') fail('WRC537_ED4_EXECUTABLE_PLAN_POWER_EXPONENT_MUST_BE_CONSTANT', path);
      return scaleDimension(graphDimension(node.args[0], metadataById, path), exponentNode.value);
    }
    case 'POLYNOMIAL': {
      if (!sameDimension(graphDimension(node.x, metadataById, path), {})) fail('WRC537_ED4_EXECUTABLE_PLAN_POLYNOMIAL_X_DIMENSIONLESS_REQUIRED', path);
      return {};
    }
    case 'LINEAR_INTERPOLATE': {
      const x = graphDimension(node.x, metadataById, path);
      const x0 = graphDimension(node.x0, metadataById, path);
      const x1 = graphDimension(node.x1, metadataById, path);
      const y0 = graphDimension(node.y0, metadataById, path);
      const y1 = graphDimension(node.y1, metadataById, path);
      if (!sameDimension(x, x0) || !sameDimension(x, x1) || !sameDimension(y0, y1)) {
        fail('WRC537_ED4_EXECUTABLE_PLAN_INTERPOLATION_DIMENSION_MISMATCH', path);
      }
      return y0;
    }
    default: fail('WRC537_ED4_EXECUTABLE_PLAN_OPERATOR_UNSUPPORTED', path);
  }
}

function evaluateGraph(node, values, numericalPolicy, path) {
  switch (node.op) {
    case 'VAR': {
      if (!values.has(node.variableId)) fail('WRC537_ED4_EXECUTION_VARIABLE_VALUE_MISSING', `${path}.${node.variableId}`);
      return values.get(node.variableId);
    }
    case 'CONST': return node.value;
    case 'NEG': return -evaluateGraph(node.arg, values, numericalPolicy, `${path}.arg`);
    case 'ABS': return Math.abs(evaluateGraph(node.arg, values, numericalPolicy, `${path}.arg`));
    case 'SQRT': {
      const value = evaluateGraph(node.arg, values, numericalPolicy, `${path}.arg`);
      if (value < 0) fail('WRC537_ED4_EXECUTION_SQRT_DOMAIN_ERROR', path);
      return Math.sqrt(value);
    }
    case 'ADD': return evaluateGraph(node.args[0], values, numericalPolicy, path) + evaluateGraph(node.args[1], values, numericalPolicy, path);
    case 'SUB': return evaluateGraph(node.args[0], values, numericalPolicy, path) - evaluateGraph(node.args[1], values, numericalPolicy, path);
    case 'MUL': return evaluateGraph(node.args[0], values, numericalPolicy, path) * evaluateGraph(node.args[1], values, numericalPolicy, path);
    case 'DIV': {
      const denominator = evaluateGraph(node.args[1], values, numericalPolicy, path);
      if (Math.abs(denominator) <= numericalPolicy.divisionZeroTolerance) fail('WRC537_ED4_EXECUTION_DIVISION_BY_ZERO', path);
      return evaluateGraph(node.args[0], values, numericalPolicy, path) / denominator;
    }
    case 'POW': return Math.pow(evaluateGraph(node.args[0], values, numericalPolicy, path), evaluateGraph(node.args[1], values, numericalPolicy, path));
    case 'MIN': return Math.min(evaluateGraph(node.args[0], values, numericalPolicy, path), evaluateGraph(node.args[1], values, numericalPolicy, path));
    case 'MAX': return Math.max(evaluateGraph(node.args[0], values, numericalPolicy, path), evaluateGraph(node.args[1], values, numericalPolicy, path));
    case 'POLYNOMIAL': {
      const x = evaluateGraph(node.x, values, numericalPolicy, `${path}.x`);
      let y = 0;
      for (let index = node.coefficients.length - 1; index >= 0; index -= 1) y = y * x + node.coefficients[index];
      return y;
    }
    case 'LINEAR_INTERPOLATE': {
      const x = evaluateGraph(node.x, values, numericalPolicy, path);
      const x0 = evaluateGraph(node.x0, values, numericalPolicy, path);
      const x1 = evaluateGraph(node.x1, values, numericalPolicy, path);
      const y0 = evaluateGraph(node.y0, values, numericalPolicy, path);
      const y1 = evaluateGraph(node.y1, values, numericalPolicy, path);
      const span = x1 - x0;
      if (Math.abs(span) <= numericalPolicy.divisionZeroTolerance) fail('WRC537_ED4_EXECUTION_INTERPOLATION_ZERO_SPAN', path);
      if (!node.sourceAllowsExtrapolation && (x < Math.min(x0, x1) || x > Math.max(x0, x1))) {
        fail('WRC537_ED4_EXECUTION_EXTRAPOLATION_NOT_AUTHORIZED', path);
      }
      return y0 + ((x - x0) / span) * (y1 - y0);
    }
    default: fail('WRC537_ED4_EXECUTABLE_PLAN_OPERATOR_UNSUPPORTED', path);
  }
}

function graphVariableRefs(node, refs = new Set()) {
  if (node.op === 'VAR') refs.add(node.variableId);
  if (node.arg) graphVariableRefs(node.arg, refs);
  if (Array.isArray(node.args)) node.args.forEach((child) => graphVariableRefs(child, refs));
  if (node.x) graphVariableRefs(node.x, refs);
  ['x0', 'x1', 'y0', 'y1'].forEach((key) => { if (node[key]) graphVariableRefs(node[key], refs); });
  return refs;
}

function validateDimensionVector(value, path) {
  requireObject(value, path);
  const result = {};
  Object.keys(value).sort().forEach((key) => {
    requiredString(key, `${path}.key`);
    if (!Number.isFinite(value[key])) fail('WRC537_ED4_EXECUTABLE_PLAN_DIMENSION_EXPONENT_INVALID', `${path}.${key}`);
    if (value[key] !== 0) result[key] = value[key];
  });
  return freeze(result);
}
function combineDimension(a, b, sign) {
  const result = { ...a };
  Object.entries(b).forEach(([key, value]) => { result[key] = (result[key] ?? 0) + sign * value; if (Math.abs(result[key]) < 1e-12) delete result[key]; });
  return freeze(result);
}
function scaleDimension(a, factor) {
  const result = {};
  Object.entries(a).forEach(([key, value]) => { const next = value * factor; if (Math.abs(next) >= 1e-12) result[key] = next; });
  return freeze(result);
}
function sameDimension(a, b) { return semanticHash(a) === semanticHash(b); }
function unique(rows, key, path) {
  const ids = rows.map((row, index) => requiredString(row[key], `${path}[${index}].${key}`));
  if (new Set(ids).size !== ids.length) fail('WRC537_ED4_EXECUTABLE_PLAN_DUPLICATE_ID', path);
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
