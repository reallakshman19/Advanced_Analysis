/** Controller for the independent guided LAFEA workbench. */
import { createLafeaWorkbenchStore } from './lafea-lifecycle-workbench-store.js';
import {
  createLafeaAccessoryPanelManager,
  lafeaAccessoryPanelConfigurationRequiresHost,
} from './lafea-workbench-accessory-panels.js';
import {
  downloadLafeaJson,
  installLafeaWorkbenchStyles,
  isLafeaRecord,
  lafeaStageFilename,
  parseLafeaJsonObject,
  readLafeaUtf8,
} from './lafea-workbench-controller-io.js';
import {
  bindLafeaWorkbenchDisplayRenderPacket,
  clearLafeaWorkbenchDisplayRenderPacket,
  destroyLafeaWorkbenchRenderEvidence,
  initializeLafeaWorkbenchRenderEvidence,
  lafeaWorkbenchDisplayRenderPacket,
  lafeaWorkbenchThreeNamespace,
} from './lafea-workbench-render-evidence.js';
import {
  classifyEmp1WorkbenchExecutionCurrentness,
  normalizeEmp1WorkbenchRunInput,
  projectEmp1WorkbenchCState,
  projectEmp1WorkbenchRunReadiness,
} from './emp1-workbench-run-state.js';
import { currentEmp1WorkbenchRouteAuthority } from './emp1-workbench-product-run.js';
import {
  createEmp1WorkspaceEngineeringReview,
  projectEmp1EngineeringReviewWorkspace,
} from './emp1-engineering-review-workspace.js';
import { publicLafeaFailure } from './lafea-public-failure.js';
import { issueLafeaSourceAuthority } from './lafea-source-authority.js';
import { LafeaWorkbenchView } from './lafea-workbench-view.js';

const ACCESSORY_PANEL_MANAGERS = new WeakMap();
const DESTROYED_CONTROLLERS = new WeakSet();

export class LafeaWorkbenchController {
  constructor(rootElement, options) {
    const configuration = isLafeaRecord(options) ? options : {};
    const { accessoryPanels, THREE, emp1RunInput, emp1ReviewClock, ...storeOptions } = configuration;
    const {
      benchmarkPanelFactory,
      mockDocumentFactory,
      mockDomainAndGeometryFactory,
      presentationMode,
      analyticalOnly,
    } = configuration;
    this.rootElement = rootElement;
    this.documentRef = rootElement?.ownerDocument ?? globalThis.document;
    this.store = createLafeaWorkbenchStore(storeOptions);
    this.emp1RunInput = emp1RunInput == null ? null : normalizeEmp1WorkbenchRunInput(emp1RunInput);
    this.emp1Execution = null;
    this.emp1RunFailure = null;
    this.emp1RunSerial = 0;
    this.emp1EngineeringReviewRecord = null;
    this.emp1ReviewClock = typeof emp1ReviewClock === 'function'
      ? emp1ReviewClock
      : () => new Date().toISOString();
    this.mockDocumentFactory = typeof mockDocumentFactory === 'function' ? mockDocumentFactory : null;
    const companionMockDomainAndGeometryFactory = this.mockDocumentFactory?.domainAndGeometryFactory;
    this.mockDomainAndGeometryFactory = typeof mockDomainAndGeometryFactory === 'function'
      ? mockDomainAndGeometryFactory
      : typeof companionMockDomainAndGeometryFactory === 'function'
        ? companionMockDomainAndGeometryFactory
        : null;
    initializeLafeaWorkbenchRenderEvidence(this, THREE ?? null);
    this.view = new LafeaWorkbenchView(rootElement, {
      getRenderPacket: (stageId) => lafeaWorkbenchDisplayRenderPacket(this, stageId),
      getEmp1RunInput: () => this.emp1RunInput,
      getEmp1Execution: () => this.emp1Execution,
      getEmp1RunFailure: () => this.emp1RunFailure,
      getEmp1RouteAuthority: () => currentEmp1WorkbenchRouteAuthority(),
      THREE: lafeaWorkbenchThreeNamespace(this),
      presentationMode,
      analyticalOnly,
    });
    this.benchmarkHost = this.documentRef.createElement('div');
    this.benchmarkHost.dataset.role = 'lafea-benchmark-host';
    this.benchmarkPanel = typeof benchmarkPanelFactory === 'function'
      ? benchmarkPanelFactory(this.benchmarkHost)
      : null;
    if (this.benchmarkPanel) this.view.setBenchmarkHost(this.benchmarkHost);
    if (lafeaAccessoryPanelConfigurationRequiresHost(configuration)) {
      ACCESSORY_PANEL_MANAGERS.set(
        this,
        createLafeaAccessoryPanelManager(this.documentRef, accessoryPanels),
      );
    }
    this.unsubscribe = null;
  }

