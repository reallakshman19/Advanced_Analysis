#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  MITC4_GAUSS_POINTS,
  SHEAR_CORRECTION_FACTOR as MITC4_SHEAR_CORRECTION,
  bendingBMatrixAt as mitc4BendingBMatrixAt,
  jacobianAt as mitc4JacobianAt,
  membraneBMatrixAt as mitc4MembraneBMatrixAt,
  q4ShapeFunctionsAndDerivatives,
  shearBMatrixAt as mitc4ShearBMatrixAt,
} from '../src/core/local-shell/mitc4-element.js';
import {
  MITC3_GAUSS_POINTS,
  SHEAR_CORRECTION_FACTOR as MITC3_SHEAR_CORRECTION,
  bendingBMatrix as mitc3BendingBMatrix,
  membraneBMatrix as mitc3MembraneBMatrix,
  shearBMatrixAt as mitc3ShearBMatrixAt,
} from '../src/core/local-shell/mitc3-element.js';

// A4 independent guard: expected values below are derived here from rigid-body
// kinematics and elementary Timoshenko beam theory. They are not copied from
// production FEM output and they do not use CST/DKT as an oracle.

const omega = Object.freeze([0.002, -0.001, 0.003]);
const expectedWrongBetaShear = Object.freeze([0.003, 0.001]);

const q4 = checkMitc4RigidObjectivity();
const t3 = checkMitc3RigidObjectivity();
const beam = checkIndependentTimoshenkoOracle();
const geometry = checkDistortedQ4CenterJacobian();

console.log(JSON.stringify({
  schema: 'lafea4-a4-independent-shear-objectivity-check/v1',
  status: 'PASS',
  oracleAuthority: 'INDEPENDENT_KINEMATICS_AND_TIMOSHENKO_HAND_CALCULATION',
  productionOutputUsedToChooseExpectedValues: false,
  productionOutputUsedToChooseTolerance: false,
  cstDktUsedAsSoleOracle: false,
  releaseAuthorityGranted: false,
  rigidObjectivity: { MITC4: q4, MITC3: t3 },
  timoshenko: beam,
  distortedQ4CenterJacobian: geometry,
}, null, 2));

function checkMitc4RigidObjectivity() {
  const nodes = [[0, 0], [4, 0], [5, 3], [0, 2]];
  const corrected = rigidLocalDofs(nodes, omega, true);
  const wrong = rigidLocalDofs(nodes, omega, false);

  let maximumCorrectMembrane = 0;
  let maximumCorrectCurvature = 0;
  let maximumCorrectShear = 0;
  for (const gp of MITC4_GAUSS_POINTS) {
    const membrane = multiply(mitc4MembraneBMatrixAt(nodes, gp.xi, gp.eta).B, corrected);
    const bending = multiply(mitc4BendingBMatrixAt(nodes, gp.xi, gp.eta).B, corrected);
    const shear = multiply(mitc4ShearBMatrixAt(nodes, gp.xi, gp.eta).B, corrected);
    maximumCorrectMembrane = Math.max(maximumCorrectMembrane, maxAbs(membrane));
    maximumCorrectCurvature = Math.max(maximumCorrectCurvature, maxAbs(bending));
    maximumCorrectShear = Math.max(maximumCorrectShear, maxAbs(shear));
    vectorClose(membrane, [0, 0, 0], 2e-12, `MITC4 ${gp.pointId} rigid membrane`);
    vectorClose(bending, [0, 0, 0], 2e-12, `MITC4 ${gp.pointId} rigid curvature`);
    vectorClose(shear, [0, 0], 2e-12, `MITC4 ${gp.pointId} rigid shear`);
  }

  const wrongShear = multiply(mitc4ShearBMatrixAt(nodes, 0, 0).B, wrong);
  vectorClose(wrongShear, expectedWrongBetaShear, 2e-12, 'MITC4 wrong-beta shear falsifier');
  assert.ok(maxAbs(wrongShear) > 1e-4, 'MITC4 wrong-beta mapping must produce material spurious shear');
  assert.equal(MITC4_SHEAR_CORRECTION, 5 / 6);

  return Object.freeze({
    status: 'PASS',
    maximumCorrectMembrane,
    maximumCorrectCurvature,
    maximumCorrectShear,
    wrongBetaShearAtCenter: wrongShear,
    expectedWrongBetaShear,
    shearCorrectionFactor: MITC4_SHEAR_CORRECTION,
  });
}

