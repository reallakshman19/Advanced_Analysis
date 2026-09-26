import assert from 'node:assert/strict';
import {
  DETERMINISTIC_JACOBI_PCG_REVISION,
  solveDeterministicJacobiPcg,
} from '../src/core/lafea-linear-solve/index.js';

verifyIndependentSpdOracle();
verifyDeterminism();
verifySingularDiagonalControl();
verifyIndefiniteDiagonalControl();
verifyCurvatureControl();
verifyNonConvergenceControl();

console.log('LAFEA shared deterministic Jacobi-PCG analytical oracle and fail-closed controls passed.');

function verifyIndependentSpdOracle() {
  const solved = solve(twoByTwoOptions());
  close(solved.solution[0], 1 / 11, 1e-12);
  close(solved.solution[1], 7 / 11, 1e-12);
  assert.equal(solved.evidence.method, 'DETERMINISTIC_JACOBI_PCG');
  assert.equal(solved.evidence.algorithmRevision, DETERMINISTIC_JACOBI_PCG_REVISION);
  assert.equal(solved.evidence.preconditioner, 'JACOBI');
  assert.equal(solved.evidence.accepted, true);
  assert.ok(solved.evidence.iterations > 0);
  assert.ok(solved.evidence.finalResidualInfinity <= solved.evidence.convergenceTarget);
  const residual = multiply2(solved.solution).map((value, index) => value - [1, 2][index]);
  assert.ok(Math.max(...residual.map(Math.abs)) <= 1e-12);
}

function verifyDeterminism() {
  assert.deepEqual(solve(twoByTwoOptions()), solve(twoByTwoOptions()));
}

function verifySingularDiagonalControl() {
  rejectsCode(() => solve({
    size: 2,
    diagonal: [4, 0],
    rightHandSide: [1, 2],
    multiply: multiply2,
    diagonalTolerance: 1e-12,
    residualTolerance: 1e-10,
  }), 'PCG_SINGULAR_DIAGONAL');
}

function verifyIndefiniteDiagonalControl() {
  rejectsCode(() => solve({
    size: 2,
    diagonal: [4, -1],
    rightHandSide: [1, 2],
    multiply: multiply2,
    diagonalTolerance: 1e-12,
    residualTolerance: 1e-10,
  }), 'PCG_INDEFINITE_DIAGONAL');
}

function verifyCurvatureControl() {
  rejectsCode(() => solve({
    size: 2,
    diagonal: [1, 1],
    rightHandSide: [1, 0],
    multiply: (vector) => vector.map((value) => -value),
    diagonalTolerance: 1e-12,
    residualTolerance: 1e-10,
  }), 'PCG_NON_POSITIVE_CURVATURE');
}

function verifyNonConvergenceControl() {
  let calls = 0;
  const inconsistentPositiveAction = (vector) => {
    calls += 1;
    const factor = calls % 2 === 1 ? 1 : 2;
    return vector.map((value) => factor * value);
  };
  rejectsCode(() => solve({
    size: 1,
    diagonal: [1],
    rightHandSide: [1],
    multiply: inconsistentPositiveAction,
    diagonalTolerance: 1e-12,
    residualTolerance: 1e-10,
  }), 'PCG_DID_NOT_CONVERGE');
}

function twoByTwoOptions() {
  return {
    size: 2,
    diagonal: [4, 3],
    rightHandSide: [1, 2],
    multiply: multiply2,
    diagonalTolerance: 1e-12,
    residualTolerance: 1e-10,
  };
}

function multiply2([x, y]) {
  return [4 * x + y, x + 3 * y];
}

function solve(options) {
  return solveDeterministicJacobiPcg(options);
}

function rejectsCode(action, code) {
  assert.throws(action, (error) => error?.code === code);
}

function close(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
}
