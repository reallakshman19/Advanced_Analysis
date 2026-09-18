#!/usr/bin/env node
/**
 * LAFEA.4 / A5 / #1764 — shell solver dispatch, storage structure and
 * fail-closed behaviour, measured through the public production route.
 *
 * A5 owns global assembly and linear solve, not shell mechanics. This leg
 * establishes, on current source:
 *
 *   SOLV-S1  the dense/sparse dispatch rule actually in force;
 *   SOLV-S2  that the path claiming to scale allocates no dense n x n;
 *   SOLV-B5  a rigid-body mechanism fails closed;
 *   SOLV-B6  a PCG solve that cannot reach its residual target fails closed;
 *   SOLV-S3  the measured thin-shell envelope of the sparse backend.
 *
 * SOLV-B2/B3 same-model dense-vs-sparse equivalence is NOT covered here: see
 * the deferral note at the bottom of this file.
 */
import assert from 'node:assert/strict';
import {
  CANONICAL_UNITS,
  MITC_PRODUCTION_FORMULATION_FAMILY,
  MITC_PRODUCTION_LIMITATIONS,
  MITC_PRODUCTION_MODEL_SCHEMA,
  MITC_PRODUCTION_RESULT_REQUEST,
  calculateLocalShell,
  createCanonicalMitcProductionModel,
} from '../src/core/local-shell/index.js';
import {
  DENSE_SHELL_STIFFNESS_DOF_LIMIT,
  SPARSE_SHELL_STIFFNESS_STORAGE,
} from '../src/core/local-shell/assembly.js';
import { MITC4_TOPOLOGY } from '../src/core/local-shell/mitc-adoption-model.js';
import { MITC4_FORMULATION } from '../src/core/local-shell/mitc4-element.js';
import { flatNode, qualificationProfile } from './lafea.4-fixtures.mjs';

const E = 200000;
const NU = 0;
const SPAN = 10;
const WIDTH = 1;
const TIP_LOAD = 1;

// Dispatch and structural evidence run at a moderate thickness. The thin-shell
// conditioning limit is a separate measured finding below; mixing them would
// let a conditioning failure masquerade as a dispatch failure.
const MODERATE_THICKNESS = 1;
const THIN_THICKNESS = 0.1;

const dispatch = checkPublicRouteDispatchRule();
const structure = checkSparsePathIsNotDense();
const singular = checkSingularMechanismFailsClosed();
const nonConvergence = checkPcgNonConvergenceFailsClosed();
const envelope = measureThinShellEnvelope();

console.log(JSON.stringify({
  schema: 'lafea4-a5-shell-solver-dispatch-and-failclosed-check/v1',
  status: 'PASS_WITH_EXPLICIT_DEFERRAL_AND_ENVELOPE_FINDING',
  denseShellStiffnessDofLimit: DENSE_SHELL_STIFFNESS_DOF_LIMIT,
  dispatch,
  structure,
  singular,
  nonConvergence,
  envelope,
  deferred: [
    'SOLV_B2_B3_SAME_MODEL_DENSE_VS_SPARSE_EQUIVALENCE_REQUIRES_A_BACKEND_OVERRIDE_SEAM',
  ],
  releaseQualified: false,
}, null, 2));

console.log('\n✅ A5 shell solver dispatch/fail-closed check passed; SOLV-B2/B3 remain deferred and the thin-shell envelope is a recorded finding.');

// SOLV-S1. Confirm the historical "sparse above 1536 DOF" rule on current
// source through the public route, rather than by reading the constant.
function checkPublicRouteDispatchRule() {
  const small = solveThroughPublicRoute(strip('A5-DENSE', 8, MODERATE_THICKNESS));
  const large = solveThroughPublicRoute(strip('A5-SPARSE', 200, MODERATE_THICKNESS));

  assert.ok(small.dofCount <= DENSE_SHELL_STIFFNESS_DOF_LIMIT, 'small control must sit under the dense limit');
  assert.ok(large.dofCount > DENSE_SHELL_STIFFNESS_DOF_LIMIT, 'large control must exceed the dense limit');
  assert.equal(small.method, 'DETERMINISTIC_DENSE_CHOLESKY', 'under the limit must factor densely');
  assert.equal(large.method, 'DETERMINISTIC_JACOBI_PCG', 'over the limit must iterate sparsely');
  assert.equal(small.storage, 'DENSE');
  assert.equal(large.storage, SPARSE_SHELL_STIFFNESS_STORAGE);

  return Object.freeze({
    denseCase: { dofCount: small.dofCount, method: small.method, storage: small.storage },
    sparseCase: { dofCount: large.dofCount, method: large.method, storage: large.storage, iterations: large.iterations },
    ruleConfirmedOnCurrentSource: true,
  });
}

