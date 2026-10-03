import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeWorkspaceDataset } from '../src/workspace/dataset-adapter.js';
import { buildSupportSiteModel } from '../src/workspace/support-sites/support-site-model.js';
import { draftSupportLoadsModel, firstLoadedSupportEntityId } from '../src/workspace/load-calc-workbench/draft-support-loads.js';
import { supportMarkup, mountDraftLoadsInspector } from '../src/workspace/load-calc-workbench/draft-loads-inspector.js';
import { createTopologyEditEditorStore } from '../src/workspace/topology-edit/editor-state/topology-edit-editor-store.js';
import { EVENT_TOPICS, APPLICATION_EVENTS } from '../src/workspace/event-topics.js';
import { createEmpiricalResultOverlay } from '../src/workspace/engineering-loads/empirical-result-overlay.js';

const load = path => JSON.parse(readFileSync(path, 'utf8'));
const sourceBytes = readFileSync('public/fixtures/Sjson.json');
const dataset = normalizeWorkspaceDataset(JSON.parse(sourceBytes), 'Sjson.json', {
  sourceBytes, sourceSha256: createHash('sha256').update(sourceBytes).digest('hex') });
const supportSiteModel = buildSupportSiteModel(dataset, load('relay/WORK/load-calc-run-readiness-v32-project-data.json'));
const receipt = load(process.argv[2] || 'relay/WORK/load-calc-new-ui-v32-gravity-export.json').receipt;
// Captured existing browser receipt: identity/custody regression, not a mechanics oracle.
const bundle = { datasetId: receipt.datasetId, execution: receipt, distribution: receipt.distribution, supportSiteModel,
  screeningContext: { dataset, commonState: { staleness: { stale: false }, request: { semanticHash: 'captured' },
    commonInput: { semanticHash: receipt.commonInputSemanticHash, seal: { semanticHash: receipt.commonInputSealSemanticHash },
      requestSemanticHash: 'captured' } } } };
const canonical = { datasetId: bundle.datasetId, sourceHash: 'same-source', canonicalTopologyHash: 'same-topology',
  supports: supportSiteModel.sites.flatMap(s => s.memberEntityIds.map(entityId => ({ id: `support:${entityId}`, entityId,
    sourceEntityIds: [entityId] }))) };
const draft = { dataset, canonical, baseCanonical: canonical };
const id = firstLoadedSupportEntityId(bundle);
const site = supportSiteModel.sites.find(s => s.primaryEntityId === id);
const select = ids => draftSupportLoadsModel(bundle, draft, ids.map(i => `support:${i}`));
const original = JSON.stringify({ bundle, draft });
const current = select([id]);
assert.equal(current.state, 'CURRENT');
assert.equal(current.supports.length, 1);
assert.equal(current.supports[0].siteId, site.siteId);
for (const row of current.supports[0].gravity) {
  const expected = receipt.distribution.loadCases.find(c => c.loadCaseId === row.loadCaseId).supportResults.find(s => s.supportSiteId === site.siteId);
  assert.equal(row.verticalForceN, expected.verticalForceN);
  assert.equal(row.transferMomentNmm, expected.cantileverMomentDemandNmm);
  assert.equal(row.status, expected.status);
}
assert.equal(current.supports[0].scenario.length, 0);
assert.equal(select([]).state, 'SELECT_SUPPORT');
assert.equal(draftSupportLoadsModel(bundle, draft, ['pipe:not-a-support']).state, 'SELECT_SUPPORT');
const restraintDraft = { ...draft, canonical: { ...canonical, supports: [{
  id: `support:${id}`, entityId: id, restraints: [{ id: 'restraint:chosen', supportType: 'REST' }] }] } };
