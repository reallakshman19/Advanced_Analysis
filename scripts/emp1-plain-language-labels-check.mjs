/**
 * EMP.1 plain-language presentation check.
 *
 * Legacy call sites may retain the historical underscore-stripping fallback, but
 * governed engineer-facing states must be explicitly mapped and strict consumers
 * must fail closed on a new unmapped machine state.
 */
import assert from 'node:assert/strict';
import {
  EMP1_PLAIN_LANGUAGE_LABEL_COUNT,
  emp1HasPlainLanguageLabel,
  emp1PlainLanguageLabel,
  emp1PlainLanguageLabelRequired,
} from '../src/workspace/emp1-plain-language-labels.js';

const RENDERED_ON_SCREEN = [
  // readiness dimensions
  'INPUT_REQUIRED', 'NOT_ESTABLISHED', 'NOT_READY', 'NOT_REVIEWED',
  'NOT_ASSESSED', 'NOT_QUALIFIED', 'UNRESOLVED',
  // authority summary values, already space separated upstream
  'SOURCE INPUT REQUIRED', 'SOURCE INCOMPLETE', 'TRANSFER INPUT REQUIRED',
  'SCREENING INPUT REQUIRED', 'LOCAL METHOD BLOCKED', 'LOCAL RESULT NOT CALCULATED',
  'RELEASE PROFILE NOT QUALIFIED', 'CODE COMPLIANCE NOT ASSESSED',
  // blockers surfaced in the blocking-evidence list and the failure banner
  'EMP1_READINESS_A_SOURCE_REQUIRED', 'EMP1_READINESS_B_SOURCE_REQUIRED',
  'EMP1_WORKBENCH_A_DOCUMENT_REQUIRED', 'EMP1_WORKBENCH_B_DOCUMENT_REQUIRED',
  'EMP1_WORKBENCH_RUN_INPUT_REQUIRED', 'EMP1_A_CURRENT_QUALIFIED_RESULT_REQUIRED',
  'EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_SUSPENDED',
  // bounded-route presentation vocabulary
  'SOURCE_QUALIFIED_RUNTIME_POLARITY_REQUIRED', 'SOURCE_REFERENCE_TOWARD_ATTACHMENT_TARGET',
  'REQUIRED', 'PROHIBITED',
  // CAUx/PV Elite benchmark presentation vocabulary
  'REFERENCE_NOT_AVAILABLE', 'SOURCE_NOT_RETAINED', 'NOT_AVAILABLE',
  'REQUIRED_FROM_RETAINED_SOURCE', 'UNRESOLVED_MUST_FREEZE_BEFORE_EMP_OBSERVATION',
  'INDEPENDENT_BENCHMARK_REFERENCE_NOT_WRC_METHOD_AUTHORITY',
  'INDEPENDENT_COMMERCIAL_SOFTWARE_COMPARISON_NOT_WRC_METHOD_AUTHORITY',
  'COMPARISON_QUALIFIED', 'REFERENCE_FROZEN', 'RETAINED_ACTUAL_EXECUTION_COMPARISON',
  'PASS', 'PASS_RECONCILED',
  'PASS_FINAL_CAUX_SOURCE_QUALIFICATION_GAMMA_RADIUS_RECONCILED_REFERENCE_FREEZE_PRESERVED',
  'NOT_RUN_EXECUTION_ENVIRONMENT', 'OUTSIDE_AUTHORIZED_ENGINEERING_ROUTE',
];

for (const code of RENDERED_ON_SCREEN) {
  assert.ok(emp1HasPlainLanguageLabel(code), `${code} must have a plain-language label`);
  const label = emp1PlainLanguageLabelRequired(code);
  assert.notEqual(label, code, `${code} must not render as itself`);
  assert.ok(/[a-z]/.test(label), `${code} label must not be all caps: ${label}`);
  assert.equal(label.includes('_'), false, `${code} label must not carry underscores: ${label}`);
}

assert.equal(
  emp1PlainLanguageLabelRequired('LOCAL METHOD BLOCKED · LOCAL RESULT NOT CALCULATED'),
  'Local method unavailable for these inputs · Local check not calculated',
);
assert.equal(
  emp1PlainLanguageLabel('LOCAL RESULT NOT CALCULATED · RELEASE PROFILE NOT QUALIFIED'),
  'Local check not calculated · Not approved for final use',
);
assert.equal(emp1PlainLanguageLabelRequired('NOT_QUALIFIED'), 'Not approved for stated use');
assert.equal(emp1PlainLanguageLabelRequired('STALE'), 'Inputs changed — recalculate');
assert.equal(
  emp1PlainLanguageLabelRequired('EMP1_A_CURRENT_QUALIFIED_RESULT_REQUIRED'),
  'A current load-transfer result is required before the local check can run.',
);

// Legacy compatibility remains available only through the non-strict helper.
assert.equal(emp1PlainLanguageLabel('SOME_FUTURE_CODE'), 'SOME FUTURE CODE');
assert.equal(emp1HasPlainLanguageLabel('SOME_FUTURE_CODE'), false);
assert.equal(emp1PlainLanguageLabel(null), 'Unresolved');

assert.throws(
  () => emp1PlainLanguageLabelRequired('SOME_FUTURE_CODE'),
  (error) => error?.code === 'EMP1_PRESENTATION_LABEL_REQUIRED'
    && error?.value === 'SOME_FUTURE_CODE',
  'strict presentation surfaces must fail closed on an unmapped machine state',
);

assert.ok(EMP1_PLAIN_LANGUAGE_LABEL_COUNT >= RENDERED_ON_SCREEN.length);
console.log(`  ${RENDERED_ON_SCREEN.length} governed rendered states mapped, ${EMP1_PLAIN_LANGUAGE_LABEL_COUNT} labels total`);
console.log('EMP1_PLAIN_LANGUAGE_LABELS_CHECK_PASS');
