#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  calculateLocalShell,
  createCanonicalLocalShellModel,
} from '../src/core/local-shell/index.js';
import {
  prescribedPatchSource,
  pressurePatchSource,
} from './lafea.4-fixtures.mjs';

const E = 200000;
const NU = 0.3;
const EPSILON = Object.freeze({ epsilonX: 0.0004, epsilonY: -0.0001, gammaXY: 0.00015 });
const ROTATION = 37 * Math.PI / 180;

const frameCovariance = qualifyFrameCovariance();
const rigidRotation = qualifyRigidPhysicalRotation();
const normalReversal = qualifyDeclaredNormalReversal();

console.log(JSON.stringify({
  schema: 'lafea4-a2-frame-covariance-check/v1',
  status: 'PASS',
  engineeringBoundary: 'FRAME_AND_PRESSURE_SIGN_TRANSFER_ONLY',
  releaseAuthorityGranted: false,
  frameCovariance,
  rigidRotation,
  normalReversal,
}, null, 2));

function qualifyFrameCovariance() {
  const source = prescribedPatchSource({
    ...EPSILON,
    curvature: [0, 0, 0],
  });
  source.modelIdentity = 'L4-MAP-03-LOCAL-GLOBAL-COVARIANCE';
  const result = solve(source);
  const loadCase = result.loadCaseResults[0];
  const globalStrain = engineeringStrainTensor(EPSILON);
  const globalStress = planeStressTensor(E, NU, EPSILON);
  let maximumLocalStressError = 0;
  let maximumLocalStrainError = 0;
  let maximumReverseGlobalStressError = 0;
  let maximumReverseGlobalStrainError = 0;
  let unrotatedOracleError = 0;
  let rotatedElementCount = 0;

  for (const elementResult of loadCase.elementResults) {
    const meshElement = result.meshEvidence.elements.find(
      (row) => row.elementId === elementResult.elementId,
    );
    assert.ok(meshElement);
    const expectedLocalStress = projectTensorToFrame(globalStress, meshElement.localFrame);
    const expectedLocalStrain = projectTensorToFrame(globalStrain, meshElement.localFrame, true);
    const actualLocalStress = stressRecordToTensor(elementResult.membraneStress);
    const actualLocalStrain = strainRecordToTensor(elementResult.membraneStrain);
    maximumLocalStressError = Math.max(
      maximumLocalStressError,
      tensorError(actualLocalStress, expectedLocalStress),
    );
    maximumLocalStrainError = Math.max(
      maximumLocalStrainError,
      tensorError(actualLocalStrain, expectedLocalStrain),
    );
    maximumReverseGlobalStressError = Math.max(
      maximumReverseGlobalStressError,
      tensorError(tensorFromFrame(actualLocalStress, meshElement.localFrame), globalStress),
    );
    maximumReverseGlobalStrainError = Math.max(
      maximumReverseGlobalStrainError,
      tensorError(tensorFromFrame(actualLocalStrain, meshElement.localFrame), globalStrain),
    );

    if (Math.abs(meshElement.localFrame.ex[1]) > 0.1) {
      rotatedElementCount += 1;
      unrotatedOracleError = Math.max(
        unrotatedOracleError,
        tensorError(actualLocalStress, globalStress),
      );
    }
  }

  assert.ok(rotatedElementCount >= 1, 'fixture must exercise a non-global element frame');
  close(maximumLocalStressError, 0, 1e-8);
  close(maximumLocalStrainError, 0, 1e-11);
  close(maximumReverseGlobalStressError, 0, 1e-8);
  close(maximumReverseGlobalStrainError, 0, 1e-11);
  assert.ok(
    unrotatedOracleError > 1,
    `unrotated global stress oracle must materially fail on a rotated element; got ${unrotatedOracleError}`,
  );

  const expectedEnergy = strainEnergyDensity(globalStress, globalStrain) * 100 * 50 * 2;
  close(loadCase.totalStrainEnergy, expectedEnergy, 1e-8);
  assert.equal(loadCase.energyQualification.accepted, true);

  return Object.freeze({
    caseId: 'L4-MAP-03-LOCAL-GLOBAL',
    globalEngineeringStrain: tensorToEngineering(globalStrain),
    globalStress: tensorToStress(globalStress),
    rotatedElementCount,
    maximumLocalStressError,
    maximumLocalStrainError,
    maximumReverseGlobalStressError,
    maximumReverseGlobalStrainError,
    deliberateUnrotatedOracleMaximumError: unrotatedOracleError,
    expectedTotalStrainEnergy: expectedEnergy,
    actualTotalStrainEnergy: loadCase.totalStrainEnergy,
  });
}

