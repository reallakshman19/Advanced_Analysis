/** Executable specification for immutable LAFEA.3 run-transaction custody. */
import { canonicalLafeaSha256 } from './lafea-canonical-sha256.js';

export const LAFEA_RUN_TRANSACTION_SCHEMA = 'lafea-run-transaction/v1';
export const LAFEA_RUN_TRANSACTION_RECEIPT_SCHEMA = 'lafea-run-transaction-receipt/v1';
const KEYS = ['sourceHash', 'analysisDomainHash', 'analysisGeometryHash', 'meshHash', 'meshProfileHash', 'solverModelHash'];

export function createLafeaWorkbenchRunTransactionState(stageIds) {
  const states = new Map(stageIds.map((stageId) => [stageId, { start: 0, done: 0, active: null, receipt: null }]));
  const get = (stageId) => { const state = states.get(stageId); if (!state) fail('LAFEA_RUN_TRANSACTION_STAGE_NOT_FOUND'); return state; };
  function begin(stageId, preflight) {
    requirePreflight(preflight, stageId); const state = get(stageId);
    if (state.active) state.receipt = finish(state, state.active, 'SUPERSEDED', null, null, 'LAFEA_RUN_TRANSACTION_REPLACED_BY_NEWER_START');
    state.start += 1;
    const parents = Object.freeze(Object.fromEntries(KEYS.map((key) => [key, preflight[key]])));
    const solverConfigHash = canonicalLafeaSha256({ schema: 'lafea-solver-configuration-binding/v1', compilerId: preflight.compilerId, compilerRevision: preflight.compilerRevision, solverModelHash: preflight.solverModelHash, requestedCaseIds: preflight.requestedCaseIds });
    const basis = { schema: LAFEA_RUN_TRANSACTION_SCHEMA, stageId, startSequence: state.start, status: 'RUNNING', parents, solverConfigHash, preflightHash: preflight.semanticHash, executionRoute: 'DOMAIN_FIRST_COMPILED_SOLVER_MODEL', releaseQualified: false };
    const transactionHash = canonicalLafeaSha256({ schema: 'lafea-run-transaction-hash-input/v1', transaction: basis });
    state.active = Object.freeze({ ...basis, transactionHash, transactionId: `LAFEA-TX-${String(state.start).padStart(6, '0')}-${transactionHash.slice(7, 19).toUpperCase()}` });
    return state.active;
  }
  function assertCurrent(stageId, id, stage, execution = null) {
    const state = get(stageId), tx = state.active;
    if (!tx || tx.transactionId !== id) fail('LAFEA_RUN_TRANSACTION_SUPERSEDED');
    const now = parents(stage);
    for (const key of KEYS) if (now[key] !== tx.parents[key]) fail(`LAFEA_RUN_TRANSACTION_PARENT_STALE:${key}`);
    if (execution) for (const key of KEYS) if (execution[key] !== tx.parents[key]) fail(`LAFEA_RUN_TRANSACTION_EXECUTION_PARENT_MISMATCH:${key}`);
    return tx;
  }
  function complete(stageId, id, stage, execution, runtime) {
    const state = get(stageId), tx = assertCurrent(stageId, id, stage, execution);
    const receipt = finish(state, tx, 'COMPLETED', execution.compiledExecutionHash, runtime?.semanticHash ?? null, null);
    state.receipt = receipt; state.active = null; return receipt;
  }
  function invalidate(stageId, reason = 'LAFEA_RUN_TRANSACTION_PARENT_INVALIDATED') {
    const state = get(stageId); if (!state.active) return state.receipt;
    state.receipt = finish(state, state.active, 'SUPERSEDED', null, null, reason); state.active = null; return state.receipt;
  }
  function fields(stageId) { const state = get(stageId); return Object.freeze({ activeRunTransaction: state.active, latestRunTransactionReceipt: state.receipt }); }
  return Object.freeze({ begin, assertCurrent, complete, invalidate, fields });
}

export function createLafeaRunningExecution(tx) {
  return Object.freeze({ schema: 'lafea-domain-first-workbench-execution/v1', stageId: tx.stageId,
    status: 'RUNNING', route: tx.executionRoute, ...tx.parents, compiledExecutionHash: null,
    runTransaction: tx, releaseQualified: false });
}

function finish(state, tx, status, executionHash, runtimeDiagnosticsHash, reasonCode) {
  state.done += 1;
  const body = { schema: LAFEA_RUN_TRANSACTION_RECEIPT_SCHEMA, stageId: tx.stageId, transactionId: tx.transactionId, transactionHash: tx.transactionHash, startSequence: tx.startSequence, completionSequence: state.done, status, parents: tx.parents, solverConfigHash: tx.solverConfigHash, preflightHash: tx.preflightHash, executionRoute: tx.executionRoute, executionHash, runtimeDiagnosticsHash, reasonCode, releaseQualified: false };
  return Object.freeze({ ...body, semanticHash: canonicalLafeaSha256({ schema: 'lafea-run-transaction-receipt-hash-input/v1', receipt: body }) });
}
function parents(stage) { return { sourceHash: stage?.sourceAuthority?.sourceHash ?? stage?.lifecycle?.source?.sourceHash ?? null, analysisDomainHash: stage?.analysisDomainProjection?.analysisDomainHash ?? null, analysisGeometryHash: stage?.analysisGeometryProjection?.analysisGeometryHash ?? null, meshHash: stage?.analysisMeshCustodyProjection?.meshHash ?? null, meshProfileHash: stage?.retainedAnalysisMeshEvidenceV2?.meshProfileHash ?? stage?.retainedAnalysisMeshProfile?.semanticHash ?? null, solverModelHash: stage?.retainedContinuumPreflightEvidence?.solverModelHash ?? null }; }
function requirePreflight(value, stageId) { if (!value || value.stageId !== stageId || value.status !== 'PASS' || value.executionAuthorized !== true || !value.semanticHash) fail('LAFEA_RUN_TRANSACTION_PREFLIGHT_INVALID'); for (const key of KEYS) if (!value[key]) fail(`LAFEA_RUN_TRANSACTION_PREFLIGHT_PARENT_INVALID:${key}`); }
function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
