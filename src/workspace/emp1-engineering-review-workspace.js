import {
  createEmp1EngineeringReviewRecord,
  projectEmp1EngineeringReviewState,
  requireEmp1EngineeringReviewRecord,
} from '../core/emp1/emp1-engineering-review-record.js';
import {
  EMP1_WORKBENCH_C_STATE,
  EMP1_WORKBENCH_EXECUTION_CURRENTNESS,
  EMP1_WORKBENCH_PRODUCT_EXECUTION_SCHEMA,
} from './emp1-workbench-run-state.js';

export const EMP1_ENGINEERING_REVIEW_WORKSPACE_SCHEMA =
  'emp1-engineering-review-workspace/v1';
export const EMP1_ENGINEERING_REVIEW_BASIS_CODE = 'EMP1_ENGINEERING_RESULT_REVIEW';

const EXPORTABLE_REVIEW_STATES = new Set(['REVIEW_ACCEPTED', 'REVIEW_REJECTED']);

/**
 * Extract review evidence only from one retained workbench execution. Caller/UI
 * values cannot supply or override engineering hashes through this adapter.
 */
export function emp1EngineeringReviewEvidenceFromExecution(execution) {
  const value = requireExecution(execution);
  const authority = record(value.authority, 'EMP1_ENGINEERING_REVIEW_EXECUTION_AUTHORITY_REQUIRED');
  const routeAuthorityHash = text(
    authority.routeAuthorityHash,
    'EMP1_ENGINEERING_REVIEW_EXECUTION_ROUTE_AUTHORITY_HASH_REQUIRED',
  );
  const routeAuthoritySnapshot = record(
    authority.routeAuthoritySnapshot,
    'EMP1_ENGINEERING_REVIEW_EXECUTION_ROUTE_AUTHORITY_SNAPSHOT_REQUIRED',
  );
  if (routeAuthoritySnapshot.semanticHash !== routeAuthorityHash) {
    throw workspaceError('EMP1_ENGINEERING_REVIEW_EXECUTION_ROUTE_AUTHORITY_MISMATCH');
  }
  return Object.freeze({
    sourceHash: text(value.sourceHash, 'EMP1_ENGINEERING_REVIEW_EXECUTION_SOURCE_HASH_REQUIRED'),
    routeAuthorityHash,
    routeAuthoritySnapshot,
    result: record(value.result, 'EMP1_ENGINEERING_REVIEW_EXECUTION_RESULT_REQUIRED'),
  });
}

/** Read-only workspace projection over one retained review and current workbench state. */
export function projectEmp1EngineeringReviewWorkspace({
  reviewRecord = null,
  execution = null,
  executionCurrentness = null,
  cState = null,
} = {}) {
  const reasons = reviewCreationBlockers({ execution, executionCurrentness, cState });
  let reviewState = projectEmp1EngineeringReviewState({ reviewRecord: null });
  let retainedReview = null;
  let validatedReviewRecord = null;
  if (reviewRecord != null) {
    const review = requireEmp1EngineeringReviewRecord(reviewRecord);
    validatedReviewRecord = review;
    retainedReview = reviewSummary(review);
    if (execution != null) {
      reviewState = projectEmp1EngineeringReviewState({
        reviewRecord: review,
        evidence: emp1EngineeringReviewEvidenceFromExecution(execution),
      });
    } else {
      reviewState = Object.freeze({ ...reviewState, retainedReviewUnavailable: true });
    }
  }

  const engineeringRecordExport = recordExportDescriptor({
    reviewRecord: validatedReviewRecord,
    reviewState,
    execution,
    currentnessBlockers: reasons,
  });

  return deepFreeze({
    schema: EMP1_ENGINEERING_REVIEW_WORKSPACE_SCHEMA,
    productId: 'EMP.1',
    canCreateReview: reasons.length === 0,
    creationBlockers: reasons,
    reviewState,
    readinessReviewState: execution == null && reviewRecord != null ? null : reviewState,
    retainedReview,
    engineeringRecordExport,
    retention: {
      scope: 'WORKSPACE_SESSION_ONLY',
      durableExportImplemented: engineeringRecordExport.canExport,
      durableExportFormat: 'EMP1_ENGINEERING_RECORD_PACKAGE_JSON_V1',
    },
    authorityBoundary: {
      createsEngineeringCalculationAuthority: false,
      createsMethodAuthority: false,
      createsApplicabilityAuthority: false,
      createsCodeCompliance: false,
      createsReleaseAuthority: false,
      createsCryptographicSeal: false,
      uiMayAuthorEngineeringHashes: false,
      uiMayCreateAuditPackageIdentity: true,
    },
  });
}

