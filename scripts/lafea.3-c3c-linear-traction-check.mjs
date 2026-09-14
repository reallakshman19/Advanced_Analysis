#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  canonicalProfile,
  defaultProfileFields,
  PROFILE_KINDS,
} from '../src/core/lafea-profile-contract/index.js';
import {
  LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_PROFILE,
  LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_SCHEMA,
  createLafeaAnalysisGeometryEvidence,
} from '../src/workspace/lafea-analysis-geometry-evidence.js';
import {
  LAFEA_ANALYSIS_GEOMETRY_ORIENTATION_POLICY,
  LAFEA_ANALYSIS_GEOMETRY_SCHEMA,
  createLafeaAnalysisGeometry,
} from '../src/workspace/lafea-analysis-geometry-contract.js';
import {
  LAFEA_ANALYSIS_MESH_AUTHORITY_V2_ROLE,
  LAFEA_ANALYSIS_MESH_AUTHORITY_V2_SCHEMA,
  LAFEA_ANALYSIS_MESH_INTAKE_V2_SCHEMA,
  createLafeaAnalysisMeshEvidenceV2,
} from '../src/workspace/lafea-analysis-mesh-evidence-v2.js';
import { lafeaAnalysisMeshContentHash } from '../src/workspace/lafea-analysis-mesh-contract.js';
import { canonicalLafeaSha256 } from '../src/workspace/lafea-canonical-sha256.js';
import {
  LAFEA_CONTINUUM_ANALYSIS_DOMAIN_SCHEMA,
  createLafeaContinuumAnalysisDomain,
} from '../src/workspace/lafea-continuum-analysis-domain.js';
import { buildLafeaContinuumCompiledExecutionInput } from '../src/workspace/lafea-continuum-compiled-input.js';
import {
  createLafeaContinuumLoadResultantEvidence,
  validateLafeaContinuumLoadResultantEvidence,
} from '../src/workspace/lafea-continuum-load-resultant-evidence.js';
import { validateLafeaContinuumProjectionEvidence } from '../src/workspace/lafea-continuum-projection-evidence.js';
import { compileLafeaContinuumSolverModel } from '../src/workspace/lafea-continuum-solver-model.js';
import { integrateLafeaAnalyticalEdgeTraction } from '../src/workspace/lafea-analytical-traction-lowering.js';
import { requireLafeaStageComposition } from '../src/workspace/lafea-stage-composition-root.js';
import { issueLafeaSourceAuthority } from '../src/workspace/lafea-source-authority.js';
import { patchSource } from './lafea.3-fixtures.mjs';

const LAW = 'LINEAR_SOURCE_SEGMENT_TRACTION_V1';
const THICKNESS = 10;
const LENGTH = 50;
const PAYLOAD = Object.freeze({
  law: LAW,
  txStart: 2,
  tyStart: -3,
  txEnd: 14,
  tyEnd: 5,
  unit: 'MPa',
});
const SOURCE_RESULTANT = Object.freeze({ forceX: 4000, forceY: 500, momentZ: -75000 });
const EXPECTED_NODAL = Object.freeze([
  Object.freeze({ nodeId: 'M-B', fx: 500 * 2 / 6, fy: 500 * -3 / 6 }),
  Object.freeze({ nodeId: 'M-BC', fx: 500 * 16 / 3, fy: 500 * 2 / 3 }),
  Object.freeze({ nodeId: 'M-C', fx: 500 * 14 / 6, fy: 500 * 5 / 6 }),
]);

