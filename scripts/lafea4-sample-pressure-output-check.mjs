#!/usr/bin/env node
import assert from 'node:assert/strict';

import { PROFILE_KINDS, canonicalProfile } from '../src/core/lafea-profile-contract/index.js';
import {
  LAFEA4_SAMPLE_PRESSURE_MPA,
  LAFEA4_SAMPLE_PRESSURE_SENSE,
} from './lafea.4-fixtures.mjs';
import {
  createLafeaMockDocument,
} from '../src/workspace/lafea-simulated-source-provider.js';
import { presentLafeaResult, resolveLafeaUnits } from '../src/workspace/lafea-result-presenters/index.js';
import { issueLafeaSourceAuthority } from '../src/workspace/lafea-source-authority.js';
import { createLafeaSimulatedShellMidsurfaceEvidence } from '../src/workspace/lafea-simulated-shell-midsurface-provider.js';
import { requireLafeaStageComposition } from '../src/workspace/lafea-stage-composition-root.js';
import { createLafeaWorkbenchOrchestratorStore } from '../src/workspace/lafea-workbench-orchestrator-store.js';

const STAGE_ID = 'LAFEA.4';
const SHELL_ELEMENT = 'CST_DKT_TRI3_THIN_SHELL_V1';
const SHELL_ROUTE = 'SHELL_RETAINED_MESH_COMPILED_SOLVER_MODEL';
const source = await createLafeaMockDocument(STAGE_ID);
assert.equal(source.modelIdentity, 'CYLINDRICAL_PIPE_SHELL_BENCHMARK');
assert.equal(source.nodes.length, 26);
assert.equal(source.elements.length, 24);
assert.equal(source.loadCases.length, 1);
const sourcePressure = source.loadCases[0];
assert.equal(sourcePressure.loadCaseId, 'PRESSURE');
assert.deepEqual(sourcePressure.nodalLoads, []);
assert.equal(sourcePressure.pressureLoads.length, source.elements.length);
assert.deepEqual(
  [...new Set(sourcePressure.pressureLoads.map((row) => row.pressure))],
  [LAFEA4_SAMPLE_PRESSURE_MPA],
);
assert.deepEqual(
  [...new Set(sourcePressure.pressureLoads.map((row) => row.sense))],
  [LAFEA4_SAMPLE_PRESSURE_SENSE],
);
assert.deepEqual(
  [...sourcePressure.pressureLoads.map((row) => row.elementId)].sort(),
  [...source.elements.map((row) => row.elementId)].sort(),
);

const composition = requireLafeaStageComposition(STAGE_ID);
const normalized = composition.normalizeDocument(source);
assert.equal(normalized.loadCases[0].pressureLoads.length, normalized.elements.length);
const authority = issueLafeaSourceAuthority(
  STAGE_ID,
  normalized,
  'ISSUE-1371/PR-C/SAMPLE-PRESSURE-OUTPUT',
);
const parent = createLafeaSimulatedShellMidsurfaceEvidence(
  STAGE_ID,
  authority.sourceHash,
  normalized,
);
assert.equal(parent.qualification, 'PASS');
assert.equal(parent.geometry.surface.kind, 'CYLINDER');
assert.equal(parent.geometry.surface.radius, 100);

const profile = canonicalProfile(PROFILE_KINDS.MESH, {
  schema: 'lafea-mesh-profile/v1',
  profileIdentity: 'ISSUE_1371_LAFEA4_SAMPLE_SHELL_15',
  sourceRevision: 'ISSUE-1371-PR-C',
  semanticHash: undefined,
  fields: {
    continuumElement: 'T3',
    shellElement: SHELL_ELEMENT,
    globalTargetSize: 15,
    adjacentSizeRatioMax: 1.5,
    aspectRatioWarn: 3,
    aspectRatioBlock: 10,
    scaledJacobianWarn: 0.6,
    scaledJacobianBlock: 0.2,
    adaptiveLevels: 3,
  },
});
const workbench = createLafeaWorkbenchOrchestratorStore({
  initialStage: STAGE_ID,
  initialDocument: normalized,
  initialSourceHash: authority.sourceHash,
});

