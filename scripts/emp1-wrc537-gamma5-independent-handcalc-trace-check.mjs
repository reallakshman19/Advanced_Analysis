#!/usr/bin/env node
/**
 * #1772 H1 independent gamma5 hand-calculation trace qualification.
 *
 * This checker reconstructs the frozen trace from validation-only source
 * readers/oracles. It deliberately imports no production EMP.1 evaluator,
 * load mapper, stress-intensity helper, expected result array or route module.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  deriveIndependentWrc537Table5Authority,
} from './oracles/emp1-wrc537/source-authority.mjs';
import {
  evaluateIndependentWrc537Table5,
} from './oracles/emp1-wrc537/table5-handcalc.mjs';
import {
  deriveIndependentWrc537PhysicalStatics,
  assertIndependentWrcRoundtrip,
} from './oracles/emp1-wrc537/physical-statics.mjs';
import {
  parseIndependentWrc537OriginalCurve,
  evaluateIndependentWrc537Curve,
} from './oracles/emp1-wrc537/curve-fit-source.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TRACE_PATH =
  'validation/emp1/wrc537-2013/gamma5-independent-handcalc-trace-v1.json';
const ORACLE_PATH =
  'validation/emp1/wrc537-2013/gamma5-post-authority-physical-oracle-v1.json';
const PROFILE_PATH =
  'validation/emp1/wrc537-2013/bounded-source-semantics-v1.json';
const REVIEWED_PATH =
  'validation/emp1/wrc537-2013/table5-reviewed-interpretation-v1.json';
const WRC_TEXT_PATH = 'docs/emp1/WRC537_2013_Tables_and_Charts.md';
const CAUX_TEXT_PATH = 'docs/emp1/CAUx_2017_WRC01f_pages_24-31.md';
const EXPECTED_PROFILE_HASH =
  '64a65852cd96216525b227d1d74fe5423278638627b3b3f94c0389285f2e84d0';
const EXPECTED_ORACLE_HASH =
  '60771128f8261057bf73fa6c183ace5df25f3ee98f417f58da25a6135d8b2e18';
const LOCATIONS = Object.freeze(['Au','Al','Bu','Bl','Cu','Cl','Du','Dl']);

const [
  traceBytes,
  oracle,
  profile,
  reviewed,
  wrcText,
  cauxText,
] = await Promise.all([
  readBuffer(TRACE_PATH),
  readJson(ORACLE_PATH),
  readJson(PROFILE_PATH),
  readJson(REVIEWED_PATH),
  readText(WRC_TEXT_PATH),
  readText(CAUX_TEXT_PATH),
]);
const trace = JSON.parse(traceBytes.toString('utf8'));
const F = oracle.semanticPayload;

assert.equal(trace.schema, 'emp1-wrc537-gamma5-independent-handcalc-trace/v1');
assert.equal(trace.issue, 1772);
assert.equal(trace.parentIssue, 1760);
assert.equal(trace.status, 'FROZEN_INDEPENDENT_H1_TRACE');
assert.deepEqual(trace.authority, {
  engineeringValidationEvidence: true,
  productionAuthority: false,
  productionObservationUsed: false,
  productionImports: [],
  codeComplianceAuthority: false,
  releaseAuthority: false,
});
assert.equal(trace.source.currentPhysicalOracleSemanticHash, EXPECTED_ORACLE_HASH);
assert.equal(oracle.semanticHash, EXPECTED_ORACLE_HASH);
assert.equal(trace.source.wrc02SourceSemanticsProfileSemanticHash, EXPECTED_PROFILE_HASH);
assert.equal(profile.semanticHash, EXPECTED_PROFILE_HASH);
assert.equal(profile.authorityModel.methodSourceSemanticsReady, true);
assert.equal(profile.authorityModel.caseApplicabilityRequiresEvidence, true);

assert.equal(
  trace.casePrerequisiteEvidence.classification,
  'SYNTHETIC_QUALIFICATION_FIXTURE_ONLY_NOT_REAL_ASSET_EVIDENCE',
);
assert.deepEqual(
  Object.keys(trace.casePrerequisiteEvidence).filter((key) => key !== 'classification'),
  [
    'SAME_STATE_ASSESSMENT_GEOMETRY',
    'STANDARD_ROUND_ATTACHMENT_CLASS',
    'PHYSICAL_ATTACHMENT_AXIS_COINCIDENCE',
    'ISOLATION_OR_NONINTERACTION_EVIDENCE',
    'ORIGINAL_CYLINDRICAL_THEORY_APPLICABILITY_EVIDENCE',
  ],
);
for (const [key, value] of Object.entries(trace.casePrerequisiteEvidence)) {
  if (key === 'classification') continue;
  assert.match(value, /^PASS_/u, `qualification fixture prerequisite: ${key}`);
}

// Independence firewall: neither this checker nor any numerical dependency in
// its reconstruction path may import production EMP.1/core calculation code.
const independentFiles = [
  'scripts/emp1-wrc537-gamma5-independent-handcalc-trace-check.mjs',
  'scripts/oracles/emp1-wrc537/source-authority.mjs',
  'scripts/oracles/emp1-wrc537/table5-handcalc.mjs',
  'scripts/oracles/emp1-wrc537/physical-statics.mjs',
  'scripts/oracles/emp1-wrc537/curve-fit-source.mjs',
];
for (const path of independentFiles) {
  const source = await readText(path);
  assert.doesNotMatch(source, /src\/core\/emp1\//u,
    `H1 independence firewall: ${path}`);
  assert.doesNotMatch(source, /src\/core\/local-stress/u,
    `H1 load/statics independence firewall: ${path}`);
}

// Source-derived signs/locations remain independent of production.
const sourceAuthority = deriveIndependentWrc537Table5Authority({
  wrcMarkdown: wrcText,
  cauxMarkdown: cauxText,
  reviewedInterpretation: reviewed,
});
assert.deepEqual(sourceAuthority.locations, LOCATIONS);
assert.deepEqual(sourceAuthority.signs, reviewed.reviewedSigns);
assert.deepEqual(sourceAuthority.productionImports, []);
assert.equal(sourceAuthority.productionObservationUsedToSetAuthority, false);

// Reconstruct physical statics from global source geometry/loads.
const statics = deriveIndependentWrc537PhysicalStatics(F.physicalBenchmark);
assertIndependentWrcRoundtrip(statics);
assert.deepEqual(statics.basisGlobal, F.expectedPhysical.basisGlobal);
assert.deepEqual(statics.transferMomentGlobal, F.expectedPhysical.transferMomentGlobal);
assert.deepEqual(statics.momentAtTargetGlobal, F.expectedPhysical.momentAtTargetGlobal);
assert.deepEqual(statics.wrcLoads, F.expectedPhysical.wrcLoads);

// H1 qualification case must satisfy the WRC-02 case prerequisites by fixture
// construction; this is not reusable real-asset applicability evidence.
const geometry = F.case.geometry;
assert.equal(geometry.meanRadius / geometry.shellThickness, F.case.gamma);
assert.ok(close(0.875 * geometry.attachmentRadius / geometry.meanRadius, F.case.beta));
assert.ok(F.case.applicability.cylinderLength >= geometry.meanRadius);
assert.equal(
  F.case.applicability.nearestCylinderEndDistance,
  Math.min(
    F.case.applicability.attachmentStationFromCylinderStart,
    F.case.applicability.cylinderLength
      - F.case.applicability.attachmentStationFromCylinderStart,
  ),
);
assert.ok(F.case.applicability.nearestCylinderEndDistance >= 0.5 * geometry.meanRadius);

// Reconstruct every current eight-point source curve directly from retained WRC
// coefficient text. This intentionally consumes 1B/2B, not historical -1 maps.
assert.equal(F.figureMap.circ.Mlbend, '1B');
assert.equal(F.figureMap.long.Mlbend, '2B');
const figures = [...new Set([
  ...Object.values(F.figureMap.circ),
  ...Object.values(F.figureMap.long),
])];
assert.equal(figures.length, 14);
const curveEvaluation = {};
const ordinatesByFigure = {};
for (const figure of figures) {
  const row = parseIndependentWrc537OriginalCurve(wrcText, figure, F.case.gamma);
  const evaluated = evaluateIndependentWrc537Curve(row, F.case.beta);
  curveEvaluation[figure] = {
    figure,
    pdfPage: row.pdfPage,
    gamma: row.gamma,
    sourceLayout: row.sourceLayout,
    coefficients: row.coefficients,
    numerator: evaluated.numerator,
    denominator: evaluated.denominator,
    ordinate: evaluated.y,
  };
  ordinatesByFigure[figure] = evaluated.y;
  assert.equal(row.pdfPage, F.figurePages[figure], `figure page: ${figure}`);
}
const curveOrdinates = {
  circ: Object.fromEntries(
    Object.entries(F.figureMap.circ).map(([key, figure]) => [key, ordinatesByFigure[figure]]),
  ),
  long: Object.fromEntries(
    Object.entries(F.figureMap.long).map(([key, figure]) => [key, ordinatesByFigure[figure]]),
  ),
};
assertNumericTreeClose(curveOrdinates, F.curveOrdinates, 'CURVE_ORDINATES');

// Independent Table-5 kernel returns full signed load-family component arrays,
// same-point totals and S at all eight locations.
const independent = evaluateIndependentWrc537Table5({
  geometry,
  stressConcentration: F.case.stressConcentration,
  loads: statics.wrcLoads,
  curveOrdinates,
  signs: sourceAuthority.signs,
  locations: sourceAuthority.locations,
});
assertNumericTreeClose(independent.scale, F.scale, 'SCALE');
for (const family of ['circumferential','longitudinal','shear','stressIntensity']) {
  assertNumericTreeClose(independent.stresses[family], F.expected[family],
    `ORACLE_${family}`);
}

// Frozen trace must be a complete rendering of the independent reconstruction.
validateTraceAgainstIndependent(trace, {
  statics,
  curveEvaluation,
  independent,
  expected: F.expected,
});

const governingIndex = independent.stresses.stressIntensity.reduce(
  (best, value, index, rows) => value > rows[best] ? index : best,
  0,
);
assert.equal(LOCATIONS[governingIndex], 'Au');
assert.equal(trace.governingEvaluatedPoint.location, 'Au');
assert.ok(close(
  trace.governingEvaluatedPoint.stressIntensity,
  independent.stresses.stressIntensity[governingIndex],
));
assert.equal(trace.governingEvaluatedPoint.evaluatedLocationCount, 8);
assert.equal(trace.governingEvaluatedPoint.continuousSearchPerformed, false);
assert.equal(trace.governingEvaluatedPoint.globalMaximumClaim, false);

// Human-auditable trace shape: 189 ordered rows and the full required H1
// categories. Exact count is a completeness guard, not a numerical oracle.
assert.equal(trace.traceRows.length, 189);
const categoryCounts = Object.fromEntries(
  [...new Set(trace.traceRows.map((row) => row.category))]
    .map((category) => [
      category,
      trace.traceRows.filter((row) => row.category === category).length,
    ]),
);
assert.deepEqual(categoryCounts, {
  UNIT_NORMALIZATION: 1,
  REFERENCE_TRANSLATION: 1,
  WRC_LOAD_MAPPING: 6,
  GEOMETRY: 2,
  APPLICABILITY: 2,
  CURVE_EVALUATION: 14,
  STRESS_SCALE: 9,
  SIGNED_STRESS_COMPONENT: 120,
  SAME_POINT_SUPERPOSITION: 24,
  STRESS_INTENSITY: 8,
  GOVERNING_EVALUATED_POINT: 1,
  SCOPE: 1,
});
const rowKeys = [
  'stepId',
  'category',
  'sourceLocator',
  'formulaOrFigureId',
  'inputs',
  'intermediate',
  'output',
  'physicalLocationSurface',
  'classification',
].sort();
trace.traceRows.forEach((row, index) => {
  assert.equal(row.stepId, `H1-${String(index + 1).padStart(3, '0')}`);
  assert.deepEqual(Object.keys(row).sort(), rowKeys);
  assert.ok(['SOURCE_REPORTED','DIRECT_SOURCE_CALCULATION','INDEPENDENT_DERIVED']
    .includes(row.classification));
});

// Trace mutation falsifiers: recomputing an outer artifact identity cannot hide
// a changed load, ordinate, component, final S, scope or independence boundary.
for (const [name, mutate] of [
  ['load', (candidate) => { candidate.independentStatics.wrcLoads.P += 1; }],
  ['curve', (candidate) => { candidate.curveEvaluation['1B'].ordinate *= 1.001; }],
  ['component', (candidate) => {
    candidate.components.circumferential.Mlbend[0] *= -1;
  }],
  ['stress-intensity', (candidate) => { candidate.totals.stressIntensity[0] += 1; }],
  ['governing', (candidate) => { candidate.governingEvaluatedPoint.location = 'Du'; }],
  ['global-maximum', (candidate) => {
    candidate.governingEvaluatedPoint.globalMaximumClaim = true;
  }],
  ['production-import', (candidate) => {
    candidate.authority.productionImports.push('src/core/emp1/fake.js');
  }],
  ['trace-row-loss', (candidate) => { candidate.traceRows.pop(); }],
]) {
  const candidate = structuredClone(trace);
  mutate(candidate);
  let rejected = false;
  try {
    validateTraceAgainstIndependent(candidate, {
      statics,
      curveEvaluation,
      independent,
      expected: F.expected,
    });
    assert.equal(candidate.traceRows.length, 189);
    assert.deepEqual(candidate.authority.productionImports, []);
    assert.equal(candidate.governingEvaluatedPoint.globalMaximumClaim, false);
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true, `H1 trace falsifier must reject: ${name}`);
}

console.log(JSON.stringify({
  schema: 'emp1-wrc537-gamma5-independent-handcalc-trace-check/v1',
  status: 'PASS_INDEPENDENT_H1_TRACE_RECONSTRUCTED',
  tracePath: TRACE_PATH,
  traceGitBlobSha1: gitBlobSha(traceBytes),
  traceRows: trace.traceRows.length,
  physicalWrcLoads: statics.wrcLoads,
  comparedStressValues: 32,
  currentLongitudinalMomentFigures: ['1B','2B'],
  governingEvaluatedPoint: trace.governingEvaluatedPoint,
  productionImports: [],
  productionObservationUsed: false,
  continuousOrGlobalMaximumClaim: false,
  falsifiersPassed: 8,
}, null, 2));

function validateTraceAgainstIndependent(candidate, reference) {
  assert.equal(candidate.schema, 'emp1-wrc537-gamma5-independent-handcalc-trace/v1');
  assert.deepEqual(candidate.authority.productionImports, []);
  assert.equal(candidate.authority.productionObservationUsed, false);
  assert.equal(candidate.authority.productionAuthority, false);
  assert.deepEqual(candidate.independentStatics.basisGlobal, reference.statics.basisGlobal);
  assert.deepEqual(
    candidate.independentStatics.transferMomentGlobal,
    reference.statics.transferMomentGlobal,
  );
  assert.deepEqual(
    candidate.independentStatics.momentAtTargetGlobal,
    reference.statics.momentAtTargetGlobal,
  );
  assert.deepEqual(candidate.independentStatics.wrcLoads, reference.statics.wrcLoads);
  assertNumericTreeClose(candidate.curveEvaluation, reference.curveEvaluation, 'TRACE_CURVES');
  assertNumericTreeClose(candidate.stressScale, reference.independent.scale, 'TRACE_SCALE');
  assertNumericTreeClose(candidate.components, reference.independent.components, 'TRACE_COMPONENTS');
  for (const family of ['circumferential','longitudinal','shear','stressIntensity']) {
    assertNumericTreeClose(
      candidate.totals[family],
      reference.independent.stresses[family],
      `TRACE_TOTAL_${family}`,
    );
    assertNumericTreeClose(
      candidate.totals[family],
      reference.expected[family],
      `TRACE_EXPECTED_${family}`,
    );
  }
  assert.equal(candidate.governingEvaluatedPoint.evaluatedLocationCount, 8);
  assert.equal(candidate.governingEvaluatedPoint.continuousSearchPerformed, false);
  assert.equal(candidate.governingEvaluatedPoint.globalMaximumClaim, false);
}

function assertNumericTreeClose(actual, expected, label) {
  if (typeof expected === 'number') {
    assert.ok(Number.isFinite(actual) && close(actual, expected),
      `${label}: actual=${actual} expected=${expected}`);
    return;
  }
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${label}: array required`);
    assert.equal(actual.length, expected.length, `${label}: array length`);
    expected.forEach((value, index) =>
      assertNumericTreeClose(actual[index], value, `${label}[${index}]`));
    return;
  }
  if (expected && typeof expected === 'object') {
    assert.ok(actual && typeof actual === 'object' && !Array.isArray(actual),
      `${label}: object required`);
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(),
      `${label}: keys`);
    for (const key of Object.keys(expected)) {
      assertNumericTreeClose(actual[key], expected[key], `${label}.${key}`);
    }
    return;
  }
  assert.deepEqual(actual, expected, label);
}

function close(a, b) {
  return Number.isFinite(a) && Number.isFinite(b)
    && Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 1e-12;
}
async function readBuffer(path) { return readFile(resolve(root, path)); }
async function readText(path) { return readFile(resolve(root, path), 'utf8'); }
async function readJson(path) { return JSON.parse(await readText(path)); }
function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.byteLength}\0`, 'utf8');
  return createHash('sha1').update(header).update(buffer).digest('hex');
}
