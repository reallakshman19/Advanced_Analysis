#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmp1EngineeringReviewRecord } from '../src/core/emp1/emp1-engineering-review-record.js';
import { createEmp1EngineeringRecordPackage } from '../src/core/emp1/emp1-engineering-record-package.js';
import { projectEmp1EngineeringRecordReleaseHandoff } from '../src/core/emp1/emp1-engineering-record-release-handoff.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packageValue = engineeringRecordPackage();
const currentReleaseState = JSON.parse(await read(
  'validation/emp1/release/emp1-professional-release-current-state-v1.json',
));

const current = projectEmp1EngineeringRecordReleaseHandoff({
  packageValue,
  releaseState: currentReleaseState,
});
assert.equal(current.schema, 'emp1-engineering-record-release-handoff/v1');
assert.equal(current.handoffCompatible, true);
assert.equal(current.alignment.routeIdMatch, true);
assert.equal(current.alignment.methodSourceShaMatch, true);
assert.equal(current.alignment.gammaMatch, true);
assert.equal(current.alignment.shellFamilyMatch, true);
assert.equal(current.alignment.attachmentShapeMatch, true);
assert.equal(current.existingReleaseState.releaseQualified, false);
assert.equal(current.existingReleaseState.deploymentAuthorized, false);
assert.equal(current.state, 'HANDOFF_ALIGNED_EXISTING_RELEASE_PROCESS_BLOCKED');
assert.ok(current.releaseProcessBlockers.includes(
  'EMP1_RELEASE_HANDOFF_EXISTING_RELEASE_NOT_QUALIFIED',
));
assert.equal(current.authorityBoundary.maySetReleaseQualified, false);
assert.equal(current.authorityBoundary.createsReleaseAuthority, false);

const releaseQualified = structuredClone(currentReleaseState);
releaseQualified.sequenceStatus.professionalReleaseReady = true;
releaseQualified.runtimeAuthority.releaseQualified = true;
releaseQualified.runtimeAuthority.deploymentAuthorized = false;
const qualifiedProjection = projectEmp1EngineeringRecordReleaseHandoff({
  packageValue,
  releaseState: releaseQualified,
});
assert.equal(qualifiedProjection.state, 'EXISTING_RELEASE_QUALIFICATION_PRESENT');
assert.equal(qualifiedProjection.existingReleaseState.releaseQualified, true);
assert.equal(qualifiedProjection.authorityBoundary.createsReleaseAuthority, false,
  'projection may reflect existing release authority but never create it');

const deployed = structuredClone(releaseQualified);
deployed.runtimeAuthority.deploymentAuthorized = true;
const deployedProjection = projectEmp1EngineeringRecordReleaseHandoff({
  packageValue,
  releaseState: deployed,
});
assert.equal(deployedProjection.state, 'EXISTING_RELEASE_AND_DEPLOYMENT_AUTHORITY_PRESENT');
assert.equal(deployedProjection.authorityBoundary.createsDeploymentAuthority, false);

const mismatched = structuredClone(currentReleaseState);
mismatched.boundedScope.routeId = 'EMP1.C.OTHER.ROUTE';
const mismatchProjection = projectEmp1EngineeringRecordReleaseHandoff({
  packageValue,
  releaseState: mismatched,
});
assert.equal(mismatchProjection.handoffCompatible, false);
assert.equal(mismatchProjection.state, 'HANDOFF_INCOMPATIBLE_WITH_EXISTING_RELEASE_PROFILE');
assert.ok(mismatchProjection.handoffBlockers.includes('EMP1_RELEASE_HANDOFF_ROUTE_ID_MISMATCH'));

const sourceMismatch = structuredClone(currentReleaseState);
sourceMismatch.sourceState.wrcSourceSha256 = 'OTHER-SOURCE';
const sourceMismatchProjection = projectEmp1EngineeringRecordReleaseHandoff({
  packageValue,
  releaseState: sourceMismatch,
});
assert.equal(sourceMismatchProjection.handoffCompatible, false);
assert.ok(sourceMismatchProjection.handoffBlockers.includes(
  'EMP1_RELEASE_HANDOFF_METHOD_SOURCE_MISMATCH',
));

