#!/usr/bin/env node
/**
 * C3-B B02C curved-hole mesh-only qualification.
 *
 * This check deliberately stops at mesh production and mesh quality. It does
 * not compile/solve a continuum model, evaluate Kirsch stresses, or claim
 * response/convergence authority. Those belong to C3-D (#1771).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalProfile,
  defaultProfileFields,
  PROFILE_KINDS,
} from '../src/core/lafea-profile-contract/index.js';
import {
  generateLafeaB02cGradedPolarMesh,
  LAFEA_B02C_GRADED_POLAR_POLICY_ID,
  LAFEA_B02C_GRADED_POLAR_STRATEGY,
} from '../src/core/lafea-meshing/b02c-kirsch-graded-polar-mesh.js';
import {
  b02cGradedPolarProfileIdentity,
  LAFEA_B02C_GRADED_POLAR_PROFILE_SOURCE_REVISION,
} from '../src/workspace/lafea-mesh-producer-binding.js';
import { qualifyLafeaAnalysisMesh } from '../src/workspace/lafea-analysis-mesh-quality.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const definition = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'validation/lafea-b02-definitions/B02C-kirsch.json'),
  'utf8',
));
const STAGE_ID = 'LAFEA.3';
const ELEMENT_FAMILY = 'T6';
const FROZEN_LEVEL_IDS = ['L1', 'L2', 'L3'];

assert.equal(definition.caseId, 'B02C');
assert.equal(definition.geometry.type, 'QUARTER_ANNULUS');
assert.deepEqual(definition.meshLadder.levels.map((row) => row.levelId), FROZEN_LEVEL_IDS);
assert.equal(definition.meshLadder.methods.T6, 'REQUIRED');

const rows = definition.meshLadder.levels.map(qualifyLevel);
assert.throws(
  () => generateLafeaB02cGradedPolarMesh({ targetElementLength: 2.8125, elementFamily: ELEMENT_FAMILY }),
  (error) => error?.code === 'LAFEA_B02C_GRADED_POLAR_TARGET_H_NOT_FROZEN_LEVEL',
  'B02C frozen graded-polar strategy must fail closed outside L1-L3',
);

const realizedOrderByMedian = [...rows]
  .sort((left, right) => right.realizedH.median - left.realizedH.median)
  .map((row) => row.levelId);
const realizedOrderByMaximum = [...rows]
  .sort((left, right) => right.realizedH.maximum - left.realizedH.maximum)
  .map((row) => row.levelId);

process.stdout.write(`${JSON.stringify({
  schema: 'lafea3-c3b-b02c-curved-hole-mesh-check/v1',
  status: 'PASS',
  issue: 'github:reallaksh19/Advanced_Analysis#1766',
  caseId: definition.caseId,
  scope: 'MESH_ONLY_CURVED_HOLE_REGRESSION',
  elementFamily: ELEMENT_FAMILY,
  strategy: LAFEA_B02C_GRADED_POLAR_STRATEGY,
  policyId: LAFEA_B02C_GRADED_POLAR_POLICY_ID,
  profileSourceRevision: LAFEA_B02C_GRADED_POLAR_PROFILE_SOURCE_REVISION,
  geometry: {
    holeRadius: definition.geometry.holeRadius,
    outerRadius: definition.geometry.outerRadius,
    angleMinimumDegrees: definition.geometry.angleMinimumDegrees,
    angleMaximumDegrees: definition.geometry.angleMaximumDegrees,
  },
  frozenLevels: rows,
  realizedOrdering: {
    byMedianCharacteristicLengthCoarseToFine: realizedOrderByMedian,
    byMaximumCharacteristicLengthCoarseToFine: realizedOrderByMaximum,
    note: 'Reported, not forced. C3-B refinement authority is the retained-refinement/M4 route; B02C is a frozen regression profile whose nominal h labels are not assumed to be asymptotic response levels.',
  },
  negativeControls: {
    nonFrozenTargetRejected: true,
    rejectedTargetElementLength: 2.8125,
    expectedCode: 'LAFEA_B02C_GRADED_POLAR_TARGET_H_NOT_FROZEN_LEVEL',
  },
  authority: {
    solverExecuted: false,
    physicalResponseEvaluated: false,
    responseConvergenceAuthorityGranted: false,
    stressRecoveryAuthorityGranted: false,
    releaseQualified: false,
  },
}, null, 2)}\n`);

function qualifyLevel(level) {
  const profile = meshProfile(level);
  const first = generateLafeaB02cGradedPolarMesh({
    targetElementLength: level.targetElementLength,
    elementFamily: ELEMENT_FAMILY,
  });
  const replay = generateLafeaB02cGradedPolarMesh({
    targetElementLength: level.targetElementLength,
    elementFamily: ELEMENT_FAMILY,
  });

  assert.equal(first.strategy, LAFEA_B02C_GRADED_POLAR_STRATEGY);
  assert.equal(first.policyId, LAFEA_B02C_GRADED_POLAR_POLICY_ID);
  assert.equal(first.elementFamily, ELEMENT_FAMILY);
  assert.equal(first.semanticHash, replay.semanticHash, `${level.levelId}: deterministic output hash`);
  assert.equal(JSON.stringify(first.mesh), JSON.stringify(replay.mesh), `${level.levelId}: byte-stable canonical mesh`);
  assert.equal(first.mesh.elements.every((row) => row.elementType === ELEMENT_FAMILY), true);
  assertUniqueIds(first.mesh, level.levelId);

  const quality = qualifyLafeaAnalysisMesh(STAGE_ID, first.mesh, profile);
  assert.notEqual(quality.worstStatus, 'BLOCK', `${level.levelId}: mesh quality must not block`);
  assert.deepEqual(quality.blockingElementIds, [], `${level.levelId}: no blocking elements`);

  const gate = Object.fromEntries(quality.gateResults.map((row) => [row.metric, row]));
  assert.ok(gate.SCALED_JACOBIAN.value > 0.20, `${level.levelId}: scaled Jacobian must exceed 0.20`);
  assert.ok(gate.ASPECT_RATIO.value < 10, `${level.levelId}: aspect ratio must remain below blocking limit 10`);
  assert.ok(gate.MINIMUM_ANGLE_DEGREES.value >= 10, `${level.levelId}: minimum angle must be at least 10 degrees`);

  const boundary = circularBoundaryEvidence(first, level.levelId);
  const expectedPerRing = (2 * first.angularSectors) + 1;
  assert.equal(boundary.hole.nodeCount, expectedPerRing, `${level.levelId}: hole boundary node count`);
  assert.equal(boundary.outer.nodeCount, expectedPerRing, `${level.levelId}: outer boundary node count`);
  assert.equal(boundary.hole.midsideNodeCount, first.angularSectors, `${level.levelId}: hole analytic midsides`);
  assert.equal(boundary.outer.midsideNodeCount, first.angularSectors, `${level.levelId}: outer analytic midsides`);

  return {
    levelId: level.levelId,
    requestedTargetElementLength: level.targetElementLength,
    meshIdentity: first.mesh.meshIdentity,
    meshSemanticHash: first.semanticHash,
    deterministicReplayHash: replay.semanticHash,
    deterministicReplay: true,
    nodeCount: first.nodeCount,
    elementCount: first.elementCount,
    angularSectors: first.angularSectors,
    radialRings: first.radialRings,
    realizedH: {
      minimum: first.characteristicLengthMin,
      median: first.characteristicLengthMedian,
      maximum: first.characteristicLengthMax,
    },
    quality: {
      worstStatus: quality.worstStatus,
      blockingElementCount: quality.blockingElementIds.length,
      gates: quality.gateResults,
      distributions: {
        aspectRatio: distribution(metricValues(quality, 'ASPECT_RATIO')),
        scaledJacobian: distribution(metricValues(quality, 'SCALED_JACOBIAN')),
        minimumAngleDegrees: distribution(metricValues(quality, 'MINIMUM_ANGLE_DEGREES')),
      },
    },
    circularBoundary: boundary,
  };
}

function meshProfile(level) {
  const defaults = defaultProfileFields(PROFILE_KINDS.MESH);
  return canonicalProfile(PROFILE_KINDS.MESH, {
    schema: 'lafea-mesh-profile/v1',
    profileIdentity: b02cGradedPolarProfileIdentity(ELEMENT_FAMILY, level.targetElementLength),
    sourceRevision: LAFEA_B02C_GRADED_POLAR_PROFILE_SOURCE_REVISION,
    semanticHash: undefined,
    fields: {
      ...defaults,
      continuumElement: ELEMENT_FAMILY,
      shellElement: 'CST_DKT_TRI3_THIN_SHELL_V1',
      globalTargetSize: level.targetElementLength,
      adjacentSizeRatioMax: definition.meshLadder.commonRequestPolicy.growthLimit,
    },
  });
}

function circularBoundaryEvidence(generated, levelId) {
  const { center, holeRadius, outerRadius } = definition.geometry;
  const scale = Math.max(1, outerRadius);
  const tolerance = 1e-10 * scale;
  const summarize = (radius, label) => {
    const nodes = generated.mesh.nodes.filter((node) => (
      Math.abs(Math.hypot(node.x - center.x, node.y - center.y) - radius) <= tolerance
    ));
    assert.ok(nodes.length > 0, `${levelId}: ${label} boundary nodes missing`);
    const residuals = nodes.map((node) => Math.abs(
      Math.hypot(node.x - center.x, node.y - center.y) - radius
    ));
    const midsides = nodes.filter((node) => node.nodeId.startsWith('M-'));
    return {
      radius,
      tolerance,
      nodeCount: nodes.length,
      midsideNodeCount: midsides.length,
      maximumRadialResidual: Math.max(...residuals),
      analyticMidsidesRetained: midsides.length === generated.angularSectors,
    };
  };
  return {
    hole: summarize(holeRadius, 'hole'),
    outer: summarize(outerRadius, 'outer'),
  };
}

function assertUniqueIds(mesh, levelId) {
  assert.equal(new Set(mesh.nodes.map((row) => row.nodeId)).size, mesh.nodes.length,
    `${levelId}: node IDs must be unique`);
  assert.equal(new Set(mesh.elements.map((row) => row.elementId)).size, mesh.elements.length,
    `${levelId}: element IDs must be unique`);
}

function metricValues(quality, metric) {
  return quality.elementResults.map((row) => {
    const value = row.metrics.find((candidate) => candidate.metric === metric)?.value;
    assert.ok(Number.isFinite(value), `missing ${metric} on ${row.elementId}`);
    return value;
  });
}

function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    minimum: sorted[0],
    p05: quantile(sorted, 0.05),
    median: quantile(sorted, 0.50),
    p95: quantile(sorted, 0.95),
    maximum: sorted.at(-1),
  };
}

function quantile(sorted, probability) {
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
