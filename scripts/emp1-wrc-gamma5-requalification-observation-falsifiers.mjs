#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const options = parseArgs(process.argv.slice(2));
if (!options.recordPath) throw gateError('EMP1_CURRENT_FALSIFIER_RECORD_REQUIRED');
if (!/^[0-9a-f]{40}$/u.test(options.expectedObservedHead ?? '')) {
  throw gateError('EMP1_CURRENT_FALSIFIER_EXPECTED_HEAD_REQUIRED');
}
const sourceRecord = JSON.parse(await readFile(resolve(root, options.recordPath), 'utf8'));
assert.equal(sourceRecord.observedHeadSha, options.expectedObservedHead);
const baseline = runReplay(options.recordPath);
assert.equal(baseline.status, 0,
  `EMP1_CURRENT_FALSIFIER_BASELINE_FAILED\nSTDOUT:\n${baseline.stdout}\nSTDERR:\n${baseline.stderr}`);

const tempRoot = await mkdtemp(join(tmpdir(), 'emp1-current-authority-falsifiers-'));
const detections = [];
try {
  const mutations = [
    { name: 'semantic-hash-corruption', recompute: false,
      mutate: (r) => { r.observationSemanticHash = '0'.repeat(64); } },
    { name: 'qualification-substitution', mutate: (r) => { r.qualificationRecordSha256 = '0'.repeat(64); } },
    { name: 'source-substitution', mutate: (r) => { r.sourceDocumentSha256 = '0'.repeat(64); } },
    { name: 'physical-load-drift', mutate: (r) => {
      const row = r.physicalWrcLoadComparisons[0]; row.actual += 1; row.absoluteDelta = Math.abs(row.actual - row.expected);
    } },
    { name: 'stress-oracle-substitution', mutate: (r) => { r.stressComparisons[0].expected += 1; } },
    { name: 'coherent-out-of-tolerance-stress', mutate: (r) => {
      const row = r.stressComparisons[0]; row.actual = row.expected + 2 * row.tolerance;
      row.absoluteDelta = Math.abs(row.actual - row.expected);
      row.relativeDelta = row.absoluteDelta / Math.max(1, Math.abs(row.expected));
      row.toleranceRatio = row.absoluteDelta / row.tolerance;
      const governing = r.stressComparisons.reduce((a, b) => b.toleranceRatio > a.toleranceRatio ? b : a,
        r.stressComparisons[0]);
      r.maxToleranceRatio = governing.toleranceRatio; r.governingComparison = structuredClone(governing);
    } },
    { name: 'stress-row-deletion', mutate: (r) => { r.stressComparisons.pop(); } },
    { name: 'authority-escalation', mutate: (r) => {
      r.authorityBoundary.authorityCreatedByThisObservation = true;
      r.currentAuthority.globalEmp1CRouteAuthority = true;
    } },
    { name: 'subordinate-hash-substitution', mutate: (r) => {
      r.subordinateEvidence.qualificationBinding.stdoutSha256 = 'f'.repeat(64);
    } },
    { name: 'historical-evidence-forgery', mutate: (r) => {
      r.standardHistoricalQualification.numericalQualification = 'PASS';
    } },
  ];
  for (let index = 0; index < mutations.length; index += 1) {
    const mutation = mutations[index];
    const record = structuredClone(sourceRecord);
    mutation.mutate(record);
    if (mutation.recompute !== false) record.observationSemanticHash = semanticHash(record);
    const path = join(tempRoot, `${String(index + 1).padStart(2, '0')}-${mutation.name}.json`);
    await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    const result = runReplay(path);
    assert.notEqual(result.status, 0, `EMP1_CURRENT_FALSIFIER_NOT_DETECTED:${mutation.name}`);
    detections.push({ name: mutation.name, detected: true });
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
assert.equal(detections.length, 10);
assert.ok(detections.every((value) => value.detected));
const receipt = {
  schema: 'emp1-wrc537-gamma5-current-authority-reobservation-falsifiers/v1',
  status: 'PASS_CURRENT_AUTHORITY_REOBSERVATION_ANTI_FORGERY_FALSIFIERS',
  observedHeadSha: sourceRecord.observedHeadSha,
  observationSemanticHash: sourceRecord.observationSemanticHash,
  baselineReplayRequiredAndPassed: true,
  mutationCount: detections.length,
  detections,
  productionRouteAuthorized: true,
  authorityCreatedByFalsifiers: false,
  standardHistoricalEvidenceCreatedByFalsifiers: false,
};
if (options.writeReceipt) await writeFile(resolve(root, options.writeReceipt), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(receipt, null, 2));

function runReplay(recordPath) {
  return spawnSync(process.execPath, [
    'scripts/emp1-wrc-gamma5-requalification-observation-replay-check.mjs',
    '--record', recordPath,
    '--expected-observed-head', options.expectedObservedHead,
  ], { cwd: root, encoding: 'utf8', env: { ...process.env, EMP1_EXACT_HEAD_PARENT_SHA: options.expectedObservedHead } });
}
function semanticHash(record) {
  const { observationSemanticHash: _hash, status: _status, ...payload } = record;
  return sha256Canonical(payload);
}
function sha256Canonical(value) {
  return createHash('sha256').update(JSON.stringify(sortValue(value)), 'utf8').digest('hex');
}
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  return value;
}
function parseArgs(args) {
  const out = { recordPath: null, expectedObservedHead: null, writeReceipt: null };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--record') out.recordPath = args[++index] ?? null;
    else if (args[index] === '--expected-observed-head') out.expectedObservedHead = args[++index] ?? null;
    else if (args[index] === '--write-receipt') out.writeReceipt = args[++index] ?? null;
    else throw gateError(`EMP1_CURRENT_FALSIFIER_UNKNOWN_ARGUMENT:${args[index]}`);
  }
  return out;
}
function gateError(code) { const error = new TypeError(code); error.code = code; return error; }
