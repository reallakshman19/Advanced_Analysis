#!/usr/bin/env node
import assert from 'node:assert/strict';

import { canonicalProfile, PROFILE_KINDS } from '../src/core/lafea-profile-contract/index.js';
import { createLafeaMockDocument } from '../src/workspace/advanced-mock-data.js';
import { normalizeLafeaStageDocument } from '../src/workspace/lafea-workbench-model.js';
import { issueLafeaSourceAuthority } from '../src/workspace/lafea-source-authority.js';
import { createLafeaSimulatedShellMidsurfaceEvidence } from '../src/workspace/lafea-simulated-shell-midsurface-provider.js';
import { LAFEA_SHELL_ELEMENT } from '../src/workspace/lafea-shell-mesh-producer.js';
import { createLafeaWorkbenchOrchestratorStore } from '../src/workspace/lafea-workbench-orchestrator-store.js';
import {
  LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_QUALIFICATION,
  previewLafea4ShellProductRefinement,
} from '../src/workspace/lafea4-shell-product-refinement-adapter.js';
import {
  evaluateLafea4ShellProductRefinementAcceptance,
  requireLafea4ShellProductRefinementCandidatePass,
} from '../src/workspace/lafea4-shell-product-refinement-acceptance.js';
import {
  LAFEA4_SHELL_PRODUCT_REFINEMENT_EXACT_HEAD_QUALIFICATION_ID,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_RECORD,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_SCHEMA,
  createLafea4ShellProductRefinementPromotionRecord,
} from '../src/workspace/lafea4-shell-product-refinement-promotion.js';
import {
  finalizeLafea4ShellProductRefinementRetention,
} from '../src/workspace/lafea4-shell-product-refinement-retention-authority.js';
import {
  LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_CURRENT_PROMOTION_REQUIRED,
  createLafea4ShellProductRefinementReplayPackage,
  requireCurrentLafea4ShellProductRefinementReplayPackage,
  validateLafea4ShellProductRefinementReplayPackage,
} from '../src/workspace/lafea4-shell-product-refinement-replay.js';

