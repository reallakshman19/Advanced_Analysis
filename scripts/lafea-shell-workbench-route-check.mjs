#!/usr/bin/env node
import assert from 'node:assert/strict';

import { canonicalProfile, PROFILE_KINDS } from '../src/core/lafea-profile-contract/index.js';
import { buildLafeaDiscretizationViewModel } from '../src/workspace/lafea-discretization-view-model.js';
import {
  LAFEA_SHELL_ANALYSIS_DOMAIN_SCHEMA,
  LAFEA_SHELL_MIDSURFACE_GEOMETRY_SCHEMA,
  LAFEA_SHELL_MIDSURFACE_INTAKE_SCHEMA,
  LAFEA_SHELL_MIDSURFACE_ORIENTATION,
  LAFEA_SHELL_MIDSURFACE_TOPOLOGY,
  createLafeaShellAnalysisDomain,
  createLafeaShellMidsurfaceEvidence,
  createLafeaShellMidsurfaceGeometry,
} from '../src/workspace/lafea-shell-midsurface-contract.js';
import { LAFEA_SHELL_ELEMENT } from '../src/workspace/lafea-shell-mesh-producer.js';
import { issueLafeaSourceAuthority } from '../src/workspace/lafea-source-authority.js';
import { normalizeLafeaStageDocument } from '../src/workspace/lafea-workbench-model.js';
import { createLafeaWorkbenchOrchestratorStore } from '../src/workspace/lafea-workbench-orchestrator-store.js';
import { createLafeaWorkbenchSourceState } from '../src/workspace/lafea-workbench-source-state.js';
import { triangleSource as shellFixture } from './lafea.4-fixtures.mjs';
import { workflowSource as trunnionFixture } from './lafea.5-fixtures.mjs';

const NEXT_SOURCE_HASH = `sha256:${'f'.repeat(64)}`;
const ROOT2 = Math.sqrt(0.5);
const fixtureByStage = { 'LAFEA.4': shellFixture, 'LAFEA.5': trunnionFixture };
const expectedCompilerBlock = {
  'LAFEA.4': 'LAFEA4_SHELL_SOLVER_CONSTRAINT_MAPPING_REQUIRED',
  'LAFEA.5': 'LAFEA5_SHELL_SOLVER_SOURCE_MESH_PARENT_REQUIRED',
};
const expectedRefinementBlock = {
  // LAFEA.4 now owns a deliberately bounded product-refinement route. This
  // planar fixture is outside that qualified surface envelope, so the product
  // scope must reject it before promotion/custody. LAFEA.5 still has no local
  // refinement product route and retains the generic stage-level rejection.
  'LAFEA.4': 'LAFEA4_SHELL_PRODUCT_REFINEMENT_SURFACE_NOT_QUALIFIED',
  'LAFEA.5': 'LAFEA_SHELL_LOCAL_REFINEMENT_NOT_QUALIFIED',
};
const rows = [];

