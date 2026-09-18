import './index.css';
import './workspace/workspace.css';
import './workspace/dataset.css';
import './workspace/viewport-renderer.css';
import './workspace/analysis-session.css';
import './workspace/analysis-ledger.css';
import './workspace/enrichment/first-cut-workbench.css';
import './workspace/linear-piping-results-workbench.css';
import './workspace/lfea-preflight-phase1.css';
import './workspace/empirical-v3-safety-workbench.css';
import './workspace/lfea-pipeline-shell.css';
import { bootstrapAnalysisWorkspace } from './workspace/bootstrap.js';
import { LfeaPipelineShellController } from './workspace/lfea-pipeline-shell-controller.js';
import { mountLfeaGlobalSettingsPopover } from './workspace/lfea-global-settings-popover.js';
import { buildInputXmlRunRequestCase } from './core/linear-piping-analysis-consumer/inputxml-run-request-cases.js';
import { LINEAR_PIPING_WORKBENCH_RUN_REQUEST_SCHEMA } from './workspace/linear-piping-run-request.js';
import { WORKSPACE_ANALYSIS_TARGET_ID } from './workspace/analysis-context.js';
import { authorizedEnrichmentConsumerController } from './workspace/enrichment/authorized-enrichment-runtime.js';
import { createAuthorizedEnrichmentWorkspaceApi } from './workspace/enrichment/authorized-enrichment-workspace-api.js';
import {
  clearEmpiricalV3GovernedPreparedExecution,
  EMPIRICAL_V3_ANALYSIS_CAPABILITY_ID,
  getEmpiricalV3GovernedPreparedExecution,
  setEmpiricalV3GovernedPreparedExecution,
} from './workspace/engineering-loads/adapters/empirical-v3-analysis-capability.js';
import { buildEmpiricalV3SourceBoundExecutionDependency } from './workspace/engineering-loads/adapters/empirical-v3-authorized-source-bound-execution.js';
import {
  applyEmpiricalV3LiveAuditReadiness,
  applyEmpiricalV3LiveResultReview,
  createEmpiricalV3LiveAuditExport,
  reconcileEmpiricalV3LiveAuthorization,
} from './workspace/engineering-loads/adapters/empirical-v3-live-run-orchestration.js';
import { ENGINEERING_MODEL_EVENTS } from './workspace/engineering-model-controller.js';
import { EventBus } from './workspace/event-bus.js';
import { retireStandaloneInputXmlAnalyzerEntry } from './workspace/linear-piping-analyzer-integration.js';
import { mountLinearPipingInputXmlSourceWorkflow } from './workspace/linear-piping-inputxml-source-workflow.js';
import { mountLfeaPipelineStagedJsonInputPanel } from './workspace/lfea-pipeline-stagedjson-input-panel.js';
import { mountLfeaPipelineAccdbInputPanel } from './workspace/lfea-pipeline-accdb-input-panel.js';
import { mountLfeaPipelineVerificationDrawer } from './workspace/lfea-pipeline-verification-drawer.js';
import { mergeAuthoredInputXmlLinearPhysicalCase } from './core/linear-piping-analysis-consumer/inputxml-linear-authored-physical-cases.js';
import { mountLinearPipingResultsWorkbench } from './workspace/linear-piping-results-workbench.js';
import { mountLfeaPreflightUi } from './workspace/lfea-preflight-ui.js';
import { mountEmpiricalV3SafetyWorkbench } from './workspace/empirical-v3-safety-workbench.js';
import { EVENT_TOPICS } from './workspace/event-topics.js';
import { SUPPORT_RESTRAINT_EVENTS } from './workspace/support-restraint-events.js';
import { diagnoseAccdbCollinearBacktracks } from './core/linear-piping-analysis-consumer/accdb-collinear-backtrack-diagnosis.js';
import { TOPOLOGY_EVENTS } from './workspace/topology-events.js';
import {
  LFEA_ENGINEERING_PREPARATION_OWNERS,
  LFEA_ENGINEERING_SOURCE_KINDS,
  createLfeaEngineeringSession,
  lfeaSessionPreFlight,
  lfeaSessionPreparationOwner,
  lfeaSessionSourceKind,
} from './workspace/lfea-session/lfea-engineering-session.js';

const applicationRoot = document.getElementById('root');
const coreWorkspace = bootstrapAnalysisWorkspace(applicationRoot);
globalThis.AnalysisWorkspace = coreWorkspace;
const authorizedEnrichmentApi = createAuthorizedEnrichmentWorkspaceApi({
  documentRef: applicationRoot.ownerDocument,
  controller: authorizedEnrichmentConsumerController,
  onEmpiricalAuthorizationChanged(state) { EventBus.publish(ENGINEERING_MODEL_EVENTS.CHANGED, { reason: 'authorization-changed', authorizationState: state }); },
  onEmpiricalChanged(execution) { EventBus.publish(ENGINEERING_MODEL_EVENTS.CHANGED, { reason: 'calculated', distribution: execution.distribution, execution }); },
  onEmpiricalFailed(error) { EventBus.publish(ENGINEERING_MODEL_EVENTS.FAILED, { message: error instanceof Error ? error.message : String(error), code: error?.code || 'EMPIRICAL_RUNTIME_EXECUTION_FAILED' }); },
});
const lfeaApplicationView = applicationRoot.querySelector('[data-application-view="LFEA"]');
const linearPipingConsumerRoot = applicationRoot.querySelector('[data-role="linear-piping-consumer-root"]');
const lfeaPipelineShellRoot = applicationRoot.ownerDocument.createElement('div');
lfeaPipelineShellRoot.dataset.role = 'lfea-pipeline-shell-root';
lfeaApplicationView.insertBefore(lfeaPipelineShellRoot, linearPipingConsumerRoot);
const lfeaPipelineShell = new LfeaPipelineShellController(lfeaPipelineShellRoot).init();
lfeaPipelineShell.getSourceHost().append(linearPipingConsumerRoot);
const lfeaEngineeringSession = createLfeaEngineeringSession();
let lfeaAnalysisSurface = null;
let lfeaStepGuidanceReady = false;
let lfeaStagedJsonHandoff = null;
const lfeaEngineeringSessionUnsubscribe = lfeaEngineeringSession.subscribe((_state, event) => {
  if (['SOURCE_REPLACED', 'SOURCE_CLEARED', 'PREFLIGHT_CHANGED'].includes(event?.type)) {
    invalidateLfeaDownstreamPresentation(event.type);
  }
});

