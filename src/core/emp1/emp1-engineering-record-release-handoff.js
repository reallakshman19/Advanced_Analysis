import { requireEmp1EngineeringRecordPackage } from './emp1-engineering-record-package.js';

export const EMP1_ENGINEERING_RECORD_RELEASE_HANDOFF_SCHEMA =
  'emp1-engineering-record-release-handoff/v1';

const RELEASE_STATE_SCHEMA = 'emp1-professional-release-current-state/v1';

/**
 * Read-only bridge from one validated Engineering Record package into the
 * existing EMP.1 professional release process. It may reflect existing release
 * authority; it never creates, upgrades, or clears that authority.
 */
export function projectEmp1EngineeringRecordReleaseHandoff({
  packageValue,
  releaseState,
} = {}) {
  const engineeringRecord = requireEmp1EngineeringRecordPackage(packageValue);
  const release = requireReleaseState(releaseState);
  const packageRoute = record(
    engineeringRecord.routeAuthority?.snapshot,
    'EMP1_RELEASE_HANDOFF_PACKAGE_ROUTE_SNAPSHOT_REQUIRED',
  );
  const releaseScope = record(
    release.boundedScope,
    'EMP1_RELEASE_HANDOFF_RELEASE_SCOPE_REQUIRED',
  );
  const runtime = record(
    release.runtimeAuthority,
    'EMP1_RELEASE_HANDOFF_RUNTIME_AUTHORITY_REQUIRED',
  );
  const sequence = record(
    release.sequenceStatus,
    'EMP1_RELEASE_HANDOFF_SEQUENCE_STATUS_REQUIRED',
  );

  const alignment = alignmentProjection(engineeringRecord, packageRoute, release);
  const handoffBlockers = [];
  if (!alignment.routeIdMatch) handoffBlockers.push('EMP1_RELEASE_HANDOFF_ROUTE_ID_MISMATCH');
  if (alignment.methodSourceShaComparable && !alignment.methodSourceShaMatch) {
    handoffBlockers.push('EMP1_RELEASE_HANDOFF_METHOD_SOURCE_MISMATCH');
  }
  if (alignment.gammaComparable && !alignment.gammaMatch) {
    handoffBlockers.push('EMP1_RELEASE_HANDOFF_GAMMA_SCOPE_MISMATCH');
  }
  if (alignment.shellFamilyComparable && !alignment.shellFamilyMatch) {
    handoffBlockers.push('EMP1_RELEASE_HANDOFF_SHELL_FAMILY_MISMATCH');
  }
  if (alignment.attachmentShapeComparable && !alignment.attachmentShapeMatch) {
    handoffBlockers.push('EMP1_RELEASE_HANDOFF_ATTACHMENT_SHAPE_MISMATCH');
  }

  const releaseProcessBlockers = [];
  if (sequence.professionalReleaseReady !== true) {
    releaseProcessBlockers.push('EMP1_RELEASE_HANDOFF_EXISTING_PROFESSIONAL_RELEASE_NOT_READY');
  }
  if (runtime.releaseQualified !== true) {
    releaseProcessBlockers.push('EMP1_RELEASE_HANDOFF_EXISTING_RELEASE_NOT_QUALIFIED');
  }
  if (runtime.deploymentAuthorized !== true) {
    releaseProcessBlockers.push('EMP1_RELEASE_HANDOFF_EXISTING_DEPLOYMENT_NOT_AUTHORIZED');
  }

  return deepFreeze({
    schema: EMP1_ENGINEERING_RECORD_RELEASE_HANDOFF_SCHEMA,
    productId: 'EMP.1',
    packageIdentity: {
      packageId: engineeringRecord.packageId,
      semanticHash: engineeringRecord.semanticHash,
      recordState: engineeringRecord.recordState,
      routeAuthorityHash: engineeringRecord.evidence.routeAuthorityHash,
    },
    releaseProfile: {
      releaseProfileId: textOrNull(release.releaseProfileId),
      routeId: textOrNull(releaseScope.routeId),
    },
    alignment,
    handoffCompatible: handoffBlockers.length === 0,
    handoffBlockers,
    existingReleaseState: {
      professionalReleaseReady: sequence.professionalReleaseReady === true,
      boundedProductionRouteAuthorized: runtime.boundedProductionRouteAuthorized === true,
      boundedEngineeringUseAuthorized: runtime.boundedEngineeringUseAuthorized === true,
      globalEmp1CRouteAuthority: runtime.globalEmp1CRouteAuthority === true,
      codeComplianceAuthorized: runtime.codeComplianceAuthorized === true,
      releaseQualified: runtime.releaseQualified === true,
      deploymentAuthorized: runtime.deploymentAuthorized === true,
    },
    releaseProcessBlockers,
    state: handoffState({ handoffBlockers, runtime, sequence }),
    authorityBoundary: {
      handoffProjectionOnly: true,
      consumesExistingReleaseState: true,
      maySetReleaseQualified: false,
      maySetDeploymentAuthorized: false,
      createsEngineeringCalculationAuthority: false,
      createsMethodAuthority: false,
      createsApplicabilityAuthority: false,
      createsReviewAuthority: false,
      createsCodeCompliance: false,
      createsReleaseAuthority: false,
      createsDeploymentAuthority: false,
      createsCryptographicSeal: false,
    },
  });
}

