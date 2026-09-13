/** Stage 13 lifecycle producer for authoritative domain-first LAFEA.3 execution. */
import {
  LAFEA_CONTINUUM_AUTHORITATIVE_EXECUTION_MODE,
  LAFEA_CONTINUUM_AUTHORITATIVE_EXECUTION_SCHEMA,
} from './lafea-continuum-compiled-execution.js';
import {
  createLafeaArtifactRecord,
  registerLafeaArtifact,
} from './lafea-lifecycle.js';
import { canonicalLafeaSha256 } from './lafea-canonical-sha256.js';
import { validateLafeaContinuumLoadResultantEvidence } from './lafea-continuum-load-resultant-evidence.js';
import {
  LAFEA_CONTINUUM_SOLVER_COMPILER_ID,
  LAFEA_CONTINUUM_SOLVER_COMPILER_REVISION,
  LAFEA_CONTINUUM_SOLVER_MODEL_SCHEMA,
} from './lafea-continuum-solver-model.js';
import { validateLafeaSourceAuthority } from './lafea-source-authority.js';

export const LAFEA_CONTINUUM_DOMAIN_FIRST_PRODUCER_SCHEMA =
  'lafea-continuum-domain-first-producer-batch/v1';
export const LAFEA_CONTINUUM_DOMAIN_FIRST_PRODUCER_REVISION = '13.2';

const STAGE_ID = 'LAFEA.3';
const ROUTE = 'DOMAIN_FIRST_COMPILED_SOLVER_MODEL';

export function createLafeaContinuumDomainFirstLifecycleProducerBatch(options) {
  const authority = validateLafeaSourceAuthority(options?.sourceAuthority);
  const solverModel = requireSolverModel(options?.solverModel);
  const execution = requireExecution(options?.execution, solverModel);
  if (authority.stageId !== STAGE_ID || authority.sourceHash !== solverModel.parents.sourceHash) {
    fail('LAFEA_CONTINUUM_DOMAIN_FIRST_SOURCE_AUTHORITY_MISMATCH');
  }

  const canonicalModelHash = solverModel.parents.canonicalInputHash;
  const analysisGeometryHash = solverModel.parents.analysisGeometryHash;
  const meshHash = solverModel.parents.meshHash;
  const meshProfileHash = solverModel.parents.meshProfileHash;
  const physicalLoadCaseHash = canonicalLafeaSha256({
    schema: 'lafea-continuum-domain-first-physical-cases-hash-input/v1',
    solverModelHash: solverModel.solverModelHash,
    physicalCases: solverModel.physicalCases,
    attachments: solverModel.attachments,
  });
  const solverProfileHash = canonicalLafeaSha256({
    schema: 'lafea-continuum-domain-first-solver-profile-hash-input/v1',
    compilerId: solverModel.compilerId,
    compilerRevision: solverModel.compilerRevision,
    formulation: solverModel.formulation,
    units: solverModel.units,
    dofPolicy: solverModel.dofPolicy,
  });
  const executionHash = execution.compiledExecutionHash;
  const recoveryProfileHash = canonicalLafeaSha256({
    schema: 'lafea-continuum-domain-first-recovery-profile-hash-input/v1',
    resultSchema: execution.result?.schema ?? null,
    formulation: solverModel.formulation,
    kernelRole: 'EXISTING_LOCAL_CONTINUUM_RECOVERY',
    producerRevision: LAFEA_CONTINUUM_DOMAIN_FIRST_PRODUCER_REVISION,
  });
  const recoveryHash = canonicalLafeaSha256({
    schema: 'lafea-continuum-domain-first-recovery-hash-input/v1',
    executionHash,
    meshHash,
    loadCaseResults: execution.result.loadCaseResults,
    formulaTrace: execution.result.formulaTrace,
  });
  const producerRef = [
    'STAGE13', STAGE_ID, solverModel.compilerId, solverModel.compilerRevision,
    LAFEA_CONTINUUM_DOMAIN_FIRST_PRODUCER_REVISION,
  ].join('/');
  const records = [
    record('CANONICAL_MODEL', canonicalModelHash, { sourceHash: authority.sourceHash }, producerRef),
    record('ANALYSIS_GEOMETRY', analysisGeometryHash, {
      sourceHash: authority.sourceHash, canonicalModelHash,
    }, producerRef),
    record('ANALYSIS_MESH', meshHash, { analysisGeometryHash, meshProfileHash }, producerRef),
    record('EXECUTION', executionHash, {
      canonicalModelHash, meshHash, physicalLoadCaseHash, solverProfileHash,
    }, producerRef),
    record('RECOVERY', recoveryHash, {
      executionHash, meshHash, recoveryProfileHash,
    }, producerRef),
  ];
  return freeze({
    schema: LAFEA_CONTINUUM_DOMAIN_FIRST_PRODUCER_SCHEMA,
    stageId: STAGE_ID,
    sourceHash: authority.sourceHash,
    solverModelHash: solverModel.solverModelHash,
    projectionHash: solverModel.parents.projectionHash,
    loadResultantEvidenceHash: execution.loadResultantEvidenceHash,
    calculationState: 'CALCULATION_ACCEPTED_BY_STAGE_CONTRACT',
    records,
    registrations: records.map((row) => ({
      registrationId: registrationId(row),
      kind: row.kind,
      artifactHash: row.artifactHash,
      producerRef: row.producerRef,
    })),
    convergenceProduced: false,
    codeAssessmentProduced: false,
    reportProduced: false,
    releaseQualified: false,
  });
}

