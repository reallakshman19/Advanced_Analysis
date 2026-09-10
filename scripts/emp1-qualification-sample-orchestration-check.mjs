import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { refreshEmp1BSourceEvidence } from '../src/core/emp1/emp1-a-to-b-refresh.js';
import { createEmp1WorkbenchQualificationSample } from '../src/workspace/emp1-workbench-qualification-sample.js';
import { createLafeaWorkbenchStore } from '../src/workspace/lafea-lifecycle-workbench-store.js';
import { executeLafeaStage } from '../src/workspace/lafea-workbench-model.js';
import { issueLafeaSourceAuthority } from '../src/workspace/lafea-source-authority.js';

const controllerPath = 'src/workspace/lafea-workbench-controller.js';
const samplePath = 'src/workspace/emp1-workbench-qualification-sample.js';
const controllerSource = await readFile(controllerPath, 'utf8');
const sampleSource = await readFile(samplePath, 'utf8');

const methodStart = controllerSource.indexOf('  async loadEmp1QualificationSample() {');
const methodEnd = controllerSource.indexOf('\n  exportDocument()', methodStart);
assert.notEqual(methodStart, -1, 'EMP1_QUALIFICATION_SAMPLE_LOADER_REQUIRED');
assert.notEqual(methodEnd, -1, 'EMP1_QUALIFICATION_SAMPLE_LOADER_BOUNDARY_REQUIRED');
const method = controllerSource.slice(methodStart, methodEnd);

const orderedMarkers = [
  'this.emp1RunSerial += 1',
  'this.emp1RunInput = null',
  'this.emp1Execution = null',
  'this.emp1EngineeringReviewRecord = null',
  'const aSourceAuthority = issueLafeaSourceAuthority(',
  'aSourceAuthority.sourceHash,',
  "this.store.selectStage('LAFEA.1')",
  'const ranA = this.run()',
  "ranA?.status === 'FAILED'",
  "diagnostic?.code ?? 'EMP1_QUALIFICATION_SAMPLE_A_RUN_FAILED'",
  "aExecution?.status !== 'QUALIFIED'",
  "aExecution?.result?.qualification?.state !== 'ACCEPTED'",
  'const bSourceAuthority = issueLafeaSourceAuthority(',
  'bSourceAuthority.sourceHash,',
  'this.setEmp1RunInput(sample.runInput)',
  'await this.runEmp1Product()',
];

let previous = -1;
for (const marker of orderedMarkers) {
  const index = method.indexOf(marker);
  assert.ok(index > previous, `EMP1_QUALIFICATION_SAMPLE_SEQUENCE_REQUIRED:${marker}`);
  previous = index;
}

// importDocument(sample.bDocument, 'LAFEA.2', sourceHash) makes B the active
// stage as an intrinsic side effect of importing into it - correct for a
// deliberate single-document import, but "load complete sample" is one bulk
// convenience action, not the caller choosing to look at B. runEmp1Product()
// itself reads stages['LAFEA.1']/['LAFEA.2'] directly and does not depend on
// which stage is active, so the method must restore A as active afterward.
const restoreAIndex = method.indexOf("this.store.selectStage('LAFEA.1')", previous);
assert.ok(restoreAIndex > previous,
  "EMP1_QUALIFICATION_SAMPLE_MUST_RESTORE_A_ACTIVE_AFTER_RUN:this.store.selectStage('LAFEA.1')");

assert.match(method, /error\.code = 'EMP1_A_CURRENT_QUALIFIED_RESULT_REQUIRED'/u);
assert.equal(method.includes('sample.aExecution'), false,
  'EMP1_QUALIFICATION_SAMPLE_MUST_NOT_INJECT_FACTORY_A_EXECUTION');
