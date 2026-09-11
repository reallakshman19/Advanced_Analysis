#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const paths = Object.freeze({
  rawTokens: 'e2e/emp1-human-presentation-tokens.spec.js',
  pressure: 'e2e/lafea-empirical-grouped-edit.spec.js',
  pressureStatic: 'scripts/emp1-governed-vector-table-check.mjs',
  sampleOrchestrationStatic: 'scripts/emp1-qualification-sample-orchestration-check.mjs',
  sampleOrchestration: 'e2e/emp1-qualification-sample-orchestration.spec.js',
  layoutStatic: 'scripts/emp1-analytical-layout-check.mjs',
  layout: 'e2e/emp1-analytical-layout.spec.js',
  coherence: 'e2e/emp1-presentation-coherence.spec.js',
  benchmarkStatic: 'scripts/emp1-benchmark-evidence-ui-check.mjs',
  benchmark: 'e2e/emp1-benchmark-evidence.spec.js',
  carrier: 'scripts/lafea-stage17-browser-run.mjs',
  validationCarrier: 'scripts/emp1-issue1651-executable-validation.mjs',
  browserPreflight: 'scripts/lib/project-local-playwright-browser.mjs',
  manualAudit: 'scripts/emp1-manual-browser-audit.js',
  manualAuditStatic: 'scripts/emp1-manual-browser-audit-check.mjs',
  manualGuide: 'agents/chains/ADV-EMP1-HUMAN-UI-1651/validation/MANUAL-EP-0025.md',
});

const source = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [
  key,
  await readFile(resolve(root, path), 'utf8'),
])));

// TASK-001: task-contextual disclosure must not shrink raw-token coverage. The
// browser spec traverses every selectable Inspector domain for every professional
// task, both route capabilities and every retained evidence view.
for (const required of [
  "'emp1-benchmark-evidence-panel'",
  '[data-emp1-raw-technical="true"]',
  '[data-lafea-raw-json="true"]',
  'machineUnderscore',
  'machineDotted',
  'for (const taskId of TASKS)',
  '[data-role="emp1-inspector-tab"]:visible',
  "[data-role=\"emp1-c-route-capability-tab\"]",
  "[data-role=\"emp1-evidence-tab\"]",
  'scanVisibleLeaks',
]) assert.ok(source.rawTokens.includes(required), `raw-token task-console coverage missing: ${required}`);

// TASK-002: exact Pressure 5 x 2 governed custody remains unchanged.
for (const required of [
  'toHaveCount(5)',
  'toHaveCount(10)',
  'LAFEA.1.pressure.internal',
  'LAFEA.1.pressure.external',
  'P-EXTERNAL',
  'SOURCE-PIPE-MODEL@7#pressure.P-EXTERNAL.internal',
  'SOURCE-PIPE-MODEL@7#pressure.P-EXTERNAL.external',
  'expect(sourceBefore.values[0] - sourceBefore.values[1]).toBe(-1)',
]) assert.ok(source.pressure.includes(required), `Pressure acceptance evidence missing: ${required}`);
assert.ok(source.pressureStatic.includes('PRESSURE'),
  'static governed-table qualification must retain Pressure coverage');

// LEG-011/012: the complete qualification sample must establish A through the
// normal controller/store run path before B/C, and must fail closed before B
// when A cannot become current and qualified. The factory may not inject its own
// private A execution into runtime custody.
for (const required of [
  'PASS_STATIC_QUALIFICATION_SAMPLE_A_THEN_B_THEN_C_CONTRACT',
  'NORMAL_CONTROLLER_STORE_RUN',
  'factoryExecutionInjectionAllowed: false',
  "this.store.selectStage('LAFEA.1')",
  'const ranA = this.run()',
  "EMP1_A_CURRENT_QUALIFIED_RESULT_REQUIRED",
]) assert.ok(source.sampleOrchestrationStatic.includes(required),
  `qualification-sample static sequencing evidence missing: ${required}`);
