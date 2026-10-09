export const CORRELATION_QUALIFICATION_OBSERVATION_TYPES = Object.freeze([
  'QUALIFICATION_STATE',
  'DIAGNOSTIC_CODE',
  'GEOMETRY_PARAMETER',
  'CONTRIBUTION',
  'INTERPOLATION_AXIS',
  'TARGET_COMPONENT',
  'TARGET_PRINCIPAL',
  'TARGET_VON_MISES',
]);

const GEOMETRY_FIELDS = new Set(['diameterRatio', 'diameterThicknessRatio']);
const CONTRIBUTION_FIELDS = new Set([
  'sourceLoad', 'basisStress', 'coefficient', 'stressContribution',
]);
const INTERPOLATION_FIELDS = new Set([
  'value', 'lowerKnot', 'upperKnot', 'weight', 'exactKnot',
]);
const TARGET_COMPONENT_FIELDS = new Set([
  'membrane', 'bending', 'shear', 'pressure', 'mechanicalSurface', 'totalSurface',
]);

export function validateCorrelationQualificationObservation(value, path = 'observation') {
  requireRecord(value, path);
  if (!CORRELATION_QUALIFICATION_OBSERVATION_TYPES.includes(value.type)) {
    fail('CORRELATION_QUALIFICATION_OBSERVATION_TYPE_UNSUPPORTED', `${path}.type`);
  }
  const common = ['observationId', 'type', 'expected', 'tolerance'];
  exactKeys(value, [...common, ...extraKeys(value.type)], path);
  requiredString(value.observationId, `${path}.observationId`);
  validateExpected(value, path);
  validateSelector(value, path);
  return freeze(structuredClone(value));
}

export function evaluateCorrelationQualificationObservation(observationInput, result) {
  const observation = validateCorrelationQualificationObservation(observationInput);
  let actual = null;
  let pass = false;
  try {
    actual = observationValue(observation, result);
    pass = comparison(observation, actual);
  } catch { /* failed lookup is a failed observation */ }
  return freeze({
    observationId: observation.observationId,
    type: observation.type,
    expected: observation.expected,
    tolerance: observation.tolerance,
    actual,
    pass,
  });
}

function observationValue(observation, result) {
  if (observation.type === 'QUALIFICATION_STATE') {
    return result.qualification?.state ?? null;
  }
  if (observation.type === 'DIAGNOSTIC_CODE') {
    return result.diagnostics?.map((row) => row.code) ?? [];
  }
  if (observation.type === 'GEOMETRY_PARAMETER') {
    return result.geometryParameters?.[observation.field] ?? null;
  }
  if (observation.type === 'CONTRIBUTION') {
    return uniqueBy(result.contributions, 'responseId', observation.responseId,
      'contributions')[observation.field];
  }
  if (observation.type === 'INTERPOLATION_AXIS') {
    const row = uniqueBy(result.contributions, 'responseId', observation.responseId,
      'contributions');
    const axis = row.interpolationEvidence?.[observation.axis];
    return observation.field === 'value'
      ? axis?.value ?? null
      : axis?.[observation.field] ?? null;
  }
  if (observation.type === 'TARGET_COMPONENT') {
    const target = uniqueBy(result.targetResults, 'targetId', observation.targetId,
      'targetResults');
    return target.components?.[observation.stressComponent]?.[observation.field] ?? null;
  }
  if (observation.type === 'TARGET_PRINCIPAL') {
    return uniqueBy(result.targetResults, 'targetId', observation.targetId,
      'targetResults').principalStresses?.[observation.principalIndex] ?? null;
  }
  if (observation.type === 'TARGET_VON_MISES') {
    return uniqueBy(result.targetResults, 'targetId', observation.targetId,
      'targetResults').vonMises;
  }
  fail('CORRELATION_QUALIFICATION_OBSERVATION_TYPE_UNSUPPORTED', 'observation.type');
}

function comparison(observation, actual) {
  if (observation.type === 'DIAGNOSTIC_CODE') {
    return Array.isArray(actual) && actual.includes(observation.expected);
  }
  if (typeof observation.expected === 'number') {
    return Number.isFinite(actual)
      && Math.abs(actual - observation.expected) <= observation.tolerance;
  }
  return actual === observation.expected;
}

