import { expect, test } from '@playwright/test';

const HOST_URL = '/e2e/fixtures/lafea-guided-workbench.html';
const CONTROLLER_URL = '/src/workspace/lafea-workbench-controller.js';

const destroyWorkbench = async (page) => page.evaluate(() => {
  globalThis.__EMP1_PROFESSIONAL_RELEASE_BROWSER__?.controller?.destroy?.();
  delete globalThis.__EMP1_PROFESSIONAL_RELEASE_BROWSER__;
}).catch(() => {});

test.afterEach(async ({ page }) => destroyWorkbench(page));

test('authorized bounded EMP.1 route executes through the real workbench without code/release overclaim', async ({ page }) => {
  await mountEmp1Workbench(page);
  const workbench = page.locator('[data-role="lafea-workbench"]');
  const sample = workbench.locator('[data-role="emp1-load-complete-qualification-sample"]');
  await expect(sample).toBeVisible();
  await sample.click();

  // Wait for the complete-example transaction to settle before navigating away.
  // Playwright's click waits for the DOM event, not an async event-handler promise;
  // without this governed-state wait a late product rerender can race Review.
  await expect(workbench.locator('[data-emp1-primary-action="true"]')).toHaveText('Review assessment');

  // Execution summary is retained evidence, not permanent page content. Review &
  // export foregrounds that same governed node without changing execution state.
  const workflow = workbench.locator('[data-role="emp1-workflow"]');
  await workflow.getByRole('button', { name: /^7 Review & export/u }).click();
  const summary = workbench.locator('[data-role="emp1-product-execution-summary"]');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('A 1 · B 1 · prepare C 1 · production C 1');
  await expect(summary.getByRole('row').filter({ hasText: 'C current/reportable result' }))
    .toContainText('YES');
  await expect(summary.getByRole('row').filter({ hasText: 'Code compliance produced' }))
    .toContainText('NO');
  await expect(summary.getByRole('row').filter({ hasText: 'Release qualified' }))
    .toContainText('NO');

  const professional = summary.locator('[data-role="emp1-professional-status"]');
  await expect(professional).toBeVisible();
  await expect(professional.getByRole('row').filter({ hasText: 'CALCULATED' })).toContainText('YES');
  await expect(professional.getByRole('row').filter({ hasText: 'METHOD QUALIFIED' })).toContainText('YES');
  await expect(professional.getByRole('row').filter({ hasText: 'CODE COMPLIANT' })).toContainText('NO');
  await expect(professional.getByRole('row').filter({ hasText: 'RELEASED' })).toContainText('NO');

  // Switch the bounded evidence console to the current WRC result before checking
  // its eight-point scope. The result node remains unique in DOM custody.
  await openEvidenceView(workbench, 'correlationResult');
  const resultCard = workbench.locator('[data-role="emp1-c-result-evidence"]');
  await expect(resultCard).toHaveCount(1);
  await expect(resultCard).toBeVisible();
  await expect(resultCard).toContainText('Eight-location shell stress trace');
  const governing = resultCard.locator('[data-role="emp1-c-eight-point-governing"]');
  await expect(governing).toHaveCount(1);
  await expect(governing).toContainText('Continuous/global shell maximumNOT CLAIMED');
  await expect(governing).toContainText('Nozzle / attachment-wall stressNOT CALCULATED');
  await expect(governing).toContainText('Code complianceNOT ESTABLISHED BY THIS WRC RESULT');

  const evidence = await page.evaluate(() => {
    const execution = globalThis.__EMP1_PROFESSIONAL_RELEASE_BROWSER__.controller.getEmp1Execution();
    return {
      invocations: execution?.invocations ?? null,
      localCorrelationState: execution?.result?.localCorrelation?.state ?? null,
      productionRouteAuthority: execution?.result?.localCorrelation?.productionRouteAuthority ?? null,
      globalEmp1CRouteAuthority: execution?.authority?.globalEmp1CRouteAuthority ?? null,
      codeComplianceProduced: execution?.authority?.codeComplianceProduced ?? null,
      releaseQualified: execution?.authority?.releaseQualified ?? null,
      routeAuthorityHash: execution?.authority?.routeAuthorityHash ?? null,
      routeAuthoritySnapshotHash: execution?.authority?.routeAuthoritySnapshot?.semanticHash ?? null,
    };
  });

  expect(evidence.invocations).toEqual({
    loadTransfer: 1,
    sectionScreening: 1,
    localPreparation: 1,
    localCorrelation: 1,
  });
  expect(evidence.localCorrelationState)
    .toBe('EVALUATED_AUTHORIZED_BOUNDED_GAMMA5_ZERO_DP_ROUTE');
  expect(evidence.productionRouteAuthority).toBe(true);
  expect(evidence.globalEmp1CRouteAuthority).toBe(false);
  expect(evidence.codeComplianceProduced).toBe(false);
  expect(evidence.releaseQualified).toBe(false);
  expect(evidence.routeAuthorityHash).toEqual(expect.any(String));
  expect(evidence.routeAuthorityHash).toBe(evidence.routeAuthoritySnapshotHash);
});

async function openEvidenceView(workbench, surfaceId) {
  const analytical = workbench.locator('[data-role="lafea-analytical-calc"]');
  const toggle = analytical.locator('[data-role="emp1-evidence-console-toggle"]');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  const tab = analytical.locator(
    `[data-role="emp1-evidence-tab"][data-emp1-evidence-view="${surfaceId}"]`,
  );
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

async function mountEmp1Workbench(page) {
  await page.goto(HOST_URL);
  return page.evaluate(async ({ controllerUrl }) => {
    const { LafeaWorkbenchController } = await import(controllerUrl);
    const root = document.querySelector('#lafea-guided-browser-host');
    const controller = new LafeaWorkbenchController(root, { analyticalOnly: true });
    controller.init();
    globalThis.__EMP1_PROFESSIONAL_RELEASE_BROWSER__ = { controller };
    const state = controller.getState();
    return { stageId: state.activeStageId, status: state.status };
  }, { controllerUrl: CONTROLLER_URL });
}
