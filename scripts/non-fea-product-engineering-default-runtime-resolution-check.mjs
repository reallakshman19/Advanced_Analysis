#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  NON_FEA_ENRICHMENT_AUTHORITIES,
  createNonFeaEnrichedProjection,
  createNonFeaEnrichmentRecord,
  createNonFeaEnrichmentSidecar,
  resolveNonFeaEnrichment,
} from '../src/core/non-fea-enrichment/index.js';
import {
  createNonFeaConfiguredDefaultProvider,
} from '../src/workspace/project-data/non-fea-configured-default-provider.js';
import {
  LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_EMPTY_V1,
  LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_STANDARD_V1,
  createNonFeaProductEngineeringDefaultProvider,
  createProductEngineeringDefaultProfile,
} from '../src/workspace/project-data/non-fea-product-engineering-default-profile.js';
import { buildStraightFixture } from './w10.5-screening-fixtures.mjs';

const sourceModel = buildStraightFixture({ lengthsM: [1, 1] }).sharedModel;
const sourceHashBefore = sourceModel.semanticHash;
const sourceJsonBefore = JSON.stringify(sourceModel);

assert.equal(
  NON_FEA_ENRICHMENT_AUTHORITIES.at(-1),
  'PRODUCT_DEFAULT',
  'Product default must be the lowest current common-enrichment authority.',
);
assert.equal(
  LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_EMPTY_V1.defaults.length,
  0,
  'The explicit empty qualification profile must remain empty.',
);
assert.equal(
  LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_STANDARD_V1.defaults.length,
  2,
  'The shipped engineering Product-default profile must contain only the governed elastic/thermal bridge rows in this slice.',
);

const shippedElasticThermalProvider = createNonFeaProductEngineeringDefaultProvider({
  sourceModel,
  requestedMethods: ['THERMAL_FREE_DISPLACEMENT'],
});
assert.deepEqual(shippedElasticThermalProvider.blockers, []);
assert.equal(shippedElasticThermalProvider.profileId, LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_STANDARD_V1.profileId);
assert.equal(shippedElasticThermalProvider.records.length, 4);
const shippedElasticRecords = shippedElasticThermalProvider.records.filter((record) => record.fieldId === 'ELASTIC_MODULUS');
const shippedThermalExpansionRecords = shippedElasticThermalProvider.records.filter((record) => (
  record.fieldId === 'THERMAL_EXPANSION_COEFFICIENT'
));
assert.equal(shippedElasticRecords.length, 2);
assert.equal(shippedThermalExpansionRecords.length, 2);
shippedElasticRecords.forEach((record) => {
  assert.equal(record.value, 200000);
  assert.equal(record.unit, 'MPa');
  assert.equal(record.authority, 'PRODUCT_DEFAULT');
  assert.match(record.evidence.basis, /PD-ELASTIC-THERMAL/u);
  assert.match(record.evidence.basis, /1 MPa = 1e6 Pa/u);
});
shippedThermalExpansionRecords.forEach((record) => {
  assert.equal(record.value, 12e-6);
  assert.equal(record.unit, '1/K');
  assert.equal(record.authority, 'PRODUCT_DEFAULT');
  assert.match(record.evidence.basis, /PD-ELASTIC-THERMAL/u);
  assert.match(record.evidence.basis, /without unit conversion/u);
});

