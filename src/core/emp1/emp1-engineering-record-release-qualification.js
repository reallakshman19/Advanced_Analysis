import { semanticHash } from '../shared-primitives/canonical-json.js';
import { requireEmp1EngineeringRecordPackage } from './emp1-engineering-record-package.js';
import { projectEmp1EngineeringRecordReleaseHandoff } from './emp1-engineering-record-release-handoff.js';
import {
  EMP1_AUTHORIZED_RELEASE_STATE_ARTIFACT,
  requireAuthorizedEmp1ProfessionalReleaseState,
} from './emp1-professional-release-state-authority.js';

export { EMP1_AUTHORIZED_RELEASE_STATE_ARTIFACT } from
  './emp1-professional-release-state-authority.js';

export const EMP1_ENGINEERING_RECORD_RELEASE_QUALIFICATION_SCHEMA =
  'emp1-engineering-record-release-qualification/v1';

/**
 * Bind one exact accepted Engineering Record to the explicitly authorized
 * professional release-current-state artifact. This record may reflect
 * releaseQualified=true only after the protected release-state authority owner
 * is updated to admit an artifact whose own release authority is true.
 */
export function createEmp1EngineeringRecordReleaseQualification({
  packageValue,
  releaseState,
  releaseStateArtifact,
} = {}) {
  const engineeringRecord = requireEmp1EngineeringRecordPackage(packageValue);
  const authorizedRelease = requireAuthorizedEmp1ProfessionalReleaseState(
    releaseState,
    releaseStateArtifact,
  );
  const handoff = projectEmp1EngineeringRecordReleaseHandoff({
    packageValue: engineeringRecord,
    releaseState,
  });
  const reviewAccepted = engineeringRecord.recordState === 'REVIEW_ACCEPTED';
  const releaseQualified = handoff.handoffCompatible === true
    && reviewAccepted
    && authorizedRelease.releaseQualified === true;
  const normalized = {
    schema: EMP1_ENGINEERING_RECORD_RELEASE_QUALIFICATION_SCHEMA,
    productId: 'EMP.1',
    state: qualificationState(handoff, authorizedRelease, engineeringRecord.recordState),
    releaseQualified,
    packageIdentity: {
      packageId: engineeringRecord.packageId,
      semanticHash: engineeringRecord.semanticHash,
      recordState: engineeringRecord.recordState,
      routeAuthorityHash: engineeringRecord.evidence.routeAuthorityHash,
    },
    releaseAuthorityIdentity: releaseAuthorityIdentity(),
    handoff: handoffSummary(handoff),
    existingReleaseAuthority: deepFreeze({ ...authorizedRelease }),
    blockers: qualificationBlockers(handoff, authorizedRelease, engineeringRecord.recordState),
    authorityBoundary: authorityBoundary(),
  };
  const qualificationSemanticHash = semanticHash(qualificationSemanticProjection(normalized));
  return deepFreeze({
    ...normalized,
    qualificationId: `emp1-engineering-record-release:${hashSuffix(qualificationSemanticHash)}`,
    semanticHash: qualificationSemanticHash,
  });
}

export function requireEmp1EngineeringRecordReleaseQualification(value) {
  const source = record(value, 'EMP1_RELEASE_QUALIFICATION_RECORD_REQUIRED');
  if (source.schema !== EMP1_ENGINEERING_RECORD_RELEASE_QUALIFICATION_SCHEMA
    || source.productId !== 'EMP.1') {
    throw qualificationError('EMP1_RELEASE_QUALIFICATION_RECORD_SCHEMA_INVALID');
  }
  const packageIdentity = normalizePackageIdentity(source.packageIdentity);
  const releaseAuthority = normalizeReleaseAuthorityIdentity(source.releaseAuthorityIdentity);
  const handoff = normalizeHandoff(source.handoff);
  const existingAuthority = normalizeExistingReleaseAuthority(source.existingReleaseAuthority);
  const reviewAccepted = packageIdentity.recordState === 'REVIEW_ACCEPTED';
  const expectedReleaseQualified = handoff.compatible === true
    && reviewAccepted
    && existingAuthority.releaseQualified === true;
  if (source.releaseQualified !== expectedReleaseQualified) {
    throw qualificationError('EMP1_RELEASE_QUALIFICATION_RELEASE_FLAG_INVALID');
  }
  const expectedState = qualificationStateFromSummary(
    handoff,
    existingAuthority,
    packageIdentity.recordState,
  );
  if (source.state !== expectedState) {
    throw qualificationError('EMP1_RELEASE_QUALIFICATION_STATE_INVALID');
  }
  const normalized = {
    schema: source.schema,
    productId: source.productId,
    state: source.state,
    releaseQualified: source.releaseQualified,
    packageIdentity,
    releaseAuthorityIdentity: releaseAuthority,
    handoff,
    existingReleaseAuthority: existingAuthority,
    blockers: stringArray(source.blockers),
    authorityBoundary: normalizeAuthorityBoundary(source.authorityBoundary),
  };
  const expectedBlockers = qualificationBlockersFromSummary(
    handoff,
    existingAuthority,
    packageIdentity.recordState,
  );
  if (JSON.stringify(normalized.blockers) !== JSON.stringify(expectedBlockers)) {
    throw qualificationError('EMP1_RELEASE_QUALIFICATION_BLOCKERS_INVALID');
  }
  const expectedHash = semanticHash(qualificationSemanticProjection(normalized));
  const expectedId = `emp1-engineering-record-release:${hashSuffix(expectedHash)}`;
  if (source.semanticHash !== expectedHash || source.qualificationId !== expectedId) {
    throw qualificationError('EMP1_RELEASE_QUALIFICATION_IDENTITY_MISMATCH');
  }
  return deepFreeze({ ...normalized, qualificationId: expectedId, semanticHash: expectedHash });
}

