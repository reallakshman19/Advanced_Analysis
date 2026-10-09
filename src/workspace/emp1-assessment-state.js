import { emp1PlainLanguageLabel } from './emp1-plain-language-labels.js';

export const EMP1_ASSESSMENT_STATE_SCHEMA = 'emp1-assessment-state/v1';

export const EMP1_ASSESSMENT_ACTIONS = Object.freeze({
  RUN_COMPLETE_EXAMPLE: 'RUN_COMPLETE_EXAMPLE',
  RUN_LOAD_TRANSFER: 'RUN_LOAD_TRANSFER',
  OPEN_SECTION_CHECK: 'OPEN_SECTION_CHECK',
  RUN_SECTION_CHECK: 'RUN_SECTION_CHECK',
  CONFIGURE_LOCAL_CHECK: 'CONFIGURE_LOCAL_CHECK',
  RUN_LOCAL_CHECK: 'RUN_LOCAL_CHECK',
  REVIEW_ASSESSMENT: 'REVIEW_ASSESSMENT',
});

const B_STALE_STATES = new Set([
  'AWAITING_CURRENT_A',
  'A_EVIDENCE_REQUIRED',
  'STALE_A_EVIDENCE',
]);

/**
 * Presentation-only EMP.1 assessment state.
 *
 * This module does not create engineering authority and does not recalculate any
 * mechanics. It translates the already-governed workspace/product projections
 * into one operator-facing state consumed by header, workflow and action bar.
 */
