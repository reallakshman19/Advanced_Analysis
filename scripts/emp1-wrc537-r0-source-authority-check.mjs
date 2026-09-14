#!/usr/bin/env node
import assert from 'node:assert/strict';
import { calculateLocalAttachmentFoundation } from '../src/core/local-stress/index.js';
import { semanticHash } from '../src/core/shared-primitives/canonical-json.js';
import {
  AXIAL_PRESSURE_THRUST_BASES,
  calculateLocalAttachmentScreening,
  createLocalAttachmentScreeningRequest,
} from '../src/core/local-attachment-screening/index.js';
import {
  EMP1_WRC537_ATTACHMENT_DIAMETER_BASIS,
  EMP1_WRC537_ATTACHMENT_PHYSICAL_LOCATION,
  EMP1_WRC537_ATTACHMENT_SOURCE_QUALIFIED,
  createEmp1Wrc537AttachmentSourceAuthority,
  requireEmp1Wrc537QualifiedAttachmentSourceAuthority,
} from '../src/core/emp1/emp1-wrc537-attachment-source-authority.js';
import {
  EMP1_WRC537_APPLICABILITY_SOURCE_QUALIFIED,
  EMP1_WRC537_ATTACHMENT_STATION_BASIS,
  EMP1_WRC537_CYLINDER_LENGTH_BASIS,
  createEmp1Wrc537ApplicabilitySourceAuthority,
} from '../src/core/emp1/emp1-wrc537-applicability-source-authority.js';
import {
  EMP1_WRC537_ATTACHMENT_SOURCE_QUALIFICATION,
  createEmp1RetainedSectionScreeningLayer,
  deriveEmp1Wrc537SourceCustody,
  requireEmp1Wrc537QualifiedR0SourceCustody,
} from '../src/core/emp1/emp1-wrc537-source-custody.js';
import {
  EMP1_C_WRC537_APPLICABILITY_SOURCE_SUSPENSION_REASON,
  EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID,
  EMP1_C_WRC537_LONGITUDINAL_CURVE_SUSPENSION_REASON,
  EMP1_C_WRC537_R0_SOURCE_SUSPENSION_REASON,
  EMP1_C_WRC537_ROUTE_REQUALIFICATION_SUSPENSION_REASON,
  emp1CBoundedRoute,
} from '../src/core/emp1/emp1-c-bounded-route-registry.js';
import {
  EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION,
  requireEmp1Wrc537Gamma5ZeroDpRuntimeSourceAuthority,
} from '../src/core/emp1/emp1-wrc537-gamma5-zero-dp-route.js';
import {
  EMP1_WRC537_TABLE5_EIGHT_POINT_LONGITUDINAL_AUTHORITY_ID,
} from '../src/core/emp1/emp1-wrc537-longitudinal-moment-curve-selection.js';
import {
  EMP1_WORKBENCH_ATTACHMENT_DIAMETER_BASIS,
  EMP1_WORKBENCH_ATTACHMENT_PHYSICAL_LOCATION,
  EMP1_WORKBENCH_LEGACY_RUN_INPUT_SCHEMA,
  EMP1_WORKBENCH_RUN_INPUT_SCHEMA,
  normalizeEmp1WorkbenchRunInput,
} from '../src/workspace/emp1-workbench-run-state.js';
import { canonicalFixture } from './lafea.1-fixtures.mjs';
import { rawRequestFixture } from './lafea.2-fixtures.mjs';

const foundationModel = routeFoundationModel({ meanRadius: 100, shellThickness: 20 });
const foundationResult = calculateLocalAttachmentFoundation(foundationModel);
assert.equal(foundationResult.qualification.state, 'ACCEPTED');
const request = createLocalAttachmentScreeningRequest(
  routeScreeningRequest(foundationModel, foundationResult),
);
const screeningResult = calculateLocalAttachmentScreening(request);
assert.equal(screeningResult.qualification.state, 'ACCEPTED');

