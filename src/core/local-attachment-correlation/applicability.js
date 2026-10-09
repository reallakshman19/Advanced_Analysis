import { semanticHash } from '../shared-primitives/canonical-json.js';
import { createCorrelationProfile } from './profile.js';

export const CORRELATION_APPLICABILITY_ACKNOWLEDGMENT_SCHEMA =
  'local-attachment-correlation-applicability-acknowledgment/v1';

export function createCorrelationApplicabilityAcknowledgment(profileInput, requestedProfileId) {
  const profile = createCorrelationProfile(profileInput);
  const requested = requiredString(requestedProfileId, 'requestedApplicabilityProfileId');
  if (requested !== profile.applicabilityProfileId) {
    fail('CORRELATION_APPLICABILITY_PROFILE_MISMATCH', 'requestedApplicabilityProfileId');
  }
  const base = {
    schema: CORRELATION_APPLICABILITY_ACKNOWLEDGMENT_SCHEMA,
    methodIdentity: profile.methodIdentity,
    methodEdition: profile.methodEdition,
    coefficientDatasetHash: profile.coefficientDatasetHash,
    applicabilityProfileId: profile.applicabilityProfileId,
    acknowledgmentBasis: 'CALLER_EXPLICIT_EXACT_PROFILE_ID_MATCH',
    limitations: [
      'APPLICABILITY_IDENTITY_MATCH_ONLY',
      'DOES_NOT_PROVE_PROJECT_GEOMETRY_IS_WITHIN_METHOD_SCOPE',
    ],
  };
  return freeze({ ...base, semanticHash: semanticHash(base) });
}

export function validateCorrelationApplicabilityAcknowledgment(value, profileInput) {
  exactKeys(value, [
    'schema', 'methodIdentity', 'methodEdition', 'coefficientDatasetHash',
    'applicabilityProfileId', 'acknowledgmentBasis', 'limitations', 'semanticHash',
  ], 'applicabilityAcknowledgment');
  if (value.schema !== CORRELATION_APPLICABILITY_ACKNOWLEDGMENT_SCHEMA) {
    fail('CORRELATION_APPLICABILITY_ACKNOWLEDGMENT_SCHEMA_MISMATCH',
      'applicabilityAcknowledgment.schema');
  }
  requiredHash(value.semanticHash, 'applicabilityAcknowledgment.semanticHash');
  const { semanticHash: retainedHash, ...suppliedBase } = value;
  if (retainedHash !== semanticHash(suppliedBase)) {
    fail('CORRELATION_APPLICABILITY_ACKNOWLEDGMENT_HASH_MISMATCH',
      'applicabilityAcknowledgment.semanticHash');
  }
  const reconstructed = createCorrelationApplicabilityAcknowledgment(
    profileInput, value.applicabilityProfileId,
  );
  if (reconstructed.semanticHash !== retainedHash) {
    fail('CORRELATION_APPLICABILITY_ACKNOWLEDGMENT_PROFILE_MISMATCH',
      'applicabilityAcknowledgment');
  }
  return reconstructed;
}

function requiredHash(value, path) {
  requiredString(value, path);
  if (!/^fnv1a64:[0-9a-f]{16}$/u.test(value)) fail('CORRELATION_HASH_FORMAT_INVALID', path);
  return value;
}
function requiredString(value, path) {
  if (typeof value !== 'string' || !value) fail('CORRELATION_STRING_REQUIRED', path);
  return value;
}
function exactKeys(value, expected, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('CORRELATION_OBJECT_REQUIRED', path);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(required)) fail('CORRELATION_EXACT_KEYS_MISMATCH', path);
}
function fail(code, path) { const error = new Error(code); error.code = code; error.path = path; throw error; }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.values(value).forEach(freeze); return Object.freeze(value); }
