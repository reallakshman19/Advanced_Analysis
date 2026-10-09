import { createLoadCalculationReviewModel, validateLoadCalculationReviewModel } from '../core/load-calculation-consumer/index.js';
import { APPLICATION_EVENTS, EVENT_TOPICS } from './event-topics.js';
import { ENGINEERING_MODEL_EVENTS } from './engineering-model-controller.js';
import { engineeringModelStore } from './engineering-model-store.js';
import { authorizedEnrichmentConsumerController } from './enrichment/authorized-enrichment-runtime.js';
import {
  isRoutineRunReady,
  renderEngineeringLoadPane,
  renderLoadCalcConsumer,
  renderLoadCalcTopologyPane,
} from './load-calc-current-system-view.js';
import { classifyLoadCalcResultPresentation } from './load-calc-result-presentation.js';
import { masterDataController } from './master-data-controller.js';
import { createCurrentNonFeaWorkspaceStatusProjection } from './non-fea-analysis-plan-runtime.js';
import { nonFeaCommonInputStore } from './non-fea-common-input-store.js';
import {
  sealCurrentNonFeaCommonInput,
  sealCurrentReadyNonFeaCalculationSnapshot,
} from './non-fea-common-input-runtime.js';
import { validateProjectDataProfile } from './project-data/project-data-contract.js';
import { projectDataStore } from './project-data/project-data-store.js';
import {
  EMPIRICAL_LOAD_CALC_SCENARIO_EVENTS,
} from './engineering-loads/empirical-load-calc-scenario-controller.js';
import {
  empiricalLoadCalcScenarioStore,
} from './engineering-loads/empirical-load-calc-scenario-store.js';
import {
  empiricalResultOverlayStore,
} from './engineering-loads/empirical-result-overlay-store.js';
import {
  topologyEditCheckSnapshotStore,
} from './topology-edit/topology-edit-check-snapshot-store.js';
import {
  TOPOLOGY_EDIT_DEFAULT_AUTOFIX_GAP_MM,
} from './topology-edit/topology-edit-gap-autofix-policy.js';
import { SUPPORT_RESTRAINT_EVENTS } from './support-restraint-events.js';
import { TOPOLOGY_EVENTS } from './topology-events.js';

const EMPIRICAL_SCENARIO_VIEW_TABS = new Set([
  'overview', 'restraints', 'load-cases', 'methods', 'results', 'evidence', 'model-3d',
]);

const WORKFLOW_STEP_BY_TAB = Object.freeze({
  topology: 'topology',
  'project-data': 'project-data',
  masters: 'masters',
  preflight: 'preflight',
  verify: 'verify',
  loads: 'loads',
});

/** Coordinates the real empirical load workflow without generating inputs. */
export class LoadCalcConsumerController {
  constructor(rootElement, consumerController, eventBus, {
    readyCalculationSnapshotProvider = sealCurrentReadyNonFeaCalculationSnapshot,
    empiricalAuthorizationController = authorizedEnrichmentConsumerController,
  } = {}) {
    if (!rootElement) throw new TypeError('Load Calc requires a stable root element.');
    if (typeof readyCalculationSnapshotProvider !== 'function') {
      throw new TypeError('Load Calc requires a READY calculation snapshot provider.');
    }
    if (!empiricalAuthorizationController
        || typeof empiricalAuthorizationController.refreshEmpirical !== 'function') {
      throw new TypeError('Load Calc requires an empirical authorization currentness controller.');
    }
    this.rootElement = rootElement;
    this.consumerController = consumerController;
    this.eventBus = eventBus;
    this.readyCalculationSnapshotProvider = readyCalculationSnapshotProvider;
    this.empiricalAuthorizationController = empiricalAuthorizationController;
    this.context = consumerController?.getContext() || null;
    this.reviewModel = buildReviewModel(this.context);
    this.activeTab = 'topology';
    this.currentWorkflowStepId = this.context?.datasetId ? 'topology' : 'import';
    this.message = '';
    this.unsubscribers = [];
    this.renderRevision = 0;
    this.topologyEdit3DController = null;
    this.pending3dInvestigationEntityId = null;
    this.pendingCertifiedTopologyAutofix = false;
    this.topologyGapAutofixToleranceMm = TOPOLOGY_EDIT_DEFAULT_AUTOFIX_GAP_MM;
    this.topologyPolicyFeedback = '';
    this.topologyCheckRevision = 0;
    this.topologyCheck = engineeringModelStore.getTopologyCheckSnapshot()
      || pendingTopologyCheck(this.context);
    this.clickHandler = (event) => this.handleClick(event);
  }

  init() {
    if (this.unsubscribers.length) return;
    this.rootElement.addEventListener('click', this.clickHandler);
    this.unsubscribers = [
      this.eventBus.subscribe(APPLICATION_EVENTS.CONTEXT_CHANGED, ({ context }) => this.handleContext(context)),
      this.eventBus.subscribe(EVENT_TOPICS.WORKSPACE_SNAPSHOT_CHANGED, () => { void this.refreshTopologyCheck(); }),
      this.eventBus.subscribe(TOPOLOGY_EVENTS.CHANGED, () => { void this.refreshTopologyCheck(); }),
      this.eventBus.subscribe(SUPPORT_RESTRAINT_EVENTS.CHANGED, () => { void this.refreshTopologyCheck(); }),
      this.eventBus.subscribe(ENGINEERING_MODEL_EVENTS.CHANGED, ({ reason, distribution, topologyCheckAffected }) => this.handleEngineeringChange(reason, distribution, topologyCheckAffected)),
      this.eventBus.subscribe(ENGINEERING_MODEL_EVENTS.FAILED, ({ message }) => this.handleFailure(message)),
      this.eventBus.subscribe(EVENT_TOPICS.LOAD_CALC_SUBTAB_REQUESTED, ({ tab }) => { this.selectTab(tab); this.render(); }),
      this.eventBus.subscribe(EMPIRICAL_LOAD_CALC_SCENARIO_EVENTS.CHANGED, ({ snapshot }) => {
        this.message = empiricalScenarioMessage(snapshot);
        this.render();
      }),
      this.eventBus.subscribe(EMPIRICAL_LOAD_CALC_SCENARIO_EVENTS.RESULT_OVERLAY_CHANGED, ({ snapshot, projection }) => {
        this.topologyEdit3DController?.viewportBackend?.setGovernedResultProjection(
          projection,
          snapshot?.reasonCode || 'EMPIRICAL_EXECUTION_REQUIRED',
        );
      }),
      this.eventBus.subscribe(EMPIRICAL_LOAD_CALC_SCENARIO_EVENTS.FAILED, ({ message }) => this.handleFailure(message)),
      // Auto-commit normalization for bundled masters whenever the controller
      // seeds raw rows without a committed fieldMap (async piping-class fetch,
      // sync weight/materialMap seed).  The function is idempotent — it skips
      // any master that already has normalizedRows or a user-committed fieldMap.
      this.eventBus.subscribe('MASTER_DATA_UPDATED', ({ action } = {}) => {
        if (!action?.startsWith('bundled_seed')) return;
        import('./master-data-ui.js').then(async ({ autoNormalizeBundledMasters, autoGenerateMasterEnrichment, autoBindMasterSources, autoEnsureDefaultQualificationProfile }) => {
          const committed = autoNormalizeBundledMasters();
          if (committed.length > 0) this.render();
          const [enrichResult, bindResult, qualResult] = await Promise.all([
            autoGenerateMasterEnrichment(),
            autoBindMasterSources(),
            autoEnsureDefaultQualificationProfile(),
          ]);
          if (enrichResult?.accepted > 0 || bindResult?.bound?.length > 0 || qualResult) this.render();
        }).catch(() => {});
      }),
    ];
    this.render();
    void this.refreshTopologyCheck();
    // Eagerly normalize + auto-generate + auto-bind for already-seeded masters
    import('./master-data-ui.js').then(async ({ autoNormalizeBundledMasters, autoGenerateMasterEnrichment, autoBindMasterSources, autoEnsureDefaultQualificationProfile }) => {
      const committed = autoNormalizeBundledMasters();
      const defaultsResult = projectDataStore.applyProductDefaults();
      if (committed.length > 0 || defaultsResult) this.render();
      const [enrichResult, bindResult, qualResult] = await Promise.all([
        autoGenerateMasterEnrichment(),
        autoBindMasterSources(),
        autoEnsureDefaultQualificationProfile(),
      ]);
      if (enrichResult?.accepted > 0 || bindResult?.bound?.length > 0 || qualResult) this.render();
      // Auto-accept unambiguous fitting weights (0 kg instruments etc.)
      import('./enrichment/non-fea-enrichment-view.js').then(({ autoAcceptClearWinnerFittingWeights }) => {
        const accepted = autoAcceptClearWinnerFittingWeights();
        if (accepted > 0) this.render();
      }).catch(() => {});
    }).catch(() => {});
  }

