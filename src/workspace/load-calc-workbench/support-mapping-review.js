import { semanticHash } from '../../core/shared-piping-model/canonical-json.js';
import { createNonFeaEnrichmentProposal, createNonFeaEnrichmentSidecar } from '../../core/non-fea-enrichment/index.js';
import { projectDataValue } from '../project-data/project-data-contract.js';
import { resolveSupportCapability } from '../engineering-loads/authorized-empirical-support-capability-binding.js';
import { unallocatedGravityPaths } from './result-evidence.js';

export const SUPPORT_MAPPING_CHOICES = Object.freeze([
  Object.freeze({ value: 'SKIP', label: 'Skip' }),
  Object.freeze({ value: 'REST', label: 'Rest' }),
  Object.freeze({ value: 'GUIDE', label: 'Guide' }),
  Object.freeze({ value: 'LINESTOP', label: 'Line stop' }),
]);

export function defaultSupportMappingChoices(review) {
  return review.rows.map(row => ({ entityId: row.entityId, type: 'SKIP' }));
}

/** Draft-only bulk edit: immutable, exact IDs, never touches protected rows or the store. */
export function bulkSupportMappingChoices(review, choices, entityIds, type) {
  if (!SUPPORT_MAPPING_CHOICES.some(c => c.value === type)) throw new Error('Choose a support type from the list.');
  const ids = new Set(entityIds);
  for (const id of ids) {
    if (!review.rows.some(r => r.entityId === id && r.fallbackEligible)) throw new Error('Only editable support rows can be changed.');
  }
  return choices.map(c => ids.has(c.entityId) ? { ...c, type } : { ...c });
}

/** Source diagnosis and reviewer proposals only. No bearing is inferred from geometry. */
export function buildSupportMappingReview({ dataset, supportSiteModel, distribution, profile, enrichment }) {
  const capabilities = projectDataValue(profile, 'topology.supportTypeCapabilities') || {};
  const supports = dataset?.sharedModel?.supports || [];
  const records = enrichment?.stale ? [] : enrichment?.acceptedRecords || [];
  const sites = supportSiteModel?.sites || [];
  const rows = (supportSiteModel?.members || []).flatMap(member => {
    const site = sites.find(s => s.memberEntityIds.includes(member.entityId));
    const support = supports.find(s => s.sourceEntityId === member.sourceEntityId || s.supportKey === member.entityId);
    const record = records.find(r => r.selectorKind === 'ENTITY' && r.selectorKey === support?.supportKey
      && r.fieldId === 'RESTRAINT_TYPE');
    const inferred = support?.supportEvidence?.supportTypes?.map(e => e.value).filter(Boolean) || [];
    const inheritedKinds = site?.assemblies.flatMap(a => a.members.map(m => m.sourceType).filter(Boolean)) || [];
    const kind = record?.value || member.sourceType || inferred[0] || '';
    let resolution;
    try { resolution = resolveSupportCapability(capabilities, kind); }
    catch { resolution = { selector: null }; }
    if (member.sourceType && resolution.selector) return [];
    const alreadyResolved = Boolean(record || inferred.length || inheritedKinds.length);
    return [{ ...member, targetId: support?.supportKey || null, siteId: site?.siteId,
      effectiveKind: kind, inheritedKinds: [...new Set(inheritedKinds)],
      issue: !member.sourceType ? 'Missing source type' : 'Unmapped support kind',
      fallbackEligible: !alreadyResolved && Boolean(support) && !enrichment?.stale,
      status: record ? 'Reviewed mapping' : alreadyResolved ? 'Existing type/site evidence retained' : 'Needs mapping confirmation' }];
  });
  const paths = unallocatedGravityPaths(distribution);
  const branches = [...new Set(paths.map(p => (dataset?.entities || []).find(e => p.entityIds.includes(e.entityId))?.branchId).filter(Boolean))]
    .map(branchId => ({ branchId, members: (supportSiteModel?.members || []).filter(m => m.branchId === branchId),
      paths: paths.filter(p => p.entityIds.some(id => dataset.entities.some(e => e.entityId === id && e.branchId === branchId))) }));
  return { rows, branches, sourceSemanticHash: dataset?.sharedModel?.semanticHash,
    binding: semanticHash({ source: dataset?.sharedModel?.semanticHash || null,
      dataset: dataset?.sourceSha256 || null, profile, enrichmentVersion: enrichment?.version ?? null,
      sites: supportSiteModel || null, distributionHash: distribution ? semanticHash(distribution) : null }) };
}

