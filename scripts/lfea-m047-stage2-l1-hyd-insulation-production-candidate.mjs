#!/usr/bin/env node
/**
 * M047 Stage 2 L1 hydrotest-insulation production-candidate runner.
 *
 * This is a fail-closed qualification harness for the staged source patch. It
 * never edits a checked-in production file: the exact frozen linear/friction
 * blobs are verified, the one-mechanic linear patch is materialized in temporary
 * sibling modules, controls are compared against the unmodified linear solver,
 * L1 is repeated through the R2 nonlinear solver, and temporary modules are
 * deleted before exit.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildCaesarAccdbBenchmarkPackage, requiredCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-package.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';
import { solveCaesarAccdbLinearBenchmark as solveFrozenControls } from '../src/core/fea-benchmarks/caesar-accdb-linear-solve.js';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';

const PROFILE = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const LINEAR = 'src/core/fea-benchmarks/caesar-accdb-linear-solve.js';
const FRICTION = 'src/core/fea-benchmarks/caesar-accdb-friction-solve.js';
const EXPECTED_LINEAR_BLOB = 'd28e3c5e893cea3ae44e116daf18fcdca0d22107';
const EXPECTED_FRICTION_BLOB = '5b3ba1ce89f6ff7509bf8be82361993a32497ad2';
const ACCDB_SHA = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const ACCDB_BYTES = 5136384;
const CONTROL_CASES = Object.freeze(['L2', 'L3', 'L4', 'L5', 'L6', 'L14']);
const GOAL = 0.10;

export async function runL1HydInsulationProductionCandidate(input) {
  if (!input?.accdbPath) throw new TypeError('accdbPath is required.');
  const out = resolve(input.outPath ?? 'reports/lfea-m047-stage2-l1-hyd-insulation-production-candidate.json');
  const repeatRuns = Number(input.repeatRuns ?? 2);
  if (!Number.isInteger(repeatRuns) || repeatRuns < 2) throw new TypeError('repeatRuns must be an integer >= 2.');

  const accdb = identity(resolve(input.accdbPath));
  if (accdb.sha256 !== ACCDB_SHA || accdb.bytes !== ACCDB_BYTES) {
    throw new Error(`Pinned BM4_L.ACCDB required; got ${accdb.sha256}/${accdb.bytes}.`);
  }
  const linearPath = resolve(LINEAR);
  const frictionPath = resolve(FRICTION);
  const linearBlobBefore = gitBlob(linearPath);
  const frictionBlobBefore = gitBlob(frictionPath);
  if (linearBlobBefore !== EXPECTED_LINEAR_BLOB) throw new Error(`Frozen linear blob drift: ${linearBlobBefore}.`);
  if (frictionBlobBefore !== EXPECTED_FRICTION_BLOB) throw new Error(`Frozen friction blob drift: ${frictionBlobBefore}.`);

  const token = `${process.pid}-${Date.now()}`;
  const tempLinearPath = resolve(`src/core/fea-benchmarks/.m047-l1-hyd-insulation-linear-${token}.mjs`);
  const tempFrictionPath = resolve(`src/core/fea-benchmarks/.m047-l1-hyd-insulation-friction-${token}.mjs`);
  const transformedLinear = injectHydInsulationProductionPatch(readFileSync(linearPath, 'utf8'));
  const tempLinearName = tempLinearPath.split('/').at(-1);
  const transformedFriction = replaceOnce(
    readFileSync(frictionPath, 'utf8'),
    "from './caesar-accdb-linear-solve.js';",
    `from './${tempLinearName}';`,
    'friction-linear-import',
  );
  writeFileSync(tempLinearPath, transformedLinear.source, 'utf8');
  writeFileSync(tempFrictionPath, transformedFriction.source, 'utf8');

  try {
    const profile = JSON.parse(readFileSync(resolve(input.profilePath ?? PROFILE), 'utf8'));
    const raw = await extractCaesarAccdbTables({
      accdbPath: resolve(input.accdbPath),
      tableNames: requiredCaesarAccdbTables(profile),
      expectedSha256: ACCDB_SHA,
    });
    const pkg = buildCaesarAccdbBenchmarkPackage({ rawExport: raw, profile });
    const candidateLinear = await import(`${pathToFileURL(tempLinearPath).href}?candidate=${Date.now()}`);
    const candidateFriction = await import(`${pathToFileURL(tempFrictionPath).href}?candidate=${Date.now()}`);

    const baselineControls = solveFrozenControls(pkg, [...CONTROL_CASES]);
    const candidateControls = candidateLinear.solveCaesarAccdbLinearBenchmark(pkg, [...CONTROL_CASES]);
    const controls = compareControls(baselineControls, candidateControls);
    if (controls.status !== 'PASS') throw new Error('Frozen L2-L6/L14 controls changed under hydrotest-insulation candidate.');

    const l1Record = pkg.cases.find((row) => row.caseId === 'L1');
    if (!l1Record) throw new Error('Pinned benchmark package has no L1.');
    const prepared = candidateLinear.prepareCaesarAccdbCaseState({
      benchmarkPackage: pkg,
      caseRecord: l1Record,
      solveProfile: pkg.profile.linearSolve,
      gate: candidateLinear.CAESAR_ACCDB_CASE_GATES.NONLINEAR_EFFECTIVE_FRICTION,
      frictionDofKeys: [],
    });
    if (prepared.hydrotestInsulation?.value !== false) throw new Error('L1 hydrotest insulation did not resolve false.');

    const runs = [];
    for (let index = 0; index < repeatRuns; index += 1) {
      const started = Date.now();
      const actual = candidateFriction.solveCaesarAccdbFrictionBenchmark(pkg, ['L1'], {
        profile: candidateFriction.CAESAR_FRICTION_SOLVER_PROFILE,
        frictionStiffnessScale: 1,
      });
      runs.push(summarizeL1({ pkg, actual, elapsedMs: Date.now() - started }));
    }
    const rowHashes = runs.map((run) => run.finalRowsSemanticHash);
    const deterministic = new Set(rowHashes).size === 1;
    if (!deterministic) throw new Error('Repeated L1 candidate runs are not deterministic.');

    const base = {
      schema: 'm047-stage2-l1-hyd-insulation-production-candidate/v1',
      measurementBoundary: 'PINNED_REAL_ACCDB_TEMPORARY_SOURCE_PATCH_NO_PRODUCTION_FILE_MUTATION',
      sourceAccdb: { ...accdb, status: 'PASS' },
      frozenSource: {
        linearBlob: linearBlobBefore,
        frictionBlob: frictionBlobBefore,
      },
      sourcePatch: {
        transformationCount: transformedLinear.count,
        candidateLinearSha256: sha256Text(transformedLinear.source),
        rule: 'ONLY_HYDROTEST_INSULATION_GRAVITY_IS_CHANGED',
      },
      authority: prepared.hydrotestInsulation,
      controls,
      runs,
      determinism: { status: 'PASS', repeatRuns, finalRowsSemanticHashes: rowHashes },
      densityCandidateIncluded: false,
      productionFilesChanged: false,
      productionPromotionAuthorized: false,
      limitation: 'Stage 2 friction parity remains unqualified; L1 tangential accuracy is diagnostic and cannot be absorbed by changing acceptance limits.',
    };
    const result = Object.freeze({ ...base, semanticHash: semanticHash(base) });
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${canonicalPrettyStringify(result)}\n`, 'utf8');
    return result;
  } finally {
    rmSync(tempLinearPath, { force: true });
    rmSync(tempFrictionPath, { force: true });
    const linearBlobAfter = gitBlob(linearPath);
    const frictionBlobAfter = gitBlob(frictionPath);
    if (linearBlobAfter !== linearBlobBefore || frictionBlobAfter !== frictionBlobBefore) {
      throw new Error('Production source blob changed during candidate run.');
    }
  }
}

function compareControls(baseline, candidate) {
  const cases = {};
  let pass = true;
  for (const caseId of CONTROL_CASES) {
    const before = baseline.cases[caseId];
    const after = candidate.cases[caseId];
    const rowHashBefore = semanticHash(before.rows);
    const rowHashAfter = semanticHash(after.rows);
    const rowIdentical = rowHashBefore === rowHashAfter;
    const executionIdentical = before.executionSemanticHash === after.executionSemanticHash;
    const stiffnessIdentical = before.stiffnessStateHash === after.stiffnessStateHash;
    pass = pass && rowIdentical && executionIdentical && stiffnessIdentical;
    cases[caseId] = {
      rowCount: before.rows.length,
      rowHashBefore,
      rowHashAfter,
      rowIdentical,
      executionSemanticHashBefore: before.executionSemanticHash,
      executionSemanticHashAfter: after.executionSemanticHash,
      executionIdentical,
      stiffnessStateHashBefore: before.stiffnessStateHash,
      stiffnessStateHashAfter: after.stiffnessStateHash,
      stiffnessIdentical,
    };
  }
  return Object.freeze({ status: pass ? 'PASS' : 'FAIL', cases });
}

function summarizeL1({ pkg, actual, elapsedMs }) {
  const evidence = actual.mechanics.cases.L1;
  if (evidence.convergenceGates.status !== 'CONVERGED') throw new Error('L1 candidate did not converge.');
  if (evidence.recoveredEquilibrium.status !== 'PASS') throw new Error('L1 candidate recovered equilibrium failed.');
  if (evidence.executionStatus !== 'QUALIFIED') throw new Error('L1 candidate solver execution was not QUALIFIED.');
  const reference = vectors(pkg.references.L1.rows);
  const solved = vectors(actual.cases.L1.rows);
  const supports = evidence.iterations.at(-1).supports.map((support) => {
    const ref = reference.get(String(support.nodeId)) ?? {};
    const got = solved.get(String(support.nodeId)) ?? {};
    const referenceNormalN = Math.abs(Number(ref[support.normalDof] ?? 0));
    const normalPercentError = referenceNormalN === 0
      ? null
      : 100 * (support.normalReactionMagnitudeN - referenceNormalN) / referenceNormalN;
    const referenceTangential = support.frictionDofs.map((dof) => Number(ref[dof] ?? 0));
    const solvedTangential = support.frictionDofs.map((dof) => Number(got[dof] ?? 0));
    const referenceMagnitude = Math.hypot(...referenceTangential);
    const vectorRelativeError = referenceMagnitude === 0
      ? null
      : Math.hypot(...solvedTangential.map((value, i) => value - referenceTangential[i])) / referenceMagnitude;
    return { restraintId: support.restraintId, nodeId: support.nodeId, normalPercentError, vectorRelativeError };
  });
  const normals = supports.filter((row) => row.normalPercentError !== null);
  const tangents = supports.filter((row) => row.vectorRelativeError !== null);
  return Object.freeze({
    elapsedMs,
    iterationCount: evidence.iterationCount,
    convergenceStatus: evidence.convergenceGates.status,
    failedGates: evidence.convergenceGates.failedGates,
    equilibriumStatus: evidence.recoveredEquilibrium.status,
    executionStatus: evidence.executionStatus,
    normalWithinGoal: normals.filter((row) => Math.abs(row.normalPercentError) <= 100 * GOAL).length,
    normalCompared: normals.length,
    normalWorstPercentError: Math.max(...normals.map((row) => Math.abs(row.normalPercentError))),
    tangentialWithinGoal: tangents.filter((row) => row.vectorRelativeError <= GOAL).length,
    tangentialCompared: tangents.length,
    tangentialWorstRelativeError: Math.max(...tangents.map((row) => row.vectorRelativeError)),
    finalRowsSemanticHash: semanticHash(actual.cases.L1.rows),
  });
}

function injectHydInsulationProductionPatch(source) {
  let next = source;
  let count = 0;
  const replace = (needle, replacement, label) => {
    const changed = replaceOnce(next, needle, replacement, label);
    next = changed.source;
    count += changed.count;
  };
  replace(
    "import { resolveCaesarConfigurationSetting } from './caesar-configuration-authority.js';",
    "import {\n  resolveCaesarConfigurationLedger,\n  resolveCaesarConfigurationSetting,\n} from './caesar-configuration-authority.js';",
    'configuration-ledger-import',
  );
  replace(
    '  const caseMode = resolveSupportedLinearCaseMode(benchmarkPackage, caseRecord);\n  const effectiveConfiguration = resolveCaseConfiguration(',
    '  const caseMode = resolveSupportedLinearCaseMode(benchmarkPackage, caseRecord);\n  const hydrotestInsulation = caseMode.hydrotest\n    ? resolveHydrotestInsulationAuthority(benchmarkPackage.profile.configurationAuthority, caseRecord.caseId)\n    : null;\n  const effectiveConfiguration = resolveCaseConfiguration(',
    'hydrotest-authority-resolution',
  );
  replace(
    '    teeModifierBySourceElementId,\n  });',
    '    teeModifierBySourceElementId,\n    hydrotestInsulation,\n  });',
    'analysis-input',
  );
  replace(
    '    caseMode,\n    effectiveConfiguration,\n    frictionAuthority,',
    '    caseMode,\n    hydrotestInsulation,\n    effectiveConfiguration,\n    frictionAuthority,',
    'prepared-state',
  );
  replace(
    '    benchmarkPackage, caseRecord, solveProfile, caseMode, effectiveConfiguration, frictionAuthority,',
    '    benchmarkPackage, caseRecord, solveProfile, caseMode, hydrotestInsulation, effectiveConfiguration, frictionAuthority,',
    'execute-destructure',
  );
  replace(
    '      hydrotestBasis: caseMode.hydrotestBasis,\n      executionStatus: execution.status,',
    '      hydrotestBasis: caseMode.hydrotestBasis,\n      ...(hydrotestInsulation === null ? {} : { hydrotestInsulation }),\n      executionStatus: execution.status,',
    'hydrotest-evidence',
  );
  replace(
    '      input.caseMode.contentsDensityKgPerM3,\n    );',
    '      input.caseMode.contentsDensityKgPerM3,\n      insulationWeightIncluded(input.hydrotestInsulation),\n    );',
    'ordinary-span-gravity',
  );
  replace(
    '    insulationThickness: Number(input.row.INSUL_THICK) * MM_TO_M,\n    insulationDensity: density(input.row.INSUL_DENSITY),',
    '    insulationThickness: insulationWeightIncluded(input.hydrotestInsulation)\n      ? Number(input.row.INSUL_THICK) * MM_TO_M\n      : 0,\n    insulationDensity: insulationWeightIncluded(input.hydrotestInsulation)\n      ? density(input.row.INSUL_DENSITY)\n      : 0,',
    'rigid-gravity',
  );
  replace(
    '      insulationThickness: Number(input.row.INSUL_THICK) * MM_TO_M,\n      insulationDensity: density(input.row.INSUL_DENSITY),',
    '      insulationThickness: insulationWeightIncluded(input.hydrotestInsulation)\n        ? Number(input.row.INSUL_THICK) * MM_TO_M\n        : 0,\n      insulationDensity: insulationWeightIncluded(input.hydrotestInsulation)\n        ? density(input.row.INSUL_DENSITY)\n        : 0,',
    'reducer-gravity',
  );
  replace(
    'function physicalLineWeight(row, section, gravityAcceleration, contentsDensityKgPerM3 = null) {',
    'function physicalLineWeight(\n  row,\n  section,\n  gravityAcceleration,\n  contentsDensityKgPerM3 = null,\n  includeInsulation = true,\n) {',
    'line-weight-signature',
  );
  replace(
    '  const insulation = density(row.INSUL_DENSITY) * insulationArea * gravityAcceleration;',
    '  const insulation = includeInsulation\n    ? density(row.INSUL_DENSITY) * insulationArea * gravityAcceleration\n    : 0;',
    'line-weight-insulation',
  );
  replace(
    '/** Resolve direct and derived CAESAR formulas to the three implemented linear primitives. */\nfunction resolveSupportedLinearCaseMode(benchmarkPackage, caseRecord) {',
    `/**\n * Resolve CAESAR v14 hydrotest insulation authority without inventing a\n * BM4_L-specific override. Declared configuration wins by the governed\n * low-to-high precedence; an undeclared setting uses CAESAR v14's documented\n * default \\`Include Insulation in Hydrotest = False\\`.\n */\nfunction resolveHydrotestInsulationAuthority(authority, caseId) {\n  const ledger = resolveCaesarConfigurationLedger(\n    authority,\n    'INCLUDE_INSULATION_IN_HYDROTEST',\n    caseId,\n  );\n  const resolved = ledger.resolved ?? {\n    setting: 'INCLUDE_INSULATION_IN_HYDROTEST',\n    caseId,\n    level: 'CAESAR_V14_DEFAULT',\n    value: false,\n    source: 'HEXAGON_CAESAR_II_14_INCLUDE_INSULATION_IN_HYDROTEST_DEFAULT_FALSE',\n  };\n  if (typeof resolved.value !== 'boolean') {\n    throw new TypeError(\n      \\`${'${caseId}'} Include Insulation in Hydrotest must resolve to boolean; got ${'${String(resolved.value)}'}.\\`,\n    );\n  }\n  return deepFreeze({\n    ...resolved,\n    precedence: ledger.precedence,\n    precedenceDirection: ledger.precedenceDirection,\n    candidates: ledger.candidates,\n  });\n}\n\nfunction insulationWeightIncluded(hydrotestInsulation) {\n  return hydrotestInsulation === null\n    || hydrotestInsulation === undefined\n    || hydrotestInsulation.value === true;\n}\n\n/** Resolve direct and derived CAESAR formulas to the three implemented linear primitives. */\nfunction resolveSupportedLinearCaseMode(benchmarkPackage, caseRecord) {`,
    'authority-helper',
  );
  return Object.freeze({ source: next, count });
}

