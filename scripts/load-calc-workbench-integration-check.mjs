import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { createGravityResultExport, currentGravityStatus, unallocatedGravityPaths } from '../src/workspace/load-calc-workbench/result-evidence.js';
import { shellMarkup } from '../src/workspace/load-calc-workbench/workbench-view.js';
import { createWorkbenchState } from '../src/workspace/load-calc-workbench/workbench-controller.js';

// Captured from the actual browser Run/export. Custody regression, not an independent mechanics oracle.
const document = JSON.parse(readFileSync(process.argv[2] || 'relay/WORK/load-calc-new-ui-v32-gravity-export.json', 'utf8'));
const receipt = document.receipt;
const bundle = { datasetId: receipt.datasetId, execution: receipt, distribution: receipt.distribution,
  screeningContext: { dataset: { sourceSha256: receipt.sourceDatasetSha256 }, commonState: {
    staleness: { stale: false }, request: { semanticHash: 'request:captured', enrichmentSidecar: document.enrichmentSidecar },
    commonInput: { semanticHash: receipt.commonInputSemanticHash, seal: { semanticHash: receipt.commonInputSealSemanticHash },
      requestSemanticHash: 'request:captured', enrichmentSidecarSemanticHash: document.enrichmentSidecar.semanticHash },
  } } };
const original = JSON.stringify(bundle);
assert.deepEqual(createGravityResultExport(bundle), document);
assert.equal(currentGravityStatus({}), 'Gravity not calculated');
assert.equal(currentGravityStatus(bundle), 'Gravity calculated · exceptions retained');
for (const mutate of [
  b => { b.datasetId = 'other-source'; },
  b => { b.screeningContext.dataset.sourceSha256 = '0'.repeat(64); },
  b => { b.execution = null; },
  b => { b.execution.semanticHash = 'tampered'; },
  b => { b.execution.distribution.loadCases[0].supportResults[0].verticalForceN += 1; },
  b => { b.distribution.freshness.status = 'STALE'; },
  b => { b.distribution.status = 'BLOCKED'; },
  b => { b.screeningContext.commonState.staleness.stale = true; },
  b => { b.screeningContext.commonState.commonInput.semanticHash = 'other-input'; },
  b => { b.screeningContext.commonState.commonInput.seal.semanticHash = 'other-seal'; },
  b => { b.screeningContext.commonState.request.semanticHash = 'new-request'; },
]) {
  const changed = structuredClone(bundle); mutate(changed);
  assert.throws(() => createGravityResultExport(changed));
  assert.match(currentGravityStatus(changed), /stale or unavailable/);
}
const wrongSidecar = structuredClone(bundle);
wrongSidecar.screeningContext.commonState.request.enrichmentSidecar.records.pop();
assert.throws(() => createGravityResultExport(wrongSidecar), /Weight assumptions/);
assert.equal(document.publicationAuthorityAsserted, false);
for (const id of ['Fa', 'Fl', 'globalMoments', 'Fh']) assert.equal(document.quantityScope[id].value, null);
const accepted = JSON.parse(readFileSync('relay/WORK/load-calc-explicit-zero-weight-v32-sidecar.json', 'utf8'));
assert.equal(accepted.records.length, 203);
for (const record of accepted.records) assert.deepEqual(document.enrichmentSidecar.records.find(row => row.recordId === record.recordId), record);
assert.equal(document.enrichmentSidecar.records.length, 584, 'Sealed input includes accepted records plus governed derived/default records');
assert.equal(document.enrichmentSidecar.records.filter(row => row.fieldId === 'COMPONENT_WEIGHT'
  && row.value === 0 && row.evidence?.zeroWeightAssumption === true).length, 7);
for (const loadCase of receipt.distribution.loadCases) {
  assert.equal(loadCase.status, 'CALCULATED_WITH_EXCEPTIONS');
  assert.equal(loadCase.supportResults.length, 37);
  const paths = unallocatedGravityPaths(receipt.distribution).filter(row => row.loadCaseId === loadCase.loadCaseId);
  assert.equal(paths.length, 3);
  assert(Math.abs(paths.reduce((sum, row) => sum + row.forceN, 0) - loadCase.completenessAudit.unallocatedForceN) < 1e-8);
  assert.equal(paths.reduce((sum, row) => sum + row.entityIds.length, 0), 21);
}
assert.equal(unallocatedGravityPaths({ ...receipt.distribution, freshness: { status: 'STALE' } }).length, 0);
assert.equal(JSON.stringify(bundle), original);
const review = { mode: 'prepared', rows: [], branches: [], supports: [], issueGroups: [],
  dataset: { sourceName: 'fixture', entities: [] }, status: null };
const markup = shellMarkup(review, { ...createWorkbenchState(), stage: 3 }, {
  eligible: true, ready: true, resultStatus: currentGravityStatus(bundle) });
assert.match(markup, /Input Check ready · preview caveats separate/);
assert.match(markup, /Gravity calculated · exceptions retained/);
assert.doesNotMatch(markup, />Review required</);
assert.match(shellMarkup(review, { ...createWorkbenchState(), stage: 2 }, { eligible: true }), /data-load-calc-tab="scenario-setup"/);
assert.match(readFileSync('src/workspace/workspace-layout.js', 'utf8'), /Benchmark: <strong data-role="tab-benchmark-value"/);
assert.equal(receipt.distributionSemanticHash, semanticHash(receipt.distribution));
console.log('PASS workbench integration: actual-browser gravity export unchanged, 203 input records/7 reviewed zeros, 111 support rows, unallocated path closure, stale/source/seal/request/tamper negatives, no invented vectors/publication, truthful status and scenario setup entry.');
