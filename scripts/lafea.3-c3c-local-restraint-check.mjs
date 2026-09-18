#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createCanonicalLocalContinuumModel } from '../src/core/local-continuum/index.js';
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
  LAFEA_CONTINUUM_SOURCE_NORMAL_RESTRAINT_MODE,
  LAFEA_CONTINUUM_SOURCE_NORMAL_RESTRAINT_POLICY,
  sourceNormalRestraintDof,
} from '../src/workspace/lafea-continuum-local-restraint.js';
import { validateLafeaContinuumProjectionEvidence } from '../src/workspace/lafea-continuum-projection-evidence.js';
import { compileLafeaContinuumSolverModel } from '../src/workspace/lafea-continuum-solver-model.js';
import { requireLafeaStageComposition } from '../src/workspace/lafea-stage-composition-root.js';
import { issueLafeaSourceAuthority } from '../src/workspace/lafea-source-authority.js';
import { patchSource } from './lafea.3-fixtures.mjs';

const receipts = [];
for (const family of ['T6', 'Q8']) {
  const fixture = compileFixture(family);
  const projection = validateLafeaContinuumProjectionEvidence(fixture.model.projectionEvidence);
  const horizontal = projection.entries.find((row) => row.attachmentId === 'ROLLER-H');
  const vertical = projection.entries.find((row) => row.attachmentId === 'ROLLER-V');
  assert.ok(horizontal, `${family}: horizontal roller projection required`);
  assert.ok(vertical, `${family}: vertical roller projection required`);
  assert.equal(horizontal.sourceFeature.geometry.type, 'LINE');
  assert.equal(vertical.sourceFeature.geometry.type, 'LINE');

  const expectedHorizontalNodes = ['M-A', 'M-AB', 'M-B'];
  const expectedVerticalNodes = ['M-A', 'M-DA', 'M-D'];
  const expectedHorizontalIds = expectedHorizontalNodes
    .map((nodeId) => `ROLLER-H/${nodeId}/UY`).sort();
  const expectedVerticalIds = expectedVerticalNodes
    .map((nodeId) => `ROLLER-V/${nodeId}/UX`).sort();
  assert.deepEqual([...horizontal.compiledContributionIds].sort(), expectedHorizontalIds);
  assert.deepEqual([...vertical.compiledContributionIds].sort(), expectedVerticalIds);

  const input = buildLafeaContinuumCompiledExecutionInput(fixture.model);
  assert.ok(input.limitations.includes('SOURCE_NORMAL_AXIS_ALIGNED_RESTRAINT_V1'));
  const constraintIds = input.constraints.map((row) => row.constraintId).sort();
  assert.deepEqual(
    constraintIds,
    [...expectedHorizontalIds, ...expectedVerticalIds, 'FIX-B/M-B/UX'].sort(),
  );
  for (const row of input.constraints.filter((item) => item.constraintId.startsWith('ROLLER-H/'))) {
    assert.equal(row.dof, 'UY');
    assert.equal(row.value, 0);
    assert.ok(row.sourceReference.includes(LAFEA_CONTINUUM_SOURCE_NORMAL_RESTRAINT_POLICY));
  }
  for (const row of input.constraints.filter((item) => item.constraintId.startsWith('ROLLER-V/'))) {
    assert.equal(row.dof, 'UX');
    assert.equal(row.value, 0);
    assert.ok(row.sourceReference.includes(LAFEA_CONTINUUM_SOURCE_NORMAL_RESTRAINT_POLICY));
  }
  const legacy = input.constraints.find((row) => row.constraintId === 'FIX-B/M-B/UX');
  assert.ok(legacy, `${family}: legacy global restraint required`);
  assert.equal(legacy.sourceReference, 'COMPILED_ATTACHMENT#FIX-B');

  const canonical = createCanonicalLocalContinuumModel(input);
  assert.deepEqual(
    canonical.constraints.map((row) => row.constraintId).sort(),
    constraintIds,
    `${family}: kernel canonical constraint IDs`,
  );

  const mixedPayload = structuredClone(fixture.model);
  mixedPayload.attachments.find((row) => row.attachmentId === 'ROLLER-H').payload.ux = true;
  expectCode(
    () => buildLafeaContinuumCompiledExecutionInput(mixedPayload),
    'LAFEA_CONTINUUM_COMPILED_RESTRAINT_PAYLOAD_INVALID',
  );

  receipts.push(Object.freeze({
    family,
    solverModelHash: fixture.model.solverModelHash,
    projectionHash: projection.projectionHash,
    horizontalDof: 'UY',
    verticalDof: 'UX',
    horizontalContributionIds: expectedHorizontalIds,
    verticalContributionIds: expectedVerticalIds,
  }));
}

