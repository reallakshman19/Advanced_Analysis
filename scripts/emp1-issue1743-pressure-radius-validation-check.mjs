#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  LAFEA1_PRESSURE_RADIUS_OUTSIDE_WALL,
  projectLafea1PressureRadiusValidation,
  requireLafea1PressureRadiusRunAuthorized,
} from '../src/workspace/lafea-1-pressure-radius-validation.js';
import { createLafeaWorkbenchStore } from '../src/workspace/lafea-lifecycle-workbench-store.js';
import { executeEmp1WorkbenchProduct } from '../src/workspace/emp1-workbench-product-run.js';
import { createEmp1WorkbenchQualificationSample } from '../src/workspace/emp1-workbench-qualification-sample.js';

const sample = createEmp1WorkbenchQualificationSample();
const valid = projectLafea1PressureRadiusValidation(sample.aDocument);
assert.equal(valid.state, 'VALID');
assert.equal(valid.runAuthorized, true);
assert.deepEqual(valid.invalidRequestedRadii, []);

const invalidDocument = structuredClone(sample.aDocument);
const retainedRequestedRadii = invalidDocument.resultRequests.pressure[0].requestedRadii
  .map((row) => row.value);
invalidDocument.pipeGeometry.outsideDiameter.value = 240;

const invalid = projectLafea1PressureRadiusValidation(invalidDocument);
assert.equal(invalid.state, 'OUTSIDE_WALL');
assert.equal(invalid.runAuthorized, false);
assert.deepEqual(invalid.reasonCodes, [LAFEA1_PRESSURE_RADIUS_OUTSIDE_WALL]);
assert.equal(invalid.innerRadius, 100);
assert.equal(invalid.outerRadius, 120);
assert.deepEqual(invalid.invalidRequestedRadii.map((row) => row.value), [90]);
assert.match(invalid.message, /90 mm lies outside the current pipe wall \(100–120 mm\)/u);
assert.match(invalid.recoveryAction, /Use Undo/u);
assert.deepEqual(
  invalidDocument.resultRequests.pressure[0].requestedRadii.map((row) => row.value),
  retainedRequestedRadii,
  'validation must not clamp or rewrite retained engineering inputs',
);
assert.throws(
  () => requireLafea1PressureRadiusRunAuthorized(invalidDocument),
  (error) => error?.code === LAFEA1_PRESSURE_RADIUS_OUTSIDE_WALL
    && error?.path === 'resultRequests.pressure.requestedRadii',
);

const store = createLafeaWorkbenchStore({
  initialStage: 'LAFEA.1',
  initialDocument: invalidDocument,
});
const beforeRun = structuredClone(store.getState().stages['LAFEA.1'].document);
const blockedStageRun = store.run();
assert.equal(blockedStageRun.status, 'FAILED');
assert.equal(blockedStageRun.stages['LAFEA.1'].execution, null);
assert.equal(blockedStageRun.diagnostics[0]?.code, LAFEA1_PRESSURE_RADIUS_OUTSIDE_WALL);
assert.match(blockedStageRun.diagnostics[0]?.message ?? '', /Use Undo/u);
assert.deepEqual(blockedStageRun.stages['LAFEA.1'].document, beforeRun,
  'stage preflight must not mutate the source document');

await assert.rejects(
  () => executeEmp1WorkbenchProduct({
    aDocument: invalidDocument,
    bDocument: sample.bDocument,
    runInput: sample.runInput,
  }),
  (error) => error?.code === LAFEA1_PRESSURE_RADIUS_OUTSIDE_WALL,
  'product transaction must stop at the same preflight before heavy execution',
);

console.log(JSON.stringify({
  schema: 'emp1-issue1743-pressure-radius-validation-check/v1',
  status: 'PASS_PRESSURE_RADIUS_PREFLIGHT_WITHOUT_SILENT_CLAMPING',
  validState: valid.state,
  invalidState: invalid.state,
  blockedCode: blockedStageRun.diagnostics[0]?.code,
  invalidRequestedRadii: invalid.invalidRequestedRadii.map((row) => row.value),
  currentWall: [invalid.innerRadius, invalid.outerRadius],
  requestedRadiiMutated: false,
  stageExecutionInvoked: blockedStageRun.stages['LAFEA.1'].execution !== null,
  recoveryUsesExplicitUndoOrImport: true,
}, null, 2));
