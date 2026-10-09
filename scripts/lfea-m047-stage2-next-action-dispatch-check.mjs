#!/usr/bin/env node
/** Static/pure contract for the verified Stage 2 next-action dispatcher. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { classifyStage2NextDecision } from './lfea-m047-stage2-next-action-dispatch.mjs';

const cases = [
  ['R5_LOCAL_TANGENT_VERIFICATION_REQUIRED', 'BLOCKED_RCA', 'R5_LOCAL_TANGENT_VERIFICATION'],
  ['HALT_DIRECTION_CANDIDATE_NOT_PROMOTABLE', 'BLOCKED_RCA', 'DIRECTION_CANDIDATE_FAILURE_RCA'],
  ['DIRECTION_MECHANISM_STILL_UNRESOLVED', 'BLOCKED_RCA', 'DIRECTION_RESIDUAL_RCA'],
  ['R2_DELETED_SPRING_STATE_PATH_IS_NEXT_MECHANICS_CANDIDATE', 'EXPERIMENT_REQUIRED', 'R2_STATE_PATH_PROMOTION_EXPERIMENT'],
  ['CAPACITY_BASIS_BEFORE_PARTITION', 'BLOCKED_RCA', 'R3_NORMAL_CAPACITY_BASIS_RCA'],
  ['TEST_FRICTIONLESS_TWIN_NORMAL_CAPACITY_BASIS', 'EXPERIMENT_REQUIRED', 'R3_FRICTIONLESS_TWIN_NORMAL_BASIS_EXPERIMENT'],
  ['PER_AXIS_CAPACITY_PARTITION_EXPERIMENT_JUSTIFIED', 'EXPERIMENT_REQUIRED', 'R3_PER_AXIS_CAPACITY_PARTITION_EXPERIMENT'],
  ['L13_RESIDUAL_MECHANISM_UNRESOLVED', 'BLOCKED_RCA', 'L13_RESIDUAL_CLASSIFICATION'],
  ['L13_RCA_CLEARED_FOR_L7_LOAD_STEPPING', 'L7_PLAN_READY', 'R4_L7_LOAD_STEPPING_SENSITIVITY'],
];
for (const [decision, disposition, workPackage] of cases) {
  const result = classifyStage2NextDecision(decision);
  assert.equal(result.disposition, disposition, decision);
  assert.equal(result.workPackage, workPackage, decision);
  assert.equal(result.productionMechanicsPromotionAuthorized, false, decision);
}

assert.throws(
  () => classifyStage2NextDecision('RUN_R3_CAPACITY_BASIS_NEXT'),
  (error) => error?.code === 'M047_STAGE2_VERIFIED_BUNDLE_UNEXPECTED_DECISION',
  'a COMPLETE verified bundle must not dispatch an intermediate/incomplete decision',
);

const scriptPath = resolve('scripts/lfea-m047-stage2-next-action-dispatch.mjs');
const source = readFileSync(scriptPath, 'utf8');
assert.match(source, /verifyStage2RcaEvidenceManifest/u,
  'dispatcher must independently verify the COMPLETE evidence manifest');
assert.match(source, /buildL7LoadStepPlan/u,
  'dispatcher may materialize L7 planning only through the governed L7 builder');
assert.match(source, /nextAction\.disposition === 'L7_PLAN_READY'/u,
  'L7 plan materialization must be restricted to the explicit cleared disposition');
assert.match(source, /automaticProductionMechanicsMutationAllowed: false/u);
assert.match(source, /productionMechanicsPromotionAuthorized: false/u);
assert.match(source, /--l7-plan-out is forbidden/u,
  'requesting an L7 plan on a blocked decision must fail closed');
assert.doesNotMatch(source, /caesar-accdb-friction-solve/u,
  'dispatcher must not import or modify the nonlinear solver');

const syntax = spawnSync(process.execPath, ['--check', scriptPath], { encoding: 'utf8' });
assert.equal(syntax.status, 0, `next-action dispatcher must parse: ${syntax.stderr}`);

process.stdout.write('PASS m047 Stage 2 next-action dispatcher contract\n');
