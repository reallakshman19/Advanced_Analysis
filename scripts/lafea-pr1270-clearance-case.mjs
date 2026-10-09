#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  canonicalProfile,
  defaultProfileFields,
  PROFILE_KINDS,
} from '../src/core/lafea-profile-contract/index.js';
import { qualifyRefinedMeshAdjacentSizeRatio } from '../src/core/lafea-meshing/refinement-fields.js';
import { createLafeaAnalysisGeometry } from '../src/workspace/lafea-analysis-geometry-contract.js';
import { createLafeaAnalysisGeometryEvidence } from '../src/workspace/lafea-analysis-geometry-evidence.js';
import { createLafeaContinuumAnalysisDomain } from '../src/workspace/lafea-continuum-analysis-domain.js';
import {
  LAFEA_RETAINED_MESH_REFINEMENT_COMMAND_SCHEMA,
  createLafeaRetainedMeshRefinementCommand,
} from '../src/workspace/lafea-mesh-refinement-command.js';
import {
  lafeaMeshGenerationConfiguration,
  produceLafeaAnalysisMeshEvidence,
} from '../src/workspace/lafea-mesh-producer-binding.js';
import {
  planLafeaRetainedMeshRefinement,
  produceLafeaRetainedMeshRefinement,
} from '../src/workspace/lafea-retained-mesh-refinement.js';

const SOURCE_HASH = `sha256:${'c'.repeat(64)}`;
const family = requiredEnum(process.env.PR1270_FAMILY, ['T3', 'T6'], 'family');
const globalTarget = finitePositive(process.env.PR1270_HGLOBAL ?? '30', 'global target');
const localTarget = finitePositive(process.env.PR1270_HLOCAL, 'local target');
const width = finitePositive(process.env.PR1270_WIDTH, 'width');
const height = finitePositive(process.env.PR1270_HEIGHT, 'height');
const xFraction = unitInterval(process.env.PR1270_XF, 'x fraction');
const yFraction = unitInterval(process.env.PR1270_YF, 'y fraction');
const caseId = process.env.PR1270_CASE_ID || 'PR1270-MATRIX-CASE';

const geometry = plate(width, height, caseId);
const stage = stageFor(geometry, caseId);
const profile = meshProfileFor(family, globalTarget, caseId);
const parent = produceLafeaAnalysisMeshEvidence(
  stage,
  lafeaMeshGenerationConfiguration(profile),
).evidence;
assert.equal(parent.qualification, 'PASS');

const requestedPoint = { x: width * xFraction, y: height * yFraction };
const targetElementId = nearestElement(parent.mesh, requestedPoint);
const command = createLafeaRetainedMeshRefinementCommand({
  schema: LAFEA_RETAINED_MESH_REFINEMENT_COMMAND_SCHEMA,
  commandId: `${caseId}-CMD`,
  stageId: 'LAFEA.3',
  parentMeshArtifactHash: parent.artifactHash,
  parentMeshHash: parent.meshHash,
  kind: 'TARGET_LENGTH',
  targetType: 'ELEMENT',
  targetIds: [targetElementId],
  targetElementLength: localTarget,
  lengthUnit: 'mm',
  reason: 'PR1270 point-clearance qualification matrix',
});
assert.equal(command.status, 'READY');
assert.equal(command.executionAuthorized, true);

const plan = planLafeaRetainedMeshRefinement({
  stage,
  meshProfile: profile,
  parentEvidence: parent,
  command,
});
const target = plan.targets[0];
const parentLocalCorners = localCornerCount(parent.mesh, target, plan.influenceRadius);
const parentLocalStats = localCharacteristicStats(parent.mesh, target, Math.max(localTarget * 2, globalTarget));