export function qualificationSemanticProjection(value) {
  return {
    schema: value.schema,
    productId: value.productId,
    state: value.state,
    releaseQualified: value.releaseQualified,
    packageIdentity: value.packageIdentity,
    releaseAuthorityIdentity: value.releaseAuthorityIdentity,
    handoff: value.handoff,
    existingReleaseAuthority: value.existingReleaseAuthority,
    blockers: value.blockers,
    authorityBoundary: value.authorityBoundary,
  };
}

function qualificationState(handoff, release, recordState) {
  return qualificationStateFromSummary({ compatible: handoff.handoffCompatible }, release, recordState);
}
function qualificationStateFromSummary(handoff, release, recordState) {
  if (handoff.compatible !== true) return 'RELEASE_INCOMPATIBLE_WITH_AUTHORIZED_PROFILE';
  if (recordState !== 'REVIEW_ACCEPTED') return 'RELEASE_BLOCKED_ENGINEERING_REVIEW_NOT_ACCEPTED';
  if (release.professionalReleaseReady !== true) return 'RELEASE_BLOCKED_EXISTING_AUTHORITY';
  if (release.releaseQualified !== true) return 'RELEASE_QUALIFICATION_PENDING_EXISTING_AUTHORITY';
  return 'RELEASE_QUALIFIED_EXISTING_AUTHORITY';
}
function qualificationBlockers(handoff, release, recordState) {
  return qualificationBlockersFromSummary({
    compatible: handoff.handoffCompatible,
    blockers: handoff.handoffBlockers,
  }, release, recordState);
}
function qualificationBlockersFromSummary(handoff, release, recordState) {
  const blockers = [...(handoff.blockers ?? [])];
  if (recordState !== 'REVIEW_ACCEPTED') {
    blockers.push('EMP1_RELEASE_QUALIFICATION_ACCEPTED_ENGINEERING_REVIEW_REQUIRED');
  }
  if (release.professionalReleaseReady !== true) {
    blockers.push('EMP1_RELEASE_QUALIFICATION_EXISTING_PROFESSIONAL_RELEASE_NOT_READY');
  }
  if (release.releaseQualified !== true) {
    blockers.push('EMP1_RELEASE_QUALIFICATION_EXISTING_RELEASE_NOT_QUALIFIED');
  }
  return deepFreeze([...new Set(blockers.map(String))]);
}

