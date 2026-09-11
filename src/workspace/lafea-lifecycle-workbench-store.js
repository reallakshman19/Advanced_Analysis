/** Public lifecycle workbench store backed by one canonical orchestrator. */
import { createLafeaContinuumConvergenceWorkbench } from './lafea-continuum-convergence-workbench.js';
import { createLafeaWorkbenchOrchestratorStore } from './lafea-workbench-orchestrator-store.js';
import { requireLafea1PressureRadiusRunAuthorized } from './lafea-1-pressure-radius-validation.js';

export {
  LAFEA_CALCULATION_STATES,
  LAFEA_CODE_STATES,
  LAFEA_LIFECYCLE_BINDING_SCHEMA,
  LAFEA_LIFECYCLE_BINDING_STATUSES,
  LAFEA_RELEASE_STATES,
  LAFEA_RESULT_STATES,
  LAFEA_WORKBENCH_STATE_SCHEMA,
} from './lafea-workbench-orchestrator-store.js';
export { createLafeaAnalysisMeshCustodyController } from './lafea-analysis-mesh-custody-controller.js';
export {
  LAFEA_ANALYSIS_MESH_CUSTODY_PROJECTION_SCHEMA,
  buildAnalysisMeshCustodyProjection,
} from './lafea-analysis-mesh-custody-projection.js';
export { validateLafeaAnalysisMeshEvidence } from './lafea-analysis-mesh-evidence-validator.js';
export {
  LAFEA_PREPARATION_APPROVAL_SCHEMA,
  LAFEA_PREPARATION_CATEGORIES,
  LAFEA_PREPARATION_DISPOSITIONS,
  LAFEA_PREPARATION_EVIDENCE_SCHEMA,
  LAFEA_PREPARATION_FINDING_SCHEMA,
  LAFEA_PREPARATION_REQUEST_SCHEMA,
  LAFEA_PREPARATION_SEVERITIES,
  createLafeaPreparationApproval,
  createLafeaPreparationEvidence,
  createLafeaPreparationFinding,
  createLafeaPreparationRequest,
  validateLafeaPreparationApproval,
  validateLafeaPreparationEvidence,
  validateLafeaPreparationFinding,
  validateLafeaPreparationRequest,
} from './lafea-preparation-contract.js';
export {
  LAFEA_PREPARATION_PROFILE_SCHEMA,
  lafeaPreparationProfile,
  requireLafeaPreparationProfile,
} from './lafea-preparation-profile.js';
export {
  LAFEA_PREPARATION_PROJECTION_SCHEMA,
  LAFEA_PREPARATION_PROJECTION_STATES,
  buildLafeaPreparationProjection,
  buildLafeaPreparationRequestFromStage,
} from './lafea-preparation-projection.js';
export {
  LAFEA_STAGE_ANALYSIS_ADAPTER_SCHEMA,
  lafeaStageAnalysisAdapter,
  requireLafeaStageAnalysisAdapter,
} from './lafea-stage-analysis-adapter.js';
export {
  LAFEA_WORKBENCH_ORCHESTRATION_ORDER,
  LAFEA_WORKBENCH_ORCHESTRATION_SCHEMA,
  LAFEA_WORKBENCH_ORCHESTRATION_SECTION_SCHEMA,
  LAFEA_WORKBENCH_ORCHESTRATION_STATES,
  buildLafeaWorkbenchOrchestrationProjection,
} from './lafea-workbench-orchestration-projection.js';
export * from './lafea-domain-geometry-public.js';
export * from './lafea-continuum-convergence-study.js';
export * from './lafea-continuum-convergence-publication.js';

export function createLafeaWorkbenchStore(options) {
  const store = createLafeaContinuumConvergenceWorkbench(
    createLafeaWorkbenchOrchestratorStore(options),
  );
  return Object.freeze({
    ...store,
    run: () => runWithLafea1PressureRadiusPreflight(store),
  });
}

function runWithLafea1PressureRadiusPreflight(store) {
  const state = store.getState();
  if (state.activeStageId === 'LAFEA.1') {
    try {
      requireLafea1PressureRadiusRunAuthorized(state.stages?.['LAFEA.1']?.document);
    } catch (error) {
      return store.reportEditError(
        'resultRequests.pressure.requestedRadii',
        null,
        error,
      );
    }
  }
  return store.run();
}
