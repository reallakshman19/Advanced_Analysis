import assert from 'node:assert/strict';
import {
  MODEL_SCHEMA,
  QUALIFICATION_PROFILE,
  calculateLocalContinuum,
  createCanonicalLocalContinuumModel,
} from '../../src/core/local-continuum/index.js';
import {
  canonicalProfile,
  defaultProfileFields,
  PROFILE_KINDS,
} from '../../src/core/lafea-profile-contract/index.js';
import { createLafeaAnalysisGeometry } from '../../src/workspace/lafea-analysis-geometry-contract.js';
import { createLafeaAnalysisGeometryEvidence } from '../../src/workspace/lafea-analysis-geometry-evidence.js';
import { createLafeaContinuumAnalysisDomain } from '../../src/workspace/lafea-continuum-analysis-domain.js';
import { evaluateLafeaContinuumPhysicalProbe } from '../../src/workspace/lafea-continuum-physical-probe.js';
import { canonicalLafeaSha256 } from '../../src/workspace/lafea-canonical-sha256.js';
import {
  b02dProfileIdentity,
  b02dProfileIdentityV2,
  lafeaMeshGenerationConfiguration,
  produceLafeaAnalysisMeshEvidence,
} from '../../src/workspace/lafea-mesh-producer-binding.js';
import { projectLafeaRuntimeSolverDiagnostics } from '../../src/workspace/lafea-runtime-solver-diagnostics.js';

const STAGE_ID = 'LAFEA.3';
const CASE_ID = 'LC1';
const PHYSICAL_PROBE_SCHEMA = 'lafea-continuum-physical-probe/v1';

/**
 * Execute one frozen B02D production level.
 *
 * `variant` selects the registered probe-stable polar mesh policy: 'V1'
 * (default, preserving every existing caller) or 'V2'. Only the mesh profile
 * identity, its source revision and the expected generator strategy differ -
 * geometry, loads, canonical source, solve and recovery are shared, so both
 * variants are qualified through exactly the same production route.
 */
export function executeB02dProductionLevel(definition, method, level, options = {}) {
  const variant = options.variant ?? 'V1';
  assert.ok(variant === 'V1' || variant === 'V2', `unsupported B02D mesh policy variant ${variant}`);
  requireDefinition(definition, method, level, variant);
  const sourceHash = canonicalLafeaSha256({
    schema: 'lafea-b02d-production-source-binding/v1',
    definition,
    method,
    levelId: level.levelId,
  });
  const geometry = annulusGeometry(definition);
  const meshStage = meshAuthorityStage(definition, sourceHash, geometry);
  const meshProfile = b02dMeshProfile(method, level.h, variant);
  const configuration = lafeaMeshGenerationConfiguration(meshProfile, {
    curvatureToleranceDegrees: level.curvatureToleranceDegrees,
  });
  const produced = produceLafeaAnalysisMeshEvidence(meshStage, configuration);
  assert.equal(produced.evidence.qualification, 'PASS');
  assert.equal(produced.evidence.releaseQualified, false);
  assert.equal(
    produced.planned.generated.strategy,
    variant === 'V2' ? 'B02D_PROBE_STABLE_POLAR_V2' : 'B02D_PROBE_STABLE_POLAR',
  );
  assert.equal(produced.evidence.mesh.elements.every((row) => row.elementType === method), true);

  const load = consistentFeatureResultant(
    produced.evidence.mesh,
    produced.planned.generated.featureMapping.loadEdges,
    definition.loadCase.resultant,
  );
  const restraintNodeIds = produced.planned.generated.featureMapping.restraintNodeIds;
  const source = canonicalSource(definition, method, produced.evidence.mesh, restraintNodeIds, load);
  const canonicalInput = createCanonicalLocalContinuumModel(source);
  const result = calculateLocalContinuum(canonicalInput);
  assert.equal(result.qualification.state, 'ACCEPTED');
  const resultCase = result.loadCaseResults.find((row) => row.loadCaseId === CASE_ID);
  assert.ok(resultCase, 'B02D LC1 result missing');

  const canonicalExecutionInputHash = canonicalLafeaSha256({
    schema: 'lafea-continuum-compiled-execution-input-hash/v1',
    canonicalInput,
  });
  const compiledExecutionHash = result.semanticHashes.executionEvidenceHash;
  const recoveryHash = canonicalLafeaSha256({
    schema: 'lafea-b02d-recovery-custody/v1',
    meshHash: produced.evidence.meshHash,
    executionHash: compiledExecutionHash,
    resultPayloadHash: result.semanticHashes.resultPayloadSemanticHash,
  });
  const execution = Object.freeze({
    stageId: STAGE_ID,
    status: 'QUALIFIED',
    route: 'B02D_REGISTERED_POLAR_MESH_CANONICAL_CONTINUUM_KERNEL',
    sourceHash,
    analysisDomainHash: meshStage.analysisDomainProjection.analysisDomainHash,
    analysisGeometryHash: meshStage.analysisGeometryProjection.analysisGeometryHash,
    meshHash: produced.evidence.meshHash,
    meshProfileHash: produced.evidence.meshProfileHash,
    solverModelHash: canonicalInput.semanticHash,
    canonicalExecutionInputHash,
    compiledExecutionHash,
    canonicalInput,
    result,
    releaseQualified: false,
  });
  const stage = Object.freeze({
    stageId: STAGE_ID,
    currentness: Object.freeze({
      currentAuthority: true,
      computationalState: 'CURRENT_RESULT',
    }),
    execution,
    analysisMeshCustodyProjection: Object.freeze({
      state: 'CURRENT_PASS',
      meshHash: produced.evidence.meshHash,
    }),
    lifecycle: Object.freeze({
      artifacts: Object.freeze({
        RECOVERY: Object.freeze({
          status: 'CURRENT',
          qualification: 'PASS',
          artifactHash: recoveryHash,
        }),
      }),
    }),
  });
  const runtimeSolverDiagnostics = projectLafeaRuntimeSolverDiagnostics(execution);
  const fixedProbes = definition.fixedProbes.map((probe) =>
    evaluateLafeaContinuumPhysicalProbe(stage, physicalProbe(probe)));
  const pathProbes = definition.fixedPath.stations.map((station) =>
    evaluateLafeaContinuumPhysicalProbe(stage, pathProbe(definition, station)));
  const energyReconstruction = reconstructMechanicalEnergy(result, resultCase);
  return Object.freeze({
    stage,
    meshEvidence: produced.evidence,
    meshGeneration: produced.planned.generated,
    load,
    resultCase,
    runtimeSolverDiagnostics,
    c3dCustody: incompleteB02dC3dCustody(stage, runtimeSolverDiagnostics),
    fixedProbes,
    pathProbes,
    energyReconstruction,
  });
}