const binding = {
  geometryIdentity: 'EMP1-R0-TYPED-SOURCE-TEST',
  outsideDiameter: 35.42857142857143,
  diameterBasis: EMP1_WRC537_ATTACHMENT_DIAMETER_BASIS,
  physicalLocation: EMP1_WRC537_ATTACHMENT_PHYSICAL_LOCATION,
  unit: 'mm',
  sourceReference: 'QUALIFICATION/DRAWING-N1/NOZZLE-OD-AT-SHELL-JUNCTURE',
};
const normalizedAttachment = {
  geometryIdentity: binding.geometryIdentity,
  attachmentDiameter: binding.outsideDiameter,
  diameterBasis: binding.diameterBasis,
  physicalLocation: binding.physicalLocation,
  unit: binding.unit,
  sourceReference: binding.sourceReference,
};
const authority = createEmp1Wrc537AttachmentSourceAuthority({
  ...binding,
  productionObservationUsedToSetAuthority: false,
});
const applicabilityAuthority = createEmp1Wrc537ApplicabilitySourceAuthority({
  geometryIdentity: 'EMP1-15-R0-ISOLATION-CYLINDER',
  cylinderLengthBasis: EMP1_WRC537_CYLINDER_LENGTH_BASIS,
  cylinderLength: 300,
  attachmentStationBasis: EMP1_WRC537_ATTACHMENT_STATION_BASIS,
  attachmentStationFromCylinderStart: 80,
  unit: 'mm',
  cylinderLengthSourceReference: 'EMP1-15/R0-ISOLATION/CYLINDER-LENGTH',
  attachmentStationSourceReference: 'EMP1-15/R0-ISOLATION/WRC-STATION',
  productionObservationUsedToSetAuthority: false,
});
assert.equal(authority.sourceQualification, EMP1_WRC537_ATTACHMENT_SOURCE_QUALIFIED);
assert.equal(applicabilityAuthority.sourceQualification,
  EMP1_WRC537_APPLICABILITY_SOURCE_QUALIFIED);
assert.equal(authority.sourceBindingSemanticHash, semanticHash(normalizedAttachment));
assert.equal(requireEmp1Wrc537QualifiedAttachmentSourceAuthority(authority).semanticHash,
  authority.semanticHash);

const typedLayer = createEmp1RetainedSectionScreeningLayer({
  screeningRequest: request,
  screeningResult,
  attachmentSourceAuthority: authority,
});
const typedCustody = deriveEmp1Wrc537SourceCustody({
  foundationResult: request.sourceEvidence.foundationResult,
  sectionScreening: typedLayer,
  loadCaseIdentity: 'LC-1',
});
const qualified = requireEmp1Wrc537QualifiedR0SourceCustody(typedCustody);
assert.equal(qualified.geometry.attachmentRadiusSourceQualification,
  EMP1_WRC537_ATTACHMENT_SOURCE_QUALIFIED);
close(qualified.geometry.meanRadius, 100, 'qualified mean radius');
close(qualified.geometry.shellThickness, 20, 'qualified shell thickness');
close(qualified.geometry.attachmentOutsideRadius, 17.714285714285715, 'qualified r0');
close(qualified.geometry.gamma, 5, 'qualified gamma');
close(qualified.geometry.beta, 0.155, 'qualified beta');
assert.equal(qualified.geometrySourceReferences.attachmentPhysicalLocation,
  EMP1_WRC537_ATTACHMENT_PHYSICAL_LOCATION);
assert.equal(qualified.geometrySourceReferences.attachmentSourceBindingSemanticHash,
  semanticHash(normalizedAttachment));

const runtime = requireEmp1Wrc537Gamma5ZeroDpRuntimeSourceAuthority({
  geometry: qualified.geometry,
  attachmentSourceAuthority: authority,
  applicabilitySourceAuthority: applicabilityAuthority,
});
assert.equal(runtime.attachmentSourceAuthority.semanticHash, authority.semanticHash);
assert.equal(runtime.applicabilitySourceAuthority.semanticHash, applicabilityAuthority.semanticHash);
close(runtime.attachmentOutsideRadius, qualified.geometry.attachmentOutsideRadius, 'runtime r0');
assert.equal(runtime.longitudinalMomentBendingAuthority.authorityId,
  EMP1_WRC537_TABLE5_EIGHT_POINT_LONGITUDINAL_AUTHORITY_ID);

expectCode(() => requireEmp1Wrc537Gamma5ZeroDpRuntimeSourceAuthority({
  geometry: qualified.geometry,
  applicabilitySourceAuthority: applicabilityAuthority,
}), 'EMP1_WRC537_R0_QUALIFIED_SOURCE_AUTHORITY_REQUIRED');
const differentValidAuthority = createEmp1Wrc537AttachmentSourceAuthority({
  ...binding,
  outsideDiameter: 40,
});
expectCode(() => requireEmp1Wrc537Gamma5ZeroDpRuntimeSourceAuthority({
  geometry: qualified.geometry,
  attachmentSourceAuthority: differentValidAuthority,
  applicabilitySourceAuthority: applicabilityAuthority,
}), 'EMP1_WRC537_GAMMA5_ZERO_DP_R0_SOURCE_VALUE_MISMATCH');

const legacyLayer = createEmp1RetainedSectionScreeningLayer({
  screeningRequest: request,
  screeningResult,
  geometryIdentity: binding.geometryIdentity,
  attachmentDiameter: binding.outsideDiameter,
  attachmentSourceReference: binding.sourceReference,
});
assert.equal(legacyLayer.attachmentGeometryEvidence.sourceQualification,
  EMP1_WRC537_ATTACHMENT_SOURCE_QUALIFICATION);
