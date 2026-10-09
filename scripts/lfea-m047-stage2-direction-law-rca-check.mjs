#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildDirectionLawRca } from './lfea-m047-stage2-direction-law-rca.mjs';

const fixture = {
  schema: 'm047-bm4l-stage2-friction-tuning-iteration/v1',
  caseId: 'L13',
  converged: true,
  sourceAccdbSha256: 'fixture',
  iterationSemanticHash: 'fixture-hash',
  restraints: [
    {
      restraintId: '1:REST_PTR1:TYPE3:UY',
      nodeId: '1',
      nodeName: 'fixture',
      frictionDofs: ['UX', 'UZ'],
      regime: {
        reference: 'SLID',
        solved: 'SLIDING',
        referenceUtilisation: 1,
        solvedUtilisation: 1,
      },
      tangential: {
        referenceN: [3, 4],
        solvedN: [-5, 0],
        referenceMagnitudeN: 5,
        solvedMagnitudeN: 5,
      },
      tangentialDisplacement: {
        referenceM: [-0.003, -0.004],
        solvedM: [-0.003, -0.004],
        elasticStretchM: [0.005, 0],
      },
    },
  ],
};

const rca = buildDirectionLawRca(fixture);
const row = rca.rows[0];
assert.ok(Math.abs(row.referenceForceVsReferenceTotalDisplacementCosine + 1) < 1e-12);
assert.ok(row.currentVectorRelativeError > 1);
assert.ok(row.candidateVectorRelativeError < 1e-12);
assert.ok(row.oracleVectorRelativeError < 1e-12);
assert.equal(
  rca.conclusion,
  'EVIDENCE_FAVOURS_TOTAL_TANGENTIAL_DISPLACEMENT_DIRECTION_AS_NEXT_ISOLATED_MECHANICS_EXPERIMENT',
);
assert.equal(rca.productionMechanicsChanged, false);
assert.equal(rca.toleranceChanged, false);
assert.equal(rca.acceptanceCriteriaChanged, false);

process.stdout.write('PASS m047 stage2 direction-law RCA contract\n');