function incompleteB02dC3dCustody(stage, runtimeSolverDiagnostics) {
  const execution = stage.execution;
  const recovery = stage.lifecycle?.artifacts?.RECOVERY;
  return Object.freeze({
    schema: 'lafea-b02-c3d-custody/v1',
    complete: false,
    reasonCode: 'B02D_GOVERNED_RUN_TRANSACTION_NOT_AVAILABLE',
    authority: 'BENCHMARK_LOCAL_CUSTODY_NOT_WORKBENCH_TRANSACTION_AUTHORITY',
    sourceHash: execution.sourceHash,
    analysisDomainHash: execution.analysisDomainHash,
    analysisGeometryHash: execution.analysisGeometryHash,
    meshProfileHash: execution.meshProfileHash,
    meshHash: execution.meshHash,
    projectionHash: null,
    solverModelHash: execution.solverModelHash,
    solverConfigHash: null,
    canonicalExecutionInputHash: execution.canonicalExecutionInputHash,
    executionHash: execution.compiledExecutionHash,
    runtimeDiagnosticsHash: runtimeSolverDiagnostics?.semanticHash ?? null,
    recoveryHash: recovery?.artifactHash ?? null,
    transaction: null,
    currentness: Object.freeze({
      computationalState: stage.currentness?.computationalState ?? null,
      currentAuthority: stage.currentness?.currentAuthority === true,
      exactCurrentParentChain: false,
      authority: 'BENCHMARK_LOCAL_NOT_C3D_CURRENTNESS_AUTHORITY',
    }),
    runtimeSolverDiagnostics,
  });
}

