import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EMP1_BENCHMARK_COMPARISON_STATE,
  EMP1_BENCHMARK_EVIDENCE_SCHEMA,
  projectEmp1BenchmarkEvidence,
} from '../src/core/emp1/emp1-benchmark-evidence-projection.js';
import {
  EMP1_C_BOUNDED_PRODUCTION_ROUTES,
  EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID,
  EMP1_C_WRC537_INTERPOLATED_GAMMA_ROUTE_ID,
} from '../src/core/emp1/emp1-c-bounded-route-registry.js';

const benchmark = JSON.parse(readFileSync(new URL(
  '../validation/emp1/caux2017-wrc01f/caux-pp24-31-benchmark-v1.json',
  import.meta.url,
)));
const qualification = JSON.parse(readFileSync(new URL(
  '../validation/emp1/caux2017-wrc01f/caux-pp24-31-benchmark-qualification-v3.json',
  import.meta.url,
)));
const interpolatedRoute = EMP1_C_BOUNDED_PRODUCTION_ROUTES.find(
  (route) => route.routeId === EMP1_C_WRC537_INTERPOLATED_GAMMA_ROUTE_ID,
);
const gamma5Route = EMP1_C_BOUNDED_PRODUCTION_ROUTES.find(
  (route) => route.routeId === EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID,
);

assert.ok(interpolatedRoute);
assert.ok(gamma5Route);

const stressIntensity = benchmark.datums.find(
  (datum) => datum.quantityId === 'P29_SUS_STRESS_INTENSITY',
);
assert.ok(stressIntensity);

const buildInput = () => ({
  referenceAvailable: true,
  comparator: { id: 'CAUX', name: 'CAUx', version: '2017' },
  caseId: 'WRC01f-pp24-31-SUS',
  benchmark,
  qualification,
  route: interpolatedRoute,
  methodRelationship: {
    comparatorMethod: 'WRC107_MARCH_1979_B1_B2_CONTEXT',
    emp1Method: 'WRC537_2013_TABLE5_INTERPOLATED_GAMMA',
    comparisonOnly: true,
  },
  comparison: {
    toleranceFrozenBeforeEmpObservation: true,
    qualificationAvailable: true,
    governing: { referenceLocation: 'Du', emp1Location: 'Du' },
    quantities: benchmark.locations.map((location, index) => ({
      quantityId: `P29_SUS_STRESS_INTENSITY:${location}`,
      location,
      description: 'Sustained host-shell stress intensity',
      referenceValue: stressIntensity.value[index],
      referenceUnit: stressIntensity.units,
      // Synthetic projection-only values. The separate CAUx comparison checker owns
      // the real EMP.1 numerical reproduction and its 3% comparison assertion.
      emp1Value: stressIntensity.value[index] * 1.01,
      emp1Unit: stressIntensity.units,
      tolerance: { kind: 'RELATIVE_PERCENT', value: 3, unit: '%' },
      toleranceBasis: 'EXISTING_CAUX_COMPARISON_POLICY_NOT_SELECTED_BY_PROJECTION',
      sourceLocator: `CAUx 2017 - WRC01f.pdf#page=29&point=${location}`,
    })),
  },
  limitations: [
    'INDEPENDENT_REFERENCE_NOT_WRC_METHOD_AUTHORITY',
    'INTERPOLATED_GAMMA_COMPARISON_ONLY_ENGINEERING_USE_NOT_AUTHORIZED',
  ],
});

const projected = projectEmp1BenchmarkEvidence(buildInput());
assert.equal(projected.schema, EMP1_BENCHMARK_EVIDENCE_SCHEMA);
assert.equal(projected.benchmarkId, 'CAUX_2017_WRC01F_PP24_31_REFERENCE_V1');
assert.equal(projected.sourceEvidence.semanticHash,
  '887b231028cd187c63d7cb29aedbc7db182b31d404623f9981f36a21987c2bf3');
