#!/usr/bin/env node

/**
 * A component the route carries no chainage for is normally fatal, and should
 * be: its force is real and nothing can say which supports carry it.
 *
 * Exactly one case is different. A qualified mass of zero produces zero force,
 * and zero force allocated anywhere adds zero to every reaction and zero to
 * every first moment - so the answer is identical whether the component is
 * placed or omitted, and no reaction is understated by omitting it.
 *
 * That case is not hypothetical. The 1885S model has one: /88-PG-10052, a
 * pressure gauge alone on its branch with a source weight of 0 and no route
 * length to measure along. It failed all three load cases of an otherwise
 * complete run - 123 contributions, equilibrium closing to 7e-9 N.mm - because
 * a zero-force contribution could not be given a position.
 *
 * This pins both halves: zero mass is an exception the run survives, and any
 * other unplaced component stays fatal.
 */

import assert from 'node:assert/strict';
import {
  calculateSupportLoadDistributionFromQualifiedCaseMasses,
} from '../src/workspace/engineering-loads/support-load-distribution-v3.js';
import { readFileSync } from 'node:fs';
import { createEvidenceValue } from '../src/workspace/project-data/project-data-contract.js';
import { createNonFeaProductDefaultProvider } from '../src/workspace/project-data/non-fea-product-default-profile.js';

// The governed 1885S profile, so the fixture is blocked by nothing except the
// thing under test.
const PROFILE = createNonFeaProductDefaultProvider({
  profile: JSON.parse(readFileSync(
    new URL('../project-data/1885s-project-data-profile.json', import.meta.url), 'utf8',
  )),
}).effectiveProfile;

const approved = (value, source = 'ZERO_MASS_OFF_ROUTE_FIXTURE') => createEvidenceValue(value, { source }, true);

const receipt = (mode) => ({
  kind: 'QUALIFIED_CASE_MASS_RECEIPT',
  authority: 'CURRENT_COMMON_INPUT_EMPIRICAL_MASS_PROJECTION',
  semanticHash: 'fnv1a64:1111111111111111',
  caseSemanticHash: 'fnv1a64:2222222222222222',
  mode,
});

const site = (siteId, x) => ({
  siteId,
  tags: [siteId],
  positionMm: { x, y: 0, z: 0 },
  assemblyIds: [`assembly-${siteId}`],
  memberEntityIds: [`support-${siteId}`],
  assemblies: [{ members: [{ sourceType: 'REST' }] }],
});

function input() {
  return {
    dataset: {
      datasetId: 'DATASET-ZERO-MASS-OFF-ROUTE',
      version: 1,
      sourceSha256: '1'.repeat(64),
      entities: [
        {
          entityId: 'pipe-1', entityType: 'PIPE', lineKey: 'L-1',
          sourceEntityId: 'source-pipe-1', jsonPointer: '/items/0',
          componentReference: 'PIPE-1', properties: {},
        },
        {
          entityId: 'gauge-1', entityType: 'INST', lineKey: 'L-1',
          sourceEntityId: 'source-gauge-1', jsonPointer: '/items/1',
          componentReference: 'PG-10052', properties: {},
        },
      ],
    },
    profile: {
      ...PROFILE,
      loadCalculation: {
        ...PROFILE.loadCalculation,
        activeLoadCases: approved(['EMPTY']),
      },
    },
    supportSiteModel: {
      schema: 'support-site-model/v1',
      status: 'READY',
      sites: [site('S-0', 0), site('S-1', 1000)],
    },
    routePartitionModel: {
      schema: 'route-partition-model/v1',
      status: 'READY',
      routes: [{
        routeId: 'R-1', status: 'READY', blockers: [],
        physicalEdgeIds: ['pipe-1', 'gauge-1'],
        entityChainages: [
          { entityId: 'pipe-1', startMm: 0, endMm: 1000, pointMm: 500, sourceStartChainageMm: 0, sourceEndChainageMm: 1000 },
          // The gauge is on the route but carries no measurable point: exactly
          // the shape of a component alone on its own branch.
          { entityId: 'gauge-1', startMm: 500, endMm: 500, sourceStartChainageMm: 500, sourceEndChainageMm: 500 },
        ],
      }],
      edges: [
        { entityId: 'pipe-1', entityType: 'PIPE', lengthMm: 1000, pointComponent: false, topologyCarrier: false, startMm: { x: 0, y: 0, z: 0 }, endMm: { x: 1000, y: 0, z: 0 } },
        { entityId: 'gauge-1', entityType: 'INST', lengthMm: 0, pointComponent: true, topologyCarrier: false, startMm: { x: 500, y: 0, z: 0 }, endMm: { x: 500, y: 0, z: 0 } },
      ],
    },
    masterData: {},
  };
}

