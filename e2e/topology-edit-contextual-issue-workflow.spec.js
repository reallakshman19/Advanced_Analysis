import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const REPORT = 'reports/qualification/contextual-issue-workflow.json';

test('production WebGL issue marker drives certified review, cancel, apply, undo, and redo', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1680, height: 1100 });
  await page.addInitScript(() => globalThis.localStorage?.clear());

  const host = await openController(page);
  const target = await targetTrimIssue(page);
  const before = await engineeringState(page);
  const firstPick = await clickIssueMarker(page, target.issueId);
  await expect(page.locator(`.topology-edit-3d-callout[data-issue-id="${target.issueId}"]`)).toBeVisible();
  await page.locator(`.topology-edit-3d-callout[data-issue-id="${target.issueId}"]`)
    .getByRole('button', { name: 'Review fix', exact: true }).click();

  const review = page.locator('[data-role="topology-edit-issue-fix-review"]');
  await expect(review).toBeVisible();
  await expect(review.locator('[data-role="topology-edit-issue-fix-title"]'))
    .toHaveText('Certified fix · TRIM_EDGE');
  await expect(review.getByRole('button', { name: 'Apply fix', exact: true })).toBeEnabled();
  await expect(review.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
  const firstPreview = await engineeringState(page);
  assertPreviewAuthority(firstPreview, before, target);
  await expect(review).toHaveAttribute('data-preview-hash', firstPreview.preview.previewHash);
  await expect(review).toHaveAttribute(
    'data-certification-hash', firstPreview.preview.certificationHash,
  );
  await expect(review).toHaveAttribute(
    'data-candidate-draft-hash', firstPreview.preview.candidateDraftHash,
  );

  await review.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(review).toBeHidden();
  const cancelled = await engineeringState(page);
  assertExactActiveState(cancelled, before);
  expect(cancelled.preview).toBeNull();
  expect(cancelled.ghostCount).toBe(0);

  const secondPick = await clickIssueMarker(page, target.issueId);
  await page.locator(`.topology-edit-3d-callout[data-issue-id="${target.issueId}"]`)
    .getByRole('button', { name: 'Review fix', exact: true }).click();
  await expect(review).toBeVisible();
  const secondPreview = await engineeringState(page);
  assertPreviewAuthority(secondPreview, before, target);
  expect(secondPreview.preview.previewHash).toBe(firstPreview.preview.previewHash);
  expect(secondPreview.preview.requestHash).toBe(firstPreview.preview.requestHash);
  expect(secondPreview.preview.certificationHash).toBe(firstPreview.preview.certificationHash);
  expect(secondPreview.preview.candidateDraftHash).toBe(firstPreview.preview.candidateDraftHash);
  expect(secondPreview.preview.ghostHash).toBe(firstPreview.preview.ghostHash);

  await review.getByRole('button', { name: 'Apply fix', exact: true }).click();
  await expect.poll(() => engineeringState(page).then((row) => row.ledger.canonicalHash))
    .not.toBe(before.ledger.canonicalHash);
  const accepted = await engineeringState(page);
  expect(accepted.preview).toBeNull();
  expect(accepted.ledger.activeCommandIds).toHaveLength(before.ledger.activeCommandIds.length + 1);
  expect(accepted.lastEntry?.commandType).toBe('TRIM_EDGE');
  expect(accepted.lastEntry?.requestHash).toBe(secondPreview.preview.requestHash);
  expect(accepted.lastEntry?.certificationHash).toBe(secondPreview.preview.certificationHash);
  expect(accepted.lastEntry?.candidateDraftHash).toBe(secondPreview.preview.candidateDraftHash);
  expect(accepted.issueIds).not.toContain(target.issueId);

  await page.locator('[data-action="undo"]').click();
  await expect.poll(() => engineeringState(page).then((row) => row.ledger.canonicalHash))
    .toBe(before.ledger.canonicalHash);
  const undone = await engineeringState(page);
  expect(undone.ledger.activeLedgerHash).toBe(before.ledger.activeLedgerHash);
  expect(undone.ledger.activeCommandIds).toEqual(before.ledger.activeCommandIds);
  expect(undone.issueIds).toContain(target.issueId);

  await page.locator('[data-action="redo"]').click();
  await expect.poll(() => engineeringState(page).then((row) => row.ledger.canonicalHash))
    .toBe(accepted.ledger.canonicalHash);
  const redone = await engineeringState(page);
  expect(redone.ledger.activeLedgerHash).toBe(accepted.ledger.activeLedgerHash);
  expect(redone.ledger.activeCommandIds).toEqual(accepted.ledger.activeCommandIds);
  expect(redone.issueIds).not.toContain(target.issueId);

  const report = {
    schema: 'TopologyEditContextualIssueWorkflowEvidence.v1',
    candidateHead: process.env.TOPOLOGY_EDIT_TARGET_HEAD_SHA || null,
    status: 'PASS',
    fixture: 'topology-edit-20-element-demo',
    target,
    productionWebglPick: { firstPick, secondPick },
    before,
    firstPreview,
    cancelled,
    secondPreview,
    accepted,
    undone,
    redone,
  };
  await mkdir('reports/qualification', { recursive: true });
  await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  await testInfo.attach('contextual-issue-workflow', {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json',
  });
  await testInfo.attach('contextual-issue-workflow-screenshot', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

function assertPreviewAuthority(current, before, target) {
  assertExactActiveState(current, before);
  expect(current.preview).not.toBeNull();
  expect(current.preview.issueId).toBe(target.issueId);
  expect(current.preview.suggestionHash).toBe(target.suggestionHash);
  expect(current.preview.previewHash).toBeTruthy();
  expect(current.preview.requestHash).toBeTruthy();
  expect(current.preview.certificationHash).toBeTruthy();
  expect(current.preview.candidateDraftHash).toBeTruthy();
  expect(current.preview.ghostHash).toBeTruthy();
  expect(current.preview.priorDraftHash).toBe(before.ledger.canonicalHash);
  expect(current.preview.sessionVersion).toBe(before.ledger.sessionVersion);
  expect(current.ghostCount).toBeGreaterThan(0);
}

function assertExactActiveState(current, before) {
  expect(current.ledger.canonicalHash).toBe(before.ledger.canonicalHash);
  expect(current.ledger.journalHash).toBe(before.ledger.journalHash);
  expect(current.ledger.activeLedgerHash).toBe(before.ledger.activeLedgerHash);
  expect(current.ledger.sessionVersion).toBe(before.ledger.sessionVersion);
  expect(current.ledger.activeCommandIds).toEqual(before.ledger.activeCommandIds);
}

async function openController(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const navigation = page.getByRole('navigation', { name: 'Application views' });
  await navigation.getByRole('button', { name: 'Workspace', exact: true }).click();
  await page.locator('[data-action="load-topology-edit-demo"]').click();
  await expect.poll(() => page.evaluate(() => (
    globalThis.AnalysisWorkspace?.getSnapshot?.()?.dataset?.entities?.length ?? 0
  ))).toBe(20);
  await page.getByRole('button', { name: '3D Edit', exact: true }).click();
  const host = page.locator('[data-role="topology-edit-render-host"]');
  await expect(host).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(
    '[data-role="topology-edit-canvas-mount"] canvas[data-viewport-backend="topology-edit-webgl"]',
  )).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const controller = document.querySelector('[data-role="topology-edit-render-host"]')
      ?.__topologyEditAuthoringController;
    return Boolean(controller?.issueOverlay?.entries?.length && controller?.autofixSuggestions?.length);
  })).toBe(true);
  await page.evaluate(() => {
    const controller = document.querySelector('[data-role="topology-edit-render-host"]')
      ?.__topologyEditAuthoringController;
    if (!controller) throw new Error('Mounted production 3D Edit controller is unavailable.');
    globalThis.__CONTEXTUAL_ISSUE_CONTROLLER__ = controller;
  });
  return host;
}

