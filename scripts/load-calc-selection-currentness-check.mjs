import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatasetController } from '../src/workspace/dataset-controller.js';
import { EventBus } from '../src/workspace/event-bus.js';
import { EVENT_TOPICS } from '../src/workspace/event-topics.js';
import { WorkspaceStateStore } from '../src/workspace/workspace-state.js';
import { SharedModelController } from '../src/workspace/shared-model-controller.js';
import { SHARED_MODEL_EVENTS } from '../src/workspace/shared-model-events.js';
import { TopologyController } from '../src/workspace/topology-controller.js';
import { TopologyStore } from '../src/workspace/topology-store.js';
import { TOPOLOGY_EVENTS } from '../src/workspace/topology-events.js';
import { SupportRestraintController } from '../src/workspace/support-restraint-controller.js';
import { SUPPORT_RESTRAINT_EVENTS } from '../src/workspace/support-restraint-events.js';
import { ModelLoadController } from '../src/workspace/model-load-controller.js';
import { ModelLoadStore } from '../src/workspace/model-load-store.js';
import { MODEL_LOAD_EVENTS } from '../src/workspace/model-load-events.js';
import { EngineeringModelController } from '../src/workspace/engineering-model-controller.js';
import { engineeringModelStore } from '../src/workspace/engineering-model-store.js';
import { nonFeaCommonInputStore } from '../src/workspace/non-fea-common-input-store.js';

// Real source/selection/derived-contract routing. Current result and seal are
// observation doubles, not synthetic engineering numerical PASS claims.
const workspace = new WorkspaceStateStore();
const source = JSON.parse(await readFile(new URL('../public/fixtures/Sjson.json', import.meta.url), 'utf8'));
const trace = [];
const selected = [];
const topics = [SHARED_MODEL_EVENTS.CHANGED, TOPOLOGY_EVENTS.CHANGED,
  SUPPORT_RESTRAINT_EVENTS.CHANGED, MODEL_LOAD_EVENTS.CHANGED];
