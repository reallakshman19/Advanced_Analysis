import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeWorkspaceDataset } from '../src/workspace/dataset-adapter.js';
import { createSharedPipingModel } from '../src/core/shared-piping-model/index.js';
import { createEmptyProjectDataProfile, createEvidenceValue } from '../src/workspace/project-data/project-data-contract.js';
import { createPreparedReview } from '../src/workspace/load-calc-workbench/prepared-review.js';
import { reviewSummary, filterReviewRows, ReviewDeferrals } from '../src/workspace/load-calc-workbench/workbench-model.js';
import { shellMarkup, rowsMarkup, evidenceMarkup } from '../src/workspace/load-calc-workbench/workbench-view.js';
import { WorkbenchController, createWorkbenchState } from '../src/workspace/load-calc-workbench/workbench-controller.js';

const dataset = normalizeWorkspaceDataset(JSON.parse(readFileSync('public/fixtures/Sjson.json', 'utf8')), 'Sjson.json');
const properties = Object.fromEntries(Object.entries({ outerDiameterMm: 100, wallThicknessMm: 5,
  materialDensityKgM3: 7850, fluidDensityOpeKgM3: 800, fluidDensityHydKgM3: 1000,
  insulationThicknessMm: 25, insulationDensityKgM3: 100 }).map(([key, value]) => [key, { value, source: 'synthetic numeric check' }]));
const identity = { branchId: 'B1', lineId: 'L1' };
const pipe = { componentKey: 'p1', sourceEntityId: 'p1', type: 'PIPE', identity, diagnostics: [],
  engineeringProperties: properties, sourceReferences: {},
  geometry: { start: { x: 0, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 }, ports: [] } };
const tee = { ...pipe, componentKey: 't1', sourceEntityId: 't1', type: 'TEE', engineeringProperties: {}, geometry: {} };
const enrichedModel = createSharedPipingModel({ ...dataset.sharedModel, components: [pipe, tee], supports: [] });
const profile = structuredClone(createEmptyProjectDataProfile());
profile.sourcesAndUnits.lengthUnit = createEvidenceValue('m', { source: 'synthetic approved unit check' }, true);
const proposal = { proposalId: 'pending', record: { selectorKind: 'ENTITY', selectorKey: 'p1',
  fieldId: 'PIPE_WALL_THICKNESS', value: 14.2748, unit: 'mm', sourceId: '<master>', revision: 'R1' } };
const snapshot = { request: { semanticHash: 'request-A', sourceDatasetSha256: dataset.sourceSha256,
  sourceModel: dataset.sharedModel, enrichedProjection: { enrichedModel, sourceSemanticHash: dataset.sharedModel.semanticHash }, projectDataProfile: profile },
  report: { semanticHash: 'report-A', requestSemanticHash: 'request-A' }, error: '' };
const enrichment = { currentSourceSemanticHash: dataset.sharedModel.semanticHash, stale: false,
  proposals: [proposal], acceptedRecords: [{ recordId: 'retained-authority' }] };
const status = { commonInput: { reportSemanticHash: 'report-A', methodRows: [{ coverageRequirements: [{ requirementId: 'MASS_COVERAGE', covered: 1, total: 2, missing: ['t1:MISSING_COMPONENT_COG'] }] }] }, summary: { readyGateCount: 6,
  masterProposalCount: 1, acceptedEnrichmentRecordCount: 1 }, gates: [] };
