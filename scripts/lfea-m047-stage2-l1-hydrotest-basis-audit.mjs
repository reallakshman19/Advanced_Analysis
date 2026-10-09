#!/usr/bin/env node
/**
 * M047 Stage 2 L1 hydrotest-basis prepared-assembly audit.
 * Diagnostic only: no production mechanic is changed and no accuracy claim is made.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAESAR_ACCDB_CASE_GATES,
  buildCaesarAccdbBenchmarkPackage,
  prepareCaesarAccdbCaseState,
  requiredCaesarAccdbTables,
} from '../src/core/fea-benchmarks/index.js';
import { extractCaesarAccdbTables } from '../src/core/fea-benchmarks/caesar-accdb-reader.js';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';

const PROFILE_PATH = 'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json';
const EXPECTED_SHA = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const KG_PER_CM3_TO_KG_PER_M3 = 1e6;
const CASE_ID = 'L1';

const n = (value) => Number(value);
const sum = (values) => values.reduce((total, value) => total + Number(value), 0);

export async function buildL1HydrotestBasisAudit(input) {
  const profile = input.profile ?? JSON.parse(readFileSync(resolve(input.profilePath ?? PROFILE_PATH), 'utf8'));
  const raw = await extractCaesarAccdbTables({
    accdbPath: input.accdbPath,
    tableNames: requiredCaesarAccdbTables(profile),
    expectedSha256: EXPECTED_SHA,
  });
  const currentPackage = buildCaesarAccdbBenchmarkPackage({ rawExport: raw, profile });
  const basis = currentPackage.profile.linearSolve?.hydrotestBasis;
  if (!basis || basis.authorityStatus !== 'RESOLVED' || !(n(basis.testFluidDensityKgPerM3) > 0)) {
    throw new TypeError('L1 audit requires a resolved positive hydrotest fluid density.');
  }
  if (basis.pressureField !== 'HYDRO_PRESSURE') throw new TypeError('L1 audit requires HYDRO_PRESSURE.');

  const currentCase = requireCase(currentPackage);
  const current = prepare(currentPackage, currentCase);
  const mutatedRaw = specialComponentHydroDensity(raw, basis.testFluidDensityKgPerM3);
  const mutatedPackage = buildCaesarAccdbBenchmarkPackage({ rawExport: mutatedRaw, profile });
  const counterfactual = prepare(mutatedPackage, requireCase(mutatedPackage));

  const sourceRows = new Map(raw.tables.INPUT_BASIC_ELEMENT_DATA.rows.map((row) => [String(row.ELEMENTID), row]));
  const currentGravity = gravityLedger(current, sourceRows);
  const counterfactualGravity = gravityLedger(counterfactual, sourceRows);
  const changedSources = [...currentGravity.bySource.keys()].sort(compareText).map((sourceElementId) => {
    const before = currentGravity.bySource.get(sourceElementId);
    const after = counterfactualGravity.bySource.get(sourceElementId);
    return {
      sourceElementId,
      sourceKind: before.sourceKind,
      analysisKinds: before.analysisKinds,
      currentGravityWeightN: before.gravityWeightN,
      counterfactualGravityWeightN: after.gravityWeightN,
      deltaN: after.gravityWeightN - before.gravityWeightN,
      operatingFluidDensityKgPerM3: n(before.sourceRow.FLUID_DENSITY) * KG_PER_CM3_TO_KG_PER_M3,
      hydrotestFluidDensityKgPerM3: n(basis.testFluidDensityKgPerM3),
    };
  }).filter((row) => Math.abs(row.deltaN) > 1e-9);

  const referenceForce = referenceSupportForceSum(currentPackage);
  const referenceVertical = Math.abs(referenceForce.FY);
  const currentError = Math.abs(referenceVertical - currentGravity.totalWeightN);
  const counterfactualError = Math.abs(referenceVertical - counterfactualGravity.totalWeightN);
  const pressureAudit = pressureEvidence(current, raw.tables.INPUT_BASIC_ELEMENT_DATA.rows);

  const base = {
    schema: 'm047-bm4l-stage2-l1-hydrotest-basis-audit/v2',
    sourceAccdbSha256: raw.source.sha256,
    caseId: CASE_ID,
    caseFormula: currentCase.formula,
    benchmarkAuthority: false,
    hydrotestAuthority: {
      testFluidDensityKgPerM3: n(basis.testFluidDensityKgPerM3),
      temperatureBasis: basis.temperatureBasis,
      pressureField: basis.pressureField,
      source: basis.source ?? null,
    },
    currentAssembly: {
      totalGravityWeightN: currentGravity.totalWeightN,
      gravityBySourceKindN: currentGravity.byKind,
      analysisElementCount: current.analysis.elements.length,
    },
    uniformWwSpecialComponentCounterfactual: {
      rule: 'RIGID_AND_REDUCER_SOURCE_FLUID_DENSITY_TO_GOVERNED_TEST_DENSITY_ONLY',
      benchmarkAuthority: false,
      totalGravityWeightN: counterfactualGravity.totalWeightN,
      gravityBySourceKindN: counterfactualGravity.byKind,
      totalDeltaN: counterfactualGravity.totalWeightN - currentGravity.totalWeightN,
      changedSourceCount: changedSources.length,
      changedSources,
    },
    referenceGlobalForceCheck: {
      convention: currentPackage.profile.conventions.restraintReaction,
      normalizedForceComponentRule: 'UX_UY_UZ_MAP_TO_FX_FY_FZ',
      supportForceSumN: referenceForce,
      expectedGravityDirection: [0, -1, 0],
      currentVerticalMagnitudeErrorN: currentError,
      counterfactualVerticalMagnitudeErrorN: counterfactualError,
      currentVerticalMagnitudeErrorFraction: currentError / Math.max(referenceVertical, 1),
      counterfactualVerticalMagnitudeErrorFraction: counterfactualError / Math.max(referenceVertical, 1),
      closerAssembly: counterfactualError < currentError
        ? 'UNIFORM_WW_SPECIAL_COMPONENT_COUNTERFACTUAL'
        : counterfactualError > currentError ? 'CURRENT' : 'TIE',
      interpretationRule: 'RCA_DISCRIMINATOR_ONLY_NOT_AN_ACCEPTANCE_GATE',
    },
    pressureAudit,
    sourceCodeDiscriminator: {
      status: changedSources.length > 0
        ? 'SPECIAL_COMPONENT_FLUID_DENSITY_PATH_IS_CASE_INCONSISTENT'
        : 'NO_SPECIAL_COMPONENT_WEIGHT_DELTA_OBSERVED',
      productionChangeAuthorized: false,
    },
  };
  return Object.freeze({ ...base, auditSemanticHash: semanticHash(base) });
}

function requireCase(pkg) {
  const row = pkg.cases.find((entry) => entry.caseId === CASE_ID);
  if (!row) throw new TypeError('Profile does not select L1.');
  return row;
}

function prepare(pkg, caseRecord) {
  return prepareCaesarAccdbCaseState({
    benchmarkPackage: pkg,
    caseRecord,
    solveProfile: pkg.profile.linearSolve,
    gate: CAESAR_ACCDB_CASE_GATES.NONLINEAR_EFFECTIVE_FRICTION,
    frictionDofKeys: [],
  });
}

function specialComponentHydroDensity(raw, densityKgPerM3) {
  const copy = structuredClone(raw);
  const stored = n(densityKgPerM3) / KG_PER_CM3_TO_KG_PER_M3;
  for (const row of copy.tables.INPUT_BASIC_ELEMENT_DATA.rows) {
    if (n(row.RIGID_PTR) > 0 || n(row.REDUCER_PTR) > 0) row.FLUID_DENSITY = stored;
  }
  copy.provider = `${String(raw.provider ?? 'ACCDB')}:L1_WW_SPECIAL_COMPONENT_COUNTERFACTUAL`;
  copy.source = { ...copy.source, path: `${String(raw.source.path)}#l1-ww-counterfactual` };
  return copy;
}

function gravityLedger(prepared, sourceRows) {
  const bySource = new Map();
  const byKind = {};
  for (const element of prepared.analysis.elements) {
    const id = String(element.sourceElementId);
    const sourceRow = sourceRows.get(id);
    if (!sourceRow) throw new TypeError(`Prepared element lacks source row ${id}.`);
    const sourceKind = sourceKindOf(sourceRow);
    const record = bySource.get(id) ?? { sourceRow, sourceKind, analysisKinds: [], gravityWeightN: 0 };
    record.analysisKinds.push(element.kind);
    record.gravityWeightN += n(element.gravityWeightN);
    bySource.set(id, record);
    byKind[sourceKind] = (byKind[sourceKind] ?? 0) + n(element.gravityWeightN);
  }
  for (const record of bySource.values()) record.analysisKinds = [...new Set(record.analysisKinds)].sort(compareText);
  return {
    bySource,
    byKind: Object.fromEntries(Object.entries(byKind).sort(([a], [b]) => compareText(a, b))),
    totalWeightN: sum([...bySource.values()].map((row) => row.gravityWeightN)),
  };
}

function sourceKindOf(row) {
  if (n(row.RIGID_PTR) > 0) return 'RIGID';
  if (n(row.REDUCER_PTR) > 0) return 'REDUCER';
  if (n(row.BEND_PTR) > 0) return 'BEND_SOURCE';
  return 'PIPE';
}

/** Qualification rows use DOF component labels for node force rows. */
function referenceSupportForceSum(pkg) {
  const rows = pkg.references[CASE_ID]?.rows ?? [];
  const forces = rows.filter((row) => row.entityKind === 'NODE' && row.quantity === 'FORCE');
  if (forces.length === 0) throw new TypeError('L1 reference contains no node force rows.');
  const map = { UX: 'FX', UY: 'FY', UZ: 'FZ', FX: 'FX', FY: 'FY', FZ: 'FZ' };
  const result = { FX: 0, FY: 0, FZ: 0 };
  for (const row of forces) {
    const key = map[row.component];
    if (key) result[key] += n(row.value);
  }
  return result;
}

