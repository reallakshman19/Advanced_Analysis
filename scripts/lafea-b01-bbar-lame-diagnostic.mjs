#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LAFEA3_QUALIFIED_MESH_QUALITY_POLICY,
  PROFILE_KINDS,
  canonicalProfile,
  defaultProfileFields,
} from '../src/core/lafea-profile-contract/index.js';
import {
  qualifyLafeaAnalysisMesh,
  requireLafeaAnalysisMeshQualifiedQualityPolicy,
} from '../src/workspace/lafea-analysis-mesh-contract.js';
import {
  executeLameBbarQualificationCase,
  lameOracle,
} from './lib/lafea-plane-strain-bbar-lame-fixture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const definition = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'validation/lafea-incompressible/plane-strain-bbar-v1.json'),
  'utf8',
));
const probeMeshPolicy = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'validation/lafea-incompressible/plane-strain-bbar-probe-mesh-policy-v1.json'),
  'utf8',
));
const benchmark = definition.benchmarks.THICK_CYLINDER;
const distortion = definition.distortionMatrix.find((row) => row.distortionId === 'REGULAR');
const frozenProbe = benchmark.fixedPhysicalProbes.find(
  (row) => row.probeId === 'LAME-R90-T30-SX',
);
if (!distortion || !frozenProbe) throw new TypeError('Frozen diagnostic target missing');

const values = benchmark.meshLadder.levels.map((level) => {
  const run = executeLameBbarQualificationCase(definition, probeMeshPolicy, {
    elementType: 'T6',
    poissonRatio: 0.30,
    level,
    distortion,
  });
  const profile = meshProfile(level.targetElementLength, level.levelId, distortion.distortionId);
  requireLafeaAnalysisMeshQualifiedQualityPolicy('LAFEA.3', profile);
  const quality = qualifyLafeaAnalysisMesh('LAFEA.3', run.mesh, profile);
  assert.equal(
    quality.gateResults.some((row) => row.metric === 'MINIMUM_ANGLE_DEGREES'),
    false,
    `T6/${level.levelId} must not be governed by a straight-corner minimum-angle surrogate`,
  );
  assert.notEqual(
    quality.worstStatus,
    'BLOCK',
    `T6/${level.levelId} frozen Lamé mesh quality blocked`,
  );
  const probe = run.probes.find((row) => row.probe.probeId === frozenProbe.probeId);
  if (!probe) throw new TypeError(`Probe ${frozenProbe.probeId} missing at ${level.levelId}`);
  return Object.freeze({
    levelId: level.levelId,
    h: level.targetElementLength,
    value: probe.authoritativeValue,
    mappingResidual: probe.mapping.mappingResidual,
    meanDilatation: probe.meanDilatation,
    elementId: probe.mapping.elementId,
    qualityWorstStatus: quality.worstStatus,
    qualityGateMetrics: quality.gateResults.map((row) => row.metric),
  });
});
const oracle = lameOracle(definition, 0.30, frozenProbe);
const l3 = benchmark.meshLadder.levels.find((row) => row.levelId === 'L3');
if (!l3) throw new TypeError('Frozen L3 stress diagnostic level missing');
let firstL3SolverFailure = null;
outer:
for (const rowDistortion of definition.distortionMatrix) {
  for (const poissonRatio of definition.poissonRatioLadder) {
    if (rowDistortion.distortionId === 'REGULAR' && poissonRatio === 0.30) continue;
    try {
      executeLameBbarQualificationCase(definition, probeMeshPolicy, {
        elementType: 'T6',
        poissonRatio,
        level: l3,
        distortion: rowDistortion,
      });
    } catch (error) {
      firstL3SolverFailure = Object.freeze({
        elementType: 'T6',
        levelId: l3.levelId,
        poissonRatio,
        distortionId: rowDistortion.distortionId,
        errorName: error?.name ?? 'Error',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      break outer;
    }
  }
}

console.log(JSON.stringify({
  schema: 'lafea-b01-bbar-lame-convergence-diagnostic/v1',
  status: 'EVIDENCE_ONLY',
  studyId: `${definition.programmeId}/T6/REGULAR/NU-0.3/${frozenProbe.probeId}`,
  expectedValue: oracle.expectedValue,
  levels: values.map((row) => ({
    ...row,
    relativeError: Math.abs(row.value - oracle.expectedValue) / Math.max(Math.abs(oracle.expectedValue), 1e-30),
  })),
  allFour: sequenceEvidence(values),
  finestThree: sequenceEvidence(values.slice(-3)),
  firstL3SolverFailure,
  qualificationChanged: false,
  releaseAuthorityGranted: false,
}, null, 2));

function meshProfile(h, levelId, distortionId) {
  const defaults = defaultProfileFields(PROFILE_KINDS.MESH);
  const policy = LAFEA3_QUALIFIED_MESH_QUALITY_POLICY.fields;
  return canonicalProfile(PROFILE_KINDS.MESH, {
    schema: 'lafea-mesh-profile/v1',
    profileIdentity: `B01-DIAGNOSTIC/T6/${levelId}/${distortionId}`,
    sourceRevision: 'PS-BBAR-FROZEN-V1',
    semanticHash: undefined,
    fields: {
      ...defaults,
      continuumElement: 'T6',
      globalTargetSize: h,
      adjacentSizeRatioMax: policy.adjacentSizeRatioMax,
      aspectRatioWarn: policy.aspectRatioWarn,
      aspectRatioBlock: policy.aspectRatioBlock,
      scaledJacobianWarn: policy.scaledJacobianWarn,
      scaledJacobianBlock: policy.scaledJacobianBlock,
      adaptiveLevels: Math.max(defaults.adaptiveLevels, policy.adaptiveLevelsMinimum),
    },
  });
}

function sequenceEvidence(rows) {
  const differences = rows.slice(0, -1).map((row, index) => row.value - rows[index + 1].value);
  const orders = differences.slice(0, -1).map((difference, index) =>
    Math.log(Math.abs(difference) / Math.abs(differences[index + 1])) / Math.log(2));
  const observedOrder = orders.at(-1) ?? null;
  const orderSpreadRelative = orders.length > 1 && Number.isFinite(observedOrder)
    ? (Math.max(...orders) - Math.min(...orders)) / Math.max(Math.abs(observedOrder), 1e-15)
    : null;
  return Object.freeze({
    levelIds: rows.map((row) => row.levelId),
    differences,
    observedOrders: orders,
    observedOrder,
    orderSpreadRelative,
  });
}