  handleContext(context) {
    const datasetChanged = this.context?.datasetId !== context?.datasetId;
    this.context = context;
    this.reviewModel = buildReviewModel(context);
    if (datasetChanged) {
      this.activeTab = 'topology';
      this.currentWorkflowStepId = context?.datasetId ? 'topology' : 'import';
      this.topologyCheck = pendingTopologyCheck(context);
      this.topologyPolicyFeedback = '';
    }
    this.render();
    if (datasetChanged) {
      void this.refreshTopologyCheck();
      // Auto-generate enrichment + bind source hashes when a new dataset arrives
      import('./master-data-ui.js').then(async ({ autoGenerateMasterEnrichment, autoBindMasterSources, autoEnsureDefaultQualificationProfile }) => {
        const defaultsResult = projectDataStore.applyProductDefaults();
        const [enrichResult, bindResult, qualResult] = await Promise.all([
          autoGenerateMasterEnrichment(),
          autoBindMasterSources(),
          autoEnsureDefaultQualificationProfile(),
        ]);
        if (defaultsResult || enrichResult?.accepted > 0 || bindResult?.bound?.length > 0 || qualResult) this.render();
        // Auto-accept unambiguous fitting weights (0 kg instruments etc.)
        import('./enrichment/non-fea-enrichment-view.js').then(({ autoAcceptClearWinnerFittingWeights }) => {
          const accepted = autoAcceptClearWinnerFittingWeights();
          if (accepted > 0) this.render();
        }).catch(() => {});
      }).catch(() => {});
    }
  }

  handleEngineeringChange(reason, distribution, topologyCheckAffected) {
    if (reason === 'calculated') {
      const presentation = classifyLoadCalcResultPresentation(distribution);
      this.message = presentation.message;
      if (presentation.openLoads) this.selectTab('loads');
    }
    if (reason === 'project-data-changed') this.message = authorityChangeMessage('Project Data');
    if (reason === 'master-data-changed') this.message = authorityChangeMessage('Master data');
    if (reason === 'authorization-changed') this.message = availabilityMessage(engineeringModelStore.getEmpiricalAuthorizationState());
    this.render();
    if ((reason === 'project-data-changed' || reason === 'master-data-changed')
        && topologyCheckAffected !== false) {
      void this.refreshTopologyCheck();
    }
  }

  handleFailure(message) {
    this.message = message || 'Load calculation failed.';
    this.render();
  }

  /** Updates presentation progress only; engineering readiness remains store-owned. */
  selectTab(tab) {
    this.activeTab = tab;
    const workflowStepId = WORKFLOW_STEP_BY_TAB[tab];
    if (workflowStepId) this.currentWorkflowStepId = workflowStepId;
  }

  /** Lazily evaluates the heavy canonical checker and refreshes run authority. */
  async refreshTopologyCheck() {
    const revision = ++this.topologyCheckRevision;
    const requestedDatasetId = this.context?.datasetId || null;
    if (!requestedDatasetId) {
      this.topologyCheck = pendingTopologyCheck(this.context);
      this.render();
      return;
    }
    try {
      const { evaluateCurrentTopologyCheck } = await import(
        './topology-edit/topology-edit-check-runtime.js'
      );
      const snapshot = evaluateCurrentTopologyCheck();
      if (revision !== this.topologyCheckRevision
          || requestedDatasetId !== this.context?.datasetId) return;
      this.topologyCheck = snapshot;
      this.topologyGapAutofixToleranceMm = snapshot.autoFix.exactToleranceMm;
      topologyEditCheckSnapshotStore.setSnapshot(snapshot);
      engineeringModelStore.refreshAuthorizedEmpiricalPackage(
        masterDataController.getMasterData(),
      );
      this.render();
    } catch (error) {
      if (revision !== this.topologyCheckRevision) return;
      this.message = error instanceof Error ? error.message : String(error);
      this.topologyCheck = failedTopologyCheck(this.context, this.message);
      this.render();
    }
  }

  async applyTopologyGapTolerance(value) {
    this.topologyPolicyFeedback = 'Updating the automatic gap-fix limit…';
    this.render();
    try {
      const { topologyEditFindingReviewStore } = await import(
        './topology-edit/topology-edit-finding-review-store.js'
      );
      this.topologyGapAutofixToleranceMm = topologyEditFindingReviewStore
        .setGapAutofixToleranceMm(value);
      await this.refreshTopologyCheck();
      const candidateCount = this.topologyCheck.autoFix.certifiedExactGapCount;
      this.topologyPolicyFeedback = candidateCount > 0
        ? `Limit applied. ${candidateCount} certified gap fix candidate(s) are ready; select Prepare auto-fix.`
        : `Limit applied. No certified source-backed endpoint gaps exist strictly below ${this.topologyGapAutofixToleranceMm} mm.`;
      this.message = this.topologyPolicyFeedback;
      this.render();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.topologyPolicyFeedback = `Limit not applied: ${message}`;
      this.message = message;
      this.render();
    }
  }

