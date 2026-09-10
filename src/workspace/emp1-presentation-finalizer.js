/**
 * Final presentation pass for the EMP.1 task shell.
 *
 * Existing engineering nodes remain intact. This module changes labels,
 * disclosure defaults and presentation hierarchy only; it does not read SVG
 * geometry as authority, calculate mechanics, or alter governed source state.
 */

export const EMP1_PRESENTATION_FINALIZER_SCHEMA = 'emp1-presentation-finalizer/v1';

const STEP_LABELS = Object.freeze({
  BASIS_SOURCE: Object.freeze({ ordinal: 1, label: 'Start', note: 'Choose assessment data and confirm the basis.' }),
  GEOMETRY: Object.freeze({ ordinal: 2, label: 'Geometry', note: 'Review the dimensions used by this assessment.' }),
  LOADS: Object.freeze({ ordinal: 3, label: 'Loads', note: 'Review forces, moments, pressure and units.' }),
  LOAD_TRANSFER: Object.freeze({ ordinal: 4, label: 'Load transfer', note: 'Calculate loads at the assessment reference point.' }),
  SECTION_SCREENING: Object.freeze({ ordinal: 5, label: 'Section check', note: 'Check the nominal section using current load-transfer evidence.' }),
  LOCAL_CORRELATION: Object.freeze({ ordinal: 6, label: 'Local check', note: 'Run the available local method for the current inputs.' }),
  REVIEW_EVIDENCE: Object.freeze({ ordinal: 7, label: 'Review & export', note: 'Review the assessment result, limitations and permitted use.' }),
});

const INSPECTOR_LABELS = Object.freeze({
  engineeringEvidence: 'Data & status',
  boundedCorrelation: 'Method limits',
  correlationAvailability: 'Method availability',
  settings: 'Technical settings',
});

const EVIDENCE_LABELS = Object.freeze({
  transactionSummary: 'Assessment result',
  results: 'Calculation detail',
  correlationResult: 'Local check evidence',
  screeningCustody: 'Section record',
  lineage: 'Data history',
  benchmarkEvidence: 'Reference comparison',
  benchmark: 'Software QA',
});

const SURFACE_TITLES = Object.freeze({
  transactionSummary: 'Assessment result',
  results: 'Calculation detail',
  correlationResult: 'Local check evidence',
  screeningCustody: 'Section check record',
  lineage: 'Data history',
  benchmarkEvidence: 'Reference comparison',
  benchmark: 'Software verification',
  runConfiguration: 'Local check setup',
});

export function finalizeEmp1Presentation(shell, options = {}) {
  if (!shell || typeof shell.querySelector !== 'function') return shell;
  const assessment = options.assessmentState ?? null;
  shell.dataset.emp1PresentationFinalizer = EMP1_PRESENTATION_FINALIZER_SCHEMA;

  normalizeWorkflow(shell, assessment);
  normalizeTaskContext(shell, assessment);
  normalizeInspector(shell);
  normalizeEvidence(shell);
  normalizeSurfaces(shell, options.backingStageId);
  normalizeTechnicalDisclosures(shell);
  normalizeBenchmark(shell);

  shell.addEventListener?.('emp1-task-shell-select', () => {
    const apply = () => {
      normalizeTaskContext(shell, assessment);
      normalizeWorkflowSteps(shell, assessment);
      normalizeCurrentTaskSurfaceTitle(shell);
    };
    const queue = shell.ownerDocument?.defaultView?.queueMicrotask ?? globalThis.queueMicrotask;
    if (typeof queue === 'function') queue(apply);
    else setTimeout(apply, 0);
  });
  return shell;
}

function normalizeWorkflow(shell, assessment) {
  const workflow = shell.querySelector('[data-role="emp1-workflow"]');
  if (!workflow) return;
  const headline = workflow.querySelector('.lafea-result-highlights__status');
  if (headline) headline.textContent = 'Local attachment assessment';

  const compact = workflow.querySelector('[data-role="emp1-workflow-compact-status"]');
  if (compact && assessment?.outcome) {
    compact.dataset.role = 'emp1-assessment-outcome';
    compact.dataset.outcomeState = assessment.outcome.state;
    compact.setAttribute('role', 'status');
    compact.setAttribute('aria-live', 'polite');
    const title = create(shell, 'strong', null, assessment.outcome.label);
    const message = create(shell, 'span', null, assessment.outcome.message);
    const result = create(shell, 'span', null, `Result · ${assessment.result?.label ?? 'Not calculated'}`);
    const use = create(shell, 'span', null, `Use · ${assessment.release?.label ?? 'Not approved for final use'}`);
    compact.replaceChildren(title, message, result, use);
  }

  normalizeWorkflowSteps(shell, assessment);
  normalizeFailure(workflow, assessment);

  const workflowDetails = workflow.querySelector('[data-role="emp1-workflow-details"]');
  const workflowSummary = workflowDetails?.querySelector(':scope > summary');
  if (workflowSummary) workflowSummary.textContent = 'Readiness and technical details';

  const backing = workflow.querySelector('[data-role="emp1-technical-backing-steps"]');
  if (backing) {
    backing.open = false;
    backing.dataset.emp1RawAllowed = 'true';
    const summary = backing.querySelector(':scope > summary');
    if (summary) summary.textContent = 'Engine details (A/B/C)';
  }
}