const input = { workspace: { status: 'ready', dataset }, enrichment, snapshot, status, binding: 'current-A' };
const original = JSON.stringify(input);
const review = createPreparedReview(input);
assert.equal(review.rows.length, 2);
assert.equal(review.sourceLengthUnit, 'm');
assert(review.lengthUnitAuthority, 'Must show the existing approved fallback authority, not guess units');
assert.deepEqual(review.checkerMassCoverage, { covered: 1, total: 2 });
assert.equal(enrichedModel.units.length, 'unknown', 'Projection may not rewrite the enriched source');
const row = review.rows.find((item) => item.entityId === 'p1');
const point = review.rows.find((item) => item.entityId === 't1');
const metal = Math.PI / 4 * (.1 ** 2 - .09 ** 2) * 7850 * 2;
const insulation = Math.PI / 4 * (.15 ** 2 - .1 ** 2) * 100 * 2;
for (const [caseId, density] of [['EMPTY', 0], ['OPE', 800], ['HYD', 1000]]) {
  const fluid = Math.PI / 4 * .09 ** 2 * density * 2;
  for (const [field, expected] of Object.entries({ metalKg: metal, fluidKg: fluid,
    insulationKg: insulation, coreMassKg: metal + fluid + insulation })) {
    assert(Math.abs(row.mass[caseId][field] - expected) < 1e-10, `${caseId} ${field}: independent annular-volume arithmetic`);
  }
  assert.equal(point.mass[caseId].coreMassKg, null, 'Missing point placement is not zero mass or execution');
}
assert.equal(row.component.engineeringProperties.wallThicknessMm.value, 5, 'Pending wall14.2748 cannot replace effective wall5');
assert.equal(row.proposed[0].record.value, 14.2748);
assert.equal(filterReviewRows(review.rows, { category: 'sections' }).length, 2, 'Sections includes pending proposals even if effective values exist');
const deferrals = new ReviewDeferrals();
deferrals.bind('A');
deferrals.defer(point, 'EMPTY', 'Awaiting qualified placement');
assert.equal(reviewSummary(review, 'EMPTY', deferrals.skipped).coverage, 1);
assert.equal(reviewSummary(review, 'EMPTY', deferrals.skipped).deferred, 1);
deferrals.bind('A'); assert.equal(deferrals.skipped.size, 1);
deferrals.bind('B'); assert.equal(deferrals.skipped.size, 0);
assert.throws(() => deferrals.bind(''), /binding/);
const state = { ...createWorkbenchState(), deferrals };
assert.match(shellMarkup(review, state), /Current preparation: Sjson.json/);
assert.match(shellMarkup(review, state), /Checker mass coverage/);
assert.match(rowsMarkup([row], state, 2), /14.2748 mm/);
assert.match(evidenceMarkup(row, state), /&lt;master&gt;/);
assert(!rowsMarkup([row], state, 2).includes('<master>'));
assert(!shellMarkup(review, state).includes('Saved project settings, accepted matches and proposals are not loaded'));
assert.match(shellMarkup(review, { ...state, stage: 2 }), /disabled/);
assert.match(shellMarkup(review, { ...state, stage: 3 }), /data-workbench-results/);
assert.doesNotMatch(shellMarkup(review, { ...state, stage: 3 }), /Results stay bound to/);
assert.doesNotMatch(shellMarkup({ ...review, unavailable: 'stale' }, { ...state, stage: 3 }), /data-workbench-results/);