const familyReceipts = [];
for (const family of ['T6', 'Q8']) {
  const fixture = compileFixture(family);
  const projection = validateLafeaContinuumProjectionEvidence(fixture.model.projectionEvidence);
  const row = projection.entries.find((entry) => entry.attachmentId === 'LINEAR-EDGE');
  assert.ok(row, `${family}: linear-traction projection required`);
  assert.equal(row.sourceFeature.geometry.type, 'LINE');
  assert.deepEqual(row.sourceFeature.geometry.start, { x: 100, y: 0 });
  assert.deepEqual(row.sourceFeature.geometry.end, { x: 100, y: 50 });
  assert.deepEqual(row.meshEntities.edgeNodePaths, [['M-B', 'M-BC', 'M-C']]);
  assert.deepEqual(row.compiledContributionIds, [
    'LINEAR-EDGE/1/1/M-B',
    'LINEAR-EDGE/1/2/M-BC',
    'LINEAR-EDGE/1/3/M-C',
  ]);

  const input = buildLafeaContinuumCompiledExecutionInput(fixture.model);
  const loadCase = input.loadCases.find((item) => item.loadCaseId === 'TRACTION');
  assert.ok(loadCase, `${family}: TRACTION case required`);
  assert.equal(loadCase.edgeTractions.length, 0, `${family}: varying traction must lower before kernel edgeTraction schema`);
  const linearLoads = loadCase.nodalForces.filter((item) =>
    item.sourceReference.startsWith('COMPILED_ANALYTICAL_TRACTION#LINEAR-EDGE/'));
  assert.equal(linearLoads.length, 3);
  const byNode = new Map(linearLoads.map((item) => [item.nodeId, item]));
  for (const expected of EXPECTED_NODAL) {
    const observed = byNode.get(expected.nodeId);
    assert.ok(observed, `${family}: expected nodal contribution ${expected.nodeId}`);
    close(observed.fx, expected.fx, 1e-9, `${family} ${expected.nodeId} fx`);
    close(observed.fy, expected.fy, 1e-9, `${family} ${expected.nodeId} fy`);
  }

  const evidence = validateLafeaContinuumLoadResultantEvidence(
    createLafeaContinuumLoadResultantEvidence(fixture.model, input),
  );
  const evaluated = evidence.evaluated.find((item) => item.attachmentId === 'LINEAR-EDGE');
  assert.ok(evaluated, `${family}: linear resultant evidence required`);
  assert.equal(evaluated.tractionLaw, LAW);
  assert.equal(evaluated.comparison.status, 'PASS');
  assert.equal(evidence.linearTractionQualified, true);
  close(evaluated.sourceResultant.forceX, SOURCE_RESULTANT.forceX, 1e-9, `${family} source Fx`);
  close(evaluated.sourceResultant.forceY, SOURCE_RESULTANT.forceY, 1e-9, `${family} source Fy`);
  close(evaluated.sourceResultant.momentZ, SOURCE_RESULTANT.momentZ, 1e-8, `${family} source Mz`);
  close(evaluated.compiledResultant.forceX, SOURCE_RESULTANT.forceX, evaluated.comparison.forceTolerance, `${family} compiled Fx`);
  close(evaluated.compiledResultant.forceY, SOURCE_RESULTANT.forceY, evaluated.comparison.forceTolerance, `${family} compiled Fy`);
  close(evaluated.compiledResultant.momentZ, SOURCE_RESULTANT.momentZ, evaluated.comparison.momentTolerance, `${family} compiled Mz`);
  assert.equal(
    createLafeaContinuumLoadResultantEvidence(fixture.model, input).loadResultantEvidenceHash,
    evidence.loadResultantEvidenceHash,
    `${family}: deterministic resultant evidence required`,
  );

  const contributionDrift = structuredClone(input);
  const driftCase = contributionDrift.loadCases.find((item) => item.loadCaseId === 'TRACTION');
  driftCase.nodalForces.find((item) => item.loadId === 'LINEAR-EDGE/1/2/M-BC').loadId = 'LINEAR-EDGE/DRIFT';
  expectCode(() => createLafeaContinuumLoadResultantEvidence(fixture.model, contributionDrift),
    'LAFEA_CONTINUUM_RESULTANT_CONTRIBUTION_CUSTODY_MISMATCH');

  familyReceipts.push(Object.freeze({
    family,
    solverModelHash: fixture.model.solverModelHash,
    projectionHash: projection.projectionHash,
    resultantEvidenceHash: evidence.loadResultantEvidenceHash,
    contributionCount: evaluated.equivalentNodalForces.length,
  }));
}

const sourceGeometry = Object.freeze({
  type: 'LINE',
  start: Object.freeze({ x: 100, y: 0 }),
  end: Object.freeze({ x: 100, y: 50 }),
});
const firstHalf = integrateLafeaAnalyticalEdgeTraction({
  payload: PAYLOAD,
  edgeNodes: [node('R-B', 100, 0), node('R-BQ', 100, 12.5), node('R-M', 100, 25)],
  thickness: THICKNESS,
  sourceFeatureGeometry: sourceGeometry,
});
const secondHalf = integrateLafeaAnalyticalEdgeTraction({
  payload: PAYLOAD,
  edgeNodes: [node('R-M', 100, 25), node('R-CQ', 100, 37.5), node('R-C', 100, 50)],
  thickness: THICKNESS,
  sourceFeatureGeometry: sourceGeometry,
});
for (const key of ['forceX', 'forceY', 'momentZ']) {
  close(firstHalf.resultant[key] + secondHalf.resultant[key], SOURCE_RESULTANT[key], 1e-8,
    `refined split ${key}`);
}

