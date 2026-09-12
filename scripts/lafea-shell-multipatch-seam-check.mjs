#!/usr/bin/env node
import assert from 'node:assert/strict';

import { canonicalProfile, PROFILE_KINDS } from '../src/core/lafea-profile-contract/index.js';
import { BASE_LIMITATIONS, createCanonicalLocalShellModel } from '../src/core/local-shell/index.js';
import { buildShellElementEvidence } from '../src/core/local-shell/element.js';
import { qualifyLafeaAnalysisMesh } from '../src/workspace/lafea-analysis-mesh-contract.js';
import { baseSource, triangleSource as shellFixture } from './lafea.4-fixtures.mjs';
import { workflowSource as trunnionFixture } from './lafea.5-fixtures.mjs';
import {
  LAFEA_SHELL_MULTIPATCH_ANALYSIS_DOMAIN_SCHEMA,
  LAFEA_SHELL_MULTIPATCH_MIDSURFACE_GEOMETRY_SCHEMA,
  LAFEA_SHELL_MULTIPATCH_MIDSURFACE_INTAKE_SCHEMA,
  LAFEA_SHELL_MULTIPATCH_ORIENTATION,
  LAFEA_SHELL_MULTIPATCH_TOPOLOGY,
  createLafeaMultiPatchShellAnalysisDomain,
  createLafeaMultiPatchShellMidsurfaceEvidence,
  createLafeaMultiPatchShellMidsurfaceGeometry,
  multiPatchShellFrame,
  validateLafeaMultiPatchShellMidsurfaceEvidence,
} from '../src/workspace/lafea-shell-multipatch-midsurface-contract.js';
import {
  LAFEA_SHELL_MULTIPATCH_ELEMENT,
  LAFEA_SHELL_MULTIPATCH_MESH_PLAN_SCHEMA,
  LAFEA_SHELL_MULTIPATCH_MESH_STRATEGY,
  planLafeaMultiPatchShellAnalysisMesh,
  produceLafeaMultiPatchShellAnalysisMesh,
} from '../src/workspace/lafea-shell-multipatch-mesh-producer.js';
import { createLafeaWorkbenchOrchestratorStore } from '../src/workspace/lafea-workbench-orchestrator-store.js';
import { buildLafeaDiscretizationViewModel } from '../src/workspace/lafea-discretization-view-model.js';

assert.ok(BASE_LIMITATIONS.includes('NO_AUTOMATIC_OR_ADAPTIVE_MESHING'));

const SOURCE_HASH = `sha256:${'9'.repeat(64)}`;
const NEXT_SOURCE_HASH = `sha256:${'a'.repeat(64)}`;
const ROOT2 = Math.sqrt(0.5);
const fixtureByStage = { 'LAFEA.4': shellFixture, 'LAFEA.5': trunnionFixture };
const rows = [];

