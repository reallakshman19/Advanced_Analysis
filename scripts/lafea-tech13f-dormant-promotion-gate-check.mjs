#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_QUALIFICATION,
} from '../src/workspace/lafea4-shell-product-refinement-adapter.js';
import {
  LAFEA4_SHELL_PRODUCT_REFINEMENT_EXACT_HEAD_QUALIFICATION_ID,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_BLOCK_CODE,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_PENDING_CODE,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_RECORD,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_SCHEMA,
  createLafea4ShellProductRefinementPromotionRecord,
  evaluateLafea4ShellProductRefinementPromotion,
  requireLafea4ShellProductRefinementPromotionAuthorized,
  validateLafea4ShellProductRefinementPromotionRecord,
} from '../src/workspace/lafea4-shell-product-refinement-promotion.js';

const policy = JSON.parse(fs.readFileSync(
  new URL('../validation/lafea4-refinement/product-refinement-promotion-v1.json', import.meta.url),
  'utf8',
));
assert.equal(policy.currentTrustRoot, 'NULL');
assert.equal(policy.activationRequiresVerifiedExactHeadBundle, true);
assert.equal(policy.activationRecordBindsImplementationFingerprint, true);
assert.equal(policy.runtimeImplementationFingerprintRequired, true);
assert.equal(policy.runtimeImplementationFingerprintMustMatchQualified, true);
assert.equal(policy.implementationFingerprintTrustRootValueExcluded, true);
assert.equal(policy.implementationFingerprintPromotionValidatorExcluded, false);
assert.equal(policy.runtimeCandidateGateStillRequiredAfterPromotion, true);
assert.equal(policy.runtimeParentNormalGateStillRequiredAfterPromotion, true);
assert.equal(policy.runtimeMeshQualityThresholdsMayChangeOnPromotion, false);
assert.equal(policy.productionAuthorityArgumentAccepted, false);
assert.equal(policy.callerSuppliedPromotionRecordMayActivate, false);

// Production truth is fail-closed and the resolver has no authority parameter.
assert.equal(LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_RECORD, null);
assert.equal(evaluateLafea4ShellProductRefinementPromotion.length, 0);
assert.equal(requireLafea4ShellProductRefinementPromotionAuthorized.length, 0);
const dormant = evaluateLafea4ShellProductRefinementPromotion();
assert.equal(dormant.active, false);
assert.equal(dormant.productRetentionAuthorized, false);
assert.equal(dormant.uiBindingAuthorized, false);
assert.equal(dormant.releaseQualified, false);
assert.equal(dormant.diagnosticCode, LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_PENDING_CODE);
assert.throws(
  () => requireLafea4ShellProductRefinementPromotionAuthorized(),
  (error) => error?.code === LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_BLOCK_CODE,
);

// A structurally valid v2 record may be constructed/verified offline, but
// passing it as an extra JavaScript argument must NOT activate the production
// resolver while the source-controlled trust root remains null.
const synthetic = createLafea4ShellProductRefinementPromotionRecord({
  schema: LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_SCHEMA,
  stageId: 'LAFEA.4',
  exactHeadQualificationId: LAFEA4_SHELL_PRODUCT_REFINEMENT_EXACT_HEAD_QUALIFICATION_ID,
  qualifiedHead: 'a'.repeat(40),
  bundleEvidenceSha256: '1'.repeat(64),
  bundlePlanSha256: '2'.repeat(64),
  bundleRunnerSha256: '3'.repeat(64),
  implementationFingerprint: `sha256:${'4'.repeat(64)}`,
  capabilityHash: LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY.capabilityHash,
  qualificationHash: LAFEA4_SHELL_PRODUCT_REFINEMENT_QUALIFICATION.qualificationHash,
  qualificationClassification: 'PASS',
  qualificationComplete: true,
  futurePromotionReviewEligible: true,
  productRetentionAuthorized: true,
  uiBindingAuthorized: true,
  releaseQualified: false,
});
assert.deepEqual(validateLafea4ShellProductRefinementPromotionRecord(synthetic), synthetic);
const injectionAttempt = evaluateLafea4ShellProductRefinementPromotion(synthetic);
assert.equal(injectionAttempt.active, false);
assert.equal(injectionAttempt.productRetentionAuthorized, false);
assert.equal(injectionAttempt.uiBindingAuthorized, false);
assert.throws(
  () => requireLafea4ShellProductRefinementPromotionAuthorized(synthetic),
  (error) => error?.code === LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_BLOCK_CODE,
);

const tampered = structuredClone(synthetic);
tampered.bundleEvidenceSha256 = '5'.repeat(64);
assert.throws(
  () => validateLafea4ShellProductRefinementPromotionRecord(tampered),
  /LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_RECORD_TAMPERED/,
);
const wrongCapability = { ...synthetic };
delete wrongCapability.semanticHash;
wrongCapability.capabilityHash = `sha256:${'6'.repeat(64)}`;
assert.throws(
  () => createLafea4ShellProductRefinementPromotionRecord(wrongCapability),
  /LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_CONTRACT_INVALID/,
);
const missingFingerprint = { ...synthetic };
delete missingFingerprint.semanticHash;
delete missingFingerprint.implementationFingerprint;
assert.throws(
  () => createLafea4ShellProductRefinementPromotionRecord(missingFingerprint),
  /LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_KEYS_INVALID/,
);

console.log(JSON.stringify({
  check: 'lafea-tech13f-dormant-promotion-gate',
  status: 'PASS',
  productionTrustRoot: 'NULL',
  productionProductRetentionAuthorized: dormant.productRetentionAuthorized,
  productionUiBindingAuthorized: dormant.uiBindingAuthorized,
  callerSuppliedValidRecordIgnored: injectionAttempt.active === false,
  v2ImplementationFingerprintRequired: true,
  syntheticRecordIsProductionEvidence: false,
  releaseQualified: false,
}, null, 2));
