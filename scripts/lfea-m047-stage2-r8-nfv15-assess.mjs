#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const BASELINE_SOLVER = 'CAESAR-ACCDB-FRICTION-SOLVER-R2';
const EXPERIMENT_SOLVER = 'CAESAR-ACCDB-FRICTION-SOLVER-R2-R8-NFV15-EXPERIMENT';
const THRESHOLD = 0.15;
const GOAL = 0.10;
const CASES = ['L13', 'L7', 'L1'];

export function assessR8Nfv15({ baseline, experiment }) {
  record(baseline, 'baseline');
  record(experiment, 'experiment');
  const caseId = String(experiment.caseId ?? '');
  if (!CASES.includes(caseId) || baseline.caseId !== caseId) throw new TypeError('Baseline/experiment case mismatch.');
  if (baseline.sourceAccdbSha256 !== SHA) throw new TypeError('Baseline must use the pinned ACCDB SHA.');
  if (baseline.solverProfileId !== BASELINE_SOLVER) throw new TypeError('Baseline must be production R2.');
  if (experiment.custody?.status !== 'PASS' || experiment.custody?.accdb?.sha256 !== SHA) {
    throw new TypeError('R8 experiment must carry PASS custody for the pinned ACCDB.');
  }
  if (experiment.measurementBoundary !== 'REAL_PINNED_ACCDB_NONPRODUCTION_ONE_MECHANIC_EXPERIMENT') {
    throw new TypeError('R8 experiment measurement boundary mismatch.');
  }
  if (experiment.productionBoundary?.productionMechanicsChanged !== false) {
    throw new TypeError('R8 experiment must prove productionMechanicsChanged=false.');
  }
  if (experiment.stateContract?.status !== 'PASS') throw new TypeError('R8 state contract must be PASS.');
  const profile = experiment.experimentalProfile;
  record(profile, 'experiment.experimentalProfile');
  if (profile.profileId !== EXPERIMENT_SOLVER) throw new TypeError('Unexpected R8 solver profile.');
  if (Number(profile.normalForceVariationRelative) !== THRESHOLD) throw new TypeError('R8 must use NFV=0.15 exactly.');
  if (profile.normalForceVariationRule !== 'SEED_ON_BREAKAWAY_RETAIN_LE_15_PERCENT_REFRESH_GT_15_PERCENT_DISCARD_ON_STICK_V1') {
    throw new TypeError('R8 retained-normal rule declaration mismatch.');
  }

  const run = firstRun(experiment);
  if (run.converged !== true) return rejectedNonconverged({ caseId, experiment, run });

  const before = mapRows(baseline.restraints, 'baseline.restraints');
  const after = mapRows(run.frictionRestraints, 'experiment.runs[0].frictionRestraints');
  const ids = [...new Set([...before.keys(), ...after.keys()])].sort(text);
  const perRestraint = ids.map((id) => compareRow(id, before.get(id), after.get(id)));
  const comparable = perRestraint.filter((row) => row.comparable);

  const baselineNormalWithinGoal = comparable.filter((row) => row.baselineNormalRelativeError !== null
    && row.baselineNormalRelativeError <= GOAL).length;
  const experimentNormalWithinGoal = comparable.filter((row) => row.experimentNormalRelativeError !== null
    && row.experimentNormalRelativeError <= GOAL).length;
  const baselineTangentialWithinGoal = comparable.filter((row) => row.baselineTangentialRelativeError !== null
    && row.baselineTangentialRelativeError <= GOAL).length;
  const experimentTangentialWithinGoal = comparable.filter((row) => row.experimentTangentialRelativeError !== null
    && row.experimentTangentialRelativeError <= GOAL).length;

  const nfvGate = convergenceGate(run.convergenceGates, 'NFV15_RETAINED_NORMAL_STATE');
  const completeRestraintSet = before.size > 0 && after.size === before.size && comparable.length === before.size;
  const completeMetricSet = completeRestraintSet && comparable.every((row) =>
    row.baselineNormalRelativeError !== null
    && row.experimentNormalRelativeError !== null
    && row.baselineTangentialRelativeError !== null
    && row.experimentTangentialRelativeError !== null);
  const nfvLedgerComplete = completeRestraintSet && comparable.every((row) =>
    row.currentNormalN !== null
    && row.capacityBasisNormalN !== null
    && row.variationRelative !== null
    && row.governedRetainedCapacityN !== null
    && row.currentNormalDiagnosticCapacityN !== null
    && typeof row.refreshedFinalIteration === 'boolean');
  const repeatGate = requestedRepeatGate(experiment.determinism);
  const gates = {
    custody: experiment.custody.status === 'PASS' && experiment.custody.accdb.sha256 === SHA,
    stateContract: experiment.stateContract.status === 'PASS',
    productionUnchanged: experiment.productionBoundary.productionMechanicsChanged === false,
    converged: true,
    equilibrium: run.recoveredEquilibriumStatus === 'PASS',
    nonlinearGates: run.convergenceGates?.status === 'CONVERGED',
    nfvRefreshRule: nfvGate?.status === 'PASS',
    completeRestraintSet,
    completeMetricSet,
    nfvLedgerComplete,
    requestedRepeatDeterminism: repeatGate.status === 'PASS',
  };
  const physicsPass = Object.values(gates).every(Boolean);
  const summary = {
    comparedRestraints: comparable.length,
    baselineNormalWithinGoal,
    experimentNormalWithinGoal,
    normalWithinGoalDelta: experimentNormalWithinGoal - baselineNormalWithinGoal,
    baselineTangentialWithinGoal,
    experimentTangentialWithinGoal,
    tangentialWithinGoalDelta: experimentTangentialWithinGoal - baselineTangentialWithinGoal,
    worstExperimentNormalRelativeError: max(comparable.map((row) => row.experimentNormalRelativeError)),
    worstExperimentTangentialRelativeError: max(comparable.map((row) => row.experimentTangentialRelativeError)),
    regimeComparison: 'NOT_GOVERNED_FROM_FINAL_NORMAL_UNDER_NFV15',
  };
  const nomination = !physicsPass
    ? 'REJECT_R8_MEASUREMENT_PHYSICS_OR_CUSTODY_GATE_FAILED'
    : summary.tangentialWithinGoalDelta > 0 && summary.normalWithinGoalDelta >= 0
      ? 'R8_NFV15_DIRECTIONALLY_NOMINATED_REQUIRES_NEXT_GOVERNED_GATE'
      : 'R8_NFV15_NOT_NOMINATED_BY_FROZEN_ACCURACY_METRICS';

  return Object.freeze({
    schema: 'm047-bm4l-stage2-r8-nfv15-assessment/v4',
    caseId,
    sourceAccdbSha256: SHA,
    baselineSolverProfileId: BASELINE_SOLVER,
    candidateSolverProfileId: EXPERIMENT_SOLVER,
    candidate: 'R8_NFV15',
    threshold: THRESHOLD,
    goalRelative: GOAL,
    gates,
    repeatGate,
    summary,
    nomination,
    determinism: experiment.determinism,
    failure: null,
    productionPromotionAuthorized: false,
    nextGate: nextGate(caseId, nomination),
    perRestraint,
  });
}