for (const stageId of ['LAFEA.4', 'LAFEA.5']) {
  const parent = multiPatchParent(stageId, SOURCE_HASH);
  assert.equal(validateLafeaMultiPatchShellMidsurfaceEvidence(parent).semanticHash, parent.semanticHash);
  const reordered = multiPatchParent(stageId, SOURCE_HASH, { reverseInputOrder: true });
  assert.equal(reordered.geometry.semanticHash, parent.geometry.semanticHash);
  assert.equal(reordered.semanticHash, parent.semanticHash);

  const coarseProfile = shellProfile(stageId, 30);
  const fineProfile = shellProfile(stageId, 15);
  const coarsePlan = planLafeaMultiPatchShellAnalysisMesh({
    midsurfaceEvidence: parent, meshProfile: coarseProfile,
  });
  assert.equal(coarsePlan.schema, LAFEA_SHELL_MULTIPATCH_MESH_PLAN_SCHEMA);
  assert.equal(coarsePlan.strategy, LAFEA_SHELL_MULTIPATCH_MESH_STRATEGY);
  assert.equal(coarsePlan.patchCount, 2);
  assert.equal(coarsePlan.seamCount, 1);
  assert.equal(coarsePlan.seamLength, 120);
  assert.ok(coarsePlan.seamNodeCount >= 2);
  assert.equal(coarsePlan.seamEdgeCount, coarsePlan.seamNodeCount - 1);
  assert.equal(coarsePlan.weldedNodeCount, coarsePlan.seamNodeCount);
  assert.equal(coarsePlan.unweldedNodeCount - coarsePlan.nodeCount, coarsePlan.seamNodeCount);
  close(coarsePlan.maximumSeamPairDistance, 0, 1e-9);
  assert.equal(coarsePlan.maximumEdgeOwnerCount, 2);
  close(coarsePlan.minimumFacetDirectorAlignment, 1, 1e-10);
  close(coarsePlan.authorityArea, 24000, 1e-8);
  close(coarsePlan.meshedArea, 24000, 1e-8);
  close(coarsePlan.areaError, 0, 1e-8);
  assert.equal(coarsePlan.estimatedDofs, coarsePlan.nodeCount * 5);

  const coarse = produceLafeaMultiPatchShellAnalysisMesh({
    midsurfaceEvidence: parent, meshProfile: coarseProfile, plan: coarsePlan,
  });
  assert.equal(coarse.evidence.qualification, 'PASS');
  assert.equal(coarse.evidence.quality.blockingElementIds.length, 0);
  assert.ok(coarse.evidence.mesh.elements.every((row) => row.elementType === LAFEA_SHELL_MULTIPATCH_ELEMENT));
  assertNodesOnPlane(coarse.evidence.mesh.nodes, parent.geometry);
  assertSeamOwnership(coarse.evidence.mesh, parent.geometry, coarsePlan.seamNodeCount);
  qualifySharedSeamFacetsAgainstLocalShell(coarse.evidence.mesh, parent.geometry);

  const replay = produceLafeaMultiPatchShellAnalysisMesh({
    midsurfaceEvidence: parent, meshProfile: coarseProfile,
  });
  assert.equal(replay.plan.planHash, coarse.plan.planHash);
  assert.equal(replay.evidence.meshHash, coarse.evidence.meshHash);
  assert.equal(replay.evidence.artifactHash, coarse.evidence.artifactHash);
  assert.equal(JSON.stringify(replay.evidence.mesh), JSON.stringify(coarse.evidence.mesh));

  const reorderedReplay = produceLafeaMultiPatchShellAnalysisMesh({
    midsurfaceEvidence: reordered, meshProfile: coarseProfile,
  });
  assert.equal(reorderedReplay.evidence.meshHash, coarse.evidence.meshHash);
  assert.equal(JSON.stringify(reorderedReplay.evidence.mesh), JSON.stringify(coarse.evidence.mesh));

  const fine = produceLafeaMultiPatchShellAnalysisMesh({
    midsurfaceEvidence: parent, meshProfile: fineProfile,
  });
  assert.equal(fine.evidence.qualification, 'PASS');
  assert.equal(fine.evidence.quality.blockingElementIds.length, 0);
  assert.ok(fine.evidence.mesh.nodes.length > coarse.evidence.mesh.nodes.length);
  assert.ok(fine.evidence.mesh.elements.length > coarse.evidence.mesh.elements.length);
  assert.ok(fine.plan.seamNodeCount > coarse.plan.seamNodeCount);
  assert.equal(fine.plan.weldedNodeCount, fine.plan.seamNodeCount);

  checkWorkbench(stageId, parent, coarseProfile);
  rows.push({
    stageId,
    target: 30,
    nodes: coarse.evidence.mesh.nodes.length,
    elements: coarse.evidence.mesh.elements.length,
    seamNodes: coarse.plan.seamNodeCount,
    seamEdges: coarse.plan.seamEdgeCount,
    weldedNodes: coarse.plan.weldedNodeCount,
    area: coarse.plan.meshedArea,
    minimumFacetDirectorAlignment: coarse.plan.minimumFacetDirectorAlignment,
    fineNodes: fine.evidence.mesh.nodes.length,
    fineElements: fine.evidence.mesh.elements.length,
    fineSeamNodes: fine.plan.seamNodeCount,
    artifactHash: coarse.evidence.artifactHash,
  });
}

const orientationTopologyFalsifiers = checkOrientationTopologyFalsifiers();
checkAdversarialContracts();

