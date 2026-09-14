#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculateLocalAttachmentFoundation } from '../src/core/local-stress/index.js';
import { canonicalFixture } from './lafea.1-fixtures.mjs';
import {
  EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION,
  EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_AUTHORIZED,
  EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_SUSPENSION_REASONS,
  evaluateEmp1Wrc537Gamma5ZeroDpRouteCandidate,
} from '../src/core/emp1/emp1-wrc537-gamma5-zero-dp-route.js';
import {
  EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID,
  emp1CBoundedRoute,
} from '../src/core/emp1/emp1-c-bounded-route-registry.js';
import {
  EMP1_WRC537_CYLINDRICAL_AXIS_AUTHORITY_ID,
  EMP1_WRC537_CYLINDRICAL_AXIS_SOURCE_SHA256,
  deriveEmp1Wrc537CylindricalAxisAuthority,
} from '../src/core/emp1/emp1-wrc537-cylindrical-axis-authority.js';
import {
  EMP1_WRC537_APPLICABILITY_SOURCE_AUTHORITY,
  EMP1_WRC537_APPLICABILITY_SOURCE_QUALIFIED,
  EMP1_WRC537_ATTACHMENT_STATION_BASIS,
  EMP1_WRC537_CYLINDER_LENGTH_BASIS,
  createEmp1Wrc537ApplicabilitySourceAuthority,
} from '../src/core/emp1/emp1-wrc537-applicability-source-authority.js';
import { EMP1_WRC537_TABLE5_EIGHT_POINT_LONGITUDINAL_AUTHORITY_ID } from '../src/core/emp1/emp1-wrc537-longitudinal-moment-curve-selection.js';

const oracleRecord = JSON.parse(await readFile(
  'validation/emp1/wrc537-2013/gamma5-post-authority-physical-oracle-v1.json', 'utf8'));
const oracle = oracleRecord.semanticPayload;
assert.equal(oracleRecord.semanticHash,
  '60771128f8261057bf73fa6c183ace5df25f3ee98f417f58da25a6135d8b2e18');
assert.equal(oracleRecord.productionAuthority, false);
assert.equal(oracleRecord.productionObservationUsed, false);

assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_AUTHORIZED, true);
assert.deepEqual(EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_SUSPENSION_REASONS, []);
assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION.cylindricalLoadAxisSignAuthority,
  'SOURCE_QUALIFIED_RUNTIME_POLARITY_REQUIRED');
assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION.cylindricalLoadAxisAuthorityId,
  EMP1_WRC537_CYLINDRICAL_AXIS_AUTHORITY_ID);
assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION.cylindricalLoadAxisSourceSha256,
  EMP1_WRC537_CYLINDRICAL_AXIS_SOURCE_SHA256);
assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION.cylindricalApplicabilitySourceAuthority,
  EMP1_WRC537_APPLICABILITY_SOURCE_AUTHORITY);
assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION.cylindricalApplicabilitySourceQualification,
  EMP1_WRC537_APPLICABILITY_SOURCE_QUALIFIED);
assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION.longitudinalMomentCurveSelectionAuthorityId,
  EMP1_WRC537_TABLE5_EIGHT_POINT_LONGITUDINAL_AUTHORITY_ID);

const registry = emp1CBoundedRoute(EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID);
assert.ok(registry);
assert.equal(registry.registered, true);
assert.equal(registry.engineeringUseAuthorized, true);
assert.deepEqual(registry.suspensionReasons, []);
assert.equal(registry.method.routeRequalificationRequired, false);
assert.equal(registry.globalEmp1CRouteAuthority, false);
assert.equal(registry.releaseQualified, false);
assert.equal(registry.scope.runtimeSourcePolarityEvidenceRequired, true);
assert.equal(registry.scope.runtimeAttachmentSourceEvidenceRequired, true);
assert.equal(registry.scope.runtimeApplicabilitySourceEvidenceRequired, true);
assert.equal(registry.scope.offAxisLongitudinalMomentMaximumAuthorized, false);
assert.ok(registry.remainingBlocked.includes('OFF_AXIS_LONGITUDINAL_MOMENT_MAXIMUM'));

