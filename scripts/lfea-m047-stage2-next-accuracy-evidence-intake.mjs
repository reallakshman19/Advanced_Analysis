#!/usr/bin/env node
/**
 * Validate the compact real-file next-accuracy batch from the sibling Stage 2 RCA.
 *
 * The batch establishes D1 as the retained experimental baseline after measured
 * D2/S2/R2/R3/N1/N2 alternatives. This reducer changes no mechanics and cannot
 * authorize production promotion. Its sole purpose is to establish whether a
 * physical load-path continuation experiment is the next admissible one-mechanic
 * iteration.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';

const PINNED_ACCDB_SHA256 = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const SCHEMA = 'm047-bm4l-stage2-next-accuracy-batch-compact-evidence/v1';
const D1_BASELINE = 'D1-total-relative-tangential-displacement-direction';
const NEXT_DECISION =
  'KEEP_D1_BASELINE_NEXT_MECHANIC_SHOULD_BE_PHYSICAL_LOAD_PATH_CONTINUATION_NOT_RELOCK_OR_ACCELERATOR_RETUNING';

export function validateNextAccuracyBatchEvidence(evidence) {
  assert.equal(evidence?.schema, SCHEMA, 'unsupported next-accuracy compact evidence schema');
  assert.equal(evidence.sourceAccdbSha256, PINNED_ACCDB_SHA256, 'next-accuracy ACCDB custody mismatch');
  assert.equal(evidence.baseline, D1_BASELINE, 'next-accuracy batch is not based on accepted D1');
  assert.equal(evidence.decision, NEXT_DECISION, 'next-accuracy batch does not select physical load-path continuation');

  requireArtifactHash(evidence.d1?.artifactSha256, 'D1');
  requireSummary(evidence.d1?.summary, 'D1');
  assert.equal(evidence.d1.summary.tangentialVectorsWithinGoal, 13,
    'accepted D1 baseline vector pass count changed');
  assert.equal(evidence.d1.summary.normalWithinGoal, 23,
    'accepted D1 baseline normal-force gate changed');

  requireArtifactHash(evidence.d2RelockDirection?.artifactSha256, 'D2');
  requireSummary(evidence.d2RelockDirection?.summary, 'D2');
  assert.equal(evidence.d2RelockDirection.converged, true, 'D2 measured outcome changed');
  assert.match(String(evidence.d2RelockDirection.decision), /^REJECT_/u, 'D2 must remain rejected');
  assert.ok(evidence.d2RelockDirection.summary.tangentialVectorsWithinGoal
    < evidence.d1.summary.tangentialVectorsWithinGoal,
  'D2 no longer degrades the accepted D1 vector pass count; re-review the batch');
  assert.equal(evidence.d2RelockDirection.summary.normalWithinGoal, 23, 'D2 normal gate changed');

  requireArtifactHash(evidence.s2RelockReanchor?.artifactSha256, 'S2');
  requireSummary(evidence.s2RelockReanchor?.summary, 'S2');
  assert.equal(evidence.s2RelockReanchor.converged, true, 'S2 measured outcome changed');
  assert.match(String(evidence.s2RelockReanchor.decision), /^REJECT_/u, 'S2 must remain rejected');
  assert.ok(evidence.s2RelockReanchor.summary.tangentialVectorsWithinGoal
    < evidence.d1.summary.tangentialVectorsWithinGoal,
  'S2 no longer degrades the accepted D1 vector pass count; re-review the batch');
  assert.equal(evidence.s2RelockReanchor.summary.normalWithinGoal, 23, 'S2 normal gate changed');

  const r2 = evidence.r2IterationPath;
  requireArtifactHash(r2?.fullLocalArtifactSha256, 'R2 iteration path');
  assert.ok(Number(r2.fullLocalArtifactByteLength) > 0, 'R2 full artifact byte length is missing');
  assert.equal(r2.decision, 'REJECT_FIRST_STATE_STABLE_STOPPING_RULE');
  assert.equal(r2.summary?.firstStateStableIteration, 2, 'R2 first state-stable iteration changed');
  assert.ok(r2.summary.firstStateStableVectorWithinGoal < r2.summary.convergedVectorWithinGoal,
    'R2 first state-stable point no longer underperforms the converged D1 state');
  assert.equal(r2.summary.convergedVectorWithinGoal, evidence.d1.summary.tangentialVectorsWithinGoal,
    'R2 converged endpoint no longer reproduces the accepted D1 vector count');
  assert.equal(r2.summary.iterationCount, 396, 'R2/D1 measured convergence iteration changed');
  assert.ok(Array.isArray(r2.selectedIterations) && r2.selectedIterations.length > 0,
    'R2 selected iteration evidence is missing');
  const convergedIteration = r2.selectedIterations.find((row) => row.gateStatus === 'CONVERGED');
  assert.ok(convergedIteration, 'R2 selected iteration evidence has no converged endpoint');
  assert.equal(convergedIteration.iteration, r2.summary.iterationCount,
    'R2 selected converged endpoint disagrees with summary');

  const r3 = evidence.r3CapacityPartition;
  requireArtifactHash(r3?.artifactSha256, 'R3 capacity partition');
  assert.equal(r3.summary?.target22140PartitionRelevant, false,
    'R3 now says 22140 is explained by partition; re-review before continuation');
  assert.equal(r3.summary?.target22220PartitionRelevant, false,
    'R3 now says 22220 is explained by partition; re-review before continuation');
  assert.equal(r3.summary?.target20710OneAxisOverCap, true,
    'R3 no longer retains 20710 as the separate one-axis capacity/path signal');
  assert.ok(Array.isArray(r3.oneAxisOverCapRestraintIds)
    && r3.oneAxisOverCapRestraintIds.includes('20710:REST_PTR13:TYPE3:UY'),
  'R3 one-axis over-cap evidence is missing 20710');

  validateRejectedNonconvergedNumericalVariant(evidence.n1NoAcceleration, 'N1');
  validateRejectedNonconvergedNumericalVariant(evidence.n2ActiveSetSafeAcceleration, 'N2');

  const base = {
    schema: 'm047-bm4l-stage2-next-accuracy-evidence-intake/v1',
    status: 'PASS',
    caseId: 'L13',
    sourceAccdbSha256: PINNED_ACCDB_SHA256,
    retainedBaseline: {
      variant: D1_BASELINE,
      tangentialVectorsWithinGoal: evidence.d1.summary.tangentialVectorsWithinGoal,
      normalWithinGoal: evidence.d1.summary.normalWithinGoal,
      convergenceIteration: r2.summary.iterationCount,
    },
    rejectedMechanisms: [
      'D2_RELOCK_DIRECTION_PROJECTION',
      'S2_RELOCK_REANCHOR_AT_CURRENT_POSITION',
      'R2_FIRST_STATE_STABLE_STOPPING',
      'R3_PARTITION_AS_EXPLANATION_FOR_22140_22220',
      'N1_NO_ACCELERATION',
      'N2_ACTIVE_SET_SAFE_ACCELERATION',
    ],
    retainedSeparateSignals: {
      oneAxisCapacityPathRestraintIds: [...r3.oneAxisOverCapRestraintIds].sort(compareText),
      target20710OneAxisOverCap: true,
    },
    next: {
      decision: 'D1_PHYSICAL_LOAD_PATH_CONTINUATION_EXPERIMENT_JUSTIFIED',
      changedMechanicAllowed: 'PHYSICAL_LOAD_PATH_CONTINUATION_FROM_ZERO_TO_FULL_L13_ONLY',
      productionMechanicsPromotionAuthorized: false,
      l7LoadSteppingAllowed: false,
      bm4nlAllowed: false,
    },
    mechanicsChanged: false,
    toleranceChanged: false,
    comparisonPolicyChanged: false,
  };
  return Object.freeze({ ...base, semanticHash: semanticHash(base) });
}

function requireSummary(summary, label) {
  assert.ok(summary && typeof summary === 'object', `${label} summary is missing`);
  assert.equal(summary.frictionRestraintCount, 23, `${label} friction restraint count changed`);
  assert.equal(summary.tangentialVectorsCompared, 23, `${label} vector comparison count changed`);
  assert.equal(summary.goalRelative, 0.1, `${label} comparison goal changed`);
  assert.ok(Number.isFinite(Number(summary.tangentialVectorsWithinGoal)), `${label} vector pass count is invalid`);
  assert.ok(Number.isFinite(Number(summary.normalWithinGoal)), `${label} normal pass count is invalid`);
}

function validateRejectedNonconvergedNumericalVariant(record, label) {
  requireArtifactHash(record?.artifactSha256, label);
  assert.equal(record.converged, false, `${label} measured convergence outcome changed`);
  assert.equal(record.decision, 'REJECT_NONCONVERGED_400', `${label} rejection decision changed`);
  assert.equal(record.failure?.iterationCount, 400, `${label} governed iteration budget changed`);
  assert.ok(Array.isArray(record.failure?.lastFailedGates) && record.failure.lastFailedGates.length > 0,
    `${label} nonconvergence gate evidence is missing`);
}

function requireArtifactHash(value, label) {
  assert.match(String(value ?? ''), /^[a-f0-9]{64}$/u, `${label} artifact SHA-256 is invalid`);
}

function compareText(left, right) {
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {
    throw new TypeError('Usage: node scripts/lfea-m047-stage2-next-accuracy-evidence-intake.mjs <next-accuracy-evidence.json>');
  }
  const evidence = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'));
  process.stdout.write(`${canonicalPrettyStringify(validateNextAccuracyBatchEvidence(evidence))}\n`);
}
