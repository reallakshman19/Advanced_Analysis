import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_WEIGHT_REVIEW_POLICY as defaults, normalizeWeightReviewPolicy, readWeightReviewPolicy,
  saveWeightReviewPolicy, isManualWeightReviewType, weightReviewFamily } from '../src/workspace/load-calc-weight-review-scope.js';
import { buildWeightReviewRows } from '../src/workspace/load-calc-weight-review-model.js';
import { buildLoadCalcPreview, effectivePreviewFields } from '../src/workspace/load-calc-preview-model.js';
import { rowsMarkup, shellMarkup } from '../src/workspace/load-calc-workbench/workbench-view.js';
import { createWorkbenchState } from '../src/workspace/load-calc-workbench/workbench-controller.js';
import { filterReviewRows } from '../src/workspace/load-calc-workbench/workbench-model.js';
import { buildFittingWeightReviewRows } from '../src/workspace/load-calc-fitting-weight-review.js';
import { normalizeWorkspaceDataset } from '../src/workspace/dataset-adapter.js';

for (const boreMm of [20, 80, 100]) assert.equal(isManualWeightReviewType('INST', { boreMm }, defaults), false);
for (const boreMm of [100.01, 150, 200]) assert.equal(isManualWeightReviewType('INSTRUMENT', { boreMm }, defaults), true);
assert.equal(isManualWeightReviewType('INST', {}, defaults), true, 'Unknown bore must not become an invented 0mm.');
for (const type of ['ELBO','ELBOW','TEE','OLET','GASK','GASKET','PIPE','CAP','REDU']) assert.equal(isManualWeightReviewType(type, { boreMm: 250 }, defaults), false);
for (const type of ['FLAN','VALV','CONTROL_VALVE','relief-valve','PRV','PSV','UZV']) assert.equal(isManualWeightReviewType(type, { boreMm: 20 }, defaults), true);
for (const [description, family] of [['ANGLE CONTROL VALVE-HOLD','controlValves'], ['RELIEF VALVE','reliefValves'], ['88-UZV-11951','valves']]) {
  assert.equal(weightReviewFamily('INST', { description }), family);
  assert.equal(isManualWeightReviewType('INST', { description, boreMm: 80 }, defaults), true);
  assert.equal(isManualWeightReviewType('INST', { description, boreMm: 80 }, { ...defaults, [family]: false }), false);
}
assert.equal(weightReviewFamily('PIPE', { description: 'CONTROL VALVE' }), null);
const stored = new Map(), storage = { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) };
assert.deepEqual(readWeightReviewPolicy(storage), defaults);
const custom = { ...defaults, flanges: false, instrumentAboveMm: 150 };
saveWeightReviewPolicy(custom, storage); assert.deepEqual(readWeightReviewPolicy(storage), custom);
assert.equal(isManualWeightReviewType('FLAN', {}, readWeightReviewPolicy(storage)), false);
assert.equal(isManualWeightReviewType('INST', { boreMm: 150 }, readWeightReviewPolicy(storage)), false);
assert.equal(isManualWeightReviewType('INST', { boreMm: 151 }, readWeightReviewPolicy(storage)), true);
for (const policy of [{ instrumentAboveMm: -1 }, { instrumentAboveMm: NaN }, { instrumentAboveMm: '100' }, { valves: 'false' }]) assert.throws(() => normalizeWeightReviewPolicy(policy));
for (const key of stored.keys()) stored.set(key, '{bad');
assert.deepEqual(readWeightReviewPolicy(storage), defaults);
assert.throws(() => saveWeightReviewPolicy(defaults, null), /unavailable/);

const evidence = value => ({ value, unit: 'mm', status: 'VALID' });
const component = (componentKey, type, bore = 150, properties = {}) => ({ componentKey, sourceEntityId: componentKey, type,
  identity: { branchId: 'B' }, compatibilityEvidence: { sourceArriveBoreMm: evidence(bore) },
  engineeringProperties: properties, geometry: { sourceLengthM: 1, start: { x: 0,y: 0,z: 0 }, end: { x: 1,y: 0,z: 0 }, applicationPoint: { x: 0.5,y: 0,z: 0 } } });
