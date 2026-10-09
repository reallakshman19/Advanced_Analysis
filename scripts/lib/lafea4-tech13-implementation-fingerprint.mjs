import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT_SCHEMA =
  'lafea4-tech13-implementation-fingerprint/v1';
export const LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT_GLOBAL =
  '__LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT__';
export const LAFEA4_TECH13_PROMOTION_PATH =
  'src/workspace/lafea4-shell-product-refinement-promotion.js';
export const LAFEA4_TECH13_TRUST_ROOT_VALUE_BEGIN =
  '/* LAFEA4_TECH13_TRUST_ROOT_VALUE_BEGIN */';
export const LAFEA4_TECH13_TRUST_ROOT_VALUE_END =
  '/* LAFEA4_TECH13_TRUST_ROOT_VALUE_END */';

/**
 * Promotion-critical implementation domain.
 *
 * This is deliberately narrower than repository HEAD and broader than the
 * product adapter alone. It includes numerical refinement dependencies,
 * quality/parent-normal authority, retained/replay custody, promotion logic,
 * the runtime/build fingerprint injection path and exact-head qualification
 * machinery. Unrelated application/docs changes do not invalidate identity.
 */
export const LAFEA4_TECH13_IMPLEMENTATION_CRITICAL_PATHS = Object.freeze([
  'scripts/lib/lafea4-tech13-implementation-fingerprint.mjs',
  'scripts/lafea-tech13-product-refinement-qualification.mjs',
  'scripts/lafea-tech13-product-refinement-bundle-verifier.mjs',
  'scripts/lafea-tech13f-promotion-record-generator.mjs',
  'validation/lafea4-refinement/product-refinement-exact-head-plan-v1.json',
  'vite.config.js',
  'vite.lafea.config.js',
  'src/core/lafea-meshing/mesh-smoothing.js',
  'src/core/lafea-meshing/interior-refinement-t6.js',
  'src/core/lafea-meshing/constrained-delaunay-t6.js',
  'src/core/lafea-profile-contract/stage-qualified-policies.js',
  'src/workspace/lafea-analysis-mesh-contract.js',
  'src/workspace/lafea-analysis-mesh-evidence-v2.js',
  'src/workspace/lafea-analysis-mesh-quality.js',
  'src/workspace/lafea-shell-curved-midsurface-contract.js',
  'src/workspace/lafea-shell-curved-hole-midsurface-contract.js',
  'src/workspace/lafea-shell-midsurface-dispatch.js',
  'src/workspace/lafea4-shell-graded-transition-plan.js',
  'src/workspace/lafea4-shell-graded-refinement-authority.js',
  'src/workspace/lafea4-shell-graded-refinement-executor.js',
  'src/workspace/lafea4-shell-product-refinement-contract.js',
  'src/workspace/lafea4-shell-product-refinement-adapter.js',
  'src/workspace/lafea4-shell-product-refinement-acceptance.js',
  'src/workspace/lafea4-shell-product-refinement-ui-policy.js',
  'src/workspace/lafea4-shell-product-refinement-implementation-currentness.js',
  LAFEA4_TECH13_PROMOTION_PATH,
  'src/workspace/lafea4-shell-product-refinement-retention-authority.js',
  'src/workspace/lafea4-shell-product-refinement-replay.js',
  'src/workspace/lafea4-shell-product-refinement-replay-actions.js',
  'src/workspace/lafea4-shell-parent-normal-qualification.js',
  'src/workspace/lafea4-parent-normal-production-gate.js',
  'src/workspace/lafea4-shell-retained-mesh-parent-normal-companion.js',
  'src/workspace/lafea-workbench-mesh-generation-actions.js',
  'src/workspace/lafea-workbench-orchestrator-api.js',
]);

export function computeLafea4Tech13ImplementationFingerprint({
  rootDir,
  overrides = new Map(),
} = {}) {
  if (typeof rootDir !== 'string' || !rootDir.trim()) {
    throw new TypeError('LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT_ROOT_REQUIRED');
  }
  const overrideMap = overrides instanceof Map
    ? overrides
    : new Map(Object.entries(overrides ?? {}));
  const files = LAFEA4_TECH13_IMPLEMENTATION_CRITICAL_PATHS.map((relativePath) => {
    const raw = overrideMap.has(relativePath)
      ? overrideMap.get(relativePath)
      : fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
    if (typeof raw !== 'string') {
      throw new TypeError(`LAFEA4_TECH13_IMPLEMENTATION_SOURCE_TEXT_REQUIRED:${relativePath}`);
    }
    const normalized = normalizeSource(relativePath, raw);
    return Object.freeze({
      path: relativePath,
      bytes: Buffer.byteLength(normalized, 'utf8'),
      sha256: digest(normalized),
    });
  });
  const manifest = Object.freeze({
    schema: 'lafea4-tech13-implementation-manifest/v1',
    normalizationPolicy: 'UTF8_LF_BOM_STRIPPED_TRUST_ROOT_VALUE_SENTINEL_V1',
    files: Object.freeze(files),
  });
  const manifestText = JSON.stringify(manifest);
  const fingerprintInput = JSON.stringify({
    schema: 'lafea4-tech13-implementation-fingerprint-input/v1',
    manifest,
  });
  return Object.freeze({
    schema: LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT_SCHEMA,
    fingerprint: digest(fingerprintInput),
    manifestSha256: digest(manifestText),
    fileCount: files.length,
    files,
  });
}

export function normalizeLafea4Tech13ImplementationSource(relativePath, rawText) {
  return normalizeSource(relativePath, rawText);
}

function normalizeSource(relativePath, rawText) {
  let text = rawText.replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n');
  if (relativePath !== LAFEA4_TECH13_PROMOTION_PATH) return text;
  const start = text.indexOf(LAFEA4_TECH13_TRUST_ROOT_VALUE_BEGIN);
  const end = text.indexOf(LAFEA4_TECH13_TRUST_ROOT_VALUE_END);
  if (start < 0 || end < 0 || end <= start) {
    throw new TypeError('LAFEA4_TECH13_TRUST_ROOT_NORMALIZATION_MARKERS_REQUIRED');
  }
  const valueStart = start + LAFEA4_TECH13_TRUST_ROOT_VALUE_BEGIN.length;
  text = `${text.slice(0, valueStart)}\n<TRUST_ROOT_VALUE_EXCLUDED_FROM_IMPLEMENTATION_IDENTITY>\n${text.slice(end)}`;
  return text;
}

function digest(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
