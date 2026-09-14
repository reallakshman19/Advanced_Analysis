#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  createCanonicalLocalContinuumModel,
} from '../src/core/local-continuum/index.js';
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
  LAFEA_CONTINUUM_DELTA_T_LAW,
  LAFEA_CONTINUUM_THERMAL_MATERIAL_AUTHORITY_SCHEMA,
} from '../src/workspace/lafea-continuum-temperature-lowering.js';
import { validateLafeaContinuumProjectionEvidence } from '../src/workspace/lafea-continuum-projection-evidence.js';
import { compileLafeaContinuumSolverModel } from '../src/workspace/lafea-continuum-solver-model.js';
import { requireLafeaStageComposition } from '../src/workspace/lafea-stage-composition-root.js';
import { issueLafeaSourceAuthority } from '../src/workspace/lafea-source-authority.js';
import { patchSource } from './lafea.3-fixtures.mjs';

const ALPHA = 1.2e-5;
const DELTA_T = 50;
const EXPECTED_STRAIN = ALPHA * DELTA_T;
const TREF = 293.15;
const cases = [
  { family: 'T6', formulation: 'PLANE_STRESS' },
  { family: 'Q8', formulation: 'PLANE_STRAIN' },
];
const receipts = [];

for (const testCase of cases) {
  const fixture = compileFixture({ ...testCase, unit: 'C', alpha: ALPHA, referenceTemperatureKelvin: TREF });
  const projection = validateLafeaContinuumProjectionEvidence(fixture.model.projectionEvidence);
  const projectionEntry = projection.entries.find((row) => row.attachmentId === 'TEMP-REGION');
  assert.ok(projectionEntry, `${testCase.family}: temperature projection required`);
  const expectedIds = fixture.model.elements.map((row) => `TEMP-REGION/${row.elementId}`).sort();
  assert.deepEqual([...projectionEntry.compiledContributionIds].sort(), expectedIds);

  const input = buildLafeaContinuumCompiledExecutionInput(fixture.model);
  assert.ok(input.limitations.includes('GOVERNED_CONSTANT_ALPHA_DELTA_T_LOWERING_V1'));
  const loadCase = input.loadCases.find((row) => row.loadCaseId === 'TRACTION');
  assert.ok(loadCase, `${testCase.family}: TRACTION case required`);
  assert.equal(loadCase.temperatureLoads.length, fixture.model.elements.length);
  assert.deepEqual(loadCase.temperatureLoads.map((row) => row.temperatureLoadId).sort(), expectedIds);
  for (const row of loadCase.temperatureLoads) {
    close(row.thermalStrain, EXPECTED_STRAIN, 1e-15, `${testCase.family} thermal strain`);
    assert.ok(row.sourceReference.includes(LAFEA_CONTINUUM_DELTA_T_LAW));
    assert.ok(row.sourceReference.includes(fixture.thermalAuthority.sourceEvidence.sourceSemanticHash));
  }

  const canonicalKernelInput = createCanonicalLocalContinuumModel(input);
  const canonicalCase = canonicalKernelInput.loadCases.find((row) => row.loadCaseId === 'TRACTION');
  assert.equal(canonicalCase.temperatureLoads.length, fixture.model.elements.length);
  canonicalCase.temperatureLoads.forEach((row) => close(
    row.thermalStrain, EXPECTED_STRAIN, 1e-15, `${testCase.family} canonical thermal strain`,
  ));

  const kelvinFixture = compileFixture({ ...testCase, unit: 'K', alpha: ALPHA, referenceTemperatureKelvin: TREF });
  const kelvinInput = buildLafeaContinuumCompiledExecutionInput(kelvinFixture.model);
  const kelvinLoads = kelvinInput.loadCases.find((row) => row.loadCaseId === 'TRACTION').temperatureLoads;
  kelvinLoads.forEach((row) => close(
    row.thermalStrain, EXPECTED_STRAIN, 1e-15, `${testCase.family} kelvin-increment parity`,
  ));

  const alphaFixture = compileFixture({ ...testCase, unit: 'C', alpha: ALPHA * 1.1, referenceTemperatureKelvin: TREF });
  assert.notEqual(alphaFixture.model.solverModelHash, fixture.model.solverModelHash,
    `${testCase.family}: alpha mutation must invalidate solver-model identity`);
  const alphaLoad = buildLafeaContinuumCompiledExecutionInput(alphaFixture.model)
    .loadCases.find((row) => row.loadCaseId === 'TRACTION').temperatureLoads[0];
  close(alphaLoad.thermalStrain, EXPECTED_STRAIN * 1.1, 1e-15,
    `${testCase.family} alpha mutation thermal strain`);

  const referenceFixture = compileFixture({
    ...testCase, unit: 'C', alpha: ALPHA, referenceTemperatureKelvin: TREF + 10,
  });
  assert.notEqual(referenceFixture.model.solverModelHash, fixture.model.solverModelHash,
    `${testCase.family}: reference-temperature mutation must invalidate solver-model identity`);
  const referenceLoad = buildLafeaContinuumCompiledExecutionInput(referenceFixture.model)
    .loadCases.find((row) => row.loadCaseId === 'TRACTION').temperatureLoads[0];
  close(referenceLoad.thermalStrain, EXPECTED_STRAIN, 1e-15,
    `${testCase.family} ΔT remains an increment when reference authority changes`);

  const missingAuthority = structuredClone(fixture.model);
  delete missingAuthority.attachments.find((row) => row.attachmentId === 'TEMP-REGION')
    .payload.thermalMaterialAuthority;
  expectCode(() => buildLafeaContinuumCompiledExecutionInput(missingAuthority),
    'LAFEA_CONTINUUM_COMPILED_TEMPERATURE_SEMANTICS_NOT_QUALIFIED');

  const wrongMaterial = structuredClone(fixture.model);
  wrongMaterial.attachments.find((row) => row.attachmentId === 'TEMP-REGION')
    .payload.thermalMaterialAuthority.materialRef = 'OTHER';
  expectCode(() => buildLafeaContinuumCompiledExecutionInput(wrongMaterial),
    'LAFEA_CONTINUUM_COMPILED_TEMPERATURE_MATERIAL_AUTHORITY_MISMATCH');

  const badEvidence = structuredClone(fixture.model);
  badEvidence.attachments.find((row) => row.attachmentId === 'TEMP-REGION')
    .payload.thermalMaterialAuthority.sourceEvidence.sourceSemanticHash = 'UNHASHED';
  expectCode(() => buildLafeaContinuumCompiledExecutionInput(badEvidence),
    'LAFEA_CONTINUUM_COMPILED_TEMPERATURE_SOURCE_EVIDENCE_INVALID');

  receipts.push(Object.freeze({
    family: testCase.family,
    formulation: testCase.formulation,
    solverModelHash: fixture.model.solverModelHash,
    projectionHash: projection.projectionHash,
    thermalStrain: EXPECTED_STRAIN,
    contributionIds: expectedIds,
  }));
}

