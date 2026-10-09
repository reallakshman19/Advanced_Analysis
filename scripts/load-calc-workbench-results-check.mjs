import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEmpiricalResultOverlay } from '../src/workspace/engineering-loads/empirical-result-overlay.js';
import { scenarioResultsDisplayable, renderWorkbenchResults } from '../src/workspace/load-calc-workbench/results-view.js';

// Synthetic method-owned values; never an oracle for the actual Sjson engineering result.
const proposal = { semanticHash: 'fnv1a64:proposal', scenarioId: 'scenario',
  adaptedRequest: { semanticHash: 'fnv1a64:request', datasetId: 'D',
    coordinateFrame: { forceOutputConvention: 'RESTRAINT_ON_PIPE', momentOutputConvention: 'RESTRAINT_ON_PIPE' },
    restraintOccurrences: [{ restraintId: 'R', supportSiteId: 'S', attachmentPointMm: { x: 0, y: 0, z: 0 } }] },
  runtimeProfile: { semanticHash: 'fnv1a64:profile' } };
const authorization = { semanticHash: 'fnv1a64:authorization' };
const execution = { semanticHash: 'fnv1a64:execution', executionId: 'E', method: 'EMPIRICAL_BEAM_CONTACT_V1',
  executedAt: '2026-10-02T00:00:00Z', coreResult: { status: 'CALCULATED', loadCases: [{
    loadCaseId: 'W-COLD', status: 'CALCULATED', supportResults: [{ restraintId: 'R', supportSiteId: 'S',
      contactState: 'ACTIVE', globalReaction: { forceN: { x: -1234, y: 0, z: 5678 },
        momentNm: { x: 12, y: -34, z: 0 } }, anchorDecomposition: { componentsN: { rest: 5678, guide: -1234, lineStop: 0 } } }],
  }] } };
const snapshot = { state: 'EXECUTED_CURRENT', proposalSemanticHash: proposal.semanticHash,
  authorizationSemanticHash: authorization.semanticHash, executionSemanticHash: execution.semanticHash };
const overlay = createEmpiricalResultOverlay({ snapshot, proposal, execution });
const bundle = { datasetId: 'D', authorizationCurrent: true, overlay,
  scenario: { snapshot, proposal, authorization, execution, overlaySnapshot: { current: true,
    state: 'CURRENT', projectionSemanticHash: overlay.semanticHash, executionId: 'E' } },
  distribution: null, supportSiteModel: null, routePartitionModel: null, authorizedExecution: null,
  authorizationState: null, execution: null, screeningContext: undefined };
const original = JSON.stringify(bundle);
assert.equal(scenarioResultsDisplayable(bundle), true);
for (const mutate of [
  b => { b.authorizationCurrent = false; }, b => { b.datasetId = 'other'; },
  b => { b.scenario = null; }, b => { b.overlay = null; },
  b => { b.scenario.snapshot.state = 'EXECUTED_STALE'; },
  b => { b.scenario.snapshot.proposalSemanticHash = 'other'; },
  b => { b.scenario.snapshot.authorizationSemanticHash = 'other'; },
  b => { b.scenario.snapshot.executionSemanticHash = 'other'; },
  b => { b.scenario.proposal.adaptedRequest.datasetId = 'other'; },
  b => { b.scenario.overlaySnapshot.current = false; },
  b => { b.scenario.overlaySnapshot.state = 'BLOCKED'; },
  b => { b.scenario.overlaySnapshot.projectionSemanticHash = 'other'; },
  b => { b.scenario.overlaySnapshot.executionId = 'other'; },
  b => { b.overlay.sourceBindings.executionSemanticHash = 'tampered'; },
]) {
  const changed = structuredClone(bundle); mutate(changed);
  assert.equal(scenarioResultsDisplayable(changed), false);
}
const nodes = { '[data-workbench-gravity]': { innerHTML: '', querySelector() { return null; } },
  '[data-workbench-scenario-results]': { innerHTML: '' } };
