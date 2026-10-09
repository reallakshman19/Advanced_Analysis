import {
  createEmp1EngineeringRecordPackage,
  requireEmp1EngineeringRecordPackage,
} from '../core/emp1/emp1-engineering-record-package.js';
import {
  emp1EngineeringReviewEvidenceFromExecution,
  projectEmp1EngineeringReviewWorkspace,
} from './emp1-engineering-review-workspace.js';

export const EMP1_ENGINEERING_RECORD_PACKAGE_AVAILABILITY_SCHEMA =
  'emp1-engineering-record-package-availability/v1';

const CURRENT_REVIEW_STATES = new Set(['REVIEW_ACCEPTED', 'REVIEW_REJECTED']);

/** Project whether the exact current workspace evidence can be packaged. */
export function projectEmp1EngineeringRecordPackageAvailability({
  reviewRecord = null,
  execution = null,
  executionCurrentness = null,
  cState = null,
} = {}) {
  const reviewWorkspace = projectEmp1EngineeringReviewWorkspace({
    reviewRecord,
    execution,
    executionCurrentness,
    cState,
  });
  const blockers = [];
  if (reviewWorkspace.canCreateReview !== true) {
    blockers.push('EMP1_ENGINEERING_RECORD_CURRENT_EXECUTION_REQUIRED');
    blockers.push(...reviewWorkspace.creationBlockers);
  }
  if (reviewWorkspace.reviewState?.reviewed !== true) {
    blockers.push('EMP1_ENGINEERING_RECORD_REVIEW_REQUIRED');
  }
  if (reviewWorkspace.reviewState?.current !== true
    || !CURRENT_REVIEW_STATES.has(reviewWorkspace.reviewState?.state)) {
    blockers.push('EMP1_ENGINEERING_RECORD_CURRENT_REVIEW_REQUIRED');
  }
  return deepFreeze({
    schema: EMP1_ENGINEERING_RECORD_PACKAGE_AVAILABILITY_SCHEMA,
    productId: 'EMP.1',
    canExport: blockers.length === 0,
    blockers: [...new Set(blockers.map(String))],
    reviewState: reviewWorkspace.reviewState?.state ?? 'NOT_REVIEWED',
    reviewId: reviewWorkspace.reviewState?.reviewId ?? null,
    retention: {
      packagePersistence: 'EXPORTED_JSON_ONLY',
      controllerRetainsPackage: false,
    },
    authorityBoundary: {
      availabilityOnly: true,
      createsEngineeringCalculationAuthority: false,
      createsMethodAuthority: false,
      createsApplicabilityAuthority: false,
      createsReviewAuthority: false,
      createsCodeCompliance: false,
      createsReleaseAuthority: false,
      createsCryptographicSeal: false,
    },
  });
}

/** Build a package only from controller-retained execution/review custody. */
export function createEmp1WorkspaceEngineeringRecordPackage({
  reviewRecord,
  execution,
  executionCurrentness,
  cState,
  packagedAt,
} = {}) {
  const availability = projectEmp1EngineeringRecordPackageAvailability({
    reviewRecord,
    execution,
    executionCurrentness,
    cState,
  });
  if (!availability.canExport) {
    const error = workspaceError('EMP1_ENGINEERING_RECORD_PACKAGE_NOT_AVAILABLE');
    error.blockers = availability.blockers;
    throw error;
  }
  const packageValue = createEmp1EngineeringRecordPackage({
    packagedAt,
    reviewRecord,
    evidence: emp1EngineeringReviewEvidenceFromExecution(execution),
  });
  return requireEmp1EngineeringRecordPackage(packageValue);
}

export function emp1EngineeringRecordPackageFilename(value) {
  const packageValue = requireEmp1EngineeringRecordPackage(value);
  const suffix = packageValue.packageId.split(':').at(-1);
  return `emp1-engineering-record-${suffix}.json`;
}

export function serializeEmp1EngineeringRecordPackage(value) {
  return `${JSON.stringify(requireEmp1EngineeringRecordPackage(value), null, 2)}\n`;
}

function workspaceError(code) { const error = new TypeError(code); error.code = code; return error; }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
