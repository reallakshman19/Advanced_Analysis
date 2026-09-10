import { expect, test } from '@playwright/test';

const HOST_URL = '/e2e/fixtures/lafea-guided-workbench.html';
const CONTROLLER_URL = '/src/workspace/lafea-workbench-controller.js';

const destroyWorkbench = async (page) => page.evaluate(() => {
  globalThis.__EMP1_PRESENTATION_COHERENCE__?.controller?.destroy?.();
  delete globalThis.__EMP1_PRESENTATION_COHERENCE__;
}).catch(() => {});

test.afterEach(async ({ page }) => destroyWorkbench(page));

test('professional task remains presentation source of truth across backing-stage rerenders', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1058 });
  await mountEmp1Workbench(page);

  const workbench = page.locator('[data-role="lafea-workbench"]');
  await workbench.locator('[data-emp1-primary-action="true"]').click();

  let analytical = workbench.locator('[data-role="lafea-analytical-calc"]');
  let workflow = analytical.locator('[data-role="emp1-workflow"]');

  // loadEmp1QualificationSample() awaits runEmp1Product() internally; wait for
  // that async product transaction to actually finish before taking geometry
  // snapshots, so an in-flight re-render doesn't get mistaken for layout
  // shift caused by the disclosure toggle below.
  await expect(analytical.locator('[data-role="emp1-product-execution-summary"]')).toHaveCount(1);

  await expect(analytical.locator('[data-role="emp1-active-task-title"]')).toHaveText('1 · Start');
  await expect(analytical.locator('[data-emp1-layout-surface="route"] > h2')).toHaveText('Assessment setup');

  const compactLabels = await workflow.locator('[data-role="emp1-professional-step"]').allTextContents();
  expect(compactLabels).toEqual([
    '1 Start',
    '2 Geometry',
    '3 Loads',
    '4 Load transfer',
    '5 Section check',
    '6 Local check',
    '7 Review & export',
  ]);
  for (const button of await workflow.locator('[data-role="emp1-professional-step"]').all()) {
    await expect(button).toHaveAttribute('aria-label', /\. /u);
  }

  await expect(analytical.locator('[data-role="emp1-inspector-tab"]:visible')).toHaveCount(2);
  await expect(analytical.locator('[data-role="emp1-inspector-tab"][data-emp1-inspector-view="boundedCorrelation"]'))
    .toBeHidden();
  await expect(analytical.locator('[data-role="emp1-evidence-console-toggle"]')).toBeVisible();
  const defaultViewport = await viewportContainment(analytical);
  expect(defaultViewport.shellBottom).toBeLessThanOrEqual(defaultViewport.viewportHeight + 1);
  expect(defaultViewport.evidenceToggleBottom).toBeLessThanOrEqual(defaultViewport.viewportHeight + 1);

  const workflowDetails = workflow.locator('[data-role="emp1-workflow-details"]');
  const beforeDisclosure = await primaryGeometry(analytical);
  await workflowDetails.locator(':scope > summary').click();
  await expect(workflowDetails).toHaveAttribute('open', '');
  const afterDisclosure = await primaryGeometry(analytical);
  expect(Math.abs(afterDisclosure.shellScrollHeight - beforeDisclosure.shellScrollHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(afterDisclosure.lanesTop - beforeDisclosure.lanesTop)).toBeLessThanOrEqual(1);
  await workflowDetails.locator(':scope > summary').click();

  // Reproduce the screenshot failure path: enter backing B, then select Review.
  await step(workflow, 'SECTION_SCREENING').click();
  analytical = workbench.locator('[data-role="lafea-analytical-calc"]');
  workflow = analytical.locator('[data-role="emp1-workflow"]');
  await expect(analytical).toHaveAttribute('data-backing-stage-id', 'LAFEA.2');
  await expect(analytical).toHaveAttribute('data-emp1-professional-task', 'SECTION_SCREENING');

  await step(workflow, 'REVIEW_EVIDENCE').click();
  analytical = workbench.locator('[data-role="lafea-analytical-calc"]');
  workflow = analytical.locator('[data-role="emp1-workflow"]');
  await expect(analytical).toHaveAttribute('data-backing-stage-id', 'LAFEA.2');
  await expect(analytical).toHaveAttribute('data-emp1-professional-task', 'REVIEW_EVIDENCE');
  await expect(analytical).toHaveAttribute('data-emp1-console-mode', 'EVIDENCE');
  await expect(step(workflow, 'REVIEW_EVIDENCE')).toHaveAttribute('aria-current', 'step');
  await expect(analytical.locator('[data-role="emp1-analytical-layout-lanes"]')).toBeHidden();
  await expect(analytical.locator('[data-emp1-layout-surface="route"]')).toBeHidden();
  await expect(analytical.locator('[data-emp1-layout-surface="source"]')).toBeHidden();
  await expect(analytical.locator('[data-emp1-layout-surface="runConfiguration"]')).toBeHidden();
  await expect(analytical.locator('[data-emp1-layout-surface="transactionSummary"]')).toBeVisible();
  await expect(analytical.locator('[data-emp1-layout-surface="transactionSummary"] > h2')).toHaveText('Assessment result');

  // Local check is the only task whose default inspector may foreground the
  // bounded WRC route authority. Deep authority disclosures remain closed.
  await step(workflow, 'LOCAL_CORRELATION').click();
  analytical = workbench.locator('[data-role="lafea-analytical-calc"]');
  await expect(analytical).toHaveAttribute('data-emp1-professional-task', 'LOCAL_CORRELATION');
  const inspector = analytical.locator('[data-role="emp1-analytical-engineering-basis"]');
  await expect(inspector).toHaveAttribute('data-emp1-inspector-view', 'boundedCorrelation');
  await expect(inspector.locator('[data-role="emp1-inspector-tab"]:visible')).toHaveCount(3);
  await expect(inspector.locator('[data-role="emp1-c-route-detail"]:visible')).not.toHaveAttribute('open', '');
  await expect(inspector.locator('[data-role="emp1-c-route-limitations"]:visible')).not.toHaveAttribute('open', '');
  await expect(inspector.locator('[data-role="emp1-c-gamma-domain-detail"]:visible')).not.toHaveAttribute('open', '');

  const inspectorGeometry = await inspector.evaluate((node) => {
    const tabs = node.querySelector('[data-role="emp1-inspector-tabs"]');
    const nodeRect = node.getBoundingClientRect();
    const tabRect = tabs.getBoundingClientRect();
    return {
      inspectorTop: nodeRect.top,
      inspectorBottom: nodeRect.bottom,
      tabsTop: tabRect.top,
      tabsBottom: tabRect.bottom,
    };
  });
  expect(inspectorGeometry.tabsTop).toBeGreaterThanOrEqual(inspectorGeometry.inspectorTop - 1);
  expect(inspectorGeometry.tabsBottom).toBeLessThanOrEqual(inspectorGeometry.inspectorBottom + 1);

  // Moving back to Loads must remove WRC authority from the task-contextual inspector.
  workflow = analytical.locator('[data-role="emp1-workflow"]');
  await step(workflow, 'LOADS').click();
  analytical = workbench.locator('[data-role="lafea-analytical-calc"]');
  await expect(analytical).toHaveAttribute('data-emp1-professional-task', 'LOADS');
  await expect(analytical.locator('[data-role="emp1-active-task-title"]')).toHaveText('3 · Loads');
  await expect(analytical.locator('[data-role="emp1-inspector-tab"][data-emp1-inspector-view="boundedCorrelation"]'))
    .toBeHidden();
  await expect(analytical.locator('[data-role="emp1-inspector-tab"]:visible')).toHaveCount(1);
});

