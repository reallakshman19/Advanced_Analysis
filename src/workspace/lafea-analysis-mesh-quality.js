/**
 * Private NB-T4A analysis-mesh quality implementation.
 *
 * The public contract facade re-exports the qualification function. This
 * module evaluates explicit mesh content only; it does not generate topology,
 * execute an engine or promote lifecycle or release authority.
 */
import {
  qualifyScaledJacobian,
  worstStatus,
} from '../core/lafea-meshing/index.js';
import {
  ORIENTATION_STATES,
  diagnoseOrientation,
} from '../core/local-shell/orientation-diagnostics.js';

export const LAFEA_ANALYSIS_MESH_QUALITY_SCHEMA = 'lafea-analysis-mesh-quality/v1';

const DEGREES_PER_RADIAN = 180 / Math.PI;
const POLICY_COMPARE_EPSILON_FACTOR = 64;
const STRAIGHT_SIDED_TRIANGLE_TYPES = new Set([
  'T3',
  'CST_DKT_TRI3_THIN_SHELL_V1',
]);

export function qualifyLafeaAnalysisMesh(stageId, mesh, meshProfile) {
  const nodeById = new Map(mesh.nodes.map((node) => [node.nodeId, node]));
  const thresholds = meshProfile.fields;
  const elementResults = mesh.elements.map((element) => {
    const physicalNodes = element.nodeIds.map((nodeId) => nodeById.get(nodeId));
    if (physicalNodes.some((node) => !node)) {
      throw meshContractError('LAFEA_ANALYSIS_MESH_ELEMENT_NODE_NOT_FOUND');
    }
    if (stageId === 'LAFEA.3' && physicalNodes.some((node) => node.z !== 0)) {
      throw meshContractError('LAFEA_ANALYSIS_MESH_CONTINUUM_NODE_NOT_PLANAR');
    }
    const cornerCount = element.elementType === 'Q8' ? 4 : 3;
    const cornerNodes = physicalNodes.slice(0, cornerCount);
    const aspectRatio = aspectRatioMetric(cornerNodes, thresholds);
    const scaledJacobian = scaledJacobianMetric(
      stageId, element.elementType, physicalNodes, thresholds,
    );
    // Corner-angle geometry is authoritative only for straight-sided triangles.
    // A T6 edge is quadratic and may be curved by its midside node, so the
    // three corner chords are not the element mapping. T6 shape quality is
    // therefore governed by its high-order scaled-Jacobian evaluation rather
    // than a linear-corner angle surrogate.
    const minimumAngle = STRAIGHT_SIDED_TRIANGLE_TYPES.has(element.elementType)
      ? minimumAngleMetric(cornerNodes, thresholds)
      : null;
    const metrics = Object.freeze([
      aspectRatio,
      scaledJacobian,
      ...(minimumAngle ? [minimumAngle] : []),
    ]);
    return Object.freeze({
      elementId: element.elementId,
      elementType: element.elementType,
      characteristicLength: characteristicLengthOf(cornerNodes),
      metrics,
      worstStatus: worstStatus(metrics),
    });
  });

  const aspectValue = maximumMetricValue(elementResults, 'ASPECT_RATIO');
  const jacobianValue = minimumMetricValue(elementResults, 'SCALED_JACOBIAN');
  const angleValue = optionalMinimumMetricValue(elementResults, 'MINIMUM_ANGLE_DEGREES');
  const angleThresholds = derivedTriangleAngleThresholds(thresholds);
  const shellOrientationTopology = shellOrientationTopologyQualification(stageId, mesh);
  const adjacentSizeRatio = stageId === 'LAFEA.4'
    ? adjacentSizeRatioQualification(mesh, elementResults, thresholds.adjacentSizeRatioMax)
    : null;

  const gateRows = [
    aggregateMetric('ASPECT_RATIO', aspectValue,
      classifyHigher(aspectValue, thresholds.aspectRatioWarn, thresholds.aspectRatioBlock),
      thresholds.aspectRatioWarn, thresholds.aspectRatioBlock),
    aggregateMetric('SCALED_JACOBIAN', jacobianValue,
      jacobianValue <= 0 ? 'BLOCK' : classifyLower(
        jacobianValue, thresholds.scaledJacobianWarn, thresholds.scaledJacobianBlock,
      ), thresholds.scaledJacobianWarn, thresholds.scaledJacobianBlock),
  ];
  if (angleValue !== null) {
    gateRows.push(aggregateMetric(
      'MINIMUM_ANGLE_DEGREES',
      angleValue,
      classifyLower(angleValue, angleThresholds.warning, angleThresholds.blocking),
      angleThresholds.warning,
      angleThresholds.blocking,
    ));
  }
  if (adjacentSizeRatio) gateRows.push(adjacentSizeRatio.gate);
  if (shellOrientationTopology) gateRows.push(shellOrientationTopology.gate);
  const gateResults = Object.freeze(gateRows);

  const blockingElementIds = new Set(
    elementResults.filter((row) => row.worstStatus === 'BLOCK').map((row) => row.elementId),
  );
  for (const elementId of adjacentSizeRatio?.blockingElementIds ?? []) {
    blockingElementIds.add(elementId);
  }
  for (const elementId of shellOrientationTopology?.blockingElementIds ?? []) {
    blockingElementIds.add(elementId);
  }

  return deepFreeze({
    schema: LAFEA_ANALYSIS_MESH_QUALITY_SCHEMA,
    meshProfileIdentity: meshProfile.profileIdentity,
    meshProfileHash: meshProfile.semanticHash,
    elementResults,
    gateResults,
    adjacentSizeRatio: adjacentSizeRatio?.evidence ?? null,
    shellOrientationTopology: shellOrientationTopology?.evidence ?? null,
    worstStatus: worstStatus(gateResults),
    blockingElementIds: [...blockingElementIds].sort(),
    warningElementIds: elementResults
      .filter((row) => row.worstStatus === 'WARNING').map((row) => row.elementId),
    elementCount: elementResults.length,
  });
}

