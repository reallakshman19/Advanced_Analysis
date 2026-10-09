#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCaesarAccdbBenchmarkPackage, requiredCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-package.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';
import { CAESAR_FRICTION_SOLVER_PROFILE, solveCaesarAccdbFrictionBenchmark } from '../src/core/fea-benchmarks/caesar-accdb-friction-solve.js';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';

const PROFILE = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const BASELINE = 'reports/lfea-m047-stage2-r2-rebaseline/L1.json';
const SHA = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const SOLVER = 'CAESAR-ACCDB-FRICTION-SOLVER-R2';
const TEST_FLUID_DENSITY_KG_PER_M3 = 1000;
const GOAL = 0.1;

export async function runHydInsulationFalse(input) {
  const profile = JSON.parse(readFileSync(resolve(input.profilePath ?? PROFILE), 'utf8'));
  const baseline = JSON.parse(readFileSync(resolve(input.baselinePath ?? BASELINE), 'utf8'));
  validateBaseline(baseline);
  const hydro = validateHydrotestBasis(profile);
  const authority = resolveSetting(profile);
  if (authority.value !== false) throw new Error(`Include Insulation in Hydrotest resolves ${authority.value}; false experiment is not authorized.`);
  const raw = await extractCaesarAccdbTables({ accdbPath: input.accdbPath, tableNames: requiredCaesarAccdbTables(profile), expectedSha256: SHA });
  const mutated = structuredClone(raw);
  const changed = [];
  for (const row of mutated.tables.INPUT_BASIC_ELEMENT_DATA.rows) {
    if (!(Number(row.INSUL_THICK) > 0) || !(Number(row.INSUL_DENSITY) > 0)) continue;
    changed.push({ elementId: String(row.ELEMENTID), thickness: Number(row.INSUL_THICK), density: Number(row.INSUL_DENSITY) });
    row.INSUL_THICK = 0;
    row.INSUL_DENSITY = 0;
  }
  if (changed.length === 0) throw new Error('No positive BM4_L insulation rows were found.');
  mutated.provider = `${raw.provider}:HYD_INSULATION_FALSE`;
  const pkg = buildCaesarAccdbBenchmarkPackage({ rawExport: mutated, profile });
  const l1 = pkg.cases.find((row) => row.caseId === 'L1');
  if (!l1 || l1.caseClass !== 'HYD' || !String(l1.formula).includes('WW') || !String(l1.formula).includes('HP')) {
    throw new Error('L1 is not the expected HYD WW+HP primitive.');
  }
  const started = Date.now();
  let actual;
  try {
    actual = solveCaesarAccdbFrictionBenchmark(pkg, ['L1'], { profile: CAESAR_FRICTION_SOLVER_PROFILE, frictionStiffnessScale: 1 });
  } catch (error) {
    const record = {
      schema: 'm047-l1-hyd-insulation-false/v2',
      sourceAccdbSha256: raw.source.sha256,
      authority,
      hydrotestInvariant: hydro,
      changedSourceCount: changed.length,
      converged: false,
      failure: {
        code: error.code ?? null,
        message: error.message,
        iterationCount: error.iterations?.length ?? null,
        failedGates: error.iterations?.at(-1)?.failedGates ?? null,
      },
      productionPromotionAuthorized: false,
    };
    return { ...record, semanticHash: semanticHash(record) };
  }
  const rows = compare(pkg, actual, baseline);
  const summary = summarize(rows, baseline);
  const evidence = actual.mechanics.cases.L1;
  if (evidence.convergenceGates.status !== 'CONVERGED' || evidence.recoveredEquilibrium.status !== 'PASS') {
    throw new Error('L1 insulation experiment returned without converged nonlinear gates and recovered equilibrium PASS.');
  }
  const record = {
    schema: 'm047-l1-hyd-insulation-false/v2',
    variant: 'L1_WW_INCLUDE_INSULATION_IN_HYDROTEST_FALSE_ONLY',
    sourceAccdbSha256: raw.source.sha256,
    authority,
    hydrotestInvariant: hydro,
    changedSourceCount: changed.length,
    changedSources: changed,
    unchanged: {
      testFluidDensityKgPerM3: TEST_FLUID_DENSITY_KG_PER_M3,
      pressureField: hydro.pressureField,
      frictionProfile: CAESAR_FRICTION_SOLVER_PROFILE.profileId,
    },
    elapsedMs: Date.now() - started,
    converged: true,
    equilibriumStatus: evidence.recoveredEquilibrium.status,
    failedGates: evidence.convergenceGates.failedGates,
    summary,
    restraints: rows,
    finalRowsSemanticHash: semanticHash(actual.cases.L1.rows),
    productionPromotionAuthorized: false,
    nextGate: 'Only a real-file nomination may authorize a separate production implementation followed by frozen L2-L6/L14 controls and nominal repeats.',
  };
  return { ...record, semanticHash: semanticHash(record) };
}

