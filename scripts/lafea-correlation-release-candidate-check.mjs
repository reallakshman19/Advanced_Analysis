import assert from 'node:assert/strict';
import {
  CORRELATION_RELEASE_CANDIDATE_SCHEMA,
  CORRELATION_RELEASE_TRUST_PROJECTION_SCHEMA,
  createCorrelationDatasetPackage,
  createCorrelationQualificationRecord,
  createCorrelationQualificationRecordFromEvidence,
  createCorrelationQualificationSuite,
  createCorrelationReleaseCandidate,
  createEngineeringCorrelationRegistry,
  correlationReleaseCandidateRegistryInputs,
  correlationReleaseCandidateTrustProjection,
  executeCorrelationQualificationSuite,
  syntheticCorrelationProfile,
  syntheticCorrelationRequest,
  unqualifiedCorrelationProfileFromDatasetPackage,
  validateCorrelationReleaseCandidate,
} from '../src/core/local-attachment-correlation/index.js';

const synthetic = syntheticCorrelationProfile();
const datasetPackage = createCorrelationDatasetPackage({
  schema: 'local-attachment-correlation-dataset-package/v1',
  packageIdentity: 'RELEASE-CANDIDATE-DATASET-001',
  packageVersion: '1',
  methodIdentity: 'RELEASE-CANDIDATE-FIXTURE',
  methodEdition: 'SOURCE-EDITION-1',
  coefficientDatasetId: synthetic.coefficientDatasetId,
  applicabilityProfileId: synthetic.applicabilityProfileId,
  provenance: {
    sourceReference: 'RELEASE_CANDIDATE_SOURCE_FIXTURE',
    sourceEdition: 'SOURCE-EDITION-1',
    dataExtraction: 'DIRECT_NUMERIC_FIXTURE',
    licenseAuthority: 'QUALIFICATION_FIXTURE_LICENSE',
  },
  axes: structuredClone(synthetic.axes),
  targets: structuredClone(synthetic.targets),
  responses: structuredClone(synthetic.responses),
  uncertainty: structuredClone(synthetic.uncertainty),
});

const unqualified = unqualifiedCorrelationProfileFromDatasetPackage(datasetPackage);
assert.equal(unqualified.authority.engineeringUseAuthorized, false);
const candidateProfile = structuredClone(unqualified);
candidateProfile.authority.engineeringUseAuthorized = true;
candidateProfile.authority.authorizationBasis = 'QUALIFICATION_EVIDENCE_AND_APPROVAL_CANDIDATE';

const suite = createCorrelationQualificationSuite({
  suiteIdentity: 'RELEASE-CANDIDATE-SUITE-001',
  profile: candidateProfile,
  cases: [{
    caseId: 'MIDPOINT-HAND-CALC',
    request: syntheticCorrelationRequest({ requestIdentity: 'RELEASE-CANDIDATE-MIDPOINT' }),
    observations: [
      exact('STATE', 'QUALIFICATION_STATE', 'ACCEPTED'),
      numeric('VM', 'TARGET_VON_MISES', 87.13782186857783, 1e-10, {
        targetId: 'CROWN_OUTER',
      }),
      numeric('SIGMA-X', 'TARGET_COMPONENT', 100, 1e-10, {
        targetId: 'CROWN_OUTER', stressComponent: 'SIGMA_X', field: 'totalSurface',
      }),
      numeric('SIGMA-THETA', 'TARGET_COMPONENT', 59, 1e-10, {
        targetId: 'CROWN_OUTER', stressComponent: 'SIGMA_THETA', field: 'totalSurface',
      }),
    ],
  }],
});
const evidence = executeCorrelationQualificationSuite(suite, candidateProfile);
assert.equal(evidence.status, 'PASS');

const record = createCorrelationQualificationRecordFromEvidence({
  profile: candidateProfile,
  qualificationEvidence: evidence,
  recordIdentity: 'RELEASE-CANDIDATE-APPROVAL-001',
  approvalAuthorityId: 'UNTRUSTED:RELEASE-CANDIDATE-FIXTURE',
  approvalReference: 'RELEASE-CANDIDATE-QUALIFICATION-REVIEW',
  engineeringUseApproved: true,
});