function checkMitc3RigidObjectivity() {
  const nodes = [[0, 0], [4, 0.5], [0.5, 3]];
  const corrected = rigidLocalDofs(nodes, omega, true);
  const wrong = rigidLocalDofs(nodes, omega, false);

  const membraneB = mitc3MembraneBMatrix(nodes);
  const bendingB = mitc3BendingBMatrix(nodes);
  vectorClose(multiply(membraneB, corrected), [0, 0, 0], 2e-12, 'MITC3 rigid membrane');
  vectorClose(multiply(bendingB, corrected), [0, 0, 0], 2e-12, 'MITC3 rigid curvature');

  let maximumCorrectShear = 0;
  for (const gp of MITC3_GAUSS_POINTS) {
    const shear = multiply(mitc3ShearBMatrixAt(nodes, gp.r, gp.s).B, corrected);
    maximumCorrectShear = Math.max(maximumCorrectShear, maxAbs(shear));
    vectorClose(shear, [0, 0], 2e-12, `MITC3 ${gp.pointId} rigid shear`);
  }

  const wrongShear = multiply(mitc3ShearBMatrixAt(nodes, 1 / 3, 1 / 3).B, wrong);
  vectorClose(wrongShear, expectedWrongBetaShear, 2e-12, 'MITC3 wrong-beta shear falsifier');
  assert.ok(maxAbs(wrongShear) > 1e-4, 'MITC3 wrong-beta mapping must produce material spurious shear');
  assert.equal(MITC3_SHEAR_CORRECTION, 5 / 6);

  return Object.freeze({
    status: 'PASS',
    maximumCorrectShear,
    wrongBetaShearAtCentroid: wrongShear,
    expectedWrongBetaShear,
    shearCorrectionFactor: MITC3_SHEAR_CORRECTION,
  });
}

function checkIndependentTimoshenkoOracle() {
  const E = 200000;
  const nu = 0;
  const G = E / (2 * (1 + nu));
  const L = 10;
  const b = 1;
  const P = 1;
  const k = 5 / 6;
  const t = 2;
  const A = b * t;
  const I = b * t ** 3 / 12;
  const bending = P * L ** 3 / (3 * E * I);
  const shear = P * L / (k * G * A);
  const total = bending + shear;
  const shearFraction = shear / total;

  close(A, 2, 1e-14, 'Timoshenko area');
  close(I, 2 / 3, 1e-14, 'Timoshenko second moment');
  close(bending, 0.0025, 1e-14, 'Euler-Bernoulli bending deflection');
  close(shear, 0.00006, 1e-14, 'Timoshenko shear deflection');
  close(total, 0.00256, 1e-14, 'Timoshenko total deflection');
  close(shearFraction, 0.0234375, 1e-14, 'Timoshenko shear fraction');
  assert.ok(shear > 0, 'moderate-thickness oracle must retain physical shear compliance');

  const sweep = [1e-5, 1e-4, 1e-3, 1e-2, 0.05, 0.1, 0.2].map((ratio) => {
    const thickness = ratio * L;
    const area = b * thickness;
    const inertia = b * thickness ** 3 / 12;
    const db = P * L ** 3 / (3 * E * inertia);
    const ds = P * L / (k * G * area);
    return Object.freeze({ tOverL: ratio, bending: db, shear: ds, total: db + ds, shearFraction: ds / (db + ds) });
  });
  assert.ok(sweep[0].shearFraction < 1e-9, 'thin-limit physical shear fraction must vanish');
  assert.ok(sweep.at(-1).shearFraction > 0.02, 't/L=0.2 must retain material physical shear compliance');

  return Object.freeze({ E, nu, G, L, b, P, k, t, A, I, bending, shear, total, shearFraction, sweep });
}

function checkDistortedQ4CenterJacobian() {
  const nodes = [[0, 0], [4, 0], [5, 3], [0, 2]];
  const { dNdXi, dNdEta } = q4ShapeFunctionsAndDerivatives(0, 0);
  const production = mitc4JacobianAt(nodes, dNdXi, dNdEta);
  const independent = {
    dxDxi: 2.25,
    dxDeta: 0.25,
    dyDxi: 0.25,
    dyDeta: 1.25,
    determinant: 2.75,
  };
  for (const [key, expected] of Object.entries(independent)) close(production[key], expected, 1e-14, `Q4 center Jacobian ${key}`);
  assert.ok(production.determinant > 0);
  return Object.freeze(independent);
}

function rigidLocalDofs(nodes, rotation, correctedBeta) {
  const [omegaX, omegaY, omegaZ] = rotation;
  return nodes.flatMap(([x, y]) => {
    const u = -omegaZ * y;
    const v = omegaZ * x;
    const w = omegaX * y - omegaY * x;
    const betaX = correctedBeta ? omegaY : omegaX;
    const betaY = correctedBeta ? -omegaX : omegaY;
    return [u, v, w, betaX, betaY];
  });
}

function multiply(matrix, vector) {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}

function vectorClose(actual, expected, tolerance, label) {
  assert.equal(actual.length, expected.length, `${label} length`);
  actual.forEach((value, index) => close(value, expected[index], tolerance, `${label}[${index}]`));
}

function close(actual, expected, tolerance, label) {
  const scale = Math.max(1, Math.abs(expected));
  assert.ok(Math.abs(actual - expected) <= tolerance * scale, `${label}: ${actual} != ${expected}`);
}

function maxAbs(values) {
  return Math.max(...values.map((value) => Math.abs(value)));
}
