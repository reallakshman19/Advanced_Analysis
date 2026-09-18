import { expect, test } from '@playwright/test';

const HOST_URL = '/e2e/fixtures/lafea-guided-workbench.html';
const CONTROLLER_URL = '/src/workspace/lafea-workbench-controller.js';

const destroyWorkbench = async (page) => page.evaluate(() => {
  globalThis.__EMP1_ANALYTICAL_LAYOUT__?.controller?.destroy?.();
  delete globalThis.__EMP1_ANALYTICAL_LAYOUT__;
}).catch(() => {});

test.afterEach(async ({ page }) => destroyWorkbench(page));

test('EMP.1 split console bounds work, inspector and evidence without responsive stacking', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 1058 });
  await mountEmp1Workbench(page);

  const workbench = page.locator('[data-role="lafea-workbench"]');
  await workbench.locator('[data-role="emp1-load-complete-qualification-sample"]').click();

  let analytical = workbench.locator('[data-role="lafea-analytical-calc"]');
  let workflow = workbench.locator('[data-role="emp1-workflow"]');
  await expect(analytical).toHaveAttribute('data-emp1-task-shell', 'true');
  await expect(analytical).toHaveAttribute('data-emp1-split-console', 'emp1-split-console/v1');
  await expect(analytical).toHaveAttribute('data-emp1-console-mode', 'WORK');
  await expect(workflow.locator('[data-role="emp1-assessment-outcome"]')).toBeVisible();
  await expect(workflow.locator('[data-role="emp1-professional-step"]')).toHaveCount(7);
  await expect(workflow.locator('[data-role="emp1-workflow-details"]')).not.toHaveAttribute('open', '');

  // loadEmp1QualificationSample() awaits runEmp1Product() internally; wait for
  // that async product transaction to actually finish (surfacing the
  // execution summary) before taking a synchronous layout-surface snapshot.
  await expect(analytical.locator('[data-role="emp1-product-execution-summary"]')).toHaveCount(1);

  await assertUniqueLayoutSurfaceManifest(analytical);
  await assertEngineerFacingCardinality(analytical);
  await assertSingleVisibleInspector(analytical, 'engineeringEvidence');
  await assertSelectedEvidence(analytical, 'results');
  await expect(analytical.locator('[data-role="emp1-analytical-full-width-detail"]'))
    .toHaveAttribute('data-emp1-evidence-open', 'false');
  await expect(analytical.locator('[data-emp1-layout-surface="results"]')).toBeHidden();
  await expect(analytical.locator('[data-role="emp1-professional-step"][aria-current="step"]'))
    .toHaveAttribute('data-emp1-professional-step', 'BASIS_SOURCE');
  await expect(analytical.locator('.lafea-doc-table-section[data-input-group]:visible')).toHaveCount(0);

  const desktopGeometry = await regionGeometry(analytical);
  expect(desktopGeometry.primary.width).toBeGreaterThan(0);
  expect(desktopGeometry.basis.width).toBeGreaterThan(0);
  expect(desktopGeometry.primary.right).toBeLessThanOrEqual(desktopGeometry.basis.left + 1);
  expect(Math.abs(desktopGeometry.primary.top - desktopGeometry.basis.top)).toBeLessThanOrEqual(1);
  expect(desktopGeometry.primary.bottom).toBeLessThanOrEqual(desktopGeometry.shell.bottom + 1);
  expect(desktopGeometry.basis.bottom).toBeLessThanOrEqual(desktopGeometry.shell.bottom + 1);
  expect(desktopGeometry.analyticalScrollWidth).toBeLessThanOrEqual(desktopGeometry.analyticalClientWidth + 1);
  expect(desktopGeometry.analyticalScrollHeight).toBeLessThanOrEqual(desktopGeometry.analyticalClientHeight + 1);

  await professionalStep(workflow, 2, 'Geometry').click();
  await expect(analytical).toHaveAttribute('data-emp1-professional-task', 'GEOMETRY');
  await assertVisibleInputGroups(analytical, ['PIPE_GEOMETRY', 'THICKNESS']);
  await assertSingleVisibleInspector(analytical, 'settings');

  await professionalStep(workflow, 3, 'Loads').click();
  await expect(analytical).toHaveAttribute('data-emp1-professional-task', 'LOADS');
  await assertVisibleInputGroups(analytical, ['PRESSURE', 'PRESSURE_RADII', 'LOAD_CASES']);
  await assertSingleVisibleInspector(analytical, 'engineeringEvidence');
  await expect(analytical.locator('[data-role="emp1-c-run-configuration"]')).toBeHidden();

  await professionalStep(workflow, 4, 'Load transfer').click();
  analytical = workbench.locator('[data-role="lafea-analytical-calc"]');
  workflow = workbench.locator('[data-role="emp1-workflow"]');
  await expect(analytical).toHaveAttribute('data-backing-stage-id', 'LAFEA.1');
  await expect(analytical).toHaveAttribute('data-emp1-professional-task', 'LOAD_TRANSFER');
  await assertVisibleInputGroups(analytical, ['REFERENCE_POINTS']);

  await professionalStep(workflow, 5, 'Section check').click();
  analytical = workbench.locator('[data-role="lafea-analytical-calc"]');
  workflow = workbench.locator('[data-role="emp1-workflow"]');
  await expect(analytical).toHaveAttribute('data-backing-stage-id', 'LAFEA.2');
  await expect(analytical).toHaveAttribute('data-emp1-professional-task', 'SECTION_SCREENING');
  await assertVisibleInputGroups(analytical, ['SCREENING_CASES', 'EVALUATION_LOCATIONS']);
  await assertSelectedEvidence(analytical, 'screeningCustody');

  await professionalStep(workflow, 6, 'Local check').click();
  await expect(analytical).toHaveAttribute('data-emp1-professional-task', 'LOCAL_CORRELATION');
  await assertSingleVisibleInspector(analytical, 'boundedCorrelation');
  await assertSelectedEvidence(analytical, 'correlationResult');
  const bounded = analytical.locator('[data-role="emp1-c-bounded-evidence"]');
  await expect(bounded.locator('[data-role="emp1-c-route-capability-tab"]')).toHaveCount(2);
  await expect(bounded.locator('[data-role="emp1-c-route-capability-panel"]:visible')).toHaveCount(1);
  await expect(bounded.locator('[data-role="emp1-c-route-capability-tab"][aria-selected="true"]'))
    .toContainText('Authorized');

  await professionalStep(workflow, 7, 'Review & export').click();
  await expect(analytical).toHaveAttribute('data-emp1-professional-task', 'REVIEW_EVIDENCE');
  await expect(analytical).toHaveAttribute('data-emp1-console-mode', 'EVIDENCE');
  await expect(analytical.locator('[data-role="emp1-analytical-full-width-detail"]'))
    .toHaveAttribute('data-emp1-evidence-open', 'true');
  await assertSelectedEvidence(analytical, 'transactionSummary');
  await expect(analytical.locator('[data-emp1-layout-surface="transactionSummary"]')).toBeVisible();

  const benchmarkTab = analytical.locator('[data-role="emp1-evidence-tab"][data-emp1-evidence-view="benchmarkEvidence"]');
  await benchmarkTab.click();
  await assertSelectedEvidence(analytical, 'benchmarkEvidence');
  await expect(analytical.locator('[data-role="emp1-benchmark-evidence-panel"]')).toBeVisible();
  await expect(analytical.locator('[data-role="emp1-benchmark-evidence-panel"]')).toHaveCount(1);

  const evidenceToggle = analytical.locator('[data-role="emp1-evidence-console-toggle"]');
  await evidenceToggle.click();
  await expect(analytical.locator('[data-role="emp1-analytical-full-width-detail"]'))
    .toHaveAttribute('data-emp1-evidence-open', 'false');
  const closedEvidenceGrowth = await analytical.evaluate((root) => {
    const region = root.querySelector('[data-role="emp1-analytical-full-width-detail"]');
    const beforeDocument = document.documentElement.scrollHeight;
    const beforeShell = root.scrollHeight;
    const sentinel = document.createElement('section');
    sentinel.dataset.emp1LayoutSurface = 'UNSELECTED_HEIGHT_FALSIFIER';
    sentinel.style.height = '5000px';
    region.append(sentinel);
    const afterDocument = document.documentElement.scrollHeight;
    const afterShell = root.scrollHeight;
    sentinel.remove();
    return {
      documentDelta: afterDocument - beforeDocument,
      shellDelta: afterShell - beforeShell,
    };
  });
  expect(Math.abs(closedEvidenceGrowth.documentDelta)).toBeLessThanOrEqual(1);
  expect(Math.abs(closedEvidenceGrowth.shellDelta)).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 720, height: 900 });
  const narrow = workbench.locator('[data-role="lafea-analytical-calc"]');
  await expect(narrow.locator('[data-role="emp1-console-mode-tabs"]')).toBeVisible();

  const workMode = narrow.locator('[data-role="emp1-console-mode-tab"][data-emp1-console-mode="WORK"]');
  const basisMode = narrow.locator('[data-role="emp1-console-mode-tab"][data-emp1-console-mode="BASIS"]');
  const evidenceMode = narrow.locator('[data-role="emp1-console-mode-tab"][data-emp1-console-mode="EVIDENCE"]');

  await workMode.click();
  await expect(narrow).toHaveAttribute('data-emp1-console-mode', 'WORK');
  await expect(narrow.locator('[data-role="emp1-analytical-primary-work"]')).toBeVisible();
  await expect(narrow.locator('[data-role="emp1-analytical-engineering-basis"]')).toBeHidden();
  await expect(narrow.locator('[data-role="emp1-analytical-full-width-detail"]')).toBeHidden();

  await basisMode.click();
  await expect(narrow).toHaveAttribute('data-emp1-console-mode', 'BASIS');
  await expect(narrow.locator('[data-role="emp1-analytical-primary-work"]')).toBeHidden();
  await expect(narrow.locator('[data-role="emp1-analytical-engineering-basis"]')).toBeVisible();
  await expect(narrow.locator('[data-role="emp1-analytical-full-width-detail"]')).toBeHidden();

  await evidenceMode.click();
  await expect(narrow).toHaveAttribute('data-emp1-console-mode', 'EVIDENCE');
  await expect(narrow.locator('[data-role="emp1-analytical-layout-lanes"]')).toBeHidden();
  await expect(narrow.locator('[data-role="emp1-analytical-full-width-detail"]')).toBeVisible();
  await expect(narrow.locator('[data-role="emp1-evidence-tabs"]')).toBeVisible();
  await expect(narrow.locator('[data-emp1-layout-surface="benchmarkEvidence"]')).toBeVisible();

  const narrowGeometry = await regionGeometry(narrow);
  expect(narrowGeometry.analyticalScrollWidth).toBeLessThanOrEqual(narrowGeometry.analyticalClientWidth + 1);
  expect(narrowGeometry.analyticalScrollHeight).toBeLessThanOrEqual(narrowGeometry.analyticalClientHeight + 1);

  await testInfo.attach('emp1-split-console-layout-geometry', {
    body: Buffer.from(`${JSON.stringify({
      desktopGeometry,
      narrowGeometry,
      closedEvidenceGrowth,
    }, null, 2)}\n`, 'utf8'),
    contentType: 'application/json',
  });
});