const legacyCustody = deriveEmp1Wrc537SourceCustody({
  foundationResult: request.sourceEvidence.foundationResult,
  sectionScreening: legacyLayer,
  loadCaseIdentity: 'LC-1',
});
expectCode(() => requireEmp1Wrc537QualifiedR0SourceCustody(legacyCustody),
  'EMP1_WRC537_R0_QUALIFIED_SOURCE_AUTHORITY_REQUIRED');
expectCode(() => createEmp1Wrc537AttachmentSourceAuthority({
  ...binding,
  diameterBasis: 'GENERIC_DIAMETER',
}), 'EMP1_WRC537_R0_OUTSIDE_DIAMETER_BASIS_REQUIRED');
expectCode(() => createEmp1Wrc537AttachmentSourceAuthority({
  ...binding,
  physicalLocation: 'UNSPECIFIED',
}), 'EMP1_WRC537_R0_SHELL_JUNCTURE_LOCATION_REQUIRED');
expectCode(() => createEmp1Wrc537AttachmentSourceAuthority({
  ...binding,
  productionObservationUsedToSetAuthority: true,
}), 'EMP1_WRC537_R0_PRODUCTION_OBSERVATION_PROHIBITED');
const bindingHashTamper = structuredClone(authority);
bindingHashTamper.sourceBindingSemanticHash = 'fnv1a64:0000000000000000';
expectCode(() => requireEmp1Wrc537QualifiedAttachmentSourceAuthority(bindingHashTamper),
  'EMP1_WRC537_R0_SOURCE_BINDING_HASH_MISMATCH');
const authorityHashTamper = structuredClone(authority);
authorityHashTamper.semanticHash = 'fnv1a64:0000000000000000';
expectCode(() => requireEmp1Wrc537QualifiedAttachmentSourceAuthority(authorityHashTamper),
  'EMP1_WRC537_R0_SOURCE_AUTHORITY_HASH_MISMATCH');
const shapeTamper = { ...structuredClone(authority), hiddenAuthority: true };
expectCode(() => requireEmp1Wrc537QualifiedAttachmentSourceAuthority(shapeTamper),
  'EMP1_WRC537_R0_SOURCE_AUTHORITY_SHAPE_MISMATCH');

assert.equal(EMP1_WORKBENCH_ATTACHMENT_DIAMETER_BASIS,
  EMP1_WRC537_ATTACHMENT_DIAMETER_BASIS);
assert.equal(EMP1_WORKBENCH_ATTACHMENT_PHYSICAL_LOCATION,
  EMP1_WRC537_ATTACHMENT_PHYSICAL_LOCATION);
const v3 = {
  schema: EMP1_WORKBENCH_RUN_INPUT_SCHEMA,
  localMethod: {
    routeRequest: {
      schema: 'emp1-wrc537-gamma5-zero-dp-orchestration-request/v2',
      loadCaseIdentity: 'LC-1',
      pressureResultIdentity: 'PR-1',
    },
    attachmentGeometry: normalizedAttachment,
  },
};
assert.deepEqual(normalizeEmp1WorkbenchRunInput(v3).localMethod.attachmentGeometry,
  normalizedAttachment);
expectCode(() => normalizeEmp1WorkbenchRunInput({
  ...v3,
  schema: EMP1_WORKBENCH_LEGACY_RUN_INPUT_SCHEMA,
}), 'EMP1_WORKBENCH_V2_ATTACHMENT_GEOMETRY_REBIND_REQUIRED');
const wrongBasis = structuredClone(v3);
wrongBasis.localMethod.attachmentGeometry.diameterBasis = 'GENERIC_DIAMETER';
expectCode(() => normalizeEmp1WorkbenchRunInput(wrongBasis),
  'EMP1_WORKBENCH_ATTACHMENT_OUTSIDE_DIAMETER_BASIS_REQUIRED');
const wrongLocation = structuredClone(v3);
wrongLocation.localMethod.attachmentGeometry.physicalLocation = 'UNSPECIFIED';
expectCode(() => normalizeEmp1WorkbenchRunInput(wrongLocation),
  'EMP1_WORKBENCH_ATTACHMENT_SHELL_JUNCTURE_LOCATION_REQUIRED');

const route = emp1CBoundedRoute(EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID);
assert.deepEqual(route.suspensionReasons, []);
for (const resolved of [
  EMP1_C_WRC537_R0_SOURCE_SUSPENSION_REASON,
  EMP1_C_WRC537_LONGITUDINAL_CURVE_SUSPENSION_REASON,
  EMP1_C_WRC537_APPLICABILITY_SOURCE_SUSPENSION_REASON,
  EMP1_C_WRC537_ROUTE_REQUALIFICATION_SUSPENSION_REASON,
]) {
  assert.equal(route.suspensionReasons.includes(resolved), false);
}
assert.equal(route.registered, true);
assert.equal(route.engineeringUseAuthorized, true);
assert.equal(route.method.routeRequalificationRequired, false);
assert.equal(route.globalEmp1CRouteAuthority, false);
assert.equal(route.releaseQualified, false);
assert.equal(route.scope.attachmentRadiusSourceAuthority,
  'EMP1_TYPED_ENGINEERING_SOURCE_BINDING_V1');
