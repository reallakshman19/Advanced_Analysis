#!/usr/bin/env node
/**
 * #1775 / WRC-05 release-control wiring guard.
 *
 * The frozen pre-authorization readiness snapshot remains historical. Live
 * release decisions must consume WRC-02 current source semantics, WRC-03
 * current exact-head reobservation, and WRC-04 current benchmark evidence.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const frozenReadinessPath =
  'validation/emp1/release/emp1-professional-release-readiness-v1.json';
const frozenReadinessBytes = await readBuffer(frozenReadinessPath);
const frozenReadiness = JSON.parse(frozenReadinessBytes.toString('utf8'));
const currentSource = await readJson(
  'validation/emp1/release/emp1-wrc537-gamma5-current-source-semantics-gate-v1.json',
);
const currentBenchmarks = await readJson(
  'validation/emp1/release/emp1-current-benchmark-manifest-v1.json',
);
const readinessSource = await readText(
  'scripts/emp1-professional-release-readiness-check.mjs',
);
const candidateSource = await readText(
  'scripts/emp1-professional-release-candidate.mjs',
);
const manifestSource = await readText(
  'scripts/emp1-professional-release-manifest.mjs',
);
const manifestCheckSource = await readText(
  'scripts/emp1-professional-release-manifest-check.mjs',
);
const evidenceExportSource = await readText(
  'src/core/emp1/emp1-engineering-evidence-export.js',
);
const packageMetadata = await readJson('package.json');

assert.equal(
  gitBlobSha1(frozenReadinessBytes),
  '0d28fac3f75bb70c9caaa19a91872ef7432ebe2d',
  'EMP1_WRC05_FROZEN_READINESS_SNAPSHOT_MUTATED',
);
assert.equal(frozenReadiness.schema, 'emp1-professional-release-readiness/v1');
assert.equal(frozenReadiness.state, 'BLOCKED_FAIL_CLOSED');
assert.equal(frozenReadiness.releaseReady, false);
assert.equal(
  frozenReadiness.requiredExecutionGates
    .find((row) => row.gateId === 'P0_SOURCE_SEMANTICS')?.command,
  'node scripts/emp1-professional-p0-source-semantics-check.mjs --require-ready',
  'historical readiness command must remain frozen provenance',
);
assert.deepEqual(frozenReadiness.replayAndExportBoundary, {
  persistedReloadCurrentnessCoveredBy:
    'scripts/emp1-workbench-route-authority-currentness-falsifiers.mjs',
  separateEmp1CNumericalExportConsumerFound: false,
  workbenchExportExportsActiveSourceDocumentNotRetainedCNumerics: true,
  futureNumericExportMustConsumeReportableProjection: true,
}, 'historical no-export observation must remain frozen provenance');

assert.equal(
  currentSource.state,
  'PASS_BOUNDED_METHOD_SOURCE_SEMANTICS_CASE_PREREQUISITES_DECLARED',
);
assert.equal(currentSource.profile.methodSourceSemanticsReady, true);
assert.equal(currentSource.profile.unresolvedPrimaryMethodSemanticCount, 0);
assert.equal(currentSource.caseApplicability.state, 'REQUIRES_CASE_SPECIFIC_EVIDENCE');
assert.equal(
  currentSource.caseApplicability.absenceOfPrerequisiteEvidenceMayBeTreatedAsPass,
  false,
);
assert.equal(currentSource.legacyAggregate.state, 'BLOCKED_P0_SOURCE_SEMANTICS');
assert.equal(currentSource.legacyAggregate.blockerCount, 9);
assert.equal(currentSource.legacyAggregate.rewritten, false);
assert.equal(currentSource.authority.caseEngineeringUseAuthorizedByThisGate, false);
assert.equal(currentSource.authority.releaseAuthorityGranted, false);

// Live readiness must project current WRC-02 semantics while retaining the old
// P0 artifact only as explicitly historical provenance.
assert.match(readinessSource,
  /emp1-wrc537-gamma5-current-source-semantics-gate-v1\.json/u);
assert.match(readinessSource,
  /boundedSourceSemanticsReady/u);
assert.match(readinessSource,
  /historicalP0Aggregate:\s*'HISTORICAL_SUPERSEDED_BLOCKED_9'/u);
assert.match(readinessSource, /WRC02_SOURCE_SEMANTICS_NOT_READY/u);
assert.doesNotMatch(readinessSource, /const\s+p0Ready\s*=/u);

// Live candidate must execute WRC-02 -> WRC-03 -> WRC-04, then qualify the
// durable evidence/review capability, before release build.
assert.doesNotMatch(candidateSource,
  /scripts\/emp1-professional-p0-source-semantics-check\.mjs/u,
  'live candidate must not execute historical P0 readiness as current authority');
const wrc02Index = candidateSource.indexOf("['WRC02_SOURCE_SEMANTICS'");
const wrc03Index = candidateSource.indexOf("['WRC03_CURRENT_EXACT_HEAD'");
const wrc04Index = candidateSource.indexOf("['WRC04_BENCHMARK_EVIDENCE'");
const exportIndex = candidateSource.indexOf("['ENGINEERING_EVIDENCE_EXPORT'");
const reviewIndex = candidateSource.indexOf("['ENGINEERING_REVIEW_CONTRACT'");
const reviewReadinessIndex = candidateSource.indexOf("['ENGINEERING_REVIEW_READINESS'");
const buildIndex = candidateSource.indexOf("['PRODUCTION_BUILD'");
for (const [name, index] of Object.entries({
  WRC02: wrc02Index,
  WRC03: wrc03Index,
  WRC04: wrc04Index,
  EVIDENCE_EXPORT: exportIndex,
  REVIEW_CONTRACT: reviewIndex,
  REVIEW_READINESS: reviewReadinessIndex,
  BUILD: buildIndex,
})) assert.ok(index >= 0, `EMP1_WRC05_REQUIRED_GATE_MISSING:${name}`);
assert.ok(
  wrc02Index < wrc03Index
    && wrc03Index < wrc04Index
    && wrc04Index < exportIndex
    && exportIndex < reviewIndex
    && reviewIndex < reviewReadinessIndex
    && reviewReadinessIndex < buildIndex,
  'EMP1_WRC05_UPSTREAM_GATE_ORDER_INVALID',
);
assert.match(candidateSource,
  /emp1-wrc537-bounded-source-semantics-profile-check\.mjs/u);
assert.match(candidateSource,
  /emp1-wrc-gamma5-exact-head-requalification\.mjs/u);
assert.match(candidateSource, /--expected-head',\s*candidateHead/u);
assert.match(candidateSource, /check:emp1-benchmarks/u);
assert.match(candidateSource, /check:emp1-evidence-export/u);
assert.match(candidateSource, /emp1-engineering-review-record-check\.mjs/u);
assert.match(candidateSource, /emp1-review-readiness-integration-check\.mjs/u);
assert.match(candidateSource, /requiredTrackedCandidateFile/u);
assert.match(candidateSource, /EMP1_RELEASE_CASE_ENGINEERING_EVIDENCE_REGULAR_FILE_REQUIRED/u);
assert.match(candidateSource, /git\(\['rev-parse', `HEAD:\$\{relativePath\}`\]\)/u);
assert.match(candidateSource, /git\(\['hash-object', '--', relativePath\]\)/u);
assert.match(candidateSource, /packageGitBlobSha1/u);
assert.match(candidateSource, /--engineering-evidence-package/u);
assert.match(candidateSource, /CASE_ENGINEERING_EVIDENCE/u);
assert.match(candidateSource, /BLOCKED_CASE_ENGINEERING_EVIDENCE_REQUIRED/u);
assert.match(candidateSource, /reviewAcceptedCurrent/u);
assert.match(candidateSource,
  /caseEngineeringEvidence\?\.gate\.status\s*===\s*'PASS'/u,
  'release qualification must require validated case engineering evidence');
assert.match(candidateSource,
  /caseEngineeringEvidence\?\.custody\.reviewAcceptedCurrent\s*===\s*true/u,
  'release qualification must require a current accepted case review');
assert.equal(
  packageMetadata.scripts?.['check:emp1-evidence-export'],
  'node scripts/emp1-engineering-evidence-export-check.mjs',
);
assert.match(evidenceExportSource, /EMP1_SCHEMAS\.EVIDENCE_EXPORT/u);
assert.match(evidenceExportSource, /HISTORICAL_NON_REPORTABLE/u);
assert.match(evidenceExportSource, /importedCurrentFlagTrusted:\s*false/u);
assert.match(evidenceExportSource, /importedRouteAuthorizationTrusted:\s*false/u);
assert.match(evidenceExportSource, /importedReleaseAuthorityTrusted:\s*false/u);
assert.doesNotMatch(evidenceExportSource, /releaseQualified:\s*true/u);

// Current benchmark contract must represent H1/H2 truth and H3 absence without
// granting external-comparison authority.
assert.equal(currentBenchmarks.issue, 1772);
assert.equal(currentBenchmarks.state, 'CURRENT_BENCHMARK_EVIDENCE_INDEX');
assert.equal(
  currentBenchmarks.gamma5.independentHandCalculationTrace.status,
  'FROZEN_INDEPENDENT_H1_TRACE',
);
assert.deepEqual(currentBenchmarks.gamma5.independentHandCalculationTrace.productionImports, []);
assert.equal(
  currentBenchmarks.gamma5.independentHandCalculationTrace.productionObservationUsed,
  false,
);
assert.equal(
  currentBenchmarks.caux.currentQualification.directPdfPageReobservation,
  'PASS',
);
assert.equal(
  currentBenchmarks.caux.retainedComparisonCustody.comparisonState,
  'COMPARISON_QUALIFIED',
);
assert.equal(currentBenchmarks.caux.routeRelationship.engineeringUseAuthorized, false);
assert.equal(currentBenchmarks.pvElite.state, 'REFERENCE_NOT_AVAILABLE');
assert.equal(currentBenchmarks.pvElite.numericalComparisonRun, false);
for (const value of Object.values(currentBenchmarks.authority)) assert.equal(value, false);

// Release manifest must retain exact current source/benchmark evidence identity,
// not just historical route authorization.
assert.match(readinessSource, /emp1-professional-release-readiness-check\/v2/u);
assert.match(manifestSource, /emp1-release-candidate\/v3/u);
assert.match(manifestCheckSource, /emp1-release-candidate\/v3/u);
for (const source of [manifestSource, manifestCheckSource]) {
  assert.match(source,
    /emp1-wrc537-gamma5-current-source-semantics-gate-v1\.json/u);
  assert.match(source, /emp1-current-benchmark-manifest-v1\.json/u);
  assert.match(source, /sourceSemanticsProfileHash/u);
  assert.match(source, /sourceSemanticsGateHash/u);
  assert.match(source, /currentManifestSha256/u);
  assert.match(source, /cauxCurrentQualificationSemanticHash/u);
  assert.match(source, /pvEliteReferenceState/u);
  assert.match(source, /routeAuthorityHash/u);
  assert.match(source, /professionalReviewCapability/u);
  assert.match(source, /durableEvidencePackageSchema/u);
  assert.match(source, /caseSpecificHumanReviewAsserted/u);
  assert.match(source, /caseSpecificHumanReviewGateId/u);
  assert.match(source, /CASE_ENGINEERING_EVIDENCE/u);
  assert.match(source, /caseEngineeringEvidence/u);
  assert.match(source, /packageGitBlobSha1/u);
  assert.match(source, /deploymentEvidence/u);
}

console.log(JSON.stringify({
  schema: 'emp1-professional-release-control-wiring-check/v2',
  status: 'PASS_WRC05_CURRENT_WRC02_WRC03_WRC04_P5_P6_RELEASE_CONTROL_WIRING',
  frozenReadinessGitBlobSha1: gitBlobSha1(frozenReadinessBytes),
  currentSourceSemanticsGateHash: currentSource.semanticHash,
  currentSourceSemanticsProfileHash: currentSource.profile.semanticHash,
  historicalP0State: currentSource.legacyAggregate.state,
  liveCandidateGateOrder: [
    'WRC02_SOURCE_SEMANTICS',
    'WRC03_CURRENT_EXACT_HEAD',
    'WRC04_BENCHMARK_EVIDENCE',
    'ENGINEERING_EVIDENCE_EXPORT',
    'ENGINEERING_REVIEW_CONTRACT',
    'ENGINEERING_REVIEW_READINESS',
    'PRODUCTION_BUILD',
  ],
  h1TraceStatus: currentBenchmarks.gamma5.independentHandCalculationTrace.status,
  cauxQualificationStatus: currentBenchmarks.caux.currentQualification.status,
  cauxComparisonRouteEngineeringUseAuthorized:
    currentBenchmarks.caux.routeRelationship.engineeringUseAuthorized,
  pvEliteReferenceState: currentBenchmarks.pvElite.state,
  historicalReplayExportObservation:
    frozenReadiness.replayAndExportBoundary.separateEmp1CNumericalExportConsumerFound,
  currentDurableEvidenceExportImplemented: true,
  currentDurableEvidenceExportSchema: 'emp1-evidence-export/v1',
  releaseManifestSchema: 'emp1-release-candidate/v3',
  caseSpecificHumanReviewRequiredForReleaseQualification: true,
  caseEngineeringEvidenceGateId: 'CASE_ENGINEERING_EVIDENCE',
  caseEngineeringEvidenceMustBeExactCandidateGitBlob: true,
  releaseAuthorityCreatedByThisCheck: false,
  codeComplianceAuthorizedByThisCheck: false,
  globalEmp1CAuthorizedByThisCheck: false,
}, null, 2));

async function readBuffer(path) { return readFile(resolve(root, path)); }
async function readText(path) { return readFile(resolve(root, path), 'utf8'); }
async function readJson(path) { return JSON.parse(await readText(path)); }
function gitBlobSha1(bytes) {
  const header = Buffer.from(`blob ${bytes.byteLength}\0`, 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}