try {
  assert.equal(workbench.registerShellMidsurfaceEvidence(parent, STAGE_ID)?.changed, true);
  assert.equal(workbench.bindAnalysisMeshProfile(profile, STAGE_ID)?.changed, true);
  const generated = workbench.generateAnalysisMesh({}, STAGE_ID);
  assert.equal(generated?.evidence?.qualification, 'PASS');
  assert.equal(generated.evidence.quality.shellOrientationTopology?.qualification, 'PASS');

  let stage = workbench.getState().stages[STAGE_ID];
  assert.equal(stage.analysisMeshCustodyProjection.state, 'CURRENT_PASS');
  assert.equal(stage.analysisMeshCustodyProjection.usableForRun, true);
  assert.equal(stage.shellSolverModelProjection.state, 'CURRENT_PASS');
  assert.equal(stage.shellSolverModelProjection.usableForRun, true);
  assert.equal(stage.shellSolverModelProjection.meshHash, generated.evidence.meshHash);
  assert.equal(stage.orchestration.sections.AUTHORIZATION.state, 'READY');
  workbench.run();

  stage = workbench.getState().stages[STAGE_ID];
  assert.equal(stage.execution?.status, 'QUALIFIED');
  assert.equal(stage.execution?.route, SHELL_ROUTE);
  assert.equal(stage.execution?.meshHash, generated.evidence.meshHash);
  assert.equal(stage.execution?.solverModelHash, stage.shellSolverModelProjection.solverModelHash);
  assert.equal(stage.lifecycle.artifacts.ANALYSIS_MESH?.artifactHash, generated.evidence.meshHash);
  assert.equal(stage.lifecycle.artifacts.EXECUTION?.artifactHash, stage.execution.compiledExecutionHash);
  assert.equal(stage.lifecycle.artifacts.RECOVERY?.status, 'CURRENT');
  assert.equal(stage.lifecycle.artifacts.RECOVERY?.qualification, 'PASS');
  assert.equal(stage.lifecycleReadiness.calculationState, 'CALCULATION_ACCEPTED_BY_STAGE_CONTRACT');
  assert.equal(stage.lifecycleReadiness.resultReady, true);

  const result = stage.execution.result;
  assert.equal(result.qualification?.accepted, true);
  const loadCase = result.loadCaseResults.find((row) => row.loadCaseId === 'PRESSURE');
  assert.ok(loadCase);
  assert.equal(loadCase.forceEquilibrium.qualification.accepted, true);
  assert.equal(loadCase.momentEquilibrium.qualification.accepted, true);
  assert.equal(
    loadCase.appliedLoadEvidence.contributions.length,
    generated.evidence.mesh.elements.length,
    'Whole-surface Sample pressure must compile onto every retained solver element.',
  );
  assert.ok(Math.hypot(...loadCase.appliedLoadEvidence.appliedForce) > 0);
  assert.ok(loadCase.reactions.some((row) => row.kind === 'FORCE' && Math.abs(row.value) > 0));
  assert.equal(
    loadCase.appliedLoadEvidence.contributions.every(
      (row) => row.type === 'UNIFORM_ELEMENT_NORMAL_PRESSURE'
        && row.pressure === LAFEA4_SAMPLE_PRESSURE_MPA
        && row.sense === LAFEA4_SAMPLE_PRESSURE_SENSE,
    ),
    true,
  );

  const presentation = presentLafeaResult(
    STAGE_ID,
    result,
    resolveLafeaUnits(STAGE_ID, normalized),
  );
  assert.equal(presentation.sections[0].title, 'Engineering summary — CST+DKT thin-shell retained evidence');
  const summary = presentation.sections[0].rows;
  assert.ok(summary.some((row) => row.label.startsWith('Max translational displacement magnitude')));
  assert.ok(summary.some((row) => row.label.startsWith('Max authoritative surface/IP von Mises')));
  assert.ok(summary.some((row) => row.label.startsWith('Max |combined surface sigmaX|')));
  assert.ok(summary.some((row) => row.label.startsWith('Max translational reaction component') && row.value > 0));
  assert.ok(summary.some((row) => row.label.includes('Force equilibrium residual · PASS')));
  assert.ok(summary.some((row) => row.label.includes('Moment equilibrium residual · PASS')));
  assert.ok(summary.some((row) => row.label.startsWith('Max applied force resultant magnitude') && row.value > 0));
  assert.ok(presentation.governing?.sourcePath?.includes('.integrationPoints['));
  assert.ok(presentation.governing?.sourcePath?.includes('.surfaces['));
  assert.ok(result.limitations.includes('NO_NODAL_STRESS'));
  assert.ok(result.limitations.includes('NO_STRESS_AVERAGING_OR_SMOOTHING'));
  assert.ok(result.limitations.includes('NO_CONTOUR_AUTHORITY'));

  console.log(JSON.stringify({
    schema: 'lafea4-sample-pressure-output-check/v1',
    status: 'PASS',
    sourceHash: authority.sourceHash,
    sourcePressureMpa: LAFEA4_SAMPLE_PRESSURE_MPA,
    sourcePressureSense: LAFEA4_SAMPLE_PRESSURE_SENSE,
    sourcePressureElementCount: sourcePressure.pressureLoads.length,
    retainedMeshHash: generated.evidence.meshHash,
    retainedNodeCount: generated.evidence.mesh.nodes.length,
    retainedElementCount: generated.evidence.mesh.elements.length,
    solverModelHash: stage.execution.solverModelHash,
    compiledExecutionHash: stage.execution.compiledExecutionHash,
    recoveryStatus: stage.lifecycle.artifacts.RECOVERY.status,
    appliedForce: loadCase.appliedLoadEvidence.appliedForce,
    appliedMomentAboutOrigin: loadCase.appliedLoadEvidence.appliedMomentAboutOrigin,
    forceEquilibriumAccepted: loadCase.forceEquilibrium.qualification.accepted,
    momentEquilibriumAccepted: loadCase.momentEquilibrium.qualification.accepted,
    shellEngineeringSummary: true,
    stressAuthority: 'RETAINED_INTEGRATION_POINT_SURFACE',
    nodalStressAuthority: false,
    contourAuthority: false,
    releaseQualified: false,
  }, null, 2));
} finally {
  workbench.destroy();
}
