/**
 * Presentation-only split-console composition contract for the EMP.1 analytical workbench.
 *
 * The registry classifies already-rendered child surfaces into stable presentation
 * regions. It never derives engineering state, calls a calculator, clones a child
 * surface, or decides whether an engineering surface is authoritative.
 */

export const EMP1_ANALYTICAL_LAYOUT_SCHEMA = 'emp1-analytical-layout/v2';
export const EMP1_SPLIT_CONSOLE_SCHEMA = 'emp1-split-console/v1';

export const EMP1_ANALYTICAL_LAYOUT_REGIONS = Object.freeze({
  WORKFLOW: 'COMPACT_WORKFLOW_NAV',
  PRIMARY_WORK: 'ACTIVE_TASK',
  ENGINEERING_BASIS: 'BASIS_RAIL',
  FULL_WIDTH_DETAIL: 'EVIDENCE_WORKSPACE',
});

export const EMP1_SPLIT_CONSOLE_MODES = Object.freeze(['WORK', 'BASIS', 'EVIDENCE']);

const REGION_DEFINITIONS = Object.freeze({
  COMPACT_WORKFLOW_NAV: Object.freeze({
    role: 'emp1-analytical-workflow-region',
    label: 'Assessment workflow navigation',
  }),
  ACTIVE_TASK: Object.freeze({
    role: 'emp1-analytical-primary-work',
    label: 'Active engineering workspace',
  }),
  BASIS_RAIL: Object.freeze({
    role: 'emp1-analytical-engineering-basis',
    label: 'Engineering inspector',
  }),
  EVIDENCE_WORKSPACE: Object.freeze({
    role: 'emp1-analytical-full-width-detail',
    label: 'Results and evidence console',
  }),
});

/** Retained EMP.1 surface custody order. */
export const EMP1_ANALYTICAL_SURFACE_ORDER = Object.freeze([
  'workflow',
  'route',
  'source',
  'engineeringEvidence',
  'screeningCustody',
  'correlationAvailability',
  'boundedCorrelation',
  'runConfiguration',
  'transactionSummary',
  'correlationResult',
  'settings',
  'results',
  'lineage',
  'benchmarkEvidence',
  'benchmark',
]);

export const EMP1_ANALYTICAL_SURFACE_PLACEMENT = Object.freeze({
  workflow: EMP1_ANALYTICAL_LAYOUT_REGIONS.WORKFLOW,
  route: EMP1_ANALYTICAL_LAYOUT_REGIONS.PRIMARY_WORK,
  source: EMP1_ANALYTICAL_LAYOUT_REGIONS.PRIMARY_WORK,
  engineeringEvidence: EMP1_ANALYTICAL_LAYOUT_REGIONS.ENGINEERING_BASIS,
  screeningCustody: EMP1_ANALYTICAL_LAYOUT_REGIONS.FULL_WIDTH_DETAIL,
  correlationAvailability: EMP1_ANALYTICAL_LAYOUT_REGIONS.ENGINEERING_BASIS,
  boundedCorrelation: EMP1_ANALYTICAL_LAYOUT_REGIONS.ENGINEERING_BASIS,
  runConfiguration: EMP1_ANALYTICAL_LAYOUT_REGIONS.PRIMARY_WORK,
  transactionSummary: EMP1_ANALYTICAL_LAYOUT_REGIONS.FULL_WIDTH_DETAIL,
  correlationResult: EMP1_ANALYTICAL_LAYOUT_REGIONS.FULL_WIDTH_DETAIL,
  settings: EMP1_ANALYTICAL_LAYOUT_REGIONS.ENGINEERING_BASIS,
  results: EMP1_ANALYTICAL_LAYOUT_REGIONS.FULL_WIDTH_DETAIL,
  lineage: EMP1_ANALYTICAL_LAYOUT_REGIONS.FULL_WIDTH_DETAIL,
  benchmarkEvidence: EMP1_ANALYTICAL_LAYOUT_REGIONS.FULL_WIDTH_DETAIL,
  benchmark: EMP1_ANALYTICAL_LAYOUT_REGIONS.FULL_WIDTH_DETAIL,
});

/** Already-rendered primary surfaces allowed to contribute height for one task. */
export const EMP1_TASK_SHELL_TASK_SURFACES = Object.freeze({
  BASIS_SOURCE: Object.freeze(['route', 'source']),
  GEOMETRY: Object.freeze(['source', 'runConfiguration']),
  LOADS: Object.freeze(['source']),
  LOAD_TRANSFER: Object.freeze(['source']),
  SECTION_SCREENING: Object.freeze(['source']),
  LOCAL_CORRELATION: Object.freeze(['runConfiguration']),
  REVIEW_EVIDENCE: Object.freeze([]),
});

