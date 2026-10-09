#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CAESAR_ACCDB_FRICTION_SOLVER_PROFILE,
  CAESAR_CONFIGURATION_PRECEDENCE,
  resolveCaesarEffectiveFriction,
  resolveCaesarHydrotestQualificationAuthority,
} from '../src/core/fea-benchmarks/index.js';

const profile = JSON.parse(readFileSync(resolve(
  'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json',
), 'utf8'));
const benchmarkPackage = {
  schema: 'caesar-accdb-benchmark-package/v1',
  profile,
  cases: [
    { caseId: 'L1', lcaseNumber: 1, caseClass: 'HYD', formula: 'WW+HP' },
    { caseId: 'L2', lcaseNumber: 2, caseClass: 'OPE', formula: 'W' },
    { caseId: 'L3', lcaseNumber: 3, caseClass: 'OPE', formula: 'T1' },
    { caseId: 'L4', lcaseNumber: 4, caseClass: 'OPE', formula: 'P1' },
    { caseId: 'L5', lcaseNumber: 5, caseClass: 'OPE', formula: 'W+T1+P1' },
    { caseId: 'L6', lcaseNumber: 6, caseClass: 'SUS', formula: 'W+P1' },
    { caseId: 'L7', lcaseNumber: 7, caseClass: 'OPE', formula: 'W+T1+P1' },
    { caseId: 'L13', lcaseNumber: 13, caseClass: 'SUS', formula: 'W+P1' },
    { caseId: 'L14', lcaseNumber: 14, caseClass: 'EXP', formula: 'L14=L5-L6' },
    { caseId: 'L15', lcaseNumber: 15, caseClass: 'EXP', formula: 'L15=L7-L13' },
  ],
};

assert.deepEqual(CAESAR_CONFIGURATION_PRECEDENCE, [
  'OVERALL_GLOBAL_DEFAULT',
  'INDIVIDUAL_FILE_SETTING',
  'LOAD_CASE_SETTING',
  'MODEL_INPUT',
]);
assert.deepEqual(profile.configurationAuthority.precedence, CAESAR_CONFIGURATION_PRECEDENCE);
for (const caseId of ['L2', 'L3', 'L4', 'L5', 'L6']) {
  const friction = resolveCaesarEffectiveFriction(benchmarkPackage, caseId);
  assert.equal(friction.modelCoefficient.value, 0.3, `${caseId} model mu`);
  assert.equal(friction.frictionMultiplier.value, 0, `${caseId} multiplier`);
  assert.equal(friction.effectiveCoefficient, 0, `${caseId} effective mu`);
}
for (const caseId of ['L1', 'L7', 'L13']) {
  const friction = resolveCaesarEffectiveFriction(benchmarkPackage, caseId);
  assert.equal(friction.modelCoefficient.value, 0.3, `${caseId} model mu`);
  assert.equal(friction.frictionMultiplier.value, 1, `${caseId} multiplier`);
  assert.equal(friction.effectiveCoefficient, 0.3, `${caseId} effective mu`);
}
const l14 = resolveCaesarEffectiveFriction(benchmarkPackage, 'L14');
assert.equal(l14.kind, 'DERIVED');
assert.deepEqual(l14.dependencies.map((row) => [row.caseId, row.effectiveCoefficient]), [
  ['L5', 0], ['L6', 0],
]);
const l15 = resolveCaesarEffectiveFriction(benchmarkPackage, 'L15');
assert.equal(l15.kind, 'DERIVED');
assert.deepEqual(l15.dependencies.map((row) => [row.caseId, row.effectiveCoefficient]), [
  ['L7', 0.3], ['L13', 0.3],
]);
const hydro = resolveCaesarHydrotestQualificationAuthority(benchmarkPackage);
assert.equal(hydro.sourceCaseClass, 'HYD');
assert.equal(hydro.sourceFormula, 'WW+HP');
assert.equal(hydro.weightTerm, 'WW');
assert.equal(hydro.waterDensityKgPerM3, 1000);
assert.equal(hydro.insulationIncluded, false);
assert.equal(hydro.pressureTerm, 'HP');
assert.equal(hydro.pressureField, 'HYDRO_PRESSURE');
assert.equal(hydro.frozenPrimitiveFormula, 'W+P1');
assert.throws(
  () => resolveCaesarHydrotestQualificationAuthority({
    ...benchmarkPackage,
    cases: benchmarkPackage.cases.map((row) => row.caseId === 'L1' ? { ...row, formula: 'W+P1' } : row),
  }),
  (error) => error?.code === 'CAESAR_ACCDB_HYDROTEST_CASE_UNQUALIFIED',
  'The governed L1 entrypoint must reject any source formula other than pinned HYD WW+HP.',
);

