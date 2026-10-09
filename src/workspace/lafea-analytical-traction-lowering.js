/**
 * Pure consistent-load integration for serializable analytical boundary-traction laws.
 * This is a lowering primitive only; it grants no benchmark or release authority.
 */
export const LAFEA_ANALYTICAL_TRACTION_LAWS = Object.freeze([
  'KIRSCH_INFINITE_PLATE_OUTER_BOUNDARY_V1',
]);
export const LAFEA_ANALYTICAL_TRACTION_QUADRATURE = 'GAUSS_LEGENDRE_12_EDGE_V1';

const GAUSS_12 = Object.freeze([
  [-0.9815606342467192, 0.04717533638651141],
  [-0.9041172563704748, 0.10693932599531907],
  [-0.7699026741943047, 0.16007832854334642],
  [-0.5873179542866175, 0.20316742672306573],
  [-0.3678314989981802, 0.2334925365383546],
  [-0.1252334085114689, 0.24914704581340269],
  [0.1252334085114689, 0.24914704581340269],
  [0.3678314989981802, 0.2334925365383546],
  [0.5873179542866175, 0.20316742672306573],
  [0.7699026741943047, 0.16007832854334642],
  [0.9041172563704748, 0.10693932599531907],
  [0.9815606342467192, 0.04717533638651141],
].map(([point, weight]) => Object.freeze({ point, weight })));

export function integrateLafeaAnalyticalEdgeTraction({ payload, edgeNodes, thickness, stressFactor = 1 }) {
  const law = requireLaw(payload);
  if (!Array.isArray(edgeNodes) || ![2, 3].includes(edgeNodes.length)
    || edgeNodes.some((node) => !Number.isFinite(node?.x) || !Number.isFinite(node?.y))) {
    fail('LAFEA_ANALYTICAL_TRACTION_EDGE_NODES_INVALID');
  }
  if (!(Number.isFinite(thickness) && thickness > 0)) fail('LAFEA_ANALYTICAL_TRACTION_THICKNESS_INVALID');
  if (!(Number.isFinite(stressFactor) && stressFactor > 0)) fail('LAFEA_ANALYTICAL_TRACTION_STRESS_FACTOR_INVALID');
  const nodal = edgeNodes.map((node) => ({ nodeId: node.nodeId, fx: 0, fy: 0 }));
  const points = [];
  for (const gp of GAUSS_12) {
    const shape = edgeShape(edgeNodes.length, gp.point);
    const mapped = mapPoint(edgeNodes, shape.N);
    const derivative = mapDerivative(edgeNodes, shape.dNds);
    const jacobian = Math.hypot(derivative.x, derivative.y);
    if (!(jacobian > 0)) fail('LAFEA_ANALYTICAL_TRACTION_EDGE_JACOBIAN_NONPOSITIVE');
    const traction = law(mapped.x, mapped.y);
    const scale = thickness * stressFactor * jacobian * gp.weight;
    for (let index = 0; index < nodal.length; index += 1) {
      nodal[index].fx += shape.N[index] * traction.tx * scale;
      nodal[index].fy += shape.N[index] * traction.ty * scale;
    }
    points.push(Object.freeze({
      s: gp.point,
      weight: gp.weight,
      x: mapped.x,
      y: mapped.y,
      jacobian,
      tx: traction.tx * stressFactor,
      ty: traction.ty * stressFactor,
    }));
  }
  const forces = nodal.map((row) => Object.freeze({
    nodeId: row.nodeId,
    fx: clean(row.fx),
    fy: clean(row.fy),
  }));
  const nodeById = new Map(edgeNodes.map((row) => [row.nodeId, row]));
  const resultant = forces.reduce((sum, row) => {
    const node = nodeById.get(row.nodeId);
    return {
      forceX: sum.forceX + row.fx,
      forceY: sum.forceY + row.fy,
      momentZ: sum.momentZ + node.x * row.fy - node.y * row.fx,
    };
  }, { forceX: 0, forceY: 0, momentZ: 0 });
  return Object.freeze({
    lawId: payload.law,
    quadratureId: LAFEA_ANALYTICAL_TRACTION_QUADRATURE,
    nodalForces: forces,
    resultant: Object.freeze(Object.fromEntries(
      Object.entries(resultant).map(([key, value]) => [key, clean(value)]),
    )),
    quadraturePoints: Object.freeze(points),
    releaseAuthorityGranted: false,
  });
}