/** Governed editor groups retained in DOM custody but filtered by active task. */
export const EMP1_TASK_SHELL_INPUT_GROUPS = Object.freeze({
  BASIS_SOURCE: Object.freeze([]),
  GEOMETRY: Object.freeze(['PIPE_GEOMETRY', 'THICKNESS']),
  LOADS: Object.freeze(['PRESSURE', 'PRESSURE_RADII', 'LOAD_CASES']),
  LOAD_TRANSFER: Object.freeze(['REFERENCE_POINTS']),
  SECTION_SCREENING: Object.freeze(['SCREENING_CASES', 'EVALUATION_LOCATIONS']),
  LOCAL_CORRELATION: Object.freeze([]),
  REVIEW_EVIDENCE: Object.freeze([]),
});

export const EMP1_TASK_SHELL_INSPECTOR_ORDER = Object.freeze([
  'engineeringEvidence',
  'boundedCorrelation',
  'correlationAvailability',
  'settings',
]);

export const EMP1_TASK_SHELL_EVIDENCE_ORDER = Object.freeze([
  'results',
  'transactionSummary',
  'correlationResult',
  'screeningCustody',
  'lineage',
  'benchmarkEvidence',
  'benchmark',
]);

const TASK_LABELS = Object.freeze({
  BASIS_SOURCE: 'Basis & Source',
  GEOMETRY: 'Geometry',
  LOADS: 'Loads',
  LOAD_TRANSFER: 'Load Transfer',
  SECTION_SCREENING: 'Section Screening',
  LOCAL_CORRELATION: 'Local Correlation',
  REVIEW_EVIDENCE: 'Review & Evidence',
});

const TASK_ORDINALS = Object.freeze({
  BASIS_SOURCE: 1,
  GEOMETRY: 2,
  LOADS: 3,
  LOAD_TRANSFER: 4,
  SECTION_SCREENING: 5,
  LOCAL_CORRELATION: 6,
  REVIEW_EVIDENCE: 7,
});

const INSPECTOR_LABELS = Object.freeze({
  engineeringEvidence: 'Custody',
  boundedCorrelation: 'Authority',
  correlationAvailability: 'Availability',
  settings: 'Settings',
});

const EVIDENCE_LABELS = Object.freeze({
  results: 'Current result',
  transactionSummary: 'Execution summary',
  correlationResult: 'Correlation evidence',
  screeningCustody: 'Screening custody',
  lineage: 'Lineage',
  benchmarkEvidence: 'Benchmark evidence',
  benchmark: 'Verification',
});

/**
 * Inspector surfaces are presentation-contextual. Existing governed nodes remain
 * in DOM custody; an unrelated authority surface is not shown merely because it
 * exists for another task.
 */
const TASK_INSPECTOR_SURFACES = Object.freeze({
  BASIS_SOURCE: Object.freeze(['engineeringEvidence', 'settings']),
  GEOMETRY: Object.freeze(['settings', 'engineeringEvidence']),
  LOADS: Object.freeze(['engineeringEvidence']),
  LOAD_TRANSFER: Object.freeze(['engineeringEvidence']),
  SECTION_SCREENING: Object.freeze(['engineeringEvidence', 'correlationAvailability']),
  LOCAL_CORRELATION: Object.freeze(['boundedCorrelation', 'correlationAvailability', 'settings']),
  REVIEW_EVIDENCE: Object.freeze(['engineeringEvidence']),
});

const TASK_DEFAULT_INSPECTOR = Object.freeze({
  BASIS_SOURCE: 'engineeringEvidence',
  GEOMETRY: 'settings',
  LOADS: 'engineeringEvidence',
  LOAD_TRANSFER: 'engineeringEvidence',
  SECTION_SCREENING: 'engineeringEvidence',
  LOCAL_CORRELATION: 'boundedCorrelation',
  REVIEW_EVIDENCE: 'engineeringEvidence',
});

const TASK_DEFAULT_EVIDENCE = Object.freeze({
  BASIS_SOURCE: 'results',
  GEOMETRY: 'results',
  LOADS: 'results',
  LOAD_TRANSFER: 'results',
  SECTION_SCREENING: 'screeningCustody',
  LOCAL_CORRELATION: 'correlationResult',
  REVIEW_EVIDENCE: 'transactionSummary',
});

const TASK_SHELL_SELECTION = new WeakMap();
const TASK_SHELL_RUNTIME = new WeakMap();

