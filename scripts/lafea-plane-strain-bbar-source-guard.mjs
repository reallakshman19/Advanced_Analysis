#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const constants = read('src/core/local-continuum/constants.js');
const normalization = read('src/core/local-continuum/source-normalization.js');
const element = read('src/core/local-continuum/element.js');
const bbar = read('src/core/local-continuum/bbar-plane-strain.js');
const t6 = read('src/core/local-continuum/t6-element.js');
const q8 = read('src/core/local-continuum/q8-element.js');
const recovery = read('src/core/local-continuum/recovery.js');
const g4 = read('src/workspace/lafea-continuum-physical-probe.js');
const domain = read('src/workspace/lafea-continuum-analysis-domain.js');
const compiledInput = read('src/workspace/lafea-continuum-compiled-input.js');
const temperature = read('src/core/local-continuum/temperature-strain-loads.js');
const settings = read('src/workspace/lafea-analysis-settings-view.js');
const overview = read('src/workspace/lafea-engineering-overview.js');
const workbenchContent = read('src/workspace/lafea-workbench-content.js');
const freezeCheck = read('scripts/lafea-plane-strain-bbar-freeze-check.mjs');
const kernelCheck = read('scripts/lafea-plane-strain-bbar-kernel-check.mjs');
const lameFixture = read('scripts/lib/lafea-plane-strain-bbar-lame-fixture.mjs');
const lameCheck = read('scripts/lafea-plane-strain-bbar-lame-check.mjs');
const probeMeshPolicy = JSON.parse(read(
  'validation/lafea-incompressible/plane-strain-bbar-probe-mesh-policy-v1.json',
));

// Existing displacement-only authority remains byte-semantically distinct.
assert.match(constants, /planeStrainPoissonWarning:\s*0\.40/u);
assert.match(constants, /planeStrainPoissonBlock:\s*0\.45/u);
assert.match(constants, /PLANE_STRAIN_BBAR:\s*'PLANE_STRAIN_BBAR'/u);
assert.match(normalization, /formulation !== FORMULATIONS\.PLANE_STRAIN\) return/u);
assert.match(normalization, /PLANE_STRAIN_NEAR_INCOMPRESSIBLE_NOT_QUALIFIED/u);
assert.match(normalization, /PLANE_STRAIN_BBAR_TEMPERATURE_NOT_QUALIFIED/u);
assert.equal(/planeStrainPoissonBlock\s*[:=]\s*(0\.[4-9][6-9]|[1-9])/u.test(constants), false,
  'Legacy plane-strain hard block must not be weakened above 0.45.');

// Placeholder source connectivity may be T3, but actual B-bar solver elements may not.
assert.equal(/validateFormulationElementAuthority/u.test(normalization), false,
  'Source normalization must not confuse domain-first placeholder connectivity with solver mesh authority.');
assert.match(element, /PLANE_STRAIN_BBAR_T3_NOT_QUALIFIED/u);
assert.match(element, /isBbarPlaneStrain\(model\.formulation\)/u);
assert.match(kernelCheck, /bbarT3ExecutionBlockedBeforeStiffnessAssembly:\s*true/u);

// B-bar mechanics must be mean-dilatation, not tolerance or reduced-integration substitution.
assert.match(bbar, /Bv_bar|meanVolumetricRow/u);
assert.match(bbar, /bulkModulus/u);
assert.match(bbar, /bbarStiffnessMatrix/u);
assert.match(bbar, /recoverBbarPlaneStrainStress/u);
assert.match(bbar, /bbarElementElasticEnergy/u);
assert.equal(/solverTolerance|choleskyPivot|pcgTolerance/u.test(bbar), false,
  'B-bar mechanics must not alter solver tolerances.');

for (const elementSource of [t6, q8]) {
  assert.match(elementSource, /isBbarPlaneStrain\(formulation\)/u);
  assert.match(elementSource, /bbarStiffnessMatrix/u);
  assert.match(elementSource, /bbarEvidence/u);
  assert.match(elementSource, /meanVolumetricRow/u);
}

// Recovery and fixed probes must consume the exact retained mean row used by stiffness.
assert.match(recovery, /element\.bbarEvidence\.meanVolumetricRow/u);
assert.match(recovery, /recoverBbarPlaneStrainStress/u);
assert.match(recovery, /MEAN_DILATATION_BBAR_PHYSICAL_ELASTIC_STRAIN_ENERGY/u);
assert.match(g4, /elementEvidence\.bbarEvidence\.meanVolumetricRow/u);
assert.match(g4, /recoverBbarPlaneStrainStress/u);
assert.match(g4, /LAFEA_G4_PROBE_BBAR_EVIDENCE_MISSING/u);

// Domain-first can carry the identity and compiled input must preserve it verbatim.
assert.match(domain, /FORMULATIONS\.PLANE_STRAIN_BBAR/u);
assert.match(compiledInput, /formulation:\s*model\.formulation/u);

// Thermal assembler still exists for standard formulations, but B-bar is source-blocked.
assert.match(temperature, /thermalEquivalentNodalForces/u);
assert.match(normalization, /validateFormulationLoadAuthority/u);

