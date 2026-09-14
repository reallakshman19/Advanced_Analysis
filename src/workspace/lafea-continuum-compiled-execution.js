/** Governed execution bridges from a compiled LAFEA.3 solver model to the existing continuum kernel. */
import {
  CANONICAL_UNITS,
  calculateLocalContinuum,
  createCanonicalLocalContinuumModel,
} from '../core/local-continuum/index.js';
import { canonicalLafeaSha256 } from './lafea-canonical-sha256.js';
import {
  buildLafeaContinuumCompiledExecutionInput,
} from './lafea-continuum-compiled-input.js';
import {
  createLafeaContinuumLoadResultantEvidence,
  validateLafeaContinuumLoadResultantEvidence,
} from './lafea-continuum-load-resultant-evidence.js';
import {
  validateLafeaContinuumProjectionEvidence,
} from './lafea-continuum-projection-evidence.js';
import {
  LAFEA_CONTINUUM_SOLVER_COMPILER_ID,
  LAFEA_CONTINUUM_SOLVER_COMPILER_REVISION,
  LAFEA_CONTINUUM_SOLVER_MODEL_SCHEMA,
} from './lafea-continuum-solver-model.js';

export const LAFEA_CONTINUUM_COMPILED_EXECUTION_SCHEMA =
  'lafea-continuum-compiled-execution/v1';
export const LAFEA_CONTINUUM_COMPILED_EXECUTION_MODE = 'PARITY_ONLY_NOT_RETAINED';
export const LAFEA_CONTINUUM_AUTHORITATIVE_EXECUTION_SCHEMA =
  'lafea-continuum-compiled-authoritative-execution/v1';
export const LAFEA_CONTINUUM_AUTHORITATIVE_EXECUTION_MODE = 'AUTHORITATIVE_WORKBENCH_RUN';

const STAGE_ID = 'LAFEA.3';
const KINDS = new Set([
  'RESTRAINT', 'IMPOSED_DISPLACEMENT', 'CONCENTRATED_LOAD', 'TRACTION',
  'PRESSURE', 'BODY_FORCE', 'TEMPERATURE',
]);

export function executeLafeaContinuumCompiledForParity(value) {
  const run = executeCompiled(value);
  const base = freeze({
    schema: LAFEA_CONTINUUM_COMPILED_EXECUTION_SCHEMA,
    stageId: STAGE_ID,
    mode: LAFEA_CONTINUUM_COMPILED_EXECUTION_MODE,
    solverModelHash: run.solverModel.solverModelHash,
    projectionHash: run.solverModel.parents.projectionHash,
    loadResultantEvidenceHash: run.loadResultantEvidence.loadResultantEvidenceHash,
    loadResultantEvidence: run.loadResultantEvidence,
    canonicalExecutionInputHash: run.canonicalExecutionInputHash,
    qualificationState: run.executionResult.qualification?.state ?? null,
    executionResult: run.executionResult,
    lifecycleExecutionPublished: false,
    lifecycleRecoveryPublished: false,
    releaseQualified: false,
  });
  return freeze({
    ...base,
    parityEvidenceHash: canonicalLafeaSha256({
      schema: 'lafea-continuum-compiled-execution-hash-input/v1',
      evidence: base,
    }),
  });
}

export function executeLafeaContinuumCompiledAuthoritatively(value) {
  const run = executeCompiled(value);
  const qualificationState = run.executionResult.qualification?.state ?? null;
  const base = freeze({
    schema: LAFEA_CONTINUUM_AUTHORITATIVE_EXECUTION_SCHEMA,
    stageId: STAGE_ID,
    mode: LAFEA_CONTINUUM_AUTHORITATIVE_EXECUTION_MODE,
    solverModelHash: run.solverModel.solverModelHash,
    projectionHash: run.solverModel.parents.projectionHash,
    loadResultantEvidenceHash: run.loadResultantEvidence.loadResultantEvidenceHash,
    loadResultantEvidence: run.loadResultantEvidence,
    canonicalExecutionInputHash: run.canonicalExecutionInputHash,
    qualificationState,
    canonicalInput: run.canonicalInput,
    executionResult: run.executionResult,
    lifecyclePublicationAuthorized: qualificationState === 'ACCEPTED',
    releaseQualified: false,
  });
  return freeze({
    ...base,
    executionEvidenceHash: canonicalLafeaSha256({
      schema: 'lafea-continuum-authoritative-execution-hash-input/v1',
      evidence: base,
    }),
  });
}