export function emp1TaskShellSelection(selectionHost, initialTaskStep = 'BASIS_SOURCE') {
  const state = mutableSelection(selectionHost, initialTaskStep);
  return Object.freeze({ ...state });
}

/** Presentation-only task update; no engineering/controller state is mutated. */
export function selectEmp1TaskShellTask(selectionHost, shell, stepId) {
  assertTaskStep(stepId);
  const state = mutableSelection(selectionHost, stepId);
  state.activeTaskStep = stepId;
  state.taskSelectionExplicit = true;
  state.inspectorView = TASK_DEFAULT_INSPECTOR[stepId];
  state.evidenceView = TASK_DEFAULT_EVIDENCE[stepId] ?? state.evidenceView;
  state.consoleMode = stepId === 'REVIEW_EVIDENCE' ? 'EVIDENCE' : 'WORK';
  state.evidenceOpen = stepId === 'REVIEW_EVIDENCE';
  const runtime = TASK_SHELL_RUNTIME.get(shell);
  if (runtime) {
    collapseTransientDetails(runtime);
    applyTaskShellState(runtime);
  }
  return Object.freeze({ ...state });
}

/**
 * Move each supplied, already-rendered surface exactly once into its declared
 * presentation region. Inspector/evidence selections only toggle presentation.
 */