const components = [component('pipe','PIPE',150,{ outerDiameterMm: evidence(168.3),wallThicknessMm: evidence(14.2748),materialDensityKgM3: { value:7850 }, insulationThicknessMm: { value:0 }, fluidDensityOpeKgM3:{value:0}, fluidDensityHydKgM3:{value:1000} }),
  ...['ELBO','TEE','OLET','GASK'].map(type => component(type,type)), component('explicit-gasket','GASK',150,{ componentWeightKg:{value:2} }),
  component('small','INST',80), component('boundary','INST',100), component('large','INST',150), component('control','INST',80)];
const entities = components.map(c => ({ entityId:c.componentKey, properties:{ attributes:{ ABORE:String(c.compatibilityEvidence.sourceArriveBoreMm.value), DTXR:c.componentKey === 'control' ? 'ANGLE CONTROL VALVE' : '' } } }));
const original = JSON.stringify({ components,entities });
const rows = buildLoadCalcPreview({ components,entities,reviewPolicy:defaults });
for (const type of ['ELBO','TEE','OLET']) {
  const row = rows.find(r=>r.type === type);
  assert.equal(row.manualReviewRequired,false); assert(row.mass.EMPTY.metalKg > 0);
  assert.equal(effectivePreviewFields(row)[0].value,null, 'Borrowed pipe section remains distinct from own section.');
  assert.equal(effectivePreviewFields(row)[0].borrowedValue,168.3);
  assert(row.mass.EMPTY.coreMassKg > 0);
}
assert.equal(rows.find(r=>r.entityId === 'GASK').mass.EMPTY.metalKg,0);
assert.equal(rows.find(r=>r.entityId === 'explicit-gasket').mass.EMPTY.metalKg,2, 'Explicit gasket evidence wins over zero default.');
assert.deepEqual(rows.filter(r=>r.manualReviewRequired).map(r=>r.entityId).sort(),['control','large']);
const state = createWorkbenchState();
assert.deepEqual(filterReviewRows(rows,{ category:'weights' }).map(r=>r.entityId).sort(),['control','large']);
const html = rowsMarkup(rows,state,rows.length);
assert.match(html,/Automatic weight/); assert.match(html,/Pipe derivation basis/); assert.match(html,/Review equipment weight/);
assert.doesNotMatch(html,/Needs input review/);
const review = { rows,branches:['B'],supports:[],dataset:{sourceName:'test',entities},sourceLengthUnit:'mm' };
assert.match(shellMarkup(review,state),/Weight review settings/);
assert.equal(JSON.stringify({ components,entities }),original);
const sourceBytes = JSON.parse(readFileSync('public/fixtures/Sjson.json','utf8'));
const dataset = normalizeWorkspaceDataset(sourceBytes,'Sjson.json');
const actual = buildWeightReviewRows({ components:dataset.sharedModel.components, entities:dataset.entities,reviewPolicy:defaults });
assert.equal(actual.find(r=>r.entityId === '=1006649732/51274').manualReviewRequired,false, 'DN80 ultrasonic flow meter excluded.');
assert.equal(actual.find(r=>r.entityId === '=1006649732/51284').manualReviewRequired,true, 'DN80 control valve still reviewed.');
assert.equal(actual.find(r=>r.entityId === '=1006649732/51250').manualReviewRequired,true, 'UZV reviewed as valve.');
const candidates = buildFittingWeightReviewRows({ dataset,reviewPolicy:defaults });
assert(!candidates.rows.some(r=>r.targetId === '=1006649732/51274'));
assert(candidates.rows.some(r=>r.targetId === '=1006649732/51284'));
console.log('PASS weight-review policy: configurable families, strict >100mm boundary, actual DN80 instrument/control distinction, UZV, persistence/invalid values, existing automatic fitting/gasket values and source precedence, borrowed/own section separation, preview actions and unchanged engineering population.');
