import { WorkspaceState } from '../workspace-state.js';
import { nonFeaEnrichmentStore } from '../enrichment/non-fea-enrichment-store.js';
import { nonFeaCommonInputStore } from '../non-fea-common-input-store.js';
import { evaluateCurrentNonFeaInputCheckStatus } from '../non-fea-common-input-check-adapter.js';
import { projectDataStore } from '../project-data/project-data-store.js';
import { engineeringModelStore } from '../engineering-model-store.js';
import { masterDataController } from '../master-data-controller.js';
import { createPreparedReview } from './prepared-review.js';
import { semanticHash } from '../../core/shared-piping-model/index.js';
import { empiricalLoadCalcScenarioStore } from '../engineering-loads/empirical-load-calc-scenario-store.js';
import { empiricalResultOverlayStore } from '../engineering-loads/empirical-result-overlay-store.js';

/** Existing preparation owner evaluates inputs; no accept/seal/authorize/run. */
export function prepareCurrentReview() {
  const { snapshot, status } = evaluateCurrentNonFeaInputCheckStatus();
  return createPreparedReview({ workspace: WorkspaceState.getSnapshot(),
    enrichment: nonFeaEnrichmentStore.getSnapshot(), snapshot, status,
    binding: currentReviewBinding() });
}

/** Conservative session invalidation. No owner mutation or numerical work. */
export function currentReviewBinding() {
  const dataset = WorkspaceState.getSnapshot().dataset;
  const common = nonFeaCommonInputStore.getSnapshot();
  const enrichment = nonFeaEnrichmentStore.getSnapshot();
  return JSON.stringify([
    dataset?.datasetId, dataset?.sharedModel?.semanticHash, dataset?.sourceSha256,
    common.request?.semanticHash, common.report?.semanticHash, common.configuration, common.error,
    common.commonInput?.semanticHash, common.staleness, common.currentBindings,
    common.consumptionAuthorizations, common.consumptionExecutions,
    enrichment.currentSourceSemanticHash, enrichment.boundSourceSemanticHash, enrichment.stale,
    enrichment.acceptedRecords, enrichment.proposals, enrichment.migrationReport,
    projectDataStore.getSemanticHash(), masterDataController.getMasterData(),
    engineeringModelStore.getSupportSiteModel()?.semanticHash,
    engineeringModelStore.getRoutePartitionModel()?.semanticHash,
    engineeringModelStore.getDistribution() ? semanticHash(engineeringModelStore.getDistribution()) : null,
    engineeringModelStore.getDistribution()?.freshness,
    engineeringModelStore.getCurrentCommonInputExecution()?.semanticHash,
    engineeringModelStore.getAuthorizedExecution()?.semanticHash,
    engineeringModelStore.getEmpiricalAuthorizationState(),
    empiricalLoadCalcScenarioStore.getSnapshot().semanticHash,
    empiricalResultOverlayStore.getSnapshot().semanticHash,
  ]);
}
