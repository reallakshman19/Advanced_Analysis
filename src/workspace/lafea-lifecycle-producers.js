/**
 * Current-core lifecycle evidence producers for NB-T2.
 *
 * The adapters translate already-accepted workbench calculations into exact
 * profile-authorized lifecycle records. They do not run numerical kernels,
 * generate meshes, infer convergence, assess code or qualify release.
 * Product-level foundation and applicability evidence is produced separately.
 */
import {
  createLafeaArtifactRecord,
  registerLafeaArtifact,
} from './lafea-lifecycle.js';
import { requireLafeaLifecycleProfileForStage } from './lafea-lifecycle-profiles.js';
import { requireLafeaStageRegistryEntry } from './lafea-stage-registry.js';
import { canonicalLafeaSha256 } from './lafea-canonical-sha256.js';
import { lafeaAnalysisMeshContentHash } from './lafea-analysis-mesh-contract.js';
import { createLafeaContinuumGeometryProjection } from './lafea-continuum-geometry-projection.js';
import { createLafeaContinuumSourceAnalysisMesh } from './lafea-continuum-source-mesh.js';
import {
  sourceAuthorityDocument,
  validateLafeaSourceAuthority,
} from './lafea-source-authority.js';

export const LAFEA_PRODUCER_BATCH_SCHEMA = 'lafea-lifecycle-producer-batch/v1';
export const LAFEA_PRODUCER_REVISION = 'NB-T2.1';

const SHELL_COMPILED_ROUTE = 'SHELL_RETAINED_MESH_COMPILED_SOLVER_MODEL';

export function createLafeaLifecycleProducerBatch(options) {
  const stageId = options?.stageId;
  const stage = requireLafeaStageRegistryEntry(stageId);
  const profile = requireLafeaLifecycleProfileForStage(stageId);
  const authority = validateLafeaSourceAuthority(options?.sourceAuthority);
  const execution = options?.execution;
  if (authority.stageId !== stageId) throw producerError('LAFEA_PRODUCER_SOURCE_STAGE_MISMATCH');
  if (stage.engineState === 'ENGINE_NOT_IMPLEMENTED') {
    throw producerError('LAFEA_PRODUCER_STAGE_ENGINE_NOT_IMPLEMENTED');
  }
  if (!execution || execution.stageId !== stageId || execution.status !== 'QUALIFIED'
    || !acceptedByStageContract(stageId, execution.result)) {
    throw producerError('LAFEA_PRODUCER_CALCULATION_NOT_ACCEPTED');
  }
  if (!execution.source || !execution.canonicalInput || !execution.result) {
    throw producerError('LAFEA_PRODUCER_EXECUTION_EVIDENCE_INCOMPLETE');
  }
  const expectedAuthority = canonicalLafeaSha256({
    schema: 'lafea-source-authority-payload/v1',
    stageId,
    source: sourceAuthorityDocument(execution.source),
  });
  if (expectedAuthority !== authority.sourceHash) {
    throw producerError('LAFEA_PRODUCER_SOURCE_AUTHORITY_MISMATCH');
  }

  const records = profile.meshApplicable
    ? feaRecords(stage, profile, authority, execution)
    : analyticalRecords(stage, profile, authority, execution);
  return deepFreeze({
    schema: LAFEA_PRODUCER_BATCH_SCHEMA,
    stageId,
    profileId: profile.profileId,
    sourceHash: authority.sourceHash,
    calculationState: 'CALCULATION_ACCEPTED_BY_STAGE_CONTRACT',
    records,
    registrations: records.map((record) => ({
      registrationId: registrationId(record),
      kind: record.kind,
      artifactHash: record.artifactHash,
      producerRef: record.producerRef,
    })),
    convergenceProduced: false,
    codeAssessmentProduced: false,
    reportProduced: false,
    releaseQualified: false,
  });
}

