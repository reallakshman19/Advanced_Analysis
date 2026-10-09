#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAESAR_FRICTION_SOLVER_PROFILE } from '../src/core/fea-benchmarks/caesar-accdb-friction-solve.js';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';

const PROFILE = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const BASELINE = 'reports/lfea-m047-stage2-r2-rebaseline/L1.json';
const PINNED_ACCDB_SHA256 = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const EXPECTED_PRECEDENCE = [
  'OVERALL_GLOBAL_DEFAULT',
  'INDIVIDUAL_FILE_SETTING',
  'LOAD_CASE_SETTING',
  'MODEL_INPUT',
];

export function runL1DiscriminatorPreflight(input = {}) {
  const profile = JSON.parse(readFileSync(resolve(input.profilePath ?? PROFILE), 'utf8'));
  const baseline = JSON.parse(readFileSync(resolve(input.baselinePath ?? BASELINE), 'utf8'));
  const hydro = profile.linearSolve?.hydrotestBasis;
  const precedence = profile.configurationAuthority?.precedence;

  assert.equal(profile.benchmarkId, 'BM4_L', 'Preflight accepts BM4_L only.');
  assert.equal(baseline.caseId, 'L1', 'Baseline must be L1.');
  assert.equal(baseline.converged, true, 'Committed R2 L1 baseline must be converged.');
  assert.equal(baseline.sourceAccdbSha256, PINNED_ACCDB_SHA256, 'Baseline source hash drifted.');
  assert.equal(hydro?.authorityStatus, 'RESOLVED', 'Hydrotest basis must be RESOLVED.');
  assert.equal(Number(hydro?.testFluidDensityKgPerM3), 1000, 'Hydrotest fluid density must remain 1000 kg/m^3.');
  assert.equal(hydro?.pressureField, 'HYDRO_PRESSURE', 'L1 HP must remain bound to HYDRO_PRESSURE.');
  assert.deepEqual(precedence, EXPECTED_PRECEDENCE, 'Configuration precedence drifted.');
  assert.equal(profile.configurationAuthority?.precedenceDirection, 'LOWEST_TO_HIGHEST_AUTHORITY');
  assert.equal(CAESAR_FRICTION_SOLVER_PROFILE.profileId, 'CAESAR-ACCDB-FRICTION-SOLVER-R2', 'Production friction profile drifted from R2.');
  assert.equal(Number(CAESAR_FRICTION_SOLVER_PROFILE.maximumIterations), 800, 'R2 iteration ceiling drifted.');

  const l1 = profile.caseSelection?.cases?.find((entry) => entry.caseId === 'L1');
  assert.equal(Number(l1?.lcaseNumber), 1, 'L1 case selection drifted.');
  assert.equal(Number(profile.configurationAuthority?.layers?.loadCase?.cases?.L1?.FRICTION_MULTIPLIER), 1, 'L1 friction multiplier drifted.');

  const base = {
    schema: 'm047-stage2-l1-discriminator-preflight/v1',
    status: 'PASS',
    benchmarkId: profile.benchmarkId,
    caseId: baseline.caseId,
    pinnedAccdbSha256: PINNED_ACCDB_SHA256,
    baselineIterationSemanticHash: baseline.iterationSemanticHash,
    hydrotestBasis: {
      testFluidDensityKgPerM3: hydro.testFluidDensityKgPerM3,
      pressureField: hydro.pressureField,
      temperatureBasis: hydro.temperatureBasis,
      authorityStatus: hydro.authorityStatus,
    },
    configurationPrecedence: [...precedence],
    frictionProfileId: CAESAR_FRICTION_SOLVER_PROFILE.profileId,
    maximumIterations: CAESAR_FRICTION_SOLVER_PROFILE.maximumIterations,
    productionPromotionAuthorized: false,
    rule: 'FAIL_CLOSED_BEFORE_EITHER_L1_WEIGHT_BASIS_DISCRIMINATOR_IS_RUN',
  };
  return Object.freeze({ ...base, semanticHash: semanticHash(base) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${canonicalPrettyStringify(runL1DiscriminatorPreflight())}\n`);
}
