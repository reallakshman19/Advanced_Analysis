import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEvidenceIndex } from '../src/core/shared-piping-model/evidence-index.js';
import { collectSourcePortBoreEvidence } from '../src/core/shared-piping-model/source-port-bore-evidence.js';
import { createSharedPipingModel, validateSharedPipingModel } from '../src/core/shared-piping-model/index.js';
import { buildPipingPortTopologyGraph } from '../src/core/piping-topology/index.js';
import { projectEngineeringLoadSources, validateEngineeringLoadSourceProjection } from '../src/core/model-loads/load-source-projection.js';
import { buildModelLoadFoundation } from '../src/core/model-loads/model-load-foundation.js';
import { derivePipeLikeFittingWeightEvidence, reviewPipeLikeFittingSection } from '../src/core/model-loads/elbow-derived-mass.js';
import { normalizeWorkspaceDataset } from '../src/workspace/dataset-adapter.js';

const collect = (value) => collectSourcePortBoreEvidence(createEvidenceIndex([
  ['sourceAttributes', { ABORE: value, LBORE: '80mm' }],
  ['enrichedAttributes', { ABORE: 200 }],
]), 'fixture');
for (const value of [150, '150', '150mm', '150 MM', '1.5e2mm']) {
  const result = collect(value);
  assert.equal(result.values.sourceArriveBoreMm.value, 150);
  assert.equal(result.values.sourceLeaveBoreMm.value, 80);
  assert.equal(result.values.sourceArriveBoreMm.sourceValue, value);
  assert.equal(result.values.sourceArriveBoreMm.sourcePath, 'sourceAttributes.ABORE');
  assert.equal(result.values.sourceArriveBoreMm.unit, 'mm');
  assert.equal(result.diagnostics.length, 0);
  assert.ok(Object.isFrozen(result.values.sourceArriveBoreMm));
}
for (const value of [null, '', 0, -1, true, {}, '6in', '150cm', 'DN150', '150mmgarbage', Infinity]) {
  const result = collect(value);
  assert.equal(result.values.sourceArriveBoreMm.value, null);
  assert.equal(result.values.sourceArriveBoreMm.status, 'INVALID');
  assert.equal(result.diagnostics[0].code, 'SOURCE_PORT_BORE_INVALID');
  if (value && typeof value === 'object') assert.equal(Object.isFrozen(value), false, 'Do not freeze invalid raw source objects');
}
assert.deepEqual(collectSourcePortBoreEvidence(createEvidenceIndex([]), 'absent'), { values: {}, diagnostics: [] });

const raw = JSON.parse(readFileSync(new URL('../public/fixtures/Sjson.json', import.meta.url), 'utf8'));
const sourceBefore = JSON.stringify(raw);
const dataset = normalizeWorkspaceDataset(raw, 'Sjson.json');
const key = '=1006649732/51228';
const elbow = dataset.sharedModel.components.find((row) => row.componentKey === key);
assert.equal(elbow.compatibilityEvidence.sourceArriveBoreMm.value, 150);
assert.equal(elbow.compatibilityEvidence.sourceLeaveBoreMm.value, 150);
assert.equal(elbow.engineeringProperties.nominalBoreMm, undefined, 'Source bore is not a master section assignment');
const section = (od, wall) => ({
  outerDiameterMm: { value: od }, wallThicknessMm: { value: wall }, materialDensityKgM3: { value: 7850 },
  insulationThicknessMm: { value: 0 }, fluidDensityOpeKgM3: { value: 800 }, fluidDensityHydKgM3: { value: 1000 },
});
const pipes = dataset.sharedModel.components.filter((row) => row.type === 'PIPE' && row.identity.branchId === elbow.identity.branchId)
  .map((row) => ({ ...row, engineeringProperties: (row.compatibilityEvidence.sourceArriveBoreMm
    ?? row.compatibilityEvidence.sourceLeaveBoreMm).value === 150
    ? section(168.3, 14.2748) : section(88.9, 7.62) }));
const model = createSharedPipingModel({ ...dataset.sharedModel, components: [elbow, ...pipes], supports: [] });
assert.equal(validateSharedPipingModel(model).ok, true);
const projected = projectEngineeringLoadSources(model, buildPipingPortTopologyGraph(model), {
  lengthUnitFallback: { value: 'mm', approved: true, evidence: { source: 'TEST_ONLY' } },
});
assert.equal(validateEngineeringLoadSourceProjection(projected).ok, true);
const projectedElbow = projected.components.find((row) => row.componentKey === key);
assert.deepEqual(projectedElbow.compatibilityEvidence, elbow.compatibilityEvidence);
const independent = Math.PI / 4 * (0.1683 ** 2 - (0.1683 - 2 * 0.0142748) ** 2) * 7850 * 1.5 * 0.1683;
const derived = derivePipeLikeFittingWeightEvidence(projectedElbow, projected.components);
assert.ok(Math.abs(derived.value - independent) < 1e-12);
assert.equal(derived.derivation.sectionSelection.nominalBoreMm, 150);
assert.deepEqual(derived.derivation.sectionSelection.sourcePaths, [
  elbow.compatibilityEvidence.sourceArriveBoreMm.sourcePath,
  elbow.compatibilityEvidence.sourceLeaveBoreMm.sourcePath,
]);
assert.equal(derivePipeLikeFittingWeightEvidence(projectedElbow, [...projected.components].reverse()).value, derived.value);

