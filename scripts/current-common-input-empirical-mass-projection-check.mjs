#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NON_FEA_COMMON_SCHEMAS } from '../src/core/non-fea-common-checker/index.js';
import { buildModelLoadFoundation } from '../src/core/model-loads/model-load-foundation.js';
import { buildPipingPortTopologyGraph } from '../src/core/piping-topology/index.js';
import { projectEngineeringLoadSources } from '../src/core/model-loads/load-source-projection.js';
import { createPipingLoadCompositionProfile } from '../src/core/model-loads/composition-profile.js';
import {
  resolveComponentCaseMass,
  resolveComponentCaseMassValues,
} from '../src/core/model-loads/component-mass-resolver.js';
import { createSharedPipingModel, semanticHash } from '../src/core/shared-piping-model/index.js';
import { createLoadCalcInsulationDefaultProvider } from '../src/workspace/load-calc-insulation-input.js';
import { createNonFeaEnrichmentSidecar, resolveNonFeaEnrichment } from '../src/core/non-fea-enrichment/index.js';
import { createNonFeaEffectiveCommonInputProjection } from '../src/workspace/project-data/non-fea-effective-common-input-projection.js';
import { LOAD_CALC_INSULATION_ZERO_DEFAULT_V1 } from '../src/workspace/project-data/non-fea-product-engineering-default-profile.js';
import { createEvidenceValue, createEmptyProjectDataProfile, replaceProjectDataValue } from '../src/workspace/project-data/project-data-contract.js';
import { createNonFeaProductDefaultProvider } from '../src/workspace/project-data/non-fea-product-default-profile.js';
import { buildRoutePartitionModel } from '../src/workspace/routes/route-partition-model.js';
import { buildSupportSiteModel } from '../src/workspace/support-sites/support-site-model.js';
import { evaluateEmpiricalGravityMethodSelection } from '../src/workspace/engineering-loads/empirical-gravity-method-selection.js';
import { calculateSupportLoadDistributionFromQualifiedCaseMasses } from '../src/workspace/engineering-loads/support-load-distribution-v3.js';
import { createNonFeaEmpiricalRunAuthorization } from '../src/workspace/engineering-loads/non-fea-empirical-run-authorization.js';
import {
  CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION_SCHEMA,
  createCurrentCommonInputEmpiricalMassProjection,
  requireCurrentCommonInputEmpiricalMassProjection,
  requireCurrentCurrentCommonInputEmpiricalMassProjection,
} from '../src/workspace/engineering-loads/current-common-input-empirical-mass-projection.js';

const AUTHORIZED_AT = '2026-08-26T12:48:00.000Z';

// Deliberately make the workspace/source primitive basis numerically different
// from the Common Input enriched model. The projection must use the latter.
const rawModel = makeModel({
  pipeMassKgPerM: 4,
  insulationMassKgPerM: 0.5,
  opeFluidMassKgPerM: 1,
  hydFluidMassKgPerM: 1.5,
  valveDryMassKg: 50,
  componentContent: false,
});
const rawTopology = buildPipingPortTopologyGraph(rawModel);
const sourceLoadPrimitiveSet = buildModelLoadFoundation(rawModel, rawTopology).loadPrimitiveSet;

const enrichedModel = makeModel();
const profile = projectProfile();
const readySnapshot = snapshot(commonInput({
  sourceModel: rawModel,
  enrichedModel,
  projectDataProfile: profile,
  sourceLoadPrimitiveSet,
}));
const runAuthorization = createNonFeaEmpiricalRunAuthorization(readySnapshot, { authorizedAt: AUTHORIZED_AT });
const projection = createCurrentCommonInputEmpiricalMassProjection({ snapshot: readySnapshot, runAuthorization });

assert.equal(projection.schema, CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION_SCHEMA);
assert.deepEqual(requireCurrentCommonInputEmpiricalMassProjection(projection), projection);
assert.deepEqual(
  requireCurrentCurrentCommonInputEmpiricalMassProjection(projection, {
    snapshot: readySnapshot,
    runAuthorization,
  }),
  projection,
);
assert.equal(projection.sourceModelSemanticHash, rawModel.semanticHash);
assert.equal(projection.enrichedModelSemanticHash, enrichedModel.semanticHash);
assert.equal(projection.sourceLoadPrimitiveSetSemanticHash, sourceLoadPrimitiveSet.semanticHash);
assert.equal(projection.policy.projectionOnly, true);
assert.equal(projection.policy.executionAuthorizationGranted, false);
assert.equal(projection.policy.legacyPublicationOrHandoffAuthorityAsserted, false);
assert.equal(projection.policy.massBasisSource, 'SEALED_COMMON_INPUT_ENRICHED_MODEL');
assert.equal(projection.policy.sourceLoadPrimitiveSetUsedAsNumericalBasis, false);
assert.equal(projection.policy.effectiveLoadSourceProjectionRebuiltDeterministically, true);
assert.equal(projection.policy.existingMassResolverReused, true);
assert.equal(projection.policy.executionGravityConsumed, false);
assert.equal(projection.policy.directMassBasisPreserved, true);
assert.equal(projection.policy.fittingDerivationPreserved, true);
assert.equal(projection.policy.negligibleMassZeroPreserved, true);
assert.equal(projection.policy.ancillaryMassIncluded, true);
assert.equal(projection.policy.componentContainedFluidIncluded, true);
assert.equal(projection.policy.supportStaticsExecuted, false);
assert.equal(projection.summary.entityCount, 4);
assert.equal(projection.summary.entityCaseCount, 12);
assert.equal(projection.summary.zeroMassEntityCaseCount, 3);

const rawPipeEmpty = sourceLoadPrimitiveSet.primitives.find((row) => (
  row.componentKey === 'PIPE-A'
  && row.loadCaseId === 'EMPTY'
  && row.primitiveType === 'DISTRIBUTED_GRAVITY_LOAD'
));
assert.equal(rawPipeEmpty.massPerLengthKgM, 4.5,
  'fixture must prove source workspace primitives differ from enriched Common Input mass');

