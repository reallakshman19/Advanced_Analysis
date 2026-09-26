import { LafeaLinearSolveError } from './errors.js';

export const DETERMINISTIC_JACOBI_PCG_REVISION = 'DETERMINISTIC_JACOBI_PCG_RELIABLE_RESIDUAL_V2';
export const PCG_RELIABLE_RESIDUAL_INTERVAL = 100;

/**
 * Factor by which the iterative solve is driven tighter than the caller's
 * acceptance tolerance.
 *
 * The caller's `residualTolerance` bounds a per-DOF (infinity-norm) residual,
 * but callers additionally qualify *summed* quantities derived from the same
 * residual vector - notably reaction/applied-force equilibrium totals. A sum
 * accumulates error with the degree-of-freedom count while the acceptance
 * tolerance does not scale with problem size, so the summed check is the
 * binding one on large models and needs the solve to land well inside the
 * per-DOF bound rather than merely within it.
 *
 * At 10 the margin is exhausted by roughly 7e4 free DOF: the infinity-norm
 * residual sits at ~5% of its limit while the summed force balance reaches
 * ~145% of its own. At 100 the same model lands well inside both.
 *
 * This tightens the solve only. It changes no acceptance tolerance, result
 * convention or algorithm, so it can only reduce solution error.
 */
export const PCG_CONVERGENCE_SAFETY_FACTOR = 100;

/**
 * Storage-independent deterministic Jacobi-preconditioned conjugate gradient.
 *
 * The caller owns matrix storage, partitioning, engineering tolerances and
 * domain error mapping. This module owns only the iterative SPD mechanics and
 * returns raw finite numerical evidence so continuum/shell adapters can retain
 * their existing canonical-number/result contracts.
 */
export function solveDeterministicJacobiPcg(options) {
  const input = validateInput(options);
  const diagonalScale = Math.max(1, ...input.diagonal.map((value) => Math.abs(value)));
  const minimumDiagonal = Math.min(...input.diagonal);
  const maximumDiagonal = Math.max(...input.diagonal);
  rejectInvalidDiagonal(minimumDiagonal, input.diagonalTolerance);

  const residualScale = Math.max(1, maxAbs(input.rightHandSide));
  const convergenceTarget = input.residualTolerance / PCG_CONVERGENCE_SAFETY_FACTOR;
  const iterationLimit = Math.min(50000, Math.max(1000, input.size * 16));
  const solution = Array(input.size).fill(0);
  let residual = [...input.rightHandSide];
  const initialResidualInfinity = maxAbs(residual);
  let finalResidualInfinity = initialResidualInfinity;
  let iterations = 0;
  let reliableResidualReplacements = 0;

  if (finalResidualInfinity > convergenceTarget) {
    ({
      residual,
      finalResidualInfinity,
      iterations,
      reliableResidualReplacements,
    } = iterate({
      ...input,
      solution,
      residual,
      convergenceTarget,
      iterationLimit,
    }));
  }

  residual = exactResidual(input.multiply, input.rightHandSide, solution);
  finalResidualInfinity = maxAbs(residual);
  if (finalResidualInfinity > convergenceTarget) {
    throw new LafeaLinearSolveError(
      'Deterministic Jacobi-PCG did not meet its internal convergence target.',
      'PCG_DID_NOT_CONVERGE',
      {
        finalResidualInfinity,
        convergenceTarget,
        residualTolerance: input.residualTolerance,
        iterations,
      },
    );
  }

  return Object.freeze({
    solution: Object.freeze([...solution]),
    evidence: Object.freeze({
      method: 'DETERMINISTIC_JACOBI_PCG',
      algorithmRevision: DETERMINISTIC_JACOBI_PCG_REVISION,
      pivotScale: null,
      pivotTolerance: null,
      pivots: Object.freeze([]),
      minimumPivot: null,
      maximumPivot: null,
      pivotRatio: null,
      preconditioner: 'JACOBI',
      iterationLimit,
      iterations,
      reliableResidualInterval: PCG_RELIABLE_RESIDUAL_INTERVAL,
      reliableResidualReplacements,
      residualScale,
      initialResidualInfinity,
      finalResidualInfinity,
      convergenceTarget,
      residualTolerance: input.residualTolerance,
      diagonalScale,
      diagonalTolerance: input.diagonalTolerance,
      minimumDiagonal,
      maximumDiagonal,
      diagonalRatio: minimumDiagonal / maximumDiagonal,
      accepted: true,
    }),
  });
}