const selected = reviewPipeLikeFittingSection(elbow, pipes).sourceComponent;
const badSection = structuredClone(selected);
badSection.engineeringProperties.wallThicknessMm.value = 5;
badSection.componentKey = 'CONFLICT-150';
assert.equal(reviewPipeLikeFittingSection(elbow, [...pipes, badSection]).code, 'CONFLICTING_BRANCH_PIPE_SECTIONS');
const incomplete = structuredClone(selected);
delete incomplete.engineeringProperties.wallThicknessMm;
assert.equal(reviewPipeLikeFittingSection(elbow, [incomplete]).code, 'INCOMPLETE_BRANCH_PIPE_SECTION');
const wrongSize = pipes.find((row) => (row.compatibilityEvidence.sourceArriveBoreMm
  ?? row.compatibilityEvidence.sourceLeaveBoreMm).value === 80);
assert.equal(reviewPipeLikeFittingSection(elbow, [wrongSize]).code, 'MISSING_MATCHING_PIPE_BORE_SECTION');
const invalidBore = { ...elbow, compatibilityEvidence: collect('6in').values };
assert.equal(reviewPipeLikeFittingSection(invalidBore, pipes).code, 'INVALID_SOURCE_PIPE_BORE');
const conflictingBore = { ...elbow, compatibilityEvidence: collect('150mm').values };
assert.equal(reviewPipeLikeFittingSection(conflictingBore, pipes).code, 'CONFLICTING_SOURCE_PIPE_BORES');
const reducer = { ...conflictingBore, type: 'REDU' };
const reducerMass = derivePipeLikeFittingWeightEvidence(reducer, pipes);
assert.equal(reducerMass.derivation.sectionSelection.policy, 'SOURCE_ARRIVE_BORE_PIPE_EQUIVALENT_ESTIMATE_V1');
assert.equal(reducerMass.derivation.sectionSelection.leaveBoreMm, 80);
assert.equal(reducerMass.derivation.developedLengthFactorAssumed, true);
const pointOlet = { ...elbow, type: 'OLET', geometry: { ...elbow.geometry, end: elbow.geometry.start } };
assert.ok(derivePipeLikeFittingWeightEvidence(pointOlet, pipes).value > 0, 'Point geometry cannot fabricate zero mass');
for (const value of [0, 20, -1]) {
  assert.equal(derivePipeLikeFittingWeightEvidence({ ...elbow,
    engineeringProperties: { componentWeightKg: { value } } }, pipes), null);
}

// Real primitive consumer uses retained bore evidence; explicit test placement only.
const located = { ...elbow, geometry: { ...elbow.geometry, center: elbow.geometry.start,
  sources: { ...elbow.geometry.sources, center: 'fixture.explicitCenter' } } };
const locatedModel = createSharedPipingModel({ ...model, units: { length: 'mm', force: 'N', mass: 'kg' },
  components: [located, ...pipes] });
const foundation = buildModelLoadFoundation(locatedModel, buildPipingPortTopologyGraph(locatedModel));
const primitive = foundation.loadPrimitiveSet.primitives.find((row) => row.componentKey === key && row.loadCaseId === 'EMPTY');
assert.ok(primitive);
assert.ok(Math.abs(primitive.pointMassKg - independent) < 1e-12);
const unlocatedModel = createSharedPipingModel({ ...locatedModel, components: [elbow, ...pipes] });
const unlocated = buildModelLoadFoundation(unlocatedModel, buildPipingPortTopologyGraph(unlocatedModel));
assert.ok(unlocated.loadPrimitiveSet.componentOutcomes.filter((row) => row.componentKey === key)
  .every((row) => !row.ready && row.blockers.includes('MISSING_COMPONENT_COG')), 'No location authority fabricated');
const changed = structuredClone(model);
changed.components.find((row) => row.componentKey === key).compatibilityEvidence.sourceArriveBoreMm.value = 80;
assert.equal(validateSharedPipingModel(changed).ok, false, 'Bore custody is hash-bound');
const tampered = structuredClone(projected);
tampered.components.find((row) => row.componentKey === key).compatibilityEvidence.sourceArriveBoreMm.value = 80;
assert.equal(validateEngineeringLoadSourceProjection(tampered).ok, false);
assert.equal(JSON.stringify(raw), sourceBefore, 'Source fixture unchanged');
console.log(`PASS source-bore fitting selection: strict parser/source custody/invalid and mixed-size negatives/order independence/hash guards/real primitive; /51228 dry estimate ${derived.value.toFixed(6)} kg; full loads NOT_RUN`);
