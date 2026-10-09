import { semanticHash } from '../../../shared-primitives/canonical-json.js';
import {
  WRC537_ED4_PACKAGE_READY,
  evaluateWrc537Ed4SourcePackage,
} from './ed4-source-package.js';

export const WRC537_ED4_ENGINEERING_DATASET_SCHEMA = 'wrc537-ed4-engineering-dataset/v1';
export const WRC537_ED4_PROMOTION_SCHEMA = 'wrc537-ed4-dataset-promotion/v1';

const AUTHORIZATION_BASIS = 'SOURCE_QUALIFIED_DATASET_NOT_METHOD_QUALIFIED';

export function createWrc537Ed4EngineeringDatasetCandidate(input) {
  requireObject(input, 'input');
  exactKeys(input, ['sourcePackage', 'sourceLedgerRows', 'coefficientRows', 'promotion'], 'input');
  requireArray(input.sourceLedgerRows, 'input.sourceLedgerRows');
  requireArray(input.coefficientRows, 'input.coefficientRows');
  validatePromotion(input.promotion);

  const readiness = evaluateWrc537Ed4SourcePackage({
    sourcePackage: input.sourcePackage,
    sourceLedgerRows: input.sourceLedgerRows,
    coefficientRows: input.coefficientRows,
  });
  if (readiness.state !== WRC537_ED4_PACKAGE_READY) {
    const error = new Error('WRC537_ED4_SOURCE_PACKAGE_NOT_READY');
    error.code = 'WRC537_ED4_SOURCE_PACKAGE_NOT_READY';
    error.path = 'input.sourcePackage';
    error.failedGateIds = [...readiness.failedGateIds];
    throw error;
  }

  const sourcePackage = clone(input.sourcePackage);
  const sourceLedgerRows = sortedUniqueRows(input.sourceLedgerRows, 'record_id', 'sourceLedgerRows');
  const coefficientRows = sortedUniqueRows(input.coefficientRows, 'coefficient_id', 'coefficientRows');
  const promotion = clone(input.promotion);
  const sourceReadiness = clone(readiness);

  const sourceBinding = {
    sourceDocumentDigest: sourcePackage.technicalSource.documentDigest,
    sourcePackageSemanticHash: semanticHash(sourcePackage),
    sourceLedgerSemanticHash: semanticHash(sourceLedgerRows),
    coefficientRowsSemanticHash: semanticHash(coefficientRows),
    readinessSemanticHash: semanticHash(sourceReadiness),
  };

  const base = {
    schema: WRC537_ED4_ENGINEERING_DATASET_SCHEMA,
    methodIdentity: 'WRC537',
    methodEdition: '4',
    publicationDate: '2026-02',
    promotion,
    authority: {
      engineeringUseAuthorized: false,
      authorizationBasis: AUTHORIZATION_BASIS,
    },
    sourceBinding,
    sourceReadiness,
    sourcePackage,
    sourceLedgerRows,
    coefficientRows,
  };

  return freeze({
    ...base,
    datasetSemanticHash: semanticHash(base),
  });
}