assert.equal(route.scope.attachmentRadiusSourceQualification,
  EMP1_WRC537_ATTACHMENT_SOURCE_QUALIFIED);
assert.equal(route.scope.runtimeAttachmentSourceEvidenceRequired, true);
assert.equal(route.scope.legacyAttachmentSourceAuthorized, false);
assert.equal(route.scope.longitudinalMomentCurveSelectionAuthorityId,
  EMP1_WRC537_TABLE5_EIGHT_POINT_LONGITUDINAL_AUTHORITY_ID);
assert.equal(route.scope.applicabilitySourceQualification,
  EMP1_WRC537_APPLICABILITY_SOURCE_QUALIFIED);
assert.equal(route.scope.nearestEndDistanceBasis, 'DERIVED_MIN_X_L_MINUS_X');
assert.equal(route.scope.runtimeApplicabilitySourceEvidenceRequired, true);
assert.equal(route.scope.legacyApplicabilityEvidenceAuthorizedForProduction, false);
assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION.attachmentOutsideRadiusSourceQualification,
  EMP1_WRC537_ATTACHMENT_SOURCE_QUALIFIED);
assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION.cylindricalApplicabilitySourceQualification,
  EMP1_WRC537_APPLICABILITY_SOURCE_QUALIFIED);

console.log(JSON.stringify({
  status: 'PASS_TYPED_WRC_R0_AUTHORITY_RETAINED_ON_CURRENT_AUTHORIZED_GAMMA5_ROUTE_WITH_WRC45_SOURCE_AUTHORITY',
  r0: qualified.geometry.attachmentOutsideRadius,
  beta: qualified.geometry.beta,
  gamma: qualified.geometry.gamma,
  sourceQualification: qualified.geometry.attachmentRadiusSourceQualification,
  sourceBindingSemanticHash: authority.sourceBindingSemanticHash,
  applicabilityAuthorityHash: applicabilityAuthority.semanticHash,
  r0FalsifiersIsolatedWithValidApplicabilityAuthority: true,
  routeR0ValueMismatchRejected: true,
  directRouteRuntimeAuthorityGuarded: true,
  longitudinalMomentAuthorityId: runtime.longitudinalMomentBendingAuthority.authorityId,
  remainingSuspensionReasons: route.suspensionReasons,
  productionRouteAuthorized: route.registered && route.engineeringUseAuthorized,
  globalEmp1CRouteAuthority: route.globalEmp1CRouteAuthority,
  releaseQualified: route.releaseQualified,
  historicalStandardNumericalQualification: 'NOT_RUN_NOT_CLAIMED',
}, null, 2));

function routeFoundationModel({ meanRadius, shellThickness }) {
  return canonicalFixture((source) => {
    const outerRadius = meanRadius + shellThickness / 2;
    const innerRadius = meanRadius - shellThickness / 2;
    source.pipeGeometry.outsideDiameter.value = 2 * outerRadius;
    source.thicknessBasis.nominalPipeThickness.value = shellThickness;
    source.thicknessBasis.corrosionAllowance.value = 0;
    source.thicknessBasis.assessmentPipeThickness.value = shellThickness;
    source.resultRequests.pressure[0].requestedRadii[0].value = innerRadius;
    source.resultRequests.pressure[0].requestedRadii[1].value = outerRadius;
  });
}

function routeScreeningRequest(foundationModel, foundationResult) {
  return rawRequestFixture((raw) => {
    raw.sourceEvidence = {
      ...raw.sourceEvidence,
      foundationModel: structuredClone(foundationModel),
      foundationResult: structuredClone(foundationResult),
    };
    raw.screeningCases = [{
      screeningCaseId: 'CASE-WRC-R0',
      mechanicalTerms: [{ loadCaseId: 'LC-1', factor: 1 }],
      pressureDefinitionId: 'P-CLOSED',
      pressureFactor: 1,
      axialPressureThrustBasis: AXIAL_PRESSURE_THRUST_BASES.EXCLUDES_PRESSURE_THRUST,
      sourceReference: 'EMP1-13/R0-SOURCE-AUTHORITY',
    }];
  });
}

function expectCode(fn, code) {
  let error = null;
  try { fn(); } catch (caught) { error = caught; }
  assert.equal(error?.code, code, `expected ${code}, got ${error?.code}`);
}
function close(actual, expected, label) {
  const tolerance = Math.max(1, Math.abs(expected)) * 1e-12;
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, got ${actual}`);
}
