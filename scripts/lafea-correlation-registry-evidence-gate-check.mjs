import assert from 'node:assert/strict';
import { semanticHash } from '../src/core/shared-primitives/canonical-json.js';
import {
  CORRELATION_METHOD_REGISTRY_SCHEMA,
  EMPTY_ENGINEERING_CORRELATION_REGISTRY,
  createCorrelationQualificationRecord,
  createCorrelationQualificationRecordFromEvidence,
  createCorrelationQualificationSuite,
  createEngineeringCorrelationRegistry,
  engineeringCorrelationMethods,
  executeCorrelationQualificationSuite,
  syntheticCorrelationApplicabilityDefinition,
  syntheticCorrelationProfile,
  syntheticCorrelationRequest,
  validateEngineeringCorrelationRegistry,
} from '../src/core/local-attachment-correlation/index.js';

const candidateProfile = structuredClone(syntheticCorrelationProfile());
candidateProfile.methodIdentity = 'QUALIFICATION-EVIDENCE-GATE-FIXTURE';
candidateProfile.methodEdition = '1';
candidateProfile.provenance.sourceReference = 'QUALIFICATION_EVIDENCE_GATE_FIXTURE';
candidateProfile.provenance.sourceEdition = '1';
candidateProfile.provenance.dataExtraction = 'DIRECT_NUMERIC_FIXTURE';
candidateProfile.provenance.licenseAuthority = 'QUALIFICATION_FIXTURE_LICENSE';
candidateProfile.authority.engineeringUseAuthorized = true;
candidateProfile.authority.authorizationBasis = 'QUALIFICATION_FIXTURE_ONLY';
const applicabilityDefinition = syntheticCorrelationApplicabilityDefinition(candidateProfile);

const passingSuite = createCorrelationQualificationSuite({
  suiteIdentity: 'REGISTRY-EVIDENCE-GATE-PASS',
  profile: candidateProfile,
  cases: [{
    caseId: 'MIDPOINT',
    request: syntheticCorrelationRequest({ requestIdentity: 'REGISTRY-GATE-MIDPOINT' }),
    observations: [
      exact('STATE', 'QUALIFICATION_STATE', 'ACCEPTED'),
      numeric('VM', 'TARGET_VON_MISES', 87.13782186857783, 1e-10, {
        targetId: 'CROWN_OUTER',
      }),
    ],
  }],
});
const passingEvidence = executeCorrelationQualificationSuite(passingSuite, candidateProfile);
assert.equal(passingEvidence.status, 'PASS');

const passingRecord = createCorrelationQualificationRecordFromEvidence({
  profile: candidateProfile,
  applicabilityDefinition,
  qualificationEvidence: passingEvidence,
  recordIdentity: 'REGISTRY-EVIDENCE-GATE-APPROVAL',
  approvalAuthorityId: 'UNTRUSTED:REGISTRY-EVIDENCE-GATE',
  approvalReference: 'REGISTRY-EVIDENCE-GATE-FIXTURE',
  engineeringUseApproved: true,
});
assert.equal(passingRecord.qualificationEvidenceHash, passingEvidence.semanticHash);
assert.equal(passingRecord.applicabilityDefinitionHash, applicabilityDefinition.semanticHash);

const arbitraryRecord = createCorrelationQualificationRecord({
  profile: candidateProfile,
  applicabilityDefinition,
  recordIdentity: 'REGISTRY-ARBITRARY-EVIDENCE-HASH',
  qualificationEvidenceHash: 'fnv1a64:0000000000000000',
  approvalAuthorityId: 'UNTRUSTED:REGISTRY-EVIDENCE-GATE',
  approvalReference: 'ARBITRARY-HASH-FIXTURE',
  engineeringUseApproved: true,
});
assert.throws(
  () => createEngineeringCorrelationRegistry(
    [candidateProfile], [arbitraryRecord], [passingEvidence], [applicabilityDefinition],
  ),
  (error) => error?.code === 'CORRELATION_ENGINEERING_QUALIFICATION_EVIDENCE_MISSING',
);

assert.throws(
  () => createEngineeringCorrelationRegistry(
    [candidateProfile], [passingRecord], [], [applicabilityDefinition],
  ),
  (error) => error?.code === 'CORRELATION_ENGINEERING_QUALIFICATION_EVIDENCE_MISSING',
);

assert.throws(
  () => createEngineeringCorrelationRegistry(
    [candidateProfile], [passingRecord], [passingEvidence], [],
  ),
  (error) => error?.code === 'CORRELATION_ENGINEERING_APPLICABILITY_DEFINITION_MISSING',
);

