import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION,
  EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_AUTHORIZED,
} from '../src/core/emp1/emp1-wrc537-gamma5-zero-dp-route.js';
import {
  EMP1_C_BOUNDED_PRODUCTION_ROUTES,
  EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID,
} from '../src/core/emp1/emp1-c-bounded-route-registry.js';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const requireReady = process.argv.includes('--require-ready');
const WRC_SHA256 = '698fcdc3e676e3bc6bbf710bc28ea8b666ac9511a81a0067a5d01088ae4c27b2';

const gate = await readJson('validation/emp1/release/emp1-wrc537-gamma5-p0-source-semantics-gate-v1.json');
const profile = await readJson(gate.releaseProfilePath);
const boundedSourceProfileCheck = JSON.parse(execFileSync(
  process.execPath,
  ['scripts/emp1-wrc537-bounded-source-semantics-profile-check.mjs'],
  { cwd: repoRoot, encoding: 'utf8' },
));

assert.equal(
  boundedSourceProfileCheck.schema,
  'emp1-wrc537-bounded-source-semantics-profile-check/v1',
);
assert.equal(
  boundedSourceProfileCheck.status,
  'PASS_PROFILE_INTEGRITY_EXTERNAL_CASE_PREREQUISITES_SEPARATED_THREE_PRIMARY_METHOD_GAPS_FAIL_CLOSED',
);
assert.equal(boundedSourceProfileCheck.sourceSha256, WRC_SHA256);
assert.equal(boundedSourceProfileCheck.sourceBindingCount, 9);
assert.equal(boundedSourceProfileCheck.externalPrerequisiteCount, 4);
assert.equal(boundedSourceProfileCheck.unresolvedPrimaryMethodSemanticCount, 3);
assert.equal(boundedSourceProfileCheck.professionalSourceSemanticsReady, false);
assert.equal(boundedSourceProfileCheck.codeCompliance, 'NOT_ASSESSED');
assert.equal(boundedSourceProfileCheck.globalEmp1CRouteAuthority, false);
assert.equal(boundedSourceProfileCheck.releaseQualified, false);
assert.equal(boundedSourceProfileCheck.authorityCreatedByThisCheck, false);

assert.equal(gate.schema, 'emp1-wrc537-gamma5-p0-source-semantics-gate/v1');
assert.equal(gate.issue, 1389);
assert.equal(gate.releaseProfileId, 'EMP1_WRC537_2013_CYLINDRICAL_GAMMA5_ZERO_DP_V1');
assert.equal(gate.sourceSha256, WRC_SHA256);
assert.equal(gate.state, 'BLOCKED_P0_SOURCE_SEMANTICS');
assert.equal(gate.blockerCount, 9);
assert.equal(gate.gates.length, 9);
assert.equal(new Set(gate.gates.map((row) => row.gateId)).size, 9);
assert.equal(new Set(gate.gates.map((row) => row.issue)).size, 9);
assert.equal(gate.sourceObservation.directPrimaryPageObservationAvailableInCurrentConnectedExecution, false);
assert.equal(gate.sourceObservation.secondaryOrOcrEvidenceMayCloseGate, false);
assert.equal(gate.sourceObservation.productionOutputMayCloseGate, false);
assert.equal(gate.sourceObservation.cauxOutputMayCloseGate, false);

assert.equal(profile.releaseProfileId, gate.releaseProfileId);
assert.equal(profile.definitionState, 'FROZEN_BEFORE_PRODUCTION_AUTHORIZATION');
assert.equal(profile.method.sourceSha256, WRC_SHA256);
assert.equal(profile.releaseAuthority.engineeringUseAuthorized, false);
assert.equal(profile.releaseAuthority.productionUseAuthorized, false);
assert.equal(profile.releaseAuthority.deploymentAuthorized, false);
assert.equal(profile.releaseAuthority.globalEmp1CRouteAuthority, false);
assert.equal(profile.releaseAuthority.releaseQualified, false);
assert.equal(profile.codeCompliance.performed, false);
assert.equal(profile.codeCompliance.authorized, false);
assert.equal(profile.codeCompliance.state, 'NOT_ASSESSED');

const observed = [];
for (const row of gate.gates) {
  assert.ok(row.gateId && row.artifact && row.authorityDocument && row.profileAuthorityKey);
  const artifact = await readJson(row.artifact);
  assert.equal(artifact.status, row.currentStatus, `${row.gateId}: retained source status drift`);
  assert.match(artifact.status, /^BLOCKED_/u, `${row.gateId}: P0 professional source state must remain fail-closed`);
  assertSourceHash(row, artifact, WRC_SHA256);

  const profileAuthority = profile.requiredAuthorities[row.profileAuthorityKey];
  assert.ok(profileAuthority, `${row.gateId}: missing release-profile authority key`);
  assert.equal(profileAuthority.issue, row.issue, `${row.gateId}: issue binding drift`);
  assert.match(profileAuthority.state, /^BLOCKED/u, `${row.gateId}: frozen profile must remain blocked`);

  observed.push({
    gateId: row.gateId,
    issue: row.issue,
    category: row.category,
    status: artifact.status,
    artifact: row.artifact,
    authorityDocument: row.authorityDocument,
  });
}

