import { semanticHash } from '../shared-primitives/canonical-json.js';
import { validateCorrelationGeometryEvidence } from './geometry-evidence.js';
import { createCorrelationProfile } from './profile.js';

export const CORRELATION_APPLICABILITY_DEFINITION_SCHEMA =
  'local-attachment-correlation-applicability-definition/v1';
export const CORRELATION_PHYSICAL_APPLICABILITY_SCHEMA =
  'local-attachment-correlation-physical-applicability/v1';
export const CORRELATION_PHYSICAL_APPLICABILITY_STATES = Object.freeze([
  'ACCEPTED',
  'REJECTED',
]);

const SUPPORTED_PARAMETER_IDS = Object.freeze([
  'DIAMETER_RATIO',
  'DIAMETER_THICKNESS_RATIO',
]);
const TOPOLOGY_FIELDS = Object.freeze([
  'hostShellFamily',
  'attachmentFamily',
  'intersectionOrientation',
  'loadReferenceConvention',
]);

export function createCorrelationApplicabilityDefinition(input) {
  const source = structuredClone(input);
  exactKeys(source, [
    'schema', 'definitionIdentity', 'methodIdentity', 'methodEdition',
    'coefficientDatasetHash', 'applicabilityProfileId', 'sourceReference',
    'sourceEdition', 'topology', 'permittedTargetIds', 'parameterLimits',
    'exclusions',
  ], 'applicabilityDefinition');
  if (source.schema !== CORRELATION_APPLICABILITY_DEFINITION_SCHEMA) {
    fail('CORRELATION_APPLICABILITY_DEFINITION_SCHEMA_MISMATCH',
      'applicabilityDefinition.schema');
  }
  requiredString(source.definitionIdentity, 'applicabilityDefinition.definitionIdentity');
  requiredString(source.methodIdentity, 'applicabilityDefinition.methodIdentity');
  requiredString(source.methodEdition, 'applicabilityDefinition.methodEdition');
  requiredHash(source.coefficientDatasetHash,
    'applicabilityDefinition.coefficientDatasetHash');
  requiredString(source.applicabilityProfileId,
    'applicabilityDefinition.applicabilityProfileId');
  requiredString(source.sourceReference, 'applicabilityDefinition.sourceReference');
  requiredString(source.sourceEdition, 'applicabilityDefinition.sourceEdition');
  validateTopology(source.topology, 'applicabilityDefinition.topology');
  source.permittedTargetIds = validateStringSet(source.permittedTargetIds,
    'applicabilityDefinition.permittedTargetIds');
  source.parameterLimits = validateParameterLimits(source.parameterLimits);
  source.exclusions = validateStringSet(source.exclusions,
    'applicabilityDefinition.exclusions', { allowEmpty: true });
  const base = source;
  return freeze({ ...base, semanticHash: semanticHash(base) });
}

export function validateCorrelationApplicabilityDefinition(value) {
  exactKeys(value, [
    'schema', 'definitionIdentity', 'methodIdentity', 'methodEdition',
    'coefficientDatasetHash', 'applicabilityProfileId', 'sourceReference',
    'sourceEdition', 'topology', 'permittedTargetIds', 'parameterLimits',
    'exclusions', 'semanticHash',
  ], 'applicabilityDefinition');
  requiredHash(value.semanticHash, 'applicabilityDefinition.semanticHash');
  const { semanticHash: retainedHash, ...source } = structuredClone(value);
  if (retainedHash !== semanticHash(source)) {
    fail('CORRELATION_APPLICABILITY_DEFINITION_HASH_MISMATCH',
      'applicabilityDefinition.semanticHash');
  }
  const reconstructed = createCorrelationApplicabilityDefinition(source);
  if (reconstructed.semanticHash !== retainedHash) {
    fail('CORRELATION_APPLICABILITY_DEFINITION_RECONSTRUCTION_MISMATCH',
      'applicabilityDefinition');
  }
  return reconstructed;
}