for (const changed of [
  { workspace: { status: 'empty', dataset: null } },
  { snapshot: { ...snapshot, request: null } },
  { snapshot: { ...snapshot, error: 'PREPARATION_FAILED' } },
  { snapshot: { ...snapshot, report: { ...snapshot.report, requestSemanticHash: 'another-request' } } },
  { snapshot: { ...snapshot, request: { ...snapshot.request, sourceDatasetSha256: 'another-source' } } },
  { snapshot: { ...snapshot, request: { ...snapshot.request, sourceModel: { semanticHash: 'another-model' } } } },
  { enrichment: { ...enrichment, stale: true } },
  { enrichment: { ...enrichment, currentSourceSemanticHash: 'another-model' } },
  { status: { ...status, commonInput: { ...status.commonInput, reportSemanticHash: 'old-report' } } },
  { snapshot: { ...snapshot, request: { ...snapshot.request, enrichedProjection: { enrichedModel, sourceSemanticHash: 'old-source' } } } },
]) {
  const invalid = createPreparedReview({ ...input, ...changed });
  assert(invalid.unavailable);
  assert.equal(invalid.rows.length, 0, 'Invalid preparation withholds all old effective numbers');
  assert.equal(invalid.status, null, 'Old checker metadata cannot be labeled current after a binding failure');
  assert.equal(invalid.requestHash, null);
  assert.equal(invalid.reportHash, null);
  assert.equal(invalid.checkerMassCoverage, null);
  assert.match(shellMarkup(invalid, state), /Current checker evidence unavailable/);
}
const unapproved = structuredClone(snapshot);
unapproved.request.projectDataProfile.sourcesAndUnits.lengthUnit.approved = false;
const unknown = createPreparedReview({ ...input, snapshot: unapproved });
assert.equal(unknown.sourceLengthUnit, 'unknown');
assert.equal(reviewSummary(unknown, 'EMPTY').coverage, 0);
assert.equal(unknown.rows[0].mass.EMPTY.coreMassKg, null);
// An old stale seal is not the fresh request. Show current review, retain gate authority.
assert.equal(createPreparedReview({ ...input, snapshot: { ...snapshot, staleness: { stale: true } } }).rows.length, 2);
assert.equal(JSON.stringify(input), original, 'No source/accepted/proposed/report/result mutation');

// Exercise controller currentness via injected owners; no browser-private-state access.
let currentBinding = 'current-A';
let prepareCount = 0;
const controller = new WorkbenchController({}, { prepare: () => { prepareCount += 1; return review; },
  getBinding: () => currentBinding, state });
controller.review = review;
controller.render = () => {};
assert.equal(controller.checkCurrent(), true);
state.deferrals.bind('current-A'); state.deferrals.defer(point, 'EMPTY', 'Review placement');
currentBinding = 'current-B';
assert.equal(controller.checkCurrent(), false);
assert.equal(controller.review.rows.length, 0);
assert.equal(state.deferrals.skipped.size, 0);
assert.equal(prepareCount, 0, 'Freshness/filter actions cannot silently reprepare, accept or execute');

let resultRenders = 0;
const resultsTarget = {};
const renderRoot = { querySelector: selector => selector === '[data-workbench-results]'
  ? resultsTarget : selector === '#evidence-dialog' ? { addEventListener() {} } : null };
const resultController = new WorkbenchController(renderRoot, { prepare: () => review,
  getBinding: () => currentBinding, renderResults: target => {
    assert.equal(target, resultsTarget); resultRenders += 1;
  }, state: { ...state, stage: 3 } });
resultController.review = review;
resultController.render(); assert.equal(resultRenders, 1);
resultController.review = { ...review, unavailable: 'stale' };
resultController.render(); assert.equal(resultRenders, 1, 'Unavailable inputs cannot render retained loads');

for (const file of ['prepared-review.js', 'workbench-model.js', 'workbench-view.js', 'workbench-controller.js']) {
  const text = readFileSync(new URL(`../src/workspace/load-calc-workbench/${file}`, import.meta.url), 'utf8');
  assert(!/acceptProposal|stageProposal\(|sealCurrent|\.authorize\(|\.execute\(|localStorage|sessionStorage/.test(text));
}
const css = readFileSync('src/workspace/load-calc-workbench/workbench.css', 'utf8');
for (const rule of css.matchAll(/([^{}]+)\{/g)) {
  if (rule[1].trim().startsWith('@')) continue;
  assert(rule[1].split(',').every((selector) => selector.trim().startsWith('.lc-workbench-host')), 'CSS must not leak into legacy workflow');
}
console.log('PASS load-calc-workbench: prepared winner/proposal separation, numeric mass oracle, immutable inputs, approved-unit gate, source/request/report/error negatives, stale-seal distinction, binding reset, injected no-write controller and scoped CSS.');
