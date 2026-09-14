/**
 * Source-geometry pressure lowering for LAFEA.3.
 *
 * Positive pressure acts into the material. Canonical analysis geometry keeps the
 * material on the left of every oriented boundary segment (OUTER is CCW, HOLE is
 * CW), so the material-inward pressure normal is the source tangent rotated +90°.
 *
 * This module is a compiler primitive only. It changes no element, solver,
 * quadrature, benchmark, tolerance, or release authority.
 */

export const LAFEA_SOURCE_PRESSURE_QUADRATURE = 'GAUSS_LEGENDRE_12_SOURCE_BOUNDARY_PRESSURE_V1';

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

export function integrateLafeaSourcePressure({
  pressure,
  edgeNodes,
  thickness,
  stressFactor = 1,
  sourceFeatureGeometry,
}) {
  const p = finite(pressure, 'LAFEA_SOURCE_PRESSURE_VALUE_INVALID');
  if (!Array.isArray(edgeNodes) || ![2, 3].includes(edgeNodes.length)
    || edgeNodes.some((node) => !node?.nodeId
      || !Number.isFinite(node.x) || !Number.isFinite(node.y))) {
    fail('LAFEA_SOURCE_PRESSURE_EDGE_NODES_INVALID');
  }
  if (!(Number.isFinite(thickness) && thickness > 0)) {
    fail('LAFEA_SOURCE_PRESSURE_THICKNESS_INVALID');
  }
  if (!(Number.isFinite(stressFactor) && stressFactor > 0)) {
    fail('LAFEA_SOURCE_PRESSURE_STRESS_FACTOR_INVALID');
  }

  const source = sourceBoundary(sourceFeatureGeometry);
  const parameters = edgeNodes.map((node) => source.parameterAt(node.x, node.y));
  const u0 = parameters[0];
  const u1 = parameters.at(-1);
  if (!(u1 > u0 + 1e-12)) fail('LAFEA_SOURCE_PRESSURE_EDGE_ORIENTATION_INVALID');
  if (edgeNodes.length === 3) {
    const expectedMid = (u0 + u1) / 2;
    if (Math.abs(parameters[1] - expectedMid) > 1e-7) {
      fail('LAFEA_SOURCE_PRESSURE_EDGE_SOURCE_PARAMETERIZATION_INVALID');
    }
  }

  const sourceJacobian = source.measure * (u1 - u0) / 2;
  if (!(sourceJacobian > 0)) fail('LAFEA_SOURCE_PRESSURE_SOURCE_JACOBIAN_NONPOSITIVE');
  const nodal = edgeNodes.map((node) => ({ nodeId: node.nodeId, fx: 0, fy: 0 }));
  const quadraturePoints = [];

  for (const gp of GAUSS_12) {
    const N = edgeShape(edgeNodes.length, gp.point);
    const u = u0 + ((gp.point + 1) / 2) * (u1 - u0);
    const tangent = source.tangentAt(u);
    const inwardNormal = [-tangent[1], tangent[0]];
    const tx = p * stressFactor * inwardNormal[0];
    const ty = p * stressFactor * inwardNormal[1];
    const scale = thickness * sourceJacobian * gp.weight;
    for (let index = 0; index < nodal.length; index += 1) {
      nodal[index].fx += N[index] * tx * scale;
      nodal[index].fy += N[index] * ty * scale;
    }
    quadraturePoints.push(Object.freeze({
      s: gp.point,
      weight: gp.weight,
      sourceParameter: u,
      sourceJacobian,
      inwardNormal: Object.freeze(inwardNormal.map(clean)),
      tx: clean(tx),
      ty: clean(ty),
    }));
  }

  const nodalForces = nodal.map((row) => Object.freeze({
    nodeId: row.nodeId,
    fx: clean(row.fx),
    fy: clean(row.fy),
  }));
  const nodeById = new Map(edgeNodes.map((row) => [row.nodeId, row]));
  const resultant = nodalForces.reduce((sum, row) => {
    const node = nodeById.get(row.nodeId);
    return {
      forceX: sum.forceX + row.fx,
      forceY: sum.forceY + row.fy,
      momentZ: sum.momentZ + node.x * row.fy - node.y * row.fx,
    };
  }, { forceX: 0, forceY: 0, momentZ: 0 });

  return Object.freeze({
    quadratureId: LAFEA_SOURCE_PRESSURE_QUADRATURE,
    sourceBoundaryAuthority: 'ANALYSIS_GEOMETRY_ORIENTED_SEGMENT_V1',
    geometryType: source.type,
    loopId: source.loopId,
    loopRole: source.loopRole,
    sourceParameterRange: Object.freeze([clean(u0), clean(u1)]),
    sourceMeasure: clean(source.measure * (u1 - u0)),
    nodalForces: Object.freeze(nodalForces),
    resultant: Object.freeze(Object.fromEntries(
      Object.entries(resultant).map(([key, value]) => [key, clean(value)]),
    )),
    quadraturePoints: Object.freeze(quadraturePoints),
    releaseAuthorityGranted: false,
  });
}

