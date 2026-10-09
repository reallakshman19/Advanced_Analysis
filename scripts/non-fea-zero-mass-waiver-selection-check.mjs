#!/usr/bin/env node

/**
 * Proves the waiver clears the gate that stopped the 1885S run.
 *
 * The dataset's pressure gauge sits on a route with no chainage point for it,
 * so the component-load audit blocks it with
 * EMPIRICAL_COMPONENT_ROUTE_CHAINAGE_MISSING. One such component is enough:
 * the selector counts it as otherBlocked, AUTO resolves to
 * EXCEPTION_POLICY_REQUIRED, no method is selected, and the calculation cannot
 * run however clean the rest of the model is.
 *
 * A gauge carries no mass, so where it sits cannot change any reaction. This
 * check fixes the audit and varies only the waiver.
 */

import assert from 'node:assert/strict';
import { semanticHash } from '../src/core/shared-piping-model/canonical-json.js';
import {
  createEmpiricalGravityMethodSelection,
} from '../src/workspace/engineering-loads/empirical-gravity-method-selection.js';
import {
  createNonFeaZeroMassWaiverSet,
} from '../src/workspace/engineering-loads/non-fea-zero-mass-waiver.js';

const CHAINAGE_MISSING = 'EMPIRICAL_COMPONENT_ROUTE_CHAINAGE_MISSING';

function record({ entityId, blockerCodes = [], explicitMomentNm = 0, onRoute = false }) {
  return {
    entityId,
    sourceEntityId: entityId,
    entityType: 'INST',
    routeId: 'route:/B5:1',
    currentMethodPointChainageMm: blockerCodes.includes(CHAINAGE_MISSING) ? null : 1000,
    cogClassification: onRoute ? 'ON_ROUTE_CHAINAGE_CANDIDATE' : 'MIDPOINT_FALLBACK_CANDIDATE',
    cogEvidence: onRoute ? { status: 'QUALIFIED', pointMm: { x: 0, y: 0, z: 0 } } : null,
    projection: null,
    candidateChainageMm: blockerCodes.includes(CHAINAGE_MISSING) ? null : 1000,
    explicitMoment: explicitMomentNm > 0
      ? { magnitudeNm: explicitMomentNm, axis: 'Y', status: 'QUALIFIED' }
      : null,
    integrationEligible: blockerCodes.length === 0,
    integrationDisposition: blockerCodes.length === 0
      ? 'CURRENT_METHOD_MIDPOINT_PARITY_ONLY'
      : 'BLOCKED_PENDING_POLICY_OR_EVIDENCE',
    blockers: blockerCodes.map((code) => ({ code })),
  };
}

function audit(records) {
  const draft = {
    schema: 'empirical-component-load-authority-audit/v1',
    datasetId: 'ZERO-MASS-WAIVER-CHECK',
    datasetVersion: null,
    sourceDatasetHash: null,
    sharedModelSemanticHash: 'fnv1a64:0000000000000001',
    routePartitionModelSemanticHash: 'fnv1a64:0000000000000002',
    projectDataProfileSemanticHash: 'fnv1a64:0000000000000003',
    toleranceMm: 1,
    status: records.some((row) => row.blockers.length > 0) ? 'BLOCKED' : 'READY_FOR_INTEGRATION_DESIGN',
    records,
    blockers: records.flatMap((row) => row.blockers.map((item) => ({
      ...item, entityId: row.entityId, routeId: row.routeId,
    }))),
    summary: {
      componentCount: records.length,
      onRouteCogCount: records.filter((row) => row.cogClassification === 'ON_ROUTE_CHAINAGE_CANDIDATE').length,
      midpointFallbackCount: records.filter((row) => row.cogClassification === 'MIDPOINT_FALLBACK_CANDIDATE').length,
      offRouteCogCount: 0,
      ambiguousCogCount: 0,
      invalidCogCount: 0,
      explicitPositiveMomentCount: records.filter((row) => row.explicitMoment?.magnitudeNm > 0).length,
      integrationEligibleCount: records.filter((row) => row.integrationEligible).length,
      blockedCount: records.filter((row) => !row.integrationEligible).length,
    },
    numericalMethodChanged: false,
  };
  return { ...draft, semanticHash: semanticHash(draft) };
}

