#!/usr/bin/env node
/** Portable static contract for the isolated D1 per-axis Coulomb-box experiment. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPerAxisCandidateSource } from './lfea-m047-stage2-d1-per-axis-cap-experiment.mjs';

const solverPath = resolve('src/core/fea-benchmarks/caesar-accdb-friction-solve.js');
const production = readFileSync(solverPath, 'utf8');
const candidate = buildPerAxisCandidateSource(production, solverPath);

const required = [
  "profileId: 'CAESAR-ACCDB-FRICTION-SOLVER-R1-D1-PER-AXIS-BOX-CAP'",
  "capacityRule: 'PER_TANGENTIAL_AXIS_BOX_USES_SAME_MU_TIMES_OWN_NORMAL_V1'",
  "slipDirectionRule: 'UNIT_TOTAL_RELATIVE_TANGENTIAL_DISPLACEMENT_V1_EXPERIMENTAL'",
  "const trialMaximumComponentN = maximum(trialForce.map((value) => Math.abs(value)));",
  "const boxSurfaceResultantCapacityN = capacityN / maximumDirectionComponent;",
  "totalDirectionUnit.map((value) => -boxSurfaceResultantCapacityN * value)",
  "Math.abs(maximum(netForce.map((value) => Math.abs(value))) - capacityN)",
  "entry.appliedForce.some((value) => Math.abs(value) > entry.capacityN",
  "capacitySurface: 'PER_TANGENTIAL_AXIS_BOX'",
  "rule: 'COSINE_BETWEEN_NET_FRICTION_FORCE_AND_TOTAL_RELATIVE_TANGENTIAL_DISPLACEMENT'",
];
for (const token of required) {
  if (!candidate.includes(token)) throw new Error(`P1 transformed solver missing ${token}`);
}

if (candidate.includes("capacityRule: 'BIDIRECTIONAL_SUPPORT_USES_NORMAL_REACTION_MAGNITUDE_V1'")) {
  throw new Error('P1 candidate retained the resultant capacity-rule declaration.');
}
if (candidate.includes('const nextState = trialMagnitude > capacityN + boundary')) {
  throw new Error('P1 candidate retained resultant-magnitude state switching.');
}
if (candidate.includes('const slideResidualN = Math.abs(netMagnitude - capacityN);')) {
  throw new Error('P1 candidate retained resultant slide-cap residual.');
}
if (candidate.includes('entry.appliedMagnitude > entry.capacityN')) {
  throw new Error('P1 candidate retained resultant cap-complementarity gate.');
}

// Mathematical negative control: along an unchanged D1 direction, a one-axis box
// has exactly the same resultant capacity as the original circle.
const cap = 123.456;
const oneAxisDirection = [1];
const oneAxisBoxResultant = cap / Math.max(...oneAxisDirection.map(Math.abs));
if (oneAxisBoxResultant !== cap) throw new Error('P1 one-axis equivalence proof failed.');

// Two-axis diagonal direction reaches the square boundary at sqrt(2)*cap,
// demonstrating that the candidate is genuinely a different capacity surface.
const diagonal = [Math.SQRT1_2, Math.SQRT1_2];
const diagonalResultant = cap / Math.max(...diagonal.map(Math.abs));
if (Math.abs(diagonalResultant - Math.SQRT2 * cap) > 1e-12 * cap) {
  throw new Error('P1 two-axis box geometry proof failed.');
}

// The experiment must remain external to the governed production source.
const experiment = readFileSync(resolve('scripts/lfea-m047-stage2-d1-per-axis-cap-experiment.mjs'), 'utf8');
if (!experiment.includes('productionSolverModified: false')) throw new Error('P1 production-source boundary missing.');
if (!experiment.includes("isolatedMechanic: 'COULOMB_CAPACITY_SURFACE_RESULTANT_CIRCLE_TO_PER_AXIS_BOX'")) {
  throw new Error('P1 isolated-mechanic declaration missing.');
}
if (!experiment.includes("'D1_TOTAL_RELATIVE_TANGENTIAL_FORCE_DIRECTION'")) throw new Error('P1 does not declare D1 direction unchanged.');
if (!experiment.includes("'TEN_PERCENT_COMPARISON_GOAL'")) throw new Error('P1 comparison-goal freeze missing.');

process.stdout.write('M047 Stage 2 D1 per-axis Coulomb-box isolation contract: PASS\n');
