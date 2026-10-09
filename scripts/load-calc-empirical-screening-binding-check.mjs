import assert from 'node:assert/strict';
import { semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { buildAutomaticEmpiricalScreening } from '../src/workspace/load-calc-empirical-screening-binding.js';
import { bindEmpiricalScreeningPreview, renderEmpiricalScreeningPreview } from '../src/workspace/load-calc-empirical-screening.js';
import { calculateSupportLoadScreeningTerms, DEFAULT_SUPPORT_LOAD_PROFILE } from '../src/calc-workspace/supportLoadEngine.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeWorkspaceDataset } from '../src/workspace/dataset-adapter.js';
import { buildSupportSiteModel } from '../src/workspace/support-sites/support-site-model.js';
import { buildRoutePartitionModel } from '../src/workspace/routes/route-partition-model.js';
import { resolveNonFeaEnrichment, createNonFeaEnrichedProjection } from '../src/core/non-fea-enrichment/index.js';
import { empiricalScreeningReferences } from '../src/workspace/load-calc-empirical-screening.js';
import { draftSupportLoadsModel } from '../src/workspace/load-calc-workbench/draft-support-loads.js';
import { supportMarkup } from '../src/workspace/load-calc-workbench/draft-loads-inspector.js';

const operating = 'AT WORKING CONDITIONS | Temp. ºC';
const design = 'DESIGN CONDITIONS | Temp Max ºC';
const ref = { supportSiteId: 'site', tags: ['PS-test'], opeVerticalN: 3811.49 };
function fixture() {
  const distribution = { datasetId: 'D', freshness: { status: 'CURRENT' }, method: 'CHAINAGE_TRIBUTARY_SPAN_V3_COG',
    loadCases: [{ loadCaseId: 'OPE', status: 'CALCULATED', supportResults: [{ ...ref, verticalForceN: ref.opeVerticalN, status: 'CALCULATED' }] }] };
  const dataset = { datasetId: 'D', sourceSha256: 'source', sharedModel: { semanticHash: 'model' },
    entities: [{ entityId: 'P', entityType: 'PIPE', lineKey: 'S8811951', properties: {} }] };
  const supportSiteModel = { datasetId: 'D', status: 'READY', sites: [{ siteId: 'site', branchIds: ['B'], positionMm: { x: 5, y: 0, z: 0 } }] };
  const routePartitionModel = { datasetId: 'D', status: 'READY', portMatchToleranceMm: 0,
    routes: [{ routeId: 'R', branchId: 'B', status: 'READY', physicalEdgeIds: ['P'] }],
    edges: [{ entityId: 'P', branchId: 'B', physical: true, lengthMm: 10, startMm: { x: 0, y: 0, z: 0 }, endMm: { x: 10, y: 0, z: 0 } }] };
  const commonState = { staleness: { stale: false }, error: null, commonInput: {
    semanticHash: 'seal', sourceModelSemanticHash: 'model', sourceDatasetSha256: 'source', enrichedModel: {
      components: [{ componentKey: 'P', type: 'PIPE', identity: { lineId: 'S8811951' }, engineeringProperties: {
        outerDiameterMm: { value: 168.3, unit: 'mm', status: 'READY' }, wallThicknessMm: { value: 14.2748, unit: 'mm', status: 'READY' } } }] } } };
  const execution = { datasetId: 'D', sourceDatasetSha256: 'source', sourceModelSemanticHash: 'model', commonInputSemanticHash: 'seal',
    distributionSemanticHash: semanticHash(distribution), supportSiteModelSemanticHash: semanticHash(supportSiteModel), routePartitionModelSemanticHash: semanticHash(routePartitionModel) };
  const lineList = { sourceHash: 'workbook-hash', fileName: 'line-list.xlsx', sheetName: 'LineList', fieldMap: { t1: design, t2: operating },
    normalizedRows: [{ lineKey: 'S8811951', t1: '325', t2: '309', _sourceRowNumber: 319, _sourceSheet: 'LineList', _sourceProvenance: { [operating]: 309, [design]: 325 } }] };
  return { distribution, context: { dataset, commonState, execution, supportSiteModel, routePartitionModel, lineList } };
}
function run(f) { return buildAutomaticEmpiricalScreening([ref], f.distribution, f.context); }
function rebind(f) {
  f.context.execution.supportSiteModelSemanticHash = semanticHash(f.context.supportSiteModel);
  f.context.execution.routePartitionModelSemanticHash = semanticHash(f.context.routePartitionModel);
}
const f = fixture(); const before = JSON.stringify(f); const result = run(f); const row = result.rows[0];
assert.equal(row.status, 'SCREENING_ESTIMATE');
assert.deepEqual(row.inputs, { outsideDiameterMm: 168.3, wallThicknessMm: 14.2748, temperatureC: 309 });
assert.equal(row.provenance.temperatureC.rowNumber, 319); assert.equal(row.provenance.temperatureC.canonicalField, 't2');
assert.equal(row.provenance.temperatureC.basis, 'CURRENT_MAPPED_LINE_LIST_NOT_GRAVITY_SEAL');
assert.deepEqual(row.terms, calculateSupportLoadScreeningTerms({ opeVerticalN: ref.opeVerticalN, ...row.inputs }, DEFAULT_SUPPORT_LOAD_PROFILE));
assert.equal(JSON.stringify(f), before); assert.ok(Object.isFrozen(row.inputs));
assert.equal(Object.isFrozen(f.context.commonState.commonInput.enrichedModel.components[0].engineeringProperties.outerDiameterMm), false);
assert.equal(Object.isFrozen(ref.tags), false);
for (const change of [
  x => { x.context.commonState.staleness.stale = true; },
  x => { x.context.execution.commonInputSemanticHash = 'other'; },
  x => { x.context.execution.distributionSemanticHash = 'other'; },
  x => { x.context.execution.sourceDatasetSha256 = 'other'; },
  x => { x.context.dataset.sharedModel.semanticHash = 'other'; },
  x => { x.context.supportSiteModel.sites[0].positionMm.x = 6; },
  x => { x.context.routePartitionModel.edges[0].branchId = 'other'; },
]) { const x = fixture(); change(x); assert.equal(run(x).summary.estimated, 0); }
for (const change of [
  x => { x.context.routePartitionModel.edges[0].physical = false; },
  x => { x.context.routePartitionModel.edges[0].topologyCarrier = true; },
  x => { x.context.routePartitionModel.edges[0].pointComponent = true; },
  x => { x.context.routePartitionModel.edges[0].branchId = 'other'; },
  x => { x.context.supportSiteModel.sites[0].positionMm.y = 0.001; },
  x => { x.context.routePartitionModel.edges.push({ ...x.context.routePartitionModel.edges[0] }); },
  x => { x.context.routePartitionModel.routes.push({ ...x.context.routePartitionModel.routes[0] }); },
  x => { x.context.supportSiteModel.sites.push({ ...x.context.supportSiteModel.sites[0] }); },
]) { const x = fixture(); change(x); rebind(x); assert.equal(run(x).summary.estimated, 0); }
const ambiguous = fixture();
ambiguous.context.dataset.entities.push({ ...ambiguous.context.dataset.entities[0], entityId: 'P2' });
ambiguous.context.routePartitionModel.routes[0].physicalEdgeIds.push('P2');
ambiguous.context.routePartitionModel.edges.push({ ...ambiguous.context.routePartitionModel.edges[0], entityId: 'P2' });
rebind(ambiguous); assert.deepEqual(run(ambiguous).rows[0].candidatePipeIds, ['P', 'P2']); assert.equal(run(ambiguous).rows[0].pipeId, null);
function straightJoin() {
  const x = fixture();
  x.context.routePartitionModel.edges[0].endMm.x = 5;
  x.context.dataset.entities.push({ ...x.context.dataset.entities[0], entityId: 'P2' });
  x.context.routePartitionModel.routes[0].physicalEdgeIds.push('P2');
  x.context.routePartitionModel.edges.push({ ...x.context.routePartitionModel.edges[0], entityId: 'P2',
    startMm: { x: 5, y: 0, z: 0 }, endMm: { x: 10, y: 0, z: 0 } });
  x.context.commonState.commonInput.enrichedModel.components.push({
    ...structuredClone(x.context.commonState.commonInput.enrichedModel.components[0]), componentKey: 'P2' });
  rebind(x); return x;
}
const join = straightJoin(), joinBefore = JSON.stringify(join), joined = run(join).rows[0];
assert.equal(joined.status, 'SCREENING_ESTIMATE'); assert.equal(joined.pipeId, null);
assert.equal(joined.matchMethod, 'EXACT_STRAIGHT_JOIN_SHARED_INPUTS');
assert.deepEqual(joined.terms, row.terms); assert.equal(joined.provenance.sharedPipeBasis.length, 2);
assert.match(renderEmpiricalScreeningPreview(join.distribution, join.context), /Shared straight-join section \(2 pipes\)/);
assert.equal(JSON.stringify(join), joinBefore);
for (const change of [
  x => { x.context.commonState.commonInput.enrichedModel.components[1].engineeringProperties.wallThicknessMm.value = 10; },
  x => { x.context.commonState.commonInput.enrichedModel.components[1].engineeringProperties.outerDiameterMm.value = 200; },
  x => { x.context.commonState.commonInput.enrichedModel.components[1].engineeringProperties.wallThicknessMm.status = 'STALE'; },
  x => { x.context.commonState.commonInput.enrichedModel.components[1].identity.lineId = 'OTHER'; },
  x => { x.context.dataset.entities[1].properties = { sourceAttributes: { OP_TEMP_C: 100 } }; },
  x => { x.context.routePartitionModel.edges[1].endMm.y = 5; },
  x => { x.context.routePartitionModel.edges[1].endMm.x = 0; },
  x => { x.context.routePartitionModel.edges[1].startMm.x = 4; },
  x => { x.context.routePartitionModel.routes[0].physicalEdgeIds.pop();
    x.context.routePartitionModel.routes.push({ routeId: 'R2', branchId: 'B', status: 'READY', physicalEdgeIds: ['P2'] }); },
]) { const x = straightJoin(); change(x); rebind(x); assert.equal(run(x).summary.estimated, 0); }
// Actual Sjson/accepted section custody and exact two joins; temperature table is
// a declared test double here. The live workbook binding is checked in browser.
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const bytes = readFileSync('public/fixtures/Sjson.json');
const source = normalizeWorkspaceDataset(JSON.parse(bytes), 'Sjson.json', {
  sourceBytes: bytes, sourceSha256: createHash('sha256').update(bytes).digest('hex') });
const profile = read('relay/WORK/load-calc-run-readiness-v32-project-data.json');
const captured = read(process.argv[2] || 'relay/WORK/load-calc-new-ui-v32-gravity-export.json');
const projection = createNonFeaEnrichedProjection({ sourceModel: source.sharedModel,
  resolutionLedger: resolveNonFeaEnrichment({ sourceModel: source.sharedModel, sidecar: captured.enrichmentSidecar }) });
const actualContext = { dataset: source, execution: captured.receipt,
  supportSiteModel: buildSupportSiteModel(source, profile), routePartitionModel: buildRoutePartitionModel(source, profile),
  commonState: { staleness: { stale: false }, commonInput: { semanticHash: captured.receipt.commonInputSemanticHash,
    sourceModelSemanticHash: source.sharedModel.semanticHash, sourceDatasetSha256: source.sourceSha256,
    enrichedModel: projection.enrichedModel } }, lineList: fixture().context.lineList };
const actualRows = buildAutomaticEmpiricalScreening(empiricalScreeningReferences(captured.receipt.distribution), captured.receipt.distribution, actualContext).rows;
for (const tag of ['PS-12244', 'PS-12246']) {
  const actual = actualRows.find(r => r.tags.includes(tag));
  assert.equal(actual.status, 'SCREENING_ESTIMATE', JSON.stringify(actual.reasons));
  assert.equal(actual.pipeId, null); assert.equal(actual.candidatePipeIds.length, 2);
  assert.equal(actual.matchMethod, 'EXACT_STRAIGHT_JOIN_SHARED_INPUTS');
  assert.equal(actual.inputs.wallThicknessMm, 14.2748);
  assert.deepEqual(actual.terms, calculateSupportLoadScreeningTerms({ opeVerticalN: actual.opeVerticalN, ...actual.inputs }, DEFAULT_SUPPORT_LOAD_PROFILE));
}
assert.equal(actualRows.find(r => r.tags.includes('=1006649732/51254')).status, 'UNRESOLVED');
actualContext.commonState.request = { semanticHash: 'captured-request' };
actualContext.commonState.commonInput.requestSemanticHash = 'captured-request';
actualContext.commonState.commonInput.seal = { semanticHash: captured.receipt.commonInputSealSemanticHash };
const canonical = { datasetId: source.datasetId, sourceHash: source.sourceSha256, canonicalTopologyHash: 'test-topology',
  supports: actualContext.supportSiteModel.sites.flatMap(site => site.memberEntityIds.map(id => ({ id: `support:${id}`, entityId: id }))) };
const actualBundle = { datasetId: source.datasetId, execution: captured.receipt, distribution: captured.receipt.distribution,
  supportSiteModel: actualContext.supportSiteModel, screeningContext: actualContext };
const draft = { dataset: source, canonical, baseCanonical: canonical };
const selectedLoads = draftSupportLoadsModel(actualBundle, draft, ['support:=1006649732/51240']);
assert.equal(selectedLoads.state, 'CURRENT');
const selectedSupport = selectedLoads.supports[0];
assert.equal(selectedSupport.screening.status, 'SCREENING_ESTIMATE');
assert.match(supportMarkup(selectedSupport, 'OPE', selectedLoads), /Fh · guide: <strong>1,050\.356 N/);
assert.match(supportMarkup(selectedSupport, 'OPE', selectedLoads), /not reactions/);
assert.doesNotMatch(supportMarkup(selectedSupport, 'HYD', selectedLoads), /Fh · guide:/);
assert.equal(selectedSupport.scenario.length, 0);
const staleScreen = structuredClone(actualBundle);
staleScreen.screeningContext.execution = { ...staleScreen.screeningContext.execution, routePartitionModelSemanticHash: 'changed' };
// Screening has its own route-currentness guard even while scalar gravity is retained.
const staleResult = draftSupportLoadsModel(staleScreen, { ...draft, dataset: staleScreen.screeningContext.dataset }, ['support:=1006649732/51240']);
assert.equal(staleResult.supports[0].screening.status, 'UNRESOLVED');
for (const change of [
  x => { x.context.lineList.normalizedRows[0].lineKey = 'W8811951'; },
  x => { x.context.lineList.normalizedRows.push({ ...x.context.lineList.normalizedRows[0] }); },
  x => { delete x.context.lineList.fieldMap.t2; },
  x => { x.context.lineList.fieldMap.t3 = operating; },
  x => { x.context.lineList.fieldMap.t2 = 'Operating temperature'; },
  x => { x.context.lineList.normalizedRows[0].t2 = 325; },
  x => { x.context.lineList.normalizedRows[0].t2 = ''; },
  x => { x.context.lineList.sourceHash = ''; },
]) { const x = fixture(); change(x); assert.equal(run(x).rows[0].inputs.temperatureC, null); assert.equal(run(x).summary.estimated, 0); }
for (const temp of [0, -5, 309, 550]) {
  const x = fixture(); x.context.lineList.normalizedRows[0].t2 = temp; x.context.lineList.normalizedRows[0]._sourceProvenance[operating] = temp;
  assert.equal(run(x).rows[0].inputs.temperatureC, temp); assert.equal(run(x).summary.estimated, 1);
}
const remapped = fixture(); remapped.context.lineList.fieldMap = { t1: operating, t2: design };
remapped.context.lineList.normalizedRows[0].t1 = 309; remapped.context.lineList.normalizedRows[0].t2 = 325;
assert.equal(run(remapped).rows[0].inputs.temperatureC, 309);
const explicit = fixture(); explicit.context.dataset.entities[0].properties.sourceAttributes = { OP_TEMP_C: '0' }; delete explicit.context.lineList;
assert.equal(run(explicit).rows[0].inputs.temperatureC, 0);
explicit.context.dataset.entities[0].properties.attributes = { OP_TEMP_C: 309 };
assert.equal(run(explicit).summary.estimated, 0);
for (const value of [null, 0, -1, Infinity, '14.2748']) {
  const x = fixture(); x.context.commonState.commonInput.enrichedModel.components[0].engineeringProperties.wallThicknessMm.value = value;
  assert.equal(run(x).summary.estimated, 0);
}
const html = renderEmpiricalScreeningPreview(f.distribution, f.context);
assert.match(html, /1 of 1 OPE references estimated/); assert.match(html, /CURRENT_MAPPED_LINE_LIST_NOT_GRAVITY_SEAL/);
assert.match(html, /row 319/); assert.match(html, /not assigned restraints/);
// Real engine, doubled DOM controls only: restore, local edit and reference change.
const fields = ['outsideDiameterMm', 'wallThicknessMm', 'temperatureC'].map(key => ({ value: '', dataset: { screenInput: key } }));
const selected = { value: 'site' }, output = { textContent: '' }, provenance = { textContent: '' }, handlers = {}, button = {};
const root = { querySelector: key => ({ '[data-screen-reference]': selected, '[data-screen-result]': output,
  '[data-screen-provenance]': provenance, '[data-screen-restore]': { addEventListener: (key, fn) => { button[key] = fn; } } }[key]),
  querySelectorAll: key => key === '[data-screen-input]' ? fields : [], addEventListener: (key, fn) => { handlers[key] = fn; } };
bindEmpiricalScreeningPreview({ querySelector: () => root }, f.distribution, f.context);
assert.equal(fields[2].value, 309); assert.match(provenance.textContent, /row 319/); assert.match(output.textContent, /T 309/);
fields[2].value = '100'; handlers.input(); assert.match(provenance.textContent, /LOCAL WHAT-IF/);
button.click(); assert.equal(fields[2].value, 309); assert.match(provenance.textContent, /row 319/);
selected.value = ''; handlers.change({ target: selected }); assert.equal(fields[2].value, ''); assert.doesNotMatch(output.textContent, /Fh guide estimate/);
selected.value = 'site'; handlers.change({ target: selected }); assert.equal(fields[2].value, 309);
assert.equal(JSON.stringify(f), before);
console.log('PASS automatic screening binding: exact pipe/line, current receipt, ambiguity/staleness rejection, operating-vs-design mapping, source-cell provenance, zero/negative/clamping, actual engine parity, local edit/restore, immutability.');