  init() {
    if (DESTROYED_CONTROLLERS.has(this)) {
      throw new TypeError('LAFEA_WORKBENCH_CONTROLLER_DESTROYED');
    }
    if (this.unsubscribe) return this;
    installLafeaWorkbenchStyles(this.documentRef);
    this.view.init({
      onStage: (stageId) => this.store.selectStage(stageId),
      onMock: (stageId) => this.loadMockData(stageId),
      onLoadEmp1QualificationSample: () => this.loadEmp1QualificationSample(),
      onFile: (file) => this.loadFile(file),
      onRun: () => this.run(),
      onRunEmp1: () => this.runEmp1Product(),
      onEmp1RunInput: (value) => this.setEmp1RunInput(value),
      getEmp1EngineeringReviewWorkspace: () => this.getEmp1EngineeringReviewWorkspace(),
      onEmp1EngineeringReview: (request) => this.submitEmp1EngineeringReview(request),
      onPrepareContinuum: () => this.attemptContinuumPreflight(),
      onRunContinuumConvergence: (request) => this.runContinuumConvergenceStudy(request),
      onExport: () => this.downloadDocument(),
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
      onSetScalar: (descriptorId, entityId, rawText) => this.setScalar(descriptorId, entityId, rawText),
      onSetScalarBatch: (edits) => this.setScalarBatch(edits),
      onApplyJson: (text) => this.applyDocumentText(text),
      onMoveNode: (path, nodeId, x, y) => this.store.moveNode(path, nodeId, x, y),
      onBenchmark: () => this.runBenchmark(),
      onImportMeshEvidence: (file) => this.loadAnalysisMeshEvidenceFile(file),
      onValidateMeshEvidence: () => this.validateRetainedAnalysisMeshEvidence(),
      onExportMeshEvidence: () => this.downloadAnalysisMeshEvidence(),
      onBindMeshProfile: (profile) => {
        const stageId = this.getState().activeStageId;
        if (stageId === 'LAFEA.3'
          && !this.getState().stages[stageId].domainFirstProfileActive) {
          this.store.activateDomainFirstProfile(stageId);
        }
        return this.bindAnalysisMeshProfile(profile);
      },
      onPlanMesh: (overrides) => this.planAnalysisMesh(overrides),
      onGenerateMesh: (overrides) => this.generateAnalysisMesh(overrides),
      onRefineMesh: (request) => this.refineAnalysisMesh(request),
    });
    this.benchmarkPanel?.render();
    this.unsubscribe = this.store.subscribe((state) => this.view.render(state));
    this.view.render(this.store.getState());
    const accessoryPanelManager = ACCESSORY_PANEL_MANAGERS.get(this);
    if (accessoryPanelManager) {
      this.rootElement.append(accessoryPanelManager.hostElement);
      accessoryPanelManager.mount(this);
    }
    return this;
  }

  runBenchmark() { return this.benchmarkPanel?.run() ?? null; }
  getBenchmarkReport() { return this.benchmarkPanel?.getReport() ?? null; }

  async loadFile(file) {
    if (!file) return this.getState();
    try {
      return this.importDocument(JSON.parse(await readLafeaUtf8(file)));
    } catch (error) {
      return this.store.reportEditError('document', null, error);
    }
  }

  async loadAnalysisMeshEvidenceFile(file) {
    if (!file) return this.getState();
    try {
      const value = JSON.parse(await readLafeaUtf8(file));
      this.recoverAnalysisMeshEvidence(value);
      return this.getState();
    } catch (error) {
      return this.store.reportEditError('analysisMeshEvidence', null, error);
    }
  }
  importDocument(value, stageId, sourceHash = null) {
    return this.store.importDocument(value, stageId, sourceHash);
  }