function executeCompiled(value) {
  const solverModel = validateSolverModel(value);
  const executionInput = buildLafeaContinuumCompiledExecutionInput(solverModel);
  const loadResultantEvidence = validateLafeaContinuumLoadResultantEvidence(
    createLafeaContinuumLoadResultantEvidence(solverModel, executionInput),
  );
  const canonicalInput = createCanonicalLocalContinuumModel(executionInput);
  const executionResult = calculateLocalContinuum(canonicalInput);
  const canonicalExecutionInputHash = canonicalLafeaSha256({
    schema: 'lafea-continuum-compiled-execution-input-hash/v1',
    canonicalInput,
  });
  return freeze({
    solverModel,
    canonicalInput,
    executionResult,
    canonicalExecutionInputHash,
    loadResultantEvidence,
  });
}

function validateSolverModel(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('LAFEA_CONTINUUM_COMPILED_SOLVER_MODEL_REQUIRED');
  }
  if (value.schema !== LAFEA_CONTINUUM_SOLVER_MODEL_SCHEMA
    || value.stageId !== STAGE_ID || value.status !== 'COMPILED') {
    fail('LAFEA_CONTINUUM_COMPILED_SOLVER_MODEL_SCHEMA_INVALID');
  }
  if (value.compilerId !== LAFEA_CONTINUUM_SOLVER_COMPILER_ID
    || value.compilerRevision !== LAFEA_CONTINUUM_SOLVER_COMPILER_REVISION) {
    fail('LAFEA_CONTINUUM_COMPILED_COMPILER_IDENTITY_INVALID');
  }
  if (value.executionAuthorized !== false || value.releaseQualified !== false) {
    fail('LAFEA_CONTINUUM_COMPILED_AUTHORITY_STATE_INVALID');
  }
  if (value.coordinateSystemId !== 'GLOBAL_XY') {
    fail('LAFEA_CONTINUUM_COMPILED_COORDINATE_SYSTEM_UNSUPPORTED');
  }
  if (value.dofPolicy?.dofsPerNode !== 2
    || JSON.stringify(value.dofPolicy?.dofOrder) !== JSON.stringify(['UX', 'UY'])) {
    fail('LAFEA_CONTINUUM_COMPILED_DOF_POLICY_INVALID');
  }
  requireCanonicalUnits(value.units);
  requireSourceModel(value.sourceModel);
  requireCollections(value);
  const projection = validateLafeaContinuumProjectionEvidence(value.projectionEvidence);
  if (value.parents?.projectionHash !== projection.projectionHash) {
    fail('LAFEA_CONTINUUM_COMPILED_PROJECTION_PARENT_INVALID');
  }
  if (!value.qualificationProfile || typeof value.qualificationProfile !== 'object') {
    fail('LAFEA_CONTINUUM_COMPILED_PROFILE_INVALID');
  }
  if (!value.attachments.every((row) => KINDS.has(row?.kind))) {
    fail('LAFEA_CONTINUUM_COMPILED_ATTACHMENT_KIND_UNSUPPORTED');
  }
  requireSolverModelHash(value);
  return value;
}

function requireCollections(value) {
  for (const key of [
    'materials', 'sections', 'nodes', 'elements', 'physicalCases',
    'attachments', 'requestedCaseIds', 'limitations',
  ]) {
    if (!Array.isArray(value[key])) {
      fail(`LAFEA_CONTINUUM_COMPILED_${key.toUpperCase()}_INVALID`);
    }
  }
  if (!value.materials.length || !value.sections.length || !value.nodes.length
    || !value.elements.length || !value.physicalCases.length) {
    fail('LAFEA_CONTINUUM_COMPILED_SOLVER_MODEL_EMPTY');
  }
}

function requireCanonicalUnits(units) {
  for (const key of ['length', 'force', 'stress', 'modulus']) {
    if (units?.[key] !== CANONICAL_UNITS[key]) {
      fail('LAFEA_CONTINUUM_COMPILED_CANONICAL_UNITS_INVALID');
    }
  }
}

function requireSourceModel(value) {
  if (!value || typeof value !== 'object' || !text(value.modelIdentity) || !text(value.modelVersion)
    || !value.sourceAncestry || typeof value.sourceAncestry !== 'object'
    || !value.elementTypePolicy || typeof value.elementTypePolicy !== 'object') {
    fail('LAFEA_CONTINUUM_COMPILED_SOURCE_MODEL_INVALID');
  }
}

function requireSolverModelHash(value) {
  const copy = structuredClone(value);
  delete copy.solverModelHash;
  const expected = canonicalLafeaSha256({
    schema: 'lafea-continuum-solver-model-hash-input/v1',
    model: copy,
  });
  if (value.solverModelHash !== expected) {
    fail('LAFEA_CONTINUUM_COMPILED_SOLVER_MODEL_HASH_INVALID');
  }
}

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
