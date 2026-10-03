import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeWorkspaceDataset } from '../src/workspace/dataset-adapter.js';
import { normalizeWeight } from '../src/workspace/master-data-normalizers.js';
import { buildFittingWeightReviewRows, fittingWeightRecordFor } from '../src/workspace/load-calc-fitting-weight-review.js';
import { openFittingWeightDialog } from '../src/workspace/load-calc-fitting-weight-dialog.js';
import { NonFeaEnrichmentStore } from '../src/workspace/enrichment/non-fea-enrichment-store.js';
import { createNonFeaEnrichmentSidecar } from '../src/core/non-fea-enrichment/index.js';

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const dataset = normalizeWorkspaceDataset(JSON.parse(read('../public/fixtures/Sjson.json')), 'Sjson.json');
const masters = { weight: { fileName: 'wtValveweights.json', sourceHash: 'controlled-master-hash', normalizedRows:
  normalizeWeight(JSON.parse(read('../src/master-data/wtValveweights.json')), {
    bore: 'DN', nps: 'NS', rating: 'Rating', length: 'RF-F/F', valveType: 'TypeDesc', weight: 'RF/RTJ KG',
  }) } };
const before = JSON.stringify({ dataset, masters });
const review = buildFittingWeightReviewRows({ dataset, masters });
const flange = review.rows.find(row => row.targetId === '=1006649732/51234');
assert.equal(flange.candidates[0].weightKg, 59);
const zeroFor = row => fittingWeightRecordFor(row, { weightKg: 0, typeDesc: 'MANUAL', manualEntry: true,
  lengthQualified: false, reason: 'Explicit Skip → 0 kg assumption.' }, -1, masters);
const zero = zeroFor(flange);
assert.equal(zero.authority, 'ACCEPTED_OVERRIDE');
assert.equal(zero.evidence.zeroWeightAssumption, true);
const store = new NonFeaEnrichmentStore(); store.loadSource(dataset.sharedModel.semanticHash);
const unrelated = { ...zero, recordId: 'unrelated-proposal' };
store.stageProposal({ proposalId: 'unrelated-proposal', record: unrelated, rationale: 'Unrelated draft' });
const preApply = JSON.stringify(store.getSnapshot());
const otherZero = zeroFor(review.rows.find(row => row.targetId === '=1006649732/51236'));
assert.throws(() => store.applyReviewedComponentWeights([zero]), /Explicit/);
for (const bad of [{ ...otherZero, fieldId: 'INSULATION_THICKNESS' }, { ...otherZero, value: -1 },
  { ...otherZero, value: NaN }, { ...otherZero, evidence: { ...otherZero.evidence, sourceSemanticHash: 'stale' } },
  { ...otherZero, evidence: { ...otherZero.evidence, reviewerSelected: false } },
  { ...otherZero, authority: 'EXACT_APPROVED_MASTER' }]) {
  assert.throws(() => store.applyReviewedComponentWeights([zero, bad], { weightReviewConfirmed: true }));
  assert.equal(JSON.stringify(store.getSnapshot()), preApply, 'Entire batch is atomic');
}
assert.throws(() => store.applyReviewedComponentWeights([zero, zero], { weightReviewConfirmed: true }));
store.applyReviewedComponentWeights([zero], { weightReviewConfirmed: true });
assert.equal(store.getSnapshot().acceptedRecords.length, 1);
assert.equal(store.getSnapshot().proposals.length, 1, 'Unrelated proposal is never accepted or removed');
assert.equal(buildFittingWeightReviewRows({ dataset, masters, sidecar: createNonFeaEnrichmentSidecar({
  sourceSemanticHash: dataset.sharedModel.semanticHash, records: store.getSnapshot().acceptedRecords,
}) }).rows.some(row => row.targetId === flange.targetId), false, 'Applied reviewed zero no longer requests review');
store.loadSource('changed-source');
assert.throws(() => store.applyReviewedComponentWeights([zero], { weightReviewConfirmed: true }), /stale/);
const catalogueStore = new NonFeaEnrichmentStore(); catalogueStore.loadSource(dataset.sharedModel.semanticHash);
const catalogueRecord = fittingWeightRecordFor(flange, flange.candidates[0], 0, masters);
catalogueStore.applyReviewedComponentWeights([catalogueRecord], { weightReviewConfirmed: true });
assert.equal(catalogueStore.getSnapshot().acceptedRecords[0].value, 59);
assert.equal(catalogueStore.getSnapshot().acceptedRecords[0].authority, 'EXACT_APPROVED_MASTER');
assert.equal(catalogueStore.getSnapshot().acceptedRecords[0].evidence.weightMasterSourceHash, masters.weight.sourceHash);

