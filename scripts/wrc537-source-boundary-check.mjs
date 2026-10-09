import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const METHOD_DIR = path.join(ROOT, 'src/core/local-attachment-correlation/methods/wrc537');
const ALLOWED_METHOD_FILES = Object.freeze([
  'ed4-engineering-dataset.js',
  'ed4-execution-engine.js',
  'ed4-numerical-adapter.js',
  'ed4-numerical-release-candidate.js',
  'ed4-qualification-engine.js',
  'ed4-source-package.js',
  'source-readiness.js',
]);

assert.ok(fs.existsSync(METHOD_DIR), 'WRC537 controlled method directory must exist.');
const methodFiles = fs.readdirSync(METHOD_DIR).filter((name) => name.endsWith('.js')).sort();
assert.deepEqual(methodFiles, [...ALLOWED_METHOD_FILES],
  'WRC537 method directory contains an unreviewed or missing capability module. Update this boundary only with explicit engineering review.');

for (const methodFile of methodFiles) {
  const methodSource = read(`src/core/local-attachment-correlation/methods/wrc537/${methodFile}`);
  for (const forbidden of [
    'engineeringUseAuthorized: true',
    'READY_FOR_ENGINEERING_REGISTRY',
    'TRUSTED_CORRELATION_APPROVAL_AUTHORITIES.push',
    'registerWrc537',
    'WRC537_ENGINEERING_PROFILE',
  ]) {
    assert.equal(methodSource.includes(forbidden), false,
      `${methodFile} must not contain engineering-activation token ${forbidden}.`);
  }
}

const sourceReadiness = read('src/core/local-attachment-correlation/methods/wrc537/source-readiness.js');
assert.equal(sourceReadiness.includes('calculateWrc537'), false,
  'Source-readiness module must not become a numerical calculator.');

const trustedAuthorities = read('src/core/local-attachment-correlation/trusted-authorities.js');
assert.match(trustedAuthorities,
  /TRUSTED_CORRELATION_APPROVAL_AUTHORITIES\s*=\s*Object\.freeze\(\[\]\)/u,
  'No WRC537 approval authority may be trusted before independent approval/trust onboarding.');

for (const relativePath of [
  'src/core/local-attachment-correlation/index.js',
  'src/core/local-attachment-correlation/engineering-registry.js',
  'src/core/local-attachment-correlation/engineering-assessment.js',
  'src/workspace/lafea-correlation-product.js',
]) {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) continue;
  const source = fs.readFileSync(fullPath, 'utf8');
  assert.equal(source.toUpperCase().includes('WRC537'), false,
    `${relativePath} must not register or activate WRC537 before the approval/trust gate.`);
}

console.log(JSON.stringify({
  check: 'wrc537-source-boundary',
  status: 'PASS',
  sourceIndependentNumericalInfrastructurePresent: true,
  engineeringExecutionAuthorized: false,
  wrc537ProductRegistrationPresent: false,
  wrc537EngineeringRegistryRegistrationPresent: false,
  trustedApprovalAuthoritiesAdded: false,
  allowedMethodFiles: methodFiles,
}));

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}