const monitors = topics.map(topic => EventBus.subscribe(topic, payload => trace.push({ topic, payload })));
monitors.push(EventBus.subscribe(EVENT_TOPICS.VIEWPORT_ENTITY_SELECTED, payload => selected.push(payload)));
const originals = {
  getDistribution: engineeringModelStore.getDistribution,
  markEmpiricalStale: engineeringModelStore.markEmpiricalStale,
  markCommonStale: nonFeaCommonInputStore.markStale,
};
let result = null;
let receipt = null;
const staleCodes = [];
const sealStales = [];
engineeringModelStore.getDistribution = () => result;
engineeringModelStore.markEmpiricalStale = code => {
  staleCodes.push(code);
  receipt = null;
  result = result ? { ...result, freshness: { status: 'STALE', reason: code } } : null;
  return result;
};
nonFeaCommonInputStore.markStale = code => { sealStales.push(code); return {}; };
const dataset = new DatasetController(EventBus, workspace);
const engineering = new EngineeringModelController(EventBus, workspace, {
  refreshEmpirical() { return {}; }, executeEmpirical() { throw new Error('not used'); },
}, { currentCommonInputExecutor() { throw new Error('not used'); } });
const shared = new SharedModelController(EventBus, workspace);
const topology = new TopologyController(EventBus);
const supports = new SupportRestraintController(EventBus);
const loads = new ModelLoadController(EventBus);
const controllers = [dataset, engineering, shared, topology, supports, loads];
function establishCurrent() {
  const active = workspace.getSnapshot().dataset;
  result = { datasetId: active.datasetId, datasetVersion: active.version || null,
    freshness: { status: 'CURRENT' }, semanticHash: 'TEST-UNCHANGED-RESULT' };
  receipt = Object.freeze({ identity: 'TEST-CURRENT-RECEIPT' });
  trace.length = 0; staleCodes.length = 0; sealStales.length = 0;
}
try {
  controllers.forEach(controller => controller.init());
  assert.equal(trace.filter(row => row.topic === SHARED_MODEL_EVENTS.CHANGED).length, 1,
    'first empty source publication must not be suppressed');
  assert.equal(trace.find(row => row.topic === SHARED_MODEL_EVENTS.CHANGED).payload.model, null);
  dataset.load({ rawPackage: source, sourceName: 'Sjson.json' });
  assert.equal(workspace.getSnapshot().dataset.entities.length, 279);
  assert.ok(TopologyStore.getGraph()); assert.ok(ModelLoadStore.getFoundation());
  establishCurrent();
  const before = workspace.getSnapshot();
  const beforeResult = result; const beforeReceipt = receipt;
  const beforeGraph = TopologyStore.getGraph(); const beforeLoads = ModelLoadStore.getFoundation();
  EventBus.publish(EVENT_TOPICS.VIEWPORT_SELECTION_REQUESTED, { entityId: '=1006649732/51458', source: 'load-table' });
  console.log(JSON.stringify({ selectionAuthorityEvents: trace.map(row => row.topic), firstInvalidation: staleCodes[0] || null }));
  assert.equal(workspace.getSnapshot().selectedEntityId, '=1006649732/51458');
  assert.ok(workspace.getSnapshot().version > before.version);
  assert.equal(workspace.getSnapshot().engineeringVersion, before.engineeringVersion);
  assert.equal(selected.at(-1).entityId, '=1006649732/51458');
  assert.equal(trace.length, 0, 'selection must not masquerade as a source/authority change');
  assert.deepEqual(staleCodes, []); assert.deepEqual(sealStales, []);
  assert.equal(result, beforeResult); assert.equal(receipt, beforeReceipt);
  assert.equal(TopologyStore.getGraph(), beforeGraph); assert.equal(ModelLoadStore.getFoundation(), beforeLoads);
  EventBus.publish(EVENT_TOPICS.VIEWPORT_SELECTION_REQUESTED, { entityId: '=1006649732/51462', source: 'load-table' });
  EventBus.publish(EVENT_TOPICS.WORKSPACE_SNAPSHOT_CHANGED, { snapshot: workspace.getSnapshot() });
  assert.equal(trace.length, 0); assert.equal(receipt, beforeReceipt);
  assert.equal(selected.at(-1).entityId, '=1006649732/51462');

  // Immutable source patch, even identical content, is not a UI-only revision.
  for (const model of [workspace.getSnapshot().dataset.sharedModel,
    structuredClone(workspace.getSnapshot().dataset.sharedModel)]) {
    establishCurrent();
    const changed = workspace.patchSharedModel(model);
    EventBus.publish(EVENT_TOPICS.WORKSPACE_SNAPSHOT_CHANGED, { snapshot: changed });
    assert.equal(trace.filter(row => row.topic === SHARED_MODEL_EVENTS.CHANGED).length, 1);
    assert.ok(staleCodes.length); assert.ok(sealStales.length); assert.equal(receipt, null);
  }
  // Replacement must publish even when reusing the exact shared-model object.
  establishCurrent();
  const replacement = workspace.loadDataset({ ...workspace.getSnapshot().dataset, version: 1 });
  EventBus.publish(EVENT_TOPICS.WORKSPACE_SNAPSHOT_CHANGED, { snapshot: replacement });
  assert.equal(trace.filter(row => row.topic === SHARED_MODEL_EVENTS.CHANGED).length, 1);
  assert.ok(staleCodes.length); assert.equal(receipt, null);

  // Explicit engineering rebuilds stay on their existing invalidation path.
  for (const [topic, code] of [[TOPOLOGY_EVENTS.REBUILD_EXACT_REQUESTED, 'TOPOLOGY_AUTHORITY_CHANGED'],
    [SUPPORT_RESTRAINT_EVENTS.REBUILD_EVIDENCE_REQUESTED, 'SUPPORT_RESTRAINT_AUTHORITY_CHANGED'],
    [MODEL_LOAD_EVENTS.REBUILD_REQUESTED, 'MODEL_LOAD_AUTHORITY_CHANGED']]) {
    establishCurrent();
    EventBus.publish(topic, {});
    assert.ok(sealStales.includes(code), `${topic} must still stale the seal`);
    assert.ok(staleCodes.length, `${topic} must still stale numerical results`);
    assert.equal(receipt, null);
  }
  establishCurrent();
  dataset.clear();
  assert.equal(trace.filter(row => row.topic === SHARED_MODEL_EVENTS.CHANGED).length, 1);
  assert.equal(trace.find(row => row.topic === SHARED_MODEL_EVENTS.CHANGED).payload.model, null);
  assert.ok(sealStales.includes('NO_ACTIVE_DATASET'));
  shared.destroy(); trace.length = 0;
  shared.init();
  assert.equal(trace.filter(row => row.topic === SHARED_MODEL_EVENTS.CHANGED).length, 1,
    'controller restart must replay initial source for new downstream consumers');
  console.log('PASS selection currentness: real Sjson routing preserves source/contracts/result/receipt on UI selection; patch/replacement/clear and explicit engineering rebuilds retain invalidation.');
} finally {
  controllers.slice().reverse().forEach(controller => controller.destroy());
  monitors.forEach(unsubscribe => unsubscribe());
  engineeringModelStore.getDistribution = originals.getDistribution;
  engineeringModelStore.markEmpiricalStale = originals.markEmpiricalStale;
  nonFeaCommonInputStore.markStale = originals.markCommonStale;
}