function meshAuthorityStage(definition, sourceHash, geometry) {
  const domain = createLafeaContinuumAnalysisDomain({
    schema: 'lafea-continuum-analysis-domain/v1',
    stageId: STAGE_ID,
    sourceHash,
    applicationRef: 'B02D/REGISTERED_POLAR_MESH_AUTHORITY',
    units: { length: 'mm', force: 'N', stress: 'MPa', temperature: 'C' },
    formulation: definition.formulation,
    region: { regionId: 'R1', materialRef: 'MAT' },
    physicalCases: [{ caseId: CASE_ID }],
    attachments: [],
  }, geometry);
  const geometryEvidence = createLafeaAnalysisGeometryEvidence({
    schema: 'lafea-analysis-geometry-evidence/v1',
    stageId: STAGE_ID,
    sourceHash,
    analysisDomain: domain,
    geometry,
    producerRef: 'B02D/REGISTERED_POLAR_MESH_AUTHORITY',
    profileId: 'LAFEA3_DOMAIN_FIRST_GEOMETRY_V1',
  });
  return Object.freeze({
    stageId: STAGE_ID,
    sourceAuthority: Object.freeze({ stageId: STAGE_ID, sourceHash }),
    retainedAnalysisGeometryEvidence: geometryEvidence,
    analysisDomainProjection: Object.freeze({
      state: 'CURRENT_PASS',
      analysisDomainHash: domain.semanticHash,
    }),
    analysisGeometryProjection: Object.freeze({
      state: 'CURRENT_PASS',
      analysisGeometryHash: geometry.semanticHash,
    }),
  });
}

function b02dMeshProfile(method, h, variant = 'V1') {
  const defaults = defaultProfileFields(PROFILE_KINDS.MESH);
  return canonicalProfile(PROFILE_KINDS.MESH, {
    schema: 'lafea-mesh-profile/v1',
    profileIdentity: variant === 'V2'
      ? b02dProfileIdentityV2(method, h)
      : b02dProfileIdentity(method, h),
    sourceRevision: variant === 'V2' ? 'B02D-FROZEN-POLAR-V2' : 'B02D-FROZEN-POLAR-V1',
    semanticHash: undefined,
    fields: {
      ...defaults,
      continuumElement: method,
      shellElement: 'CST_DKT_TRI3_THIN_SHELL_V1',
      globalTargetSize: h,
      adjacentSizeRatioMax: 1.5,
    },
  });
}

function canonicalSource(definition, method, mesh, restraintNodeIds, load) {
  return {
    schema: MODEL_SCHEMA,
    modelIdentity: `B02D_${method}_${mesh.meshIdentity}`,
    modelVersion: '1',
    sourceAncestry: {
      sourceModelIdentity: 'B02D-FROZEN-DEFINITION',
      sourceVersion: 'FROZEN-DEFINITION-V1',
      adapterIdentity: 'LAFEA_B02D_REGISTERED_POLAR_MESH_TO_CANONICAL_CONTINUUM',
      adapterVersion: '1',
    },
    units: { length: 'mm', force: 'N', stress: 'MPa', modulus: 'MPa' },
    formulation: definition.formulation,
    materials: [{
      materialId: 'MAT',
      elasticModulus: definition.material.elasticModulus,
      poissonRatio: definition.material.poissonRatio,
      sourceReference: 'B02D#FROZEN_MATERIAL',
    }],
    nodes: mesh.nodes.map((row) => ({
      nodeId: row.nodeId,
      x: row.x,
      y: row.y,
      sourceReference: `B02D_POLAR_MESH#${row.nodeId}`,
    })),
    elements: mesh.elements.map((row) => ({
      elementId: row.elementId,
      elementType: row.elementType,
      nodeIds: [...row.nodeIds],
      materialId: 'MAT',
      thickness: definition.geometry.thickness,
      sourceReference: `B02D_POLAR_MESH#${row.elementId}`,
    })),
    elementTypePolicy: {
      allowT3Fallback: method === 'T3',
      sourceReference: method === 'T3'
        ? 'B02D#T3_CONTROL_EXPLICIT_FALLBACK_ACKNOWLEDGED'
        : 'B02D#HIGH_ORDER_FAMILY_REQUIRED',
    },
    constraints: restraintNodeIds.flatMap((nodeId) => ['UX', 'UY'].map((dof) => ({
      constraintId: `B02D-REST/${nodeId}/${dof}`,
      nodeId,
      dof,
      value: 0,
      sourceReference: 'B02D#RADIAL_QUARTER_2_BOUNDARY_ZERO',
    }))),
    loadCases: [{
      loadCaseId: CASE_ID,
      nodalForces: load.nodalForces.map((row) => ({
        loadId: `B02D-LOAD/${row.nodeId}`,
        nodeId: row.nodeId,
        fx: row.fx,
        fy: row.fy,
        sourceReference: 'B02D#RADIAL_QUARTER_0_CONSISTENT_LINE_RESULTANT',
      })),
      edgeTractions: [],
      pressureLoads: [],
      bodyForces: [],
      temperatureLoads: [],
      imposedDisplacements: [],
      sourceReference: 'B02D#LC1_FROZEN_RESULTANT',
    }],
    resultRequests: { loadCaseIds: [CASE_ID] },
    qualificationProfile: structuredClone(QUALIFICATION_PROFILE),
    limitations: [
      'B02D_PROBE_STABLE_POLAR_BENCHMARK_ROUTE',
      'NO_GENERAL_INTERNAL_FEATURE_AUTHORING_AUTHORITY',
      'NO_RELEASE_AUTHORITY_FROM_SINGLE_BENCHMARK_RUN',
    ],
  };
}

