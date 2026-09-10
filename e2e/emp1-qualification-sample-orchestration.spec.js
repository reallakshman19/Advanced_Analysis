import { expect, test } from '@playwright/test';

const HOST_URL = '/e2e/fixtures/lafea-guided-workbench.html';
const CONTROLLER_URL = '/src/workspace/lafea-workbench-controller.js';

const destroyWorkbench = async (page) => page.evaluate(() => {
  globalThis.__EMP1_SAMPLE_SEQUENCE__?.controller?.destroy?.();
  delete globalThis.__EMP1_SAMPLE_SEQUENCE__;
}).catch(() => {});

test.afterEach(async ({ page }) => destroyWorkbench(page));

test('clean complete sample executes and retains A before B/C', async ({ page }) => {
  await mountEmp1Workbench(page);
  const workbench = page.locator('[data-role="lafea-workbench"]');
  await runCompleteExample(workbench);

  await expect.poll(() => sampleState(page)).toMatchObject({
    aDocumentLoaded: true,
    aExecutionStatus: 'QUALIFIED',
    aQualificationState: 'ACCEPTED',
    aLifecycleBindingStatus: 'CURRENT',
    bDocumentLoaded: true,
    bLifecycleBindingStatus: 'CURRENT',
    runInputLoaded: true,
    failureCode: null,
  });

  await expect.poll(async () => String(
    (await sampleState(page)).emp1ExecutionStatus ?? 'PENDING',
  )).toMatch(/^(CALCULATED|PREPARED_C_BLOCKED)$/u);

  const state = await sampleState(page);
  expect(['CALCULATED', 'PREPARED_C_BLOCKED']).toContain(state.emp1ExecutionStatus);
  expect(state.emp1ExecutionStatus).not.toBe('FAILED');
  expect(state.emp1ExecutionStatus).not.toBe('BLOCKED');
});

test('complete sample replaces an existing A lifecycle instead of inheriting it', async ({ page }) => {
  await mountEmp1Workbench(page);
  const workbench = page.locator('[data-role="lafea-workbench"]');
  await runCompleteExample(workbench);

  await expect.poll(() => sampleState(page)).toMatchObject({
    aExecutionStatus: 'QUALIFIED',
    aQualificationState: 'ACCEPTED',
    aLifecycleBindingStatus: 'CURRENT',
    failureCode: null,
  });

  const priorSourceHash = await page.evaluate(async () => {
    const controller = globalThis.__EMP1_SAMPLE_SEQUENCE__.controller;
    controller.store.selectStage('LAFEA.1');
    const currentA = controller.getState().stages['LAFEA.1'].document;
    const priorA = structuredClone(currentA);
    priorA.modelIdentity = `${priorA.modelIdentity}-PRIOR-LIFECYCLE`;
    const imported = controller.importDocument(priorA, 'LAFEA.1');
    const retainedA = imported.stages['LAFEA.1'].document;
    const { issueLafeaSourceAuthority } = await import('/src/workspace/lafea-source-authority.js');
    const authority = issueLafeaSourceAuthority(
      'LAFEA.1',
      retainedA,
      'EMP1_E2E/PRIOR_SOURCE',
    );
    controller.initializeLifecycle(authority.sourceHash, 'EMP1_E2E/PRIOR_SOURCE');
    const ran = controller.run();
    if (ran.stages['LAFEA.1'].execution?.status !== 'QUALIFIED') {
      throw new Error('EMP1_E2E_PRIOR_A_MUST_QUALIFY');
    }
    return authority.sourceHash;
  });

  await expect.poll(() => sampleState(page)).toMatchObject({
    aExecutionStatus: 'QUALIFIED',
    aLifecycleBindingStatus: 'CURRENT',
    aLifecycleSourceHash: priorSourceHash,
  });

  await replaceWithCompleteExample(page, workbench);

  await expect.poll(() => sampleState(page)).toMatchObject({
    storeStatus: 'READY',
    aExecutionStatus: 'QUALIFIED',
    aQualificationState: 'ACCEPTED',
    aLifecycleBindingStatus: 'CURRENT',
    bDocumentLoaded: true,
    bLifecycleBindingStatus: 'CURRENT',
    runInputLoaded: true,
    failureCode: null,
    diagnosticCode: null,
  });
  const replaced = await sampleState(page);
  expect(replaced.aLifecycleSourceHash).not.toBe(priorSourceHash);
  expect(['CALCULATED', 'PREPARED_C_BLOCKED']).toContain(replaced.emp1ExecutionStatus);
});