const candidate = createCorrelationReleaseCandidate({
  candidateIdentity: 'LOCAL-ATTACHMENT-METHOD-RELEASE-001',
  datasetPackage,
  profile: candidateProfile,
  qualificationEvidence: evidence,
  qualificationRecord: record,
});
assert.equal(candidate.schema, CORRELATION_RELEASE_CANDIDATE_SCHEMA);
assert.equal(Object.hasOwn(candidate, 'state'), false);
assert.equal(Object.hasOwn(candidate, 'trust'), false);
assert.equal(candidate.binding.datasetPackageHash, datasetPackage.packageSemanticHash);
assert.equal(candidate.binding.coefficientDatasetHash, candidateProfile.coefficientDatasetHash);
assert.equal(candidate.binding.qualificationEvidenceHash, evidence.semanticHash);
assert.equal(candidate.binding.qualificationRecordHash, record.semanticHash);
assert.match(candidate.binding.methodDefinitionHash, /^fnv1a64:[0-9a-f]{16}$/u);
assert.match(candidate.semanticHash, /^fnv1a64:[0-9a-f]{16}$/u);
assert.deepEqual(validateCorrelationReleaseCandidate(candidate), candidate);

const trust = correlationReleaseCandidateTrustProjection(candidate);
assert.equal(trust.schema, CORRELATION_RELEASE_TRUST_PROJECTION_SCHEMA);
assert.equal(trust.candidateIdentity, candidate.candidateIdentity);
assert.equal(trust.candidateSemanticHash, candidate.semanticHash);
assert.equal(trust.state, 'UNTRUSTED_APPROVAL_AUTHORITY');
assert.equal(trust.approvalAuthorityTrusted, false);
assert.equal(candidate.semanticHash, validateCorrelationReleaseCandidate(candidate).semanticHash);

assert.throws(
  () => correlationReleaseCandidateRegistryInputs(candidate),
  (error) => error?.code === 'CORRELATION_RELEASE_CANDIDATE_NOT_TRUSTED',
);
assert.throws(
  () => createEngineeringCorrelationRegistry(
    [candidate.profile], [candidate.qualificationRecord], [candidate.qualificationEvidence],
  ),
  (error) => error?.code === 'CORRELATION_APPROVAL_AUTHORITY_NOT_TRUSTED',
);

const provenanceDrift = structuredClone(candidateProfile);
provenanceDrift.provenance.sourceReference = 'DIFFERENT_SOURCE_REFERENCE';
assert.throws(
  () => createCorrelationReleaseCandidate({
    candidateIdentity: 'PROVENANCE-DRIFT',
    datasetPackage,
    profile: provenanceDrift,
    qualificationEvidence: evidence,
    qualificationRecord: record,
  }),
  (error) => error?.code === 'CORRELATION_RELEASE_DATASET_PROFILE_MISMATCH',
);

const authorityDrift = structuredClone(candidateProfile);
authorityDrift.authority.authorizationBasis = 'DIFFERENT_AUTHORITY_BASIS';
assert.throws(
  () => createCorrelationReleaseCandidate({
    candidateIdentity: 'AUTHORITY-DRIFT',
    datasetPackage,
    profile: authorityDrift,
    qualificationEvidence: evidence,
    qualificationRecord: record,
  }),
  (error) => error?.code === 'CORRELATION_RELEASE_QUALIFICATION_EVIDENCE_PROFILE_MISMATCH',
);

const wrongEvidenceRecord = createCorrelationQualificationRecord({
  profile: candidateProfile,
  recordIdentity: 'WRONG-EVIDENCE-HASH-RECORD',
  qualificationEvidenceHash: 'fnv1a64:0000000000000000',
  approvalAuthorityId: 'UNTRUSTED:RELEASE-CANDIDATE-FIXTURE',
  approvalReference: 'WRONG-EVIDENCE-HASH',
  engineeringUseApproved: true,
});
assert.throws(
  () => createCorrelationReleaseCandidate({
    candidateIdentity: 'WRONG-EVIDENCE-RECORD',
    datasetPackage,
    profile: candidateProfile,
    qualificationEvidence: evidence,
    qualificationRecord: wrongEvidenceRecord,
  }),
  (error) => error?.code === 'CORRELATION_RELEASE_QUALIFICATION_RECORD_EVIDENCE_MISMATCH',
);

