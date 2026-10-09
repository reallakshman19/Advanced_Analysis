#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  CAESAR_ACCDB_FRICTION_SOLVER_PROFILE,
  buildBenchmarkEngineeringAssessment,
  buildCaesarAccdbBenchmarkPackage,
  createCaesarAccdbQualificationAdapter,
  normalizeBenchmarkResultRows,
  resolveCaesarConfigurationSetting,
  resolveCaesarEffectiveFriction,
  resolveCaesarHydrotestQualificationAuthority,
  runGovernedBenchmarkQualification,
  solveCaesarAccdbFrictionBenchmark,
  solveCaesarAccdbLinearBenchmark,
} from '../src/core/fea-benchmarks/index.js';
import { canonicalPrettyStringify, semanticHash } from '../src/core/shared-piping-model/canonical-json.js';

const args = parseArguments(process.argv.slice(2));
const profile = readJson(args.profile, 'BM4_L profile');
const rawExport = readJson(args.rawExport, 'BM4_L raw ACCDB export');
const benchmarkPackage = buildCaesarAccdbBenchmarkPackage({ rawExport, profile });
const restraintTopology = validateFrictionRestraintTopology(benchmarkPackage);
const hydrotestAuthority = resolveCaesarHydrotestQualificationAuthority(benchmarkPackage);
const resolvedConfiguration = buildResolvedConfiguration(
  benchmarkPackage,
  restraintTopology,
  hydrotestAuthority,
);
writeJson(resolvedConfiguration, args.configOut);

const controls = solveCaesarAccdbLinearBenchmark(benchmarkPackage, ['L2', 'L3', 'L4', 'L5', 'L6', 'L14']);
const friction = solveCaesarAccdbFrictionBenchmark(benchmarkPackage, ['L13', 'L7', 'L15', 'L1']);
const actual = mergeActual(benchmarkPackage, controls, friction);
writeJson(actual, args.actualOut);

const qualification = qualifyActual(benchmarkPackage, actual);
const caseRecords = benchmarkPackage.cases
  .filter((record) => actual.cases[record.caseId])
  .map((record) => ({
    ...record,
    referenceRows: benchmarkPackage.references[record.caseId].rows,
    equilibrium: benchmarkPackage.references[record.caseId].equilibrium,
  }));
const engineeringAssessment = buildBenchmarkEngineeringAssessment({
  caseRecords,
  qualification,
  actual,
  equilibriumTolerance: benchmarkPackage.profile.equilibriumTolerance,
  policy: benchmarkPackage.profile.engineeringAssessment,
});
const nonlinearFailures = ['L13', 'L7', 'L1'].filter((caseId) =>
  actual.mechanics.cases[caseId]?.executionStatus !== 'PASS'
  || actual.mechanics.cases[caseId]?.nonlinearStateGate?.status !== 'PASS'
  || actual.mechanics.cases[caseId]?.recoveredEquilibrium?.status !== 'PASS');
const l15Evidence = actual.mechanics.cases.L15;
const l15Failure = l15Evidence?.executionStatus !== 'PASS'
  || l15Evidence?.independentNonlinearSolve !== false
  || l15Evidence?.algebraicIdentityStatus !== 'PASS'
  || Number(l15Evidence?.algebraicIdentityMaximumAbsoluteResidual) !== 0;
const report = Object.freeze({
  schema: 'lfea-m047-bm4l-friction-stage2-report/v1',
  benchmarkId: benchmarkPackage.benchmarkId,
  profileId: benchmarkPackage.profile.profileId,
  source: benchmarkPackage.source,
  packageSemanticHash: benchmarkPackage.semanticHash,
  resolvedConfiguration,
  restraintTopology,
  status: nonlinearFailures.length > 0 || l15Failure
    ? 'ACTUAL_INVALID'
    : qualification.status,
  qualification,
  engineeringAssessment,
  nonlinearGate: {
    status: nonlinearFailures.length === 0 ? 'PASS' : 'FAIL',
    failedPrimitiveCases: nonlinearFailures,
    l15AlgebraicStatus: l15Failure ? 'FAIL' : 'PASS',
    l15DerivedEquilibriumStatus: l15Evidence?.recoveredEquilibrium?.status ?? 'NOT_EVALUATED',
    l15DerivedEquilibriumQualificationUse: l15Evidence?.equilibriumQualificationUse ?? null,
  },
  pairedDeltas: actual.mechanics.pairedDeltas,
  repeatedRuns: actual.mechanics.repeatedRuns,
  sensitivity: actual.mechanics.sensitivity,
  limitations: actual.mechanics.limitations,
});
writeJson(report, args.reportOut);
if (args.summaryOut) writeSummary(report, args.summaryOut);
process.stdout.write(`${report.status}\n`);

