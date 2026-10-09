#!/usr/bin/env node
/** Fixture/static contract for the M047 Stage 2 R5 friction geometry inventory. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildFrictionGeometryInventory } from './lfea-m047-stage2-r5-friction-geometry-inventory.mjs';

const iteration = {
  schema: 'm047-bm4l-stage2-friction-tuning-iteration/v1',
  caseId: 'L13',
  converged: true,
  sourceAccdbSha256: '64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8',
  iterationSemanticHash: 'fixture',
  restraints: [
    { restraintId: 'R-BEND', nodeId: '20', nodeName: 'bend', normalDof: 'UY', frictionDofs: ['UX', 'UZ'] },
    { restraintId: 'R-TEE', nodeId: '50', nodeName: 'tee', normalDof: 'UY', frictionDofs: ['UX'] },
    { restraintId: 'R-PLAIN', nodeId: '99', nodeName: 'plain', normalDof: 'UY', frictionDofs: ['UZ'] },
  ],
};
const basicElementRows = [
  { ELEMENTID: 1, FROM_NODE: 10, TO_NODE: 20, BEND_PTR: 1 },
  { ELEMENTID: 2, FROM_NODE: 20, TO_NODE: 30, BEND_PTR: 0 },
  { ELEMENTID: 3, FROM_NODE: 30, TO_NODE: 40, BEND_PTR: 0 },
];
const sifTeeRows = [
  { TYPE: 3, NODE: 50 },
  { TYPE: 2, NODE: 60 },
];

const result = buildFrictionGeometryInventory({ iteration, basicElementRows, sifTeeRows });
assert.equal(result.frictionRestraintCount, 3);
assert.equal(result.bendDefinitionCount, 1);
assert.equal(result.teeJunctionCount, 1);
assert.equal(result.bendCoincidentFrictionCount, 1);
assert.equal(result.teeCoincidentFrictionCount, 1);
assert.equal(result.geometrySensitiveFrictionCount, 2);
assert.equal(result.decision.status, 'BEND_OR_TEE_TANGENT_VERIFICATION_REQUIRED');
assert.equal(result.decision.directionPromotionBlockedByR5, true);
assert.equal(result.restraints.find((row) => row.restraintId === 'R-BEND').bendCoincidences[0].role,
  'BEND_GEOMETRIC_INTERSECTION');
assert.equal(result.restraints.find((row) => row.restraintId === 'R-TEE').teeJunction, true);
assert.equal(result.mechanicsChanged, false);
assert.equal(result.toleranceChanged, false);
assert.equal(result.comparisonPolicyChanged, false);

const noOverlap = buildFrictionGeometryInventory({
  iteration: { ...iteration, restraints: [iteration.restraints[2]] },
  basicElementRows,
  sifTeeRows,
});
assert.equal(noOverlap.geometrySensitiveFrictionCount, 0);
assert.equal(noOverlap.decision.status, 'NO_FRICTION_RESTRAINT_ON_BEND_OR_TEE_SOURCE_STATION');
assert.equal(noOverlap.decision.directionPromotionBlockedByR5, false);

assert.throws(
  () => buildFrictionGeometryInventory({
    iteration,
    basicElementRows: [
      ...basicElementRows,
      { ELEMENTID: 4, FROM_NODE: 20, TO_NODE: 35, BEND_PTR: 0 },
    ],
    sifTeeRows,
  }),
  /requires exactly one outgoing element/u,
  'bend topology ambiguity must fail closed instead of guessing the outgoing leg',
);

const scriptPath = resolve('scripts/lfea-m047-stage2-r5-friction-geometry-inventory.mjs');
const source = readFileSync(scriptPath, 'utf8');
assert.match(source, /INPUT_BASIC_ELEMENT_DATA/u);
assert.match(source, /INPUT_SIFTEES/u);
assert.match(source, /BEND_GEOMETRIC_INTERSECTION/u);
assert.match(source, /VERIFY_FRICTION_TANGENT_PLANE_AGAINST_LOCAL_BEND_ARC_OR_TEE_LEG_TANGENT/u);
assert.match(source, /64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8/u);
assert.doesNotMatch(source, /caesar-accdb-friction-solve/u,
  'R5 topology inventory must not import or modify the nonlinear friction solver');

const syntax = spawnSync(process.execPath, ['--check', scriptPath], { encoding: 'utf8' });
assert.equal(syntax.status, 0, `R5 geometry inventory must parse: ${syntax.stderr}`);
process.stdout.write('PASS m047 R5 friction geometry inventory contract\n');