assert.equal(
  sourceNormalRestraintDof({ type: 'LINE', start: { x: 0, y: 0 }, end: { x: 20, y: 0 } }),
  'UY',
);
assert.equal(
  sourceNormalRestraintDof({ type: 'LINE', start: { x: 0, y: 0 }, end: { x: 0, y: 20 } }),
  'UX',
);
expectCode(
  () => sourceNormalRestraintDof({ type: 'LINE', start: { x: 0, y: 0 }, end: { x: 20, y: 10 } }),
  'LAFEA_CONTINUUM_LOCAL_RESTRAINT_LINEAR_CONSTRAINT_AUTHORITY_REQUIRED',
);
expectCode(
  () => sourceNormalRestraintDof({
    type: 'CIRCULAR_ARC', start: { x: 10, y: 0 }, end: { x: 0, y: 10 },
    centerX: 0, centerY: 0, radius: 10, sweep: 'CCW',
  }),
  'LAFEA_CONTINUUM_LOCAL_RESTRAINT_LINEAR_CONSTRAINT_AUTHORITY_REQUIRED',
);

console.log(JSON.stringify({
  schema: 'lafea3-c3c-local-restraint-check/v1',
  status: 'PASS',
  stageId: 'LAFEA.3',
  mode: LAFEA_CONTINUUM_SOURCE_NORMAL_RESTRAINT_MODE,
  policyId: LAFEA_CONTINUUM_SOURCE_NORMAL_RESTRAINT_POLICY,
  productionFamilies: receipts,
  sourceGeometryAuthority: 'PROJECTION_EVIDENCE_SOURCE_SEGMENT_GEOMETRY',
  horizontalSourceNormalMapsToUy: true,
  verticalSourceNormalMapsToUx: true,
  legacyGlobalRestraintPreserved: true,
  projectionAndCompiledConstraintIdsAgree: true,
  obliqueSourceNormal: 'NOT_REPRESENTABLE_FAIL_CLOSED_MPC_AUTHORITY_REQUIRED',
  curvedSourceNormal: 'NOT_REPRESENTABLE_FAIL_CLOSED_MPC_AUTHORITY_REQUIRED',
  solverConstraintFormulationChanged: false,
  releaseAuthorityGranted: false,
}));

function compileFixture(family) {
  const composition = requireLafeaStageComposition('LAFEA.3');
  const source = composition.normalizeDocument(patchSource({ formulation: 'PLANE_STRESS', thickness: 10 }));
  const canonicalInput = composition.canonicalize(source);
  const authority = issueLafeaSourceAuthority('LAFEA.3', source, `C3C-G006-${family}`);
  const geometry = rectangleGeometry();
  const caseIds = canonicalInput.loadCases.map((row) => row.loadCaseId);
  const domain = createLafeaContinuumAnalysisDomain({
    schema: LAFEA_CONTINUUM_ANALYSIS_DOMAIN_SCHEMA,
    stageId: 'LAFEA.3',
    sourceHash: authority.sourceHash,
    applicationRef: `C3C-G006-${family}`,
    units: { length: 'mm', force: 'N', stress: 'MPa', temperature: 'C' },
    formulation: 'PLANE_STRESS',
    region: { regionId: 'REGION-1', materialRef: 'MAT' },
    physicalCases: caseIds.map((caseId) => ({ caseId })),
    attachments: [
      attachment('ROLLER-H', 'RESTRAINT', 'SEGMENT', 'S1', caseIds, {
        mode: LAFEA_CONTINUUM_SOURCE_NORMAL_RESTRAINT_MODE,
      }),
      attachment('ROLLER-V', 'RESTRAINT', 'SEGMENT', 'S4', caseIds, {
        mode: LAFEA_CONTINUUM_SOURCE_NORMAL_RESTRAINT_MODE,
      }),
      attachment('FIX-B', 'RESTRAINT', 'VERTEX', 'B', caseIds, { ux: true }),
    ],
  }, geometry);
  const geometryEvidence = createLafeaAnalysisGeometryEvidence({
    schema: LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_SCHEMA,
    stageId: 'LAFEA.3', sourceHash: authority.sourceHash,
    analysisDomain: domain, geometry,
    producerRef: `C3C-G006-${family}/GEOMETRY`,
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
      status: 'ACCEPTED_BY_STAGE_CONTRACT', producerRef: `C3C-G006-${family}/MESH`,
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
    stageId: 'LAFEA.3', geometryId: 'C3C-G006-RECTANGLE',
    coordinateSystemId: 'GLOBAL_XY', lengthUnit: 'mm',
    orientationPolicy: LAFEA_ANALYSIS_GEOMETRY_ORIENTATION_POLICY,
    vertices: [
      { vertexId: 'A', x: 0, y: 0 }, { vertexId: 'B', x: 100, y: 0 },
      { vertexId: 'C', x: 100, y: 50 }, { vertexId: 'D', x: 0, y: 50 },
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
    schema: 'lafea-analysis-mesh/v1', meshIdentity: 'C3C-G006-T6',
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
    schema: 'lafea-analysis-mesh/v1', meshIdentity: 'C3C-G006-Q8',
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
    profileIdentity: `C3C-G006-${family}`,
    sourceRevision: 'C3C-G006',
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
function hash(value) { return canonicalLafeaSha256({ schema: 'c3c-g006-test-hash/v1', value }); }
function expectCode(action, code) {
  assert.throws(action, (error) => error?.code === code || error?.message === code, code);
}