export function composeEmp1AnalyticalLayout(shell, surfaces, options = {}) {
  if (!shell?.ownerDocument) throw new TypeError('EMP1_ANALYTICAL_LAYOUT_SHELL_REQUIRED');
  exactSurfaceKeys(surfaces);
  if (!nodeLike(surfaces.workflow)) {
    throw new TypeError('EMP1_ANALYTICAL_LAYOUT_WORKFLOW_REQUIRED');
  }

  const present = EMP1_ANALYTICAL_SURFACE_ORDER
    .map((surfaceId) => [surfaceId, surfaces[surfaceId]])
    .filter(([, surface]) => surface != null);
  const unique = new Set();
  present.forEach(([surfaceId, surface]) => {
    if (!nodeLike(surface)) {
      throw new TypeError(`EMP1_ANALYTICAL_LAYOUT_SURFACE_INVALID:${surfaceId}`);
    }
    if (unique.has(surface)) {
      throw new TypeError(`EMP1_ANALYTICAL_LAYOUT_SURFACE_DUPLICATE:${surfaceId}`);
    }
    unique.add(surface);
    normalizePresentationSurface(surfaceId, surface);
  });

  const selectionHost = options.selectionHost ?? shell.ownerDocument;
  const initialTaskStep = options.initialTaskStep
    ?? (shell.dataset.emp1Step === 'B' ? 'SECTION_SCREENING' : 'BASIS_SOURCE');
  const state = mutableSelection(selectionHost, initialTaskStep);
  reconcileSelectionWithBackingStage(state, shell.dataset.emp1Step);

  const regions = Object.fromEntries(Object.entries(REGION_DEFINITIONS).map(
    ([regionId, definition]) => [regionId, createRegion(shell.ownerDocument, regionId, definition)],
  ));
  const taskContext = createTaskContext(shell.ownerDocument);
  regions[EMP1_ANALYTICAL_LAYOUT_REGIONS.PRIMARY_WORK].append(taskContext.root);
  const taskEntries = [];
  const inspectorEntries = [];
  const evidenceEntries = [];

  present.forEach(([surfaceId, surface]) => {
    const regionId = EMP1_ANALYTICAL_SURFACE_PLACEMENT[surfaceId];
    surface.dataset.emp1LayoutSurface = surfaceId;
    surface.dataset.emp1LayoutRegion = regionId;
    if (regionId === EMP1_ANALYTICAL_LAYOUT_REGIONS.PRIMARY_WORK) taskEntries.push([surfaceId, surface]);
    if (regionId === EMP1_ANALYTICAL_LAYOUT_REGIONS.ENGINEERING_BASIS) {
      inspectorEntries.push([surfaceId, surface]);
      return;
    }
    if (regionId === EMP1_ANALYTICAL_LAYOUT_REGIONS.FULL_WIDTH_DETAIL) {
      evidenceEntries.push([surfaceId, surface]);
      return;
    }
    regions[regionId].append(surface);
  });

  const inspectorRegion = regions[EMP1_ANALYTICAL_LAYOUT_REGIONS.ENGINEERING_BASIS];
  const orderedInspector = EMP1_TASK_SHELL_INSPECTOR_ORDER
    .map((surfaceId) => inspectorEntries.find(([candidate]) => candidate === surfaceId))
    .filter(Boolean);
  const inspectorTabs = createInspectorTabs(shell.ownerDocument, selectionHost, shell, orderedInspector);
  inspectorRegion.append(inspectorTabs.tablist, ...orderedInspector.map(([, surface]) => surface));

  const evidenceRegion = regions[EMP1_ANALYTICAL_LAYOUT_REGIONS.FULL_WIDTH_DETAIL];
  const orderedEvidence = EMP1_TASK_SHELL_EVIDENCE_ORDER
    .map((surfaceId) => evidenceEntries.find(([candidate]) => candidate === surfaceId))
    .filter(Boolean);
  const evidenceConsole = createEvidenceConsole(shell.ownerDocument, selectionHost, shell, orderedEvidence);
  evidenceRegion.append(
    evidenceConsole.toggle,
    evidenceConsole.tablist,
    ...orderedEvidence.map(([, surface]) => surface),
  );

  const lanes = shell.ownerDocument.createElement('div');
  lanes.className = 'emp1-analytical-layout__lanes';
  lanes.dataset.role = 'emp1-analytical-layout-lanes';
  lanes.append(
    regions[EMP1_ANALYTICAL_LAYOUT_REGIONS.PRIMARY_WORK],
    inspectorRegion,
  );

  const modeTabs = createConsoleModeTabs(shell.ownerDocument, selectionHost, shell);
  shell.dataset.emp1TaskShell = 'true';
  shell.dataset.emp1SplitConsole = EMP1_SPLIT_CONSOLE_SCHEMA;
  shell.append(
    regions[EMP1_ANALYTICAL_LAYOUT_REGIONS.WORKFLOW],
    modeTabs.tablist,
    lanes,
    evidenceRegion,
  );

  const runtime = {
    selectionHost,
    shell,
    state,
    regions,
    taskContext,
    taskEntries,
    inspectorEntries: orderedInspector,
    inspectorTabs: inspectorTabs.buttons,
    evidenceEntries: orderedEvidence,
    evidenceTabs: evidenceConsole.buttons,
    evidenceToggle: evidenceConsole.toggle,
    modeTabs: modeTabs.buttons,
  };
  TASK_SHELL_RUNTIME.set(shell, runtime);

  shell.addEventListener?.('emp1-task-shell-select', (event) => {
    const stepId = event?.detail?.stepId;
    if (Object.prototype.hasOwnProperty.call(EMP1_TASK_SHELL_TASK_SURFACES, stepId)) {
      selectEmp1TaskShellTask(selectionHost, shell, stepId);
    }
  });
  shell.addEventListener?.('lafea-document-table-presentation-refresh', () => {
    applyTaskShellState(runtime);
  });
  applyTaskShellState(runtime);

  return Object.freeze({
    schema: EMP1_ANALYTICAL_LAYOUT_SCHEMA,
    splitConsoleSchema: EMP1_SPLIT_CONSOLE_SCHEMA,
    presentSurfaceCount: present.length,
    regions: Object.freeze({ ...regions }),
    lanes,
    inspectorTabs: inspectorTabs.tablist,
    evidenceTabs: evidenceConsole.tablist,
    modeTabs: modeTabs.tablist,
    selectTask: (stepId) => selectEmp1TaskShellTask(selectionHost, shell, stepId),
    selectInspector: (surfaceId) => selectInspectorView(selectionHost, shell, surfaceId),
    selectEvidence: (surfaceId) => selectEvidenceView(selectionHost, shell, surfaceId),
    selectMode: (mode) => selectConsoleMode(selectionHost, shell, mode),
    setEvidenceOpen: (open) => setEvidenceOpen(selectionHost, shell, open),
  });
}

export function emp1AnalyticalLayoutPlacementManifest() {
  return Object.freeze(EMP1_ANALYTICAL_SURFACE_ORDER.map((surfaceId) => Object.freeze({
    surfaceId,
    regionId: EMP1_ANALYTICAL_SURFACE_PLACEMENT[surfaceId],
  })));
}

function createTaskContext(documentRef) {
  const root = documentRef.createElement('div');
  root.className = 'emp1-split-console__task-context';
  root.dataset.role = 'emp1-active-task-context';
  const eyebrow = documentRef.createElement('span');
  eyebrow.className = 'emp1-split-console__task-context-eyebrow';
  eyebrow.textContent = 'Presentation task';
  const title = documentRef.createElement('strong');
  title.dataset.role = 'emp1-active-task-title';
  const note = documentRef.createElement('span');
  note.dataset.role = 'emp1-active-task-note';
  root.append(eyebrow, title, note);
  return { root, title, note };
}

