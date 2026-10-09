import { semanticHash } from '../shared-primitives/canonical-json.js';
import {
  EMP1_ENGINEERING_REVIEW_STATES,
  projectEmp1EngineeringReviewState,
  requireEmp1EngineeringReviewRecord,
} from './emp1-engineering-review-record.js';

export const EMP1_ENGINEERING_RECORD_PACKAGE_SCHEMA = 'emp1-engineering-record-package/v1';
export const EMP1_ENGINEERING_RECORD_EVIDENCE_SCHEMA = 'emp1-engineering-record-evidence/v1';
export const EMP1_ENGINEERING_RECORD_LIMITATIONS_SCHEMA = 'emp1-engineering-record-limitations/v1';

const CURRENT_REVIEW_STATES = new Set([
  EMP1_ENGINEERING_REVIEW_STATES.ACCEPTED,
  EMP1_ENGINEERING_REVIEW_STATES.REJECTED,
]);
const BINDING_KEYS = Object.freeze([
  'sourceHash',
  'loadTransferResultHash',
  'sectionScreeningResultHash',
  'localCorrelationResultHash',
  'assessmentSemanticHash',
  'routeAuthorityHash',
]);

/** Immutable audit package over already-retained EMP.1 identities. */
export function createEmp1EngineeringRecordPackage(input = {}) {
  const evidence = record(input.evidence, 'EMP1_ENGINEERING_RECORD_EVIDENCE_REQUIRED');
  const review = requireEmp1EngineeringReviewRecord(input.reviewRecord);
  const reviewState = projectEmp1EngineeringReviewState({ reviewRecord: review, evidence });
  if (reviewState.current !== true || !CURRENT_REVIEW_STATES.has(reviewState.state)) {
    throw packageError('EMP1_ENGINEERING_RECORD_CURRENT_REVIEW_REQUIRED');
  }
  const routeAuthority = routeAuthorityCustody(evidence);
  const normalized = {
    schema: EMP1_ENGINEERING_RECORD_PACKAGE_SCHEMA,
    productId: 'EMP.1',
    packagedAt: text(input.packagedAt, 'EMP1_ENGINEERING_RECORD_PACKAGED_AT_REQUIRED'),
    recordState: reviewState.state,
    evidence: evidenceCustody(reviewState),
    routeAuthority,
    review,
    limitations: limitationsFromSnapshot(routeAuthority.snapshot),
    authorityBoundary: authorityBoundary(),
  };
  const packageSemanticHash = semanticHash(packageSemanticProjection(normalized));
  return deepFreeze({
    ...normalized,
    packageId: `emp1-engineering-record:${hashSuffix(packageSemanticHash)}`,
    semanticHash: packageSemanticHash,
  });
}

