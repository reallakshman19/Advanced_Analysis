import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { normalizeWorkspaceDataset } from '../src/workspace/dataset-adapter.js';
import { buildSupportSiteModel } from '../src/workspace/support-sites/support-site-model.js';
import { buildRoutePartitionModel } from '../src/workspace/routes/route-partition-model.js';
import { resolveNonFeaEnrichment, createNonFeaEnrichmentSidecar } from '../src/core/non-fea-enrichment/index.js';
import { createNonFeaEffectiveCommonInputProjection } from '../src/workspace/project-data/non-fea-effective-common-input-projection.js';
import { NonFeaEnrichmentStore } from '../src/workspace/enrichment/non-fea-enrichment-store.js';
import { buildSupportMappingReview, supportMappingProposals, applySupportMappingReview, supportMappingSvg, defaultSupportMappingChoices, bulkSupportMappingChoices, SUPPORT_MAPPING_CHOICES } from '../src/workspace/load-calc-workbench/support-mapping-review.js';
import { projectConfirmedRestMappings } from '../src/workspace/engineering-loads/current-common-input-support-mapping.js';
import { calculateSupportLoadDistributionFromQualifiedCaseMasses } from '../src/workspace/engineering-loads/support-load-distribution-v3.js';
import { bindAuthorizedEmpiricalSupportCapabilities } from '../src/workspace/engineering-loads/authorized-empirical-support-capability-binding.js';

const load = path => JSON.parse(readFileSync(path, 'utf8'));
const sourceBytes = readFileSync('public/fixtures/Sjson.json');
const dataset = normalizeWorkspaceDataset(JSON.parse(sourceBytes), 'Sjson.json', {
  sourceBytes, sourceSha256: createHash('sha256').update(sourceBytes).digest('hex') });
