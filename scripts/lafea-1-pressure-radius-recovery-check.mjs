#!/usr/bin/env node
/**
 * LAFEA.1 pressure-radius preflight and its governed recovery.
 *
 * A geometry edit can strand the declared evaluation radii outside the pipe
 * wall. This check holds three properties:
 *
 *   1. the preflight still evaluates after an edit, when the derived assessment
 *      thickness has been stripped by the editable stage projection;
 *   2. the offered recovery targets the current bore and outer surface and is
 *      ordered so the request's ascending re-sort cannot misplace an edit;
 *   3. the recovery is stated as an editable repair rather than Undo alone.
 *
 * Presentation and input-surface only. No solver, tolerance, oracle or route
 * authority is created here.
 */
import assert from 'node:assert/strict';
import {
  LAFEA1_PRESSURE_RADIUS_OUTSIDE_WALL,
  projectLafea1PressureRadiusRefit,
  projectLafea1PressureRadiusValidation,
  requireLafea1PressureRadiusRunAuthorized,
} from '../src/workspace/lafea-1-pressure-radius-validation.js';
import { lafeaStageInputDescriptors } from '../src/workspace/lafea-stage-input-descriptors.js';
import { createEmp1WorkbenchQualificationSample } from '../src/workspace/emp1-workbench-qualification-sample.js';

const sample = createEmp1WorkbenchQualificationSample();

// The radii are a declared editable surface, not a hidden generated field.
const radiusDescriptors = lafeaStageInputDescriptors('LAFEA.1')
  .filter((descriptor) => descriptor.presentation.groupId === 'PRESSURE_RADII');
assert.equal(radiusDescriptors.length, 2, 'inner/outer radii must be editable');
for (const descriptor of radiusDescriptors) {
  assert.equal(descriptor.target.collectionPath, 'resultRequests.pressure');
  assert.equal(descriptor.target.identityKey, 'identity');
  assert.equal(descriptor.target.scalarWrapperKey, 'value');
  assert.equal(descriptor.unitContract.dimension, 'LENGTH');
  assert.equal(descriptor.valueContract.minimumExclusive, true);
}

// Baseline sample is coherent.
const baseline = projectLafea1PressureRadiusValidation(sample.aDocument);
assert.equal(baseline.state, 'VALID');
assert.equal(baseline.runAuthorized, true);
assert.equal(projectLafea1PressureRadiusRefit(sample.aDocument).state, 'NOT_REQUIRED');

// A real vessel geometry strands the demo radii. The editable stage projection
// strips the derived assessment thickness, so the preflight must fall back to
// the document's declared NOMINAL_MINUS_CORROSION policy or it silently stops
// guarding exactly when geometry has just changed.
const edited = structuredClone(sample.aDocument);
edited.pipeGeometry.outsideDiameter.value = 1844;
assert.equal(edited.thicknessBasis.policy, 'NOMINAL_MINUS_CORROSION',
  'sample must exercise the derived-thickness policy');
delete edited.thicknessBasis.assessmentPipeThickness;

const stranded = projectLafea1PressureRadiusValidation(edited);
assert.equal(stranded.state, 'OUTSIDE_WALL',
  'preflight must still evaluate once the derived thickness is stripped');
assert.equal(stranded.runAuthorized, false);
assert.deepEqual(stranded.reasonCodes, [LAFEA1_PRESSURE_RADIUS_OUTSIDE_WALL]);
assert.equal(stranded.innerRadius, 902);
assert.equal(stranded.outerRadius, 922);

// The recovery names an editable repair; Undo is no longer the only way out.
assert.match(stranded.recoveryAction, /Edit the pressure evaluation radii/u);
assert.match(stranded.recoveryAction, /Set radii to current wall/u);
assert.doesNotMatch(stranded.recoveryAction, /^Use Undo/u);

const refit = projectLafea1PressureRadiusRefit(edited);
assert.equal(refit.state, 'AVAILABLE');
assert.equal(refit.edits.length, 2);
assert.equal(refit.unaddressed.length, 0);

// A retained request re-sorts its radii ascending after every single edit, so
// the highest index must be assigned first for each edit to land where aimed.
const indices = refit.edits.map((edit) => Number(edit.descriptorId.split('.').pop()));
assert.deepEqual(indices, [2, 1], 'refit must apply the highest radius index first');
for (const edit of refit.edits) {
  assert.equal(edit.entityId, 'PR-1');
  assert.match(edit.descriptorId, /^LAFEA\.1\.pressure\.requestedRadius\.[12]$/u);
}

// Replay the edits under the ascending re-sort and confirm convergence.
const replayed = structuredClone(edited);
for (const edit of refit.edits) {
  const index = Number(edit.descriptorId.split('.').pop()) - 1;
  const request = replayed.resultRequests.pressure.find((row) => row.identity === edit.entityId);
  request.requestedRadii[index].value = Number(edit.rawText);
  request.requestedRadii.sort((left, right) => left.value - right.value);
}
assert.deepEqual(
  replayed.resultRequests.pressure[0].requestedRadii.map((row) => row.value),
  [902, 922],
  'refit must converge on the current bore and outer surface',
);
const recovered = projectLafea1PressureRadiusValidation(replayed);
assert.equal(recovered.state, 'VALID');
assert.equal(recovered.runAuthorized, true);
requireLafea1PressureRadiusRunAuthorized(replayed);

// An explicit assessment thickness still wins over the derived policy.
const explicit = structuredClone(edited);
explicit.thicknessBasis.assessmentPipeThickness = { value: 19 };
const explicitProjection = projectLafea1PressureRadiusValidation(explicit);
assert.equal(explicitProjection.innerRadius, 903);
assert.equal(explicitProjection.outerRadius, 922);

// A document with no resolvable wall stays unevaluated rather than guessing.
const unresolvable = structuredClone(edited);
delete unresolvable.thicknessBasis.nominalPipeThickness;
assert.equal(projectLafea1PressureRadiusValidation(unresolvable).state, 'NOT_EVALUATED');

console.log(`  2 editable radius descriptors; stranded wall ${stranded.innerRadius}-${stranded.outerRadius} ${stranded.unit};`);
console.log(`  refit applies indices ${indices.join(',')} and converges on [902,922]`);
console.log('LAFEA1_PRESSURE_RADIUS_RECOVERY_CHECK_PASS');
