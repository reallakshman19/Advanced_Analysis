import { expect, test } from '@playwright/test';

/**
 * Geometry outside the qualified WRC domain must reach a truthful terminal
 * state. The bounded route refuses correctly in the core; the product must stop
 * offering a run that always returns BLOCKED, stop calling the method available,
 * and name the bound that was missed in engineering language.
 */
const HOST_URL = '/e2e/fixtures/lafea-guided-workbench.html';
const CONTROLLER_URL = '/src/workspace/lafea-workbench-controller.js';

test.afterEach(async ({ page }) => page.evaluate(() => {
  globalThis.__EMP1_DOMAIN__?.controller?.destroy?.();
  delete globalThis.__EMP1_DOMAIN__;
}).catch(() => {}));

test('geometry outside the qualified gamma row is refused, named and terminal', async ({ page }) => {
  await page.goto(HOST_URL);
  await page.evaluate(async ({ controllerUrl }) => {
    const { LafeaWorkbenchController } = await import(controllerUrl);
    const root = document.querySelector('#lafea-guided-browser-host');
    const controller = new LafeaWorkbenchController(root, { analyticalOnly: true });
    controller.init();
    globalThis.__EMP1_DOMAIN__ = { controller };
  }, { controllerUrl: CONTROLLER_URL });

  const workbench = page.locator('[data-role="lafea-workbench"]');
  const primary = workbench.locator('[data-emp1-primary-action="true"]');
  await primary.click();
  await expect(primary).toHaveText('Review assessment');

  // A real vessel diameter puts gamma far outside the tabulated gamma = 5 row.
  await workbench.locator('[data-role="emp1-professional-step"]').nth(1).click();
  const outsideDiameter = workbench
    .locator('.lafea-doc-table-section[data-input-group="PIPE_GEOMETRY"] input').first();
  await outsideDiameter.fill('1844');
  await outsideDiameter.press('Tab');
  await workbench
    .locator('[data-role="lafea-apply-group"][data-input-group="PIPE_GEOMETRY"]').first().click();
  await workbench.locator('[data-role="lafea-1-pressure-radius-refit"]').click();

  await primary.click(); // load transfer
  await primary.click(); // section check
  await primary.click(); // local check, refused

  // Terminal, not a loop: the offered action stops asking for a run.
  await expect(primary).toHaveText('Review assessment');
  await expect(workbench.locator('[data-role="emp1-product-currentness"]'))
    .toContainText('BLOCKED · ROUTE LIMIT');
  await expect(workbench.locator('[data-role="emp1-run-c"]').first()).toBeDisabled();

  // The refusal names the bound in engineering language, not an internal code.
  const blockers = workbench.locator('[data-role="emp1-readiness-blockers"]');
  await expect(blockers).toContainText('γ');
  await expect(blockers).toContainText('tabulated γ = 5 row');
  await expect(blockers).not.toContainText('EMP1_WRC537_BOUNDED');

  // The method must not still be described as available for this model.
  await expect(workbench.locator('[data-role="emp1-readiness-dimensions"]'))
    .not.toContainText('Available for the bounded method range');
});
