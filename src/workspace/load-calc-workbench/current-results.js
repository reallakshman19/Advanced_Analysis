import { WorkspaceState } from '../workspace-state.js';
import { engineeringModelStore } from '../engineering-model-store.js';
import { nonFeaCommonInputStore } from '../non-fea-common-input-store.js';
import { nonFeaMethodExecutionCoordinator } from '../non-fea-method-execution-coordinator.js';
import { masterDataController } from '../master-data-controller.js';
import { empiricalLoadCalcScenarioStore } from '../engineering-loads/empirical-load-calc-scenario-store.js';
import { empiricalResultOverlayStore } from '../engineering-loads/empirical-result-overlay-store.js';
import { renderWorkbenchResults } from './results-view.js';

/** Read current owner snapshots at render time; never authorize, execute or export here. */
export function renderCurrentWorkbenchResults(container) {
  const dataset = WorkspaceState.getSnapshot().dataset;
  const execution = engineeringModelStore.getCurrentCommonInputExecution();
  const supportSiteModel = engineeringModelStore.getSupportSiteModel();
  const routePartitionModel = engineeringModelStore.getRoutePartitionModel();
  const scenario = {
    snapshot: empiricalLoadCalcScenarioStore.getSnapshot(),
    proposal: empiricalLoadCalcScenarioStore.getProposal(),
    authorization: empiricalLoadCalcScenarioStore.getAuthorization(),
    execution: empiricalLoadCalcScenarioStore.getExecution(),
    overlaySnapshot: empiricalResultOverlayStore.getSnapshot(),
  };
  let authorizationCurrent = false;
  if (scenario.snapshot.state === 'EXECUTED_CURRENT' && scenario.authorization) {
    try {
      nonFeaMethodExecutionCoordinator.requireCurrentAuthorization({
        authorizationId: scenario.authorization.authorizationId,
        implementationId: scenario.proposal.method,
      });
      authorizationCurrent = true;
    } catch { /* Existing owner rejected currentness; withhold scenario numbers. */ }
  }
  renderWorkbenchResults(container, {
    datasetId: dataset?.datasetId,
    distribution: engineeringModelStore.getDistribution(), supportSiteModel, routePartitionModel,
    execution, authorizedExecution: engineeringModelStore.getAuthorizedExecution(),
    authorizationState: engineeringModelStore.getEmpiricalAuthorizationState(),
    screeningContext: { dataset, commonState: nonFeaCommonInputStore.getSnapshot(), execution,
      supportSiteModel, routePartitionModel, lineList: masterDataController.masterData.lineList },
    scenario, overlay: empiricalResultOverlayStore.getProjection(), authorizationCurrent,
  });
}