function validateBaseline(baseline) {
  if (!baseline || typeof baseline !== 'object') throw new TypeError('Committed L1 baseline must be an object.');
  if (baseline.caseId !== 'L1' || baseline.converged !== true) throw new TypeError('Committed baseline must be converged L1.');
  if (baseline.sourceAccdbSha256 !== SHA) throw new TypeError('Committed L1 baseline is not bound to the pinned ACCDB.');
  if (baseline.solverProfileId !== SOLVER) throw new TypeError('Committed L1 baseline must use production R2.');
  if (!Array.isArray(baseline.restraints) || baseline.restraints.length === 0) throw new TypeError('Committed L1 baseline must carry restraint metrics.');
  requiredFinite(baseline.summary?.normalWithinGoal, 'baseline.summary.normalWithinGoal');
  requiredFinite(baseline.summary?.normalWorstPercentError, 'baseline.summary.normalWorstPercentError');
}

function validateHydrotestBasis(profile) {
  const hydro = profile.linearSolve?.hydrotestBasis;
  if (!hydro || hydro.authorityStatus !== 'RESOLVED') throw new TypeError('L1 hydrotest basis must remain RESOLVED.');
  if (Number(hydro.testFluidDensityKgPerM3) !== TEST_FLUID_DENSITY_KG_PER_M3) {
    throw new TypeError(`L1 hydrotest fluid density must remain exactly ${TEST_FLUID_DENSITY_KG_PER_M3} kg/m^3.`);
  }
  if (hydro.pressureField !== 'HYDRO_PRESSURE') throw new TypeError('L1 HP must remain bound to HYDRO_PRESSURE.');
  return Object.freeze({
    status: 'PASS',
    authorityStatus: hydro.authorityStatus,
    testFluidDensityKgPerM3: TEST_FLUID_DENSITY_KG_PER_M3,
    pressureField: hydro.pressureField,
  });
}

function resolveSetting(profile) {
  const layers = profile.configurationAuthority.layers;
  const values = [
    ['OVERALL_GLOBAL_DEFAULT', layers.overallGlobalDefault?.settings?.INCLUDE_INSULATION_IN_HYDROTEST],
    ['INDIVIDUAL_FILE_SETTING', layers.individualFile?.settings?.INCLUDE_INSULATION_IN_HYDROTEST],
    ['LOAD_CASE_SETTING', layers.loadCase?.cases?.L1?.INCLUDE_INSULATION_IN_HYDROTEST],
    ['MODEL_INPUT', layers.modelInput?.settings?.INCLUDE_INSULATION_IN_HYDROTEST],
  ].filter(([, value]) => value !== undefined);
  if (values.length === 0) return { value: false, level: 'CAESAR_II_V14_DEFAULT', source: 'HEXAGON_V14_1403380' };
  const [level, raw] = values.at(-1);
  const value = typeof raw === 'object' && raw !== null ? raw.value : raw;
  if (typeof value !== 'boolean') throw new Error('Include Insulation in Hydrotest must resolve to boolean.');
  return { value, level, source: 'BM4L_CONFIGURATION_AUTHORITY' };
}

