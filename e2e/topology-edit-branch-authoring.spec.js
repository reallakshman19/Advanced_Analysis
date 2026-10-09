import { expect, test } from '@playwright/test';

const CASES = [
  { recordId: 'TEE-DN100-DN50-BW-A', family: 'TEE', branchSize: 50, length: 360 },
  { recordId: 'OLET-DN100-DN25-WELDOLET-A', family: 'OLET', branchSize: 25, length: 420 },
];

test.beforeEach(async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1680, height: 1100 });
  await page.addInitScript(() => globalThis.localStorage?.clear());
});

for (const scenario of CASES) {
  test(`production Place component authors one governed ${scenario.family} branch atomically`, async ({ page }, testInfo) => {
    const diagnostics = collectBrowserDiagnostics(page);
    const host = await openProductionController(page);
    const initial = await topologySnapshot(page);
    const target = await eligibleHostEdge(page, 'P-005');

    await selectCanonicalEdgeFromTree(page, host, target.id);
    await activateBranchPlacement(page);
    await expect(host).toHaveAttribute('data-topology-edit-authoring-tool', 'BRANCH');
    await expect(host).toHaveAttribute('data-topology-edit-authoring-catalogue-option-count', '2');
    await page.locator('[data-authoring-field="catalogueRecordId"]')
      .selectOption(scenario.recordId);
    await fillAndCommit(page, 'clockingDeg', '0');
    await fillAndCommit(page, 'branchPipeLengthMm', String(scenario.length));
    await expect(page.locator('[data-authoring-field="branchFamily"]')).toBeDisabled();
    await expect(page.locator('[data-authoring-field="componentMassKg"]')).toBeDisabled();
    await expect(host).toHaveAttribute(
      'data-topology-edit-authoring-branch-family',
      scenario.family,
    );

    await expect(host).toHaveAttribute('data-topology-edit-component-placement-automatic', 'true');
    await expect.poll(() => host.getAttribute('data-topology-edit-authoring-command-count')).toBe('1');
    await expect.poll(() => page.evaluate(() => (
      globalThis.__BRANCH_AUTHORING_CONTROLLER__.viewportBackend.groups.ghostGroup.children.length
    ))).toBeGreaterThan(0);
    await expect.poll(() => host.getAttribute('data-topology-edit-authoring-phase')).toBe('READY_TO_APPLY');
    await expect(host).toHaveAttribute('data-topology-edit-authoring-blocking-issue-count', '0');
    const preview = await topologySnapshot(page);
    expect(preview.canonicalHash).toBe(initial.canonicalHash);
    expect(preview.journalHash).toBe(initial.journalHash);
    const engineeringEvidence = page.locator('[data-role="component-placement-engineering-evidence"]');
    await expect(engineeringEvidence).not.toHaveAttribute('open', '');
    await expect(engineeringEvidence.locator('[data-action="preview-authoring-operation"]')).toBeHidden();
    await expect(engineeringEvidence.locator('[data-action="validate-authoring-operation"]')).toBeHidden();

    const priorTransactionHash = await host.getAttribute(
      'data-topology-edit-authoring-transaction-hash',
    ) || '';
    const apply = page.getByRole('button', { name: 'Apply branch', exact: true });
    await expect(apply).toBeEnabled();
    await apply.click();
    await expect.poll(() => host.getAttribute('data-topology-edit-authoring-transaction-hash'))
      .not.toBe(priorTransactionHash);

    const applied = await topologySnapshot(page);
    expect(applied.components).toHaveLength(1);
    expect(applied.components[0].entityType).toBe(scenario.family);
    expect(applied.components[0].catalogueRecordId).toBe(scenario.recordId);
    expect(applied.components[0].catalogueRecordHash).toMatch(/^fnv1a64:[0-9a-f]{16}$/u);
    expect(applied.components[0].catalogueSourceHash).toMatch(/^sha256:/u);
    expect(applied.components[0].diameterMm).toBe(scenario.branchSize);
    expect(applied.junctionDegree).toBe(3);
    expect(applied.minimumEdgeLengthMm).toBeGreaterThan(0);

    const transactionHash = await host.getAttribute(
      'data-topology-edit-authoring-transaction-hash',
    );
    await page.locator('[data-action="undo"]').click();
    await expect.poll(() => controllerCanonicalHash(page)).toBe(initial.canonicalHash);
    expect((await topologySnapshot(page)).components).toHaveLength(0);
    await page.locator('[data-action="redo"]').click();
    await expect.poll(() => controllerCanonicalHash(page)).toBe(applied.canonicalHash);
    await expect(host).toHaveAttribute(
      'data-topology-edit-authoring-transaction-hash',
      transactionHash,
    );
    expect((await topologySnapshot(page)).junctionDegree).toBe(3);

    await assertBrowserDiagnostics(diagnostics);
    await testInfo.attach(`topology-edit-contextual-${scenario.family.toLowerCase()}-branch`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
}

async function openProductionController(page) {
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
      ?.__topologyEditAuthoringController
      ?.professionalRuntime
      ?.catalogue
  ))).toBe(true);
  await page.evaluate(() => {
    const controller = document.querySelector('[data-role="topology-edit-render-host"]')
      ?.__topologyEditAuthoringController;
    if (!controller) throw new Error('Mounted production authoring controller is unavailable.');
    globalThis.__BRANCH_AUTHORING_CONTROLLER__ = controller;
  });
  const panel = host.locator('details[data-panel-kind="authoring"]');
  if (!(await panel.evaluate((element) => element.open))) {
    await panel.locator(':scope > summary').click();
  }
  await expect(page.locator('[data-role="component-placement-family-picker"]')).toBeVisible();
  return host;
}

