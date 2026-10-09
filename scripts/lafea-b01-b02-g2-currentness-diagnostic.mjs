#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LAFEA_COMPUTATIONAL_STATES,
  LAFEA_WORKBENCH_QUALIFICATION_STATES,
  projectLafeaWorkbenchCurrentness,
} from '../src/workspace/lafea-workbench-currentness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

assert.deepEqual(LAFEA_COMPUTATIONAL_STATES, [
  'EDITED', 'READY', 'MESHED', 'RUNNING', 'CURRENT_RESULT', 'STALE_RESULT', 'REJECTED',
]);
assert.deepEqual(LAFEA_WORKBENCH_QUALIFICATION_STATES, ['NOT_EVALUATED', 'FAIL', 'PASS']);
assert.equal(LAFEA_COMPUTATIONAL_STATES.includes('QUALIFIED'), false,
  'QUALIFIED must never be a computational currentness state');

const edited = projectLafeaWorkbenchCurrentness(stage({
  lifecycle: null,
  binding: binding('UNINITIALIZED', null, 'doc-1'),
  readiness: readiness(),
}));
assert.equal(edited.computationalState, 'EDITED');
assert.equal(edited.qualificationState, 'NOT_EVALUATED');
assert.equal(edited.currentAuthority, false);

const ready = projectLafeaWorkbenchCurrentness(stage({
  lifecycle: lifecycle({ CANONICAL_MODEL: record('CANONICAL_MODEL', 'CURRENT', 'PASS', 'sha256:model') }),
  binding: binding('CURRENT', 'doc-2', 'doc-2'),
  readiness: readiness({ modelCurrent: true, sourceCurrent: true }),
}));
assert.equal(ready.computationalState, 'READY');
assert.equal(ready.currentAuthority, false);
assert.equal(ready.identity.canonicalModelHash, 'sha256:model');
assert.equal(ready.identity.documentRevisionTokenAuthority, 'EDITOR_REVISION_TOKEN_ONLY');

const meshed = projectLafeaWorkbenchCurrentness(stage({
  lifecycle: lifecycle({
    CANONICAL_MODEL: record('CANONICAL_MODEL', 'CURRENT', 'PASS', 'sha256:model'),
    ANALYSIS_MESH: record('ANALYSIS_MESH', 'CURRENT', 'PASS', 'sha256:mesh'),
  }),
  binding: binding('CURRENT', 'doc-3', 'doc-3'),
  readiness: readiness({ modelCurrent: true, meshQualified: true, sourceCurrent: true }),
  custody: { state: 'CURRENT_PASS', usableForRun: true, meshHash: 'sha256:mesh' },
}));
assert.equal(meshed.computationalState, 'MESHED');
assert.equal(meshed.identity.meshRevisionHash, 'sha256:mesh');

const current = projectLafeaWorkbenchCurrentness(stage({
  lifecycle: lifecycle({
    CANONICAL_MODEL: record('CANONICAL_MODEL', 'CURRENT', 'PASS', 'sha256:model'),
    ANALYSIS_MESH: record('ANALYSIS_MESH', 'CURRENT', 'PASS', 'sha256:mesh'),
    EXECUTION: record('EXECUTION', 'CURRENT', 'PASS', 'sha256:execution'),
    RECOVERY: record('RECOVERY', 'CURRENT', 'PASS', 'sha256:recovery'),
  }),
  binding: binding('CURRENT', 'doc-4', 'doc-4'),
  readiness: readiness({
    sourceCurrent: true, modelCurrent: true, meshQualified: true, resultReady: true,
  }),
  custody: { state: 'CURRENT_PASS', usableForRun: true, meshHash: 'sha256:mesh' },
  execution: {
    status: 'QUALIFIED',
    meshProfileHash: 'sha256:mesh-profile',
    solverModelHash: 'sha256:solver-model',
    compiledExecutionHash: 'sha256:execution',
  },
}));
assert.equal(current.computationalState, 'CURRENT_RESULT');
assert.equal(current.qualificationState, 'PASS');
assert.equal(current.qualificationBasis, 'CURRENT_CHAIN');
assert.equal(current.currentAuthority, true);
assert.equal(current.historicalQualificationRetained, false);
assert.equal(current.identity.sourceRevisionHash, 'sha256:source');
assert.equal(current.identity.executionHash, 'sha256:execution');
assert.equal(current.identity.recoveryHash, 'sha256:recovery');
assert.equal(current.identity.solverModelHash, 'sha256:solver-model');

