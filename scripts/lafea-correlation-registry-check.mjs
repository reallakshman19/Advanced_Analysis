import assert from 'node:assert/strict';
import {
  EMPTY_ENGINEERING_CORRELATION_REGISTRY,
  TRUSTED_CORRELATION_APPROVAL_AUTHORITIES,
  createCorrelationQualificationRecord,
  createEngineeringCorrelationRegistry,
  engineeringCorrelationMethods,
  requireEngineeringCorrelationProfile,
  syntheticCorrelationApplicabilityDefinition,
  syntheticCorrelationProfile,
  validateEngineeringCorrelationRegistry,
} from '../src/core/local-attachment-correlation/index.js';

assert.deepEqual(TRUSTED_CORRELATION_APPROVAL_AUTHORITIES, []);
assert.deepEqual(engineeringCorrelationMethods(EMPTY_ENGINEERING_CORRELATION_REGISTRY), []);
assert.deepEqual(
  validateEngineeringCorrelationRegistry(EMPTY_ENGINEERING_CORRELATION_REGISTRY),
  EMPTY_ENGINEERING_CORRELATION_REGISTRY,
);
assert.throws(
  () => requireEngineeringCorrelationProfile(
    EMPTY_ENGINEERING_CORRELATION_REGISTRY,
    'NOT-REGISTERED',
    '1',
  ),
  (error) => error?.code === 'CORRELATION_ENGINEERING_PROFILE_NOT_REGISTERED',
);

const synthetic = syntheticCorrelationProfile();
assert.throws(
  () => createEngineeringCorrelationRegistry([synthetic]),
  (error) => error?.code === 'CORRELATION_ENGINEERING_PROFILE_NOT_AUTHORIZED',
);

const falselyAuthorizedTestData = structuredClone(synthetic);
falselyAuthorizedTestData.authority.engineeringUseAuthorized = true;
falselyAuthorizedTestData.authority.authorizationBasis = 'TEST-TAMPER';
assert.throws(
  () => createEngineeringCorrelationRegistry([falselyAuthorizedTestData]),
  (error) => error?.code === 'CORRELATION_ENGINEERING_PROFILE_TEST_DATA_FORBIDDEN',
);

const userClaimedEngineeringProfile = structuredClone(synthetic);
userClaimedEngineeringProfile.methodIdentity = 'USER-CLAIMED-ENGINEERING-METHOD';
userClaimedEngineeringProfile.methodEdition = '1';
userClaimedEngineeringProfile.provenance.sourceReference = 'USER-SUPPLIED-SOURCE';
userClaimedEngineeringProfile.provenance.sourceEdition = 'USER-SUPPLIED-EDITION';
userClaimedEngineeringProfile.provenance.dataExtraction = 'USER-SUPPLIED-DIGITIZATION';
userClaimedEngineeringProfile.provenance.licenseAuthority = 'USER-CLAIMED-LICENSE';
userClaimedEngineeringProfile.authority.engineeringUseAuthorized = true;
userClaimedEngineeringProfile.authority.authorizationBasis = 'USER-CLAIMED-AUTHORITY';
assert.throws(
  () => createEngineeringCorrelationRegistry([userClaimedEngineeringProfile]),
  (error) => error?.code === 'CORRELATION_ENGINEERING_APPLICABILITY_DEFINITION_MISSING',
);

const userClaimedDefinition = syntheticCorrelationApplicabilityDefinition(
  userClaimedEngineeringProfile,
);
const userClaimedApproval = createCorrelationQualificationRecord({
  profile: userClaimedEngineeringProfile,
  applicabilityDefinition: userClaimedDefinition,
  recordIdentity: 'USER-CLAIMED-QUALIFICATION-001',
  qualificationEvidenceHash: userClaimedEngineeringProfile.coefficientDatasetHash,
  approvalAuthorityId: 'USER-CLAIMED-APPROVAL-AUTHORITY',
  approvalReference: 'USER-CLAIMED-APPROVAL-REF',
  engineeringUseApproved: true,
});
assert.throws(
  () => createEngineeringCorrelationRegistry(
    [userClaimedEngineeringProfile], [userClaimedApproval], [], [userClaimedDefinition],
  ),
  (error) => error?.code === 'CORRELATION_ENGINEERING_QUALIFICATION_EVIDENCE_MISSING',
);

const tamperedEmptyRegistry = structuredClone(EMPTY_ENGINEERING_CORRELATION_REGISTRY);
tamperedEmptyRegistry.semanticHash = 'fnv1a64:0000000000000000';
assert.throws(
  () => validateEngineeringCorrelationRegistry(tamperedEmptyRegistry),
  (error) => error?.code === 'CORRELATION_ENGINEERING_REGISTRY_HASH_MISMATCH',
);

console.log(JSON.stringify({
  check: 'lafea-correlation-engineering-registry-authority',
  status: 'PASS',
  registrySchema: EMPTY_ENGINEERING_CORRELATION_REGISTRY.schema,
  registryHash: EMPTY_ENGINEERING_CORRELATION_REGISTRY.semanticHash,
  registeredEngineeringMethods: 0,
  trustedApprovalAuthorities: TRUSTED_CORRELATION_APPROVAL_AUTHORITIES,
  syntheticProfileRejected: true,
  testDataCannotBePromotedByAuthorityFlag: true,
  userClaimedProfileWithoutApplicabilityDefinitionRejected: true,
  userClaimedProfileAndApprovalRecordWithoutEvidenceRejected: true,
  registryHashTamperRejected: true,
  missingMethodFailsClosed: true,
}));
