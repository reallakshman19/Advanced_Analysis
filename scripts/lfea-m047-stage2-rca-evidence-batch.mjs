#!/usr/bin/env node
/**
 * M047 Stage 2 — one-command L13 RCA evidence batch.
 *
 * This is deliberately not the full production boundary: the production command
 * also solves L7/L1, which remain downstream of the L13 friction RCA. This batch
 * executes only the governed L13 evidence chain against a pinned local BM4_L.ACCDB,
 * writes every generated artifact beneath reports/, and produces an execution
 * manifest that is still written if a later command fails.
 *
 * Stale evidence is forbidden by default. If any owned output already exists the
 * batch stops before execution; --overwrite explicitly clears only this batch's
 * known output files. Solver source and production mechanics are never edited.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';

const PINNED_ACCDB_SHA256 = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const PINNED_ACCDB_BYTES = 5_136_384;
const DEFAULT_ACCDB = 'artifacts/bm4l-stage2/source/BM4_L.ACCDB';
const DEFAULT_BASELINE = 'reports/lfea-m047-stage2-friction-iteration-L13.json';
const DEFAULT_OUT_ROOT = 'reports/m047-stage2-rca-evidence';
const CASE_ID = 'L13';
const MAX_BUFFER = 32 * 1024 * 1024;

const CONTRACTS = Object.freeze([
  'scripts/lfea-m047-stage2-reference-resolution-check.mjs',
  'scripts/lfea-m047-stage2-r6-restraint-sentinel-preflight-check.mjs',
  'scripts/lfea-m047-stage2-r5-friction-geometry-inventory-check.mjs',
  'scripts/lfea-m047-stage2-direction-law-rca-check.mjs',
  'scripts/lfea-m047-stage2-direction-only-experiment-check.mjs',
  'scripts/lfea-m047-stage2-r2-deleted-spring-check.mjs',
  'scripts/lfea-m047-stage2-post-direction-residual-rca-check.mjs',
  'scripts/lfea-m047-stage2-rca-decision-gate-check.mjs',
  'scripts/lfea-m047-stage2-l7-load-step-plan-check.mjs',
]);

export function evidenceStepOrder(hasR2StateStable = true) {
  const order = [
    'R1_REFERENCE_RESOLUTION',
    'R6_RESTRAINT_SENTINELS',
    'R5_FRICTION_GEOMETRY',
    'DIRECTION_LAW_RCA',
    'DIRECTION_ONLY_EXPERIMENT',
    'R2_DELETED_SPRING_EXPERIMENT',
  ];
  if (hasR2StateStable) order.push('R2_MOBILISATION_DIAGNOSTICS');
  order.push('R3_CAPACITY_DIAGNOSTICS', 'RCA_DECISION_GATE');
  return Object.freeze(order);
}

export async function runStage2RcaEvidenceBatch(input = {}) {
  const accdbPath = resolve(input.accdbPath ?? DEFAULT_ACCDB);
  const baselinePath = resolve(input.baselinePath ?? DEFAULT_BASELINE);
  const outRoot = requireReportsSubdirectory(input.outRoot ?? DEFAULT_OUT_ROOT);
  const outputs = outputPaths(outRoot);
  requirePinnedAccdb(accdbPath);
  const baseline = requireBaseline(baselinePath);
  const initialHead = gitText(['rev-parse', 'HEAD']);
  const initialWorktreeClean = gitText(['status', '--porcelain=v1', '--untracked-files=all']) === '';

  prepareOutputs(outputs, input.overwrite === true);
  mkdirSync(outRoot, { recursive: true });

  const startedAtUtc = new Date().toISOString();
  const steps = [];
  const artifacts = [];
  let r2StateStable = null;

  try {
    for (const contract of CONTRACTS) {
      executeStep({
        id: `CONTRACT:${contract}`,
        args: [contract],
        steps,
      });
    }
    executeStep({ id: 'SYNTAX:R2_MOBILISATION', args: ['--check', 'scripts/lfea-m047-stage2-r2-mobilisation-diagnostics.mjs'], steps });
    executeStep({ id: 'SYNTAX:R3_CAPACITY', args: ['--check', 'scripts/lfea-m047-stage2-r3-capacity-diagnostics.mjs'], steps });

    executeArtifactStep({
      id: 'R1_REFERENCE_RESOLUTION',
      args: [
        'scripts/lfea-m047-stage2-reference-resolution-floor.mjs',
        '--accdb', accdbPath,
        '--iteration', baselinePath,
        '--case', CASE_ID,
        '--out', outputs.r1,
      ],
      outputPath: outputs.r1,
      expectedSchema: 'm047-bm4l-stage2-reference-resolution/v1',
      expectedCaseField: 'caseId',
      steps, artifacts,
    });

    executeArtifactStep({
      id: 'R6_RESTRAINT_SENTINELS',
      args: [
        'scripts/lfea-m047-stage2-r6-restraint-sentinel-preflight.mjs',
        '--accdb', accdbPath,
        '--out', outputs.r6,
      ],
      outputPath: outputs.r6,
      expectedSchema: 'm047-bm4l-stage2-r6-restraint-sentinel-preflight/v1',
      expectedCaseField: null,
      steps, artifacts,
      validate: (value) => {
        if (value.status !== 'PASS' || value.custodyStatus !== 'PASS' || Number(value.failureCount) !== 0) {
          throw new Error('R6 source-boundary artifact is not PASS.');
        }
      },
    });

    executeArtifactStep({
      id: 'R5_FRICTION_GEOMETRY',
      args: [
        'scripts/lfea-m047-stage2-r5-friction-geometry-inventory.mjs',
        '--accdb', accdbPath,
        '--iteration', baselinePath,
        '--out', outputs.r5,
      ],
      outputPath: outputs.r5,
      expectedSchema: 'm047-bm4l-stage2-r5-friction-geometry-inventory/v1',
      expectedCaseField: 'caseId',
      steps, artifacts,
      validate: (value) => {
        if (value.custodyStatus !== 'PASS') throw new Error('R5 geometry artifact failed custody.');
      },
    });

    executeArtifactStep({
      id: 'DIRECTION_LAW_RCA',
      args: [
        'scripts/lfea-m047-stage2-direction-law-rca.mjs',
        '--iteration', baselinePath,
        '--out', outputs.directionRca,
      ],
      outputPath: outputs.directionRca,
      expectedSchema: 'm047-bm4l-stage2-direction-law-rca/v1',
      expectedCaseField: 'caseId',
      steps, artifacts,
    });

    executeArtifactStep({
      id: 'DIRECTION_ONLY_EXPERIMENT',
      args: [
        'scripts/lfea-m047-stage2-direction-only-experiment.mjs',
        '--accdb', accdbPath,
        '--baseline', baselinePath,
        '--case', CASE_ID,
        '--out', outputs.directionExperiment,
      ],
      outputPath: outputs.directionExperiment,
      expectedSchema: 'm047-bm4l-stage2-direction-only-nonlinear-experiment/v1',
      expectedCaseField: 'caseId',
      steps, artifacts,
    });

    executeArtifactStep({
      id: 'R2_DELETED_SPRING_EXPERIMENT',
      args: [
        'scripts/lfea-m047-stage2-r2-deleted-spring-experiment.mjs',
        '--accdb', accdbPath,
        '--case', CASE_ID,
        '--max-iterations', '60',
        '--out', outputs.r2Experiment,
      ],
      outputPath: outputs.r2Experiment,
      expectedSchema: 'm047-bm4l-stage2-r2-deleted-spring-experiment/v1',
      expectedCaseField: 'caseId',
      steps, artifacts,
    });
    const r2Experiment = readJson(outputs.r2Experiment);
    r2StateStable = r2Experiment.firstStateStable !== null;

    if (r2StateStable) {
      executeArtifactStep({
        id: 'R2_MOBILISATION_DIAGNOSTICS',
        args: [
          'scripts/lfea-m047-stage2-r2-mobilisation-diagnostics.mjs',
          '--r2', outputs.r2Experiment,
          '--return-map', baselinePath,
          '--out', outputs.r2Mobilisation,
        ],
        outputPath: outputs.r2Mobilisation,
        expectedSchema: 'm047-bm4l-stage2-r2-mobilisation-diagnostics/v1',
        expectedCaseField: 'caseId',
        steps, artifacts,
      });
    } else {
      steps.push(Object.freeze({
        id: 'R2_MOBILISATION_DIAGNOSTICS',
        status: 'SKIPPED',
        reason: 'R2 experiment has no first state-stable snapshot; mobilisation comparison has no admissible snapshot.',
      }));
    }

    executeArtifactStep({
      id: 'R3_CAPACITY_DIAGNOSTICS',
      args: [
        'scripts/lfea-m047-stage2-r3-capacity-diagnostics.mjs',
        '--accdb', accdbPath,
        '--iteration', baselinePath,
        '--out', outputs.r3,
      ],
      outputPath: outputs.r3,
      expectedSchema: 'm047-bm4l-stage2-r3-capacity-diagnostics/v1',
      expectedCaseField: 'frictionCaseId',
      steps, artifacts,
    });

    const decisionArgs = [
      'scripts/lfea-m047-stage2-rca-decision-gate.mjs',
      '--baseline', baselinePath,
      '--direction', outputs.directionExperiment,
      '--r6', outputs.r6,
      '--r5', outputs.r5,
      '--r2-experiment', outputs.r2Experiment,
      '--r3', outputs.r3,
    ];
    if (r2StateStable) decisionArgs.push('--r2', outputs.r2Mobilisation);
    decisionArgs.push('--out', outputs.decision);
    executeArtifactStep({
      id: 'RCA_DECISION_GATE',
      args: decisionArgs,
      outputPath: outputs.decision,
      expectedSchema: 'm047-bm4l-stage2-rca-decision-gate/v1',
      expectedCaseField: 'caseId',
      steps, artifacts,
    });

    const manifest = writeManifest({
      status: 'COMPLETE',
      startedAtUtc,
      initialHead,
      initialWorktreeClean,
      accdbPath,
      baselinePath,
      baseline,
      outRoot,
      r2StateStable,
      steps,
      artifacts,
      error: null,
      manifestPath: outputs.manifest,
    });
    return manifest;
  } catch (error) {
    writeManifest({
      status: 'FAILED',
      startedAtUtc,
      initialHead,
      initialWorktreeClean,
      accdbPath,
      baselinePath,
      baseline,
      outRoot,
      r2StateStable,
      steps,
      artifacts,
      error: { message: error.message, code: error.code ?? null },
      manifestPath: outputs.manifest,
    });
    throw error;
  }
}

function executeArtifactStep(input) {
  executeStep(input);
  if (!existsSync(input.outputPath)) {
    throw new Error(`${input.id} exited successfully but did not write ${input.outputPath}.`);
  }
  const value = readJson(input.outputPath);
  validateArtifact(value, {
    id: input.id,
    expectedSchema: input.expectedSchema,
    expectedCaseField: input.expectedCaseField,
  });
  if (input.validate) input.validate(value);
  input.artifacts.push(artifactMetadata(input.id, input.outputPath, value));
}

function executeStep({ id, args, steps }) {
  const started = new Date().toISOString();
  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
  });
  const record = Object.freeze({
    id,
    command: [process.execPath, ...args],
    startedAtUtc: started,
    finishedAtUtc: new Date().toISOString(),
    exitCode: result.status,
    signal: result.signal ?? null,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
  });
  steps.push(record);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`${id} failed with exit code ${String(result.status)}: ${tail(result.stderr)}`);
    error.code = 'M047_STAGE2_RCA_BATCH_STEP_FAILED';
    throw error;
  }
}

function validateArtifact(value, input) {
  if (value?.schema !== input.expectedSchema) {
    throw new TypeError(`${input.id} schema ${String(value?.schema)} != ${input.expectedSchema}.`);
  }
  if (value.sourceAccdbSha256 !== PINNED_ACCDB_SHA256) {
    throw new TypeError(`${input.id} does not carry the pinned BM4_L ACCDB hash.`);
  }
  if (input.expectedCaseField !== null && String(value[input.expectedCaseField]) !== CASE_ID) {
    throw new TypeError(`${input.id} ${input.expectedCaseField} is not ${CASE_ID}.`);
  }
  requireNoPolicyMutation(value, input.id);
}

function requireNoPolicyMutation(value, id) {
  for (const field of [
    'mechanicsChanged',
    'productionMechanicsChanged',
    'productionSourceModified',
    'toleranceChanged',
    'comparisonPolicyChanged',
    'acceptanceCriteriaChanged',
  ]) {
    if (value[field] === true) throw new TypeError(`${id} unexpectedly declares ${field}=true.`);
  }
  if (value.summary?.mechanicsChanged === true
      || value.summary?.toleranceChanged === true
      || value.summary?.comparisonPolicyChanged === true) {
    throw new TypeError(`${id} summary declares a forbidden mechanics/tolerance/comparison mutation.`);
  }
}

function artifactMetadata(id, path, value) {
  const bytes = readFileSync(path);
  return Object.freeze({
    id,
    path: relative(resolve('.'), path),
    byteLength: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    schema: value.schema,
    semanticHash: value.semanticHash ?? value.recordSemanticHash ?? null,
    sourceAccdbSha256: value.sourceAccdbSha256,
    caseId: value.caseId ?? value.frictionCaseId ?? null,
  });
}

function requirePinnedAccdb(path) {
  const bytes = readFileSync(path);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (bytes.byteLength !== PINNED_ACCDB_BYTES || sha256 !== PINNED_ACCDB_SHA256) {
    throw new TypeError(
      `BM4_L ACCDB custody mismatch: ${bytes.byteLength} bytes, ${sha256}; expected ${PINNED_ACCDB_BYTES} and ${PINNED_ACCDB_SHA256}.`,
    );
  }
}

function requireBaseline(path) {
  const value = readJson(path);
  if (value?.schema !== 'm047-bm4l-stage2-friction-tuning-iteration/v1'
      || value.caseId !== CASE_ID
      || value.converged !== true
      || value.sourceAccdbSha256 !== PINNED_ACCDB_SHA256) {
    throw new TypeError('Batch baseline must be the converged pinned real-ACCDB L13 tuning artifact.');
  }
  return value;
}

function requireReportsSubdirectory(value) {
  const reportsRoot = resolve('reports');
  const root = resolve(value);
  const rel = relative(reportsRoot, root);
  if (rel === '' || rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(rel)) {
    throw new TypeError('RCA batch output root must be a subdirectory of reports/.');
  }
  return root;
}

function outputPaths(root) {
  return Object.freeze({
    r1: join(root, 'r1-reference-resolution.json'),
    r6: join(root, 'r6-restraint-sentinels.json'),
    r5: join(root, 'r5-friction-geometry.json'),
    directionRca: join(root, 'direction-law-rca.json'),
    directionExperiment: join(root, 'direction-only-L13.json'),
    r2Experiment: join(root, 'r2-deleted-spring-L13.json'),
    r2Mobilisation: join(root, 'r2-mobilisation.json'),
    r3: join(root, 'r3-capacity.json'),
    decision: join(root, 'rca-decision.json'),
    manifest: join(root, 'manifest.json'),
  });
}

function prepareOutputs(outputs, overwrite) {
  const existing = Object.values(outputs).filter((path) => existsSync(path));
  if (existing.length > 0 && !overwrite) {
    throw new TypeError(
      `RCA batch refuses stale/previous output. Re-run with --overwrite only after reviewing: ${existing.join(', ')}`,
    );
  }
  if (overwrite) {
    for (const path of existing) unlinkSync(path);
  }
}

function writeManifest(input) {
  const baselineBytes = readFileSync(input.baselinePath);
  const base = {
    schema: 'm047-bm4l-stage2-rca-evidence-batch/v1',
    status: input.status,
    startedAtUtc: input.startedAtUtc,
    finishedAtUtc: new Date().toISOString(),
    exactHeadAtStart: input.initialHead || null,
    worktreeCleanAtStart: input.initialWorktreeClean,
    nodeVersion: process.versions.node,
    platform: process.platform,
    caseId: CASE_ID,
    sourceAccdbSha256: PINNED_ACCDB_SHA256,
    sourceAccdbByteLength: statSync(input.accdbPath).size,
    accdbPath: relative(resolve('.'), input.accdbPath),
    baseline: {
      path: relative(resolve('.'), input.baselinePath),
      fileSha256: createHash('sha256').update(baselineBytes).digest('hex'),
      iterationSemanticHash: input.baseline.iterationSemanticHash ?? null,
      converged: input.baseline.converged,
    },
    outRoot: relative(resolve('.'), input.outRoot),
    r2StateStableSnapshotAvailable: input.r2StateStable,
    expectedEvidenceOrder: evidenceStepOrder(input.r2StateStable !== false),
    steps: input.steps,
    artifacts: input.artifacts,
    error: input.error,
    productionMechanicsChanged: false,
    toleranceChanged: false,
    comparisonPolicyChanged: false,
  };
  const manifest = Object.freeze({ ...base, semanticHash: semanticHash(base) });
  mkdirSync(dirname(input.manifestPath), { recursive: true });
  writeFileSync(input.manifestPath, `${canonicalPrettyStringify(manifest)}\n`, 'utf8');
  return manifest;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function tail(value, limit = 4000) {
  const text = String(value ?? '').trim();
  return text.length <= limit ? text : text.slice(text.length - limit);
}

function gitText(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  return result.status === 0 ? String(result.stdout ?? '').trim() : '';
}

function parseArgs(argv) {
  const parsed = { overwrite: false };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--overwrite') {
      parsed.overwrite = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined) throw new TypeError(`Missing value for ${key}.`);
    if (key === '--accdb') parsed.accdbPath = value;
    else if (key === '--baseline') parsed.baselinePath = value;
    else if (key === '--out-root') parsed.outRoot = value;
    else throw new TypeError(`Unknown RCA batch argument ${key}.`);
    index += 1;
  }
  return parsed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const record = await runStage2RcaEvidenceBatch(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${canonicalPrettyStringify({
    status: record.status,
    caseId: record.caseId,
    sourceAccdbSha256: record.sourceAccdbSha256,
    artifactCount: record.artifacts.length,
    r2StateStableSnapshotAvailable: record.r2StateStableSnapshotAvailable,
    manifestSemanticHash: record.semanticHash,
  })}\n`);
}