const pipe = entity('PIPE-A');
assert.deepEqual(caseMasses(pipe), { EMPTY: 28, HYD: 34, OPE: 32 });
assert.equal(caseRow(pipe, 'EMPTY').sourceMassPerLengthKgPerM, 11);
assert.equal(caseRow(pipe, 'EMPTY').claddingMassPerLengthKgPerM, 2);
assert.equal(caseRow(pipe, 'EMPTY').tracingMassPerLengthKgPerM, 1);
assert.equal(caseRow(pipe, 'EMPTY').totalMassPerLengthKgPerM, 14);
assert.equal(caseRow(pipe, 'EMPTY').sourceLengthM, 2);
assert.equal(caseRow(pipe, 'OPE').sourceMassPerLengthKgPerM, 13);
assert.equal(caseRow(pipe, 'HYD').sourceMassPerLengthKgPerM, 14);
assert.deepEqual(
  caseRow(pipe, 'EMPTY').sourceMassBreakdown.map((row) => row.sourceId),
  ['PIPE_METAL', 'INSULATION'],
);
assert.ok(caseRow(pipe, 'EMPTY').sourceMassBreakdown.every((row) => row.sourceEvidence),
  'direct kg/m mass basis must remain source evidence');
assert.equal(
  caseRow(pipe, 'EMPTY').formulaTrace.some((trace) => trace.formulaId === 'PIPE_METAL_MASS_PER_LENGTH_V1'),
  false,
  'direct PIPE kg/m authority must not be rewritten as a derived section formula',
);
assert.equal(caseRow(pipe, 'EMPTY').ancillaryEvidence.length, 2);

const fitting = entity('ELBO-A');
assert.equal(
  caseRow(fitting, 'EMPTY').dryMassEvidence?.source,
  'DERIVED_FROM_ADJACENT_PIPE_SECTION',
  'fitting mass must use the existing same-branch derivation against enriched pipe evidence',
);
assert.equal(caseRow(fitting, 'EMPTY').massKg, caseRow(fitting, 'OPE').massKg);
assert.equal(caseRow(fitting, 'EMPTY').massKg, caseRow(fitting, 'HYD').massKg);
assert.equal(caseRow(fitting, 'EMPTY').mode, 'POINT');

const gasket = entity('GASK-A');
assert.deepEqual(caseMasses(gasket), { EMPTY: 0, HYD: 0, OPE: 0 });
assert.equal(caseRow(gasket, 'EMPTY').dryPointMassKg, 0);
assert.ok(caseRow(gasket, 'EMPTY').diagnostics.some((row) => row.code === 'EXCLUDED_NEGLIGIBLE_MASS'));

const valve = entity('VALVE-A');
assert.deepEqual(caseMasses(valve), { EMPTY: 100, HYD: 110, OPE: 108 });
assert.equal(caseRow(valve, 'EMPTY').containedFluidMassKg, 0);
assert.equal(caseRow(valve, 'OPE').containedFluidMassKg, 8);
assert.equal(caseRow(valve, 'HYD').containedFluidMassKg, 10);
assert.equal(caseRow(valve, 'OPE').dryPointMassKg, 100);
assert.equal(caseRow(valve, 'OPE').containedFluidEvidence.sourceKind, 'PROJECT_CONFIGURED_DEFAULT');

for (const forbidden of ['baselineId', 'handoffId', 'authorityId', 'publicationDecision']) {
  assert.equal(Object.hasOwn(projection, forbidden), false,
    `${forbidden} must not be synthesized by the current Common Input projection`);
}

const forgedPolicy = rehashProjection(projection, {
  policy: { ...projection.policy, executionAuthorizationGranted: true },
});
expectCode(() => requireCurrentCommonInputEmpiricalMassProjection(forgedPolicy),
  'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_POLICY_INVALID');

const tamperedRows = structuredClone(projection.entityRows);
const pipeIndex = tamperedRows.findIndex((row) => row.entityId === 'PIPE-A');
tamperedRows[pipeIndex].cases[0].massKg += 1;
const tamperedMass = rehashProjection(projection, { entityRows: tamperedRows });
expectCode(() => requireCurrentCommonInputEmpiricalMassProjection(tamperedMass),
  'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_COMPOSITION_INVALID');

const forgedSummary = rehashProjection(projection, {
  summary: { ...projection.summary, zeroMassEntityCaseCount: 999 },
});
expectCode(() => requireCurrentCommonInputEmpiricalMassProjection(forgedSummary),
  'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_SUMMARY_INVALID');

const forgedEffectiveBasis = rehashProjection(projection, {
  effectiveLoadSourceProjectionSemanticHash: semanticHash({ wrong: 'effective-mass-basis' }),
});
expectCode(
  () => requireCurrentCurrentCommonInputEmpiricalMassProjection(forgedEffectiveBasis, {
    snapshot: readySnapshot,
    runAuthorization,
  }),
  'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION_STALE',
);

const resealedSnapshot = snapshot(commonInput({
  sourceModel: rawModel,
  enrichedModel,
  projectDataProfile: profile,
  sourceLoadPrimitiveSet,
  overrides: {
    seal: {
      semanticHash: semanticHash({ seal: 'second' }),
      confirmedBy: 'different READY seal',
    },
  },
}));
expectCode(
  () => requireCurrentCurrentCommonInputEmpiricalMassProjection(projection, {
    snapshot: resealedSnapshot,
    runAuthorization,
  }),
  'NON_FEA_EMPIRICAL_RUN_AUTHORIZATION_SEAL_STALE',
);

