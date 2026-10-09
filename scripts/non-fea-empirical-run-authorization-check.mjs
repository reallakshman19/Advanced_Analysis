#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  NON_FEA_COMMON_SCHEMAS,
} from '../src/core/non-fea-common-checker/index.js';
import {
  commonMethodsForImplementation,
} from '../src/core/non-fea-method-consumption/index.js';
import {
  createSharedPipingModel,
  semanticHash,
} from '../src/core/shared-piping-model/index.js';
import {
  NON_FEA_EMPIRICAL_RUN_AUTHORITY_KIND,
  NON_FEA_EMPIRICAL_RUN_AUTHORITY_STATEMENT,
  NON_FEA_EMPIRICAL_RUN_IMPLEMENTATION_ID,
  createNonFeaEmpiricalRunAuthorization,
  requireCurrentNonFeaEmpiricalRunAuthorization,
  requireNonFeaEmpiricalRunAuthorization,
} from '../src/workspace/engineering-loads/non-fea-empirical-run-authorization.js';
import {
  authorizeCurrentNonFeaEmpiricalRun,
} from '../src/workspace/engineering-loads/non-fea-empirical-run-authorization-runtime.js';

const AUTHORIZED_AT = '2026-08-26T11:55:00.000Z';
const readySnapshot = snapshot(commonInput());
const authorization = createNonFeaEmpiricalRunAuthorization(readySnapshot, {
  authorizedAt: AUTHORIZED_AT,
  authorityKind: 'CALLER_MUST_NOT_CONTROL_THIS',
  humanApprovalAsserted: true,
});

assert.deepEqual(requireNonFeaEmpiricalRunAuthorization(authorization), authorization);
assert.equal(authorization.authorizedAt, AUTHORIZED_AT);
assert.equal(authorization.decision, 'AUTHORIZE_ROUTINE_RUN');
assert.equal(authorization.authorityKind, NON_FEA_EMPIRICAL_RUN_AUTHORITY_KIND);
assert.equal(authorization.authorityStatement, NON_FEA_EMPIRICAL_RUN_AUTHORITY_STATEMENT);
assert.equal(authorization.humanApprovalRequired, false);
assert.equal(authorization.humanApprovalAsserted, false);
assert.equal(authorization.implementationId, NON_FEA_EMPIRICAL_RUN_IMPLEMENTATION_ID);
assert.deepEqual(authorization.requiredCommonMethodIds, [
  'SUSTAINED_REACTIONS',
  'WEIGHT_AND_GRAVITY',
]);
assert.equal(authorization.commonInputSemanticHash, readySnapshot.commonInput.semanticHash);
assert.equal(authorization.commonInputSealSemanticHash, readySnapshot.commonInput.seal.semanticHash);
assert.equal(authorization.authorityRevisionVectorSemanticHash, authorization.authorityRevisionVector.semanticHash);
assert.equal(authorization.policy.legacyPublicationOrHandoffRequired, false);
assert.equal(authorization.policy.legacyPublicationOrHandoffAsserted, false);
assert.equal(authorization.policy.standaloneExecutionEligibility, false);
assert.equal(authorization.policy.currentnessRequiredAtExecution, true);
assert.equal(authorization.policy.implementationQualificationRequiredAtExecution, true);
assert.equal(authorization.policy.engineeringFoundationRequiredAtExecution, true);
assert.equal(authorization.policy.qualifiedNumericalProjectionRequiredAtExecution, true);
assert.equal(authorization.policy.governedMethodSelectionRequiredAtExecution, true);
assert.equal(Object.hasOwn(authorization, 'calculationEligible'), false);
assert.equal(Object.hasOwn(authorization, 'authorityId'), false);
assert.equal(Object.hasOwn(authorization, 'baselineId'), false);
assert.equal(Object.hasOwn(authorization, 'handoffId'), false);

const current = requireCurrentNonFeaEmpiricalRunAuthorization(authorization, readySnapshot);
assert.equal(current.freshness.stale, false);
assert.equal(current.currentRevisionVector.semanticHash, authorization.authorityRevisionVectorSemanticHash);