for (const required of [
  'clean complete sample executes and retains A before B/C',
  'complete sample stops before B/C when A is not current and qualified',
  "aExecutionStatus: 'QUALIFIED'",
  "aQualificationState: 'ACCEPTED'",
  'bDocumentLoaded: false',
  'runInputLoaded: false',
  "failureCode: 'EMP1_A_CURRENT_QUALIFIED_RESULT_REQUIRED'",
]) assert.ok(source.sampleOrchestration.includes(required),
  `qualification-sample browser falsifier missing: ${required}`);

// TASK-003 / recovery #1664 robust revision: presentation selection is the UI
// source of truth; Inspector content is contextual; deep custody is overlay/on-
// demand; evidence remains bounded; narrow modes substitute rather than stack.
for (const required of [
  'emp1-analytical-layout/v2',
  'emp1-split-console/v1',
  'COMPACT_WORKFLOW_NAV',
  'ACTIVE_TASK',
  'BASIS_RAIL',
  'EVIDENCE_WORKSPACE',
  'EMP1_SPLIT_CONSOLE_MODES',
  'EMP1_TASK_SHELL_INSPECTOR_ORDER',
  'EMP1_TASK_SHELL_INPUT_GROUPS',
  'inspectorVisibleMaximum: 1',
  'evidenceSelectedMaximum: 1',
  "['WORK', 'BASIS', 'EVIDENCE']",
  "['PRESSURE', 'LOAD_CASES']",
  "['REFERENCE_POINTS']",
  'BOOTSTRAP_ONLY_AFTER_EXPLICIT_TASK_SELECTION',
  'unrelatedInspectorAuthorityRejected: true',
  'reviewBackingCardHidden: true',
  'EMP1_ANALYTICAL_LAYOUT_SURFACE_DUPLICATE',
  'EMP1_ANALYTICAL_LAYOUT_SURFACE_KEYS_MISMATCH',
]) assert.ok(source.layoutStatic.includes(required), `robust split-console static evidence missing: ${required}`);

for (const required of [
  'data-emp1-split-console',
  'data-emp1-console-mode',
  'assertSingleVisibleInspector',
  'assertSelectedEvidence',
  'assertVisibleInputGroups',
  "['PIPE_GEOMETRY', 'THICKNESS']",
  "['PRESSURE', 'LOAD_CASES']",
  "['REFERENCE_POINTS']",
  "['SCREENING_CASES', 'EVALUATION_LOCATIONS']",
  'emp1-c-route-capability-tab',
  'emp1-c-route-capability-panel',
  'closedEvidenceGrowth',
  'UNSELECTED_HEIGHT_FALSIFIER',
  'analyticalScrollHeight',
  'analyticalClientHeight',
  'data-emp1-console-mode="WORK"',
  'data-emp1-console-mode="BASIS"',
  'data-emp1-console-mode="EVIDENCE"',
  'analyticalScrollWidth',
  'analyticalClientWidth',
]) assert.ok(source.layout.includes(required), `split-console browser falsifier missing: ${required}`);

for (const required of [
  'professional task remains presentation source of truth across backing-stage rerenders',
  "toHaveText('Assessment setup')",
  "toHaveText('1 · Start')",
  "toHaveAttribute('data-backing-stage-id', 'LAFEA.2')",
  "toHaveAttribute('data-emp1-professional-task', 'REVIEW_EVIDENCE')",
  "toHaveAttribute('data-emp1-console-mode', 'EVIDENCE')",
  "toBeHidden()",
  'shellBottom',
  'evidenceToggleBottom',
  'shellScrollHeight',
  'lanesTop',
  "data-emp1-inspector-view=\"boundedCorrelation\"",
  "not.toHaveAttribute('open', '')",
]) assert.ok(source.coherence.includes(required), `screenshot-derived UX falsifier missing: ${required}`);

