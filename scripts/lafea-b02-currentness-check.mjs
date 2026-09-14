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
import {
  deriveLafeaSolverConfigHash,
} from '../src/workspace/lafea-workbench-run-transaction-state.js';
import {
  createLafeaWorkbenchDomainFirstExecutionState,
} from '../src/workspace/lafea-workbench-domain-first-execution-state.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'validation/lafea-b02-contracts/gate0-contracts.json'),
  'utf8',
));

assert.deepEqual(LAFEA_COMPUTATIONAL_STATES, contract.stateModel.computationalState);
assert.deepEqual(LAFEA_WORKBENCH_QUALIFICATION_STATES, contract.stateModel.qualificationState);

function sha(character) {
  return `sha256:${character.repeat(64)}`;
}
const H = Object.freeze({
  source: sha('1'),
  source2: sha('2'),
  canonical: sha('3'),
  domain: sha('4'),
  geometry: sha('5'),
  mesh: sha('6'),
  mesh2: sha('7'),
  meshProfile: sha('8'),
  solverModel: sha('9'),
  execution: sha('a'),
  recovery: sha('b'),
  loadCase: sha('c'),
  solverProfile: sha('d'),
  recoveryProfile: sha('e'),
  preflight: sha('f'),
  transactionReceipt: sha('0'),
  rejectedReceipt: sha('1'),
  transaction2: sha('a'),
});

const current = currentStage();
const projected = projectLafeaWorkbenchCurrentness(current);
assert.equal(projected.computationalState, 'CURRENT_RESULT');
assert.equal(projected.qualificationState, 'PASS');
assert.equal(projected.currentAuthority, true);
assert.equal(projected.exactCurrentParentChain, true);
assert.deepEqual(projected.blockingReasons, []);
assert.equal(projected.identity.sourceRevisionHash, H.source);
assert.equal(projected.identity.canonicalModelHash, H.canonical);
assert.equal(projected.identity.meshRevisionHash, H.mesh);
assert.equal(projected.identity.executionHash, H.execution);
assert.equal(projected.identity.recoveryHash, H.recovery);

for (const qualification of ['NOT_EVALUATED', 'FAIL', 'PASS']) {
  const row = projectLafeaWorkbenchCurrentness(withQualification(current, qualification));
  assert.equal(row.computationalState, 'CURRENT_RESULT');
  assert.equal(row.qualificationState, qualification);
  assert.equal(row.currentAuthority, true,
    `CURRENT_RESULT must remain current when qualification is ${qualification}`);
}

const materialEdit = structuredClone(current);
materialEdit.sourceAuthority.sourceHash = H.source2;
materialEdit.lifecycle.source.sourceHash = H.source2;
for (const kind of ['CANONICAL_MODEL', 'EXECUTION', 'RECOVERY']) {
  materialEdit.lifecycle.artifacts[kind].status = 'STALE';
}
for (const kind of ['ANALYSIS_GEOMETRY', 'ANALYSIS_MESH']) {
  materialEdit.lifecycle.artifacts[kind].status = 'REVALIDATION_REQUIRED';
}
materialEdit.execution = null;
materialEdit.retainedContinuumPreflightEvidence = null;
materialEdit.analysisMeshCustodyProjection = {
  ...materialEdit.analysisMeshCustodyProjection,
  state: 'STALE',
  usableForRun: false,
};
const staleMaterial = projectLafeaWorkbenchCurrentness(materialEdit);
assert.equal(staleMaterial.computationalState, 'STALE_RESULT');
assert.equal(staleMaterial.qualificationState, 'PASS');
assert.equal(staleMaterial.currentAuthority, false);
assert.equal(staleMaterial.historicalQualificationRetained, true);
assert.equal(staleMaterial.identity.executionHash, H.execution);
assert.equal(staleMaterial.identity.recoveryHash, H.recovery);
assert.equal(staleMaterial.identity.solverConfigHash, current.latestRunTransactionReceipt.solverConfigHash);
assert.ok(staleMaterial.blockingReasons.includes('CURRENTNESS_CANONICAL_MODEL_NOT_CURRENT'));

