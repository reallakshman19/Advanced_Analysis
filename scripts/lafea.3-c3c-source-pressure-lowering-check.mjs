#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  LAFEA_SOURCE_PRESSURE_QUADRATURE,
  integrateLafeaSourcePressure,
} from '../src/workspace/lafea-source-pressure-lowering.js';

const PRESSURE = 4;
const THICKNESS = 10;

const lineGeometry = {
  type: 'LINE',
  start: { x: 10, y: 20 },
  end: { x: 110, y: 20 },
  loopBindings: [{ loopId: 'OUTER', role: 'OUTER' }],
};

for (const family of ['T6', 'Q8']) {
  const result = integrateLafeaSourcePressure({
    pressure: PRESSURE,
    thickness: THICKNESS,
    edgeNodes: [
      node(`${family}-A`, 10, 20),
      node(`${family}-M`, 60, 20),
      node(`${family}-B`, 110, 20),
    ],
    sourceFeatureGeometry: lineGeometry,
  });
  assert.equal(result.quadratureId, LAFEA_SOURCE_PRESSURE_QUADRATURE);
  assert.equal(result.sourceBoundaryAuthority, 'ANALYSIS_GEOMETRY_ORIENTED_SEGMENT_V1');
  assert.equal(result.loopRole, 'OUTER');
  assertClose(result.sourceMeasure, 100, 1e-12, `${family} straight source measure`);
  const expectedFy = [2000 / 3, 8000 / 3, 2000 / 3];
  result.nodalForces.forEach((force, index) => {
    assertClose(force.fx, 0, 1e-12, `${family} straight nodal fx ${index}`);
    assertClose(force.fy, expectedFy[index], 1e-10, `${family} straight nodal fy ${index}`);
  });
  assertResultant(result.resultant, { forceX: 0, forceY: 4000, momentZ: 240000 }, family);
}

const center = { x: 10, y: -20 };
const radius = 50;
const outerArc = arcGeometry({
  startAngle: 0,
  endAngle: Math.PI / 2,
  sweep: 'CCW',
  role: 'OUTER',
  loopId: 'OUTER',
});
const outerNodes = arcEdgeNodes('OUTER', 0, Math.PI / 2);
const outer = integrateLafeaSourcePressure({
  pressure: PRESSURE,
  thickness: THICKNESS,
  edgeNodes: outerNodes,
  sourceFeatureGeometry: outerArc,
});
const outerOracle = sourcePressureOracle(outerArc, PRESSURE, THICKNESS);
assert.equal(outer.geometryType, 'CIRCULAR_ARC');
assert.equal(outer.loopRole, 'OUTER');
assertResultant(outer.resultant, outerOracle, 'outer circular arc');

const holeArc = arcGeometry({
  startAngle: Math.PI / 2,
  endAngle: 0,
  sweep: 'CW',
  role: 'HOLE',
  loopId: 'HOLE-1',
});
const holeNodes = arcEdgeNodes('HOLE', Math.PI / 2, 0);
const hole = integrateLafeaSourcePressure({
  pressure: PRESSURE,
  thickness: THICKNESS,
  edgeNodes: holeNodes,
  sourceFeatureGeometry: holeArc,
});
const holeOracle = sourcePressureOracle(holeArc, PRESSURE, THICKNESS);
assert.equal(hole.loopRole, 'HOLE');
assertResultant(hole.resultant, holeOracle, 'hole circular arc');
assertClose(hole.resultant.forceX, -outer.resultant.forceX, 1e-9, 'hole forceX opposes outer');
assertClose(hole.resultant.forceY, -outer.resultant.forceY, 1e-9, 'hole forceY opposes outer');
assertClose(hole.resultant.momentZ, -outer.resultant.momentZ, 1e-7, 'hole moment opposes outer');

const splitA = integrateLafeaSourcePressure({
  pressure: PRESSURE,
  thickness: THICKNESS,
  edgeNodes: arcEdgeNodes('SPLIT-A', 0, Math.PI / 4),
  sourceFeatureGeometry: outerArc,
});
const splitB = integrateLafeaSourcePressure({
  pressure: PRESSURE,
  thickness: THICKNESS,
  edgeNodes: arcEdgeNodes('SPLIT-B', Math.PI / 4, Math.PI / 2),
  sourceFeatureGeometry: outerArc,
});
assertResultant(sumResultants(splitA.resultant, splitB.resultant), outerOracle, 'split/refined circular arc');