/** Validate an exported package without creating engineering authority. */
export function requireEmp1EngineeringRecordPackage(value) {
  const source = record(value, 'EMP1_ENGINEERING_RECORD_PACKAGE_REQUIRED');
  if (source.schema !== EMP1_ENGINEERING_RECORD_PACKAGE_SCHEMA || source.productId !== 'EMP.1') {
    throw packageError('EMP1_ENGINEERING_RECORD_PACKAGE_SCHEMA_INVALID');
  }
  if (!CURRENT_REVIEW_STATES.has(source.recordState)) {
    throw packageError('EMP1_ENGINEERING_RECORD_STATE_INVALID');
  }

  const review = requireEmp1EngineeringReviewRecord(source.review);
  const evidence = normalizeEvidenceCustody(source.evidence);
  if (evidence.reviewSemanticHash !== review.semanticHash || evidence.reviewId !== review.reviewId) {
    throw packageError('EMP1_ENGINEERING_RECORD_REVIEW_IDENTITY_MISMATCH');
  }
  assertBindingMatchesReview(evidence, review.evidenceBinding);

  const routeAuthority = normalizeRouteAuthorityCustody(source.routeAuthority);
  if (routeAuthority.semanticHash !== evidence.routeAuthorityHash) {
    throw packageError('EMP1_ENGINEERING_RECORD_ROUTE_AUTHORITY_BINDING_MISMATCH');
  }
  const limitations = normalizeLimitations(source.limitations);
  if (JSON.stringify(limitations) !== JSON.stringify(limitationsFromSnapshot(routeAuthority.snapshot))) {
    throw packageError('EMP1_ENGINEERING_RECORD_LIMITATIONS_MISMATCH');
  }
  const expectedReviewState = review.disposition === 'ACCEPTED'
    ? EMP1_ENGINEERING_REVIEW_STATES.ACCEPTED
    : EMP1_ENGINEERING_REVIEW_STATES.REJECTED;
  if (source.recordState !== expectedReviewState) {
    throw packageError('EMP1_ENGINEERING_RECORD_REVIEW_STATE_MISMATCH');
  }

  const normalized = {
    schema: source.schema,
    productId: source.productId,
    packagedAt: text(source.packagedAt, 'EMP1_ENGINEERING_RECORD_PACKAGED_AT_REQUIRED'),
    recordState: source.recordState,
    evidence,
    routeAuthority,
    review,
    limitations,
    authorityBoundary: normalizeAuthorityBoundary(source.authorityBoundary),
  };
  const expectedHash = semanticHash(packageSemanticProjection(normalized));
  const expectedId = `emp1-engineering-record:${hashSuffix(expectedHash)}`;
  if (source.semanticHash !== expectedHash || source.packageId !== expectedId) {
    throw packageError('EMP1_ENGINEERING_RECORD_PACKAGE_IDENTITY_MISMATCH');
  }
  return deepFreeze({ ...normalized, packageId: expectedId, semanticHash: expectedHash });
}

export function packageSemanticProjection(value) {
  return {
    schema: value.schema,
    productId: value.productId,
    packagedAt: value.packagedAt,
    recordState: value.recordState,
    evidence: value.evidence,
    routeAuthority: value.routeAuthority,
    review: value.review,
    limitations: value.limitations,
    authorityBoundary: value.authorityBoundary,
  };
}

function evidenceCustody(reviewState) {
  const binding = reviewState.currentEvidenceBinding;
  return deepFreeze({
    schema: EMP1_ENGINEERING_RECORD_EVIDENCE_SCHEMA,
    sourceHash: binding.sourceHash,
    loadTransferResultHash: binding.loadTransferResultHash,
    sectionScreeningResultHash: binding.sectionScreeningResultHash,
    localCorrelationResultHash: binding.localCorrelationResultHash,
    assessmentSemanticHash: binding.assessmentSemanticHash,
    routeAuthorityHash: binding.routeAuthorityHash,
    reviewId: reviewState.reviewId,
    reviewSemanticHash: reviewState.reviewSemanticHash,
  });
}

function normalizeEvidenceCustody(value) {
  const row = record(value, 'EMP1_ENGINEERING_RECORD_EVIDENCE_CUSTODY_REQUIRED');
  if (row.schema !== EMP1_ENGINEERING_RECORD_EVIDENCE_SCHEMA) {
    throw packageError('EMP1_ENGINEERING_RECORD_EVIDENCE_SCHEMA_INVALID');
  }
  return deepFreeze({
    schema: row.schema,
    sourceHash: requiredHash(row.sourceHash, 'SOURCE'),
    loadTransferResultHash: requiredHash(row.loadTransferResultHash, 'LOAD_TRANSFER'),
    sectionScreeningResultHash: requiredHash(row.sectionScreeningResultHash, 'SECTION_SCREENING'),
    localCorrelationResultHash: requiredHash(row.localCorrelationResultHash, 'LOCAL_CORRELATION'),
    assessmentSemanticHash: requiredHash(row.assessmentSemanticHash, 'ASSESSMENT'),
    routeAuthorityHash: requiredHash(row.routeAuthorityHash, 'ROUTE_AUTHORITY'),
    reviewId: text(row.reviewId, 'EMP1_ENGINEERING_RECORD_REVIEW_ID_REQUIRED'),
    reviewSemanticHash: requiredHash(row.reviewSemanticHash, 'REVIEW'),
  });
}

function routeAuthorityCustody(evidence) {
  return normalizeRouteAuthorityCustody({
    semanticHash: evidence.routeAuthorityHash,
    snapshot: evidence.routeAuthoritySnapshot,
  });
}