  async loadMockData(stageId) {
    if (!this.mockDocumentFactory) {
      return this.store.reportEditError(
        'document',
        null,
        new TypeError('LAFEA_SIMULATED_SOURCE_NOT_CONFIGURED'),
      );
    }
    try {
      const documentValue = await this.mockDocumentFactory(stageId);
      this.importDocument(documentValue, stageId);
      const importedDocument = this.getState().stages[stageId]?.document;
      if (!importedDocument) {
        throw new TypeError('LAFEA_SIMULATED_SOURCE_IMPORT_REQUIRED');
      }
      const sourceAuthority = issueLafeaSourceAuthority(
        stageId,
        importedDocument,
        'SIMULATED_SOURCE_PROVIDER',
      );
      this.initializeLifecycle(sourceAuthority.sourceHash, 'SIMULATED_SOURCE_PROVIDER');
      const hash = sourceAuthority.sourceHash;
      if (stageId === 'LAFEA.3') {
        this.store.activateDomainFirstProfile();
        if (this.mockDomainAndGeometryFactory) {
          const mockEv = await this.mockDomainAndGeometryFactory(stageId, hash);
          if (mockEv) {
            this.store.registerAnalysisDomain(mockEv.domain);
            this.store.registerAnalysisGeometryEvidence(mockEv.geometryEvidence);
            const meshProfileFactory = this.mockDocumentFactory?.meshProfileFactory;
            if (typeof meshProfileFactory === 'function') {
              const meshProfile = await meshProfileFactory(stageId);
              if (meshProfile) this.store.bindAnalysisMeshProfile(meshProfile, stageId);
            }
          }
        }
      } else if (stageId === 'LAFEA.4') {
        const { createLafeaSimulatedShellMidsurfaceEvidence } = await import(
          './lafea-simulated-shell-midsurface-provider.js'
        );
        const shellParent = createLafeaSimulatedShellMidsurfaceEvidence(
          stageId,
          hash,
          documentValue,
        );
        if (shellParent) {
          this.store.registerShellMidsurfaceEvidence(shellParent);
          const meshProfileFactory = this.mockDocumentFactory?.meshProfileFactory;
          if (typeof meshProfileFactory === 'function') {
            const meshProfile = await meshProfileFactory(stageId);
            if (meshProfile) {
              this.store.bindAnalysisMeshProfile(meshProfile, stageId);
              this.store.generateAnalysisMesh({}, stageId);
            }
          }
        }
      } else if (stageId === 'LAFEA.5') {
        const { createLafea5SourceShellParent } = await import(
          './lafea-source-shell-mesh-adoption.js'
        );
        const shellParent = createLafea5SourceShellParent({
          sourceHash: hash,
          shellTemplate: documentValue.shellTemplate,
        });
        this.store.registerShellMidsurfaceEvidence(shellParent);
      }
      return this.getState();
    } catch (error) {
      return this.store.reportEditError('document', null, error);
    }
  }