assert.equal(projected.sourceEvidence.directObservationState, 'PASS');
assert.equal(
  projected.sourceEvidence.qualificationState,
  'PASS_FINAL_CAUX_SOURCE_QUALIFICATION_GAMMA_RADIUS_RECONCILED_REFERENCE_FREEZE_PRESERVED',
);
assert.equal(projected.freezeEvidence.state, 'REFERENCE_FROZEN');
assert.equal(projected.routeRelationship.engineeringUseAuthorized, false);
assert.equal(projected.routeRelationship.comparisonQualificationAvailable, true);
assert.equal(projected.routeRelationship.state, 'OUTSIDE_AUTHORIZED_ENGINEERING_ROUTE');
assert.equal(projected.comparison.state, EMP1_BENCHMARK_COMPARISON_STATE.COMPARISON_QUALIFIED);
assert.equal(projected.comparison.quantities.length, 8);
assert.equal(projected.comparison.summary.withinToleranceCount, 8);
assert.ok(Math.abs(projected.comparison.summary.worstRelativeDifferencePercent - 1) < 1e-12);
assert.equal(projected.comparison.summary.governingLocationAgreement, true);
assert.equal(projected.authority.wrcMethodAuthority, false);
assert.equal(projected.authority.engineeringUseAuthorized, false);
assert.equal(projected.authority.codeComplianceAuthorized, false);
assert.equal(projected.authorityBoundary.createsEngineeringUseAuthority, false);
assert.ok(Object.isFrozen(projected));
assert.ok(Object.isFrozen(projected.comparison.quantities[0]));

const circular = buildInput();
circular.benchmark = structuredClone(benchmark);
circular.benchmark.freeze.productionOutputUsedToChooseDefinition = true;
assert.throws(
  () => projectEmp1BenchmarkEvidence(circular),
  { code: 'EMP1_BENCHMARK_FREEZE_NOT_ANTI_CIRCULAR' },
);

const authorityLeak = buildInput();
authorityLeak.qualification = structuredClone(qualification);
authorityLeak.qualification.authority.codeComplianceAuthorized = true;
assert.throws(
  () => projectEmp1BenchmarkEvidence(authorityLeak),
  { code: 'EMP1_BENCHMARK_QUALIFICATION_AUTHORITY_MUST_BE_FALSE:codeComplianceAuthorized' },
);

const unitMismatch = buildInput();
unitMismatch.comparison.quantities[0].emp1Unit = 'MPa';
assert.throws(
  () => projectEmp1BenchmarkEvidence(unitMismatch),
  { code: 'EMP1_BENCHMARK_UNIT_MISMATCH' },
);

const toleranceNotFrozen = buildInput();
toleranceNotFrozen.comparison.toleranceFrozenBeforeEmpObservation = false;
assert.throws(
  () => projectEmp1BenchmarkEvidence(toleranceNotFrozen),
  { code: 'EMP1_BENCHMARK_TOLERANCE_FREEZE_REQUIRED' },
);

const falseQualification = buildInput();
falseQualification.comparison.quantities[0].emp1Value *= 1.1;
assert.throws(
  () => projectEmp1BenchmarkEvidence(falseQualification),
  { code: 'EMP1_BENCHMARK_QUALIFICATION_CLAIM_OUTSIDE_TOLERANCE' },
);

const pvElitePending = projectEmp1BenchmarkEvidence({
  referenceAvailable: false,
  benchmarkId: 'PVELITE_WRC107537_REFERENCE_PENDING',
  comparator: { id: 'PV_ELITE', name: 'PV Elite', version: null },
  caseId: 'GAMMA5_ZERO_DP_PRIMARY_COMPARATOR',
  authorityRole: 'INDEPENDENT_COMMERCIAL_SOFTWARE_COMPARISON_NOT_WRC_METHOD_AUTHORITY',
  route: gamma5Route,
  comparison: { quantities: [] },
  methodRelationship: 'REFERENCE_NOT_RETAINED',
  limitations: ['EXACT_PV_ELITE_REPORT_INPUT_AND_VERSION_REQUIRED_BEFORE_COMPARISON'],
});
assert.equal(
  pvElitePending.comparison.state,
  EMP1_BENCHMARK_COMPARISON_STATE.REFERENCE_NOT_AVAILABLE,
);
assert.equal(pvElitePending.comparison.quantities.length, 0);
assert.equal(pvElitePending.authority.releaseAuthorityGranted, false);

console.log('EMP1_BENCHMARK_EVIDENCE_PROJECTION_CHECK_PASS');
