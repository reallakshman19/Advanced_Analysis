import { expect, test } from '@playwright/test';

const HOST_URL = '/e2e/fixtures/lafea-guided-workbench.html';
const CONTROLLER_URL = '/src/workspace/lafea-workbench-controller.js';

const destroyWorkbench = async (page) => page.evaluate(() => {
  globalThis.__EMP1_WRC_WALKTHROUGH__?.controller?.destroy?.();
  delete globalThis.__EMP1_WRC_WALKTHROUGH__;
}).catch(() => {});

test.afterEach(async ({ page }) => destroyWorkbench(page));

test('records the 12-checkpoint WRC professional walkthrough for human review', async ({ page }, testInfo) => {
  await mountEmp1Workbench(page);
  const checkpointEvidence = [];
  const workbench = page.locator('[data-role="lafea-workbench"]');
  const workflow = workbench.locator('[data-role="emp1-workflow"]');
  const summary = workflow.locator('[data-role="emp1-professional-authority-summary"]');

  await expect(summary).toContainText('Assessment data required');
  await expect(summary).toContainText('Local method unavailable for these inputs');
  await checkpoint(page, testInfo, checkpointEvidence, '01', 'cold-start-fail-closed');

  await workbench.locator('[data-emp1-primary-action="true"]').click();
  await expect(workbench.locator('[data-emp1-primary-action="true"]')).toHaveText('Review assessment');
  await expect(summary).toContainText('Assessment data current');
  await expect(summary).toContainText('Load transfer current');
  await expect(summary).toContainText('Section check current');
  await expect(summary).toContainText('Local method available');
  await expect(summary).toContainText('Local check current');
  await checkpoint(page, testInfo, checkpointEvidence, '02', 'complete-example-current');

  await professionalStep(workflow, 1, 'Start').click();
  await expect(workbench.locator('[data-role="lafea-analytical-calc"]'))
    .toHaveAttribute('data-backing-stage-id', 'LAFEA.1');
  await expect(workbench.locator('[data-guided-target="source"]')).toBeInViewport();
  await expect(workbench.locator('.lafea-doc-table-section[data-input-group]:visible')).toHaveCount(0);
  await checkpoint(page, testInfo, checkpointEvidence, '03', 'start');

  await professionalStep(workflow, 2, 'Geometry').click();
  await expect(workbench.locator('[data-role="lafea-analytical-calc"]'))
    .toHaveAttribute('data-backing-stage-id', 'LAFEA.1');
  await expect(workbench.locator('[data-role="emp1-c-run-configuration"]')).toBeInViewport();
  await expect(workbench.locator('.lafea-doc-table-section[data-input-group="PIPE_GEOMETRY"]')).toBeVisible();
  await expect(workbench.locator('.lafea-doc-table-section[data-input-group="THICKNESS"]')).toBeVisible();
  await checkpoint(page, testInfo, checkpointEvidence, '04', 'geometry');

  await professionalStep(workflow, 3, 'Loads').click();
  await expect(workbench.locator('[data-role="lafea-analytical-calc"]'))
    .toHaveAttribute('data-backing-stage-id', 'LAFEA.1');
  await expect(workbench.locator('.lafea-doc-table-section[data-input-group="PRESSURE"]')).toBeVisible();
  await expect(workbench.locator('.lafea-doc-table-section[data-input-group="LOAD_CASES"]')).toBeVisible();
  await checkpoint(page, testInfo, checkpointEvidence, '05', 'loads');

  await professionalStep(workflow, 4, 'Load transfer').click();
  await expect(workbench.locator('[data-role="lafea-analytical-calc"]'))
    .toHaveAttribute('data-backing-stage-id', 'LAFEA.1');
  await expect(workbench.locator('.lafea-doc-table-section[data-input-group="REFERENCE_POINTS"]')).toBeVisible();
  await openEvidenceView(workbench, 'results');
  await expect(workbench.locator('[data-guided-target="results"]')).toBeInViewport();
  await checkpoint(page, testInfo, checkpointEvidence, '06', 'load-transfer-results');

  await professionalStep(workflow, 5, 'Section check').click();
  await expect(workbench.locator('[data-role="lafea-analytical-calc"]'))
    .toHaveAttribute('data-backing-stage-id', 'LAFEA.2');
  await openEvidenceConsole(workbench);
  const sectionRecord = workbench.locator('[data-role="lafea-screening-load-custody"]');
  await expect(sectionRecord).toBeVisible();
  await sectionRecord.scrollIntoViewIfNeeded();
  await expect(sectionRecord).toBeInViewport();
  await expect(workbench.locator('[data-role="emp1-analytical-full-width-detail"]'))
    .toHaveAttribute('data-emp1-evidence-view', 'screeningCustody');
  await checkpoint(page, testInfo, checkpointEvidence, '07', 'section-check-record');

  await professionalStep(workflow, 6, 'Local check').click();
  const cConfiguration = workbench.locator('[data-role="emp1-c-run-configuration"]');
  await expect(cConfiguration).toBeInViewport();
  await checkpoint(page, testInfo, checkpointEvidence, '08', 'local-check-configuration');

  await openEvidenceConsole(workbench);
  const cEvidence = workbench.locator('[data-role="emp1-c-result-evidence"]');
  const governing = workbench.locator('[data-role="emp1-c-eight-point-governing"]');
  await expect(cEvidence).toBeVisible();
  await governing.scrollIntoViewIfNeeded();
  await expect(governing).toContainText('Continuous/global shell maximum');
  await expect(governing).toContainText('NOT CLAIMED');
  await expect(governing).toContainText('NOT ESTABLISHED BY THIS WRC RESULT');
  await checkpoint(page, testInfo, checkpointEvidence, '09', 'current-local-result-and-governing-scope');

  await professionalStep(workflow, 7, 'Review & export').click();
  const reviewSummary = workbench.locator('[data-role="emp1-product-execution-summary"]');
  await reviewSummary.scrollIntoViewIfNeeded();
  await expect(reviewSummary).toBeInViewport();
  await expect(workflow.locator('[data-role="emp1-workflow-details"]')).not.toHaveAttribute('open', '');
  await checkpoint(page, testInfo, checkpointEvidence, '10', 'review-and-export');

  // Returning from Review must recover the A-backed Geometry editor before the
  // governed upstream mutation is made. This is a navigation/presentation
  // contract; it does not alter EMP.1 calculation state or engineering authority.
  await professionalStep(workflow, 2, 'Geometry').click();
  await expect(workbench.locator('[data-role="lafea-analytical-calc"]'))
    .toHaveAttribute('data-backing-stage-id', 'LAFEA.1');
  const outsideDiameter = workbench.getByRole('textbox', { name: 'Pipe outside diameter LAFEA.1' });
  await expect(outsideDiameter).toBeVisible();
  const originalDiameter = Number(await outsideDiameter.inputValue());
  expect(Number.isFinite(originalDiameter)).toBe(true);
  await outsideDiameter.fill(String(originalDiameter + 1));
  const applyGeometry = workbench.locator('[data-role="lafea-apply-group"][data-input-group="PIPE_GEOMETRY"]');
  await expect(applyGeometry).toBeEnabled();
  await applyGeometry.click();
  await checkpoint(page, testInfo, checkpointEvidence, '11', 'upstream-a-geometry-edited');

  await expect(summary).toContainText('Local inputs changed — recalculate');
  const workflowDetails = workflow.locator('[data-role="emp1-workflow-details"]');
  if (!(await workflowDetails.getAttribute('open'))) await workflowDetails.locator(':scope > summary').click();
  await expect(workflowDetails).toHaveAttribute('open', '');
  const staleNotice = workflow.locator('[data-role="emp1-professional-currentness-notice"]');
  await expect(staleNotice).toHaveAttribute('data-state', 'STALE');
  await expect(staleNotice.locator('[data-role="emp1-professional-required-action"]'))
    .toContainText(/Re-run|rerun|recalculate/u);
  await expect(workbench.locator('[data-role="emp1-c-result-evidence"]')).toHaveCount(0);
  await staleNotice.scrollIntoViewIfNeeded();
  await checkpoint(page, testInfo, checkpointEvidence, '12', 'downstream-local-result-stale-with-explanation');

  await attachManifest(page, testInfo, originalDiameter, checkpointEvidence);
});