function normalizeWorkflowSteps(shell, assessment) {
  const buttons = shell.querySelectorAll?.('[data-role="emp1-professional-step"]') ?? [];
  for (const button of buttons) {
    const stepId = button.dataset.emp1ProfessionalStep;
    const definition = STEP_LABELS[stepId];
    if (!definition) continue;
    const status = assessment?.steps?.[stepId]?.label ?? 'Status available in details';
    button.textContent = `${definition.ordinal} ${definition.label}`;
    button.setAttribute('aria-label', `${definition.ordinal} ${definition.label}. ${status}`);
    button.setAttribute('title', status);
    button.dataset.emp1UserStepLabel = definition.label;
  }
}

function normalizeFailure(workflow, assessment) {
  const failure = workflow.querySelector('[data-role="emp1-workflow-run-failure"]');
  if (!failure || !assessment?.blocker || assessment.blocker.state !== 'ERROR') return;
  failure.setAttribute('role', 'alert');
  failure.replaceChildren(
    create(workflow, 'strong', null, assessment.blocker.title),
    create(workflow, 'p', null, assessment.blocker.message),
    create(workflow, 'p', null, `Next: ${assessment.blocker.recoveryAction}`),
  );
  if (assessment.blocker.technicalCode) {
    const details = create(workflow, 'details', 'lafea-workbench__custody-details');
    details.dataset.role = 'emp1-workflow-run-failure-technical';
    details.dataset.emp1RawAllowed = 'true';
    details.append(
      create(workflow, 'summary', null, 'Technical diagnostic'),
      create(workflow, 'code', null, assessment.blocker.technicalCode),
    );
    failure.append(details);
  }
}

function normalizeTaskContext(shell, assessment) {
  const stepId = shell.dataset.emp1ProfessionalTask ?? 'BASIS_SOURCE';
  const definition = STEP_LABELS[stepId] ?? STEP_LABELS.BASIS_SOURCE;
  const eyebrow = shell.querySelector('.emp1-split-console__task-context-eyebrow');
  if (eyebrow) eyebrow.textContent = 'Current step';
  const title = shell.querySelector('[data-role="emp1-active-task-title"]');
  if (title) title.textContent = `${definition.ordinal} · ${definition.label}`;
  const note = shell.querySelector('[data-role="emp1-active-task-note"]');
  if (note) note.textContent = definition.note;
  const activeStatus = assessment?.steps?.[stepId]?.state;
  if (title && activeStatus) title.dataset.stepState = activeStatus;
}

function normalizeInspector(shell) {
  const buttons = shell.querySelectorAll?.('[data-role="emp1-inspector-tab"]') ?? [];
  for (const button of buttons) {
    const surfaceId = button.dataset.emp1InspectorView;
    const label = INSPECTOR_LABELS[surfaceId];
    if (!label) continue;
    button.textContent = label;
    button.setAttribute('aria-label', label);
  }
  for (const [surfaceId, label] of Object.entries(INSPECTOR_LABELS)) {
    shell.querySelector?.(`[data-emp1-inspector-view="${surfaceId}"][role="tabpanel"]`)
      ?.setAttribute('aria-label', label);
  }
}

function normalizeEvidence(shell) {
  const buttons = shell.querySelectorAll?.('[data-role="emp1-evidence-tab"]') ?? [];
  for (const button of buttons) {
    const surfaceId = button.dataset.emp1EvidenceView;
    const label = EVIDENCE_LABELS[surfaceId];
    if (!label) continue;
    button.textContent = label;
    button.setAttribute('aria-label', label);
  }
  for (const [surfaceId, label] of Object.entries(EVIDENCE_LABELS)) {
    shell.querySelector?.(`[data-emp1-evidence-view="${surfaceId}"][role="tabpanel"]`)
      ?.setAttribute('aria-label', label);
  }
  const toggle = shell.querySelector('[data-role="emp1-evidence-console-toggle"]');
  if (toggle) {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.textContent = expanded ? 'Results & evidence · collapse' : 'Results & evidence';
  }
}