// TASK-004: benchmark remains authority-safe and is explicitly opened from the
// bounded evidence console before browser assertions execute.
for (const required of [
  "toHaveAttribute('data-emp1-layout-surface', 'benchmarkEvidence')",
  "toHaveAttribute('data-emp1-layout-region', 'EVIDENCE_WORKSPACE')",
  'data-role="emp1-evidence-console-toggle"',
  "toHaveAttribute('aria-expanded', 'false')",
  'data-emp1-evidence-view="benchmarkEvidence"',
  "toHaveCount(2)",
  "toHaveCount(8)",
  "toHaveCount(0)",
  "page.keyboard.press('Enter')",
  "page.keyboard.press('Space')",
  "table.locator('caption')",
  "table.getByRole('columnheader')",
  "table.getByRole('rowheader')",
  'Engineering use not authorized',
  'Reference not available',
]) assert.ok(source.benchmark.includes(required), `benchmark browser evidence missing: ${required}`);
for (const required of [
  '2.0355862430856293',
  '26.786740343133943',
  'engineeringUseAuthorized',
  'REFERENCE_NOT_AVAILABLE',
]) assert.ok(source.benchmarkStatic.includes(required), `benchmark static evidence missing: ${required}`);

// Existing Stage-17 carrier still owns every focused EMP.1 browser family.
for (const path of [
  paths.rawTokens,
  paths.pressure,
  paths.sampleOrchestration,
  paths.layout,
  paths.coherence,
  paths.benchmark,
]) {
  assert.ok(source.carrier.includes(path), `Stage-17 carrier missing ${path}`);
}
assert.ok(source.carrier.includes(paths.sampleOrchestrationStatic),
  `Stage-17 carrier missing ${paths.sampleOrchestrationStatic}`);
for (const required of [
  'inspectProjectLocalChromium',
  'lafea-stage17-browser-preflight/v1',
  'resolvePlaywrightRuntimeEnv',
]) assert.ok(source.carrier.includes(required), `Stage-17 browser preflight contract missing: ${required}`);

// LEG-013: one cross-platform entrypoint must preserve the exact five Node gates,
// focused qualification browser falsifier, Stage-17 and fail-closed browser-env
// distinction. The wrapper coordinates evidence only; it creates no engineering
// authority and does not replace the underlying gate outputs.
for (const required of [
  'emp1-issue1651-executable-validation/v1',
  'inspectProjectLocalChromium',
  paths.sampleOrchestrationStatic,
  paths.layoutStatic,
  paths.manualAuditStatic,
  'scripts/emp1-issue1651-acceptance-check.mjs',
  'scripts/emp1-public-product-check.mjs',
  paths.sampleOrchestration,
  paths.carrier,
  'PASS_EXECUTABLE_EXACT_HEAD_GATE_SEQUENCE',
  'FAIL_EXECUTABLE_GATE_SEQUENCE',
  'humanFactorMayProceed: false',
]) assert.ok(source.validationCarrier.includes(required),
  `LEG-013 executable validation carrier missing: ${required}`);
for (const required of [
  "PLAYWRIGHT_BROWSERS_PATH: '0'",
  'PLAYWRIGHT_LOCAL_CHROMIUM_MISSING',
  'PASS_BROWSER_ENVIRONMENT_PREFLIGHT',
  '$env:PLAYWRIGHT_BROWSERS_PATH = "0"; npx playwright install chromium',
  'PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium',
]) assert.ok(source.browserPreflight.includes(required),
  `LEG-013 project-local browser preflight missing: ${required}`);