export function validateWrc537Ed4EngineeringDatasetCandidate(value) {
  requireObject(value, 'datasetCandidate');
  exactKeys(value, [
    'schema', 'methodIdentity', 'methodEdition', 'publicationDate', 'promotion',
    'authority', 'sourceBinding', 'sourceReadiness', 'sourcePackage', 'sourceLedgerRows',
    'coefficientRows', 'datasetSemanticHash',
  ], 'datasetCandidate');
  if (value.schema !== WRC537_ED4_ENGINEERING_DATASET_SCHEMA) {
    fail('WRC537_ED4_ENGINEERING_DATASET_SCHEMA_MISMATCH', 'datasetCandidate.schema');
  }
  if (value.methodIdentity !== 'WRC537' || value.methodEdition !== '4'
    || value.publicationDate !== '2026-02') {
    fail('WRC537_ED4_ENGINEERING_DATASET_IDENTITY_MISMATCH', 'datasetCandidate');
  }
  exactKeys(value.authority, ['engineeringUseAuthorized', 'authorizationBasis'], 'datasetCandidate.authority');
  if (value.authority.engineeringUseAuthorized !== false
    || value.authority.authorizationBasis !== AUTHORIZATION_BASIS) {
    fail('WRC537_ED4_ENGINEERING_DATASET_AUTHORITY_INVALID', 'datasetCandidate.authority');
  }
  exactKeys(value.sourceBinding, [
    'sourceDocumentDigest', 'sourcePackageSemanticHash', 'sourceLedgerSemanticHash',
    'coefficientRowsSemanticHash', 'readinessSemanticHash',
  ], 'datasetCandidate.sourceBinding');
  requireObject(value.sourceReadiness, 'datasetCandidate.sourceReadiness');
  assertSortedUnique(value.sourceLedgerRows, 'record_id', 'datasetCandidate.sourceLedgerRows');
  assertSortedUnique(value.coefficientRows, 'coefficient_id', 'datasetCandidate.coefficientRows');

  const reconstructed = createWrc537Ed4EngineeringDatasetCandidate({
    sourcePackage: value.sourcePackage,
    sourceLedgerRows: value.sourceLedgerRows,
    coefficientRows: value.coefficientRows,
    promotion: value.promotion,
  });
  if (semanticHash(value.sourcePackage) !== value.sourceBinding.sourcePackageSemanticHash) {
    fail('WRC537_ED4_SOURCE_PACKAGE_HASH_MISMATCH', 'datasetCandidate.sourceBinding.sourcePackageSemanticHash');
  }
  if (semanticHash(value.sourceLedgerRows) !== value.sourceBinding.sourceLedgerSemanticHash) {
    fail('WRC537_ED4_SOURCE_LEDGER_HASH_MISMATCH', 'datasetCandidate.sourceBinding.sourceLedgerSemanticHash');
  }
  if (semanticHash(value.coefficientRows) !== value.sourceBinding.coefficientRowsSemanticHash) {
    fail('WRC537_ED4_COEFFICIENT_ROWS_HASH_MISMATCH', 'datasetCandidate.sourceBinding.coefficientRowsSemanticHash');
  }
  if (semanticHash(value.sourceReadiness) !== value.sourceBinding.readinessSemanticHash) {
    fail('WRC537_ED4_RETAINED_READINESS_HASH_MISMATCH', 'datasetCandidate.sourceBinding.readinessSemanticHash');
  }
  if (value.sourceBinding.sourceDocumentDigest !== reconstructed.sourceBinding.sourceDocumentDigest) {
    fail('WRC537_ED4_SOURCE_DOCUMENT_DIGEST_MISMATCH', 'datasetCandidate.sourceBinding.sourceDocumentDigest');
  }
  if (value.sourceBinding.readinessSemanticHash !== reconstructed.sourceBinding.readinessSemanticHash) {
    fail('WRC537_ED4_READINESS_REPLAY_MISMATCH', 'datasetCandidate.sourceBinding.readinessSemanticHash');
  }
  if (semanticHash(value.sourceReadiness) !== semanticHash(reconstructed.sourceReadiness)) {
    fail('WRC537_ED4_RETAINED_READINESS_REPLAY_MISMATCH', 'datasetCandidate.sourceReadiness');
  }
  if (value.datasetSemanticHash !== reconstructed.datasetSemanticHash) {
    fail('WRC537_ED4_ENGINEERING_DATASET_HASH_MISMATCH', 'datasetCandidate.datasetSemanticHash');
  }
  return reconstructed;
}

export function engineeringDatasetCandidateCanActivateMethod(candidateInput) {
  validateWrc537Ed4EngineeringDatasetCandidate(candidateInput);
  return false;
}

function validatePromotion(value) {
  requireObject(value, 'promotion');
  exactKeys(value, ['schema', 'candidateIdentity', 'candidateVersion', 'preparedBy', 'preparationReference'], 'promotion');
  if (value.schema !== WRC537_ED4_PROMOTION_SCHEMA) {
    fail('WRC537_ED4_PROMOTION_SCHEMA_MISMATCH', 'promotion.schema');
  }
  requiredString(value.candidateIdentity, 'promotion.candidateIdentity');
  requiredString(value.candidateVersion, 'promotion.candidateVersion');
  requiredString(value.preparedBy, 'promotion.preparedBy');
  requiredString(value.preparationReference, 'promotion.preparationReference');
}

function sortedUniqueRows(rows, key, path) {
  const cloned = clone(rows);
  cloned.forEach((row, index) => {
    requireObject(row, `${path}[${index}]`);
    requiredString(row[key], `${path}[${index}].${key}`);
  });
  cloned.sort((a, b) => a[key].localeCompare(b[key]));
  assertSortedUnique(cloned, key, path);
  return cloned;
}
function assertSortedUnique(rows, key, path) {
  requireArray(rows, path);
  let previous = null;
  rows.forEach((row, index) => {
    requireObject(row, `${path}[${index}]`);
    const current = requiredString(row[key], `${path}[${index}].${key}`);
    if (previous !== null && current <= previous) {
      fail('WRC537_ED4_DATASET_ROWS_NOT_STRICTLY_SORTED_UNIQUE', `${path}[${index}].${key}`);
    }
    previous = current;
  });
}
function requiredString(value, path) {
  if (typeof value !== 'string' || !value.trim()) fail('WRC537_ED4_STRING_REQUIRED', path);
  return value;
}
function exactKeys(value, expected, path) {
  requireObject(value, path);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(required)) {
    fail('WRC537_ED4_EXACT_KEYS_MISMATCH', path);
  }
}
function requireObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('WRC537_ED4_OBJECT_REQUIRED', path);
}
function requireArray(value, path) {
  if (!Array.isArray(value)) fail('WRC537_ED4_ARRAY_REQUIRED', path);
}
function clone(value) { return structuredClone(value); }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
function fail(code, path) {
  const error = new Error(code);
  error.code = code;
  error.path = path;
  throw error;
}