const displayedFrictionStiffness = profile.configurationAuthority.layers.overallGlobalDefault.settings.FRICT_STIF.value;
assert.equal(displayedFrictionStiffness, 1e6);
assert.equal(displayedFrictionStiffness * 100, 1e8);
assert.equal(CAESAR_ACCDB_FRICTION_SOLVER_PROFILE.initialization, 'ALL_STICK');
assert.equal(CAESAR_ACCDB_FRICTION_SOLVER_PROFILE.relaxationFactor, 1);
assert.equal(CAESAR_ACCDB_FRICTION_SOLVER_PROFILE.loadSteps, 1);
assert.deepEqual(CAESAR_ACCDB_FRICTION_SOLVER_PROFILE.sensitivityMultipliers, [0.5, 1, 2]);
assert.equal(CAESAR_ACCDB_FRICTION_SOLVER_PROFILE.frictionForceScaleFloorN, 1);
assert.equal(CAESAR_ACCDB_FRICTION_SOLVER_PROFILE.frictionDirectionCosineTolerance, 1e-8);
assert.equal(CAESAR_ACCDB_FRICTION_SOLVER_PROFILE.reconstructionForceScaleFloorN, 1);
assert.equal(CAESAR_ACCDB_FRICTION_SOLVER_PROFILE.reconstructionMomentScaleFloorNm, 1);

