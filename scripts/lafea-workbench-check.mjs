import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceFixture as attachmentFixture } from './lafea.1-fixtures.mjs';
import { rawRequestFixture as screeningFixture } from './lafea.2-fixtures.mjs';
import {
  MODEL_SCHEMA,
  THICKNESS_POLICIES,
} from '../src/core/local-stress/index.js';
import { projectLafea1PressureRadiusValidation } from '../src/workspace/lafea-1-pressure-radius-validation.js';
import { triangleSource as continuumFixture } from './lafea.3-fixtures.mjs';
import { triangleSource as shellFixture } from './lafea.4-fixtures.mjs';
import { workflowSource as trunnionFixture } from './lafea.5-fixtures.mjs';
import {
  LAFEA_STAGE_IDS,
  createLafeaWorkbenchStore,
  executeLafeaStage,
  lafeaPreviewGeometry,
} from '../src/workspace/lafea-workbench.js';
import {
  presentLafeaResult,
  resolveLafeaUnits,
} from '../src/workspace/lafea-result-presenters/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUALIFIED_FIXTURES = Object.freeze({
  'LAFEA.1': attachmentFixture,
  'LAFEA.2': screeningFixture,
  'LAFEA.3': continuumFixture,
  'LAFEA.4': shellFixture,
  'LAFEA.5': trunnionFixture,
});

function weldPlaceholder() {
  return {
    schema: 'lafea-weld-profile-placeholder/v1',
    identity: 'WELD-NOT-IMPLEMENTED',
  };
}

assert.deepEqual(
  LAFEA_STAGE_IDS,
  ['LAFEA.1', 'LAFEA.2', 'LAFEA.3', 'LAFEA.4', 'LAFEA.5', 'LAFEA.6'],
);

const qualifiedExecutions = new Map();
for (const [stageId, fixture] of Object.entries(QUALIFIED_FIXTURES)) {
  const first = executeLafeaStage(stageId, fixture());
  const second = executeLafeaStage(stageId, fixture());
  assert.equal(first.status, 'QUALIFIED', `${stageId} retained fixture must qualify.`);
  assert.equal(JSON.stringify(first.result), JSON.stringify(second.result), `${stageId} result must be deterministic.`);
  assert.equal(first.stageId, stageId);
  assert.equal(
    executeLafeaStage(stageId, first.canonicalInput).status,
    'QUALIFIED',
    `${stageId} canonical import must reconstruct.`,
  );
  qualifiedExecutions.set(stageId, first);

  const units = resolveLafeaUnits(stageId, first.source);
  const presentation = presentLafeaResult(stageId, first.result, units);
  const rows = presentation.sections.flatMap((section) => section.rows);
  assert.ok(rows.length > 0, `${stageId} presenter must expose retained result rows.`);
  rows.forEach((row) => {
    assert.match(row.sourcePath, /^result\./u, `${stageId} presenter row must cite an exact retained result path.`);
  });
  if (presentation.governing) {
    assert.match(
      presentation.governing.sourcePath,
      /^result\./u,
      `${stageId} governing row must cite an exact retained result path.`,
    );
  }
}

const unsupportedWeld = executeLafeaStage('LAFEA.6', weldPlaceholder());
assert.equal(unsupportedWeld.status, 'FAILED');
assert.equal(unsupportedWeld.result, null);
assert.equal(unsupportedWeld.canonicalInput, null);
assert.deepEqual(
  unsupportedWeld.diagnostics.map((diagnostic) => diagnostic.code),
  ['UNSUPPORTED_STAGE_ENGINE_NOT_IMPLEMENTED'],
);
assert.throws(
  () => presentLafeaResult('LAFEA.6', {}, {}),
  (error) => error?.code === 'UNSUPPORTED_STAGE_ENGINE_NOT_IMPLEMENTED',
);
assert.throws(
  () => resolveLafeaUnits('LAFEA.6', weldPlaceholder()),
  (error) => error?.code === 'UNSUPPORTED_STAGE_ENGINE_NOT_IMPLEMENTED',
);

const foundationPreview = lafeaPreviewGeometry('LAFEA.1', attachmentFixture());
assert.equal(foundationPreview.nodePath, null, 'LAFEA.1 source points must be display-only in U0.');
assert.ok(foundationPreview.nodes.length > 0, 'LAFEA.1 explicit source points must remain visible.');