const bbar = compileFixture({
  family: 'T6', formulation: 'PLANE_STRAIN_BBAR', unit: 'C',
  alpha: ALPHA, referenceTemperatureKelvin: TREF,
});
expectCode(() => buildLafeaContinuumCompiledExecutionInput(bbar.model),
  'LAFEA_CONTINUUM_COMPILED_TEMPERATURE_BBAR_NOT_QUALIFIED');

const unsupportedUnit = compileFixture({
  family: 'T6', formulation: 'PLANE_STRESS', unit: 'C',
  alpha: ALPHA, referenceTemperatureKelvin: TREF,
});
unsupportedUnit.model = structuredClone(unsupportedUnit.model);
unsupportedUnit.model.attachments.find((row) => row.attachmentId === 'TEMP-REGION').payload.unit = 'F';
expectCode(() => buildLafeaContinuumCompiledExecutionInput(unsupportedUnit.model),
  'LAFEA_CONTINUUM_COMPILED_TEMPERATURE_UNIT_UNSUPPORTED');

console.log(JSON.stringify({
  schema: 'lafea3-c3c-temperature-delta-check/v1',
  status: 'PASS',
  stageId: 'LAFEA.3',
  law: LAFEA_CONTINUUM_DELTA_T_LAW,
  authoritySchema: LAFEA_CONTINUUM_THERMAL_MATERIAL_AUTHORITY_SCHEMA,
  productionFamilies: receipts,
  exactOracle: { coefficientPerKelvin: ALPHA, deltaTemperatureKelvin: DELTA_T, thermalStrain: EXPECTED_STRAIN },
  celsiusKelvinIncrementParity: true,
  materialAuthorityMappedToRegionElements: true,
  alphaMutationInvalidatesModel: true,
  referenceTemperatureMutationInvalidatesModel: true,
  missingAuthorityFailsClosed: true,
  mismatchedMaterialFailsClosed: true,
  tamperedSourceEvidenceFailsClosed: true,
  bbarThermalAuthority: 'NOT_QUALIFIED_FAIL_CLOSED',
  kernelThermalFormulationChanged: false,
  releaseAuthorityGranted: false,
}));

