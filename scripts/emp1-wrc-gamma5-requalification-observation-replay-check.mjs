#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const options = parseArgs(process.argv.slice(2));
if (!options.recordPath) throw gateError('EMP1_CURRENT_REPLAY_RECORD_REQUIRED');
if (!/^[0-9a-f]{40}$/u.test(options.expectedObservedHead ?? '')) {
  throw gateError('EMP1_CURRENT_REPLAY_EXPECTED_HEAD_REQUIRED');
}
const actualHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
assert.equal(actualHead, options.expectedObservedHead,
  `EMP1_CURRENT_REPLAY_HEAD_MISMATCH:${actualHead}:${options.expectedObservedHead}`);
const record = await readJson(options.recordPath);
assert.equal(record.observedHeadSha, options.expectedObservedHead);

const baseRun = runScript('scripts/emp1-wrc-gamma5-requalification-observation-check.mjs', [
  '--record', options.recordPath,
  '--expected-observed-head', options.expectedObservedHead,
]);
const base = requireRecord(baseRun.records,
  'emp1-wrc537-gamma5-current-authority-reobservation-check/v1');
assert.equal(base.status, 'PASS_CURRENT_AUTHORITY_REOBSERVATION_FULL_MATRIX_INTEGRITY');

const independentRun = runScript('scripts/emp1-wrc537-independent-oracle-decoupling-check.mjs');
assertReplay(record.subordinateEvidence.independentDecoupling, independentRun,
  'emp1-wrc537-independent-oracle-decoupling/v2', 'PASS_INDEPENDENT_ORACLE_INTERPRETATION_DECOUPLED');
assertReplay(record.subordinateEvidence.independentRefreeze, independentRun,
  'emp1-wrc537-gamma5-post-authority-independent-refreeze/v1', 'PASS_FROZEN_POST_AUTHORITY_PHYSICAL_TABLE5_ORACLE');
const falsifierRun = runScript('scripts/emp1-wrc-gamma5-post-authority-refreeze-falsifiers.mjs');
assertReplay(record.subordinateEvidence.independentFalsifiers, falsifierRun,
  'emp1-wrc537-gamma5-post-authority-refreeze-falsifiers/v1', 'PASS_POST_AUTHORITY_PHYSICAL_ORACLE_FALSIFIERS');
const bindingRun = runScript('scripts/emp1-wrc-gamma5-route-requalification-candidate-check.mjs');
assertReplay(record.subordinateEvidence.qualificationBinding, bindingRun,
  'emp1-wrc537-gamma5-route-requalification-candidate-check/v1');
const reconciliationRun = runScript('scripts/emp1-wrc-gamma5-authority-identity-reconciliation-check.mjs');
assertReplay(record.subordinateEvidence.authorityIdentityReconciliation, reconciliationRun,
  'emp1-wrc537-gamma5-authority-identity-reconciliation-check/v2',
  'PASS_CURRENT_AUTHORITY_IDENTITIES_RECONCILED_WITH_AUTHORITY_STALENESS_AND_ROLE_AWARE_HASH_GUARDS_STANDARD_NUMERICAL_EVIDENCE_STILL_NOT_RUN');

const receipt = {
  schema: 'emp1-wrc537-gamma5-current-authority-reobservation-replay/v1',
  status: 'PASS_CURRENT_AUTHORITY_REOBSERVATION_SUBORDINATE_REPLAY',
  observedHeadSha: record.observedHeadSha,
  observationSemanticHash: record.observationSemanticHash,
  baseVerifierStatus: base.status,
  currentAuthority: structuredClone(record.currentAuthority),
  authorityCreatedByReplay: false,
  standardHistoricalEvidenceCreatedByReplay: false,
  standardHistoricalQualification: 'NOT_RUN_NOT_CLAIMED',
  replayedEvidence: {
    independentDecouplingStdoutSha256: independentRun.stdoutSha256,
    independentRefreezeStdoutSha256: independentRun.stdoutSha256,
    independentFalsifiersStdoutSha256: falsifierRun.stdoutSha256,
    qualificationBindingStdoutSha256: bindingRun.stdoutSha256,
    authorityIdentityReconciliationStdoutSha256: reconciliationRun.stdoutSha256,
  },
};
if (options.writeReceipt) await writeFile(resolve(root, options.writeReceipt), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(receipt, null, 2));

function assertReplay(stored, run, schema, expectedStatus = null) {
  assert.ok(stored && typeof stored === 'object', `EMP1_CURRENT_REPLAY_STORED_REQUIRED:${schema}`);
  const replayed = requireRecord(run.records, schema);
  assert.equal(run.stdoutSha256, stored.stdoutSha256, `EMP1_CURRENT_REPLAY_STDOUT_DRIFT:${schema}`);
  assert.equal(stored.schema, schema);
  assert.equal(replayed.status, stored.status);
  if (expectedStatus) assert.equal(replayed.status, expectedStatus);
  else assert.match(replayed.status ?? '', /^PASS/u);
}
function runScript(path, args = []) {
  const completed = spawnSync(process.execPath, [path, ...args], { cwd: root, encoding: 'utf8',
    env: { ...process.env, EMP1_EXACT_HEAD_PARENT_SHA: options.expectedObservedHead } });
  assert.equal(completed.status, 0,
    `EMP1_CURRENT_REPLAY_SUBORDINATE_FAILED:${path}\nSTDOUT:\n${completed.stdout ?? ''}\nSTDERR:\n${completed.stderr ?? ''}`);
  const stdout = completed.stdout ?? '';
  return { path, records: extractJsonObjects(stdout), stdoutSha256: sha256(stdout) };
}
function extractJsonObjects(text) {
  const records = []; let start = -1, depth = 0, inString = false, escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) { if (escaped) escaped = false; else if (char === '\\') escaped = true;
      else if (char === '"') inString = false; continue; }
    if (char === '"') { inString = true; continue; }
    if (char === '{') { if (depth === 0) start = index; depth += 1; continue; }
    if (char === '}') { depth -= 1; if (depth === 0 && start >= 0) {
      try { records.push(JSON.parse(text.slice(start, index + 1))); } catch {}
      start = -1;
    } }
  }
  return records;
}
function requireRecord(records, schema) {
  const value = records.find((item) => item?.schema === schema);
  assert.ok(value, `EMP1_CURRENT_REPLAY_JSON_REQUIRED:${schema}`);
  return value;
}
async function readJson(path) { return JSON.parse(await readFile(resolve(root, path), 'utf8')); }
function parseArgs(args) {
  const out = { recordPath: null, expectedObservedHead: null, writeReceipt: null };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--record') out.recordPath = args[++index] ?? null;
    else if (args[index] === '--expected-observed-head') out.expectedObservedHead = args[++index] ?? null;
    else if (args[index] === '--write-receipt') out.writeReceipt = args[++index] ?? null;
    else throw gateError(`EMP1_CURRENT_REPLAY_UNKNOWN_ARGUMENT:${args[index]}`);
  }
  return out;
}
function sha256(text) { return createHash('sha256').update(text, 'utf8').digest('hex'); }
function gateError(code) { const error = new TypeError(code); error.code = code; return error; }
