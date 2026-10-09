#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { validateS5PressureParityEvidence } from './lfea-s5-pressure-parity-evidence-contract.mjs';

const input = process.argv[2];
if (input === '--help' || input === '-h') {
  console.log('Usage: node scripts/lfea-s5-pressure-parity-evidence-file-check.mjs <evidence.json>');
  process.exit(0);
}
if (typeof input !== 'string' || input.trim() === '') {
  console.error('S5 pressure parity evidence path is required.');
  process.exit(2);
}

const requestedEvidencePath = path.resolve(process.cwd(), input);
try {
  const evidencePath = requireRegularFile(requestedEvidencePath, null, 'S5_PRESSURE_EVIDENCE_FILE_INVALID');
  const packageRoot = fs.realpathSync(path.dirname(evidencePath));
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  const result = validateS5PressureParityEvidence(evidence);
  const rawArtifactClaimsVerified = verifyRawArtifacts(evidence.runs, packageRoot);
  console.log(JSON.stringify({
    ...result,
    evidencePath,
    rawArtifactClaimsVerified,
    rawArtifactHashesVerified: true,
  }));
} catch (error) {
  console.error(JSON.stringify({
    status: error instanceof SyntaxError ? 'INVALID_EVIDENCE_FILE' : 'REJECTED_PARITY_EVIDENCE',
    evidencePath: requestedEvidencePath,
    code: String(error?.code ?? (error instanceof SyntaxError ? 'S5_PRESSURE_EVIDENCE_JSON_INVALID' : 'S5_PRESSURE_EVIDENCE_REJECTED')),
    evidence: error?.evidence ?? { message: String(error?.message ?? error) },
  }));
  process.exit(error instanceof SyntaxError ? 2 : 1);
}

function verifyRawArtifacts(runs, packageRoot) {
  const bindings = [
    ['jobFile', 'jobFileHash'],
    ['inputSource', 'inputSourceHash'],
    ['outputFile', 'outputFileHash'],
  ];
  let count = 0;
  for (const run of runs) {
    for (const [pathField, hashField] of bindings) {
      const artifactPath = requireRegularFile(
        path.resolve(packageRoot, ...run.rawArtifacts[pathField].replaceAll('\\', '/').split('/')),
        packageRoot,
        'S5_PRESSURE_RAW_ARTIFACT_FILE_INVALID',
        { runId: run.runId, role: pathField, relativePath: run.rawArtifacts[pathField] },
      );
      const actualHash = sha256File(artifactPath);
      if (actualHash !== run[hashField]) {
        fail('S5_PRESSURE_RAW_ARTIFACT_HASH_MISMATCH', {
          runId: run.runId,
          role: pathField,
          relativePath: run.rawArtifacts[pathField],
          actualHash,
          expectedHash: run[hashField],
        });
      }
      count += 1;
    }
  }
  return count;
}

function requireRegularFile(requestedPath, packageRoot, code, evidence = {}) {
  if (!fs.existsSync(requestedPath)) fail(code, { ...evidence, requestedPath, reason: 'MISSING' });
  const status = fs.lstatSync(requestedPath);
  if (status.isSymbolicLink() || !status.isFile()) {
    fail(code, { ...evidence, requestedPath, reason: status.isSymbolicLink() ? 'SYMLINK' : 'NOT_REGULAR_FILE' });
  }
  const realPath = fs.realpathSync(requestedPath);
  if (packageRoot !== null) {
    const relative = path.relative(packageRoot, realPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      fail(code, { ...evidence, requestedPath, realPath, reason: 'OUTSIDE_EVIDENCE_PACKAGE' });
    }
  }
  return realPath;
}

function sha256File(filePath) {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function fail(code, evidence) {
  const error = new Error(code);
  error.code = code;
  error.evidence = evidence ?? null;
  throw error;
}
