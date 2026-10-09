#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  PROFILE_KINDS,
  canonicalProfile,
} from '../src/core/lafea-profile-contract/index.js';
import { calculateLocalShell } from '../src/core/local-shell/index.js';
import { calculateLocalTrunnionFootprint } from '../src/core/local-trunnion-footprint/index.js';
import { createLafeaMockDocument } from '../src/workspace/advanced-mock-data.js';
import { issueLafeaSourceAuthority } from '../src/workspace/lafea-source-authority.js';
import { createLafeaSimulatedShellMidsurfaceEvidence } from '../src/workspace/lafea-simulated-shell-midsurface-provider.js';
import { produceLafeaShellAnalysisMesh } from '../src/workspace/lafea-shell-mesh-producer.js';
import {
  createLafea5SourceShellParent,
  planLafea5SourceShellMeshAdoption,
  produceLafea5SourceShellMeshAdoption,
} from '../src/workspace/lafea-source-shell-mesh-adoption.js';
import { compileLafeaShellSolverModel } from '../src/workspace/lafea-shell-solver-model.js';
import { normalizeLafeaStageDocument } from '../src/workspace/lafea-workbench-model.js';
import { createLafeaWorkbenchOrchestratorStore } from '../src/workspace/lafea-workbench-orchestrator-store.js';

const SHELL_ELEMENT = 'CST_DKT_TRI3_THIN_SHELL_V1';
const SHELL_ROUTE = 'SHELL_RETAINED_MESH_COMPILED_SOLVER_MODEL';

// ---------------------------------------------------------------------------
// LAFEA.4: nontrivial retained-mesh pressure solve.
// ---------------------------------------------------------------------------
const lafea4 = structuredClone(createLafeaMockDocument('LAFEA.4'));
lafea4.loadCases = [{
  loadCaseId: 'PRESSURE',
  nodalLoads: [],
  pressureLoads: lafea4.elements.map((element, index) => ({
    pressureLoadId: `P-${index + 1}`,
    elementId: element.elementId,
    pressure: 1.2,
    sense: 'ALONG_ELEMENT_NORMAL',
    sourceReference: `COMPILED-PRESSURE-${index + 1}`,
  })),
  sourceReference: 'COMPILED-PRESSURE-CASE',
}];
const authority4 = issueLafeaSourceAuthority(
  'LAFEA.4', lafea4, 'SHELL-COMPILED-CHECK/LAFEA4',
);
const parent4 = createLafeaSimulatedShellMidsurfaceEvidence(
  'LAFEA.4', authority4.sourceHash, lafea4,
);
const profile4 = shellProfile('LAFEA.4', 15);
const produced4 = produceLafeaShellAnalysisMesh({
  midsurfaceEvidence: parent4,
  meshProfile: profile4,
});
assert.equal(produced4.evidence.qualification, 'PASS');
assert.equal(produced4.evidence.quality.shellOrientationTopology?.qualification, 'PASS');
const compiled4 = compileLafeaShellSolverModel({
  stageId: 'LAFEA.4',
  sourceHash: authority4.sourceHash,
  source: lafea4,
  midsurfaceEvidence: parent4,
  meshEvidence: produced4.evidence,
});
assert.equal(compiled4.status, 'COMPILED');
assert.equal(compiled4.parents.meshHash, produced4.evidence.meshHash);
assert.equal(compiled4.mappingMode, 'PARAMETRIC_MIDSURFACE_UNIFORM_REGION_TRANSFER_V1');
assert.equal(compiled4.canonicalShellModel.nodes.length, produced4.evidence.mesh.nodes.length);
assert.equal(compiled4.canonicalShellModel.elements.length, produced4.evidence.mesh.elements.length);
assert.equal(
  compiled4.canonicalShellModel.loadCases[0].pressureLoads.length,
  produced4.evidence.mesh.elements.length,
);
const result4 = calculateLocalShell(compiled4.canonicalShellModel);
assert.equal(result4.qualification.accepted, true, result4.qualification.summary);
assert.equal(result4.canonicalModelSemanticHash, compiled4.kernelModelHash);
const pressureCase4 = result4.loadCaseResults.find((row) => row.loadCaseId === 'PRESSURE');
assert.ok(pressureCase4);
assert.equal(pressureCase4.forceEquilibrium.qualification.accepted, true);
assert.equal(pressureCase4.momentEquilibrium.qualification.accepted, true);
assert.ok(pressureCase4.appliedLoadEvidence.contributions.length > 0);
assert.ok(
  pressureCase4.appliedLoadEvidence.contributions.some(
    (row) => Math.hypot(...row.totalForce) > 0,
  ),
  'Nontrivial pressure benchmark must retain nonzero compiled surface loading.',
);