assert.match(method, /issueLafeaSourceAuthority\(\s*'LAFEA\.1',[\s\S]*?aSourceAuthority\.sourceHash/u,
  'EMP1_QUALIFICATION_SAMPLE_A_IMPORT_MUST_REPLACE_LIFECYCLE_AUTHORITY');
assert.match(method, /issueLafeaSourceAuthority\(\s*'LAFEA\.2',[\s\S]*?bSourceAuthority\.sourceHash/u,
  'EMP1_QUALIFICATION_SAMPLE_B_IMPORT_MUST_REPLACE_LIFECYCLE_AUTHORITY');

const factoryStart = sampleSource.indexOf('export function createEmp1WorkbenchQualificationSample()');
const factoryEnd = sampleSource.indexOf('\nfunction createQualificationAInput()', factoryStart);
assert.ok(factoryStart >= 0 && factoryEnd > factoryStart,
  'EMP1_QUALIFICATION_SAMPLE_FACTORY_BOUNDARY_REQUIRED');
const factory = sampleSource.slice(factoryStart, factoryEnd);
const factoryOrderedMarkers = [
  'const rawAInput = createQualificationAInput()',
  "normalizeLafeaStageDocument('LAFEA.1', rawAInput)",
  "executeLafeaStage('LAFEA.1', aDocument)",
  'refreshEmp1BSourceEvidence({',
];
previous = -1;
for (const marker of factoryOrderedMarkers) {
  const index = factory.indexOf(marker);
  assert.ok(index > previous, `EMP1_QUALIFICATION_SAMPLE_FACTORY_SEQUENCE_REQUIRED:${marker}`);
  previous = index;
}
assert.equal(factory.includes('aExecution,'), true,
  'EMP1_QUALIFICATION_SAMPLE_FACTORY_REFRESH_REQUIRES_PRIVATE_A_EXECUTION');

const returnStart = factory.indexOf('return deepFreeze({');
const returnEnd = factory.indexOf('\n  });', returnStart);
assert.ok(returnStart >= 0 && returnEnd > returnStart,
  'EMP1_QUALIFICATION_SAMPLE_FACTORY_RETURN_REQUIRED');
const factoryReturn = factory.slice(returnStart, returnEnd);
assert.match(factoryReturn, /\baDocument\b/u);
assert.match(factoryReturn, /\bbDocument\b/u);
assert.match(factoryReturn, /\brunInput\b/u);
assert.equal(/\baExecution\b/u.test(factoryReturn), false,
  'EMP1_QUALIFICATION_SAMPLE_FACTORY_MUST_NOT_EXPORT_A_EXECUTION');

// Runtime smoke specifically falsifies the EP-0023 failure mode: the returned
// A document must be the same normalized retained source identity accepted by
// executeLafeaStage() and the A-to-B refresh seam.
const sample = createEmp1WorkbenchQualificationSample();
assert.ok(sample?.aDocument, 'EMP1_QUALIFICATION_SAMPLE_RUNTIME_A_DOCUMENT_REQUIRED');
assert.ok(sample?.bDocument, 'EMP1_QUALIFICATION_SAMPLE_RUNTIME_B_DOCUMENT_REQUIRED');
assert.ok(sample?.runInput, 'EMP1_QUALIFICATION_SAMPLE_RUNTIME_RUN_INPUT_REQUIRED');
assert.equal(Object.hasOwn(sample, 'aExecution'), false,
  'EMP1_QUALIFICATION_SAMPLE_RUNTIME_MUST_REMAIN_SOURCE_ONLY');
const runtimeA = executeLafeaStage('LAFEA.1', sample.aDocument);
assert.equal(runtimeA.status, 'QUALIFIED', 'EMP1_QUALIFICATION_SAMPLE_RUNTIME_A_MUST_QUALIFY');
assert.equal(runtimeA.result?.qualification?.state, 'ACCEPTED',
  'EMP1_QUALIFICATION_SAMPLE_RUNTIME_A_MUST_BE_ACCEPTED');
assert.doesNotThrow(() => refreshEmp1BSourceEvidence({
  aDocument: sample.aDocument,
  aExecution: runtimeA,
  bDocument: sample.bDocument,
}), 'EMP1_QUALIFICATION_SAMPLE_RUNTIME_A_TO_B_REFRESH_MUST_ACCEPT_RETURNED_A');

// A complete-sample source replacement must not inherit an already-current
// lifecycle from a different A source. Exercise the existing explicit
// sourceHash import seam directly so this remains a non-browser falsifier for
// the source/lifecycle hash mismatch that motivated this release.
const replacementStore = createLafeaWorkbenchStore({ initialStage: 'LAFEA.1' });
const priorA = structuredClone(sample.aDocument);
priorA.modelIdentity = `${priorA.modelIdentity}-PRIOR-LIFECYCLE`;
const priorAuthority = issueLafeaSourceAuthority(
  'LAFEA.1',
  priorA,
  'EMP1_QUALIFICATION_SAMPLE_CHECK/PRIOR',
);
let replacementState = replacementStore.importDocument(
  priorA,
  'LAFEA.1',
  priorAuthority.sourceHash,
);
assert.equal(replacementState.stages['LAFEA.1'].lifecycleBinding.status, 'CURRENT');
assert.equal(
  replacementState.stages['LAFEA.1'].lifecycle.source.sourceHash,
  priorAuthority.sourceHash,
);
replacementState = replacementStore.run();
assert.equal(replacementState.status, 'READY');
assert.equal(replacementState.stages['LAFEA.1'].execution?.status, 'QUALIFIED');

const sampleAuthority = issueLafeaSourceAuthority(
  'LAFEA.1',
  sample.aDocument,
  'EMP1_QUALIFICATION_SAMPLE_CHECK/REPLACEMENT',
);
assert.notEqual(sampleAuthority.sourceHash, priorAuthority.sourceHash);
replacementState = replacementStore.importDocument(
  sample.aDocument,
  'LAFEA.1',
  sampleAuthority.sourceHash,
);
assert.equal(replacementState.stages['LAFEA.1'].lifecycleBinding.status, 'CURRENT');
assert.equal(
  replacementState.stages['LAFEA.1'].lifecycle.source.sourceHash,
  sampleAuthority.sourceHash,
);
replacementState = replacementStore.run();
assert.equal(replacementState.status, 'READY');
assert.equal(replacementState.diagnostics?.[0]?.code ?? null, null);
assert.equal(replacementState.stages['LAFEA.1'].execution?.status, 'QUALIFIED');
assert.equal(
  replacementState.stages['LAFEA.1'].execution?.result?.qualification?.state,
  'ACCEPTED',
);
replacementStore.destroy();

console.log(JSON.stringify({
  schema: 'emp1-qualification-sample-orchestration-check/v3',
  status: 'PASS_STATIC_QUALIFICATION_SAMPLE_A_THEN_B_THEN_C_CONTRACT',
  factorySourceIdentity: 'NORMALIZED_FACTORY_A_SOURCE',
  factoryRuntimeSmokePass: true,
  lifecycleReplacementSmokePass: true,
  aExecutionPath: 'NORMAL_CONTROLLER_STORE_RUN',
  aMustBeQualified: true,
  aQualificationMustBeAccepted: true,
  aRunFailureDiagnosticPreserved: true,
  bImportedAfterAQualified: true,
  cRunAfterBAndRunInput: true,
  productSidecarResetBeforeReplacement: true,
  factoryExecutionInjectionAllowed: false,
}, null, 2));