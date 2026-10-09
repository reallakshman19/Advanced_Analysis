import { buildApproximateMatchPreview } from '../enrichment/approximate-match-preview.js';
import { acceptNonFeaEnrichmentProposal, createNonFeaEnrichmentSidecar } from '../../core/non-fea-enrichment/index.js';
import { PIPE_WEIGHT_FIELDS } from './pipe-section-review.js';
import { evidenceNumber } from '../../core/model-loads/units.js';

// Owner's already recorded Sjson decision, not a new application-wide default.
const APPROVED_SOURCE = 'fnv1a64:46ec305d089d59eb';
const APPROVED = Object.freeze({
  150: { PIPE_OUTER_DIAMETER: 168.3, PIPE_WALL_THICKNESS: 14.2748, MATERIAL_DENSITY: 7850 },
  200: { PIPE_OUTER_DIAMETER: 219.1, PIPE_WALL_THICKNESS: 18.2626, MATERIAL_DENSITY: 7850 },
  250: { PIPE_OUTER_DIAMETER: 273, PIPE_WALL_THICKNESS: 21.4376, MATERIAL_DENSITY: 7850 },
});

/** Narrow prior approval: exact source, PIPE targets and complete weight-only groups. */
export function approvedPipeWeightGroups(dataset, snapshot, masters) {
  if (dataset?.sharedModel?.semanticHash !== APPROVED_SOURCE || snapshot.stale
    || snapshot.currentSourceSemanticHash !== APPROVED_SOURCE
    || (snapshot.boundSourceSemanticHash && snapshot.boundSourceSemanticHash !== APPROVED_SOURCE)) return [];
  const pipes = new Map(dataset.sharedModel.components.filter(component => component.type === 'PIPE')
    .map(component => [component.componentKey, component]));
  return buildApproximateMatchPreview(snapshot.proposals).filter(group => {
    const values = APPROVED[group.boreMm];
    if (!values || group.fields.length !== 3 || !group.fields.every(field => PIPE_WEIGHT_FIELDS.includes(field))) return false;
    if (!group.masterHash || group.masterHash !== masters?.pipingClass?.sourceHash
      || (group.lineListHash && group.lineListHash !== masters?.lineList?.sourceHash)) return false;
    const targets = new Map();
    for (const { record } of group.proposals) {
      const pipe = pipes.get(record.selectorKey);
      const bores = [pipe?.compatibilityEvidence?.sourceArriveBoreMm, pipe?.compatibilityEvidence?.sourceLeaveBoreMm,
        pipe?.engineeringProperties?.nominalBoreMm].map(evidenceNumber).filter(value => value !== null);
      if (record.selectorKind !== 'ENTITY' || record.authority !== 'EXACT_APPROVED_MASTER'
        || !pipe || !bores.length || !bores.every(bore => bore === Number(group.boreMm))
        || record.evidence.sourceSemanticHash !== APPROVED_SOURCE
        || record.sourceId !== 'Piping_class_master.json' || record.revision !== group.masterHash
        || !Number.isFinite(record.value) || Math.abs(record.value - values[record.fieldId]) > 1e-8
        || record.unit !== (record.fieldId === 'MATERIAL_DENSITY' ? 'kg/m3' : 'mm')) return false;
      const fields = targets.get(record.selectorKey) || new Set();
      if (fields.has(record.fieldId)) return false;
      fields.add(record.fieldId); targets.set(record.selectorKey, fields);
    }
    return [...targets.values()].every(fields => fields.size === 3);
  });
}

/** Explicit button only. Existing acceptance validates each complete proposal group. */
export function applyApprovedPipeWeightInputs({ dataset, store, masters }) {
  const snapshot = store.getSnapshot(), groups = approvedPipeWeightGroups(dataset, snapshot, masters);
  if (!groups.length) throw new Error('No current pipe proposals match the previously approved weight-only inputs.');
  const decision = { approximateMatchConfirmed: true,
    acceptanceBasis: 'Owner-approved Sjson DN150/200/250 Sch120 OD/wall/density for weight only. No material grade, class identity or fitting catalogue weight approved.' };
  const records = new Map(snapshot.acceptedRecords.map(record => [record.recordId, record]));
  for (const group of groups) for (const proposal of group.proposals) {
    records.set(proposal.record.recordId, acceptNonFeaEnrichmentProposal(proposal, decision));
  }
  // Prevalidate the entire chosen set before the first group mutates its owner.
  createNonFeaEnrichmentSidecar({ sourceSemanticHash: APPROVED_SOURCE, records: [...records.values()] });
  groups.forEach(group => store.acceptReviewedApproximateMatch(group.proposals.map(proposal => proposal.proposalId), decision));
  return { pipeCount: groups.reduce((sum, group) => sum + group.targetCount, 0), groupCount: groups.length };
}
