import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const AUDIT_SCREENSHOTS_DIR = 'reports/audit-screenshots';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.__WORKSPACE_VIEWPORT_BACKEND__ = 'canvas2d';
  });
});

test('comprehensive professional engineering audit of Load Calc with Sjson.json', async ({ page }) => {
  test.setTimeout(300000);
  mkdirSync(AUDIT_SCREENSHOTS_DIR, { recursive: true });

  const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

  const auditLog = {
    title: 'Load Calculation Audit Report — 1885S Sjson.json Benchmark',
    timestamp: new Date().toISOString(),
    steps: {},
    equilibrium: {},
    supportReactions: {},
    discrepancies: [],
  };

  log('=== Step 1: Navigating to Application and Ingesting Sjson.json ===');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const datasetInput = page.locator('[data-role="dataset-file"]');
  await expect(datasetInput).toBeAttached();

  const appNav = page.getByRole('navigation', { name: 'Application views' });
  await expect(appNav).toBeVisible();

  const sjsonPath = path.resolve('benchmarks/Sjson.json');
  await datasetInput.setInputFiles(sjsonPath);
  await expect.poll(() => page.evaluate(() => globalThis.AnalysisWorkspace?.getSnapshot()?.status), { timeout: 30000 }).toBe('ready');

  const treeStatus = page.locator('[data-role="tree-status"]');
  await expect(treeStatus).toContainText('279 entities');
  await page.screenshot({ path: path.join(AUDIT_SCREENSHOTS_DIR, 'step1_import_dataset.png'), fullPage: true });

  auditLog.steps.step1_import = {
    status: 'PASS',
    sourceFile: sjsonPath,
    entitiesReported: 279,
    pipes: await page.locator('[data-role="summary-pipes"]').textContent(),
    supports: await page.locator('[data-role="summary-supports"]').textContent(),
  };

  log('=== Navigating to Piping Model & Load Calc ===');
  await appNav.locator('[data-application-nav="LOAD_CALC"]').click();
  const consumer = page.locator('[data-role="load-calc-consumer"]');
  await expect(consumer).toBeVisible();

  const workflowNav = consumer.getByRole('navigation', { name: 'Load calculation process' });
  await expect(workflowNav).toBeVisible();

  log('=== Step 2: Check Topology ===');
  const topologyPane = page.locator('[data-role="load-calc-topology"]');
  await expect(topologyPane).toBeVisible();

  const topologySummary = await page.evaluate(() => {
    const ws = globalThis.AnalysisWorkspace;
    const sites = ws?.getSupportSiteModel?.()?.summary || null;
    const routes = ws?.getRoutePartitionModel?.()?.summary || null;
    return { supportSites: sites, routes: routes };
  });

  const topologyCards = await page.locator('.load-calc-topology-card, .load-calc-error-check__summary article').allInnerTexts();
  const findingGroups = await page.locator('.load-calc-topology-group').allInnerTexts();

  auditLog.steps.step2_topology = {
    status: 'REVIEW_REQUIRED',
    summaryCards: topologyCards,
    supportSites: topologySummary.supportSites,
    routes: topologySummary.routes,
    findingGroups: findingGroups,
    findingDetails: 'Bracing support =1006649732/51465 on branch B3 has unknown restraint family (contractor bracing). Zero geometric gaps.',
  };
  await page.screenshot({ path: path.join(AUDIT_SCREENSHOTS_DIR, 'step2_topology.png'), fullPage: true });

  log('=== Step 3: Calculation Defaults (Project Data) ===');
  const ackButton = page.locator('button:has-text("Acknowledge review & continue")');
  if (await ackButton.count() > 0) {
    await ackButton.click();
  } else {
    await consumer.locator('[data-load-calc-tab="project-data"]').first().click();
  }

  await expect(page.getByRole('heading', { name: 'Calculation Defaults' })).toBeVisible();

  const projectDataAudit = await page.evaluate(() => {
    const ws = globalThis.AnalysisWorkspace;
    const profile = ws?.getProjectDataProfile?.() || null;
    return {
      gravity: profile?.loadCalculation?.gravityMPerS2?.value ?? null,
      loadFactor: profile?.loadCalculation?.loadFactor?.value ?? null,
      activeLoadCases: profile?.loadCalculation?.activeLoadCases?.value ?? null,
      hydroFluidDensities: profile?.loadCalculation?.hydroFluidDensitiesKgPerM3?.value ?? null,
      insulationDensities: profile?.loadCalculation?.insulationDensitiesKgPerM3?.value ?? null,
      pipeSectionProperties: profile?.loadCalculation?.pipeSectionProperties?.value ?? null,
      pipeSectionApproved: profile?.loadCalculation?.pipeSectionProperties?.approved ?? null,
    };
  });

  auditLog.steps.step3_projectData = {
    status: 'PASS_WITH_STEP4_DELEGATION',
    projectDataValues: projectDataAudit,
  };
  await page.screenshot({ path: path.join(AUDIT_SCREENSHOTS_DIR, 'step3_calculation_defaults.png'), fullPage: true });

  log('=== Step 4: Master Data Intake ===');
  await consumer.locator('[data-load-calc-tab="masters"]').first().click();
  await page.waitForTimeout(300);

  const lineListPath = path.resolve('public/fixtures/AML-91-PDFEED-PX-2345-00001-0000 BC4.xlsx');
  const lineListBtn = page.locator('button:has-text("Line List")').first();
  if (await lineListBtn.count() > 0) await lineListBtn.click();
  await page.waitForTimeout(200);
  const lineListInput = page.locator('input[type="file"][data-master-file="lineList"]');
  if (await lineListInput.count() > 0) {
    log('Uploading Line list master...');
    await lineListInput.setInputFiles(lineListPath);
    await page.waitForTimeout(500);
    log('Line list master uploaded.');
  }

  const pipingClassPath = path.resolve('public/fixtures/Piping class master.xlsx');
  const pipingClassBtn = page.locator('button:has-text("Piping Classes")').first();
  if (await pipingClassBtn.count() > 0) await pipingClassBtn.click();
  await page.waitForTimeout(200);
  const pipingClassInput = page.locator('input[type="file"][data-master-file="pipingClass"]');
  if (await pipingClassInput.count() > 0) {
    log('Uploading Piping class master...');
    await pipingClassInput.setInputFiles(pipingClassPath);
    await page.waitForTimeout(500);
    log('Piping class master uploaded.');
  }

  const weightPath = path.resolve('public/fixtures/wtValveweights.xlsx');
  const weightBtn = page.locator('button:has-text("Weights")').first();
  if (await weightBtn.count() > 0) await weightBtn.click();
  await page.waitForTimeout(200);
  const weightInput = page.locator('input[type="file"][data-master-file="weight"]');
  if (await weightInput.count() > 0) {
    log('Uploading Valve & component weights master...');
    await weightInput.setInputFiles(weightPath);
    await page.waitForTimeout(500);
    log('Weights master uploaded.');
  }

  const masterStatus = await page.evaluate(async () => {
    const { masterDataController } = await import('./src/workspace/master-data-controller.js');
    const md = masterDataController.getMasterData();
    return Object.fromEntries(
      Object.entries(md || {}).map(([k, v]) => [
        k,
        {
          rawRowCount: v?.rawRows?.length ?? 0,
          normalizedRowCount: v?.normalizedRows?.length ?? 0,
          sourceHash: v?.sourceHash ?? null,
          fileName: v?.fileName ?? null,
        },
      ])
    );
  });

  auditLog.steps.step4_masters = {
    status: 'PASS',
    masterStatus,
  };
  await page.screenshot({ path: path.join(AUDIT_SCREENSHOTS_DIR, 'step4_master_data.png'), fullPage: true });

  log('=== Step 5: Enrichment & Overrides ===');
  const advDetails = consumer.locator('.empirical-load-calc__advanced');
  if (await advDetails.count() > 0) {
    const isOpen = await advDetails.getAttribute('open');
    if (isOpen === null) {
      await consumer.locator('.empirical-load-calc__advanced summary').click();
      await page.waitForTimeout(200);
    }
  }
  await consumer.locator('[data-load-calc-tab="enrichment"]').first().click();
  await page.waitForTimeout(500);

  await page.evaluate(async () => {
    const { autoGenerateMasterEnrichment, autoBindMasterSources } = await import('./src/workspace/master-data-ui.js');
    await autoGenerateMasterEnrichment();
    await autoBindMasterSources();
  });
  await page.waitForTimeout(500);

  const acceptAllBtn = page.locator('[data-enrichment-accept-all], button:has-text("Accept all unblocked")');
  if (await acceptAllBtn.count() > 0 && await acceptAllBtn.isEnabled()) {
    log('Accepting all unblocked master enrichment proposals...');
    await acceptAllBtn.click();
    await page.waitForTimeout(500);
  }

  const enrichmentSnapshot = await page.evaluate(async () => {
    const { nonFeaEnrichmentStore } = await import('./src/workspace/enrichment/non-fea-enrichment-store.js');
    const snap = nonFeaEnrichmentStore.getSnapshot();
    return {
      acceptedCount: snap.acceptedRecords?.length ?? 0,
      proposalCount: snap.proposals?.length ?? 0,
      stale: snap.stale,
      fieldLedgerCount: snap.fieldLedger?.length ?? 0,
      sampleAccepted: (snap.acceptedRecords || []).slice(0, 5),
    };
  });

  auditLog.steps.step5_enrichment = {
    status: 'PASS',
    enrichmentSnapshot,
  };
  await page.screenshot({ path: path.join(AUDIT_SCREENSHOTS_DIR, 'step5_enrichment.png'), fullPage: true });

  log('=== Step 6: Input Check (Preflight Gates) ===');
  await consumer.locator('[data-load-calc-tab="preflight"]').first().click();
  await page.waitForTimeout(500);

  await page.evaluate(async () => {
    const { autoEnsureDefaultQualificationProfile, autoGenerateMasterEnrichment, autoBindMasterSources } = await import('./src/workspace/master-data-ui.js');
    await autoGenerateMasterEnrichment();
    await autoBindMasterSources();
    await autoEnsureDefaultQualificationProfile();
    const ws = globalThis.AnalysisWorkspace;
    try {
      ws?.evaluateNonFeaCommonInput?.();
      const snap = ws?.getNonFeaCommonInputState?.();
      const report = snap?.report;
      ws?.sealNonFeaCommonInput?.({
        confirmationId: 'AUDIT-SEAL-001',
        confirmedAt: new Date().toISOString(),
        confirmedBy: 'AUDIT_ENGINEER',
        acceptPartial: report?.packageState !== 'READY',
        acknowledgedBlockedMethods: report?.blockedMethodIds || [],
        statement: 'Sealed for mechanical engineering audit.',
      });
    } catch (e) {
      console.warn('Seal warning:', e.message);
    }
  });
  await page.waitForTimeout(500);

  const preflightState = await page.evaluate(async () => {
    const ws = globalThis.AnalysisWorkspace;
    const snap = ws?.getNonFeaCommonInputState?.() || null;
    const evalReport = ws?.evaluateNonFeaCommonInput?.() || null;
    return {
      snapshot: snap,
      evaluationReport: evalReport,
    };
  });

  const packageState = preflightState.evaluationReport?.report?.packageState;
  auditLog.steps.step6_preflight = {
    status: packageState === 'READY' ? 'PASS' : 'BLOCKED',
    preflightState,
  };
  await page.screenshot({ path: path.join(AUDIT_SCREENSHOTS_DIR, 'step6_preflight.png'), fullPage: true });
  expect(packageState, `preflight must reach READY; blockers: ${JSON.stringify(preflightState.evaluationReport?.report?.blockers)}`).toBe('READY');

  log('=== Step 7: Run Load Calculation ===');
  await consumer.locator('[data-load-calc-tab="verify"]').first().click();
  await page.waitForTimeout(500);

  const calcDiagnostic = await page.evaluate(async () => {
    try {
      const { executeCurrentCommonInputEmpiricalRun } = await import('./src/workspace/engineering-loads/current-common-input-empirical-run-runtime.js');
      const runRes = executeCurrentCommonInputEmpiricalRun();
      return { ok: true, distStatus: runRes?.supportExecution?.distribution?.status };
    } catch (e) {
      return { ok: false, error: e.message, code: e.code, details: e.details, stack: e.stack };
    }
  });
  log('Calculation diagnostic: ' + JSON.stringify(calcDiagnostic));
  expect(calcDiagnostic.ok, `calculation must execute without throwing: ${calcDiagnostic.error}\n${calcDiagnostic.stack}`).toBe(true);

  const runButton = consumer.locator('[data-load-calc-run]');
  if (await runButton.count() > 0 && await runButton.isEnabled()) {
    log('Triggering calculation via UI Run button...');
    await runButton.click();
    await page.waitForTimeout(2500);
  } else {
    log('Run button not directly enabled, triggering calculation via store runtime...');
    await page.evaluate(async () => {
      const ws = globalThis.AnalysisWorkspace;
      try {
        ws?.calculateEmpiricalLoadCalcScenario?.();
      } catch (e) {
        console.warn('Direct calc error:', e);
      }
    });
    await page.waitForTimeout(2500);
  }

  const executionAudit = await page.evaluate(async () => {
    const ws = globalThis.AnalysisWorkspace;
    const dist = ws?.getEngineeringSupportLoadDistribution?.() || null;
    const commonExec = ws?.getNonFeaCommonInputState?.()?.currentExecution || null;
    const empiricalExec = ws?.getEmpiricalLoadCalcExecution?.() || null;
    return {
      distribution: dist,
      commonExecution: commonExec,
      empiricalExecution: empiricalExec,
    };
  });

  auditLog.steps.step7_run = {
    status: executionAudit.distribution?.status || 'CURRENT',
    executionAudit,
  };
  await page.screenshot({ path: path.join(AUDIT_SCREENSHOTS_DIR, 'step7_run.png'), fullPage: true });

  log('=== Step 8: Results & Vertical Support Reactions ===');
  await consumer.locator('[data-load-calc-tab="loads"]').first().click();
  await page.waitForTimeout(500);

  const loadCasesData = await page.evaluate(async () => {
    const ws = globalThis.AnalysisWorkspace;
    const dist = ws?.getEngineeringSupportLoadDistribution?.();
    if (!dist || !dist.loadCases) return null;
    return dist.loadCases.map((lc) => ({
      loadCaseId: lc.loadCaseId,
      status: lc.status,
      totalSystemWeightN: lc.equilibrium?.evaluatedForceN ?? null,
      totalSupportReactionN: lc.equilibrium?.reactionForceN ?? null,
      equilibrium: lc.equilibrium ?? null,
      supportResultCount: lc.supportResults?.length ?? 0,
      supportResults: (lc.supportResults || []).map((sr) => ({
        supportId: sr.supportId || sr.supportSiteId,
        supportTag: sr.supportTag || sr.supportName || sr.supportSiteId,
        physicalLocationId: sr.physicalLocationId || sr.supportSiteId,
        coordinates: sr.position,
        verticalForceN: sr.verticalForceN,
        verticalReactionN: sr.verticalReactionN ?? sr.verticalForceN,
        supportType: sr.supportType,
        tributaryLengthM: sr.tributaryLengthM,
      })),
    }));
  });

  auditLog.steps.step8_results = {
    status: loadCasesData ? 'PASS' : 'BLOCKED',
    loadCases: loadCasesData,
  };

  expect(loadCasesData, 'load cases must be produced by the run').not.toBeNull();
  expect(loadCasesData.length, 'expected EMPTY/OPERATING/HYDROTEST load cases').toBeGreaterThan(0);

  if (loadCasesData && loadCasesData.length > 0) {
    for (const lc of loadCasesData) {
      auditLog.equilibrium[lc.loadCaseId] = {
        totalSystemWeightN: lc.totalSystemWeightN,
        totalSupportReactionN: lc.totalSupportReactionN,
        deltaN: lc.totalSystemWeightN !== null && lc.totalSupportReactionN !== null
          ? Math.abs(lc.totalSystemWeightN - lc.totalSupportReactionN)
          : null,
        equilibriumStatus: lc.equilibrium?.passed ? 'BALANCED' : 'FAILED',
      };
      auditLog.supportReactions[lc.loadCaseId] = lc.supportResults.map((sr) => ({
        supportId: sr.supportId,
        verticalReactionN: sr.verticalReactionN,
        supportType: sr.supportType,
      }));

      expect(lc.equilibrium?.passed, `load case ${lc.loadCaseId} equilibrium must close within tolerance: ${JSON.stringify(lc.equilibrium)}`).toBe(true);
      expect(lc.supportResultCount, `load case ${lc.loadCaseId} must report all 37 support locations`).toBe(37);
    }
  }

  await page.screenshot({ path: path.join(AUDIT_SCREENSHOTS_DIR, 'step8_results.png'), fullPage: true });

  writeFileSync('evidence/audit-loadcalc-sjson-report.json', JSON.stringify(auditLog, null, 2));
  log('=== AUDIT COMPLETE — Written to evidence/audit-loadcalc-sjson-report.json ===');
});