async function openEvidenceConsole(workbench) {
  const analytical = workbench.locator('[data-role="lafea-analytical-calc"]');
  const toggle = analytical.locator('[data-role="emp1-evidence-console-toggle"]');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

async function openEvidenceView(workbench, surfaceId) {
  await openEvidenceConsole(workbench);
  const analytical = workbench.locator('[data-role="lafea-analytical-calc"]');
  const tab = analytical.locator(
    `[data-role="emp1-evidence-tab"][data-emp1-evidence-view="${surfaceId}"]`,
  );
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  const surface = analytical.locator(`[data-emp1-layout-surface="${surfaceId}"]`);
  await expect(surface).toBeVisible();
  await surface.scrollIntoViewIfNeeded();
}

function professionalStep(workflow, ordinal, label) {
  return workflow.getByRole('button', { name: new RegExp(`^${ordinal} ${escapeRegExp(label)}`, 'u') });
}

async function checkpoint(page, testInfo, evidence, ordinal, name) {
  await page.evaluate(() => document.activeElement?.blur?.());
  const viewportState = await page.evaluate(() => ({
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  }));
  const screenshotOptions = { animations: 'disabled', caret: 'hide' };
  const viewportBody = await page.screenshot(screenshotOptions);
  await testInfo.attach(`${ordinal}-${name}-viewport`, { body: viewportBody, contentType: 'image/png' });
  const fullPageBody = await page.screenshot({ ...screenshotOptions, fullPage: true });
  await testInfo.attach(`${ordinal}-${name}-full-page`, { body: fullPageBody, contentType: 'image/png' });
  await page.evaluate(({ scrollX, scrollY }) => window.scrollTo(scrollX, scrollY), viewportState);
  const ariaSnapshot = await page.locator('[data-role="lafea-workbench"]').ariaSnapshot();
  await testInfo.attach(`${ordinal}-${name}-aria`, {
    body: Buffer.from(`${ariaSnapshot}\n`, 'utf8'),
    contentType: 'text/plain',
  });
  evidence.push({ ordinal: Number(ordinal), name, ...viewportState });
}

async function attachManifest(page, testInfo, originalDiameter, checkpointEvidence) {
  const browserVersion = page.context().browser()?.version() ?? 'UNRESOLVED';
  const manifest = {
    schema: 'emp1-wrc-ui-walkthrough-evidence/v6',
    project: testInfo.project.name,
    browserVersion,
    checkpoints: 12,
    checkpointEvidence,
    splitConsoleSchema: 'emp1-split-console/v1',
    operatorWorkflow: [
      'Start',
      'Geometry',
      'Loads',
      'Load transfer',
      'Section check',
      'Local check',
      'Review & export',
    ],
    attachmentPolicy: {
      viewportScreenshots: 12,
      fullPageContextScreenshots: 12,
      ariaSnapshots: 12,
      ariaSnapshotScope: 'lafea-workbench',
      viewportScreenshotProvesLanding: true,
      fullPageScreenshotIsContextOnly: true,
      ariaSnapshotSupportsAccessibleNameReview: true,
      hoverOnlyTooltipRequiresLiveObservation: true,
    },
    humanObservationPolicy: {
      finalPassRequiresLiveOrRecordedQualifiedHumanObservation: true,
      artifactOnlyReviewCanEstablishFinalPass: false,
      staticArtifactsSupportPerStageReview: true,
      dynamicTransitionsRequireLiveOrRecordedObservation: true,
      fullPageWaterfallFalsifierRequired: true,
      narrowStackingForbidden: true,
    },
    upstreamMutation: {
      task: 'Geometry',
      control: 'Pipe outside diameter LAFEA.1',
      originalValue: originalDiameter,
      mutatedValue: originalDiameter + 1,
      action: 'Apply PIPE_GEOMETRY changes',
    },
    automationIsAcceptance: false,
    requiredHumanReview: true,
  };
  await testInfo.attach('walkthrough-manifest', {
    body: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
    contentType: 'application/json',
  });
}

async function mountEmp1Workbench(page) {
  await page.goto(HOST_URL);
  return page.evaluate(async ({ controllerUrl }) => {
    const { LafeaWorkbenchController } = await import(controllerUrl);
    const root = document.querySelector('#lafea-guided-browser-host');
    const controller = new LafeaWorkbenchController(root, { analyticalOnly: true });
    controller.init();
    globalThis.__EMP1_WRC_WALKTHROUGH__ = { controller };
    return controller.getState().activeStageId;
  }, { controllerUrl: CONTROLLER_URL });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