  async recordTopologySkip(findingId, reason) {
    try {
      const { topologyEditFindingReviewStore } = await import(
        './topology-edit/topology-edit-finding-review-store.js'
      );
      const receipt = topologyEditFindingReviewStore.skipFinding(
        this.topologyCheck,
        findingId,
        reason,
        new Date().toISOString(),
      );
      this.message = `Finding recorded as skipped under receipt ${receipt.receiptId}.`;
      this.topologySkipError = null;
      await this.refreshTopologyCheck();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.message = message;
      // The header status sits far from the finding row that was clicked, so the
      // failure is also reported inline against that finding.
      this.topologySkipError = { findingId, message };
      this.render();
    }
  }

  async restoreTopologyFinding(findingId) {
    try {
      const { topologyEditFindingReviewStore } = await import(
        './topology-edit/topology-edit-finding-review-store.js'
      );
      topologyEditFindingReviewStore.restoreFinding(
        this.topologyCheck,
        findingId,
        new Date().toISOString(),
      );
      this.message = 'Skipped finding restored as an active blocker.';
      await this.refreshTopologyCheck();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
      this.render();
    }
  }

  async downloadTopologyReview() {
    try {
      const { topologyEditFindingReviewStore } = await import(
        './topology-edit/topology-edit-finding-review-store.js'
      );
      const report = topologyEditFindingReviewStore.createReport(
        this.topologyCheck,
        new Date().toISOString(),
      );
      downloadJson(
        this.rootElement.ownerDocument,
        `topology-review-${report.datasetId}.json`,
        report,
      );
      this.message = `Topology review record exported with ${report.receipts.length} receipt(s).`;
      this.render();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
      this.render();
    }
  }

  runCurrentCalculation() {
    const snap = empiricalLoadCalcScenarioStore.getSnapshot();
    if (snap?.calculationEligible) {
      this.message = 'Executing the current common-seal-bound empirical method…';
      this.eventBus.publish(EMPIRICAL_LOAD_CALC_SCENARIO_EVENTS.CALCULATE_REQUESTED, {});
      return;
    }

    this.message = 'Executing the current governed gravity calculation…';
    this.eventBus.publish(
      ENGINEERING_MODEL_EVENTS.CURRENT_COMMON_INPUT_CALCULATE_REQUESTED,
      { source: 'load-calc' },
    );
  }

  handleClick(event) {
    const supportEntityId = event.target.closest('[data-load-support-entity-id]')?.dataset.loadSupportEntityId;
    if (supportEntityId) { this.eventBus.publish(EVENT_TOPICS.VIEWPORT_SELECTION_REQUESTED, { entityId: supportEntityId, source: 'load-table' }); return; }
    const investigationEntityId = event.target.closest('[data-non-fea-investigation-entity-id]')?.dataset.nonFeaInvestigationEntityId;
    if (investigationEntityId) {
      this.pending3dInvestigationEntityId = investigationEntityId;
      this.activeTab = '3d';
      this.render();
      return;
    }
    if (event.target.closest('[data-load-calc-import]')) {
      this.eventBus.publish(APPLICATION_EVENTS.CHANGE_REQUESTED, { viewId: 'WORKSPACE', source: 'load-calc-workflow' });
      return;
    }
    if (event.target.closest('[data-load-calc-topology-autofix]')) {
      const topologyCheck = this.topologyCheck;
      if (topologyCheck.autoFix.certifiedExactGapCount === 0) {
        this.topologyPolicyFeedback = 'No certified source-backed endpoint gap is available to auto-fix.';
        this.message = this.topologyPolicyFeedback;
        this.render();
        return;
      }
      this.pendingCertifiedTopologyAutofix = true;
      this.topologyPolicyFeedback = 'Opening 3D Edit and preparing the certified gap-fix draft…';
      this.message = 'Opening the certified 3D draft and applying source-backed gap fixes…';
      this.activeTab = '3d';
      this.render();
      return;
    }
    if (event.target.closest('[data-load-calc-topology-gap-apply]')) {
      const input = this.rootElement.querySelector('[data-load-calc-topology-gap-mm]');
      void this.applyTopologyGapTolerance(input?.value);
      return;
    }
    const skipButton = event.target.closest('[data-load-calc-topology-skip]');
    if (skipButton) {
      const row = skipButton.closest('[data-topology-finding-id]');
      const reason = row?.querySelector('[data-load-calc-topology-skip-reason]')?.value;
      void this.recordTopologySkip(skipButton.dataset.loadCalcTopologySkip, reason);
      return;
    }
    const restoreButton = event.target.closest('[data-load-calc-topology-restore]');
    if (restoreButton) {
      void this.restoreTopologyFinding(restoreButton.dataset.loadCalcTopologyRestore);
      return;
    }
    if (event.target.closest('[data-load-calc-topology-review-download]')) {
      void this.downloadTopologyReview();
      return;
    }
    const tab = event.target.closest('[data-load-calc-tab]')?.dataset.loadCalcTab;
    if (tab) {
      this.pending3dInvestigationEntityId = null;
      this.selectTab(tab);
      this.render();
      return;
    }
    const quickFixAction = event.target.closest('[data-quick-fix-action]')?.dataset.quickFixAction;
    if (quickFixAction === 'create-qualification-profile') {
      import('./master-data-ui.js').then(({ createDefaultQualificationProfile }) =>
        createDefaultQualificationProfile(),
      ).then(() => this.render()).catch((err) => {
        this.message = `Failed to create qualification profile: ${err.message}`;
        this.render();
      });
      return;
    }
    const restraintId = event.target.closest('[data-empirical-restraint-select]')?.dataset.empiricalRestraintSelect;
    if (restraintId) {
      const occurrence = empiricalLoadCalcScenarioStore.getProposal()?.adaptedRequest?.restraintOccurrences
        ?.find((row) => row.restraintId === restraintId);
      const entityId = occurrence?.sourceEntityIds?.[0]
        || occurrence?.hostSourceEntityId
        || occurrence?.hostEntityId;
      if (entityId) this.eventBus.publish(EVENT_TOPICS.VIEWPORT_SELECTION_REQUESTED, { entityId, source: 'load-table' });
      return;
    }
    if (event.target.closest('[data-empirical-open-sjson-viewport]')) {
      this.pending3dInvestigationEntityId = null;
      this.activeTab = '3d';
      this.render();
      return;
    }
    if (event.target.closest('[data-empirical-clone-profile]')) {
      this.eventBus.publish(EMPIRICAL_LOAD_CALC_SCENARIO_EVENTS.CLONE_PROFILE_REQUESTED, {});
      return;
    }
    if (event.target.closest('[data-empirical-authorize]')) {
      this.message = 'Authorizing the current empirical scenario against the common seal…';
      this.eventBus.publish(EMPIRICAL_LOAD_CALC_SCENARIO_EVENTS.AUTHORIZE_REQUESTED, {});
      return;
    }
    if (event.target.closest('[data-empirical-calculate]')) {
      this.message = 'Executing the current common-seal-bound empirical method…';
      this.eventBus.publish(EMPIRICAL_LOAD_CALC_SCENARIO_EVENTS.CALCULATE_REQUESTED, {});
      return;
    }
    if (event.target.closest('[data-load-calc-run]')) {
      this.runCurrentCalculation();
      return;
    }

    if (event.target.closest('[data-seal-inputs]')) {
      this.message = 'Sealing common inputs…';
      try {
        const report = nonFeaCommonInputStore.getReport();
        sealCurrentNonFeaCommonInput({
          confirmationId: 'COMMON-SEAL:' + Date.now(),
          confirmedAt: new Date().toISOString(),
          confirmedBy: 'Verify & Run Fast Seal',
          acceptPartial: report?.packageState !== 'READY',
          acknowledgedBlockedMethods: report?.blockedMethodIds || [],
          statement: 'Sealed via Verify & Run fast-seal action.',
        });
        this.message = 'Inputs sealed successfully.';
      } catch (error) {
        this.message = error instanceof Error ? error.message : String(error);
      }
      this.render();
      return;
    }

    const gotoTab = event.target.closest('[data-goto-tab]')?.dataset.gotoTab;
    if (gotoTab) {
      this.pending3dInvestigationEntityId = null;
      this.selectTab(gotoTab);
      this.render();
      return;
    }
  }

