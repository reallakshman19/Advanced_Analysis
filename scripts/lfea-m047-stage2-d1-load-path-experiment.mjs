#!/usr/bin/env node
/**
 * M047 Stage 2 D1 physical-load-path continuation experiment.
 *
 * This is a PROJECT-DECLARED numerical continuation experiment. CAESAR II is not
 * claimed to perform load stepping. The experiment asks whether the accepted D1
 * full-load equilibrium branch changes when the same final L13 equation is
 * approached through fixed load fractions.
 *
 * One mechanic only relative to accepted D1:
 *   scale the assembled L13 physical RHS (W + P1 element equivalent/initial-
 *   strain loads) by lambda and carry converged friction state/slip to the next
 *   fraction. The full L13 stiffness state is frozen; friction offset loads are
 *   not multiplied by lambda.
 *
 * N=1 must reproduce D1. N=5 and N=10 are both measured. No adaptive retry,
 * tolerance change or increment-count selection from CAESAR error is permitted.
 * Production source is never edited.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { buildCaesarAccdbBenchmarkPackage, requiredCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-package.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';
import { buildCandidateSource as buildD1CandidateSource } from './lfea-m047-stage2-direction-only-experiment.mjs';
import { validateAcceptedRealD1Evidence } from './lfea-m047-stage2-real-d1-evidence-intake.mjs';
import { validateNextAccuracyBatchEvidence } from './lfea-m047-stage2-next-accuracy-evidence-intake.mjs';

const PROFILE_PATH = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const SOLVER_PATH = 'src/core/fea-benchmarks/caesar-accdb-friction-solve.js';
const CASE_ID = 'L13';
const GOAL_PERCENT = 10;
const PATH_PROFILE_ID = 'CAESAR-ACCDB-FRICTION-SOLVER-R1-D1-PROJECT-LOAD-PATH-CONTINUATION';
const PATH_RULE = 'PROJECT_DECLARED_SCALE_PHYSICAL_ELEMENT_RHS_WITH_FULL_L13_STIFFNESS_FROZEN_V1';
const RUNS = Object.freeze([
  Object.freeze({ runId: 'D1-L13-PATH-N1', fractions: Object.freeze([1]) }),
  Object.freeze({ runId: 'D1-L13-PATH-N5', fractions: Object.freeze([0.2, 0.4, 0.6, 0.8, 1]) }),
  Object.freeze({ runId: 'D1-L13-PATH-N10', fractions: Object.freeze([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) }),
]);

export function buildD1LoadPathCandidateSource(productionSource, solverPath = resolve(SOLVER_PATH)) {
  let source = buildD1CandidateSource(productionSource, solverPath);
  source = replaceExactly(source,
    "  profileId: 'CAESAR-ACCDB-FRICTION-SOLVER-R1',",
    `  profileId: '${PATH_PROFILE_ID}',`,
    'solver profile id');
  source = replaceExactly(source,
    "  loadStepping: 'NONE_SINGLE_STEP_V1',",
    `  loadStepping: '${PATH_RULE}',`,
    'solver load-stepping declaration');
  source = replaceExactly(source,
`      : solvePrimitiveCase({
        benchmarkPackage, caseRecord, solveProfile, frictionAuthority, profile, stiffnessScale,
      });`,
`      : solvePrimitiveCase({
        benchmarkPackage, caseRecord, solveProfile, frictionAuthority, profile, stiffnessScale,
        loadPathFractions: options.loadPathFractions ?? [1],
      });`,
    'primitive solve call');

  const startMarker = 'function solvePrimitiveCase(input) {';
  const endMarker = 'function buildPrimitiveResult(input) {';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || source.indexOf(startMarker, start + 1) >= 0) {
    throw new TypeError('Load-path source guard could not uniquely isolate solvePrimitiveCase.');
  }
  const replacement = `${loadPathSolvePrimitiveSource()}\n\n`;
  source = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
  return source;
}

function loadPathSolvePrimitiveSource() {
  return String.raw`function solvePrimitiveCase(input) {
  const {
    benchmarkPackage, caseRecord, solveProfile, frictionAuthority, profile, stiffnessScale,
  } = input;
  const fractions = normalizeProjectLoadPathFractions(input.loadPathFractions ?? [1]);
  const plan = buildFrictionRestraintPlan({ benchmarkPackage, frictionAuthority, profile, stiffnessScale });
  const prepared = prepareCaesarAccdbCaseState({
    benchmarkPackage,
    caseRecord,
    solveProfile,
    gate: CAESAR_ACCDB_CASE_GATES.NONLINEAR_EFFECTIVE_FRICTION,
    frictionDofKeys: plan.frictionDofKeys,
  });
  let states = new Map(plan.supports.map((support) => [support.restraintId, 'STICK']));
  let slips = new Map(plan.supports.map((support) => [support.restraintId, support.frictionDofs.map(() => 0)]));
  const substeps = [];
  let finalContext = null;
  let totalIterationCount = 0;

  for (let stepIndex = 0; stepIndex < fractions.length; stepIndex += 1) {
    const physicalLoadFraction = fractions[stepIndex];
    const stepPrepared = scalePreparedPhysicalRhs(prepared, physicalLoadFraction);
    const acceleration = createSlipAccelerator(profile);
    const iterations = [];
    let previous = null;
    let converged = false;

    for (let iteration = 1; iteration <= profile.maximumIterations; iteration += 1) {
      totalIterationCount += 1;
      const overlay = buildOverlay({ plan, slips, caseRecord, iteration, benchmarkPackage });
      const executed = executeCaesarAccdbCaseState({ prepared: stepPrepared, overlay });
      const measured = measureSupports({ plan, executed, states, slips, overlay, profile });
      const nextStates = new Map(measured.map((entry) => [entry.restraintId, entry.nextState]));
      const mappedSlips = new Map(measured.map((entry) => [entry.restraintId, entry.nextSlip]));
      const stateChangedThisIteration = measured.some((entry) => entry.state !== entry.nextState);
      const accelerated = acceleration.next({
        order: plan.supports.map((support) => support.restraintId),
        current: slips,
        mapped: mappedSlips,
        stateChanged: stateChangedThisIteration,
      });
      const nextSlips = accelerated.slips;
      const stateChanges = measured
        .filter((entry) => entry.state !== entry.nextState)
        .map((entry) => ({
          restraintId: entry.restraintId,
          nodeId: entry.nodeId,
          from: entry.state,
          to: entry.nextState,
        }));
      const updates = updateNorms(previous, executed, measured);
      const gates = evaluateConvergenceGates({ measured, stateChanges, updates, executed, profile, iteration });
      iterations.push(Object.freeze({
        iteration,
        physicalLoadFraction,
        gateStatus: gates.status,
        failedGates: deepFreeze([...gates.failedGates]),
        failedGateEvidence: deepFreeze(gates.gates
          .filter((entry) => entry.status !== 'PASS')
          .map((entry) => ({ gate: entry.gate, evidence: entry.evidence }))),
        overlay: executed.overlay.evidence,
        stateChangeCount: stateChanges.length,
        stateChanges: deepFreeze(stateChanges),
        displacementUpdateNormM: updates.displacementUpdateNormM,
        reactionUpdateNormN: updates.reactionUpdateNormN,
        displacementScaleM: updates.displacementScaleM,
        reactionScaleN: updates.reactionScaleN,
        slipResidualNormM: accelerated.residualNormM,
        accelerationApplied: accelerated.applied,
        accelerationFactor: accelerated.factor,
        executionStatus: executed.execution.status,
        executionSemanticHash: executed.execution.semanticHash,
        recoveredEquilibriumStatus: executed.recoveredEquilibrium.status,
        supports: deepFreeze(measured.map((entry) => entry.ledger)),
      }));

      if (gates.status === 'CONVERGED') {
        const stepRecord = deepFreeze({
          stepIndex: stepIndex + 1,
          physicalLoadFraction,
          iterationCount: iterations.length,
          recoveredEquilibriumStatus: executed.recoveredEquilibrium.status,
          executionSemanticHash: executed.execution.semanticHash,
          finalStateCounts: {
            sliding: measured.filter((entry) => entry.regime === 'SLIDING').length,
            lockedAfterSlip: measured.filter((entry) => entry.regime === 'LOCKED_AFTER_SLIP').length,
            stuck: measured.filter((entry) => entry.regime === 'STUCK').length,
          },
          finalSupportSemanticHash: semanticHash(measured.map((entry) => entry.ledger)),
          iterations: deepFreeze(iterations),
        });
        substeps.push(stepRecord);
        finalContext = { executed, measured, iterations, gates, states };
        converged = true;
        break;
      }

      previous = executed;
      states = nextStates;
      slips = nextSlips;
    }

    if (!converged) {
      const error = new Error(
        caseRecord.caseId + ' project load-path substep lambda=' + physicalLoadFraction + ' '
        + 'did not converge within ' + profile.maximumIterations + ' iterations.',
      );
      error.code = 'CAESAR_ACCDB_FRICTION_LOAD_PATH_SUBSTEP_NOT_CONVERGED';
      error.failedPhysicalLoadFraction = physicalLoadFraction;
      error.failedSubstepIndex = stepIndex + 1;
      error.completedSubsteps = substeps;
      error.iterations = iterations;
      throw error;
    }
    // The converged execution was formed from the current state/slip maps. Those
    // exact maps are carried to the next physical-load fraction. Accelerator and
    // update-norm history are deliberately reinitialized per substep.
  }

  const result = buildPrimitiveResult({
    caseRecord,
    frictionAuthority,
    plan,
    prepared,
    executed: finalContext.executed,
    measured: finalContext.measured,
    states: finalContext.states,
    iterations: finalContext.iterations,
    gates: finalContext.gates,
    profile,
  });
  return {
    ...result,
    evidence: deepFreeze({
      ...result.evidence,
      loadPathContinuation: {
        rule: '${PATH_RULE}',
        authority: 'PROJECT_DECLARED_NUMERICAL_CONTINUATION_NOT_CAESAR_INTERNAL_LOAD_STEPPING',
        fullLoadStiffnessFrozen: true,
        scaledQuantities: [
          'ELEMENT_EQUIVALENT_LOAD_GLOBAL',
          'ELEMENT_INITIAL_STRAIN_LOAD_GLOBAL',
        ],
        unscaledQuantities: [
          'GLOBAL_ELEMENT_STIFFNESS',
          'FRICTION_SPRING_STIFFNESS',
          'FRICTION_SLIP_OFFSET_LOADS',
        ],
        fractions: deepFreeze([...fractions]),
        substepCount: fractions.length,
        totalIterationCount,
        stateCarryRule: 'CARRY_CONVERGED_ACTIVE_STATE_AND_RETURN_MAPPED_SLIP_OFFSET',
        accelerationHistoryRule: 'RESET_COMPONENTWISE_SECANT_HISTORY_AT_EACH_SUBSTEP',
        adaptiveRetryAllowed: false,
        substeps: deepFreeze(substeps),
      },
    }),
  };
}

function normalizeProjectLoadPathFractions(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('Project load-path fractions must be a non-empty array.');
  }
  const fractions = value.map(Number);
  let previous = 0;
  for (const fraction of fractions) {
    if (!Number.isFinite(fraction) || !(fraction > previous) || fraction > 1) {
      throw new TypeError('Project load-path fractions must be finite, strictly increasing and in (0,1].');
    }
    previous = fraction;
  }
  if (fractions.at(-1) !== 1) {
    throw new TypeError('Project load-path continuation must terminate at full physical load lambda=1.');
  }
  return deepFreeze(fractions);
}

function scalePreparedPhysicalRhs(prepared, physicalLoadFraction) {
  if (physicalLoadFraction === 1) return prepared;
  const scaleContribution = (contribution) => ({
    ...contribution,
    equivalentLoadGlobal: contribution.equivalentLoadGlobal.map((value) => physicalLoadFraction * value),
    initialStrainLoadGlobal: contribution.initialStrainLoadGlobal.map((value) => physicalLoadFraction * value),
  });
  return {
    ...prepared,
    analysis: {
      ...prepared.analysis,
      elements: prepared.analysis.elements.map((entry) => ({
        ...entry,
        contribution: scaleContribution(entry.contribution),
      })),
    },
  };
}`;
}

export async function runD1LoadPathExperiment(input) {
  const d1EvidencePath = resolve(input.d1EvidencePath);
  const nextEvidencePath = resolve(input.nextAccuracyEvidencePath);
  const d1Evidence = JSON.parse(readFileSync(d1EvidencePath, 'utf8'));
  const nextEvidence = JSON.parse(readFileSync(nextEvidencePath, 'utf8'));
  const d1Intake = validateAcceptedRealD1Evidence(d1Evidence);
  const nextIntake = validateNextAccuracyBatchEvidence(nextEvidence);
  assert.equal(nextIntake.next.decision, 'D1_PHYSICAL_LOAD_PATH_CONTINUATION_EXPERIMENT_JUSTIFIED');
  assert.equal(d1Intake.sourceAccdbSha256, nextIntake.sourceAccdbSha256,
    'D1 and next-accuracy evidence do not bind the same ACCDB');

  const profilePath = resolve(input.profilePath ?? PROFILE_PATH);
  const solverPath = resolve(input.solverPath ?? SOLVER_PATH);
  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  const rawExport = await extractCaesarAccdbTables({
    accdbPath: input.accdbPath,
    tableNames: requiredCaesarAccdbTables(profile),
  });
  const benchmarkPackage = buildCaesarAccdbBenchmarkPackage({ rawExport, profile });
  assert.equal(benchmarkPackage.source.sha256, nextIntake.sourceAccdbSha256,
    'load-path experiment ACCDB custody mismatch');

  const candidateModule = await loadCandidateModule(solverPath);
  assert.equal(candidateModule.CAESAR_FRICTION_SOLVER_PROFILE.profileId, PATH_PROFILE_ID,
    'load-path transformed profile id mismatch');
  assert.equal(candidateModule.CAESAR_FRICTION_SOLVER_PROFILE.loadStepping, PATH_RULE,
    'load-path transformed solver did not publish project continuation rule');

  const runRecords = [];
  for (const run of RUNS) {
    const first = runCandidate(candidateModule, benchmarkPackage, run.fractions);
    const second = runCandidate(candidateModule, benchmarkPackage, run.fractions);
    runRecords.push(buildRunRecord({
      run,
      first,
      second,
      d1Evidence,
      profile: candidateModule.CAESAR_FRICTION_SOLVER_PROFILE,
    }));
  }

  const n1 = runRecords.find((run) => run.runId === 'D1-L13-PATH-N1');
  const n5 = runRecords.find((run) => run.runId === 'D1-L13-PATH-N5');
  const n10 = runRecords.find((run) => run.runId === 'D1-L13-PATH-N10');
  const n1Reproduction = evaluateN1Reproduction(n1, d1Evidence, nextIntake);
  const refinement = evaluateRefinement(n5, n10, candidateModule.CAESAR_FRICTION_SOLVER_PROFILE);
  const decision = decide({ n1, n5, n10, n1Reproduction, refinement, d1Evidence });

  const base = {
    schema: 'm047-bm4l-stage2-d1-load-path-experiment/v1',
    caseId: CASE_ID,
    sourceAccdbSha256: benchmarkPackage.source.sha256,
    acceptedD1EvidenceArtifact: basename(d1EvidencePath),
    acceptedD1EvidenceSemanticHash: d1Intake.semanticHash,
    nextAccuracyEvidenceArtifact: basename(nextEvidencePath),
    nextAccuracyEvidenceSemanticHash: nextIntake.semanticHash,
    authority: 'PROJECT_DECLARED_NUMERICAL_CONTINUATION_NOT_CAESAR_INTERNAL_LOAD_STEPPING',
    isolatedMechanic: 'PHYSICAL_LOAD_PATH_CONTINUATION_FROM_ZERO_TO_FULL_L13',
    physicalLoadContinuationRule: PATH_RULE,
    fullLoadStiffnessFrozen: true,
    scaledPhysicalTerms: ['W', 'P1'],
    frictionStateLoadsScaledByPhysicalFraction: false,
    runs: runRecords,
    n1Reproduction,
    refinement,
    decision,
    retainedSeparateSignals: nextIntake.retainedSeparateSignals,
    automaticProductionMechanicsMutationAllowed: false,
    productionSourceModified: false,
    toleranceChanged: false,
    comparisonPolicyChanged: false,
    l7LoadSteppingAllowed: false,
    bm4nlAllowed: false,
  };
  return Object.freeze({ ...base, semanticHash: semanticHash(base) });
}

function runCandidate(candidateModule, benchmarkPackage, fractions) {
  try {
    return {
      actual: candidateModule.solveCaesarAccdbFrictionBenchmark(benchmarkPackage, [CASE_ID], {
        profile: candidateModule.CAESAR_FRICTION_SOLVER_PROFILE,
        loadPathFractions: [...fractions],
      }),
      error: null,
    };
  } catch (error) {
    return {
      actual: null,
      error: {
        message: error.message,
        code: error.code ?? null,
        failedPhysicalLoadFraction: error.failedPhysicalLoadFraction ?? null,
        failedSubstepIndex: error.failedSubstepIndex ?? null,
        completedSubstepCount: error.completedSubsteps?.length ?? 0,
        iterationCount: error.iterations?.length ?? null,
        stateChangesTail: (error.iterations ?? []).slice(-8).map((entry) => entry.stateChangeCount),
        reactionUpdateTailN: (error.iterations ?? []).slice(-8).map((entry) => entry.reactionUpdateNormN),
        displacementUpdateTailM: (error.iterations ?? []).slice(-8).map((entry) => entry.displacementUpdateNormM),
        lastFailedGates: error.iterations?.at(-1)?.failedGates ?? null,
      },
    };
  }
}

function buildRunRecord({ run, first, second, d1Evidence, profile }) {
  if (first.error !== null || second.error !== null) {
    return Object.freeze({
      runId: run.runId,
      incrementCount: run.fractions.length,
      fractions: [...run.fractions],
      converged: false,
      firstFailure: first.error,
      repeatFailure: second.error,
      deterministic: null,
      summary: null,
      restraints: null,
      loadPathEvidence: null,
    });
  }
  const firstRowsHash = semanticHash(first.actual.cases[CASE_ID].rows);
  const secondRowsHash = semanticHash(second.actual.cases[CASE_ID].rows);
  const restraints = compareFinalState(first.actual, d1Evidence);
  const summary = summarizeRestraints(restraints);
  const path = first.actual.mechanics.cases[CASE_ID].loadPathContinuation;
  const repeatPath = second.actual.mechanics.cases[CASE_ID].loadPathContinuation;
  return Object.freeze({
    runId: run.runId,
    incrementCount: run.fractions.length,
    fractions: [...run.fractions],
    converged: true,
    deterministic: firstRowsHash === secondRowsHash
      && semanticHash(path.substeps.map(stepDeterminismProjection))
        === semanticHash(repeatPath.substeps.map(stepDeterminismProjection)),
    finalRowsSemanticHash: firstRowsHash,
    repeatRowsSemanticHash: secondRowsHash,
    finalIterationCount: first.actual.mechanics.cases[CASE_ID].iterationCount,
    totalIterationCount: path.totalIterationCount,
    summary,
    restraints,
    loadPathEvidence: {
      rule: path.rule,
      fractions: path.fractions,
      substepCount: path.substepCount,
      totalIterationCount: path.totalIterationCount,
      adaptiveRetryAllowed: path.adaptiveRetryAllowed,
      substeps: path.substeps.map((step) => ({
        stepIndex: step.stepIndex,
        physicalLoadFraction: step.physicalLoadFraction,
        iterationCount: step.iterationCount,
        recoveredEquilibriumStatus: step.recoveredEquilibriumStatus,
        finalStateCounts: step.finalStateCounts,
        finalSupportSemanticHash: step.finalSupportSemanticHash,
      })),
    },
    existingLimits: {
      reactionUpdateLimitN: profile.reactionUpdateLimitN,
      displacementUpdateLimitM: profile.displacementUpdateLimitM,
    },
  });
}

function stepDeterminismProjection(step) {
  return {
    stepIndex: step.stepIndex,
    physicalLoadFraction: step.physicalLoadFraction,
    iterationCount: step.iterationCount,
    recoveredEquilibriumStatus: step.recoveredEquilibriumStatus,
    finalStateCounts: step.finalStateCounts,
    finalSupportSemanticHash: step.finalSupportSemanticHash,
  };
}

function compareFinalState(actual, d1Evidence) {
  const solved = vectorsByNode(actual.cases[CASE_ID].rows);
  const supports = actual.mechanics.cases[CASE_ID].iterations.at(-1).supports;
  const d1ById = new Map(d1Evidence.d1.restraints.map((row) => [row.id, row]));
  return supports.map((support) => {
    const d1 = d1ById.get(support.restraintId);
    if (!d1) throw new TypeError(`Accepted D1 evidence is missing ${support.restraintId}.`);
    const vector = solved.get(String(support.nodeId)) ?? {};
    const solvedTangentialN = support.frictionDofs.map((dof) => Number(vector[dof] ?? 0));
    const referenceTangentialN = d1.ftRef.map(Number);
    const referenceMagnitudeN = norm(referenceTangentialN);
    const solvedMagnitudeN = norm(solvedTangentialN);
    const vectorErrorPct = referenceMagnitudeN === 0 ? null
      : 100 * norm(solvedTangentialN.map((value, index) => value - referenceTangentialN[index]))
        / referenceMagnitudeN;
    const normalErrorPct = d1.nRef === 0 ? null
      : 100 * (support.normalReactionMagnitudeN - d1.nRef) / Math.abs(d1.nRef);
    const normalizedState = normalizeState(support.regime);
    return Object.freeze({
      restraintId: support.restraintId,
      nodeId: support.nodeId,
      frictionDofs: [...support.frictionDofs],
      belowR1Floor: d1.belowR1Floor === true,
      referenceTangentialN,
      d1TangentialN: d1.ftSol.map(Number),
      solvedTangentialN,
      referenceMagnitudeN,
      solvedMagnitudeN,
      d1VectorErrorPct: Number(d1.vecErrPct),
      vectorErrorPct,
      normal: {
        referenceN: Number(d1.nRef),
        d1N: Number(d1.nSol),
        solvedN: support.normalReactionMagnitudeN,
        d1PercentError: Number(d1.nErrPct),
        percentError: normalErrorPct,
      },
      state: {
        reference: d1.refState,
        d1Raw: d1.solRaw,
        d1Normalized: d1.solState,
        solvedRaw: support.regime,
        solvedNormalized: normalizedState,
        d1Match: d1.refState === d1.solState,
        solvedMatch: d1.refState === normalizedState,
      },
    });
  }).sort((left, right) => compareText(left.restraintId, right.restraintId));
}

function summarizeRestraints(restraints) {
  const comparable = restraints.filter((row) => row.vectorErrorPct !== null);
  const above = comparable.filter((row) => !row.belowR1Floor);
  const normal = restraints.filter((row) => row.normal.percentError !== null);
  return Object.freeze({
    frictionRestraintCount: restraints.length,
    tangentialVectorsCompared: comparable.length,
    tangentialVectorsWithinGoal: comparable.filter((row) => row.vectorErrorPct <= GOAL_PERCENT).length,
    tangentialWorstVectorErrorPct: maximum(comparable.map((row) => row.vectorErrorPct)),
    tangentialMedianVectorErrorPct: median(comparable.map((row) => row.vectorErrorPct)),
    normalWithinGoal: normal.filter((row) => Math.abs(row.normal.percentError) <= GOAL_PERCENT).length,
    normalWorstPercentError: maximum(normal.map((row) => Math.abs(row.normal.percentError))),
    constitutiveStateMatches: restraints.filter((row) => row.state.solvedMatch).length,
    aboveR1Count: above.length,
    aboveR1VectorsWithinGoal: above.filter((row) => row.vectorErrorPct <= GOAL_PERCENT).length,
    aboveR1WorstVectorErrorPct: maximum(above.map((row) => row.vectorErrorPct)),
  });
}

function evaluateN1Reproduction(n1, d1Evidence, nextIntake) {
  if (!n1.converged || n1.deterministic !== true) {
    return Object.freeze({ status: 'FAIL', reason: 'N1_DID_NOT_CONVERGE_DETERMINISTICALLY' });
  }
  const d1ById = new Map(d1Evidence.d1.restraints.map((row) => [row.id, row]));
  let maximumNormalDifferenceN = 0;
  let maximumTangentialComponentDifferenceN = 0;
  const failures = [];
  for (const row of n1.restraints) {
    const d1 = d1ById.get(row.restraintId);
    maximumNormalDifferenceN = Math.max(maximumNormalDifferenceN, Math.abs(row.normal.solvedN - Number(d1.nSol)));
    row.solvedTangentialN.forEach((value, index) => {
      maximumTangentialComponentDifferenceN = Math.max(
        maximumTangentialComponentDifferenceN,
        Math.abs(value - Number(d1.ftSol[index])),
      );
    });
    if (!close(row.normal.solvedN, Number(d1.nSol))
      || row.solvedTangentialN.some((value, index) => !close(value, Number(d1.ftSol[index])))
      || row.state.solvedRaw !== d1.solRaw) {
      failures.push(row.restraintId);
    }
  }
  const iterationMatches = n1.totalIterationCount === nextIntake.retainedBaseline.convergenceIteration;
  return Object.freeze({
    status: failures.length === 0 && iterationMatches ? 'PASS' : 'FAIL',
    rule: 'N1_MUST_REPRODUCE_ACCEPTED_D1_RESTRAINT_STATE_AND_RESPONSE_BEFORE_PATH_RESULTS_ARE_INTERPRETED',
    maximumNormalDifferenceN,
    maximumTangentialComponentDifferenceN,
    mismatchRestraintIds: failures.sort(compareText),
    measuredD1ConvergenceIteration: nextIntake.retainedBaseline.convergenceIteration,
    n1TotalIterationCount: n1.totalIterationCount,
    iterationMatches,
  });
}

function evaluateRefinement(n5, n10, profile) {
  if (!n5.converged || !n10.converged || n5.deterministic !== true || n10.deterministic !== true) {
    return Object.freeze({
      status: 'FAIL',
      reason: 'N5_OR_N10_DID_NOT_CONVERGE_DETERMINISTICALLY',
      stateSetsIdentical: false,
      maximumNormalDifferenceN: null,
      maximumTangentialComponentDifferenceN: null,
    });
  }
  const n10ById = new Map(n10.restraints.map((row) => [row.restraintId, row]));
  let maximumNormalDifferenceN = 0;
  let maximumTangentialComponentDifferenceN = 0;
  const stateMismatchIds = [];
  for (const row5 of n5.restraints) {
    const row10 = n10ById.get(row5.restraintId);
    if (!row10) throw new TypeError(`N10 is missing ${row5.restraintId}.`);
    maximumNormalDifferenceN = Math.max(maximumNormalDifferenceN,
      Math.abs(row5.normal.solvedN - row10.normal.solvedN));
    row5.solvedTangentialN.forEach((value, index) => {
      maximumTangentialComponentDifferenceN = Math.max(maximumTangentialComponentDifferenceN,
        Math.abs(value - row10.solvedTangentialN[index]));
    });
    if (row5.state.solvedRaw !== row10.state.solvedRaw) stateMismatchIds.push(row5.restraintId);
  }
  const stateSetsIdentical = stateMismatchIds.length === 0;
  const forceStable = maximumNormalDifferenceN <= profile.reactionUpdateLimitN
    && maximumTangentialComponentDifferenceN <= profile.reactionUpdateLimitN;
  return Object.freeze({
    status: stateSetsIdentical && forceStable ? 'PASS' : 'FAIL',
    rule: 'N5_VS_N10_REFINEMENT_USES_EXISTING_REACTION_UPDATE_LIMIT_AND_EXACT_RAW_STATE_IDENTITY_NOT_CAESAR_ERROR',
    stateSetsIdentical,
    stateMismatchRestraintIds: stateMismatchIds.sort(compareText),
    maximumNormalDifferenceN,
    maximumTangentialComponentDifferenceN,
    forceDifferenceLimitN: profile.reactionUpdateLimitN,
  });
}

function decide({ n1, n5, n10, n1Reproduction, refinement, d1Evidence }) {
  if (n1Reproduction.status !== 'PASS') {
    return Object.freeze({
      status: 'HALT_IMPLEMENTATION_DRIFT_N1_DOES_NOT_REPRODUCE_D1',
      productionMechanicsPromotionAuthorized: false,
      l7LoadSteppingAllowed: false,
    });
  }
  if (!n5.converged || !n10.converged || n5.deterministic !== true || n10.deterministic !== true) {
    return Object.freeze({
      status: 'REJECT_OR_INCONCLUSIVE_PHYSICAL_CONTINUATION_NONCONVERGED_OR_NONDETERMINISTIC',
      productionMechanicsPromotionAuthorized: false,
      l7LoadSteppingAllowed: false,
    });
  }
  if (refinement.status !== 'PASS') {
    return Object.freeze({
      status: 'INCONCLUSIVE_PHYSICAL_CONTINUATION_NOT_N5_N10_REFINEMENT_STABLE',
      productionMechanicsPromotionAuthorized: false,
      l7LoadSteppingAllowed: false,
    });
  }
  const d1Rows = d1Evidence.d1.restraints;
  const d1Above = d1Rows.filter((row) => row.belowR1Floor !== true);
  const d1StateMatches = d1Rows.filter((row) => row.refState === row.solState).length;
  const d1WorstAbove = maximum(d1Above.map((row) => Number(row.vecErrPct)));
  const improved = n10.summary.tangentialVectorsWithinGoal
      > d1Evidence.d1.summary.tangentialVectorsWithinGoal
    && n10.summary.aboveR1VectorsWithinGoal
      > d1Evidence.d1.aboveProvisionalR1Floor.vectorsWithin10Pct
    && n10.summary.constitutiveStateMatches >= d1StateMatches
    && n10.summary.normalWithinGoal === 23
    && n10.summary.aboveR1WorstVectorErrorPct <= d1WorstAbove;
  return Object.freeze({
    status: improved
      ? 'EVIDENCE_SUPPORTS_D1_PHYSICAL_LOAD_PATH_CONTINUATION_AS_NEXT_EXPERIMENTAL_BASELINE'
      : 'REJECT_PHYSICAL_LOAD_PATH_CONTINUATION_KEEP_D1_EXPERIMENTAL_BASELINE',
    rule: 'PHYSICS_CONVERGENCE_DETERMINISM_AND_N5_N10_REFINEMENT_FIRST_THEN_ACCURACY_MUST_IMPROVE_WITHOUT_NORMAL_OR_STATE_REGRESSION',
    comparison: {
      d1VectorWithinGoal: d1Evidence.d1.summary.tangentialVectorsWithinGoal,
      n10VectorWithinGoal: n10.summary.tangentialVectorsWithinGoal,
      d1AboveR1VectorWithinGoal: d1Evidence.d1.aboveProvisionalR1Floor.vectorsWithin10Pct,
      n10AboveR1VectorWithinGoal: n10.summary.aboveR1VectorsWithinGoal,
      d1ConstitutiveStateMatches: d1StateMatches,
      n10ConstitutiveStateMatches: n10.summary.constitutiveStateMatches,
      d1WorstAboveR1VectorErrorPct: d1WorstAbove,
      n10WorstAboveR1VectorErrorPct: n10.summary.aboveR1WorstVectorErrorPct,
      n10NormalWithinGoal: n10.summary.normalWithinGoal,
    },
    productionMechanicsPromotionAuthorized: false,
    l7LoadSteppingAllowed: false,
  });
}

async function loadCandidateModule(solverPath) {
  const productionSource = readFileSync(solverPath, 'utf8');
  const source = buildD1LoadPathCandidateSource(productionSource, solverPath);
  const tempPath = resolve(tmpdir(), `m047-d1-load-path-${process.pid}-${Date.now()}.mjs`);
  writeFileSync(tempPath, source, 'utf8');
  try {
    return await import(`${pathToFileURL(tempPath).href}?candidate=${Date.now()}`);
  } finally {
    try { unlinkSync(tempPath); } catch { /* best-effort cleanup */ }
  }
}

