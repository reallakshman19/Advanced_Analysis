import { canonicalLafeaSha256 } from './lafea-canonical-sha256.js';
import {
  LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_QUALIFICATION,
} from './lafea4-shell-product-refinement-adapter.js';
import {
  evaluateLafea4Tech13ImplementationCurrentness,
} from './lafea4-shell-product-refinement-implementation-currentness.js';

export const LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_SCHEMA =
  'lafea4-shell-product-refinement-promotion-record/v2';
export const LAFEA4_SHELL_PRODUCT_REFINEMENT_EXACT_HEAD_QUALIFICATION_ID =
  'LAFEA4-TECH13-PRODUCT-REFINEMENT-EXACT-HEAD-001';
export const LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_PENDING_CODE =
  'LAFEA4_SHELL_PRODUCT_REFINEMENT_PENDING_TECH13E_QUALIFICATION';
export const LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_BLOCK_CODE =
  'LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_NOT_AUTHORIZED';

/**
 * Code-owned production trust root. No caller-supplied authority is accepted.
 * TECH-13J hashes this module but deliberately normalizes only the bytes between
 * the two value markers, allowing a later trust-root-only activation commit to
 * retain the qualified implementation identity. The declaration, validator and
 * promotion logic around the slot remain fingerprint-critical.
 */
export const LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_RECORD =
  /* LAFEA4_TECH13_TRUST_ROOT_VALUE_BEGIN */
  null
  /* LAFEA4_TECH13_TRUST_ROOT_VALUE_END */;

const INPUT_KEYS = Object.freeze([
  'schema', 'stageId', 'exactHeadQualificationId', 'qualifiedHead',
  'bundleEvidenceSha256', 'bundlePlanSha256', 'bundleRunnerSha256',
  'implementationFingerprint',
  'capabilityHash', 'qualificationHash', 'qualificationClassification',
  'qualificationComplete', 'futurePromotionReviewEligible',
  'productRetentionAuthorized', 'uiBindingAuthorized', 'releaseQualified',
]);

export function createLafea4ShellProductRefinementPromotionRecord(value) {
  exactKeys(value, INPUT_KEYS, 'LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_KEYS_INVALID');
  if (value.schema !== LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_SCHEMA
    || value.stageId !== 'LAFEA.4'
    || value.exactHeadQualificationId !== LAFEA4_SHELL_PRODUCT_REFINEMENT_EXACT_HEAD_QUALIFICATION_ID
    || value.capabilityHash !== LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY.capabilityHash
    || value.qualificationHash !== LAFEA4_SHELL_PRODUCT_REFINEMENT_QUALIFICATION.qualificationHash
    || value.qualificationClassification !== 'PASS'
    || value.qualificationComplete !== true
    || value.futurePromotionReviewEligible !== true
    || value.productRetentionAuthorized !== true
    || value.uiBindingAuthorized !== true
    || value.releaseQualified !== false) {
    fail('LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_CONTRACT_INVALID');
  }
  requireGitSha(value.qualifiedHead, 'QUALIFIED_HEAD');
  requireDigest(value.bundleEvidenceSha256, 'BUNDLE_EVIDENCE_SHA256');
  requireDigest(value.bundlePlanSha256, 'BUNDLE_PLAN_SHA256');
  requireDigest(value.bundleRunnerSha256, 'BUNDLE_RUNNER_SHA256');
  requireFingerprint(value.implementationFingerprint);
  const core = freeze({ ...value });
  return freeze({
    ...core,
    semanticHash: canonicalLafeaSha256({
      schema: 'lafea4-shell-product-refinement-promotion-record-hash-input/v2',
      record: core,
    }),
  });
}

export function validateLafea4ShellProductRefinementPromotionRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_RECORD_REQUIRED');
  }
  const { semanticHash, ...input } = value;
  const rebuilt = createLafea4ShellProductRefinementPromotionRecord(input);
  if (rebuilt.semanticHash !== semanticHash) {
    fail('LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_RECORD_TAMPERED');
  }
  return rebuilt;
}

/**
 * Resolve production authority from the source-controlled trust root only.
 * Extra JavaScript arguments are intentionally ignored; there is no injection
 * seam. A non-null root is necessary but not sufficient: TECH-13J also requires
 * its qualified promotion-critical implementation fingerprint to equal the
 * fingerprint embedded by the current production build.
 */
export function evaluateLafea4ShellProductRefinementPromotion() {
  const record = LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_RECORD;
  if (record === null) {
    return freeze({
      schema: 'lafea4-shell-product-refinement-promotion-state/v2',
      stageId: 'LAFEA.4',
      active: false,
      promotionRecord: null,
      qualifiedHead: null,
      bundleEvidenceSha256: null,
      implementationCurrentness: null,
      productRetentionAuthorized: false,
      uiBindingAuthorized: false,
      releaseQualified: false,
      diagnosticCode: LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_PENDING_CODE,
    });
  }
  const promotionRecord = validateLafea4ShellProductRefinementPromotionRecord(record);
  const implementationCurrentness = evaluateLafea4Tech13ImplementationCurrentness(promotionRecord);
  if (!implementationCurrentness.current) {
    return freeze({
      schema: 'lafea4-shell-product-refinement-promotion-state/v2',
      stageId: 'LAFEA.4',
      active: false,
      promotionRecord,
      qualifiedHead: promotionRecord.qualifiedHead,
      bundleEvidenceSha256: promotionRecord.bundleEvidenceSha256,
      implementationCurrentness,
      productRetentionAuthorized: false,
      uiBindingAuthorized: false,
      releaseQualified: false,
      diagnosticCode: implementationCurrentness.diagnosticCode,
    });
  }
  return freeze({
    schema: 'lafea4-shell-product-refinement-promotion-state/v2',
    stageId: 'LAFEA.4',
    active: true,
    promotionRecord,
    qualifiedHead: promotionRecord.qualifiedHead,
    bundleEvidenceSha256: promotionRecord.bundleEvidenceSha256,
    implementationCurrentness,
    productRetentionAuthorized: true,
    uiBindingAuthorized: true,
    releaseQualified: false,
    diagnosticCode: null,
  });
}

export function requireLafea4ShellProductRefinementPromotionAuthorized() {
  const state = evaluateLafea4ShellProductRefinementPromotion();
  if (!state.active
    || state.productRetentionAuthorized !== true
    || state.uiBindingAuthorized !== true) {
    const error = new TypeError(LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_BLOCK_CODE);
    error.code = LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_BLOCK_CODE;
    error.diagnosticCode = state.diagnosticCode;
    throw error;
  }
  return state;
}

function exactKeys(value, expected, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    fail(code);
  }
}
function requireGitSha(value, field) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/u.test(value)) {
    fail(`LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_${field}_INVALID`);
  }
}
function requireDigest(value, field) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) {
    fail(`LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_${field}_INVALID`);
  }
}
function requireFingerprint(value) {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    fail('LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_IMPLEMENTATION_FINGERPRINT_INVALID');
  }
}
function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
