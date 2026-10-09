import { validateLafeaAnalysisMeshEvidenceV2 } from './lafea-analysis-mesh-evidence-v2.js';
import { canonicalLafeaSha256 } from './lafea-canonical-sha256.js';
import {
  LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_QUALIFICATION,
} from './lafea4-shell-product-refinement-adapter.js';
import {
  validateLafea4ShellProductRefinementAcceptance,
} from './lafea4-shell-product-refinement-acceptance.js';
import {
  requireLafea4ShellProductRefinementPromotionAuthorized,
  validateLafea4ShellProductRefinementPromotionRecord,
} from './lafea4-shell-product-refinement-promotion.js';
import {
  LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_CAPABILITY_SCHEMA,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_PRODUCER_REF,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_QUALIFICATION_SCHEMA,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_RETENTION_PLAN_SCHEMA,
} from './lafea4-shell-product-refinement-retention-authority.js';

export const LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PACKAGE_SCHEMA =
  'lafea4-shell-product-refinement-replay-package/v1';
export const LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_CURRENT_PROMOTION_REQUIRED =
  'LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_CURRENT_PROMOTION_REQUIRED';
export const LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PACKAGE_INVALID =
  'LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PACKAGE_INVALID';

const PACKAGE_KEYS = Object.freeze([
  'schema', 'stageId', 'retentionAuthority', 'acceptance', 'promotionRecord',
  'productRetentionAuthorized', 'uiBindingAuthorized', 'releaseQualified',
  'genericV2RecoveryAuthorized', 'dedicatedReplayRequired', 'semanticHash',
]);

/**
 * Create the portable custody sidecar for a promoted retained refinement.
 * The package carries the full retained authority lineage that V2 evidence
 * intentionally does not embed directly.
 */
export function createLafea4ShellProductRefinementReplayPackage({
  retentionAuthority,
  acceptance,
  promotion,
}) {
  const accepted = validateLafea4ShellProductRefinementAcceptance(acceptance);
  if (accepted.qualification !== 'PASS' || accepted.candidateRetentionEligible !== true) {
    fail('LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_ACCEPTANCE_PASS_REQUIRED');
  }
  if (!promotion || promotion.active !== true
    || promotion.productRetentionAuthorized !== true
    || promotion.uiBindingAuthorized !== true
    || promotion.releaseQualified !== false
    || !promotion.promotionRecord) {
    fail('LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PROMOTION_REQUIRED');
  }
  const promotionRecord = validateLafea4ShellProductRefinementPromotionRecord(
    promotion.promotionRecord,
  );
  const retained = validateRetentionAuthority(retentionAuthority, {
    acceptance: accepted,
    promotionRecord,
  });
  const core = freeze({
    schema: LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PACKAGE_SCHEMA,
    stageId: 'LAFEA.4',
    retentionAuthority: retained,
    acceptance: accepted,
    promotionRecord,
    productRetentionAuthorized: true,
    uiBindingAuthorized: true,
    releaseQualified: false,
    genericV2RecoveryAuthorized: false,
    dedicatedReplayRequired: true,
  });
  return freeze({
    ...core,
    semanticHash: canonicalLafeaSha256({
      schema: 'lafea4-shell-product-refinement-replay-package-hash-input/v1',
      package: core,
    }),
  });
}

export function validateLafea4ShellProductRefinementReplayPackage(value) {
  exactKeys(value, PACKAGE_KEYS, LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PACKAGE_INVALID);
  if (value.schema !== LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PACKAGE_SCHEMA
    || value.stageId !== 'LAFEA.4'
    || value.productRetentionAuthorized !== true
    || value.uiBindingAuthorized !== true
    || value.releaseQualified !== false
    || value.genericV2RecoveryAuthorized !== false
    || value.dedicatedReplayRequired !== true) {
    fail(LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PACKAGE_INVALID);
  }
  const acceptance = validateLafea4ShellProductRefinementAcceptance(value.acceptance);
  if (acceptance.qualification !== 'PASS' || acceptance.candidateRetentionEligible !== true) {
    fail(LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PACKAGE_INVALID);
  }
  const promotionRecord = validateLafea4ShellProductRefinementPromotionRecord(
    value.promotionRecord,
  );
  const retentionAuthority = validateRetentionAuthority(value.retentionAuthority, {
    acceptance,
    promotionRecord,
  });
  const core = freeze({
    schema: value.schema,
    stageId: value.stageId,
    retentionAuthority,
    acceptance,
    promotionRecord,
    productRetentionAuthorized: true,
    uiBindingAuthorized: true,
    releaseQualified: false,
    genericV2RecoveryAuthorized: false,
    dedicatedReplayRequired: true,
  });
  const semanticHash = canonicalLafeaSha256({
    schema: 'lafea4-shell-product-refinement-replay-package-hash-input/v1',
    package: core,
  });
  if (semanticHash !== value.semanticHash) {
    fail('LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PACKAGE_TAMPERED');
  }
  return freeze({ ...core, semanticHash });
}