function pressureEvidence(prepared, sourceRows) {
  const byKind = {};
  for (const element of prepared.analysis.elements) {
    const row = byKind[element.kind] ?? { count: 0, maxPressureAxialStrain: 0, maxBourdonRotationRad: 0 };
    row.count += 1;
    row.maxPressureAxialStrain = Math.max(row.maxPressureAxialStrain, Math.abs(n(element.pressureAxialStrain)));
    row.maxBourdonRotationRad = Math.max(row.maxBourdonRotationRad, Math.abs(n(element.bourdonRotationRadians)));
    byKind[element.kind] = row;
  }
  return {
    preparedPressureField: prepared.caseMode.pressureField,
    pressureIncluded: prepared.caseMode.pressure,
    hydrotestIncluded: prepared.caseMode.hydrotest,
    sourceElementCount: sourceRows.length,
    sourceElementsWhereHydroDiffersFromP1: sourceRows.filter((row) => n(row.HYDRO_PRESSURE) !== n(row.PRESSURE1)).length,
    preparedElementEvidenceByKind: Object.fromEntries(Object.entries(byKind).sort(([a], [b]) => compareText(a, b))),
    bindingStatus: prepared.caseMode.pressureField === 'HYDRO_PRESSURE' ? 'PASS' : 'FAIL',
  };
}

