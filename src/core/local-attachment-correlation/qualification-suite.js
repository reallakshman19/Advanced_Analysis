import { semanticHash } from '../shared-primitives/canonical-json.js';
import { calculateLocalAttachmentCorrelation } from './calculate.js';
import {
  CORRELATION_QUALIFICATION_OBSERVATION_TYPES,
  evaluateCorrelationQualificationObservation,
  validateCorrelationQualificationObservation,
} from './qualification-observations.js';
import { createCorrelationProfile } from './profile.js';

export const CORRELATION_QUALIFICATION_SUITE_SCHEMA =
  'local-attachment-correlation-qualification-suite/v1';
export const CORRELATION_QUALIFICATION_EVIDENCE_SCHEMA =
  'local-attachment-correlation-qualification-evidence/v1';
export { CORRELATION_QUALIFICATION_OBSERVATION_TYPES };

export function createCorrelationQualificationSuite(options) {
  const profile = createCorrelationProfile(options?.profile);
  const cases = validateCases(options?.cases);
  const base = {
    schema: CORRELATION_QUALIFICATION_SUITE_SCHEMA,
    suiteIdentity: requiredString(options?.suiteIdentity, 'suiteIdentity'),
    methodIdentity: profile.methodIdentity,
    methodEdition: profile.methodEdition,
    coefficientDatasetId: profile.coefficientDatasetId,
    coefficientDatasetHash: profile.coefficientDatasetHash,
    profileSemanticHash: semanticHash(profile),
    cases,
  };
  return freeze({ ...base, semanticHash: semanticHash(base) });
}

export function validateCorrelationQualificationSuite(value) {
  exactKeys(value, [
    'schema', 'suiteIdentity', 'methodIdentity', 'methodEdition',
    'coefficientDatasetId', 'coefficientDatasetHash', 'profileSemanticHash',
    'cases', 'semanticHash',
  ], 'qualificationSuite');
  if (value.schema !== CORRELATION_QUALIFICATION_SUITE_SCHEMA) {
    fail('CORRELATION_QUALIFICATION_SUITE_SCHEMA_MISMATCH', 'qualificationSuite.schema');
  }
  requiredString(value.suiteIdentity, 'qualificationSuite.suiteIdentity');
  requiredString(value.methodIdentity, 'qualificationSuite.methodIdentity');
  requiredString(value.methodEdition, 'qualificationSuite.methodEdition');
  requiredString(value.coefficientDatasetId, 'qualificationSuite.coefficientDatasetId');
  requiredHash(value.coefficientDatasetHash, 'qualificationSuite.coefficientDatasetHash');
  requiredHash(value.profileSemanticHash, 'qualificationSuite.profileSemanticHash');
  const cases = validateCases(value.cases);
  const { semanticHash: retainedHash, ...base } = value;
  if (retainedHash !== semanticHash({ ...base, cases })) {
    fail('CORRELATION_QUALIFICATION_SUITE_HASH_MISMATCH', 'qualificationSuite.semanticHash');
  }
  return freeze(structuredClone(value));
}

export function executeCorrelationQualificationSuite(suiteInput, profileInput) {
  const suite = validateCorrelationQualificationSuite(suiteInput);
  const profile = createCorrelationProfile(profileInput);
  assertProfileBinding(suite, profile, 'qualificationSuite');
  const caseResults = suite.cases.map((caseRow) => executeCase(caseRow, profile));
  const status = caseResults.every((row) => row.status === 'PASS') ? 'PASS' : 'FAIL';
  const base = {
    schema: CORRELATION_QUALIFICATION_EVIDENCE_SCHEMA,
    suiteIdentity: suite.suiteIdentity,
    suiteSemanticHash: suite.semanticHash,
    qualificationSuite: suite,
    methodIdentity: profile.methodIdentity,
    methodEdition: profile.methodEdition,
    coefficientDatasetId: profile.coefficientDatasetId,
    coefficientDatasetHash: profile.coefficientDatasetHash,
    profileSemanticHash: semanticHash(profile),
    status,
    caseResults,
  };
  return freeze({ ...base, semanticHash: semanticHash(base) });
}

export function validateCorrelationQualificationEvidence(value) {
  exactKeys(value, [
    'schema', 'suiteIdentity', 'suiteSemanticHash', 'qualificationSuite',
    'methodIdentity', 'methodEdition', 'coefficientDatasetId',
    'coefficientDatasetHash', 'profileSemanticHash', 'status', 'caseResults',
    'semanticHash',
  ], 'qualificationEvidence');
  if (value.schema !== CORRELATION_QUALIFICATION_EVIDENCE_SCHEMA) {
    fail('CORRELATION_QUALIFICATION_EVIDENCE_SCHEMA_MISMATCH', 'qualificationEvidence.schema');
  }
  const suite = validateCorrelationQualificationSuite(value.qualificationSuite);
  requiredString(value.suiteIdentity, 'qualificationEvidence.suiteIdentity');
  requiredHash(value.suiteSemanticHash, 'qualificationEvidence.suiteSemanticHash');
  if (value.suiteIdentity !== suite.suiteIdentity || value.suiteSemanticHash !== suite.semanticHash) {
    fail('CORRELATION_QUALIFICATION_EVIDENCE_SUITE_MISMATCH',
      'qualificationEvidence.qualificationSuite');
  }
  assertBindingFields(value, suite, 'qualificationEvidence');
  if (!['PASS', 'FAIL'].includes(value.status)) {
    fail('CORRELATION_QUALIFICATION_EVIDENCE_STATUS_INVALID', 'qualificationEvidence.status');
  }
  validateCaseResults(value.caseResults);
  const expectedStatus = value.caseResults.every((row) => row.status === 'PASS') ? 'PASS' : 'FAIL';
  if (value.status !== expectedStatus) {
    fail('CORRELATION_QUALIFICATION_EVIDENCE_STATUS_MISMATCH', 'qualificationEvidence.status');
  }
  const { semanticHash: retainedHash, ...base } = value;
  if (retainedHash !== semanticHash(base)) {
    fail('CORRELATION_QUALIFICATION_EVIDENCE_HASH_MISMATCH', 'qualificationEvidence.semanticHash');
  }
  return freeze(structuredClone(value));
}