// SOLV-S2. A5 invariant 3: the scaling path must not allocate a dense n x n.
// Assert the storage identity AND that occupancy stays far below a full
// triangle, so a future dense fallback cannot pass by relabelling itself.
function checkSparsePathIsNotDense() {
  const result = acceptedResult(strip('A5-STRUCTURE', 200, MODERATE_THICKNESS));
  const mesh = result.meshEvidence;

  assert.equal(mesh.stiffnessStorage, SPARSE_SHELL_STIFFNESS_STORAGE);
  assert.ok(!Array.isArray(mesh.retainedStiffness), 'sparse stiffness must not be retained as a dense row array');
  assert.ok(Array.isArray(mesh.retainedStiffness.lowerTriangleRows), 'retained sparse lower-triangle rows required');

  const { size, nonzeroCount } = mesh.retainedStiffness;
  const denseLowerTriangle = size * (size + 1) / 2;
  const occupancy = nonzeroCount / denseLowerTriangle;
  assert.ok(occupancy < 0.1, `sparse occupancy ${occupancy} must stay far below a dense triangle`);

  return Object.freeze({
    size,
    nonzeroCount,
    denseLowerTriangleCount: denseLowerTriangle,
    occupancy,
    storage: mesh.stiffnessStorage,
    hiddenDenseAllocation: false,
  });
}

// SOLV-B5. A shell left with rigid-body freedom must fail closed: no weak
// spring, no regularization, no accepted result.
function checkSingularMechanismFailsClosed() {
  const source = strip('A5-SINGULAR', 8, MODERATE_THICKNESS);
  const result = calculateLocalShell(createCanonicalMitcProductionModel({ ...source, constraints: [] }));

  assert.equal(result.qualification.accepted, false, 'an unrestrained shell must not produce an accepted result');
  assert.ok(!result.loadCaseResults?.length, 'a failed singular solve must not retain load-case results');

  return Object.freeze({
    restraintsRemoved: true,
    accepted: false,
    state: result.qualification.state,
    summary: result.qualification.summary,
    regularizationApplied: false,
    disposition: 'PASS_SINGULAR_MECHANISM_FAILS_CLOSED',
  });
}

// SOLV-B6. PCG that cannot reach its qualified residual target must fail
// closed. This control is not contrived: it is the smallest thin-shell strip
// that clears the dense limit, so it is what a user gets by asking for a
// slightly larger thin model.
function checkPcgNonConvergenceFailsClosed() {
  const source = strip('A5-THIN-NONCONV', 160, THIN_THICKNESS);
  const dofCount = source.nodes.length * 5;
  assert.ok(dofCount > DENSE_SHELL_STIFFNESS_DOF_LIMIT, 'control must dispatch to the sparse backend');

  const result = calculateLocalShell(createCanonicalMitcProductionModel(source));
  assert.equal(result.qualification.accepted, false, 'non-converged PCG must not produce an accepted result');
  assert.match(result.qualification.summary, /did not converge/, `rejection must name non-convergence; got ${result.qualification.summary}`);
  assert.ok(!result.loadCaseResults?.length, 'a non-converged solve must not retain load-case results');

  return Object.freeze({
    dofCount,
    thicknessRatio: THIN_THICKNESS / SPAN,
    accepted: false,
    summary: result.qualification.summary,
    toleranceRelaxed: false,
    iterationCapRaised: false,
    disposition: 'PASS_NON_CONVERGENT_PCG_FAILS_CLOSED',
  });
}

// SOLV-S3. Measure where the sparse backend stops converging as the shell
// thins, at one fixed size above the dense limit. Informational envelope
// evidence: no tolerance, iteration cap or dispatch threshold is altered.
function measureThinShellEnvelope() {
  const levels = [0.2, 0.1, 0.05, 0.02, 0.01].map((tOverL) => {
    const result = calculateLocalShell(createCanonicalMitcProductionModel(strip(`A5-ENV-${tOverL}`, 200, tOverL * SPAN)));
    if (!result.qualification.accepted) {
      return { tOverL, converged: false, summary: result.qualification.summary };
    }
    const evidence = result.loadCaseResults[0].solverEvidence;
    assert.equal(evidence.method, 'DETERMINISTIC_JACOBI_PCG');
    return { tOverL, converged: true, iterations: evidence.iterations, iterationLimit: evidence.iterationLimit };
  });

  const converged = levels.filter((row) => row.converged);
  const failed = levels.filter((row) => !row.converged);
  assert.ok(converged.length > 0, 'the sparse backend must converge for some thickness at this size');
  assert.ok(failed.length > 0, 'the measured envelope must record where it stops converging');

  // Iteration count must rise as the shell thins: this is the (L/t)^2
  // conditioning signature, and it is why Jacobi preconditioning runs out.
  for (let index = 1; index < converged.length; index += 1) {
    assert.ok(
      converged[index].iterations >= converged[index - 1].iterations,
      'iteration count must not fall as the shell thins',
    );
  }

  return Object.freeze({
    dofCount: 201 * 2 * 5,
    levels,
    thinnestConverged: converged[converged.length - 1].tOverL,
    thickestFailed: failed[0].tOverL,
    preconditioner: 'JACOBI',
    finding: 'SPARSE_BACKEND_CONVERGENCE_DEGRADES_WITH_L_OVER_T_SQUARED_CONDITIONING',
    remedyIsArchitectural: true,
  });
}