function mergeActual(benchmarkPackage, controls, friction) {
  const cases = Object.fromEntries(benchmarkPackage.cases
    .filter((record) => controls.cases[record.caseId] || friction.cases[record.caseId])
    .map((record) => [record.caseId, controls.cases[record.caseId] ?? friction.cases[record.caseId]]));
  return Object.freeze({
    schema: 'lfea-accdb-benchmark-actual/v1',
    sourceAccdbSha256: benchmarkPackage.source.sha256,
    cases,
    mechanics: Object.freeze({
      schema: 'lfea-m047-bm4l-friction-stage2-evidence/v1',
      sourceModelSemanticHash: benchmarkPackage.model.semanticHash,
      cases: Object.freeze({ ...controls.mechanics.cases, ...friction.mechanics.cases }),
      frictionProfile: friction.mechanics.profile,
      executionOrder: friction.mechanics.executionOrder,
      pairedDeltas: friction.mechanics.pairedDeltas,
      repeatedRuns: friction.mechanics.repeatedRuns,
      sensitivity: friction.mechanics.sensitivity,
      limitations: friction.mechanics.limitations,
    }),
  });
}

function qualifyActual(benchmarkPackage, actual) {
  const caseIds = Object.keys(actual.cases);
  const adapter = createCaesarAccdbQualificationAdapter(benchmarkPackage, caseIds);
  return runGovernedBenchmarkQualification({
    adapter,
    source: benchmarkPackage,
    tolerances: benchmarkPackage.profile.tolerances,
    optionalQuantities: [],
    excludedQuantities: benchmarkPackage.profile.engineeringAssessment?.equilibriumOnlyQuantities ?? [],
    prepare: ({ caseIds: ids, modelInput }) => governedRecord('M047-PREPARATION', {
      caseIds: ids,
      modelSemanticHash: modelInput.semanticHash,
    }),
    authorize: ({ caseIds: ids, preparation }) => governedRecord('M047-AUTHORIZATION', {
      caseIds: ids,
      preparationSemanticHash: preparation.semanticHash,
      executionBoundary: { authorizationIssued: true },
    }),
    solve: ({ caseId }) => actual.cases[caseId],
    normalizeSolved: (caseId, solved) => {
      const rows = normalizeBenchmarkResultRows(solved.rows, caseId);
      return Object.freeze({
        rows,
        exposedQuantities: Object.freeze([...new Set(rows.map((row) => row.quantity))].sort()),
        executionSemanticHash: solved.executionSemanticHash,
        executionEvidenceHash: solved.executionEvidenceHash,
      });
    },
  });
}

