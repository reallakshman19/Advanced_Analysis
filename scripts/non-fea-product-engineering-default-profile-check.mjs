#!/usr/bin/env node

import assert from 'node:assert/strict';
import { semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import {
  LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_EMPTY_V1,
  LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_STANDARD_V1,
  createNonFeaProductEngineeringDefaultProvider,
  createProductEngineeringDefaultProfile,
  requireProductEngineeringDefaultProfile,
} from '../src/workspace/project-data/non-fea-product-engineering-default-profile.js';

const sourceModel = makeSourceModel();

const empty = createNonFeaProductEngineeringDefaultProvider({
  defaultProfile: LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_EMPTY_V1,
  sourceModel,
  requestedMethods: ['WEIGHT_AND_GRAVITY'],
});
assert.equal(empty.profileId, 'LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_EMPTY_V1');
assert.equal(empty.productDefaultProfileSemanticHash, LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_EMPTY_V1.semanticHash);
assert.deepEqual(empty.records, []);
assert.deepEqual(empty.blockers, []);

const standard = createNonFeaProductEngineeringDefaultProvider({
  sourceModel,
  requestedMethods: ['THERMAL_FREE_DISPLACEMENT'],
});
assert.equal(standard.profileId, LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_STANDARD_V1.profileId);
assert.equal(LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_STANDARD_V1.defaults.length, 2);
assert.deepEqual(standard.blockers, []);
assert.equal(standard.records.length, 4,
  'global standard elastic modulus and thermal expansion must apply to both governed components');
const elasticRecords = standard.records.filter((record) => record.fieldId === 'ELASTIC_MODULUS');
const thermalExpansionRecords = standard.records.filter((record) => record.fieldId === 'THERMAL_EXPANSION_COEFFICIENT');
assert.equal(elasticRecords.length, 2);
assert.equal(thermalExpansionRecords.length, 2);
elasticRecords.forEach((record) => {
  assert.equal(record.value, 200000, '2.0e11 Pa must be converted exactly to 200000 MPa');
  assert.equal(record.unit, 'MPa');
  assert.equal(record.authority, 'PRODUCT_DEFAULT');
  assert.match(record.evidence.basis, /PD-ELASTIC-THERMAL/u);
  assert.match(record.evidence.basis, /1 MPa = 1e6 Pa/u);
  assert.equal(record.evidence.profileId, LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_STANDARD_V1.profileId);
  assert.equal(
    record.evidence.productDefaultProfileSemanticHash,
    LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_STANDARD_V1.semanticHash,
  );
});
thermalExpansionRecords.forEach((record) => {
  assert.equal(record.value, 12e-6, 'governed thermalExpansionPerK must remain exactly 12e-6 1/K');
  assert.equal(record.unit, '1/K');
  assert.equal(record.authority, 'PRODUCT_DEFAULT');
  assert.match(record.evidence.basis, /PD-ELASTIC-THERMAL/u);
  assert.match(record.evidence.basis, /without unit conversion/u);
  assert.equal(record.evidence.profileId, LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_STANDARD_V1.profileId);
  assert.equal(
    record.evidence.productDefaultProfileSemanticHash,
    LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_STANDARD_V1.semanticHash,
  );
});

const profile = createProductEngineeringDefaultProfile({
  profileId: 'PRODUCT-ENGINEERING-TABLE-2026A',
  version: 3,
  defaults: [
    productDefault('PD-OD-L1', 'PIPE_OUTER_DIAMETER', 168.3, 'mm', { lineIds: ['L-1'] }),
    productDefault('PD-WALL-CLASS-NB', 'PIPE_WALL_THICKNESS', 7.11, 'mm', {
      pipingClasses: ['CLASS-A'], nominalBoreMm: [150],
    }),
    productDefault('PD-C1-WEIGHT', 'COMPONENT_WEIGHT', 42, 'kg', { entityIds: ['C1'] }),
    productDefault('PD-C2-WEIGHT', 'COMPONENT_WEIGHT', 55, 'kg', { entityIds: ['C2'] }),
  ],
});
assert.deepEqual(requireProductEngineeringDefaultProfile(profile), profile);

const provider = createNonFeaProductEngineeringDefaultProvider({
  defaultProfile: profile,
  sourceModel,
  requestedMethods: ['WEIGHT_AND_GRAVITY'],
});
assert.deepEqual(provider.blockers, []);
assert.equal(provider.records.length, 6,
  'line OD and class+NB wall apply to two components each; two masses remain exact entity defaults');
provider.records.forEach((record) => {
  assert.equal(record.authority, 'PRODUCT_DEFAULT');
  assert.equal(record.evidence.profileId, profile.profileId);
  assert.equal(record.evidence.profileVersion, profile.version);
  assert.equal(record.evidence.productDefaultProfileSemanticHash, profile.semanticHash);
  assert.match(record.evidence.defaultSemanticHash, /^fnv1a64:[0-9a-f]{16}$/u);
  assert.equal(record.evidence.scopePrecedence, 'ISSUE_1321_SCOPE_PRECEDENCE_V1');
});

const c1Mass = provider.records.find((row) => (
  row.selectorKey === 'C1' && row.fieldId === 'COMPONENT_WEIGHT'
));
const c2Mass = provider.records.find((row) => (
  row.selectorKey === 'C2' && row.fieldId === 'COMPONENT_WEIGHT'
));
assert.equal(c1Mass.value, 42);
assert.equal(c2Mass.value, 55);
assert.notEqual(c1Mass.evidence.defaultSemanticHash, c2Mass.evidence.defaultSemanticHash);

const changed = createProductEngineeringDefaultProfile({
  profileId: profile.profileId,
  version: profile.version,
  defaults: [
    productDefault('PD-OD-L1', 'PIPE_OUTER_DIAMETER', 170, 'mm', { lineIds: ['L-1'] }),
  ],
});
assert.notEqual(changed.semanticHash, profile.semanticHash,
  'changing a product engineering value must change the product-profile hash');

assert.throws(
  () => createProductEngineeringDefaultProfile({
    profileId: 'INVALID-PRODUCT-TABLE',
    version: 1,
    defaults: [
      productDefault('PD-I-NOT-ALLOWED', 'SECOND_MOMENT_AREA', 123, 'mm4', { lineIds: ['L-1'] }),
    ],
  }),
  (error) => error?.code === 'PRODUCT_ENGINEERING_DEFAULT_FIELD_NOT_PERMITTED',
);

const conflictingProfile = createProductEngineeringDefaultProfile({
  profileId: 'PRODUCT-CONFLICT-TABLE',
  version: 1,
  defaults: [
    productDefault('PD-OD-A', 'PIPE_OUTER_DIAMETER', 168.3, 'mm', { lineIds: ['L-1'] }),
    productDefault('PD-OD-B', 'PIPE_OUTER_DIAMETER', 170, 'mm', { lineIds: ['L-1'] }),
  ],
});
const conflicting = createNonFeaProductEngineeringDefaultProvider({
  defaultProfile: conflictingProfile,
  sourceModel,
  requestedMethods: ['WEIGHT_AND_GRAVITY'],
});
assert.ok(conflicting.blockers.some((row) => row.code === 'CONFIGURED_DEFAULT_SCOPE_CONFLICT'));
assert.equal(conflicting.records.length, 0,
  'equal-scope unequal product defaults must not publish a winner');

const tampered = structuredClone(profile);
tampered.defaults[0].value = 999;
assert.throws(
  () => requireProductEngineeringDefaultProfile(tampered),
  (error) => ['PRODUCT_ENGINEERING_DEFAULT_ROW_HASH_MISMATCH', 'PRODUCT_ENGINEERING_DEFAULT_PROFILE_HASH_MISMATCH'].includes(error?.code),
);

console.log(JSON.stringify({
  status: 'PASS',
  builtInEngineeringDefaultCount: LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_STANDARD_V1.defaults.length,
  builtInElasticModulusMpa: elasticRecords[0]?.value ?? null,
  builtInThermalExpansionPerK: thermalExpansionRecords[0]?.value ?? null,
  existingProductDefaultCustodyReused: true,
  explicitProductRecordCount: provider.records.length,
  distinctComponentMassDefaults: [c1Mass.value, c2Mass.value],
  productProfileHashBound: true,
  disallowedFieldRejected: true,
  equalScopeConflictFailsClosed: true,
}, null, 2));

function productDefault(defaultId, fieldId, value, unit, scope) {
  return {
    defaultId,
    fieldId,
    value,
    unit,
    basis: `Qualified product engineering table basis for ${defaultId}`,
    allowedMethods: ['WEIGHT_AND_GRAVITY'],
    scope,
  };
}

function makeSourceModel() {
  const material = {
    schema: 'shared-piping-model/v1',
    components: [
      component('C1', 'SRC-C1', 'L-1'),
      component('C2', 'SRC-C2', 'L-1'),
    ],
    supports: [],
  };
  return { ...material, semanticHash: semanticHash(material) };
}

function component(componentKey, sourceEntityId, lineId) {
  return {
    componentKey,
    sourceEntityId,
    type: 'VALVE',
    nominalBoreMm: 150,
    pipingClass: 'CLASS-A',
    identity: {
      lineId,
      branchId: 'B-1',
      systemId: 'SYS-1',
      zoneId: 'ZONE-1',
      pipingClass: 'CLASS-A',
      nominalBoreMm: 150,
    },
  };
}