console.log(JSON.stringify({
  schema: 'lafea-shell-multipatch-seam-check/v1',
  status: 'PASS',
  rows,
  orientationTopologyFalsifiers,
  qualifiedScope: {
    patches: 2,
    surface: 'COPLANAR_PLANAR',
    patchShape: 'RECTANGLE',
    seam: 'ONE_COMPLETE_STRAIGHT_CONFORMING_EDGE',
    continuity: 'COMMON_ANALYTIC_PLANE_AND_DIRECTOR',
    elementFamily: LAFEA_SHELL_MULTIPATCH_ELEMENT,
  },
  exclusions: [
    'PARTIAL_EDGE_SEAMS', 'NONCONFORMING_SEAMS', 'CREASE_OR_KINKED_SEAMS',
    'CURVED_MULTIPATCH_SEAMS', 'PATCH_NETWORKS_GT_2', 'MULTIPATCH_HOLES',
    'OFFSET_SURFACE_GENERATION', 'THICKNESS_TRANSITION_MESHING', 'SHELL_LOCAL_REFINEMENT',
  ],
}, null, 2));

function multiPatchParent(stageId, sourceHash, options = {}) {
  const patchA = rectanglePatch('P-A', 0, 100, 0, 120, 'A');
  const patchB = rectanglePatch('P-B', 100, 200, 0, 120, 'B');
  const seam = {
    seamId: 'SEAM-AB',
    patchAId: options.reverseInputOrder ? 'P-B' : 'P-A',
    segmentAId: options.reverseInputOrder ? 'B-S4' : 'A-S2',
    patchBId: options.reverseInputOrder ? 'P-A' : 'P-B',
    segmentBId: options.reverseInputOrder ? 'A-S2' : 'B-S4',
  };
  const geometry = createLafeaMultiPatchShellMidsurfaceGeometry({
    schema: LAFEA_SHELL_MULTIPATCH_MIDSURFACE_GEOMETRY_SCHEMA,
    stageId,
    geometryId: `MULTIPATCH-${stageId}-AB`,
    lengthUnit: 'mm',
    origin: { x: 10, y: -20, z: 30 },
    axisU: { x: ROOT2, y: ROOT2, z: 0 },
    axisV: { x: 0, y: 0, z: 1 },
    orientationPolicy: LAFEA_SHELL_MULTIPATCH_ORIENTATION,
    patches: options.reverseInputOrder ? [patchB, patchA] : [patchA, patchB],
    seams: [seam],
  });
  const domain = createLafeaMultiPatchShellAnalysisDomain({
    schema: LAFEA_SHELL_MULTIPATCH_ANALYSIS_DOMAIN_SCHEMA,
    stageId,
    domainId: `MULTIPATCH-${stageId}-DOMAIN`,
    sourceHash,
    midsurfaceGeometryHash: geometry.semanticHash,
    lengthUnit: 'mm',
    topologyClass: LAFEA_SHELL_MULTIPATCH_TOPOLOGY,
  });
  return createLafeaMultiPatchShellMidsurfaceEvidence({
    schema: LAFEA_SHELL_MULTIPATCH_MIDSURFACE_INTAKE_SCHEMA,
    stageId,
    sourceHash,
    analysisDomain: domain,
    geometry,
    producerRef: 'DECLARED-COPLANAR-TWO-PATCH-MIDSURFACE',
  });
}

function rectanglePatch(patchId, u0, u1, v0, v1, prefix) {
  return {
    patchId,
    vertices: [
      { vertexId: `${prefix}-V1`, u: u0, v: v0 },
      { vertexId: `${prefix}-V2`, u: u1, v: v0 },
      { vertexId: `${prefix}-V3`, u: u1, v: v1 },
      { vertexId: `${prefix}-V4`, u: u0, v: v1 },
    ],
    segments: [
      { segmentId: `${prefix}-S1`, startVertexId: `${prefix}-V1`, endVertexId: `${prefix}-V2` },
      { segmentId: `${prefix}-S2`, startVertexId: `${prefix}-V2`, endVertexId: `${prefix}-V3` },
      { segmentId: `${prefix}-S3`, startVertexId: `${prefix}-V3`, endVertexId: `${prefix}-V4` },
      { segmentId: `${prefix}-S4`, startVertexId: `${prefix}-V4`, endVertexId: `${prefix}-V1` },
    ],
    loops: [{
      loopId: `${prefix}-OUTER`, role: 'OUTER',
      segmentIds: [`${prefix}-S1`, `${prefix}-S2`, `${prefix}-S3`, `${prefix}-S4`],
    }],
  };
}

