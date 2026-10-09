#!/usr/bin/env node
import assert from 'node:assert/strict';
import { assessR8Nfv15 } from './lfea-m047-stage2-r8-nfv15-assess.mjs';

const SHA = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const baseline = {
  caseId: 'L13',
  sourceAccdbSha256: SHA,
  solverProfileId: 'CAESAR-ACCDB-FRICTION-SOLVER-R2',
  restraints: [{
    restraintId: 'R1',
    nodeId: '1',
    normal: { percentError: 2 },
    tangential: { vectorRelativeError: 0.20 },
    regime: { match: false },
  }],
};

const candidate = {
  schema: 'm047-stage2-r8-nfv15-real-file-experiment/v1',
  measurementBoundary: 'REAL_PINNED_ACCDB_NONPRODUCTION_ONE_MECHANIC_EXPERIMENT',
  caseId: 'L13',
  custody: {
    status: 'PASS',
    accdb: { status: 'PASS', sha256: SHA },
  },
  productionBoundary: { productionMechanicsChanged: false },
  stateContract: { status: 'PASS' },
  experimentalProfile: {
    profileId: 'CAESAR-ACCDB-FRICTION-SOLVER-R2-R8-NFV15-EXPERIMENT',
    normalForceVariationRelative: 0.15,
    normalForceVariationRule: 'SEED_ON_BREAKAWAY_RETAIN_LE_15_PERCENT_REFRESH_GT_15_PERCENT_DISCARD_ON_STICK_V1',
  },
  runs: [{
    converged: true,
    recoveredEquilibriumStatus: 'PASS',
    convergenceGates: {
      status: 'CONVERGED',
      gates: [{ gate: 'NFV15_RETAINED_NORMAL_STATE', status: 'PASS' }],
    },
    frictionRestraints: [{
      restraintId: 'R1',
      nodeId: '1',
      normal: { relativeError: 0.02 },
      tangential: { vectorRelativeError: 0.05 },
      retainedNormalMechanic: {
        currentNormalN: 95,
        retainedNormalEnteringN: 100,
        capacityBasisNormalN: 100,
        variationRelative: 0.05,
        refreshed: false,
        governedRetainedCapacityN: 30,
        currentNormalDiagnosticCapacityN: 28.5,
      },
    }],
  }],
  determinism: { status: 'NOT_RUN', requestedRuns: 1, completedConvergedRuns: 1 },
};

const pass = assessR8Nfv15({ baseline, experiment: candidate });
assert.equal(pass.nomination, 'R8_NFV15_DIRECTIONALLY_NOMINATED_REQUIRES_NEXT_GOVERNED_GATE');
assert.equal(pass.nextGate, 'RUN_R8_L7_REAL_PINNED_ACCDB');
assert.equal(pass.productionPromotionAuthorized, false);
assert.equal(pass.summary.tangentialWithinGoalDelta, 1);
assert.equal(pass.summary.normalWithinGoalDelta, 0);
assert.equal(pass.summary.regimeComparison, 'NOT_GOVERNED_FROM_FINAL_NORMAL_UNDER_NFV15');
assert.equal(pass.gates.completeMetricSet, true);
assert.equal(pass.gates.nfvLedgerComplete, true);
assert.equal(pass.gates.requestedRepeatDeterminism, true);

assert.throws(
  () => assessR8Nfv15({
    baseline,
    experiment: {
      ...candidate,
      experimentalProfile: { ...candidate.experimentalProfile, normalForceVariationRelative: 0.10 },
    },
  }),
  /NFV=0\.15/,
);
assert.throws(
  () => assessR8Nfv15({
    baseline,
    experiment: { ...candidate, productionBoundary: { productionMechanicsChanged: true } },
  }),
  /productionMechanicsChanged=false/,
);
const noEq = assessR8Nfv15({
  baseline,
  experiment: {
    ...candidate,
    runs: [{ ...candidate.runs[0], recoveredEquilibriumStatus: 'FAIL' }],
  },
});
assert.equal(noEq.nomination, 'REJECT_R8_MEASUREMENT_PHYSICS_OR_CUSTODY_GATE_FAILED');

const nonconverged = assessR8Nfv15({
  baseline,
  experiment: {
    ...candidate,
    runs: [{ converged: false, failure: { code: 'CAESAR_ACCDB_FRICTION_NOT_CONVERGED', iterationCount: 800 } }],
    determinism: { status: 'NOT_RUN', requestedRuns: 1, completedConvergedRuns: 0 },
  },
});
assert.equal(nonconverged.nomination, 'REJECT_R8_MEASUREMENT_PHYSICS_OR_CUSTODY_GATE_FAILED');
assert.equal(nonconverged.gates.converged, false);
assert.equal(nonconverged.summary.comparedRestraints, 0);
assert.equal(nonconverged.failure.code, 'CAESAR_ACCDB_FRICTION_NOT_CONVERGED');

