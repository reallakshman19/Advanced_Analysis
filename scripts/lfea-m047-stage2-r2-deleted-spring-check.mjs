#!/usr/bin/env node
/** Portable contract for the R2 deleted-spring experiment boundary. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('scripts/lfea-m047-stage2-r2-deleted-spring-experiment.mjs'), 'utf8');

const required = [
  "DELETED_SPRING_WITH_CONSTANT_FORCE_AND_STATE_STABLE_STOP_V1",
  "FIRST_ZERO_STATE_CHANGE_ITERATION_RECORDED_AS_HYPOTHETICAL_CAESAR_REPORTING_POINT_V1",
  "CONTINUE_AFTER_STATE_STABLE_FOR_DIAGNOSTIC_UPDATE_CYCLE_EVIDENCE_V1",
  "productionMechanicsChanged: false",
  "toleranceChanged: false",
  "comparisonPolicyChanged: false",
  "CAESAR_ACCDB_CASE_GATES.NONLINEAR_EFFECTIVE_FRICTION",
  "prepareCaesarAccdbCaseState",
  "executeCaesarAccdbCaseState",
  "PREVIOUS_ITERATION_CAPACITY_AND_DIRECTION_CONSTANT_FORCE",
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`R2 experiment contract missing ${token}`);
}

if (source.includes("from '../src/core/fea-benchmarks/caesar-accdb-friction-solve.js'")) {
  throw new Error('R2 experiment must not import or mutate the governed production friction solver.');
}

if (!source.includes("if (firstStateStable === null && stateChanges.length === 0 && iteration > 1)")) {
  throw new Error('R2 must record the first state-stable snapshot without stopping diagnostic continuation.');
}

if (!source.includes('iterations.slice(-12)')) {
  throw new Error('R2 must preserve a diagnostic iteration tail for limit-cycle review.');
}

if (!source.includes('declarationId: `R2-FRICTION-${support.nodeId}-${dof}`')) {
  throw new Error('R2 spring declaration IDs must use canonical node/dof identities.');
}

if (source.includes('declarationId: `R2-FRICTION-${support.restraintId}-${dof}`')) {
  throw new Error('R2 must not place colon-bearing restraint IDs in kernel declaration identities.');
}

if (!source.includes('primitiveId: `R2-${caseRecord.caseId}-${support.nodeId}-IT${iteration}`')) {
  throw new Error('R2 constant-force primitive IDs must use canonical case/node/iteration identities.');
}

if (!source.includes('nodeId: support.nodeId,\n      support,\n      state,')) {
  throw new Error('R2 measured entries must retain support metadata for snapshot serialization.');
}

process.stdout.write('M047 Stage 2 R2 deleted-spring isolation contract: PASS\n');
