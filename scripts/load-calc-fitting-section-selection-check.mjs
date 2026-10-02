import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { derivePipeLikeFittingWeightEvidence, reviewPipeLikeFittingSection } from '../src/core/model-loads/elbow-derived-mass.js';
import { buildModelLoadFoundation } from '../src/core/model-loads/model-load-foundation.js';
import { buildPipingPortTopologyGraph } from '../src/core/piping-topology/index.js';
import { createSharedPipingModel } from '../src/core/shared-piping-model/index.js';
import { normalizeWorkspaceDataset } from '../src/workspace/dataset-adapter.js';
import { buildWeightReviewRows } from '../src/workspace/load-calc-weight-review-model.js';
import { collapsedWeightRowMarkup } from '../src/workspace/load-calc-weight-review-dialog.js';

const evidence = (value) => ({ value });
const point = (x) => ({ x, y: 0, z: 0 });
const pipe = (key, od, wall, branchId = 'B2') => ({
  componentKey: key, sourceEntityId: key, type: 'PIPE', identity: { branchId },
  geometry: { start: point(0), end: point(1000), center: null, ports: [] },
  engineeringProperties: { outerDiameterMm: evidence(od), wallThicknessMm: evidence(wall),
    materialDensityKgM3: evidence(7850), insulationThicknessMm: evidence(0),
    fluidDensityOpeKgM3: evidence(800), fluidDensityHydKgM3: evidence(1000) },
});
const fitting = { componentKey: 'ELBO-150', type: 'ELBO', identity: { branchId: 'B2' },
  geometry: { start: point(0), end: point(100), center: point(50), ports: [],
    applicationPoint: point(0.05), sources: { center: 'fixture.explicitCenter' } }, engineeringProperties: {} };
const dn80 = pipe('PIPE-80', 88.9, 7.62);
const dn150 = pipe('PIPE-150', 168.3, 14.2748);
const original = JSON.stringify([fitting, dn80, dn150]);
for (const order of [[dn80, dn150], [dn150, dn80]]) {
  assert.equal(derivePipeLikeFittingWeightEvidence(fitting, order), null);
  assert.equal(reviewPipeLikeFittingSection(fitting, order).code, 'CONFLICTING_BRANCH_PIPE_SECTIONS');
}
assert.equal(JSON.stringify([fitting, dn80, dn150]), original, 'No source mutation');

const equivalent = { ...dn150, componentKey: 'A-PIPE-150' };
const before = derivePipeLikeFittingWeightEvidence(fitting, [dn150]);
const independentlyCalculated = Math.PI / 4 * (0.1683 ** 2 - (0.1683 - 2 * 0.0142748) ** 2)
  * 7850 * 1.5 * 0.1683;
assert.ok(Math.abs(before.value - independentlyCalculated) < 1e-12, 'Existing formula unchanged');
for (const order of [[dn150, equivalent], [equivalent, dn150]]) {
  const actual = derivePipeLikeFittingWeightEvidence(fitting, order);
  assert.equal(actual.value, before.value);
  assert.equal(actual.derivation.sourceComponentKey, 'A-PIPE-150', 'Provenance order invariant');
}
for (const [field, value] of [['outerDiameterMm', 200], ['wallThicknessMm', 5], ['materialDensityKgM3', 8000]]) {
  const changed = structuredClone(dn150);
  changed.engineeringProperties[field] = evidence(value);
  assert.equal(derivePipeLikeFittingWeightEvidence(fitting, [dn150, changed]), null, field);
}
const incomplete = structuredClone(dn150);
delete incomplete.engineeringProperties.wallThicknessMm;
assert.equal(reviewPipeLikeFittingSection(fitting, [dn150, incomplete]).code, 'INCOMPLETE_BRANCH_PIPE_SECTION');
for (const [field, value] of [['outerDiameterMm', -1], ['wallThicknessMm', 100], ['materialDensityKgM3', 0]]) {
  const invalid = structuredClone(dn150);
  invalid.engineeringProperties[field] = evidence(value);
  assert.equal(reviewPipeLikeFittingSection(fitting, [invalid]).code, 'INVALID_BRANCH_PIPE_SECTION');
}
assert.equal(derivePipeLikeFittingWeightEvidence(fitting, [pipe('OTHER', 168.3, 14.2748, 'OTHER')]), null);
for (const value of [0, 100, -1]) {
  const explicit = { ...fitting, engineeringProperties: { componentWeightKg: evidence(value) } };
  assert.equal(derivePipeLikeFittingWeightEvidence(explicit, [dn80, dn150]), null, 'Explicit evidence cannot be overridden');
  assert.equal(reviewPipeLikeFittingSection(explicit, [dn80, dn150]).code, 'EXPLICIT_COMPONENT_WEIGHT');
}
const review = buildWeightReviewRows({ components: [dn80, dn150, fitting] }).find((row) => row.entityId === fitting.componentKey);
const summary = collapsedWeightRowMarkup(review, 'EMPTY').split('</summary>')[0];
assert.match(summary, /Dry\/metal: Pending/);
assert.match(summary, /Conflicting pipe sections on this branch; no fitting weight borrowed/);
assert.doesNotMatch(summary, /Dry\/metal: (?:2\.037|13\.689) kg/);

