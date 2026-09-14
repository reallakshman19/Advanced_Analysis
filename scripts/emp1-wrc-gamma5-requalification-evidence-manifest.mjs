#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const options = parseArgs(process.argv.slice(2));
if (!/^[0-9a-f]{40}$/u.test(options.expectedHead ?? '')) throw gateError('EMP1_CURRENT_MANIFEST_EXPECTED_HEAD_REQUIRED');
if (!options.observationPath || !options.replayReceiptPath || !options.falsifierReceiptPath || !options.writeManifest) {
  throw gateError('EMP1_CURRENT_MANIFEST_PATHS_REQUIRED');
}
const actualHead = git(['rev-parse', 'HEAD']);
assert.equal(actualHead, options.expectedHead,
  `EMP1_CURRENT_MANIFEST_HEAD_MISMATCH:${actualHead}:${options.expectedHead}`);
const observedTreeSha = git(['rev-parse', 'HEAD^{tree}']);
const parentText = git(['show', '-s', '--format=%P', 'HEAD']);
const observedParentShas = parentText ? parentText.split(/\s+/u) : [];

const [observationFile, replayFile, falsifierFile] = await Promise.all([
  readEvidence(options.observationPath), readEvidence(options.replayReceiptPath), readEvidence(options.falsifierReceiptPath),
]);
const observation = observationFile.json;
const replay = replayFile.json;
const falsifiers = falsifierFile.json;
assert.equal(observation.schema, 'emp1-wrc537-gamma5-current-authority-exact-head-reobservation/v2');
assert.equal(observation.status,
  'PASS_CURRENT_AUTHORITY_EXACT_HEAD_REOBSERVATION_STANDARD_01_TO_12_STILL_NOT_RUN');
assert.equal(observation.observedHeadSha, options.expectedHead);
assert.equal(observation.currentAuthority.productionRouteAuthorized, true);
assert.equal(observation.currentAuthority.globalEmp1CRouteAuthority, false);
assert.equal(observation.currentAuthority.codeComplianceAuthorized, false);
assert.equal(observation.currentAuthority.releaseQualified, false);
assert.equal(observation.authorityBoundary.authorityCreatedByThisObservation, false);
assert.equal(observation.standardHistoricalQualification.numericalQualification, 'NOT_RUN_NOT_CLAIMED');

assert.equal(replay.schema, 'emp1-wrc537-gamma5-current-authority-reobservation-replay/v1');
assert.equal(replay.status, 'PASS_CURRENT_AUTHORITY_REOBSERVATION_SUBORDINATE_REPLAY');
assert.equal(replay.observationSemanticHash, observation.observationSemanticHash);
assert.equal(replay.authorityCreatedByReplay, false);
assert.equal(replay.standardHistoricalQualification, 'NOT_RUN_NOT_CLAIMED');

assert.equal(falsifiers.schema, 'emp1-wrc537-gamma5-current-authority-reobservation-falsifiers/v1');
assert.equal(falsifiers.status, 'PASS_CURRENT_AUTHORITY_REOBSERVATION_ANTI_FORGERY_FALSIFIERS');
assert.equal(falsifiers.observationSemanticHash, observation.observationSemanticHash);
assert.equal(falsifiers.mutationCount, 10);
assert.ok(falsifiers.detections.every((value) => value.detected === true));
assert.equal(falsifiers.authorityCreatedByFalsifiers, false);