// Same enriched model, different source/workspace primitive authority: projected
// masses remain identical, while currentness identity must change.
const alternateRawModel = makeModel({
  pipeMassKgPerM: 7,
  insulationMassKgPerM: 0.25,
  opeFluidMassKgPerM: 0.5,
  hydFluidMassKgPerM: 0.75,
  valveDryMassKg: 30,
  componentContent: false,
});
const alternateRawPrimitiveSet = buildModelLoadFoundation(
  alternateRawModel,
  buildPipingPortTopologyGraph(alternateRawModel),
).loadPrimitiveSet;
const alternateSnapshot = snapshot(commonInput({
  sourceModel: alternateRawModel,
  enrichedModel,
  projectDataProfile: profile,
  sourceLoadPrimitiveSet: alternateRawPrimitiveSet,
}));
const alternateAuthorization = createNonFeaEmpiricalRunAuthorization(alternateSnapshot, {
  authorizedAt: AUTHORIZED_AT,
});
const alternateProjection = createCurrentCommonInputEmpiricalMassProjection({
  snapshot: alternateSnapshot,
  runAuthorization: alternateAuthorization,
});
assert.deepEqual(
  alternateProjection.entityRows.map((row) => [row.entityId, caseMasses(row)]),
  projection.entityRows.map((row) => [row.entityId, caseMasses(row)]),
  'source workspace primitive changes must not alter masses when sealed enriched Common Input is unchanged',
);
assert.notEqual(alternateProjection.sourceLoadPrimitiveSetSemanticHash,
  projection.sourceLoadPrimitiveSetSemanticHash);
assert.notEqual(alternateProjection.semanticHash, projection.semanticHash);

// Sjson preserves unknown source units. Use only the approved, sealed effective
// length-unit entry; never rewrite the enriched model or override source units.
const unknownUnitModel = makeModel({ lengthUnit: 'unknown' });
const approvedUnitProfile = {
  ...profile,
  sourcesAndUnits: {
    ...profile.sourcesAndUnits,
    lengthUnit: createEvidenceValue('mm', { source: 'sealed effective unit fixture' }, true),
  },
};
function projectWithUnit(model, projectDataProfile) {
  const unitSnapshot = snapshot(commonInput({
    sourceModel: rawModel, enrichedModel: model, projectDataProfile, sourceLoadPrimitiveSet,
  }));
  return createCurrentCommonInputEmpiricalMassProjection({
    snapshot: unitSnapshot,
    runAuthorization: createNonFeaEmpiricalRunAuthorization(unitSnapshot, { authorizedAt: AUTHORIZED_AT }),
  });
}
const unknownUnitProjection = projectWithUnit(unknownUnitModel, approvedUnitProfile);
assert.deepEqual(unknownUnitProjection.entityRows, projection.entityRows);
assert.equal(unknownUnitModel.units.length, 'unknown', 'sealed source units must remain unchanged');
assert.equal(unknownUnitProjection.enrichedModelSemanticHash, unknownUnitModel.semanticHash);
const unknownTopology = buildPipingPortTopologyGraph(unknownUnitModel);
const normalizedUnknown = projectEngineeringLoadSources(unknownUnitModel, unknownTopology, {
  lengthUnitFallback: approvedUnitProfile.sourcesAndUnits.lengthUnit,
});
assert.equal(normalizedUnknown.sharedModelSemanticHash, unknownUnitModel.semanticHash);
assert.equal(normalizedUnknown.topologySemanticHash, unknownTopology.semanticHash);
assert.equal(normalizedUnknown.units.declaredSourceLengthUnit, 'unknown');
assert.equal(normalizedUnknown.units.sourceLengthUnit, 'mm');
assert.equal(normalizedUnknown.units.lengthUnitAuthority.entrySemanticHash,
  semanticHash(approvedUnitProfile.sourcesAndUnits.lengthUnit));
assert.equal(projectEngineeringLoadSources(unknownUnitModel, unknownTopology).units.unitSupported, false,
  'legacy callers must not silently gain a unit fallback');
const changedUnitEvidence = createEvidenceValue('mm', { source: 'different sealed authority' }, true);
const changedUnitProjection = projectWithUnit(unknownUnitModel, {
  ...approvedUnitProfile,
  sourcesAndUnits: { ...approvedUnitProfile.sourcesAndUnits, lengthUnit: changedUnitEvidence },
});
assert.deepEqual(changedUnitProjection.entityRows, unknownUnitProjection.entityRows);
assert.notEqual(changedUnitProjection.effectiveLoadSourceProjectionSemanticHash,
  unknownUnitProjection.effectiveLoadSourceProjectionSemanticHash,
  'unit authority changes must change projection custody even when numerical masses agree');
assert.deepEqual(projectWithUnit(enrichedModel, {
  ...approvedUnitProfile,
  sourcesAndUnits: {
    ...approvedUnitProfile.sourcesAndUnits,
    lengthUnit: createEvidenceValue('m', { source: 'lower-precedence project unit' }, true),
  },
}).entityRows, projection.entityRows, 'explicit source mm must win over project m');
for (const entry of [
  createEvidenceValue('mm', { source: 'not approved' }, false),
  createEvidenceValue('mm', null, true),
  createEvidenceValue('unsupported-unit', { source: 'invalid unit' }, true),
]) {
  expectCode(() => projectWithUnit(unknownUnitModel, {
    ...approvedUnitProfile,
    sourcesAndUnits: { ...approvedUnitProfile.sourcesAndUnits, lengthUnit: entry },
  }), 'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_NOT_PROJECTABLE');
}
expectCode(() => projectWithUnit(makeModel({ lengthUnit: 'unsupported-unit' }), approvedUnitProfile),
  'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_NOT_PROJECTABLE');

