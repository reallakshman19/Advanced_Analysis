import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CORE = path.join(ROOT, 'src/core/local-attachment-correlation');
const files = fs.readdirSync(CORE).filter((name) => name.endsWith('.js')).sort();
assert.ok(files.length >= 10, 'Correlation core source set is incomplete.');

const forbidden = [
  'Math.random', 'Date.now(', 'performance.now(', 'new Date(',
  'node:fs', 'node:path', 'fetch(', 'XMLHttpRequest', 'WebSocket',
  'document.', 'window.', 'eval(', 'Function(',
  'WRC', 'Kellogg',
];
for (const name of files) {
  const source = fs.readFileSync(path.join(CORE, name), 'utf8');
  const lines = source.split(/\r?\n/).length;
  assert.ok(lines < 300, `${name} must remain below 300 lines; found ${lines}.`);
  assert.equal(/export\s+default\b/u.test(source), false, `${name} must use named exports.`);
  assert.deepEqual(externalImports(source), [], `${name} must use only relative imports.`);
  forbidden.forEach((token) => assert.equal(source.includes(token), false,
    `${name} contains forbidden production token ${token}.`));
}

const synthetic = read('synthetic-profile.js');
assert.match(synthetic, /engineeringUseAuthorized:\s*false/u);
assert.match(synthetic, /SYNTHETIC_QUALIFICATION_ONLY/u);
assert.match(synthetic, /syntheticCorrelationApplicabilityDefinition/u);
assert.doesNotMatch(synthetic, /engineeringUseAuthorized:\s*true/u);

const datasetPackage = read('dataset-package.js');
assert.match(datasetPackage, /engineeringUseAuthorized:\s*false/u);
assert.match(datasetPackage, /DATASET_PACKAGE_INGESTED_NOT_ENGINEERING_QUALIFIED/u);
assert.doesNotMatch(datasetPackage, /engineeringUseAuthorized:\s*true/u);

const trustedAuthorities = read('trusted-authorities.js');
assert.match(trustedAuthorities,
  /TRUSTED_CORRELATION_APPROVAL_AUTHORITIES\s*=\s*Object\.freeze\(\[\]\)/u);

const registry = read('registry.js');
assert.match(registry, /local-attachment-correlation-method-registry\/v3/u);
assert.match(registry, /applicabilityDefinitions/u);
assert.match(registry, /qualificationRecordMatchesApplicabilityDefinition/u);
assert.match(registry, /qualificationRecordMatchesProfile/u);
assert.match(registry, /validateCorrelationQualificationEvidence/u);
assert.match(registry, /executeCorrelationQualificationSuite/u);
assert.match(registry, /CORRELATION_ENGINEERING_APPLICABILITY_DEFINITION_MISSING/u);
assert.match(registry, /CORRELATION_ENGINEERING_QUALIFICATION_EVIDENCE_MISSING/u);
assert.match(registry, /CORRELATION_ENGINEERING_QUALIFICATION_EVIDENCE_NOT_REPRODUCIBLE/u);
assert.match(registry, /validateEngineeringCorrelationRegistry/u);
assert.match(registry, /semanticHash/u);
assert.match(registry, /correlationApprovalAuthorityTrusted/u);
assert.match(registry, /CORRELATION_APPROVAL_AUTHORITY_NOT_TRUSTED/u);
assert.doesNotMatch(registry, /local-attachment-correlation-method-registry\/v[12]/u);

const qualificationRecord = read('qualification-record.js');
assert.match(qualificationRecord, /local-attachment-correlation-qualification-record\/v2/u);
assert.match(qualificationRecord, /applicabilityDefinitionHash/u);
assert.match(qualificationRecord, /qualificationRecordMatchesApplicabilityDefinition/u);

const releaseCandidate = read('release-candidate.js');
assert.match(releaseCandidate, /local-attachment-correlation-release-candidate\/v2/u);
assert.match(releaseCandidate, /local-attachment-correlation-release-trust-projection\/v1/u);
assert.match(releaseCandidate, /applicabilityDefinition/u);
assert.match(releaseCandidate, /applicabilityDefinitionHash/u);
assert.match(releaseCandidate, /unqualifiedCorrelationProfileFromDatasetPackage/u);
assert.match(releaseCandidate, /executeCorrelationQualificationSuite/u);
assert.match(releaseCandidate, /qualificationRecordMatchesApplicabilityDefinition/u);
assert.match(releaseCandidate, /methodDefinitionHash/u);
assert.match(releaseCandidate, /correlationReleaseCandidateTrustProjection/u);
assert.match(releaseCandidate, /CORRELATION_RELEASE_CANDIDATE_NOT_TRUSTED/u);