function alignmentProjection(engineeringRecord, packageRoute, release) {
  const releaseScope = release.boundedScope;
  const packageRegistry = packageRoute.registry ?? {};
  const packageMethod = engineeringRecord.limitations?.method ?? packageRegistry.method ?? null;
  const packageScope = engineeringRecord.limitations?.scope ?? packageRegistry.scope ?? null;
  const packageRouteId = textOrNull(packageRoute.routeId ?? packageRegistry.routeId);
  const releaseRouteId = textOrNull(releaseScope.routeId);
  const packageSourceSha = textOrNull(
    packageMethod?.sourceDocumentSha256 ?? packageMethod?.sourceSha256,
  );
  const releaseSourceSha = textOrNull(release.sourceState?.wrcSourceSha256);
  return deepFreeze({
    packageRouteId,
    releaseRouteId,
    routeIdMatch: packageRouteId != null && packageRouteId === releaseRouteId,
    methodSourceShaComparable: packageSourceSha != null && releaseSourceSha != null,
    packageMethodSourceSha256: packageSourceSha,
    releaseMethodSourceSha256: releaseSourceSha,
    methodSourceShaMatch: packageSourceSha == null || releaseSourceSha == null
      ? null
      : packageSourceSha === releaseSourceSha,
    gammaComparable: packageScope?.gamma != null && releaseScope.gamma != null,
    gammaMatch: comparableEqual(packageScope?.gamma, releaseScope.gamma),
    shellFamilyComparable: packageScope?.shellFamily != null && releaseScope.shellFamily != null,
    shellFamilyMatch: comparableEqual(packageScope?.shellFamily, releaseScope.shellFamily),
    attachmentShapeComparable:
      packageScope?.attachmentShape != null && releaseScope.attachmentShape != null,
    attachmentShapeMatch: comparableEqual(
      packageScope?.attachmentShape,
      releaseScope.attachmentShape,
    ),
  });
}

function handoffState({ handoffBlockers, runtime, sequence }) {
  if (handoffBlockers.length) return 'HANDOFF_INCOMPATIBLE_WITH_EXISTING_RELEASE_PROFILE';
  if (runtime.releaseQualified === true && runtime.deploymentAuthorized === true) {
    return 'EXISTING_RELEASE_AND_DEPLOYMENT_AUTHORITY_PRESENT';
  }
  if (runtime.releaseQualified === true) return 'EXISTING_RELEASE_QUALIFICATION_PRESENT';
  if (sequence.professionalReleaseReady === true) {
    return 'HANDOFF_ALIGNED_EXISTING_RELEASE_QUALIFICATION_PENDING';
  }
  return 'HANDOFF_ALIGNED_EXISTING_RELEASE_PROCESS_BLOCKED';
}

function comparableEqual(left, right) {
  if (left == null || right == null) return null;
  return left === right;
}
function requireReleaseState(value) {
  const row = record(value, 'EMP1_RELEASE_HANDOFF_RELEASE_STATE_REQUIRED');
  if (row.schema !== RELEASE_STATE_SCHEMA) {
    throw handoffError('EMP1_RELEASE_HANDOFF_RELEASE_STATE_SCHEMA_INVALID');
  }
  return row;
}
function textOrNull(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}
function record(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw handoffError(code);
  return value;
}
function handoffError(code) { const error = new TypeError(code); error.code = code; return error; }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