const linearPipingInputXmlSource = mountLinearPipingInputXmlSourceWorkflow(applicationRoot, {
  documentRef: applicationRoot.ownerDocument,
  onStateChanged: (snapshot) => {
    if (lfeaStepGuidanceReady) {
      if (snapshot.fileName !== null && lfeaAccdbInputPanel.getSnapshot().fileName !== null) {
        lfeaAccdbInputPanel.clear();
      }
      syncLfeaInputXmlEngineeringSession(snapshot);
    }
    lfeaAnalysisSurface?.refreshLoadCaseStep();
    lfeaAnalysisSurface?.refreshSourceStep();
    refreshLfeaStepGuidance();
  },
});
const lfeaStagedJsonInputPanel = mountLfeaPipelineStagedJsonInputPanel(lfeaPipelineShell.getSourceHost(), {
  documentRef: applicationRoot.ownerDocument,
  onConversionComplete: (result) => {
    const staged = lfeaStagedJsonInputPanel.getSnapshot();
    lfeaStagedJsonHandoff = Object.freeze({
      identityKey: `STAGED_JSON:${staged.fileName ?? result.outputName}`,
      fileName: staged.fileName ?? result.outputName,
      provenance: Object.freeze({
        derivedInputXmlFileName: result.outputName,
        diagnosticsSummary: result.diagnostics?.summary ?? null,
      }),
    });
    try {
      return linearPipingInputXmlSource.loadSource(
        { fileName: result.outputName, content: result.inputXmlText },
        { fallbackUnit: 'mm' },
      );
    } finally {
      lfeaStagedJsonHandoff = null;
    }
  },
  onClear: () => linearPipingInputXmlSource.clear(),
});
const lfeaAccdbInputPanel = mountLfeaPipelineAccdbInputPanel(lfeaPipelineShell.getSourceHost(), {
  documentRef: applicationRoot.ownerDocument,
  onStateChanged: (snapshot) => {
    if (lfeaStepGuidanceReady) {
      if (snapshot.fileName !== null && snapshot.elementCount !== null
        && linearPipingInputXmlSource.getSnapshot().fileName !== null) {
        linearPipingInputXmlSource.clear();
      }
      syncLfeaAccdbEngineeringSession(snapshot);
    }
    refreshLfeaStepGuidance();
  },
});
const lfeaAnalysisSurfaceReady = import('./workspace/lfea-pipeline-analysis-surface.js')
  .then(({ mountLfeaPipelineAnalysisSurface }) => {
    lfeaAnalysisSurface = mountLfeaPipelineAnalysisSurface({
      documentRef: applicationRoot.ownerDocument,
      loadCaseHost: lfeaPipelineShell.getLoadCaseHost(),
      resultsHost: lfeaPipelineShell.getResultsHost(),
      getPreFlight: () => activeLfeaPreFlight(),
      onAuthorizePreFlight: (approval) => authorizeActiveLfeaPreFlight(approval),
      onContinueFromErrorCheck: () => lfeaPipelineShell.setActiveStep('LOAD_CASE'),
      onApplyCaseSelection: (caseIds) => applyLfeaCaseSelection(caseIds),
      onAnalyze: (caseIds) => runLfeaPipelineAnalysis(caseIds),
      onExportCsv: (csvText, fileName) => downloadLfeaCsv(csvText, fileName),
      sourceHost: lfeaPipelineShell.getSourceHost(),
      getSourceText: () => lfeaSessionPreparationOwner(lfeaEngineeringSession.getState())
        === LFEA_ENGINEERING_PREPARATION_OWNERS.INPUTXML
        ? linearPipingInputXmlSource.getSourceText()
        : null,
      // An ACCDB import gets the same backtrack diagnosis, without an Apply
      // button: its geometry belongs to the file, so the correction is reported
      // for the engineer to make in CAESAR rather than applied here.
      getAccdbDiagnosis: () => {
        if (lfeaSessionPreparationOwner(lfeaEngineeringSession.getState())
          !== LFEA_ENGINEERING_PREPARATION_OWNERS.ACCDB) return null;
        const rows = lfeaAccdbInputPanel.getElementRows();
        return rows === null ? null : diagnoseAccdbCollinearBacktracks(rows);
      },
      onRepaired: (repairedXml) => {
        if (lfeaSessionPreparationOwner(lfeaEngineeringSession.getState())
          !== LFEA_ENGINEERING_PREPARATION_OWNERS.INPUTXML) {
          throw new Error('Model repair is only available for the active InputXML-derived source.');
        }
        const fileName = linearPipingInputXmlSource.getSnapshot().fileName ?? 'model.xml';
        linearPipingInputXmlSource.loadSource(
          { fileName: `${fileName.replace(/\.xml$/iu, '')}.corrected.xml`, content: repairedXml },
          { fallbackUnit: 'mm' },
        );
      },
      getNodeIds: () => activeLfeaPreFlight()
        ?.preparation?.structuralPreparation?.conditionedTopology?.geometry?.nodes
        ?.map((node) => node.id) ?? [],
    });
    lfeaAnalysisSurface.refreshLoadCaseStep();
    lfeaAnalysisSurface.refreshSourceStep();
    return lfeaAnalysisSurface;
  });

