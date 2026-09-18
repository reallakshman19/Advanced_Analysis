/** Formal UI-only presentation of canonical LAFEA engineering states. */

export const LAFEA_UI_STATUS_SCHEMA = 'lafea-ui-status/v1';

const PRESENTATIONS = Object.freeze({
  NOT_STARTED: Object.freeze({ label: 'Not started', tone: 'neutral' }),
  READY: Object.freeze({ label: 'Ready', tone: 'positive' }),
  WARNING: Object.freeze({ label: 'Attention required', tone: 'warning' }),
  BLOCKED: Object.freeze({ label: 'Blocked', tone: 'critical' }),
  COMPLETE: Object.freeze({ label: 'Complete', tone: 'positive' }),
  CURRENT: Object.freeze({ label: 'Current', tone: 'positive' }),
  CURRENT_PASS: Object.freeze({ label: 'Qualified', tone: 'positive' }),
  CURRENT_WARNING: Object.freeze({ label: 'Qualified with warnings', tone: 'warning' }),
  CURRENT_BLOCK: Object.freeze({ label: 'Blocked', tone: 'critical' }),
  STALE: Object.freeze({ label: 'Stale evidence', tone: 'warning' }),
  INVALID: Object.freeze({ label: 'Invalid', tone: 'critical' }),
  ABSENT: Object.freeze({ label: 'Not generated', tone: 'neutral' }),
  UNAVAILABLE: Object.freeze({ label: 'Unavailable', tone: 'neutral' }),
  UNINITIALIZED: Object.freeze({ label: 'Not initialized', tone: 'neutral' }),
  SOURCE_REQUIRED: Object.freeze({ label: 'Source required', tone: 'neutral' }),
  SOURCE_FORMULATION_REQUIRED: Object.freeze({ label: 'Source formulation required', tone: 'warning' }),
  SOURCE_FORMULATION_UNRECOGNIZED: Object.freeze({ label: 'Unrecognized source formulation', tone: 'critical' }),
  QUALIFIED: Object.freeze({ label: 'Qualified', tone: 'positive' }),
  QUALIFIED_SOURCE_INPUT: Object.freeze({ label: 'Qualified source', tone: 'positive' }),
  ADVISORY: Object.freeze({ label: 'Advisory', tone: 'warning' }),
  FAILED: Object.freeze({ label: 'Failed', tone: 'critical' }),
  NOT_RUN: Object.freeze({ label: 'Not run', tone: 'neutral' }),
  LOADED: Object.freeze({ label: 'Loaded', tone: 'positive' }),
  NOT_LOADED: Object.freeze({ label: 'Not loaded', tone: 'neutral' }),
  RETAINED: Object.freeze({ label: 'Retained', tone: 'positive' }),
  PASS: Object.freeze({ label: 'Qualified', tone: 'positive' }),
  ACCEPTED: Object.freeze({ label: 'Accepted', tone: 'positive' }),
  NOT_DECLARED: Object.freeze({ label: 'Not declared', tone: 'neutral' }),
  NOT_APPLICABLE: Object.freeze({ label: 'Not applicable', tone: 'neutral' }),
  MESH_REQUIRED: Object.freeze({ label: 'Mesh required', tone: 'warning' }),
  MESH_REGENERATION_REQUIRED: Object.freeze({ label: 'Mesh regeneration required', tone: 'warning' }),
  QUALIFIED_NOT_CURRENT: Object.freeze({ label: 'Previous result — stale', tone: 'warning' }),
  QUALIFIED_NOT_PUBLISHED: Object.freeze({ label: 'Computed — not published', tone: 'warning' }),
  ENGINE_NOT_IMPLEMENTED: Object.freeze({ label: 'Unavailable', tone: 'neutral' }),
  QUALIFIED_ROUTE_REGISTERED: Object.freeze({ label: 'Engine available', tone: 'positive' }),
  EXACT_HEAD_QUALIFICATION_REQUIRED: Object.freeze({ label: 'External qualification required', tone: 'warning' }),
  NOT_GATED: Object.freeze({ label: 'Informational only', tone: 'neutral' }),
  NOT_RETAINED: Object.freeze({ label: 'Not generated', tone: 'neutral' }),
  'Not retained': Object.freeze({ label: 'Not generated', tone: 'neutral' }),
});

export function lafeaUiStatusPresentation(canonicalStatus) {
  const canonical = typeof canonicalStatus === 'string' && canonicalStatus
    ? canonicalStatus
    : 'UNKNOWN';
  const presentation = PRESENTATIONS[canonical]
    ?? Object.freeze({ label: 'Unknown state', tone: 'neutral' });
  return Object.freeze({
    schema: LAFEA_UI_STATUS_SCHEMA,
    canonical,
    label: presentation.label,
    tone: presentation.tone,
  });
}
