import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadedSourceReferenceUpdates, isAutomaticPipeMasterProposal, selectUnreservedMasterProposals } from '../src/workspace/load-calc-source-custody.js';
import { ProjectDataStore } from '../src/workspace/project-data/project-data-store.js';
import { LoadCalcConsumerController } from '../src/workspace/load-calc-consumer-controller.js';
import { WorkbenchController, createWorkbenchState } from '../src/workspace/load-calc-workbench/workbench-controller.js';
import { shellMarkup } from '../src/workspace/load-calc-workbench/workbench-view.js';
import { ENGINEERING_MODEL_EVENTS } from '../src/workspace/engineering-model-controller.js';
import { openFittingWeightDialog } from '../src/workspace/load-calc-fitting-weight-dialog.js';

const oldHash = 'a'.repeat(64), newHash = 'b'.repeat(64);
const store = new ProjectDataStore();
store.update('sourcesAndUnits.datasetSource', { path: 'old.json', sha256: oldHash },
  { source: 'Approved source', sourceKey: 'dataset', sourceHash: oldHash }, true);
const before = JSON.stringify(store.getProfile()), revision = store.getRuntimeRevision(), hash = store.getSemanticHash();
let notifications = 0;
store.subscribe(() => notifications++);
const audit = store.validate('normalization', { dataset: newHash });
assert(audit.errors.some(row => row.code === 'STALE_SOURCE_HASH'));
assert.equal(JSON.stringify(store.getProfile()), before, 'Validation must not rebind engineering evidence');
assert.equal(store.getRuntimeRevision(), revision);
assert.equal(store.getSemanticHash(), hash);
assert.equal(notifications, 0);
const input = { dataset: { sourceSha256: newHash, sourceName: 'new.json' },
  masters: { pipingClass: { sourceHash: newHash, fileName: 'class.json' } }, profile: store.getProfile() };
const immutable = JSON.stringify(input);
const updates = loadedSourceReferenceUpdates(input);
assert.deepEqual(updates.map(row => row.path), ['sourcesAndUnits.datasetSource', 'sourcesAndUnits.pipingClassSource']);
assert.equal(JSON.stringify(input), immutable);
assert(!updates.some(row => row.path.includes('lineList')), 'An absent line list is not permission to erase retained provenance');
assert.equal(loadedSourceReferenceUpdates({ ...input, dataset: { sourceSha256: 'not-a-hash' }, masters: {} }).length, 0);
updates.forEach(row => store.update(row.path, row.value, row.evidence, true));
assert.deepEqual(store.getProfile().loadCalculation, input.profile.loadCalculation, 'File binding cannot reapprove numerical values');
assert.equal(loadedSourceReferenceUpdates({ ...input, profile: store.getProfile() }).length, 0, 'Identity updates are idempotent');
store.update('sourcesAndUnits.lineListSource', { path: 'retained.xlsx', sha256: oldHash },
  { source: 'Retained line list', sourceKey: 'lineList', sourceHash: oldHash }, true);
assert(store.validate('loads', { dataset: newHash }).errors.some(row => row.path === 'sourcesAndUnits.lineListSource' && row.code === 'ACTIVE_SOURCE_HASH_MISSING'));

const exact = { record: { authority: 'EXACT_APPROVED_MASTER', fieldId: 'PIPE_WALL_THICKNESS',
  evidence: { matchMode: 'EXACT', sourceSemanticHash: 'model:A' } } };
assert.equal(isAutomaticPipeMasterProposal(exact), true);
const proposed = [1, 2, 3].map(n => ({ ...exact, proposalId: 'generated-' + n,
  record: { ...exact.record, selectorKey: 'pipe-' + n, value: 5 } }));
const reserved = { acceptedRecords: [proposed[0].record],
  proposals: [{ proposalId: 'independent-manual-id', record: { ...proposed[1].record, value: 7 } }] };