function createInspectorTabs(documentRef, selectionHost, shell, entries) {
  const tablist = documentRef.createElement('div');
  tablist.className = 'emp1-split-console__inspector-tabs';
  tablist.dataset.role = 'emp1-inspector-tabs';
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'EMP.1 engineering inspector');
  const buttons = [];
  entries.forEach(([surfaceId, surface], index) => {
    const button = tabButton(documentRef, INSPECTOR_LABELS[surfaceId] ?? surfaceId, index);
    button.dataset.role = 'emp1-inspector-tab';
    button.dataset.emp1InspectorView = surfaceId;
    button.addEventListener('click', () => selectInspectorView(selectionHost, shell, surfaceId));
    wireArrowTabs(button, buttons, index);
    buttons.push(button);
    tablist.append(button);
    surface.dataset.emp1InspectorView = surfaceId;
    surface.setAttribute('role', 'tabpanel');
    surface.setAttribute('aria-label', INSPECTOR_LABELS[surfaceId] ?? surfaceId);
  });
  return { tablist, buttons };
}

function createEvidenceConsole(documentRef, selectionHost, shell, entries) {
  const toggle = documentRef.createElement('button');
  toggle.type = 'button';
  toggle.className = 'emp1-split-console__evidence-toggle';
  toggle.dataset.role = 'emp1-evidence-console-toggle';
  toggle.textContent = 'Results & evidence';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.addEventListener('click', () => {
    const runtime = TASK_SHELL_RUNTIME.get(shell);
    const open = runtime ? runtime.state.evidenceOpen !== true : false;
    setEvidenceOpen(selectionHost, shell, open);
  });

  const tablist = documentRef.createElement('div');
  tablist.className = 'emp1-task-shell__evidence-tabs';
  tablist.dataset.role = 'emp1-evidence-tabs';
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'EMP.1 results and evidence');
  const buttons = [];
  entries.forEach(([surfaceId, surface], index) => {
    const button = tabButton(documentRef, EVIDENCE_LABELS[surfaceId] ?? surfaceId, index);
    button.dataset.role = 'emp1-evidence-tab';
    button.dataset.emp1EvidenceView = surfaceId;
    button.addEventListener('click', () => {
      selectEvidenceView(selectionHost, shell, surfaceId);
      setEvidenceOpen(selectionHost, shell, true);
    });
    wireArrowTabs(button, buttons, index);
    buttons.push(button);
    tablist.append(button);
    surface.dataset.emp1EvidenceView = surfaceId;
    surface.setAttribute('role', 'tabpanel');
    surface.setAttribute('aria-label', EVIDENCE_LABELS[surfaceId] ?? surfaceId);
  });
  return { toggle, tablist, buttons };
}

function createConsoleModeTabs(documentRef, selectionHost, shell) {
  const tablist = documentRef.createElement('div');
  tablist.className = 'emp1-split-console__mode-tabs';
  tablist.dataset.role = 'emp1-console-mode-tabs';
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'EMP.1 console view');
  const labels = { WORK: 'Work', BASIS: 'Basis', EVIDENCE: 'Evidence' };
  const buttons = [];
  EMP1_SPLIT_CONSOLE_MODES.forEach((mode, index) => {
    const button = tabButton(documentRef, labels[mode], index);
    button.dataset.role = 'emp1-console-mode-tab';
    button.dataset.emp1ConsoleMode = mode;
    button.addEventListener('click', () => selectConsoleMode(selectionHost, shell, mode));
    wireArrowTabs(button, buttons, index);
    buttons.push(button);
    tablist.append(button);
  });
  return { tablist, buttons };
}

function tabButton(documentRef, label, index) {
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.setAttribute('role', 'tab');
  button.setAttribute('aria-selected', 'false');
  button.tabIndex = index === 0 ? 0 : -1;
  return button;
}

function wireArrowTabs(button, buttons, index) {
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const next = (index + direction + buttons.length) % buttons.length;
    buttons[next]?.focus?.();
    buttons[next]?.click?.();
  });
}

function selectInspectorView(selectionHost, shell, surfaceId) {
  const runtime = TASK_SHELL_RUNTIME.get(shell);
  if (!runtime) return false;
  if (!allowedInspectorSurfaces(runtime.state.activeTaskStep).includes(surfaceId)) return false;
  if (!runtime.inspectorEntries.some(([candidate]) => candidate === surfaceId)) return false;
  const state = mutableSelection(selectionHost, runtime.state.activeTaskStep);
  state.inspectorView = surfaceId;
  collapseInspectorDetails(runtime);
  applyInspectorSelection(runtime);
  return true;
}

