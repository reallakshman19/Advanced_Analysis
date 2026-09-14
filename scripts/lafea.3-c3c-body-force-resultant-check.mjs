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
import { requireLafeaStageComposition } from '../src/workspace/lafea-stage-composition-root.js';
import { issueLafeaSourceAuthority } from '../src/workspace/lafea-source-authority.js';
import { patchSource } from './lafea.3-fixtures.mjs';

const THICKNESS = 10;
const PAYLOAD = Object.freeze({ bx: 3, by: -4, unit: 'N/mm^3' });
const SOURCE = Object.freeze({
  area: 5000,
  centroidX: 50,
  centroidY: 25,
  forceX: 150000,
  forceY: -200000,
  momentZ: -13750000,
});

const receipts = [];
for (const family of ['T6', 'Q8']) {
  const fixture = compileFixture(family);
  const projection = validateLafeaContinuumProjectionEvidence(fixture.model.projectionEvidence);
  const entry = projection.entries.find((row) => row.attachmentId === 'BODY-REGION');
  assert.ok(entry, `${family}: body-force projection required`);
  assert.equal(entry.sourceFeature.targetType, 'REGION');
  assert.equal(entry.sourceFeature.featureId, 'REGION-1');
  assert.equal(entry.sourceFeature.geometry.orientationPolicy, 'OUTER_CCW_HOLES_CW_V1');
  assert.equal(entry.sourceFeature.geometry.loops.length, 1);
  assert.equal(entry.sourceFeature.geometry.loops[0].role, 'OUTER');
  assert.ok(entry.sourceFeature.geometry.loops[0].segments.every((segment) => segment.type === 'LINE'));

  const expectedContributionIds = family === 'T6'
    ? ['BODY-REGION/M-E1', 'BODY-REGION/M-E2']
    : ['BODY-REGION/M-E1'];
  assert.deepEqual(entry.compiledContributionIds, expectedContributionIds);

  const input = buildLafeaContinuumCompiledExecutionInput(fixture.model);
  const loadCase = input.loadCases.find((row) => row.loadCaseId === 'TRACTION');
  assert.ok(loadCase, `${family}: TRACTION physical case required`);
  assert.deepEqual(
    loadCase.bodyForces.map((row) => row.bodyForceId).sort(),
    [...expectedContributionIds].sort(),
  );

  const evidence = validateLafeaContinuumLoadResultantEvidence(
    createLafeaContinuumLoadResultantEvidence(fixture.model, input),
  );
  const row = evidence.evaluated.find((item) => item.attachmentId === 'BODY-REGION');
  assert.ok(row, `${family}: body-force resultant evidence required`);
  assert.equal(row.caseId, 'TRACTION');
  assert.equal(row.bodyForceLaw, 'UNIFORM_SOURCE_REGION_BODY_FORCE_V1');
  assert.equal(row.sourceRegionAuthority, 'ANALYSIS_GEOMETRY_ORIENTED_REGION_BOUNDARY_V1');
  assert.equal(row.comparison.status, 'PASS');
  assert.equal(evidence.bodyForceResultantQualified, true);
  close(row.sourceRegionMoments.area, SOURCE.area, 1e-9, `${family} source area`);
  close(row.sourceRegionMoments.centroidX, SOURCE.centroidX, 1e-9, `${family} source centroid x`);
  close(row.sourceRegionMoments.centroidY, SOURCE.centroidY, 1e-9, `${family} source centroid y`);
  close(row.sourceResultant.forceX, SOURCE.forceX, 1e-8, `${family} source Fx`);
  close(row.sourceResultant.forceY, SOURCE.forceY, 1e-8, `${family} source Fy`);
  close(row.sourceResultant.momentZ, SOURCE.momentZ, 1e-7, `${family} source Mz`);
  close(row.compiledResultant.forceX, SOURCE.forceX, row.comparison.forceTolerance, `${family} compiled Fx`);
  close(row.compiledResultant.forceY, SOURCE.forceY, row.comparison.forceTolerance, `${family} compiled Fy`);
  close(row.compiledResultant.momentZ, SOURCE.momentZ, row.comparison.momentTolerance, `${family} compiled Mz`);
  assert.equal(row.sourceResultant.measureUnit, 'mm^2');
  assert.equal(row.compiledResultant.measureUnit, 'mm^2');

  const replay = createLafeaContinuumLoadResultantEvidence(fixture.model, input);
  assert.equal(replay.loadResultantEvidenceHash, evidence.loadResultantEvidenceHash,
    `${family}: deterministic resultant evidence required`);

  const contributionDrift = structuredClone(input);
  contributionDrift.loadCases.find((item) => item.loadCaseId === 'TRACTION')
    .bodyForces[0].bodyForceId = 'BODY-REGION/DRIFT';
  expectCode(() => createLafeaContinuumLoadResultantEvidence(fixture.model, contributionDrift),
    'LAFEA_CONTINUUM_RESULTANT_CONTRIBUTION_CUSTODY_MISMATCH');

  if (family === 'T6') {
    const momentOnlyDrift = structuredClone(input);
    const rows = momentOnlyDrift.loadCases.find((item) => item.loadCaseId === 'TRACTION').bodyForces;
    rows[0].by += 1;
    rows[1].by -= 1;
    const totalCompiledBy = rows.reduce((sum, item) => sum + item.by, 0);
    close(totalCompiledBy, PAYLOAD.by * rows.length, 1e-12, 'T6 body-force component sum preserved');
    expectCode(() => createLafeaContinuumLoadResultantEvidence(fixture.model, momentOnlyDrift),
      'LAFEA_CONTINUUM_LOAD_RESULTANT_MISMATCH');
  }

  receipts.push(Object.freeze({
    family,
    solverModelHash: fixture.model.solverModelHash,
    projectionHash: projection.projectionHash,
    loadResultantEvidenceHash: evidence.loadResultantEvidenceHash,
    contributionIds: row.contributionIds,
    equivalentNodalContributionCount: row.equivalentNodalForces.length,
  }));
}

console.log(JSON.stringify({
  schema: 'lafea3-c3c-body-force-resultant-check/v1',
  status: 'PASS',
  stageId: 'LAFEA.3',
  productionFamilies: receipts,
  sourceRegionAuthority: 'ANALYSIS_GEOMETRY_ORIENTED_REGION_BOUNDARY_V1',
  bodyForceLaw: 'UNIFORM_SOURCE_REGION_BODY_FORCE_V1',
  straightRegionAreaAndCentroidOracle: true,
  forcePreserved: true,
  momentPreserved: true,
  contributionIdentityDriftRejected: true,
  momentSensitiveNegativeControl: true,
  curvedRegionCertification: 'NOT_CLAIMED_FAIL_CLOSED',
  kernelBodyForceIntegrationChanged: false,
  releaseAuthorityGranted: false,
}));

function compileFixture(family) {
  const composition = requireLafeaStageComposition('LAFEA.3');
  const source = composition.normalizeDocument(patchSource({ thickness: THICKNESS }));
  const canonicalInput = composition.canonicalize(source);
  const authority = issueLafeaSourceAuthority('LAFEA.3', source, `C3C-G002-BODY-${family}`);
  const geometry = rectangleGeometry();
  const caseIds = canonicalInput.loadCases.map((row) => row.loadCaseId);
  const domain = createLafeaContinuumAnalysisDomain({
    schema: LAFEA_CONTINUUM_ANALYSIS_DOMAIN_SCHEMA,
    stageId: 'LAFEA.3',
    sourceHash: authority.sourceHash,
    applicationRef: `C3C-G002-BODY-${family}`,
    units: { length: 'mm', force: 'N', stress: 'MPa', temperature: 'C' },
    formulation: 'PLANE_STRESS',
    region: { regionId: 'REGION-1', materialRef: 'MAT' },
    physicalCases: caseIds.map((caseId) => ({ caseId })),
    attachments: [
      attachment('FIX-A', 'RESTRAINT', 'VERTEX', 'A', caseIds, { ux: true, uy: true }),
      attachment('FIX-D', 'RESTRAINT', 'VERTEX', 'D', caseIds, { ux: true }),
      attachment('BODY-REGION', 'BODY_FORCE', 'REGION', 'REGION-1', ['TRACTION'], PAYLOAD),
    ],
  }, geometry);
  const geometryEvidence = createLafeaAnalysisGeometryEvidence({
    schema: LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_SCHEMA,
    stageId: 'LAFEA.3', sourceHash: authority.sourceHash,
    analysisDomain: domain, geometry,
    producerRef: `C3C-G002-BODY-${family}/GEOMETRY`,
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
      status: 'ACCEPTED_BY_STAGE_CONTRACT', producerRef: `C3C-G002-BODY-${family}/MESH`,
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
  return { model };
}

function rectangleGeometry() {
  return createLafeaAnalysisGeometry({
    schema: LAFEA_ANALYSIS_GEOMETRY_SCHEMA,
    stageId: 'LAFEA.3',
    geometryId: 'C3C-G002-BODY-RECTANGLE',
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
    schema: 'lafea-analysis-mesh/v1', meshIdentity: 'C3C-G002-BODY-T6',
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
    schema: 'lafea-analysis-mesh/v1', meshIdentity: 'C3C-G002-BODY-Q8',
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
    profileIdentity: `C3C-G002-BODY-${family}`,
    sourceRevision: 'C3C-G002-BODY',
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
function hash(value) { return canonicalLafeaSha256({ schema: 'c3c-g002-body-test-hash/v1', value }); }
function close(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, observed ${actual}`);
}
function expectCode(action, code) {
  assert.throws(action, (error) => error?.code === code, `expected ${code}`);
}
