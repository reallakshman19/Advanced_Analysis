#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeLafea4Tech13ImplementationFingerprint,
} from './lib/lafea4-tech13-implementation-fingerprint.mjs';
import { canonicalProfile, PROFILE_KINDS } from '../src/core/lafea-profile-contract/index.js';
import { createLafeaMockDocument } from '../src/workspace/advanced-mock-data.js';
import { normalizeLafeaStageDocument } from '../src/workspace/lafea-workbench-model.js';
import { issueLafeaSourceAuthority } from '../src/workspace/lafea-source-authority.js';
import { createLafeaSimulatedShellMidsurfaceEvidence } from '../src/workspace/lafea-simulated-shell-midsurface-provider.js';
import { LAFEA_SHELL_ELEMENT } from '../src/workspace/lafea-shell-mesh-producer.js';
import { createLafeaWorkbenchOrchestratorStore } from '../src/workspace/lafea-workbench-orchestrator-store.js';
import { createLafeaWorkbenchMeshGenerationState } from '../src/workspace/lafea-workbench-mesh-generation-state.js';
import { createLafeaMeshGenerationActions } from '../src/workspace/lafea-workbench-mesh-generation-actions.js';
import { buildLafea4ShellProductRefinementUiPolicy } from '../src/workspace/lafea4-shell-product-refinement-ui-policy.js';
import {
  LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_RECORD,
  evaluateLafea4ShellProductRefinementPromotion,
  requireLafea4ShellProductRefinementPromotionAuthorized,
} from '../src/workspace/lafea4-shell-product-refinement-promotion.js';
import {
  LAFEA4_SHELL_PRODUCT_REFINEMENT_GENERIC_RECOVERY_FORBIDDEN,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_PRODUCER_REF,
} from '../src/workspace/lafea4-shell-product-refinement-retention-authority.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const implementation = computeLafea4Tech13ImplementationFingerprint({ rootDir: ROOT });
// This Node-only qualification harness mirrors the value that Vite injects
// into production. The production product API itself has no authority seam.
globalThis.__LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT__ = implementation.fingerprint;

if (LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_RECORD === null) {
  const error = new Error('TECH13G_ACTIVE_PROMOTION_TRUST_ROOT_REQUIRED');
  error.code = 'TECH13G_ACTIVE_PROMOTION_TRUST_ROOT_REQUIRED';
  throw error;
}
const promotion = requireLafea4ShellProductRefinementPromotionAuthorized();
assert.equal(evaluateLafea4ShellProductRefinementPromotion().active, true);
assert.equal(promotion.implementationCurrentness?.current, true);
assert.equal(promotion.implementationCurrentness?.currentImplementationFingerprint,
  implementation.fingerprint);
assert.equal(promotion.promotionRecord.implementationFingerprint, implementation.fingerprint);
assert.equal(promotion.productRetentionAuthorized, true);
assert.equal(promotion.uiBindingAuthorized, true);
assert.equal(promotion.releaseQualified, false);

const stageId = 'LAFEA.4';
const document = normalizeLafeaStageDocument(stageId, createLafeaMockDocument(stageId));
const sourceAuthority = issueLafeaSourceAuthority(stageId, document, 'TECH13G-ACTIVE-PROMOTION');
const midsurface = createLafeaSimulatedShellMidsurfaceEvidence(
  stageId, sourceAuthority.sourceHash, document,
);
const profile = canonicalProfile(PROFILE_KINDS.MESH, {
  schema: 'lafea-mesh-profile/v1',
  profileIdentity: 'TECH13G_ACTIVE_CURVED_TRI3',
  sourceRevision: 'TECH13G-ACTIVE-V1',
  semanticHash: undefined,
  fields: {
    continuumElement: 'T3',
    shellElement: LAFEA_SHELL_ELEMENT,
    globalTargetSize: 15,
    adjacentSizeRatioMax: 1.5,
    aspectRatioWarn: 5,
    aspectRatioBlock: 10,
    scaledJacobianWarn: 0.5,
    scaledJacobianBlock: 0.2,
    adaptiveLevels: 3,
  },
});

const workbench = createLafeaWorkbenchOrchestratorStore({
  initialStage: stageId,
  initialDocument: document,
  initialSourceHash: sourceAuthority.sourceHash,
});
assert.equal(workbench.registerShellMidsurfaceEvidence(midsurface, stageId)?.changed, true);
assert.equal(workbench.bindAnalysisMeshProfile(profile, stageId)?.changed, true);
assert.equal(workbench.generateAnalysisMesh({}, stageId)?.evidence.qualification, 'PASS');
const parent = workbench.selectRetainedAnalysisMeshEvidenceV2(stageId);
assert.ok(parent);
const stage = workbench.getState().stages[stageId];
const target = parent.mesh.elements[Math.floor(parent.mesh.elements.length / 2)];
const request = {
  commandId: 'TECH13G-ACTIVE-REFINE',
  targetType: 'ELEMENT',
  targetIds: [target.elementId],
  targetElementLength: 7.5,
  lengthUnit: midsurface.geometry.lengthUnit,
  reason: 'TECH13G trust-root-only activation verification',
};