function step(workflow, stepId) {
  return workflow.locator(
    `[data-role="emp1-professional-step"][data-emp1-professional-step="${stepId}"]`,
  );
}

async function viewportContainment(analytical) {
  return analytical.evaluate((root) => {
    const shell = root.getBoundingClientRect();
    const toggle = root.querySelector('[data-role="emp1-evidence-console-toggle"]')?.getBoundingClientRect();
    return {
      shellBottom: shell.bottom,
      evidenceToggleBottom: toggle?.bottom ?? Number.POSITIVE_INFINITY,
      viewportHeight: window.innerHeight,
    };
  });
}

async function primaryGeometry(analytical) {
  return analytical.evaluate((root) => {
    const lanes = root.querySelector('[data-role="emp1-analytical-layout-lanes"]');
    return {
      shellScrollHeight: root.scrollHeight,
      shellClientHeight: root.clientHeight,
      lanesTop: lanes?.getBoundingClientRect().top ?? null,
    };
  });
}

async function mountEmp1Workbench(page) {
  await page.goto(HOST_URL);
  return page.evaluate(async ({ controllerUrl }) => {
    const { LafeaWorkbenchController } = await import(controllerUrl);
    const root = document.querySelector('#lafea-guided-browser-host');
    const controller = new LafeaWorkbenchController(root, { analyticalOnly: true });
    controller.init();
    globalThis.__EMP1_PRESENTATION_COHERENCE__ = { controller };
    const state = controller.getState();
    return { stageId: state.activeStageId, status: state.status };
  }, { controllerUrl: CONTROLLER_URL });
}