function qualifyRigidPhysicalRotation() {
  const baseSource = prescribedPatchSource({
    ...EPSILON,
    curvature: [0, 0, 0],
  });
  baseSource.modelIdentity = 'L4-MAP-03-RIGID-ROTATION-BASE';
  const base = solve(baseSource);
  const baseCase = base.loadCaseResults[0];

  const c = Math.cos(ROTATION);
  const s = Math.sin(ROTATION);
  const q = [[c, -s], [s, c]];
  const baseStrain = engineeringStrainTensor(EPSILON);
  const baseStress = planeStressTensor(E, NU, EPSILON);
  const rotatedStrain = multiply2(multiply2(q, baseStrain), transpose2(q));
  const rotatedStress = multiply2(multiply2(q, baseStress), transpose2(q));

  const source = structuredClone(baseSource);
  source.modelIdentity = 'L4-MAP-03-RIGID-ROTATION-37DEG';
  source.modelVersion = 'A2-FRAME-1';
  source.nodes.forEach((node) => {
    const [x, y, z] = node.position;
    node.position = [c * x - s * y, s * x + c * y, z];
    node.director = [0, 0, 1];
    node.rotationBasis1 = [c, s, 0];
    node.rotationBasis2 = [-s, c, 0];
  });
  source.constraints = prescribedTensorConstraints(source.nodes, rotatedStrain);
  const rotated = solve(source);
  const rotatedCase = rotated.loadCaseResults[0];

  let maximumRecoveredGlobalStressError = 0;
  let maximumRecoveredGlobalStrainError = 0;
  for (const elementResult of rotatedCase.elementResults) {
    const meshElement = rotated.meshEvidence.elements.find(
      (row) => row.elementId === elementResult.elementId,
    );
    assert.ok(meshElement);
    const actualLocalStress = stressRecordToTensor(elementResult.membraneStress);
    const actualLocalStrain = strainRecordToTensor(elementResult.membraneStrain);
    maximumRecoveredGlobalStressError = Math.max(
      maximumRecoveredGlobalStressError,
      tensorError(tensorFromFrame(actualLocalStress, meshElement.localFrame), rotatedStress),
    );
    maximumRecoveredGlobalStrainError = Math.max(
      maximumRecoveredGlobalStrainError,
      tensorError(tensorFromFrame(actualLocalStrain, meshElement.localFrame), rotatedStrain),
    );
  }
  close(maximumRecoveredGlobalStressError, 0, 1e-8);
  close(maximumRecoveredGlobalStrainError, 0, 1e-11);
  close(rotatedCase.totalStrainEnergy, baseCase.totalStrainEnergy, 1e-8);
  close(trace2(rotatedStress), trace2(baseStress), 1e-10);
  close(det2(rotatedStress), det2(baseStress), 1e-10);
  close(trace2(rotatedStrain), trace2(baseStrain), 1e-12);
  close(det2(rotatedStrain), det2(baseStrain), 1e-12);
  assert.equal(rotatedCase.energyQualification.accepted, true);

  return Object.freeze({
    caseId: 'L4-MAP-03-RIGID-PHYSICAL-ROTATION',
    rotationDegrees: 37,
    baseTotalStrainEnergy: baseCase.totalStrainEnergy,
    rotatedTotalStrainEnergy: rotatedCase.totalStrainEnergy,
    stressTraceInvariant: trace2(baseStress),
    stressDeterminantInvariant: det2(baseStress),
    strainTraceInvariant: trace2(baseStrain),
    strainDeterminantInvariant: det2(baseStrain),
    maximumRecoveredGlobalStressError,
    maximumRecoveredGlobalStrainError,
  });
}