const screeningPreview = lafeaPreviewGeometry('LAFEA.2', screeningFixture());
assert.equal(screeningPreview.nodePath, null, 'LAFEA.2 preview must not expose unsupported geometry editing.');
assert.equal(screeningPreview.nodes.length, 0, 'LAFEA.2 must not synthesize a pipe ring.');
assert.equal(screeningPreview.elements.length, 0, 'LAFEA.2 must not synthesize mesh topology.');

const continuumPreview = lafeaPreviewGeometry('LAFEA.3', continuumFixture());
assert.equal(continuumPreview.nodePath, 'nodes');
assert.equal(continuumPreview.nodes.length, continuumFixture().nodes.length);

const weldPreview = lafeaPreviewGeometry('LAFEA.6', {
  nodes: [{ nodeId: 'W1', x: 0, y: 0, z: 0 }],
  elements: [],
});
assert.equal(weldPreview.nodePath, null, 'LAFEA.6 placeholder geometry must be display-only.');
assert.equal(weldPreview.nodes.length, 1, 'Explicit placeholder source geometry may be shown without calculation.');

const foundationStore = createLafeaWorkbenchStore({
  initialStage: 'LAFEA.1',
  initialDocument: attachmentFixture(),
});
foundationStore.setScalar('LAFEA.1.load.force.x', 'LC-1', '2500');
assert.equal(
  foundationStore.getState().stages['LAFEA.1'].document.loadCases
    .find((row) => row.identity === 'LC-1').force.value[0],
  2500,
  'LAFEA.1 force components must be editable through governed form descriptors.',
);
foundationStore.setScalar('LAFEA.1.thickness.nominal', null, '12');
let editedFoundation = foundationStore.getState().stages['LAFEA.1'].document;
assert.equal(
  editedFoundation.thicknessBasis.assessmentPipeThickness,
  undefined,
  'NOMINAL_MINUS_CORROSION edits must remove stale derived assessment thickness from retained editable source.',
);
let pressureRadiusValidation = projectLafea1PressureRadiusValidation(editedFoundation);
assert.equal(pressureRadiusValidation.state, 'VALID');
assert.equal(pressureRadiusValidation.innerRadius, 488);
assert.equal(pressureRadiusValidation.outerRadius, 500);
let editedFoundationExecution = executeLafeaStage('LAFEA.1', editedFoundation);
assert.equal(editedFoundationExecution.status, 'QUALIFIED');
assert.equal(editedFoundationExecution.canonicalInput.thicknessBasis.assessmentPipeThickness.value, 12);
assert.equal(
  editedFoundationExecution.canonicalInput.thicknessBasis.assessmentPipeThickness.derivation,
  'NOMINAL_MINUS_CORROSION',
);
assert.equal(
  editedFoundationExecution.canonicalInput.thicknessBasis.assessmentPipeThickness.sourceRef,
  `${editedFoundation.thicknessBasis.nominalPipeThickness.sourceRef}+${editedFoundation.thicknessBasis.corrosionAllowance.sourceRef}`,
);

foundationStore.setScalar('LAFEA.1.thickness.corrosionAllowance', null, '2');
editedFoundation = foundationStore.getState().stages['LAFEA.1'].document;
assert.equal(editedFoundation.thicknessBasis.assessmentPipeThickness, undefined);
pressureRadiusValidation = projectLafea1PressureRadiusValidation(editedFoundation);
assert.equal(pressureRadiusValidation.state, 'VALID');
assert.equal(pressureRadiusValidation.innerRadius, 490);
assert.equal(pressureRadiusValidation.outerRadius, 500);
editedFoundationExecution = executeLafeaStage('LAFEA.1', editedFoundation);
assert.equal(editedFoundationExecution.status, 'QUALIFIED');
assert.equal(editedFoundationExecution.canonicalInput.thicknessBasis.assessmentPipeThickness.value, 10);
assert.equal(
  editedFoundationExecution.result.pressureStressResults
    .find((row) => row.pressureDefinitionIdentity === 'P-CLOSED').assessmentPipeThickness,
  10,
  'LAFEA.1 pressure must consume the canonical nominal-minus-corrosion wall.',
);
assert.equal(
  editedFoundationExecution.result.transformedLoadCases
    .find((row) => row.identity === 'LC-1').transformedForceLocal[0],
  2500,
  'Edited force must reach the retained LAFEA.1 calculation result.',
);

