import { buildLafeaBucket01ProbeStableAxisPlan } from '../../workspace/lafea-bucket-01-probe-stable-axis-plan.js';
import { canonicalLafeaSha256 } from '../../workspace/lafea-canonical-sha256.js';

export const LAFEA_B02D_PROBE_STABLE_POLAR_FEATURE_ID_V2 = 'B02D_PROBE_STABLE_POLAR_V2';
export const LAFEA_B02D_PROBE_STABLE_POLAR_STRATEGY_V2 = 'B02D_PROBE_STABLE_POLAR_V2';
export const LAFEA_B02D_PROBE_STABLE_POLAR_POLICY_ID_V2 = 'B02D_PROBE_STABLE_POLAR_POLICY_V2';

const H_LEVELS = Object.freeze([40, 20, 10, 5]);
const POLICY = deepFreeze({
  schema: 'lafea-b02d-probe-stable-polar-policy/v2',
  policyId: LAFEA_B02D_PROBE_STABLE_POLAR_POLICY_ID_V2,
  designId: 'B02D-PROBE-STABLE-POLAR-V2',
  geometry: { centerX: 0, centerY: 0, holeRadius: 20, outerRadius: 100 },
  refinementRatio: 2,
  levels: H_LEVELS.map((h, index) => ({ ordinal: index + 1, h })),
  radialAxis: {
    axisId: 'B02D-V2-PROBE-STABLE-RADIAL', axisKind: 'RADIAL_LENGTH',
    anchors: [
      { anchorId: 'R27', value: 27 }, { anchorId: 'R33', value: 33 },
      { anchorId: 'R47', value: 47 }, { anchorId: 'R73', value: 73 },
      { anchorId: 'R87', value: 87 },
    ],
    protectedBreakpoints: [60], targetPhase: 0.35,
    backgroundBaseDivisions: 6, windowClearanceFraction: 0.3,
  },
  circumferentialAxis: {
    axisId: 'B02D-V2-PROBE-STABLE-CIRCUMFERENTIAL', axisKind: 'POLAR_ANGLE_DEGREES',
    anchors: [
      { anchorId: 'THETA_17', value: 17 }, { anchorId: 'THETA_67', value: 67 },
      { anchorId: 'THETA_83', value: 83 },
    ],
    protectedBreakpoints: [90, 180, 270], targetPhase: 0.65,
    backgroundBaseDivisions: 20, windowClearanceFraction: 0.32,
  },
  mapping: {
    radialWindowStart: 20,
    radialWindowEnd: 60,
    loadAngleDegrees: 0,
    restraintAngleDegrees: 180,
  },
  midsideGeometryPolicy: {
    physicalBoundaryCircumferentialEdges: 'ANALYTIC_CIRCULAR_ARC',
    internalCircumferentialEdges: 'STRAIGHT_CHORD',
    radialEdges: 'STRAIGHT_CHORD',
    diagonalEdges: 'STRAIGHT_CHORD',
  },
});

export function lafeaB02dProbeStablePolarPolicyV2() {
  return POLICY;
}