for (const qualification of ['NOT_EVALUATED', 'FAIL', 'PASS']) {
  const row = projectLafeaWorkbenchCurrentness(withQualification(materialEdit, qualification));
  assert.equal(row.computationalState, 'STALE_RESULT');
  assert.equal(row.qualificationState, qualification);
  assert.equal(row.currentAuthority, false,
    `STALE_RESULT must not gain current authority when qualification is ${qualification}`);
}

const unrelatedFailure = structuredClone(materialEdit);
unrelatedFailure.status = 'FAILED';
unrelatedFailure.diagnostics = [{ severity: 'ERROR', code: 'NON_EXECUTION_UI_FAILURE' }];
const stillStale = projectLafeaWorkbenchCurrentness(unrelatedFailure);
assert.equal(stillStale.computationalState, 'STALE_RESULT');
assert.equal(stillStale.qualificationState, 'PASS');
assert.equal(stillStale.currentAuthority, false);

const solverEdit = structuredClone(current);
solverEdit.retainedContinuumPreflightEvidence.compilerRevision = 'REV-2';
const staleSolver = projectLafeaWorkbenchCurrentness(solverEdit);
assert.equal(staleSolver.computationalState, 'STALE_RESULT');
assert.equal(staleSolver.qualificationState, 'PASS');
assert.equal(staleSolver.currentAuthority, false);
assert.ok(staleSolver.blockingReasons.includes('CURRENTNESS_TRANSACTION_SOLVER_CONFIG_MISMATCH'));

const meshEdit = structuredClone(current);
meshEdit.analysisMeshCustodyProjection.meshHash = H.mesh2;
const staleMesh = projectLafeaWorkbenchCurrentness(meshEdit);
assert.equal(staleMesh.computationalState, 'STALE_RESULT');
assert.equal(staleMesh.currentAuthority, false);
assert.ok(staleMesh.blockingReasons.includes('CURRENTNESS_MESH_RECEIPT_CUSTODY_MISMATCH'));

const running = structuredClone(current);
running.execution = {
  schema: 'lafea-domain-first-workbench-execution/v1',
  stageId: 'LAFEA.3',
  status: 'RUNNING',
  route: 'DOMAIN_FIRST_COMPILED_SOLVER_MODEL',
  runTransaction: { status: 'RUNNING', transactionHash: H.transaction2 },
};
const projectedRunning = projectLafeaWorkbenchCurrentness(running);
assert.equal(projectedRunning.computationalState, 'RUNNING');
assert.equal(projectedRunning.currentAuthority, false);

const rejected = structuredClone(current);
rejected.execution = null;
rejected.latestRunTransactionReceipt = rejectedReceipt(
  current.latestRunTransactionReceipt,
  'SYNTHETIC_EXECUTION_REJECTION',
);
rejected.lifecycle.artifacts.EXECUTION.qualification = 'FAIL';
rejected.lifecycle.artifacts.RECOVERY.qualification = 'FAIL';
const projectedRejected = projectLafeaWorkbenchCurrentness(rejected);
assert.equal(projectedRejected.computationalState, 'REJECTED');
assert.equal(projectedRejected.qualificationState, 'FAIL');
assert.equal(projectedRejected.currentAuthority, false);
assert.equal(projectedRejected.transactionIdentity.latestReceiptStatus, 'SUPERSEDED');

const rejectedAfterHistoricalPass = structuredClone(current);
rejectedAfterHistoricalPass.execution = null;
rejectedAfterHistoricalPass.latestRunTransactionReceipt = rejectedReceipt(
  current.latestRunTransactionReceipt,
  'SECOND_RUN_REJECTED',
);
const historicalPassRejected = projectLafeaWorkbenchCurrentness(rejectedAfterHistoricalPass);
assert.equal(historicalPassRejected.computationalState, 'REJECTED');
assert.equal(historicalPassRejected.qualificationState, 'PASS');
assert.equal(historicalPassRejected.currentAuthority, false);
assert.equal(historicalPassRejected.historicalQualificationRetained, true);