test('complete sample preserves an A run root diagnostic and retires prior product sidecars', async ({ page }) => {
  await mountEmp1Workbench(page);
  const workbench = page.locator('[data-role="lafea-workbench"]');
  await runCompleteExample(workbench);

  await expect.poll(() => sampleState(page)).toMatchObject({
    aExecutionStatus: 'QUALIFIED',
    runInputLoaded: true,
    failureCode: null,
  });
  await expect.poll(async () => String(
    (await sampleState(page)).emp1ExecutionStatus ?? 'PENDING',
  )).toMatch(/^(CALCULATED|PREPARED_C_BLOCKED)$/u);

  await page.evaluate(() => {
    const controller = globalThis.__EMP1_SAMPLE_SEQUENCE__.controller;
    controller.run = () => {
      const state = controller.getState();
      return Object.freeze({
        ...state,
        status: 'FAILED',
        diagnostics: Object.freeze([Object.freeze({
          severity: 'ERROR',
          code: 'EMP1_TEST_A_ROOT_FAILURE',
          path: 'orchestration',
          entityId: null,
          message: 'Synthetic A root failure for diagnostic-preservation regression.',
        })]),
      });
    };
  });

  await replaceWithCompleteExample(page, workbench);

  await expect.poll(() => sampleState(page)).toMatchObject({
    runInputLoaded: false,
    emp1ExecutionStatus: null,
    failureCode: 'EMP1_TEST_A_ROOT_FAILURE',
  });
  const failure = workbench.locator('[data-role="emp1-workflow-run-failure"]');
  await expect(failure).toContainText('Assessment needs attention');
  const technical = failure.locator('[data-role="emp1-workflow-run-failure-technical"]');
  await expect(technical).not.toHaveAttribute('open', '');
  await expect(technical.locator('code')).not.toBeVisible();
  await technical.locator('summary').click();
  await expect(technical.locator('code')).toBeVisible();
  await expect(technical).toContainText('EMP1_TEST_A_ROOT_FAILURE');
});

test('complete sample stops before B/C when A is not current and qualified', async ({ page }) => {
  await mountEmp1Workbench(page);
  await page.evaluate(() => {
    const controller = globalThis.__EMP1_SAMPLE_SEQUENCE__.controller;
    controller.run = () => controller.getState();
  });

  const workbench = page.locator('[data-role="lafea-workbench"]');
  await runCompleteExample(workbench);

  await expect.poll(() => sampleState(page)).toMatchObject({
    aDocumentLoaded: true,
    aExecutionStatus: null,
    aLifecycleBindingStatus: 'CURRENT',
    bDocumentLoaded: false,
    runInputLoaded: false,
    emp1ExecutionStatus: null,
    failureCode: 'EMP1_A_CURRENT_QUALIFIED_RESULT_REQUIRED',
  });
  await expect(workbench.locator('[data-role="emp1-workflow-run-failure"]'))
    .toContainText('A current load-transfer result is required before the local check can run.');
});

async function runCompleteExample(workbench) {
  await workbench.locator('[data-emp1-primary-action="true"]').click();
}

async function replaceWithCompleteExample(page, workbench) {
  const more = workbench.locator('[data-role="emp1-more-actions"]');
  if (await more.getAttribute('open') === null) await more.locator(':scope > summary').click();
  page.once('dialog', (dialog) => dialog.accept());
  await more.locator('[data-role="emp1-load-complete-qualification-sample"]').click();
}

async function sampleState(page) {
  return page.evaluate(() => {
    const controller = globalThis.__EMP1_SAMPLE_SEQUENCE__.controller;
    const state = controller.getState();
    return {
      storeStatus: state.status ?? null,
      diagnosticCode: state.diagnostics?.[0]?.code ?? null,
      aDocumentLoaded: Boolean(state.stages?.['LAFEA.1']?.document),
      aExecutionStatus: state.stages?.['LAFEA.1']?.execution?.status ?? null,
      aQualificationState:
        state.stages?.['LAFEA.1']?.execution?.result?.qualification?.state ?? null,
      aLifecycleBindingStatus:
        state.stages?.['LAFEA.1']?.lifecycleBinding?.status ?? null,
      aLifecycleSourceHash:
        state.stages?.['LAFEA.1']?.lifecycle?.source?.sourceHash ?? null,
      bDocumentLoaded: Boolean(state.stages?.['LAFEA.2']?.document),
      bLifecycleBindingStatus:
        state.stages?.['LAFEA.2']?.lifecycleBinding?.status ?? null,
      runInputLoaded: controller.getEmp1RunInput() != null,
      emp1ExecutionStatus: controller.getEmp1Execution()?.status ?? null,
      failureCode: controller.emp1RunFailure?.code ?? null,
    };
  });
}

async function mountEmp1Workbench(page) {
  await page.goto(HOST_URL);
  return page.evaluate(async ({ controllerUrl }) => {
    const { LafeaWorkbenchController } = await import(controllerUrl);
    const root = document.querySelector('#lafea-guided-browser-host');
    const controller = new LafeaWorkbenchController(root, { analyticalOnly: true });
    controller.init();
    globalThis.__EMP1_SAMPLE_SEQUENCE__ = { controller };
    return { stageId: controller.getState().activeStageId };
  }, { controllerUrl: CONTROLLER_URL });
}
