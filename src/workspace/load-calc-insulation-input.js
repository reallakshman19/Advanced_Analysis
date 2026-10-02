import { createNonFeaEnrichmentProposal } from '../core/non-fea-enrichment/index.js';
import { semanticHash } from '../core/shared-piping-model/index.js';
import { LOAD_CALC_INSULATION_ZERO_DEFAULT_V1,
  createNonFeaProductEngineeringDefaultProvider } from './project-data/non-fea-product-engineering-default-profile.js';

/** Use the existing default/precedence engine, never replace invalid source with zero. */
export function createLoadCalcInsulationDefaultProvider(options) {
  const provider = createNonFeaProductEngineeringDefaultProvider({
    ...options, defaultProfile: LOAD_CALC_INSULATION_ZERO_DEFAULT_V1,
  });
  const invalid = new Set(options.sourceModel.components.filter((component) =>
    component.diagnostics?.some((row) => row.code === 'ENGINEERING_PROPERTY_INVALID'
      && row.field === 'insulationThicknessMm')).map((component) => component.componentKey));
  const material = { ...provider, records: provider.records.filter((record) => !invalid.has(record.selectorKey)) };
  delete material.semanticHash;
  return { ...material, semanticHash: semanticHash(material) };
}

export function insulationPreviewRecordId(entityId) { return `preview-insulation:${entityId}`; }

/** Explicit Apply is an existing exact-selector accepted-override transaction. */
export function applyPreviewInsulationThickness({ store, sourceModel, entityId, text }) {
  if (!sourceModel?.components.some((component) => component.componentKey === entityId)) {
    throw new TypeError('Insulation input requires an exact current component.');
  }
  const snapshot = store.getSnapshot();
  if (snapshot.stale || snapshot.currentSourceSemanticHash !== sourceModel.semanticHash) {
    throw new TypeError('Insulation input is stale; reload current input before applying.');
  }
  const recordId = insulationPreviewRecordId(entityId);
  const input = String(text).trim();
  if (!input) { store.removeAccepted(recordId); return; }
  const value = Number(input);
  if (!Number.isFinite(value) || value < 0) throw new TypeError('Insulation thickness must be a finite non-negative number in mm.');
  const proposal = createNonFeaEnrichmentProposal({
    proposalId: recordId, rationale: 'Explicit insulation thickness entered and applied in Preview (mm).',
    record: { recordId, selectorKind: 'ENTITY', selectorKey: entityId,
      fieldId: 'INSULATION_THICKNESS', value, unit: 'mm', authority: 'ACCEPTED_OVERRIDE',
      sourceId: 'LOAD_CALC_PREVIEW_INSULATION_INPUT', revision: String(snapshot.version + 1),
      evidence: { sourceSemanticHash: sourceModel.semanticHash, source: 'Preview insulation input' } },
  });
  store.stageProposal(proposal);
  store.acceptProposal(proposal.proposalId);
}
