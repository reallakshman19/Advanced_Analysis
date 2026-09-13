import assert from 'node:assert/strict';
import { MODEL_SCHEMA, QUALIFICATION_PROFILE } from '../../src/core/local-continuum/index.js';
import {
  canonicalProfile,
  defaultProfileFields,
  PROFILE_KINDS,
} from '../../src/core/lafea-profile-contract/index.js';
import {
  LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_PROFILE,
  LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_SCHEMA,
  createLafeaAnalysisGeometryEvidence,
} from '../../src/workspace/lafea-analysis-geometry-evidence.js';
import {
  LAFEA_ANALYSIS_GEOMETRY_ORIENTATION_POLICY,
  LAFEA_ANALYSIS_GEOMETRY_SCHEMA,
  createLafeaAnalysisGeometry,
} from '../../src/workspace/lafea-analysis-geometry-contract.js';
import {
  LAFEA_CONTINUUM_ANALYSIS_DOMAIN_SCHEMA,
  createLafeaContinuumAnalysisDomain,
} from '../../src/workspace/lafea-continuum-analysis-domain.js';
import { issueLafeaSourceAuthority } from '../../src/workspace/lafea-source-authority.js';
import { requireLafeaStageComposition } from '../../src/workspace/lafea-stage-composition-root.js';
import { createLafeaWorkbenchStore } from '../../src/workspace/lafea-workbench.js';
import {
  b02cGradedPolarProfileIdentity,
  LAFEA_B02C_GRADED_POLAR_PROFILE_SOURCE_REVISION,
} from '../../src/workspace/lafea-mesh-producer-binding.js';

const STAGE_ID = 'LAFEA.3';
const PHYSICAL_PROBE_SCHEMA = 'lafea-continuum-physical-probe/v1';

export function executeB02KirschProductionLevel(definition, method, level) {
  requireDefinition(definition);
  const source = requireLafeaStageComposition(STAGE_ID).normalizeDocument(
    sourceDocument(definition, method),
  );
  const authority = issueLafeaSourceAuthority(
    STAGE_ID, source, `${definition.caseId}/PRODUCTION_ROUTE/${method}/${level.levelId}`,
  );
  const geometry = quarterAnnulusGeometry(definition);
  const domain = kirschDomain(definition, authority.sourceHash, geometry);
  const geometryEvidence = createLafeaAnalysisGeometryEvidence({
    schema: LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_SCHEMA,
    stageId: STAGE_ID,
    sourceHash: authority.sourceHash,
    analysisDomain: domain,
    geometry,
    producerRef: `${definition.caseId}/FROZEN_QUARTER_ANNULUS_GEOMETRY`,
    profileId: LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_PROFILE,
  });
  const store = createLafeaWorkbenchStore({
    initialStage: STAGE_ID,
    initialDocument: source,
    initialSourceHash: authority.sourceHash,
  });
  try {
    store.activateDomainFirstProfile();
    assert.equal(store.registerAnalysisDomain(domain).projection.state, 'CURRENT_PASS');
    assert.equal(store.registerAnalysisGeometryEvidence(geometryEvidence).projection.state, 'CURRENT_PASS');
    store.bindAnalysisMeshProfile(meshProfile(definition, method, level));
    const generated = store.generateAnalysisMesh();
    assert.equal(generated?.evidence?.qualification, 'PASS');
    assert.equal(generated.evidence.mesh.elements.every((row) => row.elementType === method), true);
    assertCircularBoundary(generated.evidence.mesh, definition);
    const preflight = store.prepareContinuumForRun();
    assert.equal(preflight.projection.state, 'CURRENT_PASS');
    store.run();
    const stage = store.getState().stages[STAGE_ID];
    assert.equal(stage.execution?.status, 'QUALIFIED');
    assert.equal(stage.execution?.result?.qualification?.state, 'ACCEPTED');
    assert.ok(stage.execution.canonicalInput.limitations.includes(
      'ANALYTICAL_TRACTION_CONSISTENT_NODAL_LOWERING_V1',
    ));
    return {
      stage,
      probes: definition.fixedProbes.map((probe) => store.evaluateContinuumPhysicalProbe(stripAcceptance(probe))),
      meshEvidence: generated.evidence,
    };
  } finally {
    store.destroy();
  }
}

