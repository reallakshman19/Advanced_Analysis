#!/usr/bin/env node
/** Pure/static contract for the measured next-batch intake and D1 load-path plan. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildD1LoadPathContinuationPlan } from './lfea-m047-stage2-d1-load-path-plan.mjs';
import { validateNextAccuracyBatchEvidence } from './lfea-m047-stage2-next-accuracy-evidence-intake.mjs';

const evidence = fixture();
const intake = validateNextAccuracyBatchEvidence(evidence);
assert.equal(intake.status, 'PASS');
assert.equal(intake.next.decision, 'D1_PHYSICAL_LOAD_PATH_CONTINUATION_EXPERIMENT_JUSTIFIED');
assert.equal(intake.retainedBaseline.tangentialVectorsWithinGoal, 13);
assert.equal(intake.retainedBaseline.normalWithinGoal, 23);
assert.equal(intake.retainedBaseline.convergenceIteration, 396);
assert.equal(intake.retainedSeparateSignals.target20710OneAxisOverCap, true);
assert.equal(intake.next.productionMechanicsPromotionAuthorized, false);

const plan = buildD1LoadPathContinuationPlan(evidence);
assert.equal(plan.schema, 'm047-bm4l-stage2-d1-load-path-plan/v1');
assert.equal(plan.caseId, 'L13');
assert.equal(plan.formula, 'W+P1');
assert.equal(plan.isolatedMechanic, 'PHYSICAL_LOAD_PATH_CONTINUATION_FROM_ZERO_TO_FULL_L13');
assert.deepEqual(plan.runs.map((run) => run.incrementCount), [1, 5, 10]);
assert.deepEqual(plan.runs[0].fractions, [1]);
assert.deepEqual(plan.runs[1].fractions, [0.2, 0.4, 0.6, 0.8, 1]);
assert.deepEqual(plan.runs[2].fractions, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
assert.ok(plan.runs.every((run) => run.adaptiveRetryAllowed === false));
assert.ok(plan.runs.every((run) => run.eachSubstepMustConvergeBeforeNextFraction === true));
assert.deepEqual(plan.physicalLoadScaling.terms, ['W', 'P1']);
assert.equal(plan.physicalLoadScaling.simultaneousTermScalingRequired, true);
assert.equal(plan.physicalLoadScaling.frictionStateLoadsScaledAsExternalPhysicalLoads, false);
assert.equal(plan.evaluation.n1Purpose, 'EXACT_SINGLE_STEP_D1_REPRODUCTION_CONTROL');
assert.match(plan.evaluation.prohibitedSelectionRule, /DO_NOT_SELECT_N_FROM_BENCHMARK_ERROR_ALONE/u);
assert.equal(plan.productionMechanicsPromotionAuthorized, false);
assert.equal(plan.l7LoadSteppingAllowed, false);
assert.equal(plan.bm4nlAllowed, false);
assert.equal(plan.toleranceChanged, false);
assert.equal(plan.comparisonPolicyChanged, false);

const d2NoLongerWorse = structuredClone(evidence);
d2NoLongerWorse.d2RelockDirection.summary.tangentialVectorsWithinGoal = 14;
assert.throws(
  () => validateNextAccuracyBatchEvidence(d2NoLongerWorse),
  /D2 no longer degrades/u,
  'a changed D2 conclusion must force re-review instead of silently preserving the continuation plan',
);

const n1NowConverges = structuredClone(evidence);
n1NowConverges.n1NoAcceleration.converged = true;
assert.throws(
  () => validateNextAccuracyBatchEvidence(n1NowConverges),
  /N1 measured convergence outcome changed/u,
  'a changed numerical-variant outcome must force re-review',
);

for (const path of [
  resolve('scripts/lfea-m047-stage2-next-accuracy-evidence-intake.mjs'),
  resolve('scripts/lfea-m047-stage2-d1-load-path-plan.mjs'),
]) {
  const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, `${path} must parse: ${syntax.stderr}`);
}

const planSource = readFileSync(resolve('scripts/lfea-m047-stage2-d1-load-path-plan.mjs'), 'utf8');
assert.doesNotMatch(planSource, /caesar-accdb-friction-solve/u,
  'the load-path planning boundary must not import or edit the production nonlinear solver');
assert.match(planSource, /adaptiveRetryAllowed: false/u);
assert.match(planSource, /MAXIMUM_ITERATIONS_400_PER_SUBSTEP/u);
assert.match(planSource, /COMPONENTWISE_SECANT_ACCELERATOR_HISTORY_ONLY/u);
assert.match(planSource, /l7LoadSteppingAllowed: false/u);

process.stdout.write('PASS m047 Stage 2 D1 physical load-path plan contract\n');

function fixture() {
  const hash = (char) => char.repeat(64);
  const summary = (vectors, worst = 1) => ({
    frictionRestraintCount: 23,
    goalRelative: 0.1,
    normalWithinGoal: 23,
    normalWorstPercentError: 1.5,
    regimeMismatchCount: 20,
    tangentialVectorsCompared: 23,
    tangentialVectorsWithinGoal: vectors,
    tangentialWorstRelativeError: worst,
  });
  return {
    schema: 'm047-bm4l-stage2-next-accuracy-batch-compact-evidence/v1',
    sourceAccdbSha256: '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8',
    baseline: 'D1-total-relative-tangential-displacement-direction',
    decision: 'KEEP_D1_BASELINE_NEXT_MECHANIC_SHOULD_BE_PHYSICAL_LOAD_PATH_CONTINUATION_NOT_RELOCK_OR_ACCELERATOR_RETUNING',
    d1: { artifactSha256: hash('1'), summary: summary(13, 7.2), targets: {} },
    d2RelockDirection: {
      artifactSha256: hash('2'),
      converged: true,
      decision: 'REJECT_OVERALL_ACCURACY_13_TO_11',
      summary: summary(11, 4.6),
      targets: {},
    },
    s2RelockReanchor: {
      artifactSha256: hash('3'),
      converged: true,
      decision: 'REJECT_OVERALL_ACCURACY_13_TO_4',
      summary: summary(4, 7.5),
      targets: {},
    },
    r2IterationPath: {
      decision: 'REJECT_FIRST_STATE_STABLE_STOPPING_RULE',
      fullLocalArtifactByteLength: 8_000_000,
      fullLocalArtifactSha256: hash('4'),
      selectedIterations: [
        { iteration: 2, gateStatus: 'NOT_CONVERGED' },
        { iteration: 396, gateStatus: 'CONVERGED' },
      ],
      summary: {
        firstStateStableIteration: 2,
        firstStateStableVectorWithinGoal: 0,
        convergedVectorWithinGoal: 13,
        iterationCount: 396,
      },
    },
    r3CapacityPartition: {
      artifactSha256: hash('5'),
      decision: 'NOT_RELEVANT_TO_22140_OR_22220;_20710_REMAINS_ONE_AXIS_OVERCAP',
      oneAxisOverCapRestraintIds: [
        '21860:REST_PTR20:TYPE3:UY',
        '20710:REST_PTR13:TYPE3:UY',
        '22020:REST_PTR22:TYPE3:UY',
      ],
      summary: {
        target22140PartitionRelevant: false,
        target22220PartitionRelevant: false,
        target20710OneAxisOverCap: true,
      },
    },
    n1NoAcceleration: {
      artifactSha256: hash('6'),
      converged: false,
      decision: 'REJECT_NONCONVERGED_400',
      failure: { iterationCount: 400, lastFailedGates: ['REACTION_UPDATE_NORM'] },
    },
    n2ActiveSetSafeAcceleration: {
      artifactSha256: hash('7'),
      converged: false,
      decision: 'REJECT_NONCONVERGED_400',
      failure: { iterationCount: 400, lastFailedGates: ['REACTION_UPDATE_NORM'] },
    },
  };
}