export function projectEmp1AssessmentState(options = {}) {
  const state = options.state ?? {};
  const projection = options.projection ?? {};
  const runReadiness = options.runReadiness ?? null;
  const executionCurrentness = options.executionCurrentness ?? null;
  const cState = options.cState ?? null;
  const runFailure = options.runFailure ?? null;

  const byShortId = Object.fromEntries((projection.steps ?? []).map((step) => [step.shortId, step]));
  const a = byShortId.A ?? {};
  const b = byShortId.B ?? {};
  const c = byShortId.C ?? {};
  const aStage = state.stages?.['LAFEA.1'] ?? null;
  const bStage = state.stages?.['LAFEA.2'] ?? null;

  const aDocumentLoaded = Boolean(aStage?.document ?? a.documentLoaded);
  const bDocumentLoaded = Boolean(bStage?.document ?? b.documentLoaded);
  const aCurrent = a.resultAvailable === true
    || (aStage?.execution?.status === 'QUALIFIED'
      && aStage?.execution?.result?.qualification?.state === 'ACCEPTED');
  const bCurrent = b.resultAvailable === true;
  const bStale = B_STALE_STATES.has(b.state) || b.retainedResultAvailable === true;
  const localCurrent = cState?.currentResultAvailable === true || c.resultAvailable === true;
  const localRetained = cState?.retainedResultAvailable === true || c.retainedResultAvailable === true;
  const executionCurrent = executionCurrentness?.state === 'CURRENT';
  const releaseQualified = projection.qualificationBoundary?.releaseQualified === true;

  const steps = Object.freeze({
    BASIS_SOURCE: stepStatus(
      !aDocumentLoaded && !bDocumentLoaded ? 'NEEDS_INPUT'
        : aDocumentLoaded && bDocumentLoaded ? 'READY'
          : 'NEEDS_ATTENTION',
      !aDocumentLoaded && !bDocumentLoaded ? 'No assessment data loaded'
        : aDocumentLoaded && bDocumentLoaded ? 'Assessment data ready'
          : 'Assessment data incomplete',
    ),
    GEOMETRY: stepStatus(aDocumentLoaded ? 'READY' : 'NEEDS_INPUT',
      aDocumentLoaded ? 'Ready to review' : 'Assessment data required'),
    LOADS: stepStatus(aDocumentLoaded ? 'READY' : 'NEEDS_INPUT',
      aDocumentLoaded ? 'Ready to review' : 'Assessment data required'),
    LOAD_TRANSFER: stepStatus(aCurrent ? 'CURRENT' : aDocumentLoaded ? 'READY' : 'UNAVAILABLE',
      aCurrent ? 'Current' : aDocumentLoaded ? 'Ready to calculate' : 'Assessment data required'),
    SECTION_SCREENING: stepStatus(bCurrent ? 'CURRENT' : bStale ? 'NEEDS_ATTENTION'
      : bDocumentLoaded && aCurrent ? 'READY' : 'UNAVAILABLE',
    bCurrent ? 'Current' : bStale ? 'Inputs changed — recalculate'
      : bDocumentLoaded && aCurrent ? 'Ready to calculate' : 'Needs current load transfer and section data'),
    LOCAL_CORRELATION: stepStatus(localCurrent ? 'CURRENT' : localRetained ? 'NEEDS_ATTENTION'
      : cState?.buttonEnabled === true ? 'READY' : 'UNAVAILABLE',
    localCurrent ? 'Current' : localRetained ? 'Inputs changed — recalculate'
      : cState?.buttonEnabled === true ? 'Ready to calculate' : 'Method unavailable or setup incomplete'),
    REVIEW_EVIDENCE: stepStatus(localCurrent || executionCurrent ? 'READY' : 'UNAVAILABLE',
      localCurrent || executionCurrent ? 'Ready to review' : 'No current assessment result'),
  });

  const nextAction = chooseNextAction({
    aDocumentLoaded,
    bDocumentLoaded,
    aCurrent,
    bCurrent,
    bStale,
    localCurrent,
    localRetained,
    executionCurrent,
    runInputLoaded: Boolean(options.runInput),
    cState,
    runReadiness,
  });

  const failure = runFailure ? failureProjection(runFailure, nextAction) : null;
  const outcome = failure
    ? Object.freeze({
      state: 'ACTION_REQUIRED',
      label: 'Action required',
      message: `Assessment stopped — ${failure.message}`,
    })
    : buildOutcome({
      aDocumentLoaded,
      bDocumentLoaded,
      localCurrent,
      executionCurrent,
      releaseQualified,
      nextAction,
    });

  return Object.freeze({
    schema: EMP1_ASSESSMENT_STATE_SCHEMA,
    outcome,
    steps,
    source: steps.BASIS_SOURCE,
    geometry: steps.GEOMETRY,
    loads: steps.LOADS,
    transfer: steps.LOAD_TRANSFER,
    screening: steps.SECTION_SCREENING,
    localCorrelation: steps.LOCAL_CORRELATION,
    result: stepStatus(localCurrent || executionCurrent ? 'CURRENT'
      : localRetained || executionCurrentness?.state === 'STALE' ? 'NEEDS_ATTENTION' : 'NOT_CALCULATED',
    localCurrent || executionCurrent ? 'Current assessment result'
      : localRetained || executionCurrentness?.state === 'STALE' ? 'Inputs changed — recalculate'
        : 'Not calculated'),
    release: stepStatus(releaseQualified ? 'APPROVED' : 'NOT_APPROVED',
      releaseQualified ? 'Approved for stated use' : 'Not approved for final use'),
    nextAction,
    blocker: failure ?? blockerProjection(nextAction),
    technical: Object.freeze({
      backingStageId: state.activeStageId ?? null,
      aLifecycleBinding: aStage?.lifecycleBinding?.status ?? null,
      bLifecycleBinding: bStage?.lifecycleBinding?.status ?? null,
      executionCurrentness: executionCurrentness?.state ?? 'NOT_RUN',
      cState: cState?.state ?? c.state ?? null,
      releaseQualified,
    }),
  });
}