  render() {
    if (this.activeTab !== '3d' && this.topologyEdit3DController) {
      this.topologyEdit3DController.deactivate();
      this.topologyEdit3DController = null;
      resetTopologyEditCleanShell(this.rootElement.ownerDocument);
    }
    this.renderRevision += 1;
    const revision = this.renderRevision;
    const authorizationState = engineeringModelStore.getEmpiricalAuthorizationState();
    const currentCommonInputExecution = engineeringModelStore.getCurrentCommonInputExecution();
    const topologyCheck = this.topologyCheck;
    const view = renderLoadCalcConsumer(this.rootElement.ownerDocument, {
      activeTab: this.activeTab,
      currentWorkflowStepId: this.currentWorkflowStepId,
      message: this.message,
      distribution: engineeringModelStore.getDistribution(),
      currentCommonInputExecution,
      authorizedExecution: engineeringModelStore.getAuthorizedExecution(),
      authorizationState,
      supportSiteModel: engineeringModelStore.getSupportSiteModel(),
      routePartitionModel: engineeringModelStore.getRoutePartitionModel(),
      empiricalScenarioState: empiricalLoadCalcScenarioStore.getSnapshot(),
      commonInputState: nonFeaCommonInputStore.getSnapshot(),
      workflowReadiness: createWorkflowReadiness(this.context, topologyCheck),
      topologyCheck,
    });
    this.rootElement.replaceChildren(view);
    const pane = view.querySelector('[data-load-calc-pane]');
    if (this.activeTab === 'loads') renderEngineeringLoadPane(
      pane,
      engineeringModelStore.getDistribution(),
      engineeringModelStore.getSupportSiteModel(),
      engineeringModelStore.getRoutePartitionModel(),
      engineeringModelStore.getAuthorizedExecution(),
      authorizationState,
      currentCommonInputExecution,
    );
    else this.renderDeferredPane(this.activeTab, pane, revision);
  }

