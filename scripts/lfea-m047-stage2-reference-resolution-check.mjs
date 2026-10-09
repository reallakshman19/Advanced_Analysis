#!/usr/bin/env node
import assert from 'node:assert/strict';
import { classifyReferenceResolution } from './lfea-m047-stage2-reference-resolution-floor.mjs';

const GOVERNED_STIFFNESS_N_PER_M = 1.751270055770874e8;
const record = classifyReferenceResolution({
  frictionStiffnessNPerM: GOVERNED_STIFFNESS_N_PER_M,
  printedResolutionMm: 0.001,
  iteration: {
    caseId: 'L13',
    converged: true,
    sourceAccdbSha256: 'fixture-custody',
    iterationSemanticHash: 'fixture-iteration',
    restraints: [
      {
        restraintId: 'small',
        nodeId: '1',
        frictionDofs: ['UX'],
        tangential: { referenceMagnitudeN: 4.9588, vectorRelativeError: 5.0 },
      },
      {
        restraintId: 'above-floor',
        nodeId: '2',
        frictionDofs: ['UX'],
        tangential: { referenceMagnitudeN: 176.3, vectorRelativeError: 0.2 },
      },
      {
        restraintId: 'zero',
        nodeId: '3',
        frictionDofs: ['UX'],
        tangential: { referenceMagnitudeN: 0, vectorRelativeError: null },
      },
    ],
  },
});

assert.ok(Math.abs(record.referenceResolution.forceResolutionFloorN - 87.56350278854371) < 1e-12);
assert.equal(record.restraints[0].classification, 'RESOLUTION_LIMITED');
assert.equal(record.restraints[1].classification, 'COMPARABLE_RELATIVE');
assert.equal(record.restraints[2].classification, 'EXACT_ZERO_REFERENCE');
assert.equal(record.summary.comparableRelativeCount, 1);
assert.equal(record.summary.resolutionLimitedCount, 1);
assert.equal(record.summary.exactZeroReferenceCount, 1);
assert.equal(record.summary.comparisonPolicyChanged, false);
assert.equal(record.summary.toleranceChanged, false);
assert.equal(record.summary.resultRowsChanged, false);

process.stdout.write('PASS lfea-m047-stage2-reference-resolution-check\n');
