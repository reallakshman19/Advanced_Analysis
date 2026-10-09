#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { buildLafeaWorkflowAreaPresentation } from '../src/workspace/lafea-guided-workflow-presentation.js';

const steps = Object.freeze([
  step('SOURCE_IDENTITY', 'Source and model identity', 'COMPLETE'),
  step('MODEL_DIAGNOSTICS', 'Model diagnostics', 'BLOCKED', ['STAGE_ENGINE_NOT_IMPLEMENTED']),
  step('ANALYSIS_PROFILE', 'Analysis profile', 'COMPLETE'),
  step('MATERIALS_SECTIONS', 'Materials and sections', 'READY'),
  step('RESTRAINTS_BCS', 'Restraints and boundary conditions', 'COMPLETE'),
  step('LOADS_CASES', 'Loads and physical cases', 'READY'),
  step('DISCRETIZATION', 'Discretization / analysis mesh', 'COMPLETE', ['WORKFLOW_STEP_NOT_APPLICABLE']),
  step('NUMERICAL_PREFLIGHT', 'Numerical preflight', 'BLOCKED', ['STAGE_ENGINE_NOT_IMPLEMENTED']),
  step('AUTHORIZATION', 'Authorization', 'BLOCKED', ['STAGE_ENGINE_NOT_IMPLEMENTED']),
  step('RUN', 'Run', 'BLOCKED', ['UNSUPPORTED_STAGE_ENGINE_NOT_IMPLEMENTED']),
  step('CONVERGENCE', 'Convergence', 'BLOCKED', ['UNSUPPORTED_STAGE_ENGINE_NOT_IMPLEMENTED']),
  step('RESULTS_EVIDENCE', 'Results and evidence', 'BLOCKED', ['EXECUTION_REQUIRED']),
]);

const unsupported = Object.freeze({
  schema: 'lafea-guided-workflow/v1',
  stageId: 'LAFEA.6',
  analysisRouteFamily: 'UNSUPPORTED',
  meshApplicable: false,
  executionSupported: false,
  steps,
});
const unsupportedAreas = byArea(buildLafeaWorkflowAreaPresentation(unsupported));
assert.equal(unsupportedAreas.MESH.status, 'NOT_APPLICABLE');
assert.equal(unsupportedAreas.SOLVE.status, 'NOT_APPLICABLE');
assert.equal(unsupportedAreas.RESULTS.status, 'NOT_APPLICABLE');
assert.deepEqual(unsupportedAreas.MESH.reasons, []);
assert.deepEqual(unsupportedAreas.SOLVE.reasons, []);
assert.deepEqual(unsupportedAreas.RESULTS.reasons, []);
assert.equal(unsupportedAreas.SOLVE.steps.length, 1);
assert.equal(unsupportedAreas.SOLVE.steps[0].stepId, 'RUN');
assert.equal(unsupportedAreas.MODEL.status, 'READY');
assert.ok(!unsupportedAreas.MODEL.steps.some((entry) => entry.stepId === 'MODEL_DIAGNOSTICS'));
assert.ok(!unsupportedAreas.MODEL.reasons.includes('STAGE_ENGINE_NOT_IMPLEMENTED'));

const supported = Object.freeze({
  ...unsupported,
  stageId: 'LAFEA.4',
  analysisRouteFamily: 'FEA',
  meshApplicable: true,
  executionSupported: true,
});
const supportedAreas = byArea(buildLafeaWorkflowAreaPresentation(supported));
assert.equal(supportedAreas.MESH.status, 'COMPLETE');
assert.equal(supportedAreas.SOLVE.status, 'BLOCKED');
assert.equal(supportedAreas.RESULTS.status, 'BLOCKED');
assert.equal(supportedAreas.SOLVE.steps.length, 4);
assert.equal(supportedAreas.SOLVE.steps[0].stepId, 'MODEL_DIAGNOSTICS');
assert.ok(supportedAreas.SOLVE.reasons.includes('UNSUPPORTED_STAGE_ENGINE_NOT_IMPLEMENTED'));

// #1841: a successful run must be visible. Before this guard the Solve area
// reported READY after RUN completed, because READY outranks COMPLETE in the
// aggregate, so no badge recorded that the solver had executed.
const solved = Object.freeze({
  ...supported,
  stageId: 'LAFEA.3',
  executionBoundary: Object.freeze({ resultEvidenceStatus: 'QUALIFIED' }),
  steps: Object.freeze([
    step('SOURCE_IDENTITY', 'Source and model identity', 'COMPLETE'),
    step('MODEL_DIAGNOSTICS', 'Model diagnostics', 'READY'),
    step('ANALYSIS_PROFILE', 'Analysis profile', 'COMPLETE'),
    step('MATERIALS_SECTIONS', 'Materials and sections', 'READY'),
    step('RESTRAINTS_BCS', 'Restraints and boundary conditions', 'COMPLETE'),
    step('LOADS_CASES', 'Loads and physical cases', 'READY'),
    step('DISCRETIZATION', 'Discretization / analysis mesh', 'COMPLETE'),
    step('NUMERICAL_PREFLIGHT', 'Numerical preflight', 'READY'),
    step('AUTHORIZATION', 'Authorization', 'READY'),
    step('RUN', 'Run', 'COMPLETE'),
    step('CONVERGENCE', 'Convergence', 'READY', ['CONVERGENCE_STUDY_NOT_RUN']),
    step('RESULTS_EVIDENCE', 'Results and evidence', 'BLOCKED', ['RESULT_EVIDENCE_NOT_CURRENT']),
  ]),
});
const solvedAreas = byArea(buildLafeaWorkflowAreaPresentation(solved));
assert.equal(solvedAreas.SOLVE.status, 'COMPLETE');
// Publication stays gated -- only the reason reported changes, so the operator
// sees the gate that is actually holding Results rather than "not current".
assert.equal(solvedAreas.RESULTS.status, 'BLOCKED');
assert.ok(solvedAreas.RESULTS.reasons.includes('CONVERGENCE_STUDY_NOT_RUN'));
assert.ok(!solvedAreas.RESULTS.reasons.includes('RESULT_EVIDENCE_NOT_CURRENT'));
// A blocked step still outranks a completed terminal step.
const blockedTerminal = byArea(buildLafeaWorkflowAreaPresentation(Object.freeze({
  ...solved,
  steps: Object.freeze(solved.steps.map((entry) => (entry.stepId === 'AUTHORIZATION'
    ? step('AUTHORIZATION', 'Authorization', 'BLOCKED', ['CANONICAL_AUTHORIZATION_NOT_READY'])
    : entry))),
})));
assert.equal(blockedTerminal.SOLVE.status, 'BLOCKED');

const guidedSource = fs.readFileSync(
  new URL('../src/workspace/lafea-guided-workflow.js', import.meta.url),
  'utf8',
);
assert.match(guidedSource, /meshApplicable: adapter\.discretization\.applicable/u);
assert.match(guidedSource, /executionSupported,/u);

console.log(JSON.stringify({
  check: 'lafea-workflow-area-applicability',
  status: 'PASS',
  unsupported: {
    mesh: unsupportedAreas.MESH.status,
    solve: unsupportedAreas.SOLVE.status,
    results: unsupportedAreas.RESULTS.status,
  },
  supportedBehaviorPreserved: true,
  engineeringAuthorityChanged: false,
}, null, 2));

function step(stepId, label, status, reasons = []) {
  return Object.freeze({ stepId, label, status, reasons: Object.freeze([...reasons]) });
}
function byArea(areas) {
  return Object.fromEntries(areas.map((area) => [area.areaId, area]));
}
