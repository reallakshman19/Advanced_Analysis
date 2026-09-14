/** Deterministic, non-executing LAFEA.3 domain-first solver-model compiler. */
import {
  createCanonicalLocalContinuumModel,
  validateCanonicalLocalContinuumModel,
} from '../core/local-continuum/index.js';
import { validateLafeaAnalysisGeometryEvidence } from './lafea-analysis-geometry-evidence.js';
import { validateLafeaAnalysisMeshEvidenceV2 } from './lafea-analysis-mesh-evidence-v2.js';
import { canonicalLafeaSha256 } from './lafea-canonical-sha256.js';
import { validateLafeaContinuumAnalysisDomain } from './lafea-continuum-analysis-domain.js';
import {
  createLafeaContinuumProjectionEvidence,
  validateLafeaContinuumProjectionEvidence,
} from './lafea-continuum-projection-evidence.js';
import { compileLafeaContinuumAttachmentTargets } from './lafea-continuum-solver-mapping.js';
import { requireLafeaStageAnalysisAdapter } from './lafea-stage-analysis-adapter.js';
import { sourceAuthorityDocument, validateLafeaSourceAuthority } from './lafea-source-authority.js';

export const LAFEA_CONTINUUM_SOLVER_MODEL_SCHEMA = 'lafea-continuum-solver-model/v1';
export const LAFEA_CONTINUUM_SOLVER_COMPILER_ID = 'LAFEA.3/DOMAIN_FIRST_SOLVER_COMPILER';
export const LAFEA_CONTINUUM_SOLVER_COMPILER_REVISION = '12B.2';

const STAGE_ID = 'LAFEA.3';

export function compileLafeaContinuumSolverModel(options) {
  const authority = validateLafeaSourceAuthority(options?.sourceAuthority);
  const source = requireObject(options?.source, 'LAFEA_CONTINUUM_SOLVER_SOURCE_REQUIRED');
  const canonical = validateCanonicalLocalContinuumModel(options?.canonicalInput);
  const rebuiltCanonical = createCanonicalLocalContinuumModel(source);
  if (canonicalLafeaSha256(rebuiltCanonical) !== canonicalLafeaSha256(canonical)) {
    fail('LAFEA_CONTINUUM_SOLVER_CANONICAL_INPUT_SOURCE_MISMATCH');
  }
  const geometryEvidence = validateLafeaAnalysisGeometryEvidence(options?.geometryEvidence);
  const domain = validateLafeaContinuumAnalysisDomain(
    options?.analysisDomain, geometryEvidence.geometry,
  );
  const meshEvidence = validateLafeaAnalysisMeshEvidenceV2(options?.meshEvidence);
  requireParentChain(authority, source, canonical, domain, geometryEvidence, meshEvidence);

  const adapter = requireLafeaStageAnalysisAdapter(STAGE_ID);
  const material = requireSingleRegionMaterial(canonical, domain);
  const thickness = requireUniformThickness(canonical);
  const attachmentTargets = compileLafeaContinuumAttachmentTargets({
    domain, geometry: geometryEvidence.geometry, mesh: meshEvidence.mesh,
  });
  const projectionEvidence = createLafeaContinuumProjectionEvidence({
    sourceHash: authority.sourceHash,
    analysisDomainHash: domain.semanticHash,
    analysisGeometryHash: geometryEvidence.analysisGeometryHash,
    meshArtifactHash: meshEvidence.artifactHash,
    meshHash: meshEvidence.meshHash,
    meshProfileHash: meshEvidence.meshProfileHash,
    domain,
    geometry: geometryEvidence.geometry,
    attachmentTargets,
  });
  validateLafeaContinuumProjectionEvidence(projectionEvidence);
  const targetMap = new Map(attachmentTargets.map((row) => [row.attachmentId, row.target]));
  const sectionId = `${domain.region.regionId}/UNIFORM_THICKNESS`;
  const base = freeze({
    schema: LAFEA_CONTINUUM_SOLVER_MODEL_SCHEMA,
    stageId: STAGE_ID,
    compilerId: LAFEA_CONTINUUM_SOLVER_COMPILER_ID,
    compilerRevision: LAFEA_CONTINUUM_SOLVER_COMPILER_REVISION,
    status: 'COMPILED',
    parents: compileParents(authority, canonical, domain, geometryEvidence, meshEvidence, projectionEvidence),
    projectionEvidence,
    formulation: canonical.formulation,
    units: freeze({ ...canonical.units.canonical }),
    declaredUnits: freeze({ ...canonical.units.declared }),
    coordinateSystemId: geometryEvidence.geometry.coordinateSystemId,
    sourceModel: compileSourceModel(canonical),
    dofPolicy: freeze({
      dofsPerNode: adapter.discretization.dofsPerNode,
      dofOrder: ['UX', 'UY'],
    }),
    materials: [compileMaterial(material)],
    sections: [freeze({
      sectionId, regionId: domain.region.regionId,
      kind: 'UNIFORM_THICKNESS', thickness,
      lengthUnit: canonical.units.canonical.length,
    })],
    nodes: compileNodes(meshEvidence),
    elements: compileElements(meshEvidence, domain, material.materialId, sectionId),
    physicalCases: domain.physicalCases.map((row) => freeze({ ...row })),
    attachments: domain.attachments.map((row) => compileAttachment(row, targetMap)),
    requestedCaseIds: [...canonical.resultRequests.loadCaseIds],
    qualificationProfile: freeze(structuredClone(canonical.qualificationProfile)),
    limitations: freeze([...new Set([
      ...canonical.limitations,
      'DOMAIN_FIRST_SINGLE_REGION_UNIFORM_THICKNESS_COMPILER_V1',
      'FEATURE_PROJECTION_HASH_CUSTODY_V1',
    ])].sort()),
    executionAuthorized: false,
    releaseQualified: false,
  });
  return freeze({
    ...base,
    solverModelHash: canonicalLafeaSha256({
      schema: 'lafea-continuum-solver-model-hash-input/v1', model: base,
    }),
  });
}