const GAUGE = '=1006649732/51485';
const HEALTHY = '=1006649732/51999';

const blockedAudit = audit([
  record({ entityId: GAUGE, blockerCodes: [CHAINAGE_MISSING] }),
  record({ entityId: HEALTHY, onRoute: true }),
]);

const select = (waiverSet) => createEmpiricalGravityMethodSelection({
  requestedMethod: 'AUTO',
  componentCogFallbackPolicy: 'GEOMETRIC_MIDPOINT',
  componentAuthorityAudit: blockedAudit,
  zeroMassWaiverSet: waiverSet,
});

// Without a waiver: the gauge blocks the whole model, exactly as observed.
const withoutWaiver = select(null);
assert.equal(withoutWaiver.selectedMethod, null);
assert.equal(withoutWaiver.selectionState, 'EXCEPTION_POLICY_REQUIRED');
assert.deepEqual(
  withoutWaiver.exceptions.map((row) => row.entityId),
  [GAUGE],
  'the chainage-less gauge is the blocking exception',
);

// With the waiver: a method is selected and the gauge stops being an exception.
const withWaiver = select(createNonFeaZeroMassWaiverSet({
  waivers: [{ entityId: GAUGE, justification: 'Pressure gauge carries no weighable mass.' }],
}));
assert.notEqual(withWaiver.selectedMethod, null, 'a waived gauge no longer blocks method selection');
assert.notEqual(withWaiver.selectionState, 'EXCEPTION_POLICY_REQUIRED');
assert.deepEqual(withWaiver.exceptions, [], 'no exception survives the waiver');
assert.deepEqual(withWaiver.zeroMassWaivedEntityIds, [GAUGE]);
assert.notEqual(
  withWaiver.zeroMassWaiverSemanticHash,
  withoutWaiver.zeroMassWaiverSemanticHash,
  'the selection receipt records which waiver set it was made under',
);

// Waiving the gauge must not quietly demote the model: the remaining component
// is healthy, so the highest-fidelity qualified method still wins.
assert.equal(
  withWaiver.selectedMethod,
  'CHAINAGE_TRIBUTARY_SPAN_V3_COG',
  'a waived massless component does not force the V2 fallback',
);

// A waiver never answers for a component that carries a real demand.
assert.throws(
  () => createEmpiricalGravityMethodSelection({
    requestedMethod: 'AUTO',
    componentCogFallbackPolicy: 'GEOMETRIC_MIDPOINT',
    componentAuthorityAudit: audit([
      record({ entityId: GAUGE, blockerCodes: [CHAINAGE_MISSING], explicitMomentNm: 1200 }),
      record({ entityId: HEALTHY, onRoute: true }),
    ]),
    zeroMassWaiverSet: createNonFeaZeroMassWaiverSet({
      waivers: [{ entityId: GAUGE, justification: 'Pressure gauge.' }],
    }),
  }),
  (error) => error.code === 'EMPIRICAL_GRAVITY_ZERO_MASS_WAIVER_INADMISSIBLE',
  'a waiver over a source explicit moment fails closed',
);

console.log(JSON.stringify({
  check: 'non-fea-zero-mass-waiver-selection',
  withoutWaiver: {
    selectedMethod: withoutWaiver.selectedMethod,
    selectionState: withoutWaiver.selectionState,
    blockingEntityIds: withoutWaiver.exceptions.map((row) => row.entityId),
  },
  withWaiver: {
    selectedMethod: withWaiver.selectedMethod,
    selectionState: withWaiver.selectionState,
    blockingEntityIds: withWaiver.exceptions.map((row) => row.entityId),
    waivedEntityIds: withWaiver.zeroMassWaivedEntityIds,
  },
  explicitMomentWaiverFailsClosed: true,
}, null, 2));