export function evaluateLafeaAnalyticalTraction(payload, x, y) {
  return requireLaw(payload)(x, y);
}

function requireLaw(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || !LAFEA_ANALYTICAL_TRACTION_LAWS.includes(payload.law)) {
    fail('LAFEA_ANALYTICAL_TRACTION_LAW_INVALID');
  }
  if (payload.law === 'KIRSCH_INFINITE_PLATE_OUTER_BOUNDARY_V1') {
    exactKeys(payload, [
      'law', 'centerX', 'centerY', 'holeRadius', 'remoteStressSigmaX', 'unit',
    ]);
    const centerX = finite(payload.centerX, 'LAFEA_KIRSCH_CENTER_INVALID');
    const centerY = finite(payload.centerY, 'LAFEA_KIRSCH_CENTER_INVALID');
    const a = positive(payload.holeRadius, 'LAFEA_KIRSCH_HOLE_RADIUS_INVALID');
    const remote = finite(payload.remoteStressSigmaX, 'LAFEA_KIRSCH_REMOTE_STRESS_INVALID');
    return (x, y) => kirschTraction(x, y, centerX, centerY, a, remote);
  }
  fail('LAFEA_ANALYTICAL_TRACTION_LAW_INVALID');
}

function kirschTraction(x, y, cx, cy, a, remote) {
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.hypot(dx, dy);
  if (!(r > a)) fail('LAFEA_KIRSCH_TRACTION_POINT_NOT_OUTSIDE_HOLE');
  const theta = Math.atan2(dy, dx);
  const a2r2 = (a * a) / (r * r);
  const a4r4 = a2r2 * a2r2;
  const cos2 = Math.cos(2 * theta);
  const sin2 = Math.sin(2 * theta);
  const sigmaRR = 0.5 * remote * (1 - a2r2)
    + 0.5 * remote * (1 - 4 * a2r2 + 3 * a4r4) * cos2;
  const tauRTheta = -0.5 * remote * (1 + 2 * a2r2 - 3 * a4r4) * sin2;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return Object.freeze({
    tx: clean(sigmaRR * c - tauRTheta * s),
    ty: clean(sigmaRR * s + tauRTheta * c),
  });
}

function edgeShape(count, s) {
  if (count === 2) {
    return {
      N: [(1 - s) / 2, (1 + s) / 2],
      dNds: [-0.5, 0.5],
    };
  }
  return {
    N: [0.5 * s * (s - 1), 1 - s * s, 0.5 * s * (s + 1)],
    dNds: [s - 0.5, -2 * s, s + 0.5],
  };
}
function mapPoint(nodes, N) {
  return nodes.reduce((sum, node, index) => ({
    x: sum.x + N[index] * node.x,
    y: sum.y + N[index] * node.y,
  }), { x: 0, y: 0 });
}
function mapDerivative(nodes, dNds) {
  return nodes.reduce((sum, node, index) => ({
    x: sum.x + dNds[index] * node.x,
    y: sum.y + dNds[index] * node.y,
  }), { x: 0, y: 0 });
}
function exactKeys(value, keys) {
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    fail('LAFEA_ANALYTICAL_TRACTION_PAYLOAD_KEYS_INVALID');
  }
}
function finite(value, code) { if (!Number.isFinite(value)) fail(code); return value; }
function positive(value, code) { if (!Number.isFinite(value) || !(value > 0)) fail(code); return value; }
function clean(value) { return Object.is(value, -0) || Math.abs(value) < 1e-14 ? 0 : value; }
function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