function normalizeSurfaces(shell, backingStageId) {
  const route = shell.querySelector('[data-emp1-layout-surface="route"]');
  const routeTitle = route?.querySelector(':scope > h2');
  if (routeTitle) routeTitle.textContent = 'Assessment setup';
  const routeHeading = route?.querySelector('[data-role="lafea-analytical-route-heading"]');
  if (routeHeading) routeHeading.textContent = backingStageId === 'LAFEA.2'
    ? 'Section check setup'
    : 'Load transfer setup';

  for (const [surfaceId, title] of Object.entries(SURFACE_TITLES)) {
    const surface = shell.querySelector(`[data-emp1-layout-surface="${surfaceId}"]`);
    const heading = surface?.querySelector(':scope > h2');
    if (heading) heading.textContent = title;
  }
  normalizeCurrentTaskSurfaceTitle(shell);
}

function normalizeCurrentTaskSurfaceTitle(shell) {
  const source = shell.querySelector('[data-emp1-layout-surface="source"]');
  const title = source?.querySelector(':scope > h2');
  if (!title || source.hidden) return;
  const stepId = shell.dataset.emp1ProfessionalTask ?? 'BASIS_SOURCE';
  const titles = {
    BASIS_SOURCE: 'Assessment data',
    GEOMETRY: 'Geometry',
    LOADS: 'Loads',
    LOAD_TRANSFER: 'Load transfer',
    SECTION_SCREENING: 'Section check',
  };
  title.textContent = titles[stepId] ?? 'Assessment data';
}

function normalizeTechnicalDisclosures(shell) {
  const selectors = [
    '[data-role="emp1-workflow-details"]',
    '[data-role="emp1-technical-backing-steps"]',
    '[data-role="emp1-c-route-detail"]',
    '[data-role="emp1-c-route-limitations"]',
    '[data-role="emp1-c-gamma-domain-detail"]',
  ];
  for (const selector of selectors) {
    const nodes = shell.querySelectorAll?.(selector) ?? [];
    for (const node of nodes) node.dataset.emp1RawAllowed = 'true';
  }
}

function normalizeBenchmark(shell) {
  const surface = shell.querySelector('[data-emp1-layout-surface="benchmark"]');
  if (!surface) return;
  normalizeBenchmarkPanel(surface);
  const MutationObserverType = shell.ownerDocument?.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  if (typeof MutationObserverType !== 'function') return;
  const observer = new MutationObserverType(() => normalizeBenchmarkPanel(surface));
  observer.observe(surface, { childList: true, subtree: true });
}

function normalizeBenchmarkPanel(surface) {
  const panel = surface.querySelector?.('[data-role="fea-benchmark-panel"]');
  if (!panel) return;
  const eyebrow = panel.querySelector('.panel-eyebrow');
  setText(eyebrow, 'Software quality assurance');
  const heading = panel.querySelector('h2');
  setText(heading, 'Software verification suite');
  const headerText = panel.querySelector('.fea-benchmark__header p');
  setText(headerText, 'These checks validate software implementation against verification cases. They are not an EMP.1 assessment result and do not establish engineering acceptance or release.');
  const status = panel.querySelector('[data-role="fea-benchmark-status"]');
  if (status && !status.textContent.startsWith('Software checks:')) {
    setText(status, `Software checks: ${status.textContent.toLowerCase()}`);
  }
  const run = panel.querySelector('[data-role="fea-benchmark-run"]');
  setText(run, 'Run software checks');
  const quick = panel.querySelector('[data-role="fea-benchmark-run-t1"]');
  setText(quick, 'Run closed-form software checks');
  const download = panel.querySelector('[data-role="fea-benchmark-download"]');
  setText(download, 'Download QA report');
  if (!panel.querySelector('[data-role="emp1-software-verification-boundary"]')) {
    const boundary = create(surface, 'p', 'lafea-workbench__authority',
      'Software verification is separate from the assessment result. A green software-check status does not mean this EMP.1 assessment passed or is approved for final use.');
    boundary.dataset.role = 'emp1-software-verification-boundary';
    panel.querySelector('.fea-benchmark__header')?.append(boundary);
  }
}

function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

function create(root, tag, className, text) {
  const documentRef = root.ownerDocument;
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