assert.equal(draftSupportLoadsModel(bundle, restraintDraft, ['restraint:chosen']).supports[0].siteId, site.siteId);
const multi = select([id, ...site.memberEntityIds]);
assert.equal(multi.supports.length, 1, 'Co-located source members map to one exact physical site.');
const two = select([id, supportSiteModel.sites.find(s => s.siteId !== site.siteId).primaryEntityId]);
assert.equal(two.supports.length, 2, 'Distinct sites stay distinct, with no force summation.');
const zeroSite = supportSiteModel.sites.find(s => receipt.distribution.loadCases.every(c => c.supportResults.find(r => r.supportSiteId === s.siteId)?.verticalForceN === 0));
assert(zeroSite);
assert.equal(select([zeroSite.primaryEntityId]).supports[0].gravity[0].verticalForceN, 0);
for (const badDraft of [ { ...draft, dataset: { ...dataset } },
  { ...draft, canonical: { ...canonical, datasetId: 'other' } },
  { ...draft, canonical: { ...canonical, sourceHash: 'other' } },
  { ...draft, canonical: { ...canonical, canonicalTopologyHash: 'edited' } },
  { ...draft, staleReason: 'source changed' } ]) {
  assert.equal(draftSupportLoadsModel(bundle, badDraft, [`support:${id}`]).supports.length, 0);
}
for (const mutate of [ b => { b.execution.semanticHash = 'tampered'; },
  b => { b.screeningContext.commonState.commonInput.seal.semanticHash = 'other'; },
  b => { b.screeningContext.commonState.staleness.stale = true; },
  b => { b.screeningContext.dataset.sourceSha256 = 'other'; },
  b => { b.distribution.freshness.status = 'STALE'; },
  b => { b.distribution.loadCases[0].supportResults[0].verticalForceN += 1; },
  b => { b.supportSiteModel.sites[0].tags.push('changed'); } ]) {
  const changed = structuredClone(bundle); mutate(changed);
  assert.equal(draftSupportLoadsModel(changed, { ...draft, dataset: changed.screeningContext.dataset }, [`support:${id}`]).state, 'RESULTS_UNAVAILABLE');
}
const unknown = { ...draft, canonical: { ...canonical, supports: [{ id: 'unknown', entityId: 'unknown' }] } };
assert.equal(draftSupportLoadsModel(bundle, unknown, ['unknown']).state, 'NO_SITE');
const html = supportMarkup({ ...current.supports[0], label: '<PS>' }, 'OPE', current);
assert.match(html, /&lt;PS&gt;/);
assert.match(html, /not calculated for this support\/case/);
assert.match(html, /chainage demand, not a solved global moment/);
assert.match(supportMarkup(select([zeroSite.primaryEntityId]).supports[0], 'OPE', current), /<strong>0(?: N)?<\/strong>/);

// Synthetic signed method-owned vectors test presentation only, never actual source qualification.
const proposal = { semanticHash: 'proposal', scenarioId: 'scenario', adaptedRequest: { semanticHash: 'request', datasetId: bundle.datasetId,
  coordinateFrame: { forceOutputConvention: 'RESTRAINT_ON_PIPE', momentOutputConvention: 'RESTRAINT_ON_PIPE' },
  restraintOccurrences: ['R1', 'R2'].map(restraintId => ({ restraintId, supportSiteId: site.siteId, attachmentPointMm: { x: 0, y: 0, z: 0 } })) },
  runtimeProfile: { semanticHash: 'profile' } };
const authorization = { semanticHash: 'authorization' };
const execution = { semanticHash: 'execution', executionId: 'E', method: 'EMPIRICAL_BEAM_CONTACT_V1', executedAt: '2026-10-03T00:00:00Z',
  coreResult: { status: 'CALCULATED', loadCases: [{ loadCaseId: 'OPE', status: 'CALCULATED', supportResults: ['R1', 'R2'].map(restraintId => ({
    restraintId, supportSiteId: site.siteId, contactState: 'ACTIVE',
    globalReaction: { forceN: { x: -12, y: 0, z: 34 }, momentNm: { x: 2, y: -3, z: 0 } },
    anchorDecomposition: { componentsN: { rest: 34, guide: -12, lineStop: 0 } } })) }] } };
const snapshot = { state: 'EXECUTED_CURRENT', proposalSemanticHash: proposal.semanticHash,
  authorizationSemanticHash: authorization.semanticHash, executionSemanticHash: execution.semanticHash };
const overlay = createEmpiricalResultOverlay({ snapshot, proposal, execution });
const scenarioBundle = { ...bundle, authorizationCurrent: true, overlay, scenario: { snapshot, proposal, authorization, execution,
  overlaySnapshot: { current: true, state: 'CURRENT', projectionSemanticHash: overlay.semanticHash, executionId: 'E' } } };