expectCode(() => integrateLafeaAnalyticalEdgeTraction({
  payload: PAYLOAD,
  edgeNodes: [node('BAD-B', 101, 0), node('BAD-M', 101, 25), node('BAD-C', 101, 50)],
  thickness: THICKNESS,
  sourceFeatureGeometry: sourceGeometry,
}), 'LAFEA_LINEAR_TRACTION_POINT_OUTSIDE_SOURCE_SEGMENT');

expectCode(() => integrateLafeaAnalyticalEdgeTraction({
  payload: PAYLOAD,
  edgeNodes: [node('B', 100, 0), node('BC', 100, 25), node('C', 100, 50)],
  thickness: THICKNESS,
  sourceFeatureGeometry: { type: 'CIRCULAR_ARC', start: { x: 100, y: 0 }, end: { x: 100, y: 50 } },
}), 'LAFEA_LINEAR_TRACTION_SOURCE_LINE_GEOMETRY_INVALID');

console.log(JSON.stringify({
  schema: 'lafea3-c3c-linear-traction-check/v1',
  status: 'PASS',
  stageId: 'LAFEA.3',
  law: LAW,
  productionFamilies: familyReceipts,
  exactSourceResultant: SOURCE_RESULTANT,
  exactQuadraticEdgeNodalOracle: true,
  sourceCoordinateInterpolation: true,
  refinementSplitInvariant: true,
  forcePreserved: true,
  momentPreserved: true,
  offSourceGeometryRejected: true,
  curvedSourceGeometryNotClaimed: true,
  kernelEdgeTractionSchemaChanged: false,
  releaseAuthorityGranted: false,
}));

function compileFixture(family) {
  const composition = requireLafeaStageComposition('LAFEA.3');
  const source = composition.normalizeDocument(patchSource({ thickness: THICKNESS }));
  const canonicalInput = composition.canonicalize(source);
  const authority = issueLafeaSourceAuthority('LAFEA.3', source, `C3C-G003-${family}`);
  const geometry = rectangleGeometry();
  const caseIds = canonicalInput.loadCases.map((row) => row.loadCaseId);
  const domain = createLafeaContinuumAnalysisDomain({
    schema: LAFEA_CONTINUUM_ANALYSIS_DOMAIN_SCHEMA,
    stageId: 'LAFEA.3',
    sourceHash: authority.sourceHash,
    applicationRef: `C3C-G003-${family}`,
    units: { length: 'mm', force: 'N', stress: 'MPa', temperature: 'C' },
    formulation: 'PLANE_STRESS',
    region: { regionId: 'REGION-1', materialRef: 'MAT' },
    physicalCases: caseIds.map((caseId) => ({ caseId })),
    attachments: [
      attachment('FIX-A', 'RESTRAINT', 'VERTEX', 'A', caseIds, { ux: true, uy: true }),
      attachment('FIX-D', 'RESTRAINT', 'VERTEX', 'D', caseIds, { ux: true }),
      attachment('LINEAR-EDGE', 'TRACTION', 'SEGMENT', 'S2', ['TRACTION'], PAYLOAD),
    ],
  }, geometry);
  const geometryEvidence = createLafeaAnalysisGeometryEvidence({
    schema: LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_SCHEMA,
    stageId: 'LAFEA.3', sourceHash: authority.sourceHash,
    analysisDomain: domain, geometry,
    producerRef: `C3C-G003-${family}/GEOMETRY`,
    profileId: LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_PROFILE,
  });
  const profile = meshProfile(family);
  const mesh = family === 'T6' ? t6Mesh() : q8Mesh();
  const meshHash = lafeaAnalysisMeshContentHash(mesh);
  const meshEvidence = createLafeaAnalysisMeshEvidenceV2({
    schema: LAFEA_ANALYSIS_MESH_INTAKE_V2_SCHEMA,
    stageId: 'LAFEA.3', sourceHash: authority.sourceHash,
    analysisDomainHash: domain.semanticHash,
    analysisGeometryHash: geometry.semanticHash,
    meshProfile: profile, mesh,
    authority: {
      schema: LAFEA_ANALYSIS_MESH_AUTHORITY_V2_SCHEMA,
      stageId: 'LAFEA.3', authorityRole: LAFEA_ANALYSIS_MESH_AUTHORITY_V2_ROLE,
      status: 'ACCEPTED_BY_STAGE_CONTRACT', producerRef: `C3C-G003-${family}/MESH`,
      sourceHash: authority.sourceHash,
      analysisDomainHash: domain.semanticHash,
      analysisGeometryHash: geometry.semanticHash,
      meshProfileHash: profile.semanticHash,
      meshHash,
      capabilityHash: hash(`${family}/CAPABILITY`),
      qualificationHash: hash(`${family}/QUALIFICATION`),
      planHash: hash(`${family}/PLAN`),
    },
  });
  const model = compileLafeaContinuumSolverModel({
    sourceAuthority: authority,
    source,
    canonicalInput,
    analysisDomain: domain,
    geometryEvidence,
    meshEvidence,
  });
  return { authority, geometry, domain, meshEvidence, model };
}

