#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMP1_PROFESSIONAL_SECURITY_HEADER_POLICY_SEMANTIC_HASH } from './emp1-professional-security-header-policy.mjs';
import { createEmp1ReleaseManifest } from './emp1-professional-release-manifest.mjs';
import { requireEmp1EngineeringEvidencePackage } from
  '../src/core/emp1/emp1-engineering-evidence-export.js';
import { currentEmp1WorkbenchRouteAuthority } from
  '../src/workspace/emp1-workbench-product-run.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const options = parseArgs(process.argv.slice(2));
const candidateHead = git(['rev-parse', 'HEAD']);
const candidateTree = git(['rev-parse', 'HEAD^{tree}']);
const candidateParent = git(['rev-parse', 'HEAD^']);
const worktreeStatus = git(['status', '--porcelain']);
const dependencyLockSha256 = await requiredFileSha256(
  'package-lock.json',
  'EMP1_RELEASE_CANDIDATE_DEPENDENCY_LOCK_REQUIRED',
);
const deploymentReceiptSha256 = options.deploymentReceipt
  ? await requiredFileSha256(
    options.deploymentReceipt,
    'EMP1_RELEASE_CANDIDATE_DEPLOYMENT_RECEIPT_REQUIRED',
  )
  : null;
const deploymentOperationsReceiptSha256 = options.deploymentOperationsReceipt
  ? await requiredFileSha256(
    options.deploymentOperationsReceipt,
    'EMP1_RELEASE_CANDIDATE_DEPLOYMENT_OPERATIONS_RECEIPT_REQUIRED',
  )
  : null;
const caseEngineeringEvidence = options.engineeringEvidencePackage
  ? await inspectCaseEngineeringEvidence(options.engineeringEvidencePackage)
  : null;

if (options.expectedHead && options.expectedHead !== candidateHead) {
  throw releaseError(`EMP1_RELEASE_CANDIDATE_HEAD_MISMATCH:${candidateHead}:${options.expectedHead}`);
}
if (options.release && worktreeStatus !== '') {
  throw releaseError('EMP1_RELEASE_CANDIDATE_CLEAN_WORKTREE_REQUIRED');
}

const readiness = runNode(
  'RELEASE_READINESS_POLICY',
  ['scripts/emp1-professional-release-readiness-check.mjs', ...(options.release ? ['--require-release'] : [])],
);
const prerequisiteBlocked = options.release && readiness.exitCode === 2;
if (prerequisiteBlocked) {
  const receipt = createReceipt({
    candidateHead,
    candidateTree,
    candidateParent,
    worktreeStatus,
    mode: 'RELEASE',
    executions: [readiness],
    buildArtifactSha256: null,
    status: 'BLOCKED_RELEASE_PREREQUISITES_NOT_READY',
    releaseCandidateQualified: false,
  });
  await maybeWriteReceipt(receipt, options.writeReceipt);
  console.log(JSON.stringify(receipt, null, 2));
  process.exit(2);
}
if (readiness.exitCode !== 0) {
  const receipt = createReceipt({
    candidateHead,
    candidateTree,
    candidateParent,
    worktreeStatus,
    mode: options.release ? 'RELEASE' : 'DIAGNOSTIC',
    executions: [readiness],
    buildArtifactSha256: null,
    status: readiness.status === 'NOT_RUN_EXECUTION_ENVIRONMENT'
      ? 'NOT_RUN_RELEASE_READINESS_EXECUTION_ENVIRONMENT'
      : 'FAIL_RELEASE_READINESS_POLICY',
    releaseCandidateQualified: false,
  });
  await maybeWriteReceipt(receipt, options.writeReceipt);
  console.log(JSON.stringify(receipt, null, 2));
  process.exit(readiness.status === 'NOT_RUN_EXECUTION_ENVIRONMENT' ? 3 : 1);
}