function validateExpected(value, path) {
  if (typeof value.expected === 'number') {
    if (!Number.isFinite(value.expected)) {
      fail('CORRELATION_QUALIFICATION_EXPECTED_NON_FINITE', `${path}.expected`);
    }
    if (!Number.isFinite(value.tolerance) || value.tolerance < 0) {
      fail('CORRELATION_QUALIFICATION_TOLERANCE_INVALID', `${path}.tolerance`);
    }
    return;
  }
  if (typeof value.expected !== 'string' && typeof value.expected !== 'boolean') {
    fail('CORRELATION_QUALIFICATION_EXPECTED_INVALID', `${path}.expected`);
  }
  if (value.tolerance !== null) {
    fail('CORRELATION_QUALIFICATION_NON_NUMERIC_TOLERANCE', `${path}.tolerance`);
  }
}

function validateSelector(value, path) {
  if (value.type === 'GEOMETRY_PARAMETER' && !GEOMETRY_FIELDS.has(value.field)) {
    fail('CORRELATION_QUALIFICATION_GEOMETRY_FIELD_UNSUPPORTED', `${path}.field`);
  }
  if (value.type === 'CONTRIBUTION') {
    requiredString(value.responseId, `${path}.responseId`);
    if (!CONTRIBUTION_FIELDS.has(value.field)) {
      fail('CORRELATION_QUALIFICATION_CONTRIBUTION_FIELD_UNSUPPORTED', `${path}.field`);
    }
  }
  if (value.type === 'INTERPOLATION_AXIS') {
    requiredString(value.responseId, `${path}.responseId`);
    if (!['x', 'y'].includes(value.axis)) {
      fail('CORRELATION_QUALIFICATION_INTERPOLATION_AXIS_UNSUPPORTED', `${path}.axis`);
    }
    if (!INTERPOLATION_FIELDS.has(value.field)) {
      fail('CORRELATION_QUALIFICATION_INTERPOLATION_FIELD_UNSUPPORTED', `${path}.field`);
    }
  }
  if (value.type === 'TARGET_COMPONENT') {
    requiredString(value.targetId, `${path}.targetId`);
    requiredString(value.stressComponent, `${path}.stressComponent`);
    if (!TARGET_COMPONENT_FIELDS.has(value.field)) {
      fail('CORRELATION_QUALIFICATION_TARGET_COMPONENT_FIELD_UNSUPPORTED', `${path}.field`);
    }
  }
  if (value.type === 'TARGET_PRINCIPAL') {
    requiredString(value.targetId, `${path}.targetId`);
    if (!Number.isInteger(value.principalIndex)
      || value.principalIndex < 0 || value.principalIndex > 2) {
      fail('CORRELATION_QUALIFICATION_PRINCIPAL_INDEX_INVALID', `${path}.principalIndex`);
    }
  }
  if (value.type === 'TARGET_VON_MISES') {
    requiredString(value.targetId, `${path}.targetId`);
  }
}

function extraKeys(type) {
  if (type === 'GEOMETRY_PARAMETER') return ['field'];
  if (type === 'CONTRIBUTION') return ['responseId', 'field'];
  if (type === 'INTERPOLATION_AXIS') return ['responseId', 'axis', 'field'];
  if (type === 'TARGET_COMPONENT') return ['targetId', 'stressComponent', 'field'];
  if (type === 'TARGET_PRINCIPAL') return ['targetId', 'principalIndex'];
  if (type === 'TARGET_VON_MISES') return ['targetId'];
  return [];
}

function uniqueBy(rows, key, identity, path) {
  if (!Array.isArray(rows)) fail('CORRELATION_QUALIFICATION_RESULT_COLLECTION_REQUIRED', path);
  const matches = rows.filter((row) => row?.[key] === identity);
  if (matches.length !== 1) {
    fail(matches.length ? 'CORRELATION_QUALIFICATION_RESULT_IDENTITY_COLLISION'
      : 'CORRELATION_QUALIFICATION_RESULT_ENTITY_NOT_FOUND', path);
  }
  return matches[0];
}
function requireRecord(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('CORRELATION_QUALIFICATION_OBSERVATION_REQUIRED', path);
  }
}
function requiredString(value, path) {
  if (typeof value !== 'string' || !value) fail('CORRELATION_STRING_REQUIRED', path);
  return value;
}
function exactKeys(value, expected, path) {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(required)) {
    fail('CORRELATION_EXACT_KEYS_MISMATCH', path);
  }
}
function fail(code, path) {
  const error = new TypeError(code);
  error.code = code;
  error.path = path;
  throw error;
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
