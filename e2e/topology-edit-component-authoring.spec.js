import { expect, test } from '@playwright/test';

const FLANGE_RECORD_ID = 'FLANGE-DN100-600-RF-B';
const REDUCER_RECORD_ID = 'REDUCER-DN150-DN100-CONC-A';

test.beforeEach(async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1680, height: 1100 });
  await page.addInitScript(() => globalThis.localStorage?.clear());
});

test('production Place component authors flange from a real WebGL edge pick with automatic qualification', async ({ page }, testInfo) => {
  const diagnostics = collectBrowserDiagnostics(page);
  const host = await openProductionController(page);
  const initial = await topologySnapshot(page);
  const target = await eligibleHostEdge(page, 100, 114.3, 120);

  await fitAllStable(page);
  const pick = await selectCanonicalEdgeFromCanvas(page, host, target.id);
  expect(pick.actual.pickedId).toBe(target.id);
  await activatePlacementFamily(page, 'flange');
  await expect(host).toHaveAttribute('data-topology-edit-authoring-tool', 'FLANGE');
  await expect(host).toHaveAttribute('data-topology-edit-authoring-catalogue-option-count', '2');
  await page.locator('[data-authoring-field="catalogueRecordId"]')
    .selectOption(FLANGE_RECORD_ID);
  await expect(page.locator('[data-authoring-field="flangeType"]')).toBeDisabled();
  await expect(page.locator('[data-authoring-field="componentLengthMm"]')).toHaveValue('120');

  const preview = await expectAutomaticQualification(page, host, initial, 1, 'Apply flange');
  expect(preview.canonicalHash).toBe(initial.canonicalHash);
  expect(preview.journalHash).toBe(initial.journalHash);

  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect.poll(() => topologySnapshot(page).then((row) => row.canonicalHash))
    .toBe(initial.canonicalHash);
  await expect.poll(() => ghostChildCount(page)).toBe(0);

  await activatePlacementFamily(page, 'flange');
  await page.locator('[data-authoring-field="catalogueRecordId"]')
    .selectOption(FLANGE_RECORD_ID);
  await expectAutomaticQualification(page, host, initial, 1, 'Apply flange');
  const applied = await applyQualifiedPlacement(page, host, 'Apply flange');
  expect(applied.inserted).toMatchObject({
    entityType: 'FLANGE',
    catalogueRecordId: FLANGE_RECORD_ID,
    componentLengthMm: 120,
    componentMassKg: 29.5,
    flangeType: 'WELD_NECK',
    derivedFromEdgeId: target.id,
  });
  expect(applied.inserted.catalogueBinding.materialSpecification).toBe('ASTM A105');
  await verifyUndoRedo(page, host, initial, applied);
  await assertBrowserDiagnostics(diagnostics);
  await attachScreenshot(page, testInfo, 'topology-edit-contextual-flange-placement');
});