function qualifyDeclaredNormalReversal() {
  const baseSource = pressurePatchSource('ALONG_ELEMENT_NORMAL');
  baseSource.modelIdentity = 'L4-MAP-NORMAL-BASE';
  const reversedSource = structuredClone(baseSource);
  reversedSource.modelIdentity = 'L4-MAP-NORMAL-DECLARED-REVERSED';
  reversedSource.elements.forEach((element) => {
    element.nodeIds = [element.nodeIds[0], element.nodeIds[2], element.nodeIds[1]];
  });

  const baseRawNormal = rawDeclaredNormal(baseSource, baseSource.elements[0]);
  const reversedRawNormal = rawDeclaredNormal(reversedSource, reversedSource.elements[0]);
  close(dot3(baseRawNormal, reversedRawNormal), -1, 1e-12);

  const base = solve(baseSource);
  const reversed = solve(reversedSource);
  const baseCase = base.loadCaseResults[0];
  const reversedCase = reversed.loadCaseResults[0];
  vectorClose(reversedCase.appliedLoadEvidence.appliedForce, baseCase.appliedLoadEvidence.appliedForce);
  vectorClose(
    reversedCase.appliedLoadEvidence.appliedMomentAboutOrigin,
    baseCase.appliedLoadEvidence.appliedMomentAboutOrigin,
  );
  close(reversedCase.totalStrainEnergy, baseCase.totalStrainEnergy, 1e-12);
  assert.equal(reversedCase.forceEquilibrium.qualification.accepted, true);
  assert.equal(reversedCase.momentEquilibrium.qualification.accepted, true);

  for (const element of reversed.meshEvidence.elements) {
    const sourceElement = reversedSource.elements.find((row) => row.elementId === element.elementId);
    assert.ok(sourceElement);
    const directors = sourceElement.nodeIds.map((nodeId) =>
      reversedSource.nodes.find((node) => node.nodeId === nodeId).director);
    assert.equal(directors.length, 3);
    directors.forEach((director) => {
      assert.ok(
        dot3(element.localFrame.ez, director) > 0.8,
        `${element.elementId} canonical element normal must remain aligned to nodal/parent director`,
      );
    });
  }

  return Object.freeze({
    caseId: 'L4-MAP-NORMAL-REVERSAL-CANONICALIZATION',
    declaredConnectivityNormalDot: dot3(baseRawNormal, reversedRawNormal),
    appliedForce: reversedCase.appliedLoadEvidence.appliedForce,
    appliedMomentAboutOrigin: reversedCase.appliedLoadEvidence.appliedMomentAboutOrigin,
    canonicalElementNormalsRemainDirectorAligned: true,
    pressureDirectionChangedByDeclaredConnectivityReversal: false,
    energyUnchanged: true,
  });
}

function solve(source) {
  const result = calculateLocalShell(createCanonicalLocalShellModel(source));
  assert.equal(result.qualification.accepted, true, result.qualification.summary);
  return result;
}

function planeStressTensor(elasticModulus, poissonRatio, strain) {
  const factor = elasticModulus / (1 - poissonRatio ** 2);
  const shearModulus = elasticModulus / (2 * (1 + poissonRatio));
  return [[
    factor * (strain.epsilonX + poissonRatio * strain.epsilonY),
    shearModulus * strain.gammaXY,
  ], [
    shearModulus * strain.gammaXY,
    factor * (strain.epsilonY + poissonRatio * strain.epsilonX),
  ]];
}

function engineeringStrainTensor(strain) {
  return [[strain.epsilonX, strain.gammaXY / 2], [strain.gammaXY / 2, strain.epsilonY]];
}

