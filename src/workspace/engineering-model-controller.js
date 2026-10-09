import { EVENT_TOPICS } from './event-topics.js';
import { engineeringModelStore } from './engineering-model-store.js';
import { nonFeaCommonInputStore } from './non-fea-common-input-store.js';
import { projectDataStore } from './project-data/project-data-store.js';
import { authorizedEnrichmentConsumerController } from './enrichment/authorized-enrichment-runtime.js';
import { MODEL_LOAD_EVENTS } from './model-load-events.js';
import { SUPPORT_RESTRAINT_EVENTS } from './support-restraint-events.js';
import { TOPOLOGY_EVENTS } from './topology-events.js';
import {
  executeCurrentCommonInputEmpiricalRun,
} from './engineering-loads/current-common-input-empirical-run-runtime.js';
import {
  commonInputConfigurationBasis,
  projectDataTopologyModelBasis,
} from './engineering-model-basis.js';

export { projectDataTopologyModelBasis };

export const ENGINEERING_MODEL_EVENTS = Object.freeze({
  CALCULATE_REQUESTED: 'engineering-support-loads:calculate-requested',
  CURRENT_COMMON_INPUT_CALCULATE_REQUESTED:
    'engineering-support-loads:current-common-input-calculate-requested',
  CHANGED: 'engineering-support-loads:changed',
  FAILED: 'engineering-support-loads:failed',
});

/** Rebuilds derived contracts and runs loads only on an explicit request. */
export class EngineeringModelController {
  constructor(
    eventBus,
    workspaceState,
    candidateController = authorizedEnrichmentConsumerController,
    { currentCommonInputExecutor = executeCurrentCommonInputEmpiricalRun } = {},
  ) {
    const isAuthorizedConsumer = candidateController
      && typeof candidateController.executeEmpirical === 'function'
      && typeof candidateController.refreshEmpirical === 'function';
    const isLegacyMasterDataDependency = candidateController
      && typeof candidateController.getMasterData === 'function';
    const authorizedConsumerController = isAuthorizedConsumer
      ? candidateController
      : isLegacyMasterDataDependency ? authorizedEnrichmentConsumerController : candidateController;
    if (!authorizedConsumerController
        || typeof authorizedConsumerController.executeEmpirical !== 'function'
        || typeof authorizedConsumerController.refreshEmpirical !== 'function') {
      const error = new TypeError('Engineering model controller requires the authorized empirical consumer.');
      error.code = 'EMPIRICAL_RUNTIME_AUTHORIZED_CONSUMER_REQUIRED';
      throw error;
    }
    if (typeof currentCommonInputExecutor !== 'function') {
      const error = new TypeError(
        'Engineering model controller requires the current Common Input empirical executor.',
      );
      error.code = 'CURRENT_COMMON_INPUT_EMPIRICAL_RUN_EXECUTOR_REQUIRED';
      throw error;
    }
    this.eventBus = eventBus;
    this.workspaceState = workspaceState;
    this.authorizedConsumerController = authorizedConsumerController;
    this.currentCommonInputExecutor = currentCommonInputExecutor;
    this.unsubscribers = [];
    this.datasetId = '';
    this.datasetVersion = null;
    this.lastRebuiltDataset = null;
    this.projectTopologyModelBasis = null;
    this.commonInputConfigurationBasis = null;
  }

  init() {
    if (this.unsubscribers.length) return;
    this.projectTopologyModelBasis = projectDataTopologyModelBasis(projectDataStore.getProfile());
    this.commonInputConfigurationBasis = commonInputConfigurationBasis(
      nonFeaCommonInputStore.getSnapshot(),
    );
    this.unsubscribers = [
      this.eventBus.subscribe(EVENT_TOPICS.WORKSPACE_SNAPSHOT_CHANGED, ({ snapshot }) => this.handleSnapshot(snapshot)),
      this.eventBus.subscribe(ENGINEERING_MODEL_EVENTS.CALCULATE_REQUESTED, () => this.calculate()),
      this.eventBus.subscribe(
        ENGINEERING_MODEL_EVENTS.CURRENT_COMMON_INPUT_CALCULATE_REQUESTED,
        () => this.calculateCurrentCommonInput(),
      ),
      this.eventBus.subscribe('MASTER_DATA_UPDATED', () => this.handleMasterDataChanged()),
      this.eventBus.subscribe('MASTER_DATA_CLEARED', () => this.handleMasterDataChanged()),
      this.eventBus.subscribe(TOPOLOGY_EVENTS.CHANGED, () => this.handleAuthorityContractChanged(
        'TOPOLOGY_AUTHORITY_CHANGED',
        'authorityContracts.topologyGraph',
        'Governed topology authority changed after the current Common Input was sealed.',
      )),
      this.eventBus.subscribe(SUPPORT_RESTRAINT_EVENTS.CHANGED, () => this.handleAuthorityContractChanged(
        'SUPPORT_RESTRAINT_AUTHORITY_CHANGED',
        'authorityContracts.supportAttachmentModel',
        'Support attachment/restraint authority changed after the current Common Input was sealed.',
      )),
      this.eventBus.subscribe(MODEL_LOAD_EVENTS.CHANGED, () => this.handleAuthorityContractChanged(
        'MODEL_LOAD_AUTHORITY_CHANGED',
        'authorityContracts.loadPrimitiveSet',
        'Source load-primitive authority changed after the current Common Input was sealed.',
      )),
      projectDataStore.subscribe((event) => this.handleProjectDataChanged(event)),
      nonFeaCommonInputStore.subscribe((snapshot) => this.handleCommonInputSnapshot(snapshot)),
    ];
  }