const refined = produceLafeaRetainedMeshRefinement({
  stage,
  meshProfile: profile,
  parentEvidence: parent,
  command,
});
assert.equal(refined.qualification, 'PASS');
const adjacency = qualifyRefinedMeshAdjacentSizeRatio(
  refined.evidence.mesh,
  profile.fields.adjacentSizeRatioMax,
);
assert.equal(adjacency.qualification, 'PASS');
assert.equal(adjacency.violatingAdjacencyCount, 0);
const childLocalCorners = localCornerCount(refined.evidence.mesh, target, plan.influenceRadius);
assert.ok(refined.localPointCount > 0, 'expected at least one retained-refinement insertion');
assert.ok(childLocalCorners > parentLocalCorners,
  `expected local corner density increase ${parentLocalCorners} -> ${childLocalCorners}`);
assert.ok(refined.evidence.mesh.nodes.length > parent.mesh.nodes.length);
assert.ok(refined.evidence.mesh.elements.length > parent.mesh.elements.length);
const childLocalStats = localCharacteristicStats(
  refined.evidence.mesh,
  target,
  Math.max(localTarget * 2, globalTarget),
);

console.log(`PR1270_CASE_RESULT=${JSON.stringify({
  caseId,
  family,
  globalTarget,
  localTarget,
  targetRatio: localTarget / globalTarget,
  width,
  height,
  xFraction,
  yFraction,
  targetElementId,
  target: { x: target.x, y: target.y },
  influenceRadius: plan.influenceRadius,
  parentNodes: parent.mesh.nodes.length,
  childNodes: refined.evidence.mesh.nodes.length,
  parentElements: parent.mesh.elements.length,
  childElements: refined.evidence.mesh.elements.length,
  localPointCount: refined.localPointCount,
  parentLocalCorners,
  childLocalCorners,
  localCornerGain: childLocalCorners - parentLocalCorners,
  parentLocalStats,
  childLocalStats,
  maximumAllowed: adjacency.maximumAllowed,
  maximumObserved: adjacency.maximumObserved,
  adjacentEdgeCount: adjacency.adjacentEdgeCount,
  violatingAdjacencyCount: adjacency.violatingAdjacencyCount,
  qualification: adjacency.qualification,
  meshHash: refined.evidence.meshHash,
})}`);

