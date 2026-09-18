import { expect, test } from '@playwright/test';

/**
 * The engineer-facing Table-5 recovery must state its governed unit and show
 * engineering precision, while the exact retained magnitude stays reachable.
 * An unlabelled stress table cannot be checked or signed by a reviewer.
 */
const HOST_URL = '/e2e/fixtures/lafea-guided-workbench.html';
const CONTROLLER_URL = '/src/workspace/lafea-workbench-controller.js';

test.afterEach(async ({ page }) => page.evaluate(() => {
  globalThis.__EMP1_WRC_UNITS__?.controller?.destroy?.();
  delete globalThis.__EMP1_WRC_UNITS__;
}).catch(() => {}));

test('eight-point stress table states its governed unit and retains exact values', async ({ page }) => {
  await page.goto(HOST_URL);
  await page.evaluate(async ({ controllerUrl }) => {
    const { LafeaWorkbenchController } = await import(controllerUrl);
    const root = document.querySelector('#lafea-guided-browser-host');
    const controller = new LafeaWorkbenchController(root, { analyticalOnly: true });
    controller.init();
    globalThis.__EMP1_WRC_UNITS__ = { controller };
  }, { controllerUrl: CONTROLLER_URL });

  const workbench = page.locator('[data-role="lafea-workbench"]');
  await workbench.locator('[data-emp1-primary-action="true"]').click();
  await expect(workbench.locator('[data-emp1-primary-action="true"]')).toHaveText('Review assessment');

  const table = workbench.locator('[data-role="emp1-c-eight-point-stress"]');
  await expect(table).toHaveCount(1);

  // Every stress column carries the governed unit, not a bare symbol.
  const headers = await table.locator('th').allInnerTexts();
  expect(headers.slice(0, 5)).toEqual([
    'Location', 'σφ (N/mm²)', 'σx (N/mm²)', 'τ (N/mm²)', 'Stress intensity (N/mm²)',
  ]);

  // Eight locations, each cell rounded for display but carrying its exact value.
  const cells = table.locator('td[data-emp1-exact-value]');
  await expect(cells).toHaveCount(32);
  for (const cell of await cells.all()) {
    const shown = Number((await cell.innerText()).trim());
    const exact = Number(await cell.getAttribute('data-emp1-exact-value'));
    expect(Number.isFinite(shown)).toBe(true);
    expect(Number.isFinite(exact)).toBe(true);
    expect(Math.abs(shown - exact)).toBeLessThanOrEqual(Math.abs(exact) * 5e-4);
  }

  // The governing point reports its unit alongside the magnitude.
  await expect(workbench.locator('[data-role="emp1-c-eight-point-governing"]'))
    .toContainText(/stress intensity [\d.]+ N\/mm²/u);

  // Full precision stays available under technical disclosure.
  const full = workbench.locator('[data-role="emp1-c-eight-point-stress-full-precision"]');
  await expect(full).toHaveAttribute('data-emp1-raw-technical', 'true');
  await expect(full.locator('summary'))
    .toHaveText('Full-precision retained stress values (N/mm²)');

  // WRC reference loads carry their governed force/moment units too.
  const loadLabels = await workbench.locator('th').allInnerTexts();
  for (const label of ['P (N)', 'Vc (N)', 'Vl (N)', 'Mc (N·mm)', 'Ml (N·mm)', 'Mt (N·mm)']) {
    expect(loadLabels).toContain(label);
  }
});
