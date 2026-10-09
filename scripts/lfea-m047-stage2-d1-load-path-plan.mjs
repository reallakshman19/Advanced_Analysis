#!/usr/bin/env node
/**
 * Freeze the next M047 Stage 2 one-mechanic experiment after the measured
 * D2/S2/R2/R3/N1/N2 batch: physical L13 load-path continuation on accepted D1.
 *
 * Planning only. This file does not solve, alter production mechanics, choose an
 * increment count from benchmark error, or unlock L7/BM4_NL. The continuation is
 * project-declared numerical RCA, not a claim that CAESAR II internally performs
 * static load stepping.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { validateNextAccuracyBatchEvidence } from './lfea-m047-stage2-next-accuracy-evidence-intake.mjs';

const INCREMENT_COUNTS = Object.freeze([1, 5, 10]);

export function buildD1LoadPathContinuationPlan(nextAccuracyEvidence) {
  const intake = validateNextAccuracyBatchEvidence(nextAccuracyEvidence);
  if (intake.next.decision !== 'D1_PHYSICAL_LOAD_PATH_CONTINUATION_EXPERIMENT_JUSTIFIED') {
    throw new TypeError(`Load-path continuation is not justified: ${intake.next.decision}.`);
  }

  const runs = INCREMENT_COUNTS.map((incrementCount) => Object.freeze({
    runId: `D1-L13-PATH-N${incrementCount}`,
    incrementCount,
    fractions: Object.freeze(Array.from(
      { length: incrementCount },
      (_unused, index) => (index + 1) / incrementCount,
    )),
    initialState: 'ALL_STICK_ZERO_SLIP_AT_ZERO_APPLIED_PHYSICAL_LOAD',
    carryBetweenConvergedSubsteps: Object.freeze([
      'FRICTION_ACTIVE_STATE_PER_RESTRAINT',
      'RETURN_MAPPED_SLIP_OFFSET_PER_TANGENTIAL_DOF',
    ]),
    resetBetweenSubsteps: Object.freeze([
      'COMPONENTWISE_SECANT_ACCELERATOR_HISTORY_ONLY',
    ]),
    eachSubstepMustConvergeBeforeNextFraction: true,
    adaptiveRetryAllowed: false,
  }));

  const base = {
    schema: 'm047-bm4l-stage2-d1-load-path-plan/v1',
    caseId: 'L13',
    caseClass: 'SUS',
    formula: 'W+P1',
    sourceAccdbSha256: intake.sourceAccdbSha256,
    authority: {
      kind: 'PROJECT_DECLARED_NUMERICAL_CONTINUATION_RCA',
      caesarInternalLoadSteppingClaimed: false,
      finalEquationIdentityRule: 'LAMBDA_1_MUST_REPRODUCE_ACCEPTED_D1_EXACTLY',
    },
    baseline: {
      variant: intake.retainedBaseline.variant,
      measuredTangentialVectorsWithinGoal: intake.retainedBaseline.tangentialVectorsWithinGoal,
      measuredNormalWithinGoal: intake.retainedBaseline.normalWithinGoal,
      measuredSingleStepConvergenceIteration: intake.retainedBaseline.convergenceIteration,
    },
    isolatedMechanic: 'PHYSICAL_LOAD_PATH_CONTINUATION_FROM_ZERO_TO_FULL_L13',
    physicalLoadScaling: {
      rule: 'SCALE_ASSEMBLED_ELEMENT_EQUIVALENT_AND_INITIAL_STRAIN_LOAD_VECTORS_BY_COMMON_LAMBDA',
      terms: Object.freeze(['W', 'P1']),
      fullL13StiffnessStateFrozenAtEveryFraction: true,
      pressureDependentStiffnessRecomputedPerFraction: false,
      frictionStateLoadsScaledAsExternalPhysicalLoads: false,
      finalFraction: 1,
      simultaneousTermScalingRequired: true,
    },
    unchangedMechanics: Object.freeze([
      'D1_SLIDING_FORCE_OPPOSES_TOTAL_RELATIVE_TANGENTIAL_DISPLACEMENT',
      'FRICTION_STIFFNESS_1_751270055770874E8_N_PER_M',
      'COULOMB_CAP_MU_TIMES_OWN_CURRENT_CASE_NORMAL_REACTION',
      'MODEL_MU_0_3_AND_LOAD_CASE_MULTIPLIER_1_0',
      'FULL_L13_PRESSURE_STIFFENED_STIFFNESS_STATE',
      'BREAKAWAY_AND_RELOCK_STATE_BOUNDARIES',
      'STATE_HYSTERESIS_0_001',
      'RETURN_MAPPED_SLIP_OFFSET_FORM',
      'COMPONENTWISE_SECANT_ACCELERATION_WITHIN_EACH_SUBSTEP',
      'MAXIMUM_ITERATIONS_400_PER_SUBSTEP',
      'DISPLACEMENT_REACTION_CONSTITUTIVE_DIRECTION_AND_EQUILIBRIUM_GATES',
      'QUALIFIED_LINEAR_ELEMENT_LOAD_RESTRAINT_AND_RECOVERY_MECHANICS_AT_FINAL_LAMBDA_1',
      'CAESAR_REFERENCE_ROWS_AND_10_PERCENT_COMPARISON_GOAL',
    ]),
    runs,
    evaluation: {
      n1Purpose: 'EXACT_SINGLE_STEP_D1_REPRODUCTION_CONTROL',
      n5Purpose: 'COARSE_PHYSICAL_CONTINUATION_MEASUREMENT',
      n10Purpose: 'REFINEMENT_STABILITY_MEASUREMENT',
      requiredForEveryRun: Object.freeze([
        'PINNED_ACCDB_CUSTODY_PASS',
        'EVERY_SUBSTEP_CONVERGED_UNDER_UNCHANGED_GATES',
        'FINAL_FULL_LOAD_EQUILIBRIUM_PASS',
        'FINAL_FULL_LOAD_NORMALS_23_OF_23_WITHIN_10_PERCENT',
        'REPEATED_RUN_DETERMINISM',
        'ALL_23_TANGENTIAL_VECTOR_ERRORS_REPORTED',
        'ALL_23_NORMAL_ERRORS_REPORTED',
        'ALL_23_NORMALIZED_CONSTITUTIVE_STATES_REPORTED',
      ]),
      continuationUsefulOnlyIf: Object.freeze([
        'N5_AND_N10_CONVERGE_WITHOUT_GATE_OR_TOLERANCE_CHANGE',
        'N1_REPRODUCES_ACCEPTED_D1_BEFORE_N5_OR_N10_IS_INTERPRETED',
        'N10_IS_REFINEMENT_STABLE_RELATIVE_TO_N5_IN_RAW_STATE_AND_FORCE_RESPONSE',
      ]),
      prohibitedSelectionRule:
        'DO_NOT_SELECT_N_FROM_BENCHMARK_ERROR_ALONE_AND_DO_NOT_ADD_ADAPTIVE_SUBSTEPS_TO_REPAIR_A_FAILURE',
      ifN1DoesNotReproduceD1: 'HALT_IMPLEMENTATION_DRIFT_BEFORE_INTERPRETING_CONTINUATION',
      ifAnySubstepDoesNotConverge: 'RECORD_NONCONVERGENCE_AS_EVIDENCE_NO_RETRY_OR_TOLERANCE_CHANGE',
    },
    retainedSeparateSignals: intake.retainedSeparateSignals,
    productionMechanicsPromotionAuthorized: false,
    l7LoadSteppingAllowed: false,
    bm4nlAllowed: false,
    mechanicsChangedByThisPlan: false,
    toleranceChanged: false,
    comparisonPolicyChanged: false,
  };
  return Object.freeze({ ...base, semanticHash: semanticHash(base) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {
    throw new TypeError(
      'Usage: node scripts/lfea-m047-stage2-d1-load-path-plan.mjs <next-accuracy-batch-evidence.json>',
    );
  }
  const evidence = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'));
  process.stdout.write(`${canonicalPrettyStringify(buildD1LoadPathContinuationPlan(evidence))}\n`);
}