function consistentFeatureResultant(mesh, edges, resultant) {
  if (!Array.isArray(edges) || !edges.length) throw new TypeError('LAFEA_B02D_LOAD_EDGES_REQUIRED');
  const nodeById = new Map(mesh.nodes.map((row) => [row.nodeId, row]));
  const segments = edges.map((edge) => {
    if (![2, 3].includes(edge.length)) throw new TypeError('LAFEA_B02D_LOAD_EDGE_ORDER_INVALID');
    const first = nodeById.get(edge[0]);
    const last = nodeById.get(edge.at(-1));
    if (!first || !last) throw new TypeError('LAFEA_B02D_LOAD_EDGE_NODE_MISSING');
    const length = Math.hypot(last.x - first.x, last.y - first.y);
    if (!(length > 0)) throw new TypeError('LAFEA_B02D_LOAD_EDGE_LENGTH_INVALID');
    return { edge, length };
  });
  const totalLength = segments.reduce((sum, row) => sum + row.length, 0);
  const forceByNode = new Map();
  for (const segment of segments) {
    const weights = segment.edge.length === 2 ? [0.5, 0.5] : [1 / 6, 4 / 6, 1 / 6];
    segment.edge.forEach((nodeId, index) => {
      const fraction = segment.length / totalLength * weights[index];
      const row = forceByNode.get(nodeId) ?? { nodeId, fx: 0, fy: 0 };
      row.fx += resultant.x * fraction;
      row.fy += resultant.y * fraction;
      forceByNode.set(nodeId, row);
    });
  }
  const nodalForces = [...forceByNode.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  const recovered = nodalForces.reduce((sum, row) => {
    const node = nodeById.get(row.nodeId);
    return {
      forceX: sum.forceX + row.fx,
      forceY: sum.forceY + row.fy,
      momentZ: sum.momentZ + node.x * row.fy - node.y * row.fx,
    };
  }, { forceX: 0, forceY: 0, momentZ: 0 });
  return Object.freeze({
    nodalForces: Object.freeze(nodalForces.map(Object.freeze)),
    totalLength,
    resultant: Object.freeze(recovered),
    distribution: 'CONSISTENT_UNIFORM_LINE_RESULTANT_T2_Q3_EDGE_V1',
  });
}

function reconstructMechanicalEnergy(result, loadCase) {
  const ordering = result.meshEvidence.dofOrdering;
  const displacementById = new Map(loadCase.nodalDisplacements.map((row) => [row.nodeId, row]));
  const vector = ordering.map((identity) => {
    const separator = identity.lastIndexOf(':');
    const nodeId = identity.slice(0, separator);
    const dof = identity.slice(separator + 1);
    const row = displacementById.get(nodeId);
    if (!row) throw new TypeError(`LAFEA_B02D_DISPLACEMENT_MISSING:${nodeId}`);
    return dof === 'UX' ? row.ux : row.uy;
  });
  const ku = stiffnessVector(result.meshEvidence, vector);
  const reconstructed = 0.5 * vector.reduce((sum, value, index) => sum + value * ku[index], 0);
  return Object.freeze({
    recoveredStrainEnergy: loadCase.totalStrainEnergy,
    stiffnessReconstruction: reconstructed,
    relativeResidual: Math.abs(reconstructed - loadCase.totalStrainEnergy)
      / Math.max(1, Math.abs(reconstructed), Math.abs(loadCase.totalStrainEnergy)),
  });
}

function stiffnessVector(meshEvidence, vector) {
  if (Array.isArray(meshEvidence.globalStiffnessMatrix)) {
    return meshEvidence.globalStiffnessMatrix.map((row) =>
      row.reduce((sum, value, index) => sum + value * vector[index], 0));
  }
  const matrix = meshEvidence.globalStiffnessCsr;
  if (!matrix || !Array.isArray(matrix.rowPointers) || !Array.isArray(matrix.columnIndices)
    || !Array.isArray(matrix.values)) {
    throw new TypeError('LAFEA_B02D_STIFFNESS_EVIDENCE_MISSING');
  }
  const output = Array(vector.length).fill(0);
  for (let row = 0; row < vector.length; row += 1) {
    for (let offset = matrix.rowPointers[row]; offset < matrix.rowPointers[row + 1]; offset += 1) {
      output[row] += matrix.values[offset] * vector[matrix.columnIndices[offset]];
    }
  }
  return output;
}

function physicalProbe(probe) {
  return {
    schema: PHYSICAL_PROBE_SCHEMA,
    probeId: probe.probeId,
    physicalCoordinate: structuredClone(probe.physicalCoordinate),
    coordinateFrame: probe.coordinateFrame,
    loadCaseId: probe.loadCaseId,
    quantityId: probe.quantityId,
    representation: probe.representation,
    recoveryMethod: probe.recoveryMethod,
    units: probe.units,
    singularityClassification: probe.singularityClassification,
  };
}

function pathProbe(definition, station) {
  return {
    schema: PHYSICAL_PROBE_SCHEMA,
    probeId: `${definition.fixedPath.pathId}/${station.stationId}`,
    physicalCoordinate: structuredClone(station.physicalCoordinate),
    coordinateFrame: 'GLOBAL_XY',
    loadCaseId: CASE_ID,
    quantityId: definition.fixedPath.quantityId,
    representation: 'PHYSICAL_POINT_DIRECT',
    recoveryMethod: 'ELEMENT_LOCAL_DIRECT_DISPLACEMENT_GRADIENT',
    units: 'MPa',
    singularityClassification: station.singularityClassification,
  };
}

function annulusGeometry(definition) {
  const { holeRadius: a, outerRadius: r } = definition.geometry;
  return createLafeaAnalysisGeometry({
    schema: 'lafea-analysis-geometry/v1',
    stageId: STAGE_ID,
    geometryId: 'B02D-ANNULUS',
    coordinateSystemId: 'GLOBAL_XY',
    lengthUnit: 'mm',
    orientationPolicy: 'OUTER_CCW_HOLES_CW_V1',
    vertices: [
      vertex('OE', r, 0), vertex('ON', 0, r), vertex('OW', -r, 0), vertex('OS', 0, -r),
      vertex('HE', a, 0), vertex('HN', 0, a), vertex('HW', -a, 0), vertex('HS', 0, -a),
    ],
    segments: [
      arc('O1', 'OE', 'ON', r, 'CCW'), arc('O2', 'ON', 'OW', r, 'CCW'),
      arc('O3', 'OW', 'OS', r, 'CCW'), arc('O4', 'OS', 'OE', r, 'CCW'),
      arc('H1', 'HE', 'HS', a, 'CW'), arc('H2', 'HS', 'HW', a, 'CW'),
      arc('H3', 'HW', 'HN', a, 'CW'), arc('H4', 'HN', 'HE', a, 'CW'),
    ],
    loops: [
      { loopId: 'OUTER', role: 'OUTER', segmentIds: ['O1', 'O2', 'O3', 'O4'] },
      { loopId: 'HOLE', role: 'HOLE', segmentIds: ['H1', 'H2', 'H3', 'H4'] },
    ],
  });
}

function requireDefinition(definition, method, level, variant = 'V1') {
  assert.equal(definition.caseId, variant === 'V2' ? 'B02D-V2' : 'B02D');
  assert.equal(definition.definitionState, 'FROZEN_BEFORE_PRODUCTION_OBSERVATION');
  assert.equal(definition.productionOutputUsedToChooseDefinition, false);
  assert.ok(['T3', 'T6', 'Q8'].includes(method));
  assert.ok(definition.globalResponseLadder.levels.some((row) => row.levelId === level.levelId && row.h === level.h));
  assert.deepEqual(definition.globalResponseLadder.commonRequestPolicy.refinementFeatureIds, []);
}
function vertex(vertexId, x, y) { return { vertexId, x, y }; }
function arc(segmentId, startVertexId, endVertexId, radius, sweep) {
  return { segmentId, type: 'CIRCULAR_ARC', startVertexId, endVertexId, centerX: 0, centerY: 0, radius, sweep };
}