const profile = load('relay/WORK/load-calc-run-readiness-v32-project-data.json');
const supportSiteModel = buildSupportSiteModel(dataset, profile);
const distribution = load('relay/WORK/load-calc-new-ui-v32-gravity-export.json').receipt.distribution;
const store = new NonFeaEnrichmentStore();
store.loadSource(dataset.sharedModel.semanticHash);
store.importAcceptedSidecar(load('relay/WORK/load-calc-explicit-zero-weight-v32-sidecar.json'));
const context = () => ({ dataset, profile, supportSiteModel, distribution, enrichment: store.getSnapshot() });
const review = buildSupportMappingReview(context());
assert.deepEqual(SUPPORT_MAPPING_CHOICES.map(c => c.value), ['SKIP', 'REST', 'GUIDE', 'LINESTOP']);
const skipChoices = defaultSupportMappingChoices(review);
assert.equal(skipChoices.length, 31);
assert(skipChoices.every(c => c.type === 'SKIP'));
const editableIds = review.rows.filter(r => r.fallbackEligible).map(r => r.entityId);
const protectedId = review.rows.find(r => !r.fallbackEligible).entityId;
for (const type of ['SKIP', 'REST', 'GUIDE', 'LINESTOP']) {
  const bulk = bulkSupportMappingChoices(review, skipChoices, editableIds, type);
  assert.equal(bulk.filter(c => c.type !== 'SKIP').length, type === 'SKIP' ? 0 : 6);
  assert.equal(bulk.find(c => c.entityId === protectedId).type, 'SKIP');
  assert.deepEqual(bulkSupportMappingChoices(review, bulk, editableIds, 'SKIP'), skipChoices);
}
const subset = bulkSupportMappingChoices(review, skipChoices, editableIds.slice(0, 2), 'GUIDE');
assert.equal(subset.filter(c => c.type === 'GUIDE').length, 2, 'Only selected exact IDs change.');
assert.deepEqual(bulkSupportMappingChoices(review, subset, [], 'REST'), subset);
assert.throws(() => bulkSupportMappingChoices(review, skipChoices, [protectedId], 'REST'), /editable/);
assert.throws(() => bulkSupportMappingChoices(review, skipChoices, [editableIds[0], 'unknown'], 'REST'), /editable/);
assert.throws(() => bulkSupportMappingChoices(review, skipChoices, editableIds, 'ANCHOR'), /list/);
assert(skipChoices.every(c => c.type === 'SKIP'), 'Draft bulk edits do not mutate defaults.');
const skipSnapshot = store.getSnapshot();
assert.deepEqual(supportMappingProposals(review, skipChoices), []);
assert.equal(applySupportMappingReview(store, review, review, skipChoices), 0);
assert.equal(store.getSnapshot(), skipSnapshot, 'All Skip must not invalidate inputs or change accepted records.');
const id = '=1006649732/51465';
const row = review.rows.find(r => r.entityId === id);
assert.equal(row.fallbackEligible, true);
assert.equal(row.sourceType, '');
assert.equal(row.jsonPointer, '/objects/8/children/1');
assert.equal(review.branches.length, 3);
assert.deepEqual(review.branches.filter(b => !b.members.length).map(b => b.branchId.split('/').at(-1)), ['B2', 'B5']);
assert(review.branches.find(b => b.branchId.endsWith('/B5')).paths.every(p => p.forceN === 0));
assert(review.rows.some(r => !r.fallbackEligible && r.inheritedKinds.length));
const before = JSON.stringify({ dataset, profile, supportSiteModel });
const confirmation = { confirmed: true, basis: 'TEST ONLY — reviewer-approved REST assumption for this exact source support.' };
assert.throws(() => supportMappingProposals(review, [id], { ...confirmation, confirmed: false }), /confirmation/);
assert.throws(() => supportMappingProposals(review, [id], { confirmed: true, basis: '' }), /confirmation/);
assert.throws(() => supportMappingProposals(review, ['missing-support'], confirmation), /not available/);
assert.throws(() => supportMappingProposals(review, [id, id], confirmation), /unique/);
assert.throws(() => supportMappingProposals(review, [review.rows.find(r => !r.fallbackEligible).entityId], confirmation), /not available/);
assert.throws(() => applySupportMappingReview(store, review, { ...review, binding: 'changed' }, [id], confirmation), /Inputs changed/);
assert.equal(store.getSnapshot().acceptedRecords.length, 203);
assert.equal(applySupportMappingReview(store, review, buildSupportMappingReview(context()), [id], confirmation), 1);
assert.equal(store.getSnapshot().acceptedRecords.length, 204);
const refreshed = buildSupportMappingReview(context());
assert.equal(refreshed.rows.find(r => r.entityId === id).status, 'Reviewed mapping');
assert.equal(refreshed.rows.find(r => r.entityId === id).fallbackEligible, false);
const sidecar = createNonFeaEnrichmentSidecar({ sourceSemanticHash: dataset.sharedModel.semanticHash, records: store.getSnapshot().acceptedRecords });
const candidateResolutionLedger = resolveNonFeaEnrichment({ sourceModel: dataset.sharedModel, sidecar });
const effective = createNonFeaEffectiveCommonInputProjection({ sourceModel: dataset.sharedModel, candidateResolutionLedger });
const commonInput = { sourceModelSemanticHash: dataset.sharedModel.semanticHash, semanticHash: 'fnv1a64:test-only',
  resolutionLedgerSemanticHash: effective.resolutionLedger.semanticHash, resolutionLedger: effective.resolutionLedger,
  enrichedModel: effective.enrichedProjection.enrichedModel };