const shippedElasticThermalLedger = resolveNonFeaEnrichment({
  sourceModel,
  sidecar: createNonFeaEnrichmentSidecar({
    sourceSemanticHash: sourceModel.semanticHash,
    records: shippedElasticThermalProvider.records,
  }),
});
assert.equal(shippedElasticThermalLedger.status, 'READY');
for (const component of sourceModel.components) {
  const elastic = selectedCandidate(shippedElasticThermalLedger, component.componentKey, 'ELASTIC_MODULUS');
  const alpha = selectedCandidate(
    shippedElasticThermalLedger,
    component.componentKey,
    'THERMAL_EXPANSION_COEFFICIENT',
  );
  assert.equal(elastic.authority, 'PRODUCT_DEFAULT');
  assert.equal(elastic.value, 200000);
  assert.equal(alpha.authority, 'PRODUCT_DEFAULT');
  assert.equal(alpha.value, 12e-6);
}
const shippedElasticThermalProjection = createNonFeaEnrichedProjection({
  sourceModel,
  resolutionLedger: shippedElasticThermalLedger,
});
for (const component of shippedElasticThermalProjection.enrichedModel.components) {
  assert.equal(component.engineeringProperties.elasticModulusMpa.value, 200000);
  assert.equal(component.engineeringProperties.elasticModulusMpa.unit, 'MPa');
  assert.equal(component.engineeringProperties.elasticModulusMpa.sourceKind, 'PRODUCT_DEFAULT');
  assert.equal(component.engineeringProperties.thermalExpansionPerK.value, 12e-6);
  assert.equal(component.engineeringProperties.thermalExpansionPerK.unit, '1/K');
  assert.equal(component.engineeringProperties.thermalExpansionPerK.sourceKind, 'PRODUCT_DEFAULT');
}

const productElasticProfile = createProductEngineeringDefaultProfile({
  profileId: 'QUAL-PRODUCT-ELASTIC-2026A',
  version: 1,
  defaults: [productDefault({
    defaultId: 'PD-ELASTIC-GLOBAL',
    fieldId: 'ELASTIC_MODULUS',
    value: 190000,
    unit: 'MPa',
    allowedMethods: ['THERMAL_FREE_DISPLACEMENT'],
  })],
});
const productElasticProvider = createNonFeaProductEngineeringDefaultProvider({
  defaultProfile: productElasticProfile,
  sourceModel,
  requestedMethods: ['THERMAL_FREE_DISPLACEMENT'],
});
assert.deepEqual(productElasticProvider.blockers, []);
assert.equal(productElasticProvider.records.length, 2);
assert.ok(productElasticProvider.records.every((row) => row.authority === 'PRODUCT_DEFAULT'));

// PRODUCT_DEFAULT only: the missing target value may be filled and must carry
// explicit Product provenance into the common enriched projection.
const productOnlyLedger = resolveNonFeaEnrichment({
  sourceModel,
  sidecar: createNonFeaEnrichmentSidecar({
    sourceSemanticHash: sourceModel.semanticHash,
    records: productElasticProvider.records,
  }),
});
assert.equal(productOnlyLedger.status, 'READY');
for (const component of sourceModel.components) {
  const selected = selectedCandidate(productOnlyLedger, component.componentKey, 'ELASTIC_MODULUS');
  assert.equal(selected.authority, 'PRODUCT_DEFAULT');
  assert.equal(selected.value, 190000);
  assert.equal(selected.evidence.profileId, productElasticProfile.profileId);
  assert.equal(selected.evidence.profileVersion, productElasticProfile.version);
  assert.equal(selected.evidence.productDefaultProfileSemanticHash, productElasticProfile.semanticHash);
}
const productOnlyProjection = createNonFeaEnrichedProjection({
  sourceModel,
  resolutionLedger: productOnlyLedger,
});
for (const component of productOnlyProjection.enrichedModel.components) {
  assert.equal(component.engineeringProperties.elasticModulusMpa.value, 190000);
  assert.equal(component.engineeringProperties.elasticModulusMpa.sourceKind, 'PRODUCT_DEFAULT');
}

