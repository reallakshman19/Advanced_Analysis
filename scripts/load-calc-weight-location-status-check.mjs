import assert from 'node:assert/strict';
import { buildLoadCalcPreview, previewWeightStatus, effectivePreviewFields } from '../src/workspace/load-calc-preview-model.js';
import { previewRowMarkup } from '../src/workspace/load-calc-preview-table.js';
import { rowsMarkup, massMarkup } from '../src/workspace/load-calc-workbench/workbench-view.js';
import { reviewSummary, sectionMissing } from '../src/workspace/load-calc-workbench/workbench-model.js';
import { createWorkbenchState } from '../src/workspace/load-calc-workbench/workbench-controller.js';
import { createPipingLoadCompositionProfile } from '../src/core/model-loads/composition-profile.js';
import { resolveComponentCaseMass } from '../src/core/model-loads/component-mass-resolver.js';

const component = (key, value, sourceKind = 'EXACT_APPROVED_MASTER', geometry = {}) => ({
  componentKey: key, type: 'FLAN', identity: { branchId: 'B1' }, diagnostics: [], sourceReferences: {}, geometry,
  engineeringProperties: value == null ? {} : { componentWeightKg: { value, unit: 'kg', sourceKind } },
});
const components = [component('accepted', 59), component('zero', 0, 'ACCEPTED_OVERRIDE'),
  component('source', 12, 'SOURCE'), component('missing', null), component('negative', -1),
  component('placed', 59, 'EXACT_APPROVED_MASTER', { applicationPoint: { x: 1, y: 0, z: 0 } })];
const inputs = { components, proposals: [{ record: { selectorKind: 'ENTITY', selectorKey: 'accepted',
  fieldId: 'COMPONENT_WEIGHT', value: 700, unit: 'kg' } }] };
const original = JSON.stringify(inputs);
const rows = buildLoadCalcPreview(inputs), byId = Object.fromEntries(rows.map(row => [row.entityId, row]));
for (const id of ['EMPTY', 'OPE', 'HYD']) {
  const accepted = byId.accepted;
  assert.equal(accepted.mass[id].metalKg, 59);
  assert.equal(accepted.mass[id].coreMassKg, null, 'Strict placement/coverage semantics unchanged');
  assert.equal(accepted.mass[id].compositionMassKg, 59, 'Observe existing point dry mass only');
  assert.equal(accepted.cases[id].ok, false);
  assert(accepted.cases[id].blockers.includes('MISSING_COMPONENT_COG'));
  const status = previewWeightStatus(accepted, id);
  assert.equal(status.label, 'Weight applied: 59 kg'); assert.equal(status.needsWeightReview, false);
  assert.equal(status.locationMissing, true); assert.equal(status.sectionNotRequired, true);
  for (const html of [previewRowMarkup(accepted, id), rowsMarkup([accepted], { ...createWorkbenchState(), caseId: id }, 1)]) {
    assert.match(html, /Weight applied: 59 kg/); assert.doesNotMatch(html, /Review equipment weight/);
    assert.match(html, /OD, wall and metal density are not required/);
    assert.match(html, /mass \(dry only\)/); assert.match(html, /Mass known · load placement pending/);
    assert.match(html, /Load location missing/); assert.match(html, /700/);
    assert.doesNotMatch(html, /core[^<]*<b>Pending/);
  }
  assert.equal(previewWeightStatus(byId.zero, id).label, 'Weight applied: 0 kg');
  assert.equal(byId.zero.mass[id].compositionMassKg, 0);
  assert.equal(byId.zero.cases[id].ok, false, 'Zero flange is not a negligible gasket exception');
  assert.equal(previewWeightStatus(byId.source, id).label, 'Weight available: 12 kg');
  assert.equal(previewWeightStatus(byId.missing, id).needsWeightReview, true);
  assert.equal(previewWeightStatus(byId.negative, id).needsWeightReview, true);
  assert.equal(byId.negative.mass[id].compositionMassKg, null);
  assert.equal(previewWeightStatus(byId.placed, id).locationMissing, false);
  assert.doesNotMatch(massMarkup(byId.placed, id), /placement pending/);
}
assert.equal(effectivePreviewFields(byId.accepted)[0].value, null, 'No invented OD');
assert.equal(sectionMissing(byId.accepted).length, 0, 'Point weight does not need pipe section');
const summary = reviewSummary({ rows, sourceLengthUnit: 'mm' }, 'EMPTY');
assert.equal(summary.groups.find(group => group.id === 'weights').count, 2, 'Missing location is not missing weight');
assert.equal(summary.coverage, 1, 'Strict case coverage still counts only placed component');
const stale = buildLoadCalcPreview({ ...inputs, stale: true }).find(row => row.entityId === 'accepted');
assert.equal(previewWeightStatus(stale, 'EMPTY').label, 'Weight evidence (stale): 59 kg');
assert.match(previewRowMarkup(stale, 'EMPTY'), /STALE/);
assert.equal(resolveComponentCaseMass(components[0], 'EMPTY', createPipingLoadCompositionProfile()).ok, false);
assert.equal(JSON.stringify(inputs), original, 'No input or authority mutation');
console.log('PASS weight/location status: applied/source/zero/missing/negative/stale mass, no invented section/location, strict core/coverage unchanged, known point dry mass separately displayed, pending proposals retained, both table surfaces truthful.');