for (const stageId of ['LAFEA.4', 'LAFEA.5']) {
  // Source authority is issued over the exact normalized document retained by
  // the workbench. A raw fixture hash is not a substitute for workbench source
  // authority because import normalization is part of the source boundary.
  const document = normalizeLafeaStageDocument(stageId, fixtureByStage[stageId]());
  const sourceAuthority = issueLafeaSourceAuthority(
    stageId, document, `P2-8-${stageId}-SOURCE-AUTHORITY`,
  );
  const sourceHash = sourceAuthority.sourceHash;
  const parent = shellParent(stageId, sourceHash);
  const profile = shellProfile(stageId, 30);
  const workbench = createLafeaWorkbenchOrchestratorStore({
    initialStage: stageId,
    initialDocument: document,
    initialSourceHash: sourceHash,
  });

  let stage = workbench.getState().stages[stageId];
  assert.equal(stage.lifecycleBinding.status, 'CURRENT');
  assert.equal(stage.lifecycle.source.sourceHash, sourceHash);

  const beforeParent = buildLafeaDiscretizationViewModel(stage);
  assert.equal(beforeParent.generation.available, false);
  assert.equal(
    beforeParent.generation.unavailableReason,
    'ANALYSIS_MESH_GENERATION_REQUIRES_SHELL_MIDSURFACE_EVIDENCE',
  );

  const registered = workbench.registerShellMidsurfaceEvidence(parent, stageId);
  assert.equal(registered?.changed, true);
  assert.equal(
    workbench.selectRetainedShellMidsurfaceEvidence(stageId)?.semanticHash,
    parent.semanticHash,
  );
  assert.equal(workbench.registerShellMidsurfaceEvidence(parent, stageId)?.changed, false);

  const bound = workbench.bindAnalysisMeshProfile(profile, stageId);
  assert.equal(bound?.changed, true);
  stage = workbench.getState().stages[stageId];
  assert.equal(stage.retainedAnalysisMeshProfile?.semanticHash, profile.semanticHash);

  const ready = buildLafeaDiscretizationViewModel(stage);
  assert.equal(ready.generation.available, true);
  assert.equal(ready.generation.declaredElementFamily, LAFEA_SHELL_ELEMENT);
  assert.equal(ready.generation.lengthUnit, 'mm');
  assert.equal(ready.actions.canPlanMesh, true);
  assert.equal(ready.actions.canGenerateMesh, true);

  const planned = workbench.planAnalysisMesh({}, stageId);
  assert.equal(planned?.summary.strategy, 'PLANAR_SHELL_MIDSURFACE_TRIANGULATION');
  assert.equal(planned?.summary.elementFamily, LAFEA_SHELL_ELEMENT);
  assert.equal(planned?.summary.estimatedDofs, planned?.summary.nodeCount * 5);

  const generated = workbench.generateAnalysisMesh({}, stageId);
  assert.equal(generated?.evidence.qualification, 'PASS');
  assert.equal(generated?.evidence.quality.shellOrientationTopology?.qualification, 'PASS');
  stage = workbench.getState().stages[stageId];
  assert.equal(stage.analysisMeshCustodyProjection.state, 'CURRENT_PASS');
  assert.equal(stage.analysisMeshCustodyProjection.usableForAdvance, true);
  assert.equal(stage.analysisMeshCustodyProjection.usableForAuthorization, true);
  assert.equal(stage.analysisMeshCustodyProjection.usableForRun, false);
  assert.equal(stage.shellSolverModelProjection.state, 'BLOCKED');
  assert.deepEqual(stage.shellSolverModelProjection.reasons, [expectedCompilerBlock[stageId]]);
  assert.deepEqual(stage.analysisMeshCustodyProjection.runBlockingReasons, [expectedCompilerBlock[stageId]]);
  assert.equal(stage.orchestration.sections.AUTHORIZATION.state, 'BLOCKED');
  assert.ok(stage.orchestration.sections.AUTHORIZATION.reasons.includes(expectedCompilerBlock[stageId]));

  const generatedVm = buildLafeaDiscretizationViewModel(stage);
  assert.equal(generatedVm.evidence.present, true);
  assert.equal(generatedVm.evidence.elementFamily, LAFEA_SHELL_ELEMENT);
  assert.equal(generatedVm.actions.canAdvance, true);
  assert.equal(generatedVm.actions.canRun, false);
  assert.equal(generatedVm.actions.manualRefinementEnabled, false);
  assert.equal(generatedVm.actions.canRefineMesh, false);
  const refineMode = generatedVm.configuration.modes.find((row) => row.mode === 'MANUAL_REFINEMENT');
  assert.equal(refineMode?.reason, 'SHELL_LOCAL_REFINEMENT_NOT_QUALIFIED');

  const retainedHash = workbench.selectRetainedAnalysisMeshEvidenceV2(stageId)?.artifactHash;
  const rejected = workbench.refineAnalysisMesh({
    targetType: 'ELEMENT',
    targetIds: ['E000001'],
    targetElementLength: 15,
    lengthUnit: 'mm',
  }, stageId);
  assert.equal(rejected, null);
  assert.equal(workbench.getState().diagnostics?.[0]?.code, expectedRefinementBlock[stageId]);
  assert.equal(workbench.selectRetainedAnalysisMeshEvidenceV2(stageId)?.artifactHash, retainedHash);

  // The compiler is intentionally bounded. This generic route is outside the
  // qualified mapping envelope and therefore must fail before legacy execution.
  const beforeRunExecution = workbench.getState().stages[stageId].execution ?? null;
  workbench.run();
  stage = workbench.getState().stages[stageId];
  assert.equal(workbench.getState().status, 'FAILED');
  assert.equal(workbench.getState().diagnostics?.[0]?.code, expectedCompilerBlock[stageId]);
  assert.deepEqual(stage.execution ?? null, beforeRunExecution);

  workbench.initializeLifecycle(NEXT_SOURCE_HASH, `P2-8-${stageId}-SOURCE-CHANGE`);
  stage = workbench.getState().stages[stageId];
  assert.equal(stage.lifecycleBinding.status, 'CURRENT');
  assert.equal(stage.lifecycle.source.sourceHash, NEXT_SOURCE_HASH);
  assert.equal(stage.shellMidsurfaceProfileActive, false);
  assert.equal(stage.retainedShellMidsurfaceEvidence, null);
  assert.equal(stage.retainedAnalysisMeshEvidenceV2, null);

  rows.push({
    stageId,
    artifactHash: retainedHash,
    nodeCount: generated.evidence.mesh.nodes.length,
    elementCount: generated.evidence.mesh.elements.length,
    meshRouteQualified: true,
    solverMeshBindingQualified: false,
    compilerBlock: expectedCompilerBlock[stageId],
    refinementBlock: expectedRefinementBlock[stageId],
    shellRunFailClosedOutsideCompilerEnvelope: true,
    shellLocalRefinementQualified: false,
    sourceChangeInvalidatesParentAndChild: true,
  });
  workbench.destroy();
}