function compare(pkg, actual, baseline) {
  const ref = vectors(pkg.references.L1.rows);
  const prior = uniqueByRestraint(baseline.restraints, 'baseline.restraints');
  const supports = actual.mechanics.cases.L1.iterations.at(-1).supports;
  const rows = supports.map((support) => {
    const r = ref.get(support.nodeId) ?? {};
    const rn = Math.abs(r[support.normalDof] ?? 0);
    const solved = support.normalReactionMagnitudeN;
    const error = rn === 0 ? null : 100 * (solved - rn) / rn;
    const oldRow = prior.get(support.restraintId);
    if (!oldRow) throw new TypeError(`L1 insulation experiment has no baseline row for restraint ${support.restraintId}.`);
    const old = requiredFinite(oldRow.normal?.percentError, `baseline restraint ${support.restraintId} normal.percentError`);
    if (error === null || !Number.isFinite(error)) throw new TypeError(`L1 insulation experiment normal metric is not comparable at ${support.restraintId}.`);
    return {
      restraintId: support.restraintId,
      nodeId: support.nodeId,
      referenceNormalN: rn,
      solvedNormalN: solved,
      normalPercentError: error,
      baselineNormalPercentError: old,
      absoluteErrorChangePercentPoints: Math.abs(error) - Math.abs(old),
    };
  });
  if (rows.length !== prior.size) {
    throw new TypeError(`L1 insulation restraint coverage mismatch: experiment=${rows.length}, baseline=${prior.size}.`);
  }
  uniqueByRestraint(rows, 'experiment.restraints');
  return rows;
}

function vectors(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row.entityKind !== 'NODE' || row.quantity !== 'FORCE') continue;
    const v = map.get(String(row.entityId)) ?? {};
    v[row.component] = Number(row.value);
    map.set(String(row.entityId), v);
  }
  return map;
}

function summarize(rows, baseline) {
  if (rows.length === 0) throw new TypeError('L1 insulation experiment has no comparable restraints.');
  const within = rows.filter((row) => Math.abs(row.normalPercentError) <= 100 * GOAL).length;
  const worst = Math.max(...rows.map((row) => Math.abs(row.normalPercentError)));
  const improved = rows.filter((row) => row.absoluteErrorChangePercentPoints < 0).length;
  const worsened = rows.filter((row) => row.absoluteErrorChangePercentPoints > 0).length;
  const oldWithin = requiredFinite(baseline.summary.normalWithinGoal, 'baseline.summary.normalWithinGoal');
  const oldWorst = requiredFinite(baseline.summary.normalWorstPercentError, 'baseline.summary.normalWorstPercentError');
  return {
    normalWithinGoal: within,
    normalCompared: rows.length,
    normalWorstPercentError: worst,
    baselineNormalWithinGoal: oldWithin,
    baselineNormalWorstPercentError: oldWorst,
    improvedNormalCount: improved,
    worsenedNormalCount: worsened,
    nominationStatus: within > oldWithin && worst < oldWorst && improved > worsened
      ? 'NOMINATE_FOR_SEPARATE_PRODUCTION_CHANGE'
      : 'DO_NOT_NOMINATE',
  };
}

function uniqueByRestraint(rows, label) {
  if (!Array.isArray(rows)) throw new TypeError(`${label} must be an array.`);
  const map = new Map();
  for (const row of rows) {
    const id = row?.restraintId;
    if (id === null || id === undefined || String(id).trim() === '') throw new TypeError(`${label} contains a row without restraintId.`);
    if (map.has(id)) throw new TypeError(`${label} contains duplicate restraintId ${String(id)}.`);
    map.set(id, row);
  }
  return map;
}

function requiredFinite(value, label) {
  if (value === null || value === undefined || typeof value === 'boolean') throw new TypeError(`${label} must be finite.`);
  if (typeof value === 'string' && value.trim() === '') throw new TypeError(`${label} must be finite.`);
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite.`);
  return number;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
  if (!args.get('--accdb')) throw new Error('Usage: --accdb <BM4_L.ACCDB> [--out file]');
  const result = await runHydInsulationFalse({ accdbPath: args.get('--accdb'), outPath: args.get('--out') });
  if (args.get('--out')) {
    const out = resolve(args.get('--out'));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${canonicalPrettyStringify(result)}\n`);
  }
  process.stdout.write(`${canonicalPrettyStringify({
    converged: result.converged,
    authority: result.authority,
    hydrotestInvariant: result.hydrotestInvariant,
    summary: result.summary ?? null,
    failedGates: result.failedGates ?? result.failure?.failedGates ?? null,
    productionPromotionAuthorized: false,
  })}\n`);
}
