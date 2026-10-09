import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const REPORT = 'reports/qualification/component-placement-contextual-evidence.json';
const FLANGE_RECORD_ID = 'FLANGE-DN100-600-RF-B';
const PIPE_TYPES = new Set(['PIPE', 'STRAIGHT', 'STRAIGHT_ELEMENT']);

test('component placement emits exact WebGL, catalogue, candidate, transaction, and replay evidence', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1680, height: 1100 });
  await page.addInitScript(() => globalThis.localStorage?.clear());

  const host = await openController(page);
  const before = await topologyLedger(page);
  const target = await eligibleHostEdge(page);
  await fitAllStable(page);
  const productionPick = await selectEdgeFromCanvas(page, host, target.id);

  await activateFlange(page);
  await page.locator('[data-authoring-field="catalogueRecordId"]').selectOption(FLANGE_RECORD_ID);
  await waitReady(page, host);
  const firstPreview = await engineeringEvidence(page);
  assertPreviewAuthority(firstPreview, before);

  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect.poll(() => topologyLedger(page).then((row) => row.canonicalHash)).toBe(before.canonicalHash);
  const cancelled = await topologyLedger(page);
  expect(cancelled.journalHash).toBe(before.journalHash);
  expect(await ghostCount(page)).toBe(0);

  await activateFlange(page);
  await page.locator('[data-authoring-field="catalogueRecordId"]').selectOption(FLANGE_RECORD_ID);
  await waitReady(page, host);
  const acceptedPreview = await engineeringEvidence(page);
  assertPreviewAuthority(acceptedPreview, before);

  await page.getByRole('button', { name: 'Apply flange', exact: true }).click();
  await expect.poll(() => host.getAttribute('data-topology-edit-authoring-transaction-hash')).not.toBe('');
  const applied = await engineeringEvidence(page);
  expect(applied.transaction?.transactionHash).toBeTruthy();
  expect(applied.transaction?.priorCanonicalHash).toBe(before.canonicalHash);
  expect(applied.transaction?.priorJournalHash).toBe(before.journalHash);
  expect(applied.transaction?.resultingCanonicalHash).toBe(applied.topology.canonicalHash);
  expect(applied.transaction?.resultingJournalHash).toBe(applied.topology.journalHash);
  expect(applied.topology.canonicalHash).not.toBe(before.canonicalHash);
  expect(applied.topology.journalHash).not.toBe(before.journalHash);

  await page.locator('[data-action="undo"]').click();
  await expect.poll(() => topologyLedger(page).then((row) => row.canonicalHash)).toBe(before.canonicalHash);
  const undone = await topologyLedger(page);
  expect(undone.activeLedgerHash).toBe(before.activeLedgerHash);
  expect(undone.activeCommandIds).toEqual(before.activeCommandIds);

  await page.locator('[data-action="redo"]').click();
  await expect.poll(() => topologyLedger(page).then((row) => row.canonicalHash)).toBe(applied.topology.canonicalHash);
  const redone = await topologyLedger(page);
  expect(redone.activeLedgerHash).toBe(applied.topology.activeLedgerHash);
  expect(redone.activeCommandIds).toEqual(applied.topology.activeCommandIds);

  const report = {
    schema: 'TopologyEditComponentPlacementEvidence.v1',
    candidateHead: process.env.TOPOLOGY_EDIT_TARGET_HEAD_SHA || null,
    status: 'PASS',
    fixture: 'topology-edit-20-element-demo',
    family: 'FLANGE',
    selectedRecordId: FLANGE_RECORD_ID,
    target,
    productionPick,
    before,
    firstPreview,
    cancelled,
    acceptedPreview,
    applied,
    undone,
    redone,
  };
  await mkdir('reports/qualification', { recursive: true });
  await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  await testInfo.attach('component-placement-contextual-evidence', {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json',
  });
  await testInfo.attach('component-placement-contextual-evidence-screenshot', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

function assertPreviewAuthority(preview, before) {
  expect(preview.topology.canonicalHash).toBe(before.canonicalHash);
  expect(preview.topology.journalHash).toBe(before.journalHash);
  expect(preview.plan?.planHash).toBeTruthy();
  expect(preview.candidate?.candidateHash).toBeTruthy();
  expect(preview.validation?.validationHash).toBeTruthy();
  expect(preview.validation?.status).toBe('READY_TO_APPLY');
  expect(preview.catalogue.selectedRecord?.recordId).toBe(FLANGE_RECORD_ID);
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
  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector('[data-role="topology-edit-render-host"]')
      ?.__topologyEditAuthoringController?.professionalRuntime?.catalogue
  ))).toBe(true);
  await page.evaluate(() => {
    const controller = document.querySelector('[data-role="topology-edit-render-host"]')
      ?.__topologyEditAuthoringController;
    if (!controller) throw new Error('Mounted production authoring controller is unavailable.');
    globalThis.__COMPONENT_PLACEMENT_EVIDENCE_CONTROLLER__ = controller;
  });
  const panel = host.locator('details[data-panel-kind="authoring"]');
  if (!(await panel.evaluate((element) => element.open))) await panel.locator(':scope > summary').click();
  await expect(page.locator('[data-role="component-placement-family-picker"]')).toBeVisible();
  return host;
}

