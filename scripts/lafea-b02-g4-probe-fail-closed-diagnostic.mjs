#!/usr/bin/env node
import assert from 'node:assert/strict';
import { canonicalLafeaSha256 } from '../src/workspace/lafea-canonical-sha256.js';
import {
  LAFEA_CONTINUUM_PHYSICAL_PROBE_SCHEMA,
  evaluateLafeaContinuumPhysicalProbe,
} from '../src/workspace/lafea-continuum-physical-probe.js';

const probe = Object.freeze({
  schema: LAFEA_CONTINUUM_PHYSICAL_PROBE_SCHEMA,
  probeId: 'G4-FAIL-CLOSED-PROBE',
  physicalCoordinate: { x: 0.2, y: 0.2 },
  coordinateFrame: 'GLOBAL_XY',
  loadCaseId: 'LC1',
  quantityId: 'STRESS_SIGMA_X',
  representation: 'PHYSICAL_POINT_DIRECT',
  recoveryMethod: 'ELEMENT_LOCAL_DIRECT_DISPLACEMENT_GRADIENT',
  units: 'MPa',
  singularityClassification: 'NON_SINGULAR_CONVERGENCE',
});

const current = stage();
assert.equal(evaluateLafeaContinuumPhysicalProbe(current, probe).status, 'PASS');

const stale = structuredClone(current);
stale.currentness.currentAuthority = false;
stale.currentness.computationalState = 'STALE_RESULT';
assert.throws(
  () => evaluateLafeaContinuumPhysicalProbe(stale, probe),
  /LAFEA_G4_PROBE_CURRENT_EXECUTION_REQUIRED/u,
);

const staleRecovery = structuredClone(current);
staleRecovery.lifecycle.artifacts.RECOVERY.status = 'STALE';
assert.throws(
  () => evaluateLafeaContinuumPhysicalProbe(staleRecovery, probe),
  /LAFEA_G4_PROBE_RECOVERY_CUSTODY_REQUIRED/u,
);

const meshMismatch = structuredClone(current);
meshMismatch.analysisMeshCustodyProjection.meshHash = hash('9');
assert.throws(
  () => evaluateLafeaContinuumPhysicalProbe(meshMismatch, probe),
  /LAFEA_G4_PROBE_MESH_CUSTODY_MISMATCH/u,
);

const hashDrift = structuredClone(current);
hashDrift.execution.canonicalInput.materials[0].elasticModulus += 1;
assert.throws(
  () => evaluateLafeaContinuumPhysicalProbe(hashDrift, probe),
  /LAFEA_G4_PROBE_CANONICAL_INPUT_HASH_MISMATCH/u,
);

assert.throws(
  () => evaluateLafeaContinuumPhysicalProbe(current, {
    ...probe,
    physicalCoordinate: { x: 2, y: 2 },
  }),
  /LAFEA_G4_PROBE_OUTSIDE_MESH/u,
);

const sharedEdge = stage({ splitSquare: true });
assert.throws(
  () => evaluateLafeaContinuumPhysicalProbe(sharedEdge, {
    ...probe,
    physicalCoordinate: { x: 0.5, y: 0.5 },
  }),
  /LAFEA_G4_PROBE_ELEMENT_AMBIGUOUS/u,
);

const inverted = stage({ inverted: true });
assert.throws(
  () => evaluateLafeaContinuumPhysicalProbe(inverted, probe),
  /LAFEA_G4_PROBE_ELEMENT_ORIENTATION_INVALID/u,
);

assert.throws(
  () => evaluateLafeaContinuumPhysicalProbe(current, {
    ...probe,
    units: 'Pa',
  }),
  /LAFEA_G4_PROBE_UNITS_INCOMPATIBLE/u,
);