assert.equal(gate.closureRule.allNineGatesMustBeSourceClosedBeforeBoundedProfessionalAuthorization, true);
assert.equal(gate.closureRule.exactPrimarySourceLocatorsRequiredWhereApplicable, true);
assert.equal(gate.closureRule.engineeringAssumptionsMustBeExplicitlyDistinguishedFromWrcSourceRules, true);
assert.equal(gate.closureRule.codeComplianceRemainsNotAssessedAfterBoundaryClosure, true);
assert.equal(gate.closureRule.productionRouteMutationAllowedByThisArtifact, false);
assert.equal(gate.closureRule.releaseAuthorityGrantedByThisArtifact, false);
assert.equal(gate.closureRule.boundedRuntimeRouteAuthorizationDoesNotCloseP0SourceSemantics, true);
assert.equal(
  gate.authorityScope,
  'AUTHORITY_GRANTED_BY_THIS_AGGREGATE_GATE_ONLY_NOT_CURRENT_RUNTIME_ROUTE_STATE',
);
assert.deepEqual(gate.authority, {
  engineeringUseAuthorized: false,
  productionUseAuthorized: false,
  deploymentAuthorized: false,
  globalEmp1CRouteAuthority: false,
  codeComplianceAuthorized: false,
});

assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_AUTHORIZED, true);
assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION.engineeringUseAuthorized, true);
assert.equal(EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION.productionUseAuthorized, true);
const registry = EMP1_C_BOUNDED_PRODUCTION_ROUTES.find(
  (row) => row.routeId === EMP1_C_WRC537_GAMMA5_ZERO_DP_ROUTE_ID,
);
assert.ok(registry, 'bounded gamma5 route registry row required');
assert.equal(registry.registered, true);
assert.equal(registry.engineeringUseAuthorized, true);
assert.equal(registry.globalEmp1CRouteAuthority, false);
assert.equal(registry.releaseQualified, false);

assert.deepEqual(gate.currentLiveRouteState, {
  boundedRouteAuthorized: true,
  registryRegistered: true,
  boundedEngineeringUseAuthorized: true,
  boundedProductionUseAuthorized: true,
  globalEmp1CRouteAuthority: false,
  releaseQualified: false,
  codeComplianceAuthorized: false,
  professionalP0SourceSemanticsReady: false,
  professionalReleaseReady: false,
  invariant: 'BOUNDED_ROUTE_AUTHORIZATION_DOES_NOT_CLOSE_P0_SOURCE_SEMANTICS_OR_PROFESSIONAL_RELEASE_GATES',
});
assert.equal(gate.currentLiveRouteState.boundedRouteAuthorized, EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_AUTHORIZED);
assert.equal(
  gate.currentLiveRouteState.boundedEngineeringUseAuthorized,
  EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION.engineeringUseAuthorized,
);
assert.equal(
  gate.currentLiveRouteState.boundedProductionUseAuthorized,
  EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION.productionUseAuthorized,
);
assert.equal(gate.currentLiveRouteState.registryRegistered, registry.registered);
assert.equal(gate.currentLiveRouteState.globalEmp1CRouteAuthority, registry.globalEmp1CRouteAuthority);
assert.equal(gate.currentLiveRouteState.releaseQualified, registry.releaseQualified);
assert.equal(gate.currentLiveRouteState.codeComplianceAuthorized, profile.codeCompliance.authorized);

const result = {
  schema: 'emp1-professional-p0-source-semantics-check/v2',
  status: 'PASS_P0_GATE_CURRENT_AUTHORIZED_ROUTE_SOURCE_SEMANTICS_STILL_BLOCKED_BOUNDED_PROFILE_INTEGRITY_PASS',
  releaseProfileId: gate.releaseProfileId,
  blockerCount: observed.length,
  blockers: observed,
  boundedSourceSemanticProfile: {
    semanticHash: boundedSourceProfileCheck.profileSemanticHash,
    sourceBindingCount: boundedSourceProfileCheck.sourceBindingCount,
    externalPrerequisiteCount: boundedSourceProfileCheck.externalPrerequisiteCount,
    unresolvedPrimaryMethodSemanticCount: boundedSourceProfileCheck.unresolvedPrimaryMethodSemanticCount,
    unresolvedPrimaryMethodSemantics: boundedSourceProfileCheck.unresolvedPrimaryMethodSemantics,
    falsifierClassesDetected: boundedSourceProfileCheck.falsifierClassesDetected,
  },
  gateAuthorityGranted: gate.authority,
  currentRuntimeAuthority: {
    routeAuthorized: EMP1_WRC537_GAMMA5_ZERO_DP_ROUTE_AUTHORIZED,
    registryRegistered: registry.registered,
    engineeringUseAuthorized: registry.engineeringUseAuthorized,
    productionUseAuthorized: EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION.productionUseAuthorized,
    globalEmp1CRouteAuthority: registry.globalEmp1CRouteAuthority,
    releaseQualified: registry.releaseQualified,
    codeComplianceAuthorized: profile.codeCompliance.authorized,
  },
  professionalP0SourceSemanticsReady: false,
  authorityCreatedByThisCheck: false,
  requireReady,
};

console.log(JSON.stringify(result, null, 2));

if (requireReady && observed.length > 0) process.exit(2);

function assertSourceHash(row, artifact, expected) {
  const candidates = [
    artifact.source?.sha256,
    artifact.sourceDocument?.rawPdfSha256,
    artifact.sourceDocument?.rawSha256,
    artifact.sourceCustody?.rawSha256,
    artifact.primarySource?.rawPdfSha256,
  ].filter((value) => value != null);
  assert.ok(candidates.length > 0, `${row.gateId}: source SHA custody missing`);
  for (const value of candidates) {
    assert.equal(value, expected, `${row.gateId}: WRC source SHA drift`);
  }
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(repoRoot, relativePath), 'utf8'));
}
