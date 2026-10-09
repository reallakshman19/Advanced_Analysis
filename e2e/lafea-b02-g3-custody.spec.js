import { expect, test } from '@playwright/test';
import { destroyStage17, mountStage17 } from './helpers/lafea-stage17-playwright.js';

test.afterEach(async ({ page }) => destroyStage17(page));

test('B02 G3: real run transaction and canonical BC/load glyph custody are visible', async ({ page }) => {
  await mountStage17(page, { buildSha: 'd'.repeat(40), targetElementLength: 25 });
  const result = await page.evaluate(() => {
    const { controller, api } = globalThis.__A17__;
    const observed = [];
    const unsubscribe = controller.store.subscribe((state) => {
      observed.push(state.stages['LAFEA.3'].execution?.status ?? 'NONE');
    });
    api.authorizeAndRun(controller);
    unsubscribe();
    const stage = controller.getState().stages['LAFEA.3'];
    return {
      observed,
      executionHash: stage.execution.compiledExecutionHash,
      canonicalExecutionInputHash: stage.execution.canonicalExecutionInputHash,
      transactionStatus: stage.execution.runTransactionReceipt?.status ?? null,
      transactionExecutionHash: stage.execution.runTransactionReceipt?.executionHash ?? null,
      solverStorage: stage.execution.runtimeSolverDiagnostics?.storageRoute ?? null,
      solverMethods: stage.execution.runtimeSolverDiagnostics?.methods ?? [],
      progressPolicy: stage.execution.runtimeSolverDiagnostics?.progressPolicy ?? null,
      glyphProjectionHash: stage.execution.bcLoadGlyphProjection?.canonicalExecutionInputHash ?? null,
      glyphIds: (stage.execution.bcLoadGlyphProjection?.glyphs ?? []).map((row) => row.glyphId).sort(),
      glyphAuthority: (stage.execution.bcLoadGlyphProjection?.glyphs ?? []).every(
        (row) => row.authority === 'CANONICAL_EXECUTION_INPUT',
      ),
    };
  });

  expect(result.observed).toContain('RUNNING');
  expect(result.observed.at(-1)).toBe('QUALIFIED');
  expect(result.transactionStatus).toBe('COMPLETED');
  expect(result.transactionExecutionHash).toBe(result.executionHash);
  expect(result.canonicalExecutionInputHash).toMatch(/^sha256:/);
  expect(result.glyphProjectionHash).toBe(result.canonicalExecutionInputHash);
  expect(result.glyphIds.length).toBeGreaterThan(0);
  expect(result.glyphAuthority).toBe(true);
  expect(['DENSE', 'CSR_FULL_SYMMETRIC']).toContain(result.solverStorage);
  expect(result.solverMethods.length).toBeGreaterThan(0);
  expect(result.progressPolicy).toBe('REAL_MILESTONES_ONLY_NO_PERCENTAGE');

  const overlay = page.locator('[data-role="lafea-bc-load-glyph-overlay"]');
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute('data-execution-hash', result.executionHash);
  await expect(overlay).toHaveAttribute('data-canonical-input-hash', result.canonicalExecutionInputHash);
  const visibleGlyphIds = (await overlay.locator('[data-glyph-id]').evaluateAll(
    (nodes) => nodes.map((node) => node.dataset.glyphId).sort(),
  ));
  expect(visibleGlyphIds).toEqual(result.glyphIds);
  await expect(overlay.locator('[data-authority="CANONICAL_EXECUTION_INPUT"]')).toHaveCount(result.glyphIds.length);
});