function iterate(input) {
  const { diagonal, multiply, rightHandSide, solution, convergenceTarget, iterationLimit } = input;
  let residual = input.residual;
  let preconditioned = applyJacobi(diagonal, residual);
  let direction = [...preconditioned];
  let rho = dotVector(residual, preconditioned);
  requirePositive(rho, 'PCG_NON_POSITIVE_INITIAL_PRODUCT');
  let finalResidualInfinity = maxAbs(residual);
  let iterations = 0;
  let reliableResidualReplacements = 0;

  while (iterations < iterationLimit) {
    const action = multiply(direction);
    requireVector(action, direction.length, 'matrix-vector action');
    const curvature = dotVector(direction, action);
    if (!(curvature > 0) || !Number.isFinite(curvature)) {
      throw new LafeaLinearSolveError(
        'Deterministic Jacobi-PCG encountered non-positive curvature.',
        'PCG_NON_POSITIVE_CURVATURE',
        { curvature },
      );
    }
    const alpha = rho / curvature;
    for (let index = 0; index < solution.length; index += 1) {
      solution[index] += alpha * direction[index];
      residual[index] -= alpha * action[index];
    }
    iterations += 1;

    const recursiveResidualInfinity = maxAbs(residual);
    finalResidualInfinity = recursiveResidualInfinity;
    const reliableResidualDue = iterations % PCG_RELIABLE_RESIDUAL_INTERVAL === 0;
    if (recursiveResidualInfinity <= convergenceTarget || reliableResidualDue) {
      const reliableResidual = exactResidual(multiply, rightHandSide, solution);
      const reliableResidualInfinity = maxAbs(reliableResidual);
      finalResidualInfinity = reliableResidualInfinity;
      if (reliableResidualInfinity <= convergenceTarget) {
        residual = reliableResidual;
        break;
      }
      if (reliableResidualDue) {
        residual = reliableResidual;
        reliableResidualReplacements += 1;
      }
      if (recursiveResidualInfinity <= convergenceTarget) {
        residual = reliableResidual;
        preconditioned = applyJacobi(diagonal, residual);
        direction = [...preconditioned];
        rho = dotVector(residual, preconditioned);
        reliableResidualReplacements += reliableResidualDue ? 0 : 1;
        requirePositive(rho, 'PCG_NON_POSITIVE_RELIABLE_PRODUCT');
        continue;
      }
    }

    preconditioned = applyJacobi(diagonal, residual);
    const nextRho = dotVector(residual, preconditioned);
    requirePositive(nextRho, 'PCG_NON_POSITIVE_RESIDUAL_PRODUCT');
    const beta = nextRho / rho;
    rho = nextRho;
    for (let index = 0; index < direction.length; index += 1) {
      direction[index] = preconditioned[index] + beta * direction[index];
    }
  }

  return { residual, finalResidualInfinity, iterations, reliableResidualReplacements };
}

function validateInput(options) {
  if (!options || typeof options !== 'object') invalid('options must be an object');
  const { size, diagonal, rightHandSide, multiply, diagonalTolerance, residualTolerance } = options;
  if (!Number.isInteger(size) || size < 1) invalid('size must be a positive integer');
  requireVector(diagonal, size, 'diagonal');
  requireVector(rightHandSide, size, 'rightHandSide');
  if (typeof multiply !== 'function') invalid('multiply must be a function');
  if (!Number.isFinite(diagonalTolerance) || diagonalTolerance < 0) invalid('diagonalTolerance must be finite and non-negative');
  if (!Number.isFinite(residualTolerance) || !(residualTolerance > 0)) invalid('residualTolerance must be finite and positive');
  return { size, diagonal, rightHandSide, multiply, diagonalTolerance, residualTolerance };
}

function rejectInvalidDiagonal(minimumDiagonal, diagonalTolerance) {
  if (minimumDiagonal < -diagonalTolerance) {
    throw new LafeaLinearSolveError(
      'Deterministic Jacobi-PCG requires a non-negative SPD diagonal.',
      'PCG_INDEFINITE_DIAGONAL',
      { minimumDiagonal, diagonalTolerance },
    );
  }
  if (minimumDiagonal <= diagonalTolerance) {
    throw new LafeaLinearSolveError(
      'Deterministic Jacobi-PCG diagonal does not clear the singularity tolerance.',
      'PCG_SINGULAR_DIAGONAL',
      { minimumDiagonal, diagonalTolerance },
    );
  }
}

function applyJacobi(diagonal, residual) {
  return residual.map((value, index) => value / diagonal[index]);
}

function exactResidual(multiply, rightHandSide, solution) {
  const action = multiply(solution);
  requireVector(action, solution.length, 'matrix-vector action');
  return rightHandSide.map((value, index) => value - action[index]);
}

function dotVector(left, right) {
  let value = 0;
  for (let index = 0; index < left.length; index += 1) value += left[index] * right[index];
  return value;
}

function requirePositive(value, code) {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new LafeaLinearSolveError(
      'Deterministic Jacobi-PCG residual product is not positive.',
      code,
      { value },
    );
  }
}

function requireVector(value, size, label) {
  if (!Array.isArray(value) || value.length !== size || value.some((item) => !Number.isFinite(item))) {
    invalid(`${label} must contain ${size} finite numbers`);
  }
}

function maxAbs(values) {
  let result = 0;
  for (const value of values) result = Math.max(result, Math.abs(value));
  return result;
}

function invalid(message) {
  throw new LafeaLinearSolveError(message, 'INVALID_PCG_INPUT');
}
