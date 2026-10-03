import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeWorkspaceDataset } from '../src/workspace/dataset-adapter.js';
import { NonFeaEnrichmentStore } from '../src/workspace/enrichment/non-fea-enrichment-store.js';
import { createNonFeaEnrichmentSidecar, resolveNonFeaEnrichment, createNonFeaEnrichedProjection } from '../src/core/non-fea-enrichment/index.js';
import { buildLoadCalcPreview } from '../src/workspace/load-calc-preview-model.js';
import { buildPipeSectionGroups, needsPipeSectionReview } from '../src/workspace/load-calc-workbench/pipe-section-review.js';
import { approvedPipeWeightGroups, applyApprovedPipeWeightInputs } from '../src/workspace/load-calc-workbench/approved-pipe-weight-inputs.js';
import { filterReviewRows, reviewSummary } from '../src/workspace/load-calc-workbench/workbench-model.js';
import { rowsMarkup, pipeSectionGroupsMarkup } from '../src/workspace/load-calc-workbench/workbench-view.js';
import { createWorkbenchState } from '../src/workspace/load-calc-workbench/workbench-controller.js';
import { projectEngineeringLoadSources } from '../src/core/model-loads/load-source-projection.js';
import { buildPipingPortTopologyGraph } from '../src/core/piping-topology/index.js';
import { createEvidenceValue } from '../src/workspace/project-data/project-data-contract.js';

const read = file => JSON.parse(readFileSync(file, 'utf8'));
const sourceBytes = readFileSync('public/fixtures/Sjson.json');
const dataset = normalizeWorkspaceDataset(JSON.parse(sourceBytes), 'Sjson.json', {
  sourceBytes, sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
});
const acceptedFixture = read('relay/WORK/load-calc-run-readiness-v32-accepted-inputs.json');
const proposals = acceptedFixture.records.filter(record => record.evidence?.matchMode === 'APPROXIMATE_CLASS_MATCH');
assert.equal(proposals.length, 105);
const masters = { pipingClass: { sourceHash: proposals[0].evidence.pipingClassSourceHash },
  lineList: { sourceHash: proposals[0].evidence.lineListSourceHash } };
const original = JSON.stringify({ dataset, proposals, masters });
const store = new NonFeaEnrichmentStore(); store.loadSource(dataset.sharedModel.semanticHash);
const base = acceptedFixture.records.filter(record => record.fieldId !== 'COMPONENT_WEIGHT' && record.evidence?.matchMode !== 'APPROXIMATE_CLASS_MATCH');
store.importAcceptedSidecar(createNonFeaEnrichmentSidecar({ sourceSemanticHash: dataset.sharedModel.semanticHash, records: base }));
proposals.forEach(record => store.stageProposal({ proposalId: record.recordId, record, rationale: 'Reconstructed prior approved weight-only proposals for regression.' }));
const equipment = acceptedFixture.records.find(record => record.fieldId === 'COMPONENT_WEIGHT');
store.stageProposal({ proposalId: 'unrelated-equipment', record: equipment, rationale: 'Unrelated equipment review must stay pending.' });
const groups = approvedPipeWeightGroups(dataset, store.getSnapshot(), masters);
assert.equal(groups.length, 5); assert.equal(groups.reduce((sum, group) => sum + group.targetCount, 0), 35);
for (const bad of [{ ...store.getSnapshot(), stale: true }, { ...store.getSnapshot(), currentSourceSemanticHash: 'changed' },
  { ...store.getSnapshot(), boundSourceSemanticHash: 'changed' }]) assert.equal(approvedPipeWeightGroups(dataset, bad, masters).length, 0);