const container = { innerHTML: '', querySelector: key => nodes[key] };
let delegated;
renderWorkbenchResults(container, bundle, { gravity: (...args) => { delegated = args; } });
assert.equal(delegated[0], nodes['[data-workbench-gravity]']);
assert.deepEqual(delegated.slice(1), [bundle.distribution, bundle.supportSiteModel, bundle.routePartitionModel,
  bundle.authorizedExecution, bundle.authorizationState, bundle.execution, bundle.screeningContext]);
assert.match(nodes['[data-workbench-scenario-results]'].innerHTML, /5,678/);
assert.match(nodes['[data-workbench-scenario-results]'].innerHTML, /-1,234/);
assert.match(nodes['[data-workbench-scenario-results]'].innerHTML, />-34</);
assert.match(nodes['[data-workbench-scenario-results]'].innerHTML, /Fv \(N\)/);
assert.match(nodes['[data-workbench-scenario-results]'].innerHTML, /Fa·LineStop/);
assert.match(nodes['[data-workbench-scenario-results]'].innerHTML, /Fl·Guide/);
renderWorkbenchResults(container, { ...bundle, authorizationCurrent: false }, { gravity() {},
  scenario() { assert.fail('Stale scenario renderer must not run'); } });
assert.match(nodes['[data-workbench-scenario-results]'].innerHTML, /not supply them/);
assert.doesNotMatch(nodes['[data-workbench-scenario-results]'].innerHTML, /5,678|-1,234/);
// Real existing gravity renderer, no source/execution: honest empty state, not invented zero.
renderWorkbenchResults(container, { ...bundle, authorizationCurrent: false });
assert.match(nodes['[data-workbench-gravity]'].innerHTML, /NOT_CALCULATED/);
const summaryDistribution = { freshness: { status: 'CURRENT' }, loadCases: [{ loadCaseId: '<OPE>',
  status: 'CALCULATED_WITH_EXCEPTIONS', supportResults: [{ verticalForceN: 42 }],
  completenessAudit: { allocatedForceN: 42, unallocatedForceN: 0, exceptionCount: 3 } }] };
renderWorkbenchResults(container, { ...bundle, distribution: summaryDistribution }, { gravity() {}, scenario() {} });
assert.match(container.innerHTML, /&lt;OPE&gt;/);
assert.match(container.innerHTML, /Allocated gravity<\/dt><dd>42 N/);
assert.match(container.innerHTML, /Unallocated gravity<\/dt><dd>0 N/);
assert.match(container.innerHTML, /Support rows<\/dt><dd>1/);
for (const changed of [
  { ...summaryDistribution, freshness: { status: 'STALE' } },
  { ...summaryDistribution, loadCases: [{ ...summaryDistribution.loadCases[0], status: 'BLOCKED' }] },
]) {
  renderWorkbenchResults(container, { ...bundle, distribution: changed }, { gravity() {}, scenario() {} });
  assert.match(container.innerHTML, /Allocated gravity<\/dt><dd>Unavailable N/);
  assert.doesNotMatch(container.innerHTML, /<dd>42 N/);
}
assert.equal(JSON.stringify(bundle), original);
for (const file of ['results-view.js', 'current-results.js', 'workbench-controller.js']) {
  const text = readFileSync(`src/workspace/load-calc-workbench/${file}`, 'utf8');
  assert.doesNotMatch(text, /\.authorize\(|\.execute\(|recordAuthorization\(|sealCurrent|acceptProposal/);
}
const binding = readFileSync('src/workspace/load-calc-workbench/current-review.js', 'utf8');
for (const owner of ['getDistribution()', 'getCurrentCommonInputExecution()', 'empiricalLoadCalcScenarioStore.getSnapshot()',
  'empiricalResultOverlayStore.getSnapshot()']) assert(binding.includes(owner));
assert(binding.includes('common.consumptionAuthorizations'), 'Authorization receipt removal invalidates the result view');
assert(binding.includes('common.consumptionExecutions'), 'Execution receipt changes invalidate the result view');
console.log('PASS workbench results: unchanged renderer delegation; configured signed vectors, projections and moments; stale/source/proposal/authorization/execution/overlay negatives; no mutation or alternate runner.');