const run = (gaugeMassKg) => calculateSupportLoadDistributionFromQualifiedCaseMasses(input(), [
  { entityId: 'pipe-1', loadCaseId: 'EMPTY', massKg: 100, source: receipt('DISTRIBUTED') },
  { entityId: 'gauge-1', loadCaseId: 'EMPTY', massKg: gaugeMassKg, source: receipt('POINT') },
]).loadCases.find((row) => row.loadCaseId === 'EMPTY');

// Zero mass: the run survives, the pipe's reactions are published, and the
// unplaced component is recorded as an exception rather than an exclusion.
const waived = run(0);
assert.equal(waived.status, 'CALCULATED_WITH_EXCEPTIONS');
assert.deepEqual(waived.excludedInputs, []);
const exception = waived.exceptionLedger.find((row) => row.code === 'ZERO_MASS_OFF_ROUTE_CONTRIBUTION_IGNORED');
assert.ok(exception, `expected the zero-mass exception; observed ${JSON.stringify(waived.exceptionLedger)}`);
assert.equal(exception.entityId, 'gauge-1');
assert.equal(exception.verticalForceN, 0);
assert.equal(waived.equilibrium.passed, true);
assert.ok(waived.supportResults.every((row) => Number.isFinite(row.verticalForceN)));
const allocated = waived.supportResults.reduce((sum, row) => sum + row.verticalForceN, 0);
assert.ok(Math.abs(allocated - waived.completenessAudit.evaluatedForceN) < 1e-8,
  'the pipe load must be fully carried');
assert.ok(waived.completenessAudit.evaluatedForceN > 0, 'the pipe must contribute a real force');
// The unplaced component contributed nothing at all, rather than being placed
// somewhere convenient.
assert.equal(waived.contributionLedger.some((row) => row.entityId === 'gauge-1'), false);

// Any real mass at an unknown position stays fatal - that is what the
// exclusion exists for, and it must not be weakened.
const real = run(0.4);
assert.equal(real.status, 'FAILED');
assert.deepEqual(real.excludedInputs.map((row) => row.code), ['MISSING_ROUTE_CHAINAGE']);
assert.equal(real.exceptionLedger.some((row) => row.code === 'ZERO_MASS_OFF_ROUTE_CONTRIBUTION_IGNORED'), false);
assert.ok(real.supportResults.every((row) => row.verticalForceN === null),
  'a failed case must not expose a production reaction');

// Reactions are identical to a model that never had the zero-mass component,
// which is the whole basis for ignoring it.
const without = calculateSupportLoadDistributionFromQualifiedCaseMasses(
  (() => {
    const base = input();
    base.routePartitionModel.routes[0].physicalEdgeIds = ['pipe-1'];
    return base;
  })(),
  [{ entityId: 'pipe-1', loadCaseId: 'EMPTY', massKg: 100, source: receipt('DISTRIBUTED') }],
).loadCases.find((row) => row.loadCaseId === 'EMPTY');
assert.deepEqual(
  waived.supportResults.map((row) => row.verticalForceN),
  without.supportResults.map((row) => row.verticalForceN),
);

console.log(JSON.stringify({
  check: 'non-fea-zero-mass-off-route',
  zeroMassCaseStatus: waived.status,
  realMassCaseStatus: real.status,
  reactionsUnchangedByIgnoringZeroMass: true,
  exceptionCode: 'ZERO_MASS_OFF_ROUTE_CONTRIBUTION_IGNORED',
}, null, 2));