export function generateLafeaB02dProbeStablePolarMeshV2({ targetElementLength, elementFamily }) {
  const ordinal = ordinalForH(targetElementLength);
  if (!['T3', 'T6', 'Q8'].includes(elementFamily)) fail('LAFEA_B02D_POLAR_V2_ELEMENT_FAMILY_INVALID');
  const radialPlan = axisPlan('RADIAL', POLICY.radialAxis).levels[ordinal - 1];
  const angularPlan = axisPlan('CIRCUMFERENTIAL', POLICY.circumferentialAxis).levels[ordinal - 1];
  const state = createState(ordinal, elementFamily, radialPlan.coordinates, angularPlan.coordinates);
  createCornerNodes(state);
  createElements(state);
  const mesh = analysisMesh(state);
  const featureMapping = buildFeatureMapping(state);
  const lengths = characteristicLengths(mesh);
  const base = {
    mesh,
    nodeCount: mesh.nodes.length,
    elementCount: mesh.elements.length,
    estimatedDofs: mesh.nodes.length * 2,
    boundarySegmentCount: 2 * state.sectorCount,
    characteristicLengthMin: Math.min(...lengths),
    characteristicLengthMedian: median(lengths),
    characteristicLengthMax: Math.max(...lengths),
    strategy: LAFEA_B02D_PROBE_STABLE_POLAR_STRATEGY_V2,
    strategyReason: 'PROSPECTIVELY_FROZEN_PHYSICAL_PROBE_STABLE_POLAR_POLICY_V2',
    holeCount: 1,
    interiorPointCount: Math.max(0, state.cornerNodeCount - 2 * state.sectorCount),
    ordinal,
    targetElementLength,
    elementFamily,
    policyId: POLICY.policyId,
    policyHash: canonicalLafeaSha256(POLICY),
    radialAxisHash: radialPlan.semanticHash,
    circumferentialAxisHash: angularPlan.semanticHash,
    featureMapping,
  };
  return deepFreeze({
    ...base,
    semanticHash: canonicalLafeaSha256({ schema: 'lafea-b02d-probe-stable-polar-mesh-output/v2', output: base }),
  });
}

function axisPlan(kind, axis) {
  return buildLafeaBucket01ProbeStableAxisPlan({
    schema: 'lafea-bucket-01-probe-stable-axis-plan-input/v1',
    axisId: axis.axisId,
    axisKind: axis.axisKind,
    domainStart: kind === 'RADIAL' ? POLICY.geometry.holeRadius : 0,
    domainEnd: kind === 'RADIAL' ? POLICY.geometry.outerRadius : 360,
    anchors: axis.anchors,
    protectedBreakpoints: axis.protectedBreakpoints,
    targetPhase: axis.targetPhase,
    refinementRatio: POLICY.refinementRatio,
    levelCount: POLICY.levels.length,
    backgroundBaseDivisions: axis.backgroundBaseDivisions,
    windowClearanceFraction: axis.windowClearanceFraction,
  });
}

function createState(ordinal, elementFamily, radii, angleCoordinates) {
  return {
    ordinal,
    elementFamily,
    radii,
    angles: angleCoordinates.slice(0, -1),
    sectorCount: angleCoordinates.length - 1,
    radialCount: radii.length - 1,
    nodes: new Map(),
    nodeMeta: new Map(),
    edgeMidpoints: new Map(),
    elements: [],
    cornerNodeCount: radii.length * (angleCoordinates.length - 1),
  };
}

function createCornerNodes(state) {
  for (let ring = 0; ring < state.radii.length; ring += 1) {
    for (let sector = 0; sector < state.sectorCount; sector += 1) {
      const radius = state.radii[ring];
      const angleDegrees = state.angles[sector];
      const theta = angleDegrees * Math.PI / 180;
      addNode(state, cornerId(ring, sector), {
        x: POLICY.geometry.centerX + radius * Math.cos(theta),
        y: POLICY.geometry.centerY + radius * Math.sin(theta),
        z: 0,
      }, { kind: 'CORNER', ring, sector, radius, angleDegrees });
    }
  }
}

function createElements(state) {
  for (let ring = 0; ring < state.radialCount; ring += 1) {
    for (let sector = 0; sector < state.sectorCount; sector += 1) {
      const next = (sector + 1) % state.sectorCount;
      const innerA = cornerId(ring, sector);
      const outerA = cornerId(ring + 1, sector);
      const outerB = cornerId(ring + 1, next);
      const innerB = cornerId(ring, next);
      if (state.elementFamily === 'Q8') {
        addQ8(state, `E-R${ring}-S${sector}`, [innerA, outerA, outerB, innerB]);
      } else {
        addTriangle(state, `E-R${ring}-S${sector}-A`, [innerA, outerA, outerB]);
        addTriangle(state, `E-R${ring}-S${sector}-B`, [innerA, outerB, innerB]);
      }
    }
  }
}

function addTriangle(state, elementId, cornerIds) {
  requirePositiveCorners(state, cornerIds, elementId);
  const nodeIds = state.elementFamily === 'T3'
    ? cornerIds
    : [...cornerIds,
      midpointId(state, cornerIds[0], cornerIds[1]),
      midpointId(state, cornerIds[1], cornerIds[2]),
      midpointId(state, cornerIds[2], cornerIds[0])];
  state.elements.push(Object.freeze({ elementId, elementType: state.elementFamily, nodeIds: Object.freeze(nodeIds) }));
}

