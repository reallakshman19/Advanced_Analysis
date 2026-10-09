import {
  LAFEA_ANALYSIS_MESH_AUTHORITY_V2_ROLE,
  LAFEA_ANALYSIS_MESH_AUTHORITY_V2_SCHEMA,
  LAFEA_ANALYSIS_MESH_INTAKE_V2_SCHEMA,
  createLafeaAnalysisMeshEvidenceV2,
  validateLafeaAnalysisMeshEvidenceV2,
} from './lafea-analysis-mesh-evidence-v2.js';
import { canonicalLafeaSha256 } from './lafea-canonical-sha256.js';
import {
  LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_PRODUCER_ID,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_PRODUCER_REF,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_QUALIFICATION,
  validateLafea4ShellProductRefinementAdapterResult,
} from './lafea4-shell-product-refinement-adapter.js';
import {
  validateLafea4ShellProductRefinementAcceptance,
} from './lafea4-shell-product-refinement-acceptance.js';
import {
  validateLafea4ShellProductRefinementPromotionRecord,
} from './lafea4-shell-product-refinement-promotion.js';

export const LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_PRODUCER_REF =
  `${LAFEA4_SHELL_PRODUCT_REFINEMENT_PRODUCER_ID}/PROMOTED_RETAINED_PRODUCT_V1`;
export const LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_CAPABILITY_SCHEMA =
  'lafea4-shell-product-refinement-retained-capability/v1';
export const LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_QUALIFICATION_SCHEMA =
  'lafea4-shell-product-refinement-retained-qualification/v1';
export const LAFEA4_SHELL_PRODUCT_REFINEMENT_RETENTION_PLAN_SCHEMA =
  'lafea4-shell-product-refinement-retention-plan/v1';
export const LAFEA4_SHELL_PRODUCT_REFINEMENT_GENERIC_RECOVERY_FORBIDDEN =
  'LAFEA4_SHELL_PRODUCT_REFINEMENT_GENERIC_RECOVERY_FORBIDDEN';

/**
 * Re-issue an accepted TECH-13 product candidate under retained-product
 * authority after the code-owned promotion gate has already authorized use.
 * Mesh bytes are immutable; only authority/capability/qualification/plan custody changes.
 */
