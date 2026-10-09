#!/usr/bin/env node
/** Static/source contract for the isolated D1 physical-load-path experiment. */
import assert from 'node:assert/strict';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildD1LoadPathCandidateSource } from './lfea-m047-stage2-d1-load-path-experiment.mjs';

const solverPath = resolve('src/core/fea-benchmarks/caesar-accdb-friction-solve.js');
const production = readFileSync(solverPath, 'utf8');
const candidate = buildD1LoadPathCandidateSource(production, solverPath);

assert.match(candidate,
  /CAESAR-ACCDB-FRICTION-SOLVER-R1-D1-PROJECT-LOAD-PATH-CONTINUATION/u,
  'candidate must publish a distinct D1 continuation profile');
assert.match(candidate,
  /PROJECT_DECLARED_SCALE_PHYSICAL_ELEMENT_RHS_WITH_FULL_L13_STIFFNESS_FROZEN_V1/u,
  'candidate must declare project numerical continuation rather than CAESAR load stepping');
assert.match(candidate, /loadPathFractions: options\.loadPathFractions \?\? \[1\]/u,
  'candidate solve boundary must default to the exact single-step D1 path');
assert.match(candidate, /function normalizeProjectLoadPathFractions/u);
assert.match(candidate, /strictly increasing and in \(0,1\]/u,
  'candidate must reject adaptive/nonmonotone path fractions');
assert.match(candidate, /terminate at full physical load lambda=1/u,
  'candidate must always end at the exact governed full-load equation');
assert.match(candidate, /equivalentLoadGlobal: contribution\.equivalentLoadGlobal\.map/u,
  'continuation must scale element equivalent physical loads');
assert.match(candidate, /initialStrainLoadGlobal: contribution\.initialStrainLoadGlobal\.map/u,
  'continuation must scale element initial-strain physical loads');
assert.doesNotMatch(candidate, /globalStiffness: contribution\.globalStiffness\.map/u,
  'continuation must never scale or rebuild the full L13 stiffness matrix');
assert.match(candidate, /if \(physicalLoadFraction === 1\) return prepared;/u,
  'lambda=1 must use the unmodified prepared L13 state');
assert.match(candidate, /const acceleration = createSlipAccelerator\(profile\);/u,
  'secant history must be created anew inside each load substep');
assert.match(candidate, /let states = new Map[\s\S]*let slips = new Map/u,
  'friction state/slip maps must exist outside the substep loop so they are carried');
assert.match(candidate, /adaptiveRetryAllowed: false/u,
  'continuation must not adaptively add load steps after observing a failure');
assert.match(candidate, /FRICTION_SLIP_OFFSET_LOADS/u,
  'friction state loads must remain unscaled by the physical load fraction');
assert.match(candidate, /PROJECT_DECLARED_NUMERICAL_CONTINUATION_NOT_CAESAR_INTERNAL_LOAD_STEPPING/u,
  'candidate evidence must preserve the CAESAR authority firewall');

for (const forbidden of [
  /stateHysteresisRelative: (?!0\.001)/u,
  /maximumIterations: (?!400)/u,
  /reactionUpdateLimitN: (?!1e-2)/u,
  /displacementUpdateLimitM: (?!1e-10)/u,
]) {
  assert.doesNotMatch(candidate, forbidden,
    'load-path experiment must not retune an existing D1 convergence/state parameter');
}
assert.equal(readFileSync(solverPath, 'utf8'), production,
  'building the load-path candidate must not edit production solver source');

const tempPath = resolve(tmpdir(), `m047-d1-load-path-check-${process.pid}.mjs`);
writeFileSync(tempPath, candidate, 'utf8');
try {
  const syntax = spawnSync(process.execPath, ['--check', tempPath], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, `transformed D1 load-path candidate must parse: ${syntax.stderr}`);
} finally {
  try { unlinkSync(tempPath); } catch { /* best-effort */ }
}

const experimentSource = readFileSync(resolve('scripts/lfea-m047-stage2-d1-load-path-experiment.mjs'), 'utf8');
assert.match(experimentSource, /D1-L13-PATH-N1/u);
assert.match(experimentSource, /D1-L13-PATH-N5/u);
assert.match(experimentSource, /D1-L13-PATH-N10/u);
assert.match(experimentSource, /N1_MUST_REPRODUCE_ACCEPTED_D1/u,
  'N1 must be a hard implementation-drift control');
assert.match(experimentSource, /N5_VS_N10_REFINEMENT_USES_EXISTING_REACTION_UPDATE_LIMIT/u,
  'N5/N10 refinement must use an existing solver force limit, not benchmark tuning');
assert.match(experimentSource, /productionMechanicsPromotionAuthorized: false/u);
assert.match(experimentSource, /l7LoadSteppingAllowed: false/u);
assert.match(experimentSource, /bm4nlAllowed: false/u);
assert.match(experimentSource, /toleranceChanged: false/u);
assert.match(experimentSource, /comparisonPolicyChanged: false/u);
assert.doesNotMatch(experimentSource, /--overwrite/u,
  'the experiment itself should not silently replace evidence artifacts');

for (const path of [
  resolve('scripts/lfea-m047-stage2-next-accuracy-evidence-intake.mjs'),
  resolve('scripts/lfea-m047-stage2-d1-load-path-plan.mjs'),
  resolve('scripts/lfea-m047-stage2-d1-load-path-experiment.mjs'),
]) {
  const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, `${path} must parse: ${syntax.stderr}`);
}

process.stdout.write('PASS m047 Stage 2 isolated D1 physical-load-path experiment contract\n');
