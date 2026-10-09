/** UI-only grouping of canonical LAFEA workflow steps into operator-facing areas. */

export const LAFEA_WORKFLOW_AREA_SCHEMA = 'lafea-workflow-area-presentation/v1';

const AREA_DEFINITIONS = Object.freeze([
  Object.freeze({
    areaId: 'MODEL',
    label: 'Model',
    stepIds: Object.freeze([
      'SOURCE_IDENTITY',
      'ANALYSIS_PROFILE',
      'MATERIALS_SECTIONS',
      'RESTRAINTS_BCS',
      'LOADS_CASES',
    ]),
  }),
  Object.freeze({
    areaId: 'MESH',
    label: 'Mesh',
    stepIds: Object.freeze(['DISCRETIZATION']),
  }),
  Object.freeze({
    areaId: 'SOLVE',
    label: 'Solve',
    stepIds: Object.freeze([
      'MODEL_DIAGNOSTICS',
      'NUMERICAL_PREFLIGHT',
      'AUTHORIZATION',
      'RUN',
    ]),
  }),
  Object.freeze({
    areaId: 'CONVERGENCE',
    label: 'Convergence',
    stepIds: Object.freeze(['CONVERGENCE']),
  }),
  Object.freeze({
    areaId: 'RESULTS',
    label: 'Results',
    stepIds: Object.freeze(['RESULTS_EVIDENCE']),
  }),
]);

const STATUS_PRIORITY = Object.freeze([
  'BLOCKED',
  'WARNING',
  'READY',
  'NOT_STARTED',
  'COMPLETE',
]);

export function buildLafeaWorkflowAreaPresentation(workflow) {
  if (!workflow || workflow.schema !== 'lafea-guided-workflow/v1' || !Array.isArray(workflow.steps)) {
    throw new TypeError('LAFEA_WORKFLOW_AREA_PRESENTATION_INPUT_INVALID');
  }
  const byId = new Map(workflow.steps.map((step) => [step.stepId, step]));
  return Object.freeze(AREA_DEFINITIONS.map((definition) => {
    const canonicalSteps = Object.freeze(
      definition.stepIds.map((stepId) => requireStep(byId, stepId)),
    );
    const status = areaStatus(definition.areaId, workflow, canonicalSteps);
    const presentationSteps = status === 'NOT_APPLICABLE' && canonicalSteps.length > 1
      ? Object.freeze([canonicalSteps[canonicalSteps.length - 1]])
      : canonicalSteps;
    return Object.freeze({
      schema: LAFEA_WORKFLOW_AREA_SCHEMA,
      areaId: definition.areaId,
      label: definition.label,
      status,
      steps: presentationSteps,
      targetStep: selectTargetStep(canonicalSteps),
      reasons: status === 'NOT_APPLICABLE'
        ? Object.freeze([])
        : Object.freeze(areaReasons(definition.areaId, workflow, byId, canonicalSteps)),
    });
  }));
}

/**
 * #1841: when the solver has produced a qualified result and publication is held
 * only by the outstanding convergence study, the Results area was reporting
 * RESULT_EVIDENCE_NOT_CURRENT -- "not current" reads as a stale or failed run,
 * which is the opposite of what happened. Report the gate that is actually
 * holding publication, and the action that clears it. The gate itself is
 * unchanged: Results stays BLOCKED until convergence is qualified.
 */
function areaReasons(areaId, workflow, byId, steps) {
  const reasons = unique(steps
    .filter((step) => step.status !== 'COMPLETE')
    .flatMap((step) => step.reasons));
  if (areaId !== 'RESULTS'
    || workflow.executionBoundary?.resultEvidenceStatus !== 'QUALIFIED') return reasons;
  const convergence = byId.get('CONVERGENCE');
  if (!convergence || convergence.status === 'COMPLETE') return reasons;
  return unique(['CONVERGENCE_STUDY_NOT_RUN', ...reasons.filter(
    (reason) => reason !== 'RESULT_EVIDENCE_NOT_CURRENT',
  )]);
}

function areaStatus(areaId, workflow, steps) {
  if (areaId === 'MESH' && workflow.meshApplicable === false) return 'NOT_APPLICABLE';
  if (areaId === 'CONVERGENCE'
    && steps.every((step) => step.reasons.includes('WORKFLOW_STEP_NOT_APPLICABLE'))) {
    return 'NOT_APPLICABLE';
  }
  if ((areaId === 'SOLVE' || areaId === 'CONVERGENCE' || areaId === 'RESULTS')
    && workflow.executionSupported === false) {
    return 'NOT_APPLICABLE';
  }
  const sourceStep = workflow.steps.find((step) => step.stepId === 'SOURCE_IDENTITY');
  if (sourceStep?.status === 'NOT_STARTED' && (areaId === 'MESH' || areaId === 'SOLVE' || areaId === 'RESULTS')) {
    return 'NOT_STARTED';
  }
  const aggregate = aggregateStatus(steps);
  if (aggregate === 'READY' && steps[steps.length - 1].status === 'COMPLETE') return 'COMPLETE';
  return aggregate;
}

function aggregateStatus(steps) {
  const statuses = new Set(steps.map((step) => step.status));
  return STATUS_PRIORITY.find((status) => statuses.has(status)) ?? 'NOT_STARTED';
}

function selectTargetStep(steps) {
  for (const status of STATUS_PRIORITY) {
    const match = steps.find((step) => step.status === status);
    if (match) return match;
  }
  return steps[0];
}

function requireStep(byId, stepId) {
  const step = byId.get(stepId);
  if (!step || !Array.isArray(step.reasons)) {
    throw new TypeError(`LAFEA_WORKFLOW_AREA_STEP_REQUIRED:${stepId}`);
  }
  return step;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