function requireParentChain(authority, source, canonical, domain, geometryEvidence, meshEvidence) {
  if (authority.stageId !== STAGE_ID || domain.stageId !== STAGE_ID
    || geometryEvidence.stageId !== STAGE_ID || meshEvidence.stageId !== STAGE_ID) {
    fail('LAFEA_CONTINUUM_SOLVER_STAGE_MISMATCH');
  }
  const expectedSourceHash = canonicalLafeaSha256({
    schema: 'lafea-source-authority-payload/v1', stageId: STAGE_ID,
    source: sourceAuthorityDocument(source),
  });
  if (authority.sourceHash !== expectedSourceHash
    || domain.sourceHash !== authority.sourceHash
    || geometryEvidence.sourceHash !== authority.sourceHash
    || meshEvidence.sourceHash !== authority.sourceHash) {
    fail('LAFEA_CONTINUUM_SOLVER_SOURCE_PARENT_STALE');
  }
  if (geometryEvidence.analysisDomainHash !== domain.semanticHash
    || meshEvidence.analysisDomainHash !== domain.semanticHash) {
    fail('LAFEA_CONTINUUM_SOLVER_DOMAIN_PARENT_STALE');
  }
  if (meshEvidence.analysisGeometryHash !== geometryEvidence.analysisGeometryHash) {
    fail('LAFEA_CONTINUUM_SOLVER_GEOMETRY_PARENT_STALE');
  }
  if (meshEvidence.status !== 'CURRENT' || meshEvidence.qualification !== 'PASS') {
    fail('LAFEA_CONTINUUM_SOLVER_MESH_NOT_CURRENT_PASS');
  }
  if (domain.formulation !== canonical.formulation) {
    fail('LAFEA_CONTINUUM_SOLVER_FORMULATION_MISMATCH');
  }
  requireLengthUnitBoundary(canonical, domain, geometryEvidence.geometry);
  const domainCases = domain.physicalCases.map((row) => row.caseId).sort();
  const canonicalCases = canonical.loadCases.map((row) => row.loadCaseId).sort();
  if (JSON.stringify(domainCases) !== JSON.stringify(canonicalCases)) {
    fail('LAFEA_CONTINUUM_SOLVER_PHYSICAL_CASE_MAPPING_REQUIRED');
  }
  for (const key of ['length', 'force', 'stress']) {
    if (domain.units[key] !== canonical.units.declared[key]) {
      fail('LAFEA_CONTINUUM_SOLVER_UNIT_SYSTEM_MISMATCH');
    }
  }
}

