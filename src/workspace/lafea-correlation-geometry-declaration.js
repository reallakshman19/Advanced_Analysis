import { createCorrelationGeometryEvidenceFromLafea2 } from '../core/local-attachment-correlation/index.js';
import { semanticHash } from '../core/shared-primitives/canonical-json.js';
import { lafeaDocumentDigest } from './lafea-edit-command.js';

export const LAFEA_CORRELATION_GEOMETRY_DECLARATION_SCHEMA =
  'lafea-correlation-geometry-declaration/v1';
export const LAFEA_CORRELATION_GEOMETRY_PROJECTION_SCHEMA =
  'lafea-correlation-geometry-projection/v1';

export function createLafeaCorrelationGeometryDeclaration(stage, input) {
  requireStage(stage);
  if (!stage.document) fail('LAFEA_CORRELATION_GEOMETRY_SOURCE_DOCUMENT_REQUIRED', 'stage.document');
  const base = {
    schema: LAFEA_CORRELATION_GEOMETRY_DECLARATION_SCHEMA,
    stageId: 'LAFEA.2',
    geometryIdentity: requiredString(input?.geometryIdentity, 'geometryIdentity'),
    attachmentDiameter: positive(input?.attachmentDiameter, 'attachmentDiameter'),
    attachmentSourceReference: requiredString(
      input?.attachmentSourceReference,
      'attachmentSourceReference',
    ),
    sourceDocumentDigest: lafeaDocumentDigest(stage.document),
  };
  return freeze({ ...base, semanticHash: semanticHash(base) });
}

export function validateLafeaCorrelationGeometryDeclaration(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('LAFEA_CORRELATION_GEOMETRY_DECLARATION_REQUIRED', 'declaration');
  }
  exactKeys(value, [
    'schema', 'stageId', 'geometryIdentity', 'attachmentDiameter',
    'attachmentSourceReference', 'sourceDocumentDigest', 'semanticHash',
  ], 'declaration');
  if (value.schema !== LAFEA_CORRELATION_GEOMETRY_DECLARATION_SCHEMA) {
    fail('LAFEA_CORRELATION_GEOMETRY_DECLARATION_SCHEMA_MISMATCH', 'declaration.schema');
  }
  if (value.stageId !== 'LAFEA.2') fail('LAFEA_CORRELATION_GEOMETRY_STAGE_MISMATCH', 'declaration.stageId');
  requiredString(value.geometryIdentity, 'declaration.geometryIdentity');
  positive(value.attachmentDiameter, 'declaration.attachmentDiameter');
  requiredString(value.attachmentSourceReference, 'declaration.attachmentSourceReference');
  requiredString(value.sourceDocumentDigest, 'declaration.sourceDocumentDigest');
  const { semanticHash: retainedHash, ...base } = value;
  if (retainedHash !== semanticHash(base)) {
    fail('LAFEA_CORRELATION_GEOMETRY_DECLARATION_HASH_MISMATCH', 'declaration.semanticHash');
  }
  return freeze(structuredClone(value));
}

export function projectLafeaCorrelationGeometry(stage, declarationInput) {
  requireStage(stage);
  if (!declarationInput) return projection('ABSENT', [
    'SOURCE_BOUND_ATTACHMENT_GEOMETRY_REQUIRED',
  ], null, null, null);

  let declaration;
  try {
    declaration = validateLafeaCorrelationGeometryDeclaration(declarationInput);
  } catch (error) {
    return projection('INVALID', [error.code ?? 'ATTACHMENT_GEOMETRY_DECLARATION_INVALID'],
      safeClone(declarationInput), null, diagnostic(error));
  }
  if (!stage.document) return projection('STALE', [
    'LAFEA2_SOURCE_DOCUMENT_REQUIRED',
  ], declaration, null, null);

  const currentDocumentDigest = lafeaDocumentDigest(stage.document);
  if (currentDocumentDigest !== declaration.sourceDocumentDigest) {
    return projection('STALE', [
      'ATTACHMENT_GEOMETRY_SOURCE_STALE',
    ], declaration, null, null, currentDocumentDigest);
  }

  const acceptedResult = stage.execution?.status === 'QUALIFIED'
    && stage.execution?.result?.qualification?.state === 'ACCEPTED';
  if (!acceptedResult) {
    return projection('CURRENT_INPUT_PENDING_RESULT', [], declaration, null, null,
      currentDocumentDigest);
  }

  try {
    const geometryEvidence = createCorrelationGeometryEvidenceFromLafea2({
      screeningRequest: stage.document,
      screeningResult: stage.execution.result,
      geometryIdentity: declaration.geometryIdentity,
      attachmentDiameter: declaration.attachmentDiameter,
      attachmentSourceReference: declaration.attachmentSourceReference,
    });
    return projection('CURRENT_EVIDENCE', [], declaration, geometryEvidence, null,
      currentDocumentDigest);
  } catch (error) {
    return projection('INVALID', [
      error.code ?? 'ATTACHMENT_GEOMETRY_EVIDENCE_REJECTED',
    ], declaration, null, diagnostic(error), currentDocumentDigest);
  }
}

function projection(
  state,
  reasons,
  declaration,
  geometryEvidence,
  diagnosticValue,
  currentDocumentDigest = null,
) {
  return freeze({
    schema: LAFEA_CORRELATION_GEOMETRY_PROJECTION_SCHEMA,
    stageId: 'LAFEA.2',
    state,
    reasons: [...reasons],
    declaration,
    declarationHash: declaration?.semanticHash ?? null,
    boundDocumentDigest: declaration?.sourceDocumentDigest ?? null,
    currentDocumentDigest,
    geometryEvidence,
    geometryEvidenceHash: geometryEvidence?.semanticHash ?? null,
    diagnostics: diagnosticValue ? [diagnosticValue] : [],
  });
}

function requireStage(stage) {
  if (!stage || stage.stageId !== 'LAFEA.2') {
    fail('LAFEA_CORRELATION_GEOMETRY_STAGE_MUST_BE_LAFEA2', 'stage.stageId');
  }
}
function diagnostic(error) {
  return freeze({
    severity: 'ERROR',
    code: error?.code ?? 'LAFEA_CORRELATION_GEOMETRY_REJECTED',
    path: error?.path ?? null,
    message: error instanceof Error ? error.message : String(error),
  });
}
function exactKeys(value, expected, path) {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(required)) {
    fail('LAFEA_CORRELATION_GEOMETRY_EXACT_KEYS_MISMATCH', path);
  }
}
function positive(value, path) {
  if (!Number.isFinite(value) || value <= 0) fail('LAFEA_CORRELATION_GEOMETRY_POSITIVE_REQUIRED', path);
  return value;
}
function requiredString(value, path) {
  if (typeof value !== 'string' || !value.trim()) fail('LAFEA_CORRELATION_GEOMETRY_STRING_REQUIRED', path);
  return value.trim();
}
function safeClone(value) {
  try { return structuredClone(value); } catch { return null; }
}
function fail(code, path) {
  const error = new TypeError(code);
  error.code = code;
  error.path = path;
  throw error;
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
