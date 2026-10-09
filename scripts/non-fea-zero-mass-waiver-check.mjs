#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertZeroMassWaiversAdmissible,
  createNonFeaZeroMassWaiverSet,
  zeroMassWaiverSetFromProfile,
  zeroMassWaiverSuggested,
} from '../src/workspace/engineering-loads/non-fea-zero-mass-waiver.js';

// A waiver without a stated reason is the unexplained zero this mechanism
// exists to replace, so it is refused at construction.
assert.throws(
  () => createNonFeaZeroMassWaiverSet({ waivers: [{ entityId: '=1/1' }] }),
  (error) => error.code === 'NON_FEA_ZERO_MASS_WAIVER_JUSTIFICATION_REQUIRED',
);
assert.throws(
  () => createNonFeaZeroMassWaiverSet({ waivers: [{ justification: 'massless' }] }),
  (error) => error.code === 'NON_FEA_ZERO_MASS_WAIVER_SELECTOR_INVALID',
);

const waiverSet = createNonFeaZeroMassWaiverSet({
  waivers: [
    { entityId: '=1/9', justification: 'Pressure gauge carries no weighable mass.' },
    { entityId: '=1/2', justification: 'Temperature instrument carries no weighable mass.' },
  ],
});
assert.deepEqual(waiverSet.waivedEntityIds, ['=1/2', '=1/9'], 'waived ids are canonically sorted');
assert.equal(
  waiverSet.semanticHash,
  createNonFeaZeroMassWaiverSet({
    waivers: [
      { entityId: '=1/2', justification: 'Temperature instrument carries no weighable mass.' },
      { entityId: '=1/9', justification: 'Pressure gauge carries no weighable mass.' },
    ],
  }).semanticHash,
  'the receipt hash is order-independent',
);

// Suggestion is description-driven, never type-driven: this dataset types a
// 900# angle control valve as INST, and a type rule would silently zero it.
assert.equal(zeroMassWaiverSuggested('PRESSURE GAUGE RF900#'), true);
assert.equal(zeroMassWaiverSuggested('TEMPERATURE INSTRUMENT'), true);
assert.equal(zeroMassWaiverSuggested('ANGLE CONTROL VALVE-HOLD'), false);
assert.equal(zeroMassWaiverSuggested('BLIND FLANGE 900#'), false);
assert.equal(zeroMassWaiverSuggested(''), false);

// A waiver would remove the component from the load path, so one covering a
// component that carries a real source moment must fail closed.
const auditRecords = [
  { entityId: '=1/2', explicitMoment: { magnitudeNm: 0 } },
  { entityId: '=1/9', explicitMoment: { magnitudeNm: 1200 } },
];
assert.deepEqual(
  assertZeroMassWaiversAdmissible(
    createNonFeaZeroMassWaiverSet({ waivers: [{ entityId: '=1/2', justification: 'Gauge.' }] }),
    auditRecords,
  ),
  [],
  'a waiver on a massless, moment-free component is admissible',
);
assert.deepEqual(
  assertZeroMassWaiversAdmissible(
    createNonFeaZeroMassWaiverSet({ waivers: [{ entityId: '=1/9', justification: 'Gauge.' }] }),
    auditRecords,
  ),
  [{ entityId: '=1/9', code: 'NON_FEA_ZERO_MASS_WAIVER_EXPLICIT_MOMENT_PRESENT' }],
);
assert.deepEqual(
  assertZeroMassWaiversAdmissible(
    createNonFeaZeroMassWaiverSet({ waivers: [{ entityId: '=1/404', justification: 'Gauge.' }] }),
    auditRecords,
  ),
  [{ entityId: '=1/404', code: 'NON_FEA_ZERO_MASS_WAIVER_ENTITY_UNKNOWN' }],
);

// An unapproved or absent Project Data entry waives nothing, so a project that
// has never declared a waiver behaves exactly as it did before.
assert.deepEqual(zeroMassWaiverSetFromProfile(null).waivedEntityIds, []);
assert.deepEqual(zeroMassWaiverSetFromProfile({}).waivedEntityIds, []);
assert.deepEqual(
  zeroMassWaiverSetFromProfile({
    loadCalculation: {
      zeroMassWaivers: { value: { '=1/2': { justification: 'Gauge.' } }, approved: false },
    },
  }).waivedEntityIds,
  [],
  'an unapproved waiver map waives nothing',
);
assert.deepEqual(
  zeroMassWaiverSetFromProfile({
    loadCalculation: {
      zeroMassWaivers: { value: { '=1/2': { justification: 'Gauge.' } }, approved: true },
    },
  }).waivedEntityIds,
  ['=1/2'],
);

console.log(JSON.stringify({
  check: 'non-fea-zero-mass-waiver',
  justificationRequired: true,
  selectorRequired: true,
  receiptHashOrderIndependent: true,
  suggestionIsDescriptionDriven: true,
  explicitMomentWaiverRejected: true,
  unknownEntityWaiverRejected: true,
  unapprovedProfileEntryWaivesNothing: true,
}, null, 2));

// The waiver control lives in the fitting-weight dialog, which needs a DOM and
// so is not constructed here. Its one cross-module dependency is checked
// statically instead: a missing import throws only when a reviewer opens the
// dialog, and the view catches that into a message, so the control silently
// does nothing and the fittings it was meant to resolve stay blocked.
const dialogSource = readFileSync(
  new URL('../src/workspace/load-calc-fitting-weight-dialog.js', import.meta.url),
  'utf8',
);
for (const helper of ['zeroMassWaiverSuggested']) {
  if (!dialogSource.includes(helper)) continue;
  assert.match(
    dialogSource,
    new RegExp(`import[^;]*\\b${helper}\\b[^;]*from`, 'u'),
    `${helper} is used by the fitting-weight dialog but never imported`,
  );
}

// A waiver must answer the component everywhere the same evidence is asked
// for. The coverage checker reads the approved waiver map; so must the mass
// resolver, or a waived component clears Validate Input and then blocks
// execution with MISSING_COMPONENT_MASS - answered in one place, unanswered in
// another.
const { resolveComponentCaseMass } = await import('../src/core/model-loads/component-mass-resolver.js');
const { createPipingLoadCompositionProfile } = await import('../src/core/model-loads/composition-profile.js');

const waivedComponent = {
  componentKey: 'INST-1',
  type: 'INST',
  geometry: { start: null, end: null, center: null, ports: [], applicationPoint: null },
  engineeringProperties: {},
  diagnostics: [],
};
const composition = createPipingLoadCompositionProfile();

const unwaived = resolveComponentCaseMass(waivedComponent, 'EMPTY', composition);
assert.equal(unwaived.ok, false, 'without a waiver the component still needs mass evidence');

const waived = resolveComponentCaseMass(waivedComponent, 'EMPTY', composition, { zeroMassWaived: true });
assert.equal(waived.ok, true, 'a waived component resolves rather than blocking');
assert.equal(waived.pointMassKg, 0);
assert.ok(
  waived.diagnostics.some((row) => row.code === 'EXCLUDED_ZERO_MASS_WAIVER'),
  'the waiver is recorded distinctly from a gasket exclusion',
);
assert.ok(
  !waived.diagnostics.some((row) => row.code === 'EXCLUDED_NEGLIGIBLE_MASS'),
  'a waiver is an engineering decision, not a property of the component type',
);