const coordinatorCalls = { prepared: [], recorded: [] };
const runtimeAuthorization = authorizeCurrentNonFeaEmpiricalRun(readySnapshot, {
  authorizedAt: AUTHORIZED_AT,
  executionCoordinator: fakeCoordinator(readySnapshot, coordinatorCalls),
});
assert.equal(coordinatorCalls.prepared.length, 1);
assert.equal(coordinatorCalls.recorded.length, 1);
// The coordinator carries the required-method set in declaration order while the
// decision canonicalises it by sorting. The binding is over the set, not the
// sequence, so a receipt that differs only in order must still be accepted.
assert.deepEqual(
  [...coordinatorCalls.recorded[0].requiredCommonMethodIds].sort(),
  [...authorization.requiredCommonMethodIds].sort(),
);
assert.notDeepEqual(
  coordinatorCalls.recorded[0].requiredCommonMethodIds,
  authorization.requiredCommonMethodIds,
);
assert.equal(
  coordinatorCalls.prepared[0].authorizationId,
  runtimeAuthorization.decision.authorizationId,
);
assert.equal(
  coordinatorCalls.prepared[0].methodRequestSemanticHash,
  runtimeAuthorization.decision.semanticHash,
);
assert.equal(
  coordinatorCalls.prepared[0].scenarioId,
  `ROUTINE-RUN:${readySnapshot.commonInput.semanticHash}`,
);
assert.equal(
  runtimeAuthorization.methodAuthorization.semanticHash,
  coordinatorCalls.recorded[0].semanticHash,
);
assert.equal(Object.hasOwn(runtimeAuthorization, 'execution'), false,
  'authorization runtime must not create numerical execution');

expectCode(
  () => authorizeCurrentNonFeaEmpiricalRun(readySnapshot, {
    authorizedAt: AUTHORIZED_AT,
    executionCoordinator: fakeCoordinator(
      snapshot(commonInput({ projectDataProfileSemanticHash: semanticHash({ wrong: true }) })),
      { prepared: [], recorded: [] },
    ),
  }),
  'NON_FEA_EMPIRICAL_RUN_AUTHORIZATION_COORDINATOR_COMMON_INPUT_MISMATCH',
);

expectCode(
  () => createNonFeaEmpiricalRunAuthorization(snapshot(commonInput({
    packageState: 'PARTIALLY_READY',
    blockedMethodIds: ['SUSTAINED_MEMBER_ACTIONS'],
  })), { authorizedAt: AUTHORIZED_AT }),
  'NON_FEA_EMPIRICAL_RUN_AUTHORIZATION_NOT_READY',
);
expectCode(
  () => createNonFeaEmpiricalRunAuthorization(snapshot(commonInput({
    packageState: 'BLOCKED',
    sealedMethodIds: [],
    blockedMethodIds: ['WEIGHT_AND_GRAVITY', 'SUSTAINED_REACTIONS'],
  })), { authorizedAt: AUTHORIZED_AT }),
  'NON_FEA_EMPIRICAL_RUN_AUTHORIZATION_NOT_READY',
);
expectCode(
  () => createNonFeaEmpiricalRunAuthorization(snapshot(commonInput({
    sealedMethodIds: ['WEIGHT_AND_GRAVITY'],
  })), { authorizedAt: AUTHORIZED_AT }),
  'NON_FEA_EMPIRICAL_RUN_AUTHORIZATION_METHOD_NOT_READY',
);
expectCode(
  () => createNonFeaEmpiricalRunAuthorization(snapshot(commonInput({
    blockedMethodIds: ['SUSTAINED_MEMBER_ACTIONS'],
  })), { authorizedAt: AUTHORIZED_AT }),
  'NON_FEA_EMPIRICAL_RUN_AUTHORIZATION_NOT_READY',
);
expectCode(
  () => createNonFeaEmpiricalRunAuthorization({
    ...readySnapshot,
    staleness: { stale: true, changes: [{ code: 'FIXTURE_STALE' }] },
  }, { authorizedAt: AUTHORIZED_AT }),
  'NON_FEA_EMPIRICAL_RUN_AUTHORIZATION_COMMON_INPUT_STALE',
);
expectCode(
  () => createNonFeaEmpiricalRunAuthorization({
    ...readySnapshot,
    error: 'fixture evaluation failure',
  }, { authorizedAt: AUTHORIZED_AT }),
  'NON_FEA_EMPIRICAL_RUN_AUTHORIZATION_COMMON_INPUT_ERROR',
);
expectCode(
  () => createNonFeaEmpiricalRunAuthorization(readySnapshot, {
    authorizedAt: 'not-a-timestamp',
  }),
  'NON_FEA_EMPIRICAL_RUN_AUTHORIZATION_TIMESTAMP_INVALID',
);