console.log(JSON.stringify({
  schema: 'lafea-b02-g4-probe-fail-closed-diagnostic/v1',
  status: 'PASS',
  staleExecutionRejected: true,
  staleRecoveryRejected: true,
  meshCustodyMismatchRejected: true,
  canonicalInputDriftRejected: true,
  outsideProbeRejected: true,
  sharedEdgeAmbiguityRejected: true,
  invertedElementRejected: true,
  incompatibleUnitsRejected: true,
  releaseAuthorityGranted: false,
  temperatureAuthorityGranted: false,
}));

function stage(options = {}) {
  const nodes = options.splitSquare
    ? [node('N1', 0, 0), node('N2', 1, 0), node('N3', 1, 1), node('N4', 0, 1)]
    : [node('N1', 0, 0), node('N2', options.inverted ? 0 : 1, options.inverted ? 1 : 0), node('N3', options.inverted ? 1 : 0, options.inverted ? 0 : 1)];
  const elements = options.splitSquare
    ? [element('E1', ['N1', 'N2', 'N3']), element('E2', ['N1', 'N3', 'N4'])]
    : [element('E1', ['N1', 'N2', 'N3'])];
  const canonicalInput = {
    formulation: 'PLANE_STRESS',
    materials: [{ materialId: 'M1', elasticModulus: 200000, poissonRatio: 0.25 }],
    nodes,
    elements,
    loadCases: [{ loadCaseId: 'LC1', temperatureLoads: [] }],
  };
  const d = [[213333.33333333334, 53333.333333333336, 0], [53333.333333333336, 213333.33333333334, 0], [0, 0, 80000]];
  const elementEvidence = elements.map((row) => ({
    elementId: row.elementId,
    elementType: 'T3',
    dMatrix: d,
    bMatrix: bMatrixFor(row, nodes),
  }));
  const meshHash = hash('3');
  return {
    stageId: 'LAFEA.3',
    currentness: { currentAuthority: true, computationalState: 'CURRENT_RESULT' },
    analysisMeshCustodyProjection: { state: 'CURRENT_PASS', meshHash },
    lifecycle: { artifacts: { RECOVERY: { status: 'CURRENT', qualification: 'PASS', artifactHash: hash('r') } } },
    execution: {
      status: 'QUALIFIED', sourceHash: hash('s'), meshHash,
      solverModelHash: hash('m'), compiledExecutionHash: hash('e'),
      canonicalExecutionInputHash: canonicalLafeaSha256({
        schema: 'lafea-continuum-compiled-execution-input-hash/v1', canonicalInput,
      }),
      canonicalInput,
      result: {
        qualification: { state: 'ACCEPTED' },
        meshEvidence: { elementEvidence },
        loadCaseResults: [{
          loadCaseId: 'LC1',
          nodalDisplacements: nodes.map((row) => ({ nodeId: row.nodeId, ux: 0.001 * row.x, uy: 0.0005 * row.y })),
        }],
      },
    },
  };
}
function element(elementId, nodeIds) {
  return { elementId, elementType: 'T3', nodeIds, materialId: 'M1', canonicalArea: 0.5 };
}
function bMatrixFor(elementValue, nodes) {
  const map = new Map(nodes.map((row) => [row.nodeId, row]));
  const [a, b, c] = elementValue.nodeIds.map((id) => map.get(id));
  const signedDoubleArea = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const area = Math.abs(signedDoubleArea) / 2;
  const beta = [b.y - c.y, c.y - a.y, a.y - b.y];
  const gamma = [c.x - b.x, a.x - c.x, b.x - a.x];
  const factor = 1 / (2 * area);
  return [
    [beta[0] * factor, 0, beta[1] * factor, 0, beta[2] * factor, 0],
    [0, gamma[0] * factor, 0, gamma[1] * factor, 0, gamma[2] * factor],
    [gamma[0] * factor, beta[0] * factor, gamma[1] * factor, beta[1] * factor, gamma[2] * factor, beta[2] * factor],
  ];
}
function node(nodeId, x, y) { return { nodeId, x, y }; }
function hash(character) { return `sha256:${character.repeat(64).slice(0, 64)}`; }
