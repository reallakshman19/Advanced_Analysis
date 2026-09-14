#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  EMP1_WRC537_ATTACHMENT_DIAMETER_BASIS,
  EMP1_WRC537_ATTACHMENT_PHYSICAL_LOCATION,
  createEmp1Wrc537AttachmentSourceAuthority,
} from '../src/core/emp1/emp1-wrc537-attachment-source-authority.js';
import {
  EMP1_WRC537_APPLICABILITY_SOURCE_QUALIFIED,
  EMP1_WRC537_ATTACHMENT_STATION_BASIS,
  EMP1_WRC537_CYLINDER_LENGTH_BASIS,
  createEmp1Wrc537ApplicabilitySourceAuthority,
} from '../src/core/emp1/emp1-wrc537-applicability-source-authority.js';
import {
  EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID,
  emp1CBoundedRoute,
} from '../src/core/emp1/emp1-c-bounded-route-registry.js';
import {
  EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION,
  requireEmp1Wrc537Gamma5ZeroDpRuntimeSourceAuthority,
} from '../src/core/emp1/emp1-wrc537-gamma5-zero-dp-route.js';

const geometry = {
  meanRadius: 100,
  shellThickness: 20,
  attachmentOutsideRadius: 17.714285714285715,
  gamma: 5,
  beta: 0.155,
};
const base = {
  geometryIdentity: 'EMP1-R0-UNIT-CUSTODY',
  outsideDiameter: 35.42857142857143,
  diameterBasis: EMP1_WRC537_ATTACHMENT_DIAMETER_BASIS,
  physicalLocation: EMP1_WRC537_ATTACHMENT_PHYSICAL_LOCATION,
  sourceReference: 'QUALIFICATION/R0-UNIT-CUSTODY',
  productionObservationUsedToSetAuthority: false,
};
const applicabilityAuthority = createEmp1Wrc537ApplicabilitySourceAuthority({
  geometryIdentity: 'EMP1-R0-UNIT-CUSTODY-CYLINDER',
  cylinderLengthBasis: EMP1_WRC537_CYLINDER_LENGTH_BASIS,
  cylinderLength: 300,
  attachmentStationBasis: EMP1_WRC537_ATTACHMENT_STATION_BASIS,
  attachmentStationFromCylinderStart: 80,
  unit: 'mm',
  cylinderLengthSourceReference: 'QUALIFICATION/R0-UNIT-CUSTODY/CYLINDER-LENGTH',
  attachmentStationSourceReference: 'QUALIFICATION/R0-UNIT-CUSTODY/WRC-STATION',
  productionObservationUsedToSetAuthority: false,
});
assert.equal(applicabilityAuthority.sourceQualification,
  EMP1_WRC537_APPLICABILITY_SOURCE_QUALIFIED);

const mmAuthority = createEmp1Wrc537AttachmentSourceAuthority({ ...base, unit: 'mm' });
const accepted = requireEmp1Wrc537Gamma5ZeroDpRuntimeSourceAuthority({
  geometry,
  attachmentSourceAuthority: mmAuthority,
  applicabilitySourceAuthority: applicabilityAuthority,
});
assert.equal(accepted.canonicalLengthUnit, 'mm');
assert.equal(accepted.applicabilitySourceAuthority.semanticHash,
  applicabilityAuthority.semanticHash);

const inchAuthority = createEmp1Wrc537AttachmentSourceAuthority({ ...base, unit: 'in' });
expectCode(() => requireEmp1Wrc537Gamma5ZeroDpRuntimeSourceAuthority({
  geometry,
  attachmentSourceAuthority: inchAuthority,
  applicabilitySourceAuthority: applicabilityAuthority,
}), 'EMP1_WRC537_GAMMA5_ZERO_DP_R0_SOURCE_UNIT_MISMATCH');

const route = emp1CBoundedRoute(EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID);
assert.equal(route.scope.canonicalLengthUnit, 'mm');
assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION.scopeContract.canonicalLengthUnit, 'mm');
assert.equal(route.scope.runtimeAttachmentSourceEvidenceRequired, true);
assert.equal(route.scope.runtimeApplicabilitySourceEvidenceRequired, true);
assert.equal(route.registered, true);
assert.equal(route.engineeringUseAuthorized, true);
assert.equal(route.globalEmp1CRouteAuthority, false);
assert.equal(route.releaseQualified, false);

console.log(JSON.stringify({
  status: 'PASS_WRC_R0_UNIT_COHERENCE_ON_CURRENT_AUTHORIZED_BOUNDED_ROUTE',
  canonicalLengthUnit: 'mm',
  sameUnitAccepted: true,
  mixedUnitRejected: true,
  qualifiedApplicabilityAuthorityRequired: true,
  productionRouteAuthorized: route.registered && route.engineeringUseAuthorized,
  globalEmp1CRouteAuthority: route.globalEmp1CRouteAuthority,
  releaseQualified: route.releaseQualified,
  historicalStandardNumericalQualification: 'NOT_RUN_NOT_CLAIMED',
}, null, 2));

function expectCode(fn, code) {
  let error = null;
  try { fn(); } catch (caught) { error = caught; }
  assert.equal(error?.code, code, `expected ${code}, got ${error?.code}`);
}
