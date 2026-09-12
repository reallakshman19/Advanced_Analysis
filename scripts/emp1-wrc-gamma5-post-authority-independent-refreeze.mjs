#!/usr/bin/env node
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
const [wrcMarkdown, cauxMarkdown, reviewedInterpretation, longitudinalLedger, frozen, historical] =
  await Promise.all([
    readFile(resolve(root, 'docs/emp1/WRC537_2013_Tables_and_Charts.md'), 'utf8'),
    readFile(resolve(root, 'docs/emp1/CAUx_2017_WRC01f_pages_24-31.md'), 'utf8'),
    readFile(resolve(root, 'validation/emp1/wrc537-2013/table5-reviewed-interpretation-v1.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, 'docs/emp1/WRC537_2013_Longitudinal_Moment_Eight_Point_Authority.md'), 'utf8'),
    readFile(resolve(root, 'validation/emp1/wrc537-2013/gamma5-post-authority-physical-oracle-v1.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, 'validation/emp1/wrc537-2013/gamma5-full-table5-oracle-v1.json'), 'utf8').then(JSON.parse),
  ]);

assert.equal(frozen.schema, 'emp1-wrc537-gamma5-post-authority-physical-oracle/v1');
assert.equal(frozen.productionAuthority, false);
assert.equal(frozen.productionObservationUsed, false);
const F = frozen.semanticPayload;
const frozenPayloadSemanticHash = sha256(canonical(F));
assert.equal(frozenPayloadSemanticHash, frozen.semanticHash,
  'FROZEN_POST_AUTHORITY_ORACLE_PAYLOAD_HASH_DRIFT');

const sourceAuthority = deriveIndependentWrc537Table5Authority({
  wrcMarkdown,
  cauxMarkdown,
  reviewedInterpretation,
});
assert.equal(sourceAuthority.hashes.sourceSemanticHash, F.table5Authority.sourceSemanticHash);
assert.equal(sourceAuthority.hashes.table5InterpretationHash,
  F.table5Authority.table5InterpretationHash);
assert.equal(sourceAuthority.hashes.signAuthorityHash, F.table5Authority.signAuthorityHash);

// Independent source/recovery interpretation: the bounded route is exactly the
// eight Table-5 A/B/C/D shell-juncture points. Section 4.4's -1 curves are the
// separate off-axis maximum, so current eight-point Ml bending is 1B / 2B.
assert.match(longitudinalLedger, /Au, Al, Bu, Bl, Cu, Cl, Du, Dl/u);
assert.match(longitudinalLedger, /circumferential stress family:\s*Figure 1B/u);
assert.match(longitudinalLedger, /longitudinal stress family:\s*Figure 2B/u);
assert.match(longitudinalLedger, /1B-1\s*\/\s*2B-1/u);
assert.match(longitudinalLedger, /continuous\/intermediate-point search/u);
assert.deepEqual(sourceAuthority.locations, F.expected.locations);

for (const [shortFamily, sourceFamily] of [['circ', 'circumferential'], ['long', 'longitudinal']]) {
  for (const [key, selectedFigure] of Object.entries(F.figureMap[shortFamily])) {
    const authority = sourceAuthority.figureAuthority[sourceFamily][key];
    assert(authority.allowedFigures.includes(selectedFigure),
      `WRC_SOURCE_SELECTED_FIGURE_NOT_ALLOWED:${shortFamily}.${key}:${selectedFigure}`);
    if (key !== 'Mlbend') {
      assert.equal(selectedFigure, sourceAuthority.historicalFigureMap[sourceFamily][key],
        `UNINTENDED_POST_AUTHORITY_FIGURE_CHANGE:${shortFamily}.${key}`);
    }
  }
}
assert.equal(F.figureMap.circ.Mlbend, '1B');
assert.equal(F.figureMap.long.Mlbend, '2B');
assert.equal(sourceAuthority.historicalFigureMap.circumferential.Mlbend, '1B-1');
assert.equal(sourceAuthority.historicalFigureMap.longitudinal.Mlbend, '2B-1');

const statics = deriveIndependentWrc537PhysicalStatics(F.physicalBenchmark);
assertIndependentWrcRoundtrip(statics);
assert.deepEqual(statics.basisGlobal, F.expectedPhysical.basisGlobal);
assert.deepEqual(statics.transferMomentGlobal, F.expectedPhysical.transferMomentGlobal);
assert.deepEqual(statics.momentAtTargetGlobal, F.expectedPhysical.momentAtTargetGlobal);
assert.deepEqual(statics.wrcLoads, F.expectedPhysical.wrcLoads);

const geometry = F.case.geometry;
assert.equal(geometry.meanRadius / geometry.shellThickness, F.case.gamma);
assert.ok(close(0.875 * geometry.attachmentRadius / geometry.meanRadius, F.case.beta));
const applicability = F.case.applicability;
assert.ok(applicability.cylinderLength >= geometry.meanRadius,
  'WRC_4_5_1_PHYSICAL_BENCHMARK_OUTSIDE_SOURCE_LIMIT');
assert.equal(applicability.nearestCylinderEndDistance,
  Math.min(applicability.attachmentStationFromCylinderStart,
    applicability.cylinderLength - applicability.attachmentStationFromCylinderStart));
assert.ok(applicability.nearestCylinderEndDistance >= 0.5 * geometry.meanRadius,
  'WRC_4_5_2_PHYSICAL_BENCHMARK_OUTSIDE_SOURCE_LIMIT');

const figures = [...new Set([
  ...Object.values(F.figureMap.circ), ...Object.values(F.figureMap.long),
])];
const rows = {};
const ordinatesByFigure = {};
for (const figure of figures) {
  const row = parseIndependentWrc537OriginalCurve(wrcMarkdown, figure, F.case.gamma);
  rows[figure] = row;
  assert.equal(row.pdfPage, F.figurePages[figure], `WRC_SOURCE_PAGE_DRIFT:${figure}`);
  ordinatesByFigure[figure] = evaluateIndependentWrc537Curve(row, F.case.beta).y;
}
const curveOrdinates = {
  circ: Object.fromEntries(Object.entries(F.figureMap.circ)
    .map(([key, figure]) => [key, ordinatesByFigure[figure]])),
  long: Object.fromEntries(Object.entries(F.figureMap.long)
    .map(([key, figure]) => [key, ordinatesByFigure[figure]])),
};
assertNumericTreeClose(curveOrdinates, F.curveOrdinates, 'CURVE_ORDINATES');

const independent = evaluateIndependentWrc537Table5({
  geometry,
  stressConcentration: F.case.stressConcentration,
  loads: statics.wrcLoads,
  curveOrdinates,
  signs: sourceAuthority.signs,
  locations: sourceAuthority.locations,
});
assertNumericTreeClose(independent.scale, F.scale, 'SCALE');
assertNumericTreeClose(independent.stresses.circumferential,
  F.expected.circumferential, 'CIRCUMFERENTIAL');
assertNumericTreeClose(independent.stresses.longitudinal,
  F.expected.longitudinal, 'LONGITUDINAL');
assertNumericTreeClose(independent.stresses.shear, F.expected.shear, 'SHEAR');
assertNumericTreeClose(independent.stresses.stressIntensity,
  F.expected.stressIntensity, 'STRESS_INTENSITY');

// The old historical vector is a deliberate falsifier, not an alternate
// acceptable oracle for the current route. Only A/B change because Ml bending
// contributes at A/B in Table 5; C/D remain exactly unchanged for this case.
assert.equal(historical.semanticPayload.figureMap.circ.Mlbend, '1B-1');
assert.equal(historical.semanticPayload.figureMap.long.Mlbend, '2B-1');
for (let index = 0; index < 4; index += 1) {
  assert.ok(!close(F.expected.stressIntensity[index],
    historical.semanticPayload.expected.stressIntensity[index]),
  `HISTORICAL_ORACLE_UNEXPECTEDLY_EQUAL_AT_AB:${index}`);
}
for (let index = 4; index < 8; index += 1) {
  assert.ok(close(F.expected.stressIntensity[index],
    historical.semanticPayload.expected.stressIntensity[index]),
  `POST_AUTHORITY_CD_DRIFT:${index}`);
}

// Runtime reproduction is an observation, not an oracle authoring path.
// Exact identity belongs to the already-frozen semantic payload above. Runtime
// floating-point values are independently compared to that payload using the
// pre-existing close() contract; their environment-specific exact hash is
// retained only as diagnostic information and is never allowed to refreeze F.
const recomposedPayload = {
  sourceDocumentSha256: F.sourceDocumentSha256,
  sourceExtraction: F.sourceExtraction,
  table5Authority: F.table5Authority,
  physicalBenchmark: F.physicalBenchmark,
  expectedPhysical: {
    basisGlobal: statics.basisGlobal,
    transferMomentGlobal: statics.transferMomentGlobal,
    momentAtTargetGlobal: statics.momentAtTargetGlobal,
    wrcLoads: statics.wrcLoads,
  },
  case: F.case,
  figureMap: F.figureMap,
  figurePages: F.figurePages,
  curveOrdinates,
  scale: independent.scale,
  expected: {
    locations: independent.locations,
    circumferential: independent.stresses.circumferential,
    longitudinal: independent.stresses.longitudinal,
    shear: independent.stresses.shear,
    stressIntensity: independent.stresses.stressIntensity,
  },
};
assertNumericTreeClose(recomposedPayload, F, 'POST_AUTHORITY_ORACLE_RUNTIME_REOBSERVATION');
const runtimeReobservationSemanticHash = sha256(canonical(recomposedPayload));

console.log(JSON.stringify({
  schema: 'emp1-wrc537-gamma5-post-authority-independent-refreeze/v1',
  status: 'PASS_FROZEN_POST_AUTHORITY_PHYSICAL_TABLE5_ORACLE',
  productionImports: [],
  productionObservationUsed: false,
  productionAuthority: false,
  semanticHash: frozen.semanticHash,
  runtimeReobservationSemanticHash,
  runtimeReobservationExactHashMatchesFrozen:
    runtimeReobservationSemanticHash === frozen.semanticHash,
  runtimeReobservationMayAuthorFrozenOracle: false,
  physical: {
    basisGlobal: statics.basisGlobal,
    transferMomentGlobal: statics.transferMomentGlobal,
    momentAtTargetGlobal: statics.momentAtTargetGlobal,
    wrcLoads: statics.wrcLoads,
    roundtrip: 'PASS',
  },
  longitudinalMomentBending: {
    currentEightPointFigures: ['1B', '2B'],
    historicalOffAxisFigures: ['1B-1', '2B-1'],
    ordinate1B: curveOrdinates.circ.Mlbend,
    ordinate2B: curveOrdinates.long.Mlbend,
  },
  stressIntensity: independent.stresses.stressIntensity,
  historicalVectorRejectedForCurrentAuthorization: true,
  unchangedCDStressIntensities: 4,
}, null, 2));

function assertNumericTreeClose(actual, expected, label) {
  if (typeof expected === 'number') {
    assert(Number.isFinite(actual) && close(actual, expected),
      `${label}: actual=${actual} expected=${expected}`);
    return;
  }
  if (Array.isArray(expected)) {
    assert(Array.isArray(actual), `${label}: array required`);
    assert.equal(actual.length, expected.length, `${label}: array length`);
    expected.forEach((item, index) => assertNumericTreeClose(actual[index], item, `${label}[${index}]`));
    return;
  }
  if (expected && typeof expected === 'object') {
    assert(actual && typeof actual === 'object' && !Array.isArray(actual), `${label}: object required`);
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${label}: keys`);
    for (const key of Object.keys(expected)) assertNumericTreeClose(actual[key], expected[key], `${label}.${key}`);
    return;
  }
  assert.deepEqual(actual, expected, label);
}
function close(a, b) {
  return Number.isFinite(a) && Number.isFinite(b)
    && Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 1e-12;
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function sha256(text) { return createHash('sha256').update(text).digest('hex'); }