// Deterministic human-observed fallback mirrors the robust task-console
// acceptance while explicitly refusing to manufacture automated browser PASS.
for (const required of [
  'emp1-manual-browser-audit/v4',
  'scanAllSplitConsoleViews',
  'for (const taskId of WORKFLOW_TASKS',
  'presentation.rawTokenLeaks.none',
  'pressure.rows.5',
  'pressure.governedCells.10',
  'layout.splitConsole.enabled',
  'layout.taskShell.loadsActive',
  'layout.workflow.details.closed',
  'layout.workflow.selectionMatchesTask',
  'layout.workflow.details.overlayNoGrowth',
  'layout.loads.inputGroups.exact',
  'layout.inspector.loadsContextOnly',
  'layout.inspector.headerContained',
  'layout.evidence.selectedAtMostOne',
  'layout.evidence.collapsedByDefault',
  'layout.evidence.hiddenHeight.zero',
  'layout.unselectedEvidence.heightDelta',
  'layout.outerShell.bounded',
  'layout.outerShell.inViewport',
  'layout.evidence.affordanceInViewport',
  'layout.review.afterBackingB.coherent',
  'layout.narrow.workOnly',
  'layout.narrow.basisOnly',
  'layout.narrow.evidenceOnly',
  'routes.capabilities.2',
  'routes.visiblePanel.1',
  'routes.authorityStates.preserved',
  'routes.inspector.contextual',
  'routes.deepDetails.closedByDefault',
  'Engineering use not authorized',
  'benchmark.caux.rows.8',
  'benchmark.pvElite.rows.0',
  'browserAcceptanceComplete: false',
  'automatedPlaywrightPassCreated: false',
]) assert.ok(source.manualAudit.includes(required), `manual robust-console acceptance mirror missing: ${required}`);
assert.ok(source.manualAuditStatic.includes('PASS_STATIC_SPLIT_CONSOLE_MANUAL_BROWSER_AUDIT_CONTRACT'));
for (const required of [
  'Windows PowerShell',
  'node scripts/emp1-issue1651-executable-validation.mjs',
  'PLAYWRIGHT_LOCAL_CHROMIUM_MISSING',
  'PASS_EXECUTABLE_EXACT_HEAD_GATE_SEQUENCE',
  'PASS_CURRENT_VIEWPORT_DOM_OBSERVATION',
  'Work / Basis / Evidence',
  'Review & Evidence',
  'Do not proceed to human-factor acceptance',
]) assert.ok(source.manualGuide.includes(required), `manual robust-console guide missing: ${required}`);

// Closure remains presentation/test evidence only with no calculation-core or
// workflow-YAML authority mutation.
assert.equal(source.carrier.includes('.github/workflows/'), false);
assert.equal(source.validationCarrier.includes('.github/workflows/'), false);
assert.equal(source.validationCarrier.includes('../src/core/'), false);
assert.equal(source.browserPreflight.includes('../src/core/'), false);
assert.equal(source.manualAudit.includes('../src/core/'), false);

console.log(JSON.stringify({
  schema: 'emp1-issue1651-acceptance-check/v6',
  status: 'PASS_STATIC_ROBUST_SPLIT_CONSOLE_ACCEPTANCE_MANIFEST_EXECUTABLE_BROWSER_GATES_RETAINED',
  issue: 1651,
  recoveryIssue: 1664,
  rawTokenTaskInspectorRouteEvidenceViewsEnumerated: true,
  pressureMatrix: { identities: 5, valueColumns: 2, governedCells: 10 },
  qualificationSample: {
    aExecutedBeforeBAndC: true,
    aCurrentQualifiedRequired: true,
    factoryExecutionInjectionAllowed: false,
    browserFalsifierRetained: true,
  },
  splitConsole: {
    professionalSteps: 7,
    explicitTaskSelectionOwnsPresentation: true,
    backingStageBootstrapOnly: true,
    taskContextualInspector: true,
    visibleInspectorMaximum: 1,
    selectedHeavyEvidenceMaximum: 1,
    outerShellOverflowTolerancePx: 1,
    outerShellMustFitViewport: true,
    workflowDetailOverlayNoGrowth: true,
    hiddenEvidenceHeightDeltaPx: 1,
    desktopSplit: true,
    narrowModes: ['WORK', 'BASIS', 'EVIDENCE'],
    narrowStackingPermitted: false,
    registeredRouteCapabilities: 2,
    visibleRouteCapabilityPanelsMaximum: 1,
    routeDetailsClosedByDefault: true,
  },
  benchmark: {
    cauxRows: 8,
    pvEliteRows: 0,
    keyboardDisclosure: true,
    tableSemantics: true,
    engineeringUseAuthorized: false,
  },
  validationCarrier: {
    path: paths.validationCarrier,
    projectLocalChromiumPreflight: true,
    fiveNodeGatesRetained: true,
    focusedPlaywrightRetained: true,
    stage17Retained: true,
    crossPlatform: true,
  },
  manualEvidencePath: {
    helper: paths.manualAudit,
    guide: paths.manualGuide,
    requiresHumanExecution: true,
  },
  executableBrowserPassCreatedByThisStaticCheck: false,
}, null, 2));