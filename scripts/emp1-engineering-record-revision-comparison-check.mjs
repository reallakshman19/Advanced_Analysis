#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmp1EngineeringReviewRecord } from '../src/core/emp1/emp1-engineering-review-record.js';
import { createEmp1EngineeringRecordPackage } from '../src/core/emp1/emp1-engineering-record-package.js';
import { compareEmp1EngineeringRecordRevisions } from '../src/core/emp1/emp1-engineering-record-revision-comparison.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const base = packageFor({ packagedAt: '2026-09-01T18:05:00Z' });

const identical = compareEmp1EngineeringRecordRevisions(base, base);
assert.equal(identical.classification, 'IDENTICAL_PACKAGE');
assert.equal(identical.samePackageIdentity, true);
assert.deepEqual(identical.changeDomains, []);

const metadataOnly = packageFor({ packagedAt: '2026-09-01T18:06:00Z' });
const metadataComparison = compareEmp1EngineeringRecordRevisions(base, metadataOnly);
assert.equal(metadataComparison.sameEngineeringEvidence, true);
assert.equal(metadataComparison.sameReview, true);
assert.equal(metadataComparison.classification, 'PACKAGE_METADATA_ONLY_CHANGED');
assert.deepEqual(metadataComparison.changeDomains, ['PACKAGE_METADATA_ONLY']);

const reviewChanged = packageFor({
  packagedAt: '2026-09-01T18:07:00Z',
  reviewer: 'engineer:beta',
  disposition: 'REJECTED',
});
const reviewComparison = compareEmp1EngineeringRecordRevisions(base, reviewChanged);
assert.equal(reviewComparison.sameEngineeringEvidence, true);
assert.equal(reviewComparison.sameReview, false);
assert.equal(reviewComparison.review.dispositionChanged, true);
assert.ok(reviewComparison.changeDomains.includes('ENGINEERING_REVIEW'));
assert.equal(reviewComparison.authorityBoundary.createsReleaseAuthority, false);

const evidenceChanged = packageFor({
  packagedAt: '2026-09-01T18:08:00Z', cHash: 'C-2',
});
const evidenceComparison = compareEmp1EngineeringRecordRevisions(base, evidenceChanged);
assert.ok(evidenceComparison.changedEvidenceBindings.includes('localCorrelationResultHash'));
assert.ok(evidenceComparison.changedEvidenceBindings.includes('assessmentSemanticHash'));
assert.equal(evidenceComparison.sameEngineeringEvidence, false);
assert.ok(evidenceComparison.changeDomains.includes('EVIDENCE_BINDING'));
assert.ok(evidenceComparison.changeDomains.includes('ENGINEERING_REVIEW'));

const routeChanged = packageFor({
  packagedAt: '2026-09-01T18:09:00Z',
  routeHash: 'ROUTE-2', methodIdentity: 'WRC537_GAMMA5_REQUALIFIED',
  limitations: ['HOST_SHELL_ONLY', 'NO_GLOBAL_MAXIMUM'],
});
const routeComparison = compareEmp1EngineeringRecordRevisions(base, routeChanged);
assert.equal(routeComparison.route.methodChanged, true);
assert.equal(routeComparison.route.routeLimitationsChanged, true);
assert.ok(routeComparison.changedEvidenceBindings.includes('routeAuthorityHash'));
assert.ok(routeComparison.changeDomains.includes('METHOD_IDENTITY'));
assert.ok(routeComparison.changeDomains.includes('LIMITATIONS'));
assert.equal(routeComparison.classification, 'MULTIPLE_CUSTODY_DOMAINS_CHANGED');

for (const comparison of [identical, metadataComparison, reviewComparison, evidenceComparison, routeComparison]) {
  assert.equal(Object.isFrozen(comparison), true);
  assert.equal(comparison.authorityBoundary.comparisonOnly, true);
  assert.equal(comparison.authorityBoundary.evaluatesNumericalDifference, false);
  assert.equal(comparison.authorityBoundary.evaluatesEngineeringSignificance, false);
  assert.equal(comparison.authorityBoundary.createsCodeCompliance, false);
  assert.equal(comparison.authorityBoundary.createsReleaseAuthority, false);
  assert.equal(comparison.authorityBoundary.createsCryptographicSeal, false);
}

const source = await read('src/core/emp1/emp1-engineering-record-revision-comparison.js');
assert.equal(source.includes('runEmp1('), false);
assert.equal(source.includes('stressIntensity'), false);
assert.equal(source.includes('semanticHash('), false,
  'revision comparison must not mint a new semantic identity');
assert.equal(source.includes('qualifiedApplicability'), false);
assert.equal(source.includes('releaseQualified = true'), false);

console.log(JSON.stringify({
  schema: 'emp1-engineering-record-revision-comparison-check/v1',
  status: 'PASS_AUDIT_CUSTODY_REVISION_COMPARISON',
  identical: identical.classification,
  metadataOnly: metadataComparison.classification,
  reviewChanged: reviewComparison.classification,
  evidenceChanged: evidenceComparison.classification,
  routeChanged: routeComparison.classification,
  numericalDifferenceEvaluated: false,
  engineeringSignificanceEvaluated: false,
  releaseAuthorityCreated: false,
}, null, 2));

function packageFor({
  packagedAt,
  reviewer = 'engineer:alpha',
  disposition = 'ACCEPTED',
  cHash = 'C-1',
  routeHash = 'ROUTE-1',
  methodIdentity = 'WRC537_GAMMA5',
  limitations = ['HOST_SHELL_ONLY'],
} = {}) {
  const parents = {
    sourceHash: 'SOURCE-1', loadTransferResultHash: 'A-1',
    sectionScreeningResultHash: 'B-1', localCorrelationResultHash: cHash,
  };
  const assessment = {
    schema: 'emp1-assessment/v1', productId: 'EMP.1', decision: 'PASS', reasons: [], parents,
    authority: { wrcEngineeringUseAuthorizedByScaffold: false, codeComplianceProduced: false, releaseQualified: false },
    interpretation: { passIsCodeCompliance: false, releaseQualified: false, localCorrelationRequiredWhenScreeningEscalates: true },
  };
  const result = {
    productId: 'EMP.1',
    loadTransfer: { resultHash: 'A-1' },
    sectionScreening: { resultHash: 'B-1' },
    localCorrelation: { resultHash: cHash },
    assessment,
  };
  const routeAuthoritySnapshot = {
    schema: 'emp1-workbench-route-authority-snapshot/v1', semanticHash: routeHash,
    registry: {
      method: { methodIdentity, methodEdition: '2013' },
      scope: { shellFamily: 'CYLINDRICAL', gamma: 5 },
      limitations,
      remainingBlocked: ['GLOBAL_MAXIMUM'],
    },
  };
  const evidence = {
    sourceHash: 'SOURCE-1', routeAuthorityHash: routeHash, routeAuthoritySnapshot, result,
  };
  const reviewRecord = createEmp1EngineeringReviewRecord({
    disposition,
    reviewer: { identity: reviewer, role: 'ENGINEER' },
    reviewedAt: '2026-09-01T18:00:00Z',
    basisCode: 'EMP1_ENGINEERING_RESULT_REVIEW',
    comment: null,
    evidence,
  });
  return createEmp1EngineeringRecordPackage({ packagedAt, reviewRecord, evidence });
}

async function read(path) { return readFile(resolve(root, path), 'utf8'); }
