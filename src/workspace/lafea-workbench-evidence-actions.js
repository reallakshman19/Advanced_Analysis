/** Registration/export actions extracted from the canonical orchestrator store. */
import {
  createLafeaContinuumDomainFirstPreflight,
} from './lafea-continuum-domain-first-preflight.js';
import { requireLafeaStageComposition } from './lafea-stage-composition-root.js';
import {
  LAFEA_CONTINUUM_REVALIDATION_RESULT_SCHEMA,
  createLafeaContinuumRevalidationBatch,
  registerLafeaContinuumRevalidationBatch,
} from './lafea-continuum-revalidation.js';
import {
  projectLafeaWorkbenchLifecycleExportAuthority,
} from './lafea-workbench-lifecycle-export-authority.js';

const WORKBENCH_DOCUMENT_SCHEMA = 'lafea-workbench-document/v1';
const PREFLIGHT_FAILURE_MODE_DIAGNOSTIC_UI = 'DIAGNOSTIC_UI';

export function createLafeaWorkbenchEvidenceActions(context) {
  const c = requireContext(context);

  function activeStageId() { return c.getRetainedState().activeStageId; }

  function prepareContinuumForRun(stageId = activeStageId(), options = null) {
    const diagnosticUi = requirePreflightOptions(options);
    if (!diagnosticUi) return prepareContinuumStrict(stageId);
    try {
      const result = prepareContinuumStrict(stageId);
      return freeze({ ...result, attemptStatus: 'PASS', diagnostic: null });
    } catch (error) {
      c.failOrchestrator(error, 'LAFEA_CONTINUUM_PREFLIGHT_REJECTED');
      const state = c.publish();
      const stage = state.stages?.[stageId] ?? null;
      return freeze({
        changed: false,
        evidence: stage?.retainedContinuumPreflightEvidence ?? null,
        projection: stage?.preparationProjection ?? null,
        attemptStatus: 'BLOCKED',
        diagnostic: state.diagnostics?.[0] ?? null,
      });
    }
  }

  function prepareContinuumStrict(stageId) {
    if (stageId !== 'LAFEA.3' || c.rawStage(stageId).domainFirstProfileActive !== true) {
      throw c.storeError('LAFEA_CONTINUUM_PREFLIGHT_DOMAIN_FIRST_STAGE_REQUIRED');
    }
    const evidence = createLafeaContinuumDomainFirstPreflight(c, stageId);
    const result = c.continuumPreflight.register(evidence);
    if (result.changed) c.clearDomainFirstExecution(stageId);
    c.clearOrchestratorDiagnostic();
    const state = result.changed ? c.publish() : c.deriveState();
    return freeze({
      ...result,
      projection: state.stages[stageId].preparationProjection,
    });
  }

  function registerTemplateReleaseRecord(value, stageId = activeStageId()) {
    const result = c.release.register(value, c.readStageState(stageId));
    const state = result.changed ? c.publish() : c.deriveState();
    return freeze({
      ...result,
      projection: state.stages[stageId].lifecycleReadiness.releaseBinding,
    });
  }

  function registerNumericalVerificationEvidence(value, stageId = activeStageId()) {
    const result = c.verification.register(value, c.readStageState(stageId));
    const state = result.changed ? c.publish() : c.deriveState();
    return freeze({
      ...result,
      projection: state.stages[stageId].numericalVerificationProjection,
    });
  }

  function registerT6GeometryQualification(value, stageId = activeStageId()) {
    const result = c.t6Geometry.register(value, c.readStageState(stageId));
    const state = result.changed ? c.publish() : c.deriveState();
    return freeze({
      ...result,
      projection: state.stages[stageId].t6GeometryQualificationProjection,
    });
  }

  function registerPreparationEvidence(value) {
    const stageId = value?.request?.stageId ?? activeStageId();
    if (c.rawStage(stageId).domainFirstProfileActive) {
      throw c.storeError('LAFEA_DOMAIN_FIRST_PREPARATION_REQUIRES_V2_EVIDENCE');
    }
    const result = c.preparation.registerEvidence(value);
    const resultStageId = result.evidence.request.stageId;
    const state = result.changed ? c.publish() : c.deriveState();
    return freeze({
      ...result,
      projection: state.stages[resultStageId].preparationProjection,
    });
  }

  function registerPreparationApproval(value) {
    const stageId = value?.stageId ?? activeStageId();
    if (c.rawStage(stageId).domainFirstProfileActive) {
      throw c.storeError('LAFEA_DOMAIN_FIRST_PREPARATION_APPROVAL_NOT_QUALIFIED');
    }
    const result = c.preparation.registerApproval(value);
    const resultStageId = result.approval.stageId;
    const state = result.changed ? c.publish() : c.deriveState();
    return freeze({
      ...result,
      projection: state.stages[resultStageId].preparationProjection,
    });
  }

  function revalidateContinuumGeometryMesh() {
    const stageId = activeStageId();
    const stage = c.readStageState(stageId);
    if (stageId !== 'LAFEA.3') {
      throw c.storeError('LAFEA_CONTINUUM_REVALIDATION_STAGE_NOT_AUTHORIZED');
    }
    if (stage.domainFirstProfileActive || stage.shellMidsurfaceProfileActive) {
      throw c.storeError('LAFEA_CONTINUUM_REVALIDATION_LEGACY_ROUTE_REQUIRED');
    }
    if (stage.lifecycleBinding?.status !== 'CURRENT') {
      throw c.storeError('LAFEA_CONTINUUM_REVALIDATION_SOURCE_BINDING_NOT_CURRENT');
    }
    if (!stage.sourceAuthority) {
      throw c.storeError('LAFEA_CONTINUUM_REVALIDATION_SOURCE_AUTHORITY_REQUIRED');
    }

    const composition = requireLafeaStageComposition(stageId);
    if (!composition.executionSupported || typeof composition.canonicalize !== 'function') {
      throw c.storeError('LAFEA_CONTINUUM_REVALIDATION_CANONICALIZER_NOT_AVAILABLE');
    }
    const source = composition.normalizeDocument(exportedStageDocument(c, stageId));
    const canonicalInput = composition.canonicalize(source);
    const batch = createLafeaContinuumRevalidationBatch({
      stageId,
      sourceAuthority: stage.sourceAuthority,
      source,
      canonicalInput,
      lifecycle: stage.lifecycle,
    });

    const predicted = registerLafeaContinuumRevalidationBatch(stage.lifecycle, batch);
    for (let index = 0; index < batch.records.length; index += 1) {
      c.invokeRetained('registerLifecycleArtifact', [
        batch.records[index],
        batch.registrations[index].registrationId,
      ]);
      const retainedState = c.getRetainedState();
      if (retainedState.status === 'FAILED') {
        throw c.storeError(
          retainedState.diagnostics?.[0]?.code
            ?? 'LAFEA_CONTINUUM_REVALIDATION_REGISTRATION_REJECTED',
        );
      }
    }

    c.clearOrchestratorDiagnostic();
    const state = c.publish();
    const current = state.stages[stageId];
    for (const kind of ['CANONICAL_MODEL', 'ANALYSIS_GEOMETRY', 'ANALYSIS_MESH']) {
      if (current.lifecycle.artifacts[kind].artifactHash !== predicted.artifacts[kind].artifactHash
        || current.lifecycle.artifacts[kind].status !== 'CURRENT') {
        throw c.storeError('LAFEA_CONTINUUM_REVALIDATION_COMMIT_DIVERGED');
      }
    }
    return freeze({
      schema: LAFEA_CONTINUUM_REVALIDATION_RESULT_SCHEMA,
      stageId,
      status: 'PASS',
      changeClass: batch.changeClass,
      calculationState: batch.calculationState,
      currentIdentity: batch.currentIdentity,
      retainedIdentity: batch.retainedIdentity,
      executionStatus: current.lifecycle.artifacts.EXECUTION.status,
      recoveryStatus: current.lifecycle.artifacts.RECOVERY.status,
      releaseQualified: false,
    });
  }

  function activateDomainFirstProfile(stageId = activeStageId()) {
    // Ensure source authority is established before geometry activation.
    // After importDocument, source.clear() wipes sourceAuthority; geometry.activate()
    // requires a valid sourceHash — ensureRunAuthority derives it from the document
    // and initializes the lifecycle if absent.
    const raw = c.rawStage(stageId);
    if (!raw.sourceAuthority?.sourceHash && !raw.lifecycle?.source?.sourceHash) {
      c.source.ensureRunAuthority(stageId, 'LAFEA_WORKBENCH/ACTIVATE_DOMAIN_FIRST_PROFILE');
    }
    const result = c.geometry.activate(c.rawStage(stageId));
    if (result.changed) {
      c.continuumPreflight.clear(stageId);
      c.clearDomainFirstExecution(stageId);
      c.clearOrchestratorDiagnostic();
    }
    return freeze({ ...result, stage: c.publish().stages[stageId] });
  }

  function registerAnalysisDomain(value) {
    const stageId = value?.stageId ?? activeStageId();
    const result = c.geometry.registerDomain(value, c.readStageState(stageId));
    if (result.changed) {
      c.meshGeneration.invalidate(stageId);
      c.continuumPreflight.clear(stageId);
      c.clearDomainFirstExecution(stageId);
    }
    const state = result.changed ? c.publish() : c.deriveState();
    return freeze({
      ...result,
      projection: state.stages[stageId].analysisDomainProjection,
    });
  }

  function registerAnalysisGeometryEvidence(value) {
    const stageId = value?.stageId ?? activeStageId();
    const result = c.geometry.registerGeometryEvidence(
      value,
      c.readStageState(stageId),
    );
    if (result.changed) {
      c.meshGeneration.invalidate(stageId);
      c.continuumPreflight.clear(stageId);
      c.clearDomainFirstExecution(stageId);
    }
    const state = result.changed ? c.publish() : c.deriveState();
    return freeze({
      ...result,
      projection: state.stages[stageId].analysisGeometryProjection,
    });
  }

  function registerAnalysisMeshEvidence(value) {
    const stageId = value?.stageId ?? activeStageId();
    const stage = c.rawStage(stageId);
    if (stage.domainFirstProfileActive || stage.shellMidsurfaceProfileActive) {
      throw c.storeError('LAFEA_GOVERNED_V2_ANALYSIS_MESH_REQUIRES_V2_CUSTODY');
    }
    return c.mesh.registerAnalysisMeshEvidence(value);
  }

  function exportLifecycle() {
    const stage = c.deriveStage(activeStageId());
    return freeze({
      ...c.retained.exportLifecycle(),
      schema: 'lafea-workbench-lifecycle-export/v2',
      sourceAuthority: stage.sourceAuthority,
      lastSourceAuthorityEvent: stage.lastSourceAuthorityEvent,
      templateReleaseRecord: stage.retainedTemplateReleaseRecord,
      releaseBinding: stage.lifecycleReadiness.releaseBinding,
      numericalVerificationEvidence: stage.retainedNumericalVerificationEvidence,
      numericalVerification: stage.numericalVerificationProjection,
      t6GeometryQualification: stage.retainedT6GeometryQualification,
      t6GeometryQualificationProjection: stage.t6GeometryQualificationProjection,
      continuumPreflightEvidence: stage.retainedContinuumPreflightEvidence,
      readiness: stage.lifecycleReadiness,
      preparation: stage.preparationProjection,
      domainFirstLifecycle: stage.domainFirstLifecycle,
      analysisDomain: stage.analysisDomainProjection,
      analysisGeometry: stage.analysisGeometryProjection,
      shellMidsurface: stage.retainedShellMidsurfaceEvidence,
      orchestration: stage.orchestration,
      currentAuthority: projectLafeaWorkbenchLifecycleExportAuthority(stage),
    });
  }

  return Object.freeze({
    prepareContinuumForRun,
    registerTemplateReleaseRecord,
    registerNumericalVerificationEvidence,
    registerT6GeometryQualification,
    registerPreparationEvidence,
    registerPreparationApproval,
    revalidateContinuumGeometryMesh,
    activateDomainFirstProfile,
    registerAnalysisDomain,
    registerAnalysisGeometryEvidence,
    registerAnalysisMeshEvidence,
    exportLifecycle,
  });
}

function requirePreflightOptions(options) {
  if (options === null || options === undefined) return false;
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || JSON.stringify(Object.keys(options).sort()) !== JSON.stringify(['failureMode'])
    || options.failureMode !== PREFLIGHT_FAILURE_MODE_DIAGNOSTIC_UI) {
    throw new TypeError('LAFEA_CONTINUUM_PREFLIGHT_OPTIONS_INVALID');
  }
  return true;
}

function exportedStageDocument(c, stageId) {
  const exported = c.retained.exportDocument();
  if (exported?.schema !== WORKBENCH_DOCUMENT_SCHEMA || exported.stageId !== stageId
    || !exported.document || typeof exported.document !== 'object'
    || Array.isArray(exported.document)) {
    throw c.storeError('LAFEA_WORKBENCH_EXPORTED_DOCUMENT_INVALID');
  }
  return exported.document;
}

function requireContext(value) {
  if (!value || typeof value !== 'object') {
    throw new TypeError('LAFEA_WORKBENCH_EVIDENCE_ACTION_CONTEXT_INVALID');
  }
  return value;
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