const model = routeFixture();
const result = calculateLocalAttachmentFoundation(model);
assert.equal(result.qualification.state, 'ACCEPTED');
const axisAuthority = deriveEmp1Wrc537CylindricalAxisAuthority({
  foundationResult: result,
  foundationModel: model,
  loadCaseIdentity: 'LC-1',
});
assert.deepEqual(axisAuthority.frameInput.nozzleCenterlineGlobal, [0, 0, -1]);
const applicabilitySourceAuthority = createEmp1Wrc537ApplicabilitySourceAuthority({
  geometryIdentity: 'ARCH-WRC-01-CURRENT-CYLINDER',
  cylinderLengthBasis: EMP1_WRC537_CYLINDER_LENGTH_BASIS,
  cylinderLength: 300,
  attachmentStationBasis: EMP1_WRC537_ATTACHMENT_STATION_BASIS,
  attachmentStationFromCylinderStart: 80,
  unit: 'mm',
  cylinderLengthSourceReference: 'ARCH-WRC-01/CYLINDER-LENGTH',
  attachmentStationSourceReference: 'ARCH-WRC-01/WRC-STATION',
  productionObservationUsedToSetAuthority: false,
});
const input = {
  loadTransferResult: result,
  loadCaseIdentity: 'LC-1',
  pressureResultIdentity: 'PR-1',
  wrcReferencePointGlobal: [0, 0, 0],
  geometry: { meanRadius: 100, shellThickness: 20, attachmentOutsideRadius: 17.714285714285715,
    gamma: 5, beta: 0.155 },
  axisAuthority,
  applicabilitySourceAuthority,
  stressConcentration: { Kn: 1, Kb: 1 },
};
const comparison = evaluateEmp1Wrc537Gamma5ZeroDpRouteCandidate(input);
assert.equal(comparison.axisAuthority.state, 'QUALIFIED_SOURCE_POLARITY');
assert.equal(comparison.numerics.curveFigureMap.circ.Mlbend, '1B');
assert.equal(comparison.numerics.curveFigureMap.long.Mlbend, '2B');
assert.equal(comparison.numerics.extremaScope.evaluatedLocationCount, 8);
assert.equal(comparison.numerics.extremaScope.continuousJunctureSearchPerformed, false);
assert.equal(comparison.applicability.status, 'PASS_WRC537_4_5_SOURCE_LIMITS_QUALIFIED');
assert.equal(comparison.stressScope.attachmentStressesCalculated, false);
assert.deepEqual(comparison.numerics.wrcLoads, oracle.expectedPhysical.wrcLoads);
assert.deepEqual(comparison.numerics.curveFigureMap, oracle.figureMap);
let stressComparisons = 0;
for (const family of ['circumferential', 'longitudinal', 'shear', 'stressIntensity']) {
  const actual = comparison.stresses[family];
  const expected = oracle.expected[family];
  actual.forEach((value, index) => {
    const tolerance = Math.max(1e-12, Math.max(1, Math.abs(expected[index])) * 1e-11);
    assert.ok(Math.abs(value - expected[index]) <= tolerance,
      `${family}[${index}]:actual=${value}:expected=${expected[index]}:tol=${tolerance}`);
    stressComparisons += 1;
  });
}
assert.equal(stressComparisons, 32);

console.log(JSON.stringify({
  schema: 'emp1-wrc537-gamma5-current-authority-after-axis-closure-check/v1',
  status: 'PASS_CURRENT_BOUNDED_ROUTE_AUTHORITY_AND_FROZEN_ORACLE_REOBSERVATION',
  oracleHash: oracleRecord.semanticHash,
  qualificationHash: registry.method.qualificationRecordSha256,
  stressComparisons,
  wrcLoads: comparison.numerics.wrcLoads,
  productionRouteAuthorized: true,
  registryRegistered: true,
  boundedEngineeringUseAuthorized: true,
  globalEmp1CRouteAuthority: false,
  releaseQualified: false,
  historicalStandardNumericalQualification: 'NOT_RUN_NOT_CLAIMED',
}, null, 2));

function routeFixture() {
  return canonicalFixture((source) => {
    source.loadCases[0].force.value = [-400, 250, 1000];
    source.loadCases[0].moment.value = [-250000, -200000, 700000];
    source.pressureDefinitions.forEach((row) => { row.internalPressure.value = 0; row.externalPressure.value = 0; });
  });
}
