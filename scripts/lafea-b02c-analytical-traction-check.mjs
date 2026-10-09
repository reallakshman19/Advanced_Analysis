#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  evaluateLafeaAnalyticalTraction,
  integrateLafeaAnalyticalEdgeTraction,
} from '../src/workspace/lafea-analytical-traction-lowering.js';

const payload = {
  law: 'KIRSCH_INFINITE_PLATE_OUTER_BOUNDARY_V1',
  centerX: 0,
  centerY: 0,
  holeRadius: 10,
  remoteStressSigmaX: 50,
  unit: 'MPa',
};

const atX = evaluateLafeaAnalyticalTraction(payload, 100, 0);
close(atX.tx, 48.7575, 1e-12, 'theta=0 tx');
close(atX.ty, 0, 1e-12, 'theta=0 ty');
const atY = evaluateLafeaAnalyticalTraction(payload, 0, 100);
close(atY.tx, 0, 1e-12, 'theta=90 tx');
close(atY.ty, 0.7425, 1e-12, 'theta=90 ty');

const radius = 100;
const edgeNodes = [
  { nodeId: 'A', x: radius, y: 0 },
  { nodeId: 'M', x: radius / Math.sqrt(2), y: radius / Math.sqrt(2) },
  { nodeId: 'B', x: 0, y: radius },
];
const integrated = integrateLafeaAnalyticalEdgeTraction({
  payload,
  edgeNodes,
  thickness: 5,
  stressFactor: 1,
});
const independent = independentCompositeGauss(edgeNodes, payload, 5, 256);
close(integrated.resultant.forceX, independent.forceX, 2e-10, 'quarter-edge forceX');
close(integrated.resultant.forceY, independent.forceY, 2e-10, 'quarter-edge forceY');
close(integrated.resultant.momentZ, independent.momentZ, 2e-10, 'quarter-edge momentZ');
assert.equal(integrated.quadratureId, 'GAUSS_LEGENDRE_12_EDGE_V1');
assert.equal(integrated.nodalForces.length, 3);
assert.equal(integrated.quadraturePoints.length, 12);
close(
  integrated.quadraturePoints.reduce((sum, point) => sum + point.weight, 0),
  2,
  1e-14,
  'Gauss weight sum',
);
for (let index = 0; index < integrated.quadraturePoints.length / 2; index += 1) {
  const left = integrated.quadraturePoints[index];
  const right = integrated.quadraturePoints.at(-(index + 1));
  close(left.s, -right.s, 1e-14, `Gauss point symmetry ${index}`);
  close(left.weight, right.weight, 1e-14, `Gauss weight symmetry ${index}`);
}
assert.equal(integrated.releaseAuthorityGranted, false);
assert.throws(
  () => integrateLafeaAnalyticalEdgeTraction({
    payload: { ...payload, law: 'UNQUALIFIED' }, edgeNodes, thickness: 5,
  }),
  (error) => error?.code === 'LAFEA_ANALYTICAL_TRACTION_LAW_INVALID',
);

console.log(JSON.stringify({
  schema: 'lafea-b02c-analytical-traction-check/v1',
  status: 'PASS',
  lawId: integrated.lawId,
  quadratureId: integrated.quadratureId,
  thetaZeroClosedFormChecked: true,
  thetaNinetyClosedFormChecked: true,
  independentCompositeIntegrationChecked: true,
  gaussRuleSymmetryChecked: true,
  resultant: integrated.resultant,
  unqualifiedLawRejected: true,
  releaseAuthorityGranted: false,
}));

function independentCompositeGauss(nodes, law, thickness, panels) {
  // Independent high-resolution composite 4-point Gauss integration over the
  // same quadratic physical edge; production uses one higher-order Gauss rule.
  const points = [
    [-0.8611363115940526, 0.3478548451374538],
    [-0.3399810435848563, 0.6521451548625461],
    [0.3399810435848563, 0.6521451548625461],
    [0.8611363115940526, 0.3478548451374538],
  ];
  let forceX = 0; let forceY = 0; let momentZ = 0;
  for (let panel = 0; panel < panels; panel += 1) {
    const a = -1 + 2 * panel / panels;
    const b = -1 + 2 * (panel + 1) / panels;
    const half = (b - a) / 2;
    const mid = (a + b) / 2;
    for (const [gp, weight] of points) {
      const s = mid + half * gp;
      const shape = qEdge(s);
      const x = sum(nodes, shape.N, 'x');
      const y = sum(nodes, shape.N, 'y');
      const dx = sum(nodes, shape.dNds, 'x');
      const dy = sum(nodes, shape.dNds, 'y');
      const jacobian = Math.hypot(dx, dy);
      const traction = independentKirsch(law, x, y);
      const scale = thickness * jacobian * weight * half;
      forceX += traction.tx * scale;
      forceY += traction.ty * scale;
      momentZ += (x * traction.ty - y * traction.tx) * scale;
    }
  }
  return { forceX, forceY, momentZ };
}
function independentKirsch(p, x, y) {
  const dx = x - p.centerX;
  const dy = y - p.centerY;
  const r2 = dx * dx + dy * dy;
  const theta = Math.atan2(dy, dx);
  const ratio2 = p.holeRadius ** 2 / r2;
  const ratio4 = ratio2 ** 2;
  const sigmaRR = p.remoteStressSigmaX / 2 * (
    (1 - ratio2) + (1 - 4 * ratio2 + 3 * ratio4) * Math.cos(2 * theta)
  );
  const tau = -p.remoteStressSigmaX / 2 * (
    1 + 2 * ratio2 - 3 * ratio4
  ) * Math.sin(2 * theta);
  return {
    tx: sigmaRR * Math.cos(theta) - tau * Math.sin(theta),
    ty: sigmaRR * Math.sin(theta) + tau * Math.cos(theta),
  };
}
function qEdge(s) {
  return {
    N: [0.5 * s * (s - 1), 1 - s * s, 0.5 * s * (s + 1)],
    dNds: [s - 0.5, -2 * s, s + 0.5],
  };
}
function sum(nodes, weights, key) {
  return nodes.reduce((total, node, index) => total + weights[index] * node[key], 0);
}
function close(actual, expected, relative, label) {
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected));
  assert.ok(Math.abs(actual - expected) <= relative * scale,
    `${label}: ${actual} != ${expected}`);
}