  async loadEmp1QualificationSample() {
    try {
      const { createEmp1WorkbenchQualificationSample } = await import(
        './emp1-workbench-qualification-sample.js'
      );
      const sample = createEmp1WorkbenchQualificationSample();

      // A complete sample load is one source/product replacement transaction.
      // Retire any previous product-side run/review state before changing the
      // backing documents, and invalidate an in-flight EMP.1 product run so it
      // cannot publish against the replacement source after this reset.
      this.emp1RunSerial += 1;
      this.emp1RunInput = null;
      this.emp1Execution = null;
      this.emp1RunFailure = null;
      this.emp1EngineeringReviewRecord = null;

      // A bulk replacement must not inherit lifecycle custody from whichever
      // source happened to be loaded previously. The retained store already
      // supports atomic import + lifecycle initialization when an explicit
      // source hash is supplied, so issue the authority for this exact sample
      // document and use that path rather than weakening run-time mismatch
      // detection.
      const aSourceAuthority = issueLafeaSourceAuthority(
        'LAFEA.1',
        sample.aDocument,
        'EMP1_QUALIFICATION_SAMPLE/A',
      );
      const importedA = this.importDocument(
        sample.aDocument,
        'LAFEA.1',
        aSourceAuthority.sourceHash,
      );
      if (!importedA?.stages?.['LAFEA.1']?.document) {
        const error = new TypeError('EMP.1 qualification sample requires an imported step A document.');
        error.code = 'EMP1_WORKBENCH_A_DOCUMENT_REQUIRED';
        throw error;
      }

      this.store.selectStage('LAFEA.1');
      const ranA = this.run();
      const aExecution = ranA?.stages?.['LAFEA.1']?.execution;
      if (ranA?.status === 'FAILED') {
        const diagnostic = ranA?.diagnostics?.find((row) => row?.severity === 'ERROR')
          ?? ranA?.diagnostics?.[0];
        const error = new TypeError(
          diagnostic?.message ?? 'EMP.1 qualification sample step A execution failed.',
        );
        error.code = diagnostic?.code ?? 'EMP1_QUALIFICATION_SAMPLE_A_RUN_FAILED';
        throw error;
      }
      if (aExecution?.status !== 'QUALIFIED'
        || aExecution?.result?.qualification?.state !== 'ACCEPTED') {
        const error = new TypeError(
          'EMP.1 qualification sample requires step A to produce a current qualified result before B/C.',
        );
        error.code = 'EMP1_A_CURRENT_QUALIFIED_RESULT_REQUIRED';
        throw error;
      }

      const bSourceAuthority = issueLafeaSourceAuthority(
        'LAFEA.2',
        sample.bDocument,
        'EMP1_QUALIFICATION_SAMPLE/B',
      );
      const importedB = this.importDocument(
        sample.bDocument,
        'LAFEA.2',
        bSourceAuthority.sourceHash,
      );
      if (!importedB?.stages?.['LAFEA.2']?.document) {
        const error = new TypeError('EMP.1 qualification sample requires an imported step B document.');
        error.code = 'EMP1_WORKBENCH_B_DOCUMENT_REQUIRED';
        throw error;
      }

      const applied = this.setEmp1RunInput(sample.runInput);
      if (applied.status !== 'APPLIED') {
        const error = new TypeError(applied.code ?? 'EMP1_QUALIFICATION_SAMPLE_RUN_INPUT_REJECTED');
        error.code = applied.code ?? 'EMP1_QUALIFICATION_SAMPLE_RUN_INPUT_REJECTED';
        throw error;
      }
      const execution = await this.runEmp1Product();
      // importDocument(sample.bDocument, 'LAFEA.2') above made B the active
      // stage as an intrinsic side effect of importing into it (as any real
      // B import would). That is correct for a deliberate single-document
      // import, but "load complete sample" is one bulk convenience action,
      // not the caller choosing to look at B - so restore A as active here.
      // runEmp1Product() itself reads stages['LAFEA.1']/['LAFEA.2'] directly
      // and does not depend on which stage is active. Leaving activeStageId
      // on B would otherwise make reconcileSelectionWithBackingStage (in
      // emp1-analytical-layout.js) jump the professional-workflow task to
      // SECTION_SCREENING instead of staying on the loaded BASIS_SOURCE task.
      this.store.selectStage('LAFEA.1');
      return Object.freeze({
        schema: sample.schema,
        status: execution?.status ?? 'FAILED',
        execution,
      });
    } catch (error) {
      this.emp1RunFailure = publicLafeaFailure(
        error,
        'EMP1_QUALIFICATION_SAMPLE_LOAD_FAILED',
        'EMP.1 qualification sample load failed.',
      );
      if (this.unsubscribe) this.view.render(this.getState());
      return Object.freeze({ status: 'FAILED', ...this.emp1RunFailure });
    }
  }

