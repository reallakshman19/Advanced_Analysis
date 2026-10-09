#!/usr/bin/env node
/** Contract for the M047 Stage 2 fail-closed RCA decision gate. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildStage2RcaDecisionGate } from './lfea-m047-stage2-rca-decision-gate.mjs';

const sha = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const baseline = {
  schema: 'm047-bm4l-stage2-friction-tuning-iteration/v1',
  caseId: 'L13',
  converged: true,
  sourceAccdbSha256: sha,
  restraints: [
    { restraintId: 'A', regime: { reference: 'STUCK', referenceUtilisation: 0.94 } },
    { restraintId: 'B', regime: { reference: 'SLID', referenceUtilisation: 1.10 } },
  ],
};
const r6 = {
  schema: 'm047-bm4l-stage2-r6-restraint-sentinel-preflight/v1',
  sourceAccdbSha256: sha,
  status: 'PASS',
  failureCount: 0,
  blankRule: 'PORTABLE_ACCDB_READER_CANONICAL_NULL_ONLY_V1',
};
const r5 = {
  schema: 'm047-bm4l-stage2-r5-friction-geometry-inventory/v1',
  caseId: 'L13',
  sourceAccdbSha256: sha,
  geometrySensitiveFrictionCount: 0,
  bendCoincidentFrictionCount: 0,
  teeCoincidentFrictionCount: 0,
  decision: {
    status: 'NO_FRICTION_RESTRAINT_ON_BEND_OR_TEE_SOURCE_STATION',
    directionPromotionBlockedByR5: false,
  },
};
function direction(status = 'EVIDENCE_SUPPORTS_PROMOTION_TO_GOVERNED_DIRECTION_RULE') {
  return {
    schema: 'm047-bm4l-stage2-direction-only-nonlinear-experiment/v1',
    caseId: 'L13',
    sourceAccdbSha256: sha,
    promotion: { status },
    restraints: [
      {
        restraintId: 'A', nodeId: '1', frictionDofs: ['UX', 'UZ'], regime: 'STUCK',
        referenceMagnitudeN: 100, candidateMagnitudeN: 100,
        candidateVectorRelativeError: 0.05, candidateDirectionCosineToReference: 0.999,
      },
      {
        restraintId: 'B', nodeId: '2', frictionDofs: ['UZ'], regime: 'SLIDING',
        referenceMagnitudeN: 100, candidateMagnitudeN: 100,
        candidateVectorRelativeError: 0.05, candidateDirectionCosineToReference: 0.999,
      },
    ],
  };
}
function r2Experiment(firstStateStable) {
  return {
    schema: 'm047-bm4l-stage2-r2-deleted-spring-experiment/v1',
    caseId: 'L13',
    sourceAccdbSha256: sha,
    strategy: 'DELETED_SPRING_WITH_CONSTANT_FORCE_AND_STATE_STABLE_STOP_V1',
    productionMechanicsChanged: false,
    toleranceChanged: false,
    comparisonPolicyChanged: false,
    numerics: { maximumIterations: 60 },
    firstStateStable,
    iterations: Array.from({ length: 60 }, (_, index) => ({ iteration: index + 1 })),
  };
}
function r2Mobilisation(decision = 'EVIDENCE_FAVOURS_RETURN_MAP_FOR_PARTIAL_MOBILISATION') {
  return {
    schema: 'm047-bm4l-stage2-r2-mobilisation-diagnostics/v1',
    caseId: 'L13',
    sourceAccdbSha256: sha,
    stateStableIteration: 3,
    decision,
    referenceClusterCount: 4,
    deletedSpringCloserCount: decision === 'EVIDENCE_FAVOURS_DELETED_SPRING_STATE_STABLE_STOP' ? 3 : 1,
    returnMapCloserCount: decision === 'EVIDENCE_FAVOURS_DELETED_SPRING_STATE_STABLE_STOP' ? 1 : 3,
  };
}
function r3({ singleAxis = false, perAxis = false, l6Closer = false } = {}) {
  return {
    schema: 'm047-bm4l-stage2-r3-capacity-diagnostics/v1',
    frictionCaseId: 'L13',
    sourceAccdbSha256: sha,
    summary: {
      l13NormalCloserToUnityCount: l6Closer ? 0 : 2,
      l6NormalCloserToUnityCount: l6Closer ? 2 : 0,
      equalDistanceCount: 0,
      perAxisSignatureCount: perAxis ? 1 : 0,
      perAxisSignatureRestraints: perAxis ? ['C'] : [],
    },
    restraints: singleAxis ? [{
      restraintId: 'B', nodeId: '2', frictionDofs: ['UZ'],
      normalBasis: {
        frictionCase: { utilisation: 1.106 },
        frictionlessTwin: { utilisation: 0.999 },
        closerToUnity: 'L6',
      },
    }] : [],
  };
}

let record = buildStage2RcaDecisionGate({ baseline, direction: direction(), r6, r5 });
assert.equal(record.next.decision, 'RUN_R2_DELETED_SPRING_EXPERIMENT_NEXT');

record = buildStage2RcaDecisionGate({
  baseline, direction: direction(), r6, r5,
  r2Experiment: r2Experiment(null),
});
assert.equal(record.r2.experimentStatus, 'NO_STATE_STABLE_SNAPSHOT_WITHIN_DECLARED_BUDGET');
assert.equal(record.next.decision, 'RUN_R3_CAPACITY_BASIS_NEXT',
  'no R2 state-stable snapshot must be retained as negative evidence rather than deadlocking the decision graph');

record = buildStage2RcaDecisionGate({
  baseline, direction: direction(), r6, r5,
  r2Experiment: r2Experiment({ iteration: 3 }),
});
assert.equal(record.next.decision, 'RUN_R2_MOBILISATION_DIAGNOSTICS_NEXT');

record = buildStage2RcaDecisionGate({
  baseline, direction: direction(), r6, r5,
  r2Experiment: r2Experiment({ iteration: 3 }),
  r2Mobilisation: r2Mobilisation('EVIDENCE_FAVOURS_DELETED_SPRING_STATE_STABLE_STOP'),
});
assert.equal(record.next.decision, 'R2_DELETED_SPRING_STATE_PATH_IS_NEXT_MECHANICS_CANDIDATE');

record = buildStage2RcaDecisionGate({
  baseline, direction: direction(), r6, r5,
  r2Experiment: r2Experiment(null),
  r3: r3({ singleAxis: true, perAxis: true }),
});
assert.equal(record.next.decision, 'CAPACITY_BASIS_BEFORE_PARTITION',
  'one-axis over-cap evidence must outrank a per-axis partition signature');

record = buildStage2RcaDecisionGate({
  baseline, direction: direction(), r6, r5,
  r2Experiment: r2Experiment({ iteration: 3 }),
  r2Mobilisation: r2Mobilisation(),
  r3: r3({ l6Closer: true }),
});
assert.equal(record.next.decision, 'TEST_FRICTIONLESS_TWIN_NORMAL_CAPACITY_BASIS');

record = buildStage2RcaDecisionGate({
  baseline, direction: direction(), r6, r5,
  r2Experiment: r2Experiment({ iteration: 3 }),
  r2Mobilisation: r2Mobilisation(),
  r3: r3({ perAxis: true }),
});
assert.equal(record.next.decision, 'PER_AXIS_CAPACITY_PARTITION_EXPERIMENT_JUSTIFIED');
assert.equal(record.mechanicsChanged, false);
assert.equal(record.toleranceChanged, false);
assert.equal(record.comparisonPolicyChanged, false);

assert.throws(
  () => buildStage2RcaDecisionGate({
    baseline, direction: direction(), r6, r5,
    r2Experiment: r2Experiment(null),
    r2Mobilisation: r2Mobilisation(),
  }),
  /invalid when the experiment has no state-stable snapshot/u,
);

const scriptPath = resolve('scripts/lfea-m047-stage2-rca-decision-gate.mjs');
const source = readFileSync(scriptPath, 'utf8');
assert.match(source, /NO_STATE_STABLE_SNAPSHOT_WITHIN_DECLARED_BUDGET/u);
assert.match(source, /CAPACITY_BASIS_BEFORE_PARTITION/u);
assert.match(source, /mechanicsChanged: false/u);
assert.doesNotMatch(source, /caesar-accdb-friction-solve/u,
  'the decision gate must remain a postprocessor and must not import the nonlinear solver');
const syntax = spawnSync(process.execPath, ['--check', scriptPath], { encoding: 'utf8' });
assert.equal(syntax.status, 0, `RCA decision gate must parse: ${syntax.stderr}`);

process.stdout.write('PASS m047 Stage 2 RCA decision gate contract\n');
