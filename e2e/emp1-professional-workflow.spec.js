import { expect, test } from '@playwright/test';

const HOST_URL = '/e2e/fixtures/lafea-guided-workbench.html';
const CONTROLLER_URL = '/src/workspace/lafea-workbench-controller.js';
const STEP_LABELS = [
  'Start',
  'Geometry',
  'Loads',
  'Load transfer',
  'Section check',
  'Local check',
  'Review & export',
];

const destroyWorkbench = async (page) => page.evaluate(() => {
  globalThis.__EMP1_WRC_WORKFLOW_BROWSER__?.controller?.destroy?.();
  delete globalThis.__EMP1_WRC_WORKFLOW_BROWSER__;
}).catch(() => {});

test.afterEach(async ({ page }) => destroyWorkbench(page));

test('EMP.1 starts with seven user steps, one primary action and technical detail collapsed', async ({ page }) => {
  await mountEmp1Workbench(page);
  const workbench = page.locator('[data-role="lafea-workbench"]');
  const workflow = workbench.locator('[data-role="emp1-workflow"]');
  const steps = workflow.locator('[data-role="emp1-professional-step"]');

  await expect(workflow).toBeVisible();
  await expect(steps).toHaveCount(7);
  for (const [index, label] of STEP_LABELS.entries()) {
    await expect(steps.nth(index)).toHaveText(`${index + 1} ${label}`);
    await expect(steps.nth(index)).toBeEnabled();
    await expect(steps.nth(index)).toHaveAttribute('aria-label', new RegExp(`^${index + 1} ${escapeRegex(label)}\\. `, 'u'));
  }

  const outcome = workflow.locator('[data-role="emp1-assessment-outcome"]');
  await expect(outcome).toBeVisible();
  await expect(outcome).toContainText('Not ready');
  await expect(outcome).toContainText('run the complete example or import assessment data to begin');
  await expect(outcome).toContainText('Use · Not approved for final use');

  const primary = workbench.locator('[data-emp1-primary-action="true"]');
  await expect(primary).toHaveCount(1);
  await expect(primary).toBeVisible();
  await expect(primary).toHaveText('Run complete example');
  await expect(primary).toHaveAttribute('data-toolbar-primary', 'true');
  await expect(workbench.locator('[data-role="emp1-primary-action-help"]'))
    .toContainText('run the required assessment stages in order');

  await expect(workbench.locator('[data-role="emp1-more-actions"]')).not.toHaveAttribute('open', '');
  await expect(workbench.locator('[data-role="emp1-header-technical-details"]')).not.toHaveAttribute('open', '');
  await expect(workflow.locator('[data-role="emp1-workflow-details"]')).not.toHaveAttribute('open', '');
  await expect(workbench.locator('[data-role="emp1-c-result-evidence"]')).toHaveCount(0);
});

test('complete example ends at a review action without implying final-use approval', async ({ page }) => {
  await mountEmp1Workbench(page);
  const workbench = page.locator('[data-role="lafea-workbench"]');
  await workbench.locator('[data-emp1-primary-action="true"]').click();

  await expect.poll(async () => (await sampleState(page)).aExecutionStatus).toBe('QUALIFIED');
  await expect.poll(async () => (await sampleState(page)).bDocumentLoaded).toBe(true);
  await expect(workbench.locator('[data-emp1-primary-action="true"]')).toHaveText('Review assessment');
  await expect(workbench.locator('[data-role="emp1-header-status"]')).toContainText(/Calculated/u);
  await expect(workbench.locator('[data-role="emp1-assessment-outcome"]'))
    .toContainText('Not approved for final use');

  const workflow = workbench.locator('[data-role="emp1-workflow"]');
  await workflow.getByRole('button', { name: /^6 Local check\./u }).click();
  await openEvidenceConsole(workbench);
  const cEvidence = workbench.locator('[data-role="emp1-c-result-evidence"]');
  if (await cEvidence.count()) {
    await expect(cEvidence).toBeVisible();
    const governing = workbench.locator('[data-role="emp1-c-eight-point-governing"]');
    await expect(governing).toContainText('Professional WRC result scope');
    await expect(governing).toContainText('Code compliance');
  }

  const cRun = workbench.locator('[data-role="emp1-run-c"]');
  await expect(cRun).toContainText(/local check/u);
});

