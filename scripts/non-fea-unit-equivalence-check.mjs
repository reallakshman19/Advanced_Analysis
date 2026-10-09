#!/usr/bin/env node

/**
 * The two overlays that gate mass projection compare a configured or product
 * default's declared unit against the common-enriched field's expected unit.
 * Project Data writes those units typographically and the target records write
 * them in ASCII, so a raw string comparison rejects a correct default and the
 * calculation cannot run.
 *
 * This pins both halves: the fold is exactly superscript digits, and neither
 * overlay compares units with raw equality any more.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeEngineeringUnit,
  sameEngineeringUnit,
} from '../src/workspace/project-data/non-fea-unit-equivalence.js';

// The pair that blocked the 1885S run.
assert.equal(sameEngineeringUnit('kg/m³', 'kg/m3'), true);
assert.equal(sameEngineeringUnit('kg/m3', 'kg/m³'), true);
assert.equal(sameEngineeringUnit('m⁴', 'm4'), true);
assert.equal(sameEngineeringUnit('kg/m³', 'kg/m³'), true);
assert.equal(sameEngineeringUnit(' kg/m³ ', 'kg/m3'), true, 'surrounding whitespace is not a unit');

// A genuine unit mismatch must still block. Folding a superscript digit is a
// change in how a digit is written; it must not become a licence to equate
// different units or different powers.
assert.equal(sameEngineeringUnit('kg/m3', 'kg/m2'), false);
assert.equal(sameEngineeringUnit('kg/m³', 'kg/m²'), false);
assert.equal(sameEngineeringUnit('kg', 'g'), false);
assert.equal(sameEngineeringUnit('kg/m', 'kg/m3'), false);
assert.equal(sameEngineeringUnit('KG/M3', 'kg/m3'), false, 'case is not folded');
assert.equal(sameEngineeringUnit('', 'kg/m3'), false, 'an absent unit matches nothing');
assert.equal(sameEngineeringUnit(null, null), false);
assert.equal(sameEngineeringUnit(undefined, 'kg'), false);

assert.equal(normalizeEngineeringUnit('kg/m³'), 'kg/m3');
assert.equal(normalizeEngineeringUnit('m⁴'), 'm4');
assert.equal(normalizeEngineeringUnit(42), '');

// Both overlays must go through the helper. A raw !== here is the defect.
for (const file of [
  'non-fea-common-enriched-configured-default-overlay.js',
  'non-fea-common-enriched-product-default-overlay.js',
]) {
  const source = readFileSync(
    new URL(`../src/workspace/project-data/${file}`, import.meta.url),
    'utf8',
  );
  assert.ok(
    source.includes('sameEngineeringUnit(record.unit, expectedUnit)'),
    `${file} must compare units through sameEngineeringUnit`,
  );
  assert.ok(
    !source.includes('record.unit !== expectedUnit'),
    `${file} still compares declared and expected units with raw equality`,
  );
  // Equivalence at the guard is only half of it: the emitted field must carry
  // the common-enriched layer's ASCII spelling, because requireCommonEnrichedField
  // rejects a typographic unit outright ("must be a non-empty ASCII identity").
  assert.ok(
    source.includes('unit: expectedUnit,'),
    `${file} must emit the expected ASCII unit into the common-enriched field`,
  );
  assert.ok(
    source.includes('unit: normalizeEngineeringUnit(record.unit),'),
    `${file} must normalize units in the authority fingerprint`,
  );
}

console.log(JSON.stringify({
  check: 'non-fea-unit-equivalence',
  superscriptFolded: ['kg/m³ = kg/m3', 'm⁴ = m4'],
  stillDistinct: ['kg/m3 != kg/m2', 'kg != g', 'KG/M3 != kg/m3'],
  overlaysUseHelper: true,
}, null, 2));
