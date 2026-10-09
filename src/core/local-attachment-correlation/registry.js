import { semanticHash } from '../shared-primitives/canonical-json.js';
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

export const CORRELATION_METHOD_REGISTRY_SCHEMA =
  'local-attachment-correlation-method-registry/v2';

export function createEngineeringCorrelationRegistry(
  profileInputs = [], qualificationRecordInputs = [], qualificationEvidenceInputs = [],
) {
  return buildRegistry(profileInputs, qualificationRecordInputs, qualificationEvidenceInputs);
}

export function validateEngineeringCorrelationRegistry(value) {
  exactKeys(value, [
    'schema', 'profiles', 'qualificationRecords', 'qualificationEvidence', 'semanticHash',
  ], 'registry');
  if (value.schema !== CORRELATION_METHOD_REGISTRY_SCHEMA) {
    fail('CORRELATION_ENGINEERING_REGISTRY_SCHEMA_MISMATCH', 'registry.schema');
  }
  requiredHash(value.semanticHash, 'registry.semanticHash');
  const canonical = buildRegistry(
    value.profiles, value.qualificationRecords, value.qualificationEvidence,
  );
  if (canonical.semanticHash !== value.semanticHash) {
    fail('CORRELATION_ENGINEERING_REGISTRY_HASH_MISMATCH', 'registry.semanticHash');
  }
  return canonical;
}

export function requireEngineeringCorrelationProfile(registryInput, methodIdentity, methodEdition) {
  const registry = validateEngineeringCorrelationRegistry(registryInput);
  const key = methodKey(requiredString(methodIdentity, 'methodIdentity'),
    requiredString(methodEdition, 'methodEdition'));
  const matches = registry.profiles.filter((profile) =>
    methodKey(profile.methodIdentity, profile.methodEdition) === key);
  if (matches.length !== 1) {
    fail(matches.length ? 'CORRELATION_ENGINEERING_PROFILE_DUPLICATE'
      : 'CORRELATION_ENGINEERING_PROFILE_NOT_REGISTERED', key);
  }
  return matches[0];
}

export function engineeringCorrelationMethods(registryInput) {
  const registry = validateEngineeringCorrelationRegistry(registryInput);
  return registry.profiles.map((profile, index) => {
    const record = registry.qualificationRecords[index];
    const evidence = registry.qualificationEvidence[index];
    return freeze({
      methodIdentity: profile.methodIdentity,
      methodEdition: profile.methodEdition,
      coefficientDatasetId: profile.coefficientDatasetId,
      coefficientDatasetHash: profile.coefficientDatasetHash,
      applicabilityProfileId: profile.applicabilityProfileId,
      sourceReference: profile.provenance.sourceReference,
      sourceEdition: profile.provenance.sourceEdition,
      licenseAuthority: profile.provenance.licenseAuthority,
      qualificationRecordIdentity: record.recordIdentity,
      qualificationRecordHash: record.semanticHash,
      qualificationEvidenceHash: evidence.semanticHash,
      qualificationSuiteIdentity: evidence.suiteIdentity,
      qualificationSuiteHash: evidence.suiteSemanticHash,
      qualificationCaseCount: evidence.caseResults.length,
      approvalAuthorityId: record.approvalAuthorityId,
      approvalReference: record.approvalReference,
    });
  });
}

export const EMPTY_ENGINEERING_CORRELATION_REGISTRY =
  createEngineeringCorrelationRegistry([], [], []);

function buildRegistry(profileInputs, recordInputs, evidenceInputs) {
  requireArray(profileInputs, 'CORRELATION_REGISTRY_PROFILES_ARRAY_REQUIRED', 'profiles');
  requireArray(recordInputs, 'CORRELATION_REGISTRY_QUALIFICATION_RECORDS_ARRAY_REQUIRED',
    'qualificationRecords');
  requireArray(evidenceInputs, 'CORRELATION_REGISTRY_QUALIFICATION_EVIDENCE_ARRAY_REQUIRED',
    'qualificationEvidence');
  const profiles = profileInputs.map((input, index) => validateEngineeringProfile(input, index));
  const records = recordInputs.map(validateCorrelationQualificationRecord);
  const evidence = evidenceInputs.map(validateCorrelationQualificationEvidence);
  assertUnique(profiles, (profile) => methodKey(profile.methodIdentity, profile.methodEdition),
    'CORRELATION_ENGINEERING_PROFILE_DUPLICATE', 'profiles');
  assertUnique(records, (record) => record.recordIdentity,
    'CORRELATION_QUALIFICATION_RECORD_DUPLICATE', 'qualificationRecords');
  assertUnique(evidence, (row) => row.semanticHash,
    'CORRELATION_QUALIFICATION_EVIDENCE_DUPLICATE', 'qualificationEvidence');

  const paired = profiles.map((profile, index) => pairProfile(
    profile, index, records, evidence,
  )).sort((a, b) => compare(methodKey(a.profile.methodIdentity, a.profile.methodEdition),
    methodKey(b.profile.methodIdentity, b.profile.methodEdition)));
  if (records.length !== paired.length) {
    fail('CORRELATION_ENGINEERING_QUALIFICATION_RECORD_UNCLAIMED', 'qualificationRecords');
  }
  if (evidence.length !== paired.length) {
    fail('CORRELATION_ENGINEERING_QUALIFICATION_EVIDENCE_UNCLAIMED', 'qualificationEvidence');
  }
  const base = {
    schema: CORRELATION_METHOD_REGISTRY_SCHEMA,
    profiles: paired.map((row) => row.profile),
    qualificationRecords: paired.map((row) => row.record),
    qualificationEvidence: paired.map((row) => row.evidence),
  };
  return freeze({ ...base, semanticHash: semanticHash(base) });
}

