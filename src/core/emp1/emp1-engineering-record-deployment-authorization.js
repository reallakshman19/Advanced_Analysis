import { semanticHash } from '../shared-primitives/canonical-json.js';
import { requireEmp1EngineeringRecordReleaseQualification } from
  './emp1-engineering-record-release-qualification.js';

export const EMP1_ENGINEERING_RECORD_DEPLOYMENT_AUTHORIZATION_SCHEMA =
  'emp1-engineering-record-deployment-authorization/v1';

/**
 * Bind one validated Engineering Record release-qualification record to the
 * deployment authority already carried by its exact admitted release state.
 *
 * This record may reflect deploymentAuthorized=true only when the validated
 * upstream qualification is itself release-qualified and its admitted release
 * authority already says deploymentAuthorized=true. It never executes a
 * deployment and never creates the underlying deployment authority.
 */
export function createEmp1EngineeringRecordDeploymentAuthorization({
  releaseQualification,
} = {}) {
  const qualification = requireEmp1EngineeringRecordReleaseQualification(releaseQualification);
  const normalized = deploymentProjection(qualification);
  const authorizationSemanticHash = semanticHash(deploymentSemanticProjection(normalized));
  return deepFreeze({
    ...normalized,
    authorizationId: `emp1-engineering-record-deployment:${hashSuffix(authorizationSemanticHash)}`,
    semanticHash: authorizationSemanticHash,
  });
}

export function requireEmp1EngineeringRecordDeploymentAuthorization(value) {
  const source = record(value, 'EMP1_DEPLOYMENT_AUTHORIZATION_RECORD_REQUIRED');
  if (source.schema !== EMP1_ENGINEERING_RECORD_DEPLOYMENT_AUTHORIZATION_SCHEMA
    || source.productId !== 'EMP.1') {
    throw deploymentError('EMP1_DEPLOYMENT_AUTHORIZATION_RECORD_SCHEMA_INVALID');
  }

  const qualification = requireEmp1EngineeringRecordReleaseQualification(
    source.releaseQualification,
  );
  const expected = deploymentProjection(qualification);

  if (source.state !== expected.state) {
    throw deploymentError('EMP1_DEPLOYMENT_AUTHORIZATION_STATE_INVALID');
  }
  if (source.deploymentAuthorized !== expected.deploymentAuthorized) {
    throw deploymentError('EMP1_DEPLOYMENT_AUTHORIZATION_FLAG_INVALID');
  }
  if (JSON.stringify(source.blockers ?? []) !== JSON.stringify(expected.blockers)) {
    throw deploymentError('EMP1_DEPLOYMENT_AUTHORIZATION_BLOCKERS_INVALID');
  }
  requireBoundary(source.authorityBoundary);

  const normalized = {
    ...expected,
    authorityBoundary: authorityBoundary(),
  };
  const expectedHash = semanticHash(deploymentSemanticProjection(normalized));
  const expectedId = `emp1-engineering-record-deployment:${hashSuffix(expectedHash)}`;
  if (source.semanticHash !== expectedHash || source.authorizationId !== expectedId) {
    throw deploymentError('EMP1_DEPLOYMENT_AUTHORIZATION_IDENTITY_MISMATCH');
  }
  return deepFreeze({ ...normalized, authorizationId: expectedId, semanticHash: expectedHash });
}

export function deploymentSemanticProjection(value) {
  return {
    schema: value.schema,
    productId: value.productId,
    state: value.state,
    deploymentAuthorized: value.deploymentAuthorized,
    releaseQualification: value.releaseQualification,
    releaseQualificationIdentity: value.releaseQualificationIdentity,
    existingAuthority: value.existingAuthority,
    upstreamReleaseBlockers: value.upstreamReleaseBlockers,
    blockers: value.blockers,
    authorityBoundary: value.authorityBoundary,
  };
}

