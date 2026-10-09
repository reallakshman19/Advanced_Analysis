#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  createEmptyProjectDataProfile,
} from '../src/workspace/project-data/project-data-contract.js';
import {
  createNonFeaProductDefaultProvider,
} from '../src/workspace/project-data/non-fea-product-default-profile.js';
import {
  getNonFeaFieldDefinition,
} from '../src/workspace/project-data/non-fea-field-registry.js';
import {
  buildSupportSiteModel,
} from '../src/workspace/support-sites/support-site-model.js';
import {
  buildRoutePartitionModel,
} from '../src/workspace/routes/route-partition-model.js';
import {
  evaluateEmpiricalGravityMethodSelection,
} from '../src/workspace/engineering-loads/empirical-gravity-method-selection.js';

const profile = createEmptyProjectDataProfile();
const provider = createNonFeaProductDefaultProvider({ profile });
const effective = provider.effectiveProfile;

assert.equal(effective.topology.portMatchToleranceMm.value, 0);
assert.equal(effective.topology.supportSiteGroupingToleranceMm.value, 0);
assert.equal(effective.topology.autoCarrierCoincidenceToleranceMm.value, 0);
assert.deepEqual(effective.topology.routeJoiningRules.value, {
  partition: 'branch-scoped-connected-components',
  chainage: 'exact-port-topology',
  sourceOrderAllowed: false,
  degreeAboveTwo: 'BLOCKED',
});
assert.deepEqual(effective.topology.supportTypeCapabilities.value, {
  DEFAULT: { vertical: false },
});
assert.deepEqual(effective.loadCalculation.equilibriumTolerances.value, {
  forceN: 1e-6,
  momentNmm: 1e-3,
});

for (const fieldId of [
  'PORT_MATCH_TOLERANCE',
  'SUPPORT_SITE_GROUPING_TOLERANCE',
  'AUTO_CARRIER_COINCIDENCE_TOLERANCE',
  'ROUTE_JOINING_RULES',
  'SUPPORT_TYPE_CAPABILITIES',
  'EQUILIBRIUM_TOLERANCES',
]) {
  const definition = getNonFeaFieldDefinition(fieldId);
  assert.ok(definition, `missing field registry row: ${fieldId}`);
  assert.ok(
    definition.authorityPath.includes('PRODUCT_DEFAULT'),
    `${fieldId} must admit PRODUCT_DEFAULT authority`,
  );
}
assert.ok(
  getNonFeaFieldDefinition('SUPPORT_TYPE_CAPABILITIES').methods.includes('WEIGHT_AND_GRAVITY'),
  'gravity support allocation must own support capability authority',
);
assert.ok(
  getNonFeaFieldDefinition('SUPPORT_SITE_GROUPING_TOLERANCE').methods.includes('WEIGHT_AND_GRAVITY'),
  'gravity topology must own support-site grouping tolerance authority',
);
assert.ok(
  getNonFeaFieldDefinition('AUTO_CARRIER_COINCIDENCE_TOLERANCE').methods.includes('WEIGHT_AND_GRAVITY'),
  'gravity topology must own AUTO-carrier coincidence tolerance authority',
);

const dataset = {
  datasetId: 'ISSUE1321-PRODUCT-BOOTSTRAP',
  version: 1,
  entities: [
    pipe('PIPE-1', { x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }),
    support('SUPPORT-A', { x: 0, y: 0, z: 0 }),
    support('SUPPORT-B', { x: 0.1, y: 0, z: 0 }),
  ],
};

// Builders intentionally receive the raw empty profile. They must compose the
// same Product-default profile internally before reading topology policy.
const supportSites = buildSupportSiteModel(dataset, profile);
const routes = buildRoutePartitionModel(dataset, profile);

assert.equal(supportSites.status, 'READY');
assert.equal(supportSites.groupingToleranceMm, 0);
assert.equal(
  supportSites.summary.physicalLocationCount,
  2,
  'zero default grouping tolerance must not merge near-but-distinct supports',
);
assert.equal(routes.status, 'READY');
assert.equal(routes.portMatchToleranceMm, 0);
assert.deepEqual(routes.routeJoiningRules, {
  partition: 'branch-scoped-connected-components',
  chainage: 'exact-port-topology',
  sourceOrderAllowed: false,
  degreeAboveTwo: 'BLOCKED',
});
assert.equal(routes.summary.routeCount, 1);
assert.equal(routes.routes[0].status, 'READY');
assert.equal(routes.routes[0].totalLengthMm, 1000);

