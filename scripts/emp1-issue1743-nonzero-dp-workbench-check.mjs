#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  classifyEmp1WorkbenchExecutionCurrentness,
  currentEmp1WorkbenchRouteAuthority,
  executeEmp1WorkbenchProduct,
  projectEmp1WorkbenchCState,
  projectEmp1WorkbenchRunReadiness,
} from '../src/workspace/emp1-workbench-product-run.js';
import { createEmp1WorkbenchQualificationSample } from '../src/workspace/emp1-workbench-qualification-sample.js';
import { normalizeLafeaStageDocument } from '../src/workspace/lafea-workbench-model.js';
import { sourceFixture } from './lafea.1-fixtures.mjs';

const sample = createEmp1WorkbenchQualificationSample();
const aDocument = normalizeLafeaStageDocument(
  'LAFEA.1',
  foundationSourceWithNonzeroDifferentialPressure(),
);
// Retain a real imported B document, but deliberately let the product transaction
// refresh its A ancestry from the newly executed nonzero-dp A document. This is
// the same custody seam used by the visible workbench journey.
const bDocument = normalizeLafeaStageDocument('LAFEA.2', sample.bDocument);
const runInput = sample.runInput;

const execution = await executeEmp1WorkbenchProduct({
  aDocument,
  bDocument,
  runInput,
});

assert.equal(execution.status, 'BLOCKED');
assert.equal(execution.authority.boundedLocalRoutePrepared, false);
assert.equal(execution.authority.boundedLocalRouteExecuted, false);
assert.deepEqual(execution.authority.routeSuspensionReasons,
  ['NONZERO_DIFFERENTIAL_PRESSURE']);
assert.deepEqual(execution.invocations, {
  loadTransfer: 1,
  sectionScreening: 1,
  localPreparation: 1,
  localCorrelation: 0,
});
assert.equal(execution.result.localCorrelation.state, 'BLOCKED');
assert.equal(execution.authority.codeComplianceProduced, false);
assert.equal(execution.authority.releaseQualified, false);

const routeAuthority = currentEmp1WorkbenchRouteAuthority();
const currentness = classifyEmp1WorkbenchExecutionCurrentness({
  execution,
  aDocument,
  bDocument,
  runInput,
  currentRouteAuthority: routeAuthority,
});
assert.equal(currentness.state, 'CURRENT');
assert.equal(currentness.inputCurrent, true);
assert.equal(currentness.cAuthorityCurrent, true);
assert.equal(currentness.cReportable, false);

const readiness = projectEmp1WorkbenchRunReadiness({ aDocument, bDocument, runInput });
assert.equal(readiness.state, 'READY');
const cState = projectEmp1WorkbenchCState({
  readiness,
  execution,
  currentness,
  routeAuthority,
});
assert.equal(cState.state, 'ROUTE_SUSPENDED');
assert.equal(cState.buttonEnabled, false);
assert.equal(cState.buttonLabel, 'C blocked by current inputs');
assert.equal(cState.stageBadge, 'BLOCKED · ROUTE LIMIT');
assert.ok(cState.blockerCodes.includes('NONZERO_DIFFERENTIAL_PRESSURE'));
assert.equal(cState.currentResultAvailable, false);

console.log(JSON.stringify({
  schema: 'emp1-issue1743-nonzero-dp-workbench-check/v3',
  status: 'PASS_NONZERO_DP_TRANSLATED_TO_BLOCKED_WORKBENCH_STATE',
  executionStatus: execution.status,
  cState: cState.state,
  stageBadge: cState.stageBadge,
  routeSuspensionReasons: execution.authority.routeSuspensionReasons,
  localCorrelationInvoked: execution.invocations.localCorrelation > 0,
  producerBoundaryRelaxed: false,
  codeComplianceProduced: false,
  releaseQualified: false,
}, null, 2));

function foundationSourceWithNonzeroDifferentialPressure() {
  return sourceFixture((source) => {
    const meanRadius = 100;
    const shellThickness = 20;
    const outerRadius = meanRadius + shellThickness / 2;
    const innerRadius = meanRadius - shellThickness / 2;
    source.modelIdentity = 'EMP1-ISSUE-1743-NONZERO-DP-A';
    source.pipeGeometry.outsideDiameter.value = 2 * outerRadius;
    source.thicknessBasis.nominalPipeThickness.value = shellThickness;
    source.thicknessBasis.corrosionAllowance.value = 0;
    source.thicknessBasis.assessmentPipeThickness.value = shellThickness;
    source.loadCases[0].force.value = [-400, -250, -1000];
    source.loadCases[0].moment.value = [-750000, 1000000, -700000];
    source.pressureDefinitions.forEach((row) => {
      row.internalPressure.value = 1;
      row.externalPressure.value = 0;
    });
    source.resultRequests.pressure[0].requestedRadii[0].value = innerRadius;
    source.resultRequests.pressure[0].requestedRadii[1].value = outerRadius;
    source.limitations = [
      '[SIMULATED] Issue 1743 nonzero differential-pressure blocker regression.',
    ];
  });
}