const unapprovedRecord = createCorrelationQualificationRecord({
  profile: candidateProfile,
  recordIdentity: 'UNAPPROVED-RECORD',
  qualificationEvidenceHash: evidence.semanticHash,
  approvalAuthorityId: 'UNTRUSTED:RELEASE-CANDIDATE-FIXTURE',
  approvalReference: 'NOT-APPROVED',
  engineeringUseApproved: false,
});
assert.throws(
  () => createCorrelationReleaseCandidate({
    candidateIdentity: 'UNAPPROVED-CANDIDATE',
    datasetPackage,
    profile: candidateProfile,
    qualificationEvidence: evidence,
    qualificationRecord: unapprovedRecord,
  }),
  (error) => error?.code === 'CORRELATION_RELEASE_ENGINEERING_USE_NOT_APPROVED',
);

const nonEngineeringProfile = structuredClone(candidateProfile);
nonEngineeringProfile.authority.engineeringUseAuthorized = false;
nonEngineeringProfile.authority.authorizationBasis = 'NOT-A-RELEASE-CANDIDATE';
const nonEngineeringSuite = createCorrelationQualificationSuite({
  suiteIdentity: 'NON-ENGINEERING-PROFILE-SUITE',
  profile: nonEngineeringProfile,
  cases: [{
    caseId: 'MIDPOINT',
    request: syntheticCorrelationRequest({ requestIdentity: 'NON-ENGINEERING-MIDPOINT' }),
    observations: [exact('STATE', 'QUALIFICATION_STATE', 'ACCEPTED')],
  }],
});
const nonEngineeringEvidence = executeCorrelationQualificationSuite(
  nonEngineeringSuite, nonEngineeringProfile,
);
const nonEngineeringRecord = createCorrelationQualificationRecordFromEvidence({
  profile: nonEngineeringProfile,
  qualificationEvidence: nonEngineeringEvidence,
  recordIdentity: 'NON-ENGINEERING-RECORD',
  approvalAuthorityId: 'UNTRUSTED:RELEASE-CANDIDATE-FIXTURE',
  approvalReference: 'NON-ENGINEERING',
  engineeringUseApproved: true,
});
assert.throws(
  () => createCorrelationReleaseCandidate({
    candidateIdentity: 'NON-ENGINEERING-CANDIDATE',
    datasetPackage,
    profile: nonEngineeringProfile,
    qualificationEvidence: nonEngineeringEvidence,
    qualificationRecord: nonEngineeringRecord,
  }),
  (error) => error?.code === 'CORRELATION_RELEASE_PROFILE_NOT_ENGINEERING_CANDIDATE',
);

const tampered = structuredClone(candidate);
tampered.binding.datasetPackageHash = 'fnv1a64:0000000000000000';
assert.throws(
  () => validateCorrelationReleaseCandidate(tampered),
  (error) => error?.code === 'CORRELATION_RELEASE_CANDIDATE_HASH_MISMATCH',
);

console.log(JSON.stringify({
  check: 'lafea-correlation-release-candidate',
  status: 'PASS',
  candidateHash: candidate.semanticHash,
  trustProjectionState: trust.state,
  datasetPackageHash: candidate.binding.datasetPackageHash,
  methodDefinitionHash: candidate.binding.methodDefinitionHash,
  qualificationEvidenceHash: candidate.binding.qualificationEvidenceHash,
  qualificationRecordHash: candidate.binding.qualificationRecordHash,
  immutableCandidateIndependentOfTrustProjection: true,
  datasetProfileDriftRejected: true,
  authorityEvidenceDriftRejected: true,
  arbitraryRecordEvidenceHashRejected: true,
  unapprovedRecordRejected: true,
  nonEngineeringCandidateRejected: true,
  tamperRejected: true,
  engineeringRegistryActivationBlockedByTrust: true,
}));

function numeric(observationId, type, expected, tolerance, selector) {
  return { observationId, type, expected, tolerance, ...selector };
}
function exact(observationId, type, expected, selector = {}) {
  return { observationId, type, expected, tolerance: null, ...selector };
}