const pointOnlyRoutes = buildRoutePartitionModel({
  datasetId: 'ISSUE1321-POINT-ONLY-ROUTE',
  version: 1,
  entities: [pointComponent('INST-1', { x: 1200, y: -30, z: 45 })],
}, profile);
assert.equal(pointOnlyRoutes.status, 'READY');
assert.equal(pointOnlyRoutes.routes.length, 1);
assert.equal(pointOnlyRoutes.routes[0].totalLengthMm, 0);
assert.equal(pointOnlyRoutes.routes[0].nodes.length, 1);
assert.deepEqual(pointOnlyRoutes.routes[0].entityChainages, [{
  entityId: 'INST-1',
  startMm: 0,
  endMm: 0,
  sourceStartChainageMm: 0,
  sourceEndChainageMm: 0,
  pointMm: 0,
}]);

const pointOnlyDataset = {
  datasetId: 'ISSUE1321-POINT-ONLY-AUTO-SELECTION',
  version: 1,
  entities: [pointComponent('INST-1', { x: 1200, y: -30, z: 45 })],
  sharedModel: {
    semanticHash: 'fnv1a64:point-only-auto-selection',
    units: { length: 'mm' },
    components: [{ componentKey: 'INST-1', loadEvidence: {} }],
  },
};
const pointOnlySelection = evaluateEmpiricalGravityMethodSelection({
  dataset: pointOnlyDataset,
  profile: effective,
  routePartitionModel: buildRoutePartitionModel(pointOnlyDataset, effective),
});
assert.equal(pointOnlySelection.selectedMethod, 'CHAINAGE_TRIBUTARY_SPAN_V2');
assert.equal(pointOnlySelection.selectionState, 'SELECTED_V2_MISSING_COG_FALLBACK');
assert.deepEqual(pointOnlySelection.exceptions, []);

console.log(JSON.stringify({
  status: 'PASS',
  benchmark: 'ISSUE1321_CONSERVATIVE_PRODUCT_DEFAULT_BOOTSTRAP',
  productDefaultProfileSemanticHash: provider.productDefaultProfileSemanticHash,
  supportGroupingToleranceMm: supportSites.groupingToleranceMm,
  supportLocationCount: supportSites.summary.physicalLocationCount,
  routePortMatchToleranceMm: routes.portMatchToleranceMm,
  routeCount: routes.summary.routeCount,
  pointOnlyRouteChainageMm: pointOnlyRoutes.routes[0].entityChainages[0].pointMm,
  pointOnlyAutoSelectedMethod: pointOnlySelection.selectedMethod,
  unknownSupportVerticalCapability: effective.topology.supportTypeCapabilities.value.DEFAULT.vertical,
  equilibriumTolerances: effective.loadCalculation.equilibriumTolerances.value,
}, null, 2));

function pipe(entityId, start, end) {
  return {
    entityId,
    entityType: 'PIPE',
    category: 'pipe',
    branchId: 'B1',
    lineKey: 'L1',
    sourceEntityId: `SRC-${entityId}`,
    jsonPointer: `/entities/${entityId}`,
    componentReference: entityId,
    name: entityId,
    properties: {
      geometry: { start, end },
      attributes: {},
    },
  };
}

function pointComponent(entityId, point) {
  return {
    ...pipe(entityId, point, point),
    entityType: 'INST',
    category: 'component',
  };
}

function support(entityId, center) {
  return {
    entityId,
    entityType: 'SUPPORT',
    category: 'support',
    branchId: 'B1',
    lineKey: 'L1',
    sourceEntityId: `SRC-${entityId}`,
    jsonPointer: `/entities/${entityId}`,
    componentReference: entityId,
    name: entityId,
    properties: {
      geometry: { center },
      attributes: {
        SUPPORT_TAG: entityId,
        SUPPORT_TYPE: 'UNKNOWN_KIND',
      },
    },
  };
}