function sourceDocument(definition, method) {
  const t = definition.geometry.thickness;
  const caseId = definition.loadCase.loadCaseId;
  return {
    schema: MODEL_SCHEMA,
    modelIdentity: `${definition.caseId}_DOMAIN_FIRST_SOURCE_${method}`,
    modelVersion: '1',
    sourceAncestry: {
      sourceModelIdentity: definition.caseId,
      sourceVersion: 'FROZEN_DEFINITION_V1',
      adapterIdentity: 'LAFEA_B02_KIRSCH_PRODUCTION_ADAPTER',
      adapterVersion: '1',
    },
    units: { length: 'mm', force: 'N', stress: 'MPa', modulus: 'MPa' },
    formulation: definition.formulation,
    materials: [{
      materialId: 'MAT', elasticModulus: definition.material.elasticModulus,
      poissonRatio: definition.material.poissonRatio, sourceReference: `${definition.caseId}#MATERIAL`,
    }],
    nodes: [node('SRC-A', 0, 0), node('SRC-B', 1, 0), node('SRC-C', 0, 1)],
    elements: [{
      elementId: 'SRC-E1', elementType: 'T3', nodeIds: ['SRC-A', 'SRC-B', 'SRC-C'],
      materialId: 'MAT', thickness: t, sourceReference: `${definition.caseId}#SOURCE_PLACEHOLDER`,
    }],
    elementTypePolicy: {
      allowT3Fallback: true,
      sourceReference: `${definition.caseId}#SOURCE_PLACEHOLDER_NOT_MESH_AUTHORITY`,
    },
    constraints: [constraint('SRC-C1', 'SRC-A', 'UX'), constraint('SRC-C2', 'SRC-A', 'UY')],
    loadCases: [{
      loadCaseId: caseId,
      nodalForces: [], edgeTractions: [], pressureLoads: [], bodyForces: [],
      temperatureLoads: [], imposedDisplacements: [],
      sourceReference: `${definition.caseId}#DOMAIN_FIRST_ATTACHMENT_AUTHORITY`,
    }],
    resultRequests: { loadCaseIds: [caseId] },
    qualificationProfile: structuredClone(QUALIFICATION_PROFILE),
    limitations: ['B02_DOMAIN_FIRST_SOURCE_GEOMETRY_IS_NOT_ANALYSIS_MESH_AUTHORITY'],
  };
}

function quarterAnnulusGeometry(definition) {
  const { holeRadius: a, outerRadius: r, center } = definition.geometry;
  return createLafeaAnalysisGeometry({
    schema: LAFEA_ANALYSIS_GEOMETRY_SCHEMA,
    stageId: STAGE_ID,
    geometryId: `${definition.caseId}-QUARTER-ANNULUS`,
    coordinateSystemId: 'GLOBAL_XY',
    lengthUnit: 'mm',
    orientationPolicy: LAFEA_ANALYSIS_GEOMETRY_ORIENTATION_POLICY,
    vertices: [
      { vertexId: 'HOLE-X', x: center.x + a, y: center.y },
      { vertexId: 'OUTER-X', x: center.x + r, y: center.y },
      { vertexId: 'OUTER-Y', x: center.x, y: center.y + r },
      { vertexId: 'HOLE-Y', x: center.x, y: center.y + a },
    ],
    segments: [
      line('X_AXIS', 'HOLE-X', 'OUTER-X'),
      arc('OUTER_ARC', 'OUTER-X', 'OUTER-Y', center.x, center.y, r, 'CCW'),
      line('Y_AXIS', 'OUTER-Y', 'HOLE-Y'),
      arc('HOLE_ARC', 'HOLE-Y', 'HOLE-X', center.x, center.y, a, 'CW'),
    ],
    loops: [{
      loopId: 'OUTER', role: 'OUTER',
      segmentIds: ['X_AXIS', 'OUTER_ARC', 'Y_AXIS', 'HOLE_ARC'],
    }],
  });
}

