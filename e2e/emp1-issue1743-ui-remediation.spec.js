import { expect, test } from '@playwright/test';

const HOST_URL = '/e2e/fixtures/lafea-guided-workbench.html';
const CONTROLLER_URL = '/src/workspace/lafea-workbench-controller.js';

const destroyWorkbench = async (page) => page.evaluate(() => {
  globalThis.__EMP1_ISSUE1743_UI__?.controller?.destroy?.();
  delete globalThis.__EMP1_ISSUE1743_UI__;
}).catch(() => {});

test.afterEach(async ({ page }) => destroyWorkbench(page));

test('Start guidance is explicit and cancelled example replacement is announced', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mountEmp1Workbench(page);

  const workbench = page.locator('[data-role="lafea-workbench"]');
  let analytical = workbench.locator('[data-role="lafea-analytical-calc"]');

  await expect(analytical.locator('[data-role="emp1-active-task-title"]')).toHaveText('1 · Start');
  await expect(analytical.locator('[data-emp1-layout-surface="route"] > h2')).toHaveText('Assessment setup');
  const startGuidance = analytical.locator('[data-role="emp1-start-guidance"]');
  await expect(startGuidance).toBeVisible();
  await expect(startGuidance).toContainText('Use Geometry or Loads to edit engineering inputs');

  await workbench.locator('[data-role="emp1-load-complete-qualification-sample"]').click();
  analytical = workbench.locator('[data-role="lafea-analytical-calc"]');
  await expect(analytical.locator('[data-role="emp1-product-execution-summary"]')).toHaveCount(1);

  const more = workbench.locator('[data-role="emp1-more-actions"]');
  if (await more.getAttribute('open') === null) await more.locator(':scope > summary').click();

  page.once('dialog', async (dialog) => dialog.dismiss());
  await more.locator('[data-role="emp1-load-complete-qualification-sample"]').click();

  const cancelled = workbench.locator('[data-role="emp1-primary-action-status"]');
  await expect(cancelled).toBeVisible();
  await expect(cancelled).toHaveAttribute('role', 'status');
  await expect(cancelled).toHaveAttribute('aria-live', 'polite');
  await expect(cancelled).toHaveText(
    'Example replacement cancelled. Current assessment was not changed.',
  );
  await expect(analytical.locator('[data-role="emp1-product-execution-summary"]')).toHaveCount(1);
});

async function mountEmp1Workbench(page) {
  await page.goto(HOST_URL);
  return page.evaluate(async ({ controllerUrl }) => {
    const { LafeaWorkbenchController } = await import(controllerUrl);
    const root = document.querySelector('#lafea-guided-browser-host');
    const controller = new LafeaWorkbenchController(root, { analyticalOnly: true });
    controller.init();
    globalThis.__EMP1_ISSUE1743_UI__ = { controller };
    const state = controller.getState();
    return { stageId: state.activeStageId, status: state.status };
  }, { controllerUrl: CONTROLLER_URL });
}
