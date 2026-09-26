#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeLameBbarQualificationCase } from './lib/lafea-plane-strain-bbar-lame-fixture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const definition = readJson('validation/lafea-incompressible/plane-strain-bbar-v1.json');
const meshPolicy = readJson(
  'validation/lafea-incompressible/plane-strain-bbar-probe-mesh-policy-v1.json',
);
const level = definition.benchmarks.THICK_CYLINDER.meshLadder.levels
  .find((row) => row.levelId === 'L3');
const distortion = definition.distortionMatrix
  .find((row) => row.distortionId === 'REGULAR');

assert.ok(level);
assert.ok(distortion);

const accepted = ['T6', 'Q8'].map((elementType) => {
  const row = executeLameBbarQualificationCase(definition, meshPolicy, {
    elementType,
    poissonRatio: 0.49,
    level,
    distortion,
  });
  assert.equal(row.result.qualification.state, 'ACCEPTED');
  assert.ok(row.loadCase.solverEvidence.finalResidualInfinity
    <= row.loadCase.solverEvidence.convergenceTarget);
  return Object.freeze({
    elementType,
    poissonRatio: 0.49,
    levelId: row.levelId,
    state: row.result.qualification.state,
    solverMethod: row.loadCase.solverEvidence.method,
    iterations: row.loadCase.solverEvidence.iterations,
    finalResidualInfinity: row.loadCase.solverEvidence.finalResidualInfinity,
    convergenceTarget: row.loadCase.solverEvidence.convergenceTarget,
  });
});

assert.throws(
  () => executeLameBbarQualificationCase(definition, meshPolicy, {
    elementType: 'T6',
    poissonRatio: 0.499,
    level,
    distortion,
  }),
  (error) => error?.code === 'PLANE_STRAIN_BBAR_NEAR_INCOMPRESSIBLE_NOT_QUALIFIED',
);

console.log(JSON.stringify({
  schema: 'lafea-plane-strain-bbar-production-envelope-check/v1',
  status: 'PASS',
  maximumQualifiedPoissonRatio: 0.49,
  accepted,
  unsupportedWitness: {
    elementType: 'T6',
    distortionId: 'REGULAR',
    poissonRatio: 0.499,
    levelId: 'L3',
    expectedCode: 'PLANE_STRAIN_BBAR_NEAR_INCOMPRESSIBLE_NOT_QUALIFIED',
  },
  frozenDefinitionModified: false,
  solverToleranceModified: false,
  sparseDirectFallbackGranted: false,
  releaseAuthorityGranted: false,
}, null, 2));

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}
