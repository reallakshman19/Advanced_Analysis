/** DOM view for the independent guided LAFEA workbench.
 * EMP.1 is the public analytical product. Its retained A/B mechanics continue
 * to execute through LAFEA.1/LAFEA.2 backing stages; LAFEA.3+ remain FEA routes.
 */
import {
  LAFEA_STAGE_REGISTRY,
  lafeaRegisteredExecutionSupported,
  requireLafeaStageRegistryEntry,
} from './lafea-stage-registry.js';
import {
  actionButton,
  captureFocusedControl,
  element,
  restoreFocusedControl,
} from './lafea-workbench-dom.js';
import { renderLafeaWorkbenchContent } from './lafea-workbench-content.js';
import { renderLafeaAnalyticalCalcContent } from './lafea-analytical-calc-content.js';
import {
  EMP1_PUBLIC_PRODUCT,
  buildEmp1ProductProjection,
  emp1StepForBackingStage,
  isEmp1BackingStage,
} from './emp1-product-projection.js';
import {
  classifyEmp1WorkbenchExecutionCurrentness,
  projectEmp1WorkbenchCState,
  projectEmp1WorkbenchRunReadiness,
} from './emp1-workbench-run-state.js';
import {
  EMP1_ASSESSMENT_ACTIONS,
  projectEmp1AssessmentState,
} from './emp1-assessment-state.js';
import { finalizeEmp1Presentation } from './emp1-presentation-finalizer.js';
import {
  lafeaWorkbenchReasonLabel,
  lafeaWorkbenchReasonLabels,
} from './lafea-workbench-reason-labels.js';
import {
  canReuseLafeaWorkbenchViewport,
  createLafeaWorkbenchViewportDependencies,
} from './lafea-workbench-viewport-lifecycle.js';
import { revealLafeaGuidedTarget } from './lafea-workbench-evidence.js';
import { hasLafeaDemoModel } from './lafea-demo-catalog.js';

const VIEW_RENDER_DEPENDENCIES = new WeakMap();
const DEFAULT_ANALYTICAL_CALC_STAGE_ID = 'LAFEA.1';
const PRESENTATION_STAGE = 'STAGE';
const PRESENTATION_ANALYTICAL = 'ANALYTICAL_CALC';

export class LafeaWorkbenchView {
  constructor(rootElement, options = {}) {
    this.rootElement = rootElement;
    VIEW_RENDER_DEPENDENCIES.set(this, Object.freeze({
      getRenderPacket: typeof options.getRenderPacket === 'function'
        ? options.getRenderPacket
        : () => null,
      getEmp1RunInput: typeof options.getEmp1RunInput === 'function'
        ? options.getEmp1RunInput
        : () => null,
      getEmp1Execution: typeof options.getEmp1Execution === 'function'
        ? options.getEmp1Execution
        : () => null,
      getEmp1RunFailure: typeof options.getEmp1RunFailure === 'function'
        ? options.getEmp1RunFailure
        : () => null,
      getEmp1RouteAuthority: typeof options.getEmp1RouteAuthority === 'function'
        ? options.getEmp1RouteAuthority
        : () => null,
      THREE: options.THREE ?? null,
    }));
    this.handlers = null;
    this.benchmarkHost = null;
    this.section = null;
    this.slots = null;
    this.presentationMode = options.presentationMode === PRESENTATION_ANALYTICAL
      ? PRESENTATION_ANALYTICAL
      : PRESENTATION_STAGE;
    this.analyticalOnly = Boolean(options.analyticalOnly || options.presentationMode === PRESENTATION_ANALYTICAL);
    this.lastState = null;
    this.activeViewport = null;
    this.activeViewportElement = null;
    this.activeViewportDependencies = null;
    this.sceneDocuments = new Map();
    this.sceneLifecycles = new Map();
    this.sceneLifecycleBindings = new Map();
    this.sceneRevisions = new Map();
    this.sceneSelections = new Map();
    this.sceneMeshFocus = new Map();
  }

  setBenchmarkHost(hostElement) { this.benchmarkHost = hostElement; }
  init(handlers) { this.handlers = handlers; }

  revealTarget(targetName) {
    const target = this.rootElement?.querySelector(`[data-guided-target="${targetName}"]`);
    return revealLafeaGuidedTarget(target);
  }

