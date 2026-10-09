#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_TARGET_SHA = '585a897afa0f5c9799cb68a58de00a55808062b3';
const TARGET_SHA = String(process.env.PERF_STACK_TARGET_SHA || DEFAULT_TARGET_SHA).trim().toLowerCase();
const RUN_REPOSITORY_GATES = process.argv.includes('--repository-gates') || process.argv.includes('--full');
const RUN_BROWSER = process.argv.includes('--browser') || process.argv.includes('--full');
const OUTPUT_PATH = process.env.PERF_STACK_REPORT_OUTPUT || 'reports/performance-stack-qualification.json';
const QUALIFICATION_ONLY_PATHS = new Set([
  'agents/PR1243_workreport.md',
  'scripts/performance-stack-exact-head-qualification.mjs',
]);

if (!/^[0-9a-f]{40}$/u.test(TARGET_SHA)) fail(`Invalid PERF_STACK_TARGET_SHA: ${TARGET_SHA}`);

const currentHead = git(['rev-parse', 'HEAD']);
const targetObject = git(['rev-parse', TARGET_SHA]);
if (targetObject !== TARGET_SHA) fail(`Target SHA does not resolve exactly: ${TARGET_SHA}`);

let executionBasis;
if (currentHead === TARGET_SHA) {
  executionBasis = 'EXACT_TARGET_HEAD';
} else {
  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', TARGET_SHA, currentHead], { encoding: 'utf8' });
  if (ancestor.status !== 0) fail(`Target SHA ${TARGET_SHA} is not an ancestor of current HEAD ${currentHead}.`);
  const changed = git(['diff', '--name-only', `${TARGET_SHA}..${currentHead}`])
    .split(/\r?\n/u).map((row) => row.trim()).filter(Boolean);
  const nonQualification = changed.filter((row) => !QUALIFICATION_ONLY_PATHS.has(row));
  if (nonQualification.length) {
    fail(`Qualification branch changes production/non-qualification paths above target SHA: ${nonQualification.join(', ')}`);
  }
  executionBasis = 'TARGET_PRODUCTION_TREE_PLUS_QUALIFICATION_ONLY_FILES';
}

const targetedChecks = [
  check('MASTER_DATA_CONTAINMENT', 'node', ['scripts/master-data-containment-check.mjs']),
  check('SUPPORT_LOAD_INDEX_AND_BASE_MASS_STRUCTURE', 'node', ['scripts/support-load-performance-index-check.mjs']),
  check('SUPPORT_LOAD_BASE_MASS_HANDCHECK', 'node', ['scripts/support-load-base-mass-handcheck.mjs']),
  check('EMPIRICAL_FORMULA_PRODUCTION_FIXTURE', 'node', ['scripts/empirical-formula-register-check.mjs']),
  check('LOADCALC_BINDING_CURRENTNESS_STRUCTURE', 'node', ['scripts/loadcalc-binding-currentness-structural-check.mjs']),
  check('LOADCALC_BINDING_CURRENTNESS_RUNTIME', 'node', ['scripts/loadcalc-binding-currentness-check.mjs']),
  check('LOADCALC_DEPENDENCY_INVALIDATION_STRUCTURE', 'node', ['scripts/loadcalc-dependency-invalidation-structural-check.mjs']),
  check('LOADCALC_DEPENDENCY_INVALIDATION_RUNTIME', 'node', ['scripts/loadcalc-dependency-invalidation-check.mjs']),
  check('STAGED_IDENTITY_OPERATION_GUARD', 'node', ['scripts/staged-model-index-identity-performance-check.mjs']),
  check('IMMUTABLE_SOURCE_REUSE_OPERATION_GUARD', 'node', ['scripts/dataset-adapter-immutable-source-reuse-check.mjs']),
  check('EVIDENCE_ALIAS_CACHE_OPERATION_GUARD', 'node', ['scripts/evidence-index-alias-cache-check.mjs']),
  check('MERGED_PERFORMANCE_NODE_TESTS', 'node', [
    '--test',
    'tests/staged-model-index-identity-performance.test.mjs',
    'tests/staged-model-index-identity-legacy-equivalence.test.mjs',
    'tests/dataset-adapter-immutable-source-reuse.test.mjs',
    'tests/evidence-index-alias-cache.test.mjs',
    'tests/load-calc-dependency-invalidation.test.mjs',
    'tests/engineering-model-controller-dataset-guard.test.mjs',
  ]),
];

const repositoryChecks = RUN_REPOSITORY_GATES ? [
  check('IMPORT_CHECK', 'npm', ['run', 'check:imports']),
  check('PRODUCTION_BUILD', 'npm', ['run', 'build']),
] : [
  notRun('IMPORT_CHECK', 'Run with --repository-gates or --full.'),
  notRun('PRODUCTION_BUILD', 'Run with --repository-gates or --full.'),
];

const browserConfigured = Boolean(
  process.env.P1_EXECUTION_ID
  && process.env.P1_FIXTURE_PATH
  && /^[0-9a-f]{64}$/u.test(String(process.env.P1_SOURCE_SHA256 || '')),
);
const browserChecks = RUN_BROWSER && browserConfigured ? [
  check('P1_4884_BROWSER', 'npx', [
    'playwright', 'test', 'e2e/p1-current-main-performance.spec.js', '--reporter=line',
  ], {
    ...process.env,
    P1_EXACT_HEAD_SHA: TARGET_SHA,
  }),
] : [
  notRun('P1_4884_BROWSER', RUN_BROWSER
    ? 'Browser requested but P1_EXECUTION_ID/P1_FIXTURE_PATH/P1_SOURCE_SHA256 are incomplete.'
    : 'Run with --browser or --full and exact P1 fixture variables.'),
];

const checks = [...targetedChecks, ...repositoryChecks, ...browserChecks];
const failures = checks.filter((row) => row.status === 'FAIL');
const targetedFailures = targetedChecks.filter((row) => row.status === 'FAIL');
const targetedNotRun = targetedChecks.filter((row) => row.status === 'NOT_RUN');
const fullPass = failures.length === 0 && checks.every((row) => row.status === 'PASS');
const targetedPass = targetedFailures.length === 0 && targetedNotRun.length === 0;
const classification = failures.length
  ? 'FAIL'
  : fullPass
    ? 'FULL_PASS'
    : targetedPass
      ? 'TARGETED_PASS_FULL_NOT_RUN'
      : 'NOT_RUN';

const report = Object.freeze({
  schema: 'performance-stack-qualification/v1',
  targetSha: TARGET_SHA,
  currentHead,
  executionBasis,
  classification,
  qualificationOnlyChangesAboveTarget: executionBasis !== 'EXACT_TARGET_HEAD',
  targetedPass,
  repositoryGatesRequested: RUN_REPOSITORY_GATES,
  browserRequested: RUN_BROWSER,
  browserConfigured,
  checks,
  authority: Object.freeze({
    changesEngineeringAuthority: false,
    changesHashDomain: false,
    changesNumericalMethod: false,
    notRunCountsAsPass: false,
  }),
});

mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
if (classification === 'FAIL') process.exit(1);
if (!targetedPass) process.exitCode = 2;

function check(id, command, args, env = process.env) {
  const startedNs = process.hrtime.bigint();
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const durationMs = Number(process.hrtime.bigint() - startedNs) / 1e6;
  const status = result.error || result.status !== 0 ? 'FAIL' : 'PASS';
  const row = Object.freeze({
    id,
    status,
    command: [command, ...args].join(' '),
    exitCode: result.status ?? null,
    durationMs: Math.round(durationMs * 1000) / 1000,
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr || result.error?.message || ''),
  });
  console.error(`${status} ${id} (${row.durationMs} ms)`);
  return row;
}

function notRun(id, reason) {
  console.error(`NOT_RUN ${id}: ${reason}`);
  return Object.freeze({ id, status: 'NOT_RUN', reason });
}

function git(args) {
  const result = spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf8' });
  if (result.error || result.status !== 0) fail(`git ${args.join(' ')} failed: ${tail(result.stderr)}`);
  return String(result.stdout || '').trim();
}

function tail(value, max = 4000) {
  const text = String(value || '');
  return text.length <= max ? text : text.slice(-max);
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}
