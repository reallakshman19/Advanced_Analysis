/** Stage 13 authoritative LAFEA.3 workbench run assembled from the compiled solver route. */
import {
  executeLafeaContinuumCompiledAuthoritatively,
} from './lafea-continuum-compiled-execution.js';
import {
  createLafeaContinuumDomainFirstLifecycleProducerBatch,
} from './lafea-continuum-domain-first-lifecycle-producers.js';
import {
  compileLafeaContinuumWorkbenchContext,
} from './lafea-continuum-workbench-route.js';
import {
  LAFEA_DOMAIN_FIRST_EXECUTION_STATE_SCHEMA,
} from './lafea-workbench-domain-first-execution-state.js';

const STAGE_ID = 'LAFEA.3';
const ROUTE = 'DOMAIN_FIRST_COMPILED_SOLVER_MODEL';

export function executeLafeaContinuumAuthoritativeWorkbenchRun(context, stageId) {
  if (stageId !== STAGE_ID) fail('LAFEA_CONTINUUM_AUTHORITATIVE_STAGE_NOT_AUTHORIZED');
  const compiled = compileLafeaContinuumWorkbenchContext(context, stageId);
  const evidence = executeLafeaContinuumCompiledAuthoritatively(compiled.solverModel);
  const accepted = evidence.qualificationState === 'ACCEPTED'
    && evidence.lifecyclePublicationAuthorized === true;
  const execution = freeze({
    schema: LAFEA_DOMAIN_FIRST_EXECUTION_STATE_SCHEMA,
    stageId,
    status: accepted ? 'QUALIFIED' : 'FAILED',
    route: ROUTE,
    sourceHash: compiled.sourceAuthority.sourceHash,
    analysisDomainHash: compiled.analysisDomain.semanticHash,
    analysisGeometryHash: compiled.geometryEvidence.analysisGeometryHash,
    meshHash: compiled.meshEvidence.meshHash,
    meshProfileHash: compiled.meshEvidence.meshProfileHash,
    solverModelHash: compiled.solverModel.solverModelHash,
    canonicalExecutionInputHash: evidence.canonicalExecutionInputHash,
    compiledExecutionHash: evidence.executionEvidenceHash,
    source: compiled.source,
    canonicalInput: evidence.canonicalInput,
    result: evidence.executionResult,
    diagnostics: accepted ? [] : diagnostics(evidence.executionResult),
    releaseQualified: false,
  });
  const lifecycleBatch = accepted
    ? createLafeaContinuumDomainFirstLifecycleProducerBatch({
      sourceAuthority: compiled.sourceAuthority,
      solverModel: compiled.solverModel,
      execution,
    })
    : null;
  return freeze({ compiled, evidence, execution, lifecycleBatch });
}

function diagnostics(result) {
  const rows = Array.isArray(result?.diagnostics) ? result.diagnostics : [];
  return rows.length ? rows.map((row) => ({ ...row })) : [{
    severity: 'ERROR',
    code: 'LAFEA_CONTINUUM_AUTHORITATIVE_CALCULATION_REJECTED',
    path: 'calculation',
    message: 'The compiled continuum kernel result was not accepted.',
  }];
}

function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