function replaceExactly(source, oldText, newText, label) {
  const first = source.indexOf(oldText);
  if (first < 0) throw new TypeError(`Load-path source guard cannot find expected ${label}.`);
  if (source.indexOf(oldText, first + oldText.length) >= 0) {
    throw new TypeError(`Load-path source guard found more than one ${label}; transformation is ambiguous.`);
  }
  return `${source.slice(0, first)}${newText}${source.slice(first + oldText.length)}`;
}

function vectorsByNode(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row.entityKind !== 'NODE' || row.quantity !== 'FORCE') continue;
    const vector = map.get(String(row.entityId)) ?? {};
    vector[row.component] = Number(row.value);
    map.set(String(row.entityId), vector);
  }
  return map;
}

function normalizeState(value) {
  if (value === 'SLIDING' || value === 'SLID') return 'SLID';
  if (value === 'LOCKED_AFTER_SLIP' || value === 'STUCK') return 'STUCK';
  throw new TypeError(`Unsupported friction state ${String(value)}.`);
}

function close(left, right) {
  const a = Number(left);
  const b = Number(right);
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * scale;
}

function norm(values) {
  return Math.hypot(...values);
}

function maximum(values) {
  return values.length === 0 ? 0 : Math.max(...values);
}

function median(values) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function compareText(left, right) {
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 2) args.set(argv[index], argv[index + 1]);
  const accdbPath = args.get('--accdb');
  const d1EvidencePath = args.get('--d1-evidence');
  const nextAccuracyEvidencePath = args.get('--next-accuracy-evidence');
  if (!accdbPath || !d1EvidencePath || !nextAccuracyEvidencePath) {
    throw new TypeError(
      'Usage: --accdb <BM4_L.ACCDB> --d1-evidence <real-d1-evidence.json> '
      + '--next-accuracy-evidence <next-accuracy-batch-evidence.json> [--out <json>]',
    );
  }
  const record = await runD1LoadPathExperiment({
    accdbPath,
    d1EvidencePath,
    nextAccuracyEvidencePath,
    profilePath: args.get('--profile'),
  });
  const outPath = args.get('--out');
  if (outPath) {
    mkdirSync(dirname(resolve(outPath)), { recursive: true });
    writeFileSync(resolve(outPath), `${canonicalPrettyStringify(record)}\n`, 'utf8');
  }
  process.stdout.write(`${canonicalPrettyStringify(record)}\n`);
}
