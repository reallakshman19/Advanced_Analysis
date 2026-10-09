#!/usr/bin/env node
/**
 * M047 Stage 2 direction-only nonlinear experiment.
 *
 * This experiment changes exactly one mechanic relative to the governed return-map
 * solver: when a restraint is currently sliding, the capped tangential force is
 * projected opposite the TOTAL relative tangential displacement instead of the
 * retained spring's elastic stretch. Capacity, normal reaction, state boundary,
 * hysteresis, acceleration, tolerances, equilibrium gates and result recovery are
 * unchanged.
 *
 * The production source is never edited. The harness reads it, asserts four exact
 * source transformations, rewrites relative imports to absolute file URLs, loads
 * the transformed module from the OS temp directory, runs it, and deletes it.
 * That makes this a mechanics experiment rather than a silent production change.
 */
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { buildCaesarAccdbBenchmarkPackage, requiredCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-package.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';
import { CAESAR_FRICTION_SOLVER_PROFILE } from '../src/core/fea-benchmarks/caesar-accdb-friction-solve.js';

const PROFILE_PATH = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const SOLVER_PATH = 'src/core/fea-benchmarks/caesar-accdb-friction-solve.js';
const BASELINE_DIRECTION_RULE = 'UNIT_RELATIVE_TANGENTIAL_DISPLACEMENT_V1';
const CANDIDATE_DIRECTION_RULE = 'UNIT_TOTAL_RELATIVE_TANGENTIAL_DISPLACEMENT_V1_EXPERIMENTAL';
const GOAL_RELATIVE = 0.1;
const DIRECTION_COSINE_GOAL = -0.999999;

export async function runDirectionOnlyExperiment(input) {
  const profilePath = resolve(input.profilePath ?? PROFILE_PATH);
  const solverPath = resolve(input.solverPath ?? SOLVER_PATH);
  const baselinePath = resolve(input.baselineIterationPath);
  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const caseId = input.caseId ?? 'L13';

  if (baseline.caseId !== caseId || baseline.converged !== true || !Array.isArray(baseline.restraints)) {
    throw new TypeError(`Baseline iteration must be a converged ${caseId} friction-tuning artifact.`);
  }
  if (baseline.solutionStrategy !== CAESAR_FRICTION_SOLVER_PROFILE.solutionStrategy) {
    throw new TypeError('Baseline iteration was not produced by the governed return-map solution strategy.');
  }
  if (CAESAR_FRICTION_SOLVER_PROFILE.slipDirectionRule !== BASELINE_DIRECTION_RULE) {
    throw new TypeError(
      `Governed production direction rule changed to ${CAESAR_FRICTION_SOLVER_PROFILE.slipDirectionRule}; `
      + 're-baseline the direction experiment before proceeding.',
    );
  }

  const rawExport = await extractCaesarAccdbTables({
    accdbPath: input.accdbPath,
    tableNames: requiredCaesarAccdbTables(profile),
  });
  const benchmarkPackage = buildCaesarAccdbBenchmarkPackage({ rawExport, profile });
  if (benchmarkPackage.source.sha256 !== baseline.sourceAccdbSha256) {
    throw new TypeError(
      `ACCDB custody mismatch: experiment ${benchmarkPackage.source.sha256}, baseline ${baseline.sourceAccdbSha256}.`,
    );
  }

  const candidateModule = await loadCandidateModule(solverPath);
  if (candidateModule.CAESAR_FRICTION_SOLVER_PROFILE.slipDirectionRule !== CANDIDATE_DIRECTION_RULE) {
    throw new TypeError('Transformed solver did not publish the candidate direction rule.');
  }

  const first = runCandidate(candidateModule, benchmarkPackage, caseId);
  const second = runCandidate(candidateModule, benchmarkPackage, caseId);
  if (first.error !== null || second.error !== null) {
    const record = {
      schema: 'm047-bm4l-stage2-direction-only-nonlinear-experiment/v1',
      caseId,
      sourceAccdbSha256: benchmarkPackage.source.sha256,
      baselineArtifact: basename(baselinePath),
      baselineDirectionRule: BASELINE_DIRECTION_RULE,
      candidateDirectionRule: CANDIDATE_DIRECTION_RULE,
      isolatedMechanic:
        'RETURN_MAP_SLIDING_PROJECTION_DIRECTION_ELASTIC_STRETCH_TO_TOTAL_RELATIVE_TANGENTIAL_DISPLACEMENT',
      productionSourceModified: false,
      toleranceChanged: false,
      comparisonPolicyChanged: false,
      candidate: {
        converged: false,
        firstRunFailure: first.error,
        repeatRunFailure: second.error,
      },
      baselineSummary: summarizeBaseline(baseline.restraints),
      candidateSummary: null,
      promotion: {
        status: 'DO_NOT_PROMOTE_FROM_THIS_RUN',
        rule: 'NONCONVERGENCE_IS_EVIDENCE_AND_MUST_NOT_BE_HIDDEN_BY_A_BENCHMARK_ACCURACY_COMPARISON_V1',
        gates: { candidateConverged: false },
      },
      restraints: null,
    };
    return Object.freeze({ ...record, recordSemanticHash: semanticHash(record) });
  }

  const candidate = first.actual;
  const evidence = candidate.mechanics.cases[caseId];
  const repeatEvidence = second.actual.mechanics.cases[caseId];
  const rowsHash = semanticHash(candidate.cases[caseId].rows);
  const repeatRowsHash = semanticHash(second.actual.cases[caseId].rows);
  const deterministic = rowsHash === repeatRowsHash;

  const restraints = compareCandidate({ benchmarkPackage, candidate, baseline, caseId });
  const baselineSummary = summarizeBaseline(baseline.restraints);
  const candidateSummary = summarizeCandidate(restraints);
  const equilibriumPass = evidence.recoveredEquilibrium?.status === 'PASS'
    && repeatEvidence.recoveredEquilibrium?.status === 'PASS';
  const totalDirectionFailures = evidence.iterations.at(-1).supports
    .filter((support) => support.regime === 'SLIDING'
      && (support.oppositionCosine === null || support.oppositionCosine > DIRECTION_COSINE_GOAL));
  const unchangedPhysicsGates = evidence.convergenceGates?.status === 'CONVERGED'
    && repeatEvidence.convergenceGates?.status === 'CONVERGED';
  const normalGate = candidateSummary.normalWithinGoal === candidateSummary.frictionRestraintCount;
  const accuracyImproved = candidateSummary.tangentialVectorsWithinGoal > baselineSummary.tangentialVectorsWithinGoal
    && candidateSummary.medianVectorRelativeError < baselineSummary.medianVectorRelativeError
    && candidateSummary.tangentialWorstRelativeError <= baselineSummary.tangentialWorstRelativeError;

  const promotion = {
    status: deterministic
      && equilibriumPass
      && unchangedPhysicsGates
      && totalDirectionFailures.length === 0
      && normalGate
      && accuracyImproved
      ? 'EVIDENCE_SUPPORTS_PROMOTION_TO_GOVERNED_DIRECTION_RULE'
      : 'DO_NOT_PROMOTE_FROM_THIS_RUN',
    rule: 'PHYSICS_AND_DETERMINISM_FIRST_THEN_ACCURACY_MUST_IMPROVE_WITHOUT_NORMAL_REACTION_REGRESSION_V1',
    gates: {
      candidateConverged: true,
      deterministic,
      equilibriumPass,
      unchangedPhysicsGates,
      slidingForceOpposesTotalTangentialDisplacement: totalDirectionFailures.length === 0,
      allNormalReactionsWithinExistingGoal: normalGate,
      tangentialAccuracyImproved: accuracyImproved,
    },
  };

  const record = {
    schema: 'm047-bm4l-stage2-direction-only-nonlinear-experiment/v1',
    caseId,
    sourceAccdbSha256: benchmarkPackage.source.sha256,
    baselineArtifact: basename(baselinePath),
    baselineDirectionRule: BASELINE_DIRECTION_RULE,
    candidateDirectionRule: CANDIDATE_DIRECTION_RULE,
    isolatedMechanic:
      'RETURN_MAP_SLIDING_PROJECTION_DIRECTION_ELASTIC_STRETCH_TO_TOTAL_RELATIVE_TANGENTIAL_DISPLACEMENT',
    unchangedMechanics: [
      'FRICTION_STIFFNESS',
      'COULOMB_CAPACITY_RULE',
      'SIGNED_NORMAL_PROJECTION',
      'STATE_BOUNDARY',
      'STATE_HYSTERESIS',
      'SLIP_ACCELERATION',
      'CONVERGENCE_LIMITS',
      'PHYSICAL_EQUILIBRIUM_GATE',
      'RESULT_RECOVERY',
    ],
    productionSourceModified: false,
    toleranceChanged: false,
    comparisonPolicyChanged: false,
    candidate: {
      converged: true,
      iterationCount: evidence.iterationCount,
      rowsSemanticHash: rowsHash,
      repeatRowsSemanticHash: repeatRowsHash,
      determinismPass: deterministic,
      recoveredEquilibriumStatus: evidence.recoveredEquilibrium?.status ?? null,
      totalDirectionFailureCount: totalDirectionFailures.length,
      totalDirectionFailures: totalDirectionFailures.map((support) => ({
        restraintId: support.restraintId,
        oppositionCosine: support.oppositionCosine,
      })),
    },
    baselineSummary,
    candidateSummary,
    promotion,
    restraints,
  };
  return Object.freeze({ ...record, recordSemanticHash: semanticHash(record) });
}

function runCandidate(candidateModule, benchmarkPackage, caseId) {
  try {
    return {
      actual: candidateModule.solveCaesarAccdbFrictionBenchmark(benchmarkPackage, [caseId], {
        profile: candidateModule.CAESAR_FRICTION_SOLVER_PROFILE,
      }),
      error: null,
    };
  } catch (error) {
    return {
      actual: null,
      error: {
        message: error.message,
        code: error.code ?? null,
        iterationCount: error.iterations?.length ?? null,
        stateChangesTail: (error.iterations ?? []).slice(-8).map((entry) => entry.stateChangeCount),
        reactionUpdateTailN: (error.iterations ?? []).slice(-8).map((entry) => entry.reactionUpdateNormN),
        displacementUpdateTailM: (error.iterations ?? []).slice(-8).map((entry) => entry.displacementUpdateNormM),
        lastFailedGates: error.iterations?.at(-1)?.failedGates ?? null,
        lastFailedGateEvidence: error.iterations?.at(-1)?.failedGateEvidence ?? null,
      },
    };
  }
}

/**
 * Build the experimental solver source by exact, fail-closed transformations.
 * Exported for the static contract check; never writes the production source.
 */
export function buildCandidateSource(productionSource, solverPath = resolve(SOLVER_PATH)) {
  let source = String(productionSource);
  source = replaceExactly(source,
    `slipDirectionRule: '${BASELINE_DIRECTION_RULE}',`,
    `slipDirectionRule: '${CANDIDATE_DIRECTION_RULE}',`,
    'solver profile direction rule');

  source = replaceExactly(source,
`    // Return mapping: project the trial force onto the Coulomb cap and carry the
    // difference as slip. A sticking support keeps its slip unchanged.
    const nextSlip = nextState === 'SLIDE' && trialMagnitude > 0
      ? tangentialDisplacement.map((value, index) =>
        value + (capacityN / trialMagnitude) * trialForce[index] / stiffness)
      : [...slip];`,
`    // Experimental direction-only variant: keep the same Coulomb magnitude and
    // state logic, but make the capped force oppose total relative tangential
    // displacement. Because F_t = -k_f (u_t - u_slip), the required return point is
    // u_slip = u_t - (capacity/k_f) * unit(u_t).
    const totalDirectionMagnitude = norm(tangentialDisplacement);
    const nextSlip = nextState === 'SLIDE' && totalDirectionMagnitude > profile.zeroTangentialMotionFloorM
      ? tangentialDisplacement.map((value) =>
        value - (capacityN / stiffness) * value / totalDirectionMagnitude)
      : [...slip];`,
    'return-map projection direction');

  source = replaceExactly(source,
    '    const frictionDirectionCosine = stretchCosine;',
    '    const frictionDirectionCosine = oppositionCosine;',
    'governing direction cosine');

  source = replaceExactly(source,
    "    rule: 'COSINE_BETWEEN_NET_FRICTION_FORCE_AND_CURRENT_ELASTIC_TANGENTIAL_STRETCH',",
    "    rule: 'COSINE_BETWEEN_NET_FRICTION_FORCE_AND_TOTAL_RELATIVE_TANGENTIAL_DISPLACEMENT',",
    'direction convergence gate evidence');

  const solverDir = dirname(solverPath);
  source = source.replace(/from '((?:\.\.\/|\.\/)[^']+)'/gu, (_match, specifier) =>
    `from '${pathToFileURL(resolve(solverDir, specifier)).href}'`);
  return source;
}

