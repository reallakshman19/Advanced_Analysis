import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isManualWeightReviewType } from '../src/workspace/load-calc-weight-review-scope.js';
import { buildWeightReviewRows, WeightReviewSession } from '../src/workspace/load-calc-weight-review-model.js';
import { buildFittingWeightReviewRows } from '../src/workspace/load-calc-fitting-weight-review.js';
import { normalizeWorkspaceDataset } from '../src/workspace/dataset-adapter.js';

const manual = ['VALV', 'VALVE', 'FLAN', 'FLANGE', 'BLIND', 'BLIND_FLANGE', 'INST', 'INSTRUMENT',
  'RELIEF_VALVE', 'PRESSURE_RELIEF_VALVE', 'SAFETY_VALVE', 'PRESSURE_SAFETY_VALVE',
  'RVALV', 'RV', 'PRV', 'PSV', 'UZV', ' relief valve ', 'pressure-relief-valve', 'uzv'];
const standard = ['PIPE', 'STRAIGHT_PIPE', 'TUBE', 'ELBO', 'ELBOW', 'BEND', 'TEE', 'OLET',
  'WELDOLET', 'SOCKOLET', 'THREDOLET', 'REDU', 'REDUCER', 'CAP', 'END_CAP', 'ENDCAP', 'GASK', 'GASKET'];
for (const type of manual) assert.equal(isManualWeightReviewType(type), true, type);
for (const type of [...standard, 'UNKNOWN', 'SUPPORT', '', null]) {
  assert.equal(isManualWeightReviewType(type), false, String(type));
}
const components = [...manual, ...standard].map((type, i) => ({
  componentKey: `C-${i}`, sourceEntityId: `C-${i}`, type,
  engineeringProperties: {}, identity: { branchId: 'B1' }, geometry: {},
}));
const coverage = { requirementId: 'MASS_COVERAGE', missing: components.map(c => `${c.componentKey}:COMPONENT_WEIGHT`) };
const before = JSON.stringify(components);
const rows = buildWeightReviewRows({ components, methodRows: [{ coverageRequirements: [coverage] }] });
const reviewRows = rows.filter(row => isManualWeightReviewType(row.type));
assert.equal(reviewRows.length, manual.length);
const session = new WeightReviewSession();
session.bind('fixture');
for (const row of rows) {
  if (isManualWeightReviewType(row.type)) session.skip('fixture', row.entityId, 'Catalogue pending', rows);
  else assert.throws(() => session.skip('fixture', row.entityId, 'defer', rows), /manual weight-review/);
}
assert.equal(session.skipped.size, manual.length);
assert.equal(JSON.stringify(components), before, 'Scope filtering must not resolve/zero/delete input mass');
assert.ok(rows.find(row => row.type === 'CAP').cases.EMPTY.ok === false);
const candidates = buildFittingWeightReviewRows({ dataset: { sharedModel: { components }, entities: [] } });
assert.equal(candidates.rows.length, manual.length, 'Catalogue review uses same scope, including relief/UZV');
assert.ok(candidates.rows.every(row => isManualWeightReviewType(row.type)));
const raw = JSON.parse(readFileSync(new URL('../public/fixtures/Sjson.json', import.meta.url), 'utf8'));
const dataset = normalizeWorkspaceDataset(raw, 'Sjson.json');
const actual = buildWeightReviewRows({ components: dataset.sharedModel.components });
const actualReview = actual.filter(row => isManualWeightReviewType(row.type));
assert.ok(actualReview.length > 0 && actualReview.length < actual.length);
assert.ok(actualReview.every(row => ['VALV', 'FLAN', 'INST'].includes(row.type)));
assert.ok(!actualReview.some(row => row.entityId === '=1006649732/51228'));
assert.equal(actual.length, dataset.sharedModel.components.length, 'Numerical population is not filtered');
const dialogSource = readFileSync(new URL('../src/workspace/load-calc-weight-review-dialog.js', import.meta.url), 'utf8');
assert.match(dialogSource, /\.filter\(\(row\) => isManualWeightReviewType\(row\.type\)\)/);
assert.ok(!dialogSource.includes('data-sections'), 'Manual popup no longer requests pipe-section review');
console.log(`PASS manual-weight-review-scope: aliases/exclusions/skip/real catalogue consumer/immutability; Sjson ${actualReview.length}/${actual.length} manual items; no numerical-completion assertion`);