const ui = buildLafea4ShellProductRefinementUiPolicy(stage);
assert.equal(ui.scopeEligible, true);
assert.equal(ui.productQualified, true);
assert.equal(ui.canRefine, true);
assert.deepEqual(ui.allowedTargetTypes, ['ELEMENT']);

const result = workbench.refineAnalysisMesh(request, stageId);
assert.ok(result);
assert.equal(result.productRefinement, true);
assert.equal(result.productRetentionAuthorized, true);
assert.equal(result.uiBindingAuthorized, true);
assert.equal(result.releaseQualified, false);
assert.ok(result.retentionAuthority);
assert.ok(result.replayPackage);
assert.equal(result.retentionAuthority.productRetentionAuthorized, true);
assert.equal(result.retentionAuthority.releaseQualified, false);
assert.equal(result.evidence.authority.producerRef,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_PRODUCER_REF);
assert.equal(result.evidence.authority.qualificationHash,
  result.retentionAuthority.retainedQualification.qualificationHash);
assert.equal(result.evidence.authority.planHash,
  result.retentionAuthority.retentionPlan.planHash);
assert.equal(result.evidence.meshHash, result.retentionAuthority.candidateEvidence.meshHash,
  'promotion-time rewrap must preserve exact candidate mesh bytes/hash');
assert.notEqual(result.evidence.artifactHash,
  result.retentionAuthority.candidateEvidence.artifactHash,
  'retained product artifact must not retain candidate-only authority');
assert.notEqual(result.evidence.artifactHash, parent.artifactHash);
assert.notEqual(result.evidence.meshHash, parent.meshHash);
assert.equal(workbench.selectRetainedAnalysisMeshEvidenceV2(stageId)?.artifactHash,
  result.evidence.artifactHash);
assert.equal(workbench.getState().stages[stageId].analysisMeshCustodyProjection.state,
  'CURRENT_PASS');

const replayPackage = workbench.exportLafea4ProductRefinementReplayPackage(stageId);
assert.ok(replayPackage);
assert.equal(replayPackage.semanticHash, result.replayPackage.semanticHash);
assert.equal(replayPackage.retentionAuthority.evidence.artifactHash, result.evidence.artifactHash);
assert.equal(replayPackage.retentionAuthority.evidence.meshHash, result.evidence.meshHash);
assert.equal(replayPackage.genericV2RecoveryAuthorized, false);
assert.equal(replayPackage.dedicatedReplayRequired, true);

const genericReplayWorkbench = createReplayWorkbench();
const genericReplay = genericReplayWorkbench.recoverAnalysisMeshEvidenceV2(
  replayPackage.retentionAuthority.evidence, stageId,
);
assert.equal(genericReplay, null);
assert.equal(genericReplayWorkbench.getState().diagnostics?.[0]?.code,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_GENERIC_RECOVERY_FORBIDDEN);
assert.equal(genericReplayWorkbench.selectRetainedAnalysisMeshEvidenceV2(stageId), null);

const replayWorkbench = createReplayWorkbench();
const replayed = replayWorkbench.recoverLafea4ProductRefinementReplayPackage(
  replayPackage, stageId,
);
assert.ok(replayed);
assert.equal(replayed.productRefinementReplay, true);
assert.equal(replayed.productRetentionAuthorized, true);
assert.equal(replayed.uiBindingAuthorized, true);
assert.equal(replayed.releaseQualified, false);
assert.equal(replayed.evidence.artifactHash, result.evidence.artifactHash);
assert.equal(replayed.evidence.meshHash, result.evidence.meshHash);
assert.equal(replayWorkbench.selectRetainedAnalysisMeshEvidenceV2(stageId)?.artifactHash,
  result.evidence.artifactHash);
assert.equal(replayWorkbench.selectRetainedAnalysisMeshEvidenceV2(stageId)?.meshHash,
  result.evidence.meshHash);
assert.equal(replayWorkbench.getState().stages[stageId].analysisMeshCustodyProjection.state,
  'CURRENT_PASS');
const replayExport = replayWorkbench.exportLafea4ProductRefinementReplayPackage(stageId);
assert.ok(replayExport);
assert.equal(replayExport.semanticHash, replayPackage.semanticHash);
assert.equal(replayExport.retentionAuthority.evidence.artifactHash, result.evidence.artifactHash);

