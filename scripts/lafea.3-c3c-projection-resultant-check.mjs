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
import { triangleSource } from './lafea.3-fixtures.mjs';

const fixture = compileFixture();
const model = fixture.model;
const projection = validateLafeaContinuumProjectionEvidence(model.projectionEvidence);
assert.equal(model.parents.projectionHash, projection.projectionHash);
assert.equal(projection.parents.sourceHash, fixture.authority.sourceHash);
assert.equal(projection.parents.analysisDomainHash, fixture.domain.semanticHash);
assert.equal(projection.parents.analysisGeometryHash, fixture.geometry.semanticHash);
assert.equal(projection.parents.meshHash, fixture.meshEvidence.meshHash);

const tractionProjection = projection.entries.find((row) => row.attachmentId === 'PULL-EDGE');
assert.ok(tractionProjection, 'PULL-EDGE projection required');
assert.equal(tractionProjection.sourceFeature.targetType, 'SEGMENT');
assert.equal(tractionProjection.sourceFeature.featureId, 'S2');
assert.equal(tractionProjection.sourceFeature.geometry.type, 'LINE');
assert.deepEqual(tractionProjection.meshEntities.nodeIds, ['M-B', 'M-BC', 'M-C']);
assert.deepEqual(tractionProjection.meshEntities.edgeNodePaths, [['M-B', 'M-BC', 'M-C']]);
assert.deepEqual(tractionProjection.meshEntities.elementIds, ['M-E1']);
assert.deepEqual(tractionProjection.compiledContributionIds, ['PULL-EDGE/1']);

const bodyProjection = projection.entries.find((row) => row.attachmentId === 'BODY');
assert.ok(bodyProjection, 'BODY projection required');
assert.equal(bodyProjection.sourceFeature.targetType, 'REGION');
assert.equal(bodyProjection.sourceFeature.featureId, 'REGION-1');
assert.equal(bodyProjection.sourceFeature.geometry.orientationPolicy, 'OUTER_CCW_HOLES_CW_V1');
assert.equal(bodyProjection.sourceFeature.geometry.loops.length, 1);
assert.equal(bodyProjection.sourceFeature.geometry.loops[0].role, 'OUTER');
assert.deepEqual(bodyProjection.compiledContributionIds, ['BODY/M-E1']);

const input = buildLafeaContinuumCompiledExecutionInput(model);
const evidence = validateLafeaContinuumLoadResultantEvidence(
  createLafeaContinuumLoadResultantEvidence(model, input),
);
assert.equal(evidence.parents.solverModelHash, model.solverModelHash);
assert.equal(evidence.parents.projectionHash, model.parents.projectionHash);
assert.equal(evidence.evaluated.length, 2);

const tractionRow = evidence.evaluated.find((item) => item.attachmentId === 'PULL-EDGE');
assert.ok(tractionRow);
assert.equal(tractionRow.caseId, 'L1');
assert.equal(tractionRow.comparison.status, 'PASS');
assert.ok(Math.abs(tractionRow.sourceResultant.forceX - 10000 * Math.SQRT2) < 1e-8);
assert.ok(Math.abs(tractionRow.sourceResultant.forceY) < 1e-12);
assert.ok(Math.abs(tractionRow.sourceResultant.momentZ + 500000 * Math.SQRT2) < 1e-7);
assert.ok(Math.abs(tractionRow.compiledResultant.forceX - tractionRow.sourceResultant.forceX) <= tractionRow.comparison.forceTolerance);
assert.ok(Math.abs(tractionRow.compiledResultant.forceY - tractionRow.sourceResultant.forceY) <= tractionRow.comparison.forceTolerance);
assert.ok(Math.abs(tractionRow.compiledResultant.momentZ - tractionRow.sourceResultant.momentZ) <= tractionRow.comparison.momentTolerance);
assert.equal(tractionRow.equivalentNodalForces.length, 3);
assert.deepEqual(tractionRow.contributionIds, ['PULL-EDGE/1']);