  exportDocument() { return this.store.exportDocument(); }
  exportLifecycle() { return this.store.exportLifecycle(); }
  initializeLifecycle(sourceHash, originRef) {
    return this.store.initializeLifecycle(sourceHash, originRef);
  }
  applyLifecycleEvent(event) { return this.store.applyLifecycleEvent(event); }
  registerLifecycleArtifact(record, registrationId) {
    return this.store.registerLifecycleArtifact(record, registrationId);
  }
  revalidateLifecycleBinding(sourceHash, originRef) {
    return this.store.revalidateLifecycleBinding(sourceHash, originRef);
  }
  registerTemplateReleaseRecord(value, stageId = this.getState().activeStageId) {
    return this.store.registerTemplateReleaseRecord(value, stageId);
  }
  selectRetainedTemplateReleaseRecord(stageId = this.getState().activeStageId) {
    return this.store.selectRetainedTemplateReleaseRecord(stageId);
  }
  buildReleaseBindingProjection(stageId = this.getState().activeStageId) {
    return this.store.buildReleaseBindingProjection(stageId);
  }
  registerNumericalVerificationEvidence(value, stageId = this.getState().activeStageId) {
    return this.store.registerNumericalVerificationEvidence(value, stageId);
  }
  selectRetainedNumericalVerificationEvidence(stageId = this.getState().activeStageId) {
    return this.store.selectRetainedNumericalVerificationEvidence(stageId);
  }
  buildNumericalVerificationProjection(stageId = this.getState().activeStageId) {
    return this.store.buildNumericalVerificationProjection(stageId);
  }
  registerT6GeometryQualification(value, stageId = this.getState().activeStageId) {
    return this.store.registerT6GeometryQualification(value, stageId);
  }
  selectRetainedT6GeometryQualification(stageId = this.getState().activeStageId) {
    return this.store.selectRetainedT6GeometryQualification(stageId);
  }
  buildT6GeometryQualificationProjection(stageId = this.getState().activeStageId) {
    return this.store.buildT6GeometryQualificationProjection(stageId);
  }
  exportT6GeometryQualification(stageId = this.getState().activeStageId) {
    return this.store.exportT6GeometryQualification(stageId);
  }
  validateLafeaAnalysisMeshEvidence(value) {
    return this.store.validateLafeaAnalysisMeshEvidence(value);
  }
  registerAnalysisMeshEvidence(value) {
    return this.store.registerAnalysisMeshEvidence(value);
  }
  selectRetainedAnalysisMeshEvidence(stageId) {
    return this.store.selectRetainedAnalysisMeshEvidence(stageId);
  }

  bindAnalysisMeshProfile(v, s = this.getState().activeStageId) { return this.store.bindAnalysisMeshProfile(v, s); }
  /** Preview only: runs the bound producer without touching mesh custody. */
  planAnalysisMesh(o = {}, s = this.getState().activeStageId) { return this.store.planAnalysisMesh(o, s); }
  generateAnalysisMesh(o = {}, s = this.getState().activeStageId) { return this.store.generateAnalysisMesh(o, s); }
  refineAnalysisMesh(r = {}, s = this.getState().activeStageId) { return this.store.refineAnalysisMesh(r, s); }
  prepareContinuumForRun(s = this.getState().activeStageId) { return this.store.prepareContinuumForRun(s); }
  attemptContinuumPreflight(s = this.getState().activeStageId) {
    return this.store.prepareContinuumForRun(s, { failureMode: 'DIAGNOSTIC_UI' });
  }
  runContinuumConvergenceStudy(request) { return this.store.runContinuumConvergenceStudy(request); }
  selectRetainedAnalysisMeshEvidenceV2(s = this.getState().activeStageId) { return this.store.selectRetainedAnalysisMeshEvidenceV2(s); }

  buildAnalysisMeshCustodyProjection(stageId = this.getState().activeStageId) {
    const stage = this.getState().stages[stageId];
    return this.store.buildAnalysisMeshCustodyProjection(
      stage,
      stage?.retainedAnalysisMeshEvidence ?? null,
    );
  }

  exportAnalysisMeshEvidence(stageId = this.getState().activeStageId) {
    return this.store.exportAnalysisMeshEvidence(stageId);
  }
  recoverAnalysisMeshEvidence(value) {
    return this.store.recoverAnalysisMeshEvidence(value);
  }
  validateRetainedAnalysisMeshEvidence(stageId = this.getState().activeStageId) {
    const evidence = this.selectRetainedAnalysisMeshEvidence(stageId);
    return evidence ? this.validateLafeaAnalysisMeshEvidence(evidence) : null;
  }

