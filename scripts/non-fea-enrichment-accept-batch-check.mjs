#!/usr/bin/env node

/**
 * Accepting staged proposals must be one authority change, not one per record.
 *
 * Every authority publication notifies the Common Input store, and the
 * Enrichment view re-derives the whole resolution ledger and enriched
 * projection when it re-renders. Accepting master enrichment one record at a
 * time therefore cost a full model projection per record - 172 of them on the
 * 1885S dataset - and the tab stopped completing at all.
 *
 * The snapshot version counts publications, so it is the honest thing to
 * assert: a batch is one version step regardless of how many records it
 * carries.
 */

import assert from 'node:assert/strict';
import { NonFeaEnrichmentStore } from '../src/workspace/enrichment/non-fea-enrichment-store.js';

const SOURCE = 'fnv1a64:acceptbatchcheck';
const COUNT = 172;

function seeded() {
  const store = new NonFeaEnrichmentStore();
  store.loadSource(SOURCE);
  for (let index = 0; index < COUNT; index += 1) {
    store.stageProposal({
      proposalId: `p${String(index).padStart(4, '0')}`,
      rationale: 'Accept-batch check.',
      record: {
        recordId: `r${String(index).padStart(4, '0')}`,
        selectorKind: 'ENTITY',
        selectorKey: `entity-${index}`,
        fieldId: 'COMPONENT_WEIGHT',
        value: 10 + index,
        unit: 'kg',
        authority: 'ACCEPTED_OVERRIDE',
        sourceId: 'accept-batch-check',
        revision: '1',
      },
    });
  }
  return store;
}

const oneAtATime = seeded();
const oneAtATimeStart = oneAtATime.getSnapshot().version;
for (const proposal of [...oneAtATime.getSnapshot().proposals]) {
  oneAtATime.acceptProposal(proposal.proposalId);
}
const oneAtATimeSteps = oneAtATime.getSnapshot().version - oneAtATimeStart;

const batched = seeded();
const batchedStart = batched.getSnapshot().version;
const snapshot = batched.acceptAllProposals();
const batchedSteps = snapshot.version - batchedStart;

assert.equal(batchedSteps, 1, 'accepting a batch publishes exactly one authority change');
assert.ok(
  oneAtATimeSteps >= COUNT,
  'the one-at-a-time path still publishes per record, which is what the batch avoids',
);

// Same outcome, not just fewer publications.
assert.equal(snapshot.acceptedRecords.length, COUNT);
assert.equal(snapshot.proposals.length, 0);
assert.equal(snapshot.boundSourceSemanticHash, SOURCE);
assert.equal(snapshot.stale, false);
assert.deepEqual(
  snapshot.acceptedRecords.map((row) => row.recordId),
  oneAtATime.getSnapshot().acceptedRecords.map((row) => row.recordId),
  'batching does not change which records are accepted, nor their order',
);

// A stale proposal rejects the whole batch rather than leaving half of it
// applied, which is what the sidecar's all-or-nothing validation already meant.
const withStale = seeded();
withStale.stageProposal({
  proposalId: 'zzz-stale',
  rationale: 'Bound to a different source model.',
  record: {
    recordId: 'zzz-stale',
    selectorKind: 'ENTITY',
    selectorKey: 'entity-stale',
    fieldId: 'COMPONENT_WEIGHT',
    value: 42,
    unit: 'kg',
    authority: 'ACCEPTED_OVERRIDE',
    sourceId: 'accept-batch-check',
    revision: '1',
    evidence: { sourceSemanticHash: 'fnv1a64:someothersource' },
  },
});
assert.throws(() => withStale.acceptAllProposals(), /stale against the active source model/u);
assert.equal(
  withStale.getSnapshot().acceptedRecords.length,
  0,
  'a rejected batch accepts nothing',
);

console.log(JSON.stringify({
  check: 'non-fea-enrichment-accept-batch',
  recordCount: COUNT,
  authorityPublications: { oneAtATime: oneAtATimeSteps, batched: batchedSteps },
  sameRecordsAndOrder: true,
  staleBatchIsAtomic: true,
}, null, 2));