test('production Place component authors reducer with automatic ghost and validation', async ({ page }, testInfo) => {
  const diagnostics = collectBrowserDiagnostics(page);
  const host = await openProductionController(page);
  const initial = await topologySnapshot(page);
  const target = await eligibleHostEdge(page, 150, 168.3, 300, 'P-003');

  await selectCanonicalEdgeFromTree(page, host, target.id);
  await activatePlacementFamily(page, 'reducer');
  await expect(host).toHaveAttribute('data-topology-edit-authoring-tool', 'REDUCER');
  await page.locator('[data-authoring-field="catalogueRecordId"]')
    .selectOption(REDUCER_RECORD_ID);
  await expect(page.locator('[data-authoring-field="inlineDirection"]')).toHaveValue('FROM_TO');
  await expect(page.locator('[data-authoring-field="fromNominalSizeMm"]')).toHaveValue('150');
  await expect(page.locator('[data-authoring-field="toNominalSizeMm"]')).toHaveValue('100');

  const preview = await expectAutomaticQualification(page, host, initial, 1, 'Apply reducer');
  expect(preview.canonicalHash).toBe(initial.canonicalHash);
  expect(preview.journalHash).toBe(initial.journalHash);
  const applied = await applyQualifiedPlacement(page, host, 'Apply reducer');
  expect(applied.inserted).toMatchObject({
    entityType: 'REDUCER',
    catalogueRecordId: REDUCER_RECORD_ID,
    componentLengthMm: 300,
    componentMassKg: 11.8,
    reducerType: 'CONCENTRIC',
    insertionDirection: 'FROM_TO',
    derivedFromEdgeId: target.id,
  });
  expect(applied.inserted.catalogueBinding.secondaryNominalSizeMm).toBe(100);
  await verifyUndoRedo(page, host, initial, applied);
  await assertBrowserDiagnostics(diagnostics);
  await attachScreenshot(page, testInfo, 'topology-edit-contextual-reducer-placement');
});

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
    globalThis.__COMPONENT_AUTHORING_CONTROLLER__ = controller;
  });
  const panel = host.locator('details[data-panel-kind="authoring"]');
  if (!(await panel.evaluate((element) => element.open))) {
    await panel.locator(':scope > summary').click();
  }
  await expect(page.locator('[data-role="topology-edit-authoring"]')).toBeVisible();
  await expect(page.locator('[data-role="component-placement-family-picker"]')).toBeVisible();
  return host;
}

