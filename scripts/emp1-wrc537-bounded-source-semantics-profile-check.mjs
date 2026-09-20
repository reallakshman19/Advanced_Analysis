#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PROFILE_PATH = 'validation/emp1/wrc537-2013/bounded-source-semantics-v1.json';
const WRC_SHA256 = '698fcdc3e676e3bc6bbf710bc28ea8b666ac9511a81a0067a5d01088ae4c27b2';
const expectedBlockers = [
  'PHYSICAL_RECOVERY_SURFACE_AND_COMMON_POINT_PRIMARY_SEMANTICS',
  'EXPLICIT_STRESS_INTENSITY_PLANE_STRESS_PRINCIPAL_RECONSTRUCTION_PRIMARY_SEMANTICS',
  'MATERIAL_SHELL_THEORY_PRIMARY_SEMANTICS',
];
const expectedPrerequisites = [
  'EXPLICIT_SAME_STATE_ASSESSMENT_GEOMETRY_EVIDENCE',
  'STANDARD_ROUND_ATTACHMENT_CLASS_EVIDENCE',
  'PHYSICAL_ATTACHMENT_AXIS_COINCIDENCE_WITH_WRC_SHELL_NORMAL',
  'ISOLATION_OR_NONINTERACTION_EVIDENCE',
];

const profile = await readJson(PROFILE_PATH);
await validateProfile(profile, { verifySourceBindings: true });

const falsifiers = [
  ['SOURCE_HASH_MUTATION', (value) => { value.sourceDocument.rawSha256 = '0'.repeat(64); }],
  ['DROP_SAME_STATE_GEOMETRY_PREREQUISITE', (value) => {
    value.externalCasePrerequisites = value.externalCasePrerequisites.filter(
      (row) => row.id !== 'EXPLICIT_SAME_STATE_ASSESSMENT_GEOMETRY_EVIDENCE',
    );
  }],
  ['AUTHORIZE_OBLIQUE_ATTACHMENT', (value) => { value.geometrySemantics.attachmentAxis.obliqueAuthorized = true; }],
  ['INVENT_NEIGHBOR_SPACING_THRESHOLD', (value) => {
    value.geometrySemantics.isolation.quantitativeWrcNeighborSpacingCriterionAvailable = true;
    value.geometrySemantics.isolation.inventedSpacingThresholdAllowed = true;
  }],
  ['PROMOTE_PHYSICAL_SURFACE_SEMANTICS', (value) => {
    value.loadAndRecoverySemantics.physicalRecovery.uLowerPhysicalSurfaceMeaningQualified = true;
  }],
  ['PROMOTE_PLANE_STRESS_SOURCE_AUTHORITY', (value) => {
    value.stressIntensitySemantics.unresolved.explicitPlaneStressQualified = true;
  }],
  ['PROMOTE_MATERIAL_INDEPENDENCE', (value) => {
    value.materialTheorySemantics.unresolved.absoluteModulusIndependenceQualified = true;
  }],
  ['PROMOTE_CODE_COMPLIANCE', (value) => {
    value.codeAndReleaseBoundary.codeAssessmentPerformed = true;
    value.codeAndReleaseBoundary.codeCompliance = 'PASS';
  }],
  ['PROMOTE_PROFESSIONAL_RELEASE', (value) => {
    value.codeAndReleaseBoundary.professionalSourceSemanticsReady = true;
    value.codeAndReleaseBoundary.professionalReleaseReady = true;
    value.codeAndReleaseBoundary.releaseQualified = true;
  }],
];

const detected = [];
for (const [id, mutate] of falsifiers) {
  const candidate = structuredClone(profile);
  mutate(candidate);
  candidate.semanticHash = semanticHash(candidate);
  let rejected = false;
  try {
    await validateProfile(candidate, { verifySourceBindings: false });
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true, `EMP1_1765_FALSIFIER_NOT_DETECTED:${id}`);
  detected.push(id);
}

console.log(JSON.stringify({
  schema: 'emp1-wrc537-bounded-source-semantics-profile-check/v1',
  status: 'PASS_PROFILE_INTEGRITY_EXTERNAL_CASE_PREREQUISITES_SEPARATED_THREE_PRIMARY_METHOD_GAPS_FAIL_CLOSED',
  profilePath: PROFILE_PATH,
  profileSemanticHash: profile.semanticHash,
  sourceSha256: profile.sourceDocument.rawSha256,
  sourceBindingCount: profile.sourceBindings.length,
  externalPrerequisiteCount: profile.externalCasePrerequisites.length,
  unresolvedPrimaryMethodSemanticCount: profile.unresolvedPrimaryMethodSemantics.length,
  unresolvedPrimaryMethodSemantics: profile.unresolvedPrimaryMethodSemantics,
  falsifierClassesDetected: detected,
  professionalSourceSemanticsReady: false,
  codeCompliance: 'NOT_ASSESSED',
  globalEmp1CRouteAuthority: false,
  releaseQualified: false,
  authorityCreatedByThisCheck: false,
}, null, 2));