// Mass is not placement authority. Derived midpoints must never become source
// CoG just to project already-known mass. Exact-point rows retain identical output.
const noCogMaterial = structuredClone(enrichedModel);
delete noCogMaterial.semanticHash;
noCogMaterial.components.forEach((item) => {
  item.geometry.explicitCenter = false;
  item.geometry.sources.center = 'derived.midpoint';
});
const noCogModel = createSharedPipingModel(noCogMaterial);
const noCogModelBefore = JSON.stringify(noCogModel);
const noCogProjection = projectWithUnit(noCogModel, profile);
const noCogSources = projectEngineeringLoadSources(noCogModel, buildPipingPortTopologyGraph(noCogModel));
const composition = createPipingLoadCompositionProfile();
const noCogValve = noCogSources.components.find((item) => item.componentKey === 'VALVE-A');
assert.equal(resolveComponentCaseMass(noCogValve, 'EMPTY', composition).code, 'MISSING_COMPONENT_COG',
  'legacy primitive resolution must remain placement-strict');
const valveMassOnly = resolveComponentCaseMassValues(noCogValve, 'EMPTY', composition);
assert.equal(valveMassOnly.ok, true);
assert.equal(valveMassOnly.pointMassKg, 100);
assert.equal(valveMassOnly.applicationPoint, null);
for (const row of noCogProjection.entityRows) {
  assert.deepEqual(caseMasses(row), caseMasses(entity(row.entityId)));
  if (row.componentType !== 'PIPE') {
    assert.ok(row.cases.every((item) => item.applicationPoint === null));
  }
}
assert.equal(JSON.stringify(noCogModel), noCogModelBefore, 'mass projection must not rewrite source geometry');
assert.equal(noCogProjection.policy.executionAuthorizationGranted, false);
const explicitValve = projectEngineeringLoadSources(enrichedModel, buildPipingPortTopologyGraph(enrichedModel))
  .components.find((item) => item.componentKey === 'VALVE-A');
assert.deepEqual(resolveComponentCaseMassValues(explicitValve, 'EMPTY', composition),
  resolveComponentCaseMass(explicitValve, 'EMPTY', composition), 'exact-point behavior must not change');
for (const [properties, code] of [
  [{ componentWeightKg: evidence(-1, 'kg', 'COMPONENT_WEIGHT_KG') }, 'INVALID_NEGATIVE_VALUE'],
  [{}, 'MISSING_COMPONENT_MASS'],
  [{ componentWeightKg: evidence(100, 'kg', 'COMPONENT_WEIGHT_KG'),
    unitPipeWeightKgPerM: evidence(2, 'kg/m', 'UNIT_PIPE_WEIGHT_KG_PER_M') }, 'DOUBLE_COUNT_CONFLICT'],
]) {
  const invalid = { ...noCogValve, engineeringProperties: properties };
  assert.equal(resolveComponentCaseMassValues(invalid, 'EMPTY', composition).code, code);
  assert.deepEqual(resolveComponentCaseMass(invalid, 'EMPTY', composition),
    resolveComponentCaseMassValues(invalid, 'EMPTY', composition));
}
for (const type of ['VALVE', 'GASK', 'UNSUPPORTED']) {
  const c = { ...noCogValve, type };
  assert.equal(resolveComponentCaseMassValues(c, 'EMPTY', composition).pointMassKg, 100);
  assert.equal(resolveComponentCaseMass(c, 'EMPTY', composition).code, 'MISSING_COMPONENT_COG');
}
const zeroGasket = { ...noCogValve, type: 'GASK', engineeringProperties: {} };
assert.deepEqual(resolveComponentCaseMass(zeroGasket, 'EMPTY', composition),
  resolveComponentCaseMassValues(zeroGasket, 'EMPTY', composition));
for (const code of ['UNIT_BLOCKED', 'GEOMETRY_LENGTH_CONFLICT']) {
  assert.equal(resolveComponentCaseMassValues({ ...noCogValve, diagnostics: [{ code }] },
    'EMPTY', composition).code, code);
}
// Independent density/volume reconstruction, not a stored solver expectation.
const densityPipe = {
  ...noCogValve, type: 'PIPE', geometry: { start: point(0), end: point(2), sourceLengthM: 2 },
  engineeringProperties: {
    outerDiameterMm: evidence(100, 'mm', 'OD'), wallThicknessMm: evidence(5, 'mm', 'WALL'),
    materialDensityKgM3: evidence(7850, 'kg/m3', 'METAL_DENSITY'),
    insulationThicknessMm: evidence(10, 'mm', 'INSULATION_THICKNESS'),
    insulationDensityKgM3: evidence(100, 'kg/m3', 'INSULATION_DENSITY'),
    fluidDensityOpeKgM3: evidence(800, 'kg/m3', 'OPE_DENSITY'),
    fluidDensityHydKgM3: evidence(1000, 'kg/m3', 'HYD_DENSITY'),
  },
};
for (const [loadCaseId, fluidDensity] of [['EMPTY', 0], ['OPE', 800], ['HYD', 1000]]) {
  const metal = Math.PI / 4 * (0.1 ** 2 - 0.09 ** 2) * 2 * 7850;
  const insulation = Math.PI / 4 * (0.12 ** 2 - 0.1 ** 2) * 2 * 100;
  const fluid = Math.PI / 4 * 0.09 ** 2 * 2 * fluidDensity;
  const resolved = resolveComponentCaseMassValues(densityPipe, loadCaseId, composition);
  assert.equal(resolved.ok, true);
  assert.ok(Math.abs(resolved.massPerLengthKgM * 2 - metal - insulation - fluid) < 1e-12);
  assert.deepEqual(resolved, resolveComponentCaseMass(densityPipe, loadCaseId, composition));
}
checkProjectedValveStatics();
checkBoreMatchedFittingProjection();
checkMissingInsulationProjection();

const source = readFileSync(new URL(
  '../src/workspace/engineering-loads/current-common-input-empirical-mass-projection.js',
  import.meta.url,
), 'utf8');
assert.match(source, /buildPipingPortTopologyGraph\(model\)/u,
  'projection must normalize topology from the sealed enriched model');