  getDisplayViewportContext() {
    const viewport = this.view.activeViewport;
    if (!viewport) return null;
    const state = viewport.getState();
    return Object.freeze({
      schema: 'lafea-workbench-display-context/v1',
      stageId: state.stageId,
      sceneRevision: state.sceneRevision,
      sourceSemanticHash: viewport.scene.sourceSemanticHash,
      mode: state.mode,
      status: state.status,
    });
  }

  setDisplayRenderPacket(packetValue) {
    const binding = bindLafeaWorkbenchDisplayRenderPacket(this, packetValue);
    this.renderActiveStageIf(binding.stageId);
    return binding;
  }

  clearDisplayRenderPacket(stageId = this.getState().activeStageId) {
    const binding = clearLafeaWorkbenchDisplayRenderPacket(this, stageId);
    if (binding.status === 'CLEARED') this.renderActiveStageIf(binding.stageId);
    return binding;
  }

  renderActiveStageIf(stageId) {
    if (this.unsubscribe && this.getState().activeStageId === stageId) {
      this.view.render(this.getState());
    }
  }

  setScalar(descriptorId, entityId, rawText) {
    try {
      return this.store.setScalar(descriptorId, entityId, rawText, 'FORM');
    } catch (error) {
      return this.store.reportEditError(descriptorId, entityId, error);
    }
  }

  setScalarBatch(edits) {
    try {
      return this.store.setScalarBatch(edits, 'FORM_GROUP');
    } catch (error) {
      return this.store.reportEditError('scalarBatch', null, error);
    }
  }

  applyDocumentText(text) {
    try {
      return this.store.replaceDocument(parseLafeaJsonObject(text, 'LAFEA document'), 'RAW_JSON');
    } catch (error) {
      return this.store.reportEditError('document', null, error);
    }
  }

  setEmp1RunInput(value) {
    try {
      this.emp1RunInput = normalizeEmp1WorkbenchRunInput(value);
      this.emp1RunFailure = null;
      if (this.unsubscribe) this.view.render(this.getState());
      return Object.freeze({ status: 'APPLIED', input: this.emp1RunInput });
    } catch (error) {
      const failure = publicLafeaFailure(
        error,
        'EMP1_WORKBENCH_RUN_INPUT_REJECTED',
        'EMP.1 source binding was rejected.',
      );
      return Object.freeze({ status: 'REJECTED', ...failure });
    }
  }

  getEmp1RunInput() { return this.emp1RunInput; }
  getEmp1Execution() { return this.emp1Execution; }
  getEmp1EngineeringReviewRecord() { return this.emp1EngineeringReviewRecord; }

  getEmp1EngineeringReviewWorkspace() {
    const context = this.emp1EngineeringReviewContext();
    return projectEmp1EngineeringReviewWorkspace({
      reviewRecord: this.emp1EngineeringReviewRecord,
      ...context,
    });
  }

  submitEmp1EngineeringReview(request = {}) {
    try {
      const context = this.emp1EngineeringReviewContext();
      const record = createEmp1WorkspaceEngineeringReview({
        disposition: request.disposition,
        reviewerIdentity: request.reviewerIdentity,
        reviewerRole: request.reviewerRole,
        comment: request.comment,
        reviewedAt: String(this.emp1ReviewClock()),
        ...context,
      });
      this.emp1EngineeringReviewRecord = record;
      const workspace = projectEmp1EngineeringReviewWorkspace({
        reviewRecord: record,
        ...context,
      });
      if (this.unsubscribe) this.view.render(this.getState());
      return Object.freeze({ status: 'RECORDED', reviewRecord: record, workspace });
    } catch (error) {
      const failure = publicLafeaFailure(
        error,
        'EMP1_ENGINEERING_REVIEW_REJECTED',
        'EMP.1 engineering review could not be recorded.',
      );
      return Object.freeze({
        status: 'REJECTED',
        ...failure,
        blockers: Object.freeze([...(error?.blockers ?? [])]),
      });
    }
  }