function adjacentSizeRatioQualification(mesh, elementResults, maximumAllowed) {
  if (!(Number.isFinite(maximumAllowed) && maximumAllowed > 1)) {
    throw meshContractError('LAFEA_ANALYSIS_MESH_ADJACENT_SIZE_RATIO_POLICY_INVALID');
  }
  const characteristicLengthByElementId = new Map(
    elementResults.map((row) => [row.elementId, row.characteristicLength]),
  );
  const edgeUsers = new Map();
  for (const element of mesh.elements) {
    const cornerCount = element.elementType === 'Q8' ? 4 : 3;
    const ids = element.nodeIds.slice(0, cornerCount);
    for (let index = 0; index < ids.length; index += 1) {
      const a = ids[index];
      const b = ids[(index + 1) % ids.length];
      const key = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
      const users = edgeUsers.get(key) ?? [];
      users.push(element.elementId);
      edgeUsers.set(key, users);
    }
  }

  const adjacencies = [];
  for (const [edgeKey, rawElementIds] of edgeUsers.entries()) {
    const elementIds = [...new Set(rawElementIds)].sort();
    if (elementIds.length < 2) continue;
    const lengths = elementIds.map((elementId) => characteristicLengthByElementId.get(elementId));
    const minimum = Math.min(...lengths);
    const maximum = Math.max(...lengths);
    if (!(minimum > 0)) throw meshContractError('LAFEA_ANALYSIS_MESH_DEGENERATE_CHARACTERISTIC_LENGTH');
    const ratio = maximum / minimum;
    const status = exceedsMaximum(ratio, maximumAllowed) ? 'BLOCK' : 'OK';
    adjacencies.push(Object.freeze({
      nodeIds: Object.freeze(edgeKey.split('\u0000')),
      elementIds: Object.freeze(elementIds),
      minimumCharacteristicLength: minimum,
      maximumCharacteristicLength: maximum,
      ratio,
      status,
    }));
  }

  adjacencies.sort((left, right) => (
    right.ratio - left.ratio
    || left.nodeIds.join('\u0000').localeCompare(right.nodeIds.join('\u0000'))
  ));
  const maximumObserved = adjacencies[0]?.ratio ?? 1;
  const violating = adjacencies.filter((row) => row.status === 'BLOCK');
  const blockingElementIds = [...new Set(violating.flatMap((row) => row.elementIds))].sort();
  const status = violating.length ? 'BLOCK' : 'OK';

  return Object.freeze({
    gate: Object.freeze({
      metric: 'ADJACENT_SIZE_RATIO',
      value: maximumObserved,
      status,
      maximum: maximumAllowed,
    }),
    blockingElementIds: Object.freeze(blockingElementIds),
    evidence: Object.freeze({
      definition: 'MAX_LONGEST_CORNER_EDGE_RATIO_ACROSS_SHARED_CORNER_EDGE_V1',
      maximumAllowed,
      maximumObserved,
      adjacentEdgeCount: adjacencies.length,
      violatingAdjacencyCount: violating.length,
      violatingAdjacencies: Object.freeze(violating),
      qualification: status === 'OK' ? 'PASS' : 'BLOCK',
    }),
  });
}

