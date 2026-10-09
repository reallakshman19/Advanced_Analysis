#!/usr/bin/env node
import assert from 'node:assert/strict';

import { PROFILE_KINDS, canonicalProfile } from '../src/core/lafea-profile-contract/index.js';
import { createLafeaMockDocument } from '../src/workspace/advanced-mock-data.js';
import { issueLafeaSourceAuthority } from '../src/workspace/lafea-source-authority.js';
import { createLafeaSimulatedShellMidsurfaceEvidence } from '../src/workspace/lafea-simulated-shell-midsurface-provider.js';
import { cylindricalShellUvAtPoint3d } from '../src/workspace/lafea-shell-curved-midsurface-contract.js';
import { produceLafeaShellAnalysisMesh } from '../src/workspace/lafea-shell-mesh-producer.js';
import {
  createLafea5SourceShellParent,
  planLafea5SourceShellMeshAdoption,
  produceLafea5SourceShellMeshAdoption,
} from '../src/workspace/lafea-source-shell-mesh-adoption.js';
import { requireLafeaStageComposition } from '../src/workspace/lafea-stage-composition-root.js';
import { normalizeLafeaStageDocument } from '../src/workspace/lafea-workbench-model.js';

const SOURCE_HASH = `sha256:${'c'.repeat(64)}`;
const shellProfile = (stageId, overrides = {}) => canonicalProfile(PROFILE_KINDS.MESH, {
  schema: 'lafea-mesh-profile/v1',
  profileIdentity: `SAMPLE_${stageId.replace('.', '_')}_SHELL_MESH_${overrides.profileSuffix ?? 'QUALIFIED'}`,
  sourceRevision: 'SAMPLE-PARENT-CHECK-V4',
  semanticHash: undefined,
  fields: {
    continuumElement: 'T3',
    shellElement: 'CST_DKT_TRI3_THIN_SHELL_V1',
    globalTargetSize: 15,
    adjacentSizeRatioMax: 1.5,
    aspectRatioWarn: 3,
    aspectRatioBlock: 10,
    scaledJacobianWarn: 0.6,
    scaledJacobianBlock: 0.2,
    adaptiveLevels: 3,
    ...overrides.fields,
  },
});

const lafea4 = createLafeaMockDocument('LAFEA.4');
const normalizedLafea4 = normalizeLafeaStageDocument('LAFEA.4', lafea4);
assert.deepEqual(
  normalizedLafea4.elements.map((row) => ({
    elementId: row.elementId,
    nodeIds: [...row.nodeIds],
  })),
  lafea4.elements.map((row) => ({
    elementId: row.elementId,
    nodeIds: [...row.nodeIds],
  })),
  'LAFEA.4 normalization must retain the editable Sample source connectivity exactly.',
);
assert.deepEqual(
  normalizedLafea4.nodes.map((row) => ({ nodeId: row.nodeId, position: [...row.position] })),
  lafea4.nodes.map((row) => ({ nodeId: row.nodeId, position: [...row.position] })),
  'LAFEA.4 normalization must retain the editable Sample source node identity and coordinates.',
);
const normalizedAuthority4 = issueLafeaSourceAuthority(
  'LAFEA.4', normalizedLafea4, 'SAMPLE-PARENT-CHECK/LAFEA4-NORMALIZED-SOURCE',
);
const normalizedParent4 = createLafeaSimulatedShellMidsurfaceEvidence(
  'LAFEA.4', normalizedAuthority4.sourceHash, normalizedLafea4,
);
assert.equal(normalizedParent4?.qualification, 'PASS');
const canonicalLafea4 = requireLafeaStageComposition('LAFEA.4').canonicalize(normalizedLafea4);
const canonicalizedConnectivityCount = canonicalLafea4.elements.filter((canonicalElement) => {
  const sourceElement = normalizedLafea4.elements.find(
    (row) => row.elementId === canonicalElement.elementId,
  );
  return sourceElement.nodeIds.join('|') !== canonicalElement.nodeIds.join('|');
}).length;
assert.ok(
  canonicalizedConnectivityCount > 0,
  'The Sample must prove source topology custody is distinct from solver winding canonicalization.',
);

