#!/usr/bin/env node
import assert from 'node:assert/strict';
import { decideR8Nfv15Sequence, R8_NFV15_NOMINATION } from './lfea-m047-stage2-r8-nfv15-sequence.mjs';

const nominated = (caseId) => ({
  caseId,
  nomination: R8_NFV15_NOMINATION,
  productionPromotionAuthorized: false,
});
const rejected = (caseId) => ({
  caseId,
  nomination: 'R8_NFV15_NOT_NOMINATED_BY_FROZEN_ACCURACY_METRICS',
  productionPromotionAuthorized: false,
});
const goodL15 = {
  identity: { status: 'PASS' },
  independentNonlinearSolve: false,
  productionPromotionAuthorized: false,
};

const initial = decideR8Nfv15Sequence();
assert.equal(initial.decision, 'RUN_R8_L13');
assert.equal(initial.runL1, false);

assert.throws(
  () => decideR8Nfv15Sequence({ l7Assessment: nominated('L7') }),
  /before L13/,
);

const stopL13 = decideR8Nfv15Sequence({ l13Assessment: rejected('L13') });
assert.equal(stopL13.decision, 'STOP_R8_AFTER_L13_NOT_NOMINATED_OR_PHYSICS_GATE_FAILED');
assert.equal(stopL13.runL1, false);

const runL7 = decideR8Nfv15Sequence({ l13Assessment: nominated('L13') });
assert.equal(runL7.decision, 'RUN_R8_L7');

assert.throws(
  () => decideR8Nfv15Sequence({ l13Assessment: nominated('L13'), l15: goodL15 }),
  /before L7/,
);

const stopL7 = decideR8Nfv15Sequence({
  l13Assessment: nominated('L13'),
  l7Assessment: rejected('L7'),
});
assert.equal(stopL7.decision, 'STOP_R8_AFTER_L7_NOT_NOMINATED_OR_PHYSICS_GATE_FAILED');
assert.equal(stopL7.runL1, false);

const deriveL15 = decideR8Nfv15Sequence({
  l13Assessment: nominated('L13'),
  l7Assessment: nominated('L7'),
});
assert.equal(deriveL15.decision, 'RECONSTRUCT_R8_L15');

const stopBadIdentity = decideR8Nfv15Sequence({
  l13Assessment: nominated('L13'),
  l7Assessment: nominated('L7'),
  l15: { ...goodL15, identity: { status: 'FAIL' } },
});
assert.equal(stopBadIdentity.decision, 'STOP_R8_L15_DERIVATION_GATE_FAILED');

const stopIndependentSolve = decideR8Nfv15Sequence({
  l13Assessment: nominated('L13'),
  l7Assessment: nominated('L7'),
  l15: { ...goodL15, independentNonlinearSolve: true },
});
assert.equal(stopIndependentSolve.decision, 'STOP_R8_L15_DERIVATION_GATE_FAILED');

const complete = decideR8Nfv15Sequence({
  l13Assessment: nominated('L13'),
  l7Assessment: nominated('L7'),
  l15: goodL15,
});
assert.equal(complete.decision, 'R8_CANDIDATE_MEASURED_THROUGH_L13_L7_L15;_L1_INTENTIONALLY_BLOCKED');
assert.equal(complete.runL1, false);
assert.equal(complete.productionPromotionAuthorized, false);

assert.throws(
  () => decideR8Nfv15Sequence({
    l13Assessment: { ...nominated('L13'), productionPromotionAuthorized: true },
  }),
  /productionPromotionAuthorized=false/,
);

process.stdout.write(`${JSON.stringify({
  schema: 'm047-r8-nfv15-sequence-contract/v1',
  status: 'PASS',
  checks: [
    'initial_gate_is_L13',
    'cannot_skip_L13',
    'L13_rejection_stops_L7',
    'L13_nomination_advances_only_to_L7',
    'cannot_skip_L7',
    'L7_rejection_stops_L15',
    'L7_nomination_advances_only_to_algebraic_L15',
    'L15_identity_failure_stops_sequence',
    'independent_nonlinear_L15_is_rejected',
    'successful_L15_still_blocks_L1',
    'promotion_authority_is_fail_closed',
  ],
}, null, 2)}\n`);
