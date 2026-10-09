/** Orchestrator-owned authoritative execution state for domain-first workbench routes. */
export const LAFEA_DOMAIN_FIRST_EXECUTION_STATE_SCHEMA =
  'lafea-domain-first-workbench-execution/v1';

export function createLafeaWorkbenchDomainFirstExecutionState(stageIds) {
  const retained = Object.fromEntries(stageIds.map((stageId) => [stageId, null]));

  function retain(stageId, value) {
    requireStage(stageId);
    if (!value || value.stageId !== stageId
      || !['RUNNING', 'QUALIFIED', 'FAILED'].includes(value.status)
      || value.schema !== LAFEA_DOMAIN_FIRST_EXECUTION_STATE_SCHEMA
      || (value.status === 'RUNNING' && value.runTransaction?.status !== 'RUNNING')) {
      fail('LAFEA_DOMAIN_FIRST_EXECUTION_STATE_INVALID');
    }
    retained[stageId] = freeze(structuredClone(value));
    return retained[stageId];
  }

  function clear(stageId) {
    requireStage(stageId);
    const changed = retained[stageId] !== null;
    retained[stageId] = null;
    return changed;
  }

  function select(stageId) {
    requireStage(stageId);
    return retained[stageId];
  }

  function fields(stageId) {
    const execution = select(stageId);
    return execution ? freeze({ execution }) : freeze({});
  }

  function requireStage(stageId) {
    if (!Object.hasOwn(retained, stageId)) fail('LAFEA_DOMAIN_FIRST_EXECUTION_STAGE_INVALID');
  }

  return Object.freeze({ retain, clear, select, fields });
}

function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
