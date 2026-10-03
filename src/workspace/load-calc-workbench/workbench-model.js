import { normalizeWorkspaceDataset } from '../dataset-adapter.js';
import { projectEngineeringLoadSources } from '../../core/model-loads/load-source-projection.js';
import { buildPipingPortTopologyGraph } from '../../core/piping-topology/index.js';
import { buildLoadCalcPreview, effectivePreviewFields, previewWeightStatus } from '../load-calc-preview-model.js';
import { isManualWeightReviewType } from '../load-calc-weight-review-scope.js';
import { needsPipeSectionReview, sectionBore } from './pipe-section-review.js';

export const CASES = Object.freeze(['EMPTY', 'OPE', 'HYD']);
export const STAGES = Object.freeze(['Import & setup', 'Review inputs', 'Calculate', 'Results & export']);
export const CATEGORIES = Object.freeze([
  ['all', 'All components'], ['sections', 'Sections & materials'],
  ['weights', 'Weights & contents'], ['supports', 'Supports & topology'], ['other', 'Other inputs'],
]);

/** Source-only observational projection. Deliberately no approved fallback or app store. */
export function createSourceReview(raw, sourceName = 'Sjson.json') {
  const dataset = normalizeWorkspaceDataset(raw, sourceName);
  const projection = projectEngineeringLoadSources(dataset.sharedModel, buildPipingPortTopologyGraph(dataset.sharedModel));
  const rows = buildLoadCalcPreview({ components: projection.components, entities: dataset.entities });
  return { dataset, rows, diagnostics: projection.diagnostics,
    supports: dataset.entities.filter((entity) => entity.selectionType === 'support'),
    branches: [...new Set(rows.map((row) => row.branchId).filter(Boolean))].sort(),
    sourceLengthUnit: dataset.sharedModel.units.length };
}

export function requireCase(caseId) {
  if (!CASES.includes(caseId)) throw new TypeError('Unknown review case.');
  return caseId;
}

export function rowProblems(row, caseId) {
  requireCase(caseId);
  return [...new Set([...row.notes, ...row.missing, ...(row.cases[caseId].blockers || [])])];
}

export function sectionMissing(row) {
  if (previewWeightStatus(row, 'EMPTY').sectionNotRequired) return [];
  return effectivePreviewFields(row).slice(0, 3).filter((field) => field.value === null);
}

export function reviewSummary(review, caseId, deferred = new Map()) {
  requireCase(caseId);
  const affected = review.rows.filter((row) => row.needsReview || !row.cases[caseId].ok);
  const coverage = review.rows.filter((row) => row.cases[caseId].ok).length;
  const sections = review.rows.filter(needsPipeSectionReview).length;
  const manualPending = review.rows.filter(row => (row.manualReviewRequired ?? isManualWeightReviewType(row.type, row)) && !previewWeightStatus(row, caseId).available).length;
  const groups = review.issueGroups || [
    ...(review.sourceLengthUnit === 'unknown' ? [{ id: 'other', title: 'Confirm source units', count: review.rows.length,
      detail: 'Global length unit is not supplied. No project fallback is applied in this source-only preview.' }] : []),
    ...(sections ? [{ id: 'sections', title: 'Review sections & materials', count: sections,
      detail: 'Review each branch + bore pipe basis once. Dependent fittings reuse it automatically.' }] : []),
    ...(manualPending ? [{ id: 'weights', title: 'Review equipment weights', count: manualPending,
      detail: 'Only the equipment families and instrument bore threshold selected in Weight review settings.' }] : []),
  ];
  return { affected: affected.length, coverage, total: review.rows.length, groups,
    deferred: affected.filter((row) => deferred.has(row.entityId)).length };
}

export function filterReviewRows(rows, { query = '', branch = '', category = 'all', caseId = 'EMPTY', unresolvedOnly = false, sectionBore: bore = '' } = {}) {
  requireCase(caseId);
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => (!branch || row.branchId === branch)
    && (category !== 'sections' || bore === '' || sectionBore(row) === Number(bore))
    && `${row.entityId} ${row.branchId} ${row.type} ${row.description} ${row.component.identity?.lineId || ''}`.toLowerCase().includes(needle)
    && (!unresolvedOnly || row.needsReview || !row.cases[caseId].ok)
    && (category === 'all' || (category === 'sections' && needsPipeSectionReview(row))
      || (category === 'weights' && (row.manualReviewRequired ?? isManualWeightReviewType(row.type, row)))));
}

/** UI deferral only: never changes rows, coverage, inputs or execution eligibility. */
export class ReviewDeferrals {
  skipped = new Map();
  binding = '';
  bind(binding) {
    if (!binding) throw new Error('Review binding is required.');
    if (binding !== this.binding) this.skipped.clear();
    this.binding = binding;
  }
  defer(row, caseId, reason) {
    requireCase(caseId);
    if (!row || (!row.needsReview && row.cases[caseId].ok)) throw new Error('Only an unresolved component can be deferred.');
    if (!String(reason || '').trim()) throw new Error('Enter a reason before deferring this component.');
    this.skipped.set(row.entityId, String(reason).trim());
  }
  restore(entityId) { this.skipped.delete(entityId); }
}

const FRIENDLY = Object.freeze({
  UNIT_BLOCKED: 'Confirm the source length unit', MISSING_GEOMETRY: 'Review missing geometry',
  PIPE_SECTION_REQUIRED: 'Review the pipe section', COMPONENT_WEIGHT_REQUIRED: 'Provide qualified component weight',
  APPLICATION_POINT_REQUIRED: 'Confirm mass application point', MATERIAL_DENSITY_REQUIRED: 'Confirm metal density',
  MISSING_COMPONENT_COG: 'Load location missing · CoG/application point required',
});
export function problemLabel(code) { return FRIENDLY[code] || String(code).replaceAll('_', ' ').toLowerCase(); }