/**
 * Production replay authority is resolved only from the source-controlled
 * promotion trust root. Package contents cannot activate replay by themselves.
 */
export function requireCurrentLafea4ShellProductRefinementReplayPackage(value) {
  const replayPackage = validateLafea4ShellProductRefinementReplayPackage(value);
  let promotion;
  try {
    promotion = requireLafea4ShellProductRefinementPromotionAuthorized();
  } catch (error) {
    const blocked = new TypeError(LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_CURRENT_PROMOTION_REQUIRED);
    blocked.code = LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_CURRENT_PROMOTION_REQUIRED;
    blocked.cause = error;
    throw blocked;
  }
  if (promotion.promotionRecord?.semanticHash !== replayPackage.promotionRecord.semanticHash
    || promotion.qualifiedHead !== replayPackage.promotionRecord.qualifiedHead
    || promotion.productRetentionAuthorized !== true
    || promotion.uiBindingAuthorized !== true
    || promotion.releaseQualified !== false) {
    fail(LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_CURRENT_PROMOTION_REQUIRED);
  }
  return freeze({ replayPackage, promotion });
}

function validateRetentionAuthority(value, { acceptance, promotionRecord }) {
  if (!value || value.schema !== 'lafea4-shell-product-refinement-retention-authority/v1'
    || value.stageId !== 'LAFEA.4'
    || value.productRetentionAuthorized !== true
    || value.uiBindingAuthorized !== true
    || value.releaseQualified !== false
    || value.promotionRecordHash !== promotionRecord.semanticHash) {
    fail(LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PACKAGE_INVALID);
  }
  const candidate = validateLafeaAnalysisMeshEvidenceV2(value.candidateEvidence);
  const evidence = validateLafeaAnalysisMeshEvidenceV2(value.evidence);
  if (acceptance.childMeshArtifactHash !== candidate.artifactHash
    || acceptance.childMeshHash !== candidate.meshHash
    || candidate.authority.capabilityHash !== LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY.capabilityHash
    || candidate.authority.qualificationHash !== LAFEA4_SHELL_PRODUCT_REFINEMENT_QUALIFICATION.qualificationHash
    || evidence.meshHash !== candidate.meshHash
    || JSON.stringify(evidence.mesh) !== JSON.stringify(candidate.mesh)
    || evidence.artifactHash === candidate.artifactHash) {
    fail(LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PACKAGE_INVALID);
  }

  const retainedCapability = validateRetainedCapability(value.retainedCapability, promotionRecord);
  const retainedQualification = validateRetainedQualification(
    value.retainedQualification,
    { retainedCapability, candidate, acceptance, promotionRecord },
  );
  const retentionPlan = validateRetentionPlan(
    value.retentionPlan,
    { retainedCapability, retainedQualification, candidate, acceptance, promotionRecord },
  );
  if (evidence.authority.producerRef !== LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_PRODUCER_REF
    || evidence.authority.capabilityHash !== retainedCapability.capabilityHash
    || evidence.authority.qualificationHash !== retainedQualification.qualificationHash
    || evidence.authority.planHash !== retentionPlan.planHash) {
    fail(LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PACKAGE_INVALID);
  }
  return freeze({
    schema: 'lafea4-shell-product-refinement-retention-authority/v1',
    stageId: 'LAFEA.4',
    candidateEvidence: candidate,
    evidence,
    retainedCapability,
    retainedQualification,
    retentionPlan,
    promotionRecordHash: promotionRecord.semanticHash,
    productRetentionAuthorized: true,
    uiBindingAuthorized: true,
    releaseQualified: false,
  });
}

