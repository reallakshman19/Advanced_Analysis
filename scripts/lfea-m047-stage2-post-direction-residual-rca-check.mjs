#!/usr/bin/env node
/** Contract for the M047 post-direction residual RCA decision ordering. */
import assert from 'node:assert/strict';
import { buildPostDirectionResidualRca } from './lfea-m047-stage2-post-direction-residual-rca.mjs';

const sha = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const baseline = {
  schema: 'm047-bm4l-stage2-friction-tuning-iteration/v1',
  caseId: 'L13',
  converged: true,
  sourceAccdbSha256: sha,
  restraints: [
    { restraintId: 'A', regime: { reference: 'STUCK', referenceUtilisation: 0.94 } },
    { restraintId: 'B', regime: { reference: 'SLID', referenceUtilisation: 1.10 } },
  ],
};

function direction(status = 'EVIDENCE_SUPPORTS_PROMOTION_TO_GOVERNED_DIRECTION_RULE') {
  return {
    schema: 'm047-bm4l-stage2-direction-only-nonlinear-experiment/v1',
    caseId: 'L13',
    sourceAccdbSha256: sha,
    promotion: { status },
    restraints: [
      {
        restraintId: 'A', nodeId: '1', frictionDofs: ['UX', 'UZ'], regime: 'STUCK',
        referenceMagnitudeN: 100, candidateMagnitudeN: 100,
        candidateVectorRelativeError: 0.05, candidateDirectionCosineToReference: 0.999,
      },
      {
        restraintId: 'B', nodeId: '2', frictionDofs: ['UZ'], regime: 'SLIDING',
        referenceMagnitudeN: 100, candidateMagnitudeN: 100,
        candidateVectorRelativeError: 0.05, candidateDirectionCosineToReference: 0.999,
      },
    ],
  };
}

function r6(pass = true) {
  return {
    schema: 'm047-bm4l-stage2-r6-restraint-sentinel-preflight/v1',
    sourceAccdbSha256: sha,
    status: pass ? 'PASS' : 'FAIL',
    failureCount: pass ? 0 : 1,
    blankRule: 'PORTABLE_ACCDB_READER_CANONICAL_NULL_ONLY_V1',
  };
}

function r5(block = false) {
  return {
    schema: 'm047-bm4l-stage2-r5-friction-geometry-inventory/v1',
    caseId: 'L13',
    sourceAccdbSha256: sha,
    geometrySensitiveFrictionCount: block ? 1 : 0,
    bendCoincidentFrictionCount: block ? 1 : 0,
    teeCoincidentFrictionCount: 0,
    decision: {
      status: block
        ? 'BEND_OR_TEE_TANGENT_VERIFICATION_REQUIRED'
        : 'NO_FRICTION_RESTRAINT_ON_BEND_OR_TEE_SOURCE_STATION',
      directionPromotionBlockedByR5: block,
    },
  };
}

function r2(decision) {
  return {
    schema: 'm047-bm4l-stage2-r2-mobilisation-diagnostics/v1',
    caseId: 'L13', sourceAccdbSha256: sha,
    decision, referenceClusterCount: 1, deletedSpringCloserCount: 1, returnMapCloserCount: 0,
  };
}

function r3({ singleAxis = false, perAxis = false, l6Closer = false } = {}) {
  return {
    schema: 'm047-bm4l-stage2-r3-capacity-diagnostics/v1',
    frictionCaseId: 'L13',
    sourceAccdbSha256: sha,
    summary: {
      l13NormalCloserToUnityCount: l6Closer ? 0 : 2,
      l6NormalCloserToUnityCount: l6Closer ? 2 : 0,
      equalDistanceCount: 0,
      perAxisSignatureCount: perAxis ? 1 : 0,
      perAxisSignatureRestraints: perAxis ? ['C'] : [],
    },
    restraints: singleAxis ? [{
      restraintId: 'B', nodeId: '2', frictionDofs: ['UZ'],
      normalBasis: {
        frictionCase: { utilisation: 1.106 },
        frictionlessTwin: { utilisation: 0.999 },
        closerToUnity: 'L6',
      },
    }] : [],
  };
}

let result = buildPostDirectionResidualRca({ baseline, direction: direction() });
assert.equal(result.next.decision, 'RUN_R6_RESTRAINT_SENTINEL_PREFLIGHT');

