#!/usr/bin/env node
/**
 * M047 Stage 2 — post-direction residual RCA gate.
 *
 * This command does not solve or change mechanics. It consumes the governed L13
 * baseline, the isolated direction-only experiment, and optional R5/R6/R2/R3
 * evidence. It decides the next single mechanic without mixing source-boundary,
 * geometry, direction, state-path and capacity hypotheses.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';

const GOAL = 0.10;
const DIRECTION_COSINE_GOAL = 0.995;
const PARTIAL_MOBILISATION_MIN = 0.91;
const PARTIAL_MOBILISATION_MAX = 0.96;
const SINGLE_AXIS_OVERCAP_SIGNAL = 1.01;

export function buildPostDirectionResidualRca(input) {
  const baseline = input.baseline;
  const direction = input.direction;
  const r5 = input.r5 ?? null;
  const r6 = input.r6 ?? null;
  const r2 = input.r2 ?? null;
  const r3 = input.r3 ?? null;

  requireBaseline(baseline);
  requireDirection(direction);
  requireSameCustody(baseline, direction, 'baseline', 'direction');
  if (r5 !== null) requireR5(r5, baseline);
  if (r6 !== null) requireR6(r6, baseline);
  if (r2 !== null) requireR2(r2, baseline);
  if (r3 !== null) requireR3(r3, baseline);

  const baselineById = new Map(baseline.restraints.map((row) => [row.restraintId, row]));
  const candidateRows = Array.isArray(direction.restraints) ? direction.restraints : [];
  const residuals = candidateRows.map((row) => classifyResidual(row, baselineById.get(row.restraintId)));

  const summary = {
    restraintCount: residuals.length,
    vectorResidualCount: residuals.filter((row) => row.vectorResidual).length,
    magnitudeResidualCount: residuals.filter((row) => row.magnitudeResidual).length,
    directionResidualCount: residuals.filter((row) => row.directionResidual).length,
    constitutiveStateMismatchCount: residuals.filter((row) => row.constitutiveStateMismatch).length,
    partialMobilisationResidualCount: residuals.filter((row) => row.partialMobilisationResidual).length,
    residualRestraintIds: residuals.filter((row) => row.anyResidual).map((row) => row.restraintId),
  };

  const capacity = r3 === null ? null : summarizeCapacity(r3);
  const geometry = r5 === null ? null : {
    geometrySensitiveFrictionCount: r5.geometrySensitiveFrictionCount,
    bendCoincidentFrictionCount: r5.bendCoincidentFrictionCount,
    teeCoincidentFrictionCount: r5.teeCoincidentFrictionCount,
    decision: r5.decision,
  };
  const restraintSentinels = r6 === null ? null : {
    status: r6.status,
    failureCount: r6.failureCount,
    blankRule: r6.blankRule,
  };
  const next = decideNext({ direction, r5, r6, r2, r3, summary, capacity });

  const result = {
    schema: 'm047-bm4l-stage2-post-direction-residual-rca/v1',
    caseId: baseline.caseId,
    sourceAccdbSha256: baseline.sourceAccdbSha256,
    rule: 'ONE_MECHANIC_AT_A_TIME_R6_SOURCE_BOUNDARY_THEN_R5_GEOMETRY_THEN_DIRECTION_THEN_STATE_PATH_THEN_CAPACITY_BASIS_THEN_PARTITION_THEN_L7_V2',
    directionPromotionStatus: direction.promotion.status,
    summary,
    residuals,
    r6: restraintSentinels,
    r5: geometry,
    r2: r2 === null ? null : {
      decision: r2.decision,
      referenceClusterCount: r2.referenceClusterCount,
      deletedSpringCloserCount: r2.deletedSpringCloserCount,
      returnMapCloserCount: r2.returnMapCloserCount,
    },
    r3: capacity,
    next,
    mechanicsChanged: false,
    toleranceChanged: false,
    comparisonPolicyChanged: false,
  };
  return Object.freeze({ ...result, semanticHash: semanticHash(result) });
}

function classifyResidual(candidate, baseline) {
  if (!baseline) throw new TypeError(`Baseline is missing restraint ${candidate.restraintId}.`);
  const referenceMagnitude = Number(candidate.referenceMagnitudeN);
  const candidateMagnitude = Number(candidate.candidateMagnitudeN);
  const magnitudeRelativeError = referenceMagnitude === 0
    ? null : Math.abs(candidateMagnitude - referenceMagnitude) / Math.abs(referenceMagnitude);
  const vectorRelativeError = candidate.candidateVectorRelativeError;
  const directionCosine = candidate.candidateDirectionCosineToReference;
  const referenceState = normalizeReferenceState(baseline.regime?.reference);
  const candidateState = normalizeSolverState(candidate.regime);
  const referenceUtilisation = Number(baseline.regime?.referenceUtilisation);
  const vectorResidual = Number.isFinite(Number(vectorRelativeError)) && Number(vectorRelativeError) > GOAL;
  const magnitudeResidual = Number.isFinite(Number(magnitudeRelativeError)) && Number(magnitudeRelativeError) > GOAL;
  const directionResidual = vectorResidual
    && Number.isFinite(Number(directionCosine))
    && Number(directionCosine) < DIRECTION_COSINE_GOAL;
  const constitutiveStateMismatch = referenceState !== null && candidateState !== null && referenceState !== candidateState;
  const partialMobilisationResidual = constitutiveStateMismatch
    && Number.isFinite(referenceUtilisation)
    && referenceUtilisation >= PARTIAL_MOBILISATION_MIN
    && referenceUtilisation <= PARTIAL_MOBILISATION_MAX;
  return {
    restraintId: candidate.restraintId,
    nodeId: candidate.nodeId,
    frictionDofs: candidate.frictionDofs,
    referenceState,
    candidateState,
    constitutiveStateMismatch,
    referenceUtilisation: Number.isFinite(referenceUtilisation) ? referenceUtilisation : null,
    vectorRelativeError,
    magnitudeRelativeError,
    candidateDirectionCosineToReference: directionCosine,
    vectorResidual,
    magnitudeResidual,
    directionResidual,
    partialMobilisationResidual,
    anyResidual: vectorResidual || magnitudeResidual || directionResidual || constitutiveStateMismatch,
  };
}

function summarizeCapacity(r3) {
  const singleAxisOverCap = r3.restraints.filter((row) =>
    row.frictionDofs.length === 1
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

function decideNext({ direction, r5, r6, r2, r3, summary, capacity }) {
  if (r6 === null) {
    return {
      decision: 'RUN_R6_RESTRAINT_SENTINEL_PREFLIGHT',
      reason: 'STIFFNESS/GAP/CNODE must be proven blank on the pinned source before a friction mechanic is promoted.',
      l7LoadSteppingAllowed: false,
    };
  }
  if (r6.status !== 'PASS' || Number(r6.failureCount) !== 0) {
    return {
      decision: 'HALT_R6_RESTRAINT_SOURCE_BOUNDARY_CHANGED',
      reason: 'At least one restraint STIFFNESS/GAP/CNODE field is nonblank; current grounded/no-gap/default-stiffness mechanics are not admissible.',
      l7LoadSteppingAllowed: false,
    };
  }
  if (r5 === null) {
    return {
      decision: 'RUN_R5_FRICTION_GEOMETRY_INVENTORY',
      reason: 'Bend/tee station coincidence must be inventoried before promoting a global tangent-plane direction rule.',
      l7LoadSteppingAllowed: false,
    };
  }
  if (r5.decision?.directionPromotionBlockedByR5 === true) {
    return {
      decision: 'R5_LOCAL_TANGENT_VERIFICATION_REQUIRED',
      reason: 'At least one friction restraint coincides with a bend/tee source station; verify the friction plane against the local arc/leg tangent before direction promotion.',
      l7LoadSteppingAllowed: false,
    };
  }
  if (direction.promotion.status !== 'EVIDENCE_SUPPORTS_PROMOTION_TO_GOVERNED_DIRECTION_RULE') {
    return {
      decision: 'HALT_DIRECTION_CANDIDATE_NOT_PROMOTABLE',
      reason: 'Direction mechanics failed at least one physics, determinism, normal-reaction or accuracy promotion gate.',
      l7LoadSteppingAllowed: false,
    };
  }
  if (summary.directionResidualCount > 0) {
    return {
      decision: 'DIRECTION_MECHANISM_STILL_UNRESOLVED',
      reason: 'Some candidate force vectors remain directionally inconsistent with CAESAR after the direction-only solve.',
      l7LoadSteppingAllowed: false,
    };
  }
  if (r2 === null) {
    return {
      decision: 'RUN_R2_MOBILISATION_NEXT',
      reason: 'Source, geometry and direction are isolated; state-path/partial-mobilisation evidence is now the next single-mechanic gate.',
      l7LoadSteppingAllowed: false,
    };
  }
  if (r2.decision === 'EVIDENCE_FAVOURS_DELETED_SPRING_STATE_STABLE_STOP') {
    return {
      decision: 'R2_DELETED_SPRING_STATE_PATH_IS_NEXT_MECHANICS_CANDIDATE',
      reason: 'The deleted-spring state-stable snapshot reproduces the declared partial-mobilisation cluster better than the return map.',
      l7LoadSteppingAllowed: false,
    };
  }
  if (r3 === null) {
    return {
      decision: 'RUN_R3_CAPACITY_BASIS_NEXT',
      reason: 'Direction and R2 are separated; residual over-cap/state rows now require capacity-basis evidence.',
      l7LoadSteppingAllowed: false,
    };
  }
  if (capacity.singleAxisOverCapCount > 0) {
    return {
      decision: 'CAPACITY_BASIS_BEFORE_PARTITION',
      reason: 'A one-free-tangent restraint exceeds the L13-normal Coulomb cap; per-axis versus resultant partition cannot explain a one-axis exceedance.',
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
  if (summary.vectorResidualCount > 0 || summary.magnitudeResidualCount > 0 || summary.constitutiveStateMismatchCount > 0) {
    return {
      decision: 'L13_RESIDUAL_MECHANISM_UNRESOLVED',
      reason: 'Residual L13 vector, magnitude or constitutive-state errors remain without a supported next capacity mechanism.',
      l7LoadSteppingAllowed: false,
    };
  }
  return {
    decision: 'L13_RCA_CLEARED_FOR_L7_LOAD_STEPPING',
    reason: 'R6 source boundary, R5 geometry, direction, state-path and capacity diagnostics leave no above-goal L13 friction residual.',
    l7LoadSteppingAllowed: true,
  };
}

function normalizeReferenceState(value) {
  if (value === 'SLID') return 'SLID';
  if (value === 'STUCK') return 'STUCK';
  return null;
}

function normalizeSolverState(value) {
  if (value === 'SLIDING') return 'SLID';
  if (value === 'STUCK' || value === 'LOCKED_AFTER_SLIP') return 'STUCK';
  return null;
}

function requireBaseline(value) {
  if (value?.schema !== 'm047-bm4l-stage2-friction-tuning-iteration/v1' || value.converged !== true) {
    throw new TypeError('A converged governed friction tuning baseline is required.');
  }
}

function requireDirection(value) {
  if (value?.schema !== 'm047-bm4l-stage2-direction-only-nonlinear-experiment/v1') {
    throw new TypeError('A direction-only nonlinear experiment artifact is required.');
  }
}

function requireR5(value, baseline) {
  if (value?.schema !== 'm047-bm4l-stage2-r5-friction-geometry-inventory/v1') {
    throw new TypeError('R5 geometry inventory must use the governed schema.');
  }
  requireSameCustody(baseline, value, 'baseline', 'R5');
}

function requireR6(value, baseline) {
  if (value?.schema !== 'm047-bm4l-stage2-r6-restraint-sentinel-preflight/v1') {
    throw new TypeError('R6 restraint sentinel preflight must use the governed schema.');
  }
  if (value.sourceAccdbSha256 !== baseline.sourceAccdbSha256) {
    throw new TypeError('baseline/R6 ACCDB custody mismatch.');
  }
}

function requireR2(value, baseline) {
  if (value?.schema !== 'm047-bm4l-stage2-r2-mobilisation-diagnostics/v1') {
    throw new TypeError('R2 mobilisation diagnostics must use the governed schema.');
  }
  requireSameCustody(baseline, value, 'baseline', 'R2');
}

function requireR3(value, baseline) {
  if (value?.schema !== 'm047-bm4l-stage2-r3-capacity-diagnostics/v1') {
    throw new TypeError('R3 capacity diagnostics must use the governed schema.');
  }
  if (baseline.sourceAccdbSha256 !== value.sourceAccdbSha256) {
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
  if (left.caseId !== undefined && right.caseId !== undefined && String(left.caseId) !== String(right.caseId)) {
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
      + '[--r6 <r6.json>] [--r5 <r5.json>] [--r2 <r2.json>] [--r3 <r3.json>] [--out <json>]',
    );
  }
  const read = (path) => JSON.parse(readFileSync(resolve(path), 'utf8'));
  const record = buildPostDirectionResidualRca({
    baseline: read(baselinePath),
    direction: read(directionPath),
    r6: args.get('--r6') ? read(args.get('--r6')) : null,
    r5: args.get('--r5') ? read(args.get('--r5')) : null,
    r2: args.get('--r2') ? read(args.get('--r2')) : null,
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
    residuals: record.summary,
    r2Decision: record.r2?.decision ?? null,
    r3: record.r3,
    next: record.next,
  })}\n`);
}
