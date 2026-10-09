import { deepFreeze } from '../../core/shared-piping-model/index.js';
import { nonFeaMethodExecutionCoordinator } from '../non-fea-method-execution-coordinator.js';
import {
  createNonFeaEmpiricalRunAuthorization,
  requireCurrentNonFeaEmpiricalRunAuthorization,
} from './non-fea-empirical-run-authorization.js';

/**
 * Records a routine product Run authorization in the existing Common Input
 * method-consumption custody. This operation creates no numerical projection,
 * governed runtime package or calculation request.
 */
export function authorizeCurrentNonFeaEmpiricalRun(
  snapshot,
  {
    authorizedAt = new Date().toISOString(),
    executionCoordinator = nonFeaMethodExecutionCoordinator,
  } = {},
) {
  requireCoordinator(executionCoordinator);
  const decision = createNonFeaEmpiricalRunAuthorization(snapshot, { authorizedAt });
  requireCurrentNonFeaEmpiricalRunAuthorization(decision, snapshot);
  const prepared = executionCoordinator.prepareAuthorization({
    authorizationId: decision.authorizationId,
    authorizedAt: decision.authorizedAt,
    implementationId: decision.implementationId,
    scenarioId: `ROUTINE-RUN:${decision.commonInputSemanticHash}`,
    methodRequestSemanticHash: decision.semanticHash,
  });
  if (prepared?.commonInput?.semanticHash !== decision.commonInputSemanticHash) {
    fail(
      'Method-currentness coordinator used a different Common Input than the system Run authorization.',
      'NON_FEA_EMPIRICAL_RUN_AUTHORIZATION_COORDINATOR_COMMON_INPUT_MISMATCH',
      {
        expected: decision.commonInputSemanticHash,
        actual: prepared?.commonInput?.semanticHash || null,
      },
    );
  }
  // The required-method set is compared as a set, not a sequence: the decision
  // canonicalises it (requiredMethods() sorts) while the coordinator carries
  // it in declaration order, so an order-sensitive compare here rejects an
  // otherwise exactly-matching receipt. Set semantics are what the binding
  // actually means, and they match how every other required-method comparison
  // in the consumption contract already behaves.
  const receipt = prepared?.receipt;
  if (!receipt
      || receipt.authorizationId !== decision.authorizationId
      || receipt.authorizedAt !== decision.authorizedAt
      || receipt.implementationId !== decision.implementationId
      || receipt.methodRequestSemanticHash !== decision.semanticHash
      || receipt.commonInputSemanticHash !== decision.commonInputSemanticHash
      || JSON.stringify([...receipt.requiredCommonMethodIds].sort())
        !== JSON.stringify([...decision.requiredCommonMethodIds].sort())) {
    fail(
      'Method-currentness coordinator returned a receipt that does not bind the system Run authorization.',
      'NON_FEA_EMPIRICAL_RUN_AUTHORIZATION_COORDINATOR_BINDING_MISMATCH',
      {
        authorizationId: receipt?.authorizationId || null,
        implementationId: receipt?.implementationId || null,
        commonInputSemanticHash: receipt?.commonInputSemanticHash || null,
      },
    );
  }
  const recorded = executionCoordinator.recordAuthorization(receipt);
  if (recorded?.semanticHash !== receipt.semanticHash) {
    fail(
      'Method-currentness coordinator did not retain the exact prepared authorization receipt.',
      'NON_FEA_EMPIRICAL_RUN_AUTHORIZATION_RECORD_MISMATCH',
    );
  }
  return deepFreeze({
    decision,
    methodAuthorization: receipt,
  });
}

function requireCoordinator(value) {
  if (!value
      || typeof value.prepareAuthorization !== 'function'
      || typeof value.recordAuthorization !== 'function') {
    fail(
      'Routine Run authorization requires the Non-FEA method-currentness coordinator.',
      'NON_FEA_EMPIRICAL_RUN_AUTHORIZATION_COORDINATOR_INVALID',
    );
  }
}

function fail(message, code, details = null) {
  const error = new Error(message);
  error.code = code;
  error.details = details === null ? null : deepFreeze(structuredClone(details));
  throw error;
}
