#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LAFEA4_TECH13_IMPLEMENTATION_CRITICAL_PATHS,
  LAFEA4_TECH13_PROMOTION_PATH,
  LAFEA4_TECH13_TRUST_ROOT_VALUE_BEGIN,
  LAFEA4_TECH13_TRUST_ROOT_VALUE_END,
  computeLafea4Tech13ImplementationFingerprint,
} from './lib/lafea4-tech13-implementation-fingerprint.mjs';
import {
  LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT_MISMATCH_CODE,
  LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT_MISSING_CODE,
  evaluateLafea4Tech13ImplementationCurrentness,
} from '../src/workspace/lafea4-shell-product-refinement-implementation-currentness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = computeLafea4Tech13ImplementationFingerprint({ rootDir: ROOT });
const repeated = computeLafea4Tech13ImplementationFingerprint({ rootDir: ROOT });
assert.match(base.fingerprint, /^sha256:[0-9a-f]{64}$/u);
assert.match(base.manifestSha256, /^sha256:[0-9a-f]{64}$/u);
assert.equal(base.fileCount, LAFEA4_TECH13_IMPLEMENTATION_CRITICAL_PATHS.length);
assert.equal(repeated.fingerprint, base.fingerprint, 'implementation fingerprint must be deterministic');
assert.equal(repeated.manifestSha256, base.manifestSha256,
  'implementation manifest digest must be deterministic');

const criticalMutations = [
  'src/workspace/lafea4-shell-graded-refinement-executor.js',
  'src/workspace/lafea-analysis-mesh-quality.js',
  'src/core/lafea-profile-contract/stage-qualified-policies.js',
  'src/workspace/lafea4-shell-parent-normal-qualification.js',
  'src/workspace/lafea4-shell-product-refinement-retention-authority.js',
  'src/workspace/lafea4-shell-product-refinement-replay.js',
  'src/workspace/lafea4-shell-product-refinement-ui-policy.js',
  'src/workspace/lafea-workbench-mesh-generation-actions.js',
  'vite.config.js',
  'vite.lafea.config.js',
];
for (const relativePath of criticalMutations) {
  const raw = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  const mutated = computeLafea4Tech13ImplementationFingerprint({
    rootDir: ROOT,
    overrides: new Map([[relativePath, `${raw}\n// TECH13J_NEGATIVE_MUTATION\n`]]),
  });
  assert.notEqual(mutated.fingerprint, base.fingerprint,
    `critical mutation did not invalidate implementation fingerprint: ${relativePath}`);
}

// Promotion validator/currentness logic is critical, but only the code-owned
// trust-root VALUE is an intentional activation slot. Changing bytes outside
// that slot must invalidate the implementation identity.
const promotionText = fs.readFileSync(path.join(ROOT, LAFEA4_TECH13_PROMOTION_PATH), 'utf8');
const promotionLogicMutation = computeLafea4Tech13ImplementationFingerprint({
  rootDir: ROOT,
  overrides: new Map([[LAFEA4_TECH13_PROMOTION_PATH,
    `${promotionText}\n// TECH13J_PROMOTION_LOGIC_NEGATIVE_MUTATION\n`]]),
});
assert.notEqual(promotionLogicMutation.fingerprint, base.fingerprint,
  'promotion logic mutation must invalidate implementation identity');

const trustRootOnlyMutation = replaceTrustRootValue(
  promotionText,
  '\n  Object.freeze({ syntheticActivationRecord: true })\n  ',
);
const trustRootFingerprint = computeLafea4Tech13ImplementationFingerprint({
  rootDir: ROOT,
  overrides: new Map([[LAFEA4_TECH13_PROMOTION_PATH, trustRootOnlyMutation]]),
});
assert.equal(trustRootFingerprint.fingerprint, base.fingerprint,
  'trust-root-value-only activation must preserve qualified implementation identity');

// Line-ending differences are not engineering identity.
const onePath = criticalMutations[0];
const lf = fs.readFileSync(path.join(ROOT, onePath), 'utf8').replace(/\r\n?/gu, '\n');
const crlf = lf.replace(/\n/gu, '\r\n');
const lineEndingFingerprint = computeLafea4Tech13ImplementationFingerprint({
  rootDir: ROOT,
  overrides: new Map([[onePath, crlf]]),
});
assert.equal(lineEndingFingerprint.fingerprint, base.fingerprint,
  'LF/CRLF transport differences must normalize to one implementation identity');

// Unrelated files are outside the declared implementation domain.
const unrelated = computeLafea4Tech13ImplementationFingerprint({
  rootDir: ROOT,
  overrides: new Map([['README.md', 'TECH13J unrelated README mutation']]),
});
assert.equal(unrelated.fingerprint, base.fingerprint,
  'unrelated repository content must not invalidate local-refinement implementation identity');

const record = Object.freeze({ implementationFingerprint: base.fingerprint });
delete globalThis.__LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT__;
const missing = evaluateLafea4Tech13ImplementationCurrentness(record);
assert.equal(missing.current, false);
assert.equal(missing.diagnosticCode, LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT_MISSING_CODE);

globalThis.__LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT__ = `sha256:${'0'.repeat(64)}`;
const mismatch = evaluateLafea4Tech13ImplementationCurrentness(record);
assert.equal(mismatch.current, false);
assert.equal(mismatch.diagnosticCode, LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT_MISMATCH_CODE);

globalThis.__LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT__ = base.fingerprint;
const current = evaluateLafea4Tech13ImplementationCurrentness(record);
assert.equal(current.current, true);
assert.equal(current.diagnosticCode, null);
assert.equal(current.currentImplementationFingerprint, base.fingerprint);
assert.equal(current.qualifiedImplementationFingerprint, base.fingerprint);

// The qualification-only global must not become a browser authority seam. In a
// browser-like runtime with no build-injected Vite value, even a matching global
// is ignored and the currentness gate remains fail closed.
globalThis.window = {};
globalThis.document = {};
const browserSpoof = evaluateLafea4Tech13ImplementationCurrentness(record);
assert.equal(browserSpoof.current, false);
assert.equal(browserSpoof.diagnosticCode, LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT_MISSING_CODE);
delete globalThis.window;
delete globalThis.document;
delete globalThis.__LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT__;

console.log(JSON.stringify({
  check: 'lafea-tech13j-implementation-currentness',
  status: 'PASS',
  implementationFingerprint: base.fingerprint,
  manifestSha256: base.manifestSha256,
  criticalFileCount: base.fileCount,
  negativeCriticalMutationCount: criticalMutations.length + 1,
  trustRootOnlyActivationFingerprintStable: true,
  unrelatedFileMutationFingerprintStable: true,
  lineEndingNormalizationStable: true,
  missingRuntimeFingerprintBlocks: true,
  mismatchedRuntimeFingerprintBlocks: true,
  matchingRuntimeFingerprintPasses: true,
  browserGlobalSpoofBlocked: true,
  releaseQualified: false,
}, null, 2));

function replaceTrustRootValue(source, replacement) {
  const start = source.indexOf(LAFEA4_TECH13_TRUST_ROOT_VALUE_BEGIN);
  const end = source.indexOf(LAFEA4_TECH13_TRUST_ROOT_VALUE_END);
  assert.ok(start >= 0 && end > start, 'trust-root normalization markers missing');
  const valueStart = start + LAFEA4_TECH13_TRUST_ROOT_VALUE_BEGIN.length;
  return `${source.slice(0, valueStart)}${replacement}${source.slice(end)}`;
}