function shellProfile(stageId, target) {
  return canonicalProfile(PROFILE_KINDS.MESH, {
    schema: 'lafea-mesh-profile/v1',
    profileIdentity: `MULTIPATCH_${stageId.replace('.', '_')}_${target}`,
    sourceRevision: 'R9', semanticHash: undefined,
    fields: {
      continuumElement: 'T3',
      shellElement: LAFEA_SHELL_MULTIPATCH_ELEMENT,
      globalTargetSize: target,
      adjacentSizeRatioMax: 1.5,
      aspectRatioWarn: 5,
      aspectRatioBlock: 10,
      scaledJacobianWarn: 0.6,
      scaledJacobianBlock: 0.2,
      adaptiveLevels: 3,
    },
  });
}

function assertNodesOnPlane(nodes, geometry) {
  const normal = cross(geometry.axisU, geometry.axisV);
  for (const node of nodes) {
    const offset = {
      x: node.x - geometry.origin.x,
      y: node.y - geometry.origin.y,
      z: node.z - geometry.origin.z,
    };
    close(dot(offset, normal), 0, 1e-9);
  }
}

function assertSeamOwnership(mesh, geometry, expectedNodeCount) {
  const seamRows = mesh.nodes.map((node) => ({ node, uv: projectUv(node, geometry) }))
    .filter((row) => Math.abs(row.uv.u - 100) <= 1e-9)
    .sort((left, right) => left.uv.v - right.uv.v || left.node.nodeId.localeCompare(right.node.nodeId));
  assert.equal(seamRows.length, expectedNodeCount);
  close(seamRows[0].uv.v, 0, 1e-9);
  close(seamRows.at(-1).uv.v, 120, 1e-9);
  const owners = edgeOwners(mesh.elements);
  for (let index = 0; index < seamRows.length - 1; index += 1) {
    assert.equal(owners.get(edgeKey(seamRows[index].node.nodeId, seamRows[index + 1].node.nodeId)), 2);
  }
}

function qualifySharedSeamFacetsAgainstLocalShell(mesh, geometry) {
  const seamRows = mesh.nodes.map((node) => ({ node, uv: projectUv(node, geometry) }))
    .filter((row) => Math.abs(row.uv.u - 100) <= 1e-9)
    .sort((left, right) => left.uv.v - right.uv.v || left.node.nodeId.localeCompare(right.node.nodeId));
  const seamKey = edgeKey(seamRows[0].node.nodeId, seamRows[1].node.nodeId);
  const owners = mesh.elements.filter((element) => elementEdges(element).includes(seamKey));
  assert.equal(owners.length, 2);
  const neededIds = [...new Set(owners.flatMap((element) => element.nodeIds))].sort();
  const nodeById = new Map(mesh.nodes.map((node) => [node.nodeId, node]));
  const frame = multiPatchShellFrame(geometry);
  const source = baseSource({
    modelIdentity: 'MULTIPATCH-SEAM-FACET-COMPATIBILITY',
    sourceAncestry: ['lafea-shell-multipatch-seam-check/v1'],
    nodes: neededIds.map((nodeId) => {
      const point = nodeById.get(nodeId);
      return {
        nodeId,
        position: [point.x, point.y, point.z],
        director: vector(frame.director),
        rotationBasis1: vector(frame.rotationBasis1),
        rotationBasis2: vector(frame.rotationBasis2),
        sourceReference: `MULTIPATCH:${nodeId}`,
      };
    }),
    elements: owners.map((element, index) => ({
      elementId: `SEAM-E${index + 1}`,
      nodeIds: [...element.nodeIds],
      materialId: 'MAT',
      thickness: 2,
      sourceReference: `MULTIPATCH:${element.elementId}`,
    })),
    constraints: [],
    loadCases: [{ loadCaseId: 'LC', nodalLoads: [], pressureLoads: [], sourceReference: 'LC-SRC' }],
  });
  const model = createCanonicalLocalShellModel(source);
  const evidence = buildShellElementEvidence(model);
  assert.equal(evidence.length, 2);
  for (const row of evidence) {
    assert.ok(row.directorAlignment.every((entry) => entry.accepted));
    assert.ok(row.qualification.rigidTranslation.accepted);
    assert.ok(row.qualification.rigidRotation.scaledQualification.accepted);
  }
}

