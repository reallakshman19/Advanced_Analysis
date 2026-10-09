#!/usr/bin/env node
/**
 * Real-file, one-mechanic L1 diagnostic. This does not modify production code.
 * Only RIGID/REDUCER FLUID_DENSITY is replaced by the already-governed L1 test
 * fluid density before building a counterfactual benchmark package. Production
 * R2 friction numerics and all comparison limits remain unchanged.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCaesarAccdbBenchmarkPackage, requiredCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-package.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';
import { CAESAR_FRICTION_SOLVER_PROFILE, solveCaesarAccdbFrictionBenchmark } from '../src/core/fea-benchmarks/caesar-accdb-friction-solve.js';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';

const PROFILE_PATH = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const EXPECTED_SHA = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const CASE_ID = 'L1';
const DENSITY_SCALE = 1e6;
const TEST_FLUID_DENSITY_KG_PER_M3 = 1000;
const GOAL = 0.1;

export async function runL1UniformWwExperiment(input) {
  const profile = JSON.parse(readFileSync(resolve(input.profilePath ?? PROFILE_PATH), 'utf8'));
  const raw = await extractCaesarAccdbTables({
    accdbPath: input.accdbPath,
    tableNames: requiredCaesarAccdbTables(profile),
    expectedSha256: EXPECTED_SHA,
  });
  const basis = profile.linearSolve?.hydrotestBasis;
  if (!basis || basis.authorityStatus !== 'RESOLVED') {
    throw new TypeError('Resolved hydrotest basis is required.');
  }
  if (Number(basis.testFluidDensityKgPerM3) !== TEST_FLUID_DENSITY_KG_PER_M3) {
    throw new TypeError(`L1 hydrotest fluid density must remain exactly ${TEST_FLUID_DENSITY_KG_PER_M3} kg/m^3.`);
  }
  if (basis.pressureField !== 'HYDRO_PRESSURE') throw new TypeError('L1 must remain bound to HYDRO_PRESSURE.');

  const changedSources = [];
  const mutated = structuredClone(raw);
  const storedDensity = TEST_FLUID_DENSITY_KG_PER_M3 / DENSITY_SCALE;
  for (const row of mutated.tables.INPUT_BASIC_ELEMENT_DATA.rows) {
    if (!(Number(row.RIGID_PTR) > 0 || Number(row.REDUCER_PTR) > 0)) continue;
    const before = Number(row.FLUID_DENSITY);
    if (before === storedDensity) continue;
    row.FLUID_DENSITY = storedDensity;
    changedSources.push({
      sourceElementId: String(row.ELEMENTID),
      kind: Number(row.RIGID_PTR) > 0 ? 'RIGID' : 'REDUCER',
      operatingDensityKgPerM3: before * DENSITY_SCALE,
      hydrotestDensityKgPerM3: TEST_FLUID_DENSITY_KG_PER_M3,
    });
  }
  mutated.provider = `${String(raw.provider)}:L1_UNIFORM_WW_EXPERIMENT`;
  mutated.source = { ...mutated.source, path: `${String(raw.source.path)}#l1-uniform-ww-experiment` };

  const pkg = buildCaesarAccdbBenchmarkPackage({ rawExport: mutated, profile });
  const l1 = pkg.cases.find((row) => row.caseId === CASE_ID);
  if (!l1 || l1.caseClass !== 'HYD' || !String(l1.formula).includes('WW') || !String(l1.formula).includes('HP')) {
    throw new TypeError('L1 must remain the governed HYD WW+HP primitive.');
  }
  let actual = null;
  let failure = null;
  const started = Date.now();
  try {
    actual = solveCaesarAccdbFrictionBenchmark(pkg, [CASE_ID], {
      profile: CAESAR_FRICTION_SOLVER_PROFILE,
      frictionStiffnessScale: 1,
    });
  } catch (error) {
    const iterations = error.iterations ?? [];
    failure = {
      code: error.code ?? null,
      message: error.message,
      iterationCount: iterations.length || null,
      lastFailedGates: iterations.at(-1)?.failedGates ?? null,
      lastFailedGateEvidence: iterations.at(-1)?.failedGateEvidence ?? null,
      displacementUpdateTail: iterations.slice(-12).map((row) => row.displacementUpdateNormM),
      reactionUpdateTail: iterations.slice(-12).map((row) => row.reactionUpdateNormN),
    };
  }
  const comparisons = actual === null ? null : compareSupports(pkg, actual);
  const summary = comparisons === null ? null : summarize(comparisons);
  const evidence = actual?.mechanics.cases[CASE_ID] ?? null;
  const base = {
    schema: 'm047-bm4l-stage2-l1-uniform-ww-experiment/v2',
    variant: 'L1_UNIFORM_WW_SPECIAL_COMPONENT_DENSITY_ONLY',
    benchmarkAuthority: false,
    sourceAccdbSha256: raw.source.sha256,
    expectedSourceAccdbSha256: EXPECTED_SHA,
    caseId: CASE_ID,
    solverProfileId: CAESAR_FRICTION_SOLVER_PROFILE.profileId,
    productionR2NumericsUnchanged: true,
    hydrotestInvariant: {
      authorityStatus: basis.authorityStatus,
      testFluidDensityKgPerM3: TEST_FLUID_DENSITY_KG_PER_M3,
      pressureField: basis.pressureField,
      status: 'PASS',
    },
    changedMechanic: {
      scope: 'WW_CONTENTS_DENSITY_ON_RIGID_AND_REDUCER_ONLY',
      hydrotestDensityKgPerM3: TEST_FLUID_DENSITY_KG_PER_M3,
      pressureField: basis.pressureField,
      changedSourceCount: changedSources.length,
      changedSources,
    },
    elapsedMs: Date.now() - started,
    converged: failure === null,
    failure,
    summary,
    restraints: comparisons,
    nonlinearEvidence: evidence === null ? null : {
      iterationCount: evidence.iterationCount,
      convergenceStatus: evidence.convergenceGates.status,
      equilibriumStatus: evidence.recoveredEquilibrium.status,
      finalRowsSemanticHash: semanticHash(actual.cases[CASE_ID].rows),
    },
    decision: 'DIAGNOSTIC_ONLY_DO_NOT_PROMOTE_WITHOUT_REAL_CONTROL_REGRESSION',
  };
  return Object.freeze({ ...base, experimentSemanticHash: semanticHash(base) });
}

function compareSupports(pkg, actual) {
  const reference = vectors(pkg.references[CASE_ID].rows);
  const solved = vectors(actual.cases[CASE_ID].rows);
  const supports = actual.mechanics.cases[CASE_ID].iterations.at(-1).supports;
  return supports.map((support) => {
    const ref = reference.get(support.nodeId) ?? {};
    const got = solved.get(support.nodeId) ?? {};
    const referenceNormal = Math.abs(ref[support.normalDof] ?? 0);
    const tangentRef = support.frictionDofs.map((dof) => ref[dof] ?? 0);
    const tangentGot = support.frictionDofs.map((dof) => got[dof] ?? 0);
    const refMagnitude = Math.hypot(...tangentRef);
    const vectorError = Math.hypot(...tangentGot.map((value, i) => value - tangentRef[i]));
    return {
      restraintId: support.restraintId,
      nodeId: support.nodeId,
      normal: {
        referenceN: referenceNormal,
        solvedN: support.normalReactionMagnitudeN,
        percentError: referenceNormal === 0 ? null : 100 * (support.normalReactionMagnitudeN - referenceNormal) / referenceNormal,
      },
      tangential: {
        referenceN: tangentRef,
        solvedN: tangentGot,
        referenceMagnitudeN: refMagnitude,
        solvedMagnitudeN: Math.hypot(...tangentGot),
        vectorRelativeError: refMagnitude === 0 ? null : vectorError / refMagnitude,
      },
      regime: support.regime,
    };
  }).sort((a, b) => Math.abs(b.normal.percentError ?? 0) - Math.abs(a.normal.percentError ?? 0));
}

function vectors(rows) {
  const result = new Map();
  for (const row of rows) {
    if (row.entityKind !== 'NODE' || row.quantity !== 'FORCE') continue;
    const vector = result.get(String(row.entityId)) ?? {};
    vector[row.component] = Number(row.value);
    result.set(String(row.entityId), vector);
  }
  return result;
}

function summarize(rows) {
  const normal = rows.filter((row) => row.normal.percentError !== null);
  const tangent = rows.filter((row) => row.tangential.vectorRelativeError !== null);
  if (normal.length !== rows.length || tangent.length !== rows.length || rows.length === 0) {
    throw new TypeError('L1 density discriminator requires complete normal and tangential metrics for every friction restraint.');
  }
  return {
    goalRelative: GOAL,
    frictionRestraintCount: rows.length,
    normalWithinGoal: normal.filter((row) => Math.abs(row.normal.percentError) <= 100 * GOAL).length,
    normalCompared: normal.length,
    normalWorstPercentError: Math.max(...normal.map((row) => Math.abs(row.normal.percentError))),
    tangentialWithinGoal: tangent.filter((row) => row.tangential.vectorRelativeError <= GOAL).length,
    tangentialCompared: tangent.length,
    tangentialWorstRelativeError: Math.max(...tangent.map((row) => row.tangential.vectorRelativeError)),
  };
}

function parse(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 2) args.set(argv[i], argv[i + 1]);
  const accdbPath = args.get('--accdb');
  if (!accdbPath) throw new TypeError('Usage: --accdb <BM4_L.ACCDB> [--profile file] [--out file]');
  return { accdbPath, profilePath: args.get('--profile') ?? PROFILE_PATH, outPath: args.get('--out') ?? null };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parse(process.argv.slice(2));
  const result = await runL1UniformWwExperiment(args);
  if (args.outPath) {
    const path = resolve(args.outPath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${canonicalPrettyStringify(result)}\n`, 'utf8');
  }
  process.stdout.write(`${canonicalPrettyStringify({
    variant: result.variant,
    changedSourceCount: result.changedMechanic.changedSourceCount,
    converged: result.converged,
    failedGates: result.failure?.lastFailedGates ?? [],
    normalWithinGoal: result.summary?.normalWithinGoal ?? null,
    normalCompared: result.summary?.normalCompared ?? null,
    tangentialWithinGoal: result.summary?.tangentialWithinGoal ?? null,
    tangentialCompared: result.summary?.tangentialCompared ?? null,
  })}\n`);
}
