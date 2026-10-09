#!/usr/bin/env node
/**
 * Governed R8/NFV15 candidate-measurement dispatcher.
 *
 * Order is fixed: L13 -> L7 -> algebraic L15. Each primitive is assessed
 * immediately against its frozen production-R2 baseline and the dispatcher stops
 * on the first failed/non-nominated gate. L1 is intentionally not run here while
 * the separate hydrotest-WW load-basis RCA remains unresolved.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { runR8Nfv15Experiment } from './lfea-m047-stage2-r8-nfv15-experiment.mjs';
import { assessR8Nfv15 } from './lfea-m047-stage2-r8-nfv15-assess.mjs';
import { reconstructR8L15 } from './lfea-m047-stage2-r8-nfv15-l15.mjs';
import { decideR8Nfv15Sequence } from './lfea-m047-stage2-r8-nfv15-sequence.mjs';

const DEFAULT_OUT = 'reports/lfea-m047-stage2-r8-nfv15-measurement';
const DEFAULT_BASELINE_ROOT = 'reports/lfea-m047-stage2-r2-rebaseline';
const EXPECTED_SHA = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const COMPLETE_DECISION = 'R8_CANDIDATE_MEASURED_THROUGH_L13_L7_L15;_L1_INTENTIONALLY_BLOCKED';

export async function runR8Nfv15Measurement(input) {
  if (!input?.zipPath || !input?.accdbPath) throw new TypeError('R8 measurement requires zipPath and accdbPath.');
  const root = resolve(input.outRoot ?? DEFAULT_OUT);
  const baselineRoot = resolve(input.baselineRoot ?? DEFAULT_BASELINE_ROOT);
  const repeatRuns = Number(input.repeatRuns ?? 1);
  if (!Number.isInteger(repeatRuns) || repeatRuns < 1) throw new TypeError('repeatRuns must be a positive integer.');
  mkdirSync(root, { recursive: true });

  const l13 = await runPrimitive({ caseId: 'L13', root, baselineRoot, repeatRuns, input });
  const afterL13 = decideR8Nfv15Sequence({ l13Assessment: l13.assessment });
  if (afterL13.decision !== 'RUN_R8_L7') {
    return finish(root, {
      stage: 'L13',
      sourceAccdbSha256: EXPECTED_SHA,
      l13: receiptCase(l13),
      l7: null,
      l15: null,
      decision: afterL13.decision,
      nextAction: afterL13.nextAction,
    });
  }

  const l7 = await runPrimitive({ caseId: 'L7', root, baselineRoot, repeatRuns, input });
  const afterL7 = decideR8Nfv15Sequence({
    l13Assessment: l13.assessment,
    l7Assessment: l7.assessment,
  });
  if (afterL7.decision !== 'RECONSTRUCT_R8_L15') {
    return finish(root, {
      stage: 'L7',
      sourceAccdbSha256: EXPECTED_SHA,
      l13: receiptCase(l13),
      l7: receiptCase(l7),
      l15: null,
      decision: afterL7.decision,
      nextAction: afterL7.nextAction,
    });
  }

  const l15Path = join(root, 'L15.json');
  const l15 = await reconstructR8L15({
    l13Path: l13.experimentPath,
    l7Path: l7.experimentPath,
    zipPath: input.zipPath,
    accdbPath: input.accdbPath,
    profilePath: input.profilePath,
  });
  write(l15Path, l15);
  const afterL15 = decideR8Nfv15Sequence({
    l13Assessment: l13.assessment,
    l7Assessment: l7.assessment,
    l15,
  });
  if (afterL15.decision !== COMPLETE_DECISION) {
    return finish(root, {
      stage: 'L15',
      sourceAccdbSha256: EXPECTED_SHA,
      l13: receiptCase(l13),
      l7: receiptCase(l7),
      l15: receiptL15(l15, l15Path),
      decision: afterL15.decision,
      nextAction: afterL15.nextAction,
    });
  }

  return finish(root, {
    stage: 'L15',
    sourceAccdbSha256: EXPECTED_SHA,
    l13: receiptCase(l13),
    l7: receiptCase(l7),
    l15: receiptL15(l15, l15Path),
    decision: afterL15.decision,
    nextAction: afterL15.nextAction,
  });
}

async function runPrimitive({ caseId, root, baselineRoot, repeatRuns, input }) {
  const experimentPath = join(root, `${caseId}.json`);
  const assessmentPath = join(root, `${caseId}-assessment.json`);
  const experiment = await runR8Nfv15Experiment({
    zipPath: input.zipPath,
    accdbPath: input.accdbPath,
    caseId,
    repeatRuns,
    profilePath: input.profilePath,
  });
  write(experimentPath, experiment);
  const baselinePath = join(baselineRoot, `${caseId}.json`);
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const assessment = assessR8Nfv15({ baseline, experiment });
  write(assessmentPath, assessment);
  return { caseId, experiment, experimentPath, assessment, assessmentPath, baselinePath };
}

function receiptCase(value) {
  const run = value.experiment.runs?.[0] ?? null;
  return {
    experimentPath: value.experimentPath,
    experimentSemanticHash: value.experiment.experimentSemanticHash ?? semanticHash(value.experiment),
    assessmentPath: value.assessmentPath,
    assessmentSemanticHash: semanticHash(value.assessment),
    baselinePath: value.baselinePath,
    converged: run?.converged === true,
    equilibriumStatus: run?.recoveredEquilibriumStatus ?? null,
    nonlinearGateStatus: run?.convergenceGates?.status ?? null,
    nomination: value.assessment.nomination,
    accuracy: run?.accuracy ?? null,
  };
}

function receiptL15(value, path) {
  return {
    artifactPath: path,
    reconstructionSemanticHash: value.reconstructionSemanticHash ?? semanticHash(value),
    identityStatus: value.identity?.status ?? null,
    independentNonlinearSolve: value.independentNonlinearSolve,
    accuracy: value.accuracy,
  };
}

function finish(root, fields) {
  const base = {
    schema: 'm047-stage2-r8-nfv15-measurement-receipt/v2',
    measurementBoundary: 'CUSTODY_VERIFIED_REAL_ACCDB_R8_CANDIDATE_SEQUENCE',
    ...fields,
    l1Run: false,
    l1BlockReason: 'SEPARATE_L1_HYDROTEST_WW_LINEAR_BASIS_RCA_IS_NOT_YET_QUALIFIED',
    frictionAngleVariationRun: false,
    productionMechanicsChanged: false,
    productionPromotionAuthorized: false,
  };
  const receipt = Object.freeze({ ...base, receiptSemanticHash: semanticHash(base) });
  write(join(root, 'receipt.json'), receipt);
  return receipt;
}

function write(path, value) {
  writeFileSync(path, `${canonicalPrettyStringify(value)}\n`, 'utf8');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
  if (!args.get('--zip') || !args.get('--accdb')) {
    throw new Error('Usage: --zip <BM4_L.zip> --accdb <BM4_L.ACCDB> [--out dir] [--baseline-root dir] [--repeat 1]');
  }
  const receipt = await runR8Nfv15Measurement({
    zipPath: args.get('--zip'),
    accdbPath: args.get('--accdb'),
    outRoot: args.get('--out') ?? DEFAULT_OUT,
    baselineRoot: args.get('--baseline-root') ?? DEFAULT_BASELINE_ROOT,
    repeatRuns: args.has('--repeat') ? Number(args.get('--repeat')) : 1,
    profilePath: args.get('--profile'),
  });
  process.stdout.write(`${canonicalPrettyStringify(receipt)}\n`);
}
