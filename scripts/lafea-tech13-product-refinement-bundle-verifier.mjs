#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeLafea4Tech13ImplementationFingerprint,
} from './lib/lafea4-tech13-implementation-fingerprint.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAN_PATH = path.join(ROOT,
  'validation/lafea4-refinement/product-refinement-exact-head-plan-v1.json');
const RUNNER_PATH = path.join(ROOT, 'scripts/lafea-tech13-product-refinement-qualification.mjs');
const args = process.argv.slice(2);
const bundlePath = args[0] ? path.resolve(process.cwd(), args[0]) : null;
const expectedHead = option('--expected-head');

if (!bundlePath || !fs.existsSync(bundlePath)) {
  fail('TECH13_BUNDLE_PATH_REQUIRED');
}
if (expectedHead !== null && !/^[0-9a-f]{40}$/u.test(expectedHead)) {
  fail('TECH13_EXPECTED_HEAD_INVALID');
}
const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
const planText = fs.readFileSync(PLAN_PATH, 'utf8');
const plan = JSON.parse(planText);
const runnerText = fs.readFileSync(RUNNER_PATH, 'utf8');
const implementation = computeLafea4Tech13ImplementationFingerprint({ rootDir: ROOT });

assert.equal(bundle.schema, 'lafea4-tech13-product-refinement-qualification-bundle/v2');
assert.equal(bundle.qualificationId, plan.qualificationId);
assert.match(bundle.expectedHead, /^[0-9a-f]{40}$/u);
assert.equal(bundle.currentHead, bundle.expectedHead);
if (expectedHead !== null) assert.equal(bundle.expectedHead, expectedHead);
assert.equal(bundle.nodeMajor, plan.requiredNodeMajor);
assert.equal(bundle.planSha256, sha256(planText));
assert.equal(bundle.runnerSha256, sha256(runnerText));
assert.equal(bundle.implementationFingerprint, implementation.fingerprint,
  'TECH13 bundle implementation fingerprint is not current');
assert.equal(bundle.implementationManifestSha256, implementation.manifestSha256,
  'TECH13 bundle implementation manifest digest is not current');
assert.equal(bundle.implementationFileCount, implementation.fileCount,
  'TECH13 bundle implementation file count is not current');
assert.equal(bundle.trackedTreeCleanBefore, true);
assert.equal(bundle.trackedTreeCleanAfter, true);
assert.equal(bundle.browserRequested, true);
assert.equal(bundle.classification, 'PASS');
assert.equal(bundle.qualificationComplete, true);
assert.equal(bundle.futurePromotionReviewEligible, true);
assert.equal(bundle.productRetentionAuthorized, false);
assert.equal(bundle.uiBindingAuthorized, false);
assert.equal(bundle.releaseQualified, false);
assert.equal(bundle.hardGateActivated, false);
assert.equal(bundle.failure, null);
assert.ok(Array.isArray(bundle.commands));

const required = [
  { ...plan.dependencyInstall, authority: 'INFRASTRUCTURE' },
  ...plan.steps.filter((row) => row.browser !== true)
    .map((row) => ({ ...row, authority: 'ENGINEERING' })),
  { ...plan.browserProvision, authority: 'INFRASTRUCTURE' },
  ...plan.steps.filter((row) => row.browser === true)
    .map((row) => ({ ...row, authority: 'ENGINEERING' })),
];
assert.equal(bundle.commands.length, required.length,
  'TECH13 exact-head PASS bundle must contain exactly the required commands');
for (const spec of required) {
  const matches = bundle.commands.filter((row) => row.id === spec.id);
  assert.equal(matches.length, 1, `TECH13 command ${spec.id} must appear exactly once`);
  const row = matches[0];
  assert.equal(row.authority, spec.authority, `${spec.id} authority mismatch`);
  assert.equal(row.executable, spec.executable, `${spec.id} executable mismatch`);
  assert.deepEqual(row.args, spec.args, `${spec.id} args mismatch`);
  assert.equal(row.status, 'PASS', `${spec.id} did not PASS`);
  assert.equal(row.exitCode, 0, `${spec.id} exit code is not zero`);
  assert.equal(row.signal, null, `${spec.id} was terminated by signal`);
  assert.equal(row.spawnError, null, `${spec.id} has a spawn error`);
  assert.match(row.stdoutSha256, /^[0-9a-f]{64}$/u);
  assert.match(row.stderrSha256, /^[0-9a-f]{64}$/u);
}

const core = { ...bundle };
delete core.evidenceSha256;
assert.equal(bundle.evidenceSha256, sha256(JSON.stringify(core)),
  'TECH13 bundle evidence digest mismatch');

const critical = [
  'TECH13A_PRODUCT_REFINEMENT_CONTRACT',
  'TECH13B_PRODUCT_REFINEMENT_ADAPTER',
  'TECH13C_PRODUCT_REFINEMENT_ACCEPTANCE',
  'TECH13D_PRODUCT_REFINEMENT_WORKBENCH_UI',
  'TECH13E_PRODUCT_REFINEMENT_NUMERICAL',
  'TECH13F_DORMANT_PROMOTION_GATE',
  'TECH13F_DORMANT_ACTIVATION_PATH',
  'TECH13G_NONSPOOFABLE_PROMOTION_AUTHORITY',
  'TECH13H_RETAINED_REFINEMENT_AUTHORITY',
  'TECH13I_PROMOTED_REFINEMENT_ROUNDTRIP',
  'TECH13J_IMPLEMENTATION_CURRENTNESS',
  'TECH7_GRADED_REFINEMENT_EXECUTOR',
  'TECH11_PARENT_NORMAL_SAMPLE',
  'MESHING_SUITE',
  'LAFEA_CORE_SUITE',
  'PRODUCTION_BUILD',
  'VISIBLE_WORKBENCH_CHROMIUM',
];
for (const id of critical) {
  assert.equal(bundle.commands.find((row) => row.id === id)?.status, 'PASS',
    `TECH13 promotion-critical step ${id} missing PASS`);
}

console.log(JSON.stringify({
  check: 'lafea-tech13-product-refinement-bundle-verifier',
  status: 'PASS',
  expectedHead: bundle.expectedHead,
  qualificationId: bundle.qualificationId,
  implementationFingerprint: bundle.implementationFingerprint,
  implementationManifestSha256: bundle.implementationManifestSha256,
  implementationFileCount: bundle.implementationFileCount,
  commandCount: bundle.commands.length,
  promotionCriticalPassCount: critical.length,
  qualificationComplete: bundle.qualificationComplete,
  futurePromotionReviewEligible: bundle.futurePromotionReviewEligible,
  productRetentionAuthorized: false,
  uiBindingAuthorized: false,
  releaseQualified: false,
}, null, 2));

function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? null : null;
}
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function fail(code) { process.stderr.write(`${code}\n`); process.exit(2); }
