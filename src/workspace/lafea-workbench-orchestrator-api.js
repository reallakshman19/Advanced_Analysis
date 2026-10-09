/** Public method-surface assembly for the canonical orchestrator; owns no state or listeners. */
import { executeLafeaContinuumCompiledForParity } from './lafea-continuum-compiled-execution.js';
import { evaluateLafeaContinuumPhysicalProbe } from './lafea-continuum-physical-probe.js';
import {
  compareLafeaContinuumPhysicalProbeEvidence,
  createLafeaContinuumProbeConvergenceDefinition,
  createLafeaContinuumProbeConvergenceObservations,
  evaluateLafeaContinuumProbeConvergence,
} from './lafea-continuum-probe-convergence.js';
import { compileLafeaContinuumWorkbenchContext } from './lafea-continuum-workbench-route.js';
import {
  buildLafeaMeshGenerationIntentV2FromStage,
  buildLafeaPreparationRequestV2FromStage,
} from './lafea-domain-first-requests.js';

export function createLafeaWorkbenchOrchestratorApi(context) {
  const c = requireContext(context);
  const activeStageId = () => c.getRetainedState().activeStageId;
  const domainFirst = (stageId = activeStageId()) =>
    c.readStageState(stageId).domainFirstProfileActive === true;
  const governedV2 = (stageId = activeStageId()) => {
    const stage = c.readStageState(stageId);
    return stage.domainFirstProfileActive === true || stage.shellMidsurfaceProfileActive === true;
  };
  return Object.freeze({
    selectStage: (stageId) => c.delegate('selectStage', [stageId]),
    importDocument: c.importDocument,
    applyEditCommand: (command) => c.mutateDocument(
      command?.commandId ?? 'APPLY_EDIT_COMMAND', 'applyEditCommand', [command],
    ),
    setScalar: (descriptorId, entityId, rawText, surface) => c.mutateDocument(
      `SET_SCALAR:${descriptorId}`, 'setScalar', [descriptorId, entityId, rawText, surface],
    ),
    replaceDocument: (value, surface) => c.mutateDocument(
      'REPLACE_DOCUMENT', 'replaceDocument', [value, surface], 'GEOMETRY',
    ),
    moveNode: (path, nodeId, x, y) => c.mutateDocument(
      `MOVE_NODE:${nodeId}`, 'moveNode', [path, nodeId, x, y], 'GEOMETRY',
    ),
    reportEditError: (...args) => c.delegate('reportEditError', args),
    run: c.run,
    undo: () => c.mutateDocument('UNDO', 'undo', []),
    redo: () => c.mutateDocument('REDO', 'redo', []),
    exportDocument: () => c.retained.exportDocument(),
    initializeLifecycle: c.initializeLifecycle,
    applyLifecycleEvent: c.applyLifecycleEvent,
    registerLifecycleArtifact: (...args) => c.delegate('registerLifecycleArtifact', args),
    revalidateLifecycleBinding: (...args) => c.delegate('revalidateLifecycleBinding', args),
    revalidateContinuumGeometryMesh: c.revalidateContinuumGeometryMesh,
    prepareContinuumForRun: c.prepareContinuumForRun,
    selectRetainedContinuumPreflightEvidence: (stageId = activeStageId()) =>
      c.continuumPreflight.select(stageId),
    compileContinuumSolverModel: () => compileLafeaContinuumWorkbenchContext(
      c, activeStageId(),
    ).solverModel,
    executeContinuumCompiledForParity: () => executeLafeaContinuumCompiledForParity(
      compileLafeaContinuumWorkbenchContext(c, activeStageId()).solverModel,
    ),
    evaluateContinuumPhysicalProbe: (probe, stageId = activeStageId()) =>
      evaluateLafeaContinuumPhysicalProbe(c.deriveStage(stageId), probe),
    compareContinuumPhysicalProbeEvidence: compareLafeaContinuumPhysicalProbeEvidence,
    createContinuumProbeConvergenceDefinition: createLafeaContinuumProbeConvergenceDefinition,
    createContinuumProbeConvergenceObservations: createLafeaContinuumProbeConvergenceObservations,
    evaluateContinuumProbeConvergence: evaluateLafeaContinuumProbeConvergence,
    registerTemplateReleaseRecord: c.registerTemplateReleaseRecord,
    selectRetainedTemplateReleaseRecord: (stageId = activeStageId()) => c.release.select(stageId),
    buildReleaseBindingProjection: (stageId = activeStageId()) =>
      c.deriveStage(stageId).lifecycleReadiness.releaseBinding,
    registerNumericalVerificationEvidence: c.registerNumericalVerificationEvidence,
    selectRetainedNumericalVerificationEvidence: (stageId = activeStageId()) =>
      c.verification.select(stageId),
    buildNumericalVerificationProjection: (stageId = activeStageId()) =>
      c.deriveStage(stageId).numericalVerificationProjection,
    registerT6GeometryQualification: c.registerT6GeometryQualification,
    selectRetainedT6GeometryQualification: (stageId = activeStageId()) =>
      c.t6Geometry.select(stageId),
    buildT6GeometryQualificationProjection: (stageId = activeStageId()) =>
      c.deriveStage(stageId).t6GeometryQualificationProjection,
    exportT6GeometryQualification: (stageId = activeStageId()) =>
      c.t6Geometry.select(stageId),
    exportLifecycle: c.exportLifecycle,
    validateLafeaAnalysisMeshEvidence: (value) => {
      const stageId = value?.stageId ?? activeStageId();
      return governedV2(stageId)
        ? c.meshGeneration.validateEvidence(value)
        : c.mesh.validateLafeaAnalysisMeshEvidence(value);
    },
    registerAnalysisMeshEvidence: c.registerAnalysisMeshEvidence,
    selectRetainedAnalysisMeshEvidence: (stageId = activeStageId()) =>
      governedV2(stageId)
        ? c.meshGeneration.selectEvidence(stageId)
        : c.mesh.selectRetainedAnalysisMeshEvidence(stageId),
    buildAnalysisMeshCustodyProjection: c.mesh.buildAnalysisMeshCustodyProjection,
    exportAnalysisMeshEvidence: (stageId = activeStageId()) =>
      governedV2(stageId)
        ? c.meshGeneration.exportEvidence(stageId)
        : c.mesh.exportAnalysisMeshEvidence(stageId),
    recoverAnalysisMeshEvidence: (value) => {
      const stageId = value?.stageId ?? activeStageId();
      return governedV2(stageId)
        ? c.recoverAnalysisMeshEvidenceV2(value, stageId)
        : c.mesh.recoverAnalysisMeshEvidence(value);
    },
    buildPreparationRequest: (caseIds = [], stageId = activeStageId()) => {
      const stage = c.readStageState(stageId);
      if (stage.domainFirstProfileActive) {
        throw apiError('LAFEA_DOMAIN_FIRST_PREPARATION_REQUIRES_V2_REQUEST');
      }
      return c.preparation.buildRequest(stage, caseIds);
    },
    registerPreparationEvidence: c.registerPreparationEvidence,
    selectRetainedPreparationEvidence: (stageId = activeStageId()) =>
      c.preparation.selectEvidence(stageId),
    registerPreparationApproval: c.registerPreparationApproval,
    selectRetainedPreparationApproval: (stageId = activeStageId()) =>
      c.preparation.selectApproval(stageId),
    buildPreparationProjection: (stageId = activeStageId()) =>
      c.deriveStage(stageId).preparationProjection,
    activateDomainFirstProfile: c.activateDomainFirstProfile,
    registerAnalysisDomain: c.registerAnalysisDomain,
    selectRetainedAnalysisDomain: (stageId = activeStageId()) =>
      c.geometry.selectDomain(stageId),
    registerAnalysisGeometryEvidence: c.registerAnalysisGeometryEvidence,
    selectRetainedAnalysisGeometryEvidence: (stageId = activeStageId()) =>
      c.geometry.selectGeometryEvidence(stageId),
    exportAnalysisGeometryEvidence: (stageId = activeStageId()) =>
      c.geometry.exportGeometryEvidence(stageId),
    recoverAnalysisGeometryEvidence: (value, stageId = activeStageId()) => {
      const result = c.geometry.recoverGeometryEvidence(value, c.readStageState(stageId));
      const state = result.changed ? c.publish() : c.deriveState();
      return freeze({ ...result, projection: state.stages[stageId].analysisGeometryProjection });
    },
    registerShellMidsurfaceEvidence: c.registerShellMidsurfaceEvidence,
    selectRetainedShellMidsurfaceEvidence: (stageId = activeStageId()) =>
      c.meshGeneration.selectShellMidsurface(stageId),
    exportShellMidsurfaceEvidence: (stageId = activeStageId()) =>
      c.meshGeneration.exportShellMidsurface(stageId),
    buildDomainPreparationRequest: (caseIds = [], stageId = activeStageId()) =>
      buildLafeaPreparationRequestV2FromStage(c.readStageState(stageId), caseIds),
    buildDomainMeshGenerationIntent: (configuration, stageId = activeStageId()) => {
      if (!domainFirst(stageId)) throw apiError('LAFEA_DOMAIN_MESH_INTENT_REQUIRES_DOMAIN_FIRST_PROFILE');
      return buildLafeaMeshGenerationIntentV2FromStage(c.readStageState(stageId), configuration);
    },
    bindAnalysisMeshProfile: c.bindAnalysisMeshProfile,
    planAnalysisMesh: c.planAnalysisMesh,
    generateAnalysisMesh: c.generateAnalysisMesh,
    refineAnalysisMesh: c.refineAnalysisMesh,
    validateLafeaAnalysisMeshEvidenceV2: c.meshGeneration.validateEvidence,
    exportAnalysisMeshEvidenceV2: (stageId = activeStageId()) =>
      c.meshGeneration.exportEvidence(stageId),
    recoverAnalysisMeshEvidenceV2: c.recoverAnalysisMeshEvidenceV2,
    selectRetainedAnalysisMeshProfile: (stageId = activeStageId()) =>
      c.meshGeneration.selectMeshProfile(stageId),
    selectRetainedAnalysisMeshEvidenceV2: (stageId = activeStageId()) =>
      c.meshGeneration.selectEvidence(stageId),
    selectAnalysisMeshPlan: (stageId = activeStageId()) =>
      c.meshGeneration.selectPlan(stageId),
    buildOrchestrationProjection: (stageId = activeStageId()) =>
      c.deriveStage(stageId).orchestration,
    subscribe: c.subscribe,
    getState: c.deriveState,
    destroy: () => {
      c.unsubscribe();
      c.retained.destroy();
      c.listeners.clear();
    },
  });
}

function apiError(code) { const error = new TypeError(code); error.code = code; return error; }
function requireContext(value) {
  if (!value || typeof value !== 'object') throw new TypeError('LAFEA_ORCHESTRATOR_API_CONTEXT_INVALID');
  return value;
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
