#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  normalizeCaesarConfigurationAuthority,
  resolveCaesarConfigurationLedger,
  resolveCaesarConfigurationSetting,
} from '../src/core/fea-benchmarks/caesar-configuration-authority.js';
import { PRODUCTION_CAPABILITY_PROFILE } from '../src/core/linear-piping-analysis-consumer/production-capability-profile.js';
import {
  PRODUCTION_PRESSURE_EFFECT_AUTHORITY_SCHEMA,
  sealProductionPressureEffectAuthority,
  sourcePressureEffectDisposition,
} from '../src/core/linear-piping-analysis-consumer/production-pressure-effect-authority.js';

const profile = JSON.parse(readFileSync(resolve(
  'benchmarks/LFEA/CAESAR_ACCDB/bm4nl-l19-l20-linear-solve.profile.json'), 'utf8'));
const configuration = normalizeCaesarConfigurationAuthority(profile.configurationAuthority);

const bourdonLedger = resolveCaesarConfigurationLedger(configuration, 'BOURDON_PRESSURE', null);
assert.equal(bourdonLedger.resolved.level, 'INDIVIDUAL_FILE_SETTING');
assert.equal(bourdonLedger.resolved.value, 'TRANSLATION_AND_ROTATION');

const pressureStiffeningLedger = resolveCaesarConfigurationLedger(configuration, 'USE_PRESSURE_STIFFENING', null);
assert.equal(pressureStiffeningLedger.resolved.level, 'OVERALL_GLOBAL_DEFAULT');
assert.equal(pressureStiffeningLedger.resolved.value, 'DEFAULT');

const codeLedger = resolveCaesarConfigurationLedger(configuration, 'DEFAULT_CODE', null);
assert.equal(codeLedger.resolved.value, 'B31.3_2022');

const elbowUnresolved = configuration.unresolvedSettings.find((row) =>
  row.setting === 'ELBOW_STIFFENING_PRESSURE' && row.caseId === 'L19');
assert.ok(elbowUnresolved, 'BM4_NL L19 must retain unresolved elbow stiffening pressure custody.');
assert.throws(
  () => resolveCaesarConfigurationSetting(configuration, 'ELBOW_STIFFENING_PRESSURE', 'L19'),
  /is unresolved/u,
);

const bm4Nl = sealProductionPressureEffectAuthority({
  schema: PRODUCTION_PRESSURE_EFFECT_AUTHORITY_SCHEMA,
  authorityId: 'S5-BM4NL-L19-SOURCE-STATE',
  activePipingCode: 'B31.3_2022',
  bourdonMode: 'TRANSLATION_AND_ROTATION',
  bendPressureStiffeningConfiguration: 'DEFAULT_CODE',
  elbowStiffeningPressureSelector: 'UNRESOLVED',
  settingEvidence: {
    activePipingCode: resolvedEvidence(codeLedger, 'B31.3_2022'),
    bourdonMode: resolvedEvidence(bourdonLedger, 'TRANSLATION_AND_ROTATION'),
    bendPressureStiffeningConfiguration: resolvedEvidence(pressureStiffeningLedger, 'DEFAULT_CODE'),
    elbowStiffeningPressureSelector: unresolvedEvidence(elbowUnresolved),
  },
});
const bm4Disposition = sourcePressureEffectDisposition(bm4Nl);
assert.equal(bm4Disposition.bourdon, 'ENABLED_BY_SOURCE_SETTING_NUMERICAL_QUALIFICATION_REQUIRED');
assert.equal(bm4Disposition.pressureStiffening.configuration, 'DEFAULT_CODE');
assert.equal(bm4Disposition.pressureStiffening.activePipingCode, 'B31.3_2022');
assert.equal(bm4Disposition.pressureStiffening.selectorResolved, false);
assert.equal(
  bm4Disposition.pressureStiffening.disposition,
  'BLOCKED_ELBOW_STIFFENING_PRESSURE_SELECTOR_UNRESOLVED',
);
assert.equal(bm4Disposition.axialThrust, 'NOT_AUTHORIZED_BY_BOURDON_OR_BEND_STIFFENING_SOURCE_STATE');

// A resolved per-case selector remains separate from the global configuration.
// DEFAULT_CODE is not silently converted to INCLUDE merely because P1 is known.
const defaultWithP1 = sealProductionPressureEffectAuthority({
  schema: PRODUCTION_PRESSURE_EFFECT_AUTHORITY_SCHEMA,
  authorityId: 'S5-DEFAULT-CODE-P1',
  activePipingCode: 'B31.3_2022',
  bourdonMode: 'NONE',
  bendPressureStiffeningConfiguration: 'DEFAULT_CODE',
  elbowStiffeningPressureSelector: 'P1',
  settingEvidence: syntheticEvidence({
    bourdonMode: 'NONE', rawBourdon: 'NONE',
    stiffening: 'DEFAULT_CODE', rawStiffening: 'DEFAULT',
    selector: 'P1', rawSelector: 'P1',
  }),
});
const defaultDisposition = sourcePressureEffectDisposition(defaultWithP1);
assert.equal(defaultDisposition.pressureStiffening.selectorResolved, true);
assert.equal(defaultDisposition.pressureStiffening.disposition,
  'CODE_CONTROLLED_NUMERICAL_QUALIFICATION_REQUIRED');

