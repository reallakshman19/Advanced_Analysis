#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_QUALIFICATION,
} from '../src/workspace/lafea4-shell-product-refinement-adapter.js';
import {
  LAFEA4_SHELL_PRODUCT_REFINEMENT_EXACT_HEAD_QUALIFICATION_ID,
  LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_SCHEMA,
  createLafea4ShellProductRefinementPromotionRecord,
} from '../src/workspace/lafea4-shell-product-refinement-promotion.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const bundlePath = args.find((value) => !value.startsWith('--')) ?? null;
const expectedHead = option('--expected-head');
const outputPath = option('--output');

if (!bundlePath || !/^[0-9a-f]{40}$/u.test(expectedHead ?? '')) {
  fatal('USAGE', 'node scripts/lafea-tech13f-promotion-record-generator.mjs <bundle.json> --expected-head <40-char-sha> [--output record.json]', 2);
}
const absoluteBundlePath = path.resolve(ROOT, bundlePath);
if (!fs.existsSync(absoluteBundlePath)) fatal('BUNDLE_NOT_FOUND', absoluteBundlePath, 2);

const verifier = spawnSync(process.execPath, [
  'scripts/lafea-tech13-product-refinement-bundle-verifier.mjs',
  bundlePath,
  '--expected-head', expectedHead,
], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});
if (verifier.status !== 0 || verifier.error) {
  fatal(
    'BUNDLE_VERIFICATION_FAILED',
    verifier.error?.message ?? verifier.stderr ?? verifier.stdout ?? `exit ${verifier.status}`,
    1,
  );
}

const bundle = JSON.parse(fs.readFileSync(absoluteBundlePath, 'utf8'));
if (bundle.schema !== 'lafea4-tech13-product-refinement-qualification-bundle/v2'
  || bundle.qualificationId !== LAFEA4_SHELL_PRODUCT_REFINEMENT_EXACT_HEAD_QUALIFICATION_ID
  || bundle.expectedHead !== expectedHead
  || bundle.currentHead !== expectedHead
  || !/^sha256:[0-9a-f]{64}$/u.test(bundle.implementationFingerprint ?? '')
  || !/^sha256:[0-9a-f]{64}$/u.test(bundle.implementationManifestSha256 ?? '')
  || !Number.isSafeInteger(bundle.implementationFileCount)
  || bundle.implementationFileCount < 1
  || bundle.classification !== 'PASS'
  || bundle.qualificationComplete !== true
  || bundle.futurePromotionReviewEligible !== true
  || bundle.productRetentionAuthorized !== false
  || bundle.uiBindingAuthorized !== false
  || bundle.releaseQualified !== false
  || bundle.hardGateActivated !== false) {
  fatal('BUNDLE_NOT_PROMOTION_ELIGIBLE', 'bundle does not satisfy TECH-13F/J promotion prerequisites', 1);
}

const record = createLafea4ShellProductRefinementPromotionRecord({
  schema: LAFEA4_SHELL_PRODUCT_REFINEMENT_PROMOTION_SCHEMA,
  stageId: 'LAFEA.4',
  exactHeadQualificationId: LAFEA4_SHELL_PRODUCT_REFINEMENT_EXACT_HEAD_QUALIFICATION_ID,
  qualifiedHead: expectedHead,
  bundleEvidenceSha256: bundle.evidenceSha256,
  bundlePlanSha256: bundle.planSha256,
  bundleRunnerSha256: bundle.runnerSha256,
  implementationFingerprint: bundle.implementationFingerprint,
  capabilityHash: LAFEA4_SHELL_PRODUCT_REFINEMENT_CAPABILITY.capabilityHash,
  qualificationHash: LAFEA4_SHELL_PRODUCT_REFINEMENT_QUALIFICATION.qualificationHash,
  qualificationClassification: 'PASS',
  qualificationComplete: true,
  futurePromotionReviewEligible: true,
  productRetentionAuthorized: true,
  uiBindingAuthorized: true,
  releaseQualified: false,
});

const serialized = `${JSON.stringify(record, null, 2)}\n`;
if (outputPath) {
  const absoluteOutput = path.resolve(ROOT, outputPath);
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  fs.writeFileSync(absoluteOutput, serialized, 'utf8');
}
process.stdout.write(serialized);

function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? null : null;
}
function fatal(code, message, exitCode) {
  process.stderr.write(`${code}: ${String(message).trim()}\n`);
  process.exit(exitCode);
}