async function assertUniqueLayoutSurfaceManifest(analytical) {
  const manifest = await analytical.locator('[data-emp1-layout-surface]').evaluateAll((nodes) => nodes.map((node) => ({
    surfaceId: node.dataset.emp1LayoutSurface,
    regionId: node.dataset.emp1LayoutRegion,
  })));
  const ids = manifest.map((entry) => entry.surfaceId);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toContain('workflow');
  expect(ids).toContain('source');
  expect(ids).toContain('settings');
  expect(ids).toContain('engineeringEvidence');
  expect(ids).toContain('boundedCorrelation');
  expect(ids).toContain('transactionSummary');
  expect(ids).toContain('correlationResult');
  expect(ids).toContain('results');
  expect(ids).toContain('lineage');
  expect(ids).toContain('benchmarkEvidence');
  expect(manifest.find((entry) => entry.surfaceId === 'workflow')?.regionId).toBe('COMPACT_WORKFLOW_NAV');
  expect(manifest.find((entry) => entry.surfaceId === 'source')?.regionId).toBe('ACTIVE_TASK');
  expect(manifest.find((entry) => entry.surfaceId === 'settings')?.regionId).toBe('BASIS_RAIL');
  expect(manifest.find((entry) => entry.surfaceId === 'benchmarkEvidence')?.regionId).toBe('EVIDENCE_WORKSPACE');
}