// Actual primitive consumer must retain missing mass instead of a fabricated load.
const model = createSharedPipingModel({ project: { datasetId: 'section-ambiguity' },
  units: { length: 'mm', force: 'N', mass: 'kg' },
  sourceSnapshotRef: { schema: 'source-package-snapshot/v1', datasetId: 'section-ambiguity',
    sourceSchema: 'fixture', sourceSemanticHash: 'fixture-source' },
  components: [dn80, dn150, fitting], supports: [] });
const foundation = buildModelLoadFoundation(model, buildPipingPortTopologyGraph(model));
const outcomes = foundation.loadPrimitiveSet.componentOutcomes.filter((row) => row.componentKey === fitting.componentKey);
assert.equal(outcomes.length, 3);
assert.ok(outcomes.every((row) => !row.ready && row.blockers.includes('UNSUPPORTED_COMPONENT_TYPE')),
  'Existing short-code ELBO classification remains unchanged when explicit/derived mass is absent');
assert.ok(!foundation.loadPrimitiveSet.primitives.some((row) => row.componentKey === fitting.componentKey));
const longTypeModel = createSharedPipingModel({ ...model,
  components: [dn80, dn150, { ...fitting, type: 'ELBOW' }] });
const longTypeFoundation = buildModelLoadFoundation(longTypeModel, buildPipingPortTopologyGraph(longTypeModel));
assert.ok(longTypeFoundation.loadPrimitiveSet.componentOutcomes.filter((row) => row.componentKey === fitting.componentKey)
  .every((row) => !row.ready && row.blockers.includes('MISSING_COMPONENT_MASS')));

// Real source geometry/identity remains untouched; test sections are fixture-only inputs.
const raw = JSON.parse(readFileSync(new URL('../public/fixtures/Sjson.json', import.meta.url), 'utf8'));
const dataset = normalizeWorkspaceDataset(raw, 'Sjson.json');
const realElbow = dataset.sharedModel.components.find((row) => row.componentKey === '=1006649732/51228');
assert.ok(realElbow);
const b2Pipes = dataset.sharedModel.components.filter((row) => row.type === 'PIPE'
  && row.identity.branchId === realElbow.identity.branchId).map((row) => {
  const source = dataset.entities.find((entity) => entity.entityId === row.componentKey);
  const section = source.boreMm === 150 ? dn150 : source.boreMm === 80 ? dn80 : null;
  assert.ok(section, `Unexpected bore ${source.boreMm}`);
  return { ...row, engineeringProperties: section.engineeringProperties };
});
assert.ok(b2Pipes.length > 1);
for (const rows of [b2Pipes, [...b2Pipes].reverse()]) {
  const selected = derivePipeLikeFittingWeightEvidence(realElbow, rows);
  assert.equal(reviewPipeLikeFittingSection(realElbow, rows).code, 'MATCHED_PIPE_BORE_SECTION');
  assert.ok(Math.abs(selected.value - independentlyCalculated) < 1e-12);
  assert.equal(selected.derivation.outerDiameterMm, 168.3);
  assert.equal(selected.derivation.sectionSelection.nominalBoreMm, 150);
  const noBore = { ...realElbow, compatibilityEvidence: {} };
  assert.equal(derivePipeLikeFittingWeightEvidence(noBore, rows), null, 'Missing source bore still cannot select between sizes');
}
console.log('PASS fitting-section-selection: permutation/independent unchanged formula/invalid/incomplete/precedence/immutability/real primitive/UI/Sjson B2 source-bore selection and no-bore negative controls; fitting methodology and full loads NOT_QUALIFIED');