// Unsupported source-node loads must remain fail-closed after remeshing.
const nodalLoad4 = structuredClone(lafea4);
nodalLoad4.loadCases = [{
  loadCaseId: 'UNMAPPED-NODAL',
  nodalLoads: [{
    loadId: 'F-UNMAPPED',
    nodeId: nodalLoad4.nodes[0].nodeId,
    fx: 10, fy: 0, fz: 0, m1: 0, m2: 0,
    sourceReference: 'UNMAPPED-NODAL-SOURCE',
  }],
  pressureLoads: [],
  sourceReference: 'UNMAPPED-NODAL-CASE',
}];
const nodalAuthority4 = issueLafeaSourceAuthority(
  'LAFEA.4', nodalLoad4, 'SHELL-COMPILED-CHECK/LAFEA4-NODAL-NEGATIVE',
);
const nodalParent4 = createLafeaSimulatedShellMidsurfaceEvidence(
  'LAFEA.4', nodalAuthority4.sourceHash, nodalLoad4,
);
const nodalProduced4 = produceLafeaShellAnalysisMesh({
  midsurfaceEvidence: nodalParent4,
  meshProfile: shellProfile('LAFEA.4', 15, 'NODAL-NEGATIVE'),
});
assert.throws(
  () => compileLafeaShellSolverModel({
    stageId: 'LAFEA.4',
    sourceHash: nodalAuthority4.sourceHash,
    source: nodalLoad4,
    midsurfaceEvidence: nodalParent4,
    meshEvidence: nodalProduced4.evidence,
  }),
  (error) => error?.code === 'LAFEA4_SHELL_SOLVER_NODAL_LOAD_MAPPING_REQUIRED',
  'A remeshed LAFEA.4 model must reject source-node loads until a qualified load-transfer rule exists.',
);

// R1/R2 are node-local tangent-basis rotations. A nonzero scalar cannot be
// copied onto a remeshed node whose tangent basis differs; only zero is
// invariant without a separately qualified rotational field map.
const rotated4 = structuredClone(lafea4);
for (const row of rotated4.constraints) {
  if (row.dof === 'R1') row.value = 0.01;
}
const rotatedAuthority4 = issueLafeaSourceAuthority(
  'LAFEA.4', rotated4, 'SHELL-COMPILED-CHECK/LAFEA4-ROTATION-NEGATIVE',
);
const rotatedParent4 = createLafeaSimulatedShellMidsurfaceEvidence(
  'LAFEA.4', rotatedAuthority4.sourceHash, rotated4,
);
const rotatedProduced4 = produceLafeaShellAnalysisMesh({
  midsurfaceEvidence: rotatedParent4,
  meshProfile: shellProfile('LAFEA.4', 15, 'ROTATION-NEGATIVE'),
});
assert.throws(
  () => compileLafeaShellSolverModel({
    stageId: 'LAFEA.4',
    sourceHash: rotatedAuthority4.sourceHash,
    source: rotated4,
    midsurfaceEvidence: rotatedParent4,
    meshEvidence: rotatedProduced4.evidence,
  }),
  (error) => error?.code === 'LAFEA4_SHELL_SOLVER_NONZERO_LOCAL_ROTATION_MAPPING_REQUIRED',
  'Nonzero local R1/R2 prescriptions must remain blocked until a qualified field mapping exists.',
);