async function loadCandidateModule(solverPath) {
  const productionSource = readFileSync(solverPath, 'utf8');
  const source = buildCandidateSource(productionSource, solverPath);
  const tempPath = resolve(tmpdir(), `m047-direction-only-${process.pid}-${Date.now()}.mjs`);
  writeFileSync(tempPath, source, 'utf8');
  try {
    return await import(`${pathToFileURL(tempPath).href}?candidate=${Date.now()}`);
  } finally {
    try { unlinkSync(tempPath); } catch { /* best-effort temp cleanup */ }
  }
}

function replaceExactly(source, oldText, newText, label) {
  const first = source.indexOf(oldText);
  if (first < 0) throw new TypeError(`Direction experiment cannot find expected ${label}.`);
  if (source.indexOf(oldText, first + oldText.length) >= 0) {
    throw new TypeError(`Direction experiment found more than one ${label}; transformation is ambiguous.`);
  }
  return `${source.slice(0, first)}${newText}${source.slice(first + oldText.length)}`;
}

function compareCandidate({ benchmarkPackage, candidate, baseline, caseId }) {
  const reference = vectorsByNode(benchmarkPackage.references[caseId].rows);
  const solved = vectorsByNode(candidate.cases[caseId].rows);
  const baselineById = new Map(baseline.restraints.map((row) => [row.restraintId, row]));
  const supports = candidate.mechanics.cases[caseId].iterations.at(-1).supports;
  return supports.map((support) => {
    const baselineRow = baselineById.get(support.restraintId);
    if (!baselineRow) throw new TypeError(`Baseline is missing friction restraint ${support.restraintId}.`);
    const referenceVector = reference.get(support.nodeId) ?? {};
    const solvedVector = solved.get(support.nodeId) ?? {};
    const referenceTangential = support.frictionDofs.map((dof) => referenceVector[dof] ?? 0);
    const candidateTangential = support.frictionDofs.map((dof) => solvedVector[dof] ?? 0);
    const referenceMagnitude = norm(referenceTangential);
    const candidateMagnitude = norm(candidateTangential);
    const vectorError = norm(candidateTangential.map((value, index) => value - referenceTangential[index]));
    const directionCosine = cosine(candidateTangential, referenceTangential);
    const baselineRelative = baselineRow.tangential.vectorRelativeError;
    const candidateRelative = referenceMagnitude === 0 ? null : vectorError / referenceMagnitude;
    const referenceNormal = baselineRow.normal.referenceN;
    const candidateNormal = support.normalReactionMagnitudeN;
    return {
      restraintId: support.restraintId,
      nodeId: support.nodeId,
      frictionDofs: support.frictionDofs,
      regime: support.regime,
      referenceTangentialN: referenceTangential,
      baselineTangentialN: baselineRow.tangential.solvedN,
      candidateTangentialN: candidateTangential,
      referenceMagnitudeN: referenceMagnitude,
      baselineMagnitudeN: baselineRow.tangential.solvedMagnitudeN,
      candidateMagnitudeN: candidateMagnitude,
      baselineVectorRelativeError: baselineRelative,
      candidateVectorRelativeError: candidateRelative,
      vectorRelativeErrorDelta: candidateRelative === null || baselineRelative === null
        ? null : candidateRelative - baselineRelative,
      candidateDirectionCosineToReference: directionCosine,
      candidateOppositionCosineToTotalDisplacement: support.oppositionCosine,
      normal: {
        referenceN: referenceNormal,
        candidateN: candidateNormal,
        candidatePercentError: referenceNormal === 0 ? null
          : ((candidateNormal - referenceNormal) / Math.abs(referenceNormal)) * 100,
      },
    };
  }).sort((left, right) =>
    (right.candidateVectorRelativeError ?? -Infinity) - (left.candidateVectorRelativeError ?? -Infinity));
}