syncLfeaEngineeringSessionFromControllers();
lfeaStepGuidanceReady = true;
refreshLfeaStepGuidance();
const lfeaVerificationDrawer = mountLfeaPipelineVerificationDrawer(lfeaPipelineShell.getVerificationDrawerHost(), {
  documentRef: applicationRoot.ownerDocument,
});
const linearPipingResultsMountRoot = { querySelector: () => lfeaPipelineShell.getResultsHost() };
const linearPipingResults = mountLinearPipingResultsWorkbench(linearPipingResultsMountRoot, { documentRef: applicationRoot.ownerDocument, urlApi: applicationRoot.ownerDocument.defaultView?.URL });
const globalSettingsPopover = mountLfeaGlobalSettingsPopover(
  applicationRoot.querySelector('.application-navigation-shell'),
  { getProfile: () => coreWorkspace.getEngineeringSettingsProfile() },
);
let lfeaAuthoritySupplement = null;
lfeaPipelineShell.setAssemblyHandlers({
  onStepActivated(stepId) {
    if (stepId === 'LOAD_CASE') {
      lfeaAnalysisSurface?.refreshLoadCaseStep();
    }
  },
  async onAuthoritySupplementSelected(file) {
    if (!file) {
      lfeaAuthoritySupplement = null;
      lfeaPipelineShell.setAuthoritySupplementStatus('No authority supplement loaded');
      return;
    }
    try {
      const parsed = JSON.parse(await file.text());
      requireLfeaAuthoritySupplementShape(parsed);
      lfeaAuthoritySupplement = parsed;
      lfeaPipelineShell.setAuthoritySupplementStatus(`Loaded: ${file.name}`);
    } catch (error) {
      lfeaAuthoritySupplement = null;
      lfeaPipelineShell.setAuthoritySupplementStatus(`Rejected: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
  async onLoadSample() {
    // A real benchmark model rather than a hand-authored toy: BM4's own
    // InputXML, which the repository already validates against. It still
    // carries its three collinear backtracks, so loading it also puts the
    // model-repair panel in front of a model that genuinely needs it.
    const sampleUrl = `${import.meta.env.BASE_URL}fixtures/lfea-sample-inputxml-bm4.xml`;
    try {
      lfeaPipelineShell.setAssembleStatus('Loading sample model…', false);
      const response = await fetch(sampleUrl);
      if (!response.ok) throw new Error(`sample fetch returned ${response.status}`);
      const content = await response.text();
      linearPipingInputXmlSource.loadSource(
        { fileName: 'InputXML_BM4.sample.xml', content },
        { fallbackUnit: 'mm' },
      );
      lfeaPipelineShell.setActiveStep('INPUT');
      lfeaPipelineShell.setAssembleStatus('Sample model loaded. Continue on Error check.', false);
    } catch (error) {
      lfeaPipelineShell.setAssembleStatus(
        `Could not load the sample model: ${error instanceof Error ? error.message : String(error)}`,
        true,
      );
    }
  },
  onAssembleAndSendToRun() {
    try {
      const runRequest = assembleLfeaInputXmlRunRequest();
      lfeaPipelineShell.setActiveStep('LOAD_CASE');
      lfeaPipelineShell.setStepStatus('ERROR_CHECK', { complete: true });
      const existingCheck = linearPipingResults.getPreRunCheck();
      const alreadyAuthorized = existingCheck?.applicationId === runRequest.applicationId
        && existingCheck.solveAuthorized;
      const preRunCheck = alreadyAuthorized ? existingCheck : linearPipingResults.checkRequest(runRequest);
      if (preRunCheck.status === 'BLOCK') {
        throw new Error(`Pre-run gate BLOCK for ${preRunCheck.applicationId}.`);
      }
      if (!preRunCheck.solveAuthorized) {
        lfeaPipelineShell.setActiveStep('RUN');
        lfeaPipelineShell.setAssembleStatus(
          `Assembled ${runRequest.applicationId} (${runRequest.cases.length} case(s)) — pre-run gate WARN. Review the disclosed limitations below, accept explicitly, then click Assemble & send to Run again.`,
          false,
        );
        return;
      }
      linearPipingResults.runRequest(runRequest);
      lfeaPipelineShell.setStepStatus('LOAD_CASE', { complete: true });
      lfeaPipelineShell.setAssembleStatus(`Sent to Run: ${runRequest.applicationId} (${runRequest.cases.length} case(s)).`, false);
      lfeaPipelineShell.setActiveStep('RUN');
    } catch (error) {
      lfeaPipelineShell.setAssembleStatus(error instanceof Error ? error.message : String(error), true);
    }
  },
});

function activeLfeaPreFlight() {
  return lfeaSessionPreFlight(lfeaEngineeringSession.getState());
}

/** Delegate visible Error Check consent to the active source authority owner. */
function authorizeActiveLfeaPreFlight(approval) {
  const owner = lfeaSessionPreparationOwner(lfeaEngineeringSession.getState());
  if (owner === LFEA_ENGINEERING_PREPARATION_OWNERS.INPUTXML) {
    return linearPipingInputXmlSource.authorizePreFlight(approval);
  }
  if (owner === LFEA_ENGINEERING_PREPARATION_OWNERS.ACCDB) {
    return lfeaAccdbInputPanel.authorizePreFlight(approval);
  }
  throw new Error('Load and prepare a model before authorizing Error Check limitations.');
}

function applyLfeaCaseSelection(caseIds) {
  const owner = lfeaSessionPreparationOwner(lfeaEngineeringSession.getState());
  if (owner === LFEA_ENGINEERING_PREPARATION_OWNERS.INPUTXML) {
    return linearPipingInputXmlSource.setRequestedCaseIds(caseIds);
  }
  if (owner === LFEA_ENGINEERING_PREPARATION_OWNERS.ACCDB) {
    return lfeaAccdbInputPanel.setRequestedCaseIds(caseIds);
  }
  throw new Error('Load a model before applying a load-case selection.');
}

function syncLfeaEngineeringSessionFromControllers() {
  const inputXml = linearPipingInputXmlSource.getSnapshot();
  const accdb = lfeaAccdbInputPanel.getSnapshot();
  if (inputXml.fileName !== null) {
    syncLfeaInputXmlEngineeringSession(inputXml);
  } else if (accdb.fileName !== null && accdb.elementCount !== null) {
    syncLfeaAccdbEngineeringSession(accdb);
  }
}

function syncLfeaInputXmlEngineeringSession(snapshot) {
  if (snapshot?.fileName === null || snapshot?.fileName === undefined) {
    lfeaEngineeringSession.clearSource(LFEA_ENGINEERING_PREPARATION_OWNERS.INPUTXML);
    return;
  }
  const preFlight = linearPipingInputXmlSource.getPreFlight();
  const providerIdentityKey = snapshot.contentSha256
    ?? preFlight?.semanticHash
    ?? `INPUTXML:${snapshot.fileName}`;
  const current = lfeaEngineeringSession.getState();
  const retainStagedIdentity = lfeaStagedJsonHandoff === null
    && current.source.kind === LFEA_ENGINEERING_SOURCE_KINDS.STAGED_JSON
    && current.source.preparationOwner === LFEA_ENGINEERING_PREPARATION_OWNERS.INPUTXML
    && current.source.providerIdentityKey === providerIdentityKey;
  const staged = lfeaStagedJsonHandoff;
  lfeaEngineeringSession.setSource({
    kind: staged || retainStagedIdentity
      ? LFEA_ENGINEERING_SOURCE_KINDS.STAGED_JSON
      : LFEA_ENGINEERING_SOURCE_KINDS.INPUTXML,
    identityKey: staged?.identityKey
      ?? (retainStagedIdentity ? current.source.identityKey : providerIdentityKey),
    providerIdentityKey,
    preparationOwner: LFEA_ENGINEERING_PREPARATION_OWNERS.INPUTXML,
    fileName: staged?.fileName
      ?? (retainStagedIdentity ? current.source.fileName : snapshot.fileName),
    provenance: staged?.provenance
      ?? (retainStagedIdentity ? current.source.provenance : Object.freeze({})),
    preFlight,
    requestedProfileId: snapshot.requestedProfileId,
    requestedCaseIds: snapshot.requestedCaseIds,
  });
}

function syncLfeaAccdbEngineeringSession(snapshot) {
  if (snapshot?.fileName === null || snapshot?.fileName === undefined || snapshot.elementCount === null) {
    lfeaEngineeringSession.clearSource(LFEA_ENGINEERING_PREPARATION_OWNERS.ACCDB);
    return;
  }
  const preFlight = lfeaAccdbInputPanel.getPreFlight();
  const identityKey = preFlight?.intake?.contentSha256
    ?? preFlight?.semanticHash
    ?? `ACCDB:${snapshot.fileName}:OVERRIDES=${snapshot.overrideCount ?? 0}`;
  lfeaEngineeringSession.setSource({
    kind: LFEA_ENGINEERING_SOURCE_KINDS.ACCDB,
    identityKey,
    providerIdentityKey: identityKey,
    preparationOwner: LFEA_ENGINEERING_PREPARATION_OWNERS.ACCDB,
    fileName: snapshot.fileName,
    provenance: Object.freeze({ overrideCount: snapshot.overrideCount ?? 0 }),
    preFlight,
    requestedProfileId: snapshot.requestedProfileId,
    requestedCaseIds: preFlight?.preparation?.requestedCaseIds ?? [],
  });
}

function invalidateLfeaDownstreamPresentation(reason) {
  lfeaAnalysisSurface?.analysisController.clear();
  lfeaAnalysisSurface?.resultsPanel.setState(null);
  for (const stepId of ['LOAD_CASE', 'RUN', 'OUTPUT', 'EXPORT']) {
    lfeaPipelineShell.setStepStatus(stepId, { complete: false });
  }
  if (reason) lfeaPipelineShell.setAssembleStatus(`Analysis state invalidated: ${reason}.`, false);
}

/**
 * Run, Output and Export follow from an analysis having been run, so they are
 * stated here rather than left at the session's default. The session defaults
 * every step to available, and refreshLfeaStepGuidance only ever set Input,
 * Error check and Load case -- so with nothing loaded at all, the stepper
 * advertised Run, Output and Export as "ready", which is three steps of
 * outright false encouragement on an empty screen.
 */
function setLfeaDownstreamStepAvailability(analysisReady, blockedReason) {
  for (const stepId of ['RUN', 'OUTPUT', 'EXPORT']) {
    lfeaPipelineShell.setStepStatus(stepId, {
      available: analysisReady,
      blockedReason: analysisReady ? null : blockedReason,
    });
  }
}

function refreshLfeaStepGuidance() {
  if (!lfeaStepGuidanceReady) return;
  const engineering = lfeaEngineeringSession.getState();
  const sourceKind = lfeaSessionSourceKind(engineering);
  const owner = lfeaSessionPreparationOwner(engineering);
  const inputXml = owner === LFEA_ENGINEERING_PREPARATION_OWNERS.INPUTXML
    ? linearPipingInputXmlSource.getSnapshot()
    : null;
  const accdb = owner === LFEA_ENGINEERING_PREPARATION_OWNERS.ACCDB
    ? lfeaAccdbInputPanel.getSnapshot()
    : null;
  const inputXmlLoaded = inputXml?.fileName !== null && inputXml !== null;
  const accdbLoaded = accdb?.fileName !== null && accdb?.elementCount !== null && accdb !== null;
  const sourceLoaded = sourceKind !== LFEA_ENGINEERING_SOURCE_KINDS.NONE
    && (inputXmlLoaded || accdbLoaded);

  lfeaPipelineShell.setActiveSourceKind(
    owner === LFEA_ENGINEERING_PREPARATION_OWNERS.INPUTXML
      ? 'INPUTXML'
      : owner === LFEA_ENGINEERING_PREPARATION_OWNERS.ACCDB ? 'ACCDB' : 'NONE',
  );

  lfeaPipelineShell.setStepStatus('INPUT', {
    available: true,
    complete: sourceLoaded,
    detail: sourceLoaded
      ? `Loaded ${engineering.source.fileName}.`
      : 'Import an InputXML, StagedJSON or CAESAR II ACCDB model.',
  });

  if (inputXmlLoaded) {
    const cleared = inputXml.preFlightStatus === 'PASS' || inputXml.preFlightSolveAuthorized;
    const blocked = inputXml.preFlightStatus === 'BLOCK';
    lfeaPipelineShell.setStepStatus('ERROR_CHECK', {
      available: true,
      complete: cleared,
      detail: cleared
        ? 'Pre-flight cleared.'
        : blocked
          ? 'Pre-flight BLOCK — resolve the blocking findings below.'
          : 'Review the disclosed limitations and accept them to proceed.',
    });
    lfeaPipelineShell.setStepStatus('LOAD_CASE', {
      available: cleared,
      detail: cleared ? 'Choose the cases to analyze, then Analyze.' : null,
      blockedReason: cleared ? null : 'The pre-flight is not authorized yet — clear Error check first.',
    });
    setLfeaDownstreamStepAvailability(cleared, 'Clear Error check, then choose load cases and Analyze.');
    return;
  }

  if (accdbLoaded) {
    const cleared = accdb.preFlightStatus === 'PASS' || accdb.preFlightSolveAuthorized;
    const failed = accdb.preFlightStatus === 'FAILED';
    lfeaPipelineShell.setStepStatus('ERROR_CHECK', {
      available: true,
      complete: cleared,
      detail: cleared
        ? 'Pre-flight cleared.'
        : failed
          ? `Pre-flight could not be prepared: ${accdb.preFlightError}`
          : `Pre-flight ${accdb.preFlightStatus} — see the grouped findings.`,
    });
    lfeaPipelineShell.setStepStatus('LOAD_CASE', {
      available: cleared,
      detail: cleared ? `Choose from ${accdb.availableCaseIds.length} case(s), then Analyze.` : null,
      blockedReason: cleared
        ? null
        : failed
          ? `The ACCDB pre-flight failed closed: ${accdb.preFlightError}`
          : 'The ACCDB pre-flight is not authorized yet — clear the blocking findings on Error check first.',
    });
    setLfeaDownstreamStepAvailability(cleared, 'Clear Error check, then choose load cases and Analyze.');
    return;
  }

  lfeaPipelineShell.setStepStatus('ERROR_CHECK', {
    available: false,
    blockedReason: 'Load a model on the Input step first.',
  });
  lfeaPipelineShell.setStepStatus('LOAD_CASE', {
    available: false,
    blockedReason: 'Load a model on the Input step first.',
  });
  setLfeaDownstreamStepAvailability(false, 'Load a model on the Input step first.');
}

function runLfeaPipelineAnalysis(caseIds) {
  try {
    const preFlight = activeLfeaPreFlight();
    if (!preFlight) throw new Error('Load a model and run Error check before analyzing.');
    const requested = preFlight.preparation.requestedCaseIds ?? [];
    const missing = caseIds.filter((caseId) => !requested.includes(caseId));
    if (missing.length > 0) {
      throw new Error(`Choose "Apply selection" first — ${missing.join(', ')} is not in the current pre-flight.`);
    }
    if (lfeaAnalysisSurface === null) throw new Error('The analysis surface is still loading; try again in a moment.');
    const state = lfeaAnalysisSurface.analysisController.analyze(preFlight, caseIds);
    lfeaEngineeringSession.bindAnalysisResult(state);
    lfeaAnalysisSurface.resultsPanel.setState(state);
    lfeaPipelineShell.setStepStatus('LOAD_CASE', { complete: true });
    lfeaPipelineShell.setStepStatus('RUN', { complete: true });
    lfeaPipelineShell.setActiveStep('OUTPUT');
    return state;
  } catch (error) {
    lfeaPipelineShell.setAssembleStatus(error instanceof Error ? error.message : String(error), true);
    throw error;
  }
}

function downloadLfeaCsv(csvText, fileName) {
  const doc = applicationRoot.ownerDocument;
  const view = doc.defaultView;
  const urlApi = view?.URL;
  if (!urlApi?.createObjectURL || typeof view.Blob !== 'function') return false;
  const url = urlApi.createObjectURL(new view.Blob([csvText], { type: 'text/csv' }));
  const anchorNode = doc.createElement('a');
  anchorNode.href = url;
  anchorNode.download = fileName;
  anchorNode.click();
  urlApi.revokeObjectURL(url);
  return true;
}

function requireLfeaAuthoritySupplementShape(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Authority supplement must be a JSON object.');
  }
  for (const key of ['applicationId', 'interfaceAuthority', 'nozzleAllowableProfiles', 'b31Authority']) {
    if (!(key in value)) throw new TypeError(`Authority supplement is missing "${key}".`);
  }
}

function assembleLfeaInputXmlRunRequest() {
  if (lfeaSessionPreparationOwner(lfeaEngineeringSession.getState())
    !== LFEA_ENGINEERING_PREPARATION_OWNERS.INPUTXML) {
    throw new Error('Optional interface/B31 code checks currently require an active InputXML-derived source.');
  }
  if (!lfeaAuthoritySupplement) {
    throw new Error(
      'Nozzle interface mechanics and B31 code checks need an authority supplement '
      + '(interface authority, nozzle allowables, B31 edition data) — licensed project data '
      + 'no InputXML file carries. For displacements, support loads and element forces, '
      + 'use Analyze on the Load case step instead; it needs none of this.',
    );
  }
  const snapshot = linearPipingInputXmlSource.getSnapshot();
  const preFlight = activeLfeaPreFlight();
  if (!snapshot.preFlightSolveAuthorized || !preFlight?.solveAuthorized) {
    throw new Error('Authorize the active InputXML-derived pre-flight before assembling a run request.');
  }
  const authorizedCaseIds = preFlight.preparation.authorizedCaseCandidates.map((row) => row.caseId);
  const applicationId = lfeaAuthoritySupplement.applicationId;
  const authoredCasePayload = lfeaAnalysisSurface?.loadCaseAuthoringPanel.getAuthoredCasePayload() ?? null;
  let authoredPreparation = preFlight.preparation;
  let authoredCaseId = null;
  if (authoredCasePayload) {
    const mergedPhysicalPreparation = mergeAuthoredInputXmlLinearPhysicalCase(
      preFlight.preparation.physicalPreparation,
      authoredCasePayload,
    );
    authoredPreparation = { ...preFlight.preparation, physicalPreparation: mergedPhysicalPreparation };
    authoredCaseId = mergedPhysicalPreparation.physicalCases
      .map((row) => row.caseId)
      .find((caseId) => !authorizedCaseIds.includes(caseId));
  }

  if (authorizedCaseIds.length === 0 && !authoredCaseId) {
    throw new Error('No authorized physical cases are available from this pre-flight to assemble.');
  }
  const cases = authorizedCaseIds.map((caseId) => ({
    caseId,
    inputXmlAnalysisRequest: buildInputXmlRunRequestCase({
      intake: preFlight.intake,
      preparation: preFlight.preparation,
      caseId,
      analysisIdentity: `${applicationId}-${caseId}`,
      analysisRevision: 1,
    }),
  }));
  if (authoredCaseId) {
    cases.push({
      caseId: authoredCaseId,
      inputXmlAnalysisRequest: buildInputXmlRunRequestCase({
        intake: preFlight.intake,
        preparation: authoredPreparation,
        caseId: authoredCaseId,
        analysisIdentity: `${applicationId}-${authoredCaseId}`,
        analysisRevision: 1,
      }),
    });
  }
  return {
    schema: LINEAR_PIPING_WORKBENCH_RUN_REQUEST_SCHEMA,
    applicationId,
    cases,
    interfaceAuthority: lfeaAuthoritySupplement.interfaceAuthority,
    nozzleAllowableProfiles: lfeaAuthoritySupplement.nozzleAllowableProfiles,
    b31Authority: lfeaAuthoritySupplement.b31Authority,
  };
}
let empiricalV3ObservedDatasetBasis = null;
const empiricalV3Safety = mountEmpiricalV3SafetyWorkbench(applicationRoot, {
  documentRef: applicationRoot.ownerDocument,
  urlApi: applicationRoot.ownerDocument.defaultView?.URL,
  isRunReady(packageValue) { return preparedExecutionMatchesPackage(getEmpiricalV3GovernedPreparedExecution(), packageValue); },
  onRunRequested({ packageValue }) {
    return runPreparedEmpiricalV3ThroughAnalysisCoordinator(packageValue);
  },
  onResultReviewCreated(receipt, packageValue, evidence) {
    return applyEmpiricalV3LiveResultReview({ packageValue, evidence, resultReview: receipt, auditMetadata: receipt.auditMetadata }).nextPackage;
  },
  onAuditReadinessCreated(readiness, resultReview, packageValue, evidence) {
    return applyEmpiricalV3LiveAuditReadiness({ packageValue, evidence, resultReview, auditReadiness: readiness }).nextPackage;
  },
  onAuditExportRequested({ packageValue, evidence, resultReview, auditReadiness }) {
    return createEmpiricalV3LiveAuditExport({ packageValue, evidence, resultReview, auditReadiness });
  },
});
const empiricalV3SourceSubscriptions = [
  EventBus.subscribe(EVENT_TOPICS.WORKSPACE_SNAPSHOT_CHANGED, ({ snapshot }) => {
    const nextBasis = empiricalV3DatasetBasis(snapshot);
    if (empiricalV3ObservedDatasetBasis !== null && nextBasis !== empiricalV3ObservedDatasetBasis) {
      invalidateEmpiricalV3ForGoverningChange();
    }
    empiricalV3ObservedDatasetBasis = nextBasis;
  }),
  EventBus.subscribe(ENGINEERING_MODEL_EVENTS.CHANGED, ({ reason }) => {
    if (reason === 'project-data-changed' || reason === 'master-data-changed') {
      invalidateEmpiricalV3ForGoverningChange();
    }
  }),
  EventBus.subscribe(TOPOLOGY_EVENTS.CHANGED, () => invalidateEmpiricalV3ForGoverningChange()),
  EventBus.subscribe(SUPPORT_RESTRAINT_EVENTS.CHANGED, () => invalidateEmpiricalV3ForGoverningChange()),
];
const linearPipingAnalyzerIntegration = retireStandaloneInputXmlAnalyzerEntry(applicationRoot);
const preflightUi = mountLfeaPreflightUi(applicationRoot, { getModel: () => ({ sharedModel: coreWorkspace.getSharedModel() }) });
const preflightSubscriptions = [EventBus.subscribe(EVENT_TOPICS.DATASET_LOADED, () => preflightUi.render()), EventBus.subscribe(EVENT_TOPICS.DATASET_CLEARED, () => preflightUi.render())];

const workspace = Object.freeze({
  ...coreWorkspace,
  ...authorizedEnrichmentApi,
  loadLinearPipingInputXmlSource(input, options) { return linearPipingInputXmlSource.loadSource(input, options); },
  authorizeLinearPipingInputXmlSourceUnit(unit) { return linearPipingInputXmlSource.authorizeUnit(unit); },
  authorizeLinearPipingInputXmlPreFlight(approval) { return linearPipingInputXmlSource.authorizePreFlight(approval); },
  getLinearPipingInputXmlSourceState() { return linearPipingInputXmlSource.getSnapshot(); },
  getLinearPipingInputXmlPreFlight() { return linearPipingInputXmlSource.getPreFlight(); },
  getLinearPipingInputXmlAnalyzerIntegrationPolicy() { return linearPipingAnalyzerIntegration; },
  clearLinearPipingInputXmlSource() { linearPipingInputXmlSource.clear(); },
  getLfeaEngineeringSessionState() { return lfeaEngineeringSession.getState(); },
  getLfeaStagedJsonInputPanelState() { return lfeaStagedJsonInputPanel.getSnapshot(); },
  getLfeaAccdbInputPanelState() { return lfeaAccdbInputPanel.getSnapshot(); },
  getLfeaLoadCaseAuthoringPanelState() { return lfeaAnalysisSurface?.loadCaseAuthoringPanel.getSnapshot() ?? null; },
  getLfeaCaseSelectionState() { return lfeaAnalysisSurface?.caseSelectionPanel.getSnapshot() ?? null; },
  getLfeaModelRepairState() { return lfeaAnalysisSurface?.modelRepairPanel.getSnapshot() ?? null; },
  getLfeaLayoutPanelState() { return lfeaAnalysisSurface?.layoutPanel.getSnapshot() ?? null; },
  getLfeaResultsPanelState() { return lfeaAnalysisSurface?.resultsPanel.getSnapshot() ?? null; },
  getLfeaAnalysisState() { return lfeaAnalysisSurface?.analysisController.getState() ?? null; },
  whenLfeaAnalysisSurfaceReady() { return lfeaAnalysisSurfaceReady; },
  getLfeaVerificationDrawerState() { return lfeaVerificationDrawer.getSnapshot(); },
  importLinearPipingResultPackage(value) { return linearPipingResults.loadPackage(value); },
  checkLinearPipingRunRequest(value) { return linearPipingResults.checkRequest(value); },
  getLinearPipingPreRunCheck() { return linearPipingResults.getPreRunCheck(); },
  clearLinearPipingResultPackage() { linearPipingResults.clear(); },
  getLinearPipingResultState() { return linearPipingResults.getSnapshot(); },
  getLinearPipingPresentation() { return linearPipingResults.getPresentation(); },
  createLinearPipingAuditExportRecord() { return linearPipingResults.createAuditExport(); },
  createLinearPipingEngineeringExportRecords() { return linearPipingResults.createEngineeringExports(); },
  loadEmpiricalV3SafetyPresentationPackage(value) {
    const packageValue = empiricalV3Safety.loadPackage(value);
    if (!preparedExecutionMatchesPackage(getEmpiricalV3GovernedPreparedExecution(), packageValue)) clearEmpiricalV3GovernedPreparedExecution();
    empiricalV3Safety.refresh();
    return packageValue;
  },
  loadEmpiricalV3CalculationEvidence(value) { return empiricalV3Safety.loadCalculationEvidence(value); },
  loadEmpiricalV3ResultReviewReceipt(value) { return empiricalV3Safety.loadResultReviewReceipt(value); },
  loadEmpiricalV3AuditReadiness(value) { return empiricalV3Safety.loadAuditReadiness(value); },
  reviewEmpiricalV3CalculationResult(review) { return empiricalV3Safety.reviewResult(review); },
  prepareEmpiricalV3Audit() { return empiricalV3Safety.prepareAudit(); },
  clearEmpiricalV3SafetyPresentationPackage() { clearEmpiricalV3GovernedPreparedExecution(); empiricalV3Safety.clear(); },
  getEmpiricalV3SafetyState() { return empiricalV3Safety.getSnapshot(); },
  getEmpiricalV3SafetyPresentationPackage() { return empiricalV3Safety.getPackage(); },
  getEmpiricalV3CalculationEvidence() { return empiricalV3Safety.getCalculationEvidence(); },
  getEmpiricalV3ResultReviewReceipt() { return empiricalV3Safety.getResultReviewReceipt(); },
  getEmpiricalV3AuditReadiness() { return empiricalV3Safety.getAuditReadiness(); },
  getEmpiricalV3LastConfirmationReceipt() { return empiricalV3Safety.getLastConfirmationReceipt(); },
  openEmpiricalV3SafetyRisk(riskId) { return empiricalV3Safety.openRisk(riskId); },
  buildEmpiricalV3SourceBoundExecutionDependency(romInput) { return buildEmpiricalV3SourceBoundExecutionDependency(romInput); },
  prepareEmpiricalV3SourceBoundExecution(input) { return prepareEmpiricalV3SourceBoundExecution(input); },
  clearEmpiricalV3PreparedExecution() { clearEmpiricalV3GovernedPreparedExecution(); empiricalV3Safety.refresh(); },
  getEmpiricalV3PreparedExecutionDependency() { return getEmpiricalV3GovernedPreparedExecution()?.dependency ?? null; },
  executeEmpiricalV3SourceBoundThermalRom(input) {
    const packageValue = empiricalV3Safety.getPackage();
    prepareEmpiricalV3SourceBoundExecution(input);
    return runPreparedEmpiricalV3ThroughAnalysisCoordinator(packageValue).then((result) => {
      empiricalV3Safety.loadPackage(result.nextPackage);
      empiricalV3Safety.loadCalculationEvidence(result.evidence);
      return result.execution;
    });
  },
  reconcileEmpiricalV3CurrentAuthorization(currentAuthorization, auditMetadata) {
    const result = reconcileEmpiricalV3LiveAuthorization({ packageValue: empiricalV3Safety.getPackage(), currentAuthorization, auditMetadata });
    if (!result.current) clearEmpiricalV3GovernedPreparedExecution();
    empiricalV3Safety.loadPackage(result.nextPackage); return result;
  },
  createEmpiricalV3AuditExportRecord() { return empiricalV3Safety.createAuditExport(); },
  getPreflightReviewModel() { return preflightUi.getProjection(); },
  destroy() {
    lfeaEngineeringSessionUnsubscribe();
    preflightSubscriptions.forEach((unsubscribe) => unsubscribe());
    empiricalV3SourceSubscriptions.forEach((unsubscribe) => unsubscribe());
    clearEmpiricalV3GovernedPreparedExecution();
    empiricalV3Safety.destroy();
    preflightUi.destroy();
    globalSettingsPopover.destroy();
    linearPipingResults.destroy();
    linearPipingInputXmlSource.destroy();
    lfeaStagedJsonInputPanel.destroy();
    lfeaAccdbInputPanel.destroy();
    lfeaAnalysisSurface?.destroy();
    lfeaVerificationDrawer.destroy();
    lfeaPipelineShell.destroy();
    lfeaEngineeringSession.destroy();
    coreWorkspace.destroy();
  },
});

globalThis.AnalysisWorkspace = workspace;
if (import.meta.hot) import.meta.hot.dispose(() => workspace.destroy());

function prepareEmpiricalV3SourceBoundExecution(input) {
  const packageValue = empiricalV3Safety.getPackage();
  if (!packageValue?.workflow.canRunCalculation || !packageValue.calculationAuthorization) throw new Error('Prepare execution only from CALCULATION_AUTHORIZED workflow.');
  if (input?.currentAuthorization?.runId !== packageValue.runId) throw new Error('Prepared current authorization basis belongs to another run.');
  const dependency = buildEmpiricalV3SourceBoundExecutionDependency(input?.romInput);
  requireExecutionDependencyMatchesActiveWorkspace(dependency);
  const authorized = packageValue.calculationAuthorization.dependencies.find((row) => row.kind === dependency.kind && row.ref === dependency.ref);
  if (!authorized || authorized.semanticHash !== dependency.semanticHash) throw new Error('Prepared source-bound execution request is not in the sealed calculation authorization.');
  const snapshot = coreWorkspace.getSnapshot();
  if (snapshot.status !== 'ready' || !snapshot.dataset) throw new Error('Prepared V3 execution requires an active workspace dataset.');
  setEmpiricalV3GovernedPreparedExecution({
    authorizationSemanticHash: packageValue.calculationAuthorization.semanticHash,
    currentAuthorization: input.currentAuthorization,
    romInput: input.romInput,
    auditMetadata: input.auditMetadata ?? null,
    dependency,
    packageValue,
    datasetId: snapshot.dataset.datasetId,
    workspaceVersion: snapshot.engineeringVersion,
  });
  empiricalV3Safety.refresh();
  return dependency;
}

function runPreparedEmpiricalV3ThroughAnalysisCoordinator(packageValue) {
  const prepared = getEmpiricalV3GovernedPreparedExecution();
  if (!preparedExecutionMatchesPackage(prepared, packageValue)) throw new Error('Prepare the exact current source-bound V3 execution request before Run.');

  EventBus.publish(EVENT_TOPICS.ANALYSIS_SESSION_OPEN_REQUESTED, {
    analysisType: EMPIRICAL_V3_ANALYSIS_CAPABILITY_ID,
    targetId: WORKSPACE_ANALYSIS_TARGET_ID,
  });
  const session = coreWorkspace.getAnalysisSession()?.session;
  if (!session
    || session.analysisType !== EMPIRICAL_V3_ANALYSIS_CAPABILITY_ID
    || session.targetId !== WORKSPACE_ANALYSIS_TARGET_ID
    || session.status !== 'ready') {
    throw new Error('Empirical V3 governed analysis session is not ready.');
  }

  return new Promise((resolve, reject) => {
    let unsubscribeCompleted = () => {};
    let unsubscribeFailed = () => {};
    const matches = (payload) => payload.analysisType === EMPIRICAL_V3_ANALYSIS_CAPABILITY_ID
      && payload.targetId === WORKSPACE_ANALYSIS_TARGET_ID
      && payload.sessionId === session.sessionId;
    const cleanup = () => {
      unsubscribeCompleted();
      unsubscribeFailed();
    };
    const closeSession = () => {
      try { EventBus.publish(EVENT_TOPICS.ANALYSIS_SESSION_CLOSE_REQUESTED, {}); } catch { /* lifecycle cleanup only */ }
    };

    unsubscribeCompleted = EventBus.subscribe(EVENT_TOPICS.ANALYSIS_COMPLETED, (payload) => {
      if (!matches(payload)) return;
      cleanup();
      clearEmpiricalV3GovernedPreparedExecution();
      closeSession();
      const liveResult = payload.result?.results;
      if (!liveResult?.nextPackage || !liveResult?.evidence || !liveResult?.execution) {
        reject(new Error('Empirical V3 governed analysis completed without the sealed V3 result bundle.'));
        return;
      }
      resolve(liveResult);
    });
    unsubscribeFailed = EventBus.subscribe(EVENT_TOPICS.ANALYSIS_FAILED, (payload) => {
      if (!matches(payload)) return;
      cleanup();
      clearEmpiricalV3GovernedPreparedExecution();
      closeSession();
      const error = new Error(payload.message || 'Empirical V3 governed analysis failed.');
      error.code = payload.code || 'EMP_V3_GOVERNED_ANALYSIS_FAILED';
      error.details = payload.details || {};
      reject(error);
    });

    try {
      EventBus.publish(EVENT_TOPICS.ANALYSIS_REQUESTED, {
        analysisType: EMPIRICAL_V3_ANALYSIS_CAPABILITY_ID,
        targetId: WORKSPACE_ANALYSIS_TARGET_ID,
        sessionId: session.sessionId,
      });
    } catch (error) {
      cleanup();
      clearEmpiricalV3GovernedPreparedExecution();
      closeSession();
      reject(error);
    }
  });
}

function preparedExecutionMatchesPackage(prepared, packageValue) {
  if (!prepared || !packageValue?.workflow.canRunCalculation || !packageValue.calculationAuthorization) return false;
  if (prepared.authorizationSemanticHash !== packageValue.calculationAuthorization.semanticHash) return false;
  if (!executionDependencyMatchesActiveWorkspace(prepared.dependency)) return false;
  return packageValue.calculationAuthorization.dependencies.some((row) => (
    row.kind === prepared.dependency.kind && row.ref === prepared.dependency.ref && row.semanticHash === prepared.dependency.semanticHash
  ));
}

function empiricalV3DatasetBasis(snapshot) {
  const dataset = snapshot?.status === 'ready' ? snapshot.dataset : null;
  if (!dataset) return 'NO_ACTIVE_DATASET';
  return JSON.stringify([
    dataset.datasetId ?? null,
    dataset.version ?? null,
    dataset.sourceSha256 ?? null,
    dataset.sourceSnapshot?.sourceSemanticHash ?? null,
  ]);
}

function executionDependencyMatchesActiveWorkspace(dependency) {
  if (!dependency?.request?.dataset || !empiricalV3ObservedDatasetBasis || empiricalV3ObservedDatasetBasis === 'NO_ACTIVE_DATASET') return false;
  let active;
  try { active = JSON.parse(empiricalV3ObservedDatasetBasis); } catch { return false; }
  const request = dependency.request;
  const requestDataset = request.dataset;
  const activeSharedModelSemanticHash = coreWorkspace.getSharedModel()?.semanticHash ?? null;
  const activeTopologySemanticHash = coreWorkspace.getTopologyGraph()?.semanticHash ?? null;
  const activeAttachmentSemanticHash = coreWorkspace.getSupportAttachmentModel()?.semanticHash ?? null;
  const activeRestraintSemanticHash = coreWorkspace.getRestraintCapabilityModel()?.semanticHash ?? null;
  return requestDataset.datasetId === active[0]
    && requestDataset.sourceSemanticHash === active[3]
    && Boolean(activeSharedModelSemanticHash)
    && requestDataset.sharedModelSemanticHash === activeSharedModelSemanticHash
    && request.topologyGraphSemanticHash === activeTopologySemanticHash
    && request.supportAttachmentModelSemanticHash === activeAttachmentSemanticHash
    && request.restraintCapabilityModelSemanticHash === activeRestraintSemanticHash;
}

function requireExecutionDependencyMatchesActiveWorkspace(dependency) {
  if (!executionDependencyMatchesActiveWorkspace(dependency)) {
    throw new Error('Empirical V3 source-bound execution request does not match the active workspace dataset/topology/support-restraint authority.');
  }
}

function invalidateEmpiricalV3ForGoverningChange() {
  clearEmpiricalV3GovernedPreparedExecution();
  const session = coreWorkspace.getAnalysisSession()?.session;
  if (session?.analysisType === EMPIRICAL_V3_ANALYSIS_CAPABILITY_ID) {
    try { EventBus.publish(EVENT_TOPICS.ANALYSIS_SESSION_CLOSE_REQUESTED, {}); } catch { /* fail-closed cleanup only */ }
  }
  if (empiricalV3Safety.getPackage() || empiricalV3Safety.getCalculationEvidence()) empiricalV3Safety.clear();
}