const bodyRow = evidence.evaluated.find((item) => item.attachmentId === 'BODY');
assert.ok(bodyRow);
assert.equal(bodyRow.caseId, 'L1');
assert.equal(bodyRow.bodyForceLaw, 'UNIFORM_SOURCE_REGION_BODY_FORCE_V1');
assert.equal(bodyRow.sourceRegionAuthority, 'ANALYSIS_GEOMETRY_ORIENTED_REGION_BOUNDARY_V1');
assert.equal(bodyRow.comparison.status, 'PASS');
close(bodyRow.sourceRegionMoments.area, 5000);
close(bodyRow.sourceRegionMoments.centroidX, 100 / 3);
close(bodyRow.sourceRegionMoments.centroidY, 100 / 3);
close(bodyRow.sourceResultant.forceX, 0);
close(bodyRow.sourceResultant.forceY, -50000);
close(bodyRow.sourceResultant.momentZ, -5000000 / 3);
close(bodyRow.compiledResultant.forceX, bodyRow.sourceResultant.forceX);
close(bodyRow.compiledResultant.forceY, bodyRow.sourceResultant.forceY);
close(bodyRow.compiledResultant.momentZ, bodyRow.sourceResultant.momentZ);
assert.equal(bodyRow.sourceResultant.measureUnit, 'mm^2');
assert.equal(bodyRow.equivalentNodalForces.length, 6);
assert.deepEqual(bodyRow.contributionIds, ['BODY/M-E1']);

assert.equal(
  createLafeaContinuumLoadResultantEvidence(model, input).loadResultantEvidenceHash,
  evidence.loadResultantEvidenceHash,
  'same compiled model/input must produce identical resultant evidence hash',
);

const projectionTamper = structuredClone(projection);
projectionTamper.entries.find((entry) => entry.attachmentId === 'PULL-EDGE').meshEntities.nodeIds[1] = 'M-CA';
expectCode(() => validateLafeaContinuumProjectionEvidence(projectionTamper),
  'LAFEA_CONTINUUM_PROJECTION_EVIDENCE_TAMPERED');

const contributionDrift = structuredClone(input);
contributionDrift.loadCases.find((loadCase) => loadCase.loadCaseId === 'L1').edgeTractions[0].tractionId = 'PULL-EDGE/DRIFT';
expectCode(() => createLafeaContinuumLoadResultantEvidence(model, contributionDrift),
  'LAFEA_CONTINUUM_RESULTANT_CONTRIBUTION_CUSTODY_MISMATCH');

const bodyContributionDrift = structuredClone(input);
bodyContributionDrift.loadCases.find((loadCase) => loadCase.loadCaseId === 'L1').bodyForces[0].bodyForceId = 'BODY/DRIFT';
expectCode(() => createLafeaContinuumLoadResultantEvidence(model, bodyContributionDrift),
  'LAFEA_CONTINUUM_RESULTANT_CONTRIBUTION_CUSTODY_MISMATCH');

const momentOnlyDrift = structuredClone(model);
for (const nodeId of ['M-B', 'M-BC', 'M-C']) {
  momentOnlyDrift.nodes.find((node) => node.nodeId === nodeId).y += 1;
}
expectCode(() => createLafeaContinuumLoadResultantEvidence(momentOnlyDrift, input),
  'LAFEA_CONTINUUM_LOAD_RESULTANT_MISMATCH');

assert.equal(evidence.pressureSourceNormalQualified, false);
assert.equal(evidence.linearTractionQualified, false);
assert.equal(evidence.bodyForceResultantQualified, true);
assert.equal(evidence.releaseAuthorityGranted, false);

console.log(JSON.stringify({
  schema: 'lafea3-c3c-projection-resultant-check/v2',
  status: 'PASS',
  stageId: 'LAFEA.3',
  projectionHash: projection.projectionHash,
  loadResultantEvidenceHash: evidence.loadResultantEvidenceHash,
  qualifiedScope: evidence.qualifiedScope,
  sourceFeatureToMeshToContributionCustody: true,
  constantStraightT6TractionForcePreserved: true,
  constantStraightT6TractionMomentPreserved: true,
  straightRegionT6BodyForcePreserved: true,
  bodyForceMomentPreserved: true,
  momentOnlyDriftRejected: true,
  contributionIdentityDriftRejected: true,
  bodyForceContributionIdentityDriftRejected: true,
  deterministicReplay: true,
  pressureSourceNormalQualified: false,
  linearTractionQualified: false,
  bodyForceResultantQualified: true,
  releaseAuthorityGranted: false,
}));