function chooseNextAction(context) {
  if (!context.aDocumentLoaded && !context.bDocumentLoaded) {
    return action(EMP1_ASSESSMENT_ACTIONS.RUN_COMPLETE_EXAMPLE, 'Run complete example',
      'Load a compatible example and run the required assessment stages in order.', 'BASIS_SOURCE');
  }
  if (!context.aDocumentLoaded) {
    return action(EMP1_ASSESSMENT_ACTIONS.RUN_COMPLETE_EXAMPLE, 'Run complete example',
      'Load a complete compatible assessment because load-transfer data is missing.', 'BASIS_SOURCE');
  }
  if (!context.aCurrent) {
    return action(EMP1_ASSESSMENT_ACTIONS.RUN_LOAD_TRANSFER, 'Run load transfer',
      'Calculate the current load-transfer source before continuing.', 'LOAD_TRANSFER');
  }
  if (!context.bDocumentLoaded) {
    return action(EMP1_ASSESSMENT_ACTIONS.OPEN_SECTION_CHECK, 'Continue to section check',
      'Add the section-check data that belongs to this assessment.', 'SECTION_SCREENING');
  }
  if (!context.bCurrent || context.bStale) {
    return action(EMP1_ASSESSMENT_ACTIONS.RUN_SECTION_CHECK, 'Run section check',
      context.bStale
        ? 'Inputs changed since the retained section result; recalculate before relying on it.'
        : 'Calculate the nominal section check for the current inputs.',
      'SECTION_SCREENING');
  }
  if (!context.runInputLoaded) {
    return action(EMP1_ASSESSMENT_ACTIONS.CONFIGURE_LOCAL_CHECK, 'Configure local check',
      'Confirm the attachment geometry and source references required by the local check.', 'LOCAL_CORRELATION');
  }
  if (context.cState?.buttonEnabled === true && !context.localCurrent) {
    return action(EMP1_ASSESSMENT_ACTIONS.RUN_LOCAL_CHECK,
      context.localRetained ? 'Recalculate local check' : 'Run local check',
      'Run the local correlation under the current bounded method authority.', 'LOCAL_CORRELATION');
  }
  if (context.localCurrent || context.executionCurrent) {
    return action(EMP1_ASSESSMENT_ACTIONS.REVIEW_ASSESSMENT, 'Review assessment',
      'Review the governing result, limitations and permitted use before export.', 'REVIEW_EVIDENCE');
  }
  if (context.runReadiness?.runAuthorized === true) {
    return action(EMP1_ASSESSMENT_ACTIONS.RUN_LOCAL_CHECK, 'Run assessment',
      'Run the required downstream assessment steps for the current inputs.', 'LOCAL_CORRELATION');
  }
  return action(EMP1_ASSESSMENT_ACTIONS.CONFIGURE_LOCAL_CHECK, 'Resolve missing information',
    plainReasons(context.runReadiness?.reasons), 'LOCAL_CORRELATION');
}

function buildOutcome(context) {
  if (!context.aDocumentLoaded && !context.bDocumentLoaded) {
    return Object.freeze({
      state: 'NOT_READY',
      label: 'Not ready',
      message: 'Run the complete example or import assessment data to begin.',
    });
  }
  if (context.localCurrent) {
    return Object.freeze({
      state: 'CALCULATED',
      label: 'Calculated',
      message: context.releaseQualified
        ? 'Assessment calculated — review the result and approved use.'
        : 'Assessment calculated — review the result. It is not approved for final use.',
    });
  }
  if (context.executionCurrent) {
    return Object.freeze({
      state: 'CALCULATED_WITH_LIMITATION',
      label: 'Calculated with limitation',
      message: 'Upstream calculations are current; review the local-check limitation before using the assessment.',
    });
  }
  return Object.freeze({
    state: 'IN_PROGRESS',
    label: 'In progress',
    message: `${context.nextAction.label} — ${context.nextAction.reason}`,
  });
}

function blockerProjection(nextAction) {
  if (!nextAction || nextAction.id === EMP1_ASSESSMENT_ACTIONS.REVIEW_ASSESSMENT) return null;
  return Object.freeze({
    state: 'GUIDANCE',
    title: 'Next required step',
    message: nextAction.reason,
    recoveryAction: nextAction.label,
    technicalCode: null,
  });
}

function failureProjection(runFailure, nextAction) {
  const code = String(runFailure.code ?? 'EMP1_ASSESSMENT_FAILED');
  const label = emp1PlainLanguageLabel(code);
  return Object.freeze({
    state: 'ERROR',
    title: 'Assessment needs attention',
    message: label === code ? 'The assessment could not complete.' : label,
    recoveryAction: nextAction?.label ?? 'Review the current inputs',
    technicalCode: code,
  });
}

function action(id, label, reason, targetStep) {
  return Object.freeze({ id, label, reason, targetStep, enabled: true });
}

function stepStatus(state, label) {
  return Object.freeze({ state, label });
}

function plainReasons(reasons) {
  if (!Array.isArray(reasons) || !reasons.length) {
    return 'Complete the missing source or local-check setup before continuing.';
  }
  return reasons.map((reason) => emp1PlainLanguageLabel(reason)).join(' ');
}
