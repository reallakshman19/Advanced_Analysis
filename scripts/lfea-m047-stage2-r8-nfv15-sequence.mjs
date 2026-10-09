#!/usr/bin/env node
/**
 * Pure orchestration contract for the R8/NFV15 governed measurement sequence.
 *
 * This module owns no solver mechanics and reads no benchmark bytes. It exists so
 * the stop/go ordering can be contract-tested without substituting a remote or
 * synthetic solve for the required local real-ACCDB measurement.
 */

export const R8_NFV15_NOMINATION = 'R8_NFV15_DIRECTIONALLY_NOMINATED_REQUIRES_NEXT_GOVERNED_GATE';

export function decideR8Nfv15Sequence(input = {}) {
  const l13Assessment = input.l13Assessment ?? null;
  const l7Assessment = input.l7Assessment ?? null;
  const l15 = input.l15 ?? null;

  if (l13Assessment === null) {
    if (l7Assessment !== null || l15 !== null) throw new TypeError('R8 sequence cannot provide L7/L15 before L13.');
    return decision('L13', 'RUN_R8_L13', 'RUN_LOCAL_CUSTODY_VERIFIED_R8_L13_AND_ASSESS_IMMEDIATELY');
  }
  assertAssessment(l13Assessment, 'L13');
  if (l13Assessment.nomination !== R8_NFV15_NOMINATION) {
    return decision(
      'L13',
      'STOP_R8_AFTER_L13_NOT_NOMINATED_OR_PHYSICS_GATE_FAILED',
      'DO_NOT_RUN_L7_OR_ANY_NEW_FRICTION_MECHANIC;_DIAGNOSE_COMMITTED_L13_ARTIFACT',
    );
  }

  if (l7Assessment === null) {
    if (l15 !== null) throw new TypeError('R8 sequence cannot provide L15 before L7.');
    return decision('L7', 'RUN_R8_L7', 'RUN_LOCAL_CUSTODY_VERIFIED_R8_L7_AND_ASSESS_IMMEDIATELY');
  }
  assertAssessment(l7Assessment, 'L7');
  if (l7Assessment.nomination !== R8_NFV15_NOMINATION) {
    return decision(
      'L7',
      'STOP_R8_AFTER_L7_NOT_NOMINATED_OR_PHYSICS_GATE_FAILED',
      'DO_NOT_RECONSTRUCT_L15_OR_RUN_L1;_DIAGNOSE_COMMITTED_L7_ARTIFACT',
    );
  }

  if (l15 === null) {
    return decision('L15', 'RECONSTRUCT_R8_L15', 'DERIVE_L15_EXACTLY_AS_L7_MINUS_L13;_NEVER_RUN_NONLINEAR_L15');
  }
  assertL15(l15);
  if (l15.identity.status !== 'PASS' || l15.independentNonlinearSolve !== false) {
    return decision(
      'L15',
      'STOP_R8_L15_DERIVATION_GATE_FAILED',
      'DO_NOT_RUN_L1_OR_PROMOTE_R8;_RECONCILE_L15_ALGEBRAIC_IDENTITY',
    );
  }

  return decision(
    'L15',
    'R8_CANDIDATE_MEASURED_THROUGH_L13_L7_L15;_L1_INTENTIONALLY_BLOCKED',
    'RESOLVE_AND_MEASURE_SEPARATE_L1_HYDROTEST_WW_BASIS_BEFORE_USING_L1_AS_AN_R8_SIGNAL',
  );
}

function assertAssessment(value, caseId) {
  if (!value || typeof value !== 'object') throw new TypeError(`${caseId} assessment must be an object.`);
  if (value.caseId !== caseId) throw new TypeError(`Expected ${caseId} assessment; received ${String(value.caseId)}.`);
  if (typeof value.nomination !== 'string') throw new TypeError(`${caseId} assessment nomination must be a string.`);
  if (value.productionPromotionAuthorized !== false) {
    throw new TypeError(`${caseId} assessment must keep productionPromotionAuthorized=false.`);
  }
}

function assertL15(value) {
  if (!value || typeof value !== 'object') throw new TypeError('L15 reconstruction must be an object.');
  if (!value.identity || typeof value.identity !== 'object' || typeof value.identity.status !== 'string') {
    throw new TypeError('L15 reconstruction must carry identity.status.');
  }
  if (typeof value.independentNonlinearSolve !== 'boolean') {
    throw new TypeError('L15 reconstruction must declare independentNonlinearSolve.');
  }
  if (value.productionPromotionAuthorized !== false) {
    throw new TypeError('L15 reconstruction must keep productionPromotionAuthorized=false.');
  }
}

function decision(gate, value, nextAction) {
  return Object.freeze({ gate, decision: value, nextAction, runL1: false, productionPromotionAuthorized: false });
}