if (!options.release && !options.executeDiagnostics) {
  const receipt = createReceipt({
    candidateHead,
    candidateTree,
    candidateParent,
    worktreeStatus,
    mode: 'POLICY_ONLY',
    executions: [readiness],
    buildArtifactSha256: null,
    status: 'PASS_POLICY_ONLY_NO_RELEASE_EXECUTION_PERFORMED',
    releaseCandidateQualified: false,
  });
  await maybeWriteReceipt(receipt, options.writeReceipt);
  console.log(JSON.stringify(receipt, null, 2));
  process.exit(0);
}

const executions = [readiness];
if (options.release && !caseEngineeringEvidence) {
  const receipt = createReceipt({
    candidateHead,
    candidateTree,
    candidateParent,
    worktreeStatus,
    mode: 'RELEASE',
    executions,
    buildArtifactSha256: null,
    status: 'BLOCKED_CASE_ENGINEERING_EVIDENCE_REQUIRED',
    releaseCandidateQualified: false,
  });
  await maybeWriteReceipt(receipt, options.writeReceipt);
  console.log(JSON.stringify(receipt, null, 2));
  process.exit(2);
}
if (caseEngineeringEvidence) {
  executions.push(caseEngineeringEvidence.gate);
  if (options.release && caseEngineeringEvidence.gate.status !== 'PASS') {
    const receipt = createReceipt({
      candidateHead,
      candidateTree,
      candidateParent,
      worktreeStatus,
      mode: 'RELEASE',
      executions,
      buildArtifactSha256: null,
      status: 'FAIL_CASE_ENGINEERING_EVIDENCE',
      releaseCandidateQualified: false,
    });
    await maybeWriteReceipt(receipt, options.writeReceipt);
    console.log(JSON.stringify(receipt, null, 2));
    process.exit(1);
  }
}

const gates = [
  ['SOURCE_CUSTODY', process.execPath, ['scripts/emp1-source-custody-reconciliation-check.mjs']],
  ['WRC02_SOURCE_SEMANTICS', process.execPath,
    ['scripts/emp1-wrc537-bounded-source-semantics-profile-check.mjs']],
  ['WRC03_CURRENT_EXACT_HEAD', process.execPath,
    ['scripts/emp1-wrc-gamma5-exact-head-requalification.mjs',
      '--expected-head', candidateHead]],
  ['WRC04_BENCHMARK_EVIDENCE', npmCommand(), ['run', 'check:emp1-benchmarks']],
  ['ENGINEERING_EVIDENCE_EXPORT', npmCommand(), ['run', 'check:emp1-evidence-export']],
  ['ENGINEERING_REVIEW_CONTRACT', process.execPath,
    ['scripts/emp1-engineering-review-record-check.mjs']],
  ['ENGINEERING_REVIEW_READINESS', process.execPath,
    ['scripts/emp1-review-readiness-integration-check.mjs']],
  ['CAUX_REFERENCE_INTEGRITY', process.execPath,
    ['scripts/emp1-caux-pp24-31-benchmark-check.mjs']],
  ['CAUX_DIRECT_PDF_QUALIFICATION', process.execPath,
    ['scripts/emp1-caux-gamma-radius-reconciliation-check.mjs']],
  ['AUTHORIZED_RUNEMP1_ORCHESTRATION', process.execPath,
    ['scripts/emp1-wrc-gamma5-zero-dp-orchestration-qualification.mjs']],
  ['CURRENTNESS_REPLAY_FALSIFIERS', process.execPath,
    ['scripts/emp1-workbench-route-authority-currentness-falsifiers.mjs']],
  ['DEPENDENCY_LOCK_CUSTODY', process.execPath,
    ['scripts/emp1-professional-dependency-lock-check.mjs']],
  ['DEPENDENCY_LOCK_CUSTODY_FALSIFIER', process.execPath,
    ['scripts/emp1-professional-dependency-lock-falsifier.mjs']],
  ['DEPENDENCY_ADVISORY', process.execPath,
    ['scripts/emp1-professional-dependency-advisory-check.mjs']],
  ['DEPENDENCY_ADVISORY_FALSIFIER', process.execPath,
    ['scripts/emp1-professional-dependency-advisory-falsifier.mjs']],
  ['PRODUCTION_BUILD', npmCommand(), ['run', 'build']],
  ['BUILD_ARTIFACT_SECURITY', process.execPath,
    ['scripts/emp1-professional-build-artifact-security-check.mjs']],
  ['BUILD_ARTIFACT_SECURITY_FALSIFIER', process.execPath,
    ['scripts/emp1-professional-build-artifact-security-falsifier.mjs']],
  ['EMP1_RELEASE_CHROMIUM', process.execPath,
    ['scripts/run-playwright.mjs', 'e2e/emp1-professional-release.spec.js']],
];
for (const [gateId, command, args] of gates) executions.push(run(gateId, command, args));

