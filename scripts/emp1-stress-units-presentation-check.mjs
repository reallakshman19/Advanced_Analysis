#!/usr/bin/env node
/**
 * EMP.1.C eight-point stress presentation: units and engineering precision.
 *
 * Asserts that stating a unit and rounding for display cannot move a retained
 * engineering value. The unit must come from the governed numerics contract
 * rather than a view-side literal, and the exact retained magnitudes and the
 * result hash must be unchanged by presentation.
 *
 * Presentation-only. This check grants no method, numerical, code or release
 * authority.
 */
import assert from 'node:assert/strict';
import {
  emp1StressDisplayNumber,
  emp1StressExactNumber,
  emp1UnitLabel,
  emp1UnitedLabel,
  governingEightPointStressIntensity,
} from '../src/workspace/emp1-professional-result-presentation.js';
import { createEmp1WorkbenchQualificationSample } from '../src/workspace/emp1-workbench-qualification-sample.js';
import { executeEmp1WorkbenchProduct } from '../src/workspace/emp1-workbench-product-run.js';

const sample = createEmp1WorkbenchQualificationSample();
const execution = await executeEmp1WorkbenchProduct({
  aDocument: sample.aDocument,
  bDocument: sample.bDocument,
  runInput: sample.runInput,
});
const localCorrelation = execution?.result?.localCorrelation;
assert.ok(localCorrelation, 'retained EMP.1.C local correlation required');

// The unit is governed by the numerics contract, not by the view.
const units = localCorrelation.numerics?.units;
assert.ok(units, 'governed numerics unit contract required');
assert.equal(units.stress, 'N/mm^2');
assert.equal(units.force, 'N');
assert.equal(units.moment, 'N*mm');
assert.equal(emp1UnitLabel(units.stress), 'N/mm²');
assert.equal(emp1UnitLabel(units.moment), 'N·mm');
assert.equal(emp1UnitedLabel('σφ', units.stress), 'σφ (N/mm²)');

// An absent unit is stated, never silently omitted.
assert.equal(emp1UnitLabel(undefined), null);
assert.equal(emp1UnitedLabel('σφ', undefined), 'σφ (unit unresolved)');
assert.equal(emp1UnitedLabel('σφ', ''), 'σφ (unit unresolved)');

// A unit token the view has never seen is passed through, not dropped.
assert.equal(emp1UnitLabel('ksi'), 'ksi');

const { stresses } = localCorrelation;
const families = ['circumferential', 'longitudinal', 'shear', 'stressIntensity'];
for (const family of families) {
  assert.equal(stresses[family].length, 8, `${family} must retain eight locations`);
}

// Display rounding is reversible to the exact retained value, and never mutates it.
let rounded = 0;
for (const family of families) {
  for (const value of stresses[family]) {
    assert.ok(Number.isFinite(value));
    assert.equal(Number(emp1StressExactNumber(value)), value,
      'exact display must round-trip to the retained double');
    const shown = Number(emp1StressDisplayNumber(value));
    assert.ok(Number.isFinite(shown));
    const tolerance = Math.abs(value) * 5e-4;
    assert.ok(Math.abs(shown - value) <= tolerance,
      `4 s.f. display of ${value} must stay within its own rounding band`);
    if (shown !== value) rounded += 1;
  }
}
assert.ok(rounded > 0, 'sample must exercise at least one rounded display value');

// Non-finite input degrades to a marker rather than a fabricated number.
for (const bad of [null, undefined, Number.NaN, Infinity, '12']) {
  assert.equal(emp1StressDisplayNumber(bad), '—');
  assert.equal(emp1StressExactNumber(bad), '—');
}

// Presentation must not disturb the governing point or the retained result hash.
const governing = governingEightPointStressIntensity(stresses.stressIntensity);
assert.equal(governing.state, 'AVAILABLE');
assert.equal(governing.stressIntensity, Math.max(...stresses.stressIntensity));
assert.equal(governing.location, 'Au');

const rerun = await executeEmp1WorkbenchProduct({
  aDocument: sample.aDocument,
  bDocument: sample.bDocument,
  runInput: sample.runInput,
});
assert.equal(rerun.result.localCorrelation.resultHash, localCorrelation.resultHash,
  'retained result hash must be unchanged by presentation');
for (const family of families) {
  assert.deepEqual(rerun.result.localCorrelation.stresses[family], stresses[family],
    `${family} retained values must be unchanged by presentation`);
}

console.log(`  8 locations x ${families.length} families; unit ${units.stress} -> ${emp1UnitLabel(units.stress)};`);
console.log(`  ${rounded} displayed values rounded, all reversible; resultHash ${localCorrelation.resultHash} stable`);
console.log('EMP1_STRESS_UNITS_PRESENTATION_CHECK_PASS');