export function supportMappingProposals(review, selections, confirmation) {
  // String IDs retain the previous REST-only API; the UI always supplies explicit choices.
  const choices = selections.map(s => typeof s === 'string' ? { entityId: s, type: 'REST' } : s);
  if (new Set(choices.map(s => s?.entityId)).size !== choices.length) throw new Error('Select unique existing support records.');
  const mapped = choices.filter(selection => {
    const row = review.rows.find(r => r.entityId === selection?.entityId);
    if (!row || !SUPPORT_MAPPING_CHOICES.some(c => c.value === selection.type)) throw new Error('Support mapping choice is not available.');
    if (selection.type === 'SKIP') return false;
    if (!row.fallbackEligible || !row.targetId) throw new Error(`Support type change is not available for ${selection.entityId}.`);
    return true;
  });
  if (!mapped.length) return [];
  if (confirmation?.confirmed !== true || !confirmation.basis?.trim()) throw new Error('Explicit support-type confirmation and a review reason are required.');
  return mapped.map(({ entityId, type }) => {
    const row = review.rows.find(r => r.entityId === entityId);
    const recordId = `support-mapping-${type.toLowerCase()}:${row.targetId}`;
    return createNonFeaEnrichmentProposal({ proposalId: recordId, rationale: confirmation.basis,
      record: { recordId, selectorKind: 'ENTITY', selectorKey: row.targetId,
        fieldId: 'RESTRAINT_TYPE', value: type, unit: 'policy', authority: 'ACCEPTED_OVERRIDE',
        sourceId: 'support-mapping-review', revision: review.sourceSemanticHash,
        evidence: { sourceSemanticHash: review.sourceSemanticHash, supportMappingFallback: true,
          reviewerConfirmed: true, assumptionBasis: confirmation.basis, sourceType: row.sourceType,
          sourceEntityId: row.sourceEntityId, jsonPointer: row.jsonPointer, branchId: row.branchId,
          supportSiteId: row.siteId, selectedSupportType: type, scope: 'SCALAR_GRAVITY_KIND_ONLY', solverRestraintAuthorityAsserted: false } } });
  });
}

/** Use existing acceptance/staleness owners, preserving unrelated records and proposals. */
export function applySupportMappingReview(store, review, liveReview, entityIds, confirmation) {
  if (review.binding !== liveReview.binding) throw new Error('Inputs changed. Close and reopen support mapping; nothing was applied.');
  const snapshot = store.getSnapshot();
  if (snapshot.stale || snapshot.currentSourceSemanticHash !== review.sourceSemanticHash
      || (snapshot.boundSourceSemanticHash && snapshot.boundSourceSemanticHash !== review.sourceSemanticHash)) throw new Error('Support mapping source is stale.');
  const proposals = supportMappingProposals(review, entityIds, confirmation);
  if (!proposals.length) return 0; // Skip never becomes restraint authority or excludes demand.
  if (proposals.some(p => snapshot.acceptedRecords.some(r => r.selectorKind === 'ENTITY'
    && r.selectorKey === p.record.selectorKey && r.fieldId === 'RESTRAINT_TYPE'))) throw new Error('An existing reviewed type must be inspected, not overwritten.');
  createNonFeaEnrichmentSidecar({ sourceSemanticHash: review.sourceSemanticHash,
    records: [...snapshot.acceptedRecords, ...proposals.map(p => p.record)] });
  for (const proposal of proposals) {
    store.stageProposal(proposal);
    store.acceptProposal(proposal.proposalId, { acceptanceBasis: confirmation.basis });
  }
  return proposals.length;
}

/** Oblique source-coordinate drawing only; no snapped or invented connections. */
export function supportMappingSvg(dataset, branchId, highlightedIds = []) {
  const entities = (dataset?.entities || []).filter(e => e.branchId === branchId);
  const point = p => p && [p.x, p.y, p.z].every(Number.isFinite) ? [p.x + .35 * p.y, -p.z + .2 * p.y] : null;
  const shapes = entities.map(e => { const g = e.properties?.geometry || {};
    return { id: e.entityId, support: e.category === 'support', start: point(g.start || g.center), end: point(g.end || g.center || g.start) }; });
  const points = shapes.flatMap(s => [s.start, s.end]).filter(Boolean);
  if (!points.length) return '<p>No source coordinates available for this branch.</p>';
  const minX = Math.min(...points.map(p => p[0])), minY = Math.min(...points.map(p => p[1]));
  const width = Math.max(...points.map(p => p[0])) - minX, height = Math.max(...points.map(p => p[1])) - minY;
  const scale = Math.min(680 / Math.max(width, 1), 300 / Math.max(height, 1));
  const xy = p => [(p[0] - minX) * scale + 35, (p[1] - minY) * scale + 30];
  return `<svg viewBox="0 0 750 360" role="img" aria-label="Source branch locator" data-support-mapping-svg>
    <title>${escapeHtml(branchId)}</title><rect width="750" height="360" fill="#091322"/>
    ${shapes.map(s => { if (!s.start) return ''; const a = xy(s.start), b = xy(s.end || s.start);
      const color = highlightedIds.includes(s.id) ? '#fbbf24' : s.support ? '#38bdf8' : '#64748b';
      return `<g><title>${escapeHtml(s.id)}</title>${s.support ? `<circle cx="${a[0]}" cy="${a[1]}" r="7" fill="${color}"/>`
        : `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="4"/><circle cx="${a[0]}" cy="${a[1]}" r="3" fill="${color}"/>`}</g>`;
    }).join('')}<text x="20" y="348" fill="#94a3b8" font-size="12">Source oblique view · blue supports · yellow selected · geometry only</text></svg>`;
}
export function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