const applicability = read('applicability.js');
assert.match(applicability, /local-attachment-correlation-applicability-acknowledgment\/v1/u);
assert.match(applicability, /CALLER_EXPLICIT_EXACT_PROFILE_ID_MATCH/u);
assert.match(applicability, /APPLICABILITY_IDENTITY_MATCH_ONLY/u);
assert.match(applicability, /DOES_NOT_PROVE_PROJECT_GEOMETRY_IS_WITHIN_METHOD_SCOPE/u);
assert.match(applicability, /CORRELATION_APPLICABILITY_PROFILE_MISMATCH/u);

const physicalApplicability = read('physical-applicability.js');
assert.match(physicalApplicability, /local-attachment-correlation-applicability-definition\/v1/u);
assert.match(physicalApplicability, /local-attachment-correlation-physical-applicability\/v1/u);
assert.match(physicalApplicability, /validateCorrelationGeometryEvidence/u);
assert.match(physicalApplicability, /DIAMETER_RATIO/u);
assert.match(physicalApplicability, /DIAMETER_THICKNESS_RATIO/u);
assert.match(physicalApplicability, /CORRELATION_PHYSICAL_APPLICABILITY_LIMIT_EXCEEDED/u);
assert.match(physicalApplicability, /CORRELATION_PHYSICAL_APPLICABILITY_TOPOLOGY_MISMATCH/u);
assert.match(physicalApplicability, /CURRENT_GEOMETRY_SUPPORT_D_D_AND_D_T_ONLY/u);

const engineeringAssessment = read('engineering-assessment.js');
const applicabilityOffset = engineeringAssessment.indexOf('createCorrelationApplicabilityAcknowledgment(');
const geometryOffset = engineeringAssessment.indexOf('createCorrelationGeometryEvidenceFromLafea2({');
const physicalOffset = engineeringAssessment.indexOf('evaluateCorrelationPhysicalApplicability({');
const requestOffset = engineeringAssessment.indexOf('createCorrelationRequestFromLafea2({');
assert.ok(applicabilityOffset >= 0, 'Engineering assessment must require applicability acknowledgment.');
assert.ok(geometryOffset > applicabilityOffset,
  'Applicability identity must be established before geometry evidence.');
assert.ok(physicalOffset > geometryOffset,
  'Physical applicability must use source-bound geometry evidence.');
assert.ok(requestOffset > physicalOffset,
  'Physical applicability must be accepted before a correlation request is created.');
assert.match(engineeringAssessment, /local-attachment-correlation-assessment\/v3/u);
assert.match(engineeringAssessment, /physicalApplicability/u);
assert.match(engineeringAssessment, /requireEngineeringCorrelationApplicabilityDefinition/u);

const interpolation = read('interpolation.js');
assert.match(interpolation, /OUTSIDE_CORRELATION_DOMAIN/u);
assert.match(interpolation, /BILINEAR_NO_EXTRAPOLATION/u);

const bridge = read('lafea2-bridge.js');
assert.match(bridge, /combinedForceLocal/u);
assert.match(bridge, /combinedMomentLocal/u);
assert.match(bridge, /screeningRequestSemanticHash/u);
assert.match(bridge, /screeningResultPayloadSemanticHash/u);
assert.match(bridge, /geometryEvidenceHash/u);
assert.doesNotMatch(bridge, /mechanicalTerms\s*\[\s*\d+/u);

const geometryEvidence = read('geometry-evidence.js');
assert.match(geometryEvidence, /validateLocalAttachmentScreeningRequest/u);
assert.match(geometryEvidence, /foundationModelHash/u);
assert.match(geometryEvidence, /foundationResultHash/u);
assert.match(geometryEvidence, /CORRELATION_LAFEA2_REQUEST_RESULT_MISMATCH/u);

console.log(JSON.stringify({
  check: 'lafea-correlation-source-authority',
  status: 'PASS',
  files,
  licensedMethodDataEmbedded: false,
  syntheticEngineeringAuthority: false,
  ingestedDatasetEngineeringAuthority: false,
  trustedApprovalAuthoritiesRegistered: 0,
  executableQualificationEvidenceRequiredForRegistry: true,
  approvedPhysicalApplicabilityDefinitionRequiredForRegistry: true,
  registryReadPathsRevalidateEvidence: true,
  releaseCandidateBindsDatasetProfileApplicabilityEvidenceAndRecord: true,
  releaseCandidateTrustEvaluatedSeparately: true,
  applicabilityProfileIdentityRequiredBeforeGeometry: true,
  physicalApplicabilityUsesSourceBoundGeometry: true,
  physicalApplicabilityRequiredBeforeCorrelationRequest: true,
  extrapolationAuthorized: false,
  lafea1AndLafea2SourceCustodyRetained: true,
}));

function read(name) { return fs.readFileSync(path.join(CORE, name), 'utf8'); }
function externalImports(source) {
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/gu)]
    .map((match) => match[1])
    .filter((value) => !value.startsWith('.'));
}
