export const LOAD_CALC_RESULT_PRESENTATION = Object.freeze({
  CALCULATED: Object.freeze({
    message: 'Authorized calculation complete.',
    openLoads: true,
  }),
  CALCULATED_WITH_EXCEPTIONS: Object.freeze({
    message: 'Authorized calculation complete with exceptions; review coverage, unallocated load and transfer-moment evidence.',
    openLoads: true,
  }),
  FAILED: Object.freeze({
    message: 'Authorized calculation failed; review blocking failures and equilibrium evidence.',
    openLoads: false,
  }),
  BLOCKED: Object.freeze({
    message: 'Authorized calculation blocked; review the listed inputs.',
    openLoads: false,
  }),
  UNKNOWN: Object.freeze({
    message: 'Authorized calculation status is unavailable; review the calculation evidence.',
    openLoads: false,
  }),
});

/**
 * Presentation-only classification for an already-produced engineering result.
 * Current-system executions may carry an overall resultStatus that is stricter
 * than the vertical-reaction distribution status (for example, retained
 * source-explicit moment demand). Prefer that receipt status when supplied.
 * This function never changes result status, engineering values, readiness,
 * equilibrium, or publication authority.
 */
export function classifyLoadCalcResultPresentation(distribution, execution = null) {
  const status = typeof execution?.resultStatus === 'string'
    ? execution.resultStatus
    : typeof distribution?.status === 'string'
      ? distribution.status
      : 'UNKNOWN';
  return LOAD_CALC_RESULT_PRESENTATION[status]
    || LOAD_CALC_RESULT_PRESENTATION.UNKNOWN;
}