const buildPassed = executions.find((item) => item.gateId === 'PRODUCTION_BUILD')?.status === 'PASS';
const buildArtifactSha256 = buildPassed
  ? await hashDirectory(resolve(root, 'dist'))
  : null;
let fail = executions.find((item) => item.status === 'FAIL');
let notRun = executions.find((item) => item.status === 'NOT_RUN_EXECUTION_ENVIRONMENT');

if (options.release && !fail && !notRun) {
  if (!options.deploymentReceipt) {
    const receipt = createReceipt({
      candidateHead,
      candidateTree,
      candidateParent,
      worktreeStatus,
      mode: 'RELEASE',
      executions,
      buildArtifactSha256,
      status: 'BLOCKED_DEPLOYMENT_EVIDENCE_REQUIRED',
      releaseCandidateQualified: false,
    });
    await maybeWriteReceipt(receipt, options.writeReceipt);
    console.log(JSON.stringify(receipt, null, 2));
    process.exit(2);
  }
  if (!/^[0-9a-f]{64}$/u.test(buildArtifactSha256 ?? '')) {
    throw releaseError('EMP1_RELEASE_CANDIDATE_BUILD_ARTIFACT_HASH_REQUIRED');
  }
  executions.push(runNode('DEPLOYMENT_EVIDENCE', [
    'scripts/emp1-professional-deployment-receipt-check.mjs',
    '--receipt', options.deploymentReceipt,
    '--expected-head', candidateHead,
    '--expected-tree', candidateTree,
    '--expected-artifact-sha256', buildArtifactSha256,
  ]));
  fail = executions.find((item) => item.status === 'FAIL');
  notRun = executions.find((item) => item.status === 'NOT_RUN_EXECUTION_ENVIRONMENT');

  if (!fail && !notRun) {
    executions.push(runNode('DEPLOYMENT_SECURITY_HEADERS', [
      'scripts/emp1-professional-deployment-security-headers-check.mjs',
      '--receipt', options.deploymentReceipt,
      '--expected-head', candidateHead,
      '--expected-tree', candidateTree,
      '--expected-artifact-sha256', buildArtifactSha256,
    ]));
    fail = executions.find((item) => item.status === 'FAIL');
    notRun = executions.find((item) => item.status === 'NOT_RUN_EXECUTION_ENVIRONMENT');
  }

  if (!fail && !notRun) {
    if (!options.deploymentOperationsReceipt) {
      const receipt = createReceipt({
        candidateHead,
        candidateTree,
        candidateParent,
        worktreeStatus,
        mode: 'RELEASE',
        executions,
        buildArtifactSha256,
        status: 'BLOCKED_DEPLOYMENT_OPERATIONS_EVIDENCE_REQUIRED',
        releaseCandidateQualified: false,
      });
      await maybeWriteReceipt(receipt, options.writeReceipt);
      console.log(JSON.stringify(receipt, null, 2));
      process.exit(2);
    }
    executions.push(runNode('DEPLOYMENT_OPERATIONS', [
      'scripts/emp1-professional-deployment-operations-check.mjs',
      '--receipt', options.deploymentOperationsReceipt,
      '--deployment-receipt', options.deploymentReceipt,
      '--expected-head', candidateHead,
      '--expected-tree', candidateTree,
      '--expected-artifact-sha256', buildArtifactSha256,
    ]));
    fail = executions.find((item) => item.status === 'FAIL');
    notRun = executions.find((item) => item.status === 'NOT_RUN_EXECUTION_ENVIRONMENT');
  }
}