const rollbackHarness = createRollbackHarness({ stage, parent });
const failed = rollbackHarness.actions.refineAnalysisMesh(request, stageId);
assert.equal(failed, null);
assert.equal(rollbackHarness.diagnostic(), 'TECH13G_FORCED_CHILD_RECOVERY_FAILURE');
assert.equal(rollbackHarness.meshGeneration.selectEvidence(stageId)?.artifactHash,
  parent.artifactHash);
assert.equal(rollbackHarness.meshGeneration.selectEvidence(stageId)?.meshHash,
  parent.meshHash);

console.log(JSON.stringify({
  check: 'lafea-tech13g-active-promotion-path',
  status: 'PASS',
  qualifiedHead: promotion.qualifiedHead,
  implementationFingerprint: implementation.fingerprint,
  implementationCurrent: promotion.implementationCurrentness.current,
  promotionRecordHash: promotion.promotionRecord.semanticHash,
  uiCanRefine: ui.canRefine,
  parentArtifactHash: parent.artifactHash,
  candidateArtifactHash: result.retentionAuthority.candidateEvidence.artifactHash,
  childArtifactHash: result.evidence.artifactHash,
  childMeshHash: result.evidence.meshHash,
  retainedProducerRef: result.evidence.authority.producerRef,
  retainedQualificationHash: result.evidence.authority.qualificationHash,
  retainedPlanHash: result.evidence.authority.planHash,
  custodyStateAfterSuccess: workbench.getState().stages[stageId].analysisMeshCustodyProjection.state,
  genericReplayBlocked: true,
  dedicatedRoundTripRestoredExactArtifact: true,
  roundTripPackageSemanticHash: replayPackage.semanticHash,
  rollbackRestoredParent: true,
  releaseQualified: false,
}, null, 2));

delete globalThis.__LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT__;
genericReplayWorkbench.destroy();
replayWorkbench.destroy();
workbench.destroy();

function createReplayWorkbench() {
  const replay = createLafeaWorkbenchOrchestratorStore({
    initialStage: stageId,
    initialDocument: document,
    initialSourceHash: sourceAuthority.sourceHash,
  });
  assert.equal(replay.registerShellMidsurfaceEvidence(midsurface, stageId)?.changed, true);
  assert.equal(replay.bindAnalysisMeshProfile(profile, stageId)?.changed, true);
  assert.equal(replay.selectRetainedAnalysisMeshEvidenceV2(stageId), null);
  return replay;
}

function createRollbackHarness({ stage: sourceStage, parent: sourceParent }) {
  const meshGeneration = createLafeaWorkbenchMeshGenerationState([stageId]);
  meshGeneration.bindMeshProfile(profile, stageId);
  meshGeneration.registerShellMidsurface(midsurface, sourceStage);
  meshGeneration.recoverEvidence(sourceParent, stageId);
  const originalRecover = meshGeneration.recoverEvidence.bind(meshGeneration);
  const wrappedMeshGeneration = Object.freeze({
    ...meshGeneration,
    recoverEvidence(value, id) {
      if (value.artifactHash !== sourceParent.artifactHash) {
        const error = new TypeError('TECH13G_FORCED_CHILD_RECOVERY_FAILURE');
        error.code = 'TECH13G_FORCED_CHILD_RECOVERY_FAILURE';
        throw error;
      }
      return originalRecover(value, id);
    },
  });
  let diagnostic = null;
  const readStageState = () => ({
    ...sourceStage,
    retainedAnalysisMeshProfile: profile,
    retainedShellMidsurfaceEvidence: wrappedMeshGeneration.selectShellMidsurface(stageId),
    retainedAnalysisMeshEvidenceV2: wrappedMeshGeneration.selectEvidence(stageId),
    shellMidsurfaceProfileActive: true,
  });
  const storeError = (code) => {
    const error = new TypeError(code);
    error.code = code;
    return error;
  };
  const actions = createLafeaMeshGenerationActions({
    meshGeneration: wrappedMeshGeneration,
    mesh: {},
    continuumPreflight: { clear() {} },
    rawStage: readStageState,
    readStageState,
    deriveStage: readStageState,
    publish: () => ({ stages: { [stageId]: readStageState() } }),
    invokeRetained() {},
    getRetainedState: () => ({ activeStageId: stageId, status: 'READY', stages: { [stageId]: {} } }),
    clearOrchestratorDiagnostic: () => { diagnostic = null; },
    failOrchestrator: (error, fallback) => { diagnostic = error?.code ?? fallback; },
    clearDomainFirstExecution() {},
    storeError,
  });
  return { actions, meshGeneration: wrappedMeshGeneration, diagnostic: () => diagnostic };
}
