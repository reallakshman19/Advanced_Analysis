import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  buildEmp1Wrc537InterpolatedTable5Ordinates,
} from '../src/core/emp1/emp1-wrc537-cylindrical-gamma-interpolation.js';
import {
  evaluateEmp1Wrc537CylindricalTable5,
} from '../src/core/emp1/emp1-wrc537-cylindrical-table5.js';
import {
  projectEmp1BenchmarkEvidence,
} from '../src/core/emp1/emp1-benchmark-evidence-projection.js';
import {
  createEmp1BenchmarkComparisonCustody,
} from '../src/core/emp1/emp1-benchmark-comparison-custody.js';

const SCRIPT_PATH = 'scripts/emp1-wrc537-caux-comparison-custody-generate.mjs';
const ROUTE_ID = 'EMP1.C.WRC537.CYLINDRICAL.ORIGINAL.INTERPOLATED_GAMMA.ZERO_DP';
const comparisonCase = readJson(
  '../validation/emp1/caux2017-wrc01f/caux-pp24-31-wrc537-comparison-case-v1.json',
);
const TOLERANCE_PERCENT = comparisonCase.comparison.tolerancePercent;
const REFERENCE_ROUNDING_HALF_WIDTH_KPA =
  comparisonCase.comparison.referenceRoundingHalfWidth_kPa;
const repositoryCommit = requiredEnv('EMP1_CAUX_EXECUTION_COMMIT');
const executedAt = requiredEnv('EMP1_CAUX_EXECUTED_AT');
const executor = requiredEnv('EMP1_CAUX_EXECUTOR');

assert.match(repositoryCommit, /^[0-9a-f]{40}$/i, 'execution commit must be a 40-hex Git commit');

const benchmark = readJson('../validation/emp1/caux2017-wrc01f/caux-pp24-31-benchmark-v1.json');
const qualification = readJson(
  '../validation/emp1/caux2017-wrc01f/caux-pp24-31-benchmark-qualification-v1.json',
);
const stressIntensity = benchmark.datums.find(
  (datum) => datum.quantityId === 'P29_SUS_STRESS_INTENSITY',
);
assert.ok(stressIntensity, 'frozen CAUx sustained stress-intensity datum is required');
assert.equal(benchmark.freeze.productionOutputObservedForExpectedValueSelection, false);
assert.equal(benchmark.freeze.toleranceDerivedFromProduction, false);
assert.equal(benchmark.authority.wrcMethodAuthority, false);
assert.equal(benchmark.authority.engineeringUseAuthorized, false);

// This generator reproduces the retained Sep-3 custody record, including its
// historical Q1 source-status snapshot. Numerical comparison semantics are
// pinned separately so helper-default changes cannot alter that reproduction.
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

const ordinateSet = buildEmp1Wrc537InterpolatedTable5Ordinates({
  variant: comparisonCase.wrc537Evaluation.variant,
  gamma,
  beta,
  coordinate: comparisonCase.wrc537Evaluation.interpolationCoordinate,
  betaDomain: comparisonCase.wrc537Evaluation.betaDomain,
  longitudinalMomentFigures: comparisonCase.wrc537Evaluation.longitudinalMomentFigures,
});
assert.equal(ordinateSet.interpolationUsed, true);
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

const locations = benchmark.locations;
const exactEmp1Kpa = result.stresses.stressIntensity.map((value) => value * 1000);
const expectedKpa = stressIntensity.value;
const quantityIds = locations.map((location) => `P29_SUS_STRESS_INTENSITY:${location}`);

locations.forEach((location, index) => {
  const differencePercent = (exactEmp1Kpa[index] - expectedKpa[index]) / expectedKpa[index] * 100;
  assert.ok(
    Math.abs(differencePercent) <= TOLERANCE_PERCENT,
    `${location}: actual comparison is outside the frozen ${TOLERANCE_PERCENT}% tolerance`,
  );
  assert.ok(
    exactEmp1Kpa[index] >= expectedKpa[index] - REFERENCE_ROUNDING_HALF_WIDTH_KPA,
    `${location}: actual comparison is below CAUx beyond source print resolution`,
  );
});

