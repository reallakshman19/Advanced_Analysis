import assert from 'node:assert/strict';
import {
  createCorrelationQualificationRecordFromEvidence,
  createCorrelationQualificationSuite,
  createEngineeringCorrelationRegistry,
  executeCorrelationQualificationSuite,
  syntheticCorrelationProfile,
  syntheticCorrelationRequest,
  validateCorrelationQualificationEvidence,
  validateCorrelationQualificationSuite,
} from '../src/core/local-attachment-correlation/index.js';

const TOL = 1e-10;
const profile = syntheticCorrelationProfile();
const suite = createCorrelationQualificationSuite({
  suiteIdentity: 'SYNTHETIC-CORRELATION-QUALIFICATION-SUITE-001',
  profile,
  cases: [
    midpointCase(),
    lowerKnotCase(),
    outsideRatioCase(),
    outsideDtCase(),
    signReversalCase(),
    ...isolatedLoadCases(),
  ],
});
assert.match(suite.semanticHash, /^fnv1a64:[0-9a-f]{16}$/u);
assert.equal(suite.methodIdentity, profile.methodIdentity);
assert.equal(suite.methodEdition, profile.methodEdition);
assert.equal(suite.coefficientDatasetHash, profile.coefficientDatasetHash);
assert.deepEqual(validateCorrelationQualificationSuite(suite), suite);

const evidence = executeCorrelationQualificationSuite(suite, profile);
assert.equal(evidence.status, 'PASS');
assert.equal(evidence.caseResults.length, 11);
assert.ok(evidence.caseResults.every((row) => row.status === 'PASS'));
assert.ok(evidence.caseResults.every((row) => row.observations.every((obs) => obs.pass)));
assert.match(evidence.semanticHash, /^fnv1a64:[0-9a-f]{16}$/u);
assert.deepEqual(validateCorrelationQualificationEvidence(evidence), evidence);

const midpoint = evidence.caseResults.find((row) => row.caseId === 'MIDPOINT-HAND-CALC');
assert.equal(observation(midpoint, 'VM').actual, 87.13782186857783);
assert.equal(observation(midpoint, 'SIGMA-X-TOTAL').actual, 100);
assert.equal(observation(midpoint, 'SIGMA-THETA-TOTAL').actual, 59);
assert.equal(observation(midpoint, 'PRINCIPAL-1').actual, 100.09732992404598);
assert.equal(observation(midpoint, 'FX-X-WEIGHT').actual, 0.5);

const lower = evidence.caseResults.find((row) => row.caseId === 'EXACT-LOWER-KNOT');
assert.equal(observation(lower, 'FX-X-EXACT').actual, true);
assert.equal(observation(lower, 'FX-Y-EXACT').actual, true);
assert.equal(observation(lower, 'FX-COEFFICIENT').actual, 1);
assert.equal(observation(lower, 'MY-COEFFICIENT').actual, 2);

const outside = evidence.caseResults.find((row) => row.caseId === 'OUTSIDE-DIAMETER-RATIO');
assert.equal(observation(outside, 'OUTSIDE-STATE').actual, 'OUTSIDE_DOMAIN');
assert.ok(observation(outside, 'OUTSIDE-DIAGNOSTIC').actual.includes('OUTSIDE_CORRELATION_DOMAIN'));

const reversal = evidence.caseResults.find((row) => row.caseId === 'SIGN-REVERSAL');
assert.equal(observation(reversal, 'REV-SIGMA-X').actual, -85);
assert.equal(observation(reversal, 'REV-SIGMA-THETA').actual, -29);
assert.equal(observation(reversal, 'REV-TAU').actual, -2);
close(observation(reversal, 'REV-VM').actual, 74.91995728776145, 'sign-reversal VM');

for (const component of ['FX', 'FY', 'FZ', 'MX', 'MY', 'MZ']) {
  const row = evidence.caseResults.find((caseRow) => caseRow.caseId === `ISOLATED-${component}`);
  assert.equal(row.status, 'PASS');
}