const stale = projectLafeaWorkbenchCurrentness(stage({
  lifecycle: lifecycle({
    CANONICAL_MODEL: record('CANONICAL_MODEL', 'STALE', 'PASS', 'sha256:model-old'),
    ANALYSIS_MESH: record('ANALYSIS_MESH', 'STALE', 'PASS', 'sha256:mesh-old'),
    EXECUTION: record('EXECUTION', 'STALE', 'PASS', 'sha256:execution-old'),
    RECOVERY: record('RECOVERY', 'STALE', 'PASS', 'sha256:recovery-old'),
  }),
  binding: binding('STALE_DOCUMENT_REVISION', 'doc-old', 'doc-new'),
  readiness: readiness({ blockingReasons: ['LIFECYCLE_SOURCE_BINDING_STALE_DOCUMENT_REVISION'] }),
}));
assert.equal(stale.computationalState, 'STALE_RESULT');
assert.equal(stale.qualificationState, 'PASS');
assert.equal(stale.qualificationBasis, 'HISTORICAL_RETAINED');
assert.equal(stale.historicalQualificationRetained, true);
assert.equal(stale.currentAuthority, false,
  'historical PASS must never grant current authority after a governing edit');
assert.equal(stale.identity.executionHash, 'sha256:execution-old');
assert.equal(stale.identity.documentRevisionToken, 'doc-new');
assert.deepEqual(stale.blockingReasons, ['LIFECYCLE_SOURCE_BINDING_STALE_DOCUMENT_REVISION']);

const rejected = projectLafeaWorkbenchCurrentness(stage({
  lifecycle: lifecycle(),
  binding: binding('CURRENT', 'doc-5', 'doc-5'),
  readiness: readiness({ sourceCurrent: true, modelCurrent: true }),
  execution: { status: 'FAILED' },
}));
assert.equal(rejected.computationalState, 'REJECTED');
assert.equal(rejected.qualificationState, 'FAIL');
assert.equal(rejected.qualificationBasis, 'CURRENT_REJECTION');
assert.equal(rejected.currentAuthority, false);

const orchestratorSource = fs.readFileSync(
  path.join(ROOT, 'src/workspace/lafea-workbench-orchestrator-store.js'), 'utf8',
);
assert.match(orchestratorSource, /projectLafeaWorkbenchCurrentness/u);
assert.match(orchestratorSource, /currentness/u);
const evidenceSource = fs.readFileSync(
  path.join(ROOT, 'src/workspace/lafea-workbench-evidence-actions.js'), 'utf8',
);
assert.match(evidenceSource, /currentness: stage\.currentness/u,
  'lifecycle export must expose the same canonical currentness projection');

console.log(JSON.stringify({
  schema: 'lafea-b02-g2-currentness-diagnostic/v1',
  status: 'PASS',
  computationalStates: LAFEA_COMPUTATIONAL_STATES,
  qualificationStates: LAFEA_WORKBENCH_QUALIFICATION_STATES,
  currentCase: {
    computationalState: current.computationalState,
    qualificationState: current.qualificationState,
    currentAuthority: current.currentAuthority,
  },
  staleCase: {
    computationalState: stale.computationalState,
    qualificationState: stale.qualificationState,
    currentAuthority: stale.currentAuthority,
    historicalQualificationRetained: stale.historicalQualificationRetained,
  },
  releaseAuthorityGranted: false,
  temperatureAuthorityGranted: false,
}));

function stage({ lifecycle: lifecycleValue, binding: bindingValue, readiness: readinessValue, custody = null, execution = null }) {
  return {
    stageId: 'LAFEA.3',
    sourceAuthority: lifecycleValue ? { sourceHash: lifecycleValue.source.sourceHash } : null,
    lifecycle: lifecycleValue,
    lifecycleBinding: bindingValue,
    lifecycleReadiness: readinessValue,
    analysisMeshCustodyProjection: custody,
    execution,
  };
}

function lifecycle(overrides = {}) {
  const kinds = ['CANONICAL_MODEL', 'ANALYSIS_GEOMETRY', 'ANALYSIS_MESH', 'EXECUTION', 'RESULT_EVIDENCE', 'RECOVERY', 'CONVERGENCE'];
  return {
    source: { status: 'CURRENT', sourceHash: 'sha256:source' },
    artifacts: Object.fromEntries(kinds.map((kind) => [kind,
      overrides[kind] ?? record(kind, 'ABSENT', 'NOT_EVALUATED', null)])),
  };
}

function record(kind, status, qualification, artifactHash) {
  return { kind, status, qualification, artifactHash, producerRef: artifactHash ? `test/${kind}` : null };
}

function binding(status, boundDocumentDigest, currentDocumentDigest) {
  return { status, boundDocumentDigest, currentDocumentDigest };
}

function readiness(overrides = {}) {
  return {
    sourceCurrent: false,
    modelCurrent: false,
    preMeshModelCurrent: false,
    solverModelCurrent: false,
    meshQualified: false,
    resultReady: false,
    blockingReasons: [],
    ...overrides,
  };
}