function validateRetainedCapability(value, promotionRecord) {
  if (!value || value.schema !== LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_CAPABILITY_SCHEMA
    || value.stageId !== 'LAFEA.4'
    || value.producerRef !== LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_PRODUCER_REF
    || value.candidateCapabilityHash !== LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY.capabilityHash
    || value.candidateQualificationHash !== LAFEA4_SHELL_PRODUCT_REFINEMENT_QUALIFICATION.qualificationHash
    || value.promotionRecordHash !== promotionRecord.semanticHash
    || value.qualifiedHead !== promotionRecord.qualifiedHead
    || value.numericalKernel !== LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY.numericalKernel
    || value.elementFamily !== LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY.elementFamily
    || JSON.stringify(value.surfaceKinds) !== JSON.stringify([...LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY.surfaceKinds])
    || JSON.stringify(value.targetTypes) !== JSON.stringify([...LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY.targetTypes])
    || value.productBindingAuthorized !== true
    || value.uiBindingAuthorized !== true
    || value.releaseQualified !== false) {
    fail(LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PACKAGE_INVALID);
  }
  const { capabilityHash, ...core } = value;
  const expected = canonicalLafeaSha256({
    schema: 'lafea4-shell-product-refinement-retained-capability-hash-input/v1',
    capability: core,
  });
  if (expected !== capabilityHash) fail('LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_CAPABILITY_TAMPERED');
  return freeze({ ...core, capabilityHash });
}

function validateRetainedQualification(value, {
  retainedCapability, candidate, acceptance, promotionRecord,
}) {
  if (!value || value.schema !== LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_QUALIFICATION_SCHEMA
    || value.stageId !== 'LAFEA.4'
    || value.qualificationId !== 'LAFEA4-SHELL-PRODUCT-REFINE-RETAINED-Q1'
    || value.retainedCapabilityHash !== retainedCapability.capabilityHash
    || value.candidateCapabilityHash !== LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY.capabilityHash
    || value.candidateQualificationHash !== LAFEA4_SHELL_PRODUCT_REFINEMENT_QUALIFICATION.qualificationHash
    || value.candidateArtifactHash !== candidate.artifactHash
    || value.candidateMeshHash !== candidate.meshHash
    || value.candidateAcceptanceHash !== acceptance.semanticHash
    || value.promotionRecordHash !== promotionRecord.semanticHash
    || value.qualifiedHead !== promotionRecord.qualifiedHead
    || value.status !== 'QUALIFIED_BY_VERIFIED_EXACT_HEAD_PROMOTION'
    || value.productBindingAuthorized !== true
    || value.uiBindingAuthorized !== true
    || value.releaseQualified !== false) {
    fail(LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PACKAGE_INVALID);
  }
  const { qualificationHash, ...core } = value;
  const expected = canonicalLafeaSha256({
    schema: 'lafea4-shell-product-refinement-retained-qualification-hash-input/v1',
    qualification: core,
  });
  if (expected !== qualificationHash) {
    fail('LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_QUALIFICATION_TAMPERED');
  }
  return freeze({ ...core, qualificationHash });
}

function validateRetentionPlan(value, {
  retainedCapability, retainedQualification, candidate, acceptance, promotionRecord,
}) {
  if (!value || value.schema !== LAFEA4_SHELL_PRODUCT_REFINEMENT_RETENTION_PLAN_SCHEMA
    || value.stageId !== 'LAFEA.4'
    || value.producerRef !== LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_PRODUCER_REF
    || value.retainedCapabilityHash !== retainedCapability.capabilityHash
    || value.retainedQualificationHash !== retainedQualification.qualificationHash
    || value.candidatePlanHash !== acceptance.productPlanHash
    || value.candidateArtifactHash !== candidate.artifactHash
    || value.meshHash !== candidate.meshHash
    || value.acceptanceHash !== acceptance.semanticHash
    || value.promotionRecordHash !== promotionRecord.semanticHash
    || value.qualifiedHead !== promotionRecord.qualifiedHead
    || value.productBindingAuthorized !== true
    || value.uiBindingAuthorized !== true
    || value.releaseQualified !== false) {
    fail(LAFEA4_SHELL_PRODUCT_REFINEMENT_REPLAY_PACKAGE_INVALID);
  }
  const { planHash, ...core } = value;
  const expected = canonicalLafeaSha256({
    schema: 'lafea4-shell-product-refinement-retention-plan-hash-input/v1',
    plan: core,
  });
  if (expected !== planHash) fail('LAFEA4_SHELL_PRODUCT_REFINEMENT_RETENTION_PLAN_TAMPERED');
  return freeze({ ...core, planHash });
}

function exactKeys(value, expected, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    fail(code);
  }
}
function fail(code) {
  const error = new TypeError(code);
  error.code = code;
  throw error;
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
