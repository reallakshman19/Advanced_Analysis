#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  canonicalProfile,
  defaultProfileFields,
  PROFILE_KINDS,
} from '../src/core/lafea-profile-contract/index.js';
import {
  createLafeaAnalysisGeometry,
} from '../src/workspace/lafea-analysis-geometry-contract.js';
import {
  createLafeaAnalysisGeometryEvidence,
} from '../src/workspace/lafea-analysis-geometry-evidence.js';
import {
  createLafeaContinuumAnalysisDomain,
} from '../src/workspace/lafea-continuum-analysis-domain.js';
import { buildLafeaContinuumCompiledExecutionInput } from '../src/workspace/lafea-continuum-compiled-input.js';
import {
  createLafeaContinuumLoadResultantEvidence,
  validateLafeaContinuumLoadResultantEvidence,
} from '../src/workspace/lafea-continuum-load-resultant-evidence.js';
import { validateLafeaContinuumProjectionEvidence } from '../src/workspace/lafea-continuum-projection-evidence.js';
import { compileLafeaContinuumSolverModel } from '../src/workspace/lafea-continuum-solver-model.js';
import {
  LAFEA_B02D_POLAR_V2_PROFILE_SOURCE_REVISION,
  b02dProfileIdentityV2,
  lafeaMeshGenerationConfiguration,
  produceLafeaAnalysisMeshEvidence,
} from '../src/workspace/lafea-mesh-producer-binding.js';
import { requireLafeaStageComposition } from '../src/workspace/lafea-stage-composition-root.js';
import { issueLafeaSourceAuthority } from '../src/workspace/lafea-source-authority.js';
import { patchSource } from './lafea.3-fixtures.mjs';

const PRESSURE = 4;
const THICKNESS = 10;
const H = 20;
const CASE_ID = 'TRACTION';
const SOURCE_PRESSURE_LAW = 'SOURCE_GEOMETRY_INWARD_NORMAL_V1';
const SOURCE_PRESSURE_AUTHORITY = 'ANALYSIS_GEOMETRY_ORIENTED_SEGMENT_V1';
const receipts = [];