const screeningBaseline = screeningFixture();
const nonzeroCorrosionSource = structuredClone(
  screeningBaseline.sourceEvidence.foundationModel.sourceEvidence,
);
nonzeroCorrosionSource.schema = MODEL_SCHEMA;
nonzeroCorrosionSource.pipeGeometry.outsideDiameter.value = 100;
nonzeroCorrosionSource.thicknessBasis.policy = THICKNESS_POLICIES.NOMINAL_MINUS_CORROSION;
nonzeroCorrosionSource.thicknessBasis.nominalPipeThickness.value = 10;
nonzeroCorrosionSource.thicknessBasis.corrosionAllowance.value = 2;
delete nonzeroCorrosionSource.thicknessBasis.assessmentPipeThickness;
for (const request of nonzeroCorrosionSource.resultRequests.pressure) {
  request.requestedRadii.forEach((radius, index) => {
    radius.value = [42, 46, 50][index];
  });
}
const nonzeroExecution = executeLafeaStage('LAFEA.1', nonzeroCorrosionSource);
assert.equal(nonzeroExecution.status, 'QUALIFIED');
assert.equal(nonzeroExecution.source.units.length, 'mm');
assert.equal(nonzeroExecution.source.units.pressure, 'MPa');
assert.equal(nonzeroExecution.canonicalInput.thicknessBasis.assessmentPipeThickness.value, 8);
assert.equal(
  nonzeroExecution.canonicalInput.thicknessBasis.assessmentPipeThickness.derivation,
  'NOMINAL_MINUS_CORROSION',
);
const derivedWallSourceRef =
  `${nonzeroCorrosionSource.thicknessBasis.nominalPipeThickness.sourceRef}+${nonzeroCorrosionSource.thicknessBasis.corrosionAllowance.sourceRef}`;
assert.equal(
  nonzeroExecution.canonicalInput.thicknessBasis.assessmentPipeThickness.sourceRef,
  derivedWallSourceRef,
);
const nonzeroClosedPressure = nonzeroExecution.result.pressureStressResults
  .find((row) => row.pressureDefinitionIdentity === 'P-CLOSED');
assert.ok(nonzeroClosedPressure, 'Nonzero-corrosion witness must retain the P-CLOSED pressure result.');
assert.equal(nonzeroClosedPressure.innerRadius, 42);
assert.equal(nonzeroClosedPressure.outerRadius, 50);
assert.equal(nonzeroClosedPressure.assessmentPipeThickness, 8);
assert.equal(nonzeroClosedPressure.pressureWallBasis, 'ASSESSMENT_PIPE_THICKNESS_ONLY');
assert.equal(nonzeroClosedPressure.sourceReferences.assessmentPipeThickness, derivedWallSourceRef);
closeRelative(nonzeroClosedPressure.coefficientA, 4.793478260869565, 1e-10);
closeRelative(nonzeroClosedPressure.coefficientB, 11983.695652173914, 1e-10);
closeRelative(nonzeroClosedPressure.requestedPoints[0].radialStress, -2, 1e-10);
closeRelative(nonzeroClosedPressure.requestedPoints[0].hoopStress, 11.58695652173913, 1e-10);
closeRelative(nonzeroClosedPressure.requestedPoints.at(-1).radialStress, 0, 1e-10);
closeRelative(nonzeroClosedPressure.requestedPoints.at(-1).hoopStress, 9.58695652173913, 1e-10);

const nonzeroScreeningSource = screeningFixture();
nonzeroScreeningSource.sourceEvidence.foundationModel = structuredClone(nonzeroExecution.canonicalInput);
nonzeroScreeningSource.sourceEvidence.foundationResult = structuredClone(nonzeroExecution.result);
const nonzeroScreeningExecution = executeLafeaStage('LAFEA.2', nonzeroScreeningSource);
assert.equal(nonzeroScreeningExecution.status, 'QUALIFIED');
const nonzeroSection = nonzeroScreeningExecution.result.sectionProperties;
assert.equal(nonzeroSection.innerRadius, 42);
assert.equal(nonzeroSection.outerRadius, 50);
assert.equal(nonzeroSection.assessmentPipeThickness, 8);
assert.equal(nonzeroSection.units.length, 'mm');
assert.equal(nonzeroSection.units.area, 'mm²');
assert.equal(nonzeroSection.units.secondMoment, 'mm⁴');
assert.equal(nonzeroSection.units.polarMoment, 'mm⁴');
assert.equal(nonzeroSection.sourceReferences.assessmentPipeThickness, derivedWallSourceRef);
closeRelative(nonzeroSection.crossSectionArea, 2312.2121930420876, 1e-8);
closeRelative(nonzeroSection.secondMomentY, 2464818.1977828657, 1e-8);
closeRelative(nonzeroSection.secondMomentZ, 2464818.1977828657, 1e-8);
closeRelative(nonzeroSection.polarMoment, 4929636.395565731, 1e-8);

