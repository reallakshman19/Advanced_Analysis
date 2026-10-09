import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const METHOD_DIR = path.join(
  ROOT, 'src/core/local-attachment-correlation/methods/wrc537',
);

assert.ok(fs.existsSync(METHOD_DIR), 'WRC537 source-readiness directory must exist.');
const methodFiles = fs.readdirSync(METHOD_DIR).sort();
assert.deepEqual(methodFiles, ['source-readiness.js'],
  'WRC537 must remain source-readiness only until the release gate is satisfied.');

const methodSource = read('src/core/local-attachment-correlation/methods/wrc537/source-readiness.js');
for (const forbidden of [
  'calculateWrc537',
  'WRC537_ENGINEERING_PROFILE',
  'engineeringUseAuthorized: true',
  'READY_FOR_ENGINEERING_REGISTRY',
]) {
  assert.equal(methodSource.includes(forbidden), false,
    `WRC537 readiness core must not contain activation token ${forbidden}.`);
}

const trustedAuthorities = read('src/core/local-attachment-correlation/trusted-authorities.js');
assert.match(trustedAuthorities,
  /TRUSTED_CORRELATION_APPROVAL_AUTHORITIES\s*=\s*Object\.freeze\(\[\]\)/u,
  'No WRC537 approval authority may be trusted by this source-intake PR.');

const productPath = path.join(ROOT, 'src/workspace/lafea-correlation-product.js');
if (fs.existsSync(productPath)) {
  const productSource = fs.readFileSync(productPath, 'utf8');
  assert.equal(productSource.includes('WRC537'), false,
    'WRC537 must not be registered in the product before source readiness passes.');
}

console.log(JSON.stringify({
  check: 'wrc537-source-boundary',
  status: 'PASS',
  wrc537NumericalImplementationPresent: false,
  wrc537ProductRegistrationPresent: false,
  trustedApprovalAuthoritiesAdded: false,
  allowedMethodFiles: methodFiles,
}));

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}
