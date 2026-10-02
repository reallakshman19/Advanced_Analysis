import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildLoadCalcPreview, effectivePreviewFields } from '../src/workspace/load-calc-preview-model.js';
import { previewRowMarkup } from '../src/workspace/load-calc-preview-table.js';

const pipe = { componentKey: 'pipe', type: 'PIPE', identity: { branchId: 'B1', lineId: 'L1' },
  diagnostics: [], sourceReferences: { jsonPointer: '/0/children/1' },
  geometry: { start: [0, 0, 0], end: [2, 0, 0], sourceLengthM: 2 },
  engineeringProperties: { outerDiameterMm: { value: 100, sourcePath: 'source.OD' }, wallThicknessMm: { value: 5 },
    materialDensityKgM3: { value: 7850 }, fluidDensityOpeKgM3: { value: 800 }, fluidDensityHydKgM3: { value: 1000 },
    insulationThicknessMm: { value: 25 }, insulationDensityKgM3: { value: 100 } } };
const elbow = { componentKey: 'elbow', type: 'ELBO', identity: pipe.identity, diagnostics: [],
  geometry: {}, engineeringProperties: {}, sourceReferences: {} };
const cap = { ...elbow, componentKey: 'cap', type: 'CAP', identity: { branchId: 'B2' } };
const entities = [
  { entityId: 'pipe', properties: { attributes: { ABORE: '80mm', AUTO_GENERATED_PIPE: true } } },
  { entityId: 'elbow', properties: { attributes: { ABORE: '150mm', LBORE: '150mm', DTXR: 'ELBOW LR Sch 80 <source>' } } },
];
const proposals = [{ record: { selectorKind: 'ENTITY', selectorKey: 'pipe', fieldId: 'PIPE_WALL_THICKNESS', value: 14.2748,
  unit: 'mm', sourceId: 'class.json', revision: 'master-hash', evidence: { rowCandidates: [{ schedule: '120', score: 1300 }],
    requestedPipingClass: '91261M7', resolvedPipingClass: '91261', classMatchConfidence: 0.8 } } }];
const inputs = { components: [pipe, elbow, cap], entities, proposals };
const original = JSON.stringify(inputs);
const aliasedRows = buildLoadCalcPreview({ ...inputs, components: inputs.components.map((component) => ({
  ...component, sourceEntityId: `raw-${component.componentKey}`,
})), entities: entities.map((entity) => ({ ...entity, entityId: `raw-${entity.entityId}`, properties: { ...entity.properties, sourceAttributes: {} } })) });
assert.equal(aliasedRows.find((row) => row.entityId === 'elbow').sourceSchedule, '80', 'Normalized component key may differ from raw source entity identity');
assert.ok(aliasedRows.find((row) => row.entityId === 'elbow').notes.some((note) => note.includes('Borrowed pipe bore differs')));
const rows = buildLoadCalcPreview(inputs);
const byId = Object.fromEntries(rows.map((row) => [row.entityId, row]));
assert.equal(rows.length, 3);
assert.equal(byId.pipe.sourceSchedule, null, 'A fitting description must never become a pipe schedule');
assert.equal(byId.elbow.sourceSchedule, '80');
assert.equal(byId.pipe.proposed[0].record.evidence.rowCandidates[0].schedule, '120');
assert.equal(byId.elbow.proposed.length, 0, 'Proposals belong only to exact selectors');
assert.equal(effectivePreviewFields(byId.pipe)[1].value, 5, 'Pending wall cannot override effective wall');
assert.equal(effectivePreviewFields(byId.elbow)[0].value, null, 'Borrowed section cannot appear as own section');
assert.ok(byId.elbow.notes.some((note) => note.includes('Borrowed pipe bore differs')));
assert.ok(byId.elbow.mass.EMPTY.metalKg > 0);
assert.equal(byId.elbow.mass.EMPTY.coreMassKg, null, 'Known dry mass cannot unblock missing placement');
assert.equal(byId.cap.mass.OPE.metalKg, null);
assert.ok(byId.cap.needsReview);
assert.equal(byId.pipe.mass.EMPTY.fluidKg, 0, 'EMPTY is an actual zero fluid policy, not missing evidence');
assert.ok(byId.pipe.mass.HYD.coreMassKg > byId.pipe.mass.OPE.coreMassKg);
assert.match(previewRowMarkup(byId.pipe, 'EMPTY'), /Top candidate Sch 120/);
assert.match(previewRowMarkup(byId.pipe, 'EMPTY'), /Distributed over source length/);
assert.match(previewRowMarkup(byId.elbow, 'OPE'), /Fitting description Sch: <b>80/);
assert.match(previewRowMarkup(byId.elbow, 'OPE'), /&lt;source&gt;/);
assert.match(previewRowMarkup(byId.elbow, 'OPE'), /MISSING_COMPONENT_COG/);
assert.match(previewRowMarkup(byId.cap, 'OPE'), /Dry \/ metal: <b>Pending/);
assert.equal(JSON.stringify(inputs), original, 'All source/effective/proposed inputs remain byte-for-byte unchanged');
assert.ok(buildLoadCalcPreview({ ...inputs, stale: true }).every((row) => row.needsReview && row.notes[0].startsWith('STALE')));
const view = await readFile(new URL('../src/workspace/load-calc-preview-view.js', import.meta.url), 'utf8');
assert.ok(!/acceptProposal|stageProposal\(|sealCurrent|authorize|replaceProjectDataValue/.test(view), 'No approval or numerical authority writes');
const controller = await readFile(new URL('../src/workspace/load-calc-consumer-controller.js', import.meta.url), 'utf8');
const shell = await readFile(new URL('../src/workspace/load-calc-consumer-view.js', import.meta.url), 'utf8');
assert.ok(controller.includes("tab === 'preview'"));
assert.ok(shell.includes('data-load-calc-tab="preview"'));
console.log('PASS load-calc-preview-check: scoped schedules, pending/effective separation, section trace, partial mass, stale evidence, escaping, immutability and dedicated route');