function rejectedNonconverged({ caseId, experiment, run }) {
  return Object.freeze({
    schema: 'm047-bm4l-stage2-r8-nfv15-assessment/v4',
    caseId,
    sourceAccdbSha256: SHA,
    baselineSolverProfileId: BASELINE_SOLVER,
    candidateSolverProfileId: EXPERIMENT_SOLVER,
    candidate: 'R8_NFV15',
    threshold: THRESHOLD,
    goalRelative: GOAL,
    gates: {
      custody: experiment.custody.status === 'PASS' && experiment.custody.accdb.sha256 === SHA,
      stateContract: experiment.stateContract.status === 'PASS',
      productionUnchanged: experiment.productionBoundary.productionMechanicsChanged === false,
      converged: false,
      equilibrium: false,
      nonlinearGates: false,
      nfvRefreshRule: false,
      completeRestraintSet: false,
      completeMetricSet: false,
      nfvLedgerComplete: false,
      requestedRepeatDeterminism: false,
    },
    repeatGate: requestedRepeatGate(experiment.determinism),
    summary: {
      comparedRestraints: 0,
      baselineNormalWithinGoal: null,
      experimentNormalWithinGoal: null,
      normalWithinGoalDelta: null,
      baselineTangentialWithinGoal: null,
      experimentTangentialWithinGoal: null,
      tangentialWithinGoalDelta: null,
      worstExperimentNormalRelativeError: null,
      worstExperimentTangentialRelativeError: null,
      regimeComparison: 'NOT_AVAILABLE_NONCONVERGED',
    },
    nomination: 'REJECT_R8_MEASUREMENT_PHYSICS_OR_CUSTODY_GATE_FAILED',
    determinism: experiment.determinism,
    failure: run.failure ?? { message: 'R8 run did not converge.' },
    productionPromotionAuthorized: false,
    nextGate: null,
    perRestraint: [],
  });
}

function requestedRepeatGate(determinism) {
  const requestedRuns = Number(determinism?.requestedRuns ?? 1);
  const completedConvergedRuns = Number(determinism?.completedConvergedRuns ?? 0);
  if (!Number.isInteger(requestedRuns) || requestedRuns < 1) {
    return Object.freeze({ status: 'FAIL', requestedRuns, completedConvergedRuns, determinismStatus: determinism?.status ?? null });
  }
  if (requestedRuns === 1) {
    return Object.freeze({ status: 'PASS', requestedRuns, completedConvergedRuns, determinismStatus: determinism?.status ?? 'NOT_RUN' });
  }
  const passed = determinism?.status === 'PASS' && completedConvergedRuns === requestedRuns;
  return Object.freeze({
    status: passed ? 'PASS' : 'FAIL',
    requestedRuns,
    completedConvergedRuns,
    determinismStatus: determinism?.status ?? null,
  });
}