result = buildPostDirectionResidualRca({ baseline, direction: direction(), r6: r6(false) });
assert.equal(result.next.decision, 'HALT_R6_RESTRAINT_SOURCE_BOUNDARY_CHANGED');

result = buildPostDirectionResidualRca({ baseline, direction: direction(), r6: r6() });
assert.equal(result.next.decision, 'RUN_R5_FRICTION_GEOMETRY_INVENTORY');

result = buildPostDirectionResidualRca({ baseline, direction: direction(), r6: r6(), r5: r5(true) });
assert.equal(result.next.decision, 'R5_LOCAL_TANGENT_VERIFICATION_REQUIRED');
assert.equal(result.next.l7LoadSteppingAllowed, false);

result = buildPostDirectionResidualRca({
  baseline,
  direction: direction('DO_NOT_PROMOTE_FROM_THIS_RUN'),
  r6: r6(),
  r5: r5(),
});
assert.equal(result.next.decision, 'HALT_DIRECTION_CANDIDATE_NOT_PROMOTABLE');

result = buildPostDirectionResidualRca({ baseline, direction: direction(), r6: r6(), r5: r5() });
assert.equal(result.next.decision, 'RUN_R2_MOBILISATION_NEXT');

result = buildPostDirectionResidualRca({
  baseline, direction: direction(), r6: r6(), r5: r5(),
  r2: r2('EVIDENCE_FAVOURS_DELETED_SPRING_STATE_STABLE_STOP'),
});
assert.equal(result.next.decision, 'R2_DELETED_SPRING_STATE_PATH_IS_NEXT_MECHANICS_CANDIDATE');

result = buildPostDirectionResidualRca({
  baseline, direction: direction(), r6: r6(), r5: r5(),
  r2: r2('EVIDENCE_FAVOURS_RETURN_MAP_FOR_PARTIAL_MOBILISATION'),
});
assert.equal(result.next.decision, 'RUN_R3_CAPACITY_BASIS_NEXT');

result = buildPostDirectionResidualRca({
  baseline,
  direction: direction(),
  r6: r6(),
  r5: r5(),
  r2: r2('EVIDENCE_FAVOURS_RETURN_MAP_FOR_PARTIAL_MOBILISATION'),
  r3: r3({ singleAxis: true, perAxis: true }),
});
assert.equal(result.next.decision, 'CAPACITY_BASIS_BEFORE_PARTITION',
  'single-axis over-cap signal must outrank any per-axis partition signature');
assert.equal(result.next.l7LoadSteppingAllowed, false);

result = buildPostDirectionResidualRca({
  baseline,
  direction: direction(),
  r6: r6(),
  r5: r5(),
  r2: r2('EVIDENCE_FAVOURS_RETURN_MAP_FOR_PARTIAL_MOBILISATION'),
  r3: r3({ l6Closer: true }),
});
assert.equal(result.next.decision, 'TEST_FRICTIONLESS_TWIN_NORMAL_CAPACITY_BASIS');

result = buildPostDirectionResidualRca({
  baseline,
  direction: direction(),
  r6: r6(),
  r5: r5(),
  r2: r2('EVIDENCE_FAVOURS_RETURN_MAP_FOR_PARTIAL_MOBILISATION'),
  r3: r3({ perAxis: true }),
});
assert.equal(result.next.decision, 'PER_AXIS_CAPACITY_PARTITION_EXPERIMENT_JUSTIFIED');

assert.throws(
  () => buildPostDirectionResidualRca({
    baseline,
    direction: direction(),
    r6: r6(),
    r5: r5(),
    r2: r2('EVIDENCE_FAVOURS_RETURN_MAP_FOR_PARTIAL_MOBILISATION'),
    r3: { ...r3(), frictionCaseId: 'L7' },
  }),
  /baseline\/R3 case mismatch/u,
  'R3 artifact for another load case must fail closed',
);

assert.throws(
  () => buildPostDirectionResidualRca({
    baseline,
    direction: direction(),
    r6: r6(),
    r5: { ...r5(), caseId: 'L7' },
  }),
  /baseline\/R5 case mismatch/u,
  'R5 artifact for another load case must fail closed',
);

assert.equal(result.mechanicsChanged, false);
assert.equal(result.toleranceChanged, false);
assert.equal(result.comparisonPolicyChanged, false);

process.stdout.write('PASS m047 post-direction residual RCA ordering contract\n');