// A lifecycle source hash is not permission to rewrite source authority. The
// source-state layer must reject a lifecycle hash that does not bind the exact
// normalized retained document.
const mismatchDocument = normalizeLafeaStageDocument('LAFEA.4', shellFixture());
const mismatchedLifecycleHash = `sha256:${'e'.repeat(64)}`;
const mismatchSourceState = createLafeaWorkbenchSourceState(['LAFEA.4'], {
  getRetainedState: () => ({
    stages: {
      'LAFEA.4': {
        document: mismatchDocument,
        lifecycle: { source: { sourceHash: mismatchedLifecycleHash } },
      },
    },
  }),
  getActiveStageId: () => 'LAFEA.4',
  invokeRetained: () => {
    throw new Error('Mismatched lifecycle authority must fail before retained lifecycle mutation.');
  },
});
assert.throws(
  () => mismatchSourceState.ensureRunAuthority('LAFEA.4', 'P2-8-SOURCE-MISMATCH-NEGATIVE'),
  (error) => error?.code === 'LAFEA_WORKBENCH_SOURCE_LIFECYCLE_HASH_MISMATCH',
);

console.log(JSON.stringify({
  schema: 'lafea-shell-workbench-route-check/v4',
  status: 'PASS',
  rows,
  sourceAuthority: {
    normalizedDocumentBound: true,
    mismatchedLifecycleHashRejected: true,
    lifecycleHashSubstitutionAllowed: false,
  },
  compilerEnvelope: {
    lafea4: 'WHOLE_SURFACE_UNIFORM_REGION_TRANSFER_ONLY',
    lafea5: 'LOSSLESS_SOURCE_MESH_PARENT_ONLY',
  },
  exclusions: [
    'GENERAL_NODAL_LOAD_TRANSFER',
    'PARTIAL_BOUNDARY_CONSTRAINT_TRANSFER',
    'PARTIAL_SURFACE_PRESSURE_TRANSFER',
    'SHELL_LOCAL_REFINEMENT',
  ],
}, null, 2));

function shellParent(stageId, sourceHash) {
  const geometry = createLafeaShellMidsurfaceGeometry({
    schema: LAFEA_SHELL_MIDSURFACE_GEOMETRY_SCHEMA,
    stageId,
    geometryId: `P2-8-${stageId}-TILTED-PLATE`,
    lengthUnit: 'mm',
    origin: { x: 10, y: -20, z: 30 },
    axisU: { x: ROOT2, y: ROOT2, z: 0 },
    axisV: { x: 0, y: 0, z: 1 },
    orientationPolicy: LAFEA_SHELL_MIDSURFACE_ORIENTATION,
    vertices: [
      { vertexId: 'V1', u: 0, v: 0 },
      { vertexId: 'V2', u: 200, v: 0 },
      { vertexId: 'V3', u: 200, v: 120 },
      { vertexId: 'V4', u: 0, v: 120 },
    ],
    segments: [
      { segmentId: 'S1', startVertexId: 'V1', endVertexId: 'V2' },
      { segmentId: 'S2', startVertexId: 'V2', endVertexId: 'V3' },
      { segmentId: 'S3', startVertexId: 'V3', endVertexId: 'V4' },
      { segmentId: 'S4', startVertexId: 'V4', endVertexId: 'V1' },
    ],
    loops: [{ loopId: 'OUTER', role: 'OUTER', segmentIds: ['S1', 'S2', 'S3', 'S4'] }],
  });
  const domain = createLafeaShellAnalysisDomain({
    schema: LAFEA_SHELL_ANALYSIS_DOMAIN_SCHEMA,
    stageId,
    domainId: `P2-8-${stageId}-DOMAIN`,
    sourceHash,
    midsurfaceGeometryHash: geometry.semanticHash,
    lengthUnit: 'mm',
    topologyClass: LAFEA_SHELL_MIDSURFACE_TOPOLOGY,
  });
  return createLafeaShellMidsurfaceEvidence({
    schema: LAFEA_SHELL_MIDSURFACE_INTAKE_SCHEMA,
    stageId,
    sourceHash,
    analysisDomain: domain,
    geometry,
    producerRef: 'P2-8-DECLARED-MIDSURFACE',
  });
}

function shellProfile(stageId, globalTargetSize) {
  return canonicalProfile(PROFILE_KINDS.MESH, {
    schema: 'lafea-mesh-profile/v1',
    profileIdentity: `P2_8_${stageId.replace('.', '_')}_SHELL_${globalTargetSize}`,
    sourceRevision: 'R9',
    semanticHash: undefined,
    fields: {
      continuumElement: 'T3',
      shellElement: LAFEA_SHELL_ELEMENT,
      globalTargetSize,
      adjacentSizeRatioMax: 1.5,
      aspectRatioWarn: 3,
      aspectRatioBlock: 10,
      scaledJacobianWarn: 0.6,
      scaledJacobianBlock: 0.2,
      adaptiveLevels: 3,
    },
  });
}