  async renderDeferredPane(tab, pane, revision) {
    try {
      const empiricalState = {
        snapshot: empiricalLoadCalcScenarioStore.getSnapshot(),
        proposal: empiricalLoadCalcScenarioStore.getProposal(),
        authorization: empiricalLoadCalcScenarioStore.getAuthorization(),
        execution: empiricalLoadCalcScenarioStore.getExecution(),
        overlaySnapshot: empiricalResultOverlayStore.getSnapshot(),
        selectedEntityId: this.context?.selectedEntityId || null,
      };
      if (tab === 'verify' || !tab) {
        if (revision === this.renderRevision) this.renderVerifyPane(pane);
      } else if (tab === 'topology') {
        if (revision === this.renderRevision) renderLoadCalcTopologyPane(
          pane,
          engineeringModelStore.getSupportSiteModel(),
          engineeringModelStore.getRoutePartitionModel(),
          this.topologyCheck,
          this.topologyPolicyFeedback,
          this.topologySkipError,
        );
      } else if (EMPIRICAL_SCENARIO_VIEW_TABS.has(tab)) {
        const scenarioView = await import('./engineering-loads/empirical-load-calc-scenario-view.js');
        if (revision !== this.renderRevision) return;
        if (tab === 'overview') scenarioView.renderEmpiricalScenarioOverview(pane, empiricalState);
        else if (tab === 'restraints') scenarioView.renderEmpiricalScenarioRestraints(pane, empiricalState);
        else if (tab === 'load-cases') scenarioView.renderEmpiricalScenarioLoadCases(pane, empiricalState);
        else if (tab === 'methods') scenarioView.renderEmpiricalScenarioMethods(pane, empiricalState);
        else if (tab === 'results') scenarioView.renderEmpiricalScenarioResults(pane, empiricalState);
        else if (tab === 'evidence') scenarioView.renderEmpiricalScenarioEvidence(pane, empiricalState);
        else scenarioView.renderEmpiricalScenarioModel3d(pane, empiricalState);
      } else if (tab === 'preflight') {
        const { renderEmpiricalPreflightView } = await import('./empirical-preflight-view.js');
        if (revision === this.renderRevision) renderEmpiricalPreflightView(pane, this.context);
      } else if (tab === 'project-data') {
        const { renderProjectDataView } = await import('./project-data/project-data-view.js');
        if (revision === this.renderRevision) renderProjectDataView(pane, () => this.render());
      } else if (tab === 'masters') {
        const { renderMasterDataUI } = await import('./master-data-ui.js');
        if (revision === this.renderRevision) pane.replaceChildren(renderMasterDataUI(pane.ownerDocument));
      } else if (tab === 'enrichment') {
        const { renderNonFeaEnrichmentView, autoStageMasterProposals, autoAcceptClearWinnerFittingWeights } = await import('./enrichment/non-fea-enrichment-view.js');
        if (revision === this.renderRevision) {
          autoStageMasterProposals(() => this.render());
          const accepted = autoAcceptClearWinnerFittingWeights();
          renderNonFeaEnrichmentView(pane, () => this.render());
          if (accepted > 0) this.render();
        }
      } else if (tab === 'method-basis') {
        const { renderNonFeaMethodBasisView } = await import('./non-fea-method-basis-view.js');
        if (revision === this.renderRevision) renderNonFeaMethodBasisView(pane, () => this.render());
      } else if (tab === 'seal-export') {
        const { renderNonFeaSealExportView } = await import('./non-fea-seal-export-view.js');
        if (revision === this.renderRevision) renderNonFeaSealExportView(pane, () => this.render());
      } else if (tab === 'json-trace') {
        const { renderJsonTraceUI } = await import('./json-trace-ui.js');
        if (revision === this.renderRevision) pane.replaceChildren(renderJsonTraceUI(pane.ownerDocument));
      } else if (tab === '3d') {
        const { TopologyEdit3DViewController } = await import('./topology-edit-3d-sjson-fidelity-controller.js');
        if (revision !== this.renderRevision) return;
        if (!this.topologyEdit3DController?.hostElement) {
          resetTopologyEditCleanShell(this.rootElement.ownerDocument);
          const controller = new TopologyEdit3DViewController(this.eventBus);
          this.topologyEdit3DController = controller;
          controller.setHighConfidenceGapToleranceMm(
            this.topologyGapAutofixToleranceMm,
          );
          await controller.activate();
          if (revision !== this.renderRevision) {
            const stillCurrent3D = this.activeTab === '3d'
              && this.topologyEdit3DController === controller;
            if (!stillCurrent3D) {
              controller.deactivate();
              if (this.topologyEdit3DController === controller) {
                this.topologyEdit3DController = null;
              }
              resetTopologyEditCleanShell(this.rootElement.ownerDocument);
            }
            return;
          }
        }
        if (revision === this.renderRevision) {
          const overlaySnapshot = empiricalResultOverlayStore.getSnapshot();
          this.topologyEdit3DController.viewportBackend?.setGovernedResultProjection(
            empiricalResultOverlayStore.getProjection(),
            overlaySnapshot.reasonCode || 'EMPIRICAL_EXECUTION_REQUIRED',
          );
          this.topologyEdit3DController.renderPane(pane);
          const entityId = this.pending3dInvestigationEntityId;
          this.pending3dInvestigationEntityId = null;
          if (entityId) {
            const focus = this.topologyEdit3DController.focusWorkspaceEntity?.(entityId);
            if (focus && focus.status !== 'FOCUSED') {
              this.message = `3D investigation target ${entityId} is not available in the current governed render projection.`;
            }
          }
          if (this.pendingCertifiedTopologyAutofix) {
            this.pendingCertifiedTopologyAutofix = false;
            const result = this.topologyEdit3DController.applyHighConfidenceGapFixes(
              this.topologyGapAutofixToleranceMm,
            );
            this.message = result
              ? `Certified TopoFix prepared ${result.applied.length} gap merge(s) in the 3D draft. Review and Commit draft to update the workspace.`
              : 'Certified TopoFix could not prepare a draft; review the 3D checker status.';
            const output = this.rootElement.querySelector('[data-engineering-load-status]');
            if (output) output.textContent = this.message;
          }
        }
      } else {
        throw new RangeError(`Unknown Load Calc tab: ${tab}.`);
      }
    } catch (error) {
      if (revision === this.renderRevision) pane.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  renderVerifyPane(container) {
    const authState = engineeringModelStore.getEmpiricalAuthorizationState();
    const commonState = nonFeaCommonInputStore.getSnapshot();
    const scenarioState = empiricalLoadCalcScenarioStore.getSnapshot();
    const freshProfile = projectDataStore.getProfile();
    const routineRunReady = isRoutineRunReady(commonState);

    // Gate statuses
    const datasetOk  = Boolean(this.context?.datasetId);
    const sealOk     = !!(commonState?.commonInput && !commonState?.staleness?.stale);
    const effectiveSealOk = sealOk || routineRunReady;
    const authOk     = !!(scenarioState?.calculationEligible || routineRunReady);

    // Human-readable status detail (P0: no raw enum codes shown to users)
    const sealDetail = sealOk ? 'Inputs sealed ✓' : routineRunReady
      ? 'READY validation will be sealed automatically when Run is selected'
      : (commonState?.commonInput ? 'Seal is stale — changes were made after sealing' : 'Validate inputs to READY; Run will seal automatically');
    const authDetail = scenarioState?.calculationEligible
      ? 'Scenario authorization current ✓'
      : routineRunReady
        ? 'Routine system Run authority will be created at execution ✓'
        : 'A fully READY current Common Input is required';

    // Loads field audit — read current values from fresh profile
    const lc = freshProfile?.loadCalculation || {};
    const su = freshProfile?.sourcesAndUnits || {};

    function fieldVal(group, key) {
      const entry = (group === 'lc' ? lc : su)[key];
      return entry?.value ?? null;
    }
    const gravitySet   = fieldVal('lc', 'gravityMPerS2') !== null;
    const factorSet    = fieldVal('lc', 'loadFactor') !== null && fieldVal('lc', 'loadFactor') > 0;
    const equilSet     = fieldVal('lc', 'equilibriumTolerances') !== null;
    const casesSet     = Array.isArray(fieldVal('lc', 'activeLoadCases')) && fieldVal('lc', 'activeLoadCases').length > 0;

    const pipeSectSet  = fieldVal('lc', 'pipeSectionProperties') !== null;
    const matDensSet   = fieldVal('lc', 'materialDensitiesKgPerM3') !== null;
    const opFluidSet   = fieldVal('lc', 'operatingFluidDensitiesKgPerM3') !== null;
    const hydFluidSet  = fieldVal('lc', 'hydroFluidDensitiesKgPerM3') !== null;
    const insulSet     = fieldVal('lc', 'insulationDensitiesKgPerM3') !== null;
    const compWtSet    = fieldVal('lc', 'componentWeightsKg') !== null;
    const lineListSet  = fieldVal('su', 'lineListSource') !== null;
    const pipClassSet  = fieldVal('su', 'pipingClassSource') !== null;
    const compSrcSet   = fieldVal('su', 'componentWeightSource') !== null;

    // The raw-field checks above predate the #1321 effective-value/default
    // ledger: they only see literal Project Data values, never Product/Project
    // defaults or ledger-resolved targets. A READY Common Input or an eligible
    // explicit legacy package proves those fields were resolved by the governed
    // authority path, so raw emptiness must not be reintroduced as a UI blocker.
    const ledgerAuthorized = routineRunReady || authState?.calculationEligible === true;

    const allSafeSet       = (gravitySet && factorSet && equilSet && casesSet) || ledgerAuthorized;
    const masterFieldsSet  = (pipeSectSet && matDensSet && opFluidSet && hydFluidSet && insulSet && compWtSet) || ledgerAuthorized;
    const sourceFieldsSet  = (lineListSet && pipClassSet && compSrcSet) || ledgerAuthorized;

    // Count blockers for the loads gate
    const rawLoadsBlockerCount = [gravitySet, factorSet, equilSet, casesSet, pipeSectSet, matDensSet,
      opFluidSet, hydFluidSet, insulSet, compWtSet, lineListSet, pipClassSet, compSrcSet
    ].filter((v) => !v).length;
    const loadsBlockerCount = ledgerAuthorized ? 0 : rawLoadsBlockerCount;
    const loadsOk = loadsBlockerCount === 0;

    const esc = (val) => String(val ?? '').replace(/[&<>'"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);

    // Renders a field's status: the raw value when present, a distinct
    // ledger-resolved note when the authorized path filled it via governed
    // defaults instead, or the original missing/blocked copy otherwise. This
    // never lets default/ledger evidence masquerade as raw source evidence.
    function fieldStatus(rawOk, rawLabel, missingLabel) {
      if (rawOk) return rawLabel;
      if (ledgerAuthorized) return '<em>resolved via effective-value ledger</em>';
      return missingLabel;
    }

    function gate(ok, label, detail, actionHtml = '') {
      return `<li class="verify-gate" data-status="${ok ? 'ok' : 'fail'}">
        <span class="verify-gate__icon">${ok ? '✅' : '❌'}</span>
        <span class="verify-gate__label">${esc(label)}</span>
        <span class="verify-gate__detail">${esc(detail)}</span>
        ${actionHtml}
      </li>`;
    }

    const sealBtn = !sealOk && !routineRunReady
      ? `<button class="verify-gate__action" data-seal-inputs title="Optional explicit audit seal">→ Seal for audit</button>`
      : '';

    const loadsDetail = loadsOk
      ? (ledgerAuthorized && rawLoadsBlockerCount > 0
        ? `Ready — effective-value ledger resolved ${rawLoadsBlockerCount} field${rawLoadsBlockerCount > 1 ? 's' : ''} via governed defaults`
        : 'All 13 fields ready')
      : `${loadsBlockerCount} field${loadsBlockerCount > 1 ? 's' : ''} need values`;
  
    container.innerHTML = `
      <div class="verify-run-pane">
        <div class="verify-layout">
  
          <!-- LEFT: Gates -->
          <div class="verify-gates-col">
            <div class="verify-section-header">
              <h2>Readiness Gates</h2>
              <span class="verify-progress" data-ok="${loadsOk && effectiveSealOk && authOk}">
                ${[datasetOk, loadsOk, effectiveSealOk, authOk].filter(Boolean).length} / 4 passing
              </span>
            </div>
            <ul class="verify-checklist">
              ${gate(datasetOk, 'Dataset', datasetOk ? 'SJSON active' : 'No dataset loaded')}
              ${gate(loadsOk, 'Load calc fields', loadsDetail,
                !loadsOk && !allSafeSet
                  ? '<button class="verify-gate__action verify-gate__action--primary" data-goto-tab="project-data">→ Open Project Data</button>'
                  : (!loadsOk ? '<button class="verify-gate__action verify-gate__action--secondary" data-goto-tab="masters">→ Open Masters</button>' : '')
              )}
              ${gate(effectiveSealOk, 'Common seal', sealDetail, sealBtn)}
              ${gate(authOk, 'Run authority', authDetail)}
            </ul>
            <p class="engineering-note">Results publish Fv / Fl(guide) / Fa(lineStop) per restraint after calculation.</p>
          </div>
  
          <!-- RIGHT: Quick-fix panel -->
          <div class="verify-quickfix-col">
  
            <!-- Safe defaults card -->
            <div class="verify-card ${allSafeSet ? 'verify-card--ok' : 'verify-card--warn'}">
              <div class="verify-card__header">
                <span>${allSafeSet ? '✅' : '⚠'} Project and method basis</span>
                <span class="verify-card__subtitle">${allSafeSet ? 'Approved values loaded' : 'Configuration required'}</span>
              </div>
              <dl class="verify-defaults-dl">
                <dt>Gravity</dt><dd>${fieldStatus(gravitySet, `${esc(fieldVal('lc', 'gravityMPerS2'))} m/s²`, '<em>empty</em>')}</dd>
                <dt>Load factor</dt><dd>${fieldStatus(factorSet, fieldVal('lc','loadFactor') + ' (ratio)', '<em>0 — invalid</em>')}</dd>
                <dt>Equilibrium tolerances</dt><dd>${fieldStatus(equilSet, esc(JSON.stringify(fieldVal('lc', 'equilibriumTolerances'))), '<em>missing</em>')}</dd>
                <dt>Active load cases</dt><dd>${fieldStatus(casesSet, esc(JSON.stringify(fieldVal('lc','activeLoadCases'))), '<em>missing</em>')}</dd>
              </dl>
              ${!allSafeSet ? '<p class="engineering-note">Configure and approve the missing project-owned values in Project Data.</p>' : ''}
            </div>
  
            <!-- Master-dependent fields card -->
            <div class="verify-card verify-card--info" style="margin-top:12px">
              <div class="verify-card__header">
                <span>${masterFieldsSet ? '✅' : '📋'} Master-dependent fields</span>
                <span class="verify-card__subtitle">Must come from master data</span>
              </div>
              <dl class="verify-defaults-dl">
                <dt>Pipe section properties</dt><dd>${fieldStatus(pipeSectSet, '✓ Set', '<em>missing</em>')}</dd>
                <dt>Material densities</dt><dd>${fieldStatus(matDensSet, '✓ Set', '<em>missing</em>')}</dd>
                <dt>Operating fluid densities</dt><dd>${fieldStatus(opFluidSet, '✓ Set', '<em>missing</em>')}</dd>
                <dt>Hydro fluid densities</dt><dd>${fieldStatus(hydFluidSet, '✓ Set', '<em>missing</em>')}</dd>
                <dt>Insulation densities</dt><dd>${fieldStatus(insulSet, '✓ Set', '<em>missing</em>')}</dd>
                <dt>Component weights</dt><dd>${fieldStatus(compWtSet, '✓ Set', '<em>missing</em>')}</dd>
              </dl>
              ${!masterFieldsSet ? '<button class="verify-gate__action verify-gate__action--secondary" style="width:100%;margin-top:8px" data-goto-tab="masters">→ Open Masters tab</button>' : ''}
            </div>

            <!-- Source fields card -->
            <div class="verify-card verify-card--info" style="margin-top:12px">
              <div class="verify-card__header">
                <span>${sourceFieldsSet ? '✅' : '🔗'} Source bindings</span>
                <span class="verify-card__subtitle">Auto-resolve when masters are loaded</span>
              </div>
              <dl class="verify-defaults-dl">
                <dt>Line-list source</dt><dd>${fieldStatus(lineListSet, '✓ Bound', '<em>not bound</em>')}</dd>
                <dt>Piping-class source</dt><dd>${fieldStatus(pipClassSet, '✓ Bound', '<em>not bound</em>')}</dd>
                <dt>Component-weight source</dt><dd>${fieldStatus(compSrcSet, '✓ Bound', '<em>not bound</em>')}</dd>
              </dl>
            </div>

            <!-- Checker status badge — links to the full Input Check view (Step 6) -->
            ${checkerStatusBadge(commonState)}

          </div>
        </div>
      </div>
    `;
  }

  getReviewModel() {
    return this.reviewModel && validateLoadCalculationReviewModel(this.reviewModel).ok ? this.reviewModel : null;
  }

  destroy() {
    this.topologyEdit3DController?.deactivate();
    this.topologyEdit3DController = null;
    this.pending3dInvestigationEntityId = null;
    resetTopologyEditCleanShell(this.rootElement.ownerDocument);
    this.rootElement.removeEventListener('click', this.clickHandler);
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    this.rootElement.replaceChildren();
    this.context = null;
    this.reviewModel = null;
  }
}

/**
 * Projects read-only progress for the guided UI. It never supplies missing
 * values or changes the stores that own engineering readiness and authority.
 */
function createWorkflowReadiness(context, topologyCheck) {
  const supportSites = engineeringModelStore.getSupportSiteModel();
  const routes = engineeringModelStore.getRoutePartitionModel();
  const distribution = engineeringModelStore.getDistribution();
  const commonInput = nonFeaCommonInputStore.getSnapshot();
  const topologyReady = supportSites?.status === 'READY' && routes?.status === 'READY';
  const topologyBlockerCount = (supportSites?.blockers?.length || 0)
    + (routes?.blockers?.length || 0)
    + (topologyCheck?.blockingIssueCount || 0);
  // null-hash check: used only as pre-checker fallback when projection not yet available
  const projectDataCheck = validateProjectDataProfile(
    projectDataStore.getProfile(),
    'loadCalcProjectBasis',
    null,
  );
  const masterDataAudit = requiredMastersAudit(masterDataController.getMasterData());
  const validationEvaluated = Boolean(commonInput.report);
  const validationBlockerCount = validationEvaluated ? safeValidationBlockerCount() : 0;

  // Use live projection (real hashes) so STALE_SOURCE_HASH is correctly detected.
  // projectDataActionCount feeds workflowStepState (legacy renderer) directly on the
  // active tab — it MUST be accurate here; a DOM post-patch is wiped on next re-render.
  const pdBlockerCodes = validationEvaluated ? safeProjectionPdBlockerCodes() : [];
  const pdBlockerCount = validationEvaluated
    ? safePdBlockerCount()                    // raw (non-deduped) PD blocker count
    : projectDataCheck.errors.length;         // pre-checker fallback

  return Object.freeze({
    datasetReady: Boolean(context?.datasetId),
    topologyBlockerCount,
    topologyOpenReviewCount: topologyCheck?.reviewIssueCount || 0,
    topologySkippedCount: topologyCheck?.skippedIssueCount || 0,
    topologyReviewIssueCount: (topologyCheck?.reviewIssueCount || 0)
      + (topologyCheck?.skippedIssueCount || 0),
    topologyCheckReady: topologyReady
      && topologyBlockerCount === 0
      && topologyCheck?.state !== 'NOT_AVAILABLE',
    projectDataReady: pdBlockerCodes.length === 0 && projectDataCheck.valid,
    projectDataActionCount: pdBlockerCount,
    projectDataBlockerCodes: pdBlockerCodes,
    masterDataReady: masterDataAudit.ready,
    masterDataActionCount: masterDataAudit.missingCount,
    enrichmentUnresolvedCount: validationEvaluated ? safeEnrichmentUnresolvedCount() : null,
    validationReady: commonInput.report?.packageState === 'READY',
    validationState: commonInput.report?.packageState || 'NOT_EVALUATED',
    validationEvaluated,
    validationBlockerCount,
    resultsCurrent: distribution?.freshness?.status === 'CURRENT',
  });
}

function pendingTopologyCheck(context) {
  const datasetLoaded = Boolean(context?.datasetId);
  return topologyCheckPlaceholder(
    datasetLoaded ? 'TOPOLOGY_CHECK_PENDING' : 'TOPOLOGY_DATASET_UNAVAILABLE',
    datasetLoaded
      ? 'Checking the current committed canonical topology…'
      : 'Import a dataset before checking topology.',
    datasetLoaded ? 'PENDING' : 'NOT_AVAILABLE',
  );
}

function failedTopologyCheck(context, message) {
  return topologyCheckPlaceholder(
    'TOPOLOGY_CHECK_FAILED',
    message || `Topology check failed for dataset ${context?.datasetId || 'NOT_AVAILABLE'}.`,
    'BLOCKED',
  );
}

function topologyCheckPlaceholder(kind, message, state) {
  const finding = Object.freeze({
    id: `system:${kind}`,
    kind,
    severity: 'HIGH',
    disposition: 'BLOCK',
    message,
    nodeIds: Object.freeze([]),
    edgeIds: Object.freeze([]),
    suggestedAutofix: null,
    distanceMm: null,
    sourceScope: Object.freeze({
      entityIds: Object.freeze([]),
      branchIds: Object.freeze([]),
      lineKeys: Object.freeze([]),
    }),
  });
  return Object.freeze({
    state,
    issueCount: 1,
    blockingIssueCount: 1,
    reviewIssueCount: 0,
    issues: Object.freeze([]),
    findings: Object.freeze([finding]),
    blockingFindings: Object.freeze([finding]),
    reviewFindings: Object.freeze([]),
    countsByKind: Object.freeze({ [kind]: 1 }),
    countsBySeverity: Object.freeze({ HIGH: 1 }),
    autoFix: Object.freeze({
      certifiedExactGapCount: 0,
      reviewOnlyNearGapCount: 0,
      exactGapIssueIds: Object.freeze([]),
      nearGapIssueIds: Object.freeze([]),
    }),
  });
}

/** Never lets a status-projection failure hide the rest of the guided workflow. */
function safeValidationBlockerCount() {
  try {
    return createCurrentNonFeaWorkspaceStatusProjection()?.blockers?.length || 0;
  } catch {
    return 0;
  }
}

/**
 * Project-data blocker codes from the live status projection (uses real
 * authority hashes — catches STALE_SOURCE_HASH that validateProjectDataProfile
 * with null hashes misses). Returns [] on any error so badge degrades gracefully.
 */
const PD_BLOCKER_CODES = new Set([
  'MISSING_VALUE', 'STALE_SOURCE_HASH', 'GRAVITY_BASIS_REQUIRED',
  'ACTIVE_LOAD_CASES_REQUIRED', 'CONFIGURED_DEFAULT_LEDGER_STALE',
  'NOT_APPROVED', 'MISSING_EVIDENCE',
]);
function safeProjectionPdBlockerCodes() {
  try {
    const projection = createCurrentNonFeaWorkspaceStatusProjection();
    return [...new Set(
      (projection?.blockers ?? [])
        .map((b) => b.code)
        .filter((c) => PD_BLOCKER_CODES.has(c)),
    )];
  } catch {
    return [];
  }
}

/** Raw (non-deduplicated) count of PD blocker entries from the live projection.
 *  Used as projectDataActionCount so the legacy renderer shows the correct number. */
function safePdBlockerCount() {
  try {
    const projection = createCurrentNonFeaWorkspaceStatusProjection();
    return (projection?.blockers ?? []).filter((b) => PD_BLOCKER_CODES.has(b.code)).length;
  } catch {
    return 0;
  }
}

/**
 * Count distinct unresolved entity IDs for MASS_COVERAGE from the live projection.
 * Each missing token is "entityId:FIELD" — distinct entityIds gives the entity count.
 * Returns null when coverage is clear or the projection is unavailable.
 */
function safeEnrichmentUnresolvedCount() {
  try {
    const projection = createCurrentNonFeaWorkspaceStatusProjection();
    const entityIds = new Set();
    for (const method of (projection?.methodRows ?? [])) {
      for (const req of (method.coverageRequirements ?? [])) {
        if (req.code !== 'MASS_COVERAGE_INCOMPLETE') continue;
        for (const token of (req.missing ?? [])) {
          const entityId = typeof token === 'string' ? token.split(':')[0] : token?.entityId;
          if (entityId) entityIds.add(entityId);
        }
      }
    }
    return entityIds.size > 0 ? entityIds.size : null;
  } catch {
    return null;
  }
}

function requiredMastersAudit(masters) {
  const missingCount = [masters?.lineList, masters?.pipingClass, masters?.weight].filter((master) => !(
    Array.isArray(master?.normalizedRows)
    && master.normalizedRows.length > 0
    && typeof master.sourceHash === 'string'
    && master.sourceHash.length > 0
  )).length;
  return { ready: missingCount === 0, missingCount };
}

/** Preserves the prior public W10.9 readiness contract. */
export function createLoadCalcActionAvailability(context, reviewModel) {
  const contracts = context?.contracts || {};
  const hasModelLoads = Boolean(reviewModel);
  const canRebuildModelLoads = Boolean(contracts.topologyGraph);
  const hasPathInputs = Boolean(hasModelLoads && contracts.sharedModel && contracts.topologyGraph && contracts.supportAttachmentModel && contracts.restraintCapabilityModel);
  const hasPathModel = Boolean(hasModelLoads && contracts.verticalLoadPathModel);
  return Object.freeze({
    rebuildModelLoads: canRebuildModelLoads,
    exportModelLoads: hasModelLoads,
    rebuildPaths: hasPathInputs,
    runScreening: hasPathModel,
    exportScreening: Boolean(reviewModel?.summary.screeningIncluded),
  });
}

/**
 * Reports an authority change against what actually exists.
 *
 * Announcing that the seal, authorization and previous calculations need a
 * refresh reads as breakage when none of them were ever established, which is
 * the normal state while a dataset is still being prepared. Only work that
 * exists is named as invalidated.
 */
function authorityChangeMessage(subject) {
  const invalidated = [];
  try {
    if (nonFeaCommonInputStore.getSnapshot().commonInput) invalidated.push('the common seal');
    const authState = engineeringModelStore.getEmpiricalAuthorizationState();
    if (authState?.authorization || authState?.authorized) invalidated.push('authorization');
    if (engineeringModelStore.getDistribution()) invalidated.push('previous calculations');
  } catch {
    return `${subject} changed.`;
  }
  return invalidated.length === 0
    ? `${subject} changed. Nothing is sealed or calculated yet, so there is nothing to refresh.`
    : `${subject} changed; ${invalidated.join(', ')} require refresh.`;
}

function availabilityMessage(state) {
  const reason = state?.reasonCode || state?.state || 'EMPIRICAL_PACKAGE_REQUIRED';
  const messages = {
    NO_ACTIVE_DATASET: 'Load calculation requires an active normalized dataset.',
    EMPIRICAL_PACKAGE_REQUIRED: 'Load calculation requires an explicitly authorized empirical package.',
    AUTHORIZATION_BINDINGS_CHANGED: 'The authorized empirical package is stale; authorize a package for the current dataset and evidence.',
    PROJECT_DATA_CHANGED: 'Project Data changed; a new common seal and authorized empirical package are required.',
    MASTER_DATA_CHANGED: 'Master data changed; a new common seal and authorized empirical package are required.',
    DATASET_EDITED: 'The dataset changed; a new common seal and authorized empirical package are required.',
    DATASET_REBUILT: 'The dataset model was rebuilt; a new common seal and authorized empirical package are required.',
    DATASET_REPLACED: 'The active dataset changed; a new common seal and authorized empirical package are required.',
    COMMON_INPUT_REQUIRED: 'A current common enriched piping input seal is required.',
    COMMON_INPUT_STALE: 'The common enriched piping input seal is stale.',
    COMMON_INPUT_METHOD_NOT_READY: 'The common input is not sealed for the requested empirical method.',
  };
  return messages[reason] || `Load calculation is disabled: ${reason}.`;
}

function empiricalScenarioMessage(snapshot) {
  const messages = {
    NOT_CONFIGURED: 'Configure an empirical scenario before authorization.',
    DRAFT_BLOCKED: 'Empirical scenario is blocked; review the Overview and Evidence panes.',
    DRAFT_READY: 'Empirical scenario is ready for common-seal-bound authorization.',
    AUTHORIZED_CURRENT: 'Empirical scenario is authorized against the current common seal.',
    AUTHORIZED_STALE: 'Empirical scenario authorization is stale.',
    EXECUTED_CURRENT: 'Empirical method execution is current and common-seal-bound.',
    EXECUTED_STALE: 'Empirical method results are stale and are not current overlays.',
  };
  return messages[snapshot?.state] || '';
}

function resetTopologyEditCleanShell(documentRef) {
  const host = documentRef?.querySelector('[data-role="topology-edit-render-host"]');
  if (!host) return;
  const mountedWorkspace = host.querySelector('[data-role="topology-edit-workspace"]');
  if (mountedWorkspace?.isConnected) return;
  delete host.dataset.topologyEditCleanShell;
  host.classList.remove('topology-edit-clean-shell');
}

function downloadJson(documentRef, fileName, value) {
  const windowRef = documentRef?.defaultView;
  if (!windowRef?.Blob || !windowRef?.URL?.createObjectURL) {
    throw new Error('Browser download services are unavailable.');
  }
  const url = windowRef.URL.createObjectURL(new windowRef.Blob(
    [JSON.stringify(value, null, 2)],
    { type: 'application/json;charset=utf-8' },
  ));
  const anchor = documentRef.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  windowRef.URL.revokeObjectURL(url);
}

/**
 * Compact checker status badge rendered inside the Verify pane.
 * Shows BLOCKED / READY state + first blocker cause + a link to the full
 * Input Check view (Step 6) where all root-cause detail lives.
 *
 * Presentation only: no authority, seal, store, or engineering logic is touched.
 */
function checkerStatusBadge(commonState) {
  const report = commonState?.report;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const ready = !report || report.packageState === 'READY';
  if (ready) return '';

  // Collect unique cause codes from method rows (de-duped across methods)
  const causeCodes = [...new Set(
    (report.methodRows || []).flatMap((row) => (row.blockers || []).map((b) => b.code)).filter(Boolean),
  )].slice(0, 3);

  const blockerCount = (report.methodRows || []).reduce((sum, row) => sum + (row.blockers || []).length, 0);

  return `<div class="verify-card verify-card--warn" style="margin-top:12px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
    <div>
      <strong style="color:#fca5a5">❌ BLOCKED — ${blockerCount} checker issue${blockerCount === 1 ? '' : 's'}</strong>
      ${causeCodes.length ? `<div style="margin-top:4px;font-size:11px;color:#94a3b8">${causeCodes.map(esc).join(' · ')}</div>` : ''}
    </div>
    <button type="button" class="verify-gate__action verify-gate__action--secondary" data-load-calc-tab="verify" style="white-space:nowrap">
      Open Input Check →
    </button>
  </div>`;
}

function buildReviewModel(context) {
  const contracts = context?.contracts || {};
  if (!context || !contracts.sharedModel || !contracts.loadCaseSet || !contracts.loadPrimitiveSet || !contracts.modelLoadReadinessAudit) return null;
  try { return createLoadCalculationReviewModel(context); } catch { return null; }
}