  render(state) {
    if (!this.rootElement || !this.handlers) return;
    if (this.analyticalOnly || isAnalyticalStage(state.activeStageId)) {
      this.presentationMode = PRESENTATION_ANALYTICAL;
    } else if (this.presentationMode === PRESENTATION_ANALYTICAL) {
      this.presentationMode = PRESENTATION_STAGE;
    }
    this.lastState = state;
    const focused = captureFocusedControl(this.rootElement);
    const stageId = state.activeStageId;
    const stage = state.stages[stageId];
    const registryEntry = requireLafeaStageRegistryEntry(stageId);
    const analyticalMode = this.presentationMode === PRESENTATION_ANALYTICAL;
    const fePresentation = !analyticalMode;
    const dependencies = VIEW_RENDER_DEPENDENCIES.get(this);
    const emp1RunInput = analyticalMode ? dependencies.getEmp1RunInput() : null;
    const emp1Execution = analyticalMode ? dependencies.getEmp1Execution() : null;
    const emp1RunFailure = analyticalMode ? dependencies.getEmp1RunFailure() : null;
    const emp1RouteAuthority = analyticalMode ? dependencies.getEmp1RouteAuthority() : null;
    const emp1ExecutionCurrentness = analyticalMode
      ? classifyEmp1WorkbenchExecutionCurrentness({
        execution: emp1Execution,
        aDocument: state.stages?.['LAFEA.1']?.document,
        bDocument: state.stages?.['LAFEA.2']?.document,
        runInput: emp1RunInput,
        currentRouteAuthority: emp1RouteAuthority,
      })
      : null;
    const emp1RunReadiness = analyticalMode
      ? projectEmp1WorkbenchRunReadiness({
        aDocument: state.stages?.['LAFEA.1']?.document,
        bDocument: state.stages?.['LAFEA.2']?.document,
        runInput: emp1RunInput,
      })
      : null;
    const emp1CState = analyticalMode
      ? projectEmp1WorkbenchCState({
        readiness: emp1RunReadiness,
        execution: emp1Execution,
        currentness: emp1ExecutionCurrentness,
        routeAuthority: emp1RouteAuthority,
      })
      : null;
    const analyticalState = analyticalMode
      ? withCurrentEmp1StageExecutions(state, emp1Execution, emp1ExecutionCurrentness)
      : state;
    const baseEmp1Projection = analyticalMode
      ? buildEmp1ProductProjection(analyticalState, {
        workspaceExecutionWired: true,
        workspaceResultAvailable: emp1CState?.currentResultAvailable === true,
      })
      : null;
    const emp1Projection = analyticalMode
      ? withEmp1CStateProjection(baseEmp1Projection, emp1CState)
      : null;
    const emp1AssessmentState = analyticalMode
      ? projectEmp1AssessmentState({
        state: analyticalState,
        projection: emp1Projection,
        runReadiness: emp1RunReadiness,
        executionCurrentness: emp1ExecutionCurrentness,
        cState: emp1CState,
        runFailure: emp1RunFailure,
        runInput: emp1RunInput,
      })
      : null;
    const presentedEmp1Projection = analyticalMode
      ? Object.freeze({ ...emp1Projection, presentationState: emp1AssessmentState })
      : null;
    const renderPacket = fePresentation ? dependencies.getRenderPacket(stageId) : null;
    const sceneRevision = fePresentation
      ? this.nextSceneRevision(stageId, stage.document, stage.lifecycle, stage.lifecycleBinding)
      : 0;
    const viewportDependencies = fePresentation
      ? createLafeaWorkbenchViewportDependencies({ stageId, stage, sceneRevision, renderPacket })
      : null;
    const reuseViewport = fePresentation
      && Boolean(this.activeViewport && this.activeViewportElement)
      && canReuseLafeaWorkbenchViewport(this.activeViewportDependencies, viewportDependencies);
    const previousViewport = this.activeViewport;

    this.ensureShell();
    this.slots.header.replaceChildren(this.header(state, stage, registryEntry, {
      analyticalMode,
      emp1AssessmentState,
    }));
    this.slots.navigation.replaceChildren(this.stageNavigation(state));
    this.slots.toolbar.replaceChildren(this.toolbar(stageId, stage, analyticalMode, {
      workspaceState: state,
      emp1RunReadiness,
      emp1ExecutionCurrentness,
      emp1CState,
      emp1AssessmentState,
    }));

    const presentedStage = analyticalMode ? analyticalState.stages[stageId] : stage;
    const content = analyticalMode
      ? renderLafeaAnalyticalCalcContent(this.rootElement, analyticalState, presentedStage, {
        handlers: this.handlers,
        registryEntry,
        emp1Projection: presentedEmp1Projection,
        emp1RunInput,
        emp1Execution,
        emp1ExecutionCurrentness,
        emp1CState,
        emp1RouteAuthority,
        emp1RunFailure,
        onSelectRoute: (nextStageId) => this.selectAnalyticalRoute(nextStageId, state),
        benchmarkHost: this.benchmarkHost,
      })
      : renderLafeaWorkbenchContent(this.rootElement, state, stage, {
        handlers: this.handlers,
        registryEntry,
        renderPacket,
        THREE: dependencies.THREE,
        sceneRevision,
        reusedViewport: reuseViewport ? { viewport: this.activeViewport, element: this.activeViewportElement } : null,
        selection: this.sceneSelections.get(stageId),
        focusedMeshElementId: this.sceneMeshFocus.get(stageId) ?? null,
        onSelectionChange: (selection) => this.sceneSelections.set(stageId, selection),
        onMeshFocusChange: (elementId) => this.sceneMeshFocus.set(stageId, elementId),
        onNavigateTarget: (target) => this.focusToolbarTarget(target),
        benchmarkHost: this.benchmarkHost,
      });

    if (analyticalMode) {
      finalizeEmp1Presentation(content.element, {
        assessmentState: emp1AssessmentState,
        backingStageId: stageId,
      });
    }

    if (!reuseViewport) previousViewport?.destroy();
    this.activeViewport = content.viewport;
    this.activeViewportElement = content.viewportElement;
    this.activeViewportDependencies = viewportDependencies;
    this.slots.content.replaceChildren(content.element);
    restoreFocusedControl(this.rootElement, focused);
  }

