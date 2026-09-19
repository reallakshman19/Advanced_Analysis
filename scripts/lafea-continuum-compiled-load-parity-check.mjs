#!/usr/bin/env node
import assert from 'node:assert/strict';
import { calculateLocalContinuum } from '../src/core/local-continuum/index.js';
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
import {
  LAFEA_CONTINUUM_ANALYSIS_DOMAIN_SCHEMA,
  createLafeaContinuumAnalysisDomain,
} from '../src/workspace/lafea-continuum-analysis-domain.js';
import { canonicalLafeaSha256 } from '../src/workspace/lafea-canonical-sha256.js';
import { executeLafeaContinuumCompiledForParity } from '../src/workspace/lafea-continuum-compiled-execution.js';
import { compileLafeaContinuumSolverModel } from '../src/workspace/lafea-continuum-solver-model.js';
import { requireLafeaStageComposition } from '../src/workspace/lafea-stage-composition-root.js';
import { issueLafeaSourceAuthority } from '../src/workspace/lafea-source-authority.js';
import { triangleSource } from './lafea.3-fixtures.mjs';
import {
  LAFEA_NUMERIC_PARITY_RELATIVE_TOLERANCE,
  compareLafeaNumericParity,
} from './lib/lafea-numeric-parity.mjs';

const cases = [
  tractionCase(),
  pressureCase(),
  bodyForceCase(),
  imposedDisplacementCase(),
];

const parityEvidence = [];

for (const testCase of cases) {
  const fixture = compileFixture(testCase);
  const legacy = calculateLocalContinuum(fixture.canonical);
  const parity = executeLafeaContinuumCompiledForParity(fixture.compiled);
  const repeated = executeLafeaContinuumCompiledForParity(fixture.compiled);
  assert.equal(legacy.qualification.state, 'ACCEPTED', `${testCase.kind}: legacy rejected`);
  assert.equal(parity.qualificationState, 'ACCEPTED', `${testCase.kind}: compiled rejected`);
  assert.equal(parity.mode, 'PARITY_ONLY_NOT_RETAINED');
  assert.equal(parity.lifecycleExecutionPublished, false);
  assert.equal(parity.lifecycleRecoveryPublished, false);
  assert.equal(parity.releaseQualified, false);
  // The compiled route against itself is a true bit-exactness contract and
  // stays exact for every parity class.
  assert.deepEqual(parity, repeated, `${testCase.kind}: compiled execution must be deterministic`);

  const actual = numericalProjection(parity.executionResult);
  const expected = numericalProjection(legacy);
  if (testCase.parityClass === 'EXACT_KERNEL_PARITY') {
    // Both routes hand the same load to the same kernel integration, so the
    // arithmetic is identical and any difference at all is a real change.
    assert.deepEqual(actual, expected, `${testCase.kind}: legacy/compiled numerical mismatch`);
    parityEvidence.push({
      kind: testCase.kind,
      parityClass: testCase.parityClass,
      maxRelativeDeviation: 0,
    });
  } else {
    // The compiled route integrates this load itself, on analytic source
    // geometry and its own quadrature, so the two routes agree mathematically
    // but not bit-for-bit. Compare within the frozen contract tolerance.
    const comparison = compareLafeaNumericParity(actual, expected);
    assert.ok(
      comparison.ok,
      `${testCase.kind}: legacy/compiled numerical mismatch ${JSON.stringify(comparison.mismatch)}`,
    );
    parityEvidence.push({
      kind: testCase.kind,
      parityClass: testCase.parityClass,
      comparedNumbers: comparison.comparedNumbers,
      maxRelativeDeviation: comparison.maxRelativeDeviation,
    });
  }

  // A compiler-lowered load is additionally held to an oracle neither route
  // computes, so a tolerance comparison can never be the only thing checking it.
  if (testCase.sourceResultant) assertSourceResultant(testCase, parity.executionResult);
}

console.log(JSON.stringify({
  schema: 'lafea-continuum-compiled-load-parity-check/v1',
  check: 'lafea-continuum-compiled-load-parity',
  status: 'PASS',
  stageId: 'LAFEA.3',
  parityKinds: cases.map((row) => row.kind),
  relativeTolerance: LAFEA_NUMERIC_PARITY_RELATIVE_TOLERANCE,
  parityEvidence,
  sourceResultantOracleKinds: cases.filter((row) => row.sourceResultant).map((row) => row.kind),
  sameExistingNumericalKernel: true,
  deterministicCompiledExecution: true,
  lifecycleExecutionPublished: false,
  releaseAuthorityChanged: false,
  authoritativeRunChanged: false,
}));

