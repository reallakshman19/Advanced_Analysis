#!/usr/bin/env node
/** Static contract for H1: final D1 return-map update only on SLIDE -> STICK. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildRelockFinalReturnMapCandidateSource } from './lfea-m047-stage2-d1-relock-final-return-map-experiment.mjs';

const solverPath = resolve('src/core/fea-benchmarks/caesar-accdb-friction-solve.js');
const production = readFileSync(solverPath, 'utf8');
const candidate = buildRelockFinalReturnMapCandidateSource(production, solverPath);

const required = [
  "profileId: 'CAESAR-ACCDB-FRICTION-SOLVER-R1-D1-RELOCK-FINAL-RETURN-MAP'",
  "slipDirectionRule: 'UNIT_TOTAL_RELATIVE_TANGENTIAL_DISPLACEMENT_V1_EXPERIMENTAL'",
  "const finalizingRelock = state === 'SLIDE' && nextState === 'STICK';",
  "const applyReturnMap = nextState === 'SLIDE' || finalizingRelock;",
  "value - (capacityN / stiffness) * value / totalDirectionMagnitude",
  "capacityRule: 'BIDIRECTIONAL_SUPPORT_USES_NORMAL_REACTION_MAGNITUDE_V1'",
  "stateBoundaryRule: 'SLIDE_IMMEDIATELY_ABOVE_CAP_RETURN_TO_STICK_ONLY_BELOW_CAP_TIMES_ONE_MINUS_H_V1'",
  "rule: 'COSINE_BETWEEN_NET_FRICTION_FORCE_AND_TOTAL_RELATIVE_TANGENTIAL_DISPLACEMENT'",
];
for (const token of required) if (!candidate.includes(token)) throw new Error(`H1 transformed solver missing ${token}`);

if (candidate.includes("const nextSlip = nextState === 'SLIDE' && totalDirectionMagnitude")) {
  throw new Error('H1 candidate did not replace the D1 transition slip rule.');
}
if (candidate.includes("nextState = state === 'SLIDE' ? 'SLIDE'")) {
  throw new Error('H1 must not reintroduce no-relock S1.');
}
if (candidate.includes("relockingFromSlide") && candidate.includes('slip.map(() => 0)')) {
  throw new Error('H1 must not reintroduce zero-force re-anchor S2.');
}

const source = readFileSync(resolve('scripts/lfea-m047-stage2-d1-relock-final-return-map-experiment.mjs'), 'utf8');
for (const token of [
  "isolatedMechanic: 'SLIDE_TO_STICK_FINALIZES_D1_RETURN_MAP_SLIP_OFFSET_ON_TRANSITION'",
  'productionSolverModified: false',
  "'RESULTANT_COULOMB_CAPACITY'",
  "'OWN_RESTRAINT_SIGNED_NORMAL_BASIS'",
  "'STATE_BOUNDARY_AND_HYSTERESIS'",
  "'TEN_PERCENT_COMPARISON_GOAL'",
  "change.from === 'SLIDE' && change.to === 'STICK'",
  'transitionReproducible',
]) if (!source.includes(token)) throw new Error(`H1 experiment boundary missing ${token}`);

process.stdout.write('M047 Stage 2 H1 relock final-return-map isolation contract: PASS\n');