function selectEvidenceView(selectionHost, shell, surfaceId) {
  const runtime = TASK_SHELL_RUNTIME.get(shell);
  if (!runtime) return false;
  if (!runtime.evidenceEntries.some(([candidate]) => candidate === surfaceId)) return false;
  const state = mutableSelection(selectionHost, runtime.state.activeTaskStep);
  state.evidenceView = surfaceId;
  applyEvidenceSelection(runtime);
  return true;
}

function selectConsoleMode(selectionHost, shell, mode) {
  assertConsoleMode(mode);
  const runtime = TASK_SHELL_RUNTIME.get(shell);
  if (!runtime) return false;
  const state = mutableSelection(selectionHost, runtime.state.activeTaskStep);
  state.consoleMode = mode;
  if (mode === 'EVIDENCE') state.evidenceOpen = true;
  applyConsoleMode(runtime);
  applyEvidenceOpen(runtime);
  return true;
}

function setEvidenceOpen(selectionHost, shell, open) {
  const runtime = TASK_SHELL_RUNTIME.get(shell);
  if (!runtime) return false;
  const state = mutableSelection(selectionHost, runtime.state.activeTaskStep);
  state.evidenceOpen = open === true;
  applyEvidenceOpen(runtime);
  return true;
}

function applyTaskShellState(runtime) {
  const state = runtime.state;
  const visibleTaskSurfaces = new Set(EMP1_TASK_SHELL_TASK_SURFACES[state.activeTaskStep] ?? []);
  const primary = runtime.regions[EMP1_ANALYTICAL_LAYOUT_REGIONS.PRIMARY_WORK];
  primary.dataset.emp1ActiveTask = state.activeTaskStep;
  runtime.shell.dataset.emp1ProfessionalTask = state.activeTaskStep;
  runtime.taskContext.title.textContent = `${TASK_ORDINALS[state.activeTaskStep]} · ${TASK_LABELS[state.activeTaskStep]}`;
  runtime.taskContext.note.textContent = state.activeTaskStep === 'REVIEW_EVIDENCE'
    ? 'Review and retained evidence workspace'
    : 'Backing calculation stage is supporting context, not the presentation task.';
  runtime.taskEntries.forEach(([surfaceId, surface]) => {
    const visible = visibleTaskSurfaces.has(surfaceId);
    surface.hidden = !visible;
    surface.dataset.emp1TaskActive = String(visible);
  });
  applyWorkflowStepSelection(runtime);
  applyTaskInputGroupSelection(runtime);
  applyInspectorSelection(runtime);
  applyEvidenceSelection(runtime);
  applyEvidenceOpen(runtime);
  applyConsoleMode(runtime);
}

function applyWorkflowStepSelection(runtime) {
  const buttons = typeof runtime.shell.querySelectorAll === 'function'
    ? runtime.shell.querySelectorAll('[data-role="emp1-professional-step"]')
    : [];
  for (const button of buttons) {
    if (button.dataset.emp1ProfessionalStep === runtime.state.activeTaskStep) {
      button.setAttribute?.('aria-current', 'step');
    } else {
      button.removeAttribute?.('aria-current');
    }
  }
}

function applyTaskInputGroupSelection(runtime) {
  const allowed = new Set(EMP1_TASK_SHELL_INPUT_GROUPS[runtime.state.activeTaskStep] ?? []);
  const groups = typeof runtime.shell.querySelectorAll === 'function'
    ? runtime.shell.querySelectorAll('.lafea-doc-table-section[data-input-group]')
    : [];
  let visibleCount = 0;
  for (const group of groups) {
    const visible = allowed.has(group.dataset.inputGroup);
    group.hidden = !visible;
    group.dataset.emp1TaskInputActive = String(visible);
    if (visible) visibleCount += 1;
  }
  const source = runtime.taskEntries.find(([surfaceId]) => surfaceId === 'source')?.[1] ?? null;
  if (source) {
    source.dataset.emp1TaskInputGroupCount = String(visibleCount);
    source.dataset.emp1TaskInputStep = runtime.state.activeTaskStep;
  }
}