const reservedBefore = JSON.stringify(reserved);
assert.deepEqual(selectUnreservedMasterProposals(proposed, reserved), [proposed[2]]);
assert.equal(JSON.stringify(reserved), reservedBefore, 'Bootstrap cannot replace or accept a pending manual field choice');
for (const record of [
  { ...exact.record, fieldId: 'COMPONENT_WEIGHT' },
  { ...exact.record, fieldId: 'UNRECOGNIZED' },
  { ...exact.record, authority: 'USER_CONFIRMED' },
  { ...exact.record, evidence: { ...exact.record.evidence, matchMode: 'APPROXIMATE_CLASS_MATCH' } },
  { ...exact.record, evidence: { matchMode: 'EXACT' } },
]) assert.equal(isAutomaticPipeMasterProposal({ record }), false);
const bootstrap = readFileSync('src/workspace/master-data-ui.js', 'utf8').split('export async function autoGenerateMasterEnrichment()')[1].split('export async function autoBindMasterSources()')[0];
assert.doesNotMatch(bootstrap, /acceptAllProposals|fittingWeightRecordFor|reviewerSelected/);
assert.match(bootstrap, /newProposals.filter\(isAutomaticPipeMasterProposal\)/);

const published = [];
const controller = new LoadCalcConsumerController({}, { getContext: () => null },
  { publish: (topic, payload) => published.push({ topic, payload }) });
assert.equal(controller.activeTab, 'workbench');
for (const [tab, stage, tool] of [['preview', 1, 'preview'], ['masters', 0, 'masters'],
  ['project-data', 0, 'project-data'], ['verify', 2, null], ['loads', 3, null], ['seal-export', 3, 'seal-export']]) {
  controller.selectTab(tab);
  assert.equal(controller.activeTab, 'workbench');
  assert.equal(controller.workbenchState.stage, stage);
  assert.equal(controller.workbenchState.toolTab, tool);
}
controller.runCurrentCalculation();
assert.equal(published.length, 1);
assert.equal(published[0].topic, ENGINEERING_MODEL_EVENTS.CURRENT_COMMON_INPUT_CALCULATE_REQUESTED);
controller.selectTab('legacy'); assert.equal(controller.activeTab, 'topology');
controller.selectTab('workbench'); assert.equal(controller.activeTab, 'workbench');

const review = { mode: 'prepared', rows: [], branches: [], supports: [], issueGroups: [],
  sourceLengthUnit: 'unknown', dataset: { sourceName: 'fixture', entities: [], sharedModel: {} }, status: null };
const state = { ...createWorkbenchState(), stage: 2 };
assert.doesNotMatch(shellMarkup(review, state), /data-load-calc-run/, 'Standalone read-only prototype cannot execute');
assert.match(shellMarkup(review, state, { eligible: true, ready: false, label: 'Run gravity' }), /data-load-calc-run/);
assert.match(shellMarkup(review, state, { eligible: false, ready: false, label: 'Run gravity' }), /data-load-calc-run disabled/);
assert.match(shellMarkup(review, { ...state, toolTab: 'preview' }, { eligible: true }), /data-workbench-tool/);
const delegated = new WorkbenchController({}, { prepare: () => review, getBinding: () => 'A' });
delegated.checkCurrent = () => { throw Error('Run delegation must not invoke a second authority'); };
delegated.click({ target: { closest: () => ({ dataset: {}, hasAttribute: key => key === 'data-load-calc-run' }) } });
const css = readFileSync('src/workspace/load-calc-workbench/workbench-shell.css', 'utf8');
assert.match(css, /\.workspace-shell\[data-workbench-view="load-calc"\]:has/);
assert.doesNotMatch(css, /\.workspace-shell:has/, 'Hidden default mount cannot hide Workspace imports');
let catalogueBinding = 'source-A:master-A', applied = 0, clickHandler;
const note = { textContent: '' };
const host = { dataset: {}, addEventListener: (name, handler) => { if (name === 'click') clickHandler = handler; },
  querySelector: () => note, remove: () => { throw Error('Stale review cannot be silently dismissed as success'); } };
openFittingWeightDialog({ documentRef: { createElement: () => host, body: { appendChild() {} } },
  dataset: { sharedModel: { semanticHash: 'source-A', components: [] } }, masters: {},
  getBinding: () => catalogueBinding, onAccept: () => applied++ });
catalogueBinding = 'source-B:master-A';
clickHandler({ target: { closest: selector => selector === '[data-lcfw-apply]' } });
assert.match(note.textContent, /changed/); assert.equal(applied, 0);
catalogueBinding = 'source-A:master-B';
clickHandler({ target: { closest: selector => selector === '[data-lcfw-apply]' } });
assert.match(note.textContent, /no selections were applied/); assert.equal(applied, 0);
console.log('PASS workbench migration: pure validation, identity-only source binding, absent-source rejection, exact pipe-only bootstrap, owner Run delegation, embedded tools, prototype no-run, active-route layout.');