  handleSnapshot(snapshot) {
    const dataset = snapshot?.status === 'ready' ? snapshot.dataset : null;
    if (!dataset) {
      engineeringModelStore.deactivate('NO_ACTIVE_DATASET');
      nonFeaCommonInputStore.markStale('NO_ACTIVE_DATASET', 'sourceDatasetSha256', 'The active dataset was cleared.');
      this.datasetId = '';
      this.datasetVersion = null;
      this.lastRebuiltDataset = null;
      return;
    }
    const distribution = engineeringModelStore.getDistribution();
    let refreshRequired = false;
    if (distribution && distribution.datasetId !== dataset.datasetId) {
      engineeringModelStore.markEmpiricalStale('DATASET_REPLACED', dataset.version || null);
      nonFeaCommonInputStore.markStale('DATASET_REPLACED', 'sourceDatasetSha256', 'A different dataset is active.');
      refreshRequired = true;
    } else if (distribution && distribution.datasetVersion !== (dataset.version || null)) {
      engineeringModelStore.markEmpiricalStale('DATASET_EDITED', dataset.version || null);
      nonFeaCommonInputStore.markStale('DATASET_EDITED', 'sourceModelSemanticHash', 'The active dataset changed after sealing.');
      refreshRequired = true;
    }
    this.datasetId = dataset.datasetId;
    this.datasetVersion = dataset.version || null;
    if (dataset !== this.lastRebuiltDataset) {
      const previousDataset = this.lastRebuiltDataset;
      this.lastRebuiltDataset = dataset;
      try {
        engineeringModelStore.rebuild(dataset);
      } catch (error) {
        this.blockDerivedModels(error, dataset);
        return;
      }
      if (previousDataset !== null) {
        nonFeaCommonInputStore.markStale('DATASET_REBUILT', 'sourceModelSemanticHash', 'The governed dataset models were rebuilt.');
      }
      refreshRequired = true;
    }
    if (refreshRequired) this.authorizedConsumerController.refreshEmpirical();
  }

  blockDerivedModels(error, dataset) {
    engineeringModelStore.deactivate('ENGINEERING_MODELS_NOT_READY');
    nonFeaCommonInputStore.markStale(
      'ENGINEERING_MODELS_NOT_READY',
      'sourceModelSemanticHash',
      'Derived support-site or route evidence is not ready for the active dataset.',
    );
    this.authorizedConsumerController.refreshEmpirical();
    this.eventBus.publish(ENGINEERING_MODEL_EVENTS.FAILED, {
      message: error instanceof Error ? error.message : String(error),
      code: error?.code || 'ENGINEERING_MODEL_REBUILD_BLOCKED',
      datasetId: dataset?.datasetId || null,
    });
  }

  handleProjectDataChanged(event = null) {
    const dataset = this.workspaceState.getSnapshot()?.dataset || null;
    const profile = event?.profile || projectDataStore.getProfile();
    const nextTopologyModelBasis = projectDataTopologyModelBasis(profile);
    const topologyModelChanged = this.projectTopologyModelBasis === null
      || this.projectTopologyModelBasis !== nextTopologyModelBasis;
    this.projectTopologyModelBasis = nextTopologyModelBasis;

    engineeringModelStore.markEmpiricalStale('PROJECT_DATA_CHANGED', dataset?.version || null);
    nonFeaCommonInputStore.markStale('PROJECT_DATA_CHANGED', 'projectDataProfileSemanticHash', 'Project Data changed after sealing.');
    if (topologyModelChanged && dataset) {
      try {
        engineeringModelStore.rebuild(dataset);
      } catch (error) {
        this.blockDerivedModels(error, dataset);
        return;
      }
    }
    this.authorizedConsumerController.refreshEmpirical();
    this.eventBus.publish(ENGINEERING_MODEL_EVENTS.CHANGED, {
      reason: 'project-data-changed',
      topologyCheckAffected: Boolean(topologyModelChanged && dataset),
      topologyModelRebuilt: Boolean(topologyModelChanged && dataset),
    });
  }