  ensureShell() {
    if (this.section) return;
    this.section = element(this.rootElement, 'section', 'lafea-workbench');
    this.section.dataset.role = 'lafea-workbench';
    this.slots = Object.fromEntries(
      ['header', 'navigation', 'toolbar', 'content'].map((name) => {
        const slot = element(this.rootElement, 'div');
        slot.dataset.lafeaSlot = name;
        this.section.append(slot);
        return [name, slot];
      }),
    );
    this.rootElement.append(this.section);
  }

  destroy() {
    this.activeViewport?.destroy();
    this.activeViewport = null;
    this.activeViewportElement = null;
    this.activeViewportDependencies = null;
    this.sceneDocuments.clear();
    this.sceneLifecycles.clear();
    this.sceneLifecycleBindings.clear();
    this.sceneRevisions.clear();
    this.sceneSelections.clear();
    this.sceneMeshFocus.clear();
    VIEW_RENDER_DEPENDENCIES.delete(this);
    this.rootElement?.replaceChildren();
    this.section = null;
    this.slots = null;
    this.handlers = null;
    this.lastState = null;
    this.presentationMode = PRESENTATION_STAGE;
  }

  header(state, stage, definition, modes) {
    const header = element(this.rootElement, 'header', 'lafea-workbench__header');
    const block = element(this.rootElement, 'div');
    let eyebrow;
    let title;
    let purpose;
    let custody = null;

    if (modes.analyticalMode) {
      eyebrow = 'Local attachment assessment';
      title = `${EMP1_PUBLIC_PRODUCT.productId} — ${EMP1_PUBLIC_PRODUCT.label}`;
      purpose = 'Check load transfer, nominal section response, and the available local correlation. EMP.1 does not create an FE mesh.';
      custody = this.analyticalCustody(stage, modes.emp1AssessmentState);
    } else {
      eyebrow = `LAFEA standalone analysis • active stage ${definition.stageId}`;
      title = `${definition.stageId} — ${definition.label}`;
      purpose = definition.purpose;
      custody = this.headerCustody(stage);
    }

    block.append(
      element(this.rootElement, 'span', 'panel-eyebrow', eyebrow),
      element(this.rootElement, 'h1', null, title),
      element(this.rootElement, 'p', null, purpose),
    );
    if (modes.analyticalMode && modes.emp1AssessmentState?.outcome) {
      const message = element(this.rootElement, 'p', 'lafea-workbench__authority', modes.emp1AssessmentState.outcome.message);
      message.dataset.role = 'emp1-header-outcome-message';
      block.append(message);
    }
    if (custody) block.append(custody);
    const feStatus = stage.execution?.status ?? state.status;
    const statusText = modes.analyticalMode
      ? modes.emp1AssessmentState?.outcome?.label ?? 'Not ready'
      : feStatus;
    const status = element(this.rootElement, 'output', 'lafea-workbench__status', statusText);
    status.dataset.status = modes.analyticalMode
      ? modes.emp1AssessmentState?.outcome?.state ?? 'NOT_READY'
      : feStatus;
    status.dataset.role = modes.analyticalMode ? 'emp1-header-status' : 'lafea-stage-status';
    status.setAttribute('aria-live', 'polite');
    header.append(block, status);
    return header;
  }