function kirschDomain(definition, sourceHash, geometry) {
  const { center, holeRadius } = definition.geometry;
  const caseId = definition.loadCase.loadCaseId;
  return createLafeaContinuumAnalysisDomain({
    schema: LAFEA_CONTINUUM_ANALYSIS_DOMAIN_SCHEMA,
    stageId: STAGE_ID,
    sourceHash,
    applicationRef: `${definition.caseId}/EXACT_KIRSCH_TRACTION_DOMAIN`,
    units: { length: 'mm', force: 'N', stress: 'MPa', temperature: 'C' },
    formulation: definition.formulation,
    region: { regionId: 'REGION-1', materialRef: 'MAT' },
    physicalCases: [{ caseId }],
    attachments: [
      attachment('SYM-X', 'RESTRAINT', 'SEGMENT', 'X_AXIS', caseId, { uy: true }),
      attachment('SYM-Y', 'RESTRAINT', 'SEGMENT', 'Y_AXIS', caseId, { ux: true }),
      attachment('KIRSCH-OUTER', 'TRACTION', 'SEGMENT', 'OUTER_ARC', caseId, {
        law: 'KIRSCH_INFINITE_PLATE_OUTER_BOUNDARY_V1',
        centerX: center.x,
        centerY: center.y,
        holeRadius,
        remoteStressSigmaX: definition.loadCase.remoteStressSigmaX,
        unit: 'MPa',
      }),
    ],
  }, geometry);
}

function meshProfile(definition, method, level) {
  const defaults = defaultProfileFields(PROFILE_KINDS.MESH);
  return canonicalProfile(PROFILE_KINDS.MESH, {
    schema: 'lafea-mesh-profile/v1',
    profileIdentity: b02cGradedPolarProfileIdentity(method, level.targetElementLength),
    sourceRevision: LAFEA_B02C_GRADED_POLAR_PROFILE_SOURCE_REVISION,
    semanticHash: undefined,
    fields: {
      ...defaults,
      continuumElement: method,
      shellElement: 'CST_DKT_TRI3_THIN_SHELL_V1',
      globalTargetSize: level.targetElementLength,
      adjacentSizeRatioMax: definition.meshLadder.commonRequestPolicy.growthLimit,
    },
  });
}

function assertCircularBoundary(mesh, definition) {
  const { center, holeRadius: a, outerRadius: r } = definition.geometry;
  const scale = Math.max(1, r);
  const radial = (node) => Math.hypot(node.x - center.x, node.y - center.y);
  const arcNodes = mesh.nodes.filter((node) => {
    const rr = radial(node);
    return Math.abs(rr - a) <= 1e-8 * scale || Math.abs(rr - r) <= 1e-8 * scale;
  });
  assert.ok(arcNodes.length >= 4, 'Kirsch mesh must retain analytic circular-boundary nodes');
}
function stripAcceptance(probe) {
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
function requireDefinition(definition) {
  assert.equal(definition.caseId, 'B02C');
  assert.equal(definition.geometry.type, 'QUARTER_ANNULUS');
  assert.equal(definition.definitionState, 'FROZEN_BEFORE_PRODUCTION_OBSERVATION');
  assert.equal(definition.productionOutputUsedToChooseDefinition, false);
  assert.equal(definition.loadCase.boundaryConditions.find((row) => row.boundary === 'OUTER_ARC')?.type,
    'EXACT_KIRSCH_TRACTION_FROM_INFINITE_PLATE_FIELD');
}
function attachment(attachmentId, kind, targetType, targetId, caseId, payload) {
  return { attachmentId, kind, targetType, targetId, physicalCaseIds: [caseId], payload };
}
function node(nodeId, x, y) { return { nodeId, x, y, sourceReference: `B02_SOURCE_NODE#${nodeId}` }; }
function constraint(constraintId, nodeId, dof) { return { constraintId, nodeId, dof, value: 0, sourceReference: `B02_SOURCE_CONSTRAINT#${constraintId}` }; }
function line(segmentId, startVertexId, endVertexId) { return { segmentId, type: 'LINE', startVertexId, endVertexId }; }
function arc(segmentId, startVertexId, endVertexId, centerX, centerY, radius, sweep) {
  return { segmentId, type: 'CIRCULAR_ARC', startVertexId, endVertexId, centerX, centerY, radius, sweep };
}