const forgedAuthority = rehashAuthorization(authorization, {
  authorityKind: 'HUMAN_APPROVED',
  humanApprovalAsserted: true,
});
expectCode(
  () => requireNonFeaEmpiricalRunAuthorization(forgedAuthority),
  'NON_FEA_EMPIRICAL_RUN_AUTHORIZATION_POLICY_INVALID',
);

const forgedEligibility = rehashAuthorization(authorization, {
  policy: {
    ...authorization.policy,
    standaloneExecutionEligibility: true,
  },
});
expectCode(
  () => requireNonFeaEmpiricalRunAuthorization(forgedEligibility),
  'NON_FEA_EMPIRICAL_RUN_AUTHORIZATION_POLICY_INVALID',
);

const changedProjectData = snapshot(commonInput({
  projectDataProfileSemanticHash: semanticHash({ profile: 'changed' }),
}));
expectCode(
  () => requireCurrentNonFeaEmpiricalRunAuthorization(authorization, changedProjectData),
  'NON_FEA_EMPIRICAL_RUN_AUTHORIZATION_STALE',
);

const resealed = snapshot(commonInput({
  seal: {
    semanticHash: semanticHash({ seal: 'second' }),
    confirmedBy: 'different current READY seal',
  },
}));
expectCode(
  () => requireCurrentNonFeaEmpiricalRunAuthorization(authorization, resealed),
  'NON_FEA_EMPIRICAL_RUN_AUTHORIZATION_SEAL_STALE',
);
const resealedAuthorization = createNonFeaEmpiricalRunAuthorization(resealed, {
  authorizedAt: AUTHORIZED_AT,
});
assert.notEqual(resealedAuthorization.authorizationId, authorization.authorizationId);
assert.notEqual(resealedAuthorization.semanticHash, authorization.semanticHash);

const contractSource = readFileSync(new URL(
  '../src/workspace/engineering-loads/non-fea-empirical-run-authorization.js',
  import.meta.url,
), 'utf8');
assert.equal(contractSource.includes('authorized-empirical-load-input'), false,
  'system Run authorization must not depend on the legacy authorized input contract');
assert.equal(contractSource.includes('common-enriched-consumer-handoff'), false,
  'system Run authorization must not synthesize a legacy consumer handoff');
assert.equal(contractSource.includes('publishCommonEnrichedPropertiesBaseline'), false,
  'system Run authorization must not synthesize a published baseline');

const runtimeSource = readFileSync(new URL(
  '../src/workspace/engineering-loads/non-fea-empirical-run-authorization-runtime.js',
  import.meta.url,
), 'utf8');
assert.match(runtimeSource, /nonFeaMethodExecutionCoordinator/u,
  'runtime bridge must use existing method-currentness custody');
assert.doesNotMatch(runtimeSource, /calculateAuthorized|calculateSupportLoad|executeGoverned/u,
  'authorization runtime must not create or execute a numerical request');

console.log(JSON.stringify({
  status: 'PASS',
  benchmark: 'ISSUE1321_READY_COMMON_INPUT_SYSTEM_RUN_AUTHORIZATION',
  authorizationSchema: authorization.schema,
  authorizationId: authorization.authorizationId,
  authorityKind: authorization.authorityKind,
  humanApprovalAsserted: authorization.humanApprovalAsserted,
  requiredCommonMethodIds: authorization.requiredCommonMethodIds,
  commonInputSemanticHash: authorization.commonInputSemanticHash,
  authorityRevisionVectorSemanticHash: authorization.authorityRevisionVectorSemanticHash,
  fullyReadyRequired: true,
  partialAndBlockedRejected: true,
  staleAndErroredRejected: true,
  standaloneExecutionEligibility: false,
  downstreamImplementationQualificationRequired: true,
  downstreamEngineeringFoundationRequired: true,
  methodCurrentnessReceiptRecorded: true,
  callerAuthorityInjectionRejected: true,
  legacyPublicationHandoffSynthesized: false,
  numericalProjectionCreated: false,
}, null, 2));

