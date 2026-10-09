#!/usr/bin/env node
/** Static contract for H2: H1 transition finalization + post-transition locked direction only. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildH2CandidateSource } from './lfea-m047-stage2-h1-relocked-total-direction-experiment.mjs';

const solverPath=resolve('src/core/fea-benchmarks/caesar-accdb-friction-solve.js');
const candidate=buildH2CandidateSource(readFileSync(solverPath,'utf8'),solverPath);
for(const token of [
  "profileId: 'CAESAR-ACCDB-FRICTION-SOLVER-R1-D1-H1-RELOCKED-TOTAL-DIRECTION'",
  "const finalizingRelock = state === 'SLIDE' && nextState === 'STICK';",
  "const applyReturnMap = nextState === 'SLIDE' || finalizingRelock;",
  "const relockedDirectionForce = state === 'STICK'",
  "&& nextState === 'STICK'",
  "tangentialDisplacement.map((value) => -trialMagnitude * value / totalDirectionMagnitude)",
  "value - (capacityN / stiffness) * value / totalDirectionMagnitude",
  "capacityRule: 'BIDIRECTIONAL_SUPPORT_USES_NORMAL_REACTION_MAGNITUDE_V1'",
  "slipDirectionRule: 'UNIT_TOTAL_RELATIVE_TANGENTIAL_DISPLACEMENT_V1_EXPERIMENTAL'",
]) if(!candidate.includes(token)) throw new Error(`H2 transformed solver missing ${token}`);

const h1Index=candidate.indexOf("const applyReturnMap = nextState === 'SLIDE' || finalizingRelock;");
const directionIndex=candidate.indexOf("const relockedDirectionForce = state === 'STICK'");
if(!(h1Index>=0&&directionIndex>h1Index)) throw new Error('H2 must preserve H1 transition rule before post-transition direction logic.');
if(candidate.includes("nextState = state === 'SLIDE' ? 'SLIDE'")) throw new Error('H2 must not reintroduce no-relock S1.');
if(candidate.includes('slip.map(() => 0)')) throw new Error('H2 must not introduce zero-force re-anchor.');

const source=readFileSync(resolve('scripts/lfea-m047-stage2-h1-relocked-total-direction-experiment.mjs'),'utf8');
for(const token of [
  "isolatedMechanic:'POST_H1_RELOCKED_FORCE_DIRECTION_ONLY'",
  "'H1_FINAL_RETURN_MAP_ON_SLIDE_TO_STICK'",
  "'RESULTANT_COULOMB_CAPACITY'",
  "'TEN_PERCENT_COMPARISON_GOAL'",
  "productionSolverModified:false",
  "directionCorrectNegativeControls",
]) if(!source.includes(token)) throw new Error(`H2 experiment boundary missing ${token}`);

process.stdout.write('M047 Stage 2 H2 sequential H1 relocked-direction isolation contract: PASS\n');