/** Create a review only for a current/reportable governed C calculation. */
export function createEmp1WorkspaceEngineeringReview({
  disposition,
  reviewerIdentity,
  reviewerRole = null,
  comment = null,
  reviewedAt,
  execution,
  executionCurrentness,
  cState,
} = {}) {
  const blockers = reviewCreationBlockers({ execution, executionCurrentness, cState });
  if (blockers.length) {
    const error = workspaceError('EMP1_ENGINEERING_REVIEW_CURRENT_CALCULATION_REQUIRED');
    error.blockers = blockers;
    throw error;
  }
  return createEmp1EngineeringReviewRecord({
    disposition,
    reviewer: {
      identity: text(reviewerIdentity, 'EMP1_ENGINEERING_REVIEW_REVIEWER_IDENTITY_REQUIRED'),
      role: optionalText(reviewerRole),
    },
    reviewedAt: text(reviewedAt, 'EMP1_ENGINEERING_REVIEW_REVIEWED_AT_REQUIRED'),
    basisCode: EMP1_ENGINEERING_REVIEW_BASIS_CODE,
    comment: optionalText(comment),
    evidence: emp1EngineeringReviewEvidenceFromExecution(execution),
  });
}

function recordExportDescriptor({ reviewRecord, reviewState, execution, currentnessBlockers }) {
  const blockers = [];
  if (currentnessBlockers.length) {
    blockers.push('EMP1_ENGINEERING_RECORD_CURRENT_EXECUTION_REQUIRED', ...currentnessBlockers);
  }
  if (reviewRecord == null || reviewState?.reviewed !== true) {
    blockers.push('EMP1_ENGINEERING_RECORD_REVIEW_REQUIRED');
  }
  if (reviewState?.current !== true || !EXPORTABLE_REVIEW_STATES.has(reviewState?.state)) {
    blockers.push('EMP1_ENGINEERING_RECORD_CURRENT_REVIEW_REQUIRED');
  }
  const uniqueBlockers = Object.freeze([...new Set(blockers.map(String))]);
  const canExport = uniqueBlockers.length === 0;
  return deepFreeze({
    schema: 'emp1-engineering-record-export-descriptor/v1',
    canExport,
    blockers: uniqueBlockers,
    reviewState: reviewState?.state ?? 'NOT_REVIEWED',
    packageInput: canExport
      ? {
        reviewRecord,
        evidence: emp1EngineeringReviewEvidenceFromExecution(execution),
      }
      : null,
    authorityBoundary: {
      descriptorOnly: true,
      createsEngineeringAuthority: false,
      createsReleaseAuthority: false,
      createsCryptographicSeal: false,
      uiMayAuthorEngineeringHashes: false,
    },
  });
}

function reviewCreationBlockers({ execution, executionCurrentness, cState }) {
  const blockers = [];
  if (execution?.schema !== EMP1_WORKBENCH_PRODUCT_EXECUTION_SCHEMA) {
    blockers.push('EMP1_ENGINEERING_REVIEW_CURRENT_EXECUTION_REQUIRED');
  }
  if (executionCurrentness?.state !== EMP1_WORKBENCH_EXECUTION_CURRENTNESS.CURRENT) {
    blockers.push('EMP1_ENGINEERING_REVIEW_EXECUTION_NOT_CURRENT');
    blockers.push(...array(executionCurrentness?.reasons));
  }
  if (executionCurrentness?.inputCurrent !== true) {
    blockers.push('EMP1_ENGINEERING_REVIEW_INPUT_CURRENTNESS_REQUIRED');
  }
  if (executionCurrentness?.cAuthorityCurrent !== true) {
    blockers.push('EMP1_ENGINEERING_REVIEW_ROUTE_AUTHORITY_CURRENTNESS_REQUIRED');
  }
  if (cState?.state !== EMP1_WORKBENCH_C_STATE.CALCULATED_CURRENT
    || cState?.currentResultAvailable !== true) {
    blockers.push('EMP1_ENGINEERING_REVIEW_CURRENT_C_RESULT_REQUIRED');
  }
  return Object.freeze([...new Set(blockers.map(String))]);
}

function reviewSummary(review) {
  return Object.freeze({
    reviewId: review.reviewId,
    semanticHash: review.semanticHash,
    disposition: review.disposition,
    reviewer: review.reviewer,
    reviewedAt: review.reviewedAt,
    basisCode: review.basisCode,
    comment: review.comment,
    evidenceBinding: review.evidenceBinding,
  });
}

function requireExecution(value) {
  const execution = record(value, 'EMP1_ENGINEERING_REVIEW_EXECUTION_REQUIRED');
  if (execution.schema !== EMP1_WORKBENCH_PRODUCT_EXECUTION_SCHEMA || execution.productId !== 'EMP.1') {
    throw workspaceError('EMP1_ENGINEERING_REVIEW_EXECUTION_SCHEMA_INVALID');
  }
  return execution;
}
function array(value) { return Array.isArray(value) ? value : []; }
function optionalText(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}
function text(value, code) {
  if (typeof value !== 'string' || !value.trim()) throw workspaceError(code);
  return value.trim();
}
function record(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw workspaceError(code);
  return value;
}
function workspaceError(code) { const error = new TypeError(code); error.code = code; return error; }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