const explicitAssessment = attachmentFixture((source) => {
  source.thicknessBasis.policy = THICKNESS_POLICIES.EXPLICIT_ASSESSMENT;
  source.thicknessBasis.corrosionAllowance.value = 2;
  source.thicknessBasis.assessmentPipeThickness.value = 7;
  source.resultRequests.pressure[0].requestedRadii[0].value = 493;
});
const explicitExecution = executeLafeaStage('LAFEA.1', explicitAssessment);
assert.equal(explicitExecution.status, 'QUALIFIED');
assert.equal(explicitExecution.canonicalInput.thicknessBasis.assessmentPipeThickness.value, 7);
assert.equal(explicitExecution.canonicalInput.thicknessBasis.assessmentPipeThickness.derivation, 'EXPLICIT');
assert.equal(
  explicitExecution.canonicalInput.thicknessBasis.assessmentPipeThickness.sourceRef,
  explicitAssessment.thicknessBasis.assessmentPipeThickness.sourceRef,
);
assert.equal(
  explicitExecution.result.pressureStressResults
    .find((row) => row.pressureDefinitionIdentity === 'P-CLOSED').innerRadius,
  493,
);

assertRejectedFoundation(
  attachmentFixture((source) => {
    source.thicknessBasis.corrosionAllowance.value = 2;
    source.thicknessBasis.assessmentPipeThickness.value = 7;
  }),
  'ASSESSMENT_THICKNESS_CONFLICT',
);
assertRejectedFoundation(
  attachmentFixture((source) => { source.thicknessBasis.corrosionAllowance.value = 10; }),
  'CORROSION_EXCEEDS_NOMINAL',
);
assertRejectedFoundation(
  attachmentFixture((source) => { source.thicknessBasis.corrosionAllowance.value = 11; }),
  'CORROSION_EXCEEDS_NOMINAL',
);
assertRejectedFoundation(
  attachmentFixture((source) => {
    source.thicknessBasis.policy = THICKNESS_POLICIES.EXPLICIT_ASSESSMENT;
    source.thicknessBasis.assessmentPipeThickness.value = 0;
  }),
  'ASSESSMENT_THICKNESS_REQUIRED',
);
assertRejectedFoundation(
  attachmentFixture((source) => {
    source.thicknessBasis.policy = THICKNESS_POLICIES.EXPLICIT_ASSESSMENT;
    source.thicknessBasis.assessmentPipeThickness.value = 500;
  }),
  'INVALID_PIPE_RADII',
);

const invalidEditStore = createLafeaWorkbenchStore({
  initialStage: 'LAFEA.1',
  initialDocument: attachmentFixture(),
});
const invalidEditBefore = JSON.stringify(invalidEditStore.getState().stages['LAFEA.1'].document);
invalidEditStore.setScalar(
  'LAFEA.1.thickness.corrosionAllowance',
  null,
  '10',
  'AGENT-B-CHECK',
);
assert.equal(invalidEditStore.getState().status, 'FAILED');
assert.equal(
  JSON.stringify(invalidEditStore.getState().stages['LAFEA.1'].document),
  invalidEditBefore,
);
invalidEditStore.destroy();