/**
 * Independent oracle for a compiler-lowered load.
 *
 * The applied resultant is derived from the source segment geometry, the
 * declared pressure and the section thickness -- not from either execution
 * path -- and the model is in static equilibrium, so the support reactions must
 * balance it in Fx, Fy and Mz about the global origin.
 */
function assertSourceResultant(testCase, executionResult) {
  const oracle = testCase.sourceResultant;
  const caseResult = executionResult.loadCaseResults
    .find((row) => row.loadCaseId === oracle.loadCaseId);
  assert.ok(caseResult, `${testCase.kind}: load case ${oracle.loadCaseId} absent`);
  const reaction = caseResult.supportReactions.reduce((sum, row) => {
    const [nodeId, dof] = String(row.dofIdentity).split(':');
    const point = oracle.nodeCoordinates[nodeId];
    assert.ok(point, `${testCase.kind}: no oracle coordinate for reaction node ${nodeId}`);
    if (dof === 'UX') {
      return { fx: sum.fx + row.value, fy: sum.fy, mz: sum.mz - point.y * row.value };
    }
    assert.equal(dof, 'UY', `${testCase.kind}: unexpected reaction dof ${row.dofIdentity}`);
    return { fx: sum.fx, fy: sum.fy + row.value, mz: sum.mz + point.x * row.value };
  }, { fx: 0, fy: 0, mz: 0 });

  const forceTolerance = oracle.forceScale * LAFEA_NUMERIC_PARITY_RELATIVE_TOLERANCE;
  const momentTolerance = oracle.momentScale * LAFEA_NUMERIC_PARITY_RELATIVE_TOLERANCE;
  assert.ok(
    Math.abs(reaction.fx + oracle.forceX) <= forceTolerance,
    `${testCase.kind}: reactions Fx ${reaction.fx} do not balance source ${oracle.forceX}`,
  );
  assert.ok(
    Math.abs(reaction.fy + oracle.forceY) <= forceTolerance,
    `${testCase.kind}: reactions Fy ${reaction.fy} do not balance source ${oracle.forceY}`,
  );
  assert.ok(
    Math.abs(reaction.mz + oracle.momentZ) <= momentTolerance,
    `${testCase.kind}: reactions Mz ${reaction.mz} do not balance source ${oracle.momentZ}`,
  );
}

function compileFixture(testCase) {
  const composition = requireLafeaStageComposition('LAFEA.3');
  const source = composition.normalizeDocument(testCase.source);
  const canonical = composition.canonicalize(source);
  const authority = issueLafeaSourceAuthority('LAFEA.3', source, `STAGE12B-PARITY/${testCase.kind}`);
  const geometry = triangleGeometry();
  const caseIds = canonical.loadCases.map((row) => row.loadCaseId);
  const domain = createLafeaContinuumAnalysisDomain({
    schema: LAFEA_CONTINUUM_ANALYSIS_DOMAIN_SCHEMA,
    stageId: 'LAFEA.3', sourceHash: authority.sourceHash,
    applicationRef: `STAGE12B/LOAD_PARITY/${testCase.kind}`,
    units: { length: 'mm', force: 'N', stress: 'MPa', temperature: 'C' },
    formulation: 'PLANE_STRESS',
    region: { regionId: 'REGION-1', materialRef: 'MAT' },
    physicalCases: caseIds.map((caseId) => ({ caseId })),
    attachments: [
      attachment('FIX-A', 'RESTRAINT', 'VERTEX', 'A', caseIds, { ux: true, uy: true }),
      attachment('FIX-B-Y', 'RESTRAINT', 'VERTEX', 'B', caseIds, { uy: true }),
      ...testCase.attachments,
    ],
  }, geometry);
  const geometryEvidence = createLafeaAnalysisGeometryEvidence({
    schema: LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_SCHEMA,
    stageId: 'LAFEA.3', sourceHash: authority.sourceHash, analysisDomain: domain, geometry,
    producerRef: 'STAGE12B/LOAD-PARITY-GEOMETRY',
    profileId: LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_PROFILE,
  });
  const profile = meshProfile();
  const mesh = sourceT3Mesh();
  const meshHash = lafeaAnalysisMeshContentHash(mesh);
  const meshEvidence = createLafeaAnalysisMeshEvidenceV2({
    schema: LAFEA_ANALYSIS_MESH_INTAKE_V2_SCHEMA,
    stageId: 'LAFEA.3', sourceHash: authority.sourceHash,
    analysisDomainHash: domain.semanticHash, analysisGeometryHash: geometry.semanticHash,
    meshProfile: profile, mesh,
    authority: {
      schema: LAFEA_ANALYSIS_MESH_AUTHORITY_V2_SCHEMA,
      stageId: 'LAFEA.3', authorityRole: LAFEA_ANALYSIS_MESH_AUTHORITY_V2_ROLE,
      status: 'ACCEPTED_BY_STAGE_CONTRACT', producerRef: 'STAGE12B/LOAD-PARITY-MESH',
      sourceHash: authority.sourceHash, analysisDomainHash: domain.semanticHash,
      analysisGeometryHash: geometry.semanticHash, meshProfileHash: profile.semanticHash,
      meshHash, capabilityHash: hash('CAPABILITY'), qualificationHash: hash('QUALIFICATION'),
      planHash: hash('PLAN'),
    },
  });
  const compiled = compileLafeaContinuumSolverModel({
    sourceAuthority: authority, source, canonicalInput: canonical,
    analysisDomain: domain, geometryEvidence, meshEvidence,
  });
  return { canonical, compiled };
}