const failingSuite = createCorrelationQualificationSuite({
  suiteIdentity: 'SYNTHETIC-CORRELATION-QUALIFICATION-SUITE-FAIL',
  profile,
  cases: [{
    ...midpointCase(),
    observations: [numeric('WRONG-VM', 'TARGET_VON_MISES', 999, TOL, {
      targetId: 'CROWN_OUTER',
    })],
  }],
});
const failingEvidence = executeCorrelationQualificationSuite(failingSuite, profile);
assert.equal(failingEvidence.status, 'FAIL');
assert.equal(failingEvidence.caseResults[0].status, 'FAIL');
assert.equal(failingEvidence.caseResults[0].observations[0].pass, false);
assert.throws(() => createCorrelationQualificationRecordFromEvidence({
  profile,
  qualificationEvidence: failingEvidence,
  recordIdentity: 'FAIL-RECORD',
  approvalAuthorityId: 'UNTRUSTED:FIXTURE',
  approvalReference: 'FAIL',
  engineeringUseApproved: true,
}), (error) => error?.code === 'CORRELATION_QUALIFICATION_EVIDENCE_NOT_PASS');

const tamperedEvidence = structuredClone(evidence);
tamperedEvidence.caseResults[0].observations[0].actual = 'TAMPERED';
assert.throws(() => validateCorrelationQualificationEvidence(tamperedEvidence),
  (error) => error?.code === 'CORRELATION_QUALIFICATION_EVIDENCE_HASH_MISMATCH');

const candidateProfile = structuredClone(profile);
candidateProfile.provenance.licenseAuthority = 'QUALIFICATION_FIXTURE_LICENSE';
candidateProfile.authority.engineeringUseAuthorized = true;
candidateProfile.authority.authorizationBasis = 'QUALIFICATION_FIXTURE_ONLY';
const candidateSuite = createCorrelationQualificationSuite({
  suiteIdentity: 'CANDIDATE-TRUST-GATE-SUITE',
  profile: candidateProfile,
  cases: [midpointCase()],
});
const candidateEvidence = executeCorrelationQualificationSuite(candidateSuite, candidateProfile);
assert.equal(candidateEvidence.status, 'PASS');
const candidateRecord = createCorrelationQualificationRecordFromEvidence({
  profile: candidateProfile,
  qualificationEvidence: candidateEvidence,
  recordIdentity: 'CANDIDATE-UNTRUSTED-APPROVAL',
  approvalAuthorityId: 'UNTRUSTED:QUALIFICATION_FIXTURE',
  approvalReference: 'QUALIFICATION-SUITE-CHECK',
  engineeringUseApproved: true,
});
assert.equal(candidateRecord.qualificationEvidenceHash, candidateEvidence.semanticHash);
assert.throws(() => createEngineeringCorrelationRegistry(
  [candidateProfile], [candidateRecord],
), (error) => error?.code === 'CORRELATION_APPROVAL_AUTHORITY_NOT_TRUSTED');

console.log(JSON.stringify({
  check: 'lafea-correlation-executable-qualification-suite',
  status: 'PASS',
  suiteHash: suite.semanticHash,
  qualificationEvidenceHash: evidence.semanticHash,
  cases: evidence.caseResults.length,
  observations: evidence.caseResults.reduce((sum, row) => sum + row.observations.length, 0),
  midpointVonMisesMpa: observation(midpoint, 'VM').actual,
  signReversalVonMisesMpa: observation(reversal, 'REV-VM').actual,
  exactKnotQualified: true,
  bothDomainBoundariesQualified: true,
  sixLoadIsolationQualified: true,
  failingEvidenceCannotCreateRecord: true,
  evidenceTamperRejected: true,
  passEvidenceStillRequiresTrustedApprovalAuthority: true,
}));