function fakeCoordinator(snapshotValue, calls) {
  return {
    prepareAuthorization(input) {
      calls.prepared.push(structuredClone(input));
      const receiptMaterial = {
        authorizationId: input.authorizationId,
        authorizedAt: input.authorizedAt,
        implementationId: input.implementationId,
        scenarioId: input.scenarioId,
        methodRequestSemanticHash: input.methodRequestSemanticHash,
        commonInputSemanticHash: snapshotValue.commonInput.semanticHash,
        // Declaration order, exactly as the production coordinator supplies it.
        // The authorization decision canonicalises the same set by sorting, so a
        // fixture that pre-sorts here cannot see an order-sensitive binding
        // comparison reject an otherwise-identical receipt.
        requiredCommonMethodIds: [...commonMethodsForImplementation(input.implementationId)],
      };
      const receipt = {
        ...receiptMaterial,
        semanticHash: semanticHash(receiptMaterial),
      };
      return {
        receipt,
        commonInput: snapshotValue.commonInput,
      };
    },
    recordAuthorization(receipt) {
      calls.recorded.push(structuredClone(receipt));
      return receipt;
    },
  };
}

function snapshot(commonInputValue) {
  return {
    commonInput: commonInputValue,
    staleness: { stale: false, changes: [] },
    error: '',
  };
}

function commonInput(overrides = {}) {
  const model = makeSharedModel();
  const base = {
    schema: NON_FEA_COMMON_SCHEMAS.COMMON_INPUT,
    packageState: 'READY',
    requestSemanticHash: semanticHash({ request: 'run-auth' }),
    reportSemanticHash: semanticHash({ report: 'run-auth' }),
    candidateSemanticHash: semanticHash({ candidate: 'run-auth' }),
    sourceDatasetSha256: 'a'.repeat(64),
    sourceModelSemanticHash: model.semanticHash,
    enrichmentSidecarSemanticHash: semanticHash({ sidecar: 'run-auth' }),
    resolutionLedgerSemanticHash: semanticHash({ resolution: 'run-auth' }),
    enrichedProjectionSemanticHash: semanticHash({ projection: 'run-auth' }),
    projectDataProfileSemanticHash: semanticHash({ profile: 'run-auth' }),
    configuredDefaultUsageLedgerSemanticHash: null,
    qualificationProfileSemanticHash: null,
    requestedLoadCases: ['EMPTY', 'HYD', 'OPE'],
    sealedMethodIds: ['SUSTAINED_REACTIONS', 'WEIGHT_AND_GRAVITY'],
    blockedMethodIds: [],
    enrichedModel: model,
    resolutionLedger: { schema: 'fixture-resolution/v1' },
    projectDataProfile: { schema: 'project-data-profile/v1' },
    configuredDefaultUsageLedger: null,
    qualificationProfile: null,
    authorityContracts: {
      topologyGraph: contract('topology'),
      supportAttachmentModel: contract('attachment'),
      restraintCapabilityModel: contract('restraint'),
      supportSiteModel: contract('support-site'),
      routePartitionModel: contract('route'),
      loadPrimitiveSet: contract('loads'),
    },
    methodReadiness: [],
    lineage: { schema: 'fixture-lineage/v1' },
    seal: {
      semanticHash: semanticHash({ seal: 'first' }),
      confirmedBy: 'fixture READY seal',
    },
  };
  const material = { ...base, ...overrides };
  return { ...material, semanticHash: semanticHash(material) };
}

function contract(id) {
  return {
    schema: `fixture-${id}/v1`,
    status: 'READY',
    semanticHash: semanticHash({ contract: id }),
  };
}

function makeSharedModel() {
  return createSharedPipingModel({
    project: {
      datasetId: 'RUN-AUTH-DATASET',
      name: 'Run authorization fixture',
      sourceName: 'fixture',
    },
    units: { length: 'mm', force: 'N', mass: 'kg' },
    sourceSnapshotRef: {
      schema: 'source-package-snapshot/v1',
      datasetId: 'RUN-AUTH-DATASET',
      sourceSchema: 'fixture/v1',
      sourceSemanticHash: semanticHash({ source: 'run-auth' }),
      sourceByteHash: null,
    },
    components: [],
    supports: [],
    sourceReferences: { nodes: [] },
    diagnostics: [],
  });
}

function rehashAuthorization(value, patch) {
  const material = { ...structuredClone(value), ...patch };
  delete material.semanticHash;
  return { ...material, semanticHash: semanticHash(material) };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.equal(error?.code, code, error?.stack || error?.message);
    return true;
  });
}