function tractionCase() {
  const source = singleCaseSource('TRACTION');
  source.loadCases[0].edgeTractions.push({
    tractionId: 'T1', elementId: 'E1', edgeNodeIds: ['B', 'C'],
    tx: 10, ty: -2, sourceReference: 'TRACTION#T1',
  });
  return {
    kind: 'TRACTION', source, parityClass: 'EXACT_KERNEL_PARITY',
    attachments: [attachment('T1', 'TRACTION', 'SEGMENT', 'S2', ['TRACTION'], { tx: 10, ty: -2, unit: 'MPa' })],
  };
}

function pressureCase() {
  const source = singleCaseSource('PRESSURE');
  source.loadCases[0].pressureLoads.push({
    pressureLoadId: 'P1', elementId: 'E1', edgeNodeIds: ['B', 'C'],
    pressure: 3, sourceReference: 'PRESSURE#P1',
  });
  return {
    kind: 'PRESSURE', source,
    attachments: [attachment('P1', 'PRESSURE', 'SEGMENT', 'S2', ['PRESSURE'], { pressure: 3, unit: 'MPa' })],
    // Since #1769 G004 the compiled route integrates pressure itself, on the
    // analytic source segment with its own quadrature, rather than handing a
    // pressureLoad to the kernel. The two routes are mathematically equal on a
    // straight edge but not bit-for-bit.
    parityClass: 'COMPILER_LOWERED_PARITY',
    // Segment S2 runs B(100,0) -> C(0,100) on a CCW OUTER loop, so the
    // material-inward normal is the unit tangent rotated +90 degrees:
    //   t = (-1, 1)/sqrt(2),  n = (-1, -1)/sqrt(2),  L = 100*sqrt(2) mm
    // With p = 3 MPa and t = 10 mm the applied resultant is
    //   F = p*t*L*n = 3*10*100*sqrt(2)*(-1,-1)/sqrt(2) = (-3000, -3000) N
    // and about the global origin Mz integrates to exactly zero:
    //   Mz = integral(x*fy - y*fx) ds = -3000*L/sqrt(2) + 15*L^2 = 0
    sourceResultant: {
      loadCaseId: 'PRESSURE',
      forceX: -3000,
      forceY: -3000,
      momentZ: 0,
      forceScale: 3000,
      momentScale: 300000,
      nodeCoordinates: { A: { x: 0, y: 0 }, B: { x: 100, y: 0 }, C: { x: 0, y: 100 } },
    },
  };
}

function bodyForceCase() {
  const source = singleCaseSource('BODY_FORCE');
  source.loadCases[0].bodyForces.push({
    bodyForceId: 'BF1', elementId: 'E1', bx: 0.002, by: -0.004,
    sourceReference: 'BODYFORCE#BF1',
  });
  return {
    kind: 'BODY_FORCE', source, parityClass: 'EXACT_KERNEL_PARITY',
    attachments: [attachment('BF1', 'BODY_FORCE', 'REGION', 'REGION-1', ['BODY_FORCE'], {
      bx: 0.002, by: -0.004, unit: 'N/mm^3',
    })],
  };
}

