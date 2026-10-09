export const EMP1_AUTHORIZED_RELEASE_STATE_ARTIFACT = deepFreeze({
  path: 'validation/emp1/release/emp1-professional-release-current-state-v1.json',
  gitBlobSha1: '8d108c6f7850e2a240fc15fdd51318ce1a70a29f',
  semanticHash: 'f9a205509b0da61014655bdb7271c5f4d5716a36a40ab3ea11e0a6cbab286d81',
  schema: 'emp1-professional-release-current-state/v1',
  issue: 1389,
  releaseProfileId: 'EMP1_WRC537_2013_CYLINDRICAL_GAMMA5_ZERO_DP_V1',
  releaseReady: false,
  state: 'BLOCKED_FAIL_CLOSED_POST_SEQUENCE',
  professionalReleaseReady: false,
  definitionOfDoneComplete: false,
  boundedProductionRouteAuthorized: true,
  boundedEngineeringUseAuthorized: true,
  globalEmp1CRouteAuthority: false,
  codeComplianceAuthorized: false,
  releaseQualified: false,
  deploymentAuthorized: false,
  routeId: 'EMP1.C.WRC537.CYLINDRICAL.ORIGINAL.GAMMA5.ZERO_DP',
  sourceSha256: '698fcdc3e676e3bc6bbf710bc28ea8b666ac9511a81a0067a5d01088ae4c27b2',
  shellFamily: 'CYLINDRICAL',
  attachmentShape: 'ROUND',
  gamma: 5,
});

/**
 * Admit only the exact professional release-current-state artifact explicitly
 * frozen by this protected authority owner. Self-consistent caller substitutes
 * are not authority, even when they carry their own semantic hash.
 */
export function requireAuthorizedEmp1ProfessionalReleaseState(value, artifact) {
  const release = record(value, 'EMP1_RELEASE_QUALIFICATION_RELEASE_STATE_REQUIRED');
  const custody = record(artifact, 'EMP1_RELEASE_QUALIFICATION_RELEASE_ARTIFACT_REQUIRED');
  const expected = EMP1_AUTHORIZED_RELEASE_STATE_ARTIFACT;
  exact('ARTIFACT_PATH', custody.path, expected.path);
  exact('ARTIFACT_GIT_BLOB', custody.gitBlobSha1, expected.gitBlobSha1);
  exact('SCHEMA', release.schema, expected.schema);
  exact('ISSUE', release.issue, expected.issue);
  exact('PROFILE', release.releaseProfileId, expected.releaseProfileId);
  exact('SEMANTIC_HASH', release.currentStateSemanticHash, expected.semanticHash);
  exact('RELEASE_READY', release.releaseReady, expected.releaseReady);
  exact('STATE', release.state, expected.state);

  const sequence = record(release.sequenceStatus, 'EMP1_RELEASE_QUALIFICATION_SEQUENCE_REQUIRED');
  exact('PROFESSIONAL_RELEASE_READY', sequence.professionalReleaseReady,
    expected.professionalReleaseReady);
  exact('DEFINITION_OF_DONE', sequence.definitionOfDoneComplete,
    expected.definitionOfDoneComplete);

  const runtime = record(release.runtimeAuthority, 'EMP1_RELEASE_QUALIFICATION_RUNTIME_REQUIRED');
  exact('BOUNDED_PRODUCTION', runtime.boundedProductionRouteAuthorized,
    expected.boundedProductionRouteAuthorized);
  exact('BOUNDED_ENGINEERING', runtime.boundedEngineeringUseAuthorized,
    expected.boundedEngineeringUseAuthorized);
  exact('GLOBAL_C', runtime.globalEmp1CRouteAuthority, expected.globalEmp1CRouteAuthority);
  exact('CODE_COMPLIANCE', runtime.codeComplianceAuthorized, expected.codeComplianceAuthorized);
  exact('RELEASE_QUALIFIED', runtime.releaseQualified, expected.releaseQualified);
  exact('DEPLOYMENT_AUTHORIZED', runtime.deploymentAuthorized, expected.deploymentAuthorized);

  const scope = record(release.boundedScope, 'EMP1_RELEASE_QUALIFICATION_SCOPE_REQUIRED');
  exact('ROUTE_ID', scope.routeId, expected.routeId);
  exact('SHELL_FAMILY', scope.shellFamily, expected.shellFamily);
  exact('ATTACHMENT_SHAPE', scope.attachmentShape, expected.attachmentShape);
  exact('GAMMA', scope.gamma, expected.gamma);
  exact('WRC_SOURCE', release.sourceState?.wrcSourceSha256, expected.sourceSha256);

  if (runtime.deploymentAuthorized === true && runtime.releaseQualified !== true) {
    throw authorityError('EMP1_RELEASE_QUALIFICATION_DEPLOYMENT_WITHOUT_RELEASE_INVALID');
  }
  if (runtime.releaseQualified === true && sequence.professionalReleaseReady !== true) {
    throw authorityError('EMP1_RELEASE_QUALIFICATION_RELEASE_WITHOUT_READINESS_INVALID');
  }

  return deepFreeze({
    professionalReleaseReady: sequence.professionalReleaseReady === true,
    definitionOfDoneComplete: sequence.definitionOfDoneComplete === true,
    boundedProductionRouteAuthorized: runtime.boundedProductionRouteAuthorized === true,
    boundedEngineeringUseAuthorized: runtime.boundedEngineeringUseAuthorized === true,
    globalEmp1CRouteAuthority: runtime.globalEmp1CRouteAuthority === true,
    codeComplianceAuthorized: runtime.codeComplianceAuthorized === true,
    releaseQualified: runtime.releaseQualified === true,
    deploymentAuthorized: runtime.deploymentAuthorized === true,
  });
}

function exact(label, actual, expected) {
  if (actual !== expected) {
    throw authorityError(`EMP1_RELEASE_QUALIFICATION_AUTHORIZED_STATE_DRIFT:${label}`);
  }
}
function record(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw authorityError(code);
  return value;
}
function authorityError(code) { const error = new TypeError(code); error.code = code; return error; }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
