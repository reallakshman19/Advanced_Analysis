/**
 * Normalize and resolve layered CAESAR configuration authority.
 *
 * Profiles carry raw settings at their original scope. The declared precedence
 * is stored lowest-to-highest authority and resolution applies each layer in
 * that order: overall/global default, individual-file setting, load-case
 * setting, then model input. Unsupported or unresolved settings raise explicit
 * errors; callers never infer an effective value from CASE text.
 */

import { deepFreeze } from '../shared-piping-model/immutable.js';

export const CAESAR_CONFIGURATION_AUTHORITY_SCHEMA =
  'caesar-configuration-authority/v1';

export const CAESAR_CONFIGURATION_PRECEDENCE = Object.freeze([
  'OVERALL_GLOBAL_DEFAULT',
  'INDIVIDUAL_FILE_SETTING',
  'LOAD_CASE_SETTING',
  'MODEL_INPUT',
]);

/** Validate and freeze one reusable CAESAR configuration authority record. */
export function normalizeCaesarConfigurationAuthority(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('configurationAuthority must be an object.');
  }
  if (input.schema !== CAESAR_CONFIGURATION_AUTHORITY_SCHEMA) {
    throw new TypeError(`Unsupported configurationAuthority schema ${String(input.schema)}.`);
  }
  const precedence = stringArray(input.precedence, 'configurationAuthority.precedence');
  if (!sameStrings(precedence, CAESAR_CONFIGURATION_PRECEDENCE)) {
    throw new TypeError(
      `configurationAuthority.precedence must be ${CAESAR_CONFIGURATION_PRECEDENCE.join(' < ')}.`,
    );
  }
  const layers = input.layers;
  if (!layers || typeof layers !== 'object' || Array.isArray(layers)) {
    throw new TypeError('configurationAuthority.layers must be an object.');
  }
  const normalized = {
    schema: CAESAR_CONFIGURATION_AUTHORITY_SCHEMA,
    caesarVersion: nonempty(input.caesarVersion, 'configurationAuthority.caesarVersion'),
    precedence,
    layers: {
      overallGlobalDefault: normalizeLayer(
        layers.overallGlobalDefault,
        'configurationAuthority.layers.overallGlobalDefault',
      ),
      modelInput: normalizeLayer(
        layers.modelInput,
        'configurationAuthority.layers.modelInput',
      ),
      individualFile: normalizeLayer(
        layers.individualFile,
        'configurationAuthority.layers.individualFile',
      ),
      loadCase: normalizeLoadCaseLayer(
        layers.loadCase,
        'configurationAuthority.layers.loadCase',
      ),
    },
    unresolvedSettings: normalizeUnresolved(input.unresolvedSettings),
  };
  return deepFreeze(normalized);
}

/** Resolve one effective setting using the frozen low-to-high precedence declaration. */
export function resolveCaesarConfigurationSetting(authorityInput, settingInput, caseIdInput) {
  const authority = normalizeCaesarConfigurationAuthority(authorityInput);
  const setting = nonempty(settingInput, 'setting');
  const caseId = caseIdInput === null ? null : nonempty(caseIdInput, 'caseId');
  const unresolved = authority.unresolvedSettings.find((entry) =>
    entry.setting === setting && (entry.caseId === null || entry.caseId === caseId));
  if (unresolved) {
    throw new TypeError(
      `CAESAR setting ${setting}${caseId === null ? '' : ` for ${caseId}`} is unresolved: ${unresolved.reason}`,
    );
  }
  const candidates = [
    [
      'OVERALL_GLOBAL_DEFAULT',
      authority.layers.overallGlobalDefault.settings[setting],
      authority.layers.overallGlobalDefault.source,
    ],
    [
      'INDIVIDUAL_FILE_SETTING',
      authority.layers.individualFile.settings[setting],
      authority.layers.individualFile.source,
    ],
  ];
  if (caseId !== null) {
    candidates.push([
      'LOAD_CASE_SETTING',
      authority.layers.loadCase.cases[caseId]?.[setting],
      authority.layers.loadCase.source,
    ]);
  }
  candidates.push([
    'MODEL_INPUT',
    authority.layers.modelInput.settings[setting],
    authority.layers.modelInput.source,
  ]);
  const declared = candidates.filter((entry) => entry[1] !== undefined);
  const resolved = declared.at(-1);
  if (!resolved) {
    throw new TypeError(
      `CAESAR setting ${setting}${caseId === null ? '' : ` for ${caseId}`} has no declared authority value.`,
    );
  }
  return deepFreeze({
    setting,
    caseId,
    level: resolved[0],
    value: resolved[1],
    source: resolved[2],
  });
}