  handleMasterDataChanged() {
    const dataset = this.workspaceState.getSnapshot()?.dataset || null;
    engineeringModelStore.markEmpiricalStale('MASTER_DATA_CHANGED', dataset?.version || null);
    nonFeaCommonInputStore.markStale('MASTER_DATA_CHANGED', 'enrichmentSidecarSemanticHash', 'Master data changed after sealing.');
    this.authorizedConsumerController.refreshEmpirical();
    this.eventBus.publish(ENGINEERING_MODEL_EVENTS.CHANGED, {
      reason: 'master-data-changed',
      topologyCheckAffected: false,
    });
  }

  /**
   * Bound topology/support/load authority contracts are calculation-affecting.
   * Mark both the retained Common Input seal and any current numerical result
   * stale so ordinary Run cannot reuse authority that changed behind the seal.
   */
  handleAuthorityContractChanged(staleCode, path, message) {
    const dataset = this.workspaceState.getSnapshot()?.dataset || null;
    const distribution = engineeringModelStore.getDistribution();
    if (distribution?.freshness?.status === 'CURRENT') {
      engineeringModelStore.markEmpiricalStale(staleCode, dataset?.version || null);
    }
    nonFeaCommonInputStore.markStale(staleCode, path, message);
    this.authorizedConsumerController.refreshEmpirical();
    this.eventBus.publish(ENGINEERING_MODEL_EVENTS.CHANGED, {
      reason: 'authority-contract-changed',
      authorityReason: staleCode,
      topologyCheckAffected: false,
    });
  }

  /**
   * Requested methods/load cases/qualification selection are calculation-
   * affecting even though they do not rebuild geometry. Observe the Common
   * Input store centrally so every configuration authoring surface invalidates
   * current numerical results. Accepted input edits also mark the retained seal
   * stale without changing configuration. Carry that authority invalidation to
   * the result/receipt once; unchanged current evaluation/sealing does not.
   */
  handleCommonInputSnapshot(snapshot) {
    const nextBasis = commonInputConfigurationBasis(snapshot);
    if (this.commonInputConfigurationBasis === null) {
      this.commonInputConfigurationBasis = nextBasis;
      return;
    }
    const configurationChanged = nextBasis !== this.commonInputConfigurationBasis;
    this.commonInputConfigurationBasis = nextBasis;
    const staleCurrentResult = snapshot?.staleness?.stale === true
      && engineeringModelStore.getDistribution()?.freshness?.status === 'CURRENT';
    if (!configurationChanged && !staleCurrentResult) return;

    const dataset = this.workspaceState.getSnapshot()?.dataset || null;
    const staleCode = configurationChanged ? 'COMMON_INPUT_CONFIGURATION_CHANGED'
      : snapshot.staleness.changes?.[0]?.code || 'COMMON_INPUT_STALE';
    // Do not mark the seal again: this is its subscriber. Stale the result before
    // publishing/refreshing so any nested store notification is idempotent.
    engineeringModelStore.markEmpiricalStale(
      staleCode,
      dataset?.version || null,
    );
    this.authorizedConsumerController.refreshEmpirical();
    this.eventBus.publish(ENGINEERING_MODEL_EVENTS.CHANGED, {
      reason: configurationChanged ? 'common-input-configuration-changed' : 'common-input-stale',
      authorityReason: staleCode,
      topologyCheckAffected: false,
    });
  }

  /** Retained explicit historical authorized-runtime execution path. */
  calculate() {
    try {
      const execution = this.authorizedConsumerController.executeEmpirical();
      const distribution = execution.distribution;
      this.eventBus.publish(ENGINEERING_MODEL_EVENTS.CHANGED, { reason: 'calculated', distribution, execution });
      return execution;
    } catch (error) {
      this.eventBus.publish(ENGINEERING_MODEL_EVENTS.FAILED, {
        message: error instanceof Error ? error.message : String(error),
        code: error?.code || 'EMPIRICAL_RUNTIME_EXECUTION_FAILED',
      });
      return null;
    }
  }

  /** Ordinary product Run path: exactly one #1478 current-system execution. */
  calculateCurrentCommonInput() {
    try {
      const runtime = this.currentCommonInputExecutor();
      const execution = runtime.supportExecution;
      const distribution = execution.distribution;
      this.eventBus.publish(ENGINEERING_MODEL_EVENTS.CHANGED, {
        reason: 'calculated',
        distribution,
        execution,
        currentCommonInputRuntime: runtime,
        authority: 'CURRENT_COMMON_INPUT_SYSTEM_RUN',
      });
      return runtime;
    } catch (error) {
      this.eventBus.publish(ENGINEERING_MODEL_EVENTS.FAILED, {
        message: error instanceof Error ? error.message : String(error),
        code: error?.code || 'CURRENT_COMMON_INPUT_EMPIRICAL_RUN_FAILED',
        authority: 'CURRENT_COMMON_INPUT_SYSTEM_RUN',
      });
      return null;
    }
  }

  destroy() {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    this.lastRebuiltDataset = null;
    this.projectTopologyModelBasis = null;
    this.commonInputConfigurationBasis = null;
    engineeringModelStore.clear();
  }
}
