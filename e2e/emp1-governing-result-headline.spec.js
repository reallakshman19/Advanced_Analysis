import { expect, test } from '@playwright/test';

/**
 * Local check is the step that produces the WRC result, so the governing value
 * belongs beside the run rather than behind a disclosure. It must also vanish
 * the moment it stops holding: a stale or refused run must show no number.
 */
const HOST_URL = '/e2e/fixtures/lafea-guided-workbench.html';
const CONTROLLER_URL = '/src/workspace/lafea-workbench-controller.js';

test.afterEach(async ({ page }) => page.evaluate(() => {
  globalThis.__EMP1_HEADLINE__?.controller?.destroy?.();
  delete globalThis.__EMP1_HEADLINE__;
}).catch(() => {}));

async function mount(page) {
  await page.goto(HOST_URL);
  await page.evaluate(async ({ controllerUrl }) => {
    const { LafeaWorkbenchController } = await import(controllerUrl);
    const root = document.querySelector('#lafea-guided-browser-host');
    const controller = new LafeaWorkbenchController(root, { analyticalOnly: true });
    controller.init();
    globalThis.__EMP1_HEADLINE__ = { controller };
  }, { controllerUrl: CONTROLLER_URL });
}

test('governing result is visible on the local check step without opening anything', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mount(page);
  const workbench = page.locator('[data-role="lafea-workbench"]');
  await workbench.locator('[data-emp1-primary-action="true"]').click();
  await expect(workbench.locator('[data-emp1-primary-action="true"]')).toHaveText('Review assessment');

  await workbench.locator('[data-role="emp1-professional-step"]').nth(5).click();
  const headline = workbench.locator('[data-role="emp1-c-governing-result-headline"]');
  await expect(headline).toBeVisible();
  await expect(headline).toBeInViewport();
  await expect(headline).toContainText(/Au · stress intensity [\d.]+ N\/mm²/u);
  // The eight-point limitation travels with the number.
  await expect(headline).toContainText('not a continuous or global shell maximum');

  // The full table remains available in the evidence console on the same step.
  await expect(workbench.locator('[data-role="emp1-c-eight-point-stress"]')).toBeVisible();
});

test('the governing result disappears once it no longer holds', async ({ page }) => {
  await mount(page);
  const workbench = page.locator('[data-role="lafea-workbench"]');
  await workbench.locator('[data-emp1-primary-action="true"]').click();
  await workbench.locator('[data-role="emp1-professional-step"]').nth(5).click();
  await expect(workbench.locator('[data-role="emp1-c-governing-result-headline"]')).toBeVisible();

  // Edit an upstream load so the retained result becomes stale.
  await workbench.locator('[data-role="emp1-professional-step"]').nth(2).click();
  const force = workbench
    .locator('.lafea-doc-table-section[data-input-group="LOAD_CASES"] input').first();
  await force.fill('-455');
  await force.press('Tab');
  await workbench
    .locator('[data-role="lafea-apply-group"][data-input-group="LOAD_CASES"]').first().click();

  await workbench.locator('[data-role="emp1-professional-step"]').nth(5).click();
  await expect(workbench.locator('[data-role="emp1-c-governing-result-headline"]')).toHaveCount(0);
});