function releaseAuthorityIdentity() {
  const value = EMP1_AUTHORIZED_RELEASE_STATE_ARTIFACT;
  return deepFreeze({
    path: value.path,
    gitBlobSha1: value.gitBlobSha1,
    currentStateSemanticHash: value.semanticHash,
    releaseProfileId: value.releaseProfileId,
  });
}
function handoffSummary(handoff) {
  return deepFreeze({
    schema: handoff.schema,
    state: handoff.state,
    compatible: handoff.handoffCompatible,
    blockers: handoff.handoffBlockers,
    alignment: handoff.alignment,
  });
}
function normalizePackageIdentity(value) {
  const row = record(value, 'EMP1_RELEASE_QUALIFICATION_PACKAGE_IDENTITY_REQUIRED');
  return deepFreeze({
    packageId: text(row.packageId, 'EMP1_RELEASE_QUALIFICATION_PACKAGE_ID_REQUIRED'),
    semanticHash: text(row.semanticHash, 'EMP1_RELEASE_QUALIFICATION_PACKAGE_HASH_REQUIRED'),
    recordState: text(row.recordState, 'EMP1_RELEASE_QUALIFICATION_PACKAGE_STATE_REQUIRED'),
    routeAuthorityHash: text(row.routeAuthorityHash,
      'EMP1_RELEASE_QUALIFICATION_ROUTE_AUTHORITY_HASH_REQUIRED'),
  });
}
function normalizeReleaseAuthorityIdentity(value) {
  const row = record(value, 'EMP1_RELEASE_QUALIFICATION_AUTHORITY_IDENTITY_REQUIRED');
  const expected = releaseAuthorityIdentity();
  for (const [key, expectedValue] of Object.entries(expected)) {
    exact(`RECORD_RELEASE_AUTHORITY_${key}`, row[key], expectedValue);
  }
  return expected;
}
function normalizeHandoff(value) {
  const row = record(value, 'EMP1_RELEASE_QUALIFICATION_HANDOFF_REQUIRED');
  return deepFreeze({
    schema: text(row.schema, 'EMP1_RELEASE_QUALIFICATION_HANDOFF_SCHEMA_REQUIRED'),
    state: text(row.state, 'EMP1_RELEASE_QUALIFICATION_HANDOFF_STATE_REQUIRED'),
    compatible: row.compatible === true,
    blockers: stringArray(row.blockers),
    alignment: structuredClone(record(row.alignment,
      'EMP1_RELEASE_QUALIFICATION_HANDOFF_ALIGNMENT_REQUIRED')),
  });
}
function normalizeExistingReleaseAuthority(value) {
  const row = record(value, 'EMP1_RELEASE_QUALIFICATION_EXISTING_AUTHORITY_REQUIRED');
  const expected = EMP1_AUTHORIZED_RELEASE_STATE_ARTIFACT;
  const normalized = {
    professionalReleaseReady: row.professionalReleaseReady === true,
    definitionOfDoneComplete: row.definitionOfDoneComplete === true,
    boundedProductionRouteAuthorized: row.boundedProductionRouteAuthorized === true,
    boundedEngineeringUseAuthorized: row.boundedEngineeringUseAuthorized === true,
    globalEmp1CRouteAuthority: row.globalEmp1CRouteAuthority === true,
    codeComplianceAuthorized: row.codeComplianceAuthorized === true,
    releaseQualified: row.releaseQualified === true,
    deploymentAuthorized: row.deploymentAuthorized === true,
  };
  for (const key of Object.keys(normalized)) {
    exact(`RECORD_EXISTING_AUTHORITY_${key}`, normalized[key], expected[key]);
  }
  return deepFreeze(normalized);
}
function authorityBoundary() {
  return deepFreeze({
    releaseQualificationBindingAuthority: true,
    underlyingReleaseAuthorityCreatedByThisRecord: false,
    callerMaySetReleaseQualified: false,
    callerMaySubstituteReleaseStateAuthority: false,
    requiresAcceptedEngineeringReview: true,
    createsEngineeringCalculationAuthority: false,
    createsSourceAuthority: false,
    createsMethodAuthority: false,
    createsApplicabilityAuthority: false,
    createsReviewAuthority: false,
    createsCodeCompliance: false,
    createsDeploymentAuthority: false,
    createsCryptographicSeal: false,
    deploymentRequiresSeparateAuthority: true,
  });
}
function normalizeAuthorityBoundary(value) {
  const row = record(value, 'EMP1_RELEASE_QUALIFICATION_AUTHORITY_BOUNDARY_REQUIRED');
  const expected = authorityBoundary();
  for (const [key, expectedValue] of Object.entries(expected)) {
    exact(`AUTHORITY_BOUNDARY_${key}`, row[key], expectedValue);
  }
  return expected;
}
function exact(label, actual, expected) {
  if (actual !== expected) throw qualificationError(`EMP1_RELEASE_QUALIFICATION_AUTHORIZED_STATE_DRIFT:${label}`);
}
function stringArray(value) { return Object.freeze(Array.isArray(value) ? value.map(String) : []); }
function hashSuffix(value) { return value.startsWith('fnv1a64:') ? value.slice(8) : value; }
function text(value, code) {
  if (typeof value !== 'string' || !value.trim()) throw qualificationError(code);
  return value.trim();
}
function record(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw qualificationError(code);
  return value;
}
function qualificationError(code) { const error = new TypeError(code); error.code = code; return error; }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