function midpointCase() {
  return {
    caseId: 'MIDPOINT-HAND-CALC',
    request: syntheticCorrelationRequest({ requestIdentity: 'SUITE-MIDPOINT' }),
    observations: [
      exact('STATE', 'QUALIFICATION_STATE', 'ACCEPTED'),
      numeric('D-RATIO', 'GEOMETRY_PARAMETER', 0.25, TOL, { field: 'diameterRatio' }),
      numeric('DT-RATIO', 'GEOMETRY_PARAMETER', 30, TOL, { field: 'diameterThicknessRatio' }),
      numeric('FX-BASIS', 'CONTRIBUTION', 30, TOL, {
        responseId: 'FX-SIGMA-X-MEMBRANE', field: 'basisStress',
      }),
      numeric('FX-COEFF', 'CONTRIBUTION', 1.5, TOL, {
        responseId: 'FX-SIGMA-X-MEMBRANE', field: 'coefficient',
      }),
      numeric('FX-X-WEIGHT', 'INTERPOLATION_AXIS', 0.5, TOL, {
        responseId: 'FX-SIGMA-X-MEMBRANE', axis: 'x', field: 'weight',
      }),
      numeric('FX-Y-WEIGHT', 'INTERPOLATION_AXIS', 0.5, TOL, {
        responseId: 'FX-SIGMA-X-MEMBRANE', axis: 'y', field: 'weight',
      }),
      numeric('SIGMA-X-TOTAL', 'TARGET_COMPONENT', 100, TOL, {
        targetId: 'CROWN_OUTER', stressComponent: 'SIGMA_X', field: 'totalSurface',
      }),
      numeric('SIGMA-THETA-TOTAL', 'TARGET_COMPONENT', 59, TOL, {
        targetId: 'CROWN_OUTER', stressComponent: 'SIGMA_THETA', field: 'totalSurface',
      }),
      numeric('SIGMA-R-TOTAL', 'TARGET_COMPONENT', 0, TOL, {
        targetId: 'CROWN_OUTER', stressComponent: 'SIGMA_R', field: 'totalSurface',
      }),
      numeric('TAU-TOTAL', 'TARGET_COMPONENT', 2, TOL, {
        targetId: 'CROWN_OUTER', stressComponent: 'TAU_XTHETA', field: 'totalSurface',
      }),
      numeric('PRINCIPAL-1', 'TARGET_PRINCIPAL', 100.09732992404598, TOL, {
        targetId: 'CROWN_OUTER', principalIndex: 0,
      }),
      numeric('PRINCIPAL-2', 'TARGET_PRINCIPAL', 58.90267007595402, TOL, {
        targetId: 'CROWN_OUTER', principalIndex: 1,
      }),
      numeric('PRINCIPAL-3', 'TARGET_PRINCIPAL', 0, TOL, {
        targetId: 'CROWN_OUTER', principalIndex: 2,
      }),
      numeric('VM', 'TARGET_VON_MISES', 87.13782186857783, TOL, {
        targetId: 'CROWN_OUTER',
      }),
    ],
  };
}

function lowerKnotCase() {
  return {
    caseId: 'EXACT-LOWER-KNOT',
    request: syntheticCorrelationRequest({
      requestIdentity: 'SUITE-LOWER-KNOT',
      geometry: { attachmentDiameter: 60, pipeThickness: 15 },
    }),
    observations: [
      exact('STATE', 'QUALIFICATION_STATE', 'ACCEPTED'),
      exact('FX-X-EXACT', 'INTERPOLATION_AXIS', true, {
        responseId: 'FX-SIGMA-X-MEMBRANE', axis: 'x', field: 'exactKnot',
      }),
      exact('FX-Y-EXACT', 'INTERPOLATION_AXIS', true, {
        responseId: 'FX-SIGMA-X-MEMBRANE', axis: 'y', field: 'exactKnot',
      }),
      numeric('FX-COEFFICIENT', 'CONTRIBUTION', 1, TOL, {
        responseId: 'FX-SIGMA-X-MEMBRANE', field: 'coefficient',
      }),
      numeric('MY-COEFFICIENT', 'CONTRIBUTION', 2, TOL, {
        responseId: 'MY-SIGMA-X-BENDING', field: 'coefficient',
      }),
    ],
  };
}

function outsideRatioCase() {
  return {
    caseId: 'OUTSIDE-DIAMETER-RATIO',
    request: syntheticCorrelationRequest({
      requestIdentity: 'SUITE-OUTSIDE-D-RATIO', geometry: { attachmentDiameter: 93 },
    }),
    observations: [
      exact('OUTSIDE-STATE', 'QUALIFICATION_STATE', 'OUTSIDE_DOMAIN'),
      exact('OUTSIDE-DIAGNOSTIC', 'DIAGNOSTIC_CODE', 'OUTSIDE_CORRELATION_DOMAIN'),
    ],
  };
}