function requireLengthUnitBoundary(canonical, domain, geometry) {
  if (geometry.lengthUnit !== domain.units.length) {
    fail('LAFEA_CONTINUUM_SOLVER_GEOMETRY_UNIT_SYSTEM_MISMATCH');
  }
  if (geometry.lengthUnit !== canonical.units.canonical.length) {
    fail('LAFEA_CONTINUUM_SOLVER_NONCANONICAL_GEOMETRY_UNITS_UNSUPPORTED');
  }
}

function requireSingleRegionMaterial(canonical, domain) {
  const material = canonical.materials.find((row) => row.materialId === domain.region.materialRef);
  if (!material) fail('LAFEA_CONTINUUM_SOLVER_DOMAIN_MATERIAL_NOT_FOUND');
  if (canonical.elements.some((row) => row.materialId !== material.materialId)) {
    fail('LAFEA_CONTINUUM_SOLVER_MATERIAL_REGION_MAPPING_REQUIRED');
  }
  return material;
}

function requireUniformThickness(canonical) {
  const values = [...new Set(canonical.elements.map((row) => row.thickness))];
  if (values.length !== 1 || !(values[0] > 0)) {
    fail('LAFEA_CONTINUUM_SOLVER_SECTION_MAPPING_REQUIRED');
  }
  return values[0];
}

function compileParents(authority, canonical, domain, geometryEvidence, meshEvidence, projectionEvidence) {
  return freeze({
    sourceHash: authority.sourceHash,
    canonicalInputHash: canonicalLafeaSha256({
      schema: 'lafea-continuum-canonical-input-hash/v1', canonicalInput: canonical,
    }),
    localContinuumSemanticHash: canonical.semanticHash,
    analysisDomainHash: domain.semanticHash,
    analysisGeometryHash: geometryEvidence.analysisGeometryHash,
    meshArtifactHash: meshEvidence.artifactHash,
    meshHash: meshEvidence.meshHash,
    meshProfileHash: meshEvidence.meshProfileHash,
    projectionHash: projectionEvidence.projectionHash,
  });
}

function compileSourceModel(canonical) {
  return freeze({
    modelIdentity: canonical.modelIdentity,
    modelVersion: canonical.modelVersion,
    sourceAncestry: freeze({ ...canonical.sourceEvidence.sourceAncestry }),
    elementTypePolicy: freeze({ ...canonical.elementTypePolicy }),
  });
}

function compileMaterial(row) {
  return freeze({
    materialId: row.materialId,
    elasticModulus: row.elasticModulus,
    poissonRatio: row.poissonRatio,
    modulusUnit: row.canonicalUnit,
  });
}

function compileNodes(meshEvidence) {
  return meshEvidence.mesh.nodes.map((row) => {
    if (row.z !== 0) fail('LAFEA_CONTINUUM_SOLVER_NONPLANAR_MESH_NODE');
    return freeze({ nodeId: row.nodeId, x: row.x, y: row.y, z: 0 });
  });
}

function compileElements(meshEvidence, domain, materialId, sectionId) {
  return meshEvidence.mesh.elements.map((row) => freeze({
    elementId: row.elementId,
    elementType: row.elementType,
    nodeIds: [...row.nodeIds],
    regionId: domain.region.regionId,
    materialId,
    sectionId,
  }));
}

function compileAttachment(row, targetMap) {
  const target = targetMap.get(row.attachmentId);
  if (!target) fail('LAFEA_CONTINUUM_SOLVER_ATTACHMENT_MAPPING_MISSING');
  return freeze({
    attachmentId: row.attachmentId,
    kind: row.kind,
    targetType: row.targetType,
    targetId: row.targetId,
    physicalCaseIds: [...row.physicalCaseIds],
    payload: freeze(structuredClone(row.payload)),
    compiledTarget: target,
  });
}

function requireObject(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  return value;
}
function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.values(value).forEach(freeze); return Object.freeze(value); }
