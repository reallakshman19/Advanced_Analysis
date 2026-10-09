#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeLafea4Tech13ImplementationFingerprint,
} from './lib/lafea4-tech13-implementation-fingerprint.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAN_PATH = path.join(ROOT,
  'validation/lafea4-refinement/product-refinement-exact-head-plan-v1.json');
const RUNNER_PATH = fileURLToPath(import.meta.url);
const args = process.argv.slice(2);
const expectedHead = option('--expected-head');
const outputPath = option('--output');
const skipBrowser = args.includes('--skip-browser');

if (!/^[0-9a-f]{40}$/u.test(expectedHead ?? '')) {
  fatal('USAGE', '--expected-head <40-char-sha> is required', 2);
}
const planText = fs.readFileSync(PLAN_PATH, 'utf8');
const plan = JSON.parse(planText);
if (plan.schema !== 'lafea4-tech13-product-refinement-exact-head-plan/v1') {
  fatal('PLAN_INVALID', 'TECH-13 exact-head qualification plan schema is invalid', 2);
}
const nodeMajor = Number(process.versions.node.split('.')[0]);
const currentHead = git(['rev-parse', 'HEAD']).trim();
const initialTrackedStatus = git(['status', '--porcelain', '--untracked-files=no']);
const commands = [];
let classification = 'PASS';
let failure = null;
let implementation = null;

if (nodeMajor !== plan.requiredNodeMajor) {
  classification = 'NOT_RUN';
  failure = `NODE_MAJOR_${nodeMajor}_REQUIRED_${plan.requiredNodeMajor}`;
} else if (currentHead !== expectedHead) {
  classification = 'NOT_RUN';
  failure = `HEAD_MISMATCH:${currentHead}`;
} else if (initialTrackedStatus.trim()) {
  classification = 'NOT_RUN';
  failure = 'TRACKED_TREE_NOT_CLEAN_BEFORE_QUALIFICATION';
}

if (classification === 'PASS') {
  try {
    implementation = computeLafea4Tech13ImplementationFingerprint({ rootDir: ROOT });
  } catch (error) {
    classification = 'FAIL';
    failure = `IMPLEMENTATION_FINGERPRINT_FAILED:${error?.code ?? error?.message ?? 'UNKNOWN'}`;
  }
}

if (classification === 'PASS') {
  const dependency = execute(plan.dependencyInstall, 'INFRASTRUCTURE');
  commands.push(dependency);
  if (dependency.status !== 'PASS') {
    classification = 'NOT_RUN';
    failure = 'DEPENDENCY_INSTALL_NOT_RUN';
  }
}

if (classification === 'PASS') {
  for (const step of plan.steps.filter((row) => row.browser !== true)) {
    const result = execute(step, 'ENGINEERING');
    commands.push(result);
    if (result.status !== 'PASS') {
      classification = 'FAIL';
      failure = `ENGINEERING_STEP_FAILED:${step.id}`;
      break;
    }
  }
}

if (classification === 'PASS') {
  if (skipBrowser) {
    classification = 'NOT_RUN';
    failure = 'BROWSER_EXPLICITLY_SKIPPED';
  } else {
    const browserProvision = execute(plan.browserProvision, 'INFRASTRUCTURE');
    commands.push(browserProvision);
    if (browserProvision.status !== 'PASS') {
      classification = 'NOT_RUN';
      failure = 'BROWSER_PROVISION_NOT_RUN';
    }
  }
}

if (classification === 'PASS') {
  for (const step of plan.steps.filter((row) => row.browser === true)) {
    const result = execute(step, 'ENGINEERING');
    commands.push(result);
    if (result.status !== 'PASS') {
      classification = 'FAIL';
      failure = `ENGINEERING_STEP_FAILED:${step.id}`;
      break;
    }
  }
}

const finalTrackedStatus = git(['status', '--porcelain', '--untracked-files=no']);
if (classification === 'PASS' && finalTrackedStatus.trim()) {
  classification = 'FAIL';
  failure = 'TRACKED_TREE_CHANGED_DURING_QUALIFICATION';
}

const evidenceCore = {
  schema: 'lafea4-tech13-product-refinement-qualification-bundle/v2',
  qualificationId: plan.qualificationId,
  expectedHead,
  currentHead,
  nodeVersion: process.version,
  nodeMajor,
  planSha256: sha256(planText),
  runnerSha256: sha256(fs.readFileSync(RUNNER_PATH, 'utf8')),
  implementationFingerprint: implementation?.fingerprint ?? null,
  implementationManifestSha256: implementation?.manifestSha256 ?? null,
  implementationFileCount: implementation?.fileCount ?? null,
  trackedTreeCleanBefore: initialTrackedStatus.trim() === '',
  trackedTreeCleanAfter: finalTrackedStatus.trim() === '',
  browserRequested: !skipBrowser,
  commands,
  classification,
  qualificationComplete: classification === 'PASS',
  futurePromotionReviewEligible: classification === 'PASS',
  productRetentionAuthorized: false,
  uiBindingAuthorized: false,
  releaseQualified: false,
  hardGateActivated: false,
  failure,
};
const bundle = Object.freeze({
  ...evidenceCore,
  evidenceSha256: sha256(JSON.stringify(evidenceCore)),
});
const serialized = `${JSON.stringify(bundle, null, 2)}\n`;
if (outputPath) {
  const absolute = path.resolve(ROOT, outputPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, serialized, 'utf8');
}
process.stdout.write(serialized);
process.exitCode = classification === 'PASS' ? 0 : classification === 'FAIL' ? 1 : 2;

function execute(spec, authority) {
  const started = Date.now();
  const result = spawnSync(spec.executable, spec.args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: '1' },
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  return Object.freeze({
    id: spec.id,
    authority,
    executable: spec.executable,
    args: [...spec.args],
    status: result.status === 0 && !result.error ? 'PASS' : 'FAIL',
    exitCode: Number.isInteger(result.status) ? result.status : null,
    signal: result.signal ?? null,
    spawnError: result.error?.message ?? null,
    elapsedMs: Date.now() - started,
    stdoutSha256: sha256(stdout),
    stderrSha256: sha256(stderr),
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr),
  });
}
function git(gitArgs) {
  const result = spawnSync('git', gitArgs, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) fatal('GIT_FAILED', result.stderr || gitArgs.join(' '), 2);
  return result.stdout ?? '';
}
function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? null : null;
}
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function tail(value) {
  const rows = String(value).trimEnd().split(/\r?\n/u);
  return rows.slice(-12).join('\n').slice(-6000);
}
function fatal(code, message, exitCode) {
  process.stderr.write(`${code}: ${message}\n`);
  process.exit(exitCode);
}