const wallLifecycleStore = createLafeaWorkbenchStore({
  initialStage: 'LAFEA.1',
  initialDocument: attachmentFixture(),
});
wallLifecycleStore.run();
let wallStage = wallLifecycleStore.getState().stages['LAFEA.1'];
assert.equal(wallStage.execution.status, 'QUALIFIED');
assert.equal(wallStage.lifecycle.artifacts.EXECUTION.status, 'CURRENT');
assert.equal(wallStage.lifecycleReadiness.resultState, 'RESULT_READY');
const wallSourceHashBeforeEdit = wallStage.sourceAuthority.sourceHash;
wallLifecycleStore.setScalar('LAFEA.1.thickness.nominal', null, '12', 'AGENT-B-CHECK');
wallStage = wallLifecycleStore.getState().stages['LAFEA.1'];
const wallSourceHashAfterEdit = wallStage.sourceAuthority.sourceHash;
assert.notEqual(wallSourceHashAfterEdit, wallSourceHashBeforeEdit);
assert.equal(wallStage.lastSourceAuthorityEvent.changeClass, 'GEOMETRY');
assert.equal(wallStage.execution, null);
assert.equal(wallStage.lifecycle.artifacts.EXECUTION.status, 'STALE');
assert.equal(wallStage.lifecycleReadiness.resultState, 'RESULT_NOT_READY');
wallLifecycleStore.undo();
wallStage = wallLifecycleStore.getState().stages['LAFEA.1'];
assert.equal(wallStage.sourceAuthority.sourceHash, wallSourceHashBeforeEdit);
assert.equal(wallStage.execution, null);
assert.equal(wallStage.lifecycle.artifacts.EXECUTION.status, 'STALE');
assert.equal(wallStage.lifecycleReadiness.resultState, 'RESULT_NOT_READY');
wallLifecycleStore.redo();
wallStage = wallLifecycleStore.getState().stages['LAFEA.1'];
assert.equal(wallStage.sourceAuthority.sourceHash, wallSourceHashAfterEdit);
assert.equal(wallStage.execution, null);
assert.equal(wallStage.lifecycle.artifacts.EXECUTION.status, 'STALE');
assert.equal(wallStage.lifecycleReadiness.resultState, 'RESULT_NOT_READY');
wallLifecycleStore.destroy();

const store = createLafeaWorkbenchStore({
  initialStage: 'LAFEA.3',
  initialDocument: continuumFixture(),
});
const nodes = store.getState().stages['LAFEA.3'].document.nodes;
const originalX = nodes.find((row) => row.nodeId === 'B').x;
store.setScalar('LAFEA.3.node.x', 'B', String(originalX + 10));
assert.equal(store.getState().stages['LAFEA.3'].document.nodes.find((row) => row.nodeId === 'B').x, originalX + 10);
assert.equal(store.getState().stages['LAFEA.3'].execution, null);
store.undo();
assert.equal(store.getState().stages['LAFEA.3'].document.nodes.find((row) => row.nodeId === 'B').x, originalX);
store.redo();
assert.equal(store.getState().stages['LAFEA.3'].document.nodes.find((row) => row.nodeId === 'B').x, originalX + 10);
assert.equal(store.exportDocument().schema, 'lafea-workbench-document/v1');
assert.equal(store.updateRecord, undefined);
assert.equal(store.deleteRecord, undefined);

const invalid = attachmentFixture();
invalid.pipeGeometry.outsideDiameter.value = -1;
const rejected = executeLafeaStage('LAFEA.1', invalid);
assert.equal(rejected.status, 'FAILED');
assert.equal(rejected.result, null);
assert.ok(rejected.diagnostics.some((row) => row.severity === 'ERROR'));

const workspace = path.join(ROOT, 'src', 'workspace');
const read = (relativePath) => fs.readFileSync(path.join(workspace, relativePath), 'utf8');
const modelSource = read('lafea-workbench-model.js');
const viewSource = read('lafea-workbench-view.js');
const storeSource = read('lafea-workbench-store.js');
const contentSource = read('lafea-workbench-content.js');
const documentTableSource = [
  read('lafea-document-table.js'),
  read('lafea-document-table-form.js'),
  read('lafea-document-table-support.js'),
].join('\n');
const previewSource = read('lafea-stage-preview.js');
const meshPanelSource = [
  read('lafea-mesh-quality-panel.js'),
  read('lafea-discretization-dom.js'),
].join('\n');
const resultsSource = read('lafea-results-view.js');
const presenterIndexSource = read('lafea-result-presenters/index.js');
const screeningPresenterSource = read('lafea-result-presenters/attachment-screening.js');
const continuumPresenterSource = read('lafea-result-presenters/local-continuum.js');
const shellPresenterSource = read('lafea-result-presenters/local-shell.js');
const trunnionPresenterSource = read('lafea-result-presenters/trunnion-footprint.js');

assert.match(modelSource, /UNSUPPORTED_STAGE_ENGINE_NOT_IMPLEMENTED/u);
assert.doesNotMatch(modelSource, /85\.4/u);
assert.doesNotMatch(modelSource, /allowable(?:Shear)?Mpa\s*\|\|/u);
assert.doesNotMatch(modelSource, /Qualified Weld Profile evaluation passed/u);