const mapped = projectConfirmedRestMappings({ commonInput, dataset, supportSiteModel });
assert(mapped.receipt, 'Selected confirmed mapping must be consumed, not ignored.');
assert.equal(mapped.receipt.mappings.length, 1);
assert.equal(mapped.supportSiteModel.members.find(m => m.entityId === id).sourceType, 'REST');
assert.equal(supportSiteModel.members.find(m => m.entityId === id).sourceType, '');
assert.equal(mapped.receipt.sourceSupportSiteModelSemanticHash, semanticHash(supportSiteModel));
assert.equal(mapped.receipt.projectedSupportSiteModelSemanticHash, semanticHash(mapped.supportSiteModel));
assert.equal(JSON.stringify({ dataset, profile, supportSiteModel }), before);
for (const type of ['REST', 'GUIDE', 'LINESTOP']) {
  const typeStore = new NonFeaEnrichmentStore();
  typeStore.loadSource(dataset.sharedModel.semanticHash);
  typeStore.importAcceptedSidecar(load('relay/WORK/load-calc-explicit-zero-weight-v32-sidecar.json'));
  const typeReview = buildSupportMappingReview({ ...context(), enrichment: typeStore.getSnapshot() });
  const typeChoices = defaultSupportMappingChoices(typeReview).map(c => c.entityId === id ? { ...c, type } : c);
  assert.throws(() => supportMappingProposals(typeReview, typeChoices), /confirmation/);
  assert.equal(applySupportMappingReview(typeStore, typeReview, typeReview, typeChoices, confirmation), 1);
  const typeEffective = createNonFeaEffectiveCommonInputProjection({ sourceModel: dataset.sharedModel,
    candidateResolutionLedger: resolveNonFeaEnrichment({ sourceModel: dataset.sharedModel,
      sidecar: createNonFeaEnrichmentSidecar({ sourceSemanticHash: dataset.sharedModel.semanticHash,
        records: typeStore.getSnapshot().acceptedRecords }) }) });
  const typeMapped = projectConfirmedRestMappings({ dataset, supportSiteModel, commonInput: { ...commonInput,
    resolutionLedger: typeEffective.resolutionLedger, resolutionLedgerSemanticHash: typeEffective.resolutionLedger.semanticHash,
    enrichedModel: typeEffective.enrichedProjection.enrichedModel } });
  assert.equal(typeMapped.receipt.mappings[0].effectiveKind, type);
  assert.equal(typeMapped.supportSiteModel.members.find(m => m.entityId === id).sourceType, type);
  const capability = bindAuthorizedEmpiricalSupportCapabilities({ profile, supportSiteModel: typeMapped.supportSiteModel });
  assert(capability.rows.some(r => r.sourceType === type));
  assert.equal(typeStore.getSnapshot().acceptedRecords.length, 204, 'Skip rows never become accepted type overrides.');
}
assert.throws(() => supportMappingProposals(review, [{ entityId: id, type: 'ANCHOR' }], confirmation), /not available/);
assert.equal(JSON.stringify({ dataset, profile, supportSiteModel }), before);
assert.deepEqual(projectConfirmedRestMappings({ commonInput: { resolutionLedger: { rows: [] } }, dataset, supportSiteModel }), { supportSiteModel, receipt: null });
// Batch acceptance uses original source type evidence for every selected member.
const batchStore = new NonFeaEnrichmentStore();
batchStore.loadSource(dataset.sharedModel.semanticHash);
batchStore.importAcceptedSidecar(load('relay/WORK/load-calc-explicit-zero-weight-v32-sidecar.json'));
const batchContext = { ...context(), enrichment: batchStore.getSnapshot() };
const batchReview = buildSupportMappingReview(batchContext);
const batchIds = batchReview.rows.filter(r => r.fallbackEligible).map(r => r.entityId);
assert.equal(applySupportMappingReview(batchStore, batchReview, batchReview, batchIds, confirmation), 6);
const batchEffective = createNonFeaEffectiveCommonInputProjection({ sourceModel: dataset.sharedModel,
  candidateResolutionLedger: resolveNonFeaEnrichment({ sourceModel: dataset.sharedModel,
    sidecar: createNonFeaEnrichmentSidecar({ sourceSemanticHash: dataset.sharedModel.semanticHash,
      records: batchStore.getSnapshot().acceptedRecords }) }) });
const batchMapped = projectConfirmedRestMappings({ dataset, supportSiteModel, commonInput: { ...commonInput,
  resolutionLedger: batchEffective.resolutionLedger, resolutionLedgerSemanticHash: batchEffective.resolutionLedger.semanticHash,
  enrichedModel: batchEffective.enrichedProjection.enrichedModel } });