const frictionSource = readFileSync(resolve(
  'src/core/fea-benchmarks/caesar-accdb-friction-solve.js',
), 'utf8');
assert.match(
  frictionSource,
  /isTranslation \? 'FORCE' : 'MOMENT', dof/u,
  'Nonlinear nodal reactions must retain the frozen/reference DOF component identity.',
);
assert.match(
  frictionSource,
  /isTranslation \? 'INCIDENT_GLOBAL_FORCE' : 'INCIDENT_GLOBAL_MOMENT',[\s\S]*?dof,/u,
  'Nonlinear incident nodal actions must retain the frozen/reference DOF component identity.',
);
assert.match(
  frictionSource,
  /TRANSLATION_DOFS\.forEach\(\(component\) => \{[\s\S]*?'INCIDENT_GLOBAL_FORCE', component/u,
  'L15 equilibrium must evaluate actual UX/UY/UZ nodal rows.',
);
assert.match(
  frictionSource,
  /combinedLimit = absoluteTolerance \+ relativeTolerance \* scale/u,
  'Iteration updates must enforce the declared combined absolute-relative tolerance.',
);
assert.match(
  frictionSource,
  /signedNormalReactionN = dot\(normalReactionGlobal, support\.normalDirection\)/u,
  'Signed normal reaction evidence must respect the declared restraint direction.',
);
assert.match(
  frictionSource,
  /const displacementUpdate = updateMetric\([\s\S]*?translationalDofValues\(U\)[\s\S]*?'TRANSLATIONAL_DOFS_ONLY',[\s\S]*?'m'/u,
  'Displacement convergence must use translations only and retain metre units.',
);
assert.match(
  frictionSource,
  /const reactionUpdate = updateMetric\([\s\S]*?translationalDofValues\(reactions\)[\s\S]*?'TRANSLATIONAL_DOFS_ONLY',[\s\S]*?'N'/u,
  'Reaction convergence must use translational forces only and retain newton units.',
);
assert.match(
  frictionSource,
  /reactionChangeRule: 'FORCE_AND_MOMENT_REACTION_NORMS_REPORTED_SEPARATELY_NO_MIXED_UNITS'/u,
  'Sensitivity must not combine force and moment reactions in one norm.',
);
assert.match(
  frictionSource,
  /translationReactionVectorRelativeChange:[\s\S]*?momentReactionVectorRelativeChange:/u,
  'Sensitivity must report translation-force and moment-reaction changes separately.',
);
assert.match(
  frictionSource,
  /rule: 'SENSITIVITY_IS_DIAGNOSTIC_AND_CANNOT_INVALIDATE_A_CONVERGED_NOMINAL_RUN'/u,
  'Diagnostic stiffness sensitivity must not invalidate a converged nominal result.',
);
assert.match(
  frictionSource,
  /convergenceStatus: 'DIAGNOSTIC_FAILED'/u,
  'Failed non-nominal sensitivity solves must be retained as diagnostic evidence rather than thrown away.',
);
assert.match(
  frictionSource,
  /FORCE_AND_MOMENT_EQUATIONS_NORMALIZED_SEPARATELY_BEFORE_DIMENSIONLESS_MAX/u,
  'Base reconstruction must normalize force and moment equations separately before comparing a dimensionless residual.',
);
assert.match(
  frictionSource,
  /return deepFreeze\(\{ \.\.\.row, caseId, value: values\.get\(identity\) \}\)/u,
  'Recovered nonlinear rows must be relabelled to their friction case rather than inheriting the control-case ID.',
);
assert.match(
  frictionSource,
  /profile\.frictionDirectionCosineTolerance/u,
  'Friction direction tolerance must come from the versioned solver profile.',
);
assert.match(
  frictionSource,
  /profile\.frictionForceScaleFloorN/u,
  'Friction force scale floor must come from the versioned solver profile.',
);

const governedFrictionSource = readFileSync(resolve(
  'src/core/fea-benchmarks/caesar-accdb-friction-solve-governed.js',
), 'utf8');
assert.match(
  governedFrictionSource,
  /caseClass !== 'HYD' \|\| formula !== 'WW\+HP'/u,
  'The governed nonlinear entrypoint must fail closed unless L1 remains exact HYD WW+HP.',
);
assert.match(
  governedFrictionSource,
  /CAESAR_WW_MEANS_PIPE_PLUS_WATER_AS_FLUID/u,
  'WW water-filled weight authority must be explicit.',
);
assert.match(
  governedFrictionSource,
  /CAESAR_HP_MEANS_HYDROSTATIC_TEST_PRESSURE/u,
  'HP hydrostatic pressure authority must be explicit.',
);
assert.match(
  governedFrictionSource,
  /CAESAR_INCLUDE_INSULATION_IN_HYDROTEST_DEFAULT_FALSE/u,
  'Hydrotest insulation exclusion authority must be explicit.',
);
assert.match(
  governedFrictionSource,
  /solveRawCaesarAccdbFrictionBenchmark\(benchmarkPackage, dependencyIds, options\)/u,
  'L13/L7 primitive dependencies must be solved before the derived L15 construction.',
);
assert.match(
  governedFrictionSource,
  /buildGovernedDerivedL15\(benchmarkPackage, preDerived\.cases\.L7, preDerived\.cases\.L13\)/u,
  'L15 must be built outside the nonlinear kernel from converged L7/L13 cases.',
);
assert.match(
  governedFrictionSource,
  /solveRawCaesarAccdbFrictionBenchmark\(benchmarkPackage, \['L1'\], options\)/u,
  'L1 must be invoked only as the final independent primitive friction state.',
);
assert.match(
  governedFrictionSource,
  /equilibriumQualificationUse: 'REPORT_ONLY_DERIVED_CASE_PRIMITIVE_OPERANDS_GOVERN_NONLINEAR_EQUILIBRIUM_ACCEPTANCE'/u,
  'L15 derived equilibrium must remain report-only while primitive equilibrium remains hard-gated.',
);
assert.match(
  governedFrictionSource,
  /algebraicIdentityStatus: 'PASS'/u,
  'The governed L15 result must publish an explicit exact algebraic identity gate.',
);

const assessmentSource = readFileSync(resolve(
  'src/core/fea-benchmarks/qualification-engineering-assessment.js',
), 'utf8');
assert.match(
  assessmentSource,
  /FORCE: Object\.freeze\(\['UX', 'UY', 'UZ'\]\)/u,
  'Coordinate-invariant nodal force vectors must use UX/UY/UZ benchmark components.',
);
assert.match(
  assessmentSource,
  /MOMENT: Object\.freeze\(\['RX', 'RY', 'RZ'\]\)/u,
  'Coordinate-invariant nodal moment vectors must use RX/RY/RZ benchmark components.',
);
assert.match(
  assessmentSource,
  /GLOBAL_END_FORCE_FROM: Object\.freeze\(\['FX', 'FY', 'FZ'\]\)/u,
  'Element-end force vectors must retain FX/FY/FZ action components.',
);

const benchmarkSource = readFileSync(resolve(
  'scripts/lfea-m047-bm4l-friction-benchmark.mjs',
), 'utf8');
assert.match(
  benchmarkSource,
  /equilibrium: benchmarkPackage\.references\[record\.caseId\]\.equilibrium/u,
  'Stage 2 must pass CAESAR reference equilibrium evidence into the engineering assessment.',
);
assert.match(
  benchmarkSource,
  /caseClass: caseRecord\.caseClass/u,
  'Resolved Stage 2 configuration must publish the canonical OPE/SUS/EXP/HYD case class.',
);
assert.match(
  benchmarkSource,
  /hydrotestAuthority = resolveCaesarHydrotestQualificationAuthority\(benchmarkPackage\)/u,
  'Hydrotest authority must resolve before the first Stage 2 solve.',
);
assert.match(
  benchmarkSource,
  /hydrotestAuthority,/u,
  'The resolved-configuration artifact must retain the governed hydrotest authority.',
);
assert.match(
  benchmarkSource,
  /l15Evidence\?\.independentNonlinearSolve !== false/u,
  'The Stage 2 gate must reject any independently solved L15 state.',
);
assert.match(
  benchmarkSource,
  /l15Evidence\?\.algebraicIdentityStatus !== 'PASS'/u,
  'The Stage 2 gate must hard-check L15 algebraic identity.',
);
assert.match(
  benchmarkSource,
  /l15DerivedEquilibriumStatus:/u,
  'L15 derived equilibrium status must be retained separately as report evidence.',
);
assert.match(
  benchmarkSource,
  /stateScope: 'PER_ACCDB_DIRECTIONAL_RESTRAINT_ROW'/u,
  'Friction active-set ownership must remain per ACCDB directional restraint row.',
);
assert.match(
  benchmarkSource,
  /Duplicate directional restraint DOF/u,
  'Ambiguous duplicate directional restraint DOFs must fail before nonlinear assembly.',
);
assert.match(
  benchmarkSource,
  /Directional restraint row .* is attached to anchor node/u,
  'Directional restraints attached to anchor nodes must fail before nonlinear assembly.',
);

process.stdout.write('M047 BM4_L friction contract: PASS\n');
