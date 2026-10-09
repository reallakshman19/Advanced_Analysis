#!/usr/bin/env node
/** Static contract for the D1 physical-load-path evidence finalizer. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const path = resolve('scripts/lfea-m047-stage2-d1-load-path-finalize.mjs');
const source = readFileSync(path, 'utf8');

assert.match(source, /buildD1LoadPathCandidateSource/u,
  'finalizer must fingerprint the exact ephemeral continuation source');
assert.match(source, /productionSolverSha256/u,
  'finalizer must fingerprint the untouched production solver');
assert.match(source, /ephemeralCandidateSha256/u,
  'finalizer must fingerprint the ephemeral candidate solver');
assert.match(source, /productionSourceModifiedByExperiment: false/u);
assert.match(source, /PROJECT_DECLARED_NUMERICAL_CONTINUATION_RCA/u);
assert.match(source, /caesarInternalLoadSteppingClaimed: false/u,
  'finalizer must not misstate the project continuation as CAESAR internal behavior');
assert.match(source,
  /GLOBAL_EQUILIBRIUM_AND_FRICTION_STATE_CONTINUATION_ONLY_NOT_CAESAR_ROW_ACCURACY/u,
  'intermediate substeps must not become CAESAR row-accuracy evidence');
assert.match(source, /caesarAccuracyComparisonScope: 'FINAL_LAMBDA_1_ROWS_ONLY'/u);
assert.match(source, /D1-L13-PATH-N1/u);
assert.match(source, /D1-L13-PATH-N5/u);
assert.match(source, /D1-L13-PATH-N10/u);
assert.match(source, /adaptiveRetryAllowed/u);
assert.match(source, /n1Reproduction/u);
assert.match(source, /refinement/u);
assert.match(source, /PASS_FOR_EXPERIMENTAL_BASELINE_REVIEW_NOT_PRODUCTION_PROMOTION/u);
assert.match(source, /productionMechanicsPromotionAuthorized: false/u);
assert.match(source, /automaticProductionMechanicsMutationAllowed: false/u);
assert.match(source, /l7LoadSteppingAllowed: false/u);
assert.match(source, /bm4nlAllowed: false/u);
assert.match(source, /toleranceChanged: false/u);
assert.match(source, /comparisonPolicyChanged: false/u);
assert.doesNotMatch(source, /solveCaesarAccdbFrictionBenchmark/u,
  'finalizer must verify evidence only, not rerun the nonlinear solve');

for (const script of [
  path,
  resolve('scripts/lfea-m047-stage2-d1-load-path-experiment.mjs'),
  resolve('scripts/lfea-m047-stage2-next-accuracy-evidence-intake.mjs'),
]) {
  const result = spawnSync(process.execPath, ['--check', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${script} must parse: ${result.stderr}`);
}

process.stdout.write('PASS m047 Stage 2 D1 physical-load-path finalizer contract\n');
