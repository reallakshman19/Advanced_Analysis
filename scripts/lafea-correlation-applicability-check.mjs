import assert from 'node:assert/strict';
import {
  CORRELATION_APPLICABILITY_ACKNOWLEDGMENT_SCHEMA,
  createCorrelationApplicabilityAcknowledgment,
  syntheticCorrelationProfile,
  validateCorrelationApplicabilityAcknowledgment,
} from '../src/core/local-attachment-correlation/index.js';

const profile = syntheticCorrelationProfile();
const acknowledgment = createCorrelationApplicabilityAcknowledgment(
  profile,
  profile.applicabilityProfileId,
);
assert.equal(acknowledgment.schema, CORRELATION_APPLICABILITY_ACKNOWLEDGMENT_SCHEMA);
assert.equal(acknowledgment.methodIdentity, profile.methodIdentity);
assert.equal(acknowledgment.methodEdition, profile.methodEdition);
assert.equal(acknowledgment.coefficientDatasetHash, profile.coefficientDatasetHash);
assert.equal(acknowledgment.applicabilityProfileId, profile.applicabilityProfileId);
assert.equal(
  acknowledgment.acknowledgmentBasis,
  'CALLER_EXPLICIT_EXACT_PROFILE_ID_MATCH',
);
assert.deepEqual(acknowledgment.limitations, [
  'APPLICABILITY_IDENTITY_MATCH_ONLY',
  'DOES_NOT_PROVE_PROJECT_GEOMETRY_IS_WITHIN_METHOD_SCOPE',
]);
assert.match(acknowledgment.semanticHash, /^fnv1a64:[0-9a-f]{16}$/u);
assert.deepEqual(
  validateCorrelationApplicabilityAcknowledgment(acknowledgment, profile),
  acknowledgment,
);

assert.throws(
  () => createCorrelationApplicabilityAcknowledgment(profile, null),
  (error) => error?.code === 'CORRELATION_STRING_REQUIRED',
);
assert.throws(
  () => createCorrelationApplicabilityAcknowledgment(profile, 'DIFFERENT-APPLICATION-PROFILE'),
  (error) => error?.code === 'CORRELATION_APPLICABILITY_PROFILE_MISMATCH',
);

const tampered = structuredClone(acknowledgment);
tampered.limitations[0] = 'SILENTLY_WIDENED_SCOPE';
assert.throws(
  () => validateCorrelationApplicabilityAcknowledgment(tampered, profile),
  (error) => error?.code === 'CORRELATION_APPLICABILITY_ACKNOWLEDGMENT_HASH_MISMATCH',
);

const otherProfile = structuredClone(profile);
otherProfile.applicabilityProfileId = 'OTHER-APPLICATION-PROFILE';
assert.throws(
  () => validateCorrelationApplicabilityAcknowledgment(acknowledgment, otherProfile),
  (error) => error?.code === 'CORRELATION_APPLICABILITY_PROFILE_MISMATCH',
);

console.log(JSON.stringify({
  check: 'lafea-correlation-applicability-acknowledgment',
  status: 'PASS',
  applicabilityProfileId: acknowledgment.applicabilityProfileId,
  acknowledgmentHash: acknowledgment.semanticHash,
  missingApplicabilityProfileRejected: true,
  mismatchedApplicabilityProfileRejected: true,
  suppliedArtifactTamperRejected: true,
  identityMatchDoesNotClaimPhysicalApplicability: true,
}));
