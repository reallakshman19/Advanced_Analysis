#!/usr/bin/env node
import assert from 'node:assert/strict';
import { canonicalLafeaSha256 } from '../src/workspace/lafea-canonical-sha256.js';
import {
  LAFEA_CONTINUUM_PHYSICAL_PROBE_SCHEMA,
  evaluateLafeaContinuumPhysicalProbe,
} from '../src/workspace/lafea-continuum-physical-probe.js';

const E = 200000;
const NU = 0.25;
const FACTOR = E / (1 - NU ** 2);
const D = [
  [FACTOR, NU * FACTOR, 0],
  [NU * FACTOR, FACTOR, 0],
  [0, 0, E / (2 * (1 + NU))],
];
const STRAIN = { epsilonX: 0.001, epsilonY: 0.0008, gammaXY: 0.0003 };
const EXPECTED = {
  sigmaX: D[0][0] * STRAIN.epsilonX + D[0][1] * STRAIN.epsilonY,
  sigmaY: D[1][0] * STRAIN.epsilonX + D[1][1] * STRAIN.epsilonY,
  tauXY: D[2][2] * STRAIN.gammaXY,
};
const ROOT = Math.sqrt(((EXPECTED.sigmaX - EXPECTED.sigmaY) / 2) ** 2 + EXPECTED.tauXY ** 2);
const PRINCIPAL_MAXIMUM = (EXPECTED.sigmaX + EXPECTED.sigmaY) / 2 + ROOT;
const VON_MISES = Math.sqrt(
  EXPECTED.sigmaX ** 2 - EXPECTED.sigmaX * EXPECTED.sigmaY
  + EXPECTED.sigmaY ** 2 + 3 * EXPECTED.tauXY ** 2,
);
const PROBE = Object.freeze({
  schema: LAFEA_CONTINUUM_PHYSICAL_PROBE_SCHEMA,
  probeId: 'G4-AFFINE-PHYSICAL-PROBE-01',
  physicalCoordinate: { x: 0.2, y: 0.3 },
  coordinateFrame: 'GLOBAL_XY',
  loadCaseId: 'LC1',
  quantityId: 'STRESS_SIGMA_X',
  representation: 'PHYSICAL_POINT_DIRECT',
  recoveryMethod: 'ELEMENT_LOCAL_DIRECT_DISPLACEMENT_GRADIENT',
  units: 'MPa',
  singularityClassification: 'NON_SINGULAR_ANALYTICAL',
});

const evidence = ['T3', 'T6', 'Q8'].map((type) =>
  evaluateLafeaContinuumPhysicalProbe(stage(type), PROBE));
for (const row of evidence) {
  close(row.strain.epsilonX, STRAIN.epsilonX);
  close(row.strain.epsilonY, STRAIN.epsilonY);
  close(row.strain.gammaXY, STRAIN.gammaXY);
  close(row.stressTensor.sigmaX, EXPECTED.sigmaX);
  close(row.stressTensor.sigmaY, EXPECTED.sigmaY);
  close(row.stressTensor.tauXY, EXPECTED.tauXY);
  close(row.principalMaximum, PRINCIPAL_MAXIMUM);
  close(row.vonMises, VON_MISES);
  close(row.displacement.ux, 0.001 * 0.2 + 0.0005 * 0.3);
  close(row.displacement.uy, -0.0002 * 0.2 + 0.0008 * 0.3);
  assert.equal(row.authoritativeValue, row.stressTensor.sigmaX);
  assert.equal(row.mapping.mappingClass, 'INTERIOR');
  assert.equal(row.pointwiseAcceptanceEligible, true);
  assert.equal(row.retainedIntegrationPointExtrapolationUsed, false);
  assert.equal(row.crossElementAveragingUsed, false);
  assert.equal(row.nodalStressProjectionUsed, false);
  assert.equal(row.displayInterpolationUsed, false);
  assert.equal(row.movingMaximumUsed, false);
  assert.equal(row.releaseAuthorityGranted, false);
  assert.equal(row.temperatureAuthorityGranted, false);
  assert.match(row.semanticHash, /^sha256:/u);
}
assert.equal(new Set(evidence.map((row) => row.probeIdentityHash)).size, 1,
  'mesh family must not mutate permanent probe identity');
assert.equal(new Set(evidence.map((row) => row.quantityIdentityHash)).size, 1,
  'mesh family must not mutate physical quantity identity');
assert.deepEqual(evidence.map((row) => row.mapping.elementType), ['T3', 'T6', 'Q8']);

const strainEvidence = evaluateLafeaContinuumPhysicalProbe(stage('Q8'), {
  ...PROBE,
  probeId: 'G4-AFFINE-STRAIN-PROBE-01',
  quantityId: 'STRAIN_EPSILON_X',
  units: 'dimensionless',
});
close(strainEvidence.authoritativeValue, STRAIN.epsilonX);
assert.equal(strainEvidence.authoritativeUnits, 'dimensionless');
assert.equal(strainEvidence.quantityIdentity.units, 'dimensionless');