assert.match(source, /projectEngineeringLoadSources\(model, effectiveTopologyGraph/u,
  'projection must normalize model-load geometry from the sealed enriched model');
assert.match(source, /resolveComponentCaseMassValues\(component, loadCaseId, compositionProfile\)/u,
  'projection must share mass formulas without granting load placement authority');
assert.match(source, /derivePipeLikeFittingWeightEvidence\(component, components\)/u,
  'projection must reuse the established same-branch fitting derivation');
assert.match(source, /commonInput\.enrichedModel/u,
  'numerical mass basis must be the sealed Common Input enriched model');
assert.match(source, /createNonFeaCommonEnrichedConfiguredDefaultOverlay/u,
  'ancillary projection must reuse the existing exact configured-default overlay');
assert.doesNotMatch(source, /buildModelLoadFoundation/u,
  'mass projection must not create a weight-force primitive set under a separate gravity profile');
assert.doesNotMatch(source, /authorized-empirical-load-input/u,
  'projection must not depend on legacy authorized empirical input');
assert.doesNotMatch(source, /common-enriched-consumer-handoff/u,
  'projection must not synthesize legacy consumer handoff authority');
assert.doesNotMatch(source, /calculateSupportLoadDistribution|allocateSupport/u,
  'projection must not execute support statics');

console.log(JSON.stringify({
  status: 'PASS',
  benchmark: 'ISSUE1321_CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION',
  schema: projection.schema,
  commonInputSemanticHash: projection.commonInputSemanticHash,
  runAuthorizationSemanticHash: projection.runAuthorizationSemanticHash,
  sourceLoadPrimitiveSetSemanticHash: projection.sourceLoadPrimitiveSetSemanticHash,
  effectiveLoadSourceProjectionSemanticHash: projection.effectiveLoadSourceProjectionSemanticHash,
  entityCount: projection.summary.entityCount,
  entityCaseCount: projection.summary.entityCaseCount,
  enrichedModelMassBasisPreserved: true,
  sourcePrimitiveNumericalOverrideRejectedByDesign: true,
  executionGravityConsumed: false,
  directMassBasisPreserved: true,
  fittingDerivedMassPreserved: true,
  negligibleGasketZeroPreserved: true,
  ancillaryMassPreserved: true,
  componentContainedFluidPreserved: true,
  legacyPublicationHandoffSynthesized: false,
  supportStaticsExecuted: false,
  sealedLengthUnitFallbackVerified: true,
  explicitSourceUnitPrecedencePreserved: true,
  unapprovedMissingAndInvalidUnitEvidenceRejected: true,
  missingCogMassProjectedWithoutFabricatedPoint: true,
  legacyPrimitivePlacementStillStrict: true,
  projectedMissingCogMassToRealV2KernelVerified: true,
}, null, 2));

function checkMissingInsulationProjection() {
  const material = structuredClone(enrichedModel);
  const pipe = material.components.find((c) => c.componentKey === 'PIPE-A');
  delete pipe.engineeringProperties.insulationThicknessMm;
  delete pipe.engineeringProperties.insulationWeightKgPerM;
  const sourceModel = createSharedPipingModel(material);
  const before = JSON.stringify(sourceModel);
  const provider = createLoadCalcInsulationDefaultProvider({ sourceModel });
  const sidecar = createNonFeaEnrichmentSidecar({ sourceSemanticHash: sourceModel.semanticHash, records: provider.records });
  const candidateResolutionLedger = resolveNonFeaEnrichment({ sourceModel, sidecar });
  const effective = createNonFeaEffectiveCommonInputProjection({ sourceModel, candidateResolutionLedger });
  const model = effective.enrichedProjection.enrichedModel;
  const zero = projectWithUnit(model, profile);
  const row = zero.entityRows.find((c) => c.entityId === 'PIPE-A');
  assert.equal(caseRow(row, 'EMPTY').massKg, 26, '2 m * (10 metal + 2 cladding + 1 tracing), insulation=0');
  assert.equal(caseRow(row, 'EMPTY').sourceMassBreakdown.find((s) => s.sourceId === 'INSULATION').massPerLengthKgM, 0);
  assert.equal(zero.productEngineeringDefaultProfileSemanticHash, LOAD_CALC_INSULATION_ZERO_DEFAULT_V1.semanticHash);
  assert.equal(zero.policy.executionAuthorizationGranted, false);
  const changed = structuredClone(model);
  const changedPipe = changed.components.find((c) => c.componentKey === 'PIPE-A');
  changedPipe.engineeringProperties.insulationThicknessMm = evidence(25, 'mm', 'INSULATION_THICKNESS_MM');
  changedPipe.engineeringProperties.insulationDensityKgM3 = evidence(100, 'kg/m3', 'INSULATION_DENSITY_KG_M3');
  const positive = projectWithUnit(createSharedPipingModel(changed), profile);
  const independentMass = Math.PI / 4 * (0.15 ** 2 - 0.1 ** 2) * 100 * 2;
  assert.ok(Math.abs(caseRow(positive.entityRows.find((c) => c.entityId === 'PIPE-A'), 'EMPTY').massKg - 26 - independentMass) < 1e-12);
  assert.notEqual(positive.commonInputSemanticHash, zero.commonInputSemanticHash);
  assert.notEqual(positive.semanticHash, zero.semanticHash);
  assert.equal(JSON.stringify(sourceModel), before);
}

function checkBoreMatchedFittingProjection() {
  const material = structuredClone(enrichedModel);
  const pipe150 = material.components.find((row) => row.componentKey === 'PIPE-A');
  pipe150.compatibilityEvidence = { sourceLeaveBoreMm: evidence(150, 'mm', 'LBORE') };
  pipe150.engineeringProperties.outerDiameterMm.value = 168.3;
  pipe150.engineeringProperties.wallThicknessMm.value = 14.2748;
  const elbow150 = material.components.find((row) => row.componentKey === 'ELBO-A');
  elbow150.compatibilityEvidence = { sourceArriveBoreMm: evidence(150, 'mm', 'ABORE'),
    sourceLeaveBoreMm: evidence(150, 'mm', 'LBORE') };
  const pipe80 = component({ key: 'PIPE-80', type: 'PIPE', start: point(-1000), end: point(0),
    engineeringProperties: { ...structuredClone(pipe150.engineeringProperties),
      outerDiameterMm: evidence(88.9, 'mm', 'OD'), wallThicknessMm: evidence(7.62, 'mm', 'WALL') } });
  pipe80.compatibilityEvidence = { sourceLeaveBoreMm: evidence(80, 'mm', 'LBORE') };
  material.components.push(pipe80);
  const model = createSharedPipingModel(material), before = JSON.stringify(model);
  const actual = projectWithUnit(model, profile);
  const row = actual.entityRows.find((item) => item.entityId === 'ELBO-A');
  const independent = Math.PI / 4 * (0.1683 ** 2 - (0.1683 - 2 * 0.0142748) ** 2) * 7850 * 1.5 * 0.1683;
  assert.ok(Math.abs(caseRow(row, 'EMPTY').massKg - independent) < 1e-12);
  assert.equal(row.derivedDryMassEvidence.derivation.sectionSelection.nominalBoreMm, 150);
  assert.equal(row.derivedDryMassEvidence.derivation.sourceComponentKey, 'PIPE-A');
  assert.deepEqual(projectWithUnit(createSharedPipingModel({ ...model, components: [...model.components].reverse() }), profile), actual);
  const wrong = structuredClone(material);
  wrong.components.find((item) => item.componentKey === 'ELBO-A').compatibilityEvidence.sourceArriveBoreMm.value = 200;
  wrong.components.find((item) => item.componentKey === 'ELBO-A').compatibilityEvidence.sourceLeaveBoreMm.value = 200;
  expectCode(() => projectWithUnit(createSharedPipingModel(wrong), profile), 'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_NOT_PROJECTABLE');
  assert.equal(JSON.stringify(model), before);
  assert.equal(actual.policy.executionAuthorizationGranted, false);
}

function checkProjectedValveStatics() {
  const effectiveProfile = createNonFeaProductDefaultProvider({
    profile: replaceProjectDataValue(profile, 'topology.supportTypeCapabilities',
      { REST: { vertical: true } }, { source: 'mass/placement seam benchmark' }, true),
  }).effectiveProfile;
  const dataset = {
    datasetId: noCogModel.project.datasetId, version: 1, sourceSha256: 'a'.repeat(64),
    sharedModel: noCogModel,
    entities: [
      ...noCogModel.components.map((c) => ({
        entityId: c.componentKey, sourceEntityId: c.componentKey, entityType: c.type,
        category: c.type === 'PIPE' ? 'pipe' : 'component', branchId: 'B-1', lineKey: 'L-1',
        componentReference: c.componentKey, jsonPointer: `/entities/${c.componentKey}`,
        properties: { geometry: { start: c.geometry.start, end: c.geometry.end }, attributes: {} },
      })),
      ...[0, 2210].map((x) => ({
        entityId: `SUP-${x}`, entityType: 'SUPPORT', category: 'support', branchId: 'B-1', lineKey: 'L-1',
        properties: { geometry: { center: point(x) }, attributes: { SUPPORT_TAG: `SUP-${x}`, SUPPORT_TYPE: 'REST' } },
      })),
    ],
  };
  const routePartitionModel = buildRoutePartitionModel(dataset, effectiveProfile);
  const supportSiteModel = buildSupportSiteModel(dataset, effectiveProfile);
  assert.equal(routePartitionModel.status, 'READY');
  assert.equal(supportSiteModel.status, 'READY');
  const input = { dataset, profile: effectiveProfile, routePartitionModel, supportSiteModel,
    masterData: { lineList: { sourceHash: '' }, pipingClass: { sourceHash: '' }, weight: { sourceHash: '' } } };
  const selection = evaluateEmpiricalGravityMethodSelection(input);
  assert.equal(selection.selectedMethod, 'CHAINAGE_TRIBUTARY_SPAN_V2');
  assert.equal(selection.selectionState, 'SELECTED_V2_MISSING_COG_FALLBACK');
  const disabledProfile = replaceProjectDataValue(effectiveProfile, 'loadCalculation.componentCogFallback',
    'DISABLED', { source: 'negative fixture project override' }, true);
  assert.equal(evaluateEmpiricalGravityMethodSelection({ ...input, profile: disabledProfile }).selectedMethod, null);
  assert.equal(evaluateEmpiricalGravityMethodSelection({ ...input,
    requestedMethod: 'CHAINAGE_TRIBUTARY_SPAN_V3_COG' }).selectedMethod, null);
  for (const cog of [{ x: 'invalid', y: 0, z: 0 }, { x: 2160, y: 1000, z: 0 }]) {
    const badDataset = structuredClone(dataset);
    badDataset.sharedModel.components.find((c) => c.componentKey === 'VALVE-A').loadEvidence = {
      componentCog: { value: cog, unit: 'mm', sourcePath: 'fixture.explicitCog' },
    };
    delete badDataset.sharedModel.semanticHash;
    badDataset.sharedModel.semanticHash = semanticHash(badDataset.sharedModel);
    assert.equal(evaluateEmpiricalGravityMethodSelection({ ...input, dataset: badDataset }).selectedMethod, null,
      'invalid/off-route source CoG must never be erased by midpoint fallback');
  }
  const masses = (receipt) => receipt.entityRows.flatMap((row) => row.cases.map((c) => ({
    entityId: row.entityId, loadCaseId: c.loadCaseId, massKg: c.massKg,
    source: { kind: 'QUALIFIED_CASE_MASS_RECEIPT', authority: 'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION',
      semanticHash: receipt.semanticHash, caseSemanticHash: semanticHash(c), mode: c.mode },
  })));
  const calculated = calculateSupportLoadDistributionFromQualifiedCaseMasses(input, masses(noCogProjection));
  assert.equal(calculated.status, 'CALCULATED');
  // Single-factor independent oracle: hold every other mass and geometry fixed,
  // change only the declared valve dry mass from100 to0 kg. Other contributions
  // cancel. The known point at2160 between supports0/2210 has exact statics.
  const zeroMaterial = structuredClone(noCogModel);
  delete zeroMaterial.semanticHash;
  zeroMaterial.components.find((c) => c.componentKey === 'VALVE-A').engineeringProperties.componentWeightKg.value = 0;
  const zeroProjection = projectWithUnit(createSharedPipingModel(zeroMaterial), profile);
  const zero = calculateSupportLoadDistributionFromQualifiedCaseMasses(input, masses(zeroProjection));
  assert.equal(zero.status, 'CALCULATED');
  for (const c of calculated.loadCases) {
    const valveRow = c.contributionLedger.find((row) => row.entityId === 'VALVE-A');
    const expectedMass = { EMPTY: 100, OPE: 108, HYD: 110 }[c.loadCaseId];
    assert.equal(valveRow.massKg, expectedMass);
    assert.ok(Math.abs(valveRow.verticalForceN - expectedMass * 9.80665) < 1e-9);
    const baseline = zero.loadCases.find((row) => row.loadCaseId === c.loadCaseId);
    const delta = (x) => {
      const id = supportSiteModel.sites.find((site) => site.tags.includes(`SUP-${x}`)).siteId;
      return c.supportResults.find((row) => row.supportSiteId === id).verticalForceN
        - baseline.supportResults.find((row) => row.supportSiteId === id).verticalForceN;
    };
    const force = 100 * 9.80665;
    assert.ok(Math.abs(delta(0) - force * 50 / 2210) < 1e-9);
    assert.ok(Math.abs(delta(2210) - force * 2160 / 2210) < 1e-9);
    assert.ok(Math.abs(delta(0) + delta(2210) - force) < 1e-9);
    assert.ok(Math.abs(delta(2210) * 2210 - force * 2160) < 1e-6);
    assert.equal(c.equilibrium.passed, true);
  }
}

function entity(entityId) {
  const row = projection.entityRows.find((item) => item.entityId === entityId);
  assert.ok(row, `missing projection entity ${entityId}`);
  return row;
}
function caseRow(entityRow, loadCaseId) {
  const row = entityRow.cases.find((item) => item.loadCaseId === loadCaseId);
  assert.ok(row, `missing ${entityRow.entityId}:${loadCaseId}`);
  return row;
}
function caseMasses(entityRow) {
  return Object.fromEntries(entityRow.cases.map((row) => [row.loadCaseId, row.massKg]));
}
function snapshot(commonInputValue) {
  return { commonInput: commonInputValue, staleness: { stale: false, changes: [] }, error: '' };
}
function commonInput({ sourceModel, enrichedModel, projectDataProfile, sourceLoadPrimitiveSet, overrides = {} }) {
  const base = {
    schema: NON_FEA_COMMON_SCHEMAS.COMMON_INPUT,
    packageState: 'READY',
    requestSemanticHash: semanticHash({ request: 'mass-projection' }),
    reportSemanticHash: semanticHash({ report: 'mass-projection' }),
    candidateSemanticHash: semanticHash({ candidate: 'mass-projection' }),
    sourceDatasetSha256: 'a'.repeat(64),
    sourceModelSemanticHash: sourceModel.semanticHash,
    enrichmentSidecarSemanticHash: semanticHash({ sidecar: 'mass-projection' }),
    resolutionLedgerSemanticHash: semanticHash({ resolution: 'mass-projection' }),
    enrichedProjectionSemanticHash: semanticHash({ projection: enrichedModel.semanticHash }),
    projectDataProfileSemanticHash: semanticHash(projectDataProfile),
    configuredDefaultUsageLedgerSemanticHash: null,
    qualificationProfileSemanticHash: null,
    requestedLoadCases: ['EMPTY', 'HYD', 'OPE'],
    sealedMethodIds: ['SUSTAINED_REACTIONS', 'WEIGHT_AND_GRAVITY'],
    blockedMethodIds: [],
    enrichedModel,
    resolutionLedger: { schema: 'fixture-resolution/v1' },
    projectDataProfile,
    configuredDefaultUsageLedger: null,
    qualificationProfile: null,
    authorityContracts: {
      topologyGraph: contract('topology'),
      supportAttachmentModel: contract('attachment'),
      restraintCapabilityModel: contract('restraint'),
      supportSiteModel: contract('support-site'),
      routePartitionModel: contract('route'),
      loadPrimitiveSet: {
        schema: sourceLoadPrimitiveSet.schema,
        status: 'READY',
        semanticHash: sourceLoadPrimitiveSet.semanticHash,
      },
    },
    methodReadiness: [],
    lineage: { schema: 'fixture-lineage/v1' },
    seal: { semanticHash: semanticHash({ seal: 'first' }), confirmedBy: 'fixture READY seal' },
  };
  const material = { ...base, ...overrides };
  return { ...material, semanticHash: semanticHash(material) };
}
function contract(id) {
  return { schema: `fixture-${id}/v1`, status: 'READY', semanticHash: semanticHash({ contract: id }) };
}
function projectProfile() {
  const empty = createEmptyProjectDataProfile();
  return {
    ...empty,
    projectId: 'CURRENT-MASS-PROJECTION-PROJECT',
    revision: 1,
    updatedAt: '2026-08-26T12:45:00.000Z',
    qualificationPolicy: {
      ...empty.qualificationPolicy,
      configuredDefaults: createEvidenceValue({
        schema: 'non-fea-configured-default-policy/v1',
        defaults: [
          ancillaryDefault('PROJECT-CLADDING', 'CLADDING_WEIGHT', 2),
          ancillaryDefault('PROJECT-TRACING', 'TRACING_WEIGHT', 1),
          {
            defaultId: 'PROJECT-HYDRO-DENSITY', fieldId: 'HYDRO_FLUID_DENSITY',
            value: 1000, unit: 'kg/m³',
            basis: 'Hydro water density using the Project Data registry unit spelling.',
            allowedMethods: ['WEIGHT_AND_GRAVITY'], scope: { lineIds: ['L-1'] },
          },
        ],
      }, { source: 'Focused current Common Input mass projection fixture' }, true),
    },
  };
}
function ancillaryDefault(defaultId, fieldId, value) {
  return {
    defaultId, fieldId, value, unit: 'kg/m',
    basis: 'Qualified permanent ancillary distributed mass for projection parity.',
    allowedMethods: ['WEIGHT_AND_GRAVITY'], scope: { lineIds: ['L-1'] },
  };
}
function makeModel({
  pipeMassKgPerM = 10,
  insulationMassKgPerM = 1,
  opeFluidMassKgPerM = 2,
  hydFluidMassKgPerM = 3,
  valveDryMassKg = 100,
  componentContent = true,
  lengthUnit = 'mm',
} = {}) {
  return createSharedPipingModel({
    project: {
      datasetId: 'CURRENT-MASS-PROJECTION-DATASET',
      name: 'Current mass projection fixture',
      sourceName: 'fixture',
    },
    units: { length: lengthUnit, force: 'N', mass: 'kg' },
    sourceSnapshotRef: {
      schema: 'source-package-snapshot/v1',
      datasetId: 'CURRENT-MASS-PROJECTION-DATASET',
      sourceSchema: 'fixture/v1',
      sourceSemanticHash: semanticHash({ source: 'current-mass-projection', pipeMassKgPerM, valveDryMassKg }),
      sourceByteHash: null,
    },
    components: [
      component({
        key: 'PIPE-A', type: 'PIPE', start: point(0), end: point(2000),
        engineeringProperties: {
          unitPipeWeightKgPerM: evidence(pipeMassKgPerM, 'kg/m', 'UNIT_PIPE_WEIGHT_KG_PER_M'),
          outerDiameterMm: evidence(100, 'mm', 'OUTSIDE_DIAMETER_MM'),
          wallThicknessMm: evidence(5, 'mm', 'WALL_THICKNESS_MM'),
          materialDensityKgM3: evidence(7850, 'kg/m3', 'MATERIAL_DENSITY_KG_M3'),
          insulationWeightKgPerM: evidence(insulationMassKgPerM, 'kg/m', 'INSULATION_WEIGHT_KG_PER_M'),
          insulationThicknessMm: evidence(0, 'mm', 'INSULATION_THICKNESS_MM'),
          fluidWeightOpeKgPerM: evidence(opeFluidMassKgPerM, 'kg/m', 'FLUID_WEIGHT_OPE_KG_PER_M'),
          fluidWeightHydKgPerM: evidence(hydFluidMassKgPerM, 'kg/m', 'FLUID_WEIGHT_HYD_KG_PER_M'),
        },
      }),
      component({ key: 'ELBO-A', type: 'ELBO', start: point(2000), end: point(2100) }),
      component({ key: 'GASK-A', type: 'GASK', start: point(2100), end: point(2110) }),
      component({
        key: 'VALVE-A', type: 'VALVE', start: point(2110), end: point(2210),
        engineeringProperties: {
          componentWeightKg: evidence(valveDryMassKg, 'kg', 'COMPONENT_WEIGHT_KG'),
          ...(componentContent ? {
            componentFluidWeightOpeKg: configuredEvidence(8, 'kg', 'COMPONENT_OPERATING_FLUID_WEIGHT'),
            componentFluidWeightHydKg: configuredEvidence(10, 'kg', 'COMPONENT_HYDRO_FLUID_WEIGHT'),
          } : {}),
        },
      }),
    ],
    supports: [], sourceReferences: { nodes: [] }, diagnostics: [],
  });
}
function component({ key, type, start, end, engineeringProperties = {} }) {
  const center = { x: (start.x + end.x) / 2, y: 0, z: 0 };
  return {
    componentKey: key, sourceEntityId: key, name: key, type,
    identity: { lineId: 'L-1', branchId: 'B-1', systemId: 'SYS-1', zoneId: 'Z-1' },
    geometry: {
      start, end, center, points: [start, end], branchPoints: [], explicitCenter: type !== 'PIPE',
      boreMm: null, ports: [port(key, 'start', start), port(key, 'end', end)],
      sources: { start: `${key}.start`, end: `${key}.end`, center: type === 'PIPE' ? 'derived.midpoint' : `${key}.center`, branches: [] },
    },
    engineeringProperties, compatibilityEvidence: {},
    sourceReferences: { sourceNodeKey: `node:${key}`, sourceEntityId: key, jsonPointer: `/objects/${key}`, sourcePath: `/MODEL/${key}` },
    diagnostics: [],
  };
}
function point(x) { return { x, y: 0, z: 0 }; }
function port(key, role, position) {
  return { portKey: `${key}:port:${role}`, role, position, sourceReference: { sourcePath: `${key}.${role}` } };
}
function evidence(value, unit, field) {
  return { value, unit, sourcePath: `sourceAttributes.${field}`, sourceRoot: 'sourceAttributes', sourceKind: 'sourceAttributes' };
}
function configuredEvidence(value, unit, field) {
  return { value, unit, sourcePath: `nonFeaEnrichment.${field}`, sourceRoot: 'PROJECT_CONFIGURED_DEFAULT', sourceKind: 'PROJECT_CONFIGURED_DEFAULT' };
}
function rehashProjection(value, patch) {
  const material = { ...structuredClone(value), ...patch };
  delete material.semanticHash;
  return { ...material, semanticHash: semanticHash(material) };
}
function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.equal(error?.code, code, error?.stack || error?.message);
    return true;
  });
}
