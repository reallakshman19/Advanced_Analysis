import assert from 'node:assert/strict';
import { EngineeringModelController, ENGINEERING_MODEL_EVENTS } from '../src/workspace/engineering-model-controller.js';
import { engineeringModelStore } from '../src/workspace/engineering-model-store.js';
import { nonFeaCommonInputStore } from '../src/workspace/non-fea-common-input-store.js';

// Subscriber boundary falsifier. These result/receipt observation doubles are
// not numerical validation; actual accepted-input browser execution is separate.
const originalGet = engineeringModelStore.getDistribution;
const originalMark = engineeringModelStore.markEmpiricalStale;
let result;
let receipt;
let refreshes = 0;
const published = [];
const marks = [];
const controller = new EngineeringModelController({
  subscribe() { return () => {}; },
  publish(topic, payload) { published.push({ topic, payload }); },
}, { getSnapshot: () => ({ dataset: { version: 3 } }) }, {
  executeEmpirical() { throw new Error('not used'); },
  refreshEmpirical() { refreshes += 1; return {}; },
}, { currentCommonInputExecutor() { throw new Error('not used'); } });
engineeringModelStore.getDistribution = () => result;
engineeringModelStore.markEmpiricalStale = (code, version) => {
  marks.push({ code, version });
  result = { ...result, freshness: { status: 'STALE' } };
  receipt = null;
};
const base = nonFeaCommonInputStore.getSnapshot();
function establishCurrent() {
  result = { freshness: { status: 'CURRENT' } };
  receipt = { identity: 'CURRENT-OBSERVATION-DOUBLE' };
}
try {
  controller.init();
  establishCurrent();
  const currentResult = result;
  const currentReceipt = receipt;
  for (const patch of [{}, { staleness: { stale: false, changes: [] } },
    { message: 'Evaluated', version: 12 }, { consumptionExecutions: [{ executionId: 'receipt' }] }]) {
    controller.handleCommonInputSnapshot({ ...base, ...patch });
    assert.equal(result, currentResult); assert.equal(receipt, currentReceipt);
  }
  for (const code of ['ENRICHMENT_RECORD_ACCEPTED', 'ENRICHMENT_RECORD_REMOVED',
    'ENRICHMENT_SIDECAR_IMPORTED', 'ENRICHMENT_CLEARED', 'RESOLUTION_LEDGER_CHANGED']) {
    establishCurrent();
    const stale = { ...base, staleness: { stale: true, changes: [{ code }] } };
    const count = marks.length;
    controller.handleCommonInputSnapshot(stale);
    assert.equal(result.freshness.status, 'STALE', `${code} must invalidate CURRENT numerical results`);
    assert.equal(receipt, null, `${code} must clear the current receipt`);
    assert.deepEqual(marks.at(-1), { code, version: 3 });
    assert.equal(published.at(-1).topic, ENGINEERING_MODEL_EVENTS.CHANGED);
    assert.equal(published.at(-1).payload.authorityReason, code);
    controller.handleCommonInputSnapshot(stale);
    assert.equal(marks.length, count + 1, 'repeated stale reports must not recursively invalidate');
  }
  establishCurrent();
  controller.handleCommonInputSnapshot({ ...base, staleness: { stale: true, changes: [] } });
  assert.equal(marks.at(-1).code, 'COMMON_INPUT_STALE');
  assert.equal(receipt, null);
  assert.equal(refreshes, 6);
  console.log('PASS Common Input subscriber currentness: unchanged configuration/evaluation/receipt preserve results; stale authority invalidates once and clears current receipt.');
} finally {
  controller.destroy();
  engineeringModelStore.getDistribution = originalGet;
  engineeringModelStore.markEmpiricalStale = originalMark;
}