function solveThroughPublicRoute(source) {
  const result = acceptedResult(source);
  const evidence = result.loadCaseResults[0].solverEvidence;
  return {
    dofCount: result.meshEvidence.dofOrdering.length,
    method: evidence.method,
    storage: result.meshEvidence.stiffnessStorage,
    iterations: evidence.iterations ?? null,
  };
}

function acceptedResult(source) {
  const result = calculateLocalShell(createCanonicalMitcProductionModel(source));
  assert.equal(result.qualification.accepted, true, `${source.modelIdentity}: ${result.qualification.summary}`);
  assert.equal(result.productionQualification.qualifiedForRelease, false);
  assert.equal(result.productionQualification.evidenceState, 'NOT_RUN');
  return result;
}

function strip(identity, along, thickness) {
  const nodes = [];
  for (let row = 0; row < 2; row += 1) {
    for (let index = 0; index <= along; index += 1) {
      nodes.push(flatNode(`N${row}-${index}`, index * SPAN / along, row * WIDTH));
    }
  }

  const elements = [];
  for (let index = 0; index < along; index += 1) {
    elements.push({
      elementId: `Q${index}`,
      formulation: MITC4_FORMULATION,
      topology: MITC4_TOPOLOGY,
      nodeIds: [`N0-${index}`, `N0-${index + 1}`, `N1-${index + 1}`, `N1-${index}`],
      materialId: 'MAT',
      thickness,
      sourceReference: `Q${index}-SRC`,
    });
  }

  const constraints = nodes.flatMap((node) => {
    const rows = ['UX', 'UY'].map((dof) => constraint(node.nodeId, dof));
    if (node.nodeId.endsWith('-0')) {
      for (const dof of ['UZ', 'R1', 'R2']) rows.push(constraint(node.nodeId, dof));
    }
    return rows;
  });

  return {
    schema: MITC_PRODUCTION_MODEL_SCHEMA,
    modelIdentity: `A4-${identity}`,
    modelVersion: '2',
    sourceAncestry: ['qualification/a5-solver/v1'],
    units: { ...CANONICAL_UNITS },
    formulationFamily: MITC_PRODUCTION_FORMULATION_FAMILY,
    materials: [{ materialId: 'MAT', elasticModulus: E, poissonRatio: NU, sourceReference: 'MAT-SRC' }],
    nodes,
    elements,
    constraints,
    loadCases: [{
      loadCaseId: `LC-${identity}`,
      nodalLoads: [`N0-${along}`, `N1-${along}`].map((nodeId, index) => ({
        loadId: `F-${index}`,
        nodeId,
        fx: 0,
        fy: 0,
        fz: TIP_LOAD / 2,
        m1: 0,
        m2: 0,
        sourceReference: `F-${index}-SRC`,
      })),
      pressureLoads: [],
      sourceReference: 'LC-SRC',
    }],
    resultRequests: {
      stressSurfaces: [...MITC_PRODUCTION_RESULT_REQUEST.stressSurfaces],
      retainElementMatrices: true,
      retainTransverseShear: true,
    },
    qualificationProfile: qualificationProfile(),
    mitcQualification: {
      quadPlanarity: { absolute: 1e-9, relative: 1e-8 },
      rigidBodyEnergy: { absolute: 1e-9, relative: 1e-9 },
    },
    limitations: [...MITC_PRODUCTION_LIMITATIONS],
  };
}

function constraint(nodeId, dof) {
  return {
    constraintId: `C-${nodeId}-${dof}`,
    nodeId,
    dof,
    value: 0,
    sourceReference: `C-${nodeId}-${dof}-SRC`,
  };
}

/**
 * SOLV-B2/B3 deferral.
 *
 * Same-model dense-vs-sparse equivalence needs one canonical model solved twice
 * through different backends. Backend choice is taken inside
 * `assembleGlobalSystem` purely from DOF count, with no override, so forcing
 * both backends means calling `assembleDenseGlobalSystem` and
 * `assembleSparseGlobalSystem` directly and supplying the element set and load
 * vector by hand.
 *
 * For the MITC production route those come from `mitc-adoption-solve.js`, whose
 * load assembly is module-private. Reconstructing it here would test a
 * reimplementation rather than production, which is exactly the circularity
 * A5's oracle rules prohibit. Reaching for the CST/DKT builders instead is not
 * a substitute either: `buildShellElementEvidence` is the CST+DKT path and
 * silently produces non-finite stiffness when handed a MITC model.
 *
 * The honest fix is a governed backend-override seam on the solver, which is an
 * architectural change requiring its own equivalence package. Recorded as
 * deferred rather than approximated.
 */
