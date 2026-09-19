#!/usr/bin/env node
/**
 * C3-C.4 probe invariance across a mesh-refinement ladder (#1769).
 *
 * The existing G4 probe diagnostic proves a probe survives a change of element
 * family. #1769 additionally requires that a probe defined by physical
 * coordinate survives refinement: across at least three genuinely different
 * meshes of the same domain, the containing entity must change while the
 * physical evaluation coordinate, the probe identity and the recovered
 * quantity do not.
 *
 * The imposed field is affine, so the recovered strain and stress are exactly
 * level-independent by construction. Any drift across levels is therefore a
 * defect in probe resolution or recovery, not discretization error, which is
 * what makes this a clean invariance test rather than a convergence study.
 *
 * Qualification only: no solver, element, recovery or oracle authority is
 * changed, and no release authority is granted.
 */
import assert from 'node:assert/strict';
import { canonicalLafeaSha256 } from '../src/workspace/lafea-canonical-sha256.js';
import {
  LAFEA_CONTINUUM_PHYSICAL_PROBE_SCHEMA,
  evaluateLafeaContinuumPhysicalProbe,
} from '../src/workspace/lafea-continuum-physical-probe.js';
import {
  LAFEA_NUMERIC_PARITY_RELATIVE_TOLERANCE,
  compareLafeaNumericParity,
} from './lib/lafea-numeric-parity.mjs';

const E = 200000;
const NU = 0.25;
const FACTOR = E / (1 - NU ** 2);
const D = [
  [FACTOR, NU * FACTOR, 0],
  [NU * FACTOR, FACTOR, 0],
  [0, 0, E / (2 * (1 + NU))],
];

/** Affine displacement field: u = a1 x + a2 y, v = b1 x + b2 y. */
const FIELD = { a1: 0.001, a2: 0.0005, b1: -0.0002, b2: 0.0008 };
const STRAIN = {
  epsilonX: FIELD.a1,
  epsilonY: FIELD.b2,
  gammaXY: FIELD.a2 + FIELD.b1,
};
const STRESS = {
  sigmaX: D[0][0] * STRAIN.epsilonX + D[0][1] * STRAIN.epsilonY,
  sigmaY: D[1][0] * STRAIN.epsilonX + D[1][1] * STRAIN.epsilonY,
  tauXY: D[2][2] * STRAIN.gammaXY,
};

/** One fixed physical point, deliberately not on any level's element boundary. */
const PROBE_POINT = { x: 0.31, y: 0.23 };
const PROBE = Object.freeze({
  schema: LAFEA_CONTINUUM_PHYSICAL_PROBE_SCHEMA,
  probeId: 'C3C-PROBE-INVARIANCE-01',
  physicalCoordinate: PROBE_POINT,
  coordinateFrame: 'GLOBAL_XY',
  loadCaseId: 'LC1',
  quantityId: 'STRESS_SIGMA_X',
  representation: 'PHYSICAL_POINT_DIRECT',
  recoveryMethod: 'ELEMENT_LOCAL_DIRECT_DISPLACEMENT_GRADIENT',
  units: 'MPa',
  singularityClassification: 'NON_SINGULAR_ANALYTICAL',
});

// Three genuinely different meshes of the unit square: 2, 8 and 32 T6 elements,
// i.e. n x n subdivision with two triangles per cell for n = 1, 2, 4.
const LEVELS = [1, 2, 4];
const evidence = LEVELS.map((n) => {
  const mesh = subdividedT6Mesh(n);
  const row = evaluateLafeaContinuumPhysicalProbe(stageFor(mesh, n), PROBE);
  return {
    level: n,
    targetSize: 1 / n,
    elementCount: mesh.elements.length,
    nodeCount: mesh.nodes.length,
    meshHash: mesh.meshHash,
    containingElementId: row.mapping.elementId,
    mappingClass: row.mapping.mappingClass,
    probeIdentityHash: row.probeIdentityHash,
    quantityIdentityHash: row.quantityIdentityHash,
    physicalCoordinate: row.probeIdentity?.physicalCoordinate ?? PROBE_POINT,
    authoritativeValue: row.authoritativeValue,
    strain: row.strain,
    stressTensor: row.stressTensor,
    row,
  };
});