export function registerLafeaContinuumDomainFirstLifecycleProducerBatch(
  lifecycleValue,
  batchValue,
) {
  const batch = requireBatch(batchValue);
  let lifecycle = lifecycleValue;
  if (lifecycle?.stageId !== batch.stageId
    || lifecycle?.source?.sourceHash !== batch.sourceHash) {
    fail('LAFEA_CONTINUUM_DOMAIN_FIRST_BATCH_LIFECYCLE_MISMATCH');
  }
  for (let index = 0; index < batch.records.length; index += 1) {
    lifecycle = registerLafeaArtifact(
      lifecycle,
      batch.records[index],
      batch.registrations[index].registrationId,
    );
  }
  return lifecycle;
}

function requireBatch(value) {
  if (!value || value.schema !== LAFEA_CONTINUUM_DOMAIN_FIRST_PRODUCER_SCHEMA
    || value.stageId !== STAGE_ID
    || !Array.isArray(value.records) || !Array.isArray(value.registrations)
    || value.records.length !== value.registrations.length
    || value.records.length !== 5
    || typeof value.projectionHash !== 'string'
    || typeof value.loadResultantEvidenceHash !== 'string') {
    fail('LAFEA_CONTINUUM_DOMAIN_FIRST_BATCH_INVALID');
  }
  return value;
}

function requireSolverModel(value) {
  if (!value || value.schema !== LAFEA_CONTINUUM_SOLVER_MODEL_SCHEMA
    || value.stageId !== STAGE_ID || value.status !== 'COMPILED'
    || value.compilerId !== LAFEA_CONTINUUM_SOLVER_COMPILER_ID
    || value.compilerRevision !== LAFEA_CONTINUUM_SOLVER_COMPILER_REVISION
    || value.executionAuthorized !== false || value.releaseQualified !== false) {
    fail('LAFEA_CONTINUUM_DOMAIN_FIRST_SOLVER_MODEL_INVALID');
  }
  const copy = structuredClone(value);
  delete copy.solverModelHash;
  const expected = canonicalLafeaSha256({
    schema: 'lafea-continuum-solver-model-hash-input/v1', model: copy,
  });
  if (value.solverModelHash !== expected) {
    fail('LAFEA_CONTINUUM_DOMAIN_FIRST_SOLVER_MODEL_HASH_INVALID');
  }
  return value;
}

function requireExecution(value, solverModel) {
  const parents = solverModel.parents ?? {};
  const resultantEvidence = validateLafeaContinuumLoadResultantEvidence(value?.loadResultantEvidence);
  if (!value || value.stageId !== STAGE_ID || value.status !== 'QUALIFIED'
    || value.route !== ROUTE || value.solverModelHash !== solverModel.solverModelHash
    || value.sourceHash !== parents.sourceHash
    || value.analysisDomainHash !== parents.analysisDomainHash
    || value.analysisGeometryHash !== parents.analysisGeometryHash
    || value.meshHash !== parents.meshHash
    || value.meshProfileHash !== parents.meshProfileHash
    || value.projectionHash !== parents.projectionHash
    || value.loadResultantEvidenceHash !== resultantEvidence.loadResultantEvidenceHash
    || resultantEvidence.parents.solverModelHash !== solverModel.solverModelHash
    || resultantEvidence.parents.projectionHash !== parents.projectionHash
    || value.releaseQualified !== false
    || typeof value.compiledExecutionHash !== 'string'
    || !/^sha256:[0-9a-f]{64}$/u.test(value.compiledExecutionHash)
    || !value.canonicalInput || typeof value.canonicalInput !== 'object'
    || value.result?.qualification?.state !== 'ACCEPTED'
    || !Array.isArray(value.result?.loadCaseResults) || !value.result.loadCaseResults.length
    || !Array.isArray(value.result?.formulaTrace)) {
    fail('LAFEA_CONTINUUM_DOMAIN_FIRST_EXECUTION_INVALID');
  }
  const canonicalExecutionInputHash = canonicalLafeaSha256({
    schema: 'lafea-continuum-compiled-execution-input-hash/v1',
    canonicalInput: value.canonicalInput,
  });
  const evidence = {
    schema: LAFEA_CONTINUUM_AUTHORITATIVE_EXECUTION_SCHEMA,
    stageId: STAGE_ID,
    mode: LAFEA_CONTINUUM_AUTHORITATIVE_EXECUTION_MODE,
    solverModelHash: solverModel.solverModelHash,
    projectionHash: parents.projectionHash,
    loadResultantEvidenceHash: resultantEvidence.loadResultantEvidenceHash,
    loadResultantEvidence: resultantEvidence,
    canonicalExecutionInputHash,
    qualificationState: 'ACCEPTED',
    canonicalInput: value.canonicalInput,
    executionResult: value.result,
    lifecyclePublicationAuthorized: true,
    releaseQualified: false,
  };
  const expected = canonicalLafeaSha256({
    schema: 'lafea-continuum-authoritative-execution-hash-input/v1', evidence,
  });
  if (value.compiledExecutionHash !== expected) {
    fail('LAFEA_CONTINUUM_DOMAIN_FIRST_EXECUTION_HASH_INVALID');
  }
  return value;
}

function record(kind, artifactHash, parentHashes, producerRef) {
  return createLafeaArtifactRecord({
    stageId: STAGE_ID,
    kind,
    status: 'CURRENT',
    artifactHash,
    parentHashes,
    qualification: 'PASS',
    producerRef,
    diagnostics: [],
  });
}

function registrationId(recordValue) {
  return `STAGE13-LAFEA-3-${recordValue.kind}-${recordValue.artifactHash.slice(7, 23).toUpperCase()}`;
}
function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
