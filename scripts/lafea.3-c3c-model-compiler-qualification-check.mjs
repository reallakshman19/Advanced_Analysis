#!/usr/bin/env node
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = process.env.C3C_ROOT ? path.resolve(process.env.C3C_ROOT) : path.resolve(path.dirname(SCRIPT_PATH), '..');
const BASIS_PATH = path.join(ROOT, 'agents/chains/ADV-LAFEA3-C3C-1769/validation/source-basis-v1.json');
const args = parseArgs(process.argv.slice(2));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const head = git(['rev-parse', 'HEAD']).trim();

if (args.expectedHead && head !== args.expectedHead) fail(`Expected HEAD ${args.expectedHead}, observed ${head}.`);
const trackedStatus = git(['status', '--porcelain', '--untracked-files=no']);
if (trackedStatus.trim()) fail(`Tracked worktree must be clean before C3-C qualification:\n${trackedStatus}`);

const basis = JSON.parse(fs.readFileSync(BASIS_PATH, 'utf8'));
if (basis.schema !== 'lafea3-c3c-source-basis/v1') fail(`Unexpected C3-C source basis schema ${basis.schema}.`);

const runnerBlobSha = git(['rev-parse', `${head}:scripts/lafea.3-c3c-model-compiler-qualification-check.mjs`]).trim();
const sourceBasisBlobSha = git(['rev-parse', `${head}:agents/chains/ADV-LAFEA3-C3C-1769/validation/source-basis-v1.json`]).trim();
const sourceCustody = basis.sources.map((source) => {
  const observedBlobSha = git(['rev-parse', `${head}:${source.path}`]).trim();
  return {
    sourceId: source.sourceId,
    path: source.path,
    expectedBlobSha: source.blobSha,
    observedBlobSha,
    status: observedBlobSha === source.blobSha ? 'PASS' : 'FAIL',
  };
});

if (sourceCustody.some((row) => row.status !== 'PASS')) {
  emit('FAIL', 'SOURCE_CUSTODY_MISMATCH', []);
  process.exit(1);
}

const steps = [
  step('C3C-COMPILER-MAPPING-MODEL', process.execPath, ['scripts/lafea-continuum-solver-model-check.mjs'], 'C3C_1_C3C_5'),
  step('C3C-COMPILED-INPUT-LOWERING', process.execPath, ['scripts/lafea-continuum-compiled-input-check.mjs'], 'C3C_2_C3C_3'),
  step('C3C-PROJECTION-RESULTANT-CUSTODY', process.execPath, ['scripts/lafea.3-c3c-projection-resultant-check.mjs'], 'C3C_1_C3C_2'),
  step('C3C-BODY-FORCE-RESULTANT', process.execPath, ['scripts/lafea.3-c3c-body-force-resultant-check.mjs'], 'C3C_2_G002'),
  step('C3C-G005-DELTA-T', process.execPath, ['scripts/lafea.3-c3c-temperature-delta-check.mjs'], 'C3C_2_G005'),
  step('C3C-LINEAR-TRACTION', process.execPath, ['scripts/lafea.3-c3c-linear-traction-check.mjs'], 'C3C_2_G003'),
  step('C3C-G004-SOURCE-PRESSURE-PRIMITIVE', process.execPath, ['scripts/lafea.3-c3c-source-pressure-lowering-check.mjs'], 'C3C_2_G004'),
  step('C3C-G004-SOURCE-PRESSURE-COMPILER', process.execPath, ['scripts/lafea.3-c3c-source-pressure-compiler-check.mjs'], 'C3C_1_C3C_2_G004'),
  step('C3C-COMPILED-LOAD-PARITY', process.execPath, ['scripts/lafea-continuum-compiled-load-parity-check.mjs'], 'C3C_2'),
  step('C3C-COMPILED-LOAD-PARITY-NEGATIVE', process.execPath, ['scripts/lafea-continuum-compiled-load-parity-negative-check.mjs'], 'C3C_2'),
  step('C3C-COMPILED-EXECUTION-PARITY', process.execPath, ['scripts/lafea-continuum-compiled-execution-check.mjs'], 'C3C_5'),
  step('C3C-SEVEN-STATE-CURRENTNESS', process.execPath, ['scripts/lafea-b02-currentness-check.mjs'], 'C3C_6'),
  step('C3C-PHYSICAL-PROBE-CURRENTNESS', process.execPath, ['scripts/lafea-b02-g4-physical-probe-diagnostic.mjs'], 'C3C_4'),
  step('C3C-PHYSICAL-PROBE-FAIL-CLOSED', process.execPath, ['scripts/lafea-b02-g4-probe-fail-closed-diagnostic.mjs'], 'C3C_4_C3C_6'),
  step('C3C-IMPORT-GOVERNANCE', npm, ['run', 'check:imports'], 'REGRESSION'),
  step('C3C-DIFF-HYGIENE', 'git', ['diff', '--check', `${args.base ?? basis.reviewedMainSha}...HEAD`], 'REGRESSION'),
];