function sourceBoundary(geometry) {
  if (!geometry || typeof geometry !== 'object' || Array.isArray(geometry)) {
    fail('LAFEA_SOURCE_PRESSURE_SOURCE_GEOMETRY_INVALID');
  }
  const binding = uniqueLoopBinding(geometry.loopBindings);
  if (geometry.type === 'LINE') return lineBoundary(geometry, binding);
  if (geometry.type === 'CIRCULAR_ARC') return arcBoundary(geometry, binding);
  fail('LAFEA_SOURCE_PRESSURE_SOURCE_GEOMETRY_UNSUPPORTED');
}

function uniqueLoopBinding(bindings) {
  if (!Array.isArray(bindings) || bindings.length !== 1
    || typeof bindings[0]?.loopId !== 'string'
    || !['OUTER', 'HOLE'].includes(bindings[0]?.role)) {
    fail('LAFEA_SOURCE_PRESSURE_LOOP_BINDING_INVALID');
  }
  return bindings[0];
}

function lineBoundary(geometry, binding) {
  const ax = finite(geometry.start?.x, 'LAFEA_SOURCE_PRESSURE_SOURCE_GEOMETRY_INVALID');
  const ay = finite(geometry.start?.y, 'LAFEA_SOURCE_PRESSURE_SOURCE_GEOMETRY_INVALID');
  const bx = finite(geometry.end?.x, 'LAFEA_SOURCE_PRESSURE_SOURCE_GEOMETRY_INVALID');
  const by = finite(geometry.end?.y, 'LAFEA_SOURCE_PRESSURE_SOURCE_GEOMETRY_INVALID');
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) fail('LAFEA_SOURCE_PRESSURE_SOURCE_GEOMETRY_INVALID');
  const scale = Math.max(1, length, Math.abs(ax), Math.abs(ay), Math.abs(bx), Math.abs(by));
  const tolerance = 1e-8 * scale;
  return Object.freeze({
    type: 'LINE', loopId: binding.loopId, loopRole: binding.role, measure: length,
    tangentAt: () => Object.freeze([dx / length, dy / length]),
    parameterAt: (x, y) => {
      const px = finite(x, 'LAFEA_SOURCE_PRESSURE_EDGE_POINT_INVALID');
      const py = finite(y, 'LAFEA_SOURCE_PRESSURE_EDGE_POINT_INVALID');
      const uRaw = ((px - ax) * dx + (py - ay) * dy) / (length * length);
      const sx = ax + uRaw * dx;
      const sy = ay + uRaw * dy;
      if (uRaw < -1e-8 || uRaw > 1 + 1e-8 || Math.hypot(px - sx, py - sy) > tolerance) {
        fail('LAFEA_SOURCE_PRESSURE_EDGE_POINT_OUTSIDE_SOURCE_SEGMENT');
      }
      return clamp01(uRaw);
    },
  });
}