async function activatePlacementFamily(page, family) {
  const picker = page.locator('[data-role="component-placement-family-picker"]');
  if (!(await picker.evaluate((element) => element.open))) {
    await picker.locator(':scope > summary').click();
  }
  await picker.locator(`[data-action="activate-authoring-${family}"]`).click();
  await expect(picker.locator(':scope > summary')).toContainText('Place component');
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

async function fitAllStable(page) {
  await page.evaluate(async () => {
    const controller = globalThis.__COMPONENT_AUTHORING_CONTROLLER__;
    controller.viewportBackend.fitAll({ remember: false });
    await new Promise((resolve) => requestAnimationFrame(() => (
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    )));
  });
}

async function selectCanonicalEdgeFromCanvas(page, host, edgeId) {
  const pick = await resolveEdgePickPoint(page, edgeId);
  const canvas = page.locator(
    '[data-role="topology-edit-canvas-mount"] canvas[data-viewport-backend="topology-edit-webgl"]',
  );
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Production WebGL canvas has no bounding box.');
  await canvas.click({ position: { x: pick.x - box.x, y: pick.y - box.y } });
  const actual = await page.evaluate(() => ({
    pickedId: globalThis.__COMPONENT_AUTHORING_CONTROLLER__.viewportBackend.lastSelectionPick?.objectId ?? null,
    selectedEdgeId: globalThis.__COMPONENT_AUTHORING_CONTROLLER__.selection?.edgeId ?? null,
  }));
  expect(actual.pickedId).toBe(edgeId);
  expect(actual.selectedEdgeId).toBe(edgeId);
  await expect(host).toHaveAttribute('data-topology-edit-selection-primary-id', edgeId);
  return { edgeId, ...pick, actual };
}

async function resolveEdgePickPoint(page, edgeId) {
  return page.evaluate((targetId) => {
    const controller = globalThis.__COMPONENT_AUTHORING_CONTROLLER__;
    const backend = controller.viewportBackend;
    const topology = controller.session.currentTopology();
    const edge = topology.edges.find((row) => row.id === targetId);
    const from = topology.nodes.find((row) => row.id === edge?.fromNodeId)?.position;
    const to = topology.nodes.find((row) => row.id === edge?.toNodeId)?.position;
    if (!edge || !from || !to) throw new Error(`Missing edge geometry for ${targetId}.`);
    backend.engineeringRoot.updateMatrixWorld(true);
    backend.activeCamera.updateMatrixWorld(true);
    backend.activeCamera.updateProjectionMatrix();
    const rect = backend.renderer.domElement.getBoundingClientRect();
    const fractions = [0.5, 0.35, 0.65, 0.2, 0.8];
    const radii = [0, 2, 4, 6, 8, 10, 12, 16, 20, 24];
    const directions = [[1,0],[.7071,.7071],[0,1],[-.7071,.7071],[-1,0],[-.7071,-.7071],[0,-1],[.7071,-.7071]];
    for (const fraction of fractions) {
      const point = {
        x: from.x + ((to.x - from.x) * fraction),
        y: from.y + ((to.y - from.y) * fraction),
        z: from.z + ((to.z - from.z) * fraction),
      };
      const vector = backend.activeCamera.position.clone().set(point.x, point.y, point.z);
      vector.applyMatrix4(backend.engineeringRoot.matrixWorld).project(backend.activeCamera);
      const center = {
        x: rect.left + ((vector.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - vector.y) / 2) * rect.height,
      };
      for (const radius of radii) {
        const offsets = radius === 0 ? [[0, 0]] : directions.map(([x, y]) => [x * radius, y * radius]);
        for (const [dx, dy] of offsets) {
          const x = center.x + dx;
          const y = center.y + dy;
          const pick = backend.pickAt(x, y);
          if (pick?.objectId === targetId) return { x, y, radiusPx: radius, fraction };
        }
      }
    }
    throw new Error(`COMPONENT_EDGE_UNREACHABLE_IN_STABLE_VIEW: ${targetId}`);
  }, edgeId);
}

async function eligibleHostEdge(
  page,
  nominalSizeMm,
  outsideDiameterMm,
  componentLengthMm,
  preferredComponentKey = null,
) {
  return page.evaluate(({ nominal, outside, length, preferred }) => {
    const topology = globalThis.__COMPONENT_AUTHORING_CONTROLLER__.session.currentTopology();
    const nodes = new Map(topology.nodes.map((node) => [node.id, node]));
    const dependentEdgeIds = new Set();
    for (const collection of ['junctions', 'supports', 'boundaries', 'rigids', 'bends']) {
      for (const record of topology[collection] ?? []) {
        if (record.edgeId) dependentEdgeIds.add(record.edgeId);
        for (const edgeId of record.edgeIds ?? []) dependentEdgeIds.add(edgeId);
      }
    }
    const candidates = topology.edges.flatMap((edge) => {
      const type = String(edge.entityType ?? '').toUpperCase();
      if (!['PIPE', 'STRAIGHT', 'STRAIGHT_ELEMENT'].includes(type)) return [];
      if (dependentEdgeIds.has(edge.id)) return [];
      if (preferred && edge.componentKey !== preferred) return [];
      if (Math.abs(Number(edge.diameterMm) - nominal) > 1e-9) return [];
      if (Math.abs(Number(edge.outsideDiameterMm) - outside) > 1e-9) return [];
      const from = nodes.get(edge.fromNodeId)?.position;
      const to = nodes.get(edge.toNodeId)?.position;
      if (!from || !to) return [];
      const edgeLengthMm = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
      return edgeLengthMm > length + 2 ? [{ id: edge.id, lengthMm: edgeLengthMm }] : [];
    }).sort((left, right) => left.id.localeCompare(right.id));
    if (!candidates.length) {
      throw new Error(`No dependency-free DN${nominal} host edge accepts ${length} mm.`);
    }
    return candidates[0];
  }, {
    nominal: nominalSizeMm,
    outside: outsideDiameterMm,
    length: componentLengthMm,
    preferred: preferredComponentKey,
  });
}

async function expectAutomaticQualification(page, host, prior, commandCount, applyLabel) {
  await expect(host).toHaveAttribute('data-topology-edit-component-placement-automatic', 'true');
  await expect.poll(() => host.getAttribute('data-topology-edit-authoring-command-count'))
    .toBe(String(commandCount));
  await expect.poll(() => ghostChildCount(page)).toBeGreaterThan(0);
  await expect.poll(() => host.getAttribute('data-topology-edit-authoring-phase'))
    .toBe('READY_TO_APPLY');
  await expect(host).toHaveAttribute('data-topology-edit-authoring-blocking-issue-count', '0');
  const evidence = page.locator('[data-role="component-placement-engineering-evidence"]');
  await expect(evidence).not.toHaveAttribute('open', '');
  await expect(evidence.locator('[data-action="preview-authoring-operation"]')).toBeHidden();
  await expect(evidence.locator('[data-action="validate-authoring-operation"]')).toBeHidden();
  await expect(page.getByRole('button', { name: applyLabel, exact: true })).toBeEnabled();
  const snapshot = await topologySnapshot(page);
  expect(snapshot.canonicalHash).toBe(prior.canonicalHash);
  expect(snapshot.journalHash).toBe(prior.journalHash);
  return snapshot;
}

async function applyQualifiedPlacement(page, host, applyLabel) {
  const priorTransactionHash = await host.getAttribute(
    'data-topology-edit-authoring-transaction-hash',
  ) || '';
  await page.getByRole('button', { name: applyLabel, exact: true }).click();
  await expect.poll(() => host.getAttribute('data-topology-edit-authoring-transaction-hash'))
    .not.toBe(priorTransactionHash);
  await expect.poll(() => ghostChildCount(page)).toBe(0);
  return topologySnapshot(page);
}

async function ghostChildCount(page) {
  return page.evaluate(() => (
    globalThis.__COMPONENT_AUTHORING_CONTROLLER__.viewportBackend.groups.ghostGroup.children.length
  ));
}

async function verifyUndoRedo(page, host, prior, applied) {
  const transactionHash = await host.getAttribute('data-topology-edit-authoring-transaction-hash');
  await page.locator('[data-action="undo"]').click();
  await expect.poll(() => controllerCanonicalHash(page)).toBe(prior.canonicalHash);
  expect((await topologySnapshot(page)).inserted).toBeNull();
  await page.locator('[data-action="redo"]').click();
  await expect.poll(() => controllerCanonicalHash(page)).toBe(applied.canonicalHash);
  await expect(host).toHaveAttribute('data-topology-edit-authoring-transaction-hash', transactionHash);
  expect((await topologySnapshot(page)).inserted?.catalogueRecordId)
    .toBe(applied.inserted.catalogueRecordId);
}

async function controllerCanonicalHash(page) {
  return page.evaluate(() => (
    globalThis.__COMPONENT_AUTHORING_CONTROLLER__.session.currentTopology().canonicalTopologyHash
  ));
}

async function topologySnapshot(page) {
  return page.evaluate(() => {
    const controller = globalThis.__COMPONENT_AUTHORING_CONTROLLER__;
    const topology = controller.session.currentTopology();
    const insertedRows = topology.edges.filter((edge) => (
      edge.topologyOperation === 'INSERT_INLINE_COMPONENT'
    ));
    if (insertedRows.length > 1) {
      throw new Error(`Expected at most one inserted component, received ${insertedRows.length}.`);
    }
    return {
      canonicalHash: topology.canonicalTopologyHash,
      journalHash: controller.session.journal.journalHash,
      activeCommandCount: controller.session.journal.activeCommandIds.length,
      nodeCount: topology.nodes.length,
      edgeCount: topology.edges.length,
      inserted: insertedRows[0] ?? null,
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
  expect(diagnostics.consoleErrors.filter(isCriticalConsoleError)).toEqual([]);
}

async function attachScreenshot(page, testInfo, name) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

function isCriticalConsoleError(message) {
  return [
    /ReferenceError/iu,
    /Cannot access .* before initialization/iu,
    /does not provide an export named/iu,
    /Failed to fetch dynamically imported module/iu,
    /circular import/iu,
    /WebGL context lost/iu,
    /TopologyEditAuthoringInlineComponent/iu,
  ].some((pattern) => pattern.test(message));
}