const displayOnly = structuredClone(current);
displayOnly.display = { zoom: 3, contourPalette: 'OTHER' };
const displayProjected = projectLafeaWorkbenchCurrentness(displayOnly);
assert.equal(displayProjected.computationalState, projected.computationalState);
assert.equal(displayProjected.qualificationState, projected.qualificationState);
assert.equal(displayProjected.currentAuthority, projected.currentAuthority);
assert.deepEqual(displayProjected.identity, projected.identity);

const sourceDependentPreflight = structuredClone(current.retainedContinuumPreflightEvidence);
sourceDependentPreflight.sourceHash = H.source2;
assert.notEqual(
  deriveLafeaSolverConfigHash(current.retainedContinuumPreflightEvidence),
  deriveLafeaSolverConfigHash(sourceDependentPreflight),
  'solverConfigHash must be a direct source-revision child',
);

const executionState = createLafeaWorkbenchDomainFirstExecutionState(['LAFEA.3']);
executionState.retain('LAFEA.3', current.execution);
executionState.clear('LAFEA.3');
let retainedFields = executionState.fields('LAFEA.3');
assert.equal(retainedFields.execution, undefined);
assert.equal(retainedFields.latestRunTransactionReceipt.status, 'COMPLETED');
assert.equal(retainedFields.latestRunTransactionReceipt.executionHash, H.execution);
executionState.retainRunTransactionReceipt(
  'LAFEA.3',
  rejectedReceipt(current.latestRunTransactionReceipt, 'SYNTHETIC_RUN_REJECTION'),
);
retainedFields = executionState.fields('LAFEA.3');
assert.equal(retainedFields.latestRunTransactionReceipt.status, 'SUPERSEDED');
assert.equal(retainedFields.latestRunTransactionReceipt.reasonCode, 'SYNTHETIC_RUN_REJECTION');

const orchestratorSource = fs.readFileSync(
  path.join(ROOT, 'src/workspace/lafea-workbench-orchestrator-store.js'),
  'utf8',
);
assert.match(orchestratorSource, /projectLafeaWorkbenchCurrentness/u);
assert.match(orchestratorSource, /domainFirstExecution\.fields\(stageId\)/u);
assert.match(orchestratorSource, /currentness:\s*projectLafeaWorkbenchCurrentness/u);
const runActionsSource = fs.readFileSync(
  path.join(ROOT, 'src/workspace/lafea-workbench-domain-first-run-actions.js'),
  'utf8',
);
assert.match(runActionsSource, /retainRunTransactionReceipt/u);
const probeSource = fs.readFileSync(
  path.join(ROOT, 'src/workspace/lafea-continuum-physical-probe.js'),
  'utf8',
);
assert.match(probeSource, /currentAuthority\s*!==\s*true/u);
assert.match(probeSource, /computationalState\s*!==\s*'CURRENT_RESULT'/u);

console.log('LAFEA B02 Gate-0 currentness parent derivation passed.');

function withQualification(stage, qualification) {
  const value = structuredClone(stage);
  for (const kind of ['EXECUTION', 'RECOVERY']) {
    value.lifecycle.artifacts[kind].qualification = qualification;
  }
  return value;
}

