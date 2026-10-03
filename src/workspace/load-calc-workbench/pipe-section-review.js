import { evidenceNumber } from '../../core/model-loads/units.js';
import { isPipeLikeFittingType } from '../../core/model-loads/elbow-derived-mass.js';
import { effectivePreviewFields, previewWeightStatus } from '../load-calc-preview-model.js';

export const PIPE_WEIGHT_FIELDS = Object.freeze(['PIPE_OUTER_DIAMETER', 'PIPE_WALL_THICKNESS', 'MATERIAL_DENSITY']);

/** One predicate for card, tab and grouped section review; no authority writes. */
export function needsPipeSectionReview(row) {
  return row.type === 'PIPE' && (effectivePreviewFields(row).slice(0, 3).some(field => field.value === null)
    || row.proposed.some(proposal => PIPE_WEIGHT_FIELDS.includes(proposal.record.fieldId)));
}

export function sectionBore(row) {
  return row.sourceBoreMm ?? evidenceNumber(row.component.compatibilityEvidence?.sourceArriveBoreMm)
    ?? evidenceNumber(row.component.compatibilityEvidence?.sourceLeaveBoreMm)
    ?? evidenceNumber(row.component.engineeringProperties.nominalBoreMm);
}

export function buildPipeSectionGroups(rows) {
  const groups = new Map();
  for (const row of rows.filter(needsPipeSectionReview)) {
    const bore = sectionBore(row);
    // Unknown identities stay separate; never infer a shared section from absence.
    const key = JSON.stringify([row.branchId || row.entityId, bore ?? row.entityId]);
    if (!groups.has(key)) groups.set(key, { key, branchId: row.branchId, boreMm: bore, pipes: [], fittings: [] });
    groups.get(key).pipes.push(row);
  }
  for (const group of groups.values()) group.fittings = rows.filter(row => isPipeLikeFittingType(row.type)
    && !previewWeightStatus(row, 'EMPTY').available && row.branchId && row.branchId === group.branchId
    && group.boreMm !== null && sectionBore(row) === group.boreMm);
  return [...groups.values()].sort((a, b) => a.branchId.localeCompare(b.branchId) || (a.boreMm ?? 0) - (b.boreMm ?? 0));
}

export function fittingPipeDependency(row, rows) {
  if (!isPipeLikeFittingType(row.type) || previewWeightStatus(row, 'EMPTY').available) return null;
  const group = buildPipeSectionGroups(rows).find(group => group.fittings.some(fitting => fitting.entityId === row.entityId));
  return group || { pipes: [], boreMm: sectionBore(row), branchId: row.branchId };
}