function applyInspectorSelection(runtime) {
  const allowed = allowedInspectorSurfaces(runtime.state.activeTaskStep);
  const available = runtime.inspectorEntries
    .map(([surfaceId]) => surfaceId)
    .filter((surfaceId) => allowed.includes(surfaceId));
  if (!available.length) return;
  const preferred = TASK_DEFAULT_INSPECTOR[runtime.state.activeTaskStep];
  const selected = available.includes(runtime.state.inspectorView)
    ? runtime.state.inspectorView
    : available.includes(preferred) ? preferred : available[0];
  runtime.state.inspectorView = selected;
  const region = runtime.regions[EMP1_ANALYTICAL_LAYOUT_REGIONS.ENGINEERING_BASIS];
  region.dataset.emp1InspectorView = selected;
  region.dataset.emp1InspectorTask = runtime.state.activeTaskStep;
  region.setAttribute('aria-label', `${TASK_LABELS[runtime.state.activeTaskStep]} engineering inspector`);
  runtime.inspectorEntries.forEach(([surfaceId, surface]) => {
    const visible = surfaceId === selected && allowed.includes(surfaceId);
    surface.hidden = !visible;
    surface.dataset.emp1InspectorActive = String(visible);
  });
  runtime.inspectorTabs.forEach((button) => {
    const allowedButton = allowed.includes(button.dataset.emp1InspectorView);
    const selectedButton = allowedButton && button.dataset.emp1InspectorView === selected;
    button.hidden = !allowedButton;
    button.setAttribute('aria-selected', String(selectedButton));
    button.tabIndex = selectedButton ? 0 : -1;
  });
}

function applyEvidenceSelection(runtime) {
  const available = runtime.evidenceEntries.map(([surfaceId]) => surfaceId);
  if (!available.length) return;
  const selected = available.includes(runtime.state.evidenceView)
    ? runtime.state.evidenceView
    : available.includes('results') ? 'results' : available[0];
  runtime.state.evidenceView = selected;
  const region = runtime.regions[EMP1_ANALYTICAL_LAYOUT_REGIONS.FULL_WIDTH_DETAIL];
  region.dataset.emp1EvidenceView = selected;
  runtime.evidenceEntries.forEach(([surfaceId, surface]) => {
    const visible = surfaceId === selected;
    surface.hidden = !visible;
    surface.dataset.emp1EvidenceActive = String(visible);
  });
  runtime.evidenceTabs.forEach((button) => {
    const selectedButton = button.dataset.emp1EvidenceView === selected;
    button.setAttribute('aria-selected', String(selectedButton));
    button.tabIndex = selectedButton ? 0 : -1;
  });
}

function applyEvidenceOpen(runtime) {
  const open = runtime.state.evidenceOpen === true;
  const region = runtime.regions[EMP1_ANALYTICAL_LAYOUT_REGIONS.FULL_WIDTH_DETAIL];
  region.dataset.emp1EvidenceOpen = String(open);
  runtime.evidenceToggle.setAttribute('aria-expanded', String(open));
  runtime.evidenceToggle.textContent = open ? 'Results & evidence · collapse' : 'Results & evidence';
}