  headerCustody(stage) {
    const details = element(this.rootElement, 'details', 'lafea-workbench__custody-details');
    const summary = element(this.rootElement, 'summary', null, 'Technical custody detail');
    const row = element(this.rootElement, 'div', 'lafea-workbench__custody');
    const sections = stage.orchestration?.sections ?? {};
    const values = [
      `Source binding: ${stage.lifecycleBinding?.status ?? 'UNINITIALIZED'}`,
      `Profile: ${stage.lifecycle?.profileId ?? 'UNINITIALIZED'}`,
      `Preparation: ${sections.PREPARATION?.state ?? 'UNAVAILABLE'}`,
      `Mesh: ${stage.analysisMeshCustodyProjection?.state ?? 'UNAVAILABLE'}`,
      `Authorization: ${sections.AUTHORIZATION?.state ?? 'UNAVAILABLE'}`,
      `Release: ${sections.RELEASE?.state === 'COMPLETE' ? 'QUALIFIED' : 'NOT QUALIFIED'}`,
    ];
    values.forEach((value) => row.append(element(this.rootElement, 'span', null, value)));
    details.append(summary, row);
    return details;
  }

  analyticalCustody(stage, assessmentState) {
    const details = element(this.rootElement, 'details', 'lafea-workbench__custody-details');
    details.dataset.role = 'emp1-header-technical-details';
    const summary = element(this.rootElement, 'summary', null, 'Technical details');
    const row = element(this.rootElement, 'div', 'lafea-workbench__custody');
    const sections = stage.orchestration?.sections ?? {};
    const step = emp1StepForBackingStage(stage.stageId);
    [
      `Engine stage: ${step?.stepId ?? 'UNRESOLVED'} ${step?.label ?? ''}`.trim(),
      `Backing engine: ${stage.stageId}`,
      `Source binding: ${stage.lifecycleBinding?.status ?? 'UNINITIALIZED'}`,
      `Profile: ${stage.lifecycle?.profileId ?? 'UNINITIALIZED'}`,
      `Preparation: ${sections.PREPARATION?.state ?? 'UNAVAILABLE'}`,
      `Authorization: ${sections.AUTHORIZATION?.state ?? 'UNAVAILABLE'}`,
      `Execution currentness: ${assessmentState?.technical?.executionCurrentness ?? 'NOT_RUN'}`,
      'FE mesh: NOT APPLICABLE',
      `Release: ${sections.RELEASE?.state === 'COMPLETE' ? 'QUALIFIED' : 'NOT QUALIFIED'}`,
    ].forEach((value) => row.append(element(this.rootElement, 'span', null, value)));
    details.append(summary, row);
    return details;
  }

  stageNavigation(state) {
    const navigation = element(this.rootElement, 'nav', 'lafea-workbench__stages');
    const emp1 = actionButton(
      this.rootElement,
      `${EMP1_PUBLIC_PRODUCT.productId} ${EMP1_PUBLIC_PRODUCT.label} · Analytical`,
      () => this.selectAnalyticalPresentation(state),
    );
    emp1.dataset.productId = EMP1_PUBLIC_PRODUCT.productId;
    emp1.dataset.method = 'ANALYTICAL';
    emp1.setAttribute('aria-current', isAnalyticalStage(state.activeStageId) ? 'step' : 'false');

    if (this.analyticalOnly) {
      navigation.setAttribute('aria-label', 'Analytical assessment products');
      navigation.append(emp1);
      return navigation;
    }

    navigation.setAttribute('aria-label', 'LAFEA analysis products and stages');
    navigation.append(emp1);
    for (const definition of LAFEA_STAGE_REGISTRY) {
      if (isAnalyticalStage(definition.stageId)) continue;
      const disabled = definition.engineState === 'ENGINE_NOT_IMPLEMENTED';
      const button = actionButton(
        this.rootElement,
        `${definition.stageId} ${definition.label} · FEA${disabled ? ' (Not implemented)' : ''}`,
        () => this.selectStagePresentation(definition.stageId, state),
      );
      button.dataset.stageId = definition.stageId;
      button.dataset.method = 'FEA';
      button.setAttribute('aria-current', definition.stageId === state.activeStageId ? 'step' : 'false');
      navigation.append(button);
    }
    return navigation;
  }

