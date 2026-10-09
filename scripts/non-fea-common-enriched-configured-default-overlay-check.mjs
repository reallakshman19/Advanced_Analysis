#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COMMON_ENRICHED_CANDIDATE_SCHEMA,
  COMMON_ENRICHED_CANDIDATE_STATUS,
  createCommonEnrichedPropertiesCandidate,
} from '../src/core/common-enriched-properties/candidate.js';
import { COMMON_ENRICHED_FIELD_SCHEMA } from '../src/core/common-enriched-properties/field.js';
import {
  COMMON_ENRICHED_TARGET_RECORD_SCHEMA,
  createCommonEnrichedTargetRecord,
} from '../src/core/common-enriched-properties/target-record.js';
import {
  COMMON_ENRICHED_TARGET_INVENTORY_SCHEMA,
  createCommonEnrichedTargetInventory,
} from '../src/core/common-enriched-properties/target-inventory.js';
import { semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import { normalizeWorkspaceDataset } from '../src/workspace/dataset-adapter.js';
import {
  authorityFromCommonEnrichedSourceKind,
} from '../src/workspace/engineering-loads/authorized-empirical-effective-value-ledger.js';
import {
  composeCommonEnrichedCandidateWithConfiguredDefaults,
  createNonFeaCommonEnrichedConfiguredDefaultOverlay,
} from '../src/workspace/project-data/non-fea-common-enriched-configured-default-overlay.js';

const sourceModel = makeSourceModel();
const inventory = createCommonEnrichedTargetInventory({
  schema: COMMON_ENRICHED_TARGET_INVENTORY_SCHEMA,
  inventoryId: 'INV-ISSUE1321-DEFAULTS',
  sharedModel: sourceModel,
});
const profile = approvedProfile([
  configured('OD-LINE', 'PIPE_OUTER_DIAMETER', 100, 'mm', { lineIds: ['L-1'] }),
  configured('WALL-LINE-SHADOWED', 'PIPE_WALL_THICKNESS', 6, 'mm', { lineIds: ['L-1'] }),
  configured('C1-WEIGHT', 'COMPONENT_WEIGHT', 10, 'kg', { entityIds: ['C1'] }),
  configured('C2-WEIGHT', 'COMPONENT_WEIGHT', 20, 'kg', { entityIds: ['C2'] }),
]);
const overlay = createNonFeaCommonEnrichedConfiguredDefaultOverlay({
  profile,
  sourceModel,
  inventory,
});
assert.deepEqual(overlay.blockers, []);
assert.equal(overlay.targetRecords.length, 3);
assert.equal(overlay.sourceBinding.sourceHash, overlay.configuredDefaultProviderSemanticHash);

const lineOverlay = overlay.targetRecords.find((row) => row.targetKind === 'LINE');
assert.ok(lineOverlay);
assert.equal(field(lineOverlay, 'pipe.outsideDiameterMm').value, 100);
assert.equal(field(lineOverlay, 'pipe.outsideDiameterMm').sourceKind, 'PROJECT_CONFIGURED_DEFAULT');
assert.equal(field(lineOverlay, 'pipe.outsideDiameterMm').status, 'RESOLVED_DERIVED');
assert.equal(field(lineOverlay, 'pipe.outsideDiameterMm').policyId, 'OD-LINE');
assert.equal(authorityFromCommonEnrichedSourceKind('PROJECT_CONFIGURED_DEFAULT'), 'PROJECT_CONFIGURED_DEFAULT');

const candidate = makeCandidate(inventory);
const composition = composeCommonEnrichedCandidateWithConfiguredDefaults({
  candidate,
  overlay,
  candidateId: 'CAND-ISSUE1321-DEFAULTED',
  revision: 2,
  createdAt: '2026-08-22T11:50:00.000Z',
});
assert.equal(composition.appliedRows.length, 3);
assert.equal(composition.shadowedRows.length, 1);
assert.ok(composition.candidate.sourceSnapshots.some((row) => (
  row.sourceKey === overlay.sourceBinding.sourceKey
  && row.sourceHash === overlay.sourceBinding.sourceHash
)));

const composedLine = composition.candidate.targetRecords.find((row) => row.targetKind === 'LINE');
assert.equal(field(composedLine, 'pipe.outsideDiameterMm').value, 100);
assert.equal(field(composedLine, 'pipe.outsideDiameterMm').sourceKind, 'PROJECT_CONFIGURED_DEFAULT');
assert.equal(field(composedLine, 'pipe.wallThicknessMm').value, 5,
  'resolved source wall thickness must shadow the configured default');
assert.equal(field(composedLine, 'pipe.wallThicknessMm').sourceKind, 'MODEL');

const c1 = composition.candidate.targetRecords.find((row) => row.sourceRecordId === 'C1');
const c2 = composition.candidate.targetRecords.find((row) => row.sourceRecordId === 'C2');
assert.equal(field(c1, 'component.weightKg').value, 10);
assert.equal(field(c2, 'component.weightKg').value, 20);
assert.equal(field(c1, 'component.weightKg').sourceKind, 'PROJECT_CONFIGURED_DEFAULT');
assert.equal(field(c2, 'component.weightKg').sourceKind, 'PROJECT_CONFIGURED_DEFAULT');

const partial = createNonFeaCommonEnrichedConfiguredDefaultOverlay({
  profile: approvedProfile([
    configured('OD-C1-ONLY', 'PIPE_OUTER_DIAMETER', 100, 'mm', { entityIds: ['C1'] }),
  ]),
  sourceModel,
  inventory,
});
assert.ok(partial.blockers.some((row) => row.code === 'CONFIGURED_DEFAULT_LINE_PARTIAL_COVERAGE'));
assert.equal(partial.targetRecords.some((row) => row.targetKind === 'LINE'), false);

const sjson = normalizeWorkspaceDataset(JSON.parse(readFileSync(
  new URL('../benchmarks/Sjson.json', import.meta.url), 'utf8',
)), 'Sjson.json');
const sjsonProfile = JSON.parse(readFileSync(
  new URL('../project-data/1885s-project-data-profile.json', import.meta.url), 'utf8',
));
const sjsonProfileHash = semanticHash(sjsonProfile);
const sjsonOverlay = createNonFeaCommonEnrichedConfiguredDefaultOverlay({
  profile: sjsonProfile,
  sourceModel: sjson.sharedModel,
  inventory: createCommonEnrichedTargetInventory({
    schema: COMMON_ENRICHED_TARGET_INVENTORY_SCHEMA,
    inventoryId: 'INV-SJSON-DENSITY-UNIT-REGRESSION',
    sharedModel: sjson.sharedModel,
  }),
  requestedMethods: ['WEIGHT_AND_GRAVITY'],
});
assert.deepEqual(sjsonOverlay.blockers, [],
  'the shipped kg/m³ density defaults must project to canonical kg/m3 fields');
assert.equal(sjsonOverlay.targetRecords.length, 5);
for (const record of sjsonOverlay.targetRecords) {
  assert.equal(field(record, 'fluid.hydroDensityKgM3').value, 1000);
  assert.equal(field(record, 'fluid.hydroDensityKgM3').unit, 'kg/m3');
  assert.equal(field(record, 'insulation.densityKgM3').value, 210);
  assert.equal(field(record, 'insulation.densityKgM3').unit, 'kg/m3');
}
assert.equal(semanticHash(sjsonProfile), sjsonProfileHash,
  'unit normalization must preserve the source profile and its authority hash');

const wrongDensityUnit = createNonFeaCommonEnrichedConfiguredDefaultOverlay({
  profile: approvedProfile([
    configured('WRONG-DENSITY', 'HYDRO_FLUID_DENSITY', 1000, 'kg/mm3', { lineIds: ['L-1'] }),
  ]),
  sourceModel,
  inventory,
});
assert.ok(wrongDensityUnit.blockers.some((row) => (
  row.code === 'CONFIGURED_DEFAULT_COMMON_UNIT_UNSUPPORTED'
)), 'a different density scale must still be rejected');

const conflict = createNonFeaCommonEnrichedConfiguredDefaultOverlay({
  profile: approvedProfile([
    configured('OD-C1', 'PIPE_OUTER_DIAMETER', 100, 'mm', { entityIds: ['C1'] }),
    configured('OD-C2', 'PIPE_OUTER_DIAMETER', 110, 'mm', { entityIds: ['C2'] }),
  ]),
  sourceModel,
  inventory,
});
assert.ok(conflict.blockers.some((row) => row.code === 'CONFIGURED_DEFAULT_LINE_AUTHORITY_CONFLICT'));
assert.equal(conflict.targetRecords.some((row) => row.targetKind === 'LINE'), false);

const ambiguousCandidate = makeCandidate(inventory, 'BLOCKED_AMBIGUOUS');
assert.throws(
  () => composeCommonEnrichedCandidateWithConfiguredDefaults({
    candidate: ambiguousCandidate,
    overlay,
    candidateId: 'CAND-MUST-NOT-MASK-AMBIGUOUS',
    revision: 2,
    createdAt: '2026-08-22T11:51:00.000Z',
  }),
  (error) => error?.code === 'CONFIGURED_DEFAULT_COMMON_NON_MISSING_BLOCKER',
);

console.log(JSON.stringify({
  status: 'PASS',
  projectDefaultSourceKindPreserved: true,
  lineDefaultFullCoverageRequired: true,
  distinctComponentMassDefaultsPreserved: true,
  resolvedSourceShadowsDefault: true,
  partialLineCoverageBlocked: true,
  conflictingLineDefaultsBlocked: true,
  ambiguousEvidenceCannotBeMasked: true,
  sjsonDensityUnitAliasAccepted: true,
  differentDensityScaleRejected: true,
}, null, 2));

function makeSourceModel() {
  const base = {
    schema: 'shared-piping-model/v1',
    components: [
      component('C1', 'SRC-C1', 'L-1'),
      component('C2', 'SRC-C2', 'L-1'),
    ],
    supports: [],
  };
  return Object.freeze({ ...base, semanticHash: semanticHash(base) });
}

function component(componentKey, sourceEntityId, lineId) {
  return {
    componentKey,
    sourceEntityId,
    type: 'VALVE',
    nominalBoreMm: 100,
    pipingClass: 'CLASS-A',
    identity: {
      lineId,
      branchId: 'B-1',
      systemId: 'SYS-1',
      zoneId: 'ZONE-1',
      pipingClass: 'CLASS-A',
      nominalBoreMm: 100,
    },
  };
}

function approvedProfile(defaults) {
  return {
    revision: 14,
    qualificationPolicy: {
      configuredDefaults: {
        value: {
          schema: 'non-fea-configured-default-policy/v1',
          defaults,
        },
        evidence: { source: 'PROJECT-DATA-DEFAULT-POLICY', sourceHash: 'fixture' },
        approved: true,
      },
    },
  };
}

function configured(defaultId, fieldId, value, unit, scope) {
  return {
    defaultId,
    fieldId,
    value,
    unit,
    basis: `Approved project basis for ${defaultId}`,
    allowedMethods: ['WEIGHT_AND_GRAVITY'],
    scope,
  };
}

function makeCandidate(targetInventory, lineMissingStatus = 'BLOCKED_MISSING') {
  const line = targetInventory.lineTargets[0];
  const targetRecords = [
    createCommonEnrichedTargetRecord({
      schema: COMMON_ENRICHED_TARGET_RECORD_SCHEMA,
      targetId: line.targetId,
      targetKind: 'LINE',
      sourceModelHash: targetInventory.sourceModelHash,
      sourceRecordId: line.targetId,
      lineKey: line.lineKey,
      fields: [
        blockedField('pipe.outsideDiameterMm', 'mm', lineMissingStatus),
        resolvedField('pipe.wallThicknessMm', 5, 'mm'),
      ].sort((a, b) => a.field.localeCompare(b.field)),
    }),
    ...targetInventory.componentTargets.map((target) => createCommonEnrichedTargetRecord({
      schema: COMMON_ENRICHED_TARGET_RECORD_SCHEMA,
      targetId: target.targetId,
      targetKind: 'COMPONENT',
      sourceModelHash: targetInventory.sourceModelHash,
      sourceRecordId: target.sourceRecordId,
      lineKey: target.lineKey,
      fields: [blockedField('component.weightKg', 'kg', 'BLOCKED_MISSING')],
    })),
  ].sort((a, b) => a.targetId.localeCompare(b.targetId));
  return createCommonEnrichedPropertiesCandidate({
    schema: COMMON_ENRICHED_CANDIDATE_SCHEMA,
    candidateId: `CAND-SOURCE-${lineMissingStatus}`,
    projectId: 'PROJECT-ISSUE1321',
    revision: 1,
    createdAt: '2026-08-22T11:49:00.000Z',
    status: COMMON_ENRICHED_CANDIDATE_STATUS,
    sourceModelHash: targetInventory.sourceModelHash,
    sourceSnapshots: [],
    targetRecords,
    reviewLedgerHash: semanticHash({ review: lineMissingStatus }),
  });
}

function blockedField(name, unit, status) {
  return {
    schema: COMMON_ENRICHED_FIELD_SCHEMA,
    field: name,
    value: null,
    unit,
    status,
    sourceKind: 'NONE',
    sourceKey: null,
    sourceHash: null,
    locator: null,
    matchMethod: 'NONE',
    confidence: 0,
    policyId: null,
    policyHash: null,
    reviewEventId: null,
    approved: false,
    diagnostics: [],
  };
}

function resolvedField(name, value, unit) {
  return {
    schema: COMMON_ENRICHED_FIELD_SCHEMA,
    field: name,
    value,
    unit,
    status: 'RESOLVED_EXACT',
    sourceKind: 'MODEL',
    sourceKey: 'MODEL:SOURCE',
    sourceHash: '1'.repeat(64),
    locator: `MODEL:${name}`,
    matchMethod: 'EXACT_KEY',
    confidence: 1,
    policyId: null,
    policyHash: null,
    reviewEventId: null,
    approved: true,
    diagnostics: [],
  };
}

function field(record, name) {
  const result = record.fields.find((row) => row.field === name);
  assert.ok(result, `Missing ${record.targetId}:${name}`);
  return result;
}
