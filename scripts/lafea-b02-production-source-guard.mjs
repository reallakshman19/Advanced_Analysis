#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runActions = read('src/workspace/lafea-workbench-domain-first-run-actions.js');
const authoritativeRun = read('src/workspace/lafea-continuum-authoritative-workbench-run.js');
const liveViewport = read('src/workspace/lafea-live-workbench-viewport.js');
const displayCache = read('src/workspace/lafea-continuum-bc-load-glyph-display-cache.js');
const verification = read('src/workspace/lafea-verification-release-view.js');
const mesherBinding = read('src/workspace/lafea-mesh-producer-binding.js');
const analyticalTraction = read('src/workspace/lafea-analytical-traction-lowering.js');
const rectangleRoute = read('scripts/lib/lafea-b02-production-route.mjs');
const kirschRoute = read('scripts/lib/lafea-b02-kirsch-production-route.mjs');
const b02dRoute = read('scripts/lib/lafea-b02d-production-route.mjs');
const sequence = read('scripts/lafea-b02-production-sequence-check.mjs');

assert.match(runActions, /transactions\.begin\(stageId, preflight\)/u);
assert.match(runActions, /createLafeaRunningExecution\(transaction\)/u);
assert.match(runActions, /transactions\.assertCurrent/u);
assert.match(runActions, /transactions\.complete/u);
assert.match(runActions, /retainLafeaBcLoadGlyphDisplayProjection\(bcLoadGlyphProjection\)/u);
assert.match(authoritativeRun, /canonicalExecutionInputHash: evidence\.canonicalExecutionInputHash/u);

assert.match(displayCache, /executionHash/u);
assert.match(displayCache, /canonicalExecutionInputHash/u);
assert.match(liveViewport, /selectLafeaBcLoadGlyphDisplayProjection\(executionHash\)/u);
assert.match(liveViewport, /LAFEA_LIVE_VIEWPORT_BC_LOAD_GLYPH_EXECUTION_MISMATCH/u);
assert.match(liveViewport, /input\.renderPacket\?\.lineage\?\.executionHash/u);

assert.match(verification, /B02_EXACT_HEAD_PRODUCTION_QUALIFICATION_NOT_RETAINED_IN_SESSION/u);
assert.match(verification, /Exact-head CI evidence is never inferred from an interactive solve/u);
assert.match(verification, /RELEASE_AUTHORITY_NOT_GRANTED/u);
assert.equal(/override.{0,30}release|grant.{0,30}release/iu.test(verification), false,
  'Verification UI must not expose an interactive release-authority override.');

assert.match(mesherBinding, /refinementFeatureIds: Object\.freeze\(\[\]\)/u);
assert.match(mesherBinding, /profile\?\.profileIdentity === b02dProfileIdentity/u);
assert.match(mesherBinding, /LAFEA_B02D_POLAR_REFINEMENT_FEATURES_MUST_REMAIN_EMPTY/u);
assert.match(mesherBinding, /LAFEA_B02D_POLAR_GEOMETRY_NOT_QUALIFIED/u);

assert.match(analyticalTraction, /KIRSCH_INFINITE_PLATE_OUTER_BOUNDARY_V1/u);
assert.match(analyticalTraction, /GAUSS_LEGENDRE_12_EDGE_V1/u);
assert.match(analyticalTraction, /LAFEA_ANALYTICAL_TRACTION_LAW_INVALID/u);
assert.equal(/eval\(|new Function/u.test(analyticalTraction), false,
  'Analytical traction laws must remain whitelisted serializable laws, not executable expressions.');

for (const [label, route] of [
  ['B02A/B', rectangleRoute],
  ['B02C', kirschRoute],
  ['B02D', b02dRoute],
]) {
  assert.match(route, /schema: PHYSICAL_PROBE_SCHEMA/u, `${label} strict probe schema missing`);
  assert.match(route, /singularityClassification: probe\.singularityClassification/u,
    `${label} singularity classification not retained`);
  assert.equal(/evaluateContinuumPhysicalProbe\(stage,\s*probe\)/u.test(route), false,
    `${label} must not pass frozen definition rows directly into G4 recovery.`);
}
assert.equal(/expectedValue\s*:/u.test(rectangleRoute), false,
  'Expected benchmark values must remain outside the rectangle production recovery adapter.');
assert.equal(/analyticalReferenceValue\s*:/u.test(kirschRoute), false,
  'Kirsch analytical reference values must remain outside production recovery identity.');

const ordered = ['B02A', 'B02B', 'B02C', 'B02D'];
let previous = -1;
for (const id of ordered) {
  const index = sequence.indexOf(`['${id}',`);
  assert.ok(index > previous, `${id} must remain in ordered production sequence`);
  previous = index;
}
assert.match(sequence, /b02Qualified: true/u);
assert.match(sequence, /releaseAuthorityGranted: false/u);
assert.match(sequence, /temperatureAuthorityGranted: false/u);

console.log(JSON.stringify({
  schema: 'lafea-b02-production-source-guard/v1',
  status: 'PASS',
  immutableRunTransactionGuarded: true,
  canonicalExecutionInputGuarded: true,
  exactExecutionGlyphBindingGuarded: true,
  verificationReleaseFailClosedGuarded: true,
  frozenB02dEmptyRefinementFeaturesGuarded: true,
  analyticalTractionWhitelistGuarded: true,
  analyticalTractionQuadrature: 'GAUSS_LEGENDRE_12_EDGE_V1',
  oracleRecoveryIdentitySeparationGuarded: true,
  orderedProductionSequenceGuarded: true,
  releaseAuthorityGranted: false,
}));

function read(path) { return fs.readFileSync(path, 'utf8'); }
