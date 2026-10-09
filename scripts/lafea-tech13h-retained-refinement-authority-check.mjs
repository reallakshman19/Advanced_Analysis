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
  LAFEA4_SHELL_PRODUCT_REFINEMENT_GENERIC_RECOVERY_FORBIDDEN,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_PRODUCER_REF,
  finalizeLafea4ShellProductRefinementRetention,
  requireLafea4ShellProductRefinementGenericRecoveryAllowed,
} from '../src/workspace/lafea4-shell-product-refinement-retention-authority.js';
import {
  qualifyLafea4ShellParentNormalOrientation,
  validateLafea4ShellParentNormalQualification,
} from '../src/workspace/lafea4-shell-parent-normal-qualification.js';

const stageId = 'LAFEA.4';
const document = normalizeLafeaStageDocument(stageId, createLafeaMockDocument(stageId));
const sourceAuthority = issueLafeaSourceAuthority(stageId, document, 'TECH13H-RETAINED-AUTHORITY');
const midsurface = createLafeaSimulatedShellMidsurfaceEvidence(
  stageId, sourceAuthority.sourceHash, document,
);
const profile = canonicalProfile(PROFILE_KINDS.MESH, {
  schema: 'lafea-mesh-profile/v1',
  profileIdentity: 'TECH13H_SAMPLE_CURVED_TRI3',
  sourceRevision: 'TECH13H-V1',
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
const parentArtifactHash = parent.artifactHash;
const parentMeshHash = parent.meshHash;
const target = parent.mesh.elements[Math.floor(parent.mesh.elements.length / 2)];
const request = {
  commandId: 'TECH13H-SAMPLE-REFINE',
  targetType: 'ELEMENT',
  targetIds: [target.elementId],
  targetElementLength: 7.5,
  lengthUnit: midsurface.geometry.lengthUnit,
  reason: 'TECH13H retained refinement authority fixture',
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

assert.throws(
  () => requireLafea4ShellProductRefinementGenericRecoveryAllowed(adapter.productEvidence),
  new RegExp(LAFEA4_SHELL_PRODUCT_REFINEMENT_GENERIC_RECOVERY_FORBIDDEN, 'u'),
);
const recovery = workbench.recoverAnalysisMeshEvidenceV2(adapter.productEvidence, stageId);
assert.equal(recovery, null);
assert.equal(workbench.getState().diagnostics?.[0]?.code,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_GENERIC_RECOVERY_FORBIDDEN);
assert.equal(workbench.selectRetainedAnalysisMeshEvidenceV2(stageId)?.artifactHash,
  parentArtifactHash);
assert.equal(workbench.selectRetainedAnalysisMeshEvidenceV2(stageId)?.meshHash,
  parentMeshHash);

assert.equal(LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_RECORD, null);
const promotionRecord = createLafea4ShellProductRefinementPromotionRecord({
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
const retained = finalizeLafea4ShellProductRefinementRetention({
  adapterResult: adapter,
  acceptance,
  promotion: {
    active: true,
    promotionRecord,
    productRetentionAuthorized: true,
    uiBindingAuthorized: true,
    releaseQualified: false,
  },
});

assert.equal(retained.productRetentionAuthorized, true);
assert.equal(retained.uiBindingAuthorized, true);
assert.equal(retained.releaseQualified, false);
assert.equal(retained.evidence.meshHash, adapter.productEvidence.meshHash);
assert.equal(JSON.stringify(retained.evidence.mesh), JSON.stringify(adapter.productEvidence.mesh));
assert.notEqual(retained.evidence.artifactHash, adapter.productEvidence.artifactHash);
assert.equal(retained.evidence.authority.producerRef,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_PRODUCER_REF);
assert.equal(retained.evidence.authority.capabilityHash,
  retained.retainedCapability.capabilityHash);
assert.equal(retained.evidence.authority.qualificationHash,
  retained.retainedQualification.qualificationHash);
assert.equal(retained.evidence.authority.planHash,
  retained.retentionPlan.planHash);
assert.notEqual(retained.evidence.authority.capabilityHash,
  adapter.productEvidence.authority.capabilityHash);
assert.notEqual(retained.evidence.authority.qualificationHash,
  adapter.productEvidence.authority.qualificationHash);
assert.notEqual(retained.evidence.authority.planHash,
  adapter.productEvidence.authority.planHash);
assert.equal(retained.retainedCapability.candidateCapabilityHash,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY.capabilityHash);
assert.equal(retained.retainedCapability.productBindingAuthorized, true);
assert.equal(retained.retainedCapability.uiBindingAuthorized, true);
assert.equal(retained.retainedCapability.releaseQualified, false);
assert.equal(retained.retainedQualification.retainedCapabilityHash,
  retained.retainedCapability.capabilityHash);
assert.equal(retained.retainedQualification.productBindingAuthorized, true);
assert.equal(retained.retainedQualification.uiBindingAuthorized, true);
assert.equal(retained.retainedQualification.releaseQualified, false);
assert.equal(retained.retentionPlan.retainedCapabilityHash,
  retained.retainedCapability.capabilityHash);
assert.equal(retained.retentionPlan.productBindingAuthorized, true);
assert.equal(retained.retentionPlan.uiBindingAuthorized, true);
assert.equal(retained.retentionPlan.releaseQualified, false);

const parentNormal = validateLafea4ShellParentNormalQualification(
  qualifyLafea4ShellParentNormalOrientation({
    meshEvidence: retained.evidence,
    midsurfaceEvidence: midsurface,
  }),
);
assert.equal(parentNormal.qualification, 'PASS');
assert.equal(parentNormal.blockedElementCount, 0);
assert.ok(parentNormal.minimumParentDirectedJacobian > parentNormal.witness.roundoffEnvelope);

assert.throws(
  () => requireLafea4ShellProductRefinementGenericRecoveryAllowed(retained.evidence),
  new RegExp(LAFEA4_SHELL_PRODUCT_REFINEMENT_GENERIC_RECOVERY_FORBIDDEN, 'u'),
);

console.log(JSON.stringify({
  check: 'lafea-tech13h-retained-refinement-authority',
  status: 'PASS',
  productionTrustRoot: 'NULL',
  genericCandidateRecoveryBlocked: true,
  retainedParentUnchangedAfterRecoveryAttempt: true,
  candidate: {
    artifactHash: adapter.productEvidence.artifactHash,
    meshHash: adapter.productEvidence.meshHash,
    producerRef: adapter.productEvidence.authority.producerRef,
    capabilityHash: adapter.productEvidence.authority.capabilityHash,
    qualificationHash: adapter.productEvidence.authority.qualificationHash,
    planHash: adapter.productEvidence.authority.planHash,
  },
  promotedRetention: {
    artifactHash: retained.evidence.artifactHash,
    meshHash: retained.evidence.meshHash,
    producerRef: retained.evidence.authority.producerRef,
    capabilityHash: retained.evidence.authority.capabilityHash,
    qualificationHash: retained.evidence.authority.qualificationHash,
    planHash: retained.evidence.authority.planHash,
    sameMeshBytesAsCandidate: true,
    distinctAuthorityArtifact: true,
    distinctCapabilityQualificationPlan: true,
    parentNormalQualification: parentNormal.qualification,
  },
  genericPromotedReplayBlockedPendingDedicatedReplayContract: true,
  releaseQualified: false,
}, null, 2));

workbench.destroy();