function dialogHarness(data = dataset, master = masters, fail = false) {
  const handlers = {}, inputs = new Map(), statuses = new Map(), note = { textContent: '' }, count = { textContent: '' };
  let removed = false, accepted = [], binding = 'current';
  const host = { dataset: {}, innerHTML: '', addEventListener: (name, callback) => { handlers[name] = callback; },
    remove: () => { removed = true; }, querySelectorAll: () => [], querySelector: selector => {
      if (selector === '[data-lcfw-note]') return note;
      if (selector === '[data-lcfw-count]') return count;
      const statusId = /data-lcfw-status="([^"]+)"/.exec(selector)?.[1];
      if (statusId) { if (!statuses.has(statusId)) statuses.set(statusId, { textContent: '' }); return statuses.get(statusId); }
      const id = /data-lcfw-weight="([^"]+)"/.exec(selector)?.[1];
      if (!id) return null;
      if (!inputs.has(id)) {
        const html = host.innerHTML.match(new RegExp(`data-lcfw-weight="${id}"[^>]*data-lcfw-selected-index="([^"]*)" value="([^"]*)"`));
        if (!html) return null;
        inputs.set(id, { value: html[2], dataset: { lcfwSelectedIndex: html[1] } });
      }
      return inputs.get(id);
    } };
  openFittingWeightDialog({ documentRef: { createElement: () => host, body: { appendChild() {} } },
    dataset: data, masters: master, getBinding: () => binding, onAccept: records => {
      if (fail) throw new Error('Validation failed'); accepted = records;
    } });
  const action = (selector, values = {}) => handlers.click({ target: { closest: key => key === selector ? { dataset: values } : null } });
  const search = value => handlers.input({ target: { matches: selector => selector === '[data-lcfw-search]', value } });
  const edit = (id, value) => { const input = host.querySelector(`[data-lcfw-weight="${id}"]`); input.value = value;
    handlers.input({ target: { ...input, dataset: { ...input.dataset, lcfwWeight: id }, matches: selector => selector === '[data-lcfw-weight]' } }); };
  return { host, note, inputs, statuses, action, search, edit, changeBinding: () => { binding = 'changed'; },
    get accepted() { return accepted; }, get removed() { return removed; } };
}
const h = dialogHarness();
assert.match(h.host.innerHTML, /Suggested · not applied/);
assert.match(h.host.innerHTML, /data-lcfw-settings/);
assert.match(h.host.innerHTML, /data-lcfw-skip-shown/);
assert.match(h.host.innerHTML, /data-lcfw-row="=1006649732\/51234"/);
assert.doesNotMatch(h.host.innerHTML, /UNSUPPORTED_COMPONENT_TYPE/);
assert.equal(h.accepted.length, 0, 'Opening/prefilling writes nothing');
h.search('51234'); h.action('[data-lcfw-skip-shown]');
assert.equal(h.inputs.get(flange.targetId).value, '0');
assert.equal(h.statuses.get(flange.targetId).textContent, 'Zero assumption · not applied');
assert.equal(h.accepted.length, 0, 'Skip is draft until Apply');
h.action('[data-lcfw-apply]');
assert.equal(h.accepted.length, 1, 'Only filtered/shown row applied');
assert.equal(h.accepted[0].value, 0);
assert.equal(h.accepted[0].evidence.zeroWeightAssumption, true);
assert.equal(h.removed, true);
const cancelled = dialogHarness(); cancelled.action('[data-lcfw-skip-shown]'); cancelled.action('[data-lcfw-close]');
assert.equal(cancelled.accepted.length, 0);
const edited = dialogHarness(); edited.edit(flange.targetId, '60');
assert.equal(edited.statuses.get(flange.targetId).textContent, 'Entered weight · not applied');
edited.edit(flange.targetId, ''); assert.equal(edited.statuses.get(flange.targetId).textContent, 'Enter weight or Skip');
const stale = dialogHarness(); stale.changeBinding(); stale.action('[data-lcfw-apply]');
assert.equal(stale.accepted.length, 0); assert.equal(stale.removed, false); assert.match(stale.note.textContent, /changed/);
const failed = dialogHarness(dataset, masters, true); failed.action('[data-lcfw-apply]');
assert.equal(failed.removed, false); assert.match(failed.note.textContent, /Nothing applied: Validation failed/);
const unknown = { sharedModel: { semanticHash: dataset.sharedModel.semanticHash, components: [{
  componentKey: 'unknown', sourceEntityId: 'unknown', type: 'FLAN', engineeringProperties: {},
}] }, entities: [] };
const missing = dialogHarness(unknown, {});
assert.match(missing.host.innerHTML, /Bore missing — enter a weight or Skip/);
assert.match(missing.host.innerHTML, /data-lcfw-weight="unknown"/);
missing.action('[data-lcfw-skip]', { lcfwSkip: 'unknown' }); missing.action('[data-lcfw-apply]');
assert.equal(missing.accepted[0].value, 0, 'No master/bore still permits explicit reviewed zero');
assert.equal(JSON.stringify({ dataset, masters }), before);
const controller = read('../src/workspace/load-calc-consumer-controller.js');
const primaryHandler = controller.slice(controller.indexOf("if (event.target.closest('[data-load-calc-weight-review]'))"), controller.indexOf('const supportEntityId ='));
assert.match(primaryHandler, /reviewFittingWeights/); assert.doesNotMatch(primaryHandler, /openWeightReviewDialog/);
const owner = read('../src/workspace/enrichment/non-fea-enrichment-view.js');
assert.match(owner, /export function reviewFittingWeights/);
assert.match(owner, /applyReviewedComponentWeights\(records, \{ weightReviewConfirmed: true \}\)/);
console.log('PASS unified weight table: same primary/catalogue owner, editable missing rows, no opening/cancel writes, filtered row/bulk zero drafts and explicit Apply custody, atomic/invalid/stale guards, unrelated proposals retained, source/master immutable.');