async function assertEngineerFacingCardinality(analytical) {
  for (const selector of [
    '[data-role="emp1-workflow"]',
    '[data-guided-target="source"]',
    '[data-role="emp1-c-run-configuration"]',
    '[data-role="emp1-product-execution-summary"]',
    '[data-role="emp1-c-result-evidence"]',
    '[data-guided-target="results"]',
    '[data-guided-target="lineage"]',
    '[data-role="emp1-benchmark-evidence-panel"]',
    '[data-role="emp1-console-mode-tabs"]',
    '[data-role="emp1-inspector-tabs"]',
    '[data-role="emp1-evidence-console-toggle"]',
  ]) {
    await expect(analytical.locator(selector)).toHaveCount(1);
  }
  const governedInputs = analytical.locator('[data-role="lafea-governed-input"]');
  expect(await governedInputs.count()).toBeGreaterThan(0);
}

async function assertVisibleInputGroups(analytical, expectedGroups) {
  const groups = await analytical.locator('.lafea-doc-table-section[data-input-group]').evaluateAll((nodes) => nodes
    .filter((node) => !node.hidden && getComputedStyle(node).display !== 'none')
    .map((node) => node.dataset.inputGroup));
  expect(groups).toEqual(expectedGroups);
}

async function assertSingleVisibleInspector(analytical, expectedSurfaceId) {
  const visible = await analytical.locator('[data-emp1-layout-region="BASIS_RAIL"][data-emp1-layout-surface][data-emp1-inspector-view]').evaluateAll((nodes) => nodes
    .filter((node) => !node.hidden && getComputedStyle(node).display !== 'none')
    .map((node) => node.dataset.emp1LayoutSurface));
  expect(visible).toEqual([expectedSurfaceId]);
  await expect(analytical.locator('[data-role="emp1-analytical-engineering-basis"]'))
    .toHaveAttribute('data-emp1-inspector-view', expectedSurfaceId);
}