async function validateProfile(value, { verifySourceBindings }) {
  assert.equal(value.schema, 'emp1-wrc537-bounded-source-semantics/v1');
  assert.equal(value.issue, 1765);
  assert.equal(value.parentIssue, 1760);
  assert.equal(value.basisMainSha, '41df6e945789273fc327aaeca6686529a9ad8b39');
  assert.equal(value.basisMainTreeSha, '2ebc03a01b3b7485e1b38a7fa41367f92bb92085');
  assert.equal(value.integrationMode,
    'SOURCE_READ_ONLY_NO_AUTHORITY_BEARING_ROUTE_INTEGRATION_UNTIL_1762_MERGED');
  assert.equal(value.status,
    'BLOCKED_PARTIAL_BOUNDED_PROFILE_ASSEMBLED_EXTERNAL_CASE_PREREQUISITES_SEPARATED_THREE_PRIMARY_METHOD_GAPS_REMAIN');
  assert.equal(value.sourceDocument.rawSha256, WRC_SHA256);
  assert.equal(value.sourceDocument.gitBlobSha1, 'ce861233928154145a9257efbbf8dbef3f5a17d1');
  assert.equal(value.sourceDocument.directPinnedPdfPageReobservation,
    'NOT_RUN_EXECUTION_ENVIRONMENT_BINARY_TRANSPORT');
  assert.equal(value.sourceDocument.externalRenderingMayEstablishNewPinnedPdfAuthority, false);
  assert.equal(value.semanticHash, semanticHash(value), 'EMP1_1765_PROFILE_SEMANTIC_HASH_DRIFT');

  assert.deepEqual(value.boundedScope, {
    method: 'WRC 537 (2013)',
    hostShell: 'CYLINDRICAL',
    attachmentShape: 'ROUND',
    variant: 'ORIGINAL',
    gamma: 5,
    betaMinimum: 0.05,
    betaMaximum: 0.5,
    differentialPressure: 0,
    Kn: 1,
    Kb: 1,
    locations: ['Au', 'Al', 'Bu', 'Bl', 'Cu', 'Cl', 'Du', 'Dl'],
    hostShellOnly: true,
    longitudinalMomentRoute: 'AXIS_OF_SYMMETRY_1B_2B_ONLY',
    continuousSearch: false,
    globalMaximumAssured: false,
  });

  assert.equal(value.sourceBindings.length, 9);
  assert.equal(new Set(value.sourceBindings.map((row) => row.legacyIssue)).size, 9);
  if (verifySourceBindings) {
    for (const row of value.sourceBindings) {
      const artifact = await readJson(row.path);
      assert.equal(artifact.status, row.retainedStatus,
        `EMP1_1765_SOURCE_BINDING_STATUS_DRIFT:${row.legacyIssue}`);
      assert.match(artifact.status, /^BLOCKED_/u);
      assert.equal(gitBlobSha(row.path), row.gitBlobSha1,
        `EMP1_1765_SOURCE_BINDING_BLOB_DRIFT:${row.legacyIssue}`);
      assertSourceHash(row, artifact);
    }
  }

  assert.equal(value.geometrySemantics.T.classification, 'SOURCE_SEMANTIC');
  assert.equal(value.geometrySemantics.T.meaning, 'HOST_CYLINDRICAL_SHELL_WALL_THICKNESS');
  assert.equal(value.geometrySemantics.T.wrcSelectsAssessmentWallState, false);
  assert.equal(value.geometrySemantics.T.externalPrerequisite,
    'EXPLICIT_SAME_STATE_ASSESSMENT_GEOMETRY_EVIDENCE');
  assert.equal(value.geometrySemantics.Rm.meaning, 'HOST_CYLINDRICAL_SHELL_MEAN_OR_MID_RADIUS');
  assert.equal(value.geometrySemantics.Rm.identityCondition,
    'Do, Di and T describe the same physical assessment wall state');
  assert.equal(value.geometrySemantics.Rm.externalPrerequisite,
    'EXPLICIT_SAME_STATE_ASSESSMENT_GEOMETRY_EVIDENCE');
  assert.equal(value.geometrySemantics.r0.meaning,
    'OUTSIDE_RADIUS_OF_STANDARD_CYLINDRICAL_ROUND_ATTACHMENT_AT_SHELL_JUNCTURE');

  assert.equal(value.geometrySemantics.attachmentClass.qualifiedSourceClass,
    'WRC537_CYLINDRICAL_STANDARD_ROUND_HOST_SHELL_ATTACHMENT');
  assert.equal(value.geometrySemantics.attachmentClass.arbitraryRoundObjectAuthorized, false);
  assert.equal(value.geometrySemantics.attachmentClass.lugPadSurrogateAuthorized, false);
  assert.equal(value.geometrySemantics.attachmentClass.reinforcementSpecificAuthority, false);
  assert.equal(value.geometrySemantics.attachmentAxis.wrcReferenceAxis,
    'AXIS_NORMAL_TO_SHELL_THROUGH_CENTER_OF_ATTACHMENT');
  assert.equal(value.geometrySemantics.attachmentAxis.obliqueAuthorized, false);
  assert.equal(value.geometrySemantics.attachmentAxis.softwareOrthogonalityToleranceIsEngineeringAngleAllowance, false);

  assert.equal(value.geometrySemantics.isolation.classification, 'EXTERNAL_CASE_PREREQUISITE');
  assert.equal(value.geometrySemantics.isolation.quantitativeWrcNeighborSpacingCriterionAvailable, false);
  assert.equal(value.geometrySemantics.isolation.inventedSpacingThresholdAllowed, false);
  assert.equal(value.geometrySemantics.section45.provesNeighborIsolation, false);
  assert.equal(value.geometrySemantics.section45.radialLoadCylinderLengthRule, 'l >= Rm when P is active');
  assert.equal(value.geometrySemantics.section45.externalMomentEndDistanceRule,
    'nearest cylinder end distance >= 0.5*Rm when Mc or Ml is active');

  const prerequisiteIds = value.externalCasePrerequisites.map((row) => row.id);
  assert.deepEqual(prerequisiteIds, expectedPrerequisites);
  for (const row of value.externalCasePrerequisites) {
    assert.equal(row.classification, 'REQUIRED_EXTERNAL_CASE_EVIDENCE_NOT_WRC_SOURCE_RULE');
  }

  assert.equal(value.loadAndRecoverySemantics.loadBasis.table5SignPlacementQualified, true);
  assert.equal(value.loadAndRecoverySemantics.loadBasis.oppositeLoadDirectionReversalQualified, true);
  assert.equal(value.loadAndRecoverySemantics.loadBasis.newLoadAxisAuthorityCreatedByProfile, false);
  assert.deepEqual(value.loadAndRecoverySemantics.table5SignArrays.pMem,
    [-1, -1, -1, -1, -1, -1, -1, -1]);
  assert.deepEqual(value.loadAndRecoverySemantics.table5SignArrays.pBend,
    [-1, 1, -1, 1, -1, 1, -1, 1]);

  const physicalRecovery = value.loadAndRecoverySemantics.physicalRecovery;
  assert.equal(physicalRecovery.classification, 'UNRESOLVED_PRIMARY_METHOD_SEMANTIC');
  assert.equal(physicalRecovery.blockerId, expectedBlockers[0]);
  assert.equal(physicalRecovery.uLowerPhysicalSurfaceMeaningQualified, false);
  assert.equal(physicalRecovery.ABCDPhysicalLocationMeaningQualified, false);
  assert.equal(physicalRecovery.membraneBendingPhysicalSurfaceReconstructionQualified, false);
  assert.equal(physicalRecovery.commonPhysicalPointSuperpositionQualified, false);

  assert.equal(value.stressIntensitySemantics.qualified.SMeaning,
    'STRESS_INTENSITY_EQUALS_TWICE_MAXIMUM_SHEAR_STRESS');
  assert.equal(value.stressIntensitySemantics.qualified.maximumShearTheoryUsed, true);
  assert.equal(value.stressIntensitySemantics.qualified.table5CombinedSigmaPhiSigmaXTauOrderQualified, true);
  const stressUnresolved = value.stressIntensitySemantics.unresolved;
  assert.equal(stressUnresolved.classification, 'UNRESOLVED_PRIMARY_METHOD_SEMANTIC');
  assert.equal(stressUnresolved.blockerId, expectedBlockers[1]);
  assert.equal(stressUnresolved.explicitPlaneStressQualified, false);
  assert.equal(stressUnresolved.sigma3ZeroQualified, false);
  assert.equal(stressUnresolved.principalStressEquationsQualified, false);
  assert.equal(stressUnresolved.maximumPrincipalDifferenceEquationQualified, false);
  assert.equal(value.stressIntensitySemantics.eightPointEnvelopeIsGlobalMaximum, false);
  assert.equal(value.stressIntensitySemantics.vonMisesAlternativeAuthorized, false);

  const material = value.materialTheorySemantics.unresolved;
  assert.equal(material.classification, 'UNRESOLVED_PRIMARY_METHOD_SEMANTIC');
  assert.equal(material.blockerId, expectedBlockers[2]);
  assert.equal(material.modulusRoleQualified, false);
  assert.equal(material.absoluteModulusIndependenceQualified, false);
  assert.equal(material.poissonRatioTreatmentQualified, false);
  assert.equal(material.constitutiveApplicabilityQualified, false);
  assert.equal(material.hostAttachmentMaterialRelationshipQualified, false);
  assert.equal(material.temperatureMaterialClassRestrictionsQualified, false);

  assert.deepEqual(value.unresolvedPrimaryMethodSemantics, expectedBlockers);
  assert.equal(value.resultScope.hostCylindricalShellLocalStressAtAttachmentShellJuncture, true);
  assert.equal(value.resultScope.attachmentWallStressAuthorized, false);
  assert.equal(value.resultScope.nozzleWallStressAuthorized, false);
  assert.equal(value.resultScope.weldStressAuthorized, false);
  assert.equal(value.resultScope.WRC297Authority, false);
  assert.equal(value.resultScope.evaluatedEightPointEnvelopeOnly, true);
  assert.equal(value.resultScope.continuousOrGlobalMaximumClaim, false);

  assert.deepEqual(value.codeAndReleaseBoundary, {
    wrcCalculationAuthorityIsSeparate: true,
    codeStressClassificationAuthorized: false,
    allowableComparisonAuthorized: false,
    codeAssessmentPerformed: false,
    codeCompliance: 'NOT_ASSESSED',
    globalEmp1CRouteAuthority: false,
    professionalSourceSemanticsReady: false,
    professionalReleaseReady: false,
    releaseQualified: false,
    deploymentAuthorized: false,
  });
  assert.equal(value.legacyAggregate.legacyRowsRemainBlocked, true);
  assert.equal(value.legacyAggregate.thisProfileDoesNotRewriteLegacySourceRecords, true);
  assert.equal(value.legacyAggregate.professionalP0GateReady, false);
  assert.equal(value.authorityEffect.sourceArtifactRewritten, false);
  assert.equal(value.authorityEffect.productionNumericsChanged, false);
  assert.equal(value.authorityEffect.routeRegistryChanged, false);
  assert.equal(value.authorityEffect.oracleToleranceChanged, false);
  assert.equal(value.authorityEffect.historicalEvidenceChanged, false);
  assert.equal(value.authorityEffect.workflowChanged, false);
  assert.equal(value.authorityEffect.newEngineeringAuthorityCreated, false);
  assert.equal(value.authorityEffect.globalEmp1CAuthorityChanged, false);
  assert.equal(value.authorityEffect.codeComplianceAuthorityChanged, false);
  assert.equal(value.authorityEffect.releaseAuthorityChanged, false);
}

function assertSourceHash(row, artifact) {
  const candidates = [
    artifact.source?.sha256,
    artifact.sourceDocument?.rawPdfSha256,
    artifact.sourceDocument?.rawSha256,
    artifact.sourceCustody?.rawSha256,
    artifact.primarySource?.rawPdfSha256,
  ].filter((value) => value != null);
  assert.ok(candidates.length > 0, `EMP1_1765_SOURCE_SHA_MISSING:${row.legacyIssue}`);
  for (const candidate of candidates) {
    assert.equal(candidate, WRC_SHA256, `EMP1_1765_SOURCE_SHA_DRIFT:${row.legacyIssue}`);
  }
}

function gitBlobSha(path) {
  return execFileSync('git', ['hash-object', path], { cwd: root, encoding: 'utf8' }).trim();
}

function semanticHash(value) {
  const payload = structuredClone(value);
  delete payload.semanticHash;
  return createHash('sha256').update(JSON.stringify(sortValue(payload)), 'utf8').digest('hex');
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value;
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(root, relativePath), 'utf8'));
}