function shellOrientationTopologyQualification(stageId, mesh) {
  if (stageId === 'LAFEA.3') return null;
  const diagnosis = diagnoseOrientation(mesh.elements);
  const edgeUsers = new Map();
  for (const element of mesh.elements) {
    const ids = element.nodeIds.slice(0, 3);
    for (const [a, b] of [[ids[0], ids[1]], [ids[1], ids[2]], [ids[2], ids[0]]]) {
      const key = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
      const row = edgeUsers.get(key) ?? [];
      row.push(element.elementId);
      edgeUsers.set(key, row);
    }
  }
  const nonManifoldEdges = [...edgeUsers.entries()]
    .filter(([, elementIds]) => elementIds.length > 2)
    .map(([edgeKey, elementIds]) => Object.freeze({
      nodeIds: Object.freeze(edgeKey.split('\u0000')),
      elementIds: Object.freeze([...elementIds].sort()),
    }));
  const consistent = diagnosis.state === ORIENTATION_STATES.CONSISTENT
    && nonManifoldEdges.length === 0;
  const blockingElementIds = new Set(diagnosis.elementsRequiringFlip);
  if (diagnosis.state === ORIENTATION_STATES.DISCONNECTED_PATCHES) {
    mesh.elements.forEach((element) => blockingElementIds.add(element.elementId));
  }
  for (const edge of nonManifoldEdges) {
    edge.elementIds.forEach((elementId) => blockingElementIds.add(elementId));
  }
  const status = consistent ? 'OK' : 'BLOCK';
  return Object.freeze({
    gate: Object.freeze({
      metric: 'SHELL_ORIENTATION_TOPOLOGY',
      value: consistent ? 1 : 0,
      status,
      warningThreshold: null,
      blockingThreshold: 1,
    }),
    blockingElementIds: Object.freeze([...blockingElementIds].sort()),
    evidence: Object.freeze({
      formulaId: diagnosis.formulaId,
      state: diagnosis.state,
      patchCount: diagnosis.patchCount,
      elementsRequiringFlip: Object.freeze([...diagnosis.elementsRequiringFlip]),
      conflicts: diagnosis.conflicts,
      nonManifoldEdgeCount: nonManifoldEdges.length,
      nonManifoldEdges: Object.freeze(nonManifoldEdges),
      qualification: consistent ? 'PASS' : 'BLOCK',
    }),
  });
}

function aspectRatioMetric(cornerNodes, thresholds) {
  const lengths = edgeLengths3d(cornerNodes);
  const shortest = Math.min(...lengths);
  if (!(shortest > 0)) throw meshContractError('LAFEA_ANALYSIS_MESH_DEGENERATE_EDGE');
  const value = Math.max(...lengths) / shortest;
  return Object.freeze({
    metric: 'ASPECT_RATIO',
    value,
    status: classifyHigher(value, thresholds.aspectRatioWarn,
      thresholds.aspectRatioBlock),
  });
}

function minimumAngleMetric(cornerNodes, thresholds) {
  const value = minimumTriangleAngleDegrees(cornerNodes);
  const derived = derivedTriangleAngleThresholds(thresholds);
  return Object.freeze({
    metric: 'MINIMUM_ANGLE_DEGREES',
    value,
    status: classifyLower(value, derived.warning, derived.blocking),
  });
}

function scaledJacobianMetric(stageId, elementType, physicalNodes, thresholds) {
  if (elementType === 'T6' || elementType === 'Q8') {
    return qualifyScaledJacobian(elementType, physicalNodes, {
      warn: thresholds.scaledJacobianWarn,
      block: thresholds.scaledJacobianBlock,
    });
  }
  const value = triangleScaledJacobian(stageId, physicalNodes.slice(0, 3));
  return Object.freeze({
    metric: 'SCALED_JACOBIAN',
    value,
    status: value <= 0 ? 'BLOCK' : classifyLower(
      value, thresholds.scaledJacobianWarn, thresholds.scaledJacobianBlock,
    ),
  });
}