function normalizeLayer(input, field) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${field} must be an object.`);
  }
  return {
    source: nonempty(input.source, `${field}.source`),
    settings: normalizeSettings(input.settings, `${field}.settings`),
  };
}

function normalizeLoadCaseLayer(input, field) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${field} must be an object.`);
  }
  if (!input.cases || typeof input.cases !== 'object' || Array.isArray(input.cases)) {
    throw new TypeError(`${field}.cases must be an object.`);
  }
  const cases = {};
  for (const caseId of Object.keys(input.cases).sort(compareText)) {
    cases[nonempty(caseId, `${field}.caseId`)] = normalizeSettings(
      input.cases[caseId],
      `${field}.cases.${caseId}`,
    );
  }
  return { source: nonempty(input.source, `${field}.source`), cases };
}

function normalizeSettings(input, field) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${field} must be an object.`);
  }
  const settings = {};
  for (const key of Object.keys(input).sort(compareText)) {
    settings[nonempty(key, `${field}.key`)] = normalizeSettingValue(input[key], `${field}.${key}`);
  }
  return settings;
}

function normalizeSettingValue(value, field) {
  if (typeof value === 'string') return nonempty(value, field);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value).sort(compareText);
    if (!sameStrings(keys, ['unit', 'value'])) {
      throw new TypeError(`${field} measurement must contain exactly unit and value.`);
    }
    const number = Number(value.value);
    if (!Number.isFinite(number)) throw new TypeError(`${field}.value must be finite.`);
    return { value: number, unit: nonempty(value.unit, `${field}.unit`) };
  }
  throw new TypeError(`${field} must be a finite number, boolean, nonempty string, or measurement.`);
}

function normalizeUnresolved(input) {
  if (!Array.isArray(input)) throw new TypeError('configurationAuthority.unresolvedSettings must be an array.');
  const identities = new Set();
  return input.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError(`configurationAuthority.unresolvedSettings[${index}] must be an object.`);
    }
    const setting = nonempty(entry.setting, `configurationAuthority.unresolvedSettings[${index}].setting`);
    const caseId = entry.caseId === null ? null : nonempty(
      entry.caseId,
      `configurationAuthority.unresolvedSettings[${index}].caseId`,
    );
    const identity = `${setting}|${caseId ?? '*'}`;
    if (identities.has(identity)) throw new TypeError(`Duplicate unresolved CAESAR setting ${identity}.`);
    identities.add(identity);
    return {
      setting,
      caseId,
      reason: nonempty(entry.reason, `configurationAuthority.unresolvedSettings[${index}].reason`),
    };
  }).sort((left, right) => compareText(
    `${left.setting}|${left.caseId ?? '*'}`,
    `${right.setting}|${right.caseId ?? '*'}`,
  ));
}

function stringArray(value, field) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError(`${field} must be a nonempty array.`);
  return value.map((entry, index) => nonempty(entry, `${field}[${index}]`));
}

function sameStrings(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function nonempty(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${field} must be nonempty.`);
  return text;
}

function compareText(left, right) {
  return String(left).localeCompare(String(right));
}
