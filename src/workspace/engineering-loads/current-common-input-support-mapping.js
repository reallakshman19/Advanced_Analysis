import { semanticHash } from '../../core/shared-piping-model/canonical-json.js';
import { clonePlain, freezeDeep } from '../dataset-utils.js';

/** Exact confirmed kind adapter. Positions, site membership and statics are untouched. */
export function projectConfirmedSupportMappings({ commonInput, dataset, supportSiteModel }) {
  const selected = (commonInput.resolutionLedger?.rows || []).map(r => r.selected).filter(r =>
    r?.targetKind === 'SUPPORT' && r.fieldId === 'RESTRAINT_TYPE' && r.evidence?.supportMappingFallback === true);
  if (!selected.length) return { supportSiteModel, receipt: null };
  if (commonInput.resolutionLedger.semanticHash !== commonInput.resolutionLedgerSemanticHash
      || dataset.sharedModel.semanticHash !== commonInput.sourceModelSemanticHash) throw new Error('Support mapping is not bound to sealed source input.');
  const model = clonePlain(supportSiteModel), mappings = [];
  for (const row of selected) {
    if (row.authority !== 'ACCEPTED_OVERRIDE' || !['REST', 'GUIDE', 'LINESTOP'].includes(row.value) || row.evidence.reviewerConfirmed !== true
        || row.evidence.sourceSemanticHash !== commonInput.sourceModelSemanticHash
        || !row.evidence.acceptanceBasis?.trim()) throw new Error('Support type mapping requires confirmed exact source-bound evidence.');
    const supports = dataset.sharedModel.supports.filter(s => s.supportKey === row.targetId);
    if (supports.length !== 1) throw new Error('Support mapping identity is missing or ambiguous.');
    const support = supports[0];
    if ((support.supportEvidence?.supportTypes || []).some(e => e.value)) throw new Error('Fallback cannot replace source support type evidence.');
    const members = model.members.filter(m => m.sourceEntityId === support.sourceEntityId);
    if (members.length !== 1 || members[0].sourceType) throw new Error('Fallback requires one existing untyped support member.');
    const member = members[0];
    const site = supportSiteModel.sites.find(s => s.memberEntityIds.includes(member.entityId));
    if (!site || site.assemblies.some(a => a.members.some(m => m.sourceType))) throw new Error('Fallback cannot replace co-located typed support evidence.');
    const effective = commonInput.enrichedModel.supports.find(s => s.supportKey === row.targetId);
    if (!effective?.supportEvidence?.supportTypes?.some(e => e.value === row.value
      && e.sourceKind === 'ACCEPTED_OVERRIDE' && e.sourcePath.endsWith(`.${row.recordId}`))) throw new Error('Support mapping is not the sealed effective winner.');
    const replace = m => m.entityId === member.entityId ? { ...m, sourceType: row.value, originalSourceType: '', supportMappingRecordId: row.recordId } : m;
    model.members = model.members.map(replace);
    model.assemblies = model.assemblies.map(a => ({ ...a, members: a.members.map(replace) }));
    model.sites = model.sites.map(s => ({ ...s, assemblies: s.assemblies.map(a => ({ ...a, members: a.members.map(replace) })) }));
    mappings.push({ entityId: member.entityId, supportKey: support.supportKey, siteId: site.siteId,
      recordId: row.recordId, originalSourceType: '', effectiveKind: row.value, evidence: row.evidence });
  }
  const material = { schema: 'current-common-input-support-mapping/v1', commonInputSemanticHash: commonInput.semanticHash,
    resolutionLedgerSemanticHash: commonInput.resolutionLedgerSemanticHash, sourceModelSemanticHash: commonInput.sourceModelSemanticHash,
    sourceSupportSiteModelSemanticHash: semanticHash(supportSiteModel), projectedSupportSiteModelSemanticHash: semanticHash(model),
    mappings, solverRestraintAuthorityAsserted: false, geometryChanged: false };
  return freezeDeep({ supportSiteModel: model, receipt: { ...material, semanticHash: semanticHash(material) } });
}

// Compatibility with callers of the original exact-REST review seam.
export const projectConfirmedRestMappings = projectConfirmedSupportMappings;
