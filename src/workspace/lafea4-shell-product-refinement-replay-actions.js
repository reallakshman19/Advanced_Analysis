import {
  createLafea4RetainedMeshParentNormalCompanion,
} from './lafea4-shell-retained-mesh-parent-normal-companion.js';
import {
  evaluateLafea4ParentNormalProductionGate,
  validateLafea4ParentNormalProductionGate,
} from './lafea4-parent-normal-production-gate.js';
import {
  createLafea4ShellProductRefinementReplayPackage,
  requireCurrentLafea4ShellProductRefinementReplayPackage,
  validateLafea4ShellProductRefinementReplayPackage,
} from './lafea4-shell-product-refinement-replay.js';

export function createLafea4ShellProductRefinementReplayActions(context) {
  const {
    meshGeneration, readStageState, publish, failOrchestrator, clearOrchestratorDiagnostic,
    clearDomainFirstExecution, continuumPreflight, storeError, getRetainedState,
  } = context;
  const retainedPackages = new Map();

  /** Build and validate the portable sidecar before child custody is changed. */
  function prepareProductRefinementReplayPackage({ retentionAuthority, acceptance, promotion }) {
    return createLafea4ShellProductRefinementReplayPackage({
      retentionAuthority,
      acceptance,
      promotion,
    });
  }

  /**
   * Called only after the already-prepared package's exact evidence has been
   * atomically retained. Map insertion itself grants no authority; export
   * remains conditional on exact retained artifact/mesh identity.
   */
  function retainPreparedProductRefinementReplayPackage(replayPackage) {
    if (!replayPackage || replayPackage.stageId !== 'LAFEA.4') return null;
    retainedPackages.set('LAFEA.4', replayPackage);
    return replayPackage;
  }

  function selectRetainedProductRefinementReplayPackage(stageId = getRetainedState().activeStageId) {
    if (stageId !== 'LAFEA.4') return null;
    const replayPackage = retainedPackages.get(stageId) ?? null;
    if (!replayPackage) return null;
    const evidence = meshGeneration.selectEvidence(stageId);
    if (!evidence
      || evidence.artifactHash !== replayPackage.retentionAuthority.evidence.artifactHash
      || evidence.meshHash !== replayPackage.retentionAuthority.evidence.meshHash) {
      return null;
    }
    return replayPackage;
  }

  function exportRetainedProductRefinementReplayPackage(stageId = getRetainedState().activeStageId) {
    const replayPackage = selectRetainedProductRefinementReplayPackage(stageId);
    return replayPackage ? validateLafea4ShellProductRefinementReplayPackage(replayPackage) : null;
  }

  function recoverProductRefinementReplayPackage(
    value,
    stageId = value?.stageId ?? getRetainedState().activeStageId,
  ) {
    if (stageId !== 'LAFEA.4') {
      failOrchestrator(storeError('LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_STAGE_INVALID'),
        'LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_REJECTED');
      publish();
      return null;
    }
    const currentMidsurface = meshGeneration.selectShellMidsurface(stageId);
    let insertedByThisCall = false;
    try {
      const { replayPackage, promotion } =
        requireCurrentLafea4ShellProductRefinementReplayPackage(value);
      const finalEvidence = replayPackage.retentionAuthority.evidence;
      const stage = readStageState(stageId);
      const midsurface = meshGeneration.selectShellMidsurface(stageId);
      const meshProfile = meshGeneration.selectMeshProfile(stageId);
      if (stage.lifecycleBinding?.status !== 'CURRENT') {
        throw storeError('LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_SOURCE_NOT_CURRENT');
      }
      if (!midsurface) throw storeError('LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_MIDSURFACE_REQUIRED');
      if (!meshProfile) throw storeError('LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PROFILE_REQUIRED');
      if (finalEvidence.sourceHash !== midsurface.sourceHash
        || finalEvidence.analysisDomainHash !== midsurface.analysisDomainHash
        || finalEvidence.analysisGeometryHash !== midsurface.analysisGeometryHash
        || replayPackage.acceptance.midsurfaceEvidenceHash !== midsurface.semanticHash
        || finalEvidence.meshProfileHash !== meshProfile.semanticHash
        || replayPackage.acceptance.meshProfileHash !== meshProfile.semanticHash) {
        throw storeError('LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_CURRENT_PARENT_MISMATCH');
      }

      const preCompanion = createLafea4RetainedMeshParentNormalCompanion({
        meshEvidence: finalEvidence,
        midsurfaceEvidence: midsurface,
      });
      const preGate = validateLafea4ParentNormalProductionGate(
        evaluateLafea4ParentNormalProductionGate({ companion: preCompanion }),
      );
      if (preGate.retainedMeshAccepted !== true) {
        throw storeError(preGate.diagnosticCode ?? 'LAFEA4_PARENT_NORMAL_PRODUCTION_GATE_BLOCKED');
      }

      const recovered = meshGeneration.recoverEvidence(finalEvidence, stageId);
      insertedByThisCall = recovered.changed === true;
      const retained = meshGeneration.selectEvidence(stageId);
      if (!retained
        || retained.artifactHash !== finalEvidence.artifactHash
        || retained.meshHash !== finalEvidence.meshHash) {
        throw storeError('LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_RETENTION_MISMATCH');
      }
      const postCompanion = createLafea4RetainedMeshParentNormalCompanion({
        meshEvidence: retained,
        midsurfaceEvidence: midsurface,
      });
      const postGate = validateLafea4ParentNormalProductionGate(
        evaluateLafea4ParentNormalProductionGate({ companion: postCompanion }),
      );
      if (postGate.retainedMeshAccepted !== true
        || postCompanion.semanticHash !== preCompanion.semanticHash
        || postGate.semanticHash !== preGate.semanticHash) {
        throw storeError('LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PARENT_NORMAL_REPLAY_MISMATCH');
      }

      retainedPackages.set(stageId, replayPackage);
      continuumPreflight.clear(stageId);
      clearDomainFirstExecution(stageId);
      clearOrchestratorDiagnostic();
      return freeze({
        ...recovered,
        replayPackage,
        promotion,
        parentNormalCompanion: postCompanion,
        parentNormalProductionGate: postGate,
        productRefinementReplay: true,
        productRetentionAuthorized: true,
        uiBindingAuthorized: true,
        releaseQualified: false,
        stage: publish().stages[stageId],
      });
    } catch (error) {
      if (insertedByThisCall) {
        try {
          meshGeneration.invalidate(stageId);
          if (currentMidsurface) {
            meshGeneration.registerShellMidsurface(currentMidsurface, readStageState(stageId));
          }
        } catch {
          // Publication below remains fail-closed even if cleanup cannot restore the parent surface.
        }
      }
      failOrchestrator(error, 'LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_REJECTED');
      publish();
      return null;
    }
  }

  return Object.freeze({
    prepareProductRefinementReplayPackage,
    retainPreparedProductRefinementReplayPackage,
    selectRetainedProductRefinementReplayPackage,
    exportRetainedProductRefinementReplayPackage,
    recoverProductRefinementReplayPackage,
  });
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