const allExecutedPass = executions.every((item) => item.status === 'PASS');
const releaseCandidateQualified = options.release
  && Boolean(options.deploymentReceipt)
  && Boolean(options.deploymentOperationsReceipt)
  && caseEngineeringEvidence?.gate.status === 'PASS'
  && caseEngineeringEvidence?.custody.reviewAcceptedCurrent === true
  && allExecutedPass;
const status = releaseCandidateQualified
  ? 'PASS_EMP1_PROFESSIONAL_RELEASE_CANDIDATE_AND_DEPLOYMENT_EVIDENCE'
  : notRun
    ? 'NOT_RUN_EMP1_PROFESSIONAL_RELEASE_CANDIDATE_EXECUTION_ENVIRONMENT'
    : fail
      ? 'FAIL_EMP1_PROFESSIONAL_RELEASE_CANDIDATE_EXECUTION'
      : 'PASS_DIAGNOSTIC_EXECUTION_RELEASE_NOT_REQUESTED';
const receipt = createReceipt({
  candidateHead,
  candidateTree,
  candidateParent,
  worktreeStatus,
  mode: options.release ? 'RELEASE' : 'DIAGNOSTIC',
  executions,
  buildArtifactSha256,
  status,
  releaseCandidateQualified,
});
await maybeWriteReceipt(receipt, options.writeReceipt);
console.log(JSON.stringify(receipt, null, 2));
if (notRun) process.exit(3);
if (fail) process.exit(1);
if (options.release && !releaseCandidateQualified) process.exit(2);

function createReceipt(input) {
  const candidate = {
    headSha: input.candidateHead,
    treeSha: input.candidateTree,
    parentSha: input.candidateParent,
    cleanWorktree: input.worktreeStatus === '',
    buildArtifactSha256: input.buildArtifactSha256,
    dependencySecurity: {
      packageLockPath: 'package-lock.json',
      packageLockSha256: dependencyLockSha256,
      advisoryAuditLevel: 'HIGH',
      liveAdvisoryGateId: 'DEPENDENCY_ADVISORY',
    },
    deployedSecurityHeaders: {
      policySemanticHash: EMP1_PROFESSIONAL_SECURITY_HEADER_POLICY_SEMANTIC_HASH,
      liveObservationGateId: 'DEPLOYMENT_SECURITY_HEADERS',
      browserCompatibilityEstablishedByHeaderPolicy: false,
    },
    deploymentEvidence: {
      deploymentReceiptSha256,
      gateId: 'DEPLOYMENT_EVIDENCE',
    },
    deploymentOperations: {
      deploymentOperationsReceiptSha256,
      gateId: 'DEPLOYMENT_OPERATIONS',
      rollbackExecutionObservedByThisHarness: false,
      rollbackSuccessAuthorizedByThisHarness: false,
    },
    caseEngineeringEvidence: caseEngineeringEvidence?.custody ?? null,
  };
  const releaseManifest = createEmp1ReleaseManifest({
    candidateHead: input.candidateHead,
    candidateTree: input.candidateTree,
    candidateParent: input.candidateParent,
    executions: input.executions,
    buildArtifactSha256: input.buildArtifactSha256,
    releaseCandidateQualified: input.releaseCandidateQualified,
    currentCandidateProvenance: candidate,
  });
  const payload = {
    schema: 'emp1-professional-release-candidate-receipt/v1',
    candidate,
    mode: input.mode,
    executions: input.executions,
    releaseManifest,
    releaseCandidateQualified: input.releaseCandidateQualified,
    authorityBoundary: {
      thisHarnessMutatesEngineeringAuthority: false,
      dependencySecurityCanBlockRelease: true,
      dependencySecurityCreatesEngineeringAuthority: false,
      vulnerabilityFreeClaimedByThisHarness: false,
      deployedSecurityHeadersCanBlockRelease: true,
      browserCompatibilityEstablishedByHeaderPolicy: false,
      deploymentOperationsCanBlockRelease: true,
      rollbackExecutionObservedByThisHarness: false,
      rollbackSuccessAuthorizedByThisHarness: false,
      codeComplianceAuthorizedByThisHarness: false,
      deploymentAuthorityGrantedByThisHarness: false,
      broaderApplicationSecurityCertificationClaimed: false,
    },
  };
  return {
    ...payload,
    receiptSemanticHash: sha256Canonical(payload),
    status: input.status,
  };
}

