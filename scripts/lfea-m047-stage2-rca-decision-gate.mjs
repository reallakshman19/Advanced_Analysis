#!/usr/bin/env node
/**
 * M047 Stage 2 — fail-closed RCA decision gate.
 *
 * Supersedes the sequencing role of the earlier post-direction residual gate for
 * evidence batches. The important addition is an explicit R2 experiment outcome:
 * if the declared deleted-spring experiment never reaches a first state-stable
 * snapshot within its fixed iteration budget, that is retained as negative R2
 * evidence and the decision graph can proceed to R3 instead of deadlocking on a
 * mobilisation postprocessor that correctly has nothing to compare.
 *
 * This file changes no solver mechanic, tolerance, comparison rule or result row.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { buildPostDirectionResidualRca } from './lfea-m047-stage2-post-direction-residual-rca.mjs';

const SINGLE_AXIS_OVERCAP_SIGNAL = 1.01;
const EARLY_PRE_R2_DECISIONS = new Set([
  'RUN_R6_RESTRAINT_SENTINEL_PREFLIGHT',
  'HALT_R6_RESTRAINT_SOURCE_BOUNDARY_CHANGED',
  'RUN_R5_FRICTION_GEOMETRY_INVENTORY',
  'R5_LOCAL_TANGENT_VERIFICATION_REQUIRED',
  'HALT_DIRECTION_CANDIDATE_NOT_PROMOTABLE',
  'DIRECTION_MECHANISM_STILL_UNRESOLVED',
]);

export function buildStage2RcaDecisionGate(input) {
  const baseline = input.baseline;
  const direction = input.direction;
  const r6 = input.r6 ?? null;
  const r5 = input.r5 ?? null;
  const r2Experiment = input.r2Experiment ?? null;
  const r2Mobilisation = input.r2Mobilisation ?? null;
  const r3 = input.r3 ?? null;

  const base = buildPostDirectionResidualRca({ baseline, direction, r6, r5 });
  if (r2Experiment !== null) requireR2Experiment(r2Experiment, baseline);
  if (r2Mobilisation !== null) requireR2Mobilisation(r2Mobilisation, baseline, r2Experiment);
  if (r3 !== null) requireR3(r3, baseline);

  const r2 = summarizeR2(r2Experiment, r2Mobilisation);
  const capacity = r3 === null ? null : summarizeCapacity(r3);
  const next = decideNext({ base, r2, r3, capacity });

  const result = {
    schema: 'm047-bm4l-stage2-rca-decision-gate/v1',
    caseId: baseline.caseId,
    sourceAccdbSha256: baseline.sourceAccdbSha256,
    rule: 'R6_THEN_R5_THEN_DIRECTION_THEN_R2_EXPERIMENT_THEN_R2_MOBILISATION_IF_AVAILABLE_THEN_R3_THEN_PARTITION_THEN_L7_V1',
    baselineResidualSummary: base.summary,
    r6: base.r6,
    r5: base.r5,
    directionPromotionStatus: base.directionPromotionStatus,
    r2,
    r3: capacity,
    next,
    mechanicsChanged: false,
    toleranceChanged: false,
    comparisonPolicyChanged: false,
  };
  return Object.freeze({ ...result, semanticHash: semanticHash(result) });
}

function summarizeR2(experiment, mobilisation) {
  if (experiment === null) return null;
  const stateStable = experiment.firstStateStable;
  if (stateStable === null) {
    return {
      experimentStatus: 'NO_STATE_STABLE_SNAPSHOT_WITHIN_DECLARED_BUDGET',
      strategy: experiment.strategy,
      maximumIterations: experiment.numerics?.maximumIterations ?? experiment.iterations?.length ?? null,
      stateStableIteration: null,
      mobilisationDecision: null,
      evidenceMeaning: 'DELETED_SPRING_STATE_STABLE_STOP_HYPOTHESIS_NOT_OBSERVED_WITHIN_DECLARED_BUDGET',
    };
  }
  if (mobilisation === null) {
    return {
      experimentStatus: 'STATE_STABLE_SNAPSHOT_AVAILABLE',
      strategy: experiment.strategy,
      maximumIterations: experiment.numerics?.maximumIterations ?? experiment.iterations?.length ?? null,
      stateStableIteration: stateStable.iteration,
      mobilisationDecision: null,
      evidenceMeaning: 'RUN_MOBILISATION_DIAGNOSTIC_BEFORE_SELECTING_R2_MECHANICS',
    };
  }
  return {
    experimentStatus: 'STATE_STABLE_SNAPSHOT_COMPARED',
    strategy: experiment.strategy,
    maximumIterations: experiment.numerics?.maximumIterations ?? experiment.iterations?.length ?? null,
    stateStableIteration: stateStable.iteration,
    mobilisationDecision: mobilisation.decision,
    referenceClusterCount: mobilisation.referenceClusterCount,
    deletedSpringCloserCount: mobilisation.deletedSpringCloserCount,
    returnMapCloserCount: mobilisation.returnMapCloserCount,
    evidenceMeaning: mobilisation.decision,
  };
}

function summarizeCapacity(r3) {
  const singleAxisOverCap = r3.restraints.filter((row) =>
    Array.isArray(row.frictionDofs)
    && row.frictionDofs.length === 1
    && Number.isFinite(Number(row.normalBasis?.frictionCase?.utilisation))
    && Number(row.normalBasis.frictionCase.utilisation) > SINGLE_AXIS_OVERCAP_SIGNAL);
  return {
    l13NormalCloserToUnityCount: r3.summary.l13NormalCloserToUnityCount,
    l6NormalCloserToUnityCount: r3.summary.l6NormalCloserToUnityCount,
    equalDistanceCount: r3.summary.equalDistanceCount,
    perAxisSignatureCount: r3.summary.perAxisSignatureCount,
    perAxisSignatureRestraints: r3.summary.perAxisSignatureRestraints,
    singleAxisOverCapCount: singleAxisOverCap.length,
    singleAxisOverCapRestraints: singleAxisOverCap.map((row) => ({
      restraintId: row.restraintId,
      nodeId: row.nodeId,
      utilisationOnL13Normal: row.normalBasis.frictionCase.utilisation,
      utilisationOnL6Normal: row.normalBasis.frictionlessTwin.utilisation,
      closerToUnity: row.normalBasis.closerToUnity,
    })),
  };
}

function decideNext({ base, r2, r3, capacity }) {
  if (EARLY_PRE_R2_DECISIONS.has(base.next.decision)) return base.next;
  if (base.next.decision !== 'RUN_R2_MOBILISATION_NEXT') {
    return {
      decision: 'HALT_UNEXPECTED_PRE_R2_DECISION',
      reason: `The preceding residual gate returned unexpected decision ${base.next.decision}.`,
      l7LoadSteppingAllowed: false,
    };
  }

  if (r2 === null) {
    return {
      decision: 'RUN_R2_DELETED_SPRING_EXPERIMENT_NEXT',
      reason: 'Source, geometry and direction gates are cleared; execute the declared deleted-spring experiment before capacity RCA.',
      l7LoadSteppingAllowed: false,
    };
  }

  if (r2.experimentStatus === 'STATE_STABLE_SNAPSHOT_AVAILABLE') {
    return {
      decision: 'RUN_R2_MOBILISATION_DIAGNOSTICS_NEXT',
      reason: 'The deleted-spring experiment has a first state-stable snapshot; compare its partial mobilisation against the governed return map before selecting R2 mechanics.',
      l7LoadSteppingAllowed: false,
    };
  }

  if (r2.experimentStatus === 'STATE_STABLE_SNAPSHOT_COMPARED'
      && r2.mobilisationDecision === 'EVIDENCE_FAVOURS_DELETED_SPRING_STATE_STABLE_STOP') {
    return {
      decision: 'R2_DELETED_SPRING_STATE_PATH_IS_NEXT_MECHANICS_CANDIDATE',
      reason: 'The state-stable deleted-spring snapshot reproduces the declared partial-mobilisation cluster better than the return map.',
      l7LoadSteppingAllowed: false,
    };
  }

  if (r3 === null) {
    return {
      decision: 'RUN_R3_CAPACITY_BASIS_NEXT',
      reason: r2.experimentStatus === 'NO_STATE_STABLE_SNAPSHOT_WITHIN_DECLARED_BUDGET'
        ? 'R2 did not produce the state-stable snapshot required by its stopping-rule hypothesis within the declared budget; retain that negative evidence and proceed to capacity-basis RCA.'
        : 'R2 mobilisation does not support promoting the deleted-spring state path; proceed to capacity-basis RCA.',
      l7LoadSteppingAllowed: false,
    };
  }

  if (capacity.singleAxisOverCapCount > 0) {
    return {
      decision: 'CAPACITY_BASIS_BEFORE_PARTITION',
      reason: 'At least one one-free-tangent restraint exceeds the L13-normal Coulomb cap; per-axis versus resultant partition cannot explain a one-axis exceedance.',
      l7LoadSteppingAllowed: false,
    };
  }
  if (capacity.l6NormalCloserToUnityCount > capacity.l13NormalCloserToUnityCount) {
    return {
      decision: 'TEST_FRICTIONLESS_TWIN_NORMAL_CAPACITY_BASIS',
      reason: 'Reference utilisation clusters closer to unity when capacity is formed from the L6 frictionless-twin normal.',
      l7LoadSteppingAllowed: false,
    };
  }
  if (capacity.perAxisSignatureCount > 0) {
    return {
      decision: 'PER_AXIS_CAPACITY_PARTITION_EXPERIMENT_JUSTIFIED',
      reason: 'After direction/state-path/capacity-basis screening, resultant-over-cap rows remain with every component individually inside the scalar cap.',
      l7LoadSteppingAllowed: false,
    };
  }
  if (base.summary.vectorResidualCount > 0
      || base.summary.magnitudeResidualCount > 0
      || base.summary.constitutiveStateMismatchCount > 0) {
    return {
      decision: 'L13_RESIDUAL_MECHANISM_UNRESOLVED',
      reason: 'Residual L13 vector, magnitude or constitutive-state errors remain without a supported next capacity mechanism.',
      l7LoadSteppingAllowed: false,
    };
  }
  return {
    decision: 'L13_RCA_CLEARED_FOR_L7_LOAD_STEPPING',
    reason: 'R6 source boundary, R5 geometry, direction, R2 and R3 leave no above-goal L13 friction residual.',
    l7LoadSteppingAllowed: true,
  };
}

function requireR2Experiment(value, baseline) {
  if (value?.schema !== 'm047-bm4l-stage2-r2-deleted-spring-experiment/v1') {
    throw new TypeError('R2 deleted-spring experiment must use the governed schema.');
  }
  requireSameCustody(baseline, value, 'baseline', 'R2 experiment');
  if (value.productionMechanicsChanged !== false
      || value.toleranceChanged !== false
      || value.comparisonPolicyChanged !== false) {
    throw new TypeError('R2 experiment must remain isolated from production mechanics/tolerances/comparison policy.');
  }
}

function requireR2Mobilisation(value, baseline, experiment) {
  if (experiment === null) {
    throw new TypeError('R2 mobilisation diagnostics cannot be supplied without the deleted-spring experiment artifact.');
  }
  if (value?.schema !== 'm047-bm4l-stage2-r2-mobilisation-diagnostics/v1') {
    throw new TypeError('R2 mobilisation diagnostics must use the governed schema.');
  }
  requireSameCustody(baseline, value, 'baseline', 'R2 mobilisation');
  if (experiment.firstStateStable === null) {
    throw new TypeError('R2 mobilisation diagnostics are invalid when the experiment has no state-stable snapshot.');
  }
  if (Number(value.stateStableIteration) !== Number(experiment.firstStateStable.iteration)) {
    throw new TypeError('R2 mobilisation diagnostics do not refer to the experiment first state-stable iteration.');
  }
}

function requireR3(value, baseline) {
  if (value?.schema !== 'm047-bm4l-stage2-r3-capacity-diagnostics/v1') {
    throw new TypeError('R3 capacity diagnostics must use the governed schema.');
  }
  if (value.sourceAccdbSha256 !== baseline.sourceAccdbSha256) {
    throw new TypeError('baseline/R3 ACCDB custody mismatch.');
  }
  if (String(value.frictionCaseId) !== String(baseline.caseId)) {
    throw new TypeError(`baseline/R3 case mismatch: ${baseline.caseId} != ${value.frictionCaseId}.`);
  }
}

function requireSameCustody(left, right, leftLabel, rightLabel) {
  if (left.sourceAccdbSha256 !== right.sourceAccdbSha256) {
    throw new TypeError(`${leftLabel}/${rightLabel} ACCDB custody mismatch.`);
  }
  if (left.caseId !== undefined && right.caseId !== undefined
      && String(left.caseId) !== String(right.caseId)) {
    throw new TypeError(`${leftLabel}/${rightLabel} case mismatch.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 2) args.set(argv[index], argv[index + 1]);
  const baselinePath = args.get('--baseline');
  const directionPath = args.get('--direction');
  if (!baselinePath || !directionPath) {
    throw new TypeError(
      'Usage: --baseline <L13-iteration.json> --direction <direction-only.json> '
      + '[--r6 <r6.json>] [--r5 <r5.json>] [--r2-experiment <r2-experiment.json>] '
      + '[--r2 <r2-mobilisation.json>] [--r3 <r3.json>] [--out <json>]',
    );
  }
  const read = (path) => JSON.parse(readFileSync(resolve(path), 'utf8'));
  const record = buildStage2RcaDecisionGate({
    baseline: read(baselinePath),
    direction: read(directionPath),
    r6: args.get('--r6') ? read(args.get('--r6')) : null,
    r5: args.get('--r5') ? read(args.get('--r5')) : null,
    r2Experiment: args.get('--r2-experiment') ? read(args.get('--r2-experiment')) : null,
    r2Mobilisation: args.get('--r2') ? read(args.get('--r2')) : null,
    r3: args.get('--r3') ? read(args.get('--r3')) : null,
  });
  const out = args.get('--out');
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(resolve(out), `${canonicalPrettyStringify(record)}\n`, 'utf8');
  }
  process.stdout.write(`${canonicalPrettyStringify({
    caseId: record.caseId,
    r6: record.r6,
    r5: record.r5,
    directionPromotionStatus: record.directionPromotionStatus,
    r2: record.r2,
    r3: record.r3,
    next: record.next,
  })}\n`);
}