function rectangleGeometry() {
  return createLafeaAnalysisGeometry({
    schema: LAFEA_ANALYSIS_GEOMETRY_SCHEMA,
    stageId: 'LAFEA.3',
    geometryId: 'C3C-G003-RECTANGLE',
    coordinateSystemId: 'GLOBAL_XY',
    lengthUnit: 'mm',
    orientationPolicy: LAFEA_ANALYSIS_GEOMETRY_ORIENTATION_POLICY,
    vertices: [
      { vertexId: 'A', x: 0, y: 0 },
      { vertexId: 'B', x: 100, y: 0 },
      { vertexId: 'C', x: 100, y: 50 },
      { vertexId: 'D', x: 0, y: 50 },
    ],
    segments: [
      line('S1', 'A', 'B'), line('S2', 'B', 'C'),
      line('S3', 'C', 'D'), line('S4', 'D', 'A'),
    ],
    loops: [{ loopId: 'OUTER', role: 'OUTER', segmentIds: ['S1', 'S2', 'S3', 'S4'] }],
  });
}

function t6Mesh() {
  return {
    schema: 'lafea-analysis-mesh/v1',
    meshIdentity: 'C3C-G003-T6',
    nodes: [
      node('M-A', 0, 0), node('M-B', 100, 0), node('M-C', 100, 50), node('M-D', 0, 50),
      node('M-AB', 50, 0), node('M-BC', 100, 25), node('M-CD', 50, 50),
      node('M-DA', 0, 25), node('M-BD', 50, 25),
    ],
    elements: [
      { elementId: 'M-E1', elementType: 'T6', nodeIds: ['M-A', 'M-B', 'M-D', 'M-AB', 'M-BD', 'M-DA'] },
      { elementId: 'M-E2', elementType: 'T6', nodeIds: ['M-B', 'M-C', 'M-D', 'M-BC', 'M-CD', 'M-BD'] },
    ],
  };
}

function q8Mesh() {
  return {
    schema: 'lafea-analysis-mesh/v1',
    meshIdentity: 'C3C-G003-Q8',
    nodes: [
      node('M-A', 0, 0), node('M-B', 100, 0), node('M-C', 100, 50), node('M-D', 0, 50),
      node('M-AB', 50, 0), node('M-BC', 100, 25), node('M-CD', 50, 50), node('M-DA', 0, 25),
    ],
    elements: [{
      elementId: 'M-E1', elementType: 'Q8',
      nodeIds: ['M-A', 'M-B', 'M-C', 'M-D', 'M-AB', 'M-BC', 'M-CD', 'M-DA'],
    }],
  };
}

function meshProfile(family) {
  const defaults = defaultProfileFields(PROFILE_KINDS.MESH);
  return canonicalProfile(PROFILE_KINDS.MESH, {
    schema: 'lafea-mesh-profile/v1',
    profileIdentity: `C3C-G003-${family}`,
    sourceRevision: 'C3C-G003',
    semanticHash: undefined,
    fields: {
      ...defaults,
      continuumElement: family,
      shellElement: 'CST_DKT_TRI3_THIN_SHELL_V1',
      globalTargetSize: 25,
    },
  });
}

function attachment(attachmentId, kind, targetType, targetId, physicalCaseIds, payload) {
  return { attachmentId, kind, targetType, targetId, physicalCaseIds, payload };
}
function line(segmentId, startVertexId, endVertexId) {
  return { segmentId, type: 'LINE', startVertexId, endVertexId };
}
function node(nodeId, x, y) { return { nodeId, x, y, z: 0 }; }
function hash(value) { return canonicalLafeaSha256({ schema: 'c3c-g003-test-hash/v1', value }); }
function close(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, observed ${actual}`);
}
function expectCode(action, code) {
  assert.throws(action, (error) => error?.code === code, `expected ${code}`);
}
