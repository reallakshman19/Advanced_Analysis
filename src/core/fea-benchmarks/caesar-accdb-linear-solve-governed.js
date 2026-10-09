import { deepFreeze } from '../shared-piping-model/immutable.js';
import { resolveCaesarConfigurationSetting } from './caesar-configuration-authority.js';
import { solveCaesarAccdbLinearBenchmark as solveFrozenLinearBenchmark } from './caesar-accdb-linear-solve.js';

const ADAPTER_ID = 'M047-ZERO-EFFECTIVE-FRICTION-COMPATIBILITY-V1';

/**
 * Govern the frozen ACCDB linear mechanics under the corrected M047 friction
 * authority. The model coefficient remains authoritative; a physical case is
 * linear only when its independent friction multiplier makes mu_eff exactly 0.
 * Derived cases are linear only when every primitive dependency is zero-friction.
 */
export function solveCaesarAccdbLinearBenchmark(benchmarkPackage, selectedCaseIds) {
  const requested = selectedCaseIds ?? benchmarkPackage.cases.map((row) => row.caseId);
  if (!Array.isArray(requested) || requested.length === 0) {
    throw new TypeError('At least one governed ACCDB linear-solve case ID is required.');
  }
  const evidenceByCase = Object.fromEntries(requested.map((caseId) => [
    String(caseId),
    requireZeroEffectiveFriction(benchmarkPackage, String(caseId)),
  ]));
  const compatibilityPackage = zeroCoefficientCompatibilityPackage(benchmarkPackage);
  const solved = solveFrozenLinearBenchmark(compatibilityPackage, requested);
  const mechanicsCases = Object.fromEntries(Object.entries(solved.mechanics.cases).map(([caseId, evidence]) => [
    caseId,
    deepFreeze({
      ...evidence,
      effectiveConfiguration: deepFreeze({
        ...evidence.effectiveConfiguration,
        friction: effectiveConfigurationFrictionEvidence(evidenceByCase[caseId]),
      }),
      frictionAuthorityAdapter: deepFreeze({
        adapterId: ADAPTER_ID,
        purpose: 'ALLOW_FROZEN_LINEAR_MECHANICS_ONLY_WHEN_GOVERNED_EFFECTIVE_FRICTION_IS_ZERO',
        frozenSolverCoefficientInjected: 0,
        resultMechanicsChanged: false,
      }),
    }),
  ]));
  return deepFreeze({
    ...solved,
    mechanics: {
      ...solved.mechanics,
      cases: mechanicsCases,
      limitations: [
        ...solved.mechanics.limitations.filter((entry) =>
          !entry.startsWith('Only cases whose governed effective coefficient of friction is zero')),
        'M047 compatibility adapter leaves the frozen linear mechanics byte-for-byte unchanged and permits only cases whose model coefficient times load-case friction multiplier is exactly zero.',
      ],
    },
  });
}

/** Resolve one selected case to its governed effective friction state. */
export function resolveCaesarEffectiveFriction(benchmarkPackage, caseId) {
  return resolveCaseFriction(benchmarkPackage, String(caseId), new Set());
}

function requireZeroEffectiveFriction(benchmarkPackage, caseId) {
  const state = resolveCaseFriction(benchmarkPackage, caseId, new Set());
  if (state.kind === 'PRIMITIVE' && state.effectiveCoefficient !== 0) {
    throw nonlinearCaseError(caseId, state.effectiveCoefficient);
  }
  if (state.kind === 'DERIVED') {
    const nonzero = state.dependencies.filter((entry) => entry.effectiveCoefficient !== 0);
    if (nonzero.length > 0) {
      throw nonlinearCaseError(
        caseId,
        nonzero.map((entry) => `${entry.caseId}:${entry.effectiveCoefficient}`).join(','),
      );
    }
  }
  return state;
}

function resolveCaseFriction(benchmarkPackage, caseId, active) {
  const caseRecord = benchmarkPackage.cases.find((entry) => entry.caseId === caseId);
  if (!caseRecord) throw new TypeError(`Unknown ACCDB case ${caseId}.`);
  if (active.has(caseId)) throw new TypeError(`ACCDB load-case cycle includes ${caseId}.`);
  const formula = String(caseRecord.formula).replace(/\s+/gu, '').toUpperCase();
  const derived = /^L(\d+)=L(\d+)-L(\d+)$/u.exec(formula);
  if (derived) {
    const next = new Set(active);
    next.add(caseId);
    const dependencies = [derived[2], derived[3]].map((number) => {
      const dependency = benchmarkPackage.cases.find((entry) => entry.lcaseNumber === Number(number));
      if (!dependency) throw new TypeError(`${caseId} requires missing dependency L${number}.`);
      const resolved = resolveCaseFriction(benchmarkPackage, dependency.caseId, next);
      if (resolved.kind !== 'PRIMITIVE') {
        return resolved.dependencies.map((entry) => ({ ...entry, viaCaseId: dependency.caseId }));
      }
      return [{
        caseId: dependency.caseId,
        modelCoefficient: resolved.modelCoefficient,
        frictionMultiplier: resolved.frictionMultiplier,
        effectiveCoefficient: resolved.effectiveCoefficient,
      }];
    }).flat();
    return deepFreeze({
      setting: 'EFFECTIVE_FRICTION',
      caseId,
      kind: 'DERIVED',
      formula: caseRecord.formula,
      combinationMethod: 'ALG',
      dependencies: Object.freeze(dependencies),
      effectiveCoefficient: null,
    });
  }

  const coefficient = resolveCaesarConfigurationSetting(
    benchmarkPackage.profile.configurationAuthority,
    'COEFFICIENT_OF_FRICTION_MU',
    caseId,
  );
  const multiplier = resolveCaesarConfigurationSetting(
    benchmarkPackage.profile.configurationAuthority,
    'FRICTION_MULTIPLIER',
    caseId,
  );
  const modelCoefficient = Number(coefficient.value);
  const frictionMultiplier = Number(multiplier.value);
  if (!(modelCoefficient >= 0) || !(frictionMultiplier >= 0)) {
    throw new TypeError(`${caseId} friction coefficient and multiplier must be nonnegative.`);
  }
  return deepFreeze({
    setting: 'EFFECTIVE_FRICTION',
    caseId,
    kind: 'PRIMITIVE',
    modelCoefficient: deepFreeze(coefficient),
    frictionMultiplier: deepFreeze(multiplier),
    effectiveCoefficient: modelCoefficient * frictionMultiplier,
    equation: 'COEFFICIENT_OF_FRICTION_MU * FRICTION_MULTIPLIER',
  });
}

function effectiveConfigurationFrictionEvidence(state) {
  if (state.kind !== 'PRIMITIVE') {
    return deepFreeze({
      setting: 'EFFECTIVE_FRICTION',
      level: 'DERIVED_ALGEBRAIC_DEPENDENCIES',
      value: 0,
      source: 'MODEL_COEFFICIENT_TIMES_LOAD_CASE_MULTIPLIER_DEPENDENCIES',
      authority: state,
    });
  }
  return deepFreeze({
    setting: 'EFFECTIVE_FRICTION',
    level: 'MODEL_INPUT_X_LOAD_CASE_SETTING',
    value: state.effectiveCoefficient,
    source: `${state.modelCoefficient.source} * ${state.frictionMultiplier.source}`,
    modelCoefficient: state.modelCoefficient,
    frictionMultiplier: state.frictionMultiplier,
    equation: state.equation,
  });
}

function zeroCoefficientCompatibilityPackage(benchmarkPackage) {
  const authority = benchmarkPackage.profile.configurationAuthority;
  return {
    ...benchmarkPackage,
    profile: {
      ...benchmarkPackage.profile,
      configurationAuthority: {
        ...authority,
        layers: {
          ...authority.layers,
          modelInput: {
            ...authority.layers.modelInput,
            settings: {
              ...authority.layers.modelInput.settings,
              COEFFICIENT_OF_FRICTION_MU: 0,
            },
          },
        },
      },
    },
  };
}

function nonlinearCaseError(caseId, effective) {
  const error = new TypeError(
    `${caseId} has governed effective friction ${String(effective)} and requires the nonlinear ACCDB friction solver.`,
  );
  error.code = 'CAESAR_ACCDB_NONLINEAR_FRICTION_REQUIRED';
  return error;
}
