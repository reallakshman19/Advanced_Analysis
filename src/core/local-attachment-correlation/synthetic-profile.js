import {
  CORRELATION_PROFILE_SCHEMA,
  CORRELATION_REQUEST_SCHEMA,
  INTERPOLATION_POLICIES,
  LOAD_BASES,
} from './constants.js';
import {
  CORRELATION_APPLICABILITY_DEFINITION_SCHEMA,
  createCorrelationApplicabilityDefinition,
} from './physical-applicability.js';
import { createCorrelationProfile } from './profile.js';

export function syntheticCorrelationProfile() {
  return createCorrelationProfile({
    schema: CORRELATION_PROFILE_SCHEMA,
    methodIdentity: 'SYNTHETIC_LOCAL_ATTACHMENT_CORRELATION',
    methodEdition: 'QUALIFICATION-1',
    coefficientDatasetId: 'SYNTHETIC-2X2-SIX-LOAD-001',
    coefficientDatasetHash: null,
    interpolationPolicyId: INTERPOLATION_POLICIES.BILINEAR_NO_EXTRAPOLATION,
    applicabilityProfileId: 'SYNTHETIC-D_RATIO-0.20-0.30-DT-20-40',
    provenance: {
      sourceReference: 'INTERNAL_SYNTHETIC_QUALIFICATION_DATA',
      sourceEdition: '1',
      dataExtraction: 'DIRECT_NUMERIC_FIXTURE',
      licenseAuthority: 'INTERNAL_TEST_DATA',
    },
    authority: {
      engineeringUseAuthorized: false,
      authorizationBasis: 'SYNTHETIC_QUALIFICATION_ONLY',
    },
    axes: {
      diameterRatio: { knots: [0.2, 0.3], sourceResolution: 0 },
      diameterThicknessRatio: { knots: [20, 40], sourceResolution: 0 },
    },
    targets: [{
      targetId: 'CROWN_OUTER',
      surface: 'OUTER',
      description: 'Synthetic outer-surface crown qualification target.',
    }],
    responses: [
      response('FX-SIGMA-X-MEMBRANE', 'SIGMA_X', 'MEMBRANE', 'FX', LOAD_BASES.FORCE_OVER_D_T,
        [[1.0, 1.4], [1.6, 2.0]]),
      response('FY-SIGMA-THETA-MEMBRANE', 'SIGMA_THETA', 'MEMBRANE', 'FY', LOAD_BASES.FORCE_OVER_D_T,
        constantGrid(2)),
      response('FZ-SIGMA-X-MEMBRANE', 'SIGMA_X', 'MEMBRANE', 'FZ', LOAD_BASES.FORCE_OVER_D_T,
        constantGrid(-0.5)),
      response('MX-TAU-XTHETA-SHEAR', 'TAU_XTHETA', 'SHEAR', 'MX', LOAD_BASES.MOMENT_OVER_D2_T,
        constantGrid(1)),
      response('MY-SIGMA-X-BENDING', 'SIGMA_X', 'BENDING', 'MY', LOAD_BASES.MOMENT_OVER_D2_T,
        [[2, 4], [6, 8]]),
      response('MZ-SIGMA-THETA-BENDING', 'SIGMA_THETA', 'BENDING', 'MZ', LOAD_BASES.MOMENT_OVER_D2_T,
        constantGrid(3)),
    ],
    uncertainty: {
      numericEvaluationTolerance: 1e-12,
      sourceDataResolution: 0,
      interpolationUncertainty: 0,
      methodValidationError: null,
    },
  });
}

export function syntheticCorrelationApplicabilityDefinition(profileInput = null) {
  const profile = profileInput ? createCorrelationProfile(profileInput) : syntheticCorrelationProfile();
  return createCorrelationApplicabilityDefinition({
    schema: CORRELATION_APPLICABILITY_DEFINITION_SCHEMA,
    definitionIdentity: 'SYNTHETIC-PHYSICAL-APPLICABILITY-001',
    methodIdentity: profile.methodIdentity,
    methodEdition: profile.methodEdition,
    coefficientDatasetHash: profile.coefficientDatasetHash,
    applicabilityProfileId: profile.applicabilityProfileId,
    sourceReference: 'INTERNAL_SYNTHETIC_QUALIFICATION_DATA/PHYSICAL_APPLICABILITY',
    sourceEdition: '1',
    topology: {
      hostShellFamily: 'CYLINDRICAL_SHELL',
      attachmentFamily: 'CIRCULAR_ATTACHMENT',
      intersectionOrientation: 'NORMAL_TO_HOST_MIDSURFACE',
      loadReferenceConvention: 'ATTACHMENT_SHELL_INTERFACE',
    },
    permittedTargetIds: profile.targets.map((row) => row.targetId),
    parameterLimits: [
      {
        parameterId: 'DIAMETER_RATIO',
        minimum: 0.2,
        maximum: 0.3,
        minimumInclusive: true,
        maximumInclusive: true,
      },
      {
        parameterId: 'DIAMETER_THICKNESS_RATIO',
        minimum: 20,
        maximum: 40,
        minimumInclusive: true,
        maximumInclusive: true,
      },
    ],
    exclusions: ['SYNTHETIC_FIXTURE_ONLY', 'NO_ENGINEERING_AUTHORITY'],
  });
}

export function syntheticCorrelationRequest(overrides = {}) {
  const request = {
    schema: CORRELATION_REQUEST_SCHEMA,
    requestIdentity: 'SYNTHETIC-HAND-CALC-001',
    sourceCustody: {
      authorityType: 'SYNTHETIC_DIRECT',
      sourceStageId: null,
      sourceRequestHash: null,
      sourceResultHash: null,
      geometryEvidenceHash: null,
      screeningCaseId: null,
      targetMappings: [{ targetId: 'CROWN_OUTER', evaluationLocationId: null }],
    },
    geometry: {
      pipeOutsideDiameter: 300,
      pipeThickness: 10,
      attachmentDiameter: 75,
    },
    loads: {
      FX: 90000,
      FY: 30000,
      FZ: 60000,
      MX: 1800000,
      MY: 9000000,
      MZ: 2700000,
    },
    pressureByTarget: [{
      targetId: 'CROWN_OUTER',
      SIGMA_X: 15,
      SIGMA_THETA: 30,
      SIGMA_R: 0,
      TAU_XTHETA: 0,
    }],
  };
  return mergeRequest(request, overrides);
}

function response(responseId, stressComponent, stressClass, loadComponent, loadBasis, coefficients) {
  return {
    responseId,
    targetId: 'CROWN_OUTER',
    stressComponent,
    stressClass,
    loadComponent,
    loadBasis,
    coefficients,
  };
}
function constantGrid(value) { return [[value, value], [value, value]]; }
function mergeRequest(base, overrides) {
  const result = structuredClone(base);
  if (overrides.requestIdentity !== undefined) result.requestIdentity = overrides.requestIdentity;
  if (overrides.sourceCustody !== undefined) result.sourceCustody = structuredClone(overrides.sourceCustody);
  if (overrides.geometry) Object.assign(result.geometry, overrides.geometry);
  if (overrides.loads) Object.assign(result.loads, overrides.loads);
  if (overrides.pressureByTarget !== undefined) result.pressureByTarget = structuredClone(overrides.pressureByTarget);
  return result;
}