export function correlationApplicabilityDefinitionMatchesProfile(definitionInput, profileInput) {
  const definition = validateCorrelationApplicabilityDefinition(definitionInput);
  const profile = createCorrelationProfile(profileInput);
  const targetIds = [...profile.targets.map((row) => row.targetId)].sort(compare);
  return definition.methodIdentity === profile.methodIdentity
    && definition.methodEdition === profile.methodEdition
    && definition.coefficientDatasetHash === profile.coefficientDatasetHash
    && definition.applicabilityProfileId === profile.applicabilityProfileId
    && JSON.stringify(definition.permittedTargetIds) === JSON.stringify(targetIds);
}

export function evaluateCorrelationPhysicalApplicability(options) {
  const definition = validateCorrelationApplicabilityDefinition(options?.definition);
  const profile = createCorrelationProfile(options?.profile);
  if (!correlationApplicabilityDefinitionMatchesProfile(definition, profile)) {
    fail('CORRELATION_APPLICABILITY_DEFINITION_PROFILE_MISMATCH',
      'applicabilityDefinition');
  }
  const geometry = validateCorrelationGeometryEvidence(options?.geometryEvidence);
  const context = validatePhysicalContext(options?.context);
  const requestedTargetIds = validateStringSet(options?.requestedTargetIds,
    'physicalApplicability.requestedTargetIds');
  const topologyChecks = TOPOLOGY_FIELDS.map((field) => freeze({
    field,
    expected: definition.topology[field],
    actual: context[field],
    pass: definition.topology[field] === context[field],
  }));
  const parameterValues = Object.freeze({
    DIAMETER_RATIO: geometry.attachmentDiameter / geometry.pipeOutsideDiameter,
    DIAMETER_THICKNESS_RATIO: geometry.pipeOutsideDiameter / geometry.pipeThickness,
  });
  const parameterChecks = definition.parameterLimits.map((limit) => {
    const value = parameterValues[limit.parameterId];
    const lowerPass = limit.minimumInclusive ? value >= limit.minimum : value > limit.minimum;
    const upperPass = limit.maximumInclusive ? value <= limit.maximum : value < limit.maximum;
    return freeze({ ...limit, value, pass: lowerPass && upperPass });
  });
  const permitted = new Set(definition.permittedTargetIds);
  const targetChecks = requestedTargetIds.map((targetId) => freeze({
    targetId,
    pass: permitted.has(targetId),
  }));
  const diagnostics = [
    ...topologyChecks.filter((row) => !row.pass).map((row) => diagnostic(
      'CORRELATION_PHYSICAL_APPLICABILITY_TOPOLOGY_MISMATCH',
      `physicalApplicability.context.${row.field}`,
      `${row.field} must equal ${row.expected}; received ${row.actual}.`,
    )),
    ...parameterChecks.filter((row) => !row.pass).map((row) => diagnostic(
      'CORRELATION_PHYSICAL_APPLICABILITY_LIMIT_EXCEEDED',
      `physicalApplicability.parameterLimits.${row.parameterId}`,
      `${row.parameterId}=${row.value} is outside the approved interval.`,
    )),
    ...targetChecks.filter((row) => !row.pass).map((row) => diagnostic(
      'CORRELATION_PHYSICAL_APPLICABILITY_TARGET_NOT_PERMITTED',
      `physicalApplicability.requestedTargetIds.${row.targetId}`,
      `Target ${row.targetId} is not permitted by the approved applicability definition.`,
    )),
  ];
  const state = diagnostics.length ? 'REJECTED' : 'ACCEPTED';
  const base = {
    schema: CORRELATION_PHYSICAL_APPLICABILITY_SCHEMA,
    state,
    definitionIdentity: definition.definitionIdentity,
    applicabilityDefinitionHash: definition.semanticHash,
    methodIdentity: profile.methodIdentity,
    methodEdition: profile.methodEdition,
    coefficientDatasetHash: profile.coefficientDatasetHash,
    applicabilityProfileId: profile.applicabilityProfileId,
    geometryEvidenceHash: geometry.semanticHash,
    context,
    topologyChecks,
    parameterChecks,
    targetChecks,
    diagnostics,
    limitations: [
      'CURRENT_GEOMETRY_SUPPORT_D_D_AND_D_T_ONLY',
      'METHOD_SPECIFIC_ADDITIONAL_GEOMETRY_REQUIRES_EXPLICIT_CONTRACT_EXTENSION',
    ],
  };
  return freeze({ ...base, semanticHash: semanticHash(base) });
}