assert.equal(batchMapped.receipt.mappings.length, 6);
assert.equal(JSON.stringify({ dataset, profile, supportSiteModel }), before);
for (const mutate of [
  c => { c.resolutionLedgerSemanticHash = 'tampered'; },
  c => { c.sourceModelSemanticHash = 'other'; },
  c => { c.resolutionLedger.rows.find(r => r.selected?.evidence?.supportMappingFallback).selected.evidence.reviewerConfirmed = false; },
  c => { c.resolutionLedger.rows.find(r => r.selected?.evidence?.supportMappingFallback).selected.value = 'ANCHOR'; },
  c => { c.resolutionLedger.rows.find(r => r.selected?.evidence?.supportMappingFallback).selected.value = 'SKIP'; },
  c => { c.enrichedModel.supports.find(s => s.supportKey === id).supportEvidence.supportTypes = []; },
]) { const changed = structuredClone(commonInput); mutate(changed); assert.throws(() => projectConfirmedRestMappings({ commonInput: changed, dataset, supportSiteModel })); }

// Existing scalar mechanics, captured masses, one factor changed: exact confirmed B3 type.
// Not an independent engineering oracle or production approval.
const routePartitionModel = buildRoutePartitionModel(dataset, profile);
const masses = distribution.loadCases.flatMap(c => c.contributionLedger.map(r => ({ entityId: r.entityId, loadCaseId: c.loadCaseId,
  massKg: r.massKg, mode: r.formula.massAuthority.mode, source: r.formula.massAuthority })));
const input = { dataset, profile, supportSiteModel, routePartitionModel, masterData: {} };
const baseline = calculateSupportLoadDistributionFromQualifiedCaseMasses(input, masses);
const changed = calculateSupportLoadDistributionFromQualifiedCaseMasses({ ...input, supportSiteModel: mapped.supportSiteModel }, masses);
for (const c of changed.loadCases) {
  const prior = baseline.loadCases.find(b => b.loadCaseId === c.loadCaseId);
  const b3 = distribution.loadCases.find(b => b.loadCaseId === c.loadCaseId).contributionLedger.filter(r => r.routeId.includes('/B3:1') && r.unallocated.length).reduce((s, r) => s + r.verticalForceN, 0);
  assert(Math.abs(prior.completenessAudit.unallocatedForceN - c.completenessAudit.unallocatedForceN - b3) < 1e-7);
  assert.equal(c.completenessAudit.evaluatedForceN, prior.completenessAudit.evaluatedForceN);
}
const svg = supportMappingSvg(dataset, row.branchId, [id]);
assert.match(svg, /data-support-mapping-svg/);
assert.match(svg, /#fbbf24/);
assert.doesNotMatch(svg, /NaN|Infinity/);
const unsafe = structuredClone(dataset); unsafe.entities.find(e => e.entityId === id).entityId = '<script>alert(1)</script>';
assert.doesNotMatch(supportMappingSvg(unsafe, row.branchId), /<script>/);
for (const file of ['results-view.js', 'workbench-view.js']) assert.match(readFileSync(`src/workspace/load-calc-workbench/${file}`, 'utf8'), /data-load-calc-support-mapping/);
const dialogSource = readFileSync('src/workspace/load-calc-workbench/support-mapping-dialog.js', 'utf8');
assert.match(dialogSource, /SUPPORT_MAPPING_CHOICES\.map/);
assert.match(dialogSource, /Continue with Skip/);
assert.match(dialogSource, /choices\.set\(id, 'SKIP'\)/);
assert.match(dialogSource, /table aria-label="Support types"/);
assert.match(dialogSource, /Select visible editable rows/);
assert.match(dialogSource, /hidden by filter/);
assert.match(dialogSource, /Yes, apply changes/);
assert.match(dialogSource, /Note \(optional\)/);
assert.doesNotMatch(dialogSource, /data-confirm>|I confirm the selected|Review reason/);
console.log(`PASS support mapping: ${review.rows.length} consolidated rows, all-Skip no authority/input mutation, confirmed REST/GUIDE/LINESTOP effective winners, ${review.branches.length} preserved branch exceptions, unchanged source/masses/statics, confirmation/staleness negatives and escaped SVG. Actual live type overrides NOT_APPLIED.`);
