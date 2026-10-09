#!/usr/bin/env node
/**
 * M047 Stage 2 P1 experiment — D1 with a per-tangential-axis Coulomb box.
 *
 * This is an isolated nonlinear discriminator. It starts from the already-staged
 * D1 total-relative-displacement direction transform and changes one mechanic:
 *
 *   resultant circle: ||F_t||_2 <= mu|N|
 *   per-axis box:     |F_i| <= mu|N| for every free tangential axis i
 *
 * D1 force direction remains exactly opposite total relative tangential
 * displacement. Along that unchanged direction, the box-surface resultant is
 * mu|N| / max_i |unit_i|. One-axis restraints are therefore mathematically
 * identical to the D1 resultant cap and act as negative controls.
 *
 * Production source is never edited. The transformed solver is loaded from a
 * temporary module and run twice. All convergence limits, normal-force basis,
 * friction stiffness, state hysteresis, load path, acceleration, equilibrium
 * checks, comparison threshold and ACCDB authority remain unchanged.
 */
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { buildCaesarAccdbBenchmarkPackage, requiredCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-package.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';
import { buildCandidateSource as buildD1CandidateSource } from './lfea-m047-stage2-direction-only-experiment.mjs';

const PROFILE_PATH = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const SOLVER_PATH = 'src/core/fea-benchmarks/caesar-accdb-friction-solve.js';
const PROFILE_ID = 'CAESAR-ACCDB-FRICTION-SOLVER-R1-D1-PER-AXIS-BOX-CAP';
const CAPACITY_RULE = 'PER_TANGENTIAL_AXIS_BOX_USES_SAME_MU_TIMES_OWN_NORMAL_V1';
const D1_DIRECTION_RULE = 'UNIT_TOTAL_RELATIVE_TANGENTIAL_DISPLACEMENT_V1_EXPERIMENTAL';
const GOAL_RELATIVE = 0.1;
const PINNED_ACCDB_SHA256 = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';

export async function runPerAxisCapExperiment(input) {
  const caseId = input.caseId ?? 'L13';
  if (caseId !== 'L13') throw new TypeError('P1 is restricted to governed L13.');
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
    throw new TypeError(`P1 ACCDB custody mismatch: ${benchmarkPackage.source.sha256}.`);
  }

  const solverPath = resolve(input.solverPath ?? SOLVER_PATH);
  const loaded = await loadCandidateModule(solverPath);
  const candidateProfile = loaded.module.CAESAR_FRICTION_SOLVER_PROFILE;
  if (candidateProfile.profileId !== PROFILE_ID) throw new Error(`P1 profile mismatch ${candidateProfile.profileId}.`);
  if (candidateProfile.capacityRule !== CAPACITY_RULE) throw new Error(`P1 capacity rule mismatch ${candidateProfile.capacityRule}.`);
  if (candidateProfile.slipDirectionRule !== D1_DIRECTION_RULE) {
    throw new Error(`P1 did not preserve D1 direction rule: ${candidateProfile.slipDirectionRule}.`);
  }

  const first = runCandidate(loaded.module, benchmarkPackage, caseId);
  const second = runCandidate(loaded.module, benchmarkPackage, caseId);
  if (first.error !== null || second.error !== null) {
    const record = {
      schema: 'm047-bm4l-stage2-d1-per-axis-cap-experiment/v1',
      measurementBoundary: 'REAL_PINNED_ACCDB_EPHEMERAL_D1_PER_AXIS_CAP',
      caseId,
      sourceAccdbSha256: benchmarkPackage.source.sha256,
      baselineD1Evidence: basename(d1EvidencePath),
      productionSolverModified: false,
      isolatedMechanic: 'COULOMB_CAPACITY_SURFACE_RESULTANT_CIRCLE_TO_PER_AXIS_BOX',
      directionRule: D1_DIRECTION_RULE,
      candidateProfileId: PROFILE_ID,
      candidateSourceSha256: loaded.sha256,
      toleranceChanged: false,
      comparisonPolicyChanged: false,
      candidate: {
        converged: false,
        firstRunFailure: first.error,
        repeatRunFailure: second.error,
      },
      baselineSummary: d1BaselineSummary(d1),
      candidateSummary: null,
      restraints: null,
      decision: 'REJECT_P1_NONCONVERGED_KEEP_D1',
    };
    return Object.freeze({ ...record, semanticHash: semanticHash(record) });
  }

  const actual = first.actual;
  const repeat = second.actual;
  const evidence = actual.mechanics.cases[caseId];
  const repeatEvidence = repeat.mechanics.cases[caseId];
  const rowsSemanticHash = semanticHash(actual.cases[caseId].rows);
  const repeatRowsSemanticHash = semanticHash(repeat.cases[caseId].rows);
  const deterministic = rowsSemanticHash === repeatRowsSemanticHash;
  const restraints = compareCandidate({ benchmarkPackage, actual, d1, caseId });
  const candidateSummary = summarizeCandidate(restraints);
  const baselineSummary = d1BaselineSummary(d1);
  const equilibriumPass = evidence.recoveredEquilibrium?.status === 'PASS'
    && repeatEvidence.recoveredEquilibrium?.status === 'PASS';
  const convergencePass = evidence.convergenceGates?.status === 'CONVERGED'
    && repeatEvidence.convergenceGates?.status === 'CONVERGED';
  const oneAxis = restraints.filter((row) => row.frictionDofs.length === 1);
  const partitionTargets = restraints.filter((row) => row.referencePerAxisSignature);
  const named = Object.fromEntries(['22140', '22220', '22370', '21470', '20710']
    .map((nodeId) => [nodeId, restraints.find((row) => row.nodeId === nodeId) ?? null]));

  const record = {
    schema: 'm047-bm4l-stage2-d1-per-axis-cap-experiment/v1',
    measurementBoundary: 'REAL_PINNED_ACCDB_EPHEMERAL_D1_PER_AXIS_CAP',
    caseId,
    sourceAccdbSha256: benchmarkPackage.source.sha256,
    baselineD1Evidence: basename(d1EvidencePath),
    productionSolverModified: false,
    isolatedMechanic: 'COULOMB_CAPACITY_SURFACE_RESULTANT_CIRCLE_TO_PER_AXIS_BOX',
    capacityRule: CAPACITY_RULE,
    directionRule: D1_DIRECTION_RULE,
    unchangedMechanics: [
      'D1_TOTAL_RELATIVE_TANGENTIAL_FORCE_DIRECTION',
      'OWN_RESTRAINT_SIGNED_NORMAL_BASIS',
      'FRICTION_STIFFNESS',
      'STATE_HYSTERESIS_WIDTH',
      'SLIP_ACCELERATION',
      'FULL_LOAD_SINGLE_STEP_L13_PATH',
      'CONVERGENCE_LIMITS',
      'RECOVERED_PHYSICAL_EQUILIBRIUM_GATE',
      'TEN_PERCENT_COMPARISON_GOAL',
    ],
    candidateProfileId: PROFILE_ID,
    candidateSourceSha256: loaded.sha256,
    toleranceChanged: false,
    comparisonPolicyChanged: false,
    candidate: {
      converged: true,
      deterministic,
      rowsSemanticHash,
      repeatRowsSemanticHash,
      iterationCount: evidence.iterationCount,
      repeatIterationCount: repeatEvidence.iterationCount,
      equilibriumPass,
      convergencePass,
    },
    baselineSummary,
    candidateSummary,
    referencePerAxisSignature: {
      count: partitionTargets.length,
      restraintIds: partitionTargets.map((row) => row.restraintId),
      baselineVectorsWithin10Pct: partitionTargets.filter((row) => row.baselineVectorErrorPct <= 10).length,
      candidateVectorsWithin10Pct: partitionTargets.filter((row) => row.candidateVectorErrorPct <= 10).length,
    },
    oneAxisNegativeControl: {
      count: oneAxis.length,
      restraintIds: oneAxis.map((row) => row.restraintId),
      note: 'LOCAL_CAP_GEOMETRY_IS_IDENTICAL_FOR_ONE_FREE_TANGENT; GLOBAL_RESPONSE_MAY_STILL_MOVE_THROUGH_COUPLING',
    },
    namedDiagnostics: named,
    restraints,
    decision: decide({ deterministic, equilibriumPass, convergencePass, baselineSummary, candidateSummary, partitionTargets, named }),
  };
  return Object.freeze({ ...record, semanticHash: semanticHash(record) });
}