async function activateFlange(page) {
  const picker = page.locator('[data-role="component-placement-family-picker"]');
  if (!(await picker.evaluate((element) => element.open))) await picker.locator(':scope > summary').click();
  await picker.locator('[data-action="activate-authoring-flange"]').click();
  await expect.poll(() => page.locator('[data-authoring-field="catalogueRecordId"] option').count())
    .toBeGreaterThan(1);
}

async function waitReady(page, host) {
  await expect.poll(() => host.getAttribute('data-topology-edit-authoring-phase')).toBe('READY_TO_APPLY');
  await expect.poll(() => ghostCount(page)).toBeGreaterThan(0);
  await expect(host).toHaveAttribute('data-topology-edit-authoring-blocking-issue-count', '0');
  await expect(page.getByRole('button', { name: 'Apply flange', exact: true })).toBeEnabled();
}

async function engineeringEvidence(page) {
  return page.evaluate((recordId) => {
    const controller = globalThis.__COMPONENT_PLACEMENT_EVIDENCE_CONTROLLER__;
    const runtime = controller.authoringRuntime;
    const professional = controller.professionalRuntime;
    const topology = controller.session.currentTopology();
    const journal = controller.session.journal;
    const custody = professional.catalogueCustody;
    const record = professional.catalogue.records.find((row) => row.recordId === recordId);
    const transaction = runtime.transaction;
    return {
      topology: ledger(topology, journal),
      catalogue: {
        custodyHash: custody?.custodyHash ?? null,
        dataset: custody?.dataset ?? null,
        source: custody?.source ?? null,
        catalogueId: professional.catalogue.catalogueId,
        catalogueVersion: professional.catalogue.catalogueVersion,
        catalogueHash: professional.catalogue.catalogueHash,
        sourceHash: professional.catalogue.authority.sourceHash,
        selectedRecord: record ? {
          recordId: record.recordId,
          recordHash: record.recordHash,
          sourceReference: record.sourceReference,
          componentType: record.componentType,
          nominalSizeMm: record.nominalSizeMm,
          outsideDiameterMm: record.outsideDiameterMm,
        } : null,
      },
      plan: runtime.plan ? {
        planHash: runtime.plan.planHash,
        basisHash: runtime.plan.basisHash,
        operationType: runtime.plan.operationType ?? runtime.state.tool,
      } : null,
      candidate: runtime.candidate ? {
        candidateHash: runtime.candidate.candidateHash,
        planHash: runtime.candidate.planHash,
        priorJournalHash: runtime.candidate.priorJournalHash,
        priorCanonicalHash: runtime.candidate.priorCanonicalHash,
        resultingJournalHash: runtime.candidate.resultingJournalHash,
        resultingCanonicalHash: runtime.candidate.resultingCanonicalHash,
        commandCount: runtime.candidate.commandCount,
        commandIds: runtime.candidate.commandIds,
        changedCanonicalIds: runtime.candidate.changedCanonicalIds,
      } : null,
      validation: runtime.validation ? {
        validationHash: runtime.validation.validationHash,
        candidateHash: runtime.validation.candidateHash,
        planHash: runtime.validation.planHash,
        validatedTopologyHash: runtime.validation.validatedTopologyHash,
        status: runtime.validation.status,
        blockingIssueCount: runtime.validation.blockingIssueCount,
      } : null,
      transaction: transaction ? {
        transactionHash: transaction.transactionHash,
        candidateHash: transaction.candidateHash,
        planHash: transaction.planHash,
        validationHash: transaction.validationHash,
        priorJournalHash: transaction.priorJournalHash,
        priorCanonicalHash: transaction.priorCanonicalHash,
        resultingJournalHash: transaction.resultingJournalHash,
        resultingCanonicalHash: transaction.resultingCanonicalHash,
        commandCount: transaction.commandCount,
        commandIds: transaction.commandIds,
        certificationHashes: transaction.certificationHashes,
      } : null,
    };

    function ledger(currentTopology, currentJournal) {
      return {
        sourceHash: currentTopology.sourceHash,
        canonicalHash: currentTopology.canonicalTopologyHash,
        journalHash: currentJournal.journalHash,
        activeLedgerHash: currentJournal.activeLedgerHash,
        sessionVersion: currentJournal.sessionVersion,
        activeCommandIds: [...currentJournal.activeCommandIds],
        commandTypes: currentJournal.history.map((row) => row.request?.commandType ?? null),
        nodeCount: currentTopology.nodes.length,
        edgeCount: currentTopology.edges.length,
      };
    }
  }, FLANGE_RECORD_ID);
}

