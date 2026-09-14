#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  EMP1_WRC537_GENERAL_SCF_AUTHORITY_STATE,
  EMP1_WRC537_UNITY_SCF_AUTHORITY,
} from '../src/core/emp1/emp1-wrc537-stress-concentration-authority.js';

const intakePath = 'validation/emp1/wrc537-2013/appendix-b-scf-primary-source-intake-v2.json';
const predecessorPath = 'validation/emp1/wrc537-2013/appendix-b-scf-source-qualification-v1.json';
const [intake, predecessor, intakeText] = await Promise.all([
  readJson(intakePath),
  readJson(predecessorPath),
  readFile(intakePath, 'utf8'),
]);

const sourceSha = '698fcdc3e676e3bc6bbf710bc28ea8b666ac9511a81a0067a5d01088ae4c27b2';
const sourceBlob = 'ce861233928154145a9257efbbf8dbef3f5a17d1';

assert.equal(intake.schema, 'emp1-wrc537-appendix-b-scf-primary-source-intake/v2');
assert.equal(intake.issue, 1777);
assert.equal(intake.trackId, 'E1');
assert.equal(intake.capability, 'NON_UNITY_STRESS_CONCENTRATION_FACTORS');
assert.equal(intake.status, 'BLOCKED_PRIMARY_APPENDIX_B_PAGES_NOT_READABLE_IN_CURRENT_INTERFACE');
assert.equal(intake.authorityCreatedByThisArtifact, false);
assert.equal(intake.engineeringPassClaimed, false);
assert.equal(intake.sourceDefinitionFrozen, false);
assert.equal(intake.productionObservationUsedToChooseDefinition, false);
assert.equal(intake.source.rawPdfSha256, sourceSha);
assert.equal(intake.source.gitBlob, sourceBlob);
assert.equal(intake.source.primaryPageObservation, 'NOT_RUN_EXECUTION_ENVIRONMENT_BINARY_TRANSPORT');
assert.equal(intake.source.primarySourceVerifiedForImplementation, false);

assert.equal(predecessor.source.rawPdfSha256, sourceSha);
assert.equal(predecessor.source.gitBlob, sourceBlob);
assert.equal(predecessor.engineeringAuthority, false);
assert.equal(predecessor.productionImplementationAuthority, false);
assert.equal(
  predecessor.existingSecondaryExtraction.candidateFormulaTextAuthority,
  'REJECTED_FOR_IMPLEMENTATION_PENDING_PRIMARY_PAGE_VERIFICATION',
);
assert.equal(predecessor.transcriptionRisk.classification, 'MATERIAL_NUMERICAL_RISK');
assert.equal(
  predecessor.transcriptionRisk.disposition,
  'DO_NOT_IMPLEMENT_OR_HANDCALC_FROM_SECONDARY_CANDIDATE_FORM',
);

assert.deepEqual(EMP1_WRC537_UNITY_SCF_AUTHORITY, {
  Kn: 1,
  Kb: 1,
  authority: 'PINNED_BOUNDED_ROUTE_UNITY_ONLY',
});
assert.equal(EMP1_WRC537_GENERAL_SCF_AUTHORITY_STATE.mode, 'UNITY_ONLY');
assert.equal(EMP1_WRC537_GENERAL_SCF_AUTHORITY_STATE.generalAppendixBAuthority, false);
assert.equal(EMP1_WRC537_GENERAL_SCF_AUTHORITY_STATE.nonUnityAuthorized, false);
assert.equal(
  EMP1_WRC537_GENERAL_SCF_AUTHORITY_STATE.sourceQualification
    .licensedPrimarySourceVerifiedForImplementation,
  false,
);
assert.equal(
  EMP1_WRC537_GENERAL_SCF_AUTHORITY_STATE.sourceQualification
    .equationSelectionPolicyQualified,
  false,
);

assert.equal(intake.currentBoundedAuthority.mode, 'UNITY_ONLY');
assert.equal(intake.currentBoundedAuthority.Kn, 1);
assert.equal(intake.currentBoundedAuthority.Kb, 1);
assert.equal(intake.currentBoundedAuthority.generalAppendixBAuthority, false);
assert.equal(intake.currentBoundedAuthority.nonUnityAuthorized, false);
assert.equal(intake.benchmarkGate.independentBenchmark, 'ABSENT');
assert.equal(intake.benchmarkGate.benchmarkFreezeAllowedNow, false);
assert.equal(intake.authority.productionImplementationAuthority, false);
assert.equal(intake.authority.independentBenchmarkFrozen, false);
assert.equal(intake.authority.numericalQualification, 'NOT_RUN');
assert.equal(intake.authority.versionedRouteProfileAuthorization, false);
assert.equal(intake.authority.globalEmp1CRouteAuthority, false);
assert.equal(intake.authority.codeComplianceAuthorized, false);
assert.equal(intake.authority.releaseQualified, false);

assert.equal(intake.requiredPrimaryExtractionFields.length, 12);
assert.equal(intake.requiredPrimaryQuestions.length, 16);
for (const required of [
  'AUTHORITATIVE_B4_VS_B5_Kb_SELECTION_RULE',
  'EXACT_RESULT_QUANTITY_TO_WHICH_FACTORS_APPLY',
  'SIGN_PRESERVATION_SEMANTICS',
  'HOST_SHELL_VS_NOZZLE_ATTACHMENT_SCOPE_AND_EXTERNAL_REFERENCE_DEPENDENCIES',
]) {
  assert(intake.requiredPrimaryQuestions.includes(required), `EMP1_1777_E1_PRIMARY_QUESTION_MISSING:${required}`);
}

for (const [key, expected] of Object.entries({
  publicReproductionCreatesMethodAuthority: false,
  secondaryCandidateEquationTextMayBeImplemented: false,
  secondaryCandidateEquationTextMaySeedIndependentBenchmark: false,
  productionNumericalAgreementMaySelectEquation: false,
  vendorOrComparisonSoftwareMaySelectEquation: false,
})) {
  assert.equal(intake.corroborationBoundary[key], expected, `EMP1_1777_E1_CORROBORATION_BOUNDARY:${key}`);
}

for (const prohibited of [
  '1 + 0.65/(r/(2T))^5.6',
  '1 + 0.85/(r/(2T))^10.75',
  '1 + 0.80/(r/(2T))^9.4',
]) {
  assert(!intakeText.includes(prohibited), 'EMP1_1777_E1_REJECTED_SECONDARY_FORMULA_COPIED_INTO_V2_AUTHORITY_RECORD');
}

console.log(JSON.stringify({
  schema: 'emp1-wrc537-appendix-b-primary-source-intake-check/v2',
  status: 'PASS_E1_INTAKE_FAIL_CLOSED_NO_NONUNITY_AUTHORITY',
  authorityCreatedByThisCheck: false,
  engineeringPassClaimed: false,
  primaryPageObservation: intake.source.primaryPageObservation,
  sourceDefinitionFrozen: false,
  independentBenchmark: 'ABSENT',
  numericalQualification: 'NOT_RUN',
  currentMode: EMP1_WRC537_GENERAL_SCF_AUTHORITY_STATE.mode,
  nonUnityAuthorized: false,
  nextGate: intake.nextGate,
}, null, 2));

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