function decide(input) {
  if (!input.deterministic || !input.equilibriumPass || !input.convergencePass) {
    return 'REJECT_P1_PHYSICS_OR_DETERMINISM_GATE_KEEP_D1';
  }
  const targetImproved = input.partitionTargets.length > 0
    && median(input.partitionTargets.map((row) => row.candidateVectorErrorPct))
      < median(input.partitionTargets.map((row) => row.baselineVectorErrorPct));
  const aggregateImproved = input.candidateSummary.vectorsWithin10Pct > input.baselineSummary.vectorsWithin10Pct
    && input.candidateSummary.medianVectorErrorPct < input.baselineSummary.medianVectorErrorPct;
  if (targetImproved && aggregateImproved && input.candidateSummary.normalsWithin10Pct === 23) {
    return 'P1_CAPACITY_PARTITION_SIGNAL_PRESENT_REQUIRES_GOVERNED_REVIEW_NOT_PRODUCTION_PROMOTION';
  }
  return 'REJECT_P1_AS_MISSING_GLOBAL_MECHANISM_KEEP_D1';
}

function runCandidate(module, benchmarkPackage, caseId) {
  try {
    return {
      actual: module.solveCaesarAccdbFrictionBenchmark(benchmarkPackage, [caseId], {
        profile: module.CAESAR_FRICTION_SOLVER_PROFILE,
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
        failedGates: error.iterations?.at(-1)?.failedGates ?? null,
        reactionUpdateTailN: (error.iterations ?? []).slice(-8).map((entry) => entry.reactionUpdateNormN),
        displacementUpdateTailM: (error.iterations ?? []).slice(-8).map((entry) => entry.displacementUpdateNormM),
      },
    };
  }
}

export function buildPerAxisCandidateSource(productionSource, solverPath = resolve(SOLVER_PATH)) {
  let source = buildD1CandidateSource(String(productionSource), solverPath);
  source = replaceExactly(source,
    "  profileId: 'CAESAR-ACCDB-FRICTION-SOLVER-R1',",
    `  profileId: '${PROFILE_ID}',`,
    'profile id');
  source = replaceExactly(source,
    "  capacityRule: 'BIDIRECTIONAL_SUPPORT_USES_NORMAL_REACTION_MAGNITUDE_V1',",
    `  capacityRule: '${CAPACITY_RULE}',`,
    'capacity rule');

  source = replaceExactly(source,
`    const band = profile.stateHysteresisRelative * capacityN;
    const nextState = trialMagnitude > capacityN + boundary
      ? 'SLIDE'
      : trialMagnitude < capacityN - boundary - band
        ? 'STICK'
        : state;
    // Experimental direction-only variant: keep the same Coulomb magnitude and
    // state logic, but make the capped force oppose total relative tangential
    // displacement. Because F_t = -k_f (u_t - u_slip), the required return point is
    // u_slip = u_t - (capacity/k_f) * unit(u_t).
    const totalDirectionMagnitude = norm(tangentialDisplacement);
    const nextSlip = nextState === 'SLIDE' && totalDirectionMagnitude > profile.zeroTangentialMotionFloorM
      ? tangentialDisplacement.map((value) =>
        value - (capacityN / stiffness) * value / totalDirectionMagnitude)
      : [...slip];`,
`    const band = profile.stateHysteresisRelative * capacityN;
    const trialMaximumComponentN = maximum(trialForce.map((value) => Math.abs(value)));
    const nextState = trialMaximumComponentN > capacityN + boundary
      ? 'SLIDE'
      : trialMaximumComponentN < capacityN - boundary - band
        ? 'STICK'
        : state;
    // P1 changes only the capacity surface. D1 direction remains opposite total
    // relative tangential displacement. The box boundary along that direction is
    // reached when its largest absolute component equals mu|N|.
    const totalDirectionMagnitude = norm(tangentialDisplacement);
    const totalDirectionUnit = totalDirectionMagnitude > profile.zeroTangentialMotionFloorM
      ? tangentialDisplacement.map((value) => value / totalDirectionMagnitude)
      : null;
    const maximumDirectionComponent = totalDirectionUnit === null
      ? 1
      : maximum(totalDirectionUnit.map((value) => Math.abs(value)));
    const boxSurfaceResultantCapacityN = capacityN / maximumDirectionComponent;
    const cappedForce = nextState === 'SLIDE' && totalDirectionUnit !== null
      ? totalDirectionUnit.map((value) => -boxSurfaceResultantCapacityN * value)
      : null;
    const nextSlip = cappedForce === null
      ? [...slip]
      : tangentialDisplacement.map((value, index) => value + cappedForce[index] / stiffness);`,
    'D1 state and return-map block');

  source = replaceExactly(source,
    '    const slideResidualN = Math.abs(netMagnitude - capacityN);',
    '    const slideResidualN = Math.abs(maximum(netForce.map((value) => Math.abs(value))) - capacityN);',
    'slide residual');

  source = replaceExactly(source,
`  const capViolations = measured.filter((entry) => entry.appliedMagnitude > entry.capacityN
    + Math.max(profile.capViolationAbsoluteN, profile.capViolationRelative * entry.capacityN));
  gates.push(gate('COULOMB_CAP_COMPLEMENTARITY', capViolations.length === 0, {
    violations: capViolations.map((entry) => ({
      restraintId: entry.restraintId,
      appliedMagnitudeN: entry.appliedMagnitude,
      capacityN: entry.capacityN,
    })),
  }));`,
`  const capViolations = measured.filter((entry) => entry.appliedForce.some((value) => Math.abs(value) > entry.capacityN
    + Math.max(profile.capViolationAbsoluteN, profile.capViolationRelative * entry.capacityN)));
  gates.push(gate('COULOMB_CAP_COMPLEMENTARITY', capViolations.length === 0, {
    capacitySurface: 'PER_TANGENTIAL_AXIS_BOX',
    violations: capViolations.map((entry) => ({
      restraintId: entry.restraintId,
      maximumAppliedComponentN: maximum(entry.appliedForce.map((value) => Math.abs(value))),
      appliedResultantMagnitudeN: entry.appliedMagnitude,
      capacityPerAxisN: entry.capacityN,
    })),
  }));`,
    'cap complementarity gate');

  source = replaceExactly(source,
`      normalMagnitude,
      capacityN,
      appliedForce: netForce,`,
`      normalMagnitude,
      capacityN,
      capacitySurface: 'PER_TANGENTIAL_AXIS_BOX',
      appliedForce: netForce,`,
    'measured capacity surface');

  source = replaceExactly(source,
`        frictionStiffnessNPerM: stiffness,
        capacityN,
        trialTangentialSpringForceN:`,
`        frictionStiffnessNPerM: stiffness,
        capacityN,
        capacitySurface: 'PER_TANGENTIAL_AXIS_BOX',
        boxSurfaceResultantCapacityN,
        trialTangentialSpringForceN:`,
    'ledger capacity evidence');

  return source;
}

async function loadCandidateModule(solverPath) {
  const productionSource = readFileSync(solverPath, 'utf8');
  const source = buildPerAxisCandidateSource(productionSource, solverPath);
  const sha256 = await sha256Text(source);
  const tempPath = resolve(tmpdir(), `m047-d1-per-axis-${process.pid}-${Date.now()}.mjs`);
  writeFileSync(tempPath, source, 'utf8');
  try {
    return { module: await import(`${pathToFileURL(tempPath).href}?p1=${Date.now()}`), sha256 };
  } finally {
    try { unlinkSync(tempPath); } catch { /* best-effort cleanup */ }
  }
}

async function sha256Text(text) {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(text).digest('hex');
}

function compareCandidate({ benchmarkPackage, actual, d1, caseId }) {
  const reference = vectorsByNode(benchmarkPackage.references[caseId].rows);
  const solved = vectorsByNode(actual.cases[caseId].rows);
  const d1ById = new Map(d1.d1.restraints.map((row) => [row.id, row]));
  const supports = actual.mechanics.cases[caseId].iterations.at(-1).supports;
  return supports.map((support) => {
    const baseline = d1ById.get(support.restraintId);
    if (!baseline) throw new TypeError(`P1 D1 evidence missing ${support.restraintId}.`);
    const refVector = reference.get(String(support.nodeId)) ?? {};
    const solvedVector = solved.get(String(support.nodeId)) ?? {};
    const ftRef = support.frictionDofs.map((dof) => Number(refVector[dof] ?? 0));
    const ftCandidate = support.frictionDofs.map((dof) => Number(solvedVector[dof] ?? 0));
    const refMagnitude = norm(ftRef);
    const candidateErrorPct = refMagnitude === 0 ? null
      : 100 * norm(ftCandidate.map((value, index) => value - ftRef[index])) / refMagnitude;
    const refNormal = Math.abs(Number(refVector[support.normalDof] ?? 0));
    const candidateNormal = support.normalReactionMagnitudeN;
    const cap = support.coefficientOfFriction * refNormal;
    const perAxisSignature = support.frictionDofs.length > 1
      && refMagnitude > cap
      && ftRef.every((value) => Math.abs(value) <= cap);
    return {
      restraintId: support.restraintId,
      nodeId: String(support.nodeId),
      frictionDofs: [...support.frictionDofs],
      referenceTangentialN: ftRef,
      baselineTangentialN: baseline.ftSol,
      candidateTangentialN: ftCandidate,
      baselineVectorErrorPct: baseline.vecErrPct,
      candidateVectorErrorPct: candidateErrorPct,
      vectorErrorDeltaPctPoints: candidateErrorPct === null ? null : candidateErrorPct - baseline.vecErrPct,
      referenceNormalN: refNormal,
      candidateNormalN: candidateNormal,
      candidateNormalErrorPct: refNormal === 0 ? null : 100 * (candidateNormal - refNormal) / refNormal,
      referenceCapacityN: cap,
      referenceResultantUtilisation: cap === 0 ? null : refMagnitude / cap,
      referenceMaximumComponentUtilisation: cap === 0 ? null : maximum(ftRef.map((value) => Math.abs(value))) / cap,
      referencePerAxisSignature: perAxisSignature,
      candidateRegime: support.regime,
      candidateAppliedResultantN: support.appliedFrictionForceMagnitudeN,
      candidateMaximumAppliedComponentN: maximum(support.appliedFrictionForceN.map((value) => Math.abs(value))),
      candidateCapacityPerAxisN: support.capacityN,
      candidateOppositionCosine: support.oppositionCosine,
    };
  }).sort((left, right) => (right.candidateVectorErrorPct ?? -Infinity) - (left.candidateVectorErrorPct ?? -Infinity));
}

function d1BaselineSummary(d1) {
  const rows = d1.d1.restraints;
  return {
    vectorsWithin10Pct: d1.d1.summary.tangentialVectorsWithinGoal,
    vectorsCompared: d1.d1.summary.tangentialVectorsCompared,
    normalsWithin10Pct: d1.d1.summary.normalWithinGoal,
    medianVectorErrorPct: median(rows.map((row) => row.vecErrPct)),
    worstVectorErrorPct: maximum(rows.map((row) => row.vecErrPct)),
    normalizedStateMatches: d1.d1.constitutiveStateMatches,
  };
}

function summarizeCandidate(rows) {
  const comparable = rows.filter((row) => row.candidateVectorErrorPct !== null);
  return {
    vectorsWithin10Pct: comparable.filter((row) => row.candidateVectorErrorPct <= 10).length,
    vectorsCompared: comparable.length,
    normalsWithin10Pct: rows.filter((row) => row.candidateNormalErrorPct !== null
      && Math.abs(row.candidateNormalErrorPct) <= 10).length,
    medianVectorErrorPct: median(comparable.map((row) => row.candidateVectorErrorPct)),
    worstVectorErrorPct: maximum(comparable.map((row) => row.candidateVectorErrorPct)),
    normalizedStateMatches: rows.filter((row) => {
      const baseline = row.referenceResultantUtilisation !== null && row.referenceResultantUtilisation >= 0.98 ? 'SLID' : 'STUCK';
      const candidate = row.candidateRegime === 'SLIDING' ? 'SLID' : 'STUCK';
      return baseline === candidate;
    }).length,
  };
}

function validateD1Evidence(d1) {
  if (d1.schema !== 'm047-bm4l-stage2-real-d1-evidence/v1') throw new TypeError('P1 requires compact real D1 evidence v1.');
  if (d1.measurementBoundary !== 'REAL_PINNED_ACCDB_LOCAL_SOLVE') throw new TypeError('P1 requires real pinned-ACCDB D1 evidence.');
  if (d1.source?.accdbSha256 !== PINNED_ACCDB_SHA256) throw new TypeError('P1 D1 ACCDB hash mismatch.');
  if (d1.d1?.caseId !== 'L13' || d1.d1?.converged !== true) throw new TypeError('P1 requires converged real L13 D1.');
  if (d1.d1?.summary?.tangentialVectorsWithinGoal !== 13 || d1.d1?.summary?.normalWithinGoal !== 23) {
    throw new TypeError('P1 D1 headline metrics do not match accepted baseline.');
  }
  if (!Array.isArray(d1.d1?.restraints) || d1.d1.restraints.length !== 23) throw new TypeError('P1 requires 23 D1 restraint rows.');
}

function replaceExactly(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new TypeError(`P1 cannot find expected ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) throw new TypeError(`P1 found ambiguous ${label}.`);
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
  const ordered = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (ordered.length === 0) return null;
  const mid = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1 ? ordered[mid] : (ordered[mid - 1] + ordered[mid]) / 2;
}

function textReport(record) {
  const lines = [
    `case                ${record.caseId}`,
    `candidate profile   ${record.candidateProfileId}`,
    `candidate converged ${record.candidate.converged}`,
    `decision            ${record.decision}`,
  ];
  if (!record.candidate.converged) {
    lines.push(`first failure       ${record.candidate.firstRunFailure?.message ?? 'none'}`);
    return lines.join('\n');
  }
  lines.push(
    `deterministic       ${record.candidate.deterministic}`,
    `equilibrium         ${record.candidate.equilibriumPass}`,
    `iterations          ${record.candidate.iterationCount}`,
    `D1 vectors          ${record.baselineSummary.vectorsWithin10Pct}/${record.baselineSummary.vectorsCompared}`,
    `P1 vectors          ${record.candidateSummary.vectorsWithin10Pct}/${record.candidateSummary.vectorsCompared}`,
    `D1 median error     ${record.baselineSummary.medianVectorErrorPct.toFixed(2)}%`,
    `P1 median error     ${record.candidateSummary.medianVectorErrorPct.toFixed(2)}%`,
    `P1 normals          ${record.candidateSummary.normalsWithin10Pct}/23`,
    `partition targets   ${record.referencePerAxisSignature.restraintIds.join(', ') || '<none>'}`,
  );
  for (const nodeId of ['22140', '22220', '22370', '21470', '20710']) {
    const row = record.namedDiagnostics[nodeId];
    if (row) lines.push(`${nodeId} D1=${row.baselineVectorErrorPct.toFixed(2)}% P1=${row.candidateVectorErrorPct.toFixed(2)}%`);
  }
  return lines.join('\n');
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
  const record = await runPerAxisCapExperiment({ accdbPath, d1EvidencePath, caseId: args.get('--case') ?? 'L13' });
  const out = args.get('--out');
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(resolve(out), `${canonicalPrettyStringify(record)}\n`, 'utf8');
  }
  process.stdout.write(`${textReport(record)}\n`);
}