for (const family of ['T6', 'Q8']) {
  const fixture = compileFixture(family);
  const projection = validateLafeaContinuumProjectionEvidence(fixture.model.projectionEvidence);
  const outerProjection = requireProjection(projection, 'OUTER-P');
  const holeProjection = requireProjection(projection, 'HOLE-P');
  assert.equal(outerProjection.sourceFeature.geometry.type, 'CIRCULAR_ARC');
  assert.equal(holeProjection.sourceFeature.geometry.type, 'CIRCULAR_ARC');
  assert.deepEqual(outerProjection.sourceFeature.geometry.loopBindings, [{ loopId: 'OUTER', role: 'OUTER' }]);
  assert.deepEqual(holeProjection.sourceFeature.geometry.loopBindings, [{ loopId: 'HOLE', role: 'HOLE' }]);
  assert.ok(outerProjection.compiledContributionIds.length >= 3);
  assert.ok(holeProjection.compiledContributionIds.length >= 3);
  assert.ok(outerProjection.compiledContributionIds.every((id) => /^OUTER-P\/\d+\/\d+\//u.test(id)));
  assert.ok(holeProjection.compiledContributionIds.every((id) => /^HOLE-P\/\d+\/\d+\//u.test(id)));

  const input = buildLafeaContinuumCompiledExecutionInput(fixture.model);
  const loadCase = input.loadCases.find((row) => row.loadCaseId === CASE_ID);
  assert.ok(loadCase, `${family}: ${CASE_ID} load case required`);
  assert.equal(loadCase.pressureLoads.length, 0, `${family}: source pressure must be lowered to nodal forces`);
  assert.ok(input.limitations.includes('SOURCE_NORMAL_PRESSURE_CONSISTENT_NODAL_LOWERING_V1'));
  const outerLoads = sourcePressureLoads(loadCase, 'OUTER-P');
  const holeLoads = sourcePressureLoads(loadCase, 'HOLE-P');
  assert.equal(outerLoads.length, outerProjection.compiledContributionIds.length);
  assert.equal(holeLoads.length, holeProjection.compiledContributionIds.length);
  assert.deepEqual(new Set(outerLoads.map((row) => row.loadId)), new Set(outerProjection.compiledContributionIds));
  assert.deepEqual(new Set(holeLoads.map((row) => row.loadId)), new Set(holeProjection.compiledContributionIds));

  const evidence = validateLafeaContinuumLoadResultantEvidence(
    createLafeaContinuumLoadResultantEvidence(fixture.model, input),
  );
  const outer = requirePressureEvidence(evidence, 'OUTER-P');
  const hole = requirePressureEvidence(evidence, 'HOLE-P');
  assert.equal(evidence.pressureSourceNormalQualified, true);
  assert.equal(evidence.bodyForceResultantQualified, false);
  assertPressureRow(outer, { forceX: -4000, forceY: -4000, momentZ: 0 }, `${family} outer`);
  assertPressureRow(hole, { forceX: 800, forceY: -800, momentZ: 0 }, `${family} hole`);
  assert.ok(outer.compiledResultant.forceX < 0 && outer.compiledResultant.forceY < 0,
    `${family}: OUTER O1 pressure must act toward the annular material`);
  assert.ok(hole.compiledResultant.forceX > 0 && hole.compiledResultant.forceY < 0,
    `${family}: HOLE H1 pressure must act away from the hole into material`);
  assert.equal(
    createLafeaContinuumLoadResultantEvidence(fixture.model, input).loadResultantEvidenceHash,
    evidence.loadResultantEvidenceHash,
    `${family}: pressure resultant evidence must replay deterministically`,
  );

  const contributionDrift = structuredClone(input);
  const driftCase = contributionDrift.loadCases.find((row) => row.loadCaseId === CASE_ID);
  const drift = driftCase.nodalForces.find((row) => row.loadId === outerProjection.compiledContributionIds[0]);
  assert.ok(drift, `${family}: pressure contribution required for negative control`);
  drift.loadId = 'OUTER-P/DRIFT';
  expectCode(() => createLafeaContinuumLoadResultantEvidence(fixture.model, contributionDrift),
    'LAFEA_CONTINUUM_RESULTANT_CONTRIBUTION_CUSTODY_MISMATCH');

  receipts.push(Object.freeze({
    family,
    meshHash: fixture.meshEvidence.meshHash,
    solverModelHash: fixture.model.solverModelHash,
    projectionHash: projection.projectionHash,
    loadResultantEvidenceHash: evidence.loadResultantEvidenceHash,
    outerContributionCount: outerProjection.compiledContributionIds.length,
    holeContributionCount: holeProjection.compiledContributionIds.length,
  }));
}

console.log(JSON.stringify({
  schema: 'lafea3-c3c-source-pressure-compiler-check/v1',
  status: 'PASS',
  stageId: 'LAFEA.3',
  productionFamilies: receipts,
  sourceNormalAuthority: SOURCE_PRESSURE_AUTHORITY,
  pressureLaw: SOURCE_PRESSURE_LAW,
  curvedOuterPressureQualified: true,
  curvedHolePressureQualified: true,
  forceAndMomentPreserved: true,
  projectionContributionCustody: true,
  deterministicReplay: true,
  kernelPressureSchemaChanged: false,
  bodyForceResultantQualified: false,
  releaseAuthorityGranted: false,
}, null, 2));

function compileFixture(family) {
  const composition = requireLafeaStageComposition('LAFEA.3');
  const source = composition.normalizeDocument(patchSource({ thickness: THICKNESS }));
  const canonicalInput = composition.canonicalize(source);
  assert.ok(canonicalInput.loadCases.some((row) => row.loadCaseId === CASE_ID));
  const authority = issueLafeaSourceAuthority('LAFEA.3', source, `C3C-G004-${family}`);
  const geometry = annulusGeometry();
  const caseIds = canonicalInput.loadCases.map((row) => row.loadCaseId);
  const domain = createLafeaContinuumAnalysisDomain({
    schema: 'lafea-continuum-analysis-domain/v1',
    stageId: 'LAFEA.3',
    sourceHash: authority.sourceHash,
    applicationRef: `C3C-G004-${family}`,
    units: { length: 'mm', force: 'N', stress: 'MPa', temperature: 'C' },
    formulation: 'PLANE_STRESS',
    region: { regionId: 'REGION-1', materialRef: 'MAT' },
    physicalCases: caseIds.map((caseId) => ({ caseId })),
    attachments: [
      attachment('OUTER-P', 'OUTER', CASE_ID),
      attachment('HOLE-P', 'H1', CASE_ID),
    ],
  }, geometry);
  const geometryEvidence = createLafeaAnalysisGeometryEvidence({
    schema: 'lafea-analysis-geometry-evidence/v1',
    stageId: 'LAFEA.3', sourceHash: authority.sourceHash,
    analysisDomain: domain, geometry,
    producerRef: `C3C-G004-${family}/ANNULUS`,
    profileId: 'LAFEA3_DOMAIN_FIRST_GEOMETRY_V1',
  });
  const profile = meshProfile(family);
  const stage = {
    stageId: 'LAFEA.3',
    sourceAuthority: { stageId: 'LAFEA.3', sourceHash: authority.sourceHash },
    retainedAnalysisGeometryEvidence: geometryEvidence,
    analysisDomainProjection: { state: 'CURRENT_PASS', analysisDomainHash: domain.semanticHash },
    analysisGeometryProjection: { state: 'CURRENT_PASS', analysisGeometryHash: geometry.semanticHash },
  };
  const produced = produceLafeaAnalysisMeshEvidence(stage, lafeaMeshGenerationConfiguration(profile));
  assert.equal(produced.evidence.qualification, 'PASS');
  assert.equal(produced.evidence.mesh.elements.every((row) => row.elementType === family), true);
  const model = compileLafeaContinuumSolverModel({
    sourceAuthority: authority,
    source,
    canonicalInput,
    analysisDomain: domain,
    geometryEvidence,
    meshEvidence: produced.evidence,
  });
  return { model, meshEvidence: produced.evidence };
}

function meshProfile(family) {
  const fields = defaultProfileFields(PROFILE_KINDS.MESH);
  return canonicalProfile(PROFILE_KINDS.MESH, {
    schema: 'lafea-mesh-profile/v1',
    profileIdentity: b02dProfileIdentityV2(family, H),
    sourceRevision: LAFEA_B02D_POLAR_V2_PROFILE_SOURCE_REVISION,
    semanticHash: undefined,
    fields: { ...fields, continuumElement: family, globalTargetSize: H },
  });
}

function annulusGeometry() {
  return createLafeaAnalysisGeometry({
    schema: 'lafea-analysis-geometry/v1', stageId: 'LAFEA.3', geometryId: 'C3C-G004-ANNULUS',
    coordinateSystemId: 'GLOBAL_XY', lengthUnit: 'mm', orientationPolicy: 'OUTER_CCW_HOLES_CW_V1',
    vertices: [
      v('OE', 100, 0), v('ON', 0, 100), v('OW', -100, 0), v('OS', 0, -100),
      v('HE', 20, 0), v('HN', 0, 20), v('HW', -20, 0), v('HS', 0, -20),
    ],
    segments: [
      arc('O1', 'OE', 'ON', 100, 'CCW'), arc('O2', 'ON', 'OW', 100, 'CCW'),
      arc('O3', 'OW', 'OS', 100, 'CCW'), arc('O4', 'OS', 'OE', 100, 'CCW'),
      arc('H1', 'HE', 'HS', 20, 'CW'), arc('H2', 'HS', 'HW', 20, 'CW'),
      arc('H3', 'HW', 'HN', 20, 'CW'), arc('H4', 'HN', 'HE', 20, 'CW'),
    ],
    loops: [
      { loopId: 'OUTER', role: 'OUTER', segmentIds: ['O1', 'O2', 'O3', 'O4'] },
      { loopId: 'HOLE', role: 'HOLE', segmentIds: ['H1', 'H2', 'H3', 'H4'] },
    ],
  });
}

function attachment(attachmentId, targetId, caseId) {
  return {
    attachmentId, kind: 'PRESSURE', targetType: 'SEGMENT', targetId,
    physicalCaseIds: [caseId], payload: { pressure: PRESSURE, unit: 'MPa' },
  };
}
function v(vertexId, x, y) { return { vertexId, x, y }; }
function arc(segmentId, startVertexId, endVertexId, radius, sweep) {
  return { segmentId, type: 'CIRCULAR_ARC', startVertexId, endVertexId, centerX: 0, centerY: 0, radius, sweep };
}
function requireProjection(projection, attachmentId) {
  const row = projection.entries.find((entry) => entry.attachmentId === attachmentId);
  assert.ok(row, `${attachmentId}: projection entry required`);
  return row;
}
function sourcePressureLoads(loadCase, attachmentId) {
  return loadCase.nodalForces.filter((row) =>
    row.sourceReference.startsWith(`COMPILED_SOURCE_PRESSURE#${attachmentId}/${SOURCE_PRESSURE_AUTHORITY}/`));
}
function requirePressureEvidence(evidence, attachmentId) {
  const row = evidence.evaluated.find((entry) => entry.attachmentId === attachmentId);
  assert.ok(row, `${attachmentId}: pressure resultant evidence required`);
  assert.equal(row.kind, 'PRESSURE');
  assert.equal(row.pressureLaw, SOURCE_PRESSURE_LAW);
  assert.equal(row.sourceBoundaryAuthority, SOURCE_PRESSURE_AUTHORITY);
  assert.equal(row.comparison.status, 'PASS');
  return row;
}
function assertPressureRow(row, expected, label) {
  close(row.sourceResultant.forceX, expected.forceX, 1e-9, `${label} source Fx`);
  close(row.sourceResultant.forceY, expected.forceY, 1e-9, `${label} source Fy`);
  close(row.sourceResultant.momentZ, expected.momentZ, 1e-9, `${label} source Mz`);
  close(row.compiledResultant.forceX, expected.forceX, row.comparison.forceTolerance, `${label} compiled Fx`);
  close(row.compiledResultant.forceY, expected.forceY, row.comparison.forceTolerance, `${label} compiled Fy`);
  close(row.compiledResultant.momentZ, expected.momentZ, row.comparison.momentTolerance, `${label} compiled Mz`);
}
function close(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}, tolerance ${tolerance}`);
}
function expectCode(action, code) {
  assert.throws(action, (error) => error?.code === code, `expected ${code}`);
}