function nextGate(caseId, nomination) {
  if (!nomination.startsWith('R8_NFV15_DIRECTIONALLY')) return null;
  if (caseId === 'L13') return 'RUN_R8_L7_REAL_PINNED_ACCDB';
  if (caseId === 'L7') return 'RECONSTRUCT_R8_L15_EXACTLY_AS_L7_MINUS_L13';
  if (caseId === 'L1') return 'RUN_DETERMINISM_AND_FROZEN_CONTROLS_BEFORE_ANY_PROMOTION';
  return null;
}

function firstRun(experiment) {
  if (!Array.isArray(experiment.runs) || experiment.runs.length === 0) throw new TypeError('R8 experiment must contain at least one run.');
  const run = experiment.runs[0];
  record(run, 'experiment.runs[0]');
  return run;
}

function convergenceGate(gates, name) {
  if (!gates || !Array.isArray(gates.gates)) return null;
  return gates.gates.find((entry) => entry.gate === name) ?? null;
}

function compareRow(restraintId, baseline, experiment) {
  const baselineNormal = relPercent(baseline?.normal?.percentError);
  const experimentNormal = finite(experiment?.normal?.relativeError);
  const baselineTangential = finite(baseline?.tangential?.vectorRelativeError);
  const experimentTangential = finite(experiment?.tangential?.vectorRelativeError);
  const retained = experiment?.retainedNormalMechanic ?? null;
  return {
    restraintId,
    nodeId: experiment?.nodeId ?? baseline?.nodeId ?? null,
    comparable: Boolean(baseline && experiment),
    baselineNormalRelativeError: baselineNormal,
    experimentNormalRelativeError: experimentNormal,
    normalAbsoluteErrorDelta: baselineNormal === null || experimentNormal === null ? null : experimentNormal - baselineNormal,
    baselineTangentialRelativeError: baselineTangential,
    experimentTangentialRelativeError: experimentTangential,
    tangentialErrorDelta: baselineTangential === null || experimentTangential === null ? null : experimentTangential - baselineTangential,
    retainedNormalEnteringN: nullableFinite(retained?.retainedNormalEnteringN),
    currentNormalN: finite(retained?.currentNormalN),
    capacityBasisNormalN: finite(retained?.capacityBasisNormalN),
    variationRelative: finite(retained?.variationRelative),
    refreshedFinalIteration: typeof retained?.refreshed === 'boolean' ? retained.refreshed : null,
    governedRetainedCapacityN: finite(retained?.governedRetainedCapacityN),
    currentNormalDiagnosticCapacityN: finite(retained?.currentNormalDiagnosticCapacityN),
  };
}

function mapRows(rows, label) {
  if (!Array.isArray(rows)) throw new TypeError(`${label} must be an array.`);
  const mapped = new Map();
  for (const row of rows) {
    const restraintId = row?.restraintId;
    if (restraintId === null || restraintId === undefined || String(restraintId).trim() === '') {
      throw new TypeError(`${label} contains a row without restraintId.`);
    }
    if (mapped.has(restraintId)) throw new TypeError(`${label} contains duplicate restraintId ${String(restraintId)}.`);
    mapped.set(restraintId, row);
  }
  return mapped;
}
function relPercent(value) { const number = finite(value); return number === null ? null : Math.abs(number) / 100; }
function finite(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function nullableFinite(value) { return value === null || value === undefined ? null : finite(value); }
function max(values) { const clean = values.filter((value) => value !== null); return clean.length ? Math.max(...clean) : null; }
function record(value, label) { if (!value || typeof value !== 'object') throw new TypeError(`${label} must be an object.`); }
function text(left, right) { return String(left).localeCompare(String(right), 'en'); }

function parse(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) args.set(argv[index], argv[index + 1]);
  if (!args.get('--baseline') || !args.get('--experiment')) {
    throw new TypeError('Usage: --baseline <R2.json> --experiment <R8.json> [--out <json>]');
  }
  return { baseline: args.get('--baseline'), experiment: args.get('--experiment'), out: args.get('--out') ?? null };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parse(process.argv.slice(2));
  const result = assessR8Nfv15({
    baseline: JSON.parse(readFileSync(resolve(args.baseline), 'utf8')),
    experiment: JSON.parse(readFileSync(resolve(args.experiment), 'utf8')),
  });
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (args.out) {
    const path = resolve(args.out);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, output, 'utf8');
  }
  process.stdout.write(output);
}
