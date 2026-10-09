import { semanticHash } from '../../core/shared-piping-model/canonical-json.js';
import { createNonFeaEnrichmentSidecar } from '../../core/non-fea-enrichment/index.js';
import { requireCurrentCommonInputEmpiricalSupportLoadExecution } from '../engineering-loads/current-common-input-empirical-support-load-execution.js';

/** Read-only export of an existing receipt. No calculation or publication authority. */
export function requireCurrentGravityReceipt(bundle) {
  const receipt = requireCurrentCommonInputEmpiricalSupportLoadExecution(bundle.execution);
  const common = bundle.screeningContext?.commonState;
  const dataset = bundle.screeningContext?.dataset;
  const calculated = value => ['CALCULATED', 'CALCULATED_WITH_EXCEPTIONS'].includes(value);
  if (!bundle.datasetId || receipt.datasetId !== bundle.datasetId
      || dataset?.sourceSha256 !== receipt.sourceDatasetSha256
      || bundle.distribution?.freshness?.status !== 'CURRENT'
      || !calculated(bundle.distribution?.status)
      || !bundle.distribution.loadCases?.length
      || bundle.distribution.loadCases.some(row => !calculated(row.status))
      || receipt.distributionSemanticHash !== semanticHash(bundle.distribution)
      || common?.staleness?.stale
      || common?.commonInput?.semanticHash !== receipt.commonInputSemanticHash
      || common?.commonInput?.seal?.semanticHash !== receipt.commonInputSealSemanticHash
      || common?.request?.semanticHash !== common?.commonInput?.requestSemanticHash) {
    throw new Error('Current source, seal and gravity receipt are required. Rerun after input changes.');
  }
  return receipt;
}

export function currentGravityStatus(bundle) {
  if (!bundle.distribution) return 'Gravity not calculated';
  try {
    requireCurrentGravityReceipt(bundle);
    return bundle.distribution.status === 'CALCULATED_WITH_EXCEPTIONS'
      ? 'Gravity calculated · exceptions retained' : `Gravity execution · ${bundle.distribution.status}`;
  } catch { return 'Gravity evidence stale or unavailable · rerun required'; }
}

export function createGravityResultExport(bundle) {
  const receipt = requireCurrentGravityReceipt(bundle);
  const common = bundle.screeningContext.commonState;
  const enrichmentSidecar = createNonFeaEnrichmentSidecar(common.request.enrichmentSidecar);
  if (enrichmentSidecar.semanticHash !== common.commonInput.enrichmentSidecarSemanticHash) {
    throw new Error('Weight assumptions no longer match the current sealed receipt.');
  }
  return {
    schema: 'load-calc-workbench-gravity-evidence/v1',
    evidenceFamily: 'SCALAR_GRAVITY',
    publicationAuthorityAsserted: false,
    quantityScope: {
      verticalForce: 'Existing source-axis gravity reaction; N; convention retained in receipt',
      moments: 'Existing chainage/overhang accounting only; not solved global moments',
      Fh: { state: 'SEPARATE_SCREENING_NOT_EXPORTED_AS_REACTION', value: null },
      Fa: { state: 'NOT_SUPPLIED_BY_GRAVITY', value: null },
      Fl: { state: 'NOT_SUPPLIED_BY_GRAVITY', value: null },
      globalMoments: { state: 'NOT_SUPPLIED_BY_GRAVITY', value: null },
    },
    receipt,
    // Preserve the exact input assumptions, including reviewed zero weights.
    enrichmentSidecar,
  };
}

/** Explain existing unallocated ledger entries; never assign another route's support. */
export function unallocatedGravityPaths(distribution) {
  if (distribution?.freshness?.status !== 'CURRENT') return [];
  return (distribution.loadCases || []).flatMap(loadCase => {
    if (!['CALCULATED', 'CALCULATED_WITH_EXCEPTIONS'].includes(loadCase.status)) return [];
    const routes = new Map();
    for (const row of loadCase.contributionLedger || []) {
      if (!row.unallocated?.length) continue;
      const group = routes.get(row.routeId) || { loadCaseId: loadCase.loadCaseId,
        routeId: row.routeId, entityIds: [], forceN: 0,
        reason: 'UNALLOCATED_FORCE_NO_QUALIFIED_VERTICAL_SUPPORT' };
      group.entityIds.push(row.entityId);
      group.forceN += row.unallocated.reduce((sum, entry) => sum + entry.verticalForceN, 0);
      routes.set(row.routeId, group);
    }
    return [...routes.values()];
  });
}