// Governed UI must edit source through the normal replacement transaction, never runtime state.
assert.match(settings, /Plane strain — standard displacement/u);
assert.match(settings, /Plane strain — B-bar \(locking resistant\)/u);
assert.match(settings, /next\.formulation = select\.value/u);
assert.match(settings, /handlers\.onApplyJson/u);
assert.match(settings, /MESH_REGENERATION_REQUIRED/u);
assert.match(settings, /EXACT_HEAD_QUALIFICATION_REQUIRED/u);
assert.match(settings, /B-bar temperature\/eigenstrain loading is not qualified/u);
assert.equal(
  /stage\.(?:execution|retainedAnalysisMesh(?:EvidenceV2|Evidence)?)\s*=/u.test(settings),
  false,
  'Formulation selector must not mutate solver/runtime custody directly.',
);
assert.match(workbenchContent, /renderLafeaAnalysisSettings\([\s\S]*options\.registryEntry,[\s\S]*options\.handlers/u);

// Overview must never manufacture a B-bar PASS from interactive state.
assert.match(overview, /FORMULATIONS\.PLANE_STRAIN_BBAR/u);
assert.match(overview, /EXACT_HEAD_QUALIFICATION_REQUIRED/u);
assert.match(overview, /EXTERNAL EXACT-HEAD 120-SOLVE EVIDENCE REQUIRED/u);
assert.match(overview, /Temperature \/ eigenstrain authority', 'NOT GRANTED/u);
assert.equal(/PLANE_STRAIN_BBAR[\s\S]{0,1000}status:\s*'QUALIFIED'/u.test(overview), false,
  'B-bar overview must not promote interactive state to qualification PASS.');

// Fixed physical probes must remain strictly inside a single polar cell and
// away from the deterministic T6 cell diagonal. These phases were frozen from
// geometry before any production solve was observed.
assert.equal(probeMeshPolicy.definitionState, 'FROZEN_BEFORE_PRODUCTION_OBSERVATION');
assert.equal(probeMeshPolicy.productionOutputUsedToChooseDefinition, false);
assert.equal(probeMeshPolicy.radialAxis.targetPhase, 0.5);
assert.equal(probeMeshPolicy.angularAxis.targetPhase, 0.35);
assert.equal(probeMeshPolicy.t6DiagonalAvoidance.minimumPhaseSeparation, 0.15);
assert.equal(probeMeshPolicy.t6DiagonalAvoidance.mappingAmbiguityAllowed, false);
assert.ok(
  Math.abs(probeMeshPolicy.radialAxis.targetPhase - probeMeshPolicy.angularAxis.targetPhase)
    >= probeMeshPolicy.t6DiagonalAvoidance.minimumPhaseSeparation,
);
assert.match(lameFixture, /probeCellEvidence/u);
assert.match(lameFixture, /protectedAxis\([\s\S]*targetPhase/u);
assert.match(lameFixture, /diagonalPhaseSeparation/u);
assert.match(lameFixture, /elementBoundaryPlacement:\s*false/u);
assert.match(lameFixture, /t6DiagonalPlacement:\s*false/u);
assert.match(lameCheck, /plane-strain-bbar-probe-mesh-policy-v1\.json/u);
assert.match(lameCheck, /probeMeshPolicyHash/u);
assert.match(lameCheck, /protectedProbePhases/u);
assert.match(lameCheck, /probeCellEvidence/u);

// Definitions/oracles must remain frozen and production observations separate.
assert.match(freezeCheck, /FROZEN_BEFORE_PRODUCTION_OBSERVATION/u);
assert.match(freezeCheck, /productionOutputUsedToChooseDefinition/u);
assert.match(kernelCheck, /legacyPlaneStrainNu045StillBlocked:\s*true/u);
assert.match(kernelCheck, /bbarT3ProductionAuthorityGranted:\s*false/u);
assert.match(kernelCheck, /bbarTemperatureAuthorityGranted:\s*false/u);
assert.match(lameCheck, /movingMaximumUsed:\s*false/u);
assert.match(lameCheck, /nodalOrSmoothedStressUsedAsAcceptanceAuthority:\s*false/u);
assert.match(lameCheck, /releaseAuthorityGranted:\s*false/u);

console.log(JSON.stringify({
  schema: 'lafea-plane-strain-bbar-source-guard/v1',
  status: 'PASS',
  legacyPlaneStrainGuardPreserved: true,
  explicitBbarIdentityRequired: true,
  placeholderT3SourceAllowedWithoutSolverAuthority: true,
  t3BbarAuthorityGranted: false,
  t3BbarBlockedAtElementExecution: true,
  bbarTemperatureAuthorityGranted: false,
  retainedMeanDilatationRecoveryGuarded: true,
  domainFirstFormulationPropagationGuarded: true,
  governedSourceSelectorGuarded: true,
  protectedProbeMeshPolicyGuarded: true,
  protectedProbePhases: {
    radial: probeMeshPolicy.radialAxis.targetPhase,
    angular: probeMeshPolicy.angularAxis.targetPhase,
    minimumDiagonalSeparation: probeMeshPolicy.t6DiagonalAvoidance.minimumPhaseSeparation,
  },
  interactiveQualificationPromotionAllowed: false,
  solverToleranceRelaxationDetected: false,
  movingMaximumAcceptanceAllowed: false,
  releaseAuthorityGranted: false,
}));

function read(file) { return fs.readFileSync(file, 'utf8'); }