function pairProfile(profile, index, records, evidenceRows) {
  const recordMatches = records.filter((record) => qualificationRecordMatchesProfile(record, profile));
  if (recordMatches.length !== 1) {
    fail(recordMatches.length
      ? 'CORRELATION_ENGINEERING_QUALIFICATION_RECORD_AMBIGUOUS'
      : 'CORRELATION_ENGINEERING_QUALIFICATION_RECORD_MISSING', `profiles[${index}]`);
  }
  const [record] = recordMatches;
  const evidenceMatches = evidenceRows.filter((evidence) =>
    evidenceMatchesProfileAndRecord(evidence, profile, record));
  if (evidenceMatches.length !== 1) {
    fail(evidenceMatches.length
      ? 'CORRELATION_ENGINEERING_QUALIFICATION_EVIDENCE_AMBIGUOUS'
      : 'CORRELATION_ENGINEERING_QUALIFICATION_EVIDENCE_MISSING', `profiles[${index}]`);
  }
  const [evidence] = evidenceMatches;
  if (evidence.status !== 'PASS') {
    fail('CORRELATION_ENGINEERING_QUALIFICATION_EVIDENCE_NOT_PASS',
      `qualificationEvidence[suiteIdentity=${evidence.suiteIdentity}].status`);
  }
  const reproduced = executeCorrelationQualificationSuite(evidence.qualificationSuite, profile);
  if (reproduced.semanticHash !== evidence.semanticHash) {
    fail('CORRELATION_ENGINEERING_QUALIFICATION_EVIDENCE_NOT_REPRODUCIBLE',
      `qualificationEvidence[suiteIdentity=${evidence.suiteIdentity}].semanticHash`);
  }
  if (record.engineeringUseApproved !== true) {
    fail('CORRELATION_ENGINEERING_QUALIFICATION_NOT_APPROVED',
      `qualificationRecords[recordIdentity=${record.recordIdentity}]`);
  }
  if (!correlationApprovalAuthorityTrusted(record.approvalAuthorityId)) {
    fail('CORRELATION_APPROVAL_AUTHORITY_NOT_TRUSTED',
      `qualificationRecords[recordIdentity=${record.recordIdentity}].approvalAuthorityId`);
  }
  return { profile, record, evidence };
}

function evidenceMatchesProfileAndRecord(evidence, profile, record) {
  return evidence.methodIdentity === profile.methodIdentity
    && evidence.methodEdition === profile.methodEdition
    && evidence.coefficientDatasetId === profile.coefficientDatasetId
    && evidence.coefficientDatasetHash === profile.coefficientDatasetHash
    && evidence.profileSemanticHash === semanticHash(profile)
    && record.qualificationEvidenceHash === evidence.semanticHash;
}

function validateEngineeringProfile(input, index) {
  const profile = createCorrelationProfile(input);
  if (profile.authority.engineeringUseAuthorized !== true) {
    fail('CORRELATION_ENGINEERING_PROFILE_NOT_AUTHORIZED', `profiles[${index}].authority`);
  }
  if (profile.provenance.licenseAuthority === 'INTERNAL_TEST_DATA') {
    fail('CORRELATION_ENGINEERING_PROFILE_TEST_DATA_FORBIDDEN',
      `profiles[${index}].provenance.licenseAuthority`);
  }
  return profile;
}
function requireArray(value, code, path) { if (!Array.isArray(value)) fail(code, path); }
function assertUnique(values, identity, code, path) {
  const seen = new Set();
  values.forEach((row, index) => {
    const key = identity(row);
    if (seen.has(key)) fail(code, `${path}[${index}]`);
    seen.add(key);
  });
}
function exactKeys(value, expected, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('CORRELATION_OBJECT_REQUIRED', path);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(required)) fail('CORRELATION_EXACT_KEYS_MISMATCH', path);
}
function requiredHash(value, path) {
  requiredString(value, path);
  if (!/^fnv1a64:[0-9a-f]{16}$/u.test(value)) fail('CORRELATION_HASH_FORMAT_INVALID', path);
  return value;
}
function methodKey(methodIdentity, methodEdition) { return `${methodIdentity}@@${methodEdition}`; }
function requiredString(value, path) { if (typeof value !== 'string' || !value) fail('CORRELATION_STRING_REQUIRED', path); return value; }
function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function fail(code, path) { const error = new Error(code); error.code = code; error.path = path; throw error; }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.values(value).forEach(freeze); return Object.freeze(value); }
