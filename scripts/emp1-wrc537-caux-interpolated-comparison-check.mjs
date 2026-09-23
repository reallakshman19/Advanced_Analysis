/**
 * Independent external comparison for gamma interpolation.
 *
 * The retained CAUx 2017 WRC01f pp.24-31 case sits at gamma = 48.03, which is not a
 * source-tabulated row, so it was unreachable until interpolation existed. It is an
 * INDEPENDENT_BENCHMARK_REFERENCE_NOT_WRC_METHOD_AUTHORITY: it cannot define or
 * correct WRC equations, and passing it grants no production or code authority.
 *
 * Expected values are frozen in validation/emp1/caux2017-wrc01f/caux-pp24-31-benchmark-v1.json
 * with productionOutputObservedForExpectedValueSelection = false. Per that record, a
 * mismatch must be diagnosed, never repaired by editing the expected values or widening
 * the tolerance here.
 *
 * CAUx reports WRC107 March 1979 (B1 & B2) curves; this evaluator uses the WRC 537 2013
 * curve set. A small edition difference is therefore expected and is why the tolerance
 * is 3% rather than machine precision.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildEmp1Wrc537InterpolatedTable5Ordinates }
  from '../src/core/emp1/emp1-wrc537-cylindrical-gamma-interpolation.js';
import { evaluateEmp1Wrc537CylindricalTable5 }
  from '../src/core/emp1/emp1-wrc537-cylindrical-table5.js';

const comparisonCase = JSON.parse(readFileSync(
  new URL('../validation/emp1/caux2017-wrc01f/caux-pp24-31-wrc537-comparison-case-v1.json', import.meta.url),
));
const benchmark = JSON.parse(readFileSync(
  new URL('../validation/emp1/caux2017-wrc01f/caux-pp24-31-benchmark-v1.json', import.meta.url),
));
const qualification = JSON.parse(readFileSync(
  new URL('../validation/emp1/caux2017-wrc01f/caux-pp24-31-benchmark-qualification-v3.json', import.meta.url),
));
const TOLERANCE_PERCENT = comparisonCase.comparison.tolerancePercent;
// CAUx prints stress intensity as whole kPa, so conservatism is assertable only to +-0.5 kPa.
const REFERENCE_ROUNDING_HALF_WIDTH_KPA =
  comparisonCase.comparison.referenceRoundingHalfWidth_kPa;
const datum = (quantityId) => {
  const row = benchmark.datums.find((entry) => entry.quantityId === quantityId);
  if (!row) throw new Error(`CAUX_BENCHMARK_DATUM_MISSING:${quantityId}`);
  return row.value;
};

// The benchmark is a reference, not authority — assert that framing survives.
assert.equal(benchmark.source.authorityRole, 'INDEPENDENT_BENCHMARK_REFERENCE_NOT_WRC_METHOD_AUTHORITY');
assert.equal(benchmark.freeze.productionOutputObservedForExpectedValueSelection, false);
assert.equal(benchmark.authority.wrcMethodAuthority, false);
assert.equal(benchmark.authority.productionUseAuthorized, false);
assert.equal(benchmark.semanticHash, comparisonCase.source.benchmarkSemanticHash);
assert.equal(qualification.semanticHash, comparisonCase.source.currentQualificationSemanticHash);
assert.equal(qualification.source.directPdfPageReobservation, 'PASS');
assert.equal(qualification.source.gammaRadiusBasisForThisBenchmark, 'PASS_RECONCILED');
assert.equal(comparisonCase.authority.wrcMethodAuthority, false);
assert.equal(comparisonCase.authority.engineeringUseAuthorized, false);

const LOCATIONS = benchmark.locations;
const expectedIntensity = datum('P29_SUS_STRESS_INTENSITY');

// Retained CAUx geometry and sustained local loads (mm, N, N.mm).
// Comparison semantics are frozen in a dedicated case contract so this benchmark
// cannot drift when production helper defaults change.
const meanRadius = comparisonCase.geometry.meanRadius_mm;
const shellThickness = comparisonCase.geometry.shellThickness_mm;
const attachmentRadius = comparisonCase.geometry.attachmentOutsideDiameter_mm / 2;
const beta = 0.875 * attachmentRadius / meanRadius;
const gamma = meanRadius / shellThickness;
const loads = {
  P: comparisonCase.loads.P,
  Vc: comparisonCase.loads.Vc,
  Vl: comparisonCase.loads.Vl,
  Mc: comparisonCase.loads.Mc,
  Ml: comparisonCase.loads.Ml,
  Mt: comparisonCase.loads.Mt,
};
assert.ok(Math.abs(beta - comparisonCase.derived.beta) <= 1e-14);
assert.ok(Math.abs(gamma - comparisonCase.derived.gamma) <= 1e-14);

// The case must genuinely exercise interpolation, not land on a tabulated row.
const ordinateSet = buildEmp1Wrc537InterpolatedTable5Ordinates({
  variant: comparisonCase.wrc537Evaluation.variant,
  gamma,
  beta,
  coordinate: comparisonCase.wrc537Evaluation.interpolationCoordinate,
  betaDomain: comparisonCase.wrc537Evaluation.betaDomain,
  longitudinalMomentFigures: comparisonCase.wrc537Evaluation.longitudinalMomentFigures,
});
assert.equal(ordinateSet.interpolationUsed, true, 'CAUx gamma=48.03 must be an interpolated case');
assert.equal(ordinateSet.sourceQualifiedGammaSelection, false);
assert.equal(ordinateSet.wrcMethodFidelityClaim, false);
assert.equal(ordinateSet.productionAuthority, false);
assert.equal(ordinateSet.coordinate, comparisonCase.wrc537Evaluation.interpolationCoordinate);
assert.equal(
  ordinateSet.provenance.circ.Mlbend.figure,
  comparisonCase.wrc537Evaluation.longitudinalMomentFigures.circumferential,
);
assert.equal(
  ordinateSet.provenance.long.Mlbend.figure,
  comparisonCase.wrc537Evaluation.longitudinalMomentFigures.longitudinal,
);

const result = evaluateEmp1Wrc537CylindricalTable5({
  geometry: { meanRadius, shellThickness, attachmentRadius, beta },
  stressConcentration: comparisonCase.wrc537Evaluation.stressConcentration,
  loads,
  curveOrdinates: ordinateSet.ordinates,
});

const kPa = (value) => value * 1000;
let worst = 0;
console.log('  pt    CAUx kPa    ours kPa      diff');
LOCATIONS.forEach((location, index) => {
  const ours = kPa(result.stresses.stressIntensity[index]);
  const expected = expectedIntensity[index];
  const differencePercent = (ours - expected) / expected * 100;
  worst = Math.max(worst, Math.abs(differencePercent));
  console.log(`  ${location}  ${String(expected).padStart(9)}  ${ours.toFixed(0).padStart(9)}  ${differencePercent.toFixed(1).padStart(8)}%`);
  assert.ok(
    Math.abs(differencePercent) <= TOLERANCE_PERCENT,
    `${location}: ${ours.toFixed(0)} kPa vs CAUx ${expected} kPa = ${differencePercent.toFixed(1)}%, `
    + `outside ${TOLERANCE_PERCENT}%. Diagnose the discrepancy; do not widen this tolerance.`,
  );
  // Interpolated screening must not come in under an independent reference. The
  // reference is printed as whole kPa, so conservatism is only assertable to that
  // resolution: allow half of the last printed digit.
  assert.ok(
    ours >= expected - REFERENCE_ROUNDING_HALF_WIDTH_KPA,
    `${location}: interpolated ${ours.toFixed(1)} kPa is below the CAUx reference `
    + `${expected} kPa by more than its ${REFERENCE_ROUNDING_HALF_WIDTH_KPA} kPa print resolution`,
  );
});

// Governing location must agree, not just the magnitudes.
const oursIndex = result.stresses.stressIntensity.indexOf(Math.max(...result.stresses.stressIntensity));
const cauxIndex = expectedIntensity.indexOf(Math.max(...expectedIntensity));
assert.equal(LOCATIONS[oursIndex], LOCATIONS[cauxIndex], 'governing location must match the reference');

console.log(`  governing ${LOCATIONS[cauxIndex]} both; worst point difference ${worst.toFixed(1)}%`);
console.log('EMP1_WRC537_CAUX_INTERPOLATED_COMPARISON_CHECK_PASS');