// Explicit global configuration and per-case selector are independent source
// settings. Do not invent a conflict rule between them; the active code and
// numerical formulation still determine effective mechanics.
const explicitExcludeWithP1 = sealProductionPressureEffectAuthority({
  schema: PRODUCTION_PRESSURE_EFFECT_AUTHORITY_SCHEMA,
  authorityId: 'S5-EXCLUDE-P1-SEPARATE-SETTINGS',
  activePipingCode: 'B31.3_2022',
  bourdonMode: 'TRANSLATION_ONLY',
  bendPressureStiffeningConfiguration: 'EXCLUDE',
  elbowStiffeningPressureSelector: 'P1',
  settingEvidence: syntheticEvidence({
    bourdonMode: 'TRANSLATION_ONLY', rawBourdon: 'TRANSLATION_ONLY',
    stiffening: 'EXCLUDE', rawStiffening: 'NO',
    selector: 'P1', rawSelector: 'P1',
  }),
});
assert.equal(sourcePressureEffectDisposition(explicitExcludeWithP1).pressureStiffening.disposition,
  'EXPLICIT_CONFIGURATION_NUMERICAL_QUALIFICATION_REQUIRED');

assert.throws(() => sealProductionPressureEffectAuthority({
  schema: PRODUCTION_PRESSURE_EFFECT_AUTHORITY_SCHEMA,
  authorityId: 'S5-UNRESOLVED-SPOOF',
  activePipingCode: 'B31.3_2022',
  bourdonMode: 'NONE',
  bendPressureStiffeningConfiguration: 'DEFAULT_CODE',
  elbowStiffeningPressureSelector: 'P1',
  settingEvidence: {
    ...syntheticEvidence({
      bourdonMode: 'NONE', rawBourdon: 'NONE',
      stiffening: 'DEFAULT_CODE', rawStiffening: 'DEFAULT',
      selector: 'P1', rawSelector: 'P1',
    }),
    elbowStiffeningPressureSelector: unresolvedEvidence({
      caseId: 'L19', reason: 'selector not observed',
    }),
  },
}), (error) => error?.code === 'PRESSURE_EFFECT_SETTING_EVIDENCE_MISMATCH');

// S5 remains a source-authority prerequisite. No numerical pressure mechanism
// becomes production-authorized merely because a source setting is known.
assert.equal(PRODUCTION_CAPABILITY_PROFILE.pressureStiffening, false);
assert.equal(PRODUCTION_CAPABILITY_PROFILE.pressureAxialThrust, false);
assert.equal(PRODUCTION_CAPABILITY_PROFILE.pressureBourdon, false);
assert.equal(PRODUCTION_CAPABILITY_PROFILE.pressureCodeStress, true);

console.log(JSON.stringify({
  check: 'lfea-s5-pressure-authority-gate',
  status: 'PASS',
  bm4NlBourdonAuthorityLevel: bourdonLedger.resolved.level,
  bm4NlBourdonMode: bm4Nl.bourdonMode,
  bm4NlGlobalPressureStiffening: bm4Nl.bendPressureStiffeningConfiguration,
  bm4NlActiveCode: bm4Nl.activePipingCode,
  bm4NlL19ElbowSelector: bm4Nl.elbowStiffeningPressureSelector,
  productionUseAuthorized: false,
  unresolved: [
    'BM4_NL_L19_ELBOW_STIFFENING_PRESSURE_SELECTOR',
    'PRODUCTION_BOURDON_FREE_DEFORMATION_PARITY',
    'PRODUCTION_BEND_PRESSURE_STIFFENING_PARITY',
    'PRESSURE_AXIAL_THRUST_SEPARATE_AUTHORITY',
  ],
}));

function resolvedEvidence(ledger, normalizedValue) {
  return {
    resolutionStatus: 'RESOLVED',
    authorityLevel: ledger.resolved.level,
    source: ledger.resolved.source,
    caseId: ledger.caseId,
    rawValue: String(ledger.resolved.value),
    normalizedValue,
    reason: null,
  };
}
function unresolvedEvidence(entry) {
  return {
    resolutionStatus: 'UNRESOLVED',
    authorityLevel: 'UNRESOLVED',
    source: 'BM4_NL_CONFIGURATION_AUTHORITY.unresolvedSettings',
    caseId: entry.caseId ?? null,
    rawValue: null,
    normalizedValue: null,
    reason: entry.reason,
  };
}
function syntheticEvidence(values) {
  return {
    activePipingCode: resolved('OVERALL_GLOBAL_DEFAULT', 'TEST-CODE-SOURCE', 'B31.3_2022', 'B31.3_2022'),
    bourdonMode: resolved('INDIVIDUAL_FILE_SETTING', 'TEST-JOB-SOURCE', values.rawBourdon, values.bourdonMode),
    bendPressureStiffeningConfiguration: resolved(
      'OVERALL_GLOBAL_DEFAULT', 'TEST-GLOBAL-SOURCE', values.rawStiffening, values.stiffening),
    elbowStiffeningPressureSelector: resolved(
      'LOAD_CASE_SETTING', 'TEST-CASE-SOURCE', values.rawSelector, values.selector, 'L1'),
  };
}
function resolved(authorityLevel, source, rawValue, normalizedValue, caseId = null) {
  return {
    resolutionStatus: 'RESOLVED', authorityLevel, source, caseId,
    rawValue, normalizedValue, reason: null,
  };
}
