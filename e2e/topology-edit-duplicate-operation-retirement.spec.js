import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const REPORT = 'reports/qualification/duplicate-operation-retirement.json';
const PIPE_GEOMETRY_OPERATIONS = [
  'EXTEND_EDGE',
  'SHORTEN_EDGE',
  'SPLIT_EDGE_FROM_DISTANCE',
  'MOVE_CONNECTED_RUN',
  'CREATE_ORTHOGONAL_OFFSET',
  'APPLY_DECLARED_SLOPE',
];

test('production 3D Edit retires duplicate professional operations without canonical mutation', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1680, height: 1080 });
  await page.addInitScript(() => globalThis.localStorage?.clear());

  const host = await openController(page);
  const before = await engineeringState(page);

  const pipePanel = host.locator('details[data-panel-kind="topology-edit-professional-operation"]');
  await expect(pipePanel.locator(':scope > summary')).toHaveText('Pipe geometry');
  if (!(await pipePanel.evaluate((element) => element.open))) {
    await pipePanel.locator(':scope > summary').click();
  }
  await expect(pipePanel.locator('.topology-edit-professional-operation__header strong'))
    .toHaveText('Pipe geometry');

  const operationValues = await pipePanel.locator('[data-role="professional-operation-type"] option')
    .evaluateAll((options) => options.map((option) => option.value));
  expect(operationValues).toEqual(PIPE_GEOMETRY_OPERATIONS);
  expect(operationValues).not.toContain('INSERT_INLINE_COMPONENT');
  expect(operationValues).not.toContain('RECONNECT_ENDPOINTS');

  for (const role of [
    'professional-center-distance-mm',
    'professional-insertion-length-mm',
    'professional-inline-direction',
    'professional-catalogue-record',
  ]) {
    await expect(pipePanel.locator(`[data-role="${role}"]`)).toHaveCount(0);
  }

  const authoringPanel = host.locator('details[data-panel-kind="authoring"]');
  if (!(await authoringPanel.evaluate((element) => element.open))) {
    await authoringPanel.locator(':scope > summary').click();
  }
  const familyPicker = authoringPanel.locator('[data-role="component-placement-family-picker"]');
  await expect(familyPicker).toBeVisible();
  if (!(await familyPicker.evaluate((element) => element.open))) {
    await familyPicker.locator(':scope > summary').click();
  }
  await expect(familyPicker.locator('[data-action="activate-authoring-flange"]')).toBeVisible();
  await expect(familyPicker.locator('[data-action="activate-authoring-reducer"]')).toBeVisible();
  await expect(familyPicker.locator('[data-action="activate-authoring-valve-assembly"]')).toBeVisible();
  await expect(familyPicker.locator('[data-action="activate-authoring-branch"]')).toBeVisible();
  await expect(familyPicker.locator('[data-action="activate-authoring-blind-flange"]')).toBeVisible();

  await familyPicker.locator('[data-action="activate-authoring-flange"]').click();
  await expect(host).toHaveAttribute('data-topology-edit-authoring-tool', 'FLANGE');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  const connect = authoringPanel.locator('[data-action="activate-authoring-connect-ends"]');
  await expect(connect).toBeVisible();
  await connect.click();
  await expect(authoringPanel.locator('.topology-edit-authoring-hud__target strong'))
    .toHaveText('CONNECT ENDS');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  const after = await engineeringState(page);
  expect(after.canonicalHash).toBe(before.canonicalHash);
  expect(after.journalHash).toBe(before.journalHash);
  expect(after.activeLedgerHash).toBe(before.activeLedgerHash);
  expect(after.activeCommandIds).toEqual(before.activeCommandIds);

  const report = {
    schema: 'TopologyEditDuplicateOperationRetirement.v1',
    candidateHead: process.env.TOPOLOGY_EDIT_TARGET_HEAD_SHA || null,
    status: 'PASS',
    operationValues,
    retiredOperations: ['INSERT_INLINE_COMPONENT', 'RECONNECT_ENDPOINTS'],
    replacements: {
      INSERT_INLINE_COMPONENT: 'Place component',
      RECONNECT_ENDPOINTS: 'Connect ends',
    },
    before,
    after,
  };
  await mkdir('reports/qualification', { recursive: true });
  await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  await testInfo.attach('duplicate-operation-retirement', {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json',
  });
  await testInfo.attach('duplicate-operation-retirement-screenshot', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

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
  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector('[data-role="topology-edit-render-host"]')
      ?.__topologyEditAuthoringController?.professionalRuntime?.catalogue
  ))).toBe(true);
  await page.evaluate(() => {
    const controller = document.querySelector('[data-role="topology-edit-render-host"]')
      ?.__topologyEditAuthoringController;
    if (!controller) throw new Error('Mounted production 3D Edit controller is unavailable.');
    globalThis.__DUPLICATE_RETIREMENT_CONTROLLER__ = controller;
  });
  return host;
}

async function engineeringState(page) {
  return page.evaluate(() => {
    const controller = globalThis.__DUPLICATE_RETIREMENT_CONTROLLER__;
    const topology = controller.session.currentTopology();
    const journal = controller.session.journal;
    return {
      sourceHash: topology.sourceHash,
      canonicalHash: topology.canonicalTopologyHash,
      journalHash: journal.journalHash,
      activeLedgerHash: journal.activeLedgerHash,
      sessionVersion: journal.sessionVersion,
      activeCommandIds: [...journal.activeCommandIds],
      nodeCount: topology.nodes.length,
      edgeCount: topology.edges.length,
    };
  });
}