export function registerLafeaLifecycleProducerBatch(lifecycleValue, batchValue) {
  const batch = validateBatch(batchValue);
  let lifecycle = lifecycleValue;
  if (lifecycle.stageId !== batch.stageId || lifecycle.profileId !== batch.profileId
    || lifecycle.source.sourceHash !== batch.sourceHash) {
    throw producerError('LAFEA_PRODUCER_BATCH_LIFECYCLE_MISMATCH');
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

function analyticalRecords(stage, profile, authority, execution) {
  const producerRef = producerReference(stage, profile);
  const sourceHash = authority.sourceHash;
  const canonicalModelHash = engineeringHash(stage.stageId, 'CANONICAL_MODEL', {
    sourceHash,
    canonicalInput: execution.canonicalInput,
  });
  const physicalLoadCaseHash = engineeringHash(stage.stageId, 'PHYSICAL_LOAD_CASE_INPUT',
    physicalLoadPayload(stage.stageId, execution.canonicalInput));
  const solverProfileHash = engineeringHash(stage.stageId, 'SOLVER_PROFILE', {
    enginePackage: stage.enginePackage,
    authority: stage.authority,
    producerRevision: LAFEA_PRODUCER_REVISION,
  });
  const executionHash = engineeringHash(stage.stageId, 'EXECUTION', {
    canonicalModelHash,
    physicalLoadCaseHash,
    solverProfileHash,
    acceptedExecutionEvidence: executionEvidence(stage.stageId, execution.result),
  });
  const resultProfileHash = engineeringHash(stage.stageId, 'RESULT_PROFILE', {
    resultContractRole: stage.resultContractRole,
    presenterRole: stage.presenterRole,
    producerRevision: LAFEA_PRODUCER_REVISION,
  });
  const resultEvidenceHash = engineeringHash(stage.stageId, 'RESULT_EVIDENCE', {
    canonicalModelHash,
    executionHash,
    resultProfileHash,
    result: execution.result,
  });
  return [
    record(stage.stageId, 'CANONICAL_MODEL', canonicalModelHash, { sourceHash }, producerRef),
    record(stage.stageId, 'EXECUTION', executionHash, {
      canonicalModelHash, physicalLoadCaseHash, solverProfileHash,
    }, producerRef),
    record(stage.stageId, 'RESULT_EVIDENCE', resultEvidenceHash, {
      canonicalModelHash, executionHash, resultProfileHash,
    }, producerRef),
  ];
}

function feaRecords(stage, profile, authority, execution) {
  if ((stage.stageId === 'LAFEA.4' || stage.stageId === 'LAFEA.5')
    && execution.route === SHELL_COMPILED_ROUTE) {
    return governedShellFeaRecords(stage, profile, authority, execution);
  }

  const producerRef = producerReference(stage, profile);
  const sourceHash = authority.sourceHash;
  const canonicalModelHash = engineeringHash(stage.stageId, 'CANONICAL_MODEL', {
    sourceHash,
    canonicalInput: execution.canonicalInput,
  });
  const sourceMesh = requireSourceAuthoredMesh(stage.stageId, execution.source);
  const analysisGeometryHash = geometryArtifactHash(
    stage.stageId,
    sourceHash,
    canonicalModelHash,
    sourceMesh,
    execution.canonicalInput,
  );
  const meshProfileHash = engineeringHash(stage.stageId, 'ANALYSIS_MESH_PROFILE', {
    authority: 'CALLER_AUTHORED_SOURCE_MESH_ONLY',
    previewPolicy: stage.previewPolicy,
    meshConfigIncluded: false,
    renderPacketIncluded: false,
    producerRevision: LAFEA_PRODUCER_REVISION,
  });
  const retainedMeshEvidence = requireRetainedMeshEvidence(stage.stageId, execution.result);
  const meshHash = meshArtifactHash(
    stage.stageId,
    analysisGeometryHash,
    meshProfileHash,
    sourceMesh,
    retainedMeshEvidence,
    execution.canonicalInput,
  );
  const physicalLoadCaseHash = engineeringHash(stage.stageId, 'PHYSICAL_LOAD_CASE_INPUT',
    physicalLoadPayload(stage.stageId, execution.canonicalInput));
  const solverProfileHash = engineeringHash(stage.stageId, 'SOLVER_PROFILE', {
    enginePackage: stage.enginePackage,
    authority: stage.authority,
    producerRevision: LAFEA_PRODUCER_REVISION,
  });
  const executionHash = engineeringHash(stage.stageId, 'EXECUTION', {
    canonicalModelHash,
    meshHash,
    physicalLoadCaseHash,
    solverProfileHash,
    acceptedExecutionEvidence: executionEvidence(stage.stageId, execution.result),
  });
  const recoveryProfileHash = engineeringHash(stage.stageId, 'RECOVERY_PROFILE', {
    resultContractRole: stage.resultContractRole,
    authority: stage.authority,
    producerRevision: LAFEA_PRODUCER_REVISION,
  });
  const recoveryEvidence = requireRecoveryEvidence(stage.stageId, execution.result);
  const recoveryHash = engineeringHash(stage.stageId, 'RECOVERY', {
    executionHash,
    meshHash,
    recoveryProfileHash,
    retainedAcceptedRecoveryEvidence: recoveryEvidence,
  });
  return [
    record(stage.stageId, 'CANONICAL_MODEL', canonicalModelHash, { sourceHash }, producerRef),
    record(stage.stageId, 'ANALYSIS_GEOMETRY', analysisGeometryHash, {
      sourceHash, canonicalModelHash,
    }, producerRef),
    record(stage.stageId, 'ANALYSIS_MESH', meshHash, {
      analysisGeometryHash, meshProfileHash,
    }, producerRef),
    record(stage.stageId, 'EXECUTION', executionHash, {
      canonicalModelHash, meshHash, physicalLoadCaseHash, solverProfileHash,
    }, producerRef),
    record(stage.stageId, 'RECOVERY', recoveryHash, {
      executionHash, meshHash, recoveryProfileHash,
    }, producerRef),
  ];
}

function governedShellFeaRecords(stage, profile, authority, execution) {
  const producerRef = `${producerReference(stage, profile)}/GOVERNED-SHELL-COMPILED-V1`;
  const sourceHash = authority.sourceHash;
  for (const [field, value] of Object.entries({
    sourceHash: execution.sourceHash,
    analysisDomainHash: execution.analysisDomainHash,
    analysisGeometryHash: execution.analysisGeometryHash,
    meshHash: execution.meshHash,
    solverModelHash: execution.solverModelHash,
    solverModelBindingHash: execution.solverModelBindingHash,
    executionMeshBindingHash: execution.executionMeshBindingHash,
    compiledExecutionHash: execution.compiledExecutionHash,
  })) {
    if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
      throw producerError(`LAFEA_SHELL_COMPILED_${field.toUpperCase()}_INVALID`);
    }
  }
  const meshProfileSemanticHash = execution.meshProfileHash;
  if (typeof meshProfileSemanticHash !== 'string'
    || !/^fnv1a64:[0-9a-f]{16}$/u.test(meshProfileSemanticHash)) {
    throw producerError('LAFEA_SHELL_COMPILED_MESHPROFILEHASH_INVALID');
  }
  if (execution.sourceHash !== sourceHash) {
    throw producerError('LAFEA_SHELL_COMPILED_SOURCE_AUTHORITY_MISMATCH');
  }
  const canonicalModelHash = engineeringHash(stage.stageId, 'CANONICAL_MODEL', {
    sourceHash,
    canonicalInput: execution.canonicalInput,
  });
  const analysisGeometryHash = execution.analysisGeometryHash;
  // Lifecycle parent hashes are SHA-256 by contract, while the governed mesh
  // profile owns an FNV-1a semantic identity. Preserve the native profile
  // identity inside a deterministic lifecycle-owned SHA-256 wrapper rather
  // than coercing or reinterpreting either hash domain.
  const meshProfileHash = engineeringHash(stage.stageId, 'ANALYSIS_MESH_PROFILE', {
    authority: 'RETAINED_GOVERNED_MESH_PROFILE',
    meshProfileSemanticHash,
    producerRevision: LAFEA_PRODUCER_REVISION,
  });
  const meshHash = execution.meshHash;
  const physicalLoadCaseHash = engineeringHash(stage.stageId, 'PHYSICAL_LOAD_CASE_INPUT',
    physicalLoadPayload(stage.stageId, execution.canonicalInput));
  // FEA_MESH_RECOVERY_V1 has an exact parent-key contract. Solver-model and
  // execution-mesh binding identities are therefore retained inside these
  // opaque profile hashes, not appended as unauthorized parent keys.
  const solverProfileHash = engineeringHash(stage.stageId, 'SOLVER_PROFILE', {
    enginePackage: stage.enginePackage,
    authority: stage.authority,
    producerRevision: LAFEA_PRODUCER_REVISION,
    route: execution.route,
    solverModelHash: execution.solverModelHash,
    solverModelBindingHash: execution.solverModelBindingHash,
    executionMeshBindingHash: execution.executionMeshBindingHash,
  });
  const executionHash = execution.compiledExecutionHash;
  const recoveryProfileHash = engineeringHash(stage.stageId, 'RECOVERY_PROFILE', {
    resultContractRole: stage.resultContractRole,
    authority: stage.authority,
    producerRevision: LAFEA_PRODUCER_REVISION,
    route: execution.route,
    solverModelHash: execution.solverModelHash,
    executionMeshBindingHash: execution.executionMeshBindingHash,
  });
  const recoveryEvidence = requireRecoveryEvidence(stage.stageId, execution.result);
  const recoveryHash = engineeringHash(stage.stageId, 'RECOVERY', {
    executionHash,
    meshHash,
    recoveryProfileHash,
    retainedAcceptedRecoveryEvidence: recoveryEvidence,
  });
  return [
    record(stage.stageId, 'CANONICAL_MODEL', canonicalModelHash, { sourceHash }, producerRef),
    record(stage.stageId, 'ANALYSIS_GEOMETRY', analysisGeometryHash, {
      sourceHash, canonicalModelHash,
    }, producerRef),
    record(stage.stageId, 'ANALYSIS_MESH', meshHash, {
      analysisGeometryHash, meshProfileHash,
    }, producerRef),
    record(stage.stageId, 'EXECUTION', executionHash, {
      canonicalModelHash,
      meshHash,
      physicalLoadCaseHash,
      solverProfileHash,
    }, producerRef),
    record(stage.stageId, 'RECOVERY', recoveryHash, {
      executionHash,
      meshHash,
      recoveryProfileHash,
    }, producerRef),
  ];
}

function geometryArtifactHash(stageId, sourceHash, canonicalModelHash, sourceMesh, canonicalInput) {
  if (stageId === 'LAFEA.3') {
    return createLafeaContinuumGeometryProjection(canonicalInput).semanticHash;
  }
  return engineeringHash(stageId, 'ANALYSIS_GEOMETRY', {
    sourceHash,
    canonicalModelHash,
    geometry: sourceGeometry(stageId, sourceMesh),
  });
}

function meshArtifactHash(
  stageId,
  analysisGeometryHash,
  meshProfileHash,
  sourceMesh,
  retainedMeshEvidence,
  canonicalInput,
) {
  if (stageId === 'LAFEA.3') {
    return lafeaAnalysisMeshContentHash(
      createLafeaContinuumSourceAnalysisMesh(canonicalInput),
    );
  }
  return engineeringHash(stageId, 'ANALYSIS_MESH', {
    analysisGeometryHash,
    meshProfileHash,
    sourceMesh,
    retainedAcceptedMeshEvidence: retainedMeshEvidence,
    canonicalInput,
  });
}

function record(stageId, kind, artifactHash, parentHashes, producerRef) {
  return createLafeaArtifactRecord({
    stageId,
    kind,
    status: 'CURRENT',
    artifactHash,
    parentHashes,
    qualification: 'PASS',
    producerRef,
    diagnostics: [],
  });
}

function engineeringHash(stageId, role, payload) {
  return canonicalLafeaSha256({
    schema: 'lafea-engineering-evidence-hash-input/v1',
    stageId,
    role,
    payload,
  });
}

function producerReference(stage, profile) {
  return `NB-T2/${stage.stageId}/${stage.enginePackage}/${profile.profileId}/${LAFEA_PRODUCER_REVISION}`;
}

function registrationId(recordValue) {
  return `NB-T2-${recordValue.stageId.replace('.', '-')}-${recordValue.kind}-${recordValue.artifactHash.slice(7, 23).toUpperCase()}`;
}

function physicalLoadPayload(stageId, input) {
  if (stageId === 'LAFEA.2') return {
    screeningCases: input.screeningCases,
    evaluationLocations: input.evaluationLocations,
  };
  if (stageId === 'LAFEA.5') return {
    loadCaseMappings: input.loadCaseMappings ?? input.canonicalLoadCaseMappings,
    attachmentEvidenceHash: input.acceptedAttachmentEvidenceHash ?? null,
  };
  return { loadCases: input.loadCases ?? null, resultRequests: input.resultRequests ?? null };
}

function requireSourceAuthoredMesh(stageId, source) {
  const mesh = stageId === 'LAFEA.5' ? source.shellTemplate : source;
  if (!mesh || !Array.isArray(mesh.nodes) || !mesh.nodes.length
    || !Array.isArray(mesh.elements) || !mesh.elements.length) {
    throw producerError('LAFEA_SOURCE_AUTHORED_ANALYSIS_MESH_REQUIRED');
  }
  const value = structuredClone(mesh);
  delete value.meshConfig;
  return value;
}

function sourceGeometry(stageId, sourceMesh) {
  return {
    stageId,
    nodes: sourceMesh.nodes,
    elements: sourceMesh.elements,
  };
}

function requireRetainedMeshEvidence(stageId, result) {
  const value = stageId === 'LAFEA.5'
    ? {
      generatedShellModel: result.generatedShellModel ?? null,
      rawShellMeshEvidence: result.rawShellResult?.meshEvidence ?? null,
      footprintGeometryEvidence: result.footprintGeometryEvidence ?? null,
    }
    : result.meshEvidence;
  if (!value || (stageId !== 'LAFEA.5' && typeof value !== 'object')) {
    throw producerError('LAFEA_RETAINED_ACCEPTED_MESH_EVIDENCE_REQUIRED');
  }
  return value;
}

function requireRecoveryEvidence(stageId, result) {
  const value = stageId === 'LAFEA.5'
    ? {
      loadCaseResults: result.loadCaseResults,
      assessmentRegionResults: result.assessmentRegionResults,
      rawShellLoadCaseResults: result.rawShellResult?.loadCaseResults ?? null,
    }
    : { loadCaseResults: result.loadCaseResults };
  if (!Array.isArray(value.loadCaseResults) || !value.loadCaseResults.length) {
    throw producerError('LAFEA_RETAINED_ACCEPTED_RECOVERY_EVIDENCE_REQUIRED');
  }
  return value;
}

function executionEvidence(stageId, result) {
  if (stageId === 'LAFEA.1') return {
    coordinateSystemEvidence: result.coordinateSystemEvidence,
    transformedLoadCases: result.transformedLoadCases,
    pressureStressResults: result.pressureStressResults,
    formulaTrace: result.formulaTrace,
  };
  if (stageId === 'LAFEA.2') return {
    sectionProperties: result.sectionProperties,
    screeningCases: result.screeningCases,
    pointStressStates: result.pointStressStates,
    formulaTrace: result.formulaTrace,
  };
  if (stageId === 'LAFEA.5') return {
    footprintGeometryEvidence: result.footprintGeometryEvidence,
    loadDistributionEvidence: result.loadDistributionEvidence,
    canonicalShellModelHash: result.canonicalShellModelHash,
    shellResultHash: result.shellResultHash,
    formulaTrace: result.formulaTrace,
  };
  return {
    meshEvidence: result.meshEvidence,
    loadCaseResults: result.loadCaseResults,
    formulaTrace: result.formulaTrace,
  };
}

function acceptedByStageContract(stageId, result) {
  if (stageId === 'LAFEA.4' || stageId === 'LAFEA.5') {
    return result?.qualification?.accepted === true;
  }
  return result?.qualification?.state === 'ACCEPTED';
}

function validateBatch(value) {
  if (!value || value.schema !== LAFEA_PRODUCER_BATCH_SCHEMA
    || !Array.isArray(value.records) || !Array.isArray(value.registrations)
    || value.records.length !== value.registrations.length) {
    throw producerError('LAFEA_PRODUCER_BATCH_INVALID');
  }
  return value;
}

function producerError(code) {
  const error = new TypeError(code);
  error.code = code;
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