async function topologyLedger(page) {
  return page.evaluate(() => {
    const controller = globalThis.__COMPONENT_PLACEMENT_EVIDENCE_CONTROLLER__;
    const topology = controller.session.currentTopology();
    const journal = controller.session.journal;
    return {
      sourceHash: topology.sourceHash,
      canonicalHash: topology.canonicalTopologyHash,
      journalHash: journal.journalHash,
      activeLedgerHash: journal.activeLedgerHash,
      sessionVersion: journal.sessionVersion,
      activeCommandIds: [...journal.activeCommandIds],
      commandTypes: journal.history.map((row) => row.request?.commandType ?? null),
      nodeCount: topology.nodes.length,
      edgeCount: topology.edges.length,
    };
  });
}

async function eligibleHostEdge(page) {
  return page.evaluate((pipeTypes) => {
    const topology = globalThis.__COMPONENT_PLACEMENT_EVIDENCE_CONTROLLER__.session.currentTopology();
    const nodes = new Map(topology.nodes.map((node) => [node.id, node]));
    const dependent = new Set();
    for (const collection of ['junctions', 'supports', 'boundaries', 'rigids', 'bends']) {
      for (const row of topology[collection] ?? []) {
        if (row.edgeId) dependent.add(row.edgeId);
        for (const edgeId of row.edgeIds ?? []) dependent.add(edgeId);
      }
    }
    const candidates = topology.edges.flatMap((edge) => {
      if (!pipeTypes.includes(String(edge.entityType ?? '').toUpperCase())) return [];
      if (dependent.has(edge.id)) return [];
      if (Number(edge.diameterMm) !== 100 || Number(edge.outsideDiameterMm) !== 114.3) return [];
      const from = nodes.get(edge.fromNodeId)?.position;
      const to = nodes.get(edge.toNodeId)?.position;
      if (!from || !to) return [];
      const lengthMm = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
      return lengthMm > 122 ? [{ id: edge.id, lengthMm, componentKey: edge.componentKey }] : [];
    }).sort((left, right) => left.id.localeCompare(right.id));
    if (!candidates.length) throw new Error('No dependency-free straight DN100 pipe accepts a 120 mm flange.');
    return candidates[0];
  }, [...PIPE_TYPES]);
}

async function fitAllStable(page) {
  await page.evaluate(async () => {
    const backend = globalThis.__COMPONENT_PLACEMENT_EVIDENCE_CONTROLLER__.viewportBackend;
    backend.fitAll({ remember: false });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  });
}

async function selectEdgeFromCanvas(page, host, edgeId) {
  const pick = await resolveEdgePickPoint(page, edgeId);
  const canvas = page.locator('[data-role="topology-edit-canvas-mount"] canvas[data-viewport-backend="topology-edit-webgl"]');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Production WebGL canvas has no bounding box.');
  await canvas.click({ position: { x: pick.x - box.x, y: pick.y - box.y } });
  const actual = await page.evaluate(() => {
    const controller = globalThis.__COMPONENT_PLACEMENT_EVIDENCE_CONTROLLER__;
    return {
      pickedId: controller.viewportBackend.lastSelectionPick?.objectId ?? null,
      selectedEdgeId: controller.selection?.edgeId ?? null,
    };
  });
  expect(actual.pickedId).toBe(edgeId);
  expect(actual.selectedEdgeId).toBe(edgeId);
  await expect(host).toHaveAttribute('data-topology-edit-selection-primary-id', edgeId);
  return { edgeId, ...pick, actual };
}

async function resolveEdgePickPoint(page, edgeId) {
  return page.evaluate((targetId) => {
    const controller = globalThis.__COMPONENT_PLACEMENT_EVIDENCE_CONTROLLER__;
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
    throw new Error(`COMPONENT_EVIDENCE_EDGE_UNREACHABLE: ${targetId}`);
  }, edgeId);
}

async function ghostCount(page) {
  return page.evaluate(() => (
    globalThis.__COMPONENT_PLACEMENT_EVIDENCE_CONTROLLER__.viewportBackend.groups.ghostGroup.children.length
  ));
}