function checkWorkbench(stageId, parent, profile) {
  const workbench = createLafeaWorkbenchOrchestratorStore({
    initialStage: stageId,
    initialDocument: fixtureByStage[stageId](),
    initialSourceHash: SOURCE_HASH,
  });
  assert.equal(workbench.registerShellMidsurfaceEvidence(parent, stageId)?.changed, true);
  assert.equal(workbench.bindAnalysisMeshProfile(profile, stageId)?.changed, true);
  const planned = workbench.planAnalysisMesh({}, stageId);
  assert.equal(planned.summary.strategy, LAFEA_SHELL_MULTIPATCH_MESH_STRATEGY);
  const generated = workbench.generateAnalysisMesh({}, stageId);
  assert.equal(generated.evidence.qualification, 'PASS');
  let stage = workbench.getState().stages[stageId];
  assert.equal(stage.analysisMeshCustodyProjection.state, 'CURRENT_PASS');
  assert.equal(stage.analysisMeshCustodyProjection.usableForRun, true);
  const vm = buildLafeaDiscretizationViewModel(stage);
  assert.equal(vm.actions.canRun, true);
  assert.equal(vm.actions.manualRefinementEnabled, false);
  const retainedHash = workbench.selectRetainedAnalysisMeshEvidenceV2(stageId).artifactHash;
  assert.equal(workbench.refineAnalysisMesh({
    targetType: 'ELEMENT', targetIds: ['E000001'], targetElementLength: 10, lengthUnit: 'mm',
  }, stageId), null);
  assert.equal(workbench.getState().diagnostics?.[0]?.code, 'LAFEA_SHELL_LOCAL_REFINEMENT_NOT_QUALIFIED');
  assert.equal(workbench.selectRetainedAnalysisMeshEvidenceV2(stageId).artifactHash, retainedHash);
  workbench.initializeLifecycle(NEXT_SOURCE_HASH, `MULTIPATCH-${stageId}-SOURCE-CHANGE`);
  stage = workbench.getState().stages[stageId];
  assert.equal(stage.retainedShellMidsurfaceEvidence, null);
  assert.equal(stage.retainedAnalysisMeshEvidenceV2, null);
  workbench.destroy();
}

function checkOrientationTopologyFalsifiers() {
  const profile = shellProfile('LAFEA.4', 30);
  const nodes = [
    { nodeId: 'A', x: 0, y: 0, z: 0 },
    { nodeId: 'B', x: 10, y: 0, z: 0 },
    { nodeId: 'C', x: 10, y: 10, z: 0 },
    { nodeId: 'D', x: 0, y: 10, z: 0 },
  ];
  const consistent = shellTopologyQuality(nodes, [
    ['E1', ['A', 'B', 'C']],
    ['E2', ['A', 'C', 'D']],
  ], profile);
  assert.equal(consistent.qualification, 'PASS');

  const oneFacetReversed = shellTopologyQuality(nodes, [
    ['E1', ['A', 'B', 'C']],
    ['E2', ['A', 'D', 'C']],
  ], profile);
  assert.equal(oneFacetReversed.qualification, 'BLOCK');
  assert.ok(oneFacetReversed.elementsRequiringFlip.length > 0);

  const globallyReversedButConsistent = shellTopologyQuality(nodes, [
    ['E1', ['A', 'C', 'B']],
    ['E2', ['A', 'D', 'C']],
  ], profile);
  assert.equal(globallyReversedButConsistent.qualification, 'PASS');
  assert.deepEqual(globallyReversedButConsistent.elementsRequiringFlip, []);

  const duplicatedSeamNodes = [
    ...nodes,
    { nodeId: 'A2', x: 0, y: 0, z: 0 },
    { nodeId: 'C2', x: 10, y: 10, z: 0 },
  ];
  const coordinateCoincidentButDisconnected = shellTopologyQuality(duplicatedSeamNodes, [
    ['E1', ['A', 'B', 'C']],
    ['E2', ['A2', 'C2', 'D']],
  ], profile);
  assert.equal(coordinateCoincidentButDisconnected.qualification, 'BLOCK');
  assert.equal(coordinateCoincidentButDisconnected.patchCount, 2);

  return {
    schema: 'lafea4-a1-orientation-topology-falsifiers/v1',
    localFacetReversal: 'BLOCK',
    coordinateCoincidentDistinctNodeIds: 'BLOCK_DISCONNECTED_PATCHES',
    duplicatedSeamNodes: 'BLOCK_DISCONNECTED_PATCHES',
    globalInversionTopologyGate: 'PASS_INTERNALLY_CONSISTENT_REQUIRES_SEPARATE_PARENT_NORMAL_POLICY',
  };
}