// The ladder must be a real ladder: three distinct meshes, strictly refining.
assert.equal(new Set(evidence.map((e) => e.meshHash)).size, LEVELS.length,
  'refinement levels must be genuinely different meshes');
assert.ok(evidence.every((e, i) => i === 0 || e.elementCount > evidence[i - 1].elementCount),
  'element count must increase with refinement');
assert.ok(evidence.every((e, i) => i === 0 || e.targetSize < evidence[i - 1].targetSize),
  'characteristic size must decrease with refinement');

// The probe must land in a different containing entity as the mesh changes --
// otherwise the invariance below would be vacuous.
assert.equal(new Set(evidence.map((e) => e.containingElementId)).size, LEVELS.length,
  'refinement must change the probe containing element, or invariance proves nothing');
assert.ok(evidence.every((e) => e.mappingClass === 'INTERIOR'),
  'the probe point must stay interior at every level');

// Identity, coordinate and recovered quantity must not move.
assert.equal(new Set(evidence.map((e) => e.probeIdentityHash)).size, 1,
  'refinement must not mutate permanent probe identity');
assert.equal(new Set(evidence.map((e) => e.quantityIdentityHash)).size, 1,
  'refinement must not mutate physical quantity identity');
evidence.forEach((e) => {
  assert.deepEqual(e.physicalCoordinate, PROBE_POINT,
    `level ${e.level} moved the physical evaluation coordinate`);
});

const baseline = evidence[0];
evidence.slice(1).forEach((e) => {
  const comparison = compareLafeaNumericParity(
    { strain: e.strain, stressTensor: e.stressTensor, authoritativeValue: e.authoritativeValue },
    { strain: baseline.strain, stressTensor: baseline.stressTensor, authoritativeValue: baseline.authoritativeValue },
  );
  assert.ok(comparison.ok,
    `level ${e.level} drifted from level ${baseline.level}: ${JSON.stringify(comparison.mismatch)}`);
});

// Against the closed-form affine field, not just against each other.
evidence.forEach((e) => {
  exact(e.strain.epsilonX, STRAIN.epsilonX, `level ${e.level} epsilonX`);
  exact(e.strain.epsilonY, STRAIN.epsilonY, `level ${e.level} epsilonY`);
  exact(e.strain.gammaXY, STRAIN.gammaXY, `level ${e.level} gammaXY`);
  exact(e.stressTensor.sigmaX, STRESS.sigmaX, `level ${e.level} sigmaX`);
  exact(e.stressTensor.sigmaY, STRESS.sigmaY, `level ${e.level} sigmaY`);
  exact(e.stressTensor.tauXY, STRESS.tauXY, `level ${e.level} tauXY`);
  exact(e.authoritativeValue, STRESS.sigmaX, `level ${e.level} authoritative value`);
});

// Anti-circularity: the qualification quantity is a fixed physical probe, never
// a moving mesh maximum or a display-only projection.
evidence.forEach((e) => {
  assert.equal(e.row.movingMaximumUsed, false);
  assert.equal(e.row.nodalStressProjectionUsed, false);
  assert.equal(e.row.crossElementAveragingUsed, false);
  assert.equal(e.row.displayInterpolationUsed, false);
  assert.equal(e.row.retainedIntegrationPointExtrapolationUsed, false);
  assert.equal(e.row.releaseAuthorityGranted, false);
});

// Negative control: a point outside the domain must fail closed rather than
// silently resolving to the nearest element.
assert.throws(
  () => evaluateLafeaContinuumPhysicalProbe(stageFor(subdividedT6Mesh(2), 2), {
    ...PROBE,
    probeId: 'C3C-PROBE-INVARIANCE-OUTSIDE-01',
    physicalCoordinate: { x: 1.75, y: 0.5 },
  }),
  'a probe outside the domain must fail closed',
);

console.log(JSON.stringify({
  schema: 'lafea3-c3c-probe-invariance-check/v1',
  check: 'lafea.3-c3c-probe-invariance',
  status: 'PASS',
  stageId: 'LAFEA.3',
  elementFamily: 'T6',
  refinementLevels: LEVELS.length,
  physicalCoordinate: PROBE_POINT,
  relativeTolerance: LAFEA_NUMERIC_PARITY_RELATIVE_TOLERANCE,
  ladder: evidence.map((e) => ({
    level: e.level,
    targetSize: e.targetSize,
    nodeCount: e.nodeCount,
    elementCount: e.elementCount,
    containingElementId: e.containingElementId,
    authoritativeValue: e.authoritativeValue,
  })),
  containingElementChangedEveryLevel: true,
  physicalCoordinateInvariant: true,
  probeIdentityInvariant: true,
  recoveredQuantityInvariant: true,
  outsideDomainFailsClosed: true,
  movingMaximumUsed: false,
  nodalStressProjectionUsed: false,
  crossElementAveragingUsed: false,
  displayInterpolationUsed: false,
  releaseAuthorityGranted: false,
}, null, 2));

