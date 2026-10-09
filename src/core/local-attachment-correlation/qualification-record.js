import { semanticHash } from '../shared-primitives/canonical-json.js';
import { createCorrelationProfile } from './profile.js';
import {
  executeCorrelationQualificationSuite,
  validateCorrelationQualificationEvidence,
  validateCorrelationQualificationSuite,
} from './qualification-suite.js';

export const CORRELATION_QUALIFICATION_RECORD_SCHEMA = 'local-attachment-correlation-qualification-record/v1';

export function createCorrelationQualificationRecord(options) {
  const profile = createCorrelationProfile(options?.profile);
  const base = {
    schema: CORRELATION_QUALIFICATION_RECORD_SCHEMA,
    recordIdentity: requiredString(options?.recordIdentity, 'recordIdentity'),
    methodIdentity: profile.methodIdentity,
    methodEdition: profile.methodEdition,
    coefficientDatasetId: profile.coefficientDatasetId,
    coefficientDatasetHash: profile.coefficientDatasetHash,
    profileSemanticHash: semanticHash(profile),
    qualificationEvidenceHash: requiredHash(options?.qualificationEvidenceHash,
      'qualificationEvidenceHash'),
    approvalAuthorityId: requiredString(options?.approvalAuthorityId, 'approvalAuthorityId'),
    approvalReference: requiredString(options?.approvalReference, 'approvalReference'),
    engineeringUseApproved: options?.engineeringUseApproved === true,
  };
  return freeze({ ...base, semanticHash: semanticHash(base) });
}

export function createCorrelationQualificationRecordFromEvidence(options) {
  const profile = createCorrelationProfile(options?.profile);
  const evidence = validateCorrelationQualificationEvidence(options?.qualificationEvidence);
  const suite = validateCorrelationQualificationSuite(
    options?.qualificationSuite ?? evidence.qualificationSuite,
  );
  if (evidence.status !== 'PASS') {
    fail('CORRELATION_QUALIFICATION_EVIDENCE_NOT_PASS', 'qualificationEvidence.status');
  }
  assertEvidenceProfileBinding(evidence, profile);
  assertSuiteProfileBinding(suite, profile);
  if (evidence.suiteSemanticHash !== suite.semanticHash) {
    fail('CORRELATION_QUALIFICATION_EVIDENCE_SUITE_MISMATCH',
      'qualificationEvidence.suiteSemanticHash');
  }
  const reproduced = executeCorrelationQualificationSuite(suite, profile);
  if (reproduced.semanticHash !== evidence.semanticHash) {
    fail('CORRELATION_QUALIFICATION_EVIDENCE_NOT_REPRODUCIBLE',
      'qualificationEvidence.semanticHash');
  }
  return createCorrelationQualificationRecord({
    profile,
    recordIdentity: options?.recordIdentity,
    qualificationEvidenceHash: evidence.semanticHash,
    approvalAuthorityId: options?.approvalAuthorityId,
    approvalReference: options?.approvalReference,
    engineeringUseApproved: options?.engineeringUseApproved,
  });
}

export function validateCorrelationQualificationRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('CORRELATION_QUALIFICATION_RECORD_OBJECT_REQUIRED', 'qualificationRecord');
  }
  exactKeys(value, [
    'schema', 'recordIdentity', 'methodIdentity', 'methodEdition',
    'coefficientDatasetId', 'coefficientDatasetHash', 'profileSemanticHash',
    'qualificationEvidenceHash', 'approvalAuthorityId', 'approvalReference',
    'engineeringUseApproved', 'semanticHash',
  ], 'qualificationRecord');
  if (value.schema !== CORRELATION_QUALIFICATION_RECORD_SCHEMA) {
    fail('CORRELATION_QUALIFICATION_RECORD_SCHEMA_MISMATCH', 'qualificationRecord.schema');
  }
  requiredString(value.recordIdentity, 'qualificationRecord.recordIdentity');
  requiredString(value.methodIdentity, 'qualificationRecord.methodIdentity');
  requiredString(value.methodEdition, 'qualificationRecord.methodEdition');
  requiredString(value.coefficientDatasetId, 'qualificationRecord.coefficientDatasetId');
  requiredHash(value.coefficientDatasetHash, 'qualificationRecord.coefficientDatasetHash');
  requiredHash(value.profileSemanticHash, 'qualificationRecord.profileSemanticHash');
  requiredHash(value.qualificationEvidenceHash, 'qualificationRecord.qualificationEvidenceHash');
  requiredString(value.approvalAuthorityId, 'qualificationRecord.approvalAuthorityId');
  requiredString(value.approvalReference, 'qualificationRecord.approvalReference');
  if (typeof value.engineeringUseApproved !== 'boolean') {
    fail('CORRELATION_QUALIFICATION_APPROVAL_BOOLEAN_REQUIRED',
      'qualificationRecord.engineeringUseApproved');
  }
  const { semanticHash: retainedHash, ...base } = value;
  if (retainedHash !== semanticHash(base)) {
    fail('CORRELATION_QUALIFICATION_RECORD_HASH_MISMATCH', 'qualificationRecord.semanticHash');
  }
  return freeze(structuredClone(value));
}

export function qualificationRecordMatchesProfile(recordInput, profileInput) {
  const record = validateCorrelationQualificationRecord(recordInput);
  const profile = createCorrelationProfile(profileInput);
  return record.methodIdentity === profile.methodIdentity
    && record.methodEdition === profile.methodEdition
    && record.coefficientDatasetId === profile.coefficientDatasetId
    && record.coefficientDatasetHash === profile.coefficientDatasetHash
    && record.profileSemanticHash === semanticHash(profile);
}

function assertEvidenceProfileBinding(evidence, profile) {
  assertBinding({
    methodIdentity: evidence.methodIdentity,
    methodEdition: evidence.methodEdition,
    coefficientDatasetId: evidence.coefficientDatasetId,
    coefficientDatasetHash: evidence.coefficientDatasetHash,
    profileSemanticHash: evidence.profileSemanticHash,
  }, profile, 'qualificationEvidence');
}

function assertSuiteProfileBinding(suite, profile) {
  assertBinding({
    methodIdentity: suite.methodIdentity,
    methodEdition: suite.methodEdition,
    coefficientDatasetId: suite.coefficientDatasetId,
    coefficientDatasetHash: suite.coefficientDatasetHash,
    profileSemanticHash: suite.profileSemanticHash,
  }, profile, 'qualificationSuite');
}

function assertBinding(actual, profile, path) {
  const expected = {
    methodIdentity: profile.methodIdentity,
    methodEdition: profile.methodEdition,
    coefficientDatasetId: profile.coefficientDatasetId,
    coefficientDatasetHash: profile.coefficientDatasetHash,
    profileSemanticHash: semanticHash(profile),
  };
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      fail('CORRELATION_QUALIFICATION_PROFILE_MISMATCH', `${path}.${key}`);
    }
  }
}

function requiredHash(value, path) {
  requiredString(value, path);
  if (!/^fnv1a64:[0-9a-f]{16}$/u.test(value)) {
    fail('CORRELATION_HASH_FORMAT_INVALID', path);
  }
  return value;
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
function fail(code, path) { const error = new Error(code); error.code = code; error.path = path; throw error; }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.values(value).forEach(freeze); return Object.freeze(value); }