function buildResolvedConfiguration(benchmarkPackage, restraintTopology, hydrotestAuthority) {
  const authority = benchmarkPackage.profile.configurationAuthority;
  const primitiveCaseIds = ['L13', 'L7', 'L1'];
  const commonSettings = [
    'Z_AXIS_UP',
    'AMBIENT_TEMPERATURE',
    'BOURDON_PRESSURE',
    'RESTRAINT_DIRECTIONAL_BEHAVIOR',
    'DEFAULT_TRANS_RESTRAINT_STIFF',
    'DEFAULT_ROT_RESTRAINT_STIFF',
    'FRICT_STIF',
    'COEFFICIENT_OF_FRICTION_MU',
  ];
  const cases = {};
  for (const caseId of ['L13', 'L7', 'L15', 'L1']) {
    const caseRecord = benchmarkPackage.cases.find((entry) => entry.caseId === caseId);
    const primitive = primitiveCaseIds.includes(caseId);
    cases[caseId] = {
      caseClass: caseRecord.caseClass,
      formula: caseRecord.formula,
      combinationMethod: primitive ? null : 'ALG',
      independentNonlinearSolve: primitive,
      settings: Object.fromEntries(commonSettings.map((setting) => [
        setting,
        primitive || !['FRICT_STIF', 'COEFFICIENT_OF_FRICTION_MU'].includes(setting)
          ? safeResolve(authority, setting, primitive ? caseId : null)
          : null,
      ])),
      frictionMultiplier: primitive
        ? resolveCaesarConfigurationSetting(authority, 'FRICTION_MULTIPLIER', caseId)
        : null,
      effectiveFriction: resolveCaesarEffectiveFriction(benchmarkPackage, caseId),
    };
  }
  const frictStif = resolveCaesarConfigurationSetting(authority, 'FRICT_STIF', null);
  return Object.freeze({
    schema: 'lfea-m047-bm4l-resolved-configuration/v1',
    precedenceLowToHigh: authority.precedence,
    caesarVersion: authority.caesarVersion,
    frictionStiffnessConversion: {
      authority: frictStif,
      displayedUnit: 'N/cm',
      displayedValue: Number(frictStif.value.value),
      conversion: 'value * 100',
      solverUnit: 'N/m',
      solverValue: Number(frictStif.value.value) * 100,
    },
    hydrotestAuthority,
    restraintTopology,
    cases,
  });
}

function validateFrictionRestraintTopology(benchmarkPackage) {
  const rows = benchmarkPackage.model.tables.INPUT_RESTRAINTS.rows;
  const tolerance = Number(CAESAR_ACCDB_FRICTION_SOLVER_PROFILE.axisAlignmentTolerance);
  const translationDofs = ['UX', 'UY', 'UZ'];
  const anchorNodes = new Set();
  const directionalByKey = new Map();
  const supports = [];

  rows.forEach((row, rowIndex) => {
    const nodeId = String(row.NODE_NUM);
    const type = Number(row.RES_TYPEID);
    if (type === 1) {
      if (anchorNodes.has(nodeId)) {
        throw new TypeError(`Duplicate anchor restraint at node ${nodeId}; Stage 2 requires one unambiguous restraint declaration.`);
      }
      const directional = [...directionalByKey.keys()].filter((key) => key.startsWith(`${nodeId}:`));
      if (directional.length > 0) {
        throw new TypeError(`Anchor node ${nodeId} also declares directional restraints: ${directional.join(', ')}.`);
      }
      anchorNodes.add(nodeId);
      return;
    }
    if (anchorNodes.has(nodeId)) {
      throw new TypeError(`Directional restraint row ${rowIndex + 1} is attached to anchor node ${nodeId}.`);
    }
    const direction = [Number(row.XCOSINE), Number(row.YCOSINE), Number(row.ZCOSINE)];
    if (!direction.every(Number.isFinite)) {
      throw new TypeError(`Directional restraint row ${rowIndex + 1} at node ${nodeId} has a non-finite direction cosine.`);
    }
    const magnitude = Math.hypot(...direction);
    if (!(magnitude > 0)) {
      throw new TypeError(`Directional restraint row ${rowIndex + 1} at node ${nodeId} has a zero normal direction.`);
    }
    const normal = direction.map((value) => value / magnitude);
    const absolute = normal.map(Math.abs);
    const normalAxis = absolute.indexOf(Math.max(...absolute));
    if (Math.abs(absolute[normalAxis] - 1) > tolerance
      || absolute.some((value, axis) => axis !== normalAxis && value > tolerance)) {
      throw new TypeError(
        `Directional restraint row ${rowIndex + 1} at node ${nodeId} is skewed; Stage 2 will not invent a rotated friction plane.`,
      );
    }
    const dof = translationDofs[normalAxis];
    const key = `${nodeId}:${dof}`;
    if (directionalByKey.has(key)) {
      throw new TypeError(
        `Duplicate directional restraint DOF ${key} at rows ${directionalByKey.get(key).sourceRowIndex + 1} and ${rowIndex + 1}.`,
      );
    }
    const support = Object.freeze({
      supportId: `ACCDB-FRICTION-${nodeId}-R${rowIndex + 1}`,
      sourceRowIndex: rowIndex,
      nodeId,
      normalDof: dof,
      normalDirection: Object.freeze(normal),
    });
    directionalByKey.set(key, support);
    supports.push(support);
  });

  return Object.freeze({
    schema: 'lfea-m047-bm4l-friction-restraint-topology/v1',
    sourceRowCount: rows.length,
    anchorNodeCount: anchorNodes.size,
    directionalRestraintCount: supports.length,
    stateScope: 'PER_ACCDB_DIRECTIONAL_RESTRAINT_ROW',
    supports: Object.freeze(supports),
  });
}