const emp1EnvelopeIndex = result.stresses.stressIntensity.indexOf(
  Math.max(...result.stresses.stressIntensity),
);
const referenceEnvelopeIndex = expectedKpa.indexOf(Math.max(...expectedKpa));
assert.equal(locations[emp1EnvelopeIndex], locations[referenceEnvelopeIndex]);

const routeSnapshot = Object.freeze({
  schema: 'emp1-c-bounded-route-registry/v1:minimal-comparison-snapshot',
  routeId: ROUTE_ID,
  registered: true,
  engineeringUseAuthorized: false,
  comparisonQualificationAvailable: true,
});
const routeSnapshotHash = createHash('sha256')
  .update(JSON.stringify(routeSnapshot))
  .digest('hex');

const evidence = projectEmp1BenchmarkEvidence({
  referenceAvailable: true,
  comparator: { id: 'CAUX', name: 'CAUx', version: '2017' },
  caseId: 'WRC01f-pp24-31-SUS',
  benchmark,
  qualification,
  route: routeSnapshot,
  methodRelationship: {
    comparatorMethod: 'WRC107_MARCH_1979_B1_B2_CONTEXT',
    emp1Method: 'WRC537_2013_TABLE5_INTERPOLATED_GAMMA',
    comparisonOnly: true,
  },
  comparison: {
    toleranceFrozenBeforeEmpObservation: true,
    qualificationAvailable: true,
    governing: {
      referenceLocation: locations[referenceEnvelopeIndex],
      emp1Location: locations[emp1EnvelopeIndex],
    },
    quantities: locations.map((location, index) => ({
      quantityId: quantityIds[index],
      location,
      description: 'Sustained host-shell stress intensity',
      referenceValue: expectedKpa[index],
      referenceUnit: stressIntensity.units,
      emp1Value: exactEmp1Kpa[index],
      emp1Unit: stressIntensity.units,
      tolerance: { kind: 'RELATIVE_PERCENT', value: TOLERANCE_PERCENT, unit: '%' },
      toleranceBasis: 'EXISTING_CAUX_COMPARISON_POLICY_FROZEN_BEFORE_THIS_EXECUTION',
      sourceLocator: `CAUx 2017 - WRC01f.pdf#page=29&point=${location}`,
    })),
  },
  limitations: [
    'INDEPENDENT_REFERENCE_NOT_WRC_METHOD_AUTHORITY',
    'DIRECT_PDF_REOBSERVATION_PENDING',
    'INTERPOLATED_GAMMA_COMPARISON_ONLY_ENGINEERING_USE_NOT_AUTHORIZED',
    'WRC_TABLE5_EIGHT_POINTS_NOT_GLOBAL_ABSOLUTE_MAXIMUM',
  ],
});

const custody = createEmp1BenchmarkComparisonCustody({
  custodyId: 'CAUX_2017_WRC01F_PP24_31_SUS_ACTUAL_EXECUTION_V1',
  evidence,
  execution: {
    kind: 'ACTUAL_EMP_COMPARISON_EXECUTION',
    executed: true,
    provenanceClass: 'DIRECT_EXECUTION_OBSERVATION',
    projectionInputSource: 'ACTUAL_EXECUTION_RESULT',
    repositoryCommit,
    scriptPath: SCRIPT_PATH,
    executedAt,
    executor,
    observedQuantityIds: quantityIds,
    inferredWithoutExecution: false,
    approximateValues: false,
    derivedFromConsoleSummary: false,
    manuallyReconstructed: false,
  },
  routeAuthority: {
    snapshotHash: routeSnapshotHash,
    capturedAt: executedAt,
    snapshot: routeSnapshot,
  },
});

process.stdout.write(`${JSON.stringify(custody, null, 2)}\n`);

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));
}

function requiredEnv(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`EMP1_CAUX_REQUIRED_ENV:${name}`);
  }
  return value;
}