assert.equal(approvedPipeWeightGroups({ ...dataset, sharedModel: { ...dataset.sharedModel, semanticHash: 'other-source' } }, store.getSnapshot(), masters).length, 0);
assert.equal(approvedPipeWeightGroups(dataset, store.getSnapshot(), { ...masters, pipingClass: { sourceHash: 'changed' } }).length, 0);
for (const patch of [{ value: 1 }, { unit: 'in' }, { selectorKind: 'LINE' }, { fieldId: 'MATERIAL_CODE' },
  { revision: 'changed' }, { sourceId: 'foreign-master' },
  { selectorKey: equipment.selectorKey }, { evidence: { ...proposals[0].evidence, sourceSemanticHash: 'stale' } }]) {
  const snapshot = store.getSnapshot(); const bad = snapshot.proposals.map(proposal => proposal.record.recordId === proposals[0].recordId
    ? { ...proposal, record: { ...proposal.record, ...patch } } : proposal);
  assert(approvedPipeWeightGroups(dataset, { ...snapshot, proposals: bad }, masters).length < 5, 'Changed/foreign fields cannot reuse prior approval');
}
const project = () => {
  const sidecar = createNonFeaEnrichmentSidecar({ sourceSemanticHash: dataset.sharedModel.semanticHash, records: store.getSnapshot().acceptedRecords });
  const enriched = createNonFeaEnrichedProjection({ sourceModel: dataset.sharedModel,
    resolutionLedger: resolveNonFeaEnrichment({ sourceModel: dataset.sharedModel, sidecar }) }).enrichedModel;
  const projected = projectEngineeringLoadSources(enriched, buildPipingPortTopologyGraph(enriched), {
    lengthUnitFallback: createEvidenceValue('mm', { source: 'Existing approved source unit used by fixture checks' }, true),
  });
  return buildLoadCalcPreview({ components: projected.components, entities: dataset.entities, proposals: store.getSnapshot().proposals });
};
const beforeRows = project(), state = { ...createWorkbenchState(), category: 'sections' };
const pipeRows = filterReviewRows(beforeRows, state), sectionGroups = buildPipeSectionGroups(beforeRows);
assert(pipeRows.every(row => row.type === 'PIPE'));
assert.equal(pipeRows.length, beforeRows.filter(needsPipeSectionReview).length);
assert.equal(reviewSummary({ rows: beforeRows, sourceLengthUnit: 'mm' }, 'EMPTY').groups.find(group => group.id === 'sections').count, pipeRows.length);
assert.equal(sectionGroups.reduce((sum, group) => sum + group.pipes.length, 0), pipeRows.length);
assert.match(pipeSectionGroupsMarkup(pipeRows, state, beforeRows), /branch \+ bore groups/);
const fitting = beforeRows.find(row => row.entityId === '=1006649732/51207');
assert.equal(fitting.mass.EMPTY.metalKg, null);
assert.match(rowsMarkup([fitting], state, 1, beforeRows), /Waiting for pipe section/);
assert.match(rowsMarkup([fitting], state, 1, beforeRows), /Review pipe basis/);
assert.doesNotMatch(rowsMarkup([fitting], state, 1, beforeRows), /OD mm <b>Pending/);
const result = applyApprovedPipeWeightInputs({ dataset, store, masters });
assert.deepEqual(result, { pipeCount: 35, groupCount: 5 });
assert.equal(store.getSnapshot().acceptedRecords.length, base.length + 105);
assert.deepEqual(store.getSnapshot().proposals.map(proposal => proposal.proposalId), ['unrelated-equipment']);
assert.equal(approvedPipeWeightGroups(dataset, store.getSnapshot(), masters).length, 0, 'No repeated acceptance');
assert.throws(() => applyApprovedPipeWeightInputs({ dataset, store, masters }), /No current/);
const afterRows = project(), actual = afterRows.find(row => row.entityId === fitting.entityId);
const independentlyCalculated = Math.PI / 4 * (0.1683 ** 2 - (0.1683 - 2 * 0.0142748) ** 2) * 7850 * 1.5 * 0.1683;
assert(Math.abs(actual.mass.EMPTY.metalKg - independentlyCalculated) < 1e-10, 'Unchanged fitting formula uses newly applied pipe inputs');
assert.equal(actual.component.geometry.applicationPoint, fitting.component.geometry.applicationPoint, 'No CoG fabricated');
assert(actual.derived.derivation.sourceComponentKey);
assert.equal(actual.manualReviewRequired, false);
assert.equal(JSON.stringify({ dataset, proposals, masters }), original);
console.log(JSON.stringify({ status: 'PASS', initialPipeIssues: pipeRows.length, branchBoreGroups: sectionGroups.length,
  dependentFittings: sectionGroups.reduce((sum, group) => sum + group.fittings.length, 0), appliedPipes: result.pipeCount,
  remainingPipeIssues: afterRows.filter(needsPipeSectionReview).length, actualElbowKg: actual.mass.EMPTY.metalKg,
  unrelatedEquipmentRetained: true, numericalFormulaAndLocationUnchanged: true }));
