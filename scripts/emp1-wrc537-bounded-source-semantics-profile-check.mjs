#!/usr/bin/env node
/**
 * #1765 / WRC-02 current bounded source-semantics integration check.
 *
 * The nine legacy source-research records remain immutable. This checker proves
 * the current integration distinction:
 *
 *   WRC method semantics        = source-closed for bounded gamma=5 route
 *   physical case applicability = requires governed case evidence
 *
 * It does not authorize a case, alter WRC numerics, or create code/release authority.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  emp1Wrc537PlaneStressIntensity,
} from '../src/core/emp1/emp1-wrc537-cylindrical-table5.js';
import {
  EMP1_WRC537_CYLINDRICAL_AXIS_AUTHORITY_ID,
  EMP1_WRC537_CYLINDRICAL_AXIS_SOURCE_SHA256,
} from '../src/core/emp1/emp1-wrc537-cylindrical-axis-authority.js';
import {
  EMP1_WRC537_TABLE5_EIGHT_POINT_LONGITUDINAL_AUTHORITY,
} from '../src/core/emp1/emp1-wrc537-longitudinal-moment-curve-selection.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const profile = await readJson(
  'validation/emp1/wrc537-2013/bounded-source-semantics-v1.json',
);
const gate = await readJson(
  'validation/emp1/release/emp1-wrc537-gamma5-current-source-semantics-gate-v1.json',
);
const legacy = await readJson(
  'validation/emp1/release/emp1-wrc537-gamma5-p0-source-semantics-gate-v1.json',
);
const retained = await readText('docs/emp1/WRC537_2013_Tables_and_Charts.md');

assert.equal(profile.schema, 'emp1-wrc537-bounded-source-semantics/v1');
assert.equal(profile.issue, 1765);
assert.equal(profile.parentIssue, 1760);
assert.equal(
  profile.status,
  'PASS_BOUNDED_METHOD_SOURCE_SEMANTICS_WITH_EXTERNAL_CASE_PREREQUISITES',
);
assert.equal(profile.semanticHash, semanticHash(profile));
assert.equal(profile.sourceDocument.rawSha256, EMP1_WRC537_CYLINDRICAL_AXIS_SOURCE_SHA256);
assert.equal(profile.sourceDocument.directPinnedPdfPageReobservation,
  'NOT_RUN_EXECUTION_ENVIRONMENT_BINARY_TRANSPORT');
assert.equal(profile.sourceDocument.externalRenderingMayEstablishPinnedPdfByteAuthority, false);
assert.equal(profile.authorityModel.methodSourceSemanticsReady, true);
assert.equal(profile.authorityModel.caseApplicabilityRequiresEvidence, true);
assert.equal(profile.authorityModel.productionObservationUsedToSetSourceSemantics, false);
assert.equal(profile.authorityModel.codeComplianceAuthorized, false);
assert.equal(profile.authorityModel.globalEmp1CAuthority, false);
assert.equal(profile.authorityModel.releaseAuthorityGranted, false);
assert.deepEqual(profile.unresolvedPrimaryMethodSemantics, []);

// Historical aggregate is preserved exactly as history, not rewritten to look green.
assert.equal(legacy.state, 'BLOCKED_P0_SOURCE_SEMANTICS');
assert.equal(legacy.blockerCount, 9);
assert.equal(profile.historicalAggregate.path,
  'validation/emp1/release/emp1-wrc537-gamma5-p0-source-semantics-gate-v1.json');
assert.equal(profile.historicalAggregate.state, legacy.state);
assert.equal(profile.historicalAggregate.blockerCount, legacy.blockerCount);
assert.equal(profile.historicalAggregate.rewrittenByThisProfile, false);

// Every inherited source record remains byte-bound and retains its historical status.
assert.equal(profile.sourceBindings.length, 9);
for (const binding of profile.sourceBindings) {
  const bytes = await readBuffer(binding.path);
  const record = JSON.parse(bytes.toString('utf8'));
  assert.equal(gitBlobSha(bytes), binding.gitBlobSha1, `source binding blob drift: ${binding.path}`);
  assert.equal(record.status, binding.retainedStatus, `source binding status drift: ${binding.path}`);
}

// Bounded route identity only; no scope widening.
assert.deepEqual(profile.boundedScope, {
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
  locations: ['Au','Al','Bu','Bl','Cu','Cl','Du','Dl'],
  hostShellOnly: true,
  longitudinalMomentRoute: 'AXIS_OF_SYMMETRY_1B_2B_ONLY',
  continuousSearch: false,
  globalMaximumAssured: false,
});

// Table 4 retained primary transcription closes surface and axis-pair meaning.
assert.match(retained, /### Table 4 .*Sign Convention for Stresses Resulting from Radial and Moment Load on a Cylindrical Shell/u);
assert.match(retained, /u.*denotes upper \(outer\) surface/u);
assert.match(retained, /L.*denotes lower \(inner\) surface/u);
assert.match(retained, /Points A, B lie along the longitudinal axis/u);
assert.match(retained, /Points C, D lie along circumferential\/transverse axis/u);
assert.deepEqual(profile.recoveryBasis.surfaces, {
  u: 'UPPER_OUTER_SHELL_SURFACE',
  l: 'LOWER_INNER_SHELL_SURFACE',
});
assert.deepEqual(profile.recoveryBasis.locationPairs, {
  AB: 'LONGITUDINAL_AXIS_PAIR_THETA_0_180',
  CD: 'CIRCUMFERENTIAL_TRANSVERSE_AXIS_PAIR_THETA_90_270',
});
assert.equal(profile.recoveryBasis.individualGlobalAngleRelabelingPerformed, false);

// Table 5 keeps all load-family contributions in the same source-labeled columns,
// directs algebraic summation, then computes combined S.
assert.match(retained, /### Table 5 .*Computation Sheet for Local Stresses in Cylindrical Shells/u);
for (const location of ['A u','A L','B u','B L','C u','C L','D u','D L']) {
  assert.ok(retained.includes(location), `missing Table-5 source location: ${location}`);
}
assert.match(retained, /Add algebraically for summation of[^\n]*stresses/u);
assert.match(retained, /Add algebraically for summation of shear stresses/u);
assert.match(retained, /COMBINED STRESS INTENSITY/u);
assert.match(retained, /When[^\n]*have like signs/u);
assert.match(retained, /When[^\n]*have unlike signs/u);
assert.match(retained, /When[^\n]*=\s*0/u);

// Existing source-qualified load axis and longitudinal eight-point authority are
// consumed, not redefined by the integration profile.
assert.equal(profile.loadBasis.authorityId, EMP1_WRC537_CYLINDRICAL_AXIS_AUTHORITY_ID);
assert.equal(profile.loadBasis.sourceSha256, EMP1_WRC537_CYLINDRICAL_AXIS_SOURCE_SHA256);
assert.deepEqual(profile.loadBasis.positiveDirections, {
  P: 'SOURCE_REFERENCE_TOWARD_ATTACHMENT_TARGET',
  Vl: 'POSITIVE_VESSEL_LONGITUDINAL',
  Vc: 'VL_CROSS_P',
  Mc: 'NEGATIVE_VESSEL_LONGITUDINAL_RIGHT_HAND_VECTOR',
  Ml: 'SAME_VECTOR_AS_VC',
  Mt: 'OPPOSITE_P_RIGHT_HAND_VECTOR',
});
assert.deepEqual(
  EMP1_WRC537_TABLE5_EIGHT_POINT_LONGITUDINAL_AUTHORITY.recoveryDomain.locations,
  profile.recoveryBasis.sourceLabeledLocations,
);
assert.equal(
  EMP1_WRC537_TABLE5_EIGHT_POINT_LONGITUDINAL_AUTHORITY.selection.circumferentialFigure,
  '1B',
);
assert.equal(
  EMP1_WRC537_TABLE5_EIGHT_POINT_LONGITUDINAL_AUTHORITY.selection.longitudinalFigure,
  '2B',
);
assert.equal(profile.recoveryBasis.longitudinalMoment.offAxisMaximumAuthorized, false);
assert.equal(profile.recoveryBasis.eightPointEnvelopeIsGlobalMaximum, false);

// Critical source-mapping proof: production's principal-difference implementation
// must be algebraically equivalent to the WRC Table-5 combined-S formula itself.
// This does NOT claim WRC separately states sigma3=0.
const probes = [];
for (const sigmaPhi of [-125, -40, 0, 35, 110]) {
  for (const sigmaX of [-95, -15, 0, 60, 140]) {
    for (const tau of [0, 7, 30]) {
      const expected = table5CombinedStressIntensity(sigmaPhi, sigmaX, tau);
      const actual = emp1Wrc537PlaneStressIntensity(sigmaPhi, sigmaX, tau);
      const tolerance = Math.max(1e-12, Math.max(1, Math.abs(expected)) * 1e-12);
      assert.ok(Math.abs(actual - expected) <= tolerance,
        `Table-5 S equivalence: phi=${sigmaPhi} x=${sigmaX} tau=${tau}: ${actual} != ${expected}`);
      probes.push({ sigmaPhi, sigmaX, tau, expected, actual });
    }
  }
}
assert.equal(probes.length, 75);
assert.equal(profile.stressIntensityBasis.productionEquivalenceMustBeProvedByChecker, true);
assert.equal(profile.stressIntensityBasis.separateWrcSigma3ZeroStatementRequiredForEquivalence, false);
assert.equal(profile.stressIntensityBasis.wrcExplicitSigma3ZeroClaimMade, false);
assert.equal(profile.stressIntensityBasis.vonMisesAuthorized, false);

// Material/theory source statements are bounded. Input silence is not promoted
// to universal material independence; unsupported case behavior fails closed.
assert.equal(
  profile.materialTheoryBasis.sourceQualifiedStatements.cylindricalFlexibleLoadingSurfaceAssumption,
  true,
);
assert.equal(
  profile.materialTheoryBasis.sourceQualifiedStatements.largeDeflectionAndOtherNonlinearEffectsIdentifiedAsLaterExtensionWork,
  true,
);
for (const value of Object.values(profile.materialTheoryBasis.claimsNotMade)) {
  assert.equal(value, false);
}
assert.equal(profile.materialTheoryBasis.unqualifiedBehaviorPolicy,
  'FAIL_CLOSED_UNLESS_SEPARATELY_SOURCE_QUALIFIED');

// The old mixed blockers become explicit case prerequisites where appropriate.
const expectedPrerequisites = [
  'SAME_STATE_ASSESSMENT_GEOMETRY',
  'STANDARD_ROUND_ATTACHMENT_CLASS',
  'PHYSICAL_ATTACHMENT_AXIS_COINCIDENCE',
  'ISOLATION_OR_NONINTERACTION_EVIDENCE',
  'ORIGINAL_CYLINDRICAL_THEORY_APPLICABILITY_EVIDENCE',
];
assert.deepEqual(
  profile.externalCasePrerequisites.map((row) => row.id),
  expectedPrerequisites,
);
assert.equal(profile.geometryBasis.T.assessmentStateSelectedByWrc, false);
assert.equal(profile.geometryBasis.attachmentAxis.obliqueAuthorized, false);
assert.equal(profile.geometryBasis.isolation.quantitativeNeighborSpacingRuleAvailable, false);
assert.equal(profile.geometryBasis.isolation.inventedSpacingThresholdAllowed, false);
assert.equal(profile.geometryBasis.attachmentClass.nonstandardRoundSurrogatesAuthorized, false);

// Result/code boundary remains strictly non-authorizing.
assert.equal(profile.resultScope.hostCylindricalShellLocalStressAtAttachmentShellJuncture, true);
assert.equal(profile.resultScope.attachmentWallStressAuthorized, false);
assert.equal(profile.resultScope.nozzleWallStressAuthorized, false);
assert.equal(profile.resultScope.weldStressAuthorized, false);
assert.equal(profile.resultScope.WRC297Authority, false);
assert.equal(profile.resultScope.continuousOrGlobalMaximumClaim, false);
assert.deepEqual(profile.codeBoundary, {
  wrcStressCalculationSeparateFromCodeClassification: true,
  codeStressClassificationAuthorized: false,
  allowableComparisonAuthorized: false,
  codeAssessmentPerformed: false,
  codeCompliance: 'NOT_ASSESSED',
});

// Current integration gate points only to this profile and creates no case,
// production, global, code or release authority.
assert.equal(gate.schema, 'emp1-wrc537-gamma5-current-source-semantics-gate/v1');
assert.equal(gate.semanticHash, semanticHash(gate));
assert.equal(gate.state,
  'PASS_BOUNDED_METHOD_SOURCE_SEMANTICS_CASE_PREREQUISITES_DECLARED');
assert.equal(gate.profile.semanticHash, profile.semanticHash);
assert.equal(gate.profile.methodSourceSemanticsReady, true);
assert.equal(gate.profile.unresolvedPrimaryMethodSemanticCount, 0);
assert.equal(gate.caseApplicability.state, 'REQUIRES_CASE_SPECIFIC_EVIDENCE');
assert.deepEqual(gate.caseApplicability.prerequisiteIds, expectedPrerequisites);
assert.equal(gate.caseApplicability.absenceOfPrerequisiteEvidenceMayBeTreatedAsPass, false);
assert.equal(gate.legacyAggregate.state, legacy.state);
assert.equal(gate.legacyAggregate.blockerCount, legacy.blockerCount);
assert.equal(gate.legacyAggregate.rewritten, false);
assert.equal(gate.authority.boundedMethodSourceSemanticsReady, true);
assert.equal(gate.authority.caseEngineeringUseAuthorizedByThisGate, false);
assert.equal(gate.authority.productionAuthorityChanged, false);
assert.equal(gate.authority.globalEmp1CAuthority, false);
assert.equal(gate.authority.codeComplianceAuthorized, false);
assert.equal(gate.authority.releaseAuthorityGranted, false);

// Recomputed-hash semantic falsifiers: an attacker cannot alter meaning and
// simply recalculate the hash.
for (const [name, mutate] of [
  ['source-hash', (p) => { p.sourceDocument.rawSha256 = '0'.repeat(64); }],
  ['surface-swap', (p) => { p.recoveryBasis.surfaces.u = 'LOWER_INNER_SHELL_SURFACE'; }],
  ['off-axis-authority', (p) => { p.recoveryBasis.longitudinalMoment.offAxisMaximumAuthorized = true; }],
  ['global-maximum', (p) => { p.resultScope.continuousOrGlobalMaximumClaim = true; }],
  ['universal-material', (p) => { p.materialTheoryBasis.claimsNotMade.universalMaterialApplicability = true; }],
  ['oblique', (p) => { p.geometryBasis.attachmentAxis.obliqueAuthorized = true; }],
  ['invent-spacing', (p) => { p.geometryBasis.isolation.inventedSpacingThresholdAllowed = true; }],
  ['code-compliance', (p) => { p.codeBoundary.codeCompliance = 'PASS'; }],
  ['drop-prerequisite', (p) => { p.externalCasePrerequisites.pop(); }],
  ['invent-sigma3-source-claim', (p) => { p.stressIntensityBasis.wrcExplicitSigma3ZeroClaimMade = true; }],
]) {
  const spoof = structuredClone(profile);
  mutate(spoof);
  spoof.semanticHash = semanticHash(spoof);
  assert.throws(() => validateProtectedSemantics(spoof), undefined, name);
}

console.log(JSON.stringify({
  schema: 'emp1-wrc537-bounded-source-semantics-profile-check/v1',
  status: 'PASS_WRC02_BOUNDED_METHOD_SOURCE_SEMANTICS_WITH_CASE_PREREQUISITES',
  profileSemanticHash: profile.semanticHash,
  legacyAggregatePreserved: true,
  legacyBlockedRowsRetained: legacy.blockerCount,
  unresolvedPrimaryMethodSemantics: profile.unresolvedPrimaryMethodSemantics.length,
  externalCasePrerequisites: expectedPrerequisites,
  recoverySourceBasis: 'RETAINED_WRC_TABLE4_TABLE5',
  stressIntensitySourceEquivalenceProbes: probes.length,
  caseEngineeringUseAuthorizedByThisGate: false,
  codeComplianceAuthorized: false,
  releaseAuthorityGranted: false,
}, null, 2));

function validateProtectedSemantics(p) {
  assert.equal(p.sourceDocument.rawSha256, EMP1_WRC537_CYLINDRICAL_AXIS_SOURCE_SHA256);
  assert.deepEqual(p.recoveryBasis.surfaces, {
    u: 'UPPER_OUTER_SHELL_SURFACE',
    l: 'LOWER_INNER_SHELL_SURFACE',
  });
  assert.equal(p.recoveryBasis.longitudinalMoment.offAxisMaximumAuthorized, false);
  assert.equal(p.resultScope.continuousOrGlobalMaximumClaim, false);
  assert.equal(p.materialTheoryBasis.claimsNotMade.universalMaterialApplicability, false);
  assert.equal(p.geometryBasis.attachmentAxis.obliqueAuthorized, false);
  assert.equal(p.geometryBasis.isolation.inventedSpacingThresholdAllowed, false);
  assert.equal(p.codeBoundary.codeCompliance, 'NOT_ASSESSED');
  assert.deepEqual(p.externalCasePrerequisites.map((row) => row.id), expectedPrerequisites);
  assert.equal(p.stressIntensityBasis.wrcExplicitSigma3ZeroClaimMade, false);
  assert.equal(p.semanticHash, semanticHash(p));
}

function table5CombinedStressIntensity(sigmaPhi, sigmaX, tau) {
  const d = Math.sqrt((sigmaPhi - sigmaX) ** 2 + 4 * tau ** 2);
  const root1 = 0.5 * (sigmaPhi + sigmaX + d);
  const root2 = 0.5 * (sigmaPhi + sigmaX - d);
  // Direct algebraic rendering of Table 5's listed candidate magnitudes.
  // For unlike-sign normal stresses d is governing; for the other listed
  // cases the maximum of the two roots and d is the same source formula.
  return Math.max(Math.abs(root1), Math.abs(root2), Math.abs(d));
}
async function readBuffer(path) { return readFile(resolve(root, path)); }
async function readText(path) { return readFile(resolve(root, path), 'utf8'); }
async function readJson(path) { return JSON.parse(await readText(path)); }
function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.byteLength}\0`, 'utf8');
  return createHash('sha1').update(header).update(buffer).digest('hex');
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
