import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeWorkspaceDataset } from '../src/workspace/dataset-adapter.js';
import { normalizeWeight } from '../src/workspace/master-data-normalizers.js';
import { createNonFeaEnrichmentSidecar } from '../src/core/non-fea-enrichment/index.js';
import { buildFittingWeightReviewRows, canPrefillFittingWeight } from '../src/workspace/load-calc-fitting-weight-review.js';
import { openFittingWeightDialog } from '../src/workspace/load-calc-fitting-weight-dialog.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const sourceBytes = readFileSync(new URL('../public/fixtures/Sjson.json', import.meta.url));
const dataset = normalizeWorkspaceDataset(JSON.parse(sourceBytes), 'Sjson.json', {
  sourceBytes, sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
});
const masters = { weight: { fileName: 'wtValveweights.json',
  sourceHash: '72e266002256e2ac0b0c0c9c722dde2bb65e93deec2075d209c7ab78d219cda2',
  normalizedRows: normalizeWeight(read('../src/master-data/wtValveweights.json'), {
    bore: 'DN', nps: 'NS', rating: 'Rating', length: 'RF-F/F', valveType: 'TypeDesc', weight: 'RF/RTJ KG',
  }) } };
const base = read('../relay/WORK/load-calc-run-readiness-v32-accepted-inputs.json');
const receipt = read('../relay/WORK/load-calc-direct-instrument-weight-v32-input-receipt.json');
const sidecar = createNonFeaEnrichmentSidecar({ sourceSemanticHash: base.sourceSemanticHash,
  records: [...base.records, receipt.addedRecord] });
assert.equal(dataset.sharedModel.semanticHash, sidecar.sourceSemanticHash, 'Actual browser byte-bound source basis');
const before = JSON.stringify({ dataset, masters, sidecar });
const build = (accepted = sidecar) => buildFittingWeightReviewRows({ dataset, masters, sidecar: accepted });
const all = build(null);
assert.equal(all.rows.length, 31);
assert.ok(canPrefillFittingWeight(all.rows.find(r => r.targetId === receipt.addedRecord.selectorKey)));
const pending = build();
const ids = ['51274', '51284', '51462', '51463', '51476', '51483', '51485'].map(x => `=1006649732/${x}`);
assert.deepEqual(pending.rows.map(r => r.targetId).sort(), ids.sort());
assert.equal(pending.summary.omittedResolvedCount, 24);
assert.equal(pending.rows.filter(canPrefillFittingWeight).length, 0);
assert.equal(build(createNonFeaEnrichmentSidecar({ ...sidecar, sourceSemanticHash: 'fnv1a64:stale' })).rows.length, 31);
assert.equal(build({ ...sidecar, semanticHash: 'tampered' }).rows.length, 31);
const conflict = { ...receipt.addedRecord, recordId: 'conflicting-uzv', value: 600 };
const conflictedInput = { ...sidecar, records: [...sidecar.records, conflict] };
assert.throws(() => createNonFeaEnrichmentSidecar(conflictedInput), /Ambiguous same-authority/);
assert.equal(build(conflictedInput).rows.length, 31);
const zero = createNonFeaEnrichmentSidecar({ ...sidecar, records: sidecar.records.map(r =>
  r.recordId === receipt.addedRecord.recordId ? { ...r, value: 0 } : r) });
assert.ok(build(zero).rows.some(r => r.targetId === receipt.addedRecord.selectorKey), 'Zero cannot omit this unresolved positive mass');

let click, accepted = [], removed = false, binding = 'accepted-state-A';
const note = { textContent: '' };
const inputs = new Map(ids.map(id => [id, { value: '', dataset: { lcfwSelectedIndex: '-1' } }]));
const host = { dataset: {}, innerHTML: '', addEventListener: (name, handler) => { if (name === 'click') click = handler; },
  remove: () => { removed = true; }, querySelector: selector => {
    if (selector === '[data-lcfw-note]') return note;
    const id = /data-lcfw-weight="([^"]+)"/.exec(selector)?.[1];
    return inputs.get(id) || null;
  }, querySelectorAll: () => [] };