// ---------------------------------------------------------------------------
// LAFEA.5: exact caller-authored source shell stays under trunnion workflow.
// ---------------------------------------------------------------------------
const lafea5 = structuredClone(createLafeaMockDocument('LAFEA.5'));
const authority5 = issueLafeaSourceAuthority(
  'LAFEA.5', lafea5, 'SHELL-COMPILED-CHECK/LAFEA5',
);
const parent5 = createLafea5SourceShellParent({
  sourceHash: authority5.sourceHash,
  shellTemplate: lafea5.shellTemplate,
});
const profile5 = shellProfile('LAFEA.5', 15);
const plan5 = planLafea5SourceShellMeshAdoption({ parent: parent5, meshProfile: profile5 });
const produced5 = produceLafea5SourceShellMeshAdoption({
  parent: parent5,
  meshProfile: profile5,
  plan: plan5,
});
const compiled5 = compileLafeaShellSolverModel({
  stageId: 'LAFEA.5',
  sourceHash: authority5.sourceHash,
  source: lafea5,
  midsurfaceEvidence: parent5,
  meshEvidence: produced5.evidence,
});
assert.equal(compiled5.status, 'COMPILED');
assert.equal(compiled5.mappingMode, 'LOSSLESS_TRUNNION_SOURCE_SHELL_BINDING_V1');
assert.equal(compiled5.parents.meshHash, produced5.evidence.meshHash);
assert.equal(compiled5.transferEvidence.nodeCoordinateMutation, false);
assert.equal(compiled5.transferEvidence.connectivityMutation, false);
const result5 = calculateLocalTrunnionFootprint(compiled5.canonicalInput);
assert.equal(result5.qualification.accepted, true, result5.qualification.summary);
assert.equal(result5.canonicalWorkflowModelHash, compiled5.kernelModelHash);
assertGeneratedShellMatchesRetained(produced5.evidence.mesh, result5.generatedShellModel);
assert.ok(result5.loadDistributionEvidence.length > 0);
assert.ok(result5.rawShellResult?.loadCaseResults?.length > 0);

// ---------------------------------------------------------------------------
// Product route: rebuild the source chain from the exact normalized document
// retained by the workbench, then prove mesh -> compiler -> execution custody.
// ---------------------------------------------------------------------------
const workbenchDocument4 = normalizeLafeaStageDocument('LAFEA.4', lafea4);
const workbenchAuthority4 = issueLafeaSourceAuthority(
  'LAFEA.4', workbenchDocument4, 'SHELL-COMPILED-CHECK/LAFEA4-WORKBENCH',
);
const workbenchParent4 = createLafeaSimulatedShellMidsurfaceEvidence(
  'LAFEA.4', workbenchAuthority4.sourceHash, workbenchDocument4,
);
const workbenchProduced4 = produceLafeaShellAnalysisMesh({
  midsurfaceEvidence: workbenchParent4,
  meshProfile: profile4,
});
const workbenchCompiled4 = compileLafeaShellSolverModel({
  stageId: 'LAFEA.4',
  sourceHash: workbenchAuthority4.sourceHash,
  source: workbenchDocument4,
  midsurfaceEvidence: workbenchParent4,
  meshEvidence: workbenchProduced4.evidence,
});
const workbench4 = createLafeaWorkbenchOrchestratorStore({
  initialStage: 'LAFEA.4',
  initialDocument: workbenchDocument4,
  initialSourceHash: workbenchAuthority4.sourceHash,
});
qualifyAndRunWorkbench(workbench4, 'LAFEA.4', workbenchParent4, profile4, 'AUTOMATIC');
const workbenchState4 = workbench4.getState().stages['LAFEA.4'];
assertWorkbenchExecutionBinding(workbenchState4, workbenchProduced4.evidence.mesh.nodes.length);
assert.equal(workbenchState4.execution.solverModelHash, workbenchCompiled4.solverModelHash);
assert.equal(
  workbenchState4.execution.result.canonicalModelSemanticHash,
  workbenchCompiled4.kernelModelHash,
);
assert.equal(workbenchState4.execution.result.loadCaseResults[0].forceEquilibrium.qualification.accepted, true);
assert.ok(
  workbenchState4.execution.result.loadCaseResults[0].appliedLoadEvidence.contributions.some(
    (row) => Math.hypot(...row.totalForce) > 0,
  ),
);
workbench4.destroy();

