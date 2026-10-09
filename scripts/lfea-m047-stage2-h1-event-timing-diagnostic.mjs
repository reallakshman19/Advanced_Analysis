#!/usr/bin/env node
/**
 * M047 Stage 2 — H1 event-timing / equilibrium-history diagnostic.
 *
 * Data-only. Reproduces the exact accepted H1 candidate against the pinned real
 * BM4_L.ACCDB, then examines the LAST SLIDE->STICK event at every re-locked
 * restraint. It compares four mechanically meaningful event snapshots:
 *
 *   PRE_RELOCK_APPLIED          executed force one iteration before re-lock;
 *   RELOCK_APPLIED              executed force on the SLIDE->STICK detection iterate;
 *   RELOCK_PROJECTED            Coulomb projection H1 commits on that transition;
 *   FIRST_LOCKED_APPLIED        first equilibrium solve with STICK active;
 *   FIRST_LOCKED_PROJECTED      one-time return-map projection using that first
 *                               locked equilibrium (candidate timing discriminator).
 *
 * No solver mechanic, tolerance, comparison rule, friction stiffness, normal
 * basis or capacity surface is changed by this script.
 */
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { buildCaesarAccdbBenchmarkPackage, requiredCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-package.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';
import { buildRelockFinalReturnMapCandidateSource } from './lfea-m047-stage2-d1-relock-final-return-map-experiment.mjs';

const PROFILE_PATH = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const SOLVER_PATH = 'src/core/fea-benchmarks/caesar-accdb-friction-solve.js';
const PINNED_ACCDB_SHA256 = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const H1_ROWS_HASH = 'fnv1a64:77eea847870b228b';
const CONVENTIONS = Object.freeze([
  'PRE_RELOCK_APPLIED',
  'RELOCK_APPLIED',
  'RELOCK_PROJECTED',
  'FIRST_LOCKED_APPLIED',
  'FIRST_LOCKED_PROJECTED',
  'FINAL_H1',
]);

async function runDiagnostic(input) {
  const profile = JSON.parse(readFileSync(resolve(input.profilePath ?? PROFILE_PATH), 'utf8'));
  const raw = await extractCaesarAccdbTables({
    accdbPath: input.accdbPath,
    tableNames: requiredCaesarAccdbTables(profile),
  });
  const pkg = buildCaesarAccdbBenchmarkPackage({ rawExport: raw, profile });
  if (pkg.source.sha256 !== PINNED_ACCDB_SHA256) {
    throw new TypeError(`H1 event timing custody mismatch ${pkg.source.sha256}.`);
  }
  const d1 = JSON.parse(readFileSync(resolve(input.d1EvidencePath), 'utf8'));
  if (d1?.source?.accdbSha256 !== PINNED_ACCDB_SHA256 || !Array.isArray(d1?.d1?.restraints)) {
    throw new TypeError('H1 event timing requires accepted pinned D1 evidence.');
  }

  const solverPath = resolve(input.solverPath ?? SOLVER_PATH);
  const candidateSource = buildRelockFinalReturnMapCandidateSource(readFileSync(solverPath, 'utf8'), solverPath);
  const tempPath = resolve(tmpdir(), `m047-h1-event-timing-${process.pid}-${Date.now()}.mjs`);
  writeFileSync(tempPath, candidateSource, 'utf8');
  let module;
  try {
    module = await import(`${pathToFileURL(tempPath).href}?eventTiming=${Date.now()}`);
  } finally {
    try { unlinkSync(tempPath); } catch { /* best effort */ }
  }

  const actual = module.solveCaesarAccdbFrictionBenchmark(pkg, ['L13'], {
    profile: module.CAESAR_FRICTION_SOLVER_PROFILE,
  });
  const rowsHash = semanticHash(actual.cases.L13.rows);
  if (rowsHash !== H1_ROWS_HASH) throw new Error(`Exact H1 reproduction failed: ${rowsHash}.`);
  const evidence = actual.mechanics.cases.L13;
  if (evidence.convergenceGates?.status !== 'CONVERGED' || evidence.recoveredEquilibrium?.status !== 'PASS') {
    throw new Error('Exact H1 reproduction did not satisfy convergence/equilibrium gates.');
  }

  const reference = vectorsByNode(pkg.references.L13.rows, 'FORCE');
  const solved = vectorsByNode(actual.cases.L13.rows, 'FORCE');
  const d1ById = new Map(d1.d1.restraints.map((row) => [row.id, row]));
  const iterationSupports = evidence.iterations.map((it) => new Map((it.supports ?? []).map((s) => [s.restraintId, s])));
  const lastEventById = new Map();
  for (let index = 0; index < evidence.iterations.length; index += 1) {
    const it = evidence.iterations[index];
    for (const change of it.stateChanges ?? []) {
      if (change.from === 'SLIDE' && change.to === 'STICK') {
        lastEventById.set(change.restraintId, { index, iteration: it.iteration, change });
      }
    }
  }

  const rows = [];
  for (const [restraintId, event] of [...lastEventById.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (event.index === 0 || event.index + 1 >= evidence.iterations.length) {
      throw new Error(`Last re-lock ${restraintId} lacks pre/post iteration context.`);
    }
    const pre = iterationSupports[event.index - 1].get(restraintId);
    const relock = iterationSupports[event.index].get(restraintId);
    const firstLocked = iterationSupports[event.index + 1].get(restraintId);
    if (!pre || !relock || !firstLocked) throw new Error(`Missing event support context ${restraintId}.`);
    if (!(relock.state === 'SLIDE' && relock.nextState === 'STICK')) {
      throw new Error(`Event ledger mismatch ${restraintId}: ${relock.state}->${relock.nextState}.`);
    }
    if (firstLocked.state !== 'STICK') {
      throw new Error(`First post-relock state is not STICK for ${restraintId}: ${firstLocked.state}.`);
    }

    const refVectorRaw = reference.get(String(relock.nodeId)) ?? {};
    const solvedVectorRaw = solved.get(String(relock.nodeId)) ?? {};
    const ref = relock.frictionDofs.map((dof) => Number(refVectorRaw[dof] ?? 0));
    const finalH1 = relock.frictionDofs.map((dof) => Number(solvedVectorRaw[dof] ?? 0));
    const vectors = {
      PRE_RELOCK_APPLIED: [...pre.appliedFrictionForceN],
      RELOCK_APPLIED: [...relock.appliedFrictionForceN],
      RELOCK_PROJECTED: projectedForce(relock),
      FIRST_LOCKED_APPLIED: [...firstLocked.appliedFrictionForceN],
      FIRST_LOCKED_PROJECTED: projectedForce(firstLocked),
      FINAL_H1: finalH1,
    };
    const errors = Object.fromEntries(CONVENTIONS.map((name) => [name, percentVectorError(vectors[name], ref)]));
    const baseline = d1ById.get(restraintId);
    if (!baseline) throw new Error(`Accepted D1 evidence missing ${restraintId}.`);
    const h1Pass = errors.FINAL_H1 <= 10;
    const d1Pass = Number(baseline.vecErrPct) <= 10;
    rows.push({
      restraintId,
      nodeId: String(relock.nodeId),
      frictionDofs: [...relock.frictionDofs],
      lastRelockIteration: event.iteration,
      preRelockIteration: evidence.iterations[event.index - 1].iteration,
      firstLockedIteration: evidence.iterations[event.index + 1].iteration,
      preRelockState: `${pre.state}->${pre.nextState}`,
      relockState: `${relock.state}->${relock.nextState}`,
      firstLockedState: `${firstLocked.state}->${firstLocked.nextState}`,
      referenceTangentialN: ref,
      vectors,
      vectorErrorPct: errors,
      d1VectorErrorPct: Number(baseline.vecErrPct),
      h1VectorErrorPct: errors.FINAL_H1,
      d1Pass,
      h1Pass,
      repairedByH1: !d1Pass && h1Pass,
      remainingH1Failure: !h1Pass,
      relockCapacityN: Number(relock.capacityN),
      firstLockedCapacityN: Number(firstLocked.capacityN),
      relockNormalN: Number(relock.normalReactionMagnitudeN),
      firstLockedNormalN: Number(firstLocked.normalReactionMagnitudeN),
      relockDisplacementM: [...relock.relativeTangentialDisplacementM],
      firstLockedDisplacementM: [...firstLocked.relativeTangentialDisplacementM],
      relockToFirstLockedDisplacementDeltaM: norm(firstLocked.relativeTangentialDisplacementM.map((v, i) => v - relock.relativeTangentialDisplacementM[i])),
      relockGateStatus: evidence.iterations[event.index].gateStatus,
      firstLockedGateStatus: evidence.iterations[event.index + 1].gateStatus,
      firstLockedReactionUpdateN: evidence.iterations[event.index + 1].reactionUpdateNormN,
      firstLockedDisplacementUpdateM: evidence.iterations[event.index + 1].displacementUpdateNormM,
    });
  }

  const remaining = rows.filter((r) => r.remainingH1Failure);
  const repaired = rows.filter((r) => r.repairedByH1);
  const h1Passes = rows.filter((r) => r.h1Pass);
  const conventionSummary = Object.fromEntries(CONVENTIONS.map((name) => [name, summarizeConvention(rows, remaining, repaired, h1Passes, name)]));
  const firstLocked = conventionSummary.FIRST_LOCKED_PROJECTED;
  const relockProjected = conventionSummary.RELOCK_PROJECTED;
  const signal = firstLocked.remainingFailureMedianErrorPct < relockProjected.remainingFailureMedianErrorPct
    && firstLocked.remainingFailuresWithin10Pct > relockProjected.remainingFailuresWithin10Pct
    && firstLocked.repairedControlsWithin10Pct === repaired.length
    && firstLocked.h1PassControlsWithin10Pct === h1Passes.length;

  const result = {
    schema: 'm047-bm4l-stage2-h1-event-timing-diagnostic/v1',
    rule: 'DATA_ONLY_EXACT_H1_EVENT_TIMING_NO_MECHANICS_CHANGE',
    sourceAccdbSha256: pkg.source.sha256,
    h1RowsSemanticHash: rowsHash,
    h1IterationCount: evidence.iterationCount,
    lastRelockRestraintCount: rows.length,
    remainingH1FailureCount: remaining.length,
    repairedByH1Count: repaired.length,
    conventions: CONVENTIONS,
    conventionSummary,
    rows,
    focusRows: ['22140','22220','22070','22370','21740','22310','21860','22260','22120']
      .map((nodeId) => rows.find((row) => row.nodeId === nodeId) ?? null),
    discriminator: {
      proposedNextMechanic: 'ONE_TIME_RETURN_MAP_FINALIZATION_ON_FIRST_LOCKED_EQUILIBRIUM_AFTER_SLIDE_TO_STICK',
      supportSignal: signal,
      gate: 'FIRST_LOCKED_PROJECTED_MUST_IMPROVE_REMAINING_FAILURE_MEDIAN_AND_PASS_COUNT_WHILE_PRESERVING_ALL_REPAIRED_AND_H1_PASS_CONTROLS_AT_EXISTING_10_PERCENT_GOAL',
      decision: signal
        ? 'EVENT_TIMING_SIGNAL_SUPPORTS_ONE_REAL_H1E1_NONLINEAR_EXPERIMENT'
        : 'NO_GENERAL_EVENT_TIMING_SIGNAL_DO_NOT_STAGE_H1E1',
    },
  };
  return Object.freeze({ ...result, semanticHash: semanticHash(result) });
}

function summarizeConvention(all, remaining, repaired, h1Passes, name) {
  return {
    allRelockedWithin10Pct: all.filter((r) => r.vectorErrorPct[name] <= 10).length,
    allRelockedMedianErrorPct: median(all.map((r) => r.vectorErrorPct[name])),
    remainingFailuresWithin10Pct: remaining.filter((r) => r.vectorErrorPct[name] <= 10).length,
    remainingFailureMedianErrorPct: median(remaining.map((r) => r.vectorErrorPct[name])),
    repairedControlsWithin10Pct: repaired.filter((r) => r.vectorErrorPct[name] <= 10).length,
    repairedControlCount: repaired.length,
    h1PassControlsWithin10Pct: h1Passes.filter((r) => r.vectorErrorPct[name] <= 10).length,
    h1PassControlCount: h1Passes.length,
  };
}

function projectedForce(support) {
  const u = [...support.relativeTangentialDisplacementM];
  const magnitude = norm(u);
  if (!(magnitude > 0)) return u.map(() => 0);
  return u.map((value) => -Number(support.capacityN) * value / magnitude);
}
function vectorsByNode(rows, quantity) {
  const out = new Map();
  for (const row of rows) {
    if (row.entityKind !== 'NODE' || row.quantity !== quantity) continue;
    const vector = out.get(String(row.entityId)) ?? {};
    vector[row.component] = Number(row.value);
    out.set(String(row.entityId), vector);
  }
  return out;
}
function norm(vector) { return Math.hypot(...vector); }
function percentVectorError(actual, reference) {
  const denominator = norm(reference);
  if (!(denominator > 0)) return null;
  return 100 * norm(actual.map((value, index) => value - reference[index])) / denominator;
}
function median(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return null;
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2 === 0 ? (finite[middle - 1] + finite[middle]) / 2 : finite[middle];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 2) args.set(argv[index], argv[index + 1]);
  const accdbPath = args.get('--accdb');
  const d1EvidencePath = args.get('--d1-evidence');
  if (!accdbPath || !d1EvidencePath) {
    throw new TypeError('Usage: --accdb <BM4_L.ACCDB> --d1-evidence <real-d1.json> [--out <json>]');
  }
  const result = await runDiagnostic({ accdbPath, d1EvidencePath });
  const out = args.get('--out');
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(resolve(out), `${canonicalPrettyStringify(result)}\n`, 'utf8');
  }
  process.stdout.write(`${result.discriminator.decision}\n`);
  for (const [name, summary] of Object.entries(result.conventionSummary)) {
    process.stdout.write(`${name} remaining=${summary.remainingFailuresWithin10Pct}/${result.remainingH1FailureCount} median=${summary.remainingFailureMedianErrorPct} repaired=${summary.repairedControlsWithin10Pct}/${summary.repairedControlCount} h1Pass=${summary.h1PassControlsWithin10Pct}/${summary.h1PassControlCount}\n`);
  }
}

export { runDiagnostic };