function executeCase(caseRow, profile) {
  const result = calculateLocalAttachmentCorrelation(caseRow.request, profile);
  const observations = caseRow.observations.map((observation) =>
    evaluateCorrelationQualificationObservation(observation, result));
  return freeze({
    caseId: caseRow.caseId,
    requestIdentity: caseRow.request.requestIdentity ?? null,
    status: observations.every((row) => row.pass) ? 'PASS' : 'FAIL',
    resultQualificationState: result.qualification?.state ?? null,
    observations,
  });
}

function validateCases(values) {
  if (!Array.isArray(values) || !values.length) {
    fail('CORRELATION_QUALIFICATION_CASES_REQUIRED', 'cases');
  }
  const caseIds = new Set();
  return values.map((caseRow, caseIndex) => {
    exactKeys(caseRow, ['caseId', 'request', 'observations'], `cases[${caseIndex}]`);
    const caseId = requiredString(caseRow.caseId, `cases[${caseIndex}].caseId`);
    if (caseIds.has(caseId)) fail('CORRELATION_QUALIFICATION_CASE_DUPLICATE',
      `cases[${caseIndex}].caseId`);
    caseIds.add(caseId);
    if (!caseRow.request || typeof caseRow.request !== 'object' || Array.isArray(caseRow.request)) {
      fail('CORRELATION_QUALIFICATION_REQUEST_REQUIRED', `cases[${caseIndex}].request`);
    }
    if (!Array.isArray(caseRow.observations) || !caseRow.observations.length) {
      fail('CORRELATION_QUALIFICATION_OBSERVATIONS_REQUIRED',
        `cases[${caseIndex}].observations`);
    }
    const observationIds = new Set();
    const observations = caseRow.observations.map((row, observationIndex) => {
      const observation = validateCorrelationQualificationObservation(row,
        `cases[${caseIndex}].observations[${observationIndex}]`);
      if (observationIds.has(observation.observationId)) {
        fail('CORRELATION_QUALIFICATION_OBSERVATION_DUPLICATE',
          `cases[${caseIndex}].observations[${observationIndex}].observationId`);
      }
      observationIds.add(observation.observationId);
      return observation;
    });
    return freeze({ caseId, request: structuredClone(caseRow.request), observations });
  });
}

function validateCaseResults(values) {
  if (!Array.isArray(values) || !values.length) {
    fail('CORRELATION_QUALIFICATION_EVIDENCE_CASES_REQUIRED',
      'qualificationEvidence.caseResults');
  }
  const ids = new Set();
  values.forEach((row, index) => {
    exactKeys(row, [
      'caseId', 'requestIdentity', 'status', 'resultQualificationState', 'observations',
    ], `qualificationEvidence.caseResults[${index}]`);
    requiredString(row.caseId, `qualificationEvidence.caseResults[${index}].caseId`);
    if (ids.has(row.caseId)) fail('CORRELATION_QUALIFICATION_EVIDENCE_CASE_DUPLICATE',
      `qualificationEvidence.caseResults[${index}].caseId`);
    ids.add(row.caseId);
    if (!['PASS', 'FAIL'].includes(row.status)) fail(
      'CORRELATION_QUALIFICATION_EVIDENCE_CASE_STATUS_INVALID',
      `qualificationEvidence.caseResults[${index}].status`);
    if (!Array.isArray(row.observations) || !row.observations.length) fail(
      'CORRELATION_QUALIFICATION_EVIDENCE_OBSERVATIONS_REQUIRED',
      `qualificationEvidence.caseResults[${index}].observations`);
    const expected = row.observations.every((observation) => observation?.pass === true)
      ? 'PASS' : 'FAIL';
    if (row.status !== expected) fail('CORRELATION_QUALIFICATION_EVIDENCE_CASE_STATUS_MISMATCH',
      `qualificationEvidence.caseResults[${index}].status`);
  });
}

function assertProfileBinding(value, profile, path) {
  const expected = {
    methodIdentity: profile.methodIdentity,
    methodEdition: profile.methodEdition,
    coefficientDatasetId: profile.coefficientDatasetId,
    coefficientDatasetHash: profile.coefficientDatasetHash,
    profileSemanticHash: semanticHash(profile),
  };
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (value[key] !== expectedValue) {
      fail('CORRELATION_QUALIFICATION_SUITE_PROFILE_MISMATCH', `${path}.${key}`);
    }
  }
}

function assertBindingFields(value, suite, path) {
  for (const key of [
    'methodIdentity', 'methodEdition', 'coefficientDatasetId',
    'coefficientDatasetHash', 'profileSemanticHash',
  ]) {
    if (value[key] !== suite[key]) fail('CORRELATION_QUALIFICATION_EVIDENCE_PROFILE_MISMATCH',
      `${path}.${key}`);
  }
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