const documentRef = { createElement: () => host, body: { appendChild() {} } };
openFittingWeightDialog({ documentRef, dataset, masters, sidecar, getBinding: () => binding,
  onAccept: records => { accepted = records; } });
assert.match(host.innerHTML, /7 unresolved manual item/);
assert.match(host.innerHTML, /24 current resolved/);
assert.match(host.innerHTML, /data-lcfw-apply-clear-winners disabled/);
assert.equal((host.innerHTML.match(/data-lcfw-selected-index="-1" value=""/g) || []).length, 7);
assert.doesNotMatch(host.innerHTML, /<button[^>]*class="[^"]*lcfw-chip--active/);
const action = selector => click({ target: { closest: key => key === selector ? {} : null } });
action('[data-lcfw-apply-clear-winners]'); // Programmatic click cannot bypass the UI disabled guard.
assert.ok([...inputs.values()].every(input => input.value === ''));
action('[data-lcfw-apply]');
assert.equal(accepted.length, 0); assert.equal(removed, false);
assert.match(note.textContent, /at least one weight/);
binding = 'accepted-state-B'; inputs.get(ids[0]).value = '12.5';
action('[data-lcfw-apply]'); assert.equal(accepted.length, 0);
assert.match(note.textContent, /changed/);
binding = 'accepted-state-A';
action('[data-lcfw-apply]');
assert.equal(accepted.length, 1);
assert.equal(accepted[0].authority, 'ACCEPTED_OVERRIDE');
assert.equal(accepted[0].evidence.matchMode, 'REVIEWED_MANUAL_VALUE');
assert.equal(accepted[0].sourceId, 'manual-weight-review');
assert.equal(accepted[0].value, 12.5);
assert.equal(accepted[0].evidence.wasTopRanked, false);
createNonFeaEnrichmentSidecar({ sourceSemanticHash: dataset.sharedModel.semanticHash, records: accepted });
removed = false; accepted = [];
inputs.get(ids[0]).value = '   ';
inputs.get(ids[1]).value = '-1';
inputs.get(ids[2]).value = 'Infinity';
action('[data-lcfw-apply]');
assert.equal(accepted.length, 0); assert.equal(removed, false);
inputs.get(ids[0]).value = '0';
action('[data-lcfw-apply]');
assert.equal(accepted.length, 1, 'Only explicit finite nonnegative entries are staged');
assert.equal(accepted[0].value, 0);
assert.equal(accepted[0].authority, 'ACCEPTED_OVERRIDE');
assert.equal(accepted[0].evidence.zeroWeightAssumption, true);
assert.equal(accepted[0].sourceId, 'manual-weight-review');
const zeroAccepted = createNonFeaEnrichmentSidecar({ ...sidecar, records: [...sidecar.records, ...accepted] });
assert.equal(build(zeroAccepted).rows.length, 6, 'Reviewed current zero override no longer requests weight');
assert.equal(build(zeroAccepted).summary.omittedResolvedCount, 25);
assert.equal(build(createNonFeaEnrichmentSidecar({ ...zeroAccepted, sourceSemanticHash: 'fnv1a64:stale' })).rows.length, 31);
const sevenZeros = ids.map(id => ({ ...accepted[0], recordId: `review-zero:${id}`, selectorKey: id }));
const allZeros = createNonFeaEnrichmentSidecar({ ...sidecar, records: [...sidecar.records, ...sevenZeros] });
assert.equal(build(allZeros).rows.length, 0);
assert.equal(build(allZeros).summary.omittedResolvedCount, 31);
assert.equal(JSON.stringify({ dataset, masters, sidecar }), before, 'Review/render/stage cannot change accepted inputs or source');
const view = readFileSync(new URL('../src/workspace/enrichment/non-fea-enrichment-view.js', import.meta.url), 'utf8');
assert.match(view, /sidecar = deriveCurrent\(dataset.sharedModel, snapshot\)\.sidecar/);
assert.match(view, /getSnapshot\(\)\.acceptedRecords/);
console.log('PASS pending catalogue review: actual196-record custody,31-to7 pending population,24 resolved retained, stale/tamper/conflict/unreviewed-zero negatives, blank/negative/nonfinite guards, seven explicit reviewed zero overrides, accepted-state binding, manual override custody; fixture check is not load completion.');