const status = steps.every((row) => row.status === 'PASS') ? 'PASS' : 'FAIL';
const blocker = status === 'PASS' ? null : steps.find((row) => row.status === 'FAIL')?.stepId ?? 'UNKNOWN_FAILURE';
emit(status, blocker, steps);
process.exit(status === 'PASS' ? 0 : 1);

function emit(status, blocker, steps) {
  const passed = (stepId) => steps.some((row) => row.stepId === stepId && row.status === 'PASS');
  process.stdout.write(`${JSON.stringify({
    schema: 'lafea3-c3c-model-compiler-qualification-run/v1',
    issue: 'github:reallaksh19/Advanced_Analysis#1769',
    chainId: 'ADV-LAFEA3-C3C-1769',
    exactHeadSha: head,
    stackedDependency: basis.stackedDependency,
    reviewedMainSha: basis.reviewedMainSha,
    sourceBasisId: basis.basisId,
    sourceBasisBlobSha,
    runnerBlobSha,
    sourceCustody,
    steps,
    knownOpenSemantics: basis.confirmedOpenSemantics,
    status,
    blocker,
    authority: {
      newPhysicsImplementedByRunner: false,
      sourceOrMeshMutationPerformedByRunner: false,
      temperatureDeltaQualified: passed('C3C-G005-DELTA-T'),
      linearTractionQualified: passed('C3C-LINEAR-TRACTION'),
      sourceNormalPressureQualified: passed('C3C-G004-SOURCE-PRESSURE-COMPILER'),
      projectionReceiptQualified: passed('C3C-PROJECTION-RESULTANT-CUSTODY'),
      constantStraightTractionForceMomentQualified: passed('C3C-PROJECTION-RESULTANT-CUSTODY'),
      bodyForceResultantQualified: passed('C3C-BODY-FORCE-RESULTANT'),
      releaseAuthorityGranted: false,
    },
  }, null, 2)}\n`);
}

function step(stepId, command, commandArgs, evidenceClass) {
  const started = process.hrtime.bigint();
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  return {
    stepId,
    evidenceClass,
    command: [command, ...commandArgs],
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exitCode: result.status,
    signal: result.signal ?? null,
    stdoutSha256: sha256(stdout),
    stderrSha256: sha256(stderr),
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr),
    elapsedMs: Number(elapsedMs.toFixed(3)),
  };
}

function parseArgs(values) {
  const out = { expectedHead: null, base: null };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--expected-head') out.expectedHead = requireArg(values, ++index, value);
    else if (value === '--base') out.base = requireArg(values, ++index, value);
    else fail(`Unknown argument ${value}.`);
  }
  return out;
}
function requireArg(values, index, flag) {
  const value = values[index];
  if (!value || value.startsWith('--')) fail(`${flag} requires a value.`);
  return value;
}
function git(commandArgs) {
  const result = spawnSync('git', commandArgs, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) fail(`git ${commandArgs.join(' ')} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}
function sha256(value) { return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`; }
function tail(value, max = 4000) { return value.length <= max ? value : value.slice(-max); }
function fail(message) { throw new Error(message); }
