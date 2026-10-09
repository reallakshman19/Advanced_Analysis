#!/usr/bin/env node
/**
 * Evidence/custody finalizer for the project-declared D1 physical-load-path run.
 *
 * This verifier does not solve. It binds a generated experiment artifact to the
 * accepted real D1 + measured next-accuracy evidence and fingerprints both the
 * untouched production solver and the exact ephemeral candidate source that the
 * experiment builder would create in this checkout.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { buildD1LoadPathCandidateSource } from './lfea-m047-stage2-d1-load-path-experiment.mjs';
import { validateAcceptedRealD1Evidence } from './lfea-m047-stage2-real-d1-evidence-intake.mjs';
import { validateNextAccuracyBatchEvidence } from './lfea-m047-stage2-next-accuracy-evidence-intake.mjs';

const SOLVER_PATH = 'src/core/fea-benchmarks/caesar-accdb-friction-solve.js';
const EXPECTED_RUNS = Object.freeze([
  Object.freeze({ runId: 'D1-L13-PATH-N1', fractions: Object.freeze([1]) }),
  Object.freeze({ runId: 'D1-L13-PATH-N5', fractions: Object.freeze([0.2, 0.4, 0.6, 0.8, 1]) }),
  Object.freeze({ runId: 'D1-L13-PATH-N10', fractions: Object.freeze([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) }),
]);

export function finalizeD1LoadPathEvidence({ experiment, d1Evidence, nextAccuracyEvidence, solverPath = SOLVER_PATH }) {
  const d1Intake = validateAcceptedRealD1Evidence(d1Evidence);
  const nextIntake = validateNextAccuracyBatchEvidence(nextAccuracyEvidence);
  assert.equal(d1Intake.sourceAccdbSha256, nextIntake.sourceAccdbSha256,
    'D1 and next-accuracy evidence source custody mismatch');
  requireExperiment(experiment, d1Intake, nextIntake);

  const productionPath = resolve(solverPath);
  const productionSource = readFileSync(productionPath, 'utf8');
  const candidateSource = buildD1LoadPathCandidateSource(productionSource, productionPath);
  const sourceFingerprints = {
    productionSolverPath: normalizePath(productionPath),
    productionSolverSha256: sha256(Buffer.from(productionSource, 'utf8')),
    ephemeralCandidateSha256: sha256(Buffer.from(candidateSource, 'utf8')),
    productionSourceModifiedByExperiment: false,
  };

  const runLedger = EXPECTED_RUNS.map((expected) => {
    const run = experiment.runs.find((entry) => entry.runId === expected.runId);
    assert.ok(run, `experiment is missing ${expected.runId}`);
    assert.deepEqual(run.fractions, expected.fractions, `${expected.runId} fractions changed`);
    assert.equal(run.incrementCount, expected.fractions.length, `${expected.runId} increment count changed`);
    if (run.converged) {
      assert.equal(run.deterministic, true, `${expected.runId} converged but is not deterministic`);
      assert.deepEqual(run.loadPathEvidence?.fractions, expected.fractions,
        `${expected.runId} internal continuation fractions disagree with outer ledger`);
      assert.equal(run.loadPathEvidence?.substepCount, expected.fractions.length,
        `${expected.runId} substep count changed`);
      assert.equal(run.loadPathEvidence?.adaptiveRetryAllowed, false,
        `${expected.runId} used an adaptive retry`);
      assert.equal(run.loadPathEvidence?.substeps?.at(-1)?.physicalLoadFraction, 1,
        `${expected.runId} did not terminate at lambda=1`);
      assert.equal(run.loadPathEvidence?.substeps?.at(-1)?.recoveredEquilibriumStatus, 'PASS',
        `${expected.runId} final full-load recovered equilibrium failed`);
      assert.equal(run.summary?.normalWithinGoal, 23,
        `${expected.runId} traded away the 23/23 normal-force gate`);
    }
    return Object.freeze({
      runId: run.runId,
      fractions: [...run.fractions],
      converged: run.converged,
      deterministic: run.deterministic,
      finalRowsSemanticHash: run.finalRowsSemanticHash ?? null,
      totalIterationCount: run.totalIterationCount ?? null,
      finalVectorWithinGoal: run.summary?.tangentialVectorsWithinGoal ?? null,
      finalAboveR1VectorWithinGoal: run.summary?.aboveR1VectorsWithinGoal ?? null,
      finalNormalWithinGoal: run.summary?.normalWithinGoal ?? null,
      finalConstitutiveStateMatches: run.summary?.constitutiveStateMatches ?? null,
    });
  });

  const interpreted = interpretDecision(experiment, d1Evidence);
  const base = {
    schema: 'm047-bm4l-stage2-d1-load-path-finalization/v1',
    status: interpreted.status,
    caseId: 'L13',
    sourceAccdbSha256: nextIntake.sourceAccdbSha256,
    sourceExperimentSemanticHash: experiment.semanticHash,
    acceptedD1EvidenceSemanticHash: d1Intake.semanticHash,
    nextAccuracyEvidenceSemanticHash: nextIntake.semanticHash,
    authority: {
      kind: 'PROJECT_DECLARED_NUMERICAL_CONTINUATION_RCA',
      caesarInternalLoadSteppingClaimed: false,
      intermediateSubstepAccuracyUse:
        'GLOBAL_EQUILIBRIUM_AND_FRICTION_STATE_CONTINUATION_ONLY_NOT_CAESAR_ROW_ACCURACY',
      caesarAccuracyComparisonScope: 'FINAL_LAMBDA_1_ROWS_ONLY',
    },
    sourceFingerprints,
    runLedger,
    n1Reproduction: experiment.n1Reproduction,
    refinement: experiment.refinement,
    experimentDecision: experiment.decision,
    finalEngineeringDisposition: interpreted,
    retainedSeparateSignals: nextIntake.retainedSeparateSignals,
    productionMechanicsPromotionAuthorized: false,
    automaticProductionMechanicsMutationAllowed: false,
    l7LoadSteppingAllowed: false,
    bm4nlAllowed: false,
    mechanicsChanged: false,
    toleranceChanged: false,
    comparisonPolicyChanged: false,
  };
  return Object.freeze({ ...base, semanticHash: semanticHash(base) });
}

function requireExperiment(experiment, d1Intake, nextIntake) {
  assert.equal(experiment?.schema, 'm047-bm4l-stage2-d1-load-path-experiment/v1',
    'unsupported load-path experiment schema');
  assert.equal(experiment.caseId, 'L13');
  assert.equal(experiment.sourceAccdbSha256, nextIntake.sourceAccdbSha256,
    'load-path experiment ACCDB custody mismatch');
  assert.equal(experiment.acceptedD1EvidenceSemanticHash, d1Intake.semanticHash,
    'load-path experiment is not bound to this accepted D1 evidence');
  assert.equal(experiment.nextAccuracyEvidenceSemanticHash, nextIntake.semanticHash,
    'load-path experiment is not bound to this next-accuracy evidence');
  assert.equal(experiment.authority, 'PROJECT_DECLARED_NUMERICAL_CONTINUATION_NOT_CAESAR_INTERNAL_LOAD_STEPPING');
  assert.equal(experiment.isolatedMechanic, 'PHYSICAL_LOAD_PATH_CONTINUATION_FROM_ZERO_TO_FULL_L13');
  assert.equal(experiment.fullLoadStiffnessFrozen, true);
  assert.deepEqual(experiment.scaledPhysicalTerms, ['W', 'P1']);
  assert.equal(experiment.frictionStateLoadsScaledByPhysicalFraction, false);
  assert.equal(experiment.productionSourceModified, false);
  assert.equal(experiment.automaticProductionMechanicsMutationAllowed, false);
  assert.equal(experiment.toleranceChanged, false);
  assert.equal(experiment.comparisonPolicyChanged, false);
  assert.equal(experiment.l7LoadSteppingAllowed, false);
  assert.equal(experiment.bm4nlAllowed, false);
  assert.ok(Array.isArray(experiment.runs) && experiment.runs.length === 3,
    'load-path experiment must contain exactly N1/N5/N10');
  verifySemanticHash(experiment, 'load-path experiment');
}

function interpretDecision(experiment, d1Evidence) {
  const status = experiment.decision?.status;
  const allowed = new Set([
    'HALT_IMPLEMENTATION_DRIFT_N1_DOES_NOT_REPRODUCE_D1',
    'REJECT_OR_INCONCLUSIVE_PHYSICAL_CONTINUATION_NONCONVERGED_OR_NONDETERMINISTIC',
    'INCONCLUSIVE_PHYSICAL_CONTINUATION_NOT_N5_N10_REFINEMENT_STABLE',
    'EVIDENCE_SUPPORTS_D1_PHYSICAL_LOAD_PATH_CONTINUATION_AS_NEXT_EXPERIMENTAL_BASELINE',
    'REJECT_PHYSICAL_LOAD_PATH_CONTINUATION_KEEP_D1_EXPERIMENTAL_BASELINE',
  ]);
  assert.ok(allowed.has(status), `unsupported load-path experiment decision ${String(status)}`);

  if (status === 'EVIDENCE_SUPPORTS_D1_PHYSICAL_LOAD_PATH_CONTINUATION_AS_NEXT_EXPERIMENTAL_BASELINE') {
    assert.equal(experiment.n1Reproduction?.status, 'PASS', 'continuation support requires N1 D1 reproduction');
    assert.equal(experiment.refinement?.status, 'PASS', 'continuation support requires N5/N10 refinement stability');
    const n10 = experiment.runs.find((run) => run.runId === 'D1-L13-PATH-N10');
    assert.equal(n10?.converged, true);
    assert.equal(n10?.deterministic, true);
    assert.equal(n10?.summary?.normalWithinGoal, 23);
    assert.ok(n10.summary.tangentialVectorsWithinGoal > d1Evidence.d1.summary.tangentialVectorsWithinGoal,
      'supported continuation does not improve total vector pass count over D1');
    assert.ok(n10.summary.aboveR1VectorsWithinGoal
      > d1Evidence.d1.aboveProvisionalR1Floor.vectorsWithin10Pct,
    'supported continuation does not improve above-R1 vector pass count over D1');
    return Object.freeze({
      status: 'PASS_FOR_EXPERIMENTAL_BASELINE_REVIEW_NOT_PRODUCTION_PROMOTION',
      retainedBaselineIfAccepted: 'D1_PLUS_PROJECT_PHYSICAL_LOAD_PATH_CONTINUATION',
      nextWorkPackage: 'REVIEW_REMAINING_L13_RESIDUAL_AND_SEPARATE_20710_CAPACITY_PATH_SIGNAL',
    });
  }

  return Object.freeze({
    status: 'NO_CONTINUATION_PROMOTION_KEEP_D1_EXPERIMENTAL_BASELINE',
    retainedBaselineIfAccepted: 'D1_TOTAL_RELATIVE_TANGENTIAL_DISPLACEMENT_DIRECTION',
    nextWorkPackage: status,
  });
}

function verifySemanticHash(record, label) {
  assert.match(String(record.semanticHash ?? ''), /^fnv1a64:[a-f0-9]{16}$/u,
    `${label} semantic hash missing or invalid`);
  const copy = { ...record };
  delete copy.semanticHash;
  assert.equal(record.semanticHash, semanticHash(copy), `${label} semantic hash mismatch`);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function normalizePath(path) {
  return String(path).replaceAll('\\', '/');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 2) args.set(argv[index], argv[index + 1]);
  const experimentPath = args.get('--experiment');
  const d1Path = args.get('--d1-evidence');
  const nextPath = args.get('--next-accuracy-evidence');
  if (!experimentPath || !d1Path || !nextPath) {
    throw new TypeError(
      'Usage: --experiment <load-path.json> --d1-evidence <real-d1-evidence.json> '
      + '--next-accuracy-evidence <next-accuracy-evidence.json> [--out <json>]',
    );
  }
  const record = finalizeD1LoadPathEvidence({
    experiment: JSON.parse(readFileSync(resolve(experimentPath), 'utf8')),
    d1Evidence: JSON.parse(readFileSync(resolve(d1Path), 'utf8')),
    nextAccuracyEvidence: JSON.parse(readFileSync(resolve(nextPath), 'utf8')),
    solverPath: args.get('--solver') ?? SOLVER_PATH,
  });
  const outPath = args.get('--out');
  if (outPath) {
    mkdirSync(dirname(resolve(outPath)), { recursive: true });
    writeFileSync(resolve(outPath), `${canonicalPrettyStringify(record)}\n`, 'utf8');
  }
  process.stdout.write(`${canonicalPrettyStringify(record)}\n`);
}