const githubActions = process.env.GITHUB_ACTIONS === 'true';
const payload = {
  schema: 'emp1-wrc537-gamma5-current-authority-evidence-manifest/v2',
  observedHeadSha: options.expectedHead,
  observedTreeSha,
  observedParentShas,
  executionContext: {
    githubActions,
    githubEventName: githubActions ? process.env.GITHUB_EVENT_NAME ?? null : null,
    githubRef: githubActions ? process.env.GITHUB_REF ?? null : null,
    githubBaseRef: githubActions ? process.env.GITHUB_BASE_REF ?? null : null,
    githubHeadRef: githubActions ? process.env.GITHUB_HEAD_REF ?? null : null,
    githubRunId: githubActions ? process.env.GITHUB_RUN_ID ?? null : null,
    githubRunAttempt: githubActions ? process.env.GITHUB_RUN_ATTEMPT ?? null : null,
  },
  evidenceFiles: [
    descriptor(options.observationPath, observationFile, observation.schema, observation.status),
    descriptor(options.replayReceiptPath, replayFile, replay.schema, replay.status),
    descriptor(options.falsifierReceiptPath, falsifierFile, falsifiers.schema, falsifiers.status),
  ],
  observationSemanticHash: observation.observationSemanticHash,
  qualificationRecordSha256: observation.qualificationRecordSha256,
  oracleSemanticHash: observation.oracleSemanticHash,
  sourceDocumentSha256: observation.sourceDocumentSha256,
  datasetHash: observation.datasetHash,
  loadProducerQualificationSha256: observation.loadProducerQualificationSha256,
  qualificationSummary: {
    physicalWrcLoadsPassed: observation.physicalWrcLoadComparisons.length,
    stressComparisonsPassed: observation.stressComparisons.length,
    maxToleranceRatio: observation.maxToleranceRatio,
    subordinateReplayPassed: true,
    antiForgeryFalsifiersPassed: falsifiers.mutationCount,
  },
  currentAuthority: structuredClone(observation.currentAuthority),
  authorityBoundary: {
    authorityCreatedByEvidenceBundle: false,
    frozenOracleMayBeRewrittenByEvidenceBundle: false,
    toleranceMayBeChangedByEvidenceBundle: false,
    standardHistoricalEvidenceCreatedByEvidenceBundle: false,
  },
  standardHistoricalQualification: structuredClone(observation.standardHistoricalQualification),
};
assert.equal(payload.qualificationSummary.physicalWrcLoadsPassed, 6);
assert.equal(payload.qualificationSummary.stressComparisonsPassed, 32);
assert.ok(payload.qualificationSummary.maxToleranceRatio >= 0 && payload.qualificationSummary.maxToleranceRatio <= 1);
const manifest = {
  ...payload,
  evidenceBundleSemanticHash: sha256Canonical(payload),
  status: 'PASS_CURRENT_AUTHORITY_EXACT_HEAD_EVIDENCE_BUNDLE_STANDARD_01_TO_12_STILL_NOT_RUN',
};
await writeFile(resolve(root, options.writeManifest), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(manifest, null, 2));

function descriptor(path, file, schema, status) { return { path, sha256: file.sha256, schema, status }; }
async function readEvidence(path) {
  const buffer = await readFile(resolve(root, path));
  return { json: JSON.parse(buffer.toString('utf8')), sha256: createHash('sha256').update(buffer).digest('hex') };
}
function git(args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim(); }
function parseArgs(args) {
  const out = { expectedHead: null, observationPath: null, replayReceiptPath: null, falsifierReceiptPath: null, writeManifest: null };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--expected-head') out.expectedHead = args[++index] ?? null;
    else if (args[index] === '--observation') out.observationPath = args[++index] ?? null;
    else if (args[index] === '--replay-receipt') out.replayReceiptPath = args[++index] ?? null;
    else if (args[index] === '--falsifier-receipt') out.falsifierReceiptPath = args[++index] ?? null;
    else if (args[index] === '--write-manifest') out.writeManifest = args[++index] ?? null;
    else throw gateError(`EMP1_CURRENT_MANIFEST_UNKNOWN_ARGUMENT:${args[index]}`);
  }
  return out;
}
function sha256Canonical(value) {
  return createHash('sha256').update(JSON.stringify(sortValue(value)), 'utf8').digest('hex');
}
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  return value;
}
function gateError(code) { const error = new TypeError(code); error.code = code; return error; }