function applyConsoleMode(runtime) {
  const mode = EMP1_SPLIT_CONSOLE_MODES.includes(runtime.state.consoleMode)
    ? runtime.state.consoleMode : 'WORK';
  runtime.state.consoleMode = mode;
  runtime.shell.dataset.emp1ConsoleMode = mode;
  runtime.modeTabs.forEach((button) => {
    const selected = button.dataset.emp1ConsoleMode === mode;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
}

/**
 * Backing A/B may choose the initial presentation task only before a user makes
 * an explicit professional-workflow selection. Subsequent rerenders must not let
 * backing-calculator state replace the selected presentation task.
 */
function reconcileSelectionWithBackingStage(state, backingStep) {
  if (state.taskSelectionExplicit === true) return;
  if (backingStep === 'B'
    && ['BASIS_SOURCE', 'LOADS', 'LOAD_TRANSFER'].includes(state.activeTaskStep)) {
    state.activeTaskStep = 'SECTION_SCREENING';
    state.inspectorView = TASK_DEFAULT_INSPECTOR.SECTION_SCREENING;
    state.evidenceView = TASK_DEFAULT_EVIDENCE.SECTION_SCREENING;
    state.consoleMode = 'WORK';
    state.evidenceOpen = false;
    return;
  }
  if (backingStep === 'A' && state.activeTaskStep === 'SECTION_SCREENING') {
    state.activeTaskStep = 'BASIS_SOURCE';
    state.inspectorView = TASK_DEFAULT_INSPECTOR.BASIS_SOURCE;
    state.evidenceView = TASK_DEFAULT_EVIDENCE.BASIS_SOURCE;
    state.consoleMode = 'WORK';
    state.evidenceOpen = false;
  }
}

function mutableSelection(selectionHost, initialTaskStep) {
  if (!selectionHost || typeof selectionHost !== 'object') {
    throw new TypeError('EMP1_TASK_SHELL_SELECTION_HOST_REQUIRED');
  }
  assertTaskStep(initialTaskStep);
  let state = TASK_SHELL_SELECTION.get(selectionHost);
  if (!state) {
    state = {
      activeTaskStep: initialTaskStep,
      taskSelectionExplicit: false,
      inspectorView: TASK_DEFAULT_INSPECTOR[initialTaskStep],
      evidenceView: TASK_DEFAULT_EVIDENCE[initialTaskStep],
      consoleMode: 'WORK',
      evidenceOpen: false,
    };
    TASK_SHELL_SELECTION.set(selectionHost, state);
  }
  return state;
}

function allowedInspectorSurfaces(stepId) {
  return TASK_INSPECTOR_SURFACES[stepId] ?? [];
}

function collapseTransientDetails(runtime) {
  const selectors = [
    '[data-role="emp1-workflow-details"]',
    '[data-role="emp1-technical-backing-steps"]',
    '[data-role="emp1-c-route-detail"]',
    '[data-role="emp1-c-route-limitations"]',
    '[data-role="emp1-c-gamma-domain-detail"]',
  ];
  for (const selector of selectors) {
    const values = typeof runtime.shell.querySelectorAll === 'function'
      ? runtime.shell.querySelectorAll(selector) : [];
    for (const details of values) details.open = false;
  }
}

function collapseInspectorDetails(runtime) {
  const region = runtime.regions[EMP1_ANALYTICAL_LAYOUT_REGIONS.ENGINEERING_BASIS];
  const values = typeof region?.querySelectorAll === 'function' ? region.querySelectorAll('details') : [];
  for (const details of values) details.open = false;
}

function normalizePresentationSurface(surfaceId, surface) {
  if (surfaceId === 'route') {
    const title = typeof surface.querySelector === 'function' ? surface.querySelector(':scope > h2') : null;
    if (title?.textContent === 'Active EMP.1 step') title.textContent = 'Backing calculation stage';
  }
  if (surfaceId === 'workflow') compactWorkflowStepLabels(surface);
}

function compactWorkflowStepLabels(workflow) {
  const buttons = typeof workflow.querySelectorAll === 'function'
    ? workflow.querySelectorAll('[data-role="emp1-professional-step"]') : [];
  for (const button of buttons) {
    const stepId = button.dataset.emp1ProfessionalStep;
    if (!Object.prototype.hasOwnProperty.call(TASK_LABELS, stepId)) continue;
    const fullLabel = button.textContent;
    button.dataset.emp1WorkflowFullLabel = fullLabel;
    button.setAttribute('aria-label', fullLabel);
    button.setAttribute('title', fullLabel);
    button.textContent = `${TASK_ORDINALS[stepId]} ${TASK_LABELS[stepId]}`;
  }
}

function assertTaskStep(stepId) {
  if (!Object.prototype.hasOwnProperty.call(EMP1_TASK_SHELL_TASK_SURFACES, stepId)) {
    throw new TypeError(`EMP1_TASK_SHELL_STEP_UNSUPPORTED:${stepId}`);
  }
}

function assertConsoleMode(mode) {
  if (!EMP1_SPLIT_CONSOLE_MODES.includes(mode)) {
    throw new TypeError(`EMP1_SPLIT_CONSOLE_MODE_UNSUPPORTED:${mode}`);
  }
}

function createRegion(documentRef, regionId, definition) {
  const section = documentRef.createElement('section');
  section.className = 'emp1-analytical-layout__region';
  section.dataset.role = definition.role;
  section.dataset.emp1LayoutRegion = regionId;
  section.dataset.emp1TaskShellRegion = regionId;
  section.setAttribute('aria-label', definition.label);
  return section;
}

function exactSurfaceKeys(surfaces) {
  if (!surfaces || typeof surfaces !== 'object' || Array.isArray(surfaces)) {
    throw new TypeError('EMP1_ANALYTICAL_LAYOUT_SURFACES_REQUIRED');
  }
  const expected = [...EMP1_ANALYTICAL_SURFACE_ORDER].sort();
  const actual = Object.keys(surfaces).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new TypeError('EMP1_ANALYTICAL_LAYOUT_SURFACE_KEYS_MISMATCH');
  }
}

function nodeLike(value) {
  return Boolean(value)
    && typeof value === 'object'
    && Number.isInteger(value.nodeType)
    && typeof value.append === 'function';
}