assert.throws(
  () => projectEmp1EngineeringRecordReleaseHandoff({
    packageValue,
    releaseState: { schema: 'wrong/v1' },
  }),
  (error) => error?.code === 'EMP1_RELEASE_HANDOFF_RELEASE_STATE_SCHEMA_INVALID',
);

const source = await read('src/core/emp1/emp1-engineering-record-release-handoff.js');
assert.equal(source.includes('runEmp1('), false);
assert.equal(source.includes('stressIntensity'), false);
assert.equal(source.includes('semanticHash('), false);
assert.equal(source.includes('releaseQualified = true'), false);
assert.equal(source.includes('deploymentAuthorized = true'), false);
assert.match(source, /maySetReleaseQualified: false/u);
assert.match(source, /createsReleaseAuthority: false/u);

console.log(JSON.stringify({
  schema: 'emp1-engineering-record-release-handoff-check/v1',
  status: 'PASS_READ_ONLY_EXISTING_RELEASE_HANDOFF_PROJECTION',
  currentRepositoryReleaseState: current.state,
  currentReleaseQualified: current.existingReleaseState.releaseQualified,
  currentDeploymentAuthorized: current.existingReleaseState.deploymentAuthorized,
  reflectedQualifiedState: qualifiedProjection.state,
  reflectedDeploymentState: deployedProjection.state,
  routeMismatchBlocked: !mismatchProjection.handoffCompatible,
  sourceMismatchBlocked: !sourceMismatchProjection.handoffCompatible,
  releaseAuthorityCreatedByProjection: false,
  deploymentAuthorityCreatedByProjection: false,
}, null, 2));

function engineeringRecordPackage() {
  const routeId = 'EMP1.C.WRC537.CYLINDRICAL.ORIGINAL.GAMMA5.ZERO_DP';
  const sourceSha = '698fcdc3e676e3bc6bbf710bc28ea8b666ac9511a81a0067a5d01088ae4c27b2';
  const parents = {
    sourceHash: 'SOURCE-1', loadTransferResultHash: 'A-1',
    sectionScreeningResultHash: 'B-1', localCorrelationResultHash: 'C-1',
  };
  const result = {
    productId: 'EMP.1',
    loadTransfer: { resultHash: 'A-1' },
    sectionScreening: { resultHash: 'B-1' },
    localCorrelation: { resultHash: 'C-1' },
    assessment: {
      schema: 'emp1-assessment/v1', productId: 'EMP.1', decision: 'PASS', reasons: [], parents,
      authority: { wrcEngineeringUseAuthorizedByScaffold: false, codeComplianceProduced: false, releaseQualified: false },
      interpretation: { passIsCodeCompliance: false, releaseQualified: false, localCorrelationRequiredWhenScreeningEscalates: true },
    },
  };
  const routeAuthoritySnapshot = {
    schema: 'emp1-workbench-route-authority-snapshot/v1',
    semanticHash: 'ROUTE-1',
    routeId,
    productionUseAuthorized: true,
    routeModuleAuthorized: true,
    registry: {
      schema: 'emp1-c-bounded-route/v1', routeId, registered: true,
      engineeringUseAuthorized: true, suspensionReasons: [],
      method: { methodIdentity: 'WRC537_2013_CYLINDRICAL_ORIGINAL_GAMMA5_TABLE5_ZERO_DP', methodEdition: '2013', sourceDocumentSha256: sourceSha },
      scope: { shellFamily: 'CYLINDRICAL', attachmentShape: 'ROUND', gamma: 5 },
      limitations: ['HOST_SHELL_ONLY'], remainingBlocked: ['GLOBAL_MAXIMUM'],
    },
  };
  const evidence = {
    sourceHash: 'SOURCE-1', routeAuthorityHash: 'ROUTE-1', routeAuthoritySnapshot, result,
  };
  const reviewRecord = createEmp1EngineeringReviewRecord({
    disposition: 'ACCEPTED', reviewer: { identity: 'engineer:alpha', role: 'ENGINEER' },
    reviewedAt: '2026-09-01T18:05:00Z', basisCode: 'EMP1_ENGINEERING_RESULT_REVIEW',
    comment: null, evidence,
  });
  return createEmp1EngineeringRecordPackage({
    packagedAt: '2026-09-01T18:06:00Z', reviewRecord, evidence,
  });
}

async function read(path) { return readFile(resolve(root, path), 'utf8'); }