// PROJECT_CONFIGURED_DEFAULT + PRODUCT_DEFAULT: the Project default must win
// for its governed target while Product remains visible as a losing candidate.
const configuredProvider = createNonFeaConfiguredDefaultProvider({
  profile: approvedProjectProfile([
    configuredDefault({
      defaultId: 'PROJECT-ELASTIC-COMP-1',
      fieldId: 'ELASTIC_MODULUS',
      value: 200000,
      unit: 'MPa',
      allowedMethods: ['THERMAL_FREE_DISPLACEMENT'],
      scope: { entityIds: ['COMP-1'] },
    }),
  ]),
  sourceModel,
  requestedMethods: ['THERMAL_FREE_DISPLACEMENT'],
});
assert.deepEqual(configuredProvider.blockers, []);
const projectAndProductLedger = resolveNonFeaEnrichment({
  sourceModel,
  sidecar: createNonFeaEnrichmentSidecar({
    sourceSemanticHash: sourceModel.semanticHash,
    records: [
      ...configuredProvider.records,
      ...productElasticProvider.records,
    ],
  }),
});
assert.equal(projectAndProductLedger.status, 'READY');
assert.equal(
  selectedCandidate(projectAndProductLedger, 'COMP-1', 'ELASTIC_MODULUS').authority,
  'PROJECT_CONFIGURED_DEFAULT',
);
assert.equal(
  selectedCandidate(projectAndProductLedger, 'COMP-1', 'ELASTIC_MODULUS').value,
  200000,
);
assert.deepEqual(
  candidateAuthorities(projectAndProductLedger, 'COMP-1', 'ELASTIC_MODULUS'),
  ['PROJECT_CONFIGURED_DEFAULT', 'PRODUCT_DEFAULT'],
);
assert.equal(
  selectedCandidate(projectAndProductLedger, 'COMP-2', 'ELASTIC_MODULUS').authority,
  'PRODUCT_DEFAULT',
);

// SOURCE_EXPLICIT + PRODUCT_DEFAULT: existing governed source evidence must win.
const productWeightProfile = createProductEngineeringDefaultProfile({
  profileId: 'QUAL-PRODUCT-WEIGHT-2026A',
  version: 1,
  defaults: [productDefault({
    defaultId: 'PD-PIPE-WEIGHT-GLOBAL',
    fieldId: 'UNIT_PIPE_WEIGHT',
    value: 999,
    unit: 'kg/m',
    allowedMethods: ['WEIGHT_AND_GRAVITY'],
  })],
});
const productWeightProvider = createNonFeaProductEngineeringDefaultProvider({
  defaultProfile: productWeightProfile,
  sourceModel,
  requestedMethods: ['WEIGHT_AND_GRAVITY'],
});
assert.deepEqual(productWeightProvider.blockers, []);
const sourceAndProductLedger = resolveNonFeaEnrichment({
  sourceModel,
  sidecar: createNonFeaEnrichmentSidecar({
    sourceSemanticHash: sourceModel.semanticHash,
    records: productWeightProvider.records,
  }),
});
assert.equal(sourceAndProductLedger.status, 'READY');
for (const component of sourceModel.components) {
  const selected = selectedCandidate(sourceAndProductLedger, component.componentKey, 'UNIT_PIPE_WEIGHT');
  assert.equal(selected.authority, 'SOURCE_EXPLICIT');
  assert.equal(selected.value, 10);
  assert.deepEqual(
    candidateAuthorities(sourceAndProductLedger, component.componentKey, 'UNIT_PIPE_WEIGHT'),
    ['SOURCE_EXPLICIT', 'PRODUCT_DEFAULT'],
  );
}

// Product authority remains forbidden for support-state semantics; this leg is
// target engineering-default plumbing, not a support-authority expansion.
assert.throws(
  () => createNonFeaEnrichmentRecord({
    recordId: 'BAD-PRODUCT-SUPPORT-TYPE',
    selectorKind: 'ENTITY',
    selectorKey: sourceModel.supports[0].supportKey,
    fieldId: 'RESTRAINT_TYPE',
    value: 'ANCHOR',
    unit: '1',
    authority: 'PRODUCT_DEFAULT',
    sourceId: 'PRODUCT-DEFAULT-TEST',
    revision: '1',
    evidence: { source: 'qualification-only product table' },
  }),
  /PRODUCT_DEFAULT is not permitted for RESTRAINT_TYPE/u,
);