  selectStagePresentation(stageId, state) {
    this.presentationMode = isAnalyticalStage(stageId)
      ? PRESENTATION_ANALYTICAL
      : PRESENTATION_STAGE;
    const result = this.handlers.onStage(stageId);
    if (state.activeStageId === stageId) this.render(this.lastState ?? state);
    return result;
  }

  selectAnalyticalPresentation(state) {
    this.presentationMode = PRESENTATION_ANALYTICAL;
    const stageId = isAnalyticalStage(state.activeStageId)
      ? state.activeStageId
      : DEFAULT_ANALYTICAL_CALC_STAGE_ID;
    const result = this.handlers.onStage(stageId);
    if (state.activeStageId === stageId) this.render(this.lastState ?? state);
    return result;
  }

  selectAnalyticalRoute(stageId, state) {
    if (!isAnalyticalStage(stageId)) {
      throw new TypeError(`EMP1_BACKING_ROUTE_UNSUPPORTED:${stageId}`);
    }
    this.presentationMode = PRESENTATION_ANALYTICAL;
    const result = this.handlers.onStage(stageId);
    if (state.activeStageId === stageId) this.render(this.lastState ?? state);
    return result;
  }

  toolbar(stageId, stage, analyticalMode = false, emp1 = {}) {
    if (analyticalMode) return this.analyticalToolbar(stageId, stage, emp1);

    const toolbar = element(this.rootElement, 'div', 'lafea-workbench__toolbar');
    const canLoadDemo = hasLafeaDemoModel(stageId);
    const mock = actionButton(
      this.rootElement,
      `Load demonstration model (${stageId})`,
      () => (this.handlers.onLoadDemo ? this.handlers.onLoadDemo(stageId) : this.handlers.onMock(stageId)),
    );
    mock.dataset.role = 'lafea-mock';
    mock.dataset.roleDemo = 'lafea-load-demo';
    if (stage?.document || !canLoadDemo) mock.style.display = 'none';

    const file = element(this.rootElement, 'input');
    const fileLabel = element(this.rootElement, 'label', null, 'Import stage JSON');
    const fileId = `lafea-import-${stageId.replace('.', '-')}`;
    file.id = fileId;
    fileLabel.htmlFor = fileId;
    file.type = 'file';
    file.accept = '.json,application/json';
    file.dataset.role = 'lafea-import';
    file.addEventListener('change', () => this.handlers.onFile(file.files?.[0] ?? null));

    const executionSupported = lafeaRegisteredExecutionSupported(stageId);
    const authorization = stage.orchestration?.sections?.AUTHORIZATION ?? null;
    const runAuthorized = authorization?.state === 'READY';
    const run = actionButton(
      this.rootElement,
      executionSupported ? 'Validate and calculate' : 'Calculation not implemented',
      this.handlers.onRun,
    );
    run.dataset.role = 'lafea-run';
    run.disabled = !stage.document || !executionSupported || !runAuthorized;
    run.title = runTitle(stage, executionSupported, authorization);

    const benchmark = actionButton(this.rootElement, 'Run available verification suite', this.handlers.onBenchmark);
    benchmark.dataset.role = 'lafea-benchmark';
    benchmark.disabled = !executionSupported;
    if (!executionSupported) benchmark.title = 'Execution is not supported for this stage.';
    const exportButton = actionButton(this.rootElement, 'Export source document', this.handlers.onExport);
    exportButton.disabled = !stage.document;
    if (!stage.document) exportButton.title = 'Load or author a source document to export.';
    const undo = actionButton(this.rootElement, 'Undo', this.handlers.onUndo);
    undo.disabled = !stage.past.length;
    if (!stage.past.length) undo.title = 'No edits to undo.';
    const redo = actionButton(this.rootElement, 'Redo', this.handlers.onRedo);
    redo.disabled = !stage.future.length;
    if (!stage.future.length) redo.title = 'No edits to redo.';
    const showMock = canLoadDemo && !this.rootElement?.hasAttribute?.('data-lafea-app-root');
    toolbar.append(
      ...(showMock ? [mock] : []),
      fileLabel,
      file,
      run,
      ...(this.benchmarkHost ? [benchmark] : []),
      exportButton,
      undo,
      redo,
    );
    return toolbar;
  }

