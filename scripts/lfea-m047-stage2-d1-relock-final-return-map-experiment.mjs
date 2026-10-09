#!/usr/bin/env node
/**
 * M047 Stage 2 H1 — D1 final return-map update on SLIDE -> STICK.
 *
 * Accepted D1 updates the permanent slip offset only while nextState is SLIDE.
 * If an iteration transitions SLIDE -> STICK, D1 therefore re-locks with the
 * slip offset from the previous iteration. H1 changes exactly that transition:
 * perform one final D1 return-map update using the current displacement and
 * current mu|N|, then enter STICK with that finalized permanent slip offset.
 *
 * Re-locking remains allowed. This is not the rejected no-relock S1 mechanic and
 * it is not the rejected zero-force re-anchor S2 mechanic. Direction, capacity,
 * own-restraint normal basis, friction stiffness, hysteresis, acceleration,
 * full-load path, convergence gates and comparison goal remain unchanged.
 */
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { buildCaesarAccdbBenchmarkPackage, requiredCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-package.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';
import { buildCandidateSource as buildD1CandidateSource } from './lfea-m047-stage2-direction-only-experiment.mjs';

const PROFILE_PATH = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const SOLVER_PATH = 'src/core/fea-benchmarks/caesar-accdb-friction-solve.js';
const PROFILE_ID = 'CAESAR-ACCDB-FRICTION-SOLVER-R1-D1-RELOCK-FINAL-RETURN-MAP';
const PINNED_ACCDB_SHA256 = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';

export async function runRelockFinalReturnMapExperiment(input) {
  const caseId = input.caseId ?? 'L13';
  if (caseId !== 'L13') throw new TypeError('H1 is restricted to L13.');
  const d1EvidencePath = resolve(input.d1EvidencePath);
  const d1 = JSON.parse(readFileSync(d1EvidencePath, 'utf8'));
  validateD1Evidence(d1);

  const profile = JSON.parse(readFileSync(resolve(input.profilePath ?? PROFILE_PATH), 'utf8'));
  const rawExport = await extractCaesarAccdbTables({
    accdbPath: input.accdbPath,
    tableNames: requiredCaesarAccdbTables(profile),
  });
  const benchmarkPackage = buildCaesarAccdbBenchmarkPackage({ rawExport, profile });
  if (benchmarkPackage.source.sha256 !== PINNED_ACCDB_SHA256 || benchmarkPackage.source.sha256 !== d1.source.accdbSha256) {
    throw new TypeError(`H1 ACCDB custody mismatch: ${benchmarkPackage.source.sha256}.`);
  }

  const loaded = await loadCandidateModule(resolve(input.solverPath ?? SOLVER_PATH));
  if (loaded.module.CAESAR_FRICTION_SOLVER_PROFILE.profileId !== PROFILE_ID) {
    throw new Error(`H1 profile mismatch ${loaded.module.CAESAR_FRICTION_SOLVER_PROFILE.profileId}.`);
  }

  const first = runCandidate(loaded.module, benchmarkPackage, caseId);
  const second = runCandidate(loaded.module, benchmarkPackage, caseId);
  if (first.error !== null || second.error !== null) {
    const record = {
      schema: 'm047-bm4l-stage2-d1-relock-final-return-map/v1',
      measurementBoundary: 'REAL_PINNED_ACCDB_EPHEMERAL_D1_RELOCK_FINAL_RETURN_MAP',
      caseId,
      sourceAccdbSha256: benchmarkPackage.source.sha256,
      baselineD1Evidence: basename(d1EvidencePath),
      productionSolverModified: false,
      isolatedMechanic: 'SLIDE_TO_STICK_FINALIZES_D1_RETURN_MAP_SLIP_OFFSET_ON_TRANSITION',
      candidateProfileId: PROFILE_ID,
      candidateSourceSha256: loaded.sha256,
      toleranceChanged: false,
      comparisonPolicyChanged: false,
      candidate: { converged: false, firstRunFailure: first.error, repeatRunFailure: second.error },
      baselineSummary: baselineSummary(d1),
      candidateSummary: null,
      restraints: null,
      decision: 'REJECT_H1_NONCONVERGED_KEEP_D1',
    };
    return Object.freeze({ ...record, semanticHash: semanticHash(record) });
  }

  const actual = first.actual;
  const repeat = second.actual;
  const evidence = actual.mechanics.cases[caseId];
  const repeatEvidence = repeat.mechanics.cases[caseId];
  const rowsSemanticHash = semanticHash(actual.cases[caseId].rows);
  const repeatRowsSemanticHash = semanticHash(repeat.cases[caseId].rows);
  const restraints = compareCandidate({ benchmarkPackage, actual, d1, caseId });
  const candidateSummary = summarizeCandidate(restraints);
  const baseSummary = baselineSummary(d1);
  const deterministic = rowsSemanticHash === repeatRowsSemanticHash;
  const equilibriumPass = evidence.recoveredEquilibrium?.status === 'PASS'
    && repeatEvidence.recoveredEquilibrium?.status === 'PASS';
  const convergencePass = evidence.convergenceGates?.status === 'CONVERGED'
    && repeatEvidence.convergenceGates?.status === 'CONVERGED';
  const transitionEvents = evidence.iterations.flatMap((iteration) =>
    (iteration.stateChanges ?? []).filter((change) => change.from === 'SLIDE' && change.to === 'STICK')
      .map((change) => ({ iteration: iteration.iteration, restraintId: change.restraintId, nodeId: change.nodeId })));
  const repeatTransitionEvents = repeatEvidence.iterations.flatMap((iteration) =>
    (iteration.stateChanges ?? []).filter((change) => change.from === 'SLIDE' && change.to === 'STICK')
      .map((change) => ({ iteration: iteration.iteration, restraintId: change.restraintId, nodeId: change.nodeId })));
  const transitionIdentity = transitionEvents.map((row) => `${row.iteration}:${row.restraintId}`).join('|');
  const repeatTransitionIdentity = repeatTransitionEvents.map((row) => `${row.iteration}:${row.restraintId}`).join('|');
  const transitionReproducible = transitionEvents.length > 0 && transitionIdentity === repeatTransitionIdentity;
  const baselineRows = new Map(d1.d1.restraints.map((row) => [row.id, row]));
  const targeted = restraints.filter((row) => {
    const baseline = baselineRows.get(row.restraintId);
    return baseline?.solRaw === 'LOCKED_AFTER_SLIP' && baseline?.vecErrPct > 10 && baseline?.belowR1Floor !== true;
  });

  const record = {
    schema: 'm047-bm4l-stage2-d1-relock-final-return-map/v1',
    measurementBoundary: 'REAL_PINNED_ACCDB_EPHEMERAL_D1_RELOCK_FINAL_RETURN_MAP',
    caseId,
    sourceAccdbSha256: benchmarkPackage.source.sha256,
    baselineD1Evidence: basename(d1EvidencePath),
    productionSolverModified: false,
    isolatedMechanic: 'SLIDE_TO_STICK_FINALIZES_D1_RETURN_MAP_SLIP_OFFSET_ON_TRANSITION',
    unchangedMechanics: [
      'D1_TOTAL_RELATIVE_TANGENTIAL_FORCE_DIRECTION',
      'RESULTANT_COULOMB_CAPACITY',
      'OWN_RESTRAINT_SIGNED_NORMAL_BASIS',
      'FRICTION_STIFFNESS',
      'STATE_BOUNDARY_AND_HYSTERESIS',
      'SECANT_SLIP_ACCELERATION',
      'FULL_LOAD_SINGLE_STEP_L13_PATH',
      'CONVERGENCE_GATES',
      'TEN_PERCENT_COMPARISON_GOAL',
    ],
    candidateProfileId: PROFILE_ID,
    candidateSourceSha256: loaded.sha256,
    toleranceChanged: false,
    comparisonPolicyChanged: false,
    candidate: {
      converged: true,
      deterministic,
      equilibriumPass,
      convergencePass,
      rowsSemanticHash,
      repeatRowsSemanticHash,
      iterationCount: evidence.iterationCount,
      repeatIterationCount: repeatEvidence.iterationCount,
      slideToStickTransitionCount: transitionEvents.length,
      repeatSlideToStickTransitionCount: repeatTransitionEvents.length,
      transitionReproducible,
      transitionEvents,
    },
    baselineSummary: baseSummary,
    candidateSummary,
    targetedRelockedResiduals: {
      count: targeted.length,
      baselineMedianVectorErrorPct: median(targeted.map((row) => row.baselineVectorErrorPct)),
      candidateMedianVectorErrorPct: median(targeted.map((row) => row.candidateVectorErrorPct)),
      baselineVectorsWithin10Pct: targeted.filter((row) => row.baselineVectorErrorPct <= 10).length,
      candidateVectorsWithin10Pct: targeted.filter((row) => row.candidateVectorErrorPct <= 10).length,
      restraintIds: targeted.map((row) => row.restraintId),
    },
    namedDiagnostics: Object.fromEntries(['22140','22220','22070','21860','22370','21740','22310','22260','20440','20710']
      .map((nodeId) => [nodeId, restraints.find((row) => row.nodeId === nodeId) ?? null])),
    restraints,
    decision: decide({ deterministic, equilibriumPass, convergencePass, transitionReproducible, baseSummary, candidateSummary, targeted }),
  };
  return Object.freeze({ ...record, semanticHash: semanticHash(record) });
}

function decide(input) {
  if (!input.deterministic || !input.equilibriumPass || !input.convergencePass || !input.transitionReproducible) {
    return 'REJECT_H1_PHYSICS_DETERMINISM_OR_EXERCISE_GATE_KEEP_D1';
  }
  const targetImproved = input.targeted.length > 0
    && median(input.targeted.map((row) => row.candidateVectorErrorPct))
      < median(input.targeted.map((row) => row.baselineVectorErrorPct));
  const aggregateImproved = input.candidateSummary.vectorsWithin10Pct > input.baseSummary.vectorsWithin10Pct
    && input.candidateSummary.medianVectorErrorPct < input.baseSummary.medianVectorErrorPct
    && input.candidateSummary.normalsWithin10Pct === 23;
  return targetImproved && aggregateImproved
    ? 'H1_SIGNAL_PRESENT_REQUIRES_GOVERNED_REVIEW_NOT_PRODUCTION_PROMOTION'
    : 'REJECT_H1_AS_MISSING_GLOBAL_MECHANISM_KEEP_D1';
}

function runCandidate(module, benchmarkPackage, caseId) {
  try {
    return { actual: module.solveCaesarAccdbFrictionBenchmark(benchmarkPackage, [caseId], {
      profile: module.CAESAR_FRICTION_SOLVER_PROFILE,
    }), error: null };
  } catch (error) {
    return { actual: null, error: {
      message: error.message,
      code: error.code ?? null,
      iterationCount: error.iterations?.length ?? null,
      failedGates: error.iterations?.at(-1)?.failedGates ?? null,
      reactionUpdateTailN: (error.iterations ?? []).slice(-8).map((entry) => entry.reactionUpdateNormN),
      displacementUpdateTailM: (error.iterations ?? []).slice(-8).map((entry) => entry.displacementUpdateNormM),
    } };
  }
}

export function buildRelockFinalReturnMapCandidateSource(productionSource, solverPath = resolve(SOLVER_PATH)) {
  let source = buildD1CandidateSource(String(productionSource), solverPath);
  source = replaceExactly(source,
    "  profileId: 'CAESAR-ACCDB-FRICTION-SOLVER-R1',",
    `  profileId: '${PROFILE_ID}',`,
    'profile id');
  source = replaceExactly(source,
`    const totalDirectionMagnitude = norm(tangentialDisplacement);
    const nextSlip = nextState === 'SLIDE' && totalDirectionMagnitude > profile.zeroTangentialMotionFloorM
      ? tangentialDisplacement.map((value) =>
        value - (capacityN / stiffness) * value / totalDirectionMagnitude)
      : [...slip];`,
`    const totalDirectionMagnitude = norm(tangentialDisplacement);
    const finalizingRelock = state === 'SLIDE' && nextState === 'STICK';
    const applyReturnMap = nextState === 'SLIDE' || finalizingRelock;
    const nextSlip = applyReturnMap && totalDirectionMagnitude > profile.zeroTangentialMotionFloorM
      ? tangentialDisplacement.map((value) =>
        value - (capacityN / stiffness) * value / totalDirectionMagnitude)
      : [...slip];`,
    'D1 slip-update transition');
  return source;
}

async function loadCandidateModule(solverPath) {
  const source = buildRelockFinalReturnMapCandidateSource(readFileSync(solverPath, 'utf8'), solverPath);
  const sha256 = createHash('sha256').update(source).digest('hex');
  const tempPath = resolve(tmpdir(), `m047-d1-relock-final-${process.pid}-${Date.now()}.mjs`);
  writeFileSync(tempPath, source, 'utf8');
  try {
    return { module: await import(`${pathToFileURL(tempPath).href}?h1=${Date.now()}`), sha256 };
  } finally {
    try { unlinkSync(tempPath); } catch { /* best effort */ }
  }
}

function compareCandidate({ benchmarkPackage, actual, d1, caseId }) {
  const reference = vectorsByNode(benchmarkPackage.references[caseId].rows);
  const solved = vectorsByNode(actual.cases[caseId].rows);
  const baselineById = new Map(d1.d1.restraints.map((row) => [row.id, row]));
  const supports = actual.mechanics.cases[caseId].iterations.at(-1).supports;
  return supports.map((support) => {
    const baseline = baselineById.get(support.restraintId);
    if (!baseline) throw new TypeError(`H1 D1 evidence missing ${support.restraintId}.`);
    const refVector = reference.get(String(support.nodeId)) ?? {};
    const solvedVector = solved.get(String(support.nodeId)) ?? {};
    const refTangential = support.frictionDofs.map((dof) => Number(refVector[dof] ?? 0));
    const candidateTangential = support.frictionDofs.map((dof) => Number(solvedVector[dof] ?? 0));
    const refMagnitude = norm(refTangential);
    return {
      restraintId: support.restraintId,
      nodeId: String(support.nodeId),
      frictionDofs: [...support.frictionDofs],
      baselineVectorErrorPct: baseline.vecErrPct,
      candidateVectorErrorPct: refMagnitude === 0 ? null
        : 100 * norm(candidateTangential.map((value, index) => value - refTangential[index])) / refMagnitude,
      referenceTangentialN: refTangential,
      candidateTangentialN: candidateTangential,
      referenceNormalN: Math.abs(Number(refVector[support.normalDof] ?? 0)),
      candidateNormalN: support.normalReactionMagnitudeN,
      candidateNormalErrorPct: Number(refVector[support.normalDof] ?? 0) === 0 ? null
        : 100 * (support.normalReactionMagnitudeN - Math.abs(Number(refVector[support.normalDof] ?? 0)))
          / Math.abs(Number(refVector[support.normalDof] ?? 0)),
      baselineRawState: baseline.solRaw,
      referenceState: baseline.refState,
      candidateRegime: support.regime,
    };
  }).sort((left, right) => (right.candidateVectorErrorPct ?? -Infinity) - (left.candidateVectorErrorPct ?? -Infinity));
}

function baselineSummary(d1) {
  return {
    vectorsWithin10Pct: d1.d1.summary.tangentialVectorsWithinGoal,
    vectorsCompared: d1.d1.summary.tangentialVectorsCompared,
    normalsWithin10Pct: d1.d1.summary.normalWithinGoal,
    medianVectorErrorPct: median(d1.d1.restraints.map((row) => row.vecErrPct)),
    worstVectorErrorPct: maximum(d1.d1.restraints.map((row) => row.vecErrPct)),
    normalizedStateMatches: d1.d1.constitutiveStateMatches,
  };
}

function summarizeCandidate(rows) {
  const comparable = rows.filter((row) => row.candidateVectorErrorPct !== null);
  return {
    vectorsWithin10Pct: comparable.filter((row) => row.candidateVectorErrorPct <= 10).length,
    vectorsCompared: comparable.length,
    normalsWithin10Pct: rows.filter((row) => row.candidateNormalErrorPct !== null && Math.abs(row.candidateNormalErrorPct) <= 10).length,
    medianVectorErrorPct: median(comparable.map((row) => row.candidateVectorErrorPct)),
    worstVectorErrorPct: maximum(comparable.map((row) => row.candidateVectorErrorPct)),
    normalizedStateMatches: rows.filter((row) => {
      const candidate = row.candidateRegime === 'SLIDING' ? 'SLID' : 'STUCK';
      return candidate === row.referenceState;
    }).length,
  };
}

function validateD1Evidence(d1) {
  if (d1.schema !== 'm047-bm4l-stage2-real-d1-evidence/v1') throw new TypeError('H1 requires compact real D1 evidence v1.');
  if (d1.measurementBoundary !== 'REAL_PINNED_ACCDB_LOCAL_SOLVE') throw new TypeError('H1 requires real pinned D1 evidence.');
  if (d1.source?.accdbSha256 !== PINNED_ACCDB_SHA256) throw new TypeError('H1 D1 ACCDB hash mismatch.');
  if (d1.d1?.converged !== true || d1.d1?.summary?.tangentialVectorsWithinGoal !== 13 || d1.d1?.summary?.normalWithinGoal !== 23) {
    throw new TypeError('H1 accepted D1 baseline mismatch.');
  }
}

function replaceExactly(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new TypeError(`H1 cannot find expected ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) throw new TypeError(`H1 found ambiguous ${label}.`);
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
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
function norm(values) { return Math.hypot(...values); }
function maximum(values) { return values.length === 0 ? 0 : Math.max(...values); }
function median(values) {
  const ordered = [...values].filter(Number.isFinite).sort((a,b) => a-b);
  if (!ordered.length) return null;
  const mid = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[mid] : (ordered[mid-1] + ordered[mid]) / 2;
}

function textReport(record) {
  const lines = [
    `case                ${record.caseId}`,
    `candidate profile   ${record.candidateProfileId}`,
    `candidate converged ${record.candidate.converged}`,
    `decision            ${record.decision}`,
  ];
  if (!record.candidate.converged) {
    lines.push(`failure             ${record.candidate.firstRunFailure?.message ?? 'none'}`);
    return lines.join('\n');
  }
  lines.push(
    `deterministic       ${record.candidate.deterministic}`,
    `transitions         ${record.candidate.slideToStickTransitionCount}`,
    `D1 vectors          ${record.baselineSummary.vectorsWithin10Pct}/23`,
    `H1 vectors          ${record.candidateSummary.vectorsWithin10Pct}/23`,
    `D1 median error     ${record.baselineSummary.medianVectorErrorPct.toFixed(2)}%`,
    `H1 median error     ${record.candidateSummary.medianVectorErrorPct.toFixed(2)}%`,
    `H1 normals          ${record.candidateSummary.normalsWithin10Pct}/23`,
    `target median D1    ${record.targetedRelockedResiduals.baselineMedianVectorErrorPct?.toFixed(2)}%`,
    `target median H1    ${record.targetedRelockedResiduals.candidateMedianVectorErrorPct?.toFixed(2)}%`,
  );
  return lines.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 2) args.set(argv[index], argv[index + 1]);
  const accdbPath = args.get('--accdb');
  const d1EvidencePath = args.get('--d1-evidence');
  if (!accdbPath || !d1EvidencePath) throw new TypeError('Usage: --accdb <BM4_L.ACCDB> --d1-evidence <real-d1.json> [--out <json>]');
  const record = await runRelockFinalReturnMapExperiment({ accdbPath, d1EvidencePath, caseId: args.get('--case') ?? 'L13' });
  const out = args.get('--out');
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(resolve(out), `${canonicalPrettyStringify(record)}\n`, 'utf8');
  }
  process.stdout.write(`${textReport(record)}\n`);
}