for (const missing of [null, '', '   ', false]) {
  const missingMetric = assessR8Nfv15({
    baseline,
    experiment: {
      ...candidate,
      runs: [{
        ...candidate.runs[0],
        frictionRestraints: [{
          ...candidate.runs[0].frictionRestraints[0],
          tangential: { vectorRelativeError: missing },
        }],
      }],
    },
  });
  assert.equal(missingMetric.gates.completeMetricSet, false);
  assert.equal(missingMetric.nomination, 'REJECT_R8_MEASUREMENT_PHYSICS_OR_CUSTODY_GATE_FAILED');
}

const missingLedger = assessR8Nfv15({
  baseline,
  experiment: {
    ...candidate,
    runs: [{
      ...candidate.runs[0],
      frictionRestraints: [{
        ...candidate.runs[0].frictionRestraints[0],
        retainedNormalMechanic: {
          ...candidate.runs[0].frictionRestraints[0].retainedNormalMechanic,
          currentNormalDiagnosticCapacityN: null,
        },
      }],
    }],
  },
});
assert.equal(missingLedger.gates.nfvLedgerComplete, false);
assert.equal(missingLedger.nomination, 'REJECT_R8_MEASUREMENT_PHYSICS_OR_CUSTODY_GATE_FAILED');

const missingVariation = assessR8Nfv15({
  baseline,
  experiment: {
    ...candidate,
    runs: [{
      ...candidate.runs[0],
      frictionRestraints: [{
        ...candidate.runs[0].frictionRestraints[0],
        retainedNormalMechanic: {
          ...candidate.runs[0].frictionRestraints[0].retainedNormalMechanic,
          variationRelative: null,
        },
      }],
    }],
  },
});
assert.equal(missingVariation.gates.nfvLedgerComplete, false);
assert.equal(missingVariation.nomination, 'REJECT_R8_MEASUREMENT_PHYSICS_OR_CUSTODY_GATE_FAILED');

assert.throws(
  () => assessR8Nfv15({
    baseline,
    experiment: {
      ...candidate,
      runs: [{
        ...candidate.runs[0],
        frictionRestraints: [
          candidate.runs[0].frictionRestraints[0],
          { ...candidate.runs[0].frictionRestraints[0] },
        ],
      }],
    },
  }),
  /duplicate restraintId R1/,
);

const repeatedPass = assessR8Nfv15({
  baseline,
  experiment: {
    ...candidate,
    determinism: { status: 'PASS', requestedRuns: 2, completedConvergedRuns: 2 },
  },
});
assert.equal(repeatedPass.gates.requestedRepeatDeterminism, true);
assert.equal(repeatedPass.nomination, 'R8_NFV15_DIRECTIONALLY_NOMINATED_REQUIRES_NEXT_GOVERNED_GATE');

const repeatedMismatch = assessR8Nfv15({
  baseline,
  experiment: {
    ...candidate,
    determinism: { status: 'FAIL', requestedRuns: 2, completedConvergedRuns: 2 },
  },
});
assert.equal(repeatedMismatch.gates.requestedRepeatDeterminism, false);
assert.equal(repeatedMismatch.nomination, 'REJECT_R8_MEASUREMENT_PHYSICS_OR_CUSTODY_GATE_FAILED');

const repeatedIncomplete = assessR8Nfv15({
  baseline,
  experiment: {
    ...candidate,
    determinism: { status: 'NOT_RUN', requestedRuns: 2, completedConvergedRuns: 1 },
  },
});
assert.equal(repeatedIncomplete.gates.requestedRepeatDeterminism, false);
assert.equal(repeatedIncomplete.nomination, 'REJECT_R8_MEASUREMENT_PHYSICS_OR_CUSTODY_GATE_FAILED');

const l7 = assessR8Nfv15({
  baseline: { ...baseline, caseId: 'L7' },
  experiment: { ...candidate, caseId: 'L7' },
});
assert.equal(l7.nextGate, 'RECONSTRUCT_R8_L15_EXACTLY_AS_L7_MINUS_L13');

process.stdout.write(`${JSON.stringify({
  schema: 'm047-r8-nfv15-assessor-contract/v5',
  status: 'PASS',
  checks: [
    'real_artifact_shape_positive_nomination',
    'threshold_fail_closed',
    'production_boundary_fail_closed',
    'equilibrium_fail_closed',
    'nonconvergence_is_clean_rejection_not_assessor_crash',
    'null_blank_and_boolean_accuracy_metrics_fail_closed',
    'incomplete_nfv_ledger_fails_closed',
    'missing_nfv_variation_fails_closed',
    'duplicate_restraint_ids_fail_closed',
    'single_run_discriminator_does_not_require_determinism',
    'requested_repeat_determinism_passes_only_on_complete_identical_repeats',
    'governed_L13_to_L7_to_L15_sequence',
  ],
}, null, 2)}\n`);
