import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeWorkspaceDataset } from '../src/workspace/dataset-adapter.js';
import { normalizeWeight } from '../src/workspace/master-data-normalizers.js';
import { buildFittingWeightReviewRows, fittingWeightRecordFor } from '../src/workspace/load-calc-fitting-weight-review.js';
import { createNonFeaEnrichmentSidecar } from '../src/core/non-fea-enrichment/index.js';
import { semanticHash } from '../src/core/shared-piping-model/index.js';

const raw = JSON.parse(readFileSync(new URL('../public/fixtures/Sjson.json', import.meta.url)));
const dataset = normalizeWorkspaceDataset(raw, 'Sjson.json');
const rawRows = JSON.parse(readFileSync(new URL('../src/master-data/wtValveweights.json', import.meta.url)));
const normalizedRows = normalizeWeight(rawRows, {
  bore: 'DN', nps: 'NS', rating: 'Rating', length: 'RF-F/F', valveType: 'TypeDesc', weight: 'RF/RTJ KG',
});
const masters = { weight: { normalizedRows, fileName: 'wtValveweights.json', sourceHash: '72e266002256e2ac0b0c0c9c722dde2bb65e93deec2075d209c7ab78d219cda2' } };
const sourceBefore = JSON.stringify(dataset.sharedModel);
const masterBefore = JSON.stringify(masters);
const build = (master = masters, data = dataset) => buildFittingWeightReviewRows({ dataset: data, masters: master });
const review = build();
const uzv = review.rows.find(row => row.targetId === '=1006649732/51250');
assert.ok(uzv);
assert.equal(uzv.candidates[0].weightKg, 548);
assert.equal(uzv.candidates[0].typeDesc, 'Instrument-ESDV/UZV');
assert.equal(uzv.candidates[0].rowLengthMm, null);
assert.equal(uzv.candidates[0].familyQualified, true);
assert.equal(uzv.clearWinner, true);
assert.ok(uzv.candidates.some(c => !c.familyQualified), 'Existing suggestions retained for observation/review');
assert.match(uzv.candidates[0].reason, /no F\/F requirement, factor or interpolation/);
const record = fittingWeightRecordFor(uzv, uzv.candidates[0], 0, masters);
assert.equal(record.authority, 'EXACT_APPROVED_MASTER');
assert.equal(record.revision, masters.weight.sourceHash);
assert.equal(record.evidence.sourceSemanticHash, dataset.sharedModel.semanticHash);
assert.equal(record.evidence.matchMode, 'BORE_RATING_INSTRUMENT_FAMILY');
assert.equal(record.evidence.vendorIdentityAsserted, false);
assert.equal(record.evidence.masterSourceRowIndex, 1482);
assert.equal(record.evidence.masterBoreDerivedFromNps, true);
assert.equal(record.evidence.masterNps, 6);
assert.equal(record.value, 548);
createNonFeaEnrichmentSidecar({ sourceSemanticHash: dataset.sharedModel.semanticHash, records: [record] });
for (const suffix of ['51274','51284','51462','51463','51476','51483','51485']) {
  const row = review.rows.find(r => r.targetId === `=1006649732/${suffix}`);
  assert.ok(row, suffix);
  assert.ok(!row.candidates.some(c => c.familyQualified), `${suffix}: no UZV inheritance`);
}

const direct = normalizedRows.find(r => r.valveType === 'Instrument-ESDV/UZV' && r.nps === 6 && r.rating === 900);
assert.equal(direct.bore, '', 'Actual auto-mapping preserves the blank DN cell');
const withRows = rows => ({ weight: { ...masters.weight, normalizedRows: rows } });
for (const altered of [{ ...direct, bore: 200 }, { ...direct, bore: 0 }, { ...direct, bore: 'invalid' }, { ...direct, nps: 6.2 }, { ...direct, nps: '' }, { ...direct, rating: 600 }, { ...direct, weight: 0 }, { ...direct, weight: NaN }, { ...direct, valveType: 'Instrument-XCV' }]) {
  const negative = build(withRows([altered])).rows.find(r => r.targetId === uzv.targetId);
  assert.ok(!negative.candidates.some(c => c.familyQualified), 'Wrong bore/rating/family/invalid mass cannot qualify');
}
const ambiguous = build(withRows([direct, { ...direct, weight: 600 }])).rows.find(r => r.targetId === uzv.targetId);
assert.equal(ambiguous.clearWinner, false, 'Two same-family master masses remain a review choice');
assert.equal(ambiguous.candidates.filter(c => c.familyQualified).length, 2);

assert.equal(JSON.stringify(dataset.sharedModel), sourceBefore, 'Source not mutated');
assert.equal(JSON.stringify(masters), masterBefore, 'Master not mutated');
assert.equal(semanticHash(JSON.parse(masterBefore)), semanticHash(masters));
// Actual browser input receipt: replay the one-record delta through the existing
// sidecar constructor. This verifies custody, not a numerical execution.
const receipt = JSON.parse(readFileSync(new URL('../relay/WORK/load-calc-direct-instrument-weight-v32-input-receipt.json', import.meta.url)));
const base = JSON.parse(readFileSync(new URL('../relay/WORK/load-calc-run-readiness-v32-accepted-inputs.json', import.meta.url)));
assert.equal(base.semanticHash, receipt.baseSidecarSemanticHash);
assert.equal(receipt.addedRecord.value, record.value);
assert.equal(receipt.addedRecord.evidence.masterSourceRowIndex, record.evidence.masterSourceRowIndex);
const replay = createNonFeaEnrichmentSidecar({ sourceSemanticHash: base.sourceSemanticHash, records: [...base.records, receipt.addedRecord] });
assert.equal(replay.semanticHash, receipt.exportedSidecarSemanticHash);
assert.equal(replay.records.length, receipt.acceptedRecords);
for (const prior of base.records) assert.deepEqual(replay.records.find(r => r.recordId === prior.recordId), prior);
assert.equal(receipt.gravityCalculated, false);
assert.equal(receipt.resultExportCreated, false);
console.log('PASS direct instrument catalogue: actual Sjson UZV548kg, provenance/hash, seven isolated remaining items, mismatch/ambiguity negatives; no calculation asserted.');