async function inspectCaseEngineeringEvidence(path) {
  const resolved = resolve(root, path);
  const allowedRoot = resolve(root, 'validation/emp1/release');
  const command = `validate case engineering evidence ${path}`;
  try {
    if (resolved !== allowedRoot && !resolved.startsWith(`${allowedRoot}/`)) {
      throw releaseError('EMP1_RELEASE_CASE_ENGINEERING_EVIDENCE_PATH_OUTSIDE_RELEASE_VALIDATION');
    }
    const retainedFile = await requiredTrackedCandidateFile(
      resolved,
      'EMP1_RELEASE_CASE_ENGINEERING_EVIDENCE',
    );
    const bytes = retainedFile.bytes;
    const retained = requireEmp1EngineeringEvidencePackage(
      JSON.parse(bytes.toString('utf8')),
    );
    const packageMetadata = JSON.parse(
      await readFile(resolve(root, 'package.json'), 'utf8'),
    );
    const releaseProfile = JSON.parse(
      await readFile(
        resolve(
          root,
          'validation/emp1/release/emp1-wrc537-gamma5-bounded-release-profile-v1.json',
        ),
        'utf8',
      ),
    );
    const routeAuthority = currentEmp1WorkbenchRouteAuthority();
    const reasons = [];
    if (retained.product.version !== packageMetadata.version) {
      reasons.push('EMP1_RELEASE_CASE_ENGINEERING_EVIDENCE_PRODUCT_VERSION_MISMATCH');
    }
    if (retained.releaseProfile.id !== releaseProfile.releaseProfileId
      || retained.releaseProfile.version !== releaseProfile.schema) {
      reasons.push('EMP1_RELEASE_CASE_ENGINEERING_EVIDENCE_RELEASE_PROFILE_MISMATCH');
    }
    if (routeAuthority.productionUseAuthorized !== true
      || retained.calculation.routeAuthority.hash !== routeAuthority.routeAuthorityHash) {
      reasons.push('EMP1_RELEASE_CASE_ENGINEERING_EVIDENCE_ROUTE_AUTHORITY_MISMATCH');
    }
    if (retained.review.record == null
      || retained.review.state.state !== 'REVIEW_ACCEPTED'
      || retained.review.state.current !== true
      || retained.review.state.disposition !== 'ACCEPTED') {
      reasons.push('EMP1_RELEASE_CASE_ENGINEERING_REVIEW_ACCEPTED_CURRENT_REQUIRED');
    }
    if (retained.authorityBoundary.releaseQualified !== false
      || retained.authorityBoundary.createsReleaseAuthority !== false
      || retained.authorityBoundary.codeComplianceState !== 'NOT_ASSESSED') {
      reasons.push('EMP1_RELEASE_CASE_ENGINEERING_EVIDENCE_AUTHORITY_BOUNDARY_INVALID');
    }
    if (reasons.length) throw releaseError(reasons.join(':'));

    const custody = Object.freeze({
      path: retainedFile.path,
      packageGitBlobSha1: retainedFile.gitBlobSha1,
      packageSha256: createHash('sha256').update(bytes).digest('hex'),
      packageSchema: retained.schema,
      packageSemanticHash: retained.semanticHash,
      productVersion: retained.product.version,
      releaseProfileId: retained.releaseProfile.id,
      releaseProfileVersion: retained.releaseProfile.version,
      routeAuthorityHash: retained.calculation.routeAuthority.hash,
      reviewAcceptedCurrent: true,
      reviewState: retained.review.state.state,
      reviewDisposition: retained.review.state.disposition,
      reviewId: retained.review.state.reviewId,
      reviewSemanticHash: retained.review.state.reviewSemanticHash,
      reviewedAt: retained.review.record.reviewedAt,
      reviewerIdentity: retained.review.record.reviewer.identity,
    });
    return Object.freeze({
      custody,
      gate: evidenceGate('CASE_ENGINEERING_EVIDENCE', command, 'PASS', custody, null),
    });
  } catch (error) {
    return Object.freeze({
      custody: null,
      gate: evidenceGate(
        'CASE_ENGINEERING_EVIDENCE',
        command,
        'FAIL',
        null,
        error?.code ?? error?.message ?? 'EMP1_RELEASE_CASE_ENGINEERING_EVIDENCE_INVALID',
      ),
    });
  }
}

