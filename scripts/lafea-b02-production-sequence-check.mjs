#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { canonicalLafeaSha256 } from '../src/workspace/lafea-canonical-sha256.js';

const checks = [
  ['B02C_ANALYTICAL_TRACTION', 'scripts/lafea-b02c-analytical-traction-check.mjs'],
  ['B02D_POLAR_MESH', 'scripts/lafea-b02d-v2-preobservation-quality-check.mjs'],
  ['B02A', 'scripts/lafea-b02a-production-check.mjs'],
  ['B02B', 'scripts/lafea-b02b-production-check.mjs'],
  ['B02C', 'scripts/lafea-b02c-production-check.mjs'],
  ['B02D', 'scripts/lafea-b02d-production-check.mjs'],
];
const receipts = {};
for (const [id, script] of checks) {
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    console.error(`LAFEA_B02_PRODUCTION_SEQUENCE_BLOCKED_AT_${id}`);
    process.exit(result.status ?? 1);
  }
  const receipt = parseReceipt(result.stdout, id);
  assert.equal(receipt.status, 'PASS', `${id} did not emit PASS`);
  receipts[id] = receipt;
  process.stdout.write(result.stdout);
}

for (const id of ['B02A', 'B02B', 'B02C', 'B02D']) {
  assert.equal(receipts[id].caseId, id);
  assert.equal(receipts[id].definitionFrozenBeforeObservation, true);
  assert.equal(receipts[id].productionOutputUsedToChooseDefinition, false);
  assert.equal(receipts[id].releaseAuthorityGranted, false);
  assert.equal(receipts[id].temperatureAuthorityGranted, false);
}
assert.equal(receipts.B02D.requiredMethods.includes('T6'), true);
assert.equal(receipts.B02D.requiredMethods.includes('Q8'), true);
assert.equal(receipts.B02D.t3Disposition, 'CONTROL_NOT_RELEASE_CRITICAL');

const precursorHashes = Object.freeze(Object.fromEntries(
  Object.entries(receipts).map(([id, receipt]) => [id, receipt.semanticHash ?? canonicalLafeaSha256(receipt)]),
));
const body = {
  schema: 'lafea-b02e-production-qualification-receipt/v1',
  caseId: 'B02E',
  status: 'PASS',
  executionOrder: ['B02A', 'B02B', 'B02C', 'B02D', 'B02E'],
  precursorHashes,
  fixedDefinitionsPrecededObservation: true,
  quantityBoundConvergenceApplied: true,
  requiredMethodsQualified: true,
  b02Qualified: true,
  releaseAuthorityGranted: false,
  temperatureAuthorityGranted: false,
};
const receipt = Object.freeze({
  ...body,
  semanticHash: canonicalLafeaSha256({
    schema: 'lafea-b02e-production-qualification-receipt-hash-input/v1', receipt: body,
  }),
});
console.log(JSON.stringify(receipt));

function parseReceipt(stdout, id) {
  const text = String(stdout ?? '').trim();
  if (!text) throw new TypeError(`LAFEA_B02_${id}_RECEIPT_MISSING`);
  try {
    return JSON.parse(text);
  } catch {
    const starts = [...text.matchAll(/\{/gu)].map((match) => match.index).reverse();
    for (const start of starts) {
      try { return JSON.parse(text.slice(start)); } catch { /* continue */ }
    }
    throw new TypeError(`LAFEA_B02_${id}_RECEIPT_INVALID_JSON`);
  }
}