assert.doesNotMatch(viewSource, /stage\.document(?:\.|\[)[^;\n]*=/u);
assert.doesNotMatch(viewSource, /\bprompt\s*\(/u);
assert.doesNotMatch(viewSource, /createHybridViewport|webgl:\s*\{\s*render:\s*\(\)\s*=>\s*\{\}/u);
assert.match(contentSource, /No geometry or mesh has been synthesized/u);
assert.match(viewSource, /Calculation not implemented/u);
assert.match(contentSource, /onSetScalar/u);

assert.match(storeSource, /applyLafeaStageEditCommand/u);
assert.doesNotMatch(storeSource, /function updateRecord|function deleteRecord|rowIndex === index/u);
assert.doesNotMatch(documentTableSource, /Number\([^)]*\)\s*\|\|\s*0/u);
assert.doesNotMatch(documentTableSource, /collectScalars|findCollections|stableColumns|recordIdentity/u);
assert.match(documentTableSource, /Governed stage-specific inputs/u);
assert.match(documentTableSource, /whole-document replacement/u);

assert.doesNotMatch(previewSource, /PLATE-NW|VALVE-MASS|Q8-PLATE|SH3D-|WELD-FILLET/u);
assert.match(previewSource, /does not manufacture pads/u);
assert.match(previewSource, /nodePath: editable \? nodePath : null/u);

assert.doesNotMatch(meshPanelSource, /J_min\s*=|Max AR\s*=|Max Skew\s*=/u);
assert.doesNotMatch(meshPanelSource, /\[PASS\]/u);
assert.match(meshPanelSource, /Build a display model from retained gate evidence/u);
assert.match(meshPanelSource, /No retained mesh-quality result is available/u);

assert.doesNotMatch(resultsSource, /IMMUTABLE TRUTH/u);
assert.doesNotMatch(resultsSource, /Raw qualified evidence/u);
assert.match(resultsSource, /RAW_RETAINED_FIELD/u);

assert.doesNotMatch(presenterIndexSource, /presentWeldProfile|WELD-TOE-001|MOMENT-ARM-X/u);
assert.doesNotMatch(presenterIndexSource, /LAFEA\.6['"]:\s*documentValue/u);
assert.match(presenterIndexSource, /UNSUPPORTED_STAGE_ENGINE_NOT_IMPLEMENTED/u);

assert.doesNotMatch(screeningPresenterSource, /ASME B31\.3/u);
assert.match(screeningPresenterSource, /Nominal pipe-section stress envelopes/u);
assert.match(continuumPresenterSource, /result\.loadCaseResults\[/u);
assert.match(shellPresenterSource, /result\.loadCaseResults\[/u);
assert.match(trunnionPresenterSource, /result\.assessmentRegionResults\[/u);

const workbenchFiles = fs.readdirSync(workspace)
  .filter((name) => name.startsWith('lafea-workbench') && name.endsWith('.js'));
const sourceText = workbenchFiles
  .map((name) => fs.readFileSync(path.join(workspace, name), 'utf8'))
  .join('\n');
assert.doesNotMatch(sourceText, /EventBus|analysis-context|workspace-consumer-context/u);

function closeRelative(actual, expected, relativeTolerance) {
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected));
  assert.ok(
    Math.abs(actual - expected) <= relativeTolerance * scale,
    `${actual} != ${expected} within relative tolerance ${relativeTolerance}`,
  );
}

function assertRejectedFoundation(source, expectedCode) {
  const execution = executeLafeaStage('LAFEA.1', source);
  assert.equal(execution.status, 'FAILED');
  assert.equal(execution.result, null);
  assert.ok(
    execution.diagnostics.some((diagnostic) => diagnostic.code === expectedCode),
    `Expected LAFEA.1 rejection ${expectedCode}; got ${execution.diagnostics.map((row) => row.code).join(', ')}`,
  );
}

console.log(JSON.stringify({
  check: 'lafea-workbench-u0-u2b',
  status: 'PASS',
  qualifiedStages: Object.keys(QUALIFIED_FIXTURES),
  unsupportedStages: ['LAFEA.6'],
  failClosed: true,
  fabricatedEngineeringClaims: false,
  presenterPathsRetained: true,
  typedCommandEditing: true,
  arrayIndexEditAuthority: false,
  workspaceCoupling: false,
}));