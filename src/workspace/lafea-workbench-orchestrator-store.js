/** Canonical LAFEA workbench orchestrator with one public publication boundary. */
import { createLafeaLifecycleProducerBatch } from './lafea-lifecycle-producers.js';
import { lafeaDocumentDigest } from './lafea-edit-command.js';
import {
  LAFEA_LIFECYCLE_BINDING_SCHEMA,
  LAFEA_LIFECYCLE_BINDING_STATUSES,
  LAFEA_WORKBENCH_STATE_SCHEMA,
  createLafeaWorkbenchStore as createRetainedStore,
} from './lafea-lifecycle-workbench-store-retained.js';
import { buildLafeaWorkbenchOrchestrationProjection } from './lafea-workbench-orchestration-projection.js';
import { createLafeaWorkbenchEvidenceActions } from './lafea-workbench-evidence-actions.js';
import { createLafeaWorkbenchGeometryState } from './lafea-workbench-geometry-state.js';
import { buildLafeaDomainFirstMeshCustodyProjection } from './lafea-domain-first-mesh-custody.js';
import { buildLafeaDomainPreparationProjection } from './lafea-domain-first-requests.js';
import { createLafeaWorkbenchOrchestratorApi } from './lafea-workbench-orchestrator-api.js';
import { createLafeaWorkbenchContinuumPreflightState } from './lafea-workbench-continuum-preflight-state.js';
import { createLafeaWorkbenchDomainFirstExecutionState } from './lafea-workbench-domain-first-execution-state.js';
import { createLafeaWorkbenchDomainFirstRunActions } from './lafea-workbench-domain-first-run-actions.js';
import { createLafeaWorkbenchMeshState } from './lafea-workbench-mesh-state.js';
import { createLafeaWorkbenchMeshGenerationState } from './lafea-workbench-mesh-generation-state.js';
import { createLafeaMeshGenerationActions } from './lafea-workbench-mesh-generation-actions.js';
import { createLafeaWorkbenchPreparationState } from './lafea-workbench-preparation-state.js';
import {
  projectLafeaWorkbenchCurrentness,
  projectLafeaWorkbenchReadiness,
} from './lafea-workbench-readiness.js';
import { createLafeaWorkbenchReleaseState } from './lafea-workbench-release-binding.js';
import { createLafeaWorkbenchSourceState } from './lafea-workbench-source-state.js';
import { createLafeaT6GeometryQualificationState } from './lafea-t6-geometry-qualification-state.js';
import {
  createLafeaWorkbenchVerificationState,
  projectLafeaWorkbenchVerificationBinding,
} from './lafea-workbench-verification-state.js';

export { LAFEA_LIFECYCLE_BINDING_SCHEMA, LAFEA_LIFECYCLE_BINDING_STATUSES, LAFEA_WORKBENCH_STATE_SCHEMA };
export const LAFEA_CALCULATION_STATES = Object.freeze(['CALCULATION_NOT_RUN', 'CALCULATION_ACCEPTED_BY_STAGE_CONTRACT', 'CALCULATION_NOT_ACCEPTED_BY_STAGE_CONTRACT']);
export const LAFEA_RESULT_STATES = Object.freeze(['RESULT_NOT_READY', 'RESULT_READY']);
export const LAFEA_CODE_STATES = Object.freeze(['CODE_NOT_READY', 'CODE_READY']);
export const LAFEA_RELEASE_STATES = Object.freeze(['RELEASE_NOT_QUALIFIED', 'RELEASE_QUALIFIED']);

const SOURCE_CHANGE_CLASSES = new Set([
  'MATERIAL_PROPERTY', 'SECTION_PROPERTY', 'GEOMETRY', 'LOAD_OR_BC', 'MODEL_METADATA',
]);

export function createLafeaWorkbenchOrchestratorStore(options) {
  const configuration = options ?? {};
  const {
    currentCandidateHeadSha = null,
    authorizedReleaseEvidenceHashes = [],
    ...retainedOptions
  } = configuration;
  const retained = createRetainedStore(retainedOptions);
  let retainedState = retained.getState();
  let suppressRetainedPublish = false;
  let orchestratorStatus = null;
  let orchestratorDiagnostics = null;
  const listeners = new Set();
  const stageIds = Object.keys(retainedState.stages);
  const continuumPreflight = createLafeaWorkbenchContinuumPreflightState(stageIds);
  const domainFirstExecution = createLafeaWorkbenchDomainFirstExecutionState(stageIds);
  const source = createLafeaWorkbenchSourceState(stageIds, {
    getRetainedState: () => retainedState,
    getActiveStageId: () => retainedState.activeStageId,
    invokeRetained,
  });
  const release = createLafeaWorkbenchReleaseState(stageIds, {
    currentCandidateHeadSha, authorizedReleaseEvidenceHashes,
  });
  const verification = createLafeaWorkbenchVerificationState(stageIds);
  const t6Geometry = createLafeaT6GeometryQualificationState(stageIds, { currentCandidateHeadSha });
  const geometry = createLafeaWorkbenchGeometryState(stageIds);
  const mesh = createLafeaWorkbenchMeshState(stageIds, {
    getActiveStageId: () => retainedState.activeStageId, readStageState, invokeRetained, publish,
  });
  const meshGeneration = createLafeaWorkbenchMeshGenerationState(stageIds);
  const preparation = createLafeaWorkbenchPreparationState(stageIds);
  const unsubscribe = retained.subscribe((next) => {
    retainedState = next;
    if (!suppressRetainedPublish) publish();
  });

  function rawStage(stageId) {
    const stage = retainedState.stages[stageId];
    if (!stage) throw storeError('LAFEA_WORKBENCH_STAGE_NOT_FOUND');
    const geometryFields = geometry.fields(stageId);
    const executionFields = geometryFields.domainFirstProfileActive
      ? { execution: domainFirstExecution.select(stageId) }
      : domainFirstExecution.fields(stageId);
    return freeze({
      ...stage, stageId, ...source.fields(stageId), ...release.fields(stageId),
      ...verification.fields(stageId), ...t6Geometry.fields(stageId),
      ...mesh.fields(stageId), ...meshGeneration.fields(stageId),
      ...preparation.fields(stageId), ...geometryFields,
      ...continuumPreflight.fields(stageId), ...executionFields,
    });
  }

  function readStageState(stageId) {
    const raw = rawStage(stageId);
    const withGeometry = freeze({ ...raw, ...geometry.buildProjections(raw) });
    const legacyCustody = mesh.buildAnalysisMeshCustodyProjection(
      withGeometry, withGeometry.retainedAnalysisMeshEvidence,
    );
    const governedV2 = withGeometry.domainFirstProfileActive || withGeometry.shellMidsurfaceProfileActive;
    const analysisMeshCustodyProjection = governedV2
      ? buildLafeaDomainFirstMeshCustodyProjection(withGeometry, withGeometry.retainedAnalysisMeshEvidenceV2)
      : legacyCustody;
    const withMesh = freeze({ ...withGeometry, analysisMeshCustodyProjection });
    const preparationProjection = withMesh.domainFirstProfileActive
      ? buildLafeaDomainPreparationProjection(withMesh)
      : preparation.buildProjection(withMesh);
    const withPreparation = freeze({ ...withMesh, preparationProjection });
    const lifecycleReadiness = projectLafeaWorkbenchReadiness(stageId, withPreparation);
    const withReadiness = freeze({ ...withPreparation, lifecycleReadiness });
    const withCurrentness = freeze({
      ...withReadiness,
      currentness: projectLafeaWorkbenchCurrentness(withReadiness),
    });
    return freeze({
      ...withCurrentness,
      numericalVerificationProjection: projectLafeaWorkbenchVerificationBinding(
        withCurrentness, withCurrentness.retainedNumericalVerificationEvidence,
      ),
      t6GeometryQualificationProjection: t6Geometry.project(withCurrentness),
    });
  }

  function deriveStage(stageId) {
    const stage = readStageState(stageId);
    return freeze({ ...stage, orchestration: buildLafeaWorkbenchOrchestrationProjection(stage) });
  }
  function deriveState() {
    return freeze({
      ...retainedState,
      stages: Object.fromEntries(stageIds.map((stageId) => [stageId, deriveStage(stageId)])),
      status: orchestratorStatus ?? retainedState.status,
      diagnostics: orchestratorDiagnostics ?? retainedState.diagnostics,
    });
  }
  function publish() {
    const state = deriveState();
    for (const listener of listeners) {
      try { listener(state); } catch { /* subscriber isolation */ }
    }
    return state;
  }
  function invokeRetained(method, args = []) {
    if (typeof retained[method] !== 'function') throw storeError(`LAFEA_RETAINED_METHOD_NOT_FOUND:${method}`);
    suppressRetainedPublish = true;
    try {
      const returned = retained[method](...args);
      retainedState = returned ?? retained.getState();
      return retainedState;
    } finally { suppressRetainedPublish = false; }
  }

  function clearDomainFirstExecution(stageId = retainedState.activeStageId) {
    return domainFirstExecution.clear(stageId);
  }
  function clearDomainFirstAuthority(stageId = retainedState.activeStageId) {
    continuumPreflight.clear(stageId);
    clearDomainFirstExecution(stageId);
  }
  function mutateDocument(originRef, method, args, explicitClass = null) {
    const before = retainedState;
    const stageId = before.activeStageId;
    const beforeDocument = before.stages[stageId]?.document ?? null;
    invokeRetained(method, args);
    if (retainedState.status === 'FAILED') return publish();
    source.reconcileDocumentMutation(before, originRef, explicitClass);
    const afterDocument = retainedState.stages[stageId]?.document ?? null;
    if (documentDigest(beforeDocument) !== documentDigest(afterDocument)) {
      geometry.invalidate(stageId);
      meshGeneration.invalidate(stageId);
      clearDomainFirstAuthority(stageId);
    }
    clearOrchestratorDiagnostic();
    return publish();
  }

  function run() {
    const stageId = retainedState.activeStageId;
    if (rawStage(stageId).domainFirstProfileActive) return domainFirstRun.run(stageId);
    invokeRetained('run');
    let stage = retainedState.stages[stageId];
    try {
      if (stage.execution?.status === 'QUALIFIED') {
        const authority = source.ensureRunAuthority(stageId, 'RUN_CALCULATION/SOURCE_AUTHORITY');
        stage = retainedState.stages[stageId];
        const batch = createLafeaLifecycleProducerBatch({
          stageId, sourceAuthority: authority, execution: stage.execution,
        });
        for (let index = 0; index < batch.records.length; index += 1) {
          invokeRetained('registerLifecycleArtifact', [
            batch.records[index], batch.registrations[index].registrationId,
          ]);
          if (retainedState.status === 'FAILED') {
            throw storeError(retainedState.diagnostics?.[0]?.code ?? 'LAFEA_PRODUCER_REGISTRATION_REJECTED');
          }
        }
      }
      clearOrchestratorDiagnostic();
    } catch (error) { failOrchestrator(error, 'LAFEA_PRODUCER_REGISTRATION_REJECTED'); }
    return publish();
  }

  function importDocument(value, stageId = retainedState.activeStageId, sourceHash = null) {
    invokeRetained('importDocument', [value, stageId, sourceHash]);
    if (retainedState.status !== 'FAILED') {
      source.clear(stageId); geometry.clear(stageId); meshGeneration.clear(stageId);
      clearDomainFirstAuthority(stageId); clearOrchestratorDiagnostic();
    }
    return publish();
  }
  function initializeLifecycle(sourceHash, originRef = 'EXTERNAL_SOURCE_AUTHORITY') {
    const stageId = retainedState.activeStageId;
    source.clear(stageId); clearDomainFirstAuthority(stageId);
    invokeRetained('initializeLifecycle', [sourceHash, originRef]);
    if (retainedState.status !== 'FAILED') {
      geometry.invalidate(stageId); meshGeneration.invalidate(stageId);
    }
    clearOrchestratorDiagnosticIfReady();
    return publish();
  }
  function applyLifecycleEvent(event) {
    invokeRetained('applyLifecycleEvent', [event]);
    const succeeded = retainedState.status !== 'FAILED';
    source.afterLifecycleEvent(event, succeeded); mesh.afterLifecycleEvent(event, succeeded);
    if (succeeded && (SOURCE_CHANGE_CLASSES.has(event?.changeClass)
      || event?.changeClass === 'ANALYSIS_MESH_PROFILE')) {
      const stageId = retainedState.activeStageId;
      if (SOURCE_CHANGE_CLASSES.has(event?.changeClass)) {
        geometry.invalidate(stageId); meshGeneration.invalidate(stageId);
      }
      clearDomainFirstAuthority(stageId);
    }
    if (succeeded) clearOrchestratorDiagnostic();
    return publish();
  }
  function delegate(method, args = []) {
    invokeRetained(method, args); clearOrchestratorDiagnosticIfReady(); return publish();
  }

  const meshGenerationActions = createLafeaMeshGenerationActions({
    meshGeneration, mesh, continuumPreflight, rawStage, readStageState, deriveStage, publish,
    invokeRetained, storeError, clearOrchestratorDiagnostic, failOrchestrator,
    clearDomainFirstExecution, getRetainedState: () => retainedState,
  });
  const evidenceActions = createLafeaWorkbenchEvidenceActions({
    retained, release, verification, t6Geometry, preparation, geometry, continuumPreflight,
    meshGeneration, mesh, rawStage, readStageState, deriveStage, deriveState, publish,
    invokeRetained, storeError, clearOrchestratorDiagnostic, clearDomainFirstExecution,
    getRetainedState: () => retainedState,
  });
  const domainFirstRun = createLafeaWorkbenchDomainFirstRunActions({
    ...routeContext(), source, domainFirstExecution,
  });

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('LAFEA subscriber must be a function.');
    listeners.add(listener); return () => listeners.delete(listener);
  }
  function clearOrchestratorDiagnosticIfReady() { if (retainedState.status !== 'FAILED') clearOrchestratorDiagnostic(); }
  function clearOrchestratorDiagnostic() { orchestratorStatus = null; orchestratorDiagnostics = null; }
  function failOrchestrator(error, fallbackCode) {
    orchestratorStatus = 'FAILED';
    orchestratorDiagnostics = [freeze({
      severity: 'ERROR', code: typeof error?.code === 'string' ? error.code : fallbackCode,
      path: 'orchestration', entityId: null,
      message: error instanceof Error ? error.message : String(error),
    })];
  }
  function routeContext() {
    return {
      retained, release, verification, t6Geometry, mesh, meshGeneration, preparation,
      geometry, continuumPreflight, listeners, unsubscribe, ...meshGenerationActions,
      ...evidenceActions, getRetainedState: () => retainedState, readStageState, deriveStage,
      deriveState, publish, delegate, mutateDocument, importDocument, run, initializeLifecycle,
      applyLifecycleEvent, clearDomainFirstExecution, subscribe, invokeRetained,
      clearOrchestratorDiagnostic, failOrchestrator, storeError,
    };
  }
  return createLafeaWorkbenchOrchestratorApi(routeContext());
}

function documentDigest(value) { return value ? lafeaDocumentDigest(value) : null; }
function storeError(code) { const error = new Error(code); error.code = code; return error; }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.values(value).forEach(freeze); return Object.freeze(value); }