function stressRecordToTensor(record) {
  return [[record.sigmaX, record.tauXY], [record.tauXY, record.sigmaY]];
}

function strainRecordToTensor(record) {
  return [[record.epsilonX, record.gammaXY / 2], [record.gammaXY / 2, record.epsilonY]];
}

function projectTensorToFrame(globalTensor, frame, engineeringStrain = false) {
  const q = [
    [frame.localFrame?.ex?.[0] ?? frame.ex[0], frame.localFrame?.ey?.[0] ?? frame.ey[0]],
    [frame.localFrame?.ex?.[1] ?? frame.ex[1], frame.localFrame?.ey?.[1] ?? frame.ey[1]],
  ];
  const local = multiply2(multiply2(transpose2(q), globalTensor), q);
  if (!engineeringStrain) return local;
  return [[local[0][0], local[0][1]], [local[1][0], local[1][1]]];
}

function tensorFromFrame(localTensor, frame) {
  const q = [[frame.ex[0], frame.ey[0]], [frame.ex[1], frame.ey[1]]];
  return multiply2(multiply2(q, localTensor), transpose2(q));
}

function prescribedTensorConstraints(nodes, strainTensor) {
  return nodes.flatMap((node) => {
    const [x, y] = node.position;
    const ux = strainTensor[0][0] * x + strainTensor[0][1] * y;
    const uy = strainTensor[1][0] * x + strainTensor[1][1] * y;
    const values = { UX: ux, UY: uy, UZ: 0, R1: 0, R2: 0 };
    return ['UX', 'UY', 'UZ', 'R1', 'R2'].map((dof) => ({
      constraintId: `A2-ROT-${node.nodeId}-${dof}`,
      nodeId: node.nodeId,
      dof,
      value: values[dof],
      sourceReference: `L4-MAP-03-ROTATED/${node.nodeId}/${dof}`,
    }));
  });
}

function rawDeclaredNormal(source, element) {
  const points = element.nodeIds.map((nodeId) =>
    source.nodes.find((node) => node.nodeId === nodeId).position);
  const a = subtract3(points[1], points[0]);
  const b = subtract3(points[2], points[0]);
  const normal = cross3(a, b);
  const magnitude = Math.hypot(...normal);
  assert.ok(magnitude > 0);
  return normal.map((value) => value / magnitude);
}

function strainEnergyDensity(stress, strain) {
  return 0.5 * (
    stress[0][0] * strain[0][0]
    + stress[1][1] * strain[1][1]
    + 2 * stress[0][1] * strain[0][1]
  );
}

function tensorToEngineering(tensor) {
  return { epsilonX: tensor[0][0], epsilonY: tensor[1][1], gammaXY: 2 * tensor[0][1] };
}
function tensorToStress(tensor) {
  return { sigmaX: tensor[0][0], sigmaY: tensor[1][1], tauXY: tensor[0][1] };
}
function tensorError(a, b) {
  return Math.max(
    Math.abs(a[0][0] - b[0][0]),
    Math.abs(a[1][1] - b[1][1]),
    Math.abs(a[0][1] - b[0][1]),
    Math.abs(a[1][0] - b[1][0]),
  );
}
function multiply2(a, b) {
  return [
    [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
    [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
  ];
}
function transpose2(a) { return [[a[0][0], a[1][0]], [a[0][1], a[1][1]]]; }
function trace2(a) { return a[0][0] + a[1][1]; }
function det2(a) { return a[0][0] * a[1][1] - a[0][1] * a[1][0]; }
function subtract3(a, b) { return a.map((value, index) => value - b[index]); }
function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function dot3(a, b) { return a.reduce((sum, value, index) => sum + value * b[index], 0); }
function vectorClose(actual, expected, tolerance = 1e-9) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => close(value, expected[index], tolerance));
}
function close(actual, expected, tolerance = 1e-9) {
  const scale = Math.max(1, Math.abs(expected));
  assert.ok(Math.abs(actual - expected) <= tolerance * scale, `${actual} != ${expected}`);
}