/** n x n subdivision of the unit square, two T6 triangles per cell. */
function subdividedT6Mesh(n) {
  const step = 1 / n;
  const nodes = new Map();
  const key = (x, y) => `${round(x)}|${round(y)}`;
  const addNode = (x, y) => {
    const id = key(x, y);
    if (!nodes.has(id)) nodes.set(id, { nodeId: `N${nodes.size + 1}`, x: round(x), y: round(y) });
    return nodes.get(id).nodeId;
  };
  const elements = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const x0 = i * step;
      const y0 = j * step;
      const x1 = x0 + step;
      const y1 = y0 + step;
      elements.push(t6(addNode, [x0, y0], [x1, y0], [x0, y1], `E${elements.length + 1}`));
      elements.push(t6(addNode, [x1, y0], [x1, y1], [x0, y1], `E${elements.length + 1}`));
    }
  }
  const nodeList = [...nodes.values()];
  return {
    nodes: nodeList,
    elements,
    meshHash: canonicalLafeaSha256({
      schema: 'lafea3-c3c-probe-invariance-mesh/v1',
      nodes: nodeList,
      elements,
    }),
  };
}

function t6(addNode, a, b, c, elementId) {
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const ids = [a, b, c, mid(a, b), mid(b, c), mid(c, a)].map((p) => addNode(p[0], p[1]));
  return { elementId, elementType: 'T6', nodeIds: ids, materialId: 'M1' };
}

function stageFor(mesh, level) {
  const canonicalInput = {
    formulation: 'PLANE_STRESS',
    materials: [{ materialId: 'M1', elasticModulus: E, poissonRatio: NU }],
    nodes: mesh.nodes,
    elements: mesh.elements,
    loadCases: [{ loadCaseId: 'LC1', temperatureLoads: [] }],
  };
  const canonicalExecutionInputHash = canonicalLafeaSha256({
    schema: 'lafea-continuum-compiled-execution-input-hash/v1', canonicalInput,
  });
  return {
    stageId: 'LAFEA.3',
    currentness: { currentAuthority: true, computationalState: 'CURRENT_RESULT' },
    analysisMeshCustodyProjection: { state: 'CURRENT_PASS', meshHash: mesh.meshHash },
    lifecycle: {
      artifacts: {
        RECOVERY: { status: 'CURRENT', qualification: 'PASS', artifactHash: levelHash('r', level) },
      },
    },
    execution: {
      status: 'QUALIFIED',
      sourceHash: levelHash('s', level),
      meshHash: mesh.meshHash,
      solverModelHash: levelHash('m', level),
      compiledExecutionHash: levelHash('e', level),
      canonicalExecutionInputHash,
      canonicalInput,
      result: {
        qualification: { state: 'ACCEPTED' },
        meshEvidence: {
          elementEvidence: mesh.elements.map((element) => ({
            elementId: element.elementId,
            elementType: element.elementType,
            dMatrix: D,
          })),
        },
        loadCaseResults: [{
          loadCaseId: 'LC1',
          nodalDisplacements: mesh.nodes.map((n) => ({
            nodeId: n.nodeId,
            ux: FIELD.a1 * n.x + FIELD.a2 * n.y,
            uy: FIELD.b1 * n.x + FIELD.b2 * n.y,
          })),
        }],
      },
    },
  };
}

function round(value) { return Number(value.toFixed(12)); }
function levelHash(character, level) {
  return `sha256:${`${character}${level}`.repeat(64).slice(0, 64)}`;
}
function exact(actual, expected, label) {
  const scale = Math.max(1, Math.abs(expected));
  assert.ok(
    Math.abs(actual - expected) <= LAFEA_NUMERIC_PARITY_RELATIVE_TOLERANCE * scale,
    `${label}: ${actual} != ${expected}`,
  );
}