async function activateBranchPlacement(page) {
  const picker = page.locator('[data-role="component-placement-family-picker"]');
  if (!(await picker.evaluate((element) => element.open))) {
    await picker.locator(':scope > summary').click();
  }
  await picker.locator('[data-action="activate-authoring-branch"]').click();
  await expect(picker.locator(':scope > summary')).toContainText('Tee / Olet branch');
}

async function fillAndCommit(page, key, value) {
  const control = page.locator(`[data-authoring-field="${key}"]`);
  await control.fill(value);
  await control.blur();
}

async function selectCanonicalEdgeFromTree(page, host, edgeId) {
  const panel = host.locator('details[data-panel-kind="topology-edit-object-tree"]');
  if (!(await panel.evaluate((element) => element.open))) {
    await panel.locator(':scope > summary').click();
  }
  const tree = panel.locator('[data-role="topology-edit-object-tree"]');
  const filter = tree.locator('[data-role="topology-edit-object-tree-filter"]');
  await filter.fill(edgeId);
  const row = tree.locator(`[data-canonical-id="${edgeId}"]`);
  await expect(row).toHaveCount(1);
  await row.locator('[data-object-tree-select]').click();
  await expect(host).toHaveAttribute('data-topology-edit-selection-primary-id', edgeId);
  await filter.fill('');
}

async function eligibleHostEdge(page, componentKey) {
  return page.evaluate((preferred) => {
    const topology = globalThis.__BRANCH_AUTHORING_CONTROLLER__.session.currentTopology();
    const matches = topology.edges.filter((edge) => (
      edge.componentKey === preferred
      && Number(edge.diameterMm) === 100
      && Number(edge.outsideDiameterMm) === 114.3
      && !(topology.junctions ?? []).some((row) => row.edgeIds?.includes(edge.id))
      && !(topology.supports ?? []).some((row) => row.edgeId === edge.id)
      && !(topology.boundaries ?? []).some((row) => row.edgeId === edge.id)
      && !(topology.rigids ?? []).some((row) => row.edgeId === edge.id)
      && !(topology.bends ?? []).some((row) => row.edgeIds?.includes(edge.id))
    ));
    if (matches.length !== 1) {
      throw new Error(`Expected one eligible ${preferred} edge; received ${matches.length}.`);
    }
    return { id: matches[0].id };
  }, componentKey);
}

async function controllerCanonicalHash(page) {
  return page.evaluate(() => (
    globalThis.__BRANCH_AUTHORING_CONTROLLER__.session.currentTopology().canonicalTopologyHash
  ));
}

async function topologySnapshot(page) {
  return page.evaluate(() => {
    const controller = globalThis.__BRANCH_AUTHORING_CONTROLLER__;
    const topology = controller.session.currentTopology();
    const nodes = new Map(topology.nodes.map((node) => [node.id, node]));
    const components = topology.edges.filter((edge) => (
      edge.topologyOperation === 'INSERT_BRANCH_COMPONENT'
      && edge.branchComponentRole === 'BRANCH_COMPONENT'
    ));
    const junction = topology.junctions.find((row) => (
      row.topologyOperation === 'INSERT_BRANCH_COMPONENT'
    ));
    const lengths = topology.edges.map((edge) => {
      const from = nodes.get(edge.fromNodeId).position;
      const to = nodes.get(edge.toNodeId).position;
      return Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    });
    const junctionDegree = junction
      ? topology.edges.filter((edge) => (
        edge.fromNodeId === junction.nodeId || edge.toNodeId === junction.nodeId
      )).length
      : 0;
    return {
      canonicalHash: topology.canonicalTopologyHash,
      journalHash: controller.session.journal.journalHash,
      activeCommandCount: controller.session.journal.activeCommandIds.length,
      components,
      junctionDegree,
      minimumEdgeLengthMm: Math.min(...lengths),
    };
  });
}

function collectBrowserDiagnostics(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  return { pageErrors, consoleErrors };
}

async function assertBrowserDiagnostics(diagnostics) {
  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.consoleErrors.filter((message) => [
    /ReferenceError/iu,
    /Cannot access .* before initialization/iu,
    /does not provide an export named/iu,
    /Failed to fetch dynamically imported module/iu,
    /circular import/iu,
    /WebGL context lost/iu,
    /BranchAuthoring/iu,
  ].some((pattern) => pattern.test(message)))).toEqual([]);
}
