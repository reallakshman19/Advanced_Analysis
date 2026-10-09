import assert from 'node:assert/strict';
import { createSharedPipingModel, semanticHash } from '../src/core/shared-piping-model/index.js';
import { createNonFeaEnrichmentSidecar, resolveNonFeaEnrichment } from '../src/core/non-fea-enrichment/index.js';
import { createNonFeaEffectiveCommonInputProjection } from '../src/workspace/project-data/non-fea-effective-common-input-projection.js';
import { createLoadCalcInsulationDefaultProvider, applyPreviewInsulationThickness } from '../src/workspace/load-calc-insulation-input.js';
import { NonFeaEnrichmentStore } from '../src/workspace/enrichment/non-fea-enrichment-store.js';
import { createNonFeaProductEngineeringDefaultProvider, LOAD_CALC_INSULATION_ZERO_DEFAULT_V1 } from '../src/workspace/project-data/non-fea-product-engineering-default-profile.js';
import { projectEngineeringLoadSources } from '../src/core/model-loads/load-source-projection.js';
import { buildPipingPortTopologyGraph } from '../src/core/piping-topology/index.js';
import { resolveComponentCaseMassValues } from '../src/core/model-loads/component-mass-resolver.js';
import { createPipingLoadCompositionProfile } from '../src/core/model-loads/composition-profile.js';
import { buildLoadCalcPreview } from '../src/workspace/load-calc-preview-model.js';
import { previewRowMarkup } from '../src/workspace/load-calc-preview-table.js';

const e = (value, unit) => ({ value, unit, sourceKind: 'SOURCE_EXPLICIT', sourcePath: 'fixture' });
const sourceModel = createSharedPipingModel({ project: { datasetId: 'insulation-test' },
  units: { length: 'm' }, sourceSnapshotRef: { schema: 'source-package-snapshot/v1', datasetId: 'insulation-test', sourceSchema: 'fixture/v1', sourceSemanticHash: semanticHash({ fixture: 'insulation' }) }, components: [{ componentKey: 'PIPE', type: 'PIPE',
    identity: { branchId: 'B', lineId: 'L' }, geometry: { start: { x: 0, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 } },
    engineeringProperties: { outerDiameterMm: e(100, 'mm'), wallThicknessMm: e(5, 'mm'),
      materialDensityKgM3: e(7850, 'kg/m3'), fluidDensityOpeKgM3: e(800, 'kg/m3'), fluidDensityHydKgM3: e(1000, 'kg/m3') } }], supports: [] });
const original = JSON.stringify(sourceModel);
const store = new NonFeaEnrichmentStore(); store.loadSource(sourceModel.semanticHash);
function effective(model = sourceModel, records = store.getSnapshot().acceptedRecords) {
  const provider = createLoadCalcInsulationDefaultProvider({ sourceModel: model });
  const material = { ...provider }; delete material.semanticHash;
  assert.equal(provider.semanticHash, semanticHash(material));
  const sidecar = createNonFeaEnrichmentSidecar({ sourceSemanticHash: model.semanticHash, records: [...records, ...provider.records] });
  const ledger = resolveNonFeaEnrichment({ sourceModel: model, sidecar });
  return createNonFeaEffectiveCommonInputProjection({ sourceModel: model, candidateResolutionLedger: ledger }).enrichedProjection.enrichedModel;
}
function masses(model) {
  const c = projectEngineeringLoadSources(model, buildPipingPortTopologyGraph(model)).components[0];
  return ['EMPTY', 'OPE', 'HYD'].map((id) => resolveComponentCaseMassValues(c, id, createPipingLoadCompositionProfile()));
}
const zero = effective();
assert.equal(zero.components[0].engineeringProperties.insulationThicknessMm.value, 0);
assert.equal(zero.components[0].engineeringProperties.insulationThicknessMm.sourceKind, 'PRODUCT_DEFAULT');
assert.equal(zero.components[0].engineeringProperties.insulationThicknessMm.sourceRoot, LOAD_CALC_INSULATION_ZERO_DEFAULT_V1.profileId);
assert.ok(masses(zero).every((row) => row.ok));
assert.ok(masses(zero).every((row) => row.massSourceBreakdown.find((s) => s.sourceId === 'INSULATION').massPerLengthKgM === 0));
assert.equal(createNonFeaProductEngineeringDefaultProvider({ sourceModel }).records.length, 0, 'Generic provider still defaults to empty');
const html = previewRowMarkup(buildLoadCalcPreview({ components: projectEngineeringLoadSources(zero, buildPipingPortTopologyGraph(zero)).components })[0], 'EMPTY');
assert.match(html, /0 mm fallback · uninsulated/); assert.match(html, /Apply thickness/); assert.match(html, /Use source \/ default/);
const apply = (text) => applyPreviewInsulationThickness({ store, sourceModel, entityId: 'PIPE', text });
for (const text of ['-1', 'NaN', 'Infinity', 'abc']) assert.throws(() => apply(text), /finite non-negative/);
assert.equal(store.getSnapshot().acceptedRecords.length, 0);
apply('25');
const positiveNoDensity = effective();
assert.ok(masses(positiveNoDensity).every((row) => row.code === 'MISSING_INSULATION_INPUT'), 'Positive insulation cannot silently lose density');
const withDensity = createSharedPipingModel({ ...sourceModel, components: sourceModel.components.map((c) => ({ ...c,
  engineeringProperties: { ...c.engineeringProperties, insulationDensityKgM3: e(100, 'kg/m3') } })) });
