#!/usr/bin/env node
/** Contract for the fail-closed M047 L7 load-step readiness boundary. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildL7LoadStepPlan } from './lfea-m047-stage2-l7-load-step-plan.mjs';

const base = {
  schema: 'm047-bm4l-stage2-rca-decision-gate/v1',
  caseId: 'L13',
  sourceAccdbSha256: '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8',
  semanticHash: 'fnv1a64:test',
};

assert.throws(
  () => buildL7LoadStepPlan({
    ...base,
    next: { decision: 'R2_DELETED_SPRING_STATE_PATH_IS_NEXT_MECHANICS_CANDIDATE', l7LoadSteppingAllowed: false },
  }),
  (error) => error?.code === 'M047_L7_LOAD_STEPPING_BLOCKED_BY_L13_RCA',
  'L7 must remain blocked while L13 state-path mechanics are unresolved',
);

assert.throws(
  () => buildL7LoadStepPlan({
    ...base,
    next: { decision: 'PER_AXIS_CAPACITY_PARTITION_EXPERIMENT_JUSTIFIED', l7LoadSteppingAllowed: false },
  }),
  (error) => error?.code === 'M047_L7_LOAD_STEPPING_BLOCKED_BY_L13_RCA',
  'L7 must remain blocked while L13 capacity partition is unresolved',
);

assert.throws(
  () => buildL7LoadStepPlan({
    ...base,
    schema: 'm047-bm4l-stage2-post-direction-residual-rca/v1',
    next: { decision: 'L13_RCA_CLEARED_FOR_L7_LOAD_STEPPING', l7LoadSteppingAllowed: true },
  }),
  /current governed Stage 2 RCA decision-gate/u,
  'superseded residual RCA artifacts must no longer unlock L7 planning',
);

const plan = buildL7LoadStepPlan({
  ...base,
  next: { decision: 'L13_RCA_CLEARED_FOR_L7_LOAD_STEPPING', l7LoadSteppingAllowed: true },
}, {
  manifestSchema: 'm047-bm4l-stage2-rca-evidence-batch/v1',
  manifestSemanticHash: 'fnv1a64:manifest',
  manifestVerificationStatus: 'PASS',
});
assert.equal(plan.schema, 'm047-bm4l-stage2-l7-load-step-plan/v2');
assert.deepEqual(plan.stepCounts, [1, 5, 10]);
assert.deepEqual(plan.variants.map((row) => row.incrementFraction), [1, 0.2, 0.1]);
assert.ok(plan.variants.every((row) => row.carrySlipStateBetweenIncrements === true));
assert.ok(plan.variants.every((row) => row.carryActiveSetBetweenIncrements === true));
assert.ok(plan.variants.every((row) => row.solveEachIncrementToExistingNonlinearConvergenceGates === true));
assert.equal(plan.sourceL13RcaSchema, 'm047-bm4l-stage2-rca-decision-gate/v1');
assert.equal(plan.sourceEvidenceManifestVerificationStatus, 'PASS');
assert.equal(plan.mechanicsChanged, false);
assert.equal(plan.toleranceChanged, false);
assert.equal(plan.comparisonPolicyChanged, false);

const scriptPath = resolve('scripts/lfea-m047-stage2-l7-load-step-plan.mjs');
const source = readFileSync(scriptPath, 'utf8');
assert.match(source, /verifyStage2RcaEvidenceManifest/u,
  'standalone L7 planner must verify the COMPLETE evidence manifest');
assert.match(source, /--manifest/u,
  'standalone L7 planner must accept the evidence manifest, not a free-standing RCA JSON');
assert.doesNotMatch(source, /--l13-rca/u,
  'superseded free-standing L13 RCA CLI must not remain an L7 unlock path');
const syntax = spawnSync(process.execPath, ['--check', scriptPath], { encoding: 'utf8' });
assert.equal(syntax.status, 0, `L7 readiness planner must parse: ${syntax.stderr}`);

process.stdout.write('PASS m047 L7 load-step readiness contract\n');