function summarizeBaseline(restraints) {
  const comparable = restraints.filter((row) => row.tangential.vectorRelativeError !== null);
  return summarizeRelativeErrors(
    restraints.length,
    comparable.map((row) => row.tangential.vectorRelativeError),
    restraints.filter((row) => row.normal.percentError !== null
      && Math.abs(row.normal.percentError) <= GOAL_RELATIVE * 100).length,
  );
}

function summarizeCandidate(restraints) {
  const comparable = restraints.filter((row) => row.candidateVectorRelativeError !== null);
  return summarizeRelativeErrors(
    restraints.length,
    comparable.map((row) => row.candidateVectorRelativeError),
    restraints.filter((row) => row.normal.candidatePercentError !== null
      && Math.abs(row.normal.candidatePercentError) <= GOAL_RELATIVE * 100).length,
  );
}

function summarizeRelativeErrors(restraintCount, relativeErrors, normalWithinGoal) {
  const ordered = [...relativeErrors].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  const median = ordered.length === 0 ? null
    : ordered.length % 2 === 1 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
  return {
    frictionRestraintCount: restraintCount,
    tangentialVectorsCompared: ordered.length,
    tangentialVectorsWithinGoal: ordered.filter((value) => value <= GOAL_RELATIVE).length,
    tangentialWorstRelativeError: ordered.length === 0 ? null : ordered.at(-1),
    medianVectorRelativeError: median,
    normalWithinGoal,
  };
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

function cosine(left, right) {
  const denominator = norm(left) * norm(right);
  return denominator === 0 ? null : dot(left, right) / denominator;
}

function norm(values) {
  return Math.hypot(...values);
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function textReport(record) {
  const b = record.baselineSummary;
  const c = record.candidateSummary;
  const lines = [
    `case                 ${record.caseId}`,
    `baseline rule        ${record.baselineDirectionRule}`,
    `candidate rule       ${record.candidateDirectionRule}`,
    `candidate converged  ${record.candidate.converged}`,
    `promotion            ${record.promotion.status}`,
  ];
  if (!record.candidate.converged) {
    lines.push(
      `first failure        ${record.candidate.firstRunFailure?.message ?? 'none'}`,
      `repeat failure       ${record.candidate.repeatRunFailure?.message ?? 'none'}`,
    );
    return lines.join('\n');
  }
  lines.push(
    `deterministic        ${record.candidate.determinismPass}`,
    `equilibrium          ${record.candidate.recoveredEquilibriumStatus}`,
    `direction failures   ${record.candidate.totalDirectionFailureCount}`,
    '',
    `vectors within +-10% baseline ${b.tangentialVectorsWithinGoal}/${b.tangentialVectorsCompared}`,
    `vectors within +-10% candidate ${c.tangentialVectorsWithinGoal}/${c.tangentialVectorsCompared}`,
    `median vector error baseline   ${(100 * b.medianVectorRelativeError).toFixed(1)}%`,
    `median vector error candidate  ${(100 * c.medianVectorRelativeError).toFixed(1)}%`,
    `worst vector error baseline    ${(100 * b.tangentialWorstRelativeError).toFixed(1)}%`,
    `worst vector error candidate   ${(100 * c.tangentialWorstRelativeError).toFixed(1)}%`,
    `normal within +-10% candidate  ${c.normalWithinGoal}/${c.frictionRestraintCount}`,
    '',
    'restraint                    base err%  cand err%  delta pp  cos(ref)',
  );
  for (const row of record.restraints) {
    lines.push([
      row.restraintId.padEnd(28),
      (100 * (row.baselineVectorRelativeError ?? 0)).toFixed(1).padStart(9),
      (100 * (row.candidateVectorRelativeError ?? 0)).toFixed(1).padStart(10),
      (100 * (row.vectorRelativeErrorDelta ?? 0)).toFixed(1).padStart(9),
      (row.candidateDirectionCosineToReference ?? 0).toFixed(4).padStart(9),
    ].join(' '));
  }
  return lines.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 2) args.set(argv[index], argv[index + 1]);
  const accdbPath = args.get('--accdb');
  const baselineIterationPath = args.get('--baseline');
  if (!accdbPath || !baselineIterationPath) {
    throw new TypeError('Usage: --accdb <BM4_L.ACCDB> --baseline <L13-iteration.json> [--case L13] [--out <json>]');
  }
  const record = await runDirectionOnlyExperiment({
    accdbPath,
    baselineIterationPath,
    caseId: args.get('--case') ?? 'L13',
  });
  const outPath = args.get('--out');
  if (outPath) {
    mkdirSync(dirname(resolve(outPath)), { recursive: true });
    writeFileSync(resolve(outPath), `${canonicalPrettyStringify(record)}\n`, 'utf8');
  }
  process.stdout.write(`${textReport(record)}\n`);
}
