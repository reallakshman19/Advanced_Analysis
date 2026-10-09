#!/usr/bin/env node

/**
 * Validate reusable CAESAR configuration precedence against the governed BM4_L profile.
 * The authority list is written low-to-high; resolution applies every declared
 * layer and retains the highest-authority value. Model friction coefficient and
 * load-case friction multiplier remain distinct governed quantities.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CAESAR_CONFIGURATION_PRECEDENCE,
  normalizeCaesarConfigurationAuthority,
  resolveCaesarConfigurationSetting,
} from '../src/core/fea-benchmarks/caesar-configuration-authority.js';

const profilePath = resolve(
  'benchmarks/LFEA/CAESAR_ACCDB/bm4l-validation.profile.json',
);
const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
const authority = normalizeCaesarConfigurationAuthority(profile.configurationAuthority);

assert.deepEqual(authority.precedence, [
  'OVERALL_GLOBAL_DEFAULT',
  'INDIVIDUAL_FILE_SETTING',
  'LOAD_CASE_SETTING',
  'MODEL_INPUT',
]);
assert.deepEqual(authority.precedence, CAESAR_CONFIGURATION_PRECEDENCE);
assert.deepEqual(
  resolveCaesarConfigurationSetting(authority, 'BOURDON_PRESSURE', null),
  {
    setting: 'BOURDON_PRESSURE',
    caseId: null,
    level: 'INDIVIDUAL_FILE_SETTING',
    value: 'TRANSLATION_AND_ROTATION',
    source: authority.layers.individualFile.source,
  },
);
assert.deepEqual(
  resolveCaesarConfigurationSetting(authority, 'AMBIENT_TEMPERATURE', null).value,
  { value: 21, unit: 'C' },
);
assert.equal(
  resolveCaesarConfigurationSetting(authority, 'DEFAULT_TRANS_RESTRAINT_STIFF', null).value.value,
  1e12,
);
assert.equal(
  resolveCaesarConfigurationSetting(authority, 'DEFAULT_ROT_RESTRAINT_STIFF', null).value.value,
  1e12,
);
for (const caseId of ['L5', 'L7', 'L13']) {
  const coefficient = resolveCaesarConfigurationSetting(
    authority,
    'COEFFICIENT_OF_FRICTION_MU',
    caseId,
  );
  assert.equal(coefficient.level, 'MODEL_INPUT');
  assert.equal(coefficient.value, 0.3);
}
assert.equal(
  resolveCaesarConfigurationSetting(authority, 'FRICTION_MULTIPLIER', 'L5').value,
  0,
);
assert.equal(
  resolveCaesarConfigurationSetting(authority, 'FRICTION_MULTIPLIER', 'L7').value,
  1,
);
assert.equal(
  resolveCaesarConfigurationSetting(authority, 'FRICTION_MULTIPLIER', 'L13').value,
  1,
);
assert.equal(
  resolveCaesarConfigurationSetting(authority, 'FLEXIBILITY_ELASTIC_MODULUS', 'L7').value,
  'EC',
);
assert.throws(
  () => resolveCaesarConfigurationSetting(authority, 'FRICTION_MULTIPLIER', 'L15'),
  /has no declared authority value/u,
);
assert.throws(
  () => normalizeCaesarConfigurationAuthority({
    ...profile.configurationAuthority,
    precedence: [...CAESAR_CONFIGURATION_PRECEDENCE].reverse(),
  }),
  /precedence must be/u,
);

process.stdout.write('CAESAR configuration authority: PASS\n');