const workbenchDocument5 = normalizeLafeaStageDocument('LAFEA.5', lafea5);
const workbenchAuthority5 = issueLafeaSourceAuthority(
  'LAFEA.5', workbenchDocument5, 'SHELL-COMPILED-CHECK/LAFEA5-WORKBENCH',
);
const workbenchParent5 = createLafea5SourceShellParent({
  sourceHash: workbenchAuthority5.sourceHash,
  shellTemplate: workbenchDocument5.shellTemplate,
});
const workbenchPlan5 = planLafea5SourceShellMeshAdoption({
  parent: workbenchParent5,
  meshProfile: profile5,
});
const workbenchProduced5 = produceLafea5SourceShellMeshAdoption({
  parent: workbenchParent5,
  meshProfile: profile5,
  plan: workbenchPlan5,
});
const workbenchCompiled5 = compileLafeaShellSolverModel({
  stageId: 'LAFEA.5',
  sourceHash: workbenchAuthority5.sourceHash,
  source: workbenchDocument5,
  midsurfaceEvidence: workbenchParent5,
  meshEvidence: workbenchProduced5.evidence,
});
const workbench5 = createLafeaWorkbenchOrchestratorStore({
  initialStage: 'LAFEA.5',
  initialDocument: workbenchDocument5,
  initialSourceHash: workbenchAuthority5.sourceHash,
});
qualifyAndRunWorkbench(
  workbench5, 'LAFEA.5', workbenchParent5, profile5, 'SOURCE_MESH_ADOPTION',
);
const workbenchState5 = workbench5.getState().stages['LAFEA.5'];
assertWorkbenchExecutionBinding(workbenchState5, workbenchProduced5.evidence.mesh.nodes.length);
assert.equal(workbenchState5.execution.solverModelHash, workbenchCompiled5.solverModelHash);
assert.equal(
  workbenchState5.execution.result.canonicalWorkflowModelHash,
  workbenchCompiled5.kernelModelHash,
);
assertGeneratedShellMatchesRetained(
  workbenchState5.retainedAnalysisMeshEvidenceV2.mesh,
  workbenchState5.execution.result.generatedShellModel,
);
workbench5.destroy();

console.log(JSON.stringify({
  schema: 'lafea-shell-compiled-execution-check/v3',
  status: 'PASS',
  lafea4: {
    sourceElements: lafea4.elements.length,
    retainedNodes: produced4.evidence.mesh.nodes.length,
    retainedElements: produced4.evidence.mesh.elements.length,
    solverModelHash: compiled4.solverModelHash,
    solverModelBindingHash: compiled4.solverModelBindingHash,
    resultKernelModelHash: result4.canonicalModelSemanticHash,
    pressureContributionCount: pressureCase4.appliedLoadEvidence.contributions.length,
    forceEquilibrium: pressureCase4.forceEquilibrium.qualification.accepted,
    momentEquilibrium: pressureCase4.momentEquilibrium.qualification.accepted,
    unsupportedNodalLoadRejected: true,
    unsupportedNonzeroLocalRotationRejected: true,
    normalizedWorkbenchSourceHash: workbenchAuthority4.sourceHash,
    authoritativeWorkbenchExecutionBoundToRetainedMesh: true,
  },
  lafea5: {
    retainedNodes: produced5.evidence.mesh.nodes.length,
    retainedElements: produced5.evidence.mesh.elements.length,
    solverModelHash: compiled5.solverModelHash,
    solverModelBindingHash: compiled5.solverModelBindingHash,
    canonicalWorkflowModelHash: result5.canonicalWorkflowModelHash,
    generatedShellModelHash: result5.canonicalShellModelHash,
    workflowLoadCaseCount: result5.loadDistributionEvidence.length,
    normalizedWorkbenchSourceHash: workbenchAuthority5.sourceHash,
    losslessRetainedMeshExecutionBinding: true,
    authoritativeWorkbenchExecutionBoundToRetainedMesh: true,
  },
}, null, 2));