  analyticalToolbar(stageId, stage, emp1) {
    const toolbar = element(this.rootElement, 'div', 'lafea-workbench__toolbar');
    toolbar.dataset.role = 'emp1-action-bar';
    const step = emp1StepForBackingStage(stageId);
    const assessment = emp1.emp1AssessmentState;
    const next = assessment?.nextAction ?? {
      id: EMP1_ASSESSMENT_ACTIONS.RUN_COMPLETE_EXAMPLE,
      label: 'Run complete example',
      reason: 'Load compatible assessment data to begin.',
    };

    const primary = actionButton(
      this.rootElement,
      next.label,
      () => this.executeEmp1PrimaryAction(next.id, emp1.workspaceState),
    );
    primary.dataset.role = 'emp1-primary-action';
    primary.dataset.nextAction = next.id;
    primary.dataset.toolbarPrimary = 'true';
    primary.title = next.reason;
    primary.setAttribute('aria-describedby', 'emp1-primary-action-help');

    const help = element(this.rootElement, 'span', 'lafea-workbench__toolbar-help', next.reason);
    help.id = 'emp1-primary-action-help';
    help.dataset.role = 'emp1-primary-action-help';

    const details = element(this.rootElement, 'details', 'lafea-workbench__custody-details');
    details.dataset.role = 'emp1-more-actions';
    details.append(element(this.rootElement, 'summary', null, 'More actions'));
    const note = element(this.rootElement, 'p', 'lafea-workbench__section-intro',
      'Import, export, software verification and individual engine-stage tools are secondary. Use them only when you need to inspect or replace a specific part of the assessment.');
    details.append(note);

    const sourceControls = this.emp1SourceControls(stageId, stage, emp1.workspaceState);
    const runControls = this.emp1TechnicalRunControls(stageId, stage, emp1);
    const evidenceControls = this.emp1EvidenceControls(stageId, stage);
    details.append(
      this.toolbarGroup('source', 'Assessment data', sourceControls),
      this.toolbarGroup('run', 'Engine-stage tools', runControls),
      this.toolbarGroup('evidence', 'Export & software QA', evidenceControls),
    );
    toolbar.append(primary, help, details);
    return toolbar;
  }

  emp1SourceControls(stageId, stage, workspaceState) {
    const step = emp1StepForBackingStage(stageId);
    const isolatedLabel = step?.shortId === 'B'
      ? 'Load B-only test data (requires current load transfer)'
      : 'Load A-only test data';
    const mock = actionButton(this.rootElement, isolatedLabel, () => this.handlers.onMock(stageId));
    mock.dataset.role = 'lafea-mock';
    mock.dataset.mockData = 'true';
    mock.title = step?.shortId === 'B'
      ? 'Technical sample only. It does not supply the current load-transfer evidence required by section screening.'
      : 'Technical sample only. Use Run complete example for the guided end-to-end assessment.';

    const completeSample = actionButton(
      this.rootElement,
      'Run complete example',
      () => this.loadCompleteExampleWithConfirmation(workspaceState),
    );
    completeSample.dataset.role = 'emp1-load-complete-qualification-sample';
    completeSample.dataset.mockData = 'true';
    completeSample.title = 'Load compatible A/B/C example inputs, establish fresh assessment custody, and run the required stages.';

    const file = element(this.rootElement, 'input');
    const fileLabel = element(this.rootElement, 'label', null,
      step?.shortId === 'B' ? 'Import section-check JSON' : 'Import load-transfer JSON');
    const fileId = `lafea-import-${stageId.replace('.', '-')}`;
    file.id = fileId;
    fileLabel.htmlFor = fileId;
    file.type = 'file';
    file.accept = '.json,application/json';
    file.dataset.role = 'lafea-import';
    file.addEventListener('change', () => this.handlers.onFile(file.files?.[0] ?? null));
    return [mock, completeSample, fileLabel, file];
  }

