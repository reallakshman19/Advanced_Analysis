#!/usr/bin/env node
import assert from 'node:assert/strict';
import { calculateLocalAttachmentFoundation } from '../src/core/local-stress/index.js';
import {
  EMP1_WORKBENCH_ATTACHMENT_DIAMETER_BASIS,
  EMP1_WORKBENCH_ATTACHMENT_PHYSICAL_LOCATION,
  EMP1_WORKBENCH_ATTACHMENT_STATION_BASIS,
  EMP1_WORKBENCH_CYLINDER_LENGTH_BASIS,
  EMP1_WORKBENCH_RUN_INPUT_SCHEMA,
  classifyEmp1WorkbenchExecutionCurrentness,
  currentEmp1WorkbenchRouteAuthority,
  executeEmp1WorkbenchProduct,
  projectEmp1WorkbenchCState,
  projectEmp1WorkbenchRunReadiness,
} from '../src/workspace/emp1-workbench-product-run.js';
import { canonicalFixture } from './lafea.1-fixtures.mjs';
import { rawRequestFixture } from './lafea.2-fixtures.mjs';

const aDocument = foundationModelWithNonzeroDifferentialPressure();
const aResult = calculateLocalAttachmentFoundation(aDocument);
assert.equal(aResult.qualification.state, 'ACCEPTED');
const bDocument = routeScreeningRequest(aDocument, aResult);
const runInput = qualifiedRunInput();

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
  schema: 'emp1-issue1743-nonzero-dp-workbench-check/v2',
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

function foundationModelWithNonzeroDifferentialPressure() {
  return canonicalFixture((source) => {
    const meanRadius = 100;
    const shellThickness = 20;
    const outerRadius = meanRadius + shellThickness / 2;
    const innerRadius = meanRadius - shellThickness / 2;
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
  });
}

function routeScreeningRequest(foundationModel, foundationResult) {
  return rawRequestFixture((raw) => {
    raw.sourceEvidence = {
      ...raw.sourceEvidence,
      foundationModel: structuredClone(foundationModel),
      foundationResult: structuredClone(foundationResult),
    };
    raw.screeningCases = [{
      screeningCaseId: 'CASE-WRC',
      mechanicalTerms: [{ loadCaseId: 'LC-1', factor: 1 }],
      pressureDefinitionId: 'P-CLOSED',
      pressureFactor: 0,
      sourceReference: 'EMP1-1743/CASE-WRC',
    }];
  });
}

function qualifiedRunInput() {
  const attachmentRadius = 0.155 * 100 / 0.875;
  return {
    schema: EMP1_WORKBENCH_RUN_INPUT_SCHEMA,
    localMethod: {
      routeRequest: {
        schema: 'emp1-wrc537-gamma5-zero-dp-orchestration-request/v2',
        loadCaseIdentity: 'LC-1',
        pressureResultIdentity: 'PR-1',
      },
      attachmentGeometry: {
        geometryIdentity: 'EMP1-WRC-ATTACHMENT-1743',
        attachmentDiameter: 2 * attachmentRadius,
        diameterBasis: EMP1_WORKBENCH_ATTACHMENT_DIAMETER_BASIS,
        physicalLocation: EMP1_WORKBENCH_ATTACHMENT_PHYSICAL_LOCATION,
        unit: 'mm',
        sourceReference: 'EMP1-1743/ATTACHMENT-OUTSIDE-DIAMETER-AT-SHELL-JUNCTURE',
      },
      applicabilityGeometry: {
        geometryIdentity: 'EMP1-WRC45-CYLINDER-1743',
        cylinderLengthBasis: EMP1_WORKBENCH_CYLINDER_LENGTH_BASIS,
        cylinderLength: 300,
        attachmentStationBasis: EMP1_WORKBENCH_ATTACHMENT_STATION_BASIS,
        attachmentStationFromCylinderStart: 80,
        unit: 'mm',
        cylinderLengthSourceReference: 'EMP1-1743/CYLINDER-LENGTH',
        attachmentStationSourceReference: 'EMP1-1743/WRC-ATTACHMENT-STATION',
      },
    },
  };
}