function qualifyAndRunWorkbench(workbench, stageId, parent, profile, expectedMode) {
  assert.equal(workbench.registerShellMidsurfaceEvidence(parent, stageId)?.changed, true);
  assert.equal(workbench.bindAnalysisMeshProfile(profile, stageId)?.changed, true);
  const generated = workbench.generateAnalysisMesh({}, stageId);
  assert.equal(generated?.evidence?.qualification, 'PASS');
  let stage = workbench.getState().stages[stageId];
  assert.equal(stage.shellSolverModelProjection.state, 'CURRENT_PASS');
  assert.equal(stage.shellSolverModelProjection.usableForRun, true);
  assert.equal(stage.analysisMeshCustodyProjection.usableForRun, true);
  assert.equal(stage.analysisMeshCustodyProjection.meshHash, generated.evidence.meshHash);
  assert.equal(stage.analysisMeshCustodyProjection.solverModelHash, stage.shellSolverModelProjection.solverModelHash);
  assert.equal(stage.orchestration.sections.AUTHORIZATION.state, 'READY');
  assert.ok(stage.orchestration.sections.EXECUTION.allowedActions.includes('RUN_SOLVE'));
  assert.equal(
    stageId === 'LAFEA.5' ? generated.plan.generationMode : 'AUTOMATIC',
    expectedMode,
  );
  workbench.run();
  assert.notEqual(workbench.getState().status, 'FAILED', workbench.getState().diagnostics?.[0]?.code);
  stage = workbench.getState().stages[stageId];
  assert.equal(stage.execution?.status, 'QUALIFIED');
  assert.equal(stage.execution?.route, SHELL_ROUTE);
  assert.equal(stage.execution?.meshHash, generated.evidence.meshHash);
  assert.equal(stage.execution?.solverModelHash, stage.shellSolverModelProjection.solverModelHash);
  assert.equal(stage.execution?.solverModelBindingHash, stage.shellSolverModelProjection.solverModelBindingHash);
  assert.equal(stage.lifecycle.artifacts.ANALYSIS_MESH?.artifactHash, generated.evidence.meshHash);
  assert.equal(stage.lifecycle.artifacts.EXECUTION?.artifactHash, stage.execution.compiledExecutionHash);
  assert.equal(stage.lifecycle.artifacts.RECOVERY?.status, 'CURRENT');
  assert.equal(stage.lifecycle.artifacts.RECOVERY?.qualification, 'PASS');
  assert.equal(stage.lifecycleReadiness.calculationState, 'CALCULATION_ACCEPTED_BY_STAGE_CONTRACT');
  assert.equal(stage.lifecycleReadiness.resultReady, true);
  assert.equal(stage.orchestration.sections.EXECUTION.state, 'COMPLETE');
  assert.equal(stage.orchestration.sections.RESULTS.state, 'COMPLETE');
}

function assertWorkbenchExecutionBinding(stage, minimumNodeCount) {
  assert.equal(stage.analysisMeshCustodyProjection.state, 'CURRENT_PASS');
  assert.equal(stage.analysisMeshCustodyProjection.usableForRun, true);
  assert.ok(stage.retainedAnalysisMeshEvidenceV2.mesh.nodes.length >= minimumNodeCount);
  assert.equal(stage.execution.meshHash, stage.retainedAnalysisMeshEvidenceV2.meshHash);
  assert.equal(stage.execution.meshHash, stage.lifecycle.artifacts.ANALYSIS_MESH.artifactHash);
  assert.equal(stage.execution.solverModelHash, stage.shellSolverModelProjection.solverModelHash);
  assert.equal(
    stage.execution.solverModelBindingHash,
    stage.shellSolverModelProjection.solverModelBindingHash,
  );
  assert.match(stage.execution.executionMeshBindingHash, /^sha256:[0-9a-f]{64}$/u);
}

function shellProfile(stageId, target, suffix = 'QUALIFIED') {
  return canonicalProfile(PROFILE_KINDS.MESH, {
    schema: 'lafea-mesh-profile/v1',
    profileIdentity: `SHELL_COMPILED_${stageId.replace('.', '_')}_${suffix}`,
    sourceRevision: 'SHELL-COMPILED-CHECK-V3',
    semanticHash: undefined,
    fields: {
      continuumElement: 'T3',
      shellElement: SHELL_ELEMENT,
      globalTargetSize: target,
      adjacentSizeRatioMax: 1.5,
      aspectRatioWarn: 3,
      aspectRatioBlock: 10,
      scaledJacobianWarn: 0.6,
      scaledJacobianBlock: 0.2,
      adaptiveLevels: 3,
    },
  });
}

function assertGeneratedShellMatchesRetained(retained, generated) {
  assert.ok(generated);
  assert.equal(generated.nodes.length, retained.nodes.length);
  assert.equal(generated.elements.length, retained.elements.length);
  const nodeById = new Map(generated.nodes.map((row) => [row.nodeId, row]));
  for (const node of retained.nodes) {
    assert.deepEqual(nodeById.get(node.nodeId)?.position, [node.x, node.y, node.z]);
  }
  const elementById = new Map(generated.elements.map((row) => [row.elementId, row]));
  for (const element of retained.elements) {
    assert.deepEqual(
      [...elementById.get(element.elementId).nodeIds].sort(),
      [...element.nodeIds].sort(),
    );
  }
}