test('seven-step navigation uses task language and review leads with assessment result', async ({ page }) => {
  await mountEmp1Workbench(page);
  const workbench = page.locator('[data-role="lafea-workbench"]');
  await workbench.locator('[data-emp1-primary-action="true"]').click();
  await expect(workbench.locator('[data-emp1-primary-action="true"]')).toHaveText('Review assessment');

  let analytical = workbench.locator('[data-role="lafea-analytical-calc"]');
  let workflow = workbench.locator('[data-role="emp1-workflow"]');

  await workflow.getByRole('button', { name: /^4 Load transfer\./u }).click();
  analytical = workbench.locator('[data-role="lafea-analytical-calc"]');
  await expect(analytical).toHaveAttribute('data-backing-stage-id', 'LAFEA.1');
  await expect(analytical.locator('[data-role="emp1-active-task-title"]')).toHaveText('4 · Load transfer');

  workflow = workbench.locator('[data-role="emp1-workflow"]');
  await workflow.getByRole('button', { name: /^5 Section check\./u }).click();
  analytical = workbench.locator('[data-role="lafea-analytical-calc"]');
  await expect(analytical).toHaveAttribute('data-backing-stage-id', 'LAFEA.2');
  await expect(analytical.locator('[data-role="emp1-active-task-title"]')).toHaveText('5 · Section check');

  workflow = workbench.locator('[data-role="emp1-workflow"]');
  await workflow.getByRole('button', { name: /^6 Local check\./u }).click();
  await expect(workbench.locator('[data-role="emp1-c-run-configuration"]')).toBeInViewport();

  workflow = workbench.locator('[data-role="emp1-workflow"]');
  await workflow.getByRole('button', { name: /^7 Review & export\./u }).click();
  analytical = workbench.locator('[data-role="lafea-analytical-calc"]');
  await expect(analytical).toHaveAttribute('data-emp1-console-mode', 'EVIDENCE');
  await expect(analytical.locator('[data-role="emp1-active-task-title"]')).toHaveText('7 · Review & export');
  await expect(analytical.locator('[data-emp1-layout-surface="transactionSummary"] > h2'))
    .toHaveText('Assessment result');
  await expect(analytical.locator('[data-role="emp1-evidence-tab"][data-emp1-evidence-view="transactionSummary"]'))
    .toHaveText('Assessment result');
});

test('secondary samples state their limitation and replacing an assessment asks first', async ({ page }) => {
  await mountEmp1Workbench(page);
  const workbench = page.locator('[data-role="lafea-workbench"]');
  await workbench.locator('[data-emp1-primary-action="true"]').click();
  await expect(workbench.locator('[data-emp1-primary-action="true"]')).toHaveText('Review assessment');

  const workflow = workbench.locator('[data-role="emp1-workflow"]');
  await workflow.getByRole('button', { name: /^5 Section check\./u }).click();
  const more = workbench.locator('[data-role="emp1-more-actions"]');
  await more.locator(':scope > summary').click();
  await expect(more.locator('[data-role="lafea-mock"]'))
    .toHaveText('Load B-only test data (requires current load transfer)');

  const replacement = more.locator('[data-role="emp1-load-complete-qualification-sample"]');
  let prompt = '';
  page.once('dialog', async (dialog) => {
    prompt = dialog.message();
    await dialog.dismiss();
  });
  await replacement.click();
  await expect.poll(() => prompt).toContain('Replace the current EMP.1 assessment?');
  await expect(workbench.locator('[data-emp1-primary-action="true"]')).toHaveText('Review assessment');
});

async function openEvidenceConsole(workbench) {
  const analytical = workbench.locator('[data-role="lafea-analytical-calc"]');
  const toggle = analytical.locator('[data-role="emp1-evidence-console-toggle"]');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

async function sampleState(page) {
  return page.evaluate(() => {
    const controller = globalThis.__EMP1_WRC_WORKFLOW_BROWSER__.controller;
    const state = controller.getState();
    return {
      aExecutionStatus: state.stages?.['LAFEA.1']?.execution?.status ?? null,
      bDocumentLoaded: Boolean(state.stages?.['LAFEA.2']?.document),
    };
  });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

async function mountEmp1Workbench(page) {
  await page.goto(HOST_URL);
  return page.evaluate(async ({ controllerUrl }) => {
    const { LafeaWorkbenchController } = await import(controllerUrl);
    const root = document.querySelector('#lafea-guided-browser-host');
    const controller = new LafeaWorkbenchController(root, { analyticalOnly: true });
    controller.init();
    globalThis.__EMP1_WRC_WORKFLOW_BROWSER__ = { controller };
    const state = controller.getState();
    return { stageId: state.activeStageId, status: state.status };
  }, { controllerUrl: CONTROLLER_URL });
}
