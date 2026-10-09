#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLafeaMeshGenerationIntentV2 } from '../src/workspace/lafea-domain-first-requests.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'validation/lafea-b02-definitions');
const manifest = read('frozen-definition-manifest.json');
const matrix = JSON.parse(fs.readFileSync(path.join(ROOT, manifest.methodApplicabilitySource), 'utf8'));
const definitions = Object.fromEntries(Object.entries(manifest.definitionFiles).map(([id, relative]) => [id, JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'))]));

assert.equal(manifest.adoptedG4ParentExactHead, 'c3fb24b5fc354763e5fd8f86161da14ac228e80b');
assert.equal(manifest.g4ParentGate, 'PASS');
assert.equal(manifest.frozenBeforeAnyB02ProductionObservation, true);
assert.equal(manifest.productionOutputUsedToGenerateTargetsTolerancesProbesOrMeshes, false);
assert.equal(manifest.authority.b02Qualified, false);
assert.equal(manifest.authority.releaseAuthorityGranted, false);
assert.equal(manifest.authority.temperatureAuthorityGranted, false);
const parentCustodyMode = verifyAdoptedParentCustody();

const matrixById = new Map(matrix.matrix.map((row) => [row.benchmarkId, row]));
for (const [id, definition] of Object.entries(definitions)) {
  assert.equal(definition.schema, 'lafea-b02-frozen-benchmark-definition/v1');
  assert.equal(definition.caseId, id);
  assert.equal(definition.stageId, 'LAFEA.3');
  assert.equal(definition.definitionState, 'FROZEN_BEFORE_PRODUCTION_OBSERVATION');
  assert.equal(definition.productionOutputUsedToChooseDefinition, false);
  assert.equal(definition.authority.benchmarkQualified, false);
  assert.equal(definition.authority.releaseAuthorityGranted, false);
  assert.equal(definition.authority.temperatureAuthorityGranted, false);
  assert.ok(matrixById.has(id));
}

assert.deepEqual(definitions.B02A.meshLadder.methods, pickMethods(matrixById.get('B02A')));
assert.deepEqual(definitions.B02B.meshLadder.methods, pickMethods(matrixById.get('B02B')));
assert.deepEqual(definitions.B02C.meshLadder.methods, pickMethods(matrixById.get('B02C')));
assert.deepEqual(definitions.B02D.globalResponseLadder.methods, pickMethods(matrixById.get('B02D')));
assert.deepEqual(definitions.B02E.methods, pickMethods(matrixById.get('B02E')));

for (const id of ['B02A', 'B02B', 'B02C']) validateRegisteredLadder(definitions[id].meshLadder, definitions[id].meshLadder.methods);
validateRegisteredLadder(definitions.B02D.globalResponseLadder, definitions.B02D.globalResponseLadder.methods);
validateRouteExpressibleCantilever(definitions.B02A);
validateRouteExpressibleCantilever(definitions.B02B);
assert.deepEqual(definitions.B02D.globalResponseLadder.levels.map((row) => row.historicalT6ControlElementCount), [64, 256, 1024, 4096]);
assert.deepEqual(definitions.B02D.globalResponseLadder.evaluatedConvergenceLevels, ['L2', 'L3', 'L4']);
assert.equal(definitions.B02D.globalResponseLadder.historicalCountsAreControlsNotProducerGuarantees, true);
assert.deepEqual(definitions.B02C.meshLadder.levels.map((row) => row.historicalT6ControlElementCount), [64, 256, 1024]);
assert.equal(definitions.B02C.meshLadder.historicalCountsAreControlsNotProducerGuarantees, true);
assert.equal(definitions.B02D.fixedProbeMeshPolicy.anchorCellWidthContraction, 'EXACT_FACTOR_TWO_PER_LEVEL');
assert.equal(definitions.B02D.fixedProbeMeshPolicy.minimumParametricDiagonalSeparation, 0.3);

for (const id of ['B02A', 'B02B', 'B02C']) validateProbeSet(definitions[id].fixedProbes);
validateProbeSet(definitions.B02D.fixedProbes);
for (const station of definitions.B02D.fixedPath.stations) {
  assert.ok(['HIGH_GRADIENT_CONVERGENCE', 'NON_SINGULAR_CONVERGENCE'].includes(station.singularityClassification));
}
assert.equal(definitions.B02C.acceptance.finiteDomainErrorMustBeReportedSeparately, true);
assert.equal(definitions.B02C.acceptance.movingMaximumAllowed, false);
assert.equal(definitions.B02D.acceptance.movingMaximumAllowed, false);

const e = definitions.B02E;
assert.equal(e.definitionObservationSeparationRequired, true);
assert.equal(e.minimumUsefulLevels, 3);
assert.equal(e.frozenRules.refinementRatio, 2);
assert.equal(e.frozenRules.gciSafetyFactor, 1.25);
assert.equal(e.frozenRules.fixedPhysicalQuantityIdentityRequired, true);
assert.equal(e.frozenRules.singularPointwisePeaksExcluded, true);
assert.equal(e.frozenRules.movingMaximumForbidden, true);
assert.deepEqual(e.subBucketBindings.B02A.h, definitions.B02A.meshLadder.levels.map((row) => row.h));
assert.deepEqual(e.subBucketBindings.B02B.h, definitions.B02B.meshLadder.levels.map((row) => row.h));
assert.deepEqual(e.subBucketBindings.B02C.h, definitions.B02C.meshLadder.levels.map((row) => row.h));
assert.deepEqual(e.subBucketBindings.B02D.h, definitions.B02D.globalResponseLadder.levels.slice(1).map((row) => row.h));
for (const binding of Object.values(e.subBucketBindings)) {
  assertRatio2(binding.h.map((h, index) => ({ levelId: binding.levelIds[index], h })));
}

assert.equal(definitions.B02B.independentOracle.authority, 'TIMOSHENKO_CANTILEVER_PLUS_JOURAWSKI_RECTANGULAR_SHEAR_ENGINEERING_THEORY');
assert.ok(definitions.B02B.independentOracle.shearEnergyFraction > 0.70);
assert.equal(definitions.B02B.title.toUpperCase().includes('PURE SHEAR PATCH'), false);

for (const definition of Object.values(definitions)) {
  for (const source of definition.independentOracle?.sourceRefs ?? definition.historicalDefinitionSources ?? []) {
    assert.ok(fs.existsSync(path.join(ROOT, source)), `missing frozen source ${source}`);
  }
}

const hashes = Object.fromEntries(Object.entries(manifest.definitionFiles).map(([id, relative]) => {
  const bytes = fs.readFileSync(path.join(ROOT, relative));
  return [id, `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`];
}));
console.log(JSON.stringify({
  schema: 'lafea-b02-definition-freeze-receipt/v1',
  status: 'PASS',
  adoptedG4ParentExactHead: manifest.adoptedG4ParentExactHead,
  parentCustodyMode,
  definitionHashes: hashes,
  methodsMatchGate0Matrix: true,
  registeredMeshIntentContractSatisfied: true,
  routeAttachmentContractSatisfiedForAAndB: true,
  b02bIsGenuinelyNonUniformShear: true,
  historicalResultsPromotedToQualification: false,
  productionOutputUsedToChooseDefinitions: false,
  releaseAuthorityGranted: false,
  temperatureAuthorityGranted: false,
}));

function verifyAdoptedParentCustody() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    if (event.pull_request?.base?.sha) {
      assert.equal(
        event.pull_request.base.sha,
        manifest.adoptedG4ParentExactHead,
        'PR base SHA must equal the adopted green G4/G4.5 exact head',
      );
      return 'GITHUB_PULL_REQUEST_BASE_SHA';
    }
  }
  try {
    execFileSync('git', ['cat-file', '-e', `${manifest.adoptedG4ParentExactHead}^{commit}`], { cwd: ROOT, stdio: 'ignore' });
    execFileSync('git', ['merge-base', '--is-ancestor', manifest.adoptedG4ParentExactHead, 'HEAD'], { cwd: ROOT, stdio: 'ignore' });
    return 'LOCAL_GIT_ANCESTRY';
  } catch {
    assert.equal(manifest.g4ParentGate, 'PASS');
    assert.match(manifest.adoptedG4ParentExactHead, /^[0-9a-f]{40}$/u);
    return 'MANIFEST_BOUND_SHALLOW_NON_PR';
  }
}
function read(name) { return JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8')); }
function pickMethods(row) { return { T3: row.T3, T6: row.T6, Q8: row.Q8 }; }
function assertRatio2(levels) {
  assert.ok(levels.length >= 3);
  for (let i = 1; i < levels.length; i += 1) {
    assert.ok(Math.abs(levels[i - 1].h / levels[i].h - 2) < 1e-12, 'frozen h ratio must equal 2');
  }
}
function validateRegisteredLadder(ladder, methods) {
  assert.equal(ladder.requestSchema, 'REGISTERED_LAFEA_MESH_GENERATION_INTENT_V2');
  assertRatio2(ladder.levels);
  for (const level of ladder.levels) {
    assert.equal(level.h, level.targetElementLength);
    for (const [elementFamily, applicability] of Object.entries(methods)) {
      if (applicability === 'NOT_APPLICABLE') continue;
      const policy = ladder.familyRequestPolicy[elementFamily];
      const common = ladder.commonRequestPolicy;
      const intent = createLafeaMeshGenerationIntentV2({
        schema: 'lafea-mesh-generation-intent/v2',
        stageId: 'LAFEA.3',
        sourceHash: `sha256:${'1'.repeat(64)}`,
        analysisDomainHash: `sha256:${'2'.repeat(64)}`,
        analysisGeometryHash: `sha256:${'3'.repeat(64)}`,
        meshProfileHash: 'freeze-contract-profile',
        targetElementLength: level.targetElementLength,
        lengthUnit: common.lengthUnit,
        elementFamily,
        curvatureToleranceDegrees: level.curvatureToleranceDegrees,
        growthLimit: common.growthLimit,
        maximumNodes: common.maximumNodes,
        maximumElements: common.maximumElements,
        maximumEstimatedDofs: common.maximumEstimatedDofs,
        refinementFeatureIds: common.refinementFeatureIds,
        allowT3Fallback: policy.allowT3Fallback,
        stageAdapterId: 'LAFEA.3:FREEZE_CHECK',
        stageAdapterRevision: 'FREEZE_CHECK',
      });
      assert.equal(intent.status, 'EXECUTABLE_INTENT');
      assert.equal(intent.executionAuthorized, true);
      assert.ok(intent.producerRef);
    }
  }
}
function validateRouteExpressibleCantilever(definition) {
  const rows = definition.loadCase.routeAttachmentSemantics;
  assert.equal(rows.length, 2);
  const restraint = rows.find((row) => row.kind === 'RESTRAINT');
  const traction = rows.find((row) => row.kind === 'TRACTION');
  assert.equal(restraint.targetType, 'EDGE');
  assert.deepEqual(restraint.payload, { ux: true, uy: true });
  assert.equal(traction.targetType, 'EDGE');
  assert.deepEqual(Object.keys(traction.payload).sort(), ['tx', 'ty', 'unit']);
  assert.equal(traction.payload.tx, 0);
  assert.ok(Number.isFinite(traction.payload.ty));
  assert.equal(traction.payload.unit, 'MPa');
}
function validateProbeSet(probes) {
  assert.ok(Array.isArray(probes) && probes.length > 0);
  for (const probe of probes) {
    for (const key of ['probeId', 'physicalCoordinate', 'coordinateFrame', 'loadCaseId', 'quantityId', 'representation', 'recoveryMethod', 'units', 'singularityClassification']) {
      assert.ok(probe[key] !== undefined, `${probe.probeId} missing ${key}`);
    }
    assert.equal(probe.coordinateFrame, 'GLOBAL_XY');
    assert.equal(probe.representation, 'PHYSICAL_POINT_DIRECT');
    assert.ok(Number.isFinite(probe.physicalCoordinate.x) && Number.isFinite(probe.physicalCoordinate.y));
  }
}