const parent4 = createLafeaSimulatedShellMidsurfaceEvidence('LAFEA.4', SOURCE_HASH, lafea4);
assert.equal(lafea4.modelIdentity, 'CYLINDRICAL_PIPE_SHELL_BENCHMARK');
assert.equal(lafea4.nodes.length, 26);
assert.equal(lafea4.elements.length, 24);
assert.equal(parent4.stageId, 'LAFEA.4');
assert.equal(parent4.sourceHash, SOURCE_HASH);
assert.equal(parent4.qualification, 'PASS');
assert.equal(parent4.geometry.surface.kind, 'CYLINDER');
assert.equal(parent4.geometry.surface.radius, 100);
for (const node of lafea4.nodes) {
  const uv = cylindricalShellUvAtPoint3d(parent4.geometry, {
    x: node.position[0], y: node.position[1], z: node.position[2],
  });
  assert.ok(Number.isFinite(uv.u));
  assert.ok(Number.isFinite(uv.v));
}
const produced4 = produceLafeaShellAnalysisMesh({
  midsurfaceEvidence: parent4,
  meshProfile: shellProfile('LAFEA.4'),
});
assert.equal(produced4.evidence.qualification, 'PASS');
assert.equal(produced4.evidence.quality.shellOrientationTopology?.qualification, 'PASS');
assert.throws(
  () => produceLafeaShellAnalysisMesh({
    midsurfaceEvidence: parent4,
    meshProfile: shellProfile('LAFEA.4', {
      profileSuffix: 'WEAKENED', fields: { scaledJacobianBlock: 0.1 },
    }),
  }),
  (error) => error?.code === 'LAFEA4_MESH_QUALITY_POLICY_WEAKENING_NOT_QUALIFIED',
);

const lafea5 = createLafeaMockDocument('LAFEA.5');
assert.equal(
  createLafeaSimulatedShellMidsurfaceEvidence('LAFEA.5', SOURCE_HASH, lafea5),
  null,
  'LAFEA.5 must not be replaced by an analytic cylinder that changes the source footprint band.',
);
const parent5 = createLafea5SourceShellParent({
  sourceHash: SOURCE_HASH,
  shellTemplate: lafea5.shellTemplate,
});
const profile5 = shellProfile('LAFEA.5');
const plan5 = planLafea5SourceShellMeshAdoption({ parent: parent5, meshProfile: profile5 });
const produced5 = produceLafea5SourceShellMeshAdoption({
  parent: parent5,
  meshProfile: profile5,
  plan: plan5,
});
assert.equal(lafea5.workflowIdentity, 'TRUNNION-WORKFLOW-1');
assert.equal(lafea5.shellTemplate.nodes.length, 24);
assert.equal(lafea5.shellTemplate.elements.length, 24);
assert.equal(parent5.schema, 'lafea5-source-shell-parent/v1');
assert.equal(parent5.qualification, 'PASS');
assert.equal(plan5.generationMode, 'SOURCE_MESH_ADOPTION');
assert.equal(plan5.topologyMutation, false);
assert.equal(plan5.coordinateMutation, false);
assert.equal(produced5.evidence.qualification, 'PASS');
assert.equal(produced5.evidence.quality.blockingElementIds.length, 0);
assert.equal(produced5.evidence.quality.shellOrientationTopology?.qualification, 'PASS');
assert.equal(produced5.evidence.mesh.nodes.length, 24);
assert.equal(produced5.evidence.mesh.elements.length, 24);
assert.deepEqual(
  produced5.evidence.mesh.nodes,
  lafea5.shellTemplate.nodes.map((row) => ({
    nodeId: row.nodeId,
    x: row.position[0], y: row.position[1], z: row.position[2],
  })).sort((a, b) => a.nodeId.localeCompare(b.nodeId)),
);
assert.deepEqual(
  produced5.evidence.mesh.elements,
  lafea5.shellTemplate.elements.map((row) => ({
    elementId: row.elementId,
    elementType: 'CST_DKT_TRI3_THIN_SHELL_V1',
    nodeIds: [...row.nodeIds],
  })).sort((a, b) => a.elementId.localeCompare(b.elementId)),
);