function safeResolve(authority, setting, caseId) {
  try {
    return resolveCaesarConfigurationSetting(authority, setting, caseId);
  } catch (error) {
    if (/has no declared authority value/u.test(String(error.message))) return null;
    throw error;
  }
}

function governedRecord(kind, fields) {
  const base = { kind, ...fields };
  return Object.freeze({ ...base, semanticHash: semanticHash(base) });
}

function writeSummary(report, path) {
  const a = report.engineeringAssessment;
  const lines = [
    '# M047 BM4_L friction Stage 2 qualification',
    '',
    `- Status: ${report.status}`,
    `- ACCDB SHA-256: \`${report.source.sha256}\``,
    `- Precedence: ${report.resolvedConfiguration.precedenceLowToHigh.join(' < ')}`,
    `- Friction stiffness: ${report.resolvedConfiguration.frictionStiffnessConversion.solverValue} N/m`,
    `- L1 hydrotest: ${report.resolvedConfiguration.hydrotestAuthority.sourceCaseClass} ${report.resolvedConfiguration.hydrotestAuthority.sourceFormula}; WW water basis ${report.resolvedConfiguration.hydrotestAuthority.waterDensityKgPerM3} kg/m^3; HP -> HYDRO_PRESSURE.`,
    `- Friction contacts: ${report.restraintTopology.directionalRestraintCount} directional restraint rows; state scope is per restraint row.`,
    `- Literal external components: ${a.literalExternalComponents.status}; ${a.literalExternalComponents.counts.failed} failures.`,
    `- Restraint components: ${a.restraintComponents.status}; ${a.restraintComponents.counts.failed} failures.`,
    `- Coordinate-invariant vectors: ${a.vectorGroups.status}; ${a.vectorGroups.counts.failed} failures.`,
    `- Physical equilibrium: ${a.physicalEquilibrium.status}; ${a.physicalEquilibrium.counts.failed} failed cases.`,
    `- Nonlinear friction gate: ${report.nonlinearGate.status}.`,
    `- L15 algebraic identity: ${report.nonlinearGate.l15AlgebraicStatus}.`,
    `- L15 derived equilibrium (report-only): ${report.nonlinearGate.l15DerivedEquilibriumStatus}.`,
    '',
    'Sensitivity runs are diagnostic only; 1x nominal remains the qualification result.',
  ];
  writeText(lines.join('\n') + '\n', path);
}

function parseArguments(argv) {
  const map = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new TypeError(`Invalid argument near ${String(key)}.`);
    map.set(key, value);
  }
  const required = ['--raw-export', '--profile', '--config-out', '--actual-out', '--report-out'];
  for (const key of required) if (!map.get(key)) throw new TypeError(`Missing ${key}.`);
  return Object.freeze({
    rawExport: map.get('--raw-export'),
    profile: map.get('--profile'),
    configOut: map.get('--config-out'),
    actualOut: map.get('--actual-out'),
    reportOut: map.get('--report-out'),
    summaryOut: map.get('--summary-out') ?? null,
  });
}

function readJson(path, label) {
  try { return JSON.parse(readFileSync(resolve(path), 'utf8')); }
  catch (error) { throw new Error(`Cannot read ${label} ${path}: ${error.message}`, { cause: error }); }
}
function writeJson(value, path) { writeText(canonicalPrettyStringify(value), path); }
function writeText(value, path) {
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, value, 'utf8');
}