function triangleScaledJacobian(stageId, nodes) {
  return Math.min(...nodes.map((origin, index) => {
    const first = subtract3d(nodes[(index + 1) % 3], origin);
    const second = subtract3d(nodes[(index + 2) % 3], origin);
    const denominator = norm3d(first) * norm3d(second);
    if (!(denominator > 0)) return 0;
    if (stageId === 'LAFEA.3') {
      return ((first.x * second.y) - (first.y * second.x)) / denominator;
    }
    // Shell triangle shape uses the unsigned 3D area magnitude. Winding and
    // topology are qualified independently above because signed shell normal
    // custody cannot be inferred from a scalar shape metric.
    return norm3d(cross3d(first, second)) / denominator;
  }));
}

function minimumTriangleAngleDegrees(nodes) {
  if (nodes.length !== 3) throw meshContractError('LAFEA_ANALYSIS_MESH_TRIANGLE_ANGLE_NODE_COUNT_INVALID');
  const angles = nodes.map((origin, index) => {
    const first = subtract3d(nodes[(index + 1) % 3], origin);
    const second = subtract3d(nodes[(index + 2) % 3], origin);
    const denominator = norm3d(first) * norm3d(second);
    if (!(denominator > 0)) return 0;
    const cosine = Math.max(-1, Math.min(1, dot3d(first, second) / denominator));
    return Math.acos(cosine) * DEGREES_PER_RADIAN;
  });
  return Math.min(...angles);
}

function derivedTriangleAngleThresholds(thresholds) {
  const warning = Math.asin(clampUnit(thresholds.scaledJacobianWarn)) * DEGREES_PER_RADIAN;
  const blocking = Math.asin(clampUnit(thresholds.scaledJacobianBlock)) * DEGREES_PER_RADIAN;
  return Object.freeze({ warning, blocking });
}

function characteristicLengthOf(cornerNodes) {
  return Math.max(...edgeLengths3d(cornerNodes));
}

function edgeLengths3d(cornerNodes) {
  return cornerNodes.map((node, index) => distance3d(
    node, cornerNodes[(index + 1) % cornerNodes.length],
  ));
}

function maximumMetricValue(elementResults, metric) {
  return Math.max(...elementResults.map((row) => metricValue(row, metric)));
}

function minimumMetricValue(elementResults, metric) {
  return Math.min(...elementResults.map((row) => metricValue(row, metric)));
}

function optionalMinimumMetricValue(elementResults, metric) {
  const values = elementResults
    .map((row) => row.metrics.find((candidate) => candidate.metric === metric)?.value)
    .filter((value) => Number.isFinite(value));
  return values.length ? Math.min(...values) : null;
}

function metricValue(row, metric) {
  const value = row.metrics.find((candidate) => candidate.metric === metric)?.value;
  if (!Number.isFinite(value)) throw meshContractError('LAFEA_ANALYSIS_MESH_REQUIRED_METRIC_MISSING');
  return value;
}

function aggregateMetric(metric, value, status, warningThreshold, blockingThreshold) {
  return Object.freeze({ metric, value, status, warningThreshold, blockingThreshold });
}

function classifyHigher(value, warning, blocking) {
  if (value >= blocking) return 'BLOCK';
  if (value >= warning) return 'WARNING';
  return 'OK';
}

function classifyLower(value, warning, blocking) {
  if (value <= blocking) return 'BLOCK';
  if (value <= warning) return 'WARNING';
  return 'OK';
}

function exceedsMaximum(value, maximum) {
  const tolerance = POLICY_COMPARE_EPSILON_FACTOR * Number.EPSILON * Math.max(1, Math.abs(maximum));
  return value > maximum + tolerance;
}

function clampUnit(value) {
  if (!Number.isFinite(value)) throw meshContractError('LAFEA_ANALYSIS_MESH_SCALED_JACOBIAN_POLICY_INVALID');
  return Math.max(0, Math.min(1, value));
}

function distance3d(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y, right.z - left.z);
}

function subtract3d(left, right) {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function dot3d(left, right) {
  return (left.x * right.x) + (left.y * right.y) + (left.z * right.z);
}

function cross3d(left, right) {
  return {
    x: (left.y * right.z) - (left.z * right.y),
    y: (left.z * right.x) - (left.x * right.z),
    z: (left.x * right.y) - (left.y * right.x),
  };
}

function norm3d(value) {
  return Math.hypot(value.x, value.y, value.z);
}

function meshContractError(code) {
  const error = new TypeError(code);
  error.code = code;
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
