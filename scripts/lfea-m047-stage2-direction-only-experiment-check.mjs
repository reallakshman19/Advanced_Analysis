#!/usr/bin/env node
/** Static contract for the M047 direction-only nonlinear experiment. */
import assert from 'node:assert/strict';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildCandidateSource } from './lfea-m047-stage2-direction-only-experiment.mjs';

const solverPath = resolve('src/core/fea-benchmarks/caesar-accdb-friction-solve.js');
const experimentPath = resolve('scripts/lfea-m047-stage2-direction-only-experiment.mjs');
const production = readFileSync(solverPath, 'utf8');
const experimentSource = readFileSync(experimentPath, 'utf8');
const baselineRule = "slipDirectionRule: 'UNIT_RELATIVE_TANGENTIAL_DISPLACEMENT_V1',";
const candidateRule = "slipDirectionRule: 'UNIT_TOTAL_RELATIVE_TANGENTIAL_DISPLACEMENT_V1_EXPERIMENTAL',";

assert.equal(count(production, baselineRule), 1, 'production solver must retain exactly one governed direction rule');
assert.equal(count(production, candidateRule), 0, 'experimental direction rule must not be written into production solver');

const candidate = buildCandidateSource(production, solverPath);
assert.equal(count(candidate, baselineRule), 0, 'candidate module must replace the governed direction rule');
assert.equal(count(candidate, candidateRule), 1, 'candidate module must publish exactly one experimental direction rule');
assert.match(candidate, /value - \(capacityN \/ stiffness\) \* value \/ totalDirectionMagnitude/u,
  'candidate return map must point capped force opposite total tangential displacement');
assert.match(candidate, /const frictionDirectionCosine = oppositionCosine;/u,
  'candidate convergence gate must use total tangential displacement direction');
assert.match(candidate, /COSINE_BETWEEN_NET_FRICTION_FORCE_AND_TOTAL_RELATIVE_TANGENTIAL_DISPLACEMENT/u,
  'candidate evidence must name the changed direction law');
assert.doesNotMatch(candidate,
  /const frictionDirectionCosine = stretchCosine;/u,
  'candidate module must not keep elastic-stretch direction as the governing direction cosine');
assert.equal(readFileSync(solverPath, 'utf8'), production,
  'building the candidate source must not modify the production solver');

assert.match(experimentSource, /NONCONVERGENCE_IS_EVIDENCE_AND_MUST_NOT_BE_HIDDEN/u,
  'candidate nonconvergence must be recorded as evidence rather than thrown away');
assert.match(experimentSource, /stateChangesTail/u,
  'nonconvergence evidence must retain active-set tail history');
assert.match(experimentSource, /reactionUpdateTailN/u,
  'nonconvergence evidence must retain reaction-update tail history');
assert.match(experimentSource, /PHYSICS_AND_DETERMINISM_FIRST_THEN_ACCURACY/u,
  'promotion must gate on physics and determinism before accuracy');

const runnerSyntax = spawnSync(process.execPath, ['--check', experimentPath], { encoding: 'utf8' });
assert.equal(runnerSyntax.status, 0, `direction experiment runner must parse: ${runnerSyntax.stderr}`);

const tempPath = resolve(tmpdir(), `m047-direction-only-check-${process.pid}.mjs`);
writeFileSync(tempPath, candidate, 'utf8');
try {
  const syntax = spawnSync(process.execPath, ['--check', tempPath], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, `transformed candidate module must parse: ${syntax.stderr}`);
} finally {
  try { unlinkSync(tempPath); } catch { /* best-effort */ }
}

assert.throws(
  () => buildCandidateSource(production.replace(baselineRule, ''), solverPath),
  /cannot find expected solver profile direction rule/u,
  'source drift must fail closed instead of silently producing a different experiment',
);

process.stdout.write('PASS m047 direction-only experiment isolation contract\n');

function count(text, needle) {
  return text.split(needle).length - 1;
}
