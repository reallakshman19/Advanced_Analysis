import { semanticHash } from '../shared-primitives/canonical-json.js';
import {
  unqualifiedCorrelationProfileFromDatasetPackage,
  validateCorrelationDatasetPackage,
} from './dataset-package.js';
import { createCorrelationProfile } from './profile.js';
import {
  qualificationRecordMatchesProfile,
  validateCorrelationQualificationRecord,
} from './qualification-record.js';
import {
  executeCorrelationQualificationSuite,
  validateCorrelationQualificationEvidence,
} from './qualification-suite.js';
import { correlationApprovalAuthorityTrusted } from './trusted-authorities.js';

export const CORRELATION_RELEASE_CANDIDATE_SCHEMA =
  'local-attachment-correlation-release-candidate/v1';
export const CORRELATION_RELEASE_TRUST_PROJECTION_SCHEMA =
  'local-attachment-correlation-release-trust-projection/v1';
export const CORRELATION_RELEASE_TRUST_STATES = Object.freeze([
  'READY_FOR_ENGINEERING_REGISTRY',
  'UNTRUSTED_APPROVAL_AUTHORITY',
]);

export function createCorrelationReleaseCandidate(options) {
  const datasetPackage = validateCorrelationDatasetPackage(options?.datasetPackage);
  const profile = createCorrelationProfile(options?.profile);
  const evidence = validateCorrelationQualificationEvidence(options?.qualificationEvidence);
  const record = validateCorrelationQualificationRecord(options?.qualificationRecord);
  assertDatasetProfileBinding(datasetPackage, profile);
  assertEvidenceProfileBinding(evidence, profile);
  assertEvidenceReproducible(evidence, profile);
  if (!qualificationRecordMatchesProfile(record, profile)) {
    fail('CORRELATION_RELEASE_QUALIFICATION_RECORD_PROFILE_MISMATCH',
      'qualificationRecord.profileSemanticHash');
  }
  if (record.qualificationEvidenceHash !== evidence.semanticHash) {
    fail('CORRELATION_RELEASE_QUALIFICATION_RECORD_EVIDENCE_MISMATCH',
      'qualificationRecord.qualificationEvidenceHash');
  }
  if (record.engineeringUseApproved !== true) {
    fail('CORRELATION_RELEASE_ENGINEERING_USE_NOT_APPROVED',
      'qualificationRecord.engineeringUseApproved');
  }
  if (profile.authority.engineeringUseAuthorized !== true) {
    fail('CORRELATION_RELEASE_PROFILE_NOT_ENGINEERING_CANDIDATE',
      'profile.authority.engineeringUseAuthorized');
  }
  const base = {
    schema: CORRELATION_RELEASE_CANDIDATE_SCHEMA,
    candidateIdentity: requiredString(options?.candidateIdentity, 'candidateIdentity'),
    datasetPackage,
    profile,
    qualificationEvidence: evidence,
    qualificationRecord: record,
    binding: {
      datasetPackageHash: datasetPackage.packageSemanticHash,
      coefficientDatasetHash: profile.coefficientDatasetHash,
      profileSemanticHash: semanticHash(profile),
      qualificationSuiteHash: evidence.suiteSemanticHash,
      qualificationEvidenceHash: evidence.semanticHash,
      qualificationRecordHash: record.semanticHash,
      methodDefinitionHash: methodDefinitionHash(profile),
    },
  };
  return freeze({ ...base, semanticHash: semanticHash(base) });
}