const displacementEvidence = evaluateLafeaContinuumPhysicalProbe(stage('T6'), {
  ...PROBE,
  probeId: 'G4-AFFINE-DISPLACEMENT-PROBE-01',
  quantityId: 'DISPLACEMENT_X',
  recoveryMethod: 'ELEMENT_SHAPE_INTERPOLATION',
  units: 'mm',
  singularityClassification: 'NOT_APPLICABLE',
});
close(displacementEvidence.authoritativeValue, 0.001 * 0.2 + 0.0005 * 0.3);
assert.equal(displacementEvidence.authoritativeUnits, 'mm');

const singular = evaluateLafeaContinuumPhysicalProbe(stage('T6'), {
  ...PROBE,
  probeId: 'G4-SINGULAR-CLASSIFICATION-CONTROL',
  singularityClassification: 'SINGULAR_EXCLUDED_FROM_POINTWISE_ACCEPTANCE',
});
assert.equal(singular.pointwiseAcceptanceEligible, false);

assert.throws(
  () => evaluateLafeaContinuumPhysicalProbe(stage('T6', { temperature: true }), PROBE),
  /LAFEA_G4_PROBE_TEMPERATURE_AUTHORITY_NOT_GRANTED/u,
);

console.log(JSON.stringify({
  schema: 'lafea-b02-g4-physical-probe-diagnostic/v1',
  status: 'PASS',
  physicalProbeIdentityStableAcrossMeshFamilies: true,
  directT3T6Q8Recovery: true,
  canonicalStrainUnits: 'dimensionless',
  displacementShapeInterpolation: true,
  directStressTensorDerivedFromUnroundedComponents: true,
  displayProjectionUsedForAcceptance: false,
  crossElementAveragingUsed: false,
  movingMaximumUsed: false,
  temperatureAuthorityGranted: false,
  releaseAuthorityGranted: false,
}));

function stage(type, options = {}) {
  const nodes = nodesFor(type);
  const element = {
    elementId: `E-${type}`,
    elementType: type,
    nodeIds: nodes.map((row) => row.nodeId),
    materialId: 'M1',
  };
  const canonicalInput = {
    formulation: 'PLANE_STRESS',
    materials: [{ materialId: 'M1', elasticModulus: E, poissonRatio: NU }],
    nodes,
    elements: [element],
    loadCases: [{ loadCaseId: 'LC1', temperatureLoads: options.temperature ? [{ deltaT: 10 }] : [] }],
  };
  const canonicalExecutionInputHash = canonicalLafeaSha256({
    schema: 'lafea-continuum-compiled-execution-input-hash/v1', canonicalInput,
  });
  const elementEvidence = { elementId: element.elementId, elementType: type, dMatrix: D };
  if (type === 'T3') elementEvidence.bMatrix = [
    [-1, 0, 1, 0, 0, 0],
    [0, -1, 0, 0, 0, 1],
    [-1, -1, 0, 1, 1, 0],
  ];
  const meshHash = hash(type === 'T3' ? '3' : type === 'T6' ? '6' : '8');
  return {
    stageId: 'LAFEA.3',
    currentness: { currentAuthority: true, computationalState: 'CURRENT_RESULT' },
    analysisMeshCustodyProjection: { state: 'CURRENT_PASS', meshHash },
    lifecycle: { artifacts: { RECOVERY: { status: 'CURRENT', qualification: 'PASS', artifactHash: hash('r') } } },
    execution: {
      status: 'QUALIFIED',
      sourceHash: hash('s'),
      meshHash,
      solverModelHash: hash('m'),
      compiledExecutionHash: hash('e'),
      canonicalExecutionInputHash,
      canonicalInput,
      result: {
        qualification: { state: 'ACCEPTED' },
        meshEvidence: { elementEvidence: [elementEvidence] },
        loadCaseResults: [{
          loadCaseId: 'LC1',
          nodalDisplacements: nodes.map((node) => ({
            nodeId: node.nodeId,
            ux: 0.001 * node.x + 0.0005 * node.y,
            uy: -0.0002 * node.x + 0.0008 * node.y,
          })),
        }],
      },
    },
  };
}

function nodesFor(type) {
  if (type === 'T3') return [node('N1', 0, 0), node('N2', 1, 0), node('N3', 0, 1)];
  if (type === 'T6') return [
    node('N1', 0, 0), node('N2', 1, 0), node('N3', 0, 1),
    node('N4', 0.5, 0), node('N5', 0.5, 0.5), node('N6', 0, 0.5),
  ];
  return [
    node('N1', 0, 0), node('N2', 1, 0), node('N3', 1, 1), node('N4', 0, 1),
    node('N5', 0.5, 0), node('N6', 1, 0.5), node('N7', 0.5, 1), node('N8', 0, 0.5),
  ];
}
function node(nodeId, x, y) { return { nodeId, x, y }; }
function hash(character) { return `sha256:${character.repeat(64).slice(0, 64)}`; }
function close(actual, expected) {
  const scale = Math.max(1, Math.abs(expected));
  assert.ok(Math.abs(actual - expected) <= 1e-10 * scale, `${actual} != ${expected}`);
}
