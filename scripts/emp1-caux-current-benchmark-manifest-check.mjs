#!/usr/bin/env node
/**
 * H2 current benchmark manifest + CAUx comparison execution-contract guard.
 *
 * Historical CAUx records remain immutable. This check proves that current source
 * qualification resolves through Q3, while the retained Sep-3 comparison remains
 * reproducible from an explicit WRC537 comparison contract that does not inherit
 * mutable helper defaults.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildEmp1Wrc537InterpolatedTable5Ordinates,
} from '../src/core/emp1/emp1-wrc537-cylindrical-gamma-interpolation.js';
import {
  evaluateEmp1Wrc537CylindricalTable5,
} from '../src/core/emp1/emp1-wrc537-cylindrical-table5.js';
import {
  emp1CBoundedRoute,
} from '../src/core/emp1/emp1-c-bounded-route-registry.js';
import {
  EMP1_PVELITE_BENCHMARK_PROGRAMME,
} from '../src/core/emp1/emp1-pvelite-benchmark-programme.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const manifest = await readJson('validation/emp1/release/emp1-current-benchmark-manifest-v1.json');
const comparisonCase = await readJson(
  'validation/emp1/caux2017-wrc01f/caux-pp24-31-wrc537-comparison-case-v1.json',
);
const benchmark = await readJson(manifest.caux.benchmark.path);
const q1 = await readJson(manifest.caux.historicalQualifications[0].path);
const q3 = await readJson(manifest.caux.currentQualification.path);
const directObservation = await readJson(manifest.caux.directPdfObservation.path);
const gammaRadius = await readJson(manifest.caux.gammaRadiusReconciliation.path);
const custody = await readJson(manifest.caux.retainedComparisonCustody.path);
const gamma5Oracle = await readJson(manifest.gamma5.physicalOracle.path);
const gamma5Qualification = await readJson(manifest.gamma5.qualification.path);
const checkerSource = await readText('scripts/emp1-wrc537-caux-interpolated-comparison-check.mjs');
const generatorSource = await readText('scripts/emp1-wrc537-caux-comparison-custody-generate.mjs');

assert.equal(manifest.schema, 'emp1-current-benchmark-manifest/v1');
assert.equal(manifest.issue, 1772);
assert.equal(manifest.historicalPolicy.historicalRecordsAreImmutable, true);
assert.equal(manifest.historicalPolicy.supersessionChangesCurrentStatusOnly, true);

assert.equal(benchmark.semanticHash, manifest.caux.benchmark.semanticHash);
assert.equal(q1.semanticHash, manifest.caux.historicalQualifications[0].semanticHash);
assert.equal(q1.source.directPdfPageReobservation, 'NOT_RUN_EXECUTION_ENVIRONMENT');
assert.equal(manifest.caux.historicalQualifications[0].classification,
  'HISTORICAL_SUPERSEDED_STATUS_RECORD');

assert.equal(q3.semanticHash, manifest.caux.currentQualification.semanticHash);
assert.equal(q3.qualificationId, manifest.caux.currentQualification.qualificationId);
assert.equal(q3.status, manifest.caux.currentQualification.status);
assert.equal(q3.source.directPdfPageReobservation, 'PASS');
assert.equal(q3.source.gammaRadiusBasisForThisBenchmark, 'PASS_RECONCILED');
assert.equal(q3.directPdfObservation.semanticHash, directObservation.semanticHash);
assert.equal(q3.gammaRadiusReconciliation.semanticHash, gammaRadius.semanticHash);
assert.equal(directObservation.status, 'PASS');
assert.equal(gammaRadius.status,
  'PASS_CAUX_INTERNAL_CORROSION_SAME_STATE_MID_RADIUS_RECONCILIATION');
assert.equal(gammaRadius.mayEstablishGlobalCorrosionGeometryPolicy, false);

assert.equal(custody.state, manifest.caux.retainedComparisonCustody.state);
assert.equal(custody.comparison.state,
  manifest.caux.retainedComparisonCustody.comparisonState);
assert.equal(custody.comparison.summary.comparedQuantities, 8);
assert.equal(custody.comparison.summary.withinToleranceCount, 8);
assert.equal(custody.comparison.summary.worstRelativeDifferencePercent,
  manifest.caux.retainedComparisonCustody.worstRelativeDifferencePercent);
assert.equal(custody.comparison.summary.governingReferenceLocation, 'Du');
assert.equal(custody.comparison.summary.governingEmp1Location, 'Du');
assert.equal(custody.routeRelationship.engineeringUseAuthorized, false);
assert.equal(custody.routeRelationship.comparisonQualificationAvailable, true);

assert.equal(gamma5Oracle.semanticHash, manifest.gamma5.physicalOracle.semanticHash);
assert.equal(gamma5Qualification.qualificationRecordSha256,
  manifest.gamma5.qualification.qualificationRecordSha256);

assert.equal(EMP1_PVELITE_BENCHMARK_PROGRAMME.reference.state,
  manifest.pvElite.state);
assert.equal(EMP1_PVELITE_BENCHMARK_PROGRAMME.reference.sourceCustodyState,
  manifest.pvElite.sourceCustodyState);
assert.equal(EMP1_PVELITE_BENCHMARK_PROGRAMME.tolerancePolicy.value, null);
assert.equal(manifest.pvElite.numericalComparisonRun, false);

for (const value of Object.values(manifest.authority)) assert.equal(value, false);

// The CAUx WRC107 source-reproduction curve identity and WRC537 eight-point
// comparison curve identity are intentionally different method semantics.
assert.deepEqual(comparisonCase.source.sourceLongitudinalMomentBendingFigures, {
  circumferential: '1B1',
  longitudinal: '2B1',
  normalizedInterpretation: {
    circumferential: '1B-1',
    longitudinal: '2B-1',
  },
});
assert.deepEqual(comparisonCase.wrc537Evaluation.longitudinalMomentFigures, {
  circumferential: '1B',
  longitudinal: '2B',
});
assert.equal(comparisonCase.wrc537Evaluation.interpolationCoordinate, 'LINEAR_GAMMA');
assert.equal(comparisonCase.wrc537Evaluation.engineeringUseAuthorized, false);
assert.equal(comparisonCase.wrc537Evaluation.comparisonQualificationAvailable, true);

const { geometry, derived, loads, wrc537Evaluation, comparison } = comparisonCase;
const attachmentRadius = geometry.attachmentOutsideDiameter_mm / 2;
const gamma = geometry.meanRadius_mm / geometry.shellThickness_mm;
const beta = 0.875 * attachmentRadius / geometry.meanRadius_mm;
approx(gamma, derived.gamma, 1e-14, 'comparison gamma');
approx(beta, derived.beta, 1e-14, 'comparison beta');
approx(attachmentRadius, geometry.attachmentRadius_mm, 1e-14, 'attachment radius');

const explicit = buildEmp1Wrc537InterpolatedTable5Ordinates({
  variant: wrc537Evaluation.variant,
  gamma,
  beta,
  coordinate: wrc537Evaluation.interpolationCoordinate,
  betaDomain: wrc537Evaluation.betaDomain,
  longitudinalMomentFigures: wrc537Evaluation.longitudinalMomentFigures,
});
assert.equal(explicit.coordinate, 'LINEAR_GAMMA');
assert.equal(explicit.provenance.circ.Mlbend.figure, '1B');
assert.equal(explicit.provenance.long.Mlbend.figure, '2B');

const explicitResult = evaluateEmp1Wrc537CylindricalTable5({
  geometry: {
    meanRadius: geometry.meanRadius_mm,
    shellThickness: geometry.shellThickness_mm,
    attachmentRadius,
    beta,
  },
  stressConcentration: wrc537Evaluation.stressConcentration,
  loads: {
    P: loads.P, Vc: loads.Vc, Vl: loads.Vl,
    Mc: loads.Mc, Ml: loads.Ml, Mt: loads.Mt,
  },
  curveOrdinates: explicit.ordinates,
});
const retained = custody.comparison.quantities.map((row) => row.emp1Value);
assert.equal(retained.length, comparison.locations.length);
explicitResult.stresses.stressIntensity.forEach((value, index) => {
  approx(value * 1000, retained[index], 1e-9,
    `retained CAUx comparison ${comparison.locations[index]}`);
});

// Falsifier: the historical WRC107-style -1 figure map is not silently
// interchangeable with the WRC537 eight-point figure map.
const alternateFigures = buildEmp1Wrc537InterpolatedTable5Ordinates({
  variant: wrc537Evaluation.variant,
  gamma,
  beta,
  coordinate: wrc537Evaluation.interpolationCoordinate,
  betaDomain: wrc537Evaluation.betaDomain,
  longitudinalMomentFigures: {
    circumferential: '1B-1',
    longitudinal: '2B-1',
  },
});
const alternateResult = evaluateEmp1Wrc537CylindricalTable5({
  geometry: {
    meanRadius: geometry.meanRadius_mm,
    shellThickness: geometry.shellThickness_mm,
    attachmentRadius,
    beta,
  },
  stressConcentration: wrc537Evaluation.stressConcentration,
  loads: {
    P: loads.P, Vc: loads.Vc, Vl: loads.Vl,
    Mc: loads.Mc, Ml: loads.Ml, Mt: loads.Mt,
  },
  curveOrdinates: alternateFigures.ordinates,
});
const figureMapDeltaKpa = explicitResult.stresses.stressIntensity
  .map((value, index) => Math.abs(value - alternateResult.stresses.stressIntensity[index]) * 1000);
assert.ok(Math.max(...figureMapDeltaKpa) > 0.4,
  'figure-map falsifier must distinguish 1B/2B from 1B-1/2B-1 for this case');

// Falsifier: interpolation coordinate is part of the comparison identity too.
const logCoordinate = buildEmp1Wrc537InterpolatedTable5Ordinates({
  variant: wrc537Evaluation.variant,
  gamma,
  beta,
  coordinate: 'LOG_GAMMA',
  betaDomain: wrc537Evaluation.betaDomain,
  longitudinalMomentFigures: wrc537Evaluation.longitudinalMomentFigures,
});
assert.notEqual(logCoordinate.ordinates.circ.Pmem_AB, explicit.ordinates.circ.Pmem_AB);

// Source-level anti-drift: both executable paths must pass the frozen case
// semantics explicitly rather than inheriting helper defaults.
for (const [name, source] of [
  ['comparison-check', checkerSource],
  ['custody-generator', generatorSource],
]) {
  assert.match(source,
    /coordinate:\s*comparisonCase\.wrc537Evaluation\.interpolationCoordinate/u,
    `${name} must pin interpolation coordinate`);
  assert.match(source,
    /longitudinalMomentFigures:\s*comparisonCase\.wrc537Evaluation\.longitudinalMomentFigures/u,
    `${name} must pin longitudinal-moment figure map`);
}

const route = emp1CBoundedRoute(custody.routeRelationship.routeId);
assert.ok(route);
assert.equal(route.engineeringUseAuthorized, false);
assert.equal(route.comparisonQualificationAvailable, true);

console.log(JSON.stringify({
  schema: 'emp1-caux-current-benchmark-manifest-check/v1',
  status: 'PASS_CURRENT_CAUX_Q3_AND_EXPLICIT_WRC537_COMPARISON_CONTRACT',
  currentQualificationId: q3.qualificationId,
  directPdfPageReobservation: q3.source.directPdfPageReobservation,
  gammaRadiusBasis: q3.source.gammaRadiusBasisForThisBenchmark,
  retainedComparisonPoints: retained.length,
  retainedComparisonMaxReplayError_kPa: Math.max(
    ...explicitResult.stresses.stressIntensity
      .map((value, index) => Math.abs(value * 1000 - retained[index])),
  ),
  figureMapFalsifierMaxDelta_kPa: Math.max(...figureMapDeltaKpa),
  comparisonRouteEngineeringUseAuthorized: route.engineeringUseAuthorized,
  pvEliteReferenceState: manifest.pvElite.state,
}, null, 2));

async function readJson(path) {
  return JSON.parse(await readText(path));
}
async function readText(path) {
  return readFile(resolve(root, path), 'utf8');
}
function approx(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} != ${expected}`);
}
