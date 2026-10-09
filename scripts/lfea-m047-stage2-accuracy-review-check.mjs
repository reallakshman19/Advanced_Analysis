#!/usr/bin/env node
/** Pure/static contract for the verified Stage 2 restraint accuracy review. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  buildStage2AccuracyReview,
  renderStage2AccuracyReviewMarkdown,
} from './lfea-m047-stage2-accuracy-review.mjs';

const sourceAccdbSha256 = '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8';
const baseline = {
  schema: 'm047-bm4l-stage2-friction-tuning-iteration/v1',
  caseId: 'L13',
  converged: true,
  sourceAccdbSha256,
  iterationSemanticHash: 'fnv1a64:baseline',
  restraints: [
    {
      restraintId: 'A', nodeId: '100', nodeName: 'A', frictionDofs: ['UX', 'UZ'],
      normal: { referenceN: 1000, solvedN: 1050 },
      regime: { reference: 'SLID', solved: 'SLIDING', referenceUtilisation: 1.0, solvedUtilisation: 1.0 },
      tangential: {
        referenceN: [100, 0], referenceMagnitudeN: 100,
        solvedN: [0, 100], solvedMagnitudeN: 100,
        vectorRelativeError: Math.SQRT2,
      },
    },
    {
      restraintId: 'B', nodeId: '200', nodeName: 'B', frictionDofs: ['UX'],
      normal: { referenceN: 2000, solvedN: 2300 },
      regime: { reference: 'STUCK', solved: 'LOCKED_AFTER_SLIP', referenceUtilisation: 0.9, solvedUtilisation: 0.8 },
      tangential: {
        referenceN: [5], referenceMagnitudeN: 5,
        solvedN: [5.5], solvedMagnitudeN: 5.5,
        vectorRelativeError: 0.1,
      },
    },
  ],
};
const r1 = {
  schema: 'm047-bm4l-stage2-reference-resolution/v1',
  caseId: 'L13',
  sourceAccdbSha256,
  semanticHash: 'fnv1a64:r1',
  referenceResolution: { forceResolutionFloorN: 87.5635 },
  summary: { comparableRelativeCount: 1, resolutionLimitedCount: 1, exactZeroReferenceCount: 0 },
  restraints: [
    {
      restraintId: 'A', nodeId: '100', classification: 'COMPARABLE_RELATIVE',
      forceResolutionFloorN: 87.5635, referenceTangentialMagnitudeN: 100,
      relativeComparisonEligible: true,
    },
    {
      restraintId: 'B', nodeId: '200', classification: 'RESOLUTION_LIMITED',
      forceResolutionFloorN: 87.5635, referenceTangentialMagnitudeN: 5,
      relativeComparisonEligible: false,
    },
  ],
};
const direction = {
  schema: 'm047-bm4l-stage2-direction-only-nonlinear-experiment/v1',
  caseId: 'L13',
  sourceAccdbSha256,
  recordSemanticHash: 'fnv1a64:direction',
  candidate: { converged: true },
  promotion: { status: 'DO_NOT_PROMOTE_FROM_THIS_RUN' },
  restraints: [
    {
      restraintId: 'A', nodeId: '100', regime: 'SLIDING',
      candidateTangentialN: [100, 0], candidateMagnitudeN: 100,
      candidateVectorRelativeError: 0,
      candidateDirectionCosineToReference: 1,
      candidateOppositionCosineToTotalDisplacement: -1,
      normal: { candidateN: 990, candidatePercentError: -1 },
    },
    {
      restraintId: 'B', nodeId: '200', regime: 'STUCK',
      candidateTangentialN: [-5], candidateMagnitudeN: 5,
      candidateVectorRelativeError: 2,
      candidateDirectionCosineToReference: -1,
      candidateOppositionCosineToTotalDisplacement: null,
      normal: { candidateN: 2010, candidatePercentError: 0.5 },
    },
  ],
};

const review = buildStage2AccuracyReview({
  baseline, r1, direction,
  provenance: {
    manifestSchema: 'm047-bm4l-stage2-rca-evidence-batch/v1',
    manifestSemanticHash: 'fnv1a64:manifest',
    verificationStatus: 'PASS',
  },
});
assert.equal(review.candidateStatus, 'CONVERGED');
assert.equal(review.qualificationClaimMade, false);
assert.equal(review.mechanicsChanged, false);
assert.equal(review.toleranceChanged, false);
assert.equal(review.comparisonPolicyChanged, false);
assert.equal(review.baselineSummary.normalWithinGoal, 1);
assert.equal(review.candidateSummary.normalWithinGoal, 2);
assert.equal(review.baselineSummary.tangentialMagnitudeWithinGoal, 2);
assert.equal(review.candidateSummary.tangentialMagnitudeWithinGoal, 2);
assert.equal(review.baselineSummary.tangentialVectorWithinGoal, 1);
assert.equal(review.candidateSummary.tangentialVectorWithinGoal, 1);
assert.equal(review.baselineSummary.normalizedConstitutiveStateMatches, 2,
  'SLIDING and LOCKED_AFTER_SLIP must normalize to CAESAR SLID/STUCK states');
assert.equal(review.candidateSummary.normalizedConstitutiveStateMatches, 2);
assert.ok(Math.abs(review.restraints[0].tangential.baselineDirectionErrorDegrees - 90) < 1e-12);
assert.ok(Math.abs(review.restraints[0].tangential.candidateDirectionErrorDegrees) < 1e-12);
assert.ok(Math.abs(review.restraints[1].tangential.candidateDirectionErrorDegrees - 180) < 1e-12);
assert.equal(review.restraints[1].r1.classification, 'RESOLUTION_LIMITED');
assert.equal(review.r1Summary.comparableRelativeCount, 1);

const markdown = renderStage2AccuracyReviewMarkdown(review);
assert.match(markdown, /Normal reactions within ±10%/u);
assert.match(markdown, /Tangential vectors within ±10%/u);
assert.match(markdown, /State ref\/B0\/D1/u);
assert.match(markdown, /Direction err B0\/D1/u);
assert.match(markdown, /RESOLUTION_LIMITED/u);

const failedDirection = {
  ...direction,
  candidate: {
    converged: false,
    firstRunFailure: { message: 'did not converge' },
    repeatRunFailure: { message: 'did not converge' },
  },
  restraints: null,
};
const failedReview = buildStage2AccuracyReview({ baseline, r1, direction: failedDirection });
assert.equal(failedReview.candidateStatus, 'NONCONVERGED_NO_CANDIDATE_ACCURACY_CLAIM');
assert.equal(failedReview.candidateSummary, null);
assert.equal(failedReview.delta, null);
assert.ok(failedReview.restraints.every((row) => row.normal.candidatePercentError === null));
assert.ok(failedReview.restraints.every((row) => row.tangential.candidateVectorRelativeError === null));
assert.ok(failedReview.restraints.every((row) => row.tangential.candidateMagnitudeRelativeError === null));
assert.ok(failedReview.restraints.every((row) => row.tangential.candidateDirectionErrorDegrees === null));
assert.match(renderStage2AccuracyReviewMarkdown(failedReview), /no counterfactual\/oracle is substituted/u);

const scriptPath = resolve('scripts/lfea-m047-stage2-accuracy-review.mjs');
const source = readFileSync(scriptPath, 'utf8');
assert.match(source, /verifyStage2RcaEvidenceManifest/u,
  'CLI accuracy review must accept only a verified COMPLETE evidence bundle');
assert.match(source, /NONCONVERGED_NO_CANDIDATE_ACCURACY_CLAIM/u,
  'nonconvergence must fail closed on candidate accuracy reporting');
assert.match(source, /qualificationClaimMade: false/u);
assert.match(source, /CANDIDATE_PERCENTAGES_ARE_REPORTED_ONLY_FROM_A_CONVERGED_REAL_ACCDB_NONLINEAR_DIRECTION_RUN/u);
assert.doesNotMatch(source, /direction-only counterfactual/iu,
  'verified accuracy review must not substitute the diagnostic direction counterfactual');

const syntax = spawnSync(process.execPath, ['--check', scriptPath], { encoding: 'utf8' });
assert.equal(syntax.status, 0, `accuracy-review script must parse: ${syntax.stderr}`);

process.stdout.write('PASS m047 Stage 2 verified accuracy review contract\n');