const remappedRecords = store.getSnapshot().acceptedRecords.map((r) => ({ ...r, evidence: { ...r.evidence, sourceSemanticHash: withDensity.semanticHash } }));
const insulated = effective(withDensity, remappedRecords);
const expected = Math.PI / 4 * (0.15 ** 2 - 0.1 ** 2) * 100;
assert.ok(masses(insulated).every((row) => Math.abs(row.massSourceBreakdown.find((s) => s.sourceId === 'INSULATION').massPerLengthKgM - expected) < 1e-12));
assert.notEqual(positiveNoDensity.semanticHash, zero.semanticHash);
apply('30'); assert.equal(store.getSnapshot().acceptedRecords.length, 1); assert.equal(effective().components[0].engineeringProperties.insulationThicknessMm.value, 30);
apply(''); assert.equal(store.getSnapshot().acceptedRecords.length, 0); assert.deepEqual(effective(), zero);
const supplied = createSharedPipingModel({ ...withDensity, components: withDensity.components.map((c) => ({ ...c,
  engineeringProperties: { ...c.engineeringProperties, insulationThicknessMm: e(40, 'mm') } })) });
assert.equal(effective(supplied, []).components[0].engineeringProperties.insulationThicknessMm.value, 40, 'Source thickness wins over zero');
const negative = createSharedPipingModel({ ...supplied, components: supplied.components.map((c) => ({ ...c,
  engineeringProperties: { ...c.engineeringProperties, insulationThicknessMm: e(-1, 'mm') } })) });
assert.ok(masses(effective(negative, [])).every((r) => r.code === 'INVALID_NEGATIVE_VALUE'));
const direct = createSharedPipingModel({ ...sourceModel, components: sourceModel.components.map((c) => ({ ...c,
  engineeringProperties: { ...c.engineeringProperties, insulationWeightKgPerM: e(3, 'kg/m') } })) });
assert.ok(masses(effective(direct, [])).every((r) => r.massSourceBreakdown.find((s) => s.sourceId === 'INSULATION').massPerLengthKgM === 3), 'Direct insulation weight is not zeroed');
const invalid = createSharedPipingModel({ ...sourceModel, components: sourceModel.components.map((c) => ({ ...c,
  diagnostics: [{ code: 'ENGINEERING_PROPERTY_INVALID', severity: 'WARNING', field: 'insulationThicknessMm' }] })) });
assert.equal(createLoadCalcInsulationDefaultProvider({ sourceModel: invalid }).records.length, 0, 'Invalid source is not missing');
assert.ok(masses(effective(invalid, [])).every((r) => r.code === 'MISSING_INSULATION_INPUT'));
store.loadSource(supplied.semanticHash); assert.throws(() => apply('25'), /stale/);
assert.equal(JSON.stringify(sourceModel), original);
console.log('PASS insulation preview: missing-zero, positive independent annulus, source precedence, exact edit/reset, invalid/stale guards, source immutability and hash custody');
