import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptCiiV14Preview } from '../src/find_replace/adapters/cii_v14_adapter.js';
import { mapCiiCandidatesToTransaction } from '../src/find_replace/adapters/cii_change_mapper.js';

function preview(overrides = {}) {
  const operation = {
    operationId: 'NODE-NAME-200', family: 'NODE_NAME', property: 'Node name / to-name',
    action: 'COPY', status: 'PREVIEW_READY', scopeDecision: 'APPLY', before: 'OLD', proposed: 'NEW',
    targetEvidence: { identity: '200' }, policyAuthority: 'CII_WRITER_1C_NODENAME_POLICY',
  };
  return {
    versionBridge: {
      schema: 'CIIWorkspaceWriterVersionBridge.v2', mode: 'CHANGE_ISOLATED_V14_VIA_V11',
      source: { originalVersion: 14, originalSha256: 'a'.repeat(64) },
      target: { originalVersion: 14, originalSha256: 'b'.repeat(64) },
    },
    transferPlan: { status: 'PREVIEW_READY', operations: [operation] },
    ...overrides,
  };
}

test('maps a reviewed CII v14 candidate to a deeply immutable transaction operation', () => {
  const candidateSet = adaptCiiV14Preview(preview());
  const transaction = mapCiiCandidatesToTransaction(candidateSet);
  assert.equal(transaction.sourceHash, 'b'.repeat(64));
  assert.deepEqual(transaction.operations[0], {
    schema: 'FindReplaceOperation.v1', scope: 'ELEMENT', from: '200', to: '200', block: 'NODE_NAME',
    findText: 'OLD', replaceText: 'NEW',
    provenance: {
      source: 'XML_COMPARE_UTILITIES_CII_V14', candidateOperationId: 'NODE-NAME-200',
      property: 'Node name / to-name', policyAuthority: 'CII_WRITER_1C_NODENAME_POLICY', evidenceAuthority: null,
    },
  });
  assert(Object.isFrozen(candidateSet));
  assert(Object.isFrozen(candidateSet.candidates));
  assert(Object.isFrozen(transaction));
  assert(Object.isFrozen(transaction.operations));
  assert(Object.isFrozen(transaction.operations[0]));
  assert(Object.isFrozen(transaction.operations[0].provenance));
});

test('fails closed for direct v11, excluded, delete, duplicate, and non-scalar candidates', () => {
  const direct = preview(); direct.versionBridge.mode = 'DIRECT_V11';
  assert.throws(() => adaptCiiV14Preview(direct), /CHANGE_ISOLATED_V14_MODE_REQUIRED/);
  const excluded = preview(); excluded.transferPlan.operations[0].scopeDecision = 'EXCLUDE';
  assert.throws(() => mapCiiCandidatesToTransaction(adaptCiiV14Preview(excluded)), /CANDIDATE_NOT_APPLIED/);
  const deletion = preview(); deletion.transferPlan.operations[0].action = 'DELETE';
  assert.throws(() => mapCiiCandidatesToTransaction(adaptCiiV14Preview(deletion)), /ACTION_UNSUPPORTED/);
  const duplicate = preview(); duplicate.transferPlan.operations.push({ ...duplicate.transferPlan.operations[0] });
  assert.throws(() => adaptCiiV14Preview(duplicate), /DUPLICATE_OPERATION_ID/);
  const structured = preview(); structured.transferPlan.operations[0].proposed = { value: 'NEW' };
  assert.throws(() => adaptCiiV14Preview(structured), /SCALAR_VALUES_REQUIRED/);
});