const reversedTemplate = structuredClone(lafea5.shellTemplate);
reversedTemplate.elements[0].nodeIds = [
  reversedTemplate.elements[0].nodeIds[0],
  reversedTemplate.elements[0].nodeIds[2],
  reversedTemplate.elements[0].nodeIds[1],
];
assert.throws(
  () => createLafea5SourceShellParent({ sourceHash: SOURCE_HASH, shellTemplate: reversedTemplate }),
  (error) => error?.code === 'LAFEA5_SOURCE_SHELL_WINDING_DIRECTOR_MISMATCH',
  'Lossless source-mesh adoption must not preserve connectivity whose winding contradicts declared shell directors.',
);

const weakProfile5 = shellProfile('LAFEA.5', {
  profileSuffix: 'WEAKENED', fields: { aspectRatioWarn: 6 },
});
const weakPlan5 = planLafea5SourceShellMeshAdoption({ parent: parent5, meshProfile: weakProfile5 });
assert.throws(
  () => produceLafea5SourceShellMeshAdoption({
    parent: parent5,
    meshProfile: weakProfile5,
    plan: weakPlan5,
  }),
  (error) => error?.code === 'LAFEA5_MESH_QUALITY_POLICY_WEAKENING_NOT_QUALIFIED',
);

console.log(JSON.stringify({
  schema: 'lafea-shell-sample-parent-check/v4',
  status: 'PASS',
  lafea4: {
    sampleGeometry: 'CYLINDRICAL_PIPE_SHELL_BENCHMARK',
    sampleNodes: lafea4.nodes.length,
    sampleElements: lafea4.elements.length,
    sourceTopologyRetainedThroughNormalization: true,
    normalizedSourceAuthorityHash: normalizedAuthority4.sourceHash,
    solverCanonicalizedConnectivityCount: canonicalizedConnectivityCount,
    sourceAndSolverTopologyCustodySeparated: true,
    surface: parent4.geometry.surface.kind,
    radius: parent4.geometry.surface.radius,
    axialLength: 50,
    angularSpanDegrees: 60,
    meshMode: 'AUTOMATIC_CYLINDRICAL_MIDSURFACE_TRIANGULATION',
    shellParentRegistered: true,
    retainedNodes: produced4.evidence.mesh.nodes.length,
    retainedElements: produced4.evidence.mesh.elements.length,
    shellOrientationTopology: produced4.evidence.quality.shellOrientationTopology?.qualification,
    weakenedPolicyRejected: true,
  },
  lafea5: {
    sampleGeometry: 'TRUNNION_FOOTPRINT_CALLER_AUTHORED_SHELL_TEMPLATE',
    sampleNodes: lafea5.shellTemplate.nodes.length,
    sampleElements: lafea5.shellTemplate.elements.length,
    meshMode: plan5.generationMode,
    shellParentRegistered: true,
    producerRef: produced5.evidence.authority.producerRef,
    retainedNodes: produced5.evidence.mesh.nodes.length,
    retainedElements: produced5.evidence.mesh.elements.length,
    warningElements: produced5.evidence.quality.warningElementIds.length,
    blockingElements: produced5.evidence.quality.blockingElementIds.length,
    shellOrientationTopology: produced5.evidence.quality.shellOrientationTopology?.qualification,
    reversedSourceWindingRejected: true,
    weakenedPolicyRejected: true,
    topologyMutation: false,
    coordinateMutation: false,
  },
}, null, 2));