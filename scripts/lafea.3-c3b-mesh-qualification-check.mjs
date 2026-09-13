#!/usr/bin/env node
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = process.env.C3B_ROOT ? path.resolve(process.env.C3B_ROOT) : path.resolve(path.dirname(SCRIPT_PATH), '..');
const BASIS_PATH = path.join(ROOT, 'agents/chains/ADV-LAFEA3-C3B-1766/validation/source-basis-v1.json');
const args = parseArgs(process.argv.slice(2));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const head = git(['rev-parse', 'HEAD']).trim();
if (args.expectedHead && head !== args.expectedHead) {
  fail(`Expected HEAD ${args.expectedHead}, observed ${head}.`);
}
const trackedStatus = git(['status', '--porcelain', '--untracked-files=no']);
if (trackedStatus.trim()) fail(`Tracked worktree must be clean before C3-B qualification:\n${trackedStatus}`);

const basis = JSON.parse(fs.readFileSync(BASIS_PATH, 'utf8'));
if (basis.schema !== 'lafea3-c3b-source-basis/v1') fail(`Unexpected C3-B source basis schema ${basis.schema}.`);

const runnerBlobSha = git(['rev-parse', `${head}:scripts/lafea.3-c3b-mesh-qualification-check.mjs`]).trim();
const sourceBasisBlobSha = git(['rev-parse', `${head}:agents/chains/ADV-LAFEA3-C3B-1766/validation/source-basis-v1.json`]).trim();

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
  process.stdout.write(`${JSON.stringify(summary({ head, basis, sourceCustody, steps: [], status: 'FAIL', blocker: 'SOURCE_CUSTODY_MISMATCH' }), null, 2)}\n`);
  process.exit(1);
}

const steps = [
  step('C3B-M0-M2-ORDINARY-GEOMETRY', process.execPath, ['scripts/lafea.3-geometry-intake-check.mjs'], 'M0_M1_M2'),
  step('C3B-M2-CURVED-GEOMETRY', process.execPath, ['scripts/lafea.3-curved-geometry-intake-check.mjs'], 'M2'),
  step('C3B-M0-M3-PRODUCER-BINDING', process.execPath, ['scripts/lafea-mesh-producer-binding-check.mjs'], 'M0_M1_M2_M3'),
  step('C3B-REFINEMENT-CUSTODY', process.execPath, ['scripts/lafea-retained-mesh-refinement-check.mjs'], 'C3B_3'),
  step('C3B-M4-CONTINUUM-HANDOFF', process.execPath, ['scripts/lafea.3-continuum-convergence-route-check.mjs'], 'M4'),
  step('C3B-B02C-CURVED-HOLE-MESH', process.execPath, ['scripts/lafea.3-c3b-b02c-mesh-check.mjs'], 'M2_M3'),
  step('C3B-MESHING-GOVERNANCE', npm, ['run', 'check:lafea-meshing'], 'REGRESSION'),
  step('C3B-IMPORT-GOVERNANCE', npm, ['run', 'check:imports'], 'REGRESSION'),
  step('C3B-DIFF-HYGIENE', 'git', ['diff', '--check', `${args.base ?? basis.candidateBaseSha}...HEAD`], 'REGRESSION'),
];

const status = steps.every((row) => row.status === 'PASS') ? 'PASS' : 'FAIL';
const blocker = status === 'PASS' ? null : steps.find((row) => row.status === 'FAIL')?.stepId ?? 'UNKNOWN_FAILURE';
process.stdout.write(`${JSON.stringify(summary({ head, basis, sourceCustody, steps, status, blocker }), null, 2)}\n`);
process.exit(status === 'PASS' ? 0 : 1);

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
    stdertTail: tail(stderr),
    elapsedMs: Number(elapsedMs.toFixed(3)),
  };
}

function summary({ head, basis, sourceCustody, steps, status, blocker }) {
  return {
    schema: 'lafea3-c3b-mesh-qualification-run/v1',
    issue: 'github:reallaksh19/Advanced_Analysis#1766',
    chainId: 'ADV-LAFEA3-C3B-1766',
    exactHeadSha: head,
    sourceBasisId: basis.basisId,
    sourceBasisBlobSha,
    historicalBmMeshDisposition: basis.historicalBenchmark.disposition,
    runnerBlobSha,
    sourceCustody,
    steps,
    status,
    blocker,
    authority: {
      productionMesherMutationPerformedByRunner: false,
      benchmarkOracleOrToleranceMutationPerformedByRunner: false,
      releaseAuthorityGranted: false,
      downstreamSolverOrRecoveryQualificationGranted: false,
    },
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

function git(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) fail(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function tail(value, max = 4000) {
  return value.length <= max ? value : value.slice(-max);
}

function fail(message) {
  throw new Error(message);
}