  emp1EngineeringReviewContext() {
    const state = this.getState();
    const routeAuthority = currentEmp1WorkbenchRouteAuthority();
    const readiness = projectEmp1WorkbenchRunReadiness({
      aDocument: state.stages?.['LAFEA.1']?.document,
      bDocument: state.stages?.['LAFEA.2']?.document,
      runInput: this.emp1RunInput,
    });
    const executionCurrentness = classifyEmp1WorkbenchExecutionCurrentness({
      execution: this.emp1Execution,
      aDocument: state.stages?.['LAFEA.1']?.document,
      bDocument: state.stages?.['LAFEA.2']?.document,
      runInput: this.emp1RunInput,
      currentRouteAuthority: routeAuthority,
    });
    const cState = projectEmp1WorkbenchCState({
      readiness,
      execution: this.emp1Execution,
      currentness: executionCurrentness,
      routeAuthority,
    });
    return Object.freeze({
      execution: this.emp1Execution,
      executionCurrentness,
      cState,
    });
  }

  async runEmp1Product() {
    const state = this.getState();
    const readiness = projectEmp1WorkbenchRunReadiness({
      aDocument: state.stages?.['LAFEA.1']?.document,
      bDocument: state.stages?.['LAFEA.2']?.document,
      runInput: this.emp1RunInput,
    });
    if (!readiness.runAuthorized) {
      this.emp1RunFailure = Object.freeze({
        code: 'EMP1_WORKBENCH_RUN_NOT_READY',
        message: readiness.reasons.join(', '),
      });
      if (this.unsubscribe) this.view.render(state);
      return Object.freeze({ status: 'BLOCKED', reasons: readiness.reasons });
    }

    const serial = ++this.emp1RunSerial;
    this.emp1RunFailure = null;
    try {
      const { executeEmp1WorkbenchProduct } = await import('./emp1-workbench-product-run.js');
      const execution = await executeEmp1WorkbenchProduct({
        aDocument: state.stages['LAFEA.1'].document,
        bDocument: state.stages['LAFEA.2'].document,
        runInput: this.emp1RunInput,
        previous: this.emp1Execution,
      });
      if (serial !== this.emp1RunSerial || DESTROYED_CONTROLLERS.has(this)) return null;
      this.emp1Execution = execution;
      this.emp1RunFailure = null;
      if (this.unsubscribe) this.view.render(this.getState());
      return execution;
    } catch (error) {
      if (serial !== this.emp1RunSerial || DESTROYED_CONTROLLERS.has(this)) return null;
      this.emp1Execution = null;
      this.emp1RunFailure = publicLafeaFailure(
        error,
        'EMP1_WORKBENCH_RUN_FAILED',
        'EMP.1 execution failed.',
      );
      if (this.unsubscribe) this.view.render(this.getState());
      return Object.freeze({ status: 'FAILED', ...this.emp1RunFailure });
    }
  }

  run() { return this.store.run(); }
  undo() { return this.store.undo(); }
  redo() { return this.store.redo(); }
  getState() { return this.store.getState(); }

  /** Observe workbench state without reaching into the store from outside. */
  subscribe(listener) { return this.store.subscribe(listener); }

  downloadDocument() {
    const value = this.exportDocument();
    downloadLafeaJson(this.documentRef, value, `${lafeaStageFilename(value.stageId)}-document.json`);
    return value;
  }

  downloadAnalysisMeshEvidence(stageId = this.getState().activeStageId) {
    const value = this.exportAnalysisMeshEvidence(stageId);
    if (!value) return null;
    downloadLafeaJson(this.documentRef, value, `${lafeaStageFilename(stageId)}-analysis-mesh-evidence.json`);
    return value;
  }

  destroy() {
    if (DESTROYED_CONTROLLERS.has(this)) return;
    DESTROYED_CONTROLLERS.add(this);
    this.emp1RunSerial += 1;
    this.emp1RunInput = null;
    this.emp1Execution = null;
    this.emp1RunFailure = null;
    this.emp1EngineeringReviewRecord = null;
    this.emp1ReviewClock = null;
    const accessoryPanelManager = ACCESSORY_PANEL_MANAGERS.get(this);
    accessoryPanelManager?.destroy();
    ACCESSORY_PANEL_MANAGERS.delete(this);
    this.benchmarkPanel?.destroy();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.store.destroy();
    this.view.destroy();
    destroyLafeaWorkbenchRenderEvidence(this);
    this.rootElement = null;
  }
}