/**
 * Orchestrator actions for the bound analysis-mesh producer.
 *
 * These sit between the store's publication boundary and the generation state
 * slice: they enforce the route precondition, publish once per action, and
 * turn a producer/refinement/recovery rejection into an orchestrator diagnostic
 * rather than an exception escaping into the view.
 */
import { createLafeaLifecycleEvent } from './lafea-lifecycle.js';
import {
  createLafea4RetainedMeshParentNormalCompanion,
  isLafea4ParentNormalCompanionSurfaceQualified,
  requireCurrentLafea4RetainedMeshParentNormalCompanion,
  validateLafea4RetainedMeshParentNormalCompanion,
} from './lafea4-shell-retained-mesh-parent-normal-companion.js';
import {
  evaluateLafea4ParentNormalProductionGate,
  validateLafea4ParentNormalProductionGate,
} from './lafea4-parent-normal-production-gate.js';
import {
  LAFEA4_SHELL_PRODUCT_REFINEMENT_PENDING_CODE,
  evaluateLafea4ShellProductRefinementScope,
} from './lafea4-shell-product-refinement-contract.js';
import { previewLafea4ShellProductRefinement } from './lafea4-shell-product-refinement-adapter.js';
import {
  LAFEA4_SHELL_PRODUCT_REFINEMENT_ACCEPTANCE_BLOCK_CODE,
  evaluateLafea4ShellProductRefinementAcceptance,
  requireLafea4ShellProductRefinementCandidatePass,
} from './lafea4-shell-product-refinement-acceptance.js';
import {
  LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_BLOCK_CODE,
  requireLafea4ShellProductRefinementPromotionAuthorized,
} from './lafea4-shell-product-refinement-promotion.js';
import {
  finalizeLafea4ShellProductRefinementRetention,
  requireLafea4ShellProductRefinementGenericRecoveryAllowed,
} from './lafea4-shell-product-refinement-retention-authority.js';
import { createLafea4ShellProductRefinementReplayActions } from './lafea4-shell-product-refinement-replay-actions.js';

export function createLafeaMeshGenerationActions(context) {
  const {
    meshGeneration, mesh, continuumPreflight, rawStage, readStageState, deriveStage, publish,
    invokeRetained, getRetainedState, clearOrchestratorDiagnostic, failOrchestrator,
    clearDomainFirstExecution, storeError,
  } = context;
  const productRefinementReplay = createLafea4ShellProductRefinementReplayActions(context);

  function bindAnalysisMeshProfile(value, stageId = getRetainedState().activeStageId) {
    const result = meshGeneration.bindMeshProfile(value, stageId);
    if (!result.changed) return freeze({ ...result, stage: deriveStage(stageId) });
    continuumPreflight.clear(stageId);
    clearDomainFirstExecution(stageId);
    const event = createLafeaLifecycleEvent({
      eventId: `MESH_PROFILE_BIND/${result.meshProfile.semanticHash}`,
      stageId,
      changeClass: 'ANALYSIS_MESH_PROFILE',
      previousSourceHash: null,
      currentSourceHash: null,
      profileHash: result.meshProfile.semanticHash,
      originRef: 'LAFEA_WORKBENCH/MESH_PROFILE_BIND',
    });
    invokeRetained('applyLifecycleEvent', [event]);
    const succeeded = getRetainedState().status !== 'FAILED';
    mesh.afterLifecycleEvent(event, succeeded);
    if (succeeded) clearOrchestratorDiagnostic();
    return freeze({ ...result, stage: publish().stages[stageId] });
  }

  function registerShellMidsurfaceEvidence(
    value,
    stageId = value?.stageId ?? getRetainedState().activeStageId,
  ) {
    try {
      const result = meshGeneration.registerShellMidsurface(value, readStageState(stageId));
      clearOrchestratorDiagnostic();
      return freeze({ ...result, stage: (result.changed ? publish() : deriveState()).stages[stageId] });
    } catch (error) {
      failOrchestrator(error, 'LAFEA_SHELL_MIDSURFACE_REGISTRATION_REJECTED');
      publish();
      return null;
    }
  }

  function planAnalysisMesh(overrides = {}, stageId = getRetainedState().activeStageId) {
    return attempt(stageId, 'LAFEA_ANALYSIS_MESH_PLAN_REJECTED',
      () => meshGeneration.planMesh(readStageState(stageId), overrides), false);
  }

  function generateAnalysisMesh(overrides = {}, stageId = getRetainedState().activeStageId) {
    return attempt(stageId, 'LAFEA_ANALYSIS_MESH_GENERATION_REJECTED', () => {
      const currentMidsurface = stageId === 'LAFEA.4'
        ? meshGeneration.selectShellMidsurface(stageId)
        : null;
      const result = meshGeneration.generateMesh(readStageState(stageId), overrides);
      try {
        const parentNormalCompanion = parentNormalCompanionForEvidence(stageId, result.evidence);
        const parentNormalProductionGate = parentNormalProductionGateForCompanion(parentNormalCompanion);
        requireProductionGateAllowsRetention(parentNormalProductionGate);
        return parentNormalCompanion
          ? freeze({ ...result, parentNormalCompanion, parentNormalProductionGate })
          : result;
      } catch (error) {
        rollbackCompanionCustody(stageId, currentMidsurface);
        throw error;
      }
    }, true);
  }

  function refineAnalysisMesh(request = {}, stageId = getRetainedState().activeStageId) {
    return attempt(stageId, 'LAFEA_RETAINED_MESH_REFINEMENT_REJECTED', () => {
      const midsurface = meshGeneration.selectShellMidsurface(stageId);
      if (!midsurface || stageId !== 'LAFEA.4') {
        return meshGeneration.refineMesh(readStageState(stageId), request);
      }
      const parentEvidence = meshGeneration.selectEvidence(stageId);
      if (!parentEvidence) throw storeError('LAFEA_RETAINED_MESH_REFINEMENT_PARENT_REQUIRED');
      const meshProfile = meshGeneration.selectMeshProfile(stageId);
      if (!meshProfile) throw storeError('LAFEA_ANALYSIS_MESH_PROFILE_BINDING_REQUIRED');
      const stage = readStageState(stageId);
      const scope = evaluateLafea4ShellProductRefinementScope({
        stage,
        parentEvidence,
        midsurfaceEvidence: midsurface,
        meshProfile,
        request,
      });
      const adapterResult = previewLafea4ShellProductRefinement({
        stage,
        parentEvidence,
        midsurfaceEvidence: midsurface,
        meshProfile,
        request,
      });
      const acceptance = evaluateLafea4ShellProductRefinementAcceptance({
        stage,
        parentEvidence,
        midsurfaceEvidence: midsurface,
        meshProfile,
        adapterResult,
      });
      try {
        requireLafea4ShellProductRefinementCandidatePass(acceptance);
      } catch (error) {
        throw storeError(error?.code ?? LAFEA4_SHELL_PRODUCT_REFINEMENT_ACCEPTANCE_BLOCK_CODE);
      }
      if (scope.semanticHash !== acceptance.productScopeHash
        || parentEvidence.meshHash !== meshGeneration.selectEvidence(stageId)?.meshHash) {
        throw storeError('LAFEA4_SHELL_PRODUCT_REFINEMENT_PARENT_CHANGED_DURING_CANDIDATE_GATE');
      }

      let promotion;
      try {
        promotion = requireLafea4ShellProductRefinementPromotionAuthorized();
      } catch (error) {
        throw storeError(
          error?.diagnosticCode
            ?? error?.code
            ?? LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_BLOCK_CODE,
        );
      }

      const retentionAuthority = finalizeLafea4ShellProductRefinementRetention({
        adapterResult,
        acceptance,
        promotion,
      });
      const replayPackage = productRefinementReplay.prepareProductRefinementReplayPackage({
        retentionAuthority,
        acceptance,
        promotion,
      });
      const childEvidence = retentionAuthority.evidence;
      const parentNormalCompanion = parentNormalCompanionForEvidence(stageId, childEvidence);
      const parentNormalProductionGate = parentNormalProductionGateForCompanion(parentNormalCompanion);
      requireProductionGateAllowsRetention(parentNormalProductionGate);

      const retained = replaceLafea4ProductRefinementEvidence({
        stageId,
        parentEvidence,
        midsurface,
        childEvidence,
      });
      productRefinementReplay.retainPreparedProductRefinementReplayPackage(replayPackage);
      return freeze({
        ...retained,
        scope,
        acceptance,
        promotion,
        retentionAuthority,
        replayPackage,
        candidateEvidenceArtifactHash: adapterResult.productEvidence.artifactHash,
        parentNormalCompanion,
        parentNormalProductionGate,
        productRefinement: true,
        productRetentionAuthorized: true,
        uiBindingAuthorized: true,
        releaseQualified: false,
      });
    }, true);
  }

  /**
   * Replace the retained LAFEA.4 mesh without publishing an intermediate
   * state. All engineering gates have already passed before this function is
   * entered. If any synchronous custody operation still rejects, restore the
   * exact parent before the outer action publishes its diagnostic.
   */
  function replaceLafea4ProductRefinementEvidence({
    stageId, parentEvidence, midsurface, childEvidence,
  }) {
    if (stageId !== 'LAFEA.4') throw storeError('LAFEA4_PRODUCT_REFINEMENT_STAGE_INVALID');
    const current = meshGeneration.selectEvidence(stageId);
    if (!current
      || current.artifactHash !== parentEvidence.artifactHash
      || current.meshHash !== parentEvidence.meshHash) {
      throw storeError('LAFEA4_SHELL_PRODUCT_REFINEMENT_PARENT_CHANGED_BEFORE_RETENTION');
    }
    try {
      meshGeneration.invalidate(stageId);
      meshGeneration.registerShellMidsurface(midsurface, readStageState(stageId));
      const recovered = meshGeneration.recoverEvidence(childEvidence, stageId);
      const retained = meshGeneration.selectEvidence(stageId);
      if (!retained
        || retained.artifactHash !== childEvidence.artifactHash
        || retained.meshHash !== childEvidence.meshHash) {
        throw storeError('LAFEA4_SHELL_PRODUCT_REFINEMENT_CHILD_RETENTION_MISMATCH');
      }
      return freeze({
        changed: recovered.changed,
        parentEvidence,
        evidence: retained,
        meshProfile: recovered.meshProfile,
      });
    } catch (error) {
      try {
        meshGeneration.invalidate(stageId);
        meshGeneration.registerShellMidsurface(midsurface, readStageState(stageId));
        meshGeneration.recoverEvidence(parentEvidence, stageId);
        const restored = meshGeneration.selectEvidence(stageId);
        if (!restored
          || restored.artifactHash !== parentEvidence.artifactHash
          || restored.meshHash !== parentEvidence.meshHash) {
          throw new Error('PARENT_RESTORE_MISMATCH');
        }
      } catch (rollbackError) {
        const fatal = storeError('LAFEA4_SHELL_PRODUCT_REFINEMENT_ATOMIC_ROLLBACK_FAILED');
        fatal.cause = rollbackError;
        throw fatal;
      }
      throw error;
    }
  }

  function recoverAnalysisMeshEvidenceV2(
    value,
    stageId = value?.stageId ?? getRetainedState().activeStageId,
  ) {
    requireGenerationAuthorized(stageId);
    const currentMidsurface = stageId === 'LAFEA.4'
      ? meshGeneration.selectShellMidsurface(stageId)
      : null;
    try {
      const validated = meshGeneration.validateEvidence(value);
      if (validated.stageId !== stageId) {
        throw storeError('LAFEA_ANALYSIS_MESH_V2_RECOVERY_STAGE_MISMATCH');
      }
      try {
        requireLafea4ShellProductRefinementGenericRecoveryAllowed(validated);
      } catch (error) {
        throw storeError(error?.code ?? 'LAFEA4_SHELL_PRODUCT_REFINEMENT_GENERIC_RECOVERY_FORBIDDEN');
      }
      const prevalidatedCompanion = parentNormalCompanionForEvidence(stageId, validated);
      const prevalidatedProductionGate = parentNormalProductionGateForCompanion(prevalidatedCompanion);
      requireProductionGateAllowsRetention(prevalidatedProductionGate);
      const currentProfile = meshGeneration.selectMeshProfile(stageId);
      const binding = currentProfile?.semanticHash === validated.meshProfileHash
        ? freeze({ changed: false, meshProfile: currentProfile })
        : bindAnalysisMeshProfile(validated.meshProfile, stageId);
      if (getRetainedState().status === 'FAILED') return null;
      const result = meshGeneration.recoverEvidence(validated, stageId);
      let retainedCompanion;
      let retainedProductionGate;
      try {
        retainedCompanion = parentNormalCompanionForEvidence(stageId, result.evidence);
        retainedProductionGate = parentNormalProductionGateForCompanion(retainedCompanion);
        requireProductionGateAllowsRetention(retainedProductionGate);
        if (prevalidatedCompanion && retainedCompanion
          && prevalidatedCompanion.semanticHash !== retainedCompanion.semanticHash) {
          throw storeError('LAFEA4_PARENT_NORMAL_COMPANION_RECOVERY_REPLAY_MISMATCH');
        }
        if (prevalidatedProductionGate && retainedProductionGate
          && prevalidatedProductionGate.semanticHash !== retainedProductionGate.semanticHash) {
          throw storeError('LAFEA4_PARENT_NORMAL_PRODUCTION_GATE_RECOVERY_REPLAY_MISMATCH');
        }
      } catch (error) {
        rollbackCompanionCustody(stageId, currentMidsurface);
        throw error;
      }
      continuumPreflight.clear(stageId);
      clearDomainFirstExecution(stageId);
      clearOrchestratorDiagnostic();
      return freeze({
        ...result,
        parentNormalCompanion: retainedCompanion,
        parentNormalProductionGate: retainedProductionGate,
        profileChanged: binding.changed,
        stage: publish().stages[stageId],
      });
    } catch (error) {
      failOrchestrator(error, 'LAFEA_ANALYSIS_MESH_V2_RECOVERY_REJECTED');
      publish();
      return null;
    }
  }

  function selectRetainedAnalysisMeshParentNormalCompanion(
    stageId = getRetainedState().activeStageId,
  ) {
    const retained = meshGeneration.selectEvidence(stageId);
    if (!retained) return null;
    return parentNormalCompanionForEvidence(stageId, retained);
  }

  function exportRetainedAnalysisMeshParentNormalCompanion(
    stageId = getRetainedState().activeStageId,
  ) {
    return selectRetainedAnalysisMeshParentNormalCompanion(stageId);
  }

  function validateRetainedAnalysisMeshParentNormalCompanion(
    value,
    stageId = value?.stageId ?? getRetainedState().activeStageId,
  ) {
    const candidate = validateLafea4RetainedMeshParentNormalCompanion(value);
    const retained = meshGeneration.selectEvidence(stageId);
    const midsurface = meshGeneration.selectShellMidsurface(stageId);
    if (!retained || !midsurface) {
      throw storeError('LAFEA4_PARENT_NORMAL_COMPANION_CURRENT_PARENTS_REQUIRED');
    }
    return requireCurrentLafea4RetainedMeshParentNormalCompanion(candidate, {
      meshEvidence: retained,
      midsurfaceEvidence: midsurface,
    });
  }

  function selectRetainedAnalysisMeshParentNormalProductionGate(
    stageId = getRetainedState().activeStageId,
  ) {
    const companion = selectRetainedAnalysisMeshParentNormalCompanion(stageId);
    return parentNormalProductionGateForCompanion(companion);
  }

  function exportRetainedAnalysisMeshParentNormalProductionGate(
    stageId = getRetainedState().activeStageId,
  ) {
    return selectRetainedAnalysisMeshParentNormalProductionGate(stageId);
  }

  function parentNormalCompanionForEvidence(stageId, meshEvidence) {
    if (stageId !== 'LAFEA.4') return null;
    const midsurface = meshGeneration.selectShellMidsurface(stageId);
    if (!midsurface) throw storeError('LAFEA4_PARENT_NORMAL_COMPANION_MIDSURFACE_REQUIRED');
    if (!isLafea4ParentNormalCompanionSurfaceQualified(midsurface)) return null;
    return createLafea4RetainedMeshParentNormalCompanion({
      meshEvidence,
      midsurfaceEvidence: midsurface,
    });
  }

  function parentNormalProductionGateForCompanion(companion) {
    if (!companion) return null;
    return validateLafea4ParentNormalProductionGate(
      evaluateLafea4ParentNormalProductionGate({ companion }),
    );
  }

  function requireProductionGateAllowsRetention(gate) {
    if (!gate || gate.retainedMeshAccepted === true) return;
    throw storeError(gate.diagnosticCode ?? 'LAFEA4_PARENT_NORMAL_PRODUCTION_GATE_BLOCKED');
  }

  function rollbackCompanionCustody(stageId, midsurface) {
    if (stageId !== 'LAFEA.4' || !midsurface) return;
    meshGeneration.invalidate(stageId);
    meshGeneration.registerShellMidsurface(midsurface, readStageState(stageId));
  }

  function attempt(stageId, fallbackCode, action, invalidatesExecution) {
    requireGenerationAuthorized(stageId);
    try {
      const result = action();
      if (invalidatesExecution) {
        continuumPreflight.clear(stageId);
        clearDomainFirstExecution(stageId);
      }
      clearOrchestratorDiagnostic();
      return freeze({ ...result, stage: publish().stages[stageId] });
    } catch (error) {
      failOrchestrator(error, fallbackCode);
      publish();
      return null;
    }
  }

  function requireGenerationAuthorized(stageId) {
    const stage = rawStage(stageId);
    if (stage.domainFirstProfileActive || stage.shellMidsurfaceProfileActive) return;
    throw storeError(stageId === 'LAFEA.4' || stageId === 'LAFEA.5'
      ? 'LAFEA_ANALYSIS_MESH_GENERATION_REQUIRES_SHELL_MIDSURFACE_EVIDENCE'
      : 'LAFEA_ANALYSIS_MESH_GENERATION_REQUIRES_DOMAIN_FIRST_PROFILE');
  }

  function deriveState() {
    return Object.freeze({
      stages: Object.fromEntries(
        Object.keys(getRetainedState().stages).map((stageId) => [stageId, deriveStage(stageId)]),
      ),
    });
  }

  return Object.freeze({
    bindAnalysisMeshProfile,
    registerShellMidsurfaceEvidence,
    planAnalysisMesh,
    generateAnalysisMesh,
    refineAnalysisMesh,
    recoverAnalysisMeshEvidenceV2,
    selectRetainedAnalysisMeshParentNormalCompanion,
    exportRetainedAnalysisMeshParentNormalCompanion,
    validateRetainedAnalysisMeshParentNormalCompanion,
    selectRetainedAnalysisMeshParentNormalProductionGate,
    exportRetainedAnalysisMeshParentNormalProductionGate,
    ...productRefinementReplay,
  });
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}