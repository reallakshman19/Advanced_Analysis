/**
 * FEA benchmark suite — public API.
 *
 * Verification tiers:
 *   T1_CLOSED_FORM   an exact analytical answer exists (patch test, Lame, uniaxial)
 *   T2_CONVERGENCE   no exact single-mesh answer; refinement behaviour is verified
 *   T3_INVARIANT     no reference needed; a physical or architectural law must hold
 *   T4_PRESENTATION  the displayed value must equal the published kernel evidence
 *   T5_PERFORMANCE   declared cost budgets
 */
export {
  BENCHMARK_REPORT_SCHEMA, CASE_STATUS, compareBenchmarkReports, runBenchmarks,
} from './runner.js';
export {
  BENCHMARK_ENTITY_KINDS,
  BENCHMARK_QUALIFICATION_REPORT_SCHEMA,
  BENCHMARK_RESULT_ROW_SCHEMA,
  BENCHMARK_ROW_STATUSES,
  benchmarkResultRowIdentity,
  normalizeBenchmarkResultRows,
  requireGovernedBenchmarkRecord,
  sealBenchmarkQualificationReport,
} from './qualification-contract.js';
export { compareBenchmarkResultRows } from './qualification-comparison.js';
export { buildBenchmarkEngineeringAssessment } from './qualification-engineering-assessment.js';
export { normalizeLinearSolverBenchmarkResult } from './qualification-normalization.js';
export { runGovernedBenchmarkQualification } from './qualification-pipeline.js';
export { createBenchmarkQualificationAdapter } from './adapters/generic.js';
export { CAESAR_ACCDB_ADAPTER_ID, createCaesarAccdbQualificationAdapter } from './adapters/caesar-accdb.js';
export {
  CAESAR_ACCDB_PACKAGE_SCHEMA,
  CAESAR_ACCDB_PROFILE_SCHEMA,
  CAESAR_BOURDON_PRESSURE_EFFECT_MODES,
  CAESAR_ACCDB_NODE_SELECTIONS,
  CAESAR_ACCDB_RESULT_FAMILIES,
  buildCaesarAccdbBenchmarkPackage,
  requiredCaesarAccdbTables,
} from './caesar-accdb-package.js';
export { convertCaesarValue, normalizeCaesarUnitToken, temperatureToKelvin } from './caesar-accdb-units.js';
export {
  CAESAR_CONFIGURATION_AUTHORITY_SCHEMA,
  CAESAR_CONFIGURATION_PRECEDENCE,
  normalizeCaesarConfigurationAuthority,
  resolveCaesarConfigurationSetting,
} from './caesar-configuration-authority.js';
export {
  resolveCaesarEffectiveFriction,
  solveCaesarAccdbLinearBenchmark,
} from './caesar-accdb-linear-solve-governed.js';
export {
  CAESAR_ACCDB_FRICTION_SOLVER_PROFILE,
  CAESAR_ACCDB_HYDROTEST_AUTHORITY_SCHEMA,
  resolveCaesarHydrotestQualificationAuthority,
  solveCaesarAccdbFrictionBenchmark,
} from './caesar-accdb-friction-solve-governed.js';
export {
  BM4_QUALIFICATION_ADAPTER_ID,
  BM4_QUALIFICATION_CASE_IDS,
  createBm4QualificationAdapter,
  normalizeBm4ReferenceCase,
} from './adapters/bm4.js';
export { kernelBenchmarkCases } from './cases-kernel.js';
export { presentationBenchmarkCases } from './cases-presentation.js';
export { performanceBenchmarkCases } from './cases-performance.js';

import { kernelBenchmarkCases } from './cases-kernel.js';
import { presentationBenchmarkCases } from './cases-presentation.js';
import { performanceBenchmarkCases } from './cases-performance.js';

export const BENCHMARK_TIERS = Object.freeze([
  'T1_CLOSED_FORM', 'T2_CONVERGENCE', 'T3_INVARIANT', 'T4_PRESENTATION', 'T5_PERFORMANCE',
]);

/**
 * Every registered benchmark case, in deterministic order.
 *
 * @returns {Array<Record<string, unknown>>} Case definitions.
 */
export function allBenchmarkCases() {
  return [
    ...kernelBenchmarkCases(),
    ...presentationBenchmarkCases(),
    ...performanceBenchmarkCases(),
  ];
}

/**
 * Cases attached to a given workbench surface.
 *
 * @param {string} surface 'LFEA' or 'LAFEA'.
 * @returns {Array<Record<string, unknown>>} Case definitions.
 */
export function benchmarkCasesForSurface(surface) {
  if (surface === 'LFEA') return allBenchmarkCases();
  if (surface === 'LAFEA') {
    return allBenchmarkCases().filter((row) => row.kernel !== 'lfea-workbench');
  }
  throw new TypeError(`Unknown benchmark surface: ${surface}.`);
}