expectCode(() => integrateLafeaSourcePressure({
  pressure: PRESSURE,
  thickness: THICKNESS,
  edgeNodes: outerNodes,
  sourceFeatureGeometry: { ...outerArc, loopBindings: [] },
}), 'LAFEA_SOURCE_PRESSURE_LOOP_BINDING_INVALID');

expectCode(() => integrateLafeaSourcePressure({
  pressure: PRESSURE,
  thickness: THICKNESS,
  edgeNodes: [...outerNodes].reverse(),
  sourceFeatureGeometry: outerArc,
}), 'LAFEA_SOURCE_PRESSURE_EDGE_ORIENTATION_INVALID');

const badMid = structuredClone(outerNodes);
badMid[1].x += 1;
expectCode(() => integrateLafeaSourcePressure({
  pressure: PRESSURE,
  thickness: THICKNESS,
  edgeNodes: badMid,
  sourceFeatureGeometry: outerArc,
}), 'LAFEA_SOURCE_PRESSURE_EDGE_POINT_OUTSIDE_SOURCE_SEGMENT');

console.log(JSON.stringify({
  schema: 'lafea3-c3c-source-pressure-lowering-check/v1',
  status: 'PASS',
  stageId: 'LAFEA.3',
  qualifiedIncrement: 'G004_SOURCE_NORMAL_PRESSURE_LOWERING_PRIMITIVE',
  t6StraightQuadraticEdge: true,
  q8StraightQuadraticEdge: true,
  circularArcSourceNormal: true,
  outerOrientation: true,
  holeOrientationOppositeOuter: true,
  exactSourceForceAndMomentOracle: true,
  splitEdgeRefinementInvariant: true,
  missingLoopBindingFailsClosed: true,
  reversedSourceTraversalFailsClosed: true,
  offSourceGeometryFailsClosed: true,
  ordinaryCompilerWiringQualified: false,
  pressureResultantReceiptQualified: false,
  releaseAuthorityGranted: false,
}));

function sourcePressureOracle(geometry, pressure, thickness) {
  const a = geometry.start;
  const b = geometry.end;
  return {
    forceX: -pressure * thickness * (b.y - a.y),
    forceY: pressure * thickness * (b.x - a.x),
    momentZ: 0.5 * pressure * thickness
      * ((b.x * b.x + b.y * b.y) - (a.x * a.x + a.y * a.y)),
  };
}

function arcGeometry({ startAngle, endAngle, sweep, role, loopId }) {
  return {
    type: 'CIRCULAR_ARC',
    centerX: center.x,
    centerY: center.y,
    radius,
    sweep,
    start: pointAt(startAngle),
    end: pointAt(endAngle),
    loopBindings: [{ loopId, role }],
  };
}

function arcEdgeNodes(prefix, startAngle, endAngle) {
  const midAngle = (startAngle + endAngle) / 2;
  const angles = [startAngle, midAngle, endAngle];
  return angles.map((angle, index) => {
    const point = pointAt(angle);
    return node(`${prefix}-${index + 1}`, point.x, point.y);
  });
}

function pointAt(angle) {
  return {
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
  };
}

function sumResultants(...rows) {
  return rows.reduce((sum, row) => ({
    forceX: sum.forceX + row.forceX,
    forceY: sum.forceY + row.forceY,
    momentZ: sum.momentZ + row.momentZ,
  }), { forceX: 0, forceY: 0, momentZ: 0 });
}

function assertResultant(actual, expected, label) {
  assertClose(actual.forceX, expected.forceX, 1e-8, `${label} forceX`);
  assertClose(actual.forceY, expected.forceY, 1e-8, `${label} forceY`);
  assertClose(actual.momentZ, expected.momentZ, 1e-6, `${label} momentZ`);
}

function assertClose(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}, tolerance ${tolerance}`);
}

function node(nodeId, x, y) { return { nodeId, x, y }; }
function expectCode(action, code) {
  assert.throws(action, (error) => error?.code === code, `expected ${code}`);
}