function deploymentProjection(qualification) {
  const releaseQualified = qualification.releaseQualified === true;
  const existingDeploymentAuthority =
    qualification.existingReleaseAuthority?.deploymentAuthorized === true;
  const reviewAccepted = qualification.packageIdentity?.recordState === 'REVIEW_ACCEPTED';
  const deploymentAuthorized = releaseQualified && existingDeploymentAuthority;

  return deepFreeze({
    schema: EMP1_ENGINEERING_RECORD_DEPLOYMENT_AUTHORIZATION_SCHEMA,
    productId: 'EMP.1',
    state: deploymentState({ releaseQualified, existingDeploymentAuthority }),
    deploymentAuthorized,
    releaseQualification: qualification,
    releaseQualificationIdentity: {
      qualificationId: qualification.qualificationId,
      semanticHash: qualification.semanticHash,
      state: qualification.state,
      releaseQualified,
      packageId: qualification.packageIdentity.packageId,
      packageSemanticHash: qualification.packageIdentity.semanticHash,
    },
    existingAuthority: {
      professionalReleaseReady:
        qualification.existingReleaseAuthority.professionalReleaseReady === true,
      releaseQualified:
        qualification.existingReleaseAuthority.releaseQualified === true,
      deploymentAuthorized: existingDeploymentAuthority,
    },
    upstreamReleaseBlockers: [...qualification.blockers],
    blockers: deploymentBlockers({
      reviewAccepted,
      releaseQualified,
      existingDeploymentAuthority,
    }),
    authorityBoundary: authorityBoundary(),
  });
}

function deploymentState({ releaseQualified, existingDeploymentAuthority }) {
  if (!releaseQualified) return 'DEPLOYMENT_BLOCKED_RELEASE_NOT_QUALIFIED';
  if (!existingDeploymentAuthority) return 'DEPLOYMENT_BLOCKED_EXISTING_AUTHORITY';
  return 'DEPLOYMENT_AUTHORIZED_EXISTING_AUTHORITY';
}

function deploymentBlockers({
  reviewAccepted,
  releaseQualified,
  existingDeploymentAuthority,
}) {
  const blockers = [];
  if (!reviewAccepted) {
    blockers.push('EMP1_DEPLOYMENT_ACCEPTED_ENGINEERING_REVIEW_REQUIRED');
  }
  if (!releaseQualified) {
    blockers.push('EMP1_DEPLOYMENT_RELEASE_QUALIFICATION_REQUIRED');
  }
  if (!existingDeploymentAuthority) {
    blockers.push('EMP1_DEPLOYMENT_EXISTING_AUTHORITY_REQUIRED');
  }
  return deepFreeze(blockers);
}

function authorityBoundary() {
  return deepFreeze({
    deploymentAuthorizationBindingAuthority: true,
    underlyingDeploymentAuthorityCreatedByThisRecord: false,
    callerMaySetDeploymentAuthorized: false,
    callerMaySubstituteReleaseQualification: false,
    requiresAcceptedEngineeringReview: true,
    requiresReleaseQualifiedEngineeringRecord: true,
    requiresExistingDeploymentAuthority: true,
    executesDeployment: false,
    mutatesDeploymentTarget: false,
    observesRollbackExecution: false,
    authorizesRollbackSuccess: false,
    createsEngineeringCalculationAuthority: false,
    createsSourceAuthority: false,
    createsMethodAuthority: false,
    createsApplicabilityAuthority: false,
    createsReviewAuthority: false,
    createsCodeCompliance: false,
    createsReleaseAuthority: false,
    createsUnderlyingDeploymentAuthority: false,
    createsCryptographicSeal: false,
  });
}

function requireBoundary(value) {
  const row = record(value, 'EMP1_DEPLOYMENT_AUTHORIZATION_BOUNDARY_REQUIRED');
  const expected = authorityBoundary();
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (row[key] !== expectedValue) {
      throw deploymentError(`EMP1_DEPLOYMENT_AUTHORIZATION_BOUNDARY_INVALID:${key}`);
    }
  }
  return expected;
}

function hashSuffix(value) { return value.startsWith('fnv1a64:') ? value.slice(8) : value; }
function record(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw deploymentError(code);
  return value;
}
function deploymentError(code) { const error = new TypeError(code); error.code = code; return error; }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
