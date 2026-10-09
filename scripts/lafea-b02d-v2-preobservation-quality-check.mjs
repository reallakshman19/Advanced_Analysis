#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  generateLafeaB02dProbeStablePolarMeshV2,
  lafeaB02dProbeStablePolarPolicyV2,
  LAFEA_B02D_PROBE_STABLE_POLAR_POLICY_ID_V2,
} from '../src/core/lafea-meshing/b02d-probe-stable-polar-mesh-v2.js';
import {
  canonicalProfile,
  defaultProfileFields,
  PROFILE_KINDS,
} from '../src/core/lafea-profile-contract/index.js';
import { qualifyLafeaAnalysisMesh } from '../src/workspace/lafea-analysis-mesh-quality.js';
import { qualifyLafeaMeshTopologyV3 } from '../src/workspace/lafea-mesh-topology-qualification-v3.js';
import { qualifyLafeaHighOrderJacobiansV3 } from '../src/workspace/lafea-high-order-jacobian-qualification-v3.js';

const definition = JSON.parse(fs.readFileSync(
  'validation/lafea-b02-definitions/B02D-lug-pinhole-v2.json', 'utf8',
));
const policy = lafeaB02dProbeStablePolarPolicyV2();
assert.equal(definition.definitionState, 'FROZEN_BEFORE_PRODUCTION_OBSERVATION');
assert.equal(definition.productionOutputUsedToChooseDefinition, false);
assert.equal(definition.v2DesignBasis.responseResultsUsedToSelectV2, false);
assert.equal(policy.policyId, LAFEA_B02D_PROBE_STABLE_POLAR_POLICY_ID_V2);
assert.equal(policy.circumferentialAxis.backgroundBaseDivisions, 20);
assert.equal(definition.fixedProbeMeshPolicy.circumferentialAxis.backgroundBaseDivisions, 20);
assert.equal(policy.circumferentialAxis.windowClearanceFraction, 0.32);
assert.equal(definition.fixedProbeMeshPolicy.circumferentialAxis.windowClearanceFraction, 0.32);
assert.equal(policy.radialAxis.backgroundBaseDivisions, 6);
assert.equal(policy.radialAxis.windowClearanceFraction, 0.3);
assert.deepEqual(policy.levels.map((row) => row.h), [40, 20, 10, 5]);
assert.equal(definition.v2DesignBasis.preObservationTrials.at(-1).status, 'QUALIFIED_PRE_OBSERVATION');

const records = [];
for (const family of ['T3', 'T6', 'Q8']) {
  for (const level of definition.globalResponseLadder.levels) {
    const first = generateLafeaB02dProbeStablePolarMeshV2({
      targetElementLength: level.h,
      elementFamily: family,
    });
    const second = generateLafeaB02dProbeStablePolarMeshV2({
      targetElementLength: level.h,
      elementFamily: family,
    });
    assert.equal(first.semanticHash, second.semanticHash, `${family}/${level.levelId} deterministic output`);
    assert.deepEqual(first.mesh, second.mesh, `${family}/${level.levelId} deterministic mesh`);
    const quality = qualifyLafeaAnalysisMesh('LAFEA.3', first.mesh, meshProfile(family, level.h));
    const nodeById = new Map(first.mesh.nodes.map((node) => [node.nodeId, node]));
    const elementById = new Map(first.mesh.elements.map((element) => [element.elementId, element]));
    const record = {
      family,
      levelId: level.levelId,
      h: level.h,
      nodeCount: first.mesh.nodes.length,
      elementCount: first.mesh.elements.length,
      meshSemanticHash: first.semanticHash,
      qualityWorstStatus: quality.worstStatus,
      minimumScaledJacobian: metric(quality, 'SCALED_JACOBIAN'),
      maximumAspectRatio: metric(quality, 'ASPECT_RATIO'),
      minimumAngleDegrees: optionalMetric(quality, 'MINIMUM_ANGLE_DEGREES'),
      blockingElementIds: quality.blockingElementIds.slice(0, 20),
      blockingElements: quality.elementResults
        .filter((row) => row.worstStatus === 'BLOCK')
        .slice(0, 10)
        .map((row) => {
          const element = elementById.get(row.elementId);
          return {
            elementId: row.elementId,
            metrics: row.metrics,
            nodeIds: element?.nodeIds ?? [],
            nodes: (element?.nodeIds ?? []).slice(0, family === 'Q8' ? 4 : 3).map((nodeId) => {
              const node = nodeById.get(nodeId);
              return {
                nodeId,
                x: node?.x ?? null,
                y: node?.y ?? null,
                radius: node ? Math.hypot(node.x, node.y) : null,
                angleDegrees: node
                  ? normalizedAngle(Math.atan2(node.y, node.x) * 180 / Math.PI)
                  : null,
              };
            }),
          };
        }),
    };
    records.push(record);
    assert.notEqual(quality.worstStatus, 'BLOCK', `B02D_V2_PREOBS_QUALITY_BLOCK:${JSON.stringify(record)}`);
    assert.equal(qualifyLafeaMeshTopologyV3(first.mesh).qualification, 'PASS', `${family}/${level.levelId} topology`);
    if (family !== 'T3') {
      assert.equal(qualifyLafeaHighOrderJacobiansV3(first.mesh).qualification, 'PASS', `${family}/${level.levelId} high-order Jacobian`);
    }
  }
}
const t3l1 = records.find((row) => row.family === 'T3' && row.levelId === 'L1');
const t3l2 = records.find((row) => row.family === 'T3' && row.levelId === 'L2');
assert.ok(t3l1.minimumScaledJacobian > 0.2, JSON.stringify(t3l1));
assert.ok(t3l1.maximumAspectRatio < 5, JSON.stringify(t3l1));
assert.ok(t3l2.minimumScaledJacobian > 0.2, JSON.stringify(t3l2));
assert.ok(t3l2.maximumAspectRatio < 5, JSON.stringify(t3l2));

console.log(JSON.stringify({
  schema: 'lafea-b02d-v2-preobservation-quality-qualification/v1',
  status: 'PASS',
  definitionState: definition.definitionState,
  productionOutputUsedToChooseDefinition: definition.productionOutputUsedToChooseDefinition,
  policyId: policy.policyId,
  v1Preserved: true,
  responseObserved: false,
  hardQualityThresholdsChanged: false,
  records,
  releaseAuthorityGranted: false,
}, null, 2));

function meshProfile(family, h) {
  const fields = defaultProfileFields(PROFILE_KINDS.MESH);
  return canonicalProfile(PROFILE_KINDS.MESH, {
    schema: 'lafea-mesh-profile/v1',
    profileIdentity: `B02D_V2_PREOBS_${family}_H${h}`,
    sourceRevision: 'B02D-FROZEN-POLAR-V2-PREOBS',
    semanticHash: undefined,
    fields: { ...fields, continuumElement: family, globalTargetSize: h },
  });
}
function metric(quality, name) {
  const row = quality.gateResults.find((entry) => entry.metric === name);
  assert.ok(row, name);
  return row.value;
}
function optionalMetric(quality, name) {
  return quality.gateResults.find((entry) => entry.metric === name)?.value ?? null;
}
function normalizedAngle(value) {
  const angle = value < 0 ? value + 360 : value;
  return Math.abs(angle - 360) < 1e-10 ? 0 : angle;
}