function evidenceGate(gateId, command, status, payload, errorCode) {
  const stdout = payload ? JSON.stringify(payload) : '';
  const stderr = errorCode ? String(errorCode) : '';
  return Object.freeze({
    gateId,
    command,
    status,
    exitCode: status === 'PASS' ? 0 : 1,
    signal: null,
    errorCode,
    stdoutSha256: sha256Text(stdout),
    stderrSha256: sha256Text(stderr),
    stdoutBytes: Buffer.byteLength(stdout, 'utf8'),
    stderrBytes: Buffer.byteLength(stderr, 'utf8'),
  });
}

function runNode(gateId, args) {
  return run(gateId, process.execPath, args);
}
function run(gateId, command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env },
    maxBuffer: 32 * 1024 * 1024,
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const notRun = Boolean(result.error)
    || result.status == null
    || result.error?.code === 'ENOENT'
    || (gateId === 'DEPENDENCY_ADVISORY' && result.status === 3)
    || (gateId === 'DEPLOYMENT_SECURITY_HEADERS' && result.status === 3);
  return Object.freeze({
    gateId,
    command: [command, ...args].join(' '),
    status: notRun ? 'NOT_RUN_EXECUTION_ENVIRONMENT' : result.status === 0 ? 'PASS' : 'FAIL',
    exitCode: Number.isInteger(result.status) ? result.status : null,
    signal: result.signal ?? null,
    errorCode: result.error?.code ?? null,
    stdoutSha256: sha256Text(stdout),
    stderrSha256: sha256Text(stderr),
    stdoutBytes: Buffer.byteLength(stdout, 'utf8'),
    stderrBytes: Buffer.byteLength(stderr, 'utf8'),
  });
}
function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw releaseError(`EMP1_RELEASE_CANDIDATE_GIT_REQUIRED:${args.join('_')}`);
  }
  return String(result.stdout ?? '').trim();
}
async function requiredFileSha256(path, code) {
  try {
    return createHash('sha256').update(await readFile(resolve(root, path))).digest('hex');
  } catch {
    throw releaseError(code);
  }
}