async function assertSelectedEvidence(analytical, expectedSurfaceId) {
  const selected = await analytical.locator('[data-emp1-layout-region="EVIDENCE_WORKSPACE"][data-emp1-layout-surface][data-emp1-evidence-view]').evaluateAll((nodes) => nodes
    .filter((node) => !node.hidden)
    .map((node) => node.dataset.emp1LayoutSurface));
  expect(selected).toEqual([expectedSurfaceId]);
  await expect(analytical.locator('[data-role="emp1-analytical-full-width-detail"]'))
    .toHaveAttribute('data-emp1-evidence-view', expectedSurfaceId);
}

async function regionGeometry(analytical) {
  return analytical.evaluate((root) => {
    const box = (role) => {
      const node = root.querySelector(`[data-role="${role}"]`);
      if (!node || getComputedStyle(node).display === 'none') return null;
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const shellRect = root.getBoundingClientRect();
    return {
      primary: box('emp1-analytical-primary-work'),
      basis: box('emp1-analytical-engineering-basis'),
      detail: box('emp1-analytical-full-width-detail'),
      lanes: box('emp1-analytical-layout-lanes'),
      shell: {
        left: shellRect.left,
        right: shellRect.right,
        top: shellRect.top,
        bottom: shellRect.bottom,
        width: shellRect.width,
        height: shellRect.height,
      },
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      analyticalScrollWidth: root.scrollWidth,
      analyticalClientWidth: root.clientWidth,
      analyticalScrollHeight: root.scrollHeight,
      analyticalClientHeight: root.clientHeight,
      pageScrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    };
  });
}

function professionalStep(workflow, ordinal, label) {
  return workflow.getByRole('button', { name: new RegExp(`^${ordinal} ${escapeRegExp(label)}`, 'u') });
}

async function mountEmp1Workbench(page) {
  await page.goto(HOST_URL);
  return page.evaluate(async ({ controllerUrl }) => {
    const { LafeaWorkbenchController } = await import(controllerUrl);
    const root = document.querySelector('#lafea-guided-browser-host');
    const controller = new LafeaWorkbenchController(root, { analyticalOnly: true });
    controller.init();
    globalThis.__EMP1_ANALYTICAL_LAYOUT__ = { controller };
    return controller.getState().activeStageId;
  }, { controllerUrl: CONTROLLER_URL });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