function compileFixture() {
  const composition = requireLafeaStageComposition('LAFEA.3');
  const source = composition.normalizeDocument(triangleSource());
  const canonicalInput = composition.canonicalize(source);
  const authority = issueLafeaSourceAuthority('LAFEA.3', source, 'C3C-G001-G002');
  const geometry = triangleGeometry();
  const caseIds = canonicalInput.loadCases.map((row) => row.loadCaseId);
  const domain = createLafeaContinuumAnalysisDomain({
    schema: LAFEA_CONTINUUM_ANALYSIS_DOMAIN_SCHEMA,
    stageId: 'LAFEA.3', sourceHash: authority.sourceHash,
    applicationRef: 'C3C-G001-G002',
    units: { length: 'mm', force: 'N', stress: 'MPa', temperature: 'C' },
    formulation: 'PLANE_STRESS', region: { regionId: 'REGION-1', materialRef: 'MAT' },
    physicalCases: caseIds.map((caseId) => ({ caseId })),
    attachments: [
      attachment('FIX-A', 'RESTRAINT', 'VERTEX', 'A', caseIds, { ux: true, uy: true }),
      attachment('FIX-EDGE', 'RESTRAINT', 'SEGMENT', 'S3', caseIds, { ux: true }),
      attachment('PULL-EDGE', 'TRACTION', 'SEGMENT', 'S2', [caseIds[0]], { tx: 10, ty: 0, unit: 'MPa' }),
      attachment('BODY', 'BODY_FORCE', 'REGION', 'REGION-1', [caseIds[0]], { bx: 0, by: -1, unit: 'N/mm^3' }),
    ],
  }, geometry);
  const geometryEvidence = createLafeaAnalysisGeometryEvidence({
    schema: LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_SCHEMA,
    stageId: 'LAFEA.3', sourceHash: authority.sourceHash,
    analysisDomain: domain, geometry,
    producerRef: 'C3C-G001-G002/GEOMETRY',
    profileId: LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_PROFILE,
  });
  const profile = meshProfile();
  const mesh = t6Mesh();
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
      status: 'ACCEPTED_BY_STAGE_CONTRACT', producerRef: 'C3C-G001-G002/T6',
      sourceHash: authority.sourceHash,
      analysisDomainHash: domain.semanticHash,
      analysisGeometryHash: geometry.semanticHash,
      meshProfileHash: profile.semanticHash,
      meshHash,
      capabilityHash: hash('CAPABILITY'),
      qualificationHash: hash('QUALIFICATION'),
      planHash: hash('PLAN'),
    },
  });
  const model = compileLafeaContinuumSolverModel({
    sourceAuthority: authority, source, canonicalInput,
    analysisDomain: domain, geometryEvidence, meshEvidence,
  });
  return { authority, geometry, domain, meshEvidence, model };
}

function triangleGeometry() {
  return createLafeaAnalysisGeometry({
    schema: LAFEA_ANALYSIS_GEOMETRY_SCHEMA,
    stageId: 'LAFEA.3', geometryId: 'C3C-T6-TRIANGLE', coordinateSystemId: 'GLOBAL_XY',
    lengthUnit: 'mm', orientationPolicy: LAFEA_ANALYSIS_GEOMETRY_ORIENTATION_POLICY,
    vertices: [
      { vertexId: 'A', x: 0, y: 0 },
      { vertexId: 'B', x: 100, y: 0 },
      { vertexId: 'C', x: 0, y: 100 },
    ],
    segments: [line('S1', 'A', 'B'), line('S2', 'B', 'C'), line('S3', 'C', 'A')],
    loops: [{ loopId: 'OUTER', role: 'OUTER', segmentIds: ['S1', 'S2', 'S3'] }],
  });
}

function t6Mesh() {
  return {
    schema: 'lafea-analysis-mesh/v1', meshIdentity: 'C3C-T6-STRAIGHT-EDGE',
    nodes: [
      node('M-A', 0, 0), node('M-B', 100, 0), node('M-C', 0, 100),
      node('M-AB', 50, 0), node('M-BC', 50, 50), node('M-CA', 0, 50),
    ],
    elements: [{
      elementId: 'M-E1', elementType: 'T6',
      nodeIds: ['M-A', 'M-B', 'M-C', 'M-AB', 'M-BC', 'M-CA'],
    }],
  };
}

function meshProfile() {
  const defaults = defaultProfileFields(PROFILE_KINDS.MESH);
  return canonicalProfile(PROFILE_KINDS.MESH, {
    schema: 'lafea-mesh-profile/v1', profileIdentity: 'C3C-G001-G002-T6',
    sourceRevision: 'C3C-G001-G002', semanticHash: undefined,
    fields: {
      ...defaults,
      continuumElement: 'T6',
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
function hash(value) { return canonicalLafeaSha256({ schema: 'c3c-g001-g002-test-hash/v1', value }); }
function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
}
function expectCode(action, code) {
  assert.throws(action, (error) => error?.code === code, `expected ${code}`);
}