function outsideDtCase() {
  return {
    caseId: 'OUTSIDE-DIAMETER-THICKNESS-RATIO',
    request: syntheticCorrelationRequest({
      requestIdentity: 'SUITE-OUTSIDE-DT', geometry: { pipeThickness: 300 / 41 },
    }),
    observations: [
      exact('OUTSIDE-STATE', 'QUALIFICATION_STATE', 'OUTSIDE_DOMAIN'),
      exact('OUTSIDE-DIAGNOSTIC', 'DIAGNOSTIC_CODE', 'OUTSIDE_CORRELATION_DOMAIN'),
    ],
  };
}

function signReversalCase() {
  return {
    caseId: 'SIGN-REVERSAL',
    request: syntheticCorrelationRequest({
      requestIdentity: 'SUITE-SIGN-REVERSAL',
      loads: {
        FX: -90000, FY: -30000, FZ: -60000,
        MX: -1800000, MY: -9000000, MZ: -2700000,
      },
      pressureByTarget: [zeroPressure()],
    }),
    observations: [
      exact('STATE', 'QUALIFICATION_STATE', 'ACCEPTED'),
      numeric('REV-SIGMA-X', 'TARGET_COMPONENT', -85, TOL, {
        targetId: 'CROWN_OUTER', stressComponent: 'SIGMA_X', field: 'totalSurface',
      }),
      numeric('REV-SIGMA-THETA', 'TARGET_COMPONENT', -29, TOL, {
        targetId: 'CROWN_OUTER', stressComponent: 'SIGMA_THETA', field: 'totalSurface',
      }),
      numeric('REV-TAU', 'TARGET_COMPONENT', -2, TOL, {
        targetId: 'CROWN_OUTER', stressComponent: 'TAU_XTHETA', field: 'totalSurface',
      }),
      numeric('REV-VM', 'TARGET_VON_MISES', 74.91995728776145, TOL, {
        targetId: 'CROWN_OUTER',
      }),
    ],
  };
}

function isolatedLoadCases() {
  const definitions = {
    FX: { load: 90000, stressComponent: 'SIGMA_X', expected: 45 },
    FY: { load: 30000, stressComponent: 'SIGMA_THETA', expected: 20 },
    FZ: { load: 60000, stressComponent: 'SIGMA_X', expected: -10 },
    MX: { load: 1800000, stressComponent: 'TAU_XTHETA', expected: 2 },
    MY: { load: 9000000, stressComponent: 'SIGMA_X', expected: 50 },
    MZ: { load: 2700000, stressComponent: 'SIGMA_THETA', expected: 9 },
  };
  return Object.entries(definitions).map(([component, definition]) => ({
    caseId: `ISOLATED-${component}`,
    request: syntheticCorrelationRequest({
      requestIdentity: `SUITE-ISOLATED-${component}`,
      loads: { FX: 0, FY: 0, FZ: 0, MX: 0, MY: 0, MZ: 0, [component]: definition.load },
      pressureByTarget: [zeroPressure()],
    }),
    observations: [
      exact('STATE', 'QUALIFICATION_STATE', 'ACCEPTED'),
      numeric(`${component}-TARGET`, 'TARGET_COMPONENT', definition.expected, TOL, {
        targetId: 'CROWN_OUTER',
        stressComponent: definition.stressComponent,
        field: 'totalSurface',
      }),
    ],
  }));
}

function numeric(observationId, type, expected, tolerance, selector) {
  return { observationId, type, expected, tolerance, ...selector };
}
function exact(observationId, type, expected, selector = {}) {
  return { observationId, type, expected, tolerance: null, ...selector };
}
function zeroPressure() {
  return { targetId: 'CROWN_OUTER', SIGMA_X: 0, SIGMA_THETA: 0, SIGMA_R: 0, TAU_XTHETA: 0 };
}
function observation(caseResult, observationId) {
  const rows = caseResult.observations.filter((row) => row.observationId === observationId);
  assert.equal(rows.length, 1, `Expected observation ${observationId}.`);
  return rows[0];
}
function close(actual, expected, label) {
  assert.ok(Number.isFinite(actual), `${label} must be finite.`);
  assert.ok(Math.abs(actual - expected) <= TOL,
    `${label}: expected ${expected}, received ${actual}.`);
}