  emp1TechnicalRunControls(stageId, stage, emp1) {
    const step = emp1StepForBackingStage(stageId);
    const executionSupported = lafeaRegisteredExecutionSupported(stageId);
    const authorization = stage.orchestration?.sections?.AUTHORIZATION ?? null;
    const runAuthorized = authorization?.state === 'READY';
    const run = actionButton(
      this.rootElement,
      step?.shortId === 'B' ? 'Run section check' : 'Run load transfer',
      this.handlers.onRun,
    );
    run.dataset.role = 'lafea-run';
    if (step) run.dataset.emp1Step = step.shortId;
    run.disabled = !stage.document || !executionSupported || !runAuthorized;
    run.title = runTitle(stage, executionSupported, authorization);

    const productRun = actionButton(
      this.rootElement,
      'Run required assessment steps',
      this.handlers.onRunEmp1,
    );
    productRun.dataset.role = 'emp1-run-product';
    productRun.dataset.currentness = emp1.emp1ExecutionCurrentness?.state ?? 'NOT_RUN';
    productRun.disabled = emp1.emp1RunReadiness?.runAuthorized !== true;
    productRun.title = productRun.disabled
      ? `Assessment setup is incomplete: ${(emp1.emp1RunReadiness?.reasons ?? []).join(', ')}`
      : 'Run current required A/B mechanics and the governed local check when it is available.';

    const cRun = actionButton(
      this.rootElement,
      emp1.emp1CState?.currentResultAvailable === true ? 'Recalculate local check' : 'Run local check',
      this.handlers.onRunEmp1,
    );
    cRun.dataset.role = 'emp1-run-c';
    cRun.dataset.cState = emp1.emp1CState?.state ?? 'SOURCE_INCOMPLETE';
    cRun.disabled = emp1.emp1CState?.buttonEnabled !== true;
    cRun.title = cRun.disabled
      ? `Local check is unavailable: ${(emp1.emp1CState?.blockerCodes ?? []).join(', ') || 'source or method setup is incomplete'}`
      : 'Run the local correlation under the current bounded method authority.';
    return [productRun, cRun, run];
  }

  emp1EvidenceControls(stageId, stage) {
    const executionSupported = lafeaRegisteredExecutionSupported(stageId);
    const benchmark = actionButton(this.rootElement, 'Run software verification', this.handlers.onBenchmark);
    benchmark.dataset.role = 'lafea-benchmark';
    benchmark.disabled = !executionSupported;
    benchmark.title = 'Runs software quality-assurance checks. Passing these checks is not an EMP.1 assessment result.';

    const exportButton = actionButton(this.rootElement, 'Export current step data', this.handlers.onExport);
    exportButton.disabled = !stage.document;
    const undo = actionButton(this.rootElement, 'Undo edit', this.handlers.onUndo);
    undo.disabled = !stage.past.length;
    const redo = actionButton(this.rootElement, 'Redo edit', this.handlers.onRedo);
    redo.disabled = !stage.future.length;
    return [...(this.benchmarkHost ? [benchmark] : []), exportButton, undo, redo];
  }

  loadCompleteExampleWithConfirmation(state) {
    const hasCurrentAssessment = Boolean(
      state?.stages?.['LAFEA.1']?.document
      || state?.stages?.['LAFEA.2']?.document
      || state?.stages?.['LAFEA.1']?.execution
      || state?.stages?.['LAFEA.2']?.execution,
    );
    if (hasCurrentAssessment) {
      const confirm = this.rootElement?.ownerDocument?.defaultView?.confirm;
      if (typeof confirm === 'function' && confirm(
        'Replace the current EMP.1 assessment? Existing calculated results will be cleared and recalculated for the example.',
      ) !== true) return null;
    }
    return this.handlers.onLoadEmp1QualificationSample();
  }

  executeEmp1PrimaryAction(actionId, state) {
    if (actionId === EMP1_ASSESSMENT_ACTIONS.RUN_COMPLETE_EXAMPLE) {
      return this.loadCompleteExampleWithConfirmation(state);
    }
    if (actionId === EMP1_ASSESSMENT_ACTIONS.RUN_LOAD_TRANSFER) {
      this.handlers.onStage('LAFEA.1');
      return this.handlers.onRun();
    }
    if (actionId === EMP1_ASSESSMENT_ACTIONS.OPEN_SECTION_CHECK) {
      this.handlers.onStage('LAFEA.2');
      return this.selectEmp1Task('SECTION_SCREENING');
    }
    if (actionId === EMP1_ASSESSMENT_ACTIONS.RUN_SECTION_CHECK) {
      this.handlers.onStage('LAFEA.2');
      return this.handlers.onRun();
    }
    if (actionId === EMP1_ASSESSMENT_ACTIONS.CONFIGURE_LOCAL_CHECK) {
      return this.selectEmp1Task('LOCAL_CORRELATION');
    }
    if (actionId === EMP1_ASSESSMENT_ACTIONS.RUN_LOCAL_CHECK) {
      return this.handlers.onRunEmp1();
    }
    if (actionId === EMP1_ASSESSMENT_ACTIONS.REVIEW_ASSESSMENT) {
      return this.selectEmp1Task('REVIEW_EVIDENCE');
    }
    throw new TypeError(`EMP1_PRIMARY_ACTION_UNSUPPORTED:${actionId}`);
  }