export function finalizeLafea4ShellProductRefinementRetention({
  adapterResult,
  acceptance,
  promotion,
}) {
  const adapter = validateLafea4ShellProductRefinementAdapterResult(adapterResult);
  const accepted = validateLafea4ShellProductRefinementAcceptance(acceptance);
  if (accepted.qualification !== 'PASS' || accepted.candidateRetentionEligible !== true) {
    fail('LAFEA4_SHELL_PRODUCT_REFINEMENT_RETENTION_ACCEPTANCE_PASS_REQUIRED');
  }
  if (accepted.childMeshArtifactHash !== adapter.productEvidence.artifactHash
    || accepted.childMeshHash !== adapter.productEvidence.meshHash
    || accepted.productPlanHash !== adapter.plan.planHash) {
    fail('LAFEA4_SHELL_PRODUCT_REFINEMENT_RETENTION_CANDIDATE_MISMATCH');
  }
  if (!promotion || promotion.active !== true
    || promotion.productRetentionAuthorized !== true
    || promotion.uiBindingAuthorized !== true
    || promotion.releaseQualified !== false
    || !promotion.promotionRecord) {
    fail('LAFEA4_SHELL_PRODUCT_REFINEMENT_RETENTION_PROMOTION_REQUIRED');
  }
  const promotionRecord = validateLafea4ShellProductRefinementPromotionRecord(
    promotion.promotionRecord,
  );

  const capabilityCore = freeze({
    schema: LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_CAPABILITY_SCHEMA,
    stageId: 'LAFEA.4',
    producerRef: LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_PRODUCER_REF,
    candidateCapabilityHash: LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY.capabilityHash,
    candidateQualificationHash: LAFEA4_SHELL_PRODUCT_REFINEMENT_QUALIFICATION.qualificationHash,
    promotionRecordHash: promotionRecord.semanticHash,
    qualifiedHead: promotionRecord.qualifiedHead,
    numericalKernel: LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY.numericalKernel,
    elementFamily: LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY.elementFamily,
    surfaceKinds: [...LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY.surfaceKinds],
    targetTypes: [...LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY.targetTypes],
    productBindingAuthorized: true,
    uiBindingAuthorized: true,
    releaseQualified: false,
  });
  const retainedCapability = freeze({
    ...capabilityCore,
    capabilityHash: canonicalLafeaSha256({
      schema: 'lafea4-shell-product-refinement-retained-capability-hash-input/v1',
      capability: capabilityCore,
    }),
  });

  const qualificationCore = freeze({
    schema: LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_QUALIFICATION_SCHEMA,
    stageId: 'LAFEA.4',
    qualificationId: 'LAFEA4-SHELL-PRODUCT-REFINE-RETAINED-Q1',
    retainedCapabilityHash: retainedCapability.capabilityHash,
    candidateCapabilityHash: LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY.capabilityHash,
    candidateQualificationHash: LAFEA4_SHELL_PRODUCT_REFINEMENT_QUALIFICATION.qualificationHash,
    candidateArtifactHash: adapter.productEvidence.artifactHash,
    candidateMeshHash: adapter.productEvidence.meshHash,
    candidateAcceptanceHash: accepted.semanticHash,
    promotionRecordHash: promotionRecord.semanticHash,
    qualifiedHead: promotionRecord.qualifiedHead,
    status: 'QUALIFIED_BY_VERIFIED_EXACT_HEAD_PROMOTION',
    productBindingAuthorized: true,
    uiBindingAuthorized: true,
    releaseQualified: false,
  });
  const retainedQualification = freeze({
    ...qualificationCore,
    qualificationHash: canonicalLafeaSha256({
      schema: 'lafea4-shell-product-refinement-retained-qualification-hash-input/v1',
      qualification: qualificationCore,
    }),
  });

  const retentionPlanCore = freeze({
    schema: LAFEA4_SHELL_PRODUCT_REFINEMENT_RETENTION_PLAN_SCHEMA,
    stageId: 'LAFEA.4',
    producerRef: LAFEA4_SHELL_PRODUCT_REFINEMENT_RETAINED_PRODUCER_REF,
    retainedCapabilityHash: retainedCapability.capabilityHash,
    retainedQualificationHash: retainedQualification.qualificationHash,
    candidatePlanHash: adapter.plan.planHash,
    candidateArtifactHash: adapter.productEvidence.artifactHash,
    meshHash: adapter.productEvidence.meshHash,
    acceptanceHash: accepted.semanticHash,
    promotionRecordHash: promotionRecord.semanticHash,
    qualifiedHead: promotionRecord.qualifiedHead,
    productBindingAuthorized: true,
    uiBindingAuthorized: true,
    releaseQualified: false,
  });
  const retentionPlan = freeze({
    ...retentionPlanCore,
    planHash: canonicalLafeaSha256({
      schema: 'lafea4-shell-product-refinement-retention-plan-hash-input/v1',
      plan: retentionPlanCore,
    }),
  });

  const candidate = validateLafeaAnalysisMeshEvidenceV2(adapter.productEvidence);
  const evidence = createLafeaAnalysisMeshEvidenceV2({
    schema: LAFEA_ANALYSIS_MESH_INTAKE_V2_SCHEMA,
    stageId: 'LAFEA.4',
    sourceHash: candidate.sourceHash,
    analysisDomainHash: candidate.analysisDomainHash,
    analysisGeometryHash: candidate.analysisGeometryHash,
    meshProfile: candidate.meshProfile,
    mesh: candidate.mesh,
    authority: {
      schema: LAFEA_ANALYSIS_MESH_AUTHORITY_V2_SCHEMA,
      stageId: 'LAFEA.4',
      authorityRole: LAFEA_ANALYSIS_MESH_AUTHORITY_V2_ROLE,
      status: 'ACCEPTED_BY_STAGE_CONTRACT',
      producerRef: retentionPlan.producerRef,
      sourceHash: candidate.sourceHash,
      analysisDomainHash: candidate.analysisDomainHash,
      analysisGeometryHash: candidate.analysisGeometryHash,
      meshProfileHash: candidate.meshProfileHash,
      meshHash: candidate.meshHash,
      capabilityHash: retainedCapability.capabilityHash,
      qualificationHash: retainedQualification.qualificationHash,
      planHash: retentionPlan.planHash,
    },
  });

  if (evidence.meshHash !== candidate.meshHash
    || JSON.stringify(evidence.mesh) !== JSON.stringify(candidate.mesh)
    || evidence.artifactHash === candidate.artifactHash
    || evidence.authority.capabilityHash === candidate.authority.capabilityHash
    || evidence.authority.qualificationHash === candidate.authority.qualificationHash
    || evidence.authority.planHash === candidate.authority.planHash
    || evidence.authority.producerRef === candidate.authority.producerRef) {
    fail('LAFEA4_SHELL_PRODUCT_REFINEMENT_RETENTION_REWRAP_INVALID');
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

/**
 * TECH-13 product-refinement evidence has dedicated custody semantics and may
 * not be laundered through the generic portable V2 recovery route. This keeps
 * candidate-only artifacts non-retainable and also prevents a promoted artifact
 * from being replayed without a separately qualified retained-product replay path.
 */
export function requireLafea4ShellProductRefinementGenericRecoveryAllowed(value) {
  const evidence = validateLafeaAnalysisMeshEvidenceV2(value);
  if (evidence.stageId !== 'LAFEA.4') return evidence;
  const producerRef = evidence.authority?.producerRef ?? '';
  const productProducerFamily = `${LAFEA4_SHELL_PRODUCT_REFINEMENT_PRODUCER_ID}/`;
  if (producerRef.startsWith(productProducerFamily)
    || producerRef === LAFEA4_SHELL_PRODUCT_REFINEMENT_PRODUCER_REF
    || evidence.authority?.qualificationHash
      === LAFEA4_SHELL_PRODUCT_REFINEMENT_QUALIFICATION.qualificationHash) {
    fail(LAFEA4_SHELL_PRODUCT_REFINEMENT_GENERIC_RECOVERY_FORBIDDEN);
  }
  return evidence;
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