function currentStage() {
  const preflight = {
    stageId: 'LAFEA.3',
    sourceHash: H.source,
    analysisDomainHash: H.domain,
    analysisGeometryHash: H.geometry,
    meshHash: H.mesh,
    meshProfileHash: H.meshProfile,
    solverModelHash: H.solverModel,
    compilerId: 'LAFEA-COMPILER',
    compilerRevision: 'REV-1',
    requestedCaseIds: ['LC-1'],
    status: 'PASS',
    executionAuthorized: true,
    semanticHash: H.preflight,
  };
  const solverConfigHash = deriveLafeaSolverConfigHash(preflight);
  const receipt = {
    schema: 'lafea-run-transaction-receipt/v1',
    status: 'COMPLETED',
    semanticHash: H.transactionReceipt,
    solverConfigHash,
    executionHash: H.execution,
    parents: {
      sourceHash: H.source,
      analysisDomainHash: H.domain,
      analysisGeometryHash: H.geometry,
      meshHash: H.mesh,
      meshProfileHash: H.meshProfile,
      solverModelHash: H.solverModel,
    },
  };
  return {
    stageId: 'LAFEA.3',
    status: 'READY',
    diagnostics: [],
    lifecycleBinding: { status: 'CURRENT' },
    sourceAuthority: { sourceHash: H.source },
    lifecycle: {
      source: { status: 'CURRENT', sourceHash: H.source },
      artifacts: {
        CANONICAL_MODEL: record(H.canonical, { sourceHash: H.source }),
        ANALYSIS_GEOMETRY: record(H.geometry, {
          sourceHash: H.source,
          canonicalModelHash: H.canonical,
        }),
        ANALYSIS_MESH: record(H.mesh, {
          analysisGeometryHash: H.geometry,
          meshProfileHash: H.meshProfile,
        }),
        EXECUTION: record(H.execution, {
          canonicalModelHash: H.canonical,
          meshHash: H.mesh,
          physicalLoadCaseHash: H.loadCase,
          solverProfileHash: H.solverProfile,
        }),
        RECOVERY: record(H.recovery, {
          executionHash: H.execution,
          meshHash: H.mesh,
          recoveryProfileHash: H.recoveryProfile,
        }),
        CONVERGENCE: absent(),
      },
    },
    analysisDomainProjection: {
      state: 'CURRENT_PASS',
      analysisDomainHash: H.domain,
    },
    analysisGeometryProjection: {
      state: 'CURRENT_PASS',
      analysisGeometryHash: H.geometry,
    },
    analysisMeshCustodyProjection: {
      state: 'CURRENT_PASS',
      usableForRun: true,
      meshHash: H.mesh,
    },
    retainedAnalysisMeshEvidenceV2: {
      sourceHash: H.source,
      analysisDomainHash: H.domain,
      analysisGeometryHash: H.geometry,
      meshHash: H.mesh,
      meshProfileHash: H.meshProfile,
    },
    retainedContinuumPreflightEvidence: preflight,
    latestRunTransactionReceipt: receipt,
    lifecycleReadiness: {
      modelCurrent: true,
      preMeshModelCurrent: true,
      resultReady: true,
    },
    execution: {
      schema: 'lafea-domain-first-workbench-execution/v1',
      stageId: 'LAFEA.3',
      status: 'QUALIFIED',
      route: 'DOMAIN_FIRST_COMPILED_SOLVER_MODEL',
      sourceHash: H.source,
      analysisDomainHash: H.domain,
      analysisGeometryHash: H.geometry,
      meshHash: H.mesh,
      meshProfileHash: H.meshProfile,
      solverModelHash: H.solverModel,
      compiledExecutionHash: H.execution,
      runTransactionReceipt: receipt,
    },
  };
}

function rejectedReceipt(receipt, reasonCode) {
  return {
    ...structuredClone(receipt),
    status: 'SUPERSEDED',
    executionHash: null,
    reasonCode,
    semanticHash: H.rejectedReceipt,
  };
}
function record(artifactHash, parentHashes) {
  return {
    status: 'CURRENT',
    artifactHash,
    parentHashes,
    qualification: 'PASS',
  };
}
function absent() {
  return {
    status: 'ABSENT',
    artifactHash: null,
    parentHashes: {},
    qualification: 'NOT_EVALUATED',
  };
}