function replaceOnce(source, needle, replacement, label) {
  const parts = source.split(needle);
  if (parts.length !== 2) throw new Error(`${label} expected exactly one source marker; found ${parts.length - 1}.`);
  return Object.freeze({ source: `${parts[0]}${replacement}${parts[1]}`, count: 1 });
}
function identity(path) { const bytes = readFileSync(path); return Object.freeze({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }); }
function sha256Text(text) { return createHash('sha256').update(text, 'utf8').digest('hex'); }
function gitBlob(path) { return execFileSync('git', ['hash-object', path], { encoding: 'utf8' }).trim(); }
function vectors(rows) { const map = new Map(); for (const row of rows) { if (row.entityKind !== 'NODE' || row.quantity !== 'FORCE') continue; const value = map.get(String(row.entityId)) ?? {}; value[row.component] = Number(row.value); map.set(String(row.entityId), value); } return map; }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map();
  for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
  if (!args.get('--accdb')) throw new Error('Usage: --accdb <BM4_L.ACCDB> [--out <json>] [--repeat 2]');
  const result = await runL1HydInsulationProductionCandidate({
    accdbPath: args.get('--accdb'),
    outPath: args.get('--out'),
    repeatRuns: args.has('--repeat') ? Number(args.get('--repeat')) : 2,
    profilePath: args.get('--profile'),
  });
  process.stdout.write(`${canonicalPrettyStringify({ controls: result.controls.status, authority: result.authority, runs: result.runs, determinism: result.determinism, productionPromotionAuthorized: false })}\n`);
}