export function validateCorrelationReleaseCandidate(value) {
  exactKeys(value, [
    'schema', 'candidateIdentity', 'datasetPackage', 'profile',
    'qualificationEvidence', 'qualificationRecord', 'binding', 'semanticHash',
  ], 'releaseCandidate');
  if (value.schema !== CORRELATION_RELEASE_CANDIDATE_SCHEMA) {
    fail('CORRELATION_RELEASE_CANDIDATE_SCHEMA_MISMATCH', 'releaseCandidate.schema');
  }
  requiredString(value.candidateIdentity, 'releaseCandidate.candidateIdentity');
  requiredHash(value.semanticHash, 'releaseCandidate.semanticHash');
  const { semanticHash: retainedHash, ...suppliedBase } = value;
  if (retainedHash !== semanticHash(suppliedBase)) {
    fail('CORRELATION_RELEASE_CANDIDATE_HASH_MISMATCH', 'releaseCandidate.semanticHash');
  }
  const reconstructed = createCorrelationReleaseCandidate({
    candidateIdentity: value.candidateIdentity,
    datasetPackage: value.datasetPackage,
    profile: value.profile,
    qualificationEvidence: value.qualificationEvidence,
    qualificationRecord: value.qualificationRecord,
  });
  if (reconstructed.semanticHash !== retainedHash) {
    fail('CORRELATION_RELEASE_CANDIDATE_BINDING_MISMATCH', 'releaseCandidate.binding');
  }
  return reconstructed;
}

export function correlationReleaseCandidateTrustProjection(candidateInput) {
  const candidate = validateCorrelationReleaseCandidate(candidateInput);
  const record = candidate.qualificationRecord;
  const approvalAuthorityTrusted = correlationApprovalAuthorityTrusted(record.approvalAuthorityId);
  return freeze({
    schema: CORRELATION_RELEASE_TRUST_PROJECTION_SCHEMA,
    candidateIdentity: candidate.candidateIdentity,
    candidateSemanticHash: candidate.semanticHash,
    state: approvalAuthorityTrusted
      ? 'READY_FOR_ENGINEERING_REGISTRY'
      : 'UNTRUSTED_APPROVAL_AUTHORITY',
    approvalAuthorityId: record.approvalAuthorityId,
    approvalReference: record.approvalReference,
    approvalAuthorityTrusted,
  });
}

export function correlationReleaseCandidateRegistryInputs(candidateInput) {
  const candidate = validateCorrelationReleaseCandidate(candidateInput);
  const trust = correlationReleaseCandidateTrustProjection(candidate);
  if (trust.state !== 'READY_FOR_ENGINEERING_REGISTRY') {
    fail('CORRELATION_RELEASE_CANDIDATE_NOT_TRUSTED', 'releaseCandidate.trust');
  }
  return freeze({
    profiles: [candidate.profile],
    qualificationRecords: [candidate.qualificationRecord],
    qualificationEvidence: [candidate.qualificationEvidence],
  });
}

function assertDatasetProfileBinding(datasetPackage, profile) {
  const derived = unqualifiedCorrelationProfileFromDatasetPackage(datasetPackage);
  if (methodDefinitionHash(derived) !== methodDefinitionHash(profile)) {
    fail('CORRELATION_RELEASE_DATASET_PROFILE_MISMATCH', 'profile');
  }
}

function assertEvidenceProfileBinding(evidence, profile) {
  const expected = {
    methodIdentity: profile.methodIdentity,
    methodEdition: profile.methodEdition,
    coefficientDatasetId: profile.coefficientDatasetId,
    coefficientDatasetHash: profile.coefficientDatasetHash,
    profileSemanticHash: semanticHash(profile),
  };
  for (const [key, value] of Object.entries(expected)) {
    if (evidence[key] !== value) {
      fail('CORRELATION_RELEASE_QUALIFICATION_EVIDENCE_PROFILE_MISMATCH',
        `qualificationEvidence.${key}`);
    }
  }
  if (evidence.status !== 'PASS') {
    fail('CORRELATION_RELEASE_QUALIFICATION_EVIDENCE_NOT_PASS',
      'qualificationEvidence.status');
  }
}

function assertEvidenceReproducible(evidence, profile) {
  const reproduced = executeCorrelationQualificationSuite(evidence.qualificationSuite, profile);
  if (reproduced.semanticHash !== evidence.semanticHash) {
    fail('CORRELATION_RELEASE_QUALIFICATION_EVIDENCE_NOT_REPRODUCIBLE',
      'qualificationEvidence.semanticHash');
  }
}

function methodDefinitionHash(profile) {
  const { authority: _authority, ...definition } = profile;
  return semanticHash(definition);
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