function addQ8(state, elementId, cornerIds) {
  requirePositivePolygon(state, cornerIds, elementId);
  const nodeIds = [...cornerIds,
    midpointId(state, cornerIds[0], cornerIds[1]),
    midpointId(state, cornerIds[1], cornerIds[2]),
    midpointId(state, cornerIds[2], cornerIds[3]),
    midpointId(state, cornerIds[3], cornerIds[0])];
  state.elements.push(Object.freeze({ elementId, elementType: 'Q8', nodeIds: Object.freeze(nodeIds) }));
}

function midpointId(state, firstId, secondId) {
  const key = edgeKey(firstId, secondId);
  if (state.edgeMidpoints.has(key)) return state.edgeMidpoints.get(key);
  const first = requireNode(state, firstId);
  const second = requireNode(state, secondId);
  const a = state.nodeMeta.get(firstId);
  const b = state.nodeMeta.get(secondId);
  const nodeId = `M-${key.replace(':', '--')}`;
  let point = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2, z: 0 };
  if (a?.kind === 'CORNER' && b?.kind === 'CORNER' && a.ring === b.ring
      && (a.ring === 0 || a.ring === state.radialCount)) {
    const radius = a.radius;
    const ux = (first.x - POLICY.geometry.centerX) / radius
      + (second.x - POLICY.geometry.centerX) / radius;
    const uy = (first.y - POLICY.geometry.centerY) / radius
      + (second.y - POLICY.geometry.centerY) / radius;
    const norm = Math.hypot(ux, uy);
    if (!(norm > 0)) fail('LAFEA_B02D_POLAR_V2_CIRCUMFERENTIAL_MIDSIDE_INVALID');
    point = {
      x: POLICY.geometry.centerX + radius * ux / norm,
      y: POLICY.geometry.centerY + radius * uy / norm,
      z: 0,
    };
  }
  addNode(state, nodeId, point, { kind: 'MIDSIDE', edgeKey: key, firstId, secondId });
  state.edgeMidpoints.set(key, nodeId);
  return nodeId;
}

function buildFeatureMapping(state) {
  const load = radialPath(state, POLICY.mapping.loadAngleDegrees);
  const restraint = radialPath(state, POLICY.mapping.restraintAngleDegrees);
  if (load.nodeIds.length < 2 || restraint.nodeIds.length < 2) fail('LAFEA_B02D_POLAR_V2_FEATURE_PATH_EMPTY');
  return deepFreeze({
    schema: 'lafea-b02d-probe-stable-polar-feature-mapping/v2',
    loadFeatureRole: 'RADIAL_QUARTER_0',
    restraintFeatureRole: 'RADIAL_QUARTER_2',
    radialStart: POLICY.mapping.radialWindowStart,
    radialEnd: POLICY.mapping.radialWindowEnd,
    loadAngleDegrees: POLICY.mapping.loadAngleDegrees,
    restraintAngleDegrees: POLICY.mapping.restraintAngleDegrees,
    loadNodeIds: load.nodeIds,
    restraintNodeIds: restraint.nodeIds,
    loadEdges: load.edges,
    restraintEdges: restraint.edges,
    exactEndpointNodes: true,
    physicalCoordinateSelection: true,
    indexScaledSelectionUsed: false,
  });
}

