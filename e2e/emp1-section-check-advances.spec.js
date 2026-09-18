import { expect, test } from '@playwright/test';

/**
 * After a governed input edit the assessment must be able to return to current.
 *
 * EMP.1.B keeps A-derived source evidence, so an edit that supersedes the A
 * result leaves B bound to evidence that can never satisfy a section check.
 * Running the section check must rebind B to the current qualified A first,
 * otherwise the retained result stays stale for good.
 */
const HOST_URL = '/e2e/fixtures/lafea-guided-workbench.html';
const CONTROLLER_URL = '/src/workspace/lafea-workbench-controller.js';

test.afterEach(async ({ page }) => page.evaluate(() => {
  globalThis.__EMP1_SECTION__?.controller?.destroy?.();
  delete globalThis.__EMP1_SECTION__;
}).catch(() => {}));

async function mount(page) {
  await page.goto(HOST_URL);
  await page.evaluate(async ({ controllerUrl }) => {
    const { LafeaWorkbenchController } = await import(controllerUrl);
    const root = document.querySelector('#lafea-guided-browser-host');
    const controller = new LafeaWorkbenchController(root, { analyticalOnly: true });
    controller.init();
    globalThis.__EMP1_SECTION__ = { controller };
  }, { controllerUrl: CONTROLLER_URL });
}

test('a load edit can be recalculated back to a current assessment', async ({ page }) => {
  await mount(page);
  const workbench = page.locator('[data-role="lafea-workbench"]');
  const primary = workbench.locator('[data-emp1-primary-action="true"]');
  await primary.click();
  await expect(primary).toHaveText('Review assessment');

  // Edit one load component and commit it.
  await workbench.locator('[data-role="emp1-professional-step"]').nth(2).click();
  const force = workbench
    .locator('.lafea-doc-table-section[data-input-group="LOAD_CASES"] input').first();
  await force.fill('-450');
  await force.press('Tab');
  await workbench
    .locator('[data-role="lafea-apply-group"][data-input-group="LOAD_CASES"]').first().click();
  await expect(workbench.locator('[data-role="emp1-product-currentness"]'))
    .toContainText('STALE');

  // Following the offered action must reach a current assessment again.
  await expect(primary).toHaveText('Run load transfer');
  await primary.click();
  await expect(primary).toHaveText('Run section check');
  await primary.click();
  await expect(primary).toHaveText('Recalculate local check');
  await primary.click();
  await expect(primary).toHaveText('Review assessment');

  await expect(workbench.locator('[data-role="emp1-product-currentness"]'))
    .toContainText('CALCULATED · CURRENT');
});

test('running the section check rebinds B to the current qualified A', async ({ page }) => {
  await mount(page);
  const workbench = page.locator('[data-role="lafea-workbench"]');
  const primary = workbench.locator('[data-emp1-primary-action="true"]');
  await primary.click();
  await expect(primary).toHaveText('Review assessment');

  await workbench.locator('[data-role="emp1-professional-step"]').nth(2).click();
  const force = workbench
    .locator('.lafea-doc-table-section[data-input-group="LOAD_CASES"] input').first();
  await force.fill('-475');
  await force.press('Tab');
  await workbench
    .locator('[data-role="lafea-apply-group"][data-input-group="LOAD_CASES"]').first().click();

  await primary.click(); // load transfer
  await expect(primary).toHaveText('Run section check');

  // The custody card is rendered by the LAFEA.2-backed step.
  await workbench.locator('[data-role="emp1-professional-step"]').nth(4).click();
  const custody = workbench.locator('[data-role="emp1-b-source-currentness"]');
  await expect(custody).toHaveAttribute('data-state', 'STALE_A_EVIDENCE_REFRESH_AVAILABLE');

  await primary.click(); // section check rebinds B, then runs
  await expect(custody).toHaveAttribute('data-state', 'CURRENT_A_EVIDENCE');
});
