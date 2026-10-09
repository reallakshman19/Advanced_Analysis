#!/usr/bin/env node
/**
 * M047 Stage 2 R8/NFV15 real-file experiment.
 *
 * Non-production by construction: verify the frozen production R2 solver blob,
 * materialize a temporary sibling solver, inject only the documented 15% retained
 * normal mechanic, run one primitive friction case, emit full evidence + CAESAR
 * accuracy, delete the temporary module, and prove production R2 stayed unchanged.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { buildCaesarAccdbBenchmarkPackage, requiredCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-package.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';
import { checkNfv15StateContract, NFV15_RELATIVE } from './lfea-m047-stage2-r8-nfv15-state.mjs';

const PROFILE_PATH = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const PRODUCTION_SOLVER_PATH = 'src/core/fea-benchmarks/caesar-accdb-friction-solve.js';
const EXPECTED_PRODUCTION_SOLVER_GIT_BLOB = '5b3ba1ce89f6ff7509bf8be82361993a32497ad2';
const EXPECTED_ZIP_SHA256 = '978617cba50fa0b1a16c2fa71dc1e0d38e55ac834b191f887d100c6951abd8b9';
const EXPECTED_ZIP_BYTES = 582488;
const EXPECTED_ACCDB_SHA256 = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const EXPECTED_ACCDB_BYTES = 5136384;
const GOAL_RELATIVE = 0.1;
const ALLOWED_CASES = Object.freeze(['L13', 'L7', 'L1']);

export async function runR8Nfv15Experiment(input) {
  const caseId = String(input.caseId ?? 'L13');
  if (!ALLOWED_CASES.includes(caseId)) throw new TypeError(`R8 accepts primitive cases only: ${ALLOWED_CASES.join(', ')}.`);
  const repeatRuns = Number(input.repeatRuns ?? 1);
  if (!Number.isInteger(repeatRuns) || repeatRuns < 1) throw new TypeError('--repeat must be a positive integer.');

  const custody = verifyCustody({ zipPath: input.zipPath, accdbPath: input.accdbPath });
  const stateContract = checkNfv15StateContract();
  if (stateContract.status !== 'PASS') throw new Error('R8/NFV15 state contract is not PASS.');

  const productionPath = resolve(PRODUCTION_SOLVER_PATH);
  const productionBlobBefore = gitBlob(productionPath);
  if (productionBlobBefore !== EXPECTED_PRODUCTION_SOLVER_GIT_BLOB) {
    throw new Error(`Production R2 solver blob ${productionBlobBefore} != expected ${EXPECTED_PRODUCTION_SOLVER_GIT_BLOB}; re-arbitrate before measuring.`);
  }
  const transformed = injectNfv15(readFileSync(productionPath, 'utf8'));
  const tempPath = resolve(`src/core/fea-benchmarks/.m047-r8-nfv15-${process.pid}-${Date.now()}.mjs`);
  writeFileSync(tempPath, transformed.source, 'utf8');

  try {
    const profile = JSON.parse(readFileSync(resolve(input.profilePath ?? PROFILE_PATH), 'utf8'));
    const rawExport = await extractCaesarAccdbTables({
      accdbPath: resolve(input.accdbPath),
      tableNames: requiredCaesarAccdbTables(profile),
    });
    const benchmarkPackage = buildCaesarAccdbBenchmarkPackage({ rawExport, profile });
    if (benchmarkPackage.source.sha256 !== EXPECTED_ACCDB_SHA256) throw new Error('Benchmark package is not the pinned BM4_L member.');

    const solver = await import(`${pathToFileURL(tempPath).href}?r8=${Date.now()}`);
    const experimentalProfile = Object.freeze({
      ...solver.CAESAR_FRICTION_SOLVER_PROFILE,
      profileId: 'CAESAR-ACCDB-FRICTION-SOLVER-R2-R8-NFV15-EXPERIMENT',
      normalForceVariationRelative: NFV15_RELATIVE,
      normalForceVariationRule: 'SEED_ON_BREAKAWAY_RETAIN_LE_15_PERCENT_REFRESH_GT_15_PERCENT_DISCARD_ON_STICK_V1',
    });

    const runs = [];
    for (let run = 1; run <= repeatRuns; run += 1) {
      const startedAtMs = Date.now();
      let actual = null;
      let failure = null;
      try {
        actual = solver.solveCaesarAccdbFrictionBenchmark(benchmarkPackage, [caseId], {
          profile: experimentalProfile,
          frictionStiffnessScale: 1,
        });
      } catch (error) {
        failure = serializeFailure(error);
      }
      runs.push(buildRunRecord({ run, caseId, startedAtMs, actual, failure, benchmarkPackage }));
      if (failure !== null) break;
    }

    const convergedRuns = runs.filter((run) => run.converged);
    const rowHashes = convergedRuns.map((run) => run.actualRowsSemanticHash);
    const determinism = repeatRuns < 2 || convergedRuns.length < 2
      ? { status: 'NOT_RUN', requestedRuns: repeatRuns, completedConvergedRuns: convergedRuns.length }
      : {
        status: new Set(rowHashes).size === 1 ? 'PASS' : 'FAIL',
        requestedRuns: repeatRuns,
        completedConvergedRuns: convergedRuns.length,
        actualRowsSemanticHashes: rowHashes,
      };

    const base = {
      schema: 'm047-stage2-r8-nfv15-real-file-experiment/v1',
      measurementBoundary: 'REAL_PINNED_ACCDB_NONPRODUCTION_ONE_MECHANIC_EXPERIMENT',
      variant: 'R8_NFV15_RETAINED_NORMAL_15_PERCENT',
      caseId,
      goalRelative: GOAL_RELATIVE,
      custody,
      productionBoundary: {
        productionSolverPath: PRODUCTION_SOLVER_PATH,
        expectedProductionSolverGitBlob: EXPECTED_PRODUCTION_SOLVER_GIT_BLOB,
        productionSolverGitBlobBefore: productionBlobBefore,
        experimentSourceSha256: sha256Text(transformed.source),
        transformationCount: transformed.count,
        productionMechanicsChanged: false,
      },
      stateContract,
      experimentalProfile: {
        profileId: experimentalProfile.profileId,
        solutionStrategy: experimentalProfile.solutionStrategy,
        slipDirectionRule: experimentalProfile.slipDirectionRule,
        normalDirectionRule: experimentalProfile.normalDirectionRule,
        normalForceVariationRelative: experimentalProfile.normalForceVariationRelative,
        normalForceVariationRule: experimentalProfile.normalForceVariationRule,
        maximumIterations: experimentalProfile.maximumIterations,
        loadStepping: experimentalProfile.loadStepping,
        frictionStiffnessScale: 1,
      },
      runs,
      determinism,
      accuracyClaimBoundary: 'CANDIDATE_ACCURACY_ONLY_AFTER_CONVERGED_PHYSICS_GATES;_QUALIFICATION_REQUIRES_COMMITTED_ARTIFACT_REPEATS_L15_IDENTITY_AND_FROZEN_CONTROLS',
    };
    return Object.freeze({ ...base, experimentSemanticHash: semanticHash(base) });
  } finally {
    rmSync(tempPath, { force: true });
    const productionBlobAfter = gitBlob(productionPath);
    if (productionBlobAfter !== productionBlobBefore) throw new Error(`Production solver changed during R8 experiment: ${productionBlobBefore} -> ${productionBlobAfter}.`);
  }
}

function buildRunRecord({ run, caseId, startedAtMs, actual, failure, benchmarkPackage }) {
  if (failure !== null) return Object.freeze({ run, converged: false, elapsedMs: Date.now() - startedAtMs, failure, accuracy: null });
  const caseActual = actual.cases[caseId];
  const evidence = actual.mechanics.cases[caseId];
  const comparisons = compareFrictionRestraints({ benchmarkPackage, actual, caseId });
  return Object.freeze({
    run,
    converged: evidence.convergenceGates.status === 'CONVERGED',
    elapsedMs: Date.now() - startedAtMs,
    solverProfileId: evidence.solverProfileId,
    iterationCount: evidence.iterationCount,
    recoveredEquilibriumStatus: evidence.recoveredEquilibrium.status,
    convergenceGates: evidence.convergenceGates,
    accuracy: summarize(comparisons),
    frictionRestraints: comparisons,
    actualRowsSemanticHash: semanticHash(caseActual.rows),
    actualRows: caseActual.rows,
    referenceRowsSemanticHash: semanticHash(benchmarkPackage.references[caseId].rows),
    referenceRows: benchmarkPackage.references[caseId].rows,
    nonlinearEvidence: evidence,
  });
}

function compareFrictionRestraints({ benchmarkPackage, actual, caseId }) {
  const referenceForce = vectorsByNode(benchmarkPackage.references[caseId].rows, ['FORCE', 'MOMENT']);
  const solvedForce = vectorsByNode(actual.cases[caseId].rows, ['FORCE', 'MOMENT']);
  const supports = actual.mechanics.cases[caseId].iterations.at(-1).supports;
  return supports.map((support) => {
    const ref = referenceForce.get(String(support.nodeId)) ?? {};
    const solved = solvedForce.get(String(support.nodeId)) ?? {};
    const referenceTangential = support.frictionDofs.map((dof) => Number(ref[dof] ?? 0));
    const solvedTangential = support.frictionDofs.map((dof) => Number(solved[dof] ?? 0));
    const referenceTangentialMagnitudeN = norm(referenceTangential);
    const solvedTangentialMagnitudeN = norm(solvedTangential);
    const referenceNormalN = Math.abs(Number(ref[support.normalDof] ?? 0));
    const vectorErrorN = norm(solvedTangential.map((value, index) => value - referenceTangential[index]));
    return Object.freeze({
      restraintId: support.restraintId,
      nodeId: support.nodeId,
      normalDof: support.normalDof,
      frictionDofs: support.frictionDofs,
      coefficientOfFriction: support.coefficientOfFriction,
      normal: {
        referenceN: referenceNormalN,
        solvedN: support.normalReactionMagnitudeN,
        relativeError: referenceNormalN === 0 ? null : Math.abs(support.normalReactionMagnitudeN - referenceNormalN) / referenceNormalN,
      },
      tangential: {
        referenceN: referenceTangential,
        solvedN: solvedTangential,
        referenceMagnitudeN: referenceTangentialMagnitudeN,
        solvedMagnitudeN: solvedTangentialMagnitudeN,
        vectorErrorN,
        vectorRelativeError: referenceTangentialMagnitudeN === 0 ? null : vectorErrorN / referenceTangentialMagnitudeN,
      },
      retainedNormalMechanic: {
        currentNormalN: support.normalReactionMagnitudeN,
        retainedNormalEnteringN: support.retainedNormalEnteringN,
        variationRelative: support.normalVariationRelative,
        refreshed: support.normalBasisRefreshed,
        capacityBasisNormalN: support.capacityBasisNormalMagnitudeN,
        governedRetainedCapacityN: support.capacityN,
        currentNormalDiagnosticCapacityN: support.currentNormalDiagnosticCapacityN,
        nextRetainedNormalN: support.nextRetainedNormalMagnitudeN,
      },
      referenceCurrentNormalUtilisationDiagnostic: referenceNormalN === 0 ? null : referenceTangentialMagnitudeN / (support.coefficientOfFriction * referenceNormalN),
      solvedGovernedUtilisation: support.capacityN === 0 ? null : solvedTangentialMagnitudeN / support.capacityN,
      solvedRegime: support.regime,
    });
  });
}

function summarize(rows) {
  const normalComparable = rows.filter((row) => row.normal.relativeError !== null);
  const tangentComparable = rows.filter((row) => row.tangential.vectorRelativeError !== null);
  return Object.freeze({
    frictionRestraintCount: rows.length,
    normalWithinGoal: normalComparable.filter((row) => row.normal.relativeError <= GOAL_RELATIVE).length,
    normalCompared: normalComparable.length,
    normalWorstRelativeError: maximum(normalComparable.map((row) => row.normal.relativeError)),
    tangentialVectorsWithinGoal: tangentComparable.filter((row) => row.tangential.vectorRelativeError <= GOAL_RELATIVE).length,
    tangentialVectorsCompared: tangentComparable.length,
    tangentialWorstRelativeError: maximum(tangentComparable.map((row) => row.tangential.vectorRelativeError)),
    retainedNormalRefreshCountFinalIteration: rows.filter((row) => row.retainedNormalMechanic.refreshed).length,
    note: 'CAESAR regime is not inferred from mu*|N_final| in R8; NFV15 makes final-normal utilisation diagnostic only.',
  });
}

function serializeFailure(error) {
  return Object.freeze({
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    code: error?.code ?? null,
    iterationCount: error?.iterations?.length ?? null,
    lastFailedGates: error?.iterations?.at(-1)?.failedGates ?? null,
    lastFailedGateEvidence: error?.iterations?.at(-1)?.failedGateEvidence ?? null,
    displacementUpdateTail: (error?.iterations ?? []).slice(-8).map((entry) => entry.displacementUpdateNormM),
    reactionUpdateTail: (error?.iterations ?? []).slice(-8).map((entry) => entry.reactionUpdateNormN),
  });
}

function injectNfv15(source) {
  let next = source;
  let count = 0;
  const replace = (needle, replacement, label) => {
    const pieces = next.split(needle);
    if (pieces.length !== 2) throw new Error(`R8 source patch ${label} expected one marker; found ${pieces.length - 1}.`);
    next = `${pieces[0]}${replacement}${pieces[1]}`;
    count += 1;
  };

  replace(
    "import { classifyCaesarCaseFormula, resolveCaesarFrictionAuthority } from './caesar-friction-authority.js';",
    "import { classifyCaesarCaseFormula, resolveCaesarFrictionAuthority } from './caesar-friction-authority.js';\nimport { advanceNfv15 } from '../../../scripts/lfea-m047-stage2-r8-nfv15-state.mjs';",
    'state-helper-import',
  );
  replace(
    "  let states = new Map(plan.supports.map((support) => [support.restraintId, 'STICK']));\n  let slips = new Map(plan.supports.map((support) => [support.restraintId, support.frictionDofs.map(() => 0)]));",
    "  let states = new Map(plan.supports.map((support) => [support.restraintId, 'STICK']));\n  let slips = new Map(plan.supports.map((support) => [support.restraintId, support.frictionDofs.map(() => 0)]));\n  let retainedNormals = new Map(plan.supports.map((support) => [support.restraintId, null]));",
    'retained-normal-state-init',
  );
  replace(
    '    const measured = measureSupports({ plan, executed, states, slips, overlay, profile });',
    '    const measured = measureSupports({ plan, executed, states, slips, retainedNormals, overlay, profile });',
    'measure-input',
  );
  replace(
    "    const nextStates = new Map(measured.map((entry) => [entry.restraintId, entry.nextState]));\n    const mappedSlips = new Map(measured.map((entry) => [entry.restraintId, entry.nextSlip]));",
    "    const nextStates = new Map(measured.map((entry) => [entry.restraintId, entry.nextState]));\n    const nextRetainedNormals = new Map(measured.map((entry) => [entry.restraintId, entry.nextRetainedNormalMagnitudeN]));\n    const mappedSlips = new Map(measured.map((entry) => [entry.restraintId, entry.nextSlip]));",
    'next-retained-normal-state',
  );
  replace('    states = nextStates;\n    slips = nextSlips;', '    states = nextStates;\n    slips = nextSlips;\n    retainedNormals = nextRetainedNormals;', 'retained-normal-advance');
  replace('  const { plan, executed, states, slips, overlay, profile } = input;', '  const { plan, executed, states, slips, retainedNormals, overlay, profile } = input;', 'measure-destructure');
  replace(
    "    const normalMagnitude = Math.abs(signedNormalProjection);\n    const capacityN = support.coefficientOfFriction * normalMagnitude;",
    "    const normalMagnitude = Math.abs(signedNormalProjection);\n    const retainedNormalEnteringN = retainedNormals.get(support.restraintId) ?? null;\n    if (state === 'STICK' && retainedNormalEnteringN !== null) throw new Error(`R8 invariant: STICK ${support.restraintId} has retained normal.`);\n    const retainingNormal = state === 'SLIDE' && retainedNormalEnteringN !== null;\n    const normalVariationRelative = !retainingNormal ? 0 : retainedNormalEnteringN === 0 ? (normalMagnitude === 0 ? 0 : Number.POSITIVE_INFINITY) : Math.abs(normalMagnitude - retainedNormalEnteringN) / retainedNormalEnteringN;\n    const normalBasisRefreshed = retainingNormal && normalVariationRelative > profile.normalForceVariationRelative;\n    const capacityBasisNormalMagnitudeN = retainingNormal && !normalBasisRefreshed ? retainedNormalEnteringN : normalMagnitude;\n    const capacityN = support.coefficientOfFriction * capacityBasisNormalMagnitudeN;\n    const currentNormalDiagnosticCapacityN = support.coefficientOfFriction * normalMagnitude;",
    'capacity-basis',
  );
  replace(
    "    const nextState = trialMagnitude > capacityN + boundary\n      ? 'SLIDE'\n      : trialMagnitude < capacityN - boundary - band\n        ? 'STICK'\n        : state;",
    "    const nextState = trialMagnitude > capacityN + boundary\n      ? 'SLIDE'\n      : trialMagnitude < capacityN - boundary - band\n        ? 'STICK'\n        : state;\n    const nfv = advanceNfv15({ threshold: profile.normalForceVariationRelative, state, nextState, currentNormalMagnitudeN: normalMagnitude, retainedNormalMagnitudeN: retainedNormalEnteringN });\n    if (nfv.capacityNormalMagnitudeN !== capacityBasisNormalMagnitudeN) throw new Error(`R8 capacity-basis mismatch at ${support.restraintId}.`);\n    const nextRetainedNormalMagnitudeN = nfv.nextRetainedNormalMagnitudeN;",
    'state-transition',
  );
  replace(
    "      normalMagnitude,\n      capacityN,",
    "      normalMagnitude,\n      retainedNormalEnteringN,\n      normalVariationRelative,\n      normalBasisRefreshed,\n      capacityBasisNormalMagnitudeN,\n      currentNormalDiagnosticCapacityN,\n      nextRetainedNormalMagnitudeN,\n      nfv,\n      capacityN,",
    'measured-fields',
  );
  replace(
    "        normalReactionMagnitudeN: normalMagnitude,\n        coefficientOfFriction: support.coefficientOfFriction,",
    "        normalReactionMagnitudeN: normalMagnitude,\n        normalForceVariationRelative: profile.normalForceVariationRelative,\n        retainedNormalEnteringN,\n        normalVariationRelative,\n        normalBasisRefreshed,\n        capacityBasisNormalMagnitudeN,\n        currentNormalDiagnosticCapacityN,\n        nextRetainedNormalMagnitudeN,\n        coefficientOfFriction: support.coefficientOfFriction,",
    'ledger-fields',
  );
  replace(
    "  gates.push(gate('COULOMB_CAP_COMPLEMENTARITY', capViolations.length === 0, {\n    violations: capViolations.map((entry) => ({\n      restraintId: entry.restraintId,\n      appliedMagnitudeN: entry.appliedMagnitude,\n      capacityN: entry.capacityN,\n    })),\n  }));",
    "  gates.push(gate('COULOMB_CAP_COMPLEMENTARITY', capViolations.length === 0, {\n    capacityBasis: 'R8_NFV15_RETAINED_NORMAL_WHILE_SLIDING',\n    violations: capViolations.map((entry) => ({ restraintId: entry.restraintId, appliedMagnitudeN: entry.appliedMagnitude, capacityN: entry.capacityN, currentNormalDiagnosticCapacityN: entry.currentNormalDiagnosticCapacityN })),\n  }));\n  const nfvFailures = measured.filter((entry) => {\n    const nfv = entry.nfv;\n    if (entry.state === 'STICK' && nfv.retainedNormalEnteringN !== null) return true;\n    if (entry.nextState === 'STICK' && nfv.nextRetainedNormalMagnitudeN !== null) return true;\n    if (entry.state === 'STICK' && entry.nextState === 'SLIDE') return nfv.nextRetainedNormalMagnitudeN !== entry.normalMagnitude;\n    if (entry.state === 'SLIDE') {\n      if (nfv.retainedNormalEnteringN === null) return true;\n      if (nfv.variationRelative > profile.normalForceVariationRelative) return !nfv.refreshed || nfv.capacityNormalMagnitudeN !== entry.normalMagnitude || nfv.nextRetainedNormalMagnitudeN !== (entry.nextState === 'SLIDE' ? entry.normalMagnitude : null);\n      return nfv.refreshed || nfv.capacityNormalMagnitudeN !== nfv.retainedNormalEnteringN || nfv.nextRetainedNormalMagnitudeN !== (entry.nextState === 'SLIDE' ? nfv.retainedNormalEnteringN : null);\n    }\n    return false;\n  });\n  gates.push(gate('NFV15_RETAINED_NORMAL_STATE', nfvFailures.length === 0, { threshold: profile.normalForceVariationRelative, strictRefreshRule: 'REFRESH_ONLY_WHEN_VARIATION_GT_THRESHOLD', failures: nfvFailures.map((entry) => ({ restraintId: entry.restraintId, nfv: entry.nfv })) }));",
    'nfv-gate',
  );
  return Object.freeze({ source: next, count });
}

function verifyCustody({ zipPath, accdbPath }) {
  if (!zipPath || !accdbPath) throw new TypeError('R8 measurement requires both --zip and --accdb.');
  const zip = fileIdentity(resolve(zipPath));
  const accdb = fileIdentity(resolve(accdbPath));
  if (zip.sha256 !== EXPECTED_ZIP_SHA256 || zip.bytes !== EXPECTED_ZIP_BYTES) throw new Error(`Pinned ZIP custody mismatch: ${zip.sha256}/${zip.bytes}.`);
  if (accdb.sha256 !== EXPECTED_ACCDB_SHA256 || accdb.bytes !== EXPECTED_ACCDB_BYTES) throw new Error(`Pinned ACCDB custody mismatch: ${accdb.sha256}/${accdb.bytes}.`);
  return Object.freeze({
    zip: { ...zip, expectedSha256: EXPECTED_ZIP_SHA256, expectedBytes: EXPECTED_ZIP_BYTES, status: 'PASS' },
    accdb: { ...accdb, expectedSha256: EXPECTED_ACCDB_SHA256, expectedBytes: EXPECTED_ACCDB_BYTES, status: 'PASS' },
    status: 'PASS',
  });
}

function fileIdentity(path) {
  return Object.freeze({ path, bytes: statSync(path).size, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
}
function gitBlob(path) { return execFileSync('git', ['hash-object', path], { encoding: 'utf8' }).trim(); }
function sha256Text(text) { return createHash('sha256').update(text, 'utf8').digest('hex'); }
function vectorsByNode(rows, quantities) {
  const map = new Map();
  for (const row of rows) {
    if (row.entityKind !== 'NODE' || !quantities.includes(row.quantity)) continue;
    const vector = map.get(String(row.entityId)) ?? {};
    vector[row.component] = Number(row.value);
    map.set(String(row.entityId), vector);
  }
  return map;
}
function norm(values) { return Math.hypot(...values); }
function maximum(values) { return values.length === 0 ? null : Math.max(...values); }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
  if (!args.get('--zip') || !args.get('--accdb')) throw new Error('Usage: --zip <BM4_L.zip> --accdb <BM4_L.ACCDB> --case <L13|L7|L1> [--repeat 1] [--out <json>]');
  const caseId = args.get('--case') ?? 'L13';
  const record = await runR8Nfv15Experiment({
    zipPath: args.get('--zip'),
    accdbPath: args.get('--accdb'),
    caseId,
    repeatRuns: args.has('--repeat') ? Number(args.get('--repeat')) : 1,
    profilePath: args.get('--profile') ?? PROFILE_PATH,
  });
  const outPath = resolve(args.get('--out') ?? `reports/lfea-m047-stage2-r8-nfv15-${caseId}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${canonicalPrettyStringify(record)}\n`, 'utf8');
  const first = record.runs[0];
  process.stdout.write([
    `R8/NFV15 ${caseId}`,
    `custody=${record.custody.status}`,
    `converged=${first.converged}`,
    `equilibrium=${first.recoveredEquilibriumStatus ?? 'N/A'}`,
    `normalWithin10=${first.accuracy ? `${first.accuracy.normalWithinGoal}/${first.accuracy.normalCompared}` : 'N/A'}`,
    `tangentWithin10=${first.accuracy ? `${first.accuracy.tangentialVectorsWithinGoal}/${first.accuracy.tangentialVectorsCompared}` : 'N/A'}`,
    `determinism=${record.determinism.status}`,
    `artifact=${outPath}`,
  ].join(' ') + '\n');
}