async function requiredTrackedCandidateFile(path, code) {
  const stat = await lstat(path).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) {
    throw releaseError(`${code}_REGULAR_FILE_REQUIRED`);
  }
  const relativePath = relative(root, path).replaceAll('\\', '/');
  if (!relativePath || relativePath === '..' || relativePath.startsWith('../')) {
    throw releaseError(`${code}_PATH_OUTSIDE_REPOSITORY`);
  }
  let headBlob;
  let worktreeBlob;
  try {
    headBlob = git(['rev-parse', `HEAD:${relativePath}`]);
    worktreeBlob = git(['hash-object', '--', relativePath]);
  } catch {
    throw releaseError(`${code}_TRACKED_CANDIDATE_BLOB_REQUIRED`);
  }
  if (!/^[0-9a-f]{40}$/u.test(headBlob)
    || !/^[0-9a-f]{40}$/u.test(worktreeBlob)
    || headBlob !== worktreeBlob) {
    throw releaseError(`${code}_CANDIDATE_BLOB_DRIFT`);
  }
  return Object.freeze({
    path: relativePath,
    gitBlobSha1: headBlob,
    bytes: await readFile(path),
  });
}
async function hashDirectory(directory) {
  const rows = [];
  await walk(directory);
  rows.sort((a, b) => a.path.localeCompare(b.path));
  return sha256Text(rows.map((row) => `${row.path}\0${row.sha256}`).join('\n'));

  async function walk(path) {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw releaseError('EMP1_RELEASE_BUILD_ARTIFACT_SYMLINK_PROHIBITED');
    if (stat.isFile()) {
      rows.push({
        path: relative(directory, path).replaceAll('\\', '/'),
        sha256: createHash('sha256').update(await readFile(path)).digest('hex'),
      });
      return;
    }
    if (!stat.isDirectory()) return;
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      await walk(join(path, entry.name));
    }
  }
}
function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}
async function maybeWriteReceipt(receipt, path) {
  if (!path) return;
  const resolved = resolve(root, path);
  const allowedRoot = resolve(root, 'validation/emp1/release');
  if (resolved !== allowedRoot && !resolved.startsWith(`${allowedRoot}/`)) {
    throw releaseError('EMP1_RELEASE_CANDIDATE_RECEIPT_PATH_OUTSIDE_RELEASE_VALIDATION');
  }
  await writeFile(resolved, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
}
function parseArgs(args) {
  const out = {
    release: false,
    executeDiagnostics: false,
    expectedHead: null,
    writeReceipt: null,
    deploymentReceipt: null,
    deploymentOperationsReceipt: null,
    engineeringEvidencePackage: null,
  };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--release') out.release = true;
    else if (args[index] === '--execute-diagnostics') out.executeDiagnostics = true;
    else if (args[index] === '--expected-head') out.expectedHead = args[++index] ?? null;
    else if (args[index] === '--write-receipt') out.writeReceipt = args[++index] ?? null;
    else if (args[index] === '--deployment-receipt') out.deploymentReceipt = args[++index] ?? null;
    else if (args[index] === '--deployment-operations-receipt') out.deploymentOperationsReceipt = args[++index] ?? null;
    else if (args[index] === '--engineering-evidence-package') out.engineeringEvidencePackage = args[++index] ?? null;
    else throw releaseError(`EMP1_RELEASE_CANDIDATE_UNKNOWN_ARGUMENT:${args[index]}`);
  }
  if (out.release && out.executeDiagnostics) {
    throw releaseError('EMP1_RELEASE_CANDIDATE_RELEASE_AND_DIAGNOSTIC_ARE_MUTUALLY_EXCLUSIVE');
  }
  if (out.release && !out.writeReceipt) {
    throw releaseError('EMP1_RELEASE_CANDIDATE_RETAINED_RECEIPT_REQUIRED');
  }
  if (out.deploymentReceipt && !out.release) {
    throw releaseError('EMP1_RELEASE_CANDIDATE_DEPLOYMENT_RECEIPT_REQUIRES_RELEASE_MODE');
  }
  if (out.deploymentOperationsReceipt && !out.release) {
    throw releaseError('EMP1_RELEASE_CANDIDATE_DEPLOYMENT_OPERATIONS_RECEIPT_REQUIRES_RELEASE_MODE');
  }
  if (out.expectedHead && !/^[0-9a-f]{40}$/u.test(out.expectedHead)) {
    throw releaseError('EMP1_RELEASE_CANDIDATE_EXPECTED_HEAD_INVALID');
  }
  return out;
}
function sha256Text(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
function sha256Canonical(value) {
  return sha256Text(JSON.stringify(sortValue(value)));
}
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value;
}
function releaseError(code) {
  const error = new TypeError(code);
  error.code = code;
  return error;
}