function validatePhysicalContext(value) {
  exactKeys(value, TOPOLOGY_FIELDS, 'physicalApplicability.context');
  const result = {};
  TOPOLOGY_FIELDS.forEach((field) => {
    result[field] = requiredString(value[field], `physicalApplicability.context.${field}`);
  });
  return freeze(result);
}

function validateTopology(value, path) {
  exactKeys(value, TOPOLOGY_FIELDS, path);
  TOPOLOGY_FIELDS.forEach((field) => requiredString(value[field], `${path}.${field}`));
}

function validateParameterLimits(values) {
  if (!Array.isArray(values) || !values.length) {
    fail('CORRELATION_APPLICABILITY_PARAMETER_LIMITS_REQUIRED',
      'applicabilityDefinition.parameterLimits');
  }
  const seen = new Set();
  return values.map((row, index) => {
    const path = `applicabilityDefinition.parameterLimits[${index}]`;
    exactKeys(row, [
      'parameterId', 'minimum', 'maximum', 'minimumInclusive', 'maximumInclusive',
    ], path);
    if (!SUPPORTED_PARAMETER_IDS.includes(row.parameterId)) {
      fail('CORRELATION_APPLICABILITY_PARAMETER_UNSUPPORTED', `${path}.parameterId`);
    }
    if (seen.has(row.parameterId)) {
      fail('CORRELATION_APPLICABILITY_PARAMETER_DUPLICATE', `${path}.parameterId`);
    }
    seen.add(row.parameterId);
    finite(row.minimum, `${path}.minimum`);
    finite(row.maximum, `${path}.maximum`);
    if (row.minimum >= row.maximum) {
      fail('CORRELATION_APPLICABILITY_PARAMETER_RANGE_INVALID', path);
    }
    if (typeof row.minimumInclusive !== 'boolean' || typeof row.maximumInclusive !== 'boolean') {
      fail('CORRELATION_APPLICABILITY_BOUNDARY_BOOLEAN_REQUIRED', path);
    }
    return freeze(structuredClone(row));
  }).sort((a, b) => compare(a.parameterId, b.parameterId));
}

function validateStringSet(values, path, options = {}) {
  if (!Array.isArray(values) || (!values.length && options.allowEmpty !== true)) {
    fail('CORRELATION_APPLICABILITY_STRING_SET_REQUIRED', path);
  }
  const normalized = values.map((value, index) => requiredString(value, `${path}[${index}]`))
    .sort(compare);
  if (new Set(normalized).size !== normalized.length) {
    fail('CORRELATION_APPLICABILITY_STRING_SET_DUPLICATE', path);
  }
  return normalized;
}
function diagnostic(code, path, message) { return freeze({ severity: 'ERROR', code, path, message }); }
function finite(value, path) { if (!Number.isFinite(value)) fail('CORRELATION_NUMBER_NON_FINITE', path); return value; }
function requiredHash(value, path) { requiredString(value, path); if (!/^fnv1a64:[0-9a-f]{16}$/u.test(value)) fail('CORRELATION_HASH_FORMAT_INVALID', path); return value; }
function requiredString(value, path) { if (typeof value !== 'string' || !value) fail('CORRELATION_STRING_REQUIRED', path); return value; }
function exactKeys(value, expected, path) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail('CORRELATION_OBJECT_REQUIRED', path); const actual = Object.keys(value).sort(); const required = [...expected].sort(); if (JSON.stringify(actual) !== JSON.stringify(required)) fail('CORRELATION_EXACT_KEYS_MISMATCH', path); }
function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function fail(code, path) { const error = new Error(code); error.code = code; error.path = path; throw error; }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.values(value).forEach(freeze); return Object.freeze(value); }