const failingSuite = createCorrelationQualificationSuite({
  suiteIdentity: 'REGISTRY-EVIDENCE-GATE-FAIL',
  profile: candidateProfile,
  cases: [{
    caseId: 'WRONG-EXPECTED-VM',
    request: syntheticCorrelationRequest({ requestIdentity: 'REGISTRY-GATE-FAIL' }),
    observations: [numeric('VM', 'TARGET_VON_MISES', 999, 1e-10, {
      targetId: 'CROWN_OUTER',
    })],
  }],
});
const failingEvidence = executeCorrelationQualificationSuite(failingSuite, candidateProfile);
assert.equal(failingEvidence.status, 'FAIL');
const failingRecord = createCorrelationQualificationRecord({
  profile: candidateProfile,
  applicabilityDefinition,
  recordIdentity: 'REGISTRY-FAIL-EVIDENCE-APPROVAL',
  qualificationEvidenceHash: failingEvidence.semanticHash,
  approvalAuthorityId: 'UNTRUSTED:REGISTRY-EVIDENCE-GATE',
  approvalReference: 'FAIL-EVIDENCE-FIXTURE',
  engineeringUseApproved: true,
});
assert.throws(
  () => createEngineeringCorrelationRegistry(
    [candidateProfile], [failingRecord], [failingEvidence], [applicabilityDefinition],
  ),
  (error) => error?.code === 'CORRELATION_ENGINEERING_QUALIFICATION_EVIDENCE_NOT_PASS',
);

assert.throws(
  () => createEngineeringCorrelationRegistry(
    [candidateProfile], [passingRecord], [passingEvidence, passingEvidence],
    [applicabilityDefinition],
  ),
  (error) => error?.code === 'CORRELATION_QUALIFICATION_EVIDENCE_DUPLICATE',
);

assert.throws(
  () => createEngineeringCorrelationRegistry(
    [candidateProfile], [passingRecord], [passingEvidence], [applicabilityDefinition],
  ),
  (error) => error?.code === 'CORRELATION_APPROVAL_AUTHORITY_NOT_TRUSTED',
);

const forgedBase = {
  schema: CORRELATION_METHOD_REGISTRY_SCHEMA,
  profiles: [candidateProfile],
  applicabilityDefinitions: [applicabilityDefinition],
  qualificationRecords: [passingRecord],
  qualificationEvidence: [passingEvidence],
};
const forgedRegistry = Object.freeze({
  ...forgedBase,
  semanticHash: semanticHash(forgedBase),
});
assert.throws(
  () => validateEngineeringCorrelationRegistry(forgedRegistry),
  (error) => error?.code === 'CORRELATION_APPROVAL_AUTHORITY_NOT_TRUSTED',
);
assert.throws(
  () => engineeringCorrelationMethods(forgedRegistry),
  (error) => error?.code === 'CORRELATION_APPROVAL_AUTHORITY_NOT_TRUSTED',
);

const tamperedEmpty = structuredClone(EMPTY_ENGINEERING_CORRELATION_REGISTRY);
tamperedEmpty.semanticHash = 'fnv1a64:0000000000000000';
assert.throws(
  () => validateEngineeringCorrelationRegistry(tamperedEmpty),
  (error) => error?.code === 'CORRELATION_ENGINEERING_REGISTRY_HASH_MISMATCH',
);
assert.deepEqual(
  validateEngineeringCorrelationRegistry(EMPTY_ENGINEERING_CORRELATION_REGISTRY),
  EMPTY_ENGINEERING_CORRELATION_REGISTRY,
);

console.log(JSON.stringify({
  check: 'lafea-correlation-registry-evidence-gate',
  status: 'PASS',
  registrySchema: CORRELATION_METHOD_REGISTRY_SCHEMA,
  emptyRegistryHash: EMPTY_ENGINEERING_CORRELATION_REGISTRY.semanticHash,
  arbitraryRecordHashRejected: true,
  missingEvidenceRejected: true,
  missingApplicabilityDefinitionRejected: true,
  failingEvidenceRejected: true,
  duplicateEvidenceRejected: true,
  forgedRegistryRejectedOnRead: true,
  completeEvidenceStillRequiresTrustedAuthority: true,
}));

function numeric(observationId, type, expected, tolerance, selector) {
  return { observationId, type, expected, tolerance, ...selector };
}
function exact(observationId, type, expected, selector = {}) {
  return { observationId, type, expected, tolerance: null, ...selector };
}