function normalizeRouteAuthorityCustody(value) {
  const row = record(value, 'EMP1_ENGINEERING_RECORD_ROUTE_AUTHORITY_REQUIRED');
  const semanticHashValue = requiredHash(row.semanticHash, 'ROUTE_AUTHORITY');
  const snapshot = record(row.snapshot, 'EMP1_ENGINEERING_RECORD_ROUTE_AUTHORITY_SNAPSHOT_REQUIRED');
  if (requiredHash(snapshot.semanticHash, 'ROUTE_AUTHORITY_SNAPSHOT') !== semanticHashValue) {
    throw packageError('EMP1_ENGINEERING_RECORD_ROUTE_AUTHORITY_HASH_MISMATCH');
  }
  return deepFreeze({ semanticHash: semanticHashValue, snapshot: structuredClone(snapshot) });
}

function limitationsFromSnapshot(snapshot) {
  const registry = recordOrNull(snapshot.registry);
  return deepFreeze({
    schema: EMP1_ENGINEERING_RECORD_LIMITATIONS_SCHEMA,
    source: 'RETAINED_ROUTE_AUTHORITY_SNAPSHOT_ONLY',
    method: cloneRecordOrNull(registry?.method),
    scope: cloneRecordOrNull(registry?.scope),
    routeLimitations: stringArray(registry?.limitations),
    remainingBlocked: stringArray(registry?.remainingBlocked),
  });
}

function normalizeLimitations(value) {
  const row = record(value, 'EMP1_ENGINEERING_RECORD_LIMITATIONS_REQUIRED');
  if (row.schema !== EMP1_ENGINEERING_RECORD_LIMITATIONS_SCHEMA
    || row.source !== 'RETAINED_ROUTE_AUTHORITY_SNAPSHOT_ONLY') {
    throw packageError('EMP1_ENGINEERING_RECORD_LIMITATIONS_SCHEMA_INVALID');
  }
  return deepFreeze({
    schema: row.schema,
    source: row.source,
    method: cloneRecordOrNull(row.method),
    scope: cloneRecordOrNull(row.scope),
    routeLimitations: stringArray(row.routeLimitations),
    remainingBlocked: stringArray(row.remainingBlocked),
  });
}

function assertBindingMatchesReview(evidence, binding) {
  for (const key of BINDING_KEYS) {
    if (evidence[key] !== binding[key]) {
      throw packageError(`EMP1_ENGINEERING_RECORD_REVIEW_BINDING_MISMATCH:${key}`);
    }
  }
}

function authorityBoundary() {
  return deepFreeze({
    auditRecordOnly: true,
    createsPackageIdentity: true,
    createsEngineeringCalculationAuthority: false,
    createsSourceAuthority: false,
    createsMethodAuthority: false,
    createsApplicabilityAuthority: false,
    createsReviewAuthority: false,
    createsCodeCompliance: false,
    createsReleaseAuthority: false,
    createsDeploymentAuthority: false,
    createsCryptographicSeal: false,
  });
}

function normalizeAuthorityBoundary(value) {
  const row = record(value, 'EMP1_ENGINEERING_RECORD_AUTHORITY_BOUNDARY_REQUIRED');
  const expected = authorityBoundary();
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (row[key] !== expectedValue) {
      throw packageError(`EMP1_ENGINEERING_RECORD_AUTHORITY_BOUNDARY_INVALID:${key}`);
    }
  }
  return expected;
}

function requiredHash(value, label) {
  return text(value, `EMP1_ENGINEERING_RECORD_${label}_HASH_REQUIRED`);
}
function cloneRecordOrNull(value) { return recordOrNull(value) ? structuredClone(value) : null; }
function recordOrNull(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function stringArray(value) {
  return Object.freeze(Array.isArray(value) ? value.map((entry) => String(entry)) : []);
}
function hashSuffix(value) { return value.startsWith('fnv1a64:') ? value.slice(8) : value; }
function text(value, code) {
  if (typeof value !== 'string' || !value.trim()) throw packageError(code);
  return value.trim();
}
function record(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw packageError(code);
  return value;
}
function packageError(code) { const error = new TypeError(code); error.code = code; return error; }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
