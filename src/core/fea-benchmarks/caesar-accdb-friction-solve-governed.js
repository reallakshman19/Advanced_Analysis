/**
 * Governed public boundary for M047 CAESAR ACCDB friction qualification.
 *
 * Primitive nonlinear mechanics remain in caesar-accdb-friction-solve.js. This
 * layer owns governed case semantics and execution order: L13, L7, algebraic
 * L15, then L1. L15 is therefore never passed into the nonlinear kernel.
 */
import { semanticHash } from '../shared-piping-model/canonical-json.js';
import { deepFreeze } from '../shared-piping-model/immutable.js';
import { compareBenchmarkResultRows } from './qualification-comparison.js';
import {
  resolveCaesarEffectiveFriction,
  solveCaesarAccdbLinearBenchmark,
} from './caesar-accdb-linear-solve-governed.js';
import {
  CAESAR_ACCDB_FRICTION_SOLVER_PROFILE,
  solveCaesarAccdbFrictionBenchmark as solveRawCaesarAccdbFrictionBenchmark,
} from './caesar-accdb-friction-solve.js';

const DOFS = Object.freeze(['UX', 'UY', 'UZ', 'RX', 'RY', 'RZ']);
const TRANSLATION_DOFS = Object.freeze(['UX', 'UY', 'UZ']);
const GOVERNED_CASE_SEMANTICS = deepFreeze({
  L13: { lcaseNumber: 13, caseClass: 'SUS', formula: 'W+P1' },
  L7: { lcaseNumber: 7, caseClass: 'OPE', formula: 'W+T1+P1' },
  L15: { lcaseNumber: 15, caseClass: 'EXP', formula: 'L15=L7-L13' },
  L1: { lcaseNumber: 1, caseClass: 'HYD', formula: 'WW+HP' },
});
const DERIVED_FRICTION_SETTINGS = Object.freeze([
  'COEFFICIENT_OF_FRICTION_MU',
  'FRICTION_MULTIPLIER',
  'FRICT_STIF',
]);

export { CAESAR_ACCDB_FRICTION_SOLVER_PROFILE };

export const CAESAR_ACCDB_HYDROTEST_AUTHORITY_SCHEMA =
  'caesar-accdb-hydrotest-qualification-authority/v1';

/** Resolve the exact governed L1 hydrotest interpretation used by Stage 2. */
export function resolveCaesarHydrotestQualificationAuthority(benchmarkPackage) {
  requireBenchmarkPackage(benchmarkPackage);
  const sourceCase = benchmarkPackage.cases.find((entry) => entry.caseId === 'L1');
  if (!sourceCase) {
    throw hydrotestError('BM4_L Stage 2 requires selected case L1.', 'CAESAR_ACCDB_HYDROTEST_CASE_MISSING');
  }
  const caseClass = String(sourceCase.caseClass ?? '').trim().toUpperCase();
  const formula = normalizeFormula(sourceCase.formula);
  if (Number(sourceCase.lcaseNumber) !== 1 || caseClass !== 'HYD' || formula !== 'WW+HP') {
    throw hydrotestError(
      `L1 hydrotest qualification requires exact L1 HYD WW+HP; got L${String(sourceCase.lcaseNumber)} ${String(sourceCase.caseClass)} ${String(sourceCase.formula)}.`,
      'CAESAR_ACCDB_HYDROTEST_CASE_UNQUALIFIED',
    );
  }
  return deepFreeze({
    schema: CAESAR_ACCDB_HYDROTEST_AUTHORITY_SCHEMA,
    caseId: 'L1',
    sourceLcaseNumber: 1,
    sourceCaseClass: caseClass,
    sourceFormula: formula,
    weightTerm: 'WW',
    weightAuthority: 'CAESAR_WW_MEANS_PIPE_PLUS_WATER_AS_FLUID',
    waterDensityKgPerM3: 1000,
    waterDensityKgPerCm3: 0.001,
    waterDensityRule: 'WW_WATER_FILLED_LOAD_BASIS',
    insulationIncluded: false,
    insulationAuthority: 'CAESAR_INCLUDE_INSULATION_IN_HYDROTEST_DEFAULT_FALSE',
    pressureTerm: 'HP',
    pressureField: 'HYDRO_PRESSURE',
    pressureAuthority: 'CAESAR_HP_MEANS_HYDROSTATIC_TEST_PRESSURE',
    frozenPrimitiveFormula: 'W+P1',
    transformationRule: 'WW_TO_W_WITH_WATER_FLUID_DENSITY_AND_HP_HYDRO_PRESSURE_TO_P1_PRESSURE1',
    benchmarkReferenceRule: 'STORED_ACCDB_L1_OUTPUT_REMAINS_THE_ONLY_BENCHMARK_REFERENCE',
    counterfactualBaseRule: 'ZERO_FRICTION_BASE_IS_ASSEMBLY_INPUT_ONLY_NOT_CAESAR_REFERENCE_AUTHORITY',
  });
}

/**
 * Public governed nonlinear friction solver.
 *
 * Primitive cases are delegated to the nonlinear kernel. L15 is constructed in
 * this layer from the already-converged L7/L13 result rows and its physical
 * equilibrium is retained as report evidence rather than a primitive nonlinear
 * acceptance gate.
 */
export function solveCaesarAccdbFrictionBenchmark(benchmarkPackage, selectedCaseIds, options = {}) {
  requireBenchmarkPackage(benchmarkPackage);
  if (selectedCaseIds !== undefined && !Array.isArray(selectedCaseIds)) {
    throw new TypeError('M047 governed friction case selection must be an array.');
  }
  const requested = selectedCaseIds === undefined
    ? ['L13', 'L7', 'L15', 'L1']
    : [...new Set(selectedCaseIds.map(String))];
  if (requested.length === 0) {
    throw new TypeError('At least one governed ACCDB friction case is required.');
  }
  const allowed = new Set(Object.keys(GOVERNED_CASE_SEMANTICS));
  const unknown = requested.filter((caseId) => !allowed.has(caseId));
  if (unknown.length > 0) {
    throw new TypeError(`M047 governed friction solver accepts only L13, L7, L15 and L1; got ${unknown.join(', ')}.`);
  }

  const semanticCaseIds = new Set(requested);
  if (requested.includes('L15')) {
    semanticCaseIds.add('L13');
    semanticCaseIds.add('L7');
  }
  for (const caseId of semanticCaseIds) requireGovernedCaseSemantics(benchmarkPackage, caseId);
  if (requested.includes('L15')) requireNoIndependentDerivedFrictionSettings(benchmarkPackage, 'L15');
  if (requested.includes('L1')) resolveCaesarHydrotestQualificationAuthority(benchmarkPackage);
  const l15FrictionAuthority = requested.includes('L15')
    ? requireCompatibleL15FrictionAuthority(benchmarkPackage)
    : null;

  const dependencyIds = [];
  if (requested.includes('L13') || requested.includes('L15')) dependencyIds.push('L13');
  if (requested.includes('L7') || requested.includes('L15')) dependencyIds.push('L7');
  const preDerived = dependencyIds.length > 0
    ? solveRawCaesarAccdbFrictionBenchmark(benchmarkPackage, dependencyIds, options)
    : null;

  const derived = requested.includes('L15')
    ? buildGovernedDerivedL15(
      benchmarkPackage,
      preDerived.cases.L7,
      preDerived.cases.L13,
      l15FrictionAuthority,
    )
    : null;

  // L1 is intentionally invoked only after L15 has been constructed, preserving
  // the issue-governed execution order even though it is an independent state.
  const hydro = requested.includes('L1')
    ? solveRawCaesarAccdbFrictionBenchmark(benchmarkPackage, ['L1'], options)
    : null;

  const availableCases = {
    ...(preDerived?.cases ?? {}),
    ...(derived === null ? {} : { L15: derived.actualCase }),
    ...(hydro?.cases ?? {}),
  };
  const cases = Object.fromEntries(requested.map((caseId) => [caseId, availableCases[caseId]]));
  const mechanicsCases = {
    ...(preDerived?.mechanics.cases ?? {}),
    ...(derived === null ? {} : { L15: derived.evidence }),
    ...(hydro?.mechanics.cases ?? {}),
  };
  const pairedDeltas = {
    ...(preDerived?.mechanics.pairedDeltas ?? {}),
    ...(derived === null ? {} : { 'L15-L14': buildL15PairedDelta(benchmarkPackage, derived.actualCase) }),
  };
  const repeatedRuns = {
    ...(preDerived?.mechanics.repeatedRuns ?? {}),
    ...(hydro?.mechanics.repeatedRuns ?? {}),
  };
  const sensitivity = {
    ...(preDerived?.mechanics.sensitivity ?? {}),
    ...(hydro?.mechanics.sensitivity ?? {}),
  };
  const sourceMechanics = preDerived?.mechanics ?? hydro?.mechanics;
  return deepFreeze({
    schema: 'lfea-accdb-benchmark-actual/v1',
    sourceAccdbSha256: benchmarkPackage.source.sha256,
    cases,
    mechanics: {
      schema: 'lfea-accdb-friction-solve-evidence/v1',
      sourceModelSemanticHash: benchmarkPackage.model.semanticHash,
      profile: sourceMechanics?.profile ?? CAESAR_ACCDB_FRICTION_SOLVER_PROFILE,
      executionOrder: Object.freeze([
        ...dependencyIds,
        ...(requested.includes('L15') ? ['L15'] : []),
        ...(requested.includes('L1') ? ['L1'] : []),
      ]),
      dependencyExecution: Object.freeze(dependencyIds),
      governedCaseSemantics: Object.freeze(Object.fromEntries(
        [...semanticCaseIds].map((caseId) => [caseId, GOVERNED_CASE_SEMANTICS[caseId]]),
      )),
      cases: mechanicsCases,
      pairedDeltas,
      repeatedRuns,
      sensitivity,
      limitations: sourceMechanics?.limitations ?? Object.freeze([]),
    },
  });
}

function requireGovernedCaseSemantics(benchmarkPackage, caseId) {
  const expected = GOVERNED_CASE_SEMANTICS[caseId];
  const record = benchmarkPackage.cases.find((entry) => entry.caseId === caseId);
  if (!record) throw caseAuthorityError(`${caseId} is missing from the selected ACCDB package.`);
  const actual = {
    lcaseNumber: Number(record.lcaseNumber),
    caseClass: String(record.caseClass ?? '').trim().toUpperCase(),
    formula: normalizeFormula(record.formula),
  };
  if (actual.lcaseNumber !== expected.lcaseNumber
    || actual.caseClass !== expected.caseClass
    || actual.formula !== expected.formula) {
    throw caseAuthorityError(
      `${caseId} must remain L${expected.lcaseNumber} ${expected.caseClass} ${expected.formula}; `
      + `got L${String(record.lcaseNumber)} ${String(record.caseClass)} ${String(record.formula)}.`,
    );
  }
  return deepFreeze({ caseId, ...actual });
}

function requireNoIndependentDerivedFrictionSettings(benchmarkPackage, caseId) {
  const caseSettings = benchmarkPackage.profile.configurationAuthority.layers.loadCase.cases[caseId] ?? {};
  const declared = DERIVED_FRICTION_SETTINGS.filter((setting) =>
    Object.prototype.hasOwnProperty.call(caseSettings, setting));
  if (declared.length > 0) {
    throw derivedFrictionError(
      `${caseId} is algebraic and may not declare independent friction settings: ${declared.join(', ')}.`,
    );
  }
}

function requireCompatibleL15FrictionAuthority(benchmarkPackage) {
  const authority = resolveCaesarEffectiveFriction(benchmarkPackage, 'L15');
  if (authority.kind !== 'DERIVED' || authority.combinationMethod !== 'ALG') {
    throw derivedFrictionError('L15 must resolve as an algebraic derived-friction case.');
  }
  const dependencies = authority.dependencies;
  const caseIds = dependencies.map((entry) => entry.caseId).sort(compareText);
  if (dependencies.length !== 2 || caseIds[0] !== 'L13' || caseIds[1] !== 'L7') {
    throw derivedFrictionError(`L15 friction dependencies must be exactly L7 and L13; got ${caseIds.join(',')}.`);
  }
  const effective = dependencies.map((entry) => Number(entry.effectiveCoefficient));
  if (effective.some((value) => !Number.isFinite(value) || !(value > 0)) || effective[0] !== effective[1]) {
    throw derivedFrictionError(
      `L15 requires one common positive effective friction state; got L7/L13 values ${effective.join(',')}.`,
    );
  }
  return deepFreeze({
    ...authority,
    commonEffectiveCoefficient: effective[0],
    compatibilityRule: 'L7_AND_L13_MUST_SHARE_ONE_POSITIVE_EFFECTIVE_FRICTION_STATE_BEFORE_L15_SUBTRACTION',
  });
}

function buildGovernedDerivedL15(benchmarkPackage, l7, l13, frictionAuthority) {
  if (!l7 || !l13) throw new TypeError('L15 requires independently converged L7 and L13 states.');
  const rows = subtractRows('L15', l7.rows, l13.rows);
  const recoveredEquilibrium = equilibriumFromResultRows(rows, benchmarkPackage.profile.equilibriumTolerance);
  const evidence = deepFreeze({
    formula: 'L15=L7-L13',
    combinationMethod: 'ALG',
    independentNonlinearSolve: false,
    operandExecutionSemanticHashes: Object.freeze([l7.executionSemanticHash, l13.executionSemanticHash]),
    governedFrictionAuthority: frictionAuthority,
    algebraicIdentityStatus: 'PASS',
    algebraicIdentityMaximumAbsoluteResidual: 0,
    executionStatus: 'PASS',
    recoveredEquilibrium,
    equilibriumQualificationUse: 'REPORT_ONLY_DERIVED_CASE_PRIMITIVE_OPERANDS_GOVERN_NONLINEAR_EQUILIBRIUM_ACCEPTANCE',
  });
  const executionSemanticHash = semanticHash({
    schema: 'caesar-accdb-derived-friction-case/v2',
    rows,
    evidence,
  });
  return {
    actualCase: deepFreeze({
      executionSemanticHash,
      executionEvidenceHash: semanticHash(evidence),
      stiffnessStateHash: semanticHash({ kind: 'ALG', operands: evidence.operandExecutionSemanticHashes }),
      rows,
    }),
    evidence,
  };
}

function buildL15PairedDelta(benchmarkPackage, l15) {
  const control = solveCaesarAccdbLinearBenchmark(benchmarkPackage, ['L14']).cases.L14;
  const actualDelta = subtractRows('RCA:L15-L14:ACTUAL', l15.rows, control.rows);
  const referenceDelta = subtractRows(
    'RCA:L15-L14:REFERENCE',
    benchmarkPackage.references.L15.rows,
    benchmarkPackage.references.L14.rows,
  );
  const comparison = compareBenchmarkResultRows({
    caseId: 'RCA:L15-L14',
    referenceRows: referenceDelta,
    actualRows: actualDelta,
    tolerances: benchmarkPackage.profile.tolerances,
    optionalQuantities: [],
    exposedQuantities: [...new Set(actualDelta.map((row) => row.quantity))],
    excludedQuantities: benchmarkPackage.profile.engineeringAssessment?.equilibriumOnlyQuantities ?? [],
  });
  return deepFreeze({ actualDeltaRows: actualDelta, referenceDeltaRows: referenceDelta, comparison });
}

function equilibriumFromResultRows(rows, tolerance) {
  const values = new Map(rows.filter((row) => row.entityKind === 'NODE').map((row) => [
    rowIdentity(row.entityKind, row.entityId, row.quantity, row.component),
    Number(row.value),
  ]));
  const nodeIds = [...new Set(rows.filter((row) => row.entityKind === 'NODE').map((row) => String(row.entityId)))];
  let forceN = 0;
  let momentNm = 0;
  for (const nodeId of nodeIds) {
    TRANSLATION_DOFS.forEach((component) => {
      const incident = values.get(rowIdentity('NODE', nodeId, 'INCIDENT_GLOBAL_FORCE', component)) ?? 0;
      const reaction = values.get(rowIdentity('NODE', nodeId, 'FORCE', component)) ?? 0;
      forceN = Math.max(forceN, Math.abs(incident - reaction));
    });
    DOFS.slice(3).forEach((component) => {
      const incident = values.get(rowIdentity('NODE', nodeId, 'INCIDENT_GLOBAL_MOMENT', component)) ?? 0;
      const reaction = values.get(rowIdentity('NODE', nodeId, 'MOMENT', component)) ?? 0;
      momentNm = Math.max(momentNm, Math.abs(incident - reaction));
    });
  }
  return deepFreeze({
    status: forceN <= tolerance.forceN && momentNm <= tolerance.momentNm ? 'PASS' : 'FAIL',
    rule: 'DERIVED_RESULT_INCIDENT_ACTION_MINUS_SUPPORT_REACTION_V1',
    maximumAbsoluteResidual: { forceN, momentNm },
  });
}

function subtractRows(caseId, leftRows, rightRows) {
  const left = new Map(leftRows.map((row) => [caseIndependentIdentity(row), row]));
  const right = new Map(rightRows.map((row) => [caseIndependentIdentity(row), row]));
  const identities = [...new Set([...left.keys(), ...right.keys()])].sort(compareText);
  return Object.freeze(identities.map((identity) => {
    const a = left.get(identity);
    const b = right.get(identity);
    if (!a || !b) throw new TypeError(`${caseId} delta has incomplete row identity ${identity}.`);
    if (a.unit !== b.unit) throw new TypeError(`${caseId} delta unit mismatch at ${identity}.`);
    return deepFreeze({
      caseId,
      entityKind: a.entityKind,
      entityId: a.entityId,
      quantity: a.quantity,
      component: a.component,
      value: Number(a.value) - Number(b.value),
      unit: a.unit,
      required: a.required !== false && b.required !== false,
    });
  }));
}

function requireBenchmarkPackage(value) {
  if (!value || value.schema !== 'caesar-accdb-benchmark-package/v1') {
    throw new TypeError('A canonical CAESAR ACCDB benchmark package is required.');
  }
}

function normalizeFormula(value) {
  return String(value ?? '').replace(/\s+/gu, '').toUpperCase();
}
function rowIdentity(entityKind, entityId, quantity, component) {
  return [entityKind, entityId, quantity, component].join(':');
}
function caseIndependentIdentity(row) {
  return rowIdentity(row.entityKind, row.entityId, row.quantity, row.component);
}
function compareText(left, right) {
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
}
function caseAuthorityError(message) {
  const error = new TypeError(message);
  error.code = 'CAESAR_ACCDB_FRICTION_CASE_AUTHORITY_MISMATCH';
  return error;
}
function hydrotestError(message, code) {
  const error = new TypeError(message);
  error.code = code;
  return error;
}
function derivedFrictionError(message) {
  const error = new TypeError(message);
  error.code = 'CAESAR_ACCDB_DERIVED_FRICTION_AUTHORITY_MISMATCH';
  return error;
}