function shellTopologyQuality(nodes, definitions, profile) {
  const quality = qualifyLafeaAnalysisMesh('LAFEA.4', {
    nodes,
    elements: definitions.map(([elementId, nodeIds]) => ({
      elementId,
      elementType: LAFEA_SHELL_MULTIPATCH_ELEMENT,
      nodeIds,
    })),
  }, profile);
  return quality.shellOrientationTopology;
}

function checkAdversarialContracts() {
  const base = rawGeometry('LAFEA.4');
  const gap = structuredClone(base);
  for (const vertex of gap.patches[1].vertices) vertex.u += 1;
  assert.throws(() => createLafeaMultiPatchShellMidsurfaceGeometry(gap),
    (error) => error?.code === 'LAFEA_SHELL_MULTIPATCH_SEAM_NOT_COINCIDENT_OPPOSITE');

  const coordinateCoincidentWithoutDeclaredTopology = structuredClone(base);
  coordinateCoincidentWithoutDeclaredTopology.seams = [];
  assert.throws(
    () => createLafeaMultiPatchShellMidsurfaceGeometry(coordinateCoincidentWithoutDeclaredTopology),
    (error) => error?.code === 'LAFEA_SHELL_MULTIPATCH_EXACTLY_ONE_SEAM_REQUIRED',
  );

  const nonRectangle = structuredClone(base);
  nonRectangle.patches[1].vertices.find((row) => row.vertexId === 'B-V2').v = 10;
  assert.throws(() => createLafeaMultiPatchShellMidsurfaceGeometry(nonRectangle),
    (error) => error?.code === 'LAFEA_SHELL_MULTIPATCH_RECTANGULAR_PATCH_REQUIRED');

  const wrongSeam = structuredClone(base);
  wrongSeam.seams[0].segmentAId = 'A-S1';
  assert.throws(() => createLafeaMultiPatchShellMidsurfaceGeometry(wrongSeam),
    (error) => error?.code === 'LAFEA_SHELL_MULTIPATCH_SEAM_NOT_COINCIDENT_OPPOSITE');

  const third = structuredClone(base);
  third.patches.push(rectanglePatch('P-C', 200, 300, 0, 120, 'C'));
  assert.throws(() => createLafeaMultiPatchShellMidsurfaceGeometry(third),
    (error) => error?.code === 'LAFEA_SHELL_MULTIPATCH_EXACTLY_TWO_PATCHES_REQUIRED');
}

function rawGeometry(stageId) {
  return {
    schema: LAFEA_SHELL_MULTIPATCH_MIDSURFACE_GEOMETRY_SCHEMA,
    stageId,
    geometryId: `MULTIPATCH-${stageId}-AB`,
    lengthUnit: 'mm',
    origin: { x: 10, y: -20, z: 30 },
    axisU: { x: ROOT2, y: ROOT2, z: 0 },
    axisV: { x: 0, y: 0, z: 1 },
    orientationPolicy: LAFEA_SHELL_MULTIPATCH_ORIENTATION,
    patches: [rectanglePatch('P-A', 0, 100, 0, 120, 'A'), rectanglePatch('P-B', 100, 200, 0, 120, 'B')],
    seams: [{ seamId: 'SEAM-AB', patchAId: 'P-A', segmentAId: 'A-S2', patchBId: 'P-B', segmentBId: 'B-S4' }],
  };
}

function projectUv(point, geometry) {
  const offset = {
    x: point.x - geometry.origin.x,
    y: point.y - geometry.origin.y,
    z: point.z - geometry.origin.z,
  };
  return { u: dot(offset, geometry.axisU), v: dot(offset, geometry.axisV) };
}
function elementEdges(element) {
  return [
    edgeKey(element.nodeIds[0], element.nodeIds[1]),
    edgeKey(element.nodeIds[1], element.nodeIds[2]),
    edgeKey(element.nodeIds[2], element.nodeIds[0]),
  ];
}
function edgeOwners(elements) {
  const map = new Map();
  for (const element of elements) {
    for (const key of elementEdges(element)) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}
function edgeKey(a, b) { return a < b ? `${a}:${b}` : `${b}:${a}`; }
function vector(value) { return [value.x, value.y, value.z]; }
function dot(left, right) { return left.x * right.x + left.y * right.y + left.z * right.z; }
function cross(left, right) {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}
function close(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} within ${tolerance}`);
}