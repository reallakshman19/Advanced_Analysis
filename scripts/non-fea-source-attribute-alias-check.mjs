#!/usr/bin/env node

/**
 * Source dialects name the same quantity differently, and an unrecognised name
 * is indistinguishable downstream from a quantity the model does not have.
 *
 * SJSON states insulation thickness as INSU. No built-in alias listed it, so
 * every component arrived with no insulation thickness: the readiness checker
 * concluded the lines were uninsulated and passed them, while the mass
 * resolver refused to compute an insulation mass it could not determine. The
 * lines carry 80 mm. This pins the built-in name, the unit-suffixed value form
 * SJSON writes, and the project-editable extension point.
 */

import assert from 'node:assert/strict';
import { collectEvidence } from '../src/core/shared-piping-model/evidence.js';
import { ENGINEERING_PROPERTY_SPECS } from '../src/core/shared-piping-model/property-specs.js';
import {
  validateConfiguredSourceAttributeAliases,
  withConfiguredSourceAttributeAliases,
} from '../src/core/shared-piping-model/source-attribute-aliases.js';

const read = (specs, attrs, field) => collectEvidence(
  { [field]: specs[field] }, [['attributes', attrs]], 'E1',
);

// INSU resolves, in the unit-suffixed form the source actually writes.
assert.equal(read(ENGINEERING_PROPERTY_SPECS, { INSU: '80mm' }, 'insulationThicknessMm')
  .values.insulationThicknessMm.value, 80);
assert.equal(read(ENGINEERING_PROPERTY_SPECS, { INSU: '0mm' }, 'insulationThicknessMm')
  .values.insulationThicknessMm.value, 0, 'an explicit zero is evidence, not absence');
assert.equal(read(ENGINEERING_PROPERTY_SPECS, { INSU: 80 }, 'insulationThicknessMm')
  .values.insulationThicknessMm.value, 80);

// A suffix in the wrong unit is a real error and must not be read as a number.
const wrongUnit = read(ENGINEERING_PROPERTY_SPECS, { INSU: '80in' }, 'insulationThicknessMm');
assert.equal(wrongUnit.values.insulationThicknessMm, undefined);
assert.equal(wrongUnit.diagnostics.length, 1, 'a mismatched unit is reported, not silently dropped');

// A project can teach the importer a further name.
const extended = withConfiguredSourceAttributeAliases(ENGINEERING_PROPERTY_SPECS, {
  insulationThicknessMm: ['LAGGING_MM'],
});
assert.equal(read(extended, { LAGGING_MM: '65mm' }, 'insulationThicknessMm')
  .values.insulationThicknessMm.value, 65);
assert.equal(read(ENGINEERING_PROPERTY_SPECS, { LAGGING_MM: '65mm' }, 'insulationThicknessMm')
  .values.insulationThicknessMm, undefined, 'unconfigured projects are unaffected');

// Built-in names keep precedence, so existing datasets resolve unchanged.
assert.equal(
  read(extended, { INSU: '80mm', LAGGING_MM: '65mm' }, 'insulationThicknessMm')
    .values.insulationThicknessMm.value,
  80,
);

// Additions are additive only: they cannot invent a property or retarget a
// name that already means something else.
const unknown = validateConfiguredSourceAttributeAliases(ENGINEERING_PROPERTY_SPECS, {
  notAProperty: ['FOO'],
});
assert.deepEqual(unknown.issues.map((row) => row.code), ['SOURCE_ATTRIBUTE_ALIAS_UNKNOWN_PROPERTY']);
assert.deepEqual(unknown.accepted, {});

const conflict = validateConfiguredSourceAttributeAliases(ENGINEERING_PROPERTY_SPECS, {
  insulationThicknessMm: ['WALL_THICKNESS_MM'],
});
assert.deepEqual(conflict.issues.map((row) => row.code), ['SOURCE_ATTRIBUTE_ALIAS_CONFLICT']);
assert.deepEqual(conflict.accepted, {});

const empty = validateConfiguredSourceAttributeAliases(ENGINEERING_PROPERTY_SPECS, {
  insulationThicknessMm: ['  '],
});
assert.deepEqual(empty.issues.map((row) => row.code), ['SOURCE_ATTRIBUTE_ALIAS_EMPTY']);

// Absent or malformed configuration leaves the built-ins exactly as they are.
assert.equal(withConfiguredSourceAttributeAliases(ENGINEERING_PROPERTY_SPECS, null), ENGINEERING_PROPERTY_SPECS);
assert.equal(withConfiguredSourceAttributeAliases(ENGINEERING_PROPERTY_SPECS, {}), ENGINEERING_PROPERTY_SPECS);
assert.deepEqual(
  validateConfiguredSourceAttributeAliases(ENGINEERING_PROPERTY_SPECS, 'nonsense').issues
    .map((row) => row.code),
  ['SOURCE_ATTRIBUTE_ALIASES_INVALID'],
);

// The setting must be visible and editable as governed Project Data.
const { PROJECT_DATA_GROUPS } = await import('../src/workspace/project-data/project-data-fields.js');
const sources = PROJECT_DATA_GROUPS.find((group) => group.key === 'sourcesAndUnits');
assert.ok(
  sources.fields.some((field) => field.key === 'sourceAttributeAliases' && field.inputType === 'json'),
  'source attribute aliases must be an editable Project Data field',
);

console.log(JSON.stringify({
  check: 'non-fea-source-attribute-alias',
  insuResolves: '80mm -> 80',
  explicitZeroPreserved: true,
  wrongUnitRejected: true,
  projectAliasesExtendImporter: 'LAGGING_MM -> insulationThicknessMm',
  builtInPrecedenceKept: true,
  cannotInventOrRetargetProperties: true,
  editableAsProjectData: true,
}, null, 2));