async function targetTrimIssue(page) {
  return page.evaluate(() => {
    const controller = globalThis.__CONTEXTUAL_ISSUE_CONTROLLER__;
    const suggestion = controller.autofixSuggestions
      .find((row) => row.commandType === 'TRIM_EDGE');
    if (!suggestion) throw new Error('Demo has no source-backed TRIM_EDGE suggestion.');
    const issue = controller.issues.find((row) => row.id === suggestion.issueId);
    const entry = controller.issueOverlay.entries.find((row) => row.issueId === suggestion.issueId);
    if (!issue || !entry) throw new Error('TRIM_EDGE issue is missing its governed spatial overlay.');
    return {
      issueId: issue.id,
      issueKind: issue.kind,
      severity: issue.severity,
      distanceMm: issue.distanceMm ?? null,
      suggestionHash: suggestion.suggestionHash,
      commandType: suggestion.commandType,
      overlayHash: controller.issueOverlay.overlayHash,
      canonicalIds: [...entry.canonicalIds],
      anchorSource: entry.anchorSource,
    };
  });
}

async function clickIssueMarker(page, issueId) {
  const point = await resolveIssuePickPoint(page, issueId);
  const canvas = page.locator(
    '[data-role="topology-edit-canvas-mount"] canvas[data-viewport-backend="topology-edit-webgl"]',
  );
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Production WebGL canvas has no bounding box.');
  await canvas.click({ position: { x: point.x - box.x, y: point.y - box.y } });
  const actual = await page.evaluate(() => {
    const pick = globalThis.__CONTEXTUAL_ISSUE_CONTROLLER__.viewportBackend.lastSelectionPick;
    return pick ? {
      objectKind: pick.objectKind,
      objectId: pick.objectId,
      partRole: pick.partRole,
    } : null;
  });
  expect(actual?.objectKind).toBe('issue');
  expect(actual?.objectId).toBe(issueId);
  return { ...point, actual };
}

