import { lafeaRunExecutionIdentity } from './lafea-run-history.js';

export const LAFEA_WORKBENCH_LIFECYCLE_EXPORT_AUTHORITY_SCHEMA =
  'lafea-workbench-lifecycle-export-current-authority/v1';

const CALCULATION_ACCEPTED = 'CALCULATION_ACCEPTED_BY_STAGE_CONTRACT';
const RELEASE_QUALIFIED = 'RELEASE_QUALIFIED';
const GOVERNED_RESULT_AUTHORITY_BASIS = 'GOVERNED_EXECUTION_AND_READINESS';
const LEGACY_RESULT_AUTHORITY_BASIS = 'LEGACY_LIFECYCLE_READINESS';

/**
 * Read-only interpretation of retained lifecycle evidence against the current
 * workbench authority state. The lifecycle ledger is intentionally not
 * rewritten when a newer engineering gate revokes current result authority.
 */
export function projectLafeaWorkbenchLifecycleExportAuthority(stageValue) {
  const stage = requireStage(stageValue);
  const readiness = stage.lifecycleReadiness ?? {};
  const execution = stage.execution ?? null;
  const executionArtifact = stage.lifecycle?.artifacts?.EXECUTION ?? null;
  const releaseRecord = stage.retainedTemplateReleaseRecord ?? null;
  const releaseBinding = readiness.releaseBinding ?? null;
  const governedRoute = stage.domainFirstProfileActive === true
    || stage.shellMidsurfaceProfileActive === true;
  const resultAuthorityBasis = governedRoute
    ? GOVERNED_RESULT_AUTHORITY_BASIS
    : LEGACY_RESULT_AUTHORITY_BASIS;
  const currentResultAccepted = governedRoute
    ? execution?.status === 'QUALIFIED'
      && readiness.calculationState === CALCULATION_ACCEPTED
      && readiness.resultReady === true
    : readiness.resultReady === true;
  const currentReleaseQualified = readiness.releaseState === RELEASE_QUALIFIED
    && releaseBinding?.releaseQualified === true;

  return deepFreeze({
    schema: LAFEA_WORKBENCH_LIFECYCLE_EXPORT_AUTHORITY_SCHEMA,
    stageId: stage.stageId,
    governedRoute,
    resultAuthorityBasis,
    retainedEvidence: {
      executionPresent: execution !== null,
      executionStatus: execution?.status ?? null,
      executionIdentity: execution ? lafeaRunExecutionIdentity(execution) : null,
      lifecycleExecutionArtifactStatus: executionArtifact?.status ?? 'ABSENT',
      lifecycleExecutionArtifactQualification: executionArtifact?.qualification ?? null,
      lifecycleExecutionArtifactHash: executionArtifact?.artifactHash ?? null,
      releaseRecordPresent: releaseRecord !== null,
      releaseRecordSemanticHash: releaseRecord?.semanticHash ?? null,
      releaseRecordAuthorityState: releaseRecord?.authorityState ?? null,
    },
    currentAuthority: {
      calculationState: readiness.calculationState ?? null,
      resultReady: readiness.resultReady === true,
      currentResultAccepted,
      releaseState: readiness.releaseState ?? null,
      releaseBindingStatus: releaseBinding?.bindingStatus ?? 'ABSENT',
      currentReleaseQualified,
      blockingReasons: [...(readiness.blockingReasons ?? [])],
      releaseBlockingReasons: [...(readiness.releaseBlockingReasons ?? [])],
    },
    interpretation: {
      lifecycleArtifactStatusIsRetainedEvidenceOnly: true,
      retainedExecutionQualificationGrantsCurrentAuthority: false,
      retainedReleaseRecordGrantsCurrentAuthority: false,
      exportGrantsCurrentResultAuthority: false,
      exportGrantsCurrentReleaseAuthority: false,
    },
  });
}

export function validateLafeaWorkbenchLifecycleExportAuthority(value) {
  if (!value || value.schema !== LAFEA_WORKBENCH_LIFECYCLE_EXPORT_AUTHORITY_SCHEMA
    || typeof value.stageId !== 'string' || !value.stageId
    || typeof value.governedRoute !== 'boolean'
    || value.resultAuthorityBasis !== (value.governedRoute
      ? GOVERNED_RESULT_AUTHORITY_BASIS
      : LEGACY_RESULT_AUTHORITY_BASIS)
    || typeof value.retainedEvidence?.executionPresent !== 'boolean'
    || typeof value.currentAuthority?.resultReady !== 'boolean'
    || typeof value.currentAuthority?.currentResultAccepted !== 'boolean'
    || typeof value.currentAuthority?.currentReleaseQualified !== 'boolean'
    || !Array.isArray(value.currentAuthority?.blockingReasons)
    || !Array.isArray(value.currentAuthority?.releaseBlockingReasons)
    || value.interpretation?.lifecycleArtifactStatusIsRetainedEvidenceOnly !== true
    || value.interpretation?.retainedExecutionQualificationGrantsCurrentAuthority !== false
    || value.interpretation?.retainedReleaseRecordGrantsCurrentAuthority !== false
    || value.interpretation?.exportGrantsCurrentResultAuthority !== false
    || value.interpretation?.exportGrantsCurrentReleaseAuthority !== false) {
    throw authorityError('LAFEA_LIFECYCLE_EXPORT_CURRENT_AUTHORITY_INVALID');
  }
  if (value.currentAuthority.currentResultAccepted === true
    && value.currentAuthority.resultReady !== true) {
    throw authorityError('LAFEA_LIFECYCLE_EXPORT_RESULT_AUTHORITY_INCONSISTENT');
  }
  if (value.governedRoute === true
    && value.currentAuthority.currentResultAccepted === true
    && value.currentAuthority.calculationState !== CALCULATION_ACCEPTED) {
    throw authorityError('LAFEA_LIFECYCLE_EXPORT_RESULT_AUTHORITY_INCONSISTENT');
  }
  if (value.currentAuthority.currentReleaseQualified === true
    && (value.currentAuthority.releaseState !== RELEASE_QUALIFIED
      || value.currentAuthority.releaseBindingStatus !== 'CURRENT')) {
    throw authorityError('LAFEA_LIFECYCLE_EXPORT_RELEASE_AUTHORITY_INCONSISTENT');
  }
  return value;
}

function requireStage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || typeof value.stageId !== 'string' || !value.stageId) {
    throw authorityError('LAFEA_LIFECYCLE_EXPORT_STAGE_INVALID');
  }
  return value;
}

function authorityError(code) {
  const error = new TypeError(code);
  error.code = code;
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
