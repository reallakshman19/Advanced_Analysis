import assert from 'node:assert/strict';
import {
  WRC537_ED4_ENGINEERING_DATASET_SCHEMA,
  WRC537_ED4_PROMOTION_SCHEMA,
  createWrc537Ed4EngineeringDatasetCandidate,
  engineeringDatasetCandidateCanActivateMethod,
  validateWrc537Ed4EngineeringDatasetCandidate,
} from '../src/core/local-attachment-correlation/methods/wrc537/ed4-engineering-dataset.js';
import { createReadyWrc537Ed4SourceFixture } from './wrc537-ed4-ready-source-fixture.mjs';

const promotion = {
  schema: WRC537_ED4_PROMOTION_SCHEMA,
  candidateIdentity: 'WRC537-ED4-DATASET-FIXTURE-001',
  candidateVersion: '1',
  preparedBy: 'QUALIFICATION_FIXTURE',
  preparationReference: 'WRC537-ED4-PROMOTION-SELF-TEST',
};

const ready = createReadyWrc537Ed4SourceFixture();
const candidate = createWrc537Ed4EngineeringDatasetCandidate({ ...ready, promotion });
assert.equal(candidate.schema, WRC537_ED4_ENGINEERING_DATASET_SCHEMA);
assert.equal(candidate.authority.engineeringUseAuthorized, false);
assert.equal(candidate.authority.authorizationBasis, 'SOURCE_QUALIFIED_DATASET_NOT_METHOD_QUALIFIED');
assert.equal(candidate.sourceReadiness.state, 'READY_FOR_TECHNICAL_IMPLEMENTATION');
assert.ok(candidate.datasetSemanticHash.startsWith('fnv1a64:'));
assert.ok(Object.isFrozen(candidate));
assert.ok(Object.isFrozen(candidate.sourcePackage));
assert.ok(Object.isFrozen(candidate.sourceReadiness));
assert.equal(validateWrc537Ed4EngineeringDatasetCandidate(candidate).datasetSemanticHash,
  candidate.datasetSemanticHash);
assert.equal(engineeringDatasetCandidateCanActivateMethod(candidate), false);

const reorderedInput = createReadyWrc537Ed4SourceFixture();
reorderedInput.sourceLedgerRows.reverse();
const reorderedCandidate = createWrc537Ed4EngineeringDatasetCandidate({ ...reorderedInput, promotion });
assert.equal(reorderedCandidate.datasetSemanticHash, candidate.datasetSemanticHash,
  'Input row order must not change the promoted dataset identity.');

const blocked = createReadyWrc537Ed4SourceFixture();
blocked.sourcePackage.technicalSource.available = false;
const blockedError = expectCreateError('WRC537_ED4_SOURCE_PACKAGE_NOT_READY', blocked);
assert.ok(blockedError.failedGateIds.includes('PRIMARY_TECHNICAL_SOURCE'));

const duplicate = createReadyWrc537Ed4SourceFixture();
duplicate.coefficientRows.push(structuredClone(duplicate.coefficientRows[0]));
const duplicateError = expectCreateError('WRC537_ED4_SOURCE_PACKAGE_NOT_READY', duplicate);
assert.ok(duplicateError.failedGateIds.includes('COEFFICIENT_IDS_UNIQUE'));

expectValidationError('WRC537_ED4_ENGINEERING_DATASET_AUTHORITY_INVALID', (copy) => {
  copy.authority.engineeringUseAuthorized = true;
});
expectValidationError('WRC537_ED4_SOURCE_PACKAGE_HASH_MISMATCH', (copy) => {
  copy.sourcePackage.technicalSource.custodyNote = 'Different but still resolved custody note.';
});
expectValidationError('WRC537_ED4_SOURCE_LEDGER_HASH_MISMATCH', (copy) => {
  copy.sourceLedgerRows[0].locator = 'Different official catalog locator';
});
expectValidationError('WRC537_ED4_COEFFICIENT_ROWS_HASH_MISMATCH', (copy) => {
  copy.coefficientRows[0].coefficient_value = '1.235';
});
expectValidationError('WRC537_ED4_RETAINED_READINESS_HASH_MISMATCH', (copy) => {
  copy.sourceReadiness.gates[0].status = 'FAIL';
});
expectValidationError('WRC537_ED4_DATASET_ROWS_NOT_STRICTLY_SORTED_UNIQUE', (copy) => {
  copy.sourceLedgerRows.reverse();
});
expectValidationError('WRC537_ED4_ENGINEERING_DATASET_HASH_MISMATCH', (copy) => {
  copy.datasetSemanticHash = 'fnv1a64:0000000000000000';
});
expectValidationError('WRC537_ED4_PROMOTION_SCHEMA_MISMATCH', (copy) => {
  copy.promotion.schema = 'wrong-schema';
});

console.log(JSON.stringify({
  check: 'wrc537-ed4-engineering-dataset-self-test',
  status: 'PASS',
  readySourcePackagePromoted: true,
  fullSourceSnapshotRetained: true,
  readinessEvidenceRetainedAndBound: true,
  semanticHashesBound: true,
  inputOrderingCanonicalized: true,
  blockedSourcePackageRejected: true,
  duplicateCoefficientIdRejectedUpstream: true,
  forgedEngineeringAuthorityRejected: true,
  sourcePackageTamperRejected: true,
  sourceLedgerTamperRejected: true,
  coefficientTamperRejected: true,
  retainedReadinessTamperRejected: true,
  retainedRowReorderingRejected: true,
  datasetHashTamperRejected: true,
  candidateCannotActivateMethod: true,
}));

function expectCreateError(code, fixture) {
  try {
    createWrc537Ed4EngineeringDatasetCandidate({ ...fixture, promotion });
  } catch (error) {
    assert.equal(error.code, code);
    return error;
  }
  assert.fail(`Expected creation error ${code}.`);
}

function expectValidationError(code, mutate) {
  const copy = structuredClone(candidate);
  mutate(copy);
  try {
    validateWrc537Ed4EngineeringDatasetCandidate(copy);
  } catch (error) {
    assert.equal(error.code, code);
    return;
  }
  assert.fail(`Expected validation error ${code}.`);
}
