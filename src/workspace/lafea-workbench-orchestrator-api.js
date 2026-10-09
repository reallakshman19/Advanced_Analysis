/** Public method-surface assembly for the canonical orchestrator; owns no state or listeners. */
import { executeLafeaContinuumCompiledForParity } from './lafea-continuum-compiled-execution.js';
import {
  createLafeaContinuumGeometryIntake,
} from './lafea-continuum-geometry-intake.js';
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
import {
  sanitizeLafeaPublicResult,
  sanitizeLafeaPublicState,
} from './lafea-public-failure.js';
import { requireLafeaInputDescriptor } from './lafea-stage-input-descriptors.js';

export function createLafeaWorkbenchOrchestratorApi(context) {
  const c = requireContext(context);
  const activeStageId = () => c.getRetainedState().activeStageId;
  const domainFirst = (stageId = activeStageId()) =>
    c.readStageState(stageId).domainFirstProfileActive === true;
  const governedV2 = (stageId = activeStageId()) => {
    const stage = c.readStageState(stageId);
    return stage.domainFirstProfileActive === true || stage.shellMidsurfaceProfileActive === true;
  };
  const registerContinuumGeometryIntake = (declaration, stageId = activeStageId()) => {
    if (stageId !== 'LAFEA.3') throw apiError('LAFEA_CONTINUUM_GEOMETRY_INTAKE_STAGE_NOT_AUTHORIZED');
    const sourceDocument = exportedStageDocument(c, stageId);

    // Build and validate the complete custody-free package before changing any
    // domain/geometry state. This composer cannot generate mesh or solver data.
    const intake = createLafeaContinuumGeometryIntake(sourceDocument, declaration);
    const before = c.readStageState(stageId);
    const beforeSourceHash = currentStageSourceHash(before);
    if (beforeSourceHash && beforeSourceHash !== intake.sourceHash) {
      throw apiError('LAFEA_CONTINUUM_GEOMETRY_INTAKE_SOURCE_PARENT_STALE');
    }

    const activation = c.activateDomainFirstProfile(stageId);
    const activated = c.readStageState(stageId);
    if (currentStageSourceHash(activated) !== intake.sourceHash) {
      throw apiError('LAFEA_CONTINUUM_GEOMETRY_INTAKE_ACTIVATED_SOURCE_MISMATCH');
    }

    const domainRegistration = c.registerAnalysisDomain(intake.analysisDomain);
    const geometryRegistration = c.registerAnalysisGeometryEvidence(intake.geometryEvidence);
    const stage = c.deriveStage(stageId);
    if (stage.analysisDomainProjection?.state !== 'CURRENT_PASS'
      || stage.analysisDomainProjection?.analysisDomainHash !== intake.analysisDomainHash
      || stage.analysisGeometryProjection?.state !== 'CURRENT_PASS'
      || stage.analysisGeometryProjection?.analysisGeometryHash !== intake.analysisGeometryHash) {
      throw apiError('LAFEA_CONTINUUM_GEOMETRY_INTAKE_COMMIT_DIVERGED');
    }
    return freeze({
      schema: 'lafea-continuum-geometry-intake-registration/v1',
      stageId,
      status: 'CURRENT',
      changed: Boolean(
        activation.changed || domainRegistration.changed || geometryRegistration.changed
      ),
      intake,
      analysisDomainProjection: stage.analysisDomainProjection,
      analysisGeometryProjection: stage.analysisGeometryProjection,
      meshGenerated: false,
      solverExecuted: false,
      releaseQualified: false,
    });
  };
  const api = {
    selectStage: (stageId) => c.delegate('selectStage', [stageId]),
    importDocument: c.importDocument,
    applyEditCommand: (command) => c.mutateDocument(
      command?.commandId ?? 'APPLY_EDIT_COMMAND', 'applyEditCommand', [command],
    ),
    setScalar: (descriptorId, entityId, rawText, surface) => c.mutateDocument(
      `SET_SCALAR:${descriptorId}`, 'setScalar', [descriptorId, entityId, rawText, surface],
    ),
    setScalarBatch: (edits, surface = 'FORM_GROUP') => {
      const stageId = activeStageId();
      const invalidationClass = scalarBatchInvalidationClass(stageId, edits);
      return c.mutateDocument(
        `SET_SCALAR_BATCH:${invalidationClass}`,
        'setScalarBatch',
        [edits, surface],
        invalidationClass,
      );
    },
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
    registerContinuumGeometryIntake,
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
    exportLafea4ProductRefinementReplayPackage:
      c.exportRetainedProductRefinementReplayPackage,
    recoverLafea4ProductRefinementReplayPackage:
      c.recoverProductRefinementReplayPackage,
    selectRetainedAnalysisMeshProfile: (stageId = activeStageId()) =>
      c.meshGeneration.selectMeshProfile(stageId),
    selectRetainedAnalysisMeshEvidenceV2: (stageId = activeStageId()) =>
      c.meshGeneration.selectEvidence(stageId),
    selectRetainedAnalysisMeshParentNormalCompanion:
      c.selectRetainedAnalysisMeshParentNormalCompanion,
    exportRetainedAnalysisMeshParentNormalCompanion:
      c.exportRetainedAnalysisMeshParentNormalCompanion,
    validateRetainedAnalysisMeshParentNormalCompanion:
      c.validateRetainedAnalysisMeshParentNormalCompanion,
    selectRetainedAnalysisMeshParentNormalProductionGate:
      c.selectRetainedAnalysisMeshParentNormalProductionGate,
    exportRetainedAnalysisMeshParentNormalProductionGate:
      c.exportRetainedAnalysisMeshParentNormalProductionGate,
    selectAnalysisMeshPlan: (stageId = activeStageId()) =>
      c.meshGeneration.selectPlan(stageId),
    buildOrchestrationProjection: (stageId = activeStageId()) =>
      c.deriveStage(stageId).orchestration,
    subscribe: (listener) => c.subscribe((state) => listener(sanitizeLafeaPublicState(state))),
    getState: c.deriveState,
    destroy: () => {
      c.unsubscribe();
      c.retained.destroy();
      c.listeners.clear();
    },
  };
  return Object.freeze(Object.fromEntries(Object.entries(api).map(([name, value]) => [
    name,
    typeof value === 'function'
      ? (...args) => exposePublicResult(value(...args))
      : value,
  ])));
}