function compareText(a, b) { return String(a).localeCompare(String(b), 'en'); }

function parse(argv) {
  const m = new Map();
  for (let i = 0; i < argv.length; i += 2) m.set(argv[i], argv[i + 1]);
  if (!m.get('--accdb')) throw new TypeError('Usage: --accdb <BM4_L.ACCDB> [--profile file] [--out file]');
  return { accdbPath: m.get('--accdb'), profilePath: m.get('--profile') ?? PROFILE_PATH, outPath: m.get('--out') ?? null };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parse(process.argv.slice(2));
  const result = await buildL1HydrotestBasisAudit(args);
  if (args.outPath) {
    const path = resolve(args.outPath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${canonicalPrettyStringify(result)}\n`, 'utf8');
  }
  process.stdout.write(`${canonicalPrettyStringify({
    sourceAccdbSha256: result.sourceAccdbSha256,
    changedSourceCount: result.uniformWwSpecialComponentCounterfactual.changedSourceCount,
    gravityDeltaN: result.uniformWwSpecialComponentCounterfactual.totalDeltaN,
    referenceSupportFyN: result.referenceGlobalForceCheck.supportForceSumN.FY,
    closerAssembly: result.referenceGlobalForceCheck.closerAssembly,
    pressureBinding: result.pressureAudit.bindingStatus,
  })}\n`);
}