const vectorModel = draftSupportLoadsModel(scenarioBundle, draft, [`support:${id}`]);
const scenarioOnly = draftSupportLoadsModel({ ...scenarioBundle, execution: null, distribution: null }, draft, [`support:${id}`]);
assert.equal(scenarioOnly.state, 'CURRENT');
assert.equal(scenarioOnly.supports[0].gravity.length, 0);
assert.equal(scenarioOnly.supports[0].scenario.length, 2);
assert.equal(vectorModel.supports[0].scenario.length, 2, 'Individual restraint vectors must not be merged.');
for (const vector of vectorModel.supports[0].scenario) {
  assert.deepEqual(vector.forceN, { x: -12, y: 0, z: 34 });
  assert.deepEqual(vector.momentNm, { x: 2, y: -3, z: 0 });
  assert.equal(vector.Fa, 0); assert.equal(vector.Fl, -12); assert.equal(vector.Fv, 34);
}
assert.equal(draftSupportLoadsModel({ ...scenarioBundle, authorizationCurrent: false }, draft, [`support:${id}`]).supports[0].scenario.length, 0);
assert.match(supportMarkup(vectorModel.supports[0], 'OPE', vectorModel), />-3 N·m</);
assert.equal(JSON.stringify({ bundle, draft }), original, 'Inspection must never mutate source, receipt or draft.');
// Disposable UI lifecycle with the production selection store; DOM seam is a test-only element.
const events = new Map(), listeners = new Map(), sections = [];
const host = { ownerDocument: { createElement() { return { dataset: {}, style: {}, isConnected: false,
  setAttribute() {}, addEventListener: (name, handler) => listeners.set(name, handler),
  removeEventListener: name => listeners.delete(name), remove() { this.isConnected = false; } }; } },
  prepend(element) { element.isConnected = true; sections.push(element); } };
const editorStore = createTopologyEditEditorStore();
let currentTopology = canonical;
const controller = { hostElement: { querySelector: () => host }, editorStore, workspaceDataset: dataset,
  session: { currentTopology: () => currentTopology, baseCanonicalTopology: canonical }, unsubscribers: [],
  eventBus: { subscribe(topic, listener) { events.set(topic, listener); return () => events.delete(topic); },
    publish(topic, payload) { assert.equal(topic, EVENT_TOPICS.LOAD_CALC_SUBTAB_REQUESTED); assert.deepEqual(payload, { tab: 'workbench' }); } } };
const inspector = mountDraftLoadsInspector(controller, () => bundle);
assert.match(inspector.element.innerHTML, /Click a support/);
editorStore.getState().actions.replaceSelection([`support:${id}`], 'tree');
assert.match(inspector.element.innerHTML, /PS-12244/);
assert.equal(mountDraftLoadsInspector(controller, () => bundle), inspector);
assert.equal(sections.length, 1);
listeners.get('change')({ target: { matches: () => true, value: 'HYD' } });
assert.match(inspector.element.innerHTML, /Gravity · HYD/);
listeners.get('click')({ target: { closest: () => true } });
currentTopology = { ...canonical, canonicalTopologyHash: 'changed' };
events.get(APPLICATION_EVENTS.CONTEXT_CHANGED)();
assert.match(inspector.element.innerHTML, /Draft geometry has changed/);
assert.doesNotMatch(inspector.element.innerHTML, /3,811/);
inspector.destroy(); inspector.destroy();
assert.equal(events.size, 0); assert.equal(listeners.size, 0); assert.equal(inspector.element.isConnected, false);
assert.doesNotThrow(() => controller.unsubscribers.forEach(unsubscribe => unsubscribe()));
assert.equal(editorStore.getState().selection.canonicalIds[0], `support:${id}`, 'Inspector teardown does not change canonical selection.');
for (const file of ['draft-support-loads.js', 'draft-loads-inspector.js']) {
  assert.doesNotMatch(readFileSync(`src/workspace/load-calc-workbench/${file}`, 'utf8'), /\.authorize\(|\.execute\(|acceptProposal|appendCommand|recordAuthorization/);
}
console.log('PASS loads-to-draft: actual gravity receipt/cases, exact/co-located site joins, zero/missing/distinct supports, stale/source/seal/topology guards, signed scenario force/moment projection, HTML escaping and no mutation.');
