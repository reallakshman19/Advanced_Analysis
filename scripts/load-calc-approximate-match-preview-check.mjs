import assert from 'node:assert/strict';
import { buildStraightFixture } from './w10.5-screening-fixtures.mjs';
import { buildLoadCalcMasterEnrichmentProposals } from '../src/workspace/load-calc-master-candidates.js';
import { buildApproximateMatchPreview, approximateMatchPreviewMarkup, requiresApproximateMatchReview } from '../src/workspace/enrichment/approximate-match-preview.js';
import { NonFeaEnrichmentStore } from '../src/workspace/enrichment/non-fea-enrichment-store.js';

// Synthetic rows exercise review plumbing, not engineering class equivalence.
const model = buildStraightFixture({ lengthsM: [1, 1] }).sharedModel;
const sourceBefore = JSON.stringify(model);
const dataset = { sharedModel: model, entities: model.components.map(component => ({
  entityId: component.sourceEntityId, properties: { attributes: { ABORE: '50mm' } },
})) };
const masters = {
  lineList: { sourceHash: 'test-line-revision', normalizedRows: [...new Set(model.components.map(component => component.identity.lineId))].map(lineKey => ({
    lineKey, pipingClass: '91261M7', operatingFluidDensity: 800,
  })) },
  pipingClass: { sourceHash: 'test-class-revision', normalizedRows: [
    { pipingClass: '91261', bore: 50, componentType: 'PIPE', wallThickness: 3.91, rating: '150', schedule: '40' },
    { pipingClass: '91262', bore: 50, componentType: 'PIPE', wallThickness: 5.54, rating: '300', schedule: '80' },
  ] },
};
const result = buildLoadCalcMasterEnrichmentProposals({ dataset, masters });
const approximate = result.proposals.filter(requiresApproximateMatchReview);
const exact = result.proposals.filter(proposal => !requiresApproximateMatchReview(proposal));
assert.equal(approximate.length, 4);
assert.equal(exact.length, 2);
assert.ok(approximate.every(proposal => proposal.record.evidence.sourceSemanticHash === model.semanticHash));
const groups = buildApproximateMatchPreview(result.proposals);
assert.equal(groups.length, 1);
assert.equal(groups[0].targetCount, 2);
assert.equal(groups[0].proposals.length, 4);
assert.ok(groups[0].evidence.classCandidates.length > 0);
assert.ok(groups[0].evidence.rowCandidates.length > 0);
const markup = approximateMatchPreviewMarkup(result.proposals);
assert.match(markup, /Ranked class candidates/);
assert.match(markup, /Ranked section rows/);
assert.match(markup, /disabled>Apply reviewed match \(4 fields\)/);
assert.match(markup, /3\.91/);
const injection = structuredClone(approximate[0]);
injection.record.evidence.requestedPipingClass = '<script>bad()</script>';
assert.ok(!approximateMatchPreviewMarkup([injection]).includes('<script>'));
assert.match(approximateMatchPreviewMarkup([injection]), /&lt;script&gt;/);
const differentLine = structuredClone(approximate[0]);
differentLine.record.evidence.lineKey = 'OTHER';
assert.equal(buildApproximateMatchPreview([...approximate, differentLine]).length, 2);

function staged(proposals = result.proposals) {
  const store = new NonFeaEnrichmentStore();
  store.loadSource(model.semanticHash);
  proposals.forEach(proposal => store.stageProposal(proposal));
  return store;
}
const store = staged();
store.acceptAllProposals();
assert.equal(store.getSnapshot().acceptedRecords.length, 2, 'bulk acceptance must leave approximate matches pending');
assert.equal(store.getSnapshot().proposals.length, 4);
assert.throws(() => store.acceptProposal(approximate[0].proposalId), /complete approximate/);
assert.throws(() => store.acceptProposal(approximate[0].proposalId, { approximateMatchConfirmed: true }), /complete approximate/);
const decision = { approximateMatchConfirmed: true, acceptanceBasis: 'Synthetic fixture review of both exact pipe selectors and section values.' };
const ids = approximate.map(proposal => proposal.proposalId);
const unchanged = store.getSnapshot();
assert.throws(() => store.acceptReviewedApproximateMatch(ids, {}), /confirmation/);
assert.throws(() => store.acceptReviewedApproximateMatch([ids[0]], decision), /complete preview group/);
assert.throws(() => store.acceptReviewedApproximateMatch([...ids, 'missing'], decision), /staged approximate/);
assert.strictEqual(store.getSnapshot(), unchanged, 'failed transactions must not mutate acceptance');
store.acceptReviewedApproximateMatch(ids, decision);
assert.equal(store.getSnapshot().acceptedRecords.length, 6);
assert.equal(store.getSnapshot().proposals.length, 0);
assert.ok(store.getSnapshot().acceptedRecords.filter(record => record.evidence.matchMode === 'APPROXIMATE_CLASS_MATCH').every(record => record.evidence.acceptanceBasis === decision.acceptanceBasis));

const stale = staged(approximate);
stale.loadSource('another-source');
const staleBefore = stale.getSnapshot();
assert.throws(() => stale.acceptReviewedApproximateMatch(ids, decision), /stale/);
assert.strictEqual(stale.getSnapshot(), staleBefore);
const conflicting = staged(approximate);
const duplicate = structuredClone(approximate[0]);
duplicate.proposalId += ':conflict';
duplicate.record.recordId += ':conflict';
duplicate.record.value += 1;
conflicting.stageProposal(duplicate);
const conflictBefore = conflicting.getSnapshot();
assert.throws(() => conflicting.acceptReviewedApproximateMatch([...ids, duplicate.proposalId], decision), /Ambiguous same-authority/i);
assert.strictEqual(conflicting.getSnapshot(), conflictBefore);
assert.equal(JSON.stringify(model), sourceBefore, 'review must not mutate source geometry or values');
console.log(JSON.stringify({ status: 'PASS', scope: 'Approximate-match preview and explicit atomic review only; no production class approval', groups: groups.length, targetCount: groups[0].targetCount, bulkSkipsApproximate: true, atomicFailures: true, sourceImmutable: true }, null, 2));
