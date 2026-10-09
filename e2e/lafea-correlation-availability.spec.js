import { expect, test } from '@playwright/test';

test('LAFEA.2 binds correlation geometry to exact source and keeps empirical authority blocked', async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.__WORKSPACE_VIEWPORT_BACKEND__ = 'canvas2d';
  });
  await page.goto('/');
  await page.locator('[data-application-nav="LAFEA"]').click();
  const workbench = page.locator('[data-role="lafea-workbench"]');
  await workbench.locator('.lafea-workbench__stages [data-stage-id="LAFEA.2"]').click();
  await workbench.locator('[data-role="lafea-mock"]').click();

  let availability = workbench.locator('[data-role="lafea-correlation-availability"]');
  await expect(availability).toBeVisible();
  await expect(availability).toHaveAttribute('data-correlation-state', 'BLOCKED');
  await expect(availability).toHaveAttribute('data-geometry-state', 'ABSENT');
  await expect(availability.locator('[data-role="lafea-correlation-status"]')).toHaveText('BLOCKED');
  await expect(availability).toContainText('Registered engineering methods');
  await expect(availability).toContainText('No qualified engineering correlation method/edition is registered.');
  await expect(availability).toContainText('Run and qualify the current LAFEA.2 nominal screening result');
  await expect(availability).toContainText('Declare attachment geometry identity, diameter and source reference');
  await expect(availability).toContainText('No local-attachment empirical stress result is authorized.');
  await expect(availability).not.toContainText('SYNTHETIC_LOCAL_ATTACHMENT_CORRELATION');
  await expect(availability.locator('[data-correlation-blocker="NO_ENGINEERING_CORRELATION_PROFILE_REGISTERED"]')).toHaveCount(1);
  await expect(availability.locator('[data-correlation-blocker="QUALIFIED_LAFEA2_RESULT_REQUIRED"]')).toHaveCount(1);
  await expect(availability.locator('[data-correlation-blocker="SOURCE_BOUND_ATTACHMENT_GEOMETRY_REQUIRED"]')).toHaveCount(1);

  const editor = availability.locator('[data-role="lafea-correlation-geometry-editor"]');
  await expect(editor).toBeVisible();
  await editor.locator('[data-role="lafea-correlation-geometry-identity"]').fill('ATTACHMENT-GEOMETRY-UI');
  await editor.locator('[data-role="lafea-correlation-attachment-diameter"]').fill('250');
  await editor.locator('[data-role="lafea-correlation-attachment-source-reference"]')
    .fill('UI_FIXTURE/ATTACHMENT_DIAMETER');
  await editor.locator('[data-role="lafea-correlation-bind-geometry"]').click();

  availability = workbench.locator('[data-role="lafea-correlation-availability"]');
  await expect(availability).toHaveAttribute('data-geometry-state', 'CURRENT_INPUT_PENDING_RESULT');
  await expect(availability.locator('[data-correlation-blocker="SOURCE_BOUND_ATTACHMENT_GEOMETRY_REQUIRED"]')).toHaveCount(0);
  await expect(availability.locator('[data-correlation-blocker="QUALIFIED_LAFEA2_RESULT_REQUIRED"]')).toHaveCount(1);
  await expect(availability.locator('[data-role="lafea-correlation-geometry-feedback"]'))
    .toContainText('Geometry declaration is current for this LAFEA.2 source');
  const declarationHash = await availability.locator('tr')
    .filter({ hasText: 'Geometry declaration hash' }).locator('td').textContent();
  expect(declarationHash).toMatch(/^fnv1a64:[0-9a-f]{16}$/u);

  const run = workbench.locator('[data-role="lafea-run"]');
  await expect(run).toBeEnabled();
  await run.click();

  availability = workbench.locator('[data-role="lafea-correlation-availability"]');
  await expect(availability).toHaveAttribute('data-correlation-state', 'BLOCKED');
  await expect(availability).toHaveAttribute('data-geometry-state', 'CURRENT_EVIDENCE');
  await expect(availability.locator('[data-correlation-blocker="NO_ENGINEERING_CORRELATION_PROFILE_REGISTERED"]')).toHaveCount(1);
  await expect(availability.locator('[data-correlation-blocker="QUALIFIED_LAFEA2_RESULT_REQUIRED"]')).toHaveCount(0);
  await expect(availability.locator('[data-correlation-blocker="SOURCE_BOUND_ATTACHMENT_GEOMETRY_REQUIRED"]')).toHaveCount(0);
  await expect(availability.locator('[data-correlation-blocker="ATTACHMENT_GEOMETRY_EVIDENCE_REQUIRED"]')).toHaveCount(0);
  await expect(availability).toContainText('QUALIFIED');
  await expect(availability).toContainText('ACCEPTED');
  await expect(availability.locator('[data-role="lafea-correlation-geometry-feedback"]'))
    .toContainText('reconstructed correlation geometry evidence are current');

  const state = await page.evaluate(() => globalThis.AnalysisWorkspace.getLafeaWorkbenchState());
  const resultHash = state.stages['LAFEA.2'].execution.result.semanticHashes.screeningResultPayloadSemanticHash;
  expect(resultHash).toMatch(/^fnv1a64:[0-9a-f]{16}$/u);
  await expect(availability).toContainText(resultHash);
  const evidenceHash = await availability.locator('tr')
    .filter({ hasText: 'Geometry evidence hash' }).first().locator('td').textContent();
  expect(evidenceHash).toMatch(/^fnv1a64:[0-9a-f]{16}$/u);
  await expect(availability).toContainText(state.stages['LAFEA.2'].document.sourceEvidence.foundationModel.semanticHash);
  await expect(availability).toContainText(
    state.stages['LAFEA.2'].document.sourceEvidence.foundationResult.semanticHashes.resultPayloadSemanticHash,
  );
  await expect(availability).not.toContainText('SYNTHETIC_LOCAL_ATTACHMENT_CORRELATION');

  const custody = workbench.locator('[data-role="lafea-screening-load-custody"]');
  const factor = custody.locator(
    '[data-role="lafea-screening-term-factor"][data-screening-case-id="CASE-B"][data-load-case-id="LC-A"]',
  );
  await factor.fill('0.25');
  await custody.locator(
    '[data-role="lafea-apply-screening-term-factor"][data-screening-case-id="CASE-B"][data-load-case-id="LC-A"]',
  ).click();

  availability = workbench.locator('[data-role="lafea-correlation-availability"]');
  await expect(availability).toHaveAttribute('data-geometry-state', 'STALE');
  await expect(availability.locator('[data-correlation-blocker="ATTACHMENT_GEOMETRY_SOURCE_STALE"]')).toHaveCount(1);
  await expect(availability.locator('[data-correlation-blocker="QUALIFIED_LAFEA2_RESULT_REQUIRED"]')).toHaveCount(1);
  await expect(availability.locator('[data-role="lafea-correlation-geometry-feedback"]'))
    .toContainText('stale because the LAFEA.2 source changed');

  await availability.locator('[data-role="lafea-correlation-bind-geometry"]').click();
  availability = workbench.locator('[data-role="lafea-correlation-availability"]');
  await expect(availability).toHaveAttribute('data-geometry-state', 'CURRENT_INPUT_PENDING_RESULT');
  await expect(availability.locator('[data-correlation-blocker="ATTACHMENT_GEOMETRY_SOURCE_STALE"]')).toHaveCount(0);
  await expect(availability.locator('[data-correlation-blocker="QUALIFIED_LAFEA2_RESULT_REQUIRED"]')).toHaveCount(1);
});