function compileFixture({ family, formulation, unit, alpha, referenceTemperatureKelvin }) {
  const composition = requireLafeaStageComposition('LAFEA.3');
  const source = composition.normalizeDocument(patchSource({ formulation, thickness: 10 }));
  const canonicalInput = composition.canonicalize(source);
  const authority = issueLafeaSourceAuthority('LAFEA.3', source, `C3C-G005-${family}-${formulation}-${unit}`);
  const geometry = rectangleGeometry();
  const caseIds = canonicalInput.loadCases.map((row) => row.loadCaseId);
  const thermalAuthority = thermalMaterialAuthority(alpha, referenceTemperatureKelvin);
  const domain = createLafeaContinuumAnalysisDomain({
    schema: LAFEA_CONTINUUM_ANALYSIS_DOMAIN_SCHEMA,
    stageId: 'LAFEA.3',
    sourceHash: authority.sourceHash,
    applicationRef: `C3C-G005-${family}-${formulation}`,
    units: { length: 'mm', force: 'N', stress: 'MPa', temperature: unit },
    formulation,
    region: { regionId: 'REGION-1', materialRef: 'MAT' },
    physicalCases: caseIds.map((caseId) => ({ caseId })),
    attachments: [
      attachment('FIX-A', 'RESTRAINT', 'VERTEX', 'A', caseIds, { ux: true, uy: true }),
      attachment('FIX-D', 'RESTRAINT', 'VERTEX', 'D', caseIds, { ux: true }),
      attachment('TEMP-REGION', 'TEMPERATURE', 'REGION', 'REGION-1', ['TRACTION'], {
        value: DELTA_T,
        unit,
        thermalMaterialAuthority: thermalAuthority,
      }),
    ],
  }, geometry);
  const geometryEvidence = createLafeaAnalysisGeometryEvidence({
    schema: LAFEA_ANALYSIS_GEOMETRY_EVIDENCE_SCHEMA,
    stageId: 'LAFEA.3', sourceHash: authority.sourceHash,
    analysisDomain: domain, geometry,
    producerRef: `C3C-G005-${family}/GEOMETRY`,
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
      status: 'ACCEPTED_BY_STAGE_CONTRACT', producerRef: `C3C-G005-${family}/MESH`,
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
  return { model, thermalAuthority };
}

function thermalMaterialAuthority(alpha, referenceTemperatureKelvin) {
  return {
    schema: LAFEA_CONTINUUM_THERMAL_MATERIAL_AUTHORITY_SCHEMA,
    law: LAFEA_CONTINUUM_DELTA_T_LAW,
    materialRef: 'MAT',
    coefficientPerKelvin: alpha,
    referenceTemperatureKelvin,
    sourceEvidence: {
      sourceId: 'C3C-G005-MATERIAL-AUTHORITY',
      sourceRevision: '1',
      sourceSemanticHash: hash({ alpha, referenceTemperatureKelvin }),
    },
  };
}

function rectangleGeometry() {
  return createLafeaAnalysisGeometry({
    schema: LAFEA_ANALYSIS_GEOMETRY_SCHEMA,
    stageId: 'LAFEA.3', geometryId: 'C3C-G005-RECTANGLE',
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
    schema: 'lafea-analysis-mesh/v1', meshIdentity: 'C3C-G005-T6',
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
    schema: 'lafea-analysis-mesh/v1', meshIdentity: 'C3C-G005-Q8',
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
    schema: 'lafea-mesh-profile/v1', profileIdentity: `C3C-G005-${family}`,
    sourceRevision: 'C3C-G005', semanticHash: undefined,
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
function hash(value) { return canonicalLafeaSha256({ schema: 'c3c-g005-test-hash/v1', value }); }
function close(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, observed ${actual}`);
}
function expectCode(action, code) {
  assert.throws(action, (error) => error?.code === code, `expected ${code}`);
}
