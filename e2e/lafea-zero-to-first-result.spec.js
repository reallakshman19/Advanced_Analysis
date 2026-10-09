import { expect, test } from '@playwright/test';

const HOST_URL = '/lafea.html';

test.describe('LAFEA zero-to-first-result UX (#1821)', () => {
  test('cold boot on EMP.1 loads qualification sample to qualified result in one action', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(HOST_URL);

    const workbench = page.locator('[data-role="lafea-workbench"]');
    await expect(workbench).toBeVisible();

    const analytical = workbench.locator('[data-role="lafea-analytical-calc"]');
    await expect(analytical).toBeVisible();

    // EMP.1 primary CTA on cold boot is "Run complete example"
    const completeAction = workbench.locator('[data-role="emp1-load-complete-qualification-sample"]');
    await expect(completeAction).toBeVisible();
    await completeAction.click();

    // Verify qualified status reached (EMP.1 analytical presentation uses "Calculated")
    const status = workbench.locator('[data-role="emp1-header-status"]');
    await expect(status).toHaveText('Calculated');
    await expect(status).toHaveAttribute('data-status', 'CALCULATED');

    // Verify release authority remains honest (NOT_QUALIFIED)
    await expect(workbench).toContainText('Release: NOT QUALIFIED');

    // Verify result is displayed
    const workflow = analytical.locator('[data-role="emp1-workflow"]');
    await expect(workflow).toBeVisible();
  });

  test('cold boot on LAFEA.3 loads demo model to qualified result in one action', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(HOST_URL);

    const workbench = page.locator('[data-role="lafea-workbench"]');
    await expect(workbench).toBeVisible();

    // Switch to LAFEA.3
    await workbench.locator('.lafea-workbench__stages [data-stage-id="LAFEA.3"]').click();
    await expect(workbench.locator('h1')).toContainText('LAFEA.3');

    // Initial empty state banner
    const banner = workbench.locator('[data-role="lafea-next-action-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Step 1: Load a model to begin');

    const demoBtn = banner.locator('[data-role="lafea-load-demo"]');
    await expect(demoBtn).toBeVisible();
    await expect(demoBtn).toContainText('Load demonstration model (LAFEA.3)');

    // Click demo model button - one click to first result
    await demoBtn.click();

    // Verify qualified status reached
    await expect(workbench.locator('.lafea-workbench__status')).toHaveText('QUALIFIED');

    // Verify release authority remains honest (NOT_QUALIFIED)
    await expect(workbench).toContainText('Release: NOT QUALIFIED');

    // Verify results highlights are displayed
    const results = workbench.locator('[data-guided-target="results"]');
    await expect(results).toBeVisible();
    const highlights = results.locator('[data-role="lafea-result-highlights"]');
    await expect(highlights).toBeVisible();
    await expect(highlights).toContainText('Max displacement');
    await expect(highlights).toContainText('Max von Mises');
  });

  test('cold boot on LAFEA.4 loads demo model to qualified result in one action', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(HOST_URL);

    const workbench = page.locator('[data-role="lafea-workbench"]');
    await expect(workbench).toBeVisible();

    // Switch to LAFEA.4
    await workbench.locator('.lafea-workbench__stages [data-stage-id="LAFEA.4"]').click();
    await expect(workbench.locator('h1')).toContainText('LAFEA.4');

    const banner = workbench.locator('[data-role="lafea-next-action-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Step 1: Load a model to begin');

    const demoBtn = banner.locator('[data-role="lafea-load-demo"]');
    await expect(demoBtn).toBeVisible();
    await expect(demoBtn).toContainText('Load demonstration model (LAFEA.4)');

    // Click demo model button
    await demoBtn.click();

    // Verify qualified status reached
    await expect(workbench.locator('.lafea-workbench__status')).toHaveText('QUALIFIED');
    await expect(workbench).toContainText('Release: NOT QUALIFIED');

    // Verify results are displayed
    const results = workbench.locator('[data-guided-target="results"]');
    await expect(results).toBeVisible();
    await expect(results.locator('.lafea-workbench__authority')).toContainText(
      'Analysis completed. Retained result evidence is accepted by the current stage result contract.',
    );
    await expect(results.locator('.lafea-workbench__result-plot')).toBeVisible();
  });

  test('cold boot on LAFEA.5 loads demo model to qualified result in one action', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(HOST_URL);

    const workbench = page.locator('[data-role="lafea-workbench"]');
    await expect(workbench).toBeVisible();

    // Switch to LAFEA.5
    await workbench.locator('.lafea-workbench__stages [data-stage-id="LAFEA.5"]').click();
    await expect(workbench.locator('h1')).toContainText('LAFEA.5');

    const banner = workbench.locator('[data-role="lafea-next-action-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Step 1: Load a model to begin');

    const demoBtn = banner.locator('[data-role="lafea-load-demo"]');
    await expect(demoBtn).toBeVisible();
    await expect(demoBtn).toContainText('Load demonstration model (LAFEA.5)');

    // Click demo model button
    await demoBtn.click();

    // Verify qualified status reached
    await expect(workbench.locator('.lafea-workbench__status')).toHaveText('QUALIFIED');
    await expect(workbench).toContainText('Release: NOT QUALIFIED');

    // Verify results are displayed
    const results = workbench.locator('[data-guided-target="results"]');
    await expect(results).toBeVisible();
    await expect(results.locator('.lafea-workbench__authority')).toContainText(
      'Analysis completed. Retained result evidence is accepted by the current stage result contract.',
    );
    await expect(results.locator('[data-role="lafea-result"]')).toBeAttached();
  });

  test('LAFEA.6 displays honest empty state message with no demo loader button', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(HOST_URL);

    const workbench = page.locator('[data-role="lafea-workbench"]');
    await expect(workbench).toBeVisible();

    // Switch to LAFEA.6
    await workbench.locator('.lafea-workbench__stages [data-stage-id="LAFEA.6"]').click();
    await expect(workbench.locator('h1')).toContainText('LAFEA.6');

    // Verify honest message
    const banner = workbench.locator('[data-role="lafea-next-action-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(
      'Weld profile analysis is not implemented; no demonstration model or solver is available for this stage.',
    );

    // Verify NO demo button is rendered
    await expect(banner.locator('[data-role="lafea-load-demo"]')).toHaveCount(0);
    await expect(workbench.locator('[data-role="lafea-mock"]')).toHaveCount(0);
  });
});
