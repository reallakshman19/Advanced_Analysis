/**
 * Final presentation pass for the EMP.1 task shell.
 *
 * Existing engineering nodes remain intact. This module changes labels,
 * disclosure defaults and presentation hierarchy only; it does not read SVG
 * geometry as authority, calculate mechanics, or alter governed source state.
 */

export const EMP1_PRESENTATION_FINALIZER_SCHEMA = 'emp1-presentation-finalizer/v1';

const GLOBAL_META_OBSERVERS = new WeakMap();

const STEP_LABELS = Object.freeze({
  BASIS_SOURCE: Object.freeze({ ordinal: 1, label: 'Start', note: 'Confirm the assessment basis here. Use Geometry or Loads to edit engineering inputs.' }),
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

  normalizeGlobalTopbar(shell);
  normalizeActionBar(shell, assessment);
  normalizeWorkflow(shell, assessment);
  normalizeTaskContext(shell, assessment);
  normalizeInspector(shell);
  normalizeEvidence(shell);
  normalizeLocalCheck(shell);
  normalizeReviewOutcome(shell, assessment);
  normalizeSurfaces(shell, options.backingStageId);
  normalizeTechnicalDisclosures(shell);
  normalizeBenchmark(shell);

  shell.addEventListener?.('emp1-task-shell-select', () => {
    const apply = () => {
      normalizeTaskContext(shell, assessment);
      normalizeWorkflowSteps(shell, assessment);
      normalizeCurrentTaskSurfaceTitle(shell);
      normalizeLocalCheck(shell);
    };
    const queue = shell.ownerDocument?.defaultView?.queueMicrotask ?? globalThis.queueMicrotask;
    if (typeof queue === 'function') queue(apply);
    else setTimeout(apply, 0);
  });
  return shell;
}

function normalizeActionBar(shell, assessment) {
  const documentRef = shell.ownerDocument;
  const toolbar = documentRef?.querySelector?.('[data-role="lafea-workbench"] [data-role="emp1-action-bar"]');
  if (!toolbar) return;
  const primary = toolbar.querySelector('[data-role="emp1-primary-action"]');
  const help = toolbar.querySelector('[data-role="emp1-primary-action-help"]');
  const complete = toolbar.querySelector('[data-role="emp1-load-complete-qualification-sample"]');
  if (primary) primary.dataset.emp1PrimaryAction = 'true';

  if (assessment?.nextAction?.id === 'RUN_COMPLETE_EXAMPLE' && complete) {
    if (primary) {
      primary.hidden = true;
      delete primary.dataset.emp1PrimaryAction;
    }
    complete.dataset.emp1PrimaryAction = 'true';
    complete.dataset.toolbarPrimary = 'true';
    complete.setAttribute('aria-describedby', 'emp1-primary-action-help');
    toolbar.insertBefore(complete, help ?? toolbar.firstChild);
  }
}

function normalizeGlobalTopbar(shell) {
  const documentRef = shell.ownerDocument;
  const meta = documentRef?.querySelector?.('.top-bar-meta');
  if (meta) {
    meta.hidden = true;
    meta.dataset.hiddenByEmp1 = 'true';
  }
  const MutationObserverType = documentRef?.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  if (!documentRef || typeof MutationObserverType !== 'function' || GLOBAL_META_OBSERVERS.has(documentRef)) return;
  const observer = new MutationObserverType(() => {
    if (documentRef.querySelector?.('[data-role="lafea-analytical-calc"]')) return;
    const current = documentRef.querySelector?.('.top-bar-meta[data-hidden-by-emp1="true"]');
    if (current) {
      current.hidden = false;
      delete current.dataset.hiddenByEmp1;
    }
  });
  observer.observe(documentRef.body ?? documentRef.documentElement, { childList: true, subtree: true });
  GLOBAL_META_OBSERVERS.set(documentRef, observer);
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
    const title = create(shell, 'strong', null, `${assessment.outcome.label}: `);
    const message = create(shell, 'span', null, `${assessment.outcome.message} `);
    const result = create(shell, 'span', null, `· Result · ${assessment.result?.label ?? 'Not calculated'} `);
    const use = create(shell, 'span', null, `· Use · ${assessment.release?.label ?? 'Not approved for final use'}`);
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
  normalizeStartGuidance(shell, stepId);
  const activeStatus = assessment?.steps?.[stepId]?.state;
  if (title && activeStatus) title.dataset.stepState = activeStatus;
}

function normalizeStartGuidance(shell, stepId) {
  const source = shell.querySelector('[data-emp1-layout-surface="source"]');
  const existing = source?.querySelector?.('[data-role="emp1-start-guidance"]') ?? null;
  if (stepId !== 'BASIS_SOURCE') {
    existing?.remove?.();
    return;
  }
  if (!source || existing) return;
  const guidance = create(
    shell,
    'p',
    'lafea-workbench__authority',
    'Start confirms which assessment data is loaded. Use Geometry or Loads to edit engineering inputs.',
  );
  guidance.dataset.role = 'emp1-start-guidance';
  const heading = source.querySelector(':scope > h2');
  if (heading?.insertAdjacentElement) heading.insertAdjacentElement('afterend', guidance);
  else source.prepend?.(guidance);
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

function normalizeLocalCheck(shell) {
  const panel = shell.querySelector('[data-role="emp1-c-run-configuration"]');
  if (!panel) return;
  const form = panel.querySelector('.lafea-workbench__form');
  if (!form) return;

  const intro = panel.querySelector('.lafea-workbench__section-intro');
  setText(intro,
    'Choose the load and pressure cases, confirm the attachment and cylinder dimensions, and review whether the bounded local method applies.');

  relabelControl(panel, 'emp1-c-load-case', 'Load case');
  relabelControl(panel, 'emp1-c-pressure-result', 'Pressure case (zero differential pressure required)');

  const currentness = panel.querySelector('[data-role="emp1-product-currentness"]');
  if (currentness?.textContent?.startsWith('EMP.1.C:')) {
    currentness.textContent = currentness.textContent.replace(/^EMP\.1\.C:/u, 'Local check:');
  }

  const apply = panel.querySelector('[data-role="emp1-c-apply-run-input"]');
  setText(apply, 'Update local-check basis');

  let technical = panel.querySelector('[data-role="emp1-local-check-source-traceability"]');
  if (!technical) {
    technical = create(panel, 'details', 'lafea-workbench__custody-details');
    technical.dataset.role = 'emp1-local-check-source-traceability';
    technical.dataset.emp1RawAllowed = 'true';
    technical.open = false;
    technical.append(create(panel, 'summary', null, 'Source traceability & advanced settings'));
  }

  const technicalRoles = [
    'emp1-c-geometry-identity',
    'emp1-c-attachment-source-ref',
    'emp1-c-applicability-geometry-identity',
    'emp1-c-cylinder-length-source-ref',
    'emp1-c-attachment-station-source-ref',
  ];
  for (const role of technicalRoles) {
    const row = panel.querySelector(`[data-role="${role}"]`)?.closest?.('label');
    if (row) technical.append(row);
  }
  const physicalBasis = panel.querySelector('[data-role="emp1-c-r0-physical-basis"]');
  const canonical = panel.querySelector('[data-role="emp1-c-canonical-length-unit"]');
  if (physicalBasis) technical.append(physicalBasis);
  if (canonical) technical.append(canonical);
  form.append(technical);

  const boundary = panel.querySelector('[data-role="emp1-c-production-authority"]');
  const boundaryTitle = boundary?.querySelector('strong');
  const boundaryText = boundary?.querySelector('p');
  const suspended = Boolean(boundaryTitle?.textContent?.toLowerCase().includes('suspended'));
  setText(boundaryTitle, suspended ? 'Local method unavailable for current inputs' : 'Bounded local method');
  setText(boundaryText, suspended
    ? 'The local method cannot run under the current bounded authority. Review the reasons below and correct the inputs or method setup.'
    : 'Available only within the qualified WRC range shown in Method limits. A calculated local result does not establish code compliance or final-use approval.');

  panel.dataset.emp1Simplified = 'true';
}

function relabelControl(container, role, label) {
  const control = container.querySelector(`[data-role="${role}"]`);
  const row = control?.closest?.('label');
  const labelNode = row?.querySelector?.(':scope > span');
  setText(labelNode, label);
  control?.setAttribute?.('aria-label', label);
}

function normalizeReviewOutcome(shell, assessment) {
  const summary = shell.querySelector('[data-role="emp1-product-execution-summary"]');
  if (!summary || summary.dataset.emp1OutcomeFirst === 'true') return;
  const body = summary.children?.[1] ?? null;
  const professional = summary.querySelector('[data-role="emp1-professional-status"]');
  if (!body || !professional) return;

  const rawTransactionTable = [...body.children]
    .find((node) => node.tagName === 'TABLE') ?? null;
  const engineeringDecision = tableValue(rawTransactionTable, 'Engineering decision');
  const outcome = create(summary, 'div', 'lafea-workbench__authority');
  outcome.dataset.role = 'emp1-review-outcome';
  outcome.append(
    create(summary, 'strong', null, 'Assessment outcome'),
    create(summary, 'p', null,
      assessment?.outcome?.message ?? 'Review the current assessment result and limitations before export.'),
  );
  const facts = create(summary, 'dl', 'lafea-workbench__review-outcome-facts');
  appendDefinition(summary, facts, 'Result', assessment?.result?.label ?? 'Status available in technical evidence');
  appendDefinition(summary, facts, 'Engineering decision', plainEngineeringDecision(engineeringDecision));
  appendDefinition(summary, facts, 'Permitted use', assessment?.release?.label ?? 'Not approved for final use');
  outcome.append(facts);
  outcome.append(create(summary, 'p', null,
    `Next: ${assessment?.nextAction?.reason ?? 'Review the limitations and permitted use before export.'}`));
  professional.append(outcome);

  const technical = create(summary, 'details', 'lafea-workbench__custody-details');
  technical.dataset.role = 'emp1-review-technical-evidence';
  technical.dataset.emp1RawAllowed = 'true';
  technical.open = false;
  technical.append(create(summary, 'summary', null, 'Technical evidence & traceability'));

  const domain = professional.querySelector('[data-role="emp1-professional-bounded-domain"]');
  if (domain) technical.append(domain);
  if (rawTransactionTable) technical.append(rawTransactionTable);
  const authorityEvidence = body.querySelector(':scope > [data-role="emp1-c-authority-evidence"]');
  if (authorityEvidence) technical.append(authorityEvidence);
  body.append(technical);
  summary.dataset.emp1OutcomeFirst = 'true';
}

function appendDefinition(root, list, term, value) {
  list.append(
    create(root, 'dt', null, term),
    create(root, 'dd', null, value ?? '—'),
  );
}

function tableValue(table, label) {
  if (!table) return null;
  for (const row of table.querySelectorAll?.('tr') ?? []) {
    const heading = row.querySelector?.('th[scope="row"]');
    if (heading?.textContent?.trim() !== label) continue;
    return row.querySelector?.('td')?.textContent?.trim() ?? null;
  }
  return null;
}

function plainEngineeringDecision(value) {
  if (value === 'ESCALATE') return 'Engineering review required';
  if (value === 'ACCEPT') return 'Acceptable within the stated assessment scope';
  if (value === 'REJECT') return 'Correction required';
  if (!value) return 'Review required';
  return value.toLowerCase().replaceAll('_', ' ');
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
    '[data-role="emp1-review-technical-evidence"]',
    '[data-role="emp1-local-check-source-traceability"]',
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