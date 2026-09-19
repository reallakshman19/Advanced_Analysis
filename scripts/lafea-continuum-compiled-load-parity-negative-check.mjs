#!/usr/bin/env node
/**
 * Negative controls for the LAFEA compiled-vs-legacy numeric parity contract.
 *
 * #1769 Phase 0 loosened the PRESSURE cross-path comparison from bit-exact to a
 * frozen relative tolerance, because the compiled route now integrates pressure
 * itself on analytic source geometry and the two routes are mathematically --
 * not bitwise -- equal. A tolerance is only defensible if it still rejects the
 * defects the exact comparison used to catch, so every mutation below must be
 * rejected, and the representation-level noise the contract is meant to absorb
 * must still be accepted.
 *
 * This file asserts the comparator's behaviour directly. It does not execute the
 * solver and grants no engineering authority.
 */
import assert from 'node:assert/strict';
import {
  LAFEA_NUMERIC_PARITY_RELATIVE_TOLERANCE,
  compareLafeaNumericParity,
} from './lib/lafea-numeric-parity.mjs';

/** Shaped like one entry of the parity check's numericalProjection(). */
function reference() {
  return [{
    loadCaseId: 'PRESSURE',
    nodalDisplacements: [
      { nodeId: 'A', ux: 0, uy: 0 },
      { nodeId: 'B', ux: -0.00105, uy: 0 },
      { nodeId: 'C', ux: -0.0039, uy: -0.00105 },
    ],
    supportReactions: [
      { dofIdentity: 'A:UX', value: 3000, prescribedDisplacement: 0 },
      { dofIdentity: 'A:UY', value: 3000, prescribedDisplacement: 0 },
      { dofIdentity: 'B:UY', value: 0, prescribedDisplacement: 0 },
    ],
    freeDofResiduals: [{ dofIdentity: 'B:UX', value: -2.2737367544323206e-13 }],
    equilibrium: { residualScale: 3000, accepted: true },
    totalStrainEnergy: 4.5,
    elementResults: [{
      elementId: 'E1',
      nodeIds: ['A', 'B', 'C'],
      strain: { epsilonX: -0.0000105, epsilonY: -0.0000105, gammaXY: -0.000039 },
      stress: { sigmaX: -3, sigmaY: -3, sigmaZ: 0, tauXY: -3 },
      principalMaximum: 0,
      principalMinimum: -6,
      maximumInPlaneShear: 3,
      vonMises: 6,
      strainEnergy: 4.5,
    }],
  }];
}

function mutate(apply) {
  const value = reference();
  apply(value[0]);
  return value;
}

const mustReject = [
  ['sign flipped on a stress component', mutate((row) => {
    row.elementResults[0].stress.sigmaX = 3;
  })],
  ['factor of two on a displacement', mutate((row) => {
    row.nodalDisplacements[2].ux = -0.0078;
  })],
  ['reaction doubled', mutate((row) => {
    row.supportReactions[0].value = 6000;
  })],
  ['one part per billion on a stress component', mutate((row) => {
    row.elementResults[0].stress.tauXY = -3 * (1 + 1e-9);
  })],
  ['one part per ten billion on strain energy', mutate((row) => {
    row.totalStrainEnergy = 4.5 * (1 + 1e-10);
  })],
  ['near-zero value pushed above the absolute floor', mutate((row) => {
    row.elementResults[0].principalMaximum = 1e-6;
  })],
  ['an extra key', mutate((row) => {
    row.elementResults[0].unexpected = 1;
  })],
  ['a missing element result', mutate((row) => {
    row.elementResults.pop();
  })],
  ['a changed node identity', mutate((row) => {
    row.nodalDisplacements[1].nodeId = 'X';
  })],
  ['a non-finite value', mutate((row) => {
    row.totalStrainEnergy = Number.NaN;
  })],
];

const rejected = mustReject.map(([label, candidate]) => {
  const comparison = compareLafeaNumericParity(candidate, reference());
  assert.equal(comparison.ok, false, `parity comparator accepted ${label}`);
  assert.ok(comparison.mismatch, `parity comparator reported no mismatch for ${label}`);
  return { mutation: label, reason: comparison.mismatch.reason, path: comparison.mismatch.path };
});

// Positive control: representation-level noise is what the contract exists to
// absorb. If this were rejected the tolerance would be unusable.
const noise = mutate((row) => {
  row.elementResults[0].stress.sigmaX = -2.9999999999999996;
  row.elementResults[0].strain.epsilonX = -0.000010500000000000001;
  row.elementResults[0].principalMaximum = 4.440892098500626e-16;
});
const accepted = compareLafeaNumericParity(noise, reference());
assert.equal(accepted.ok, true, `parity comparator rejected representation noise ${JSON.stringify(accepted.mismatch)}`);
assert.ok(
  accepted.maxRelativeDeviation < LAFEA_NUMERIC_PARITY_RELATIVE_TOLERANCE,
  'representation noise must sit well inside the frozen tolerance',
);

// The frozen tolerance must stay far enough below the smallest rejected
// perturbation that it cannot be widened into meaninglessness unnoticed.
assert.ok(
  LAFEA_NUMERIC_PARITY_RELATIVE_TOLERANCE <= 1e-10,
  'frozen parity tolerance must remain at or below 1e-10',
);

console.log(JSON.stringify({
  schema: 'lafea-continuum-compiled-load-parity-negative-check/v1',
  check: 'lafea-continuum-compiled-load-parity-negative',
  status: 'PASS',
  stageId: 'LAFEA.3',
  relativeTolerance: LAFEA_NUMERIC_PARITY_RELATIVE_TOLERANCE,
  mutationsRejected: rejected.length,
  rejected,
  representationNoiseAccepted: true,
  representationNoiseMaxRelativeDeviation: accepted.maxRelativeDeviation,
  smallestRejectedRelativePerturbation: 1e-10,
  engineeringAuthorityChanged: false,
}, null, 2));