  selectEmp1Task(stepId) {
    const shell = this.rootElement?.querySelector?.('[data-role="lafea-analytical-calc"]');
    const CustomEventType = this.rootElement?.ownerDocument?.defaultView?.CustomEvent ?? globalThis.CustomEvent;
    if (!shell || typeof shell.dispatchEvent !== 'function' || typeof CustomEventType !== 'function') return false;
    shell.dispatchEvent(new CustomEventType('emp1-task-shell-select', { detail: { stepId } }));
    return true;
  }

  /** One labelled, separated cluster of toolbar controls. */
  toolbarGroup(groupId, label, controls) {
    const group = element(this.rootElement, 'div', 'lafea-workbench__toolbar-group');
    group.dataset.toolbarGroup = groupId;
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
    group.append(element(this.rootElement, 'span', 'lafea-workbench__toolbar-group-label', label));
    group.append(...controls);
    return group;
  }

  nextSceneRevision(stageId, documentValue, lifecycle, lifecycleBinding) {
    const changed = !this.sceneDocuments.has(stageId)
      || this.sceneDocuments.get(stageId) !== documentValue
      || this.sceneLifecycles.get(stageId) !== lifecycle
      || this.sceneLifecycleBindings.get(stageId) !== lifecycleBinding;
    if (changed) {
      this.sceneDocuments.set(stageId, documentValue);
      this.sceneLifecycles.set(stageId, lifecycle);
      this.sceneLifecycleBindings.set(stageId, lifecycleBinding);
      this.sceneRevisions.set(stageId, (this.sceneRevisions.get(stageId) ?? 0) + 1);
      this.sceneSelections.delete(stageId);
      this.sceneMeshFocus.delete(stageId);
    }
    return this.sceneRevisions.get(stageId) ?? 0;
  }

  focusToolbarTarget(target) {
    if (target !== 'run') return;
    this.slots?.toolbar?.querySelector?.('[data-role="emp1-primary-action"], [data-role="lafea-run"]')?.focus?.();
  }
}

function withCurrentEmp1StageExecutions(state, execution, currentness) {
  if (currentness?.inputCurrent !== true || !execution) return state;
  const loadTransfer = execution.stageExecutions?.loadTransfer ?? null;
  const sectionScreening = execution.stageExecutions?.sectionScreening ?? null;
  if (!loadTransfer && !sectionScreening) return state;
  return {
    ...state,
    stages: {
      ...state.stages,
      'LAFEA.1': loadTransfer
        ? { ...state.stages['LAFEA.1'], execution: loadTransfer }
        : state.stages['LAFEA.1'],
      'LAFEA.2': sectionScreening
        ? { ...state.stages['LAFEA.2'], execution: sectionScreening }
        : state.stages['LAFEA.2'],
    },
  };
}

function withEmp1CStateProjection(projection, cState) {
  if (!projection || !cState) return projection;
  return Object.freeze({
    ...projection,
    steps: Object.freeze(projection.steps.map((step) => step.shortId === 'C'
      ? Object.freeze({
        ...step,
        state: cState.state,
        resultAvailable: cState.currentResultAvailable,
        retainedResultAvailable: cState.retainedResultAvailable,
        runAuthorized: cState.buttonEnabled,
        blockers: cState.blockerCodes,
        currentnessBadge: cState.stageBadge,
      })
      : step)),
  });
}

function isAnalyticalStage(stageId) {
  return isEmp1BackingStage(stageId);
}

function runTitle(stage, executionSupported, authorization) {
  if (!executionSupported) {
    return lafeaWorkbenchReasonLabel('UNSUPPORTED_STAGE_ENGINE_NOT_IMPLEMENTED');
  }
  if (!stage.document) {
    return 'Import or create a valid source document before running the analysis.';
  }
  if (authorization?.state !== 'READY') {
    const reasons = lafeaWorkbenchReasonLabels(
      authorization?.reasons?.length
        ? authorization.reasons
        : ['CANONICAL_AUTHORIZATION_NOT_READY'],
    ).join(' ');
    return `Run is not authorized. ${reasons}`;
  }
  return 'Analysis authorization is ready. A retained calculation result does not by itself establish release qualification.';
}