const stageId = 'LAFEA.4';
const document = normalizeLafeaStageDocument(stageId, createLafeaMockDocument(stageId));
const sourceAuthority = issueLafeaSourceAuthority(stageId, document, 'TECH13I-REPLAY');
const midsurface = createLafeaSimulatedShellMidsurfaceEvidence(
  stageId, sourceAuthority.sourceHash, document,
);
const profile = canonicalProfile(PROFILE_KINDS.MESH, {
  schema: 'lafea-mesh-profile/v1',
  profileIdentity: 'TECH13I_SAMPLE_CURVED_TRI3',
  sourceRevision: 'TECH13I-V1',
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
assert.equal(typeof workbench.exportLafea4ProductRefinementReplayPackage, 'function');
assert.equal(typeof workbench.recoverLafea4ProductRefinementReplayPackage, 'function');
assert.equal(workbench.registerShellMidsurfaceEvidence(midsurface, stageId)?.changed, true);
assert.equal(workbench.bindAnalysisMeshProfile(profile, stageId)?.changed, true);
assert.equal(workbench.generateAnalysisMesh({}, stageId)?.evidence.qualification, 'PASS');
const parent = workbench.selectRetainedAnalysisMeshEvidenceV2(stageId);
assert.ok(parent);
const parentArtifactHash = parent.artifactHash;
const parentMeshHash = parent.meshHash;

const target = parent.mesh.elements[Math.floor(parent.mesh.elements.length / 2)];
const request = {
  commandId: 'TECH13I-SAMPLE-REFINE',
  targetType: 'ELEMENT',
  targetIds: [target.elementId],
  targetElementLength: 7.5,
  lengthUnit: midsurface.geometry.lengthUnit,
  reason: 'TECH13I promoted refinement replay fixture',
};
const stage = workbench.getState().stages[stageId];
const adapter = previewLafea4ShellProductRefinement({
  stage,
  parentEvidence: parent,
  midsurfaceEvidence: midsurface,
  meshProfile: profile,
  request,
});
const acceptance = evaluateLafea4ShellProductRefinementAcceptance({
  stage,
  parentEvidence: parent,
  midsurfaceEvidence: midsurface,
  meshProfile: profile,
  adapterResult: adapter,
});
requireLafea4ShellProductRefinementCandidatePass(acceptance);

assert.equal(LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_RECORD, null);
const syntheticRecord = createLafea4ShellProductRefinementPromotionRecord({
  schema: LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_SCHEMA,
  stageId,
  exactHeadQualificationId: LAFEA4_SHELL_PRODUCT_REFINEMENT_EXACT_HEAD_QUALIFICATION_ID,
  qualifiedHead: 'a'.repeat(40),
  bundleEvidenceSha256: 'b'.repeat(64),
  bundlePlanSha256: 'c'.repeat(64),
  bundleRunnerSha256: 'd'.repeat(64),
  capabilityHash: LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY.capabilityHash,
  qualificationHash: LAFEA4_SHELL_PRODUCT_REFINEMENT_QUALIFICATION.qualificationHash,
  qualificationClassification: 'PASS',
  qualificationComplete: true,
  futurePromotionReviewEligible: true,
  productRetentionAuthorized: true,
  uiBindingAuthorized: true,
  releaseQualified: false,
});
const syntheticPromotion = Object.freeze({
  active: true,
  promotionRecord: syntheticRecord,
  qualifiedHead: syntheticRecord.qualifiedHead,
  productRetentionAuthorized: true,
  uiBindingAuthorized: true,
  releaseQualified: false,
});
const retentionAuthority = finalizeLafea4ShellProductRefinementRetention({
  adapterResult: adapter,
  acceptance,
  promotion: syntheticPromotion,
});
const replayPackage = createLafea4ShellProductRefinementReplayPackage({
  retentionAuthority,
  acceptance,
  promotion: syntheticPromotion,
});
const validatedReplay = validateLafea4ShellProductRefinementReplayPackage(replayPackage);
assert.equal(validatedReplay.semanticHash, replayPackage.semanticHash);
assert.equal(validatedReplay.genericV2RecoveryAuthorized, false);
assert.equal(validatedReplay.dedicatedReplayRequired, true);
assert.equal(validatedReplay.releaseQualified, false);
assert.equal(validatedReplay.retentionAuthority.evidence.meshHash,
  adapter.productEvidence.meshHash);
assert.notEqual(validatedReplay.retentionAuthority.evidence.artifactHash,
  adapter.productEvidence.artifactHash);

// A structurally valid package cannot activate replay. Production authority is
// still the source-controlled null trust root.
assert.throws(
  () => requireCurrentLafea4ShellProductRefinementReplayPackage(replayPackage),
  (error) => error?.code === LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_CURRENT_PROMOTION_REQUIRED,
);
const dedicatedRecovery = workbench.recoverLafea4ProductRefinementReplayPackage(
  replayPackage, stageId,
);
assert.equal(dedicatedRecovery, null);
assert.equal(workbench.getState().diagnostics?.[0]?.code,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_CURRENT_PROMOTION_REQUIRED);
assert.equal(workbench.selectRetainedAnalysisMeshEvidenceV2(stageId)?.artifactHash,
  parentArtifactHash);
assert.equal(workbench.selectRetainedAnalysisMeshEvidenceV2(stageId)?.meshHash,
  parentMeshHash);
assert.equal(workbench.exportLafea4ProductRefinementReplayPackage(stageId), null);

// The same promoted evidence still cannot use generic V2 recovery.
const genericRecovery = workbench.recoverAnalysisMeshEvidenceV2(
  replayPackage.retentionAuthority.evidence, stageId,
);
assert.equal(genericRecovery, null);
assert.equal(workbench.getState().diagnostics?.[0]?.code,
  'LAFEA4_SHELL_PRODUCT_REFINEMENT_GENERIC_RECOVERY_FORBIDDEN');
assert.equal(workbench.selectRetainedAnalysisMeshEvidenceV2(stageId)?.artifactHash,
  parentArtifactHash);
assert.equal(workbench.selectRetainedAnalysisMeshEvidenceV2(stageId)?.meshHash,
  parentMeshHash);

const tampered = structuredClone(replayPackage);
tampered.retentionAuthority.retentionPlan.qualifiedHead = 'e'.repeat(40);
assert.throws(
  () => validateLafea4ShellProductRefinementReplayPackage(tampered),
  /LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PACKAGE_INVALID|LAFEA4_SHELL_PRODUCT_REFINEMENT_RETENTION_PLAN_TAMPERED/u,
);

const tamperedHash = structuredClone(replayPackage);
tamperedHash.semanticHash = `sha256:${'0'.repeat(64)}`;
assert.throws(
  () => validateLafea4ShellProductRefinementReplayPackage(tamperedHash),
  /LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PACKAGE_TAMPERED/u,
);

console.log(JSON.stringify({
  check: 'lafea-tech13i-promoted-refinement-roundtrip',
  status: 'PASS',
  productionTrustRoot: 'NULL',
  packageStructuralValidation: 'PASS',
  currentPromotionRequired: true,
  syntheticPackageMayActivateProductionReplay: false,
  genericV2RecoveryAuthorized: false,
  dedicatedReplayRequired: true,
  retainedParentUnchangedAfterRejectedReplay: true,
  packageSemanticHash: replayPackage.semanticHash,
  promotedArtifactHash: replayPackage.retentionAuthority.evidence.artifactHash,
  promotedMeshHash: replayPackage.retentionAuthority.evidence.meshHash,
  activeRoundTripCheck: 'scripts/lafea-tech13g-active-promotion-path-check.mjs',
  releaseQualified: false,
}, null, 2));

workbench.destroy();