function plate(w, h, id) {
  return createLafeaAnalysisGeometry({
    schema: 'lafea-analysis-geometry/v1',
    stageId: 'LAFEA.3',
    geometryId: `${id}-PLATE`,
    coordinateSystemId: 'GLOBAL',
    lengthUnit: 'mm',
    orientationPolicy: 'OUTER_CCW_HOLES_CW_V1',
    vertices: [
      { vertexId: 'V1', x: 0, y: 0 },
      { vertexId: 'V2', x: w, y: 0 },
      { vertexId: 'V3', x: w, y: h },
      { vertexId: 'V4', x: 0, y: h },
    ],
    segments: [
      line('S1', 'V1', 'V2'), line('S2', 'V2', 'V3'),
      line('S3', 'V3', 'V4'), line('S4', 'V4', 'V1'),
    ],
    loops: [{ loopId: 'L_OUTER', role: 'OUTER', segmentIds: ['S1', 'S2', 'S3', 'S4'] }],
  });
}
function line(segmentId, startVertexId, endVertexId) {
  return { segmentId, type: 'LINE', startVertexId, endVertexId };
}
function meshProfileFor(continuumElement, globalTargetSize, id) {
  const defaults = defaultProfileFields(PROFILE_KINDS.MESH);
  return canonicalProfile(PROFILE_KINDS.MESH, {
    schema: 'lafea-mesh-profile/v1',
    profileIdentity: `${id}_${continuumElement}_${globalTargetSize}`,
    sourceRevision: 'PR1270-DIAG',
    semanticHash: undefined,
    fields: {
      ...defaults,
      continuumElement,
      shellElement: 'CST_DKT_TRI3_THIN_SHELL_V1',
      globalTargetSize,
    },
  });
}
function stageFor(geometryValue, id) {
  const domain = createLafeaContinuumAnalysisDomain({
    schema: 'lafea-continuum-analysis-domain/v1',
    stageId: 'LAFEA.3',
    sourceHash: SOURCE_HASH,
    applicationRef: id,
    units: { length: 'mm', force: 'N', stress: 'MPa', temperature: 'C' },
    formulation: 'PLANE_STRESS',
    region: { regionId: 'R1', materialRef: 'MAT_A' },
    physicalCases: [{ caseId: 'C1' }],
    attachments: [],
  }, geometryValue);
  const geometryEvidence = createLafeaAnalysisGeometryEvidence({
    schema: 'lafea-analysis-geometry-evidence/v1',
    stageId: 'LAFEA.3',
    sourceHash: SOURCE_HASH,
    analysisDomain: domain,
    geometry: geometryValue,
    producerRef: 'PR1270-DIAGNOSTIC-GEOMETRY',
    profileId: 'LAFEA3_DOMAIN_FIRST_GEOMETRY_V1',
  });
  return {
    stageId: 'LAFEA.3',
    domainFirstProfileActive: true,
    sourceAuthority: { stageId: 'LAFEA.3', sourceHash: SOURCE_HASH },
    retainedAnalysisGeometryEvidence: geometryEvidence,
    analysisDomainProjection: { state: 'CURRENT_PASS', analysisDomainHash: domain.semanticHash },
    analysisGeometryProjection: { state: 'CURRENT_PASS', analysisGeometryHash: geometryValue.semanticHash },
  };
}
function nearestElement(mesh, point) {
  const nodeById = new Map(mesh.nodes.map((node) => [node.nodeId, node]));
  return mesh.elements.map((element) => {
    const corners = element.nodeIds.slice(0, 3).map((id) => nodeById.get(id));
    const centroid = {
      x: corners.reduce((sum, node) => sum + node.x, 0) / 3,
      y: corners.reduce((sum, node) => sum + node.y, 0) / 3,
    };
    return {
      elementId: element.elementId,
      distance: Math.hypot(centroid.x - point.x, centroid.y - point.y),
    };
  }).sort((a, b) => a.distance - b.distance || a.elementId.localeCompare(b.elementId))[0].elementId;
}
function localCornerCount(mesh, target, radius) {
  const cornerIds = new Set(mesh.elements.flatMap((element) => element.nodeIds.slice(0, 3)));
  return mesh.nodes.filter((node) => cornerIds.has(node.nodeId)
    && Math.hypot(node.x - target.x, node.y - target.y) <= radius).length;
}
function localCharacteristicStats(mesh, target, radius) {
  const nodeById = new Map(mesh.nodes.map((node) => [node.nodeId, node]));
  const values = [];
  for (const element of mesh.elements) {
    const corners = element.nodeIds.slice(0, 3).map((id) => nodeById.get(id));
    const centroid = {
      x: corners.reduce((sum, node) => sum + node.x, 0) / 3,
      y: corners.reduce((sum, node) => sum + node.y, 0) / 3,
    };
    if (Math.hypot(centroid.x - target.x, centroid.y - target.y) > radius) continue;
    let h = 0;
    for (let edge = 0; edge < 3; edge += 1) {
      const a = corners[edge];
      const b = corners[(edge + 1) % 3];
      h = Math.max(h, Math.hypot(b.x - a.x, b.y - a.y));
    }
    values.push(h);
  }
  values.sort((a, b) => a - b);
  if (!values.length) return { count: 0, minimum: null, median: null, maximum: null };
  return {
    count: values.length,
    minimum: values[0],
    median: values[Math.floor(values.length / 2)],
    maximum: values.at(-1),
  };
}
function finitePositive(value, label) {
  const number = Number(value);
  assert.ok(Number.isFinite(number) && number > 0, `${label} must be finite and > 0`);
  return number;
}
function unitInterval(value, label) {
  const number = Number(value);
  assert.ok(Number.isFinite(number) && number > 0 && number < 1, `${label} must be inside (0,1)`);
  return number;
}
function requiredEnum(value, values, label) {
  assert.ok(values.includes(value), `${label} must be one of ${values.join(', ')}`);
  return value;
}
