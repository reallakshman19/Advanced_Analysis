import { expect, test } from '@playwright/test';

/**
 * A geometry edit can strand the declared pressure evaluation radii outside the
 * pipe wall. The engineer must be able to repair that in place; Undo alone is
 * not a recovery from their own legitimate input.
 */
const HOST_URL = '/e2e/fixtures/lafea-guided-workbench.html';
const CONTROLLER_URL = '/src/workspace/lafea-workbench-controller.js';

test.afterEach(async ({ page }) => page.evaluate(() => {
  globalThis.__LAFEA1_RADIUS__?.controller?.destroy?.();
  delete globalThis.__LAFEA1_RADIUS__;
}).catch(() => {}));

test('stranded pressure radii are repairable in place', async ({ page }) => {
  await page.goto(HOST_URL);
  await page.evaluate(async ({ controllerUrl }) => {
    const { LafeaWorkbenchController } = await import(controllerUrl);
    const root = document.querySelector('#lafea-guided-browser-host');
    const controller = new LafeaWorkbenchController(root, { analyticalOnly: true });
    controller.init();
    globalThis.__LAFEA1_RADIUS__ = { controller };
  }, { controllerUrl: CONTROLLER_URL });

  const workbench = page.locator('[data-role="lafea-workbench"]');
  await workbench.locator('[data-emp1-primary-action="true"]').click();
  await expect(workbench.locator('[data-emp1-primary-action="true"]')).toHaveText('Review assessment');

  // The radii are an ordinary governed input group, reachable under Loads.
  await workbench.locator('[data-role="emp1-professional-step"]').nth(2).click();
  const radiusGroup = workbench.locator('.lafea-doc-table-section[data-input-group="PRESSURE_RADII"]');
  await expect(radiusGroup).toBeVisible();
  await expect(radiusGroup.locator('input')).toHaveCount(2);

  // A real vessel diameter strands the demo radii outside the new wall.
  await workbench.locator('[data-role="emp1-professional-step"]').nth(1).click();
  const outsideDiameter = workbench
    .locator('.lafea-doc-table-section[data-input-group="PIPE_GEOMETRY"] input').first();
  await outsideDiameter.fill('1844');
  await outsideDiameter.press('Tab');
  await workbench
    .locator('[data-role="lafea-apply-group"][data-input-group="PIPE_GEOMETRY"]').first().click();

  const recovery = workbench.locator('[data-role="lafea-1-pressure-radius-recovery"]');
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText('outside the current pipe wall');
  await expect(recovery).toContainText('Edit the pressure evaluation radii');
  // Undo must not be the only offered way out.
  await expect(recovery).toContainText('Set radii to current wall');

  await workbench.locator('[data-role="lafea-1-pressure-radius-refit"]').click();
  await expect(recovery).toHaveCount(0);

  // The repair lands on the current bore and outer surface, in order.
  await workbench.locator('[data-role="emp1-professional-step"]').nth(2).click();
  await expect(radiusGroup.locator('input').nth(0)).toHaveValue('902');
  await expect(radiusGroup.locator('input').nth(1)).toHaveValue('922');
});