function imposedDisplacementCase() {
  const source = singleCaseSource('IMPOSED_DISPLACEMENT');
  source.loadCases[0].imposedDisplacements.push({
    imposedDisplacementId: 'D1', nodeId: 'C', dof: 'UX', value: 5,
    sourceReference: 'IMPOSED#D1',
  });
  return {
    kind: 'IMPOSED_DISPLACEMENT', source, parityClass: 'EXACT_KERNEL_PARITY',
    attachments: [attachment('D1', 'IMPOSED_DISPLACEMENT', 'VERTEX', 'C', ['IMPOSED_DISPLACEMENT'], {
      ux: 5, unit: 'mm',
    })],
  };
}

function singleCaseSource(loadCaseId) {
  const source = triangleSource();
  source.loadCases = [{
    loadCaseId, nodalForces: [], edgeTractions: [], pressureLoads: [], bodyForces: [],
    temperatureLoads: [], imposedDisplacements: [], sourceReference: `CASE#${loadCaseId}`,
  }];
  source.resultRequests = { loadCaseIds: [loadCaseId] };
  return source;
}

function triangleGeometry() {
  return createLafeaAnalysisGeometry({
    schema: LAFEA_ANALYSIS_GEOMETRY_SCHEMA,
    stageId: 'LAFEA.3', geometryId: 'TRIANGLE-DOMAIN', coordinateSystemId: 'GLOBAL_XY',
    lengthUnit: 'mm', orientationPolicy: LAFEA_ANALYSIS_GEOMETRY_ORIENTATION_POLICY,
    vertices: [
      { vertexId: 'A', x: 0, y: 0 }, { vertexId: 'B', x: 100, y: 0 },
      { vertexId: 'C', x: 0, y: 100 },
    ],
    segments: [line('S1', 'A', 'B'), line('S2', 'B', 'C'), line('S3', 'C', 'A')],
    loops: [{ loopId: 'OUTER', role: 'OUTER', segmentIds: ['S1', 'S2', 'S3'] }],
  });
}

function sourceT3Mesh() {
  return {
    schema: 'lafea-analysis-mesh/v1', meshIdentity: 'STAGE12B-LOAD-PARITY-T3',
    nodes: [node('A', 0, 0), node('B', 100, 0), node('C', 0, 100)],
    elements: [{ elementId: 'E1', elementType: 'T3', nodeIds: ['A', 'B', 'C'] }],
  };
}

function meshProfile() {
  const defaults = defaultProfileFields(PROFILE_KINDS.MESH);
  return canonicalProfile(PROFILE_KINDS.MESH, {
    schema: 'lafea-mesh-profile/v1', profileIdentity: 'STAGE12B-LOAD-PARITY-T3',
    sourceRevision: '12B.3', semanticHash: undefined,
    fields: {
      ...defaults,
      continuumElement: 'T3',
      shellElement: 'CST_DKT_TRI3_THIN_SHELL_V1',
      globalTargetSize: 100,
    },
  });
}

function numericalProjection(result) {
  return result.loadCaseResults.map((row) => ({
    loadCaseId: row.loadCaseId,
    nodalDisplacements: row.nodalDisplacements.map(({ nodeId, ux, uy }) => ({ nodeId, ux, uy })),
    supportReactions: row.supportReactions,
    freeDofResiduals: row.freeDofResiduals,
    equilibrium: row.equilibrium,
    totalStrainEnergy: row.totalStrainEnergy,
    elementResults: row.elementResults.map((element) => ({
      elementId: element.elementId,
      nodeIds: element.nodeIds,
      strain: element.strain,
      stress: element.stress,
      principalMaximum: element.principalMaximum,
      principalMinimum: element.principalMinimum,
      maximumInPlaneShear: element.maximumInPlaneShear,
      vonMises: element.vonMises,
      strainEnergy: element.strainEnergy,
    })),
  }));
}

function attachment(attachmentId, kind, targetType, targetId, physicalCaseIds, payload) {
  return { attachmentId, kind, targetType, targetId, physicalCaseIds, payload };
}
function line(segmentId, startVertexId, endVertexId) {
  return { segmentId, type: 'LINE', startVertexId, endVertexId };
}
function node(nodeId, x, y) { return { nodeId, x, y, z: 0 }; }
function hash(value) { return canonicalLafeaSha256({ schema: 'stage12b-load-parity-hash/v1', value }); }