async function resolveIssuePickPoint(page, issueId) {
  return page.evaluate((targetId) => {
    const controller = globalThis.__CONTEXTUAL_ISSUE_CONTROLLER__;
    const backend = controller.viewportBackend;
    const marker = backend.groups.issueGroup.children
      .find((row) => row.userData?.issueId === targetId);
    if (!marker) throw new Error(`Rendered issue marker ${targetId} is missing.`);
    backend.engineeringRoot.updateMatrixWorld(true);
    backend.activeCamera.updateMatrixWorld(true);
    backend.activeCamera.updateProjectionMatrix();
    const rect = backend.renderer.domElement.getBoundingClientRect();
    const world = marker.position.clone();
    marker.getWorldPosition(world);
    world.project(backend.activeCamera);
    const center = {
      x: rect.left + ((world.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - world.y) / 2) * rect.height,
    };
    const radii = [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 30];
    const directions = [[1,0],[.7071,.7071],[0,1],[-.7071,.7071],[-1,0],[-.7071,-.7071],[0,-1],[.7071,-.7071]];
    for (const radius of radii) {
      const offsets = radius === 0 ? [[0, 0]] : directions.map(([x, y]) => [x * radius, y * radius]);
      for (const [dx, dy] of offsets) {
        const x = center.x + dx;
        const y = center.y + dy;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
        const pick = backend.pickAt(x, y);
        if (pick?.objectKind === 'issue' && pick.objectId === targetId) {
          return {
            x,
            y,
            projectedCenter: center,
            directPickerPreflight: {
              objectKind: pick.objectKind,
              objectId: pick.objectId,
              partRole: pick.partRole,
            },
          };
        }
      }
    }
    throw new Error(`No production GPU-pick pixel resolved issue marker ${targetId}.`);
  }, issueId);
}

async function engineeringState(page) {
  return page.evaluate(() => {
    const controller = globalThis.__CONTEXTUAL_ISSUE_CONTROLLER__;
    const topology = controller.session.currentTopology();
    const journal = controller.session.journal;
    const preview = controller.autofixPreview;
    const last = journal.history.at(-1) ?? null;
    return {
      ledger: {
        sourceHash: topology.sourceHash,
        canonicalHash: topology.canonicalTopologyHash,
        journalHash: journal.journalHash,
        activeLedgerHash: journal.activeLedgerHash,
        redoLedgerHash: journal.redoLedgerHash,
        sessionVersion: journal.sessionVersion,
        activeCommandIds: [...journal.activeCommandIds],
        redoCommandIds: [...journal.redoCommandIds],
      },
      overlayHash: controller.issueOverlay?.overlayHash ?? null,
      issueIds: controller.issues.map((row) => row.id),
      preview: preview ? {
        issueId: preview.issueId,
        suggestionHash: preview.suggestionHash,
        previewHash: preview.previewHash,
        requestHash: preview.requestHash,
        certificationHash: preview.certificationHash,
        candidateDraftHash: preview.candidateDraftHash,
        ghostHash: preview.ghostHash,
        priorDraftHash: preview.priorDraftHash,
        sessionVersion: preview.sessionVersion,
        commandId: preview.request?.commandId ?? null,
        commandType: preview.request?.commandType ?? null,
        basis: preview.request?.basis ?? null,
      } : null,
      ghostCount: controller.viewportBackend.groups.ghostGroup.children.length,
      lastEntry: last ? {
        entryHash: last.entryHash,
        commandId: last.commandId,
        commandType: last.commandType,
        requestHash: last.request?.requestHash ?? null,
        certificationHash: last.certificationHash,
        candidateDraftHash: last.receipt?.result?.candidateDraftHash ?? null,
        validationHash: last.receipt?.result?.validationHash ?? null,
        editLedgerHash: last.receipt?.result?.editLedgerHash ?? null,
      } : null,
    };
  });
}