function exportedStageDocument(c, stageId) {
  const exported = c.retained.exportDocument();
  if (exported?.schema !== 'lafea-workbench-document/v1'
    || exported.stageId !== stageId
    || !exported.document || typeof exported.document !== 'object'
    || Array.isArray(exported.document)) {
    throw apiError('LAFEA_CONTINUUM_GEOMETRY_INTAKE_SOURCE_DOCUMENT_INVALID');
  }
  return exported.document;
}

function currentStageSourceHash(stage) {
  return stage?.sourceAuthority?.sourceHash ?? stage?.lifecycle?.source?.sourceHash ?? null;
}

function exposePublicResult(value) {
  if (value && typeof value.then === 'function') {
    return value.then((resolved) => sanitizeLafeaPublicResult(resolved));
  }
  return sanitizeLafeaPublicResult(value);
}

function scalarBatchInvalidationClass(stageId, edits) {
  if (!Array.isArray(edits) || !edits.length) throw apiError('LAFEA_SCALAR_BATCH_REQUIRED');
  const classes = new Set(edits.map((edit) => requireLafeaInputDescriptor(
    stageId,
    edit?.descriptorId,
  ).invalidation.invalidationClass));
  if (classes.size !== 1) throw apiError('LAFEA_SCALAR_BATCH_MIXED_INVALIDATION_CLASS');
  return [...classes][0];
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