function radialPath(state, angleDegrees) {
  const sector = state.angles.findIndex((value) => Math.abs(value - angleDegrees) < 1e-12);
  if (sector < 0) fail('LAFEA_B02D_POLAR_V2_CARDINAL_FEATURE_MISSING');
  const start = coordinateIndex(state.radii, POLICY.mapping.radialWindowStart);
  const end = coordinateIndex(state.radii, POLICY.mapping.radialWindowEnd);
  if (start < 0 || end <= start) fail('LAFEA_B02D_POLAR_V2_RADIAL_WINDOW_MISSING');
  const nodeIds = [];
  const edges = [];
  for (let ring = start; ring < end; ring += 1) {
    const a = cornerId(ring, sector);
    const b = cornerId(ring + 1, sector);
    const edge = state.elementFamily === 'T3'
      ? [a, b]
      : [a, midpointId(state, a, b), b];
    if (!nodeIds.length) nodeIds.push(edge[0]);
    nodeIds.push(...edge.slice(1));
    edges.push(Object.freeze([...edge]));
  }
  return { nodeIds: Object.freeze(nodeIds), edges: Object.freeze(edges) };
}

function analysisMesh(state) {
  return deepFreeze({
    schema: 'lafea-analysis-mesh/v1',
    meshIdentity: `B02D-V2-${state.elementFamily}-L${state.ordinal}-PROBE-STABLE-POLAR`,
    nodes: [...state.nodes].map(([nodeId, point]) => ({ nodeId, ...point }))
      .sort((a, b) => a.nodeId.localeCompare(b.nodeId)),
    elements: [...state.elements].sort((a, b) => a.elementId.localeCompare(b.elementId)),
  });
}

function characteristicLengths(mesh) {
  const nodeById = new Map(mesh.nodes.map((row) => [row.nodeId, row]));
  const values = [];
  for (const element of mesh.elements) {
    const corners = element.elementType === 'Q8' ? element.nodeIds.slice(0, 4) : element.nodeIds.slice(0, 3);
    for (let index = 0; index < corners.length; index += 1) {
      const a = nodeById.get(corners[index]);
      const b = nodeById.get(corners[(index + 1) % corners.length]);
      values.push(Math.hypot(b.x - a.x, b.y - a.y));
    }
  }
  if (!values.length) fail('LAFEA_B02D_POLAR_V2_CHARACTERISTIC_LENGTH_EMPTY');
  return values;
}

function ordinalForH(value) {
  if (!Number.isFinite(value)) fail('LAFEA_B02D_POLAR_V2_TARGET_H_INVALID');
  const index = H_LEVELS.findIndex((h) => Math.abs(h - value) <= 1e-12 * Math.max(1, h));
  if (index < 0) fail('LAFEA_B02D_POLAR_V2_TARGET_H_NOT_FROZEN_LEVEL');
  return index + 1;
}
function coordinateIndex(values, target) {
  return values.findIndex((value) => Math.abs(value - target) <= 1e-12 * Math.max(1, Math.abs(target)));
}
function cornerId(ring, sector) { return `N-R${ring}-S${sector}`; }
function edgeKey(a, b) { return a < b ? `${a}:${b}` : `${b}:${a}`; }
function addNode(state, nodeId, point, meta) {
  if (state.nodes.has(nodeId)) fail('LAFEA_B02D_POLAR_V2_NODE_DUPLICATE');
  state.nodes.set(nodeId, Object.freeze({ x: clean(point.x), y: clean(point.y), z: 0 }));
  state.nodeMeta.set(nodeId, Object.freeze(meta));
}
function requireNode(state, nodeId) {
  const node = state.nodes.get(nodeId);
  if (!node) fail('LAFEA_B02D_POLAR_V2_NODE_MISSING');
  return node;
}
function requirePositiveCorners(state, ids, elementId) {
  const [a, b, c] = ids.map((id) => requireNode(state, id));
  const twice = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (!(twice > 0)) fail(`LAFEA_B02D_POLAR_V2_ELEMENT_ORIENTATION_INVALID:${elementId}`);
}
function requirePositivePolygon(state, ids, elementId) {
  const p = ids.map((id) => requireNode(state, id));
  let twice = 0;
  for (let i = 0; i < p.length; i += 1) {
    const a = p[i]; const b = p[(i + 1) % p.length]; twice += a.x * b.y - b.x * a.y;
  }
  if (!(twice > 0)) fail(`LAFEA_B02D_POLAR_V2_ELEMENT_ORIENTATION_INVALID:${elementId}`);
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function clean(value) { return Math.abs(value) < 1e-13 || Object.is(value, -0) ? 0 : value; }
function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze); return Object.freeze(value);
}