function arcBoundary(geometry, binding) {
  const cx = finite(geometry.centerX, 'LAFEA_SOURCE_PRESSURE_SOURCE_GEOMETRY_INVALID');
  const cy = finite(geometry.centerY, 'LAFEA_SOURCE_PRESSURE_SOURCE_GEOMETRY_INVALID');
  const radius = positive(geometry.radius, 'LAFEA_SOURCE_PRESSURE_SOURCE_GEOMETRY_INVALID');
  if (!['CCW', 'CW'].includes(geometry.sweep)) fail('LAFEA_SOURCE_PRESSURE_SOURCE_GEOMETRY_INVALID');
  const ax = finite(geometry.start?.x, 'LAFEA_SOURCE_PRESSURE_SOURCE_GEOMETRY_INVALID');
  const ay = finite(geometry.start?.y, 'LAFEA_SOURCE_PRESSURE_SOURCE_GEOMETRY_INVALID');
  const bx = finite(geometry.end?.x, 'LAFEA_SOURCE_PRESSURE_SOURCE_GEOMETRY_INVALID');
  const by = finite(geometry.end?.y, 'LAFEA_SOURCE_PRESSURE_SOURCE_GEOMETRY_INVALID');
  const scale = Math.max(1, radius, Math.abs(cx), Math.abs(cy), Math.abs(ax), Math.abs(ay), Math.abs(bx), Math.abs(by));
  const tolerance = 1e-8 * scale;
  if (Math.abs(Math.hypot(ax - cx, ay - cy) - radius) > tolerance
    || Math.abs(Math.hypot(bx - cx, by - cy) - radius) > tolerance) {
    fail('LAFEA_SOURCE_PRESSURE_SOURCE_GEOMETRY_INVALID');
  }
  const a0 = Math.atan2(ay - cy, ax - cx);
  const a1 = Math.atan2(by - cy, bx - cx);
  const totalAngle = geometry.sweep === 'CCW' ? ccw(a0, a1) : ccw(a1, a0);
  if (!(totalAngle > 1e-12)) fail('LAFEA_SOURCE_PRESSURE_SOURCE_GEOMETRY_INVALID');
  const sign = geometry.sweep === 'CCW' ? 1 : -1;
  return Object.freeze({
    type: 'CIRCULAR_ARC', loopId: binding.loopId, loopRole: binding.role,
    measure: radius * totalAngle,
    tangentAt: (u) => {
      const angle = a0 + sign * totalAngle * u;
      return Object.freeze([clean(-sign * Math.sin(angle)), clean(sign * Math.cos(angle))]);
    },
    parameterAt: (x, y) => {
      const px = finite(x, 'LAFEA_SOURCE_PRESSURE_EDGE_POINT_INVALID');
      const py = finite(y, 'LAFEA_SOURCE_PRESSURE_EDGE_POINT_INVALID');
      if (Math.abs(Math.hypot(px - cx, py - cy) - radius) > tolerance) {
        fail('LAFEA_SOURCE_PRESSURE_EDGE_POINT_OUTSIDE_SOURCE_SEGMENT');
      }
      const angle = Math.atan2(py - cy, px - cx);
      const delta = geometry.sweep === 'CCW' ? ccw(a0, angle) : ccw(angle, a0);
      const uRaw = delta / totalAngle;
      if (uRaw < -1e-8 || uRaw > 1 + 1e-8) {
        fail('LAFEA_SOURCE_PRESSURE_EDGE_POINT_OUTSIDE_SOURCE_SEGMENT');
      }
      return clamp01(uRaw);
    },
  });
}

function edgeShape(count, s) {
  if (count === 2) return [(1 - s) / 2, (1 + s) / 2];
  return [0.5 * s * (s - 1), 1 - s * s, 0.5 * s * (s + 1)];
}
function ccw(start, end) {
  let value = end - start;
  while (value < 0) value += Math.PI * 2;
  while (value >= Math.PI * 2) value -= Math.PI * 2;
  return value;
}
function clamp01(value) { return Math.min(1, Math.max(0, value)); }
function finite(value, code) { if (!Number.isFinite(value)) fail(code); return value; }
function positive(value, code) { if (!Number.isFinite(value) || !(value > 0)) fail(code); return value; }
function clean(value) { return Object.is(value, -0) || Math.abs(value) < 1e-13 ? 0 : value; }
function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