const runtimeSource = await readFile(
  new URL('../src/workspace/non-fea-common-input-runtime.js', import.meta.url),
  'utf8',
);
assert.match(
  runtimeSource,
  /createNonFeaProductEngineeringDefaultProvider/u,
  'Ordinary Common Input runtime must consume the existing Product engineering-default provider.',
);
assert.match(
  runtimeSource,
  /const productEngineeringDefaultProvider = createNonFeaProductEngineeringDefaultProvider\(\{[\s\S]*?sourceModel: dataset\.sharedModel,[\s\S]*?requestedMethods: configuration\.requestedMethods,[\s\S]*?\}\);/u,
  'Product engineering-default provider must bind the active source model and requested methods.',
);
assert.match(
  runtimeSource,
  /\.\.\.acceptedEnrichmentSidecar\.records,[\s\S]*?\.\.\.configuredDefaultProvider\.records,[\s\S]*?\.\.\.productEngineeringDefaultProvider\.records,/u,
  'The single ephemeral resolver sidecar must place Product evidence after Project configured defaults.',
);
assert.match(
  runtimeSource,
  /productEngineeringDefaultProvider,\s*\n\s*productDefaultProvider,/u,
  'Common Input request evidence must expose the exact Product engineering-default provider receipt.',
);
assert.equal(
  (runtimeSource.match(/resolveNonFeaEnrichment\(/gu) || []).length,
  1,
  'Ordinary Common Input must continue to use exactly one field-resolution call.',
);
assert.doesNotMatch(
  runtimeSource,
  /authorCommonEnrichedCandidateWithEffectiveDefaults/u,
  'Ordinary Common Input must not create a second Product-default resolution path through the authoring seam.',
);

assert.equal(sourceModel.semanticHash, sourceHashBefore, 'Product-default resolution changed source hash.');
assert.equal(JSON.stringify(sourceModel), sourceJsonBefore, 'Product-default resolution mutated the source model.');

console.log(JSON.stringify({
  status: 'PASS',
  benchmark: 'ISSUE1321_PRODUCT_ENGINEERING_DEFAULT_ORDINARY_RESOLUTION',
  shippedEngineeringProductDefaultCount: LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_STANDARD_V1.defaults.length,
  shippedElasticModulusMpa: shippedElasticRecords[0]?.value ?? null,
  shippedThermalExpansionPerK: shippedThermalExpansionRecords[0]?.value ?? null,
  shippedElasticThermalSource: 'PD-ELASTIC-THERMAL',
  shippedElasticThermalProjected: true,
  productOnlyWinner: 'PRODUCT_DEFAULT',
  projectOverProductWinner: 'PROJECT_CONFIGURED_DEFAULT',
  sourceOverProductWinner: 'SOURCE_EXPLICIT',
  productCandidateRemainsAuditableWhenShadowed: true,
  supportAuthorityExpanded: false,
  ordinaryRuntimeUsesSingleResolver: true,
  sourceImmutable: true,
}, null, 2));

function selectedCandidate(ledger, targetId, fieldId) {
  const row = resolutionRow(ledger, targetId, fieldId);
  assert.ok(row.selected, `missing selected candidate for ${targetId}/${fieldId}`);
  return row.selected;
}

function candidateAuthorities(ledger, targetId, fieldId) {
  return resolutionRow(ledger, targetId, fieldId).candidates.map((row) => row.authority);
}

function resolutionRow(ledger, targetId, fieldId) {
  const row = ledger.rows.find((item) => item.targetId === targetId && item.fieldId === fieldId);
  assert.ok(row, `missing resolution row for ${targetId}/${fieldId}`);
  return row;
}

function approvedProjectProfile(defaults) {
  return {
    revision: 1,
    qualificationPolicy: {
      configuredDefaults: {
        value: {
          schema: 'non-fea-configured-default-policy/v1',
          defaults,
        },
        evidence: { source: 'ISSUE1321-PROJECT-DEFAULT-QUALIFICATION', sourceHash: 'fixture' },
        approved: true,
      },
    },
  };
}

function configuredDefault(overrides) {
  return {
    defaultId: overrides.defaultId,
    fieldId: overrides.fieldId,
    value: overrides.value,
    unit: overrides.unit,
    basis: `Approved qualification basis for ${overrides.defaultId}`,
    allowedMethods: overrides.allowedMethods,
    ...(overrides.scope ? { scope: overrides.scope } : {}),
  };
}

function productDefault(overrides) {
  return {
    defaultId: overrides.defaultId,
    fieldId: overrides.fieldId,
    value: overrides.value,
    unit: overrides.unit,
    basis: `Qualified Product engineering basis for ${overrides.defaultId}`,
    allowedMethods: overrides.allowedMethods,
    ...(overrides.scope ? { scope: overrides.scope } : {}),
  };
}
