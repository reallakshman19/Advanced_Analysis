import { semanticHash } from '../../core/shared-piping-model/canonical-json.js';
import { freezeDeep, isRecord, stringValue } from '../dataset-utils.js';
import {
  NON_FEA_METHOD_IDS,
  getNonFeaFieldDefinition,
} from './non-fea-field-registry.js';
import {
  NON_FEA_CONFIGURED_DEFAULT_SCOPE_PRECEDENCE,
  createNonFeaConfiguredDefaultProvider,
} from './non-fea-configured-default-provider.js';
import { LOAD_CALC_STANDARD_DEFAULTS_V1 } from './non-fea-product-default-profile.js';

export const NON_FEA_PRODUCT_ENGINEERING_DEFAULT_PROFILE_SCHEMA =
  'non-fea-product-engineering-default-profile/v1';
export const NON_FEA_PRODUCT_ENGINEERING_DEFAULT_PROVIDER_SCHEMA =
  'non-fea-product-engineering-default-provider/v1';
export const NON_FEA_PRODUCT_ENGINEERING_DEFAULT_RECORD_SCHEMA =
  'non-fea-product-engineering-default-record/v1';

/**
 * Empty reference profile retained for explicit no-Product-default qualification
 * cases. Ordinary Load Calc uses the separately defined standard profile below.
 */
export const LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_EMPTY_V1 = createProductEngineeringDefaultProfile({
  profileId: 'LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_EMPTY_V1',
  version: 1,
  defaults: [],
});

const STANDARD_ELASTIC_THERMAL_DEFAULT = requireStandardProductDefault('PD-ELASTIC-THERMAL');
const STANDARD_ELASTIC_MODULUS_MPA = requireStandardElasticModulusMpa(STANDARD_ELASTIC_THERMAL_DEFAULT);
const STANDARD_THERMAL_EXPANSION_PER_K = requireStandardThermalExpansionPerK(STANDARD_ELASTIC_THERMAL_DEFAULT);

/**
 * Target-level Product engineering defaults may only reuse values that already
 * have explicit Product-default authority elsewhere in the repository. These
 * built-in rows do not invent material values: they project the exact generic-
 * steel elastic modulus and thermal-expansion coefficient already governed by
 * PD-ELASTIC-THERMAL. Elastic modulus is converted from Pa to the enrichment
 * contract's MPa value; thermal expansion already uses the canonical 1/K unit.
 *
 * Generic OD, wall, density, insulation and component-mass tables remain absent
 * until separately qualified product engineering tables exist.
 */
export const LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_STANDARD_V1 = createProductEngineeringDefaultProfile({
  profileId: 'LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_STANDARD_V1',
  version: 1,
  defaults: [{
    defaultId: 'PD-ENG-ELASTIC-MODULUS-GENERIC-STEEL',
    fieldId: 'ELASTIC_MODULUS',
    value: STANDARD_ELASTIC_MODULUS_MPA,
    unit: 'MPa',
    basis: [
      'Target-level projection of existing governed Product default',
      `${LOAD_CALC_STANDARD_DEFAULTS_V1.profileId}@${LOAD_CALC_STANDARD_DEFAULTS_V1.version}`,
      `${STANDARD_ELASTIC_THERMAL_DEFAULT.defaultId}@${STANDARD_ELASTIC_THERMAL_DEFAULT.semanticHash}`,
      'DEFAULT.elasticModulusPa converted by exact 1 MPa = 1e6 Pa.',
    ].join(' '),
    allowedMethods: getNonFeaFieldDefinition('ELASTIC_MODULUS').methods,
  }, {
    defaultId: 'PD-ENG-THERMAL-EXPANSION-GENERIC-STEEL',
    fieldId: 'THERMAL_EXPANSION_COEFFICIENT',
    value: STANDARD_THERMAL_EXPANSION_PER_K,
    unit: '1/K',
    basis: [
      'Target-level projection of existing governed Product default',
      `${LOAD_CALC_STANDARD_DEFAULTS_V1.profileId}@${LOAD_CALC_STANDARD_DEFAULTS_V1.version}`,
      `${STANDARD_ELASTIC_THERMAL_DEFAULT.defaultId}@${STANDARD_ELASTIC_THERMAL_DEFAULT.semanticHash}`,
      'DEFAULT.thermalExpansionPerK reused without unit conversion because the field contract is 1/K.',
    ].join(' '),
    allowedMethods: getNonFeaFieldDefinition('THERMAL_EXPANSION_COEFFICIENT').methods,
  }],
});

export function createProductEngineeringDefaultProfile({ profileId, version, defaults } = {}) {
  const rows = requireProductRows(defaults).sort((left, right) => left.defaultId.localeCompare(right.defaultId));
  const material = {
    schema: NON_FEA_PRODUCT_ENGINEERING_DEFAULT_PROFILE_SCHEMA,
    profileId: requiredText(profileId, 'profileId'),
    version: positiveInteger(version, 'version'),
    defaults: rows,
  };
  return freezeDeep({ ...material, semanticHash: semanticHash(material) });
}

export function requireProductEngineeringDefaultProfile(value) {
  if (!isRecord(value)
      || value.schema !== NON_FEA_PRODUCT_ENGINEERING_DEFAULT_PROFILE_SCHEMA
      || !Array.isArray(value.defaults)) {
    throw codedError(
      `Expected ${NON_FEA_PRODUCT_ENGINEERING_DEFAULT_PROFILE_SCHEMA}.`,
      'PRODUCT_ENGINEERING_DEFAULT_PROFILE_INVALID',
    );
  }
  const material = {
    schema: value.schema,
    profileId: requiredText(value.profileId, 'profileId'),
    version: positiveInteger(value.version, 'version'),
    defaults: requireProductRows(value.defaults).sort((left, right) => left.defaultId.localeCompare(right.defaultId)),
  };
  if (stringValue(value.semanticHash) !== semanticHash(material)) {
    throw codedError(
      'Product engineering-default profile semantic hash is stale.',
      'PRODUCT_ENGINEERING_DEFAULT_PROFILE_HASH_MISMATCH',
    );
  }
  return freezeDeep({ ...material, semanticHash: value.semanticHash });
}

/**
 * Uses the same exact identity/scope engine as Project Data configured defaults,
 * then rebinds the selected rows to PRODUCT_DEFAULT authority and product-table
 * provenance. No Project Data authority escapes from the internal scope pass.
 */
export function createNonFeaProductEngineeringDefaultProvider({
  defaultProfile = LOAD_CALC_ENGINEERING_PRODUCT_DEFAULTS_STANDARD_V1,
  sourceModel,
  requestedMethods = NON_FEA_METHOD_IDS,
} = {}) {
  const profile = requireProductEngineeringDefaultProfile(defaultProfile);
  if (!isRecord(sourceModel)) {
    throw codedError(
      'Product engineering-default provider requires a shared piping model.',
      'PRODUCT_ENGINEERING_DEFAULT_SOURCE_MODEL_INVALID',
    );
  }
  const methods = normalizeMethods(requestedMethods);
  const scopeProfile = {
    revision: profile.version,
    qualificationPolicy: {
      configuredDefaults: {
        value: {
          schema: 'non-fea-configured-default-policy/v1',
          defaults: profile.defaults.map((row) => ({
            defaultId: row.defaultId,
            fieldId: row.fieldId,
            value: row.value,
            unit: row.unit,
            basis: row.basis,
            allowedMethods: row.allowedMethods,
            ...(row.scope ? { scope: row.scope } : {}),
          })),
        },
        evidence: {
          source: `PRODUCT_ENGINEERING_DEFAULT_SCOPE:${profile.profileId}`,
          sourceHash: profile.semanticHash,
        },
        approved: true,
      },
    },
  };
  const scoped = createNonFeaConfiguredDefaultProvider({
    profile: scopeProfile,
    sourceModel,
    requestedMethods: methods,
  });
  const rowById = new Map(profile.defaults.map((row) => [row.defaultId, row]));
  const records = scoped.records.map((record) => {
    const row = rowById.get(record.evidence?.defaultId);
    if (!row) {
      throw codedError(
        `Scoped product default ${record.evidence?.defaultId || '<missing>'} is not in the product profile.`,
        'PRODUCT_ENGINEERING_DEFAULT_SCOPE_BINDING_INVALID',
      );
    }
    const material = {
      schema: NON_FEA_PRODUCT_ENGINEERING_DEFAULT_RECORD_SCHEMA,
      recordId: `product-default:${profile.profileId}:${row.defaultId}:${record.selectorKey}`,
      selectorKind: record.selectorKind,
      selectorKey: record.selectorKey,
      fieldId: row.fieldId,
      value: row.value,
      unit: row.unit,
      authority: 'PRODUCT_DEFAULT',
      sourceId: profile.profileId,
      revision: String(profile.version),
      evidence: {
        source: 'Versioned product engineering default',
        defaultId: row.defaultId,
        basis: row.basis,
        scope: record.evidence?.scope || {},
        scopePrecedence: NON_FEA_CONFIGURED_DEFAULT_SCOPE_PRECEDENCE,
        scopePriority: record.evidence?.scopePriority || [],
        allowedMethods: record.evidence?.allowedMethods || [],
        defaultSemanticHash: row.semanticHash,
        profileId: profile.profileId,
        profileVersion: profile.version,
        productDefaultProfileSemanticHash: profile.semanticHash,
      },
    };
    return freezeDeep({ ...material, semanticHash: semanticHash(material) });
  }).sort((left, right) => left.recordId.localeCompare(right.recordId));

  const material = {
    schema: NON_FEA_PRODUCT_ENGINEERING_DEFAULT_PROVIDER_SCHEMA,
    profileId: profile.profileId,
    profileVersion: profile.version,
    productDefaultProfileSemanticHash: profile.semanticHash,
    sourceModelSemanticHash: stringValue(sourceModel.semanticHash) || null,
    requestedMethods: methods,
    records,
    blockers: scoped.blockers,
    scopeEngineSemanticHash: scoped.semanticHash,
  };
  return freezeDeep({ ...material, semanticHash: semanticHash(material) });
}

function requireProductRows(value) {
  if (!Array.isArray(value)) {
    throw codedError(
      'Product engineering-default rows must be an array.',
      'PRODUCT_ENGINEERING_DEFAULT_PROFILE_INVALID',
    );
  }
  const ids = new Set();
  return value.map((row, index) => {
    if (!isRecord(row)) {
      throw codedError(
        `Product engineering default [${index}] must be an object.`,
        'PRODUCT_ENGINEERING_DEFAULT_ROW_INVALID',
      );
    }
    const defaultId = requiredText(row.defaultId, `defaults[${index}].defaultId`);
    if (ids.has(defaultId)) {
      throw codedError(
        `Duplicate product engineering default ID: ${defaultId}.`,
        'PRODUCT_ENGINEERING_DEFAULT_ID_DUPLICATE',
      );
    }
    ids.add(defaultId);
    const fieldId = requiredText(row.fieldId, `defaults[${index}].fieldId`);
    const definition = getNonFeaFieldDefinition(fieldId);
    if (!definition?.defaultEligible || !definition.authorityPath.includes('PRODUCT_DEFAULT')) {
      throw codedError(
        `PRODUCT_DEFAULT is not permitted for ${fieldId}.`,
        'PRODUCT_ENGINEERING_DEFAULT_FIELD_NOT_PERMITTED',
      );
    }
    if (!Object.hasOwn(row, 'value') || row.value === null || row.value === undefined) {
      throw codedError(
        `Product engineering default ${defaultId} requires a value.`,
        'PRODUCT_ENGINEERING_DEFAULT_VALUE_REQUIRED',
      );
    }
    validateFiniteValue(row.value, defaultId);
    const allowedMethods = normalizeMethods(row.allowedMethods);
    if (!allowedMethods.length) {
      throw codedError(
        `Product engineering default ${defaultId} requires at least one allowed method.`,
        'PRODUCT_ENGINEERING_DEFAULT_METHOD_REQUIRED',
      );
    }
    const material = {
      defaultId,
      fieldId,
      value: clone(row.value),
      unit: requiredText(row.unit, `defaults[${index}].unit`),
      basis: requiredText(row.basis, `defaults[${index}].basis`),
      allowedMethods,
      ...(row.scope === undefined ? {} : { scope: clone(row.scope) }),
    };
    const expected = semanticHash(material);
    if (row.semanticHash !== undefined && row.semanticHash !== expected) {
      throw codedError(
        `Product engineering default semantic hash mismatch: ${defaultId}.`,
        'PRODUCT_ENGINEERING_DEFAULT_ROW_HASH_MISMATCH',
      );
    }
    return freezeDeep({ ...material, semanticHash: expected });
  });
}

function requireStandardProductDefault(defaultId) {
  const row = LOAD_CALC_STANDARD_DEFAULTS_V1.defaults.find((item) => item.defaultId === defaultId);
  if (!row) {
    throw codedError(
      `Required governing Product default ${defaultId} was not found.`,
      'PRODUCT_ENGINEERING_DEFAULT_SOURCE_PRODUCT_DEFAULT_MISSING',
    );
  }
  return row;
}

function requireStandardElasticModulusMpa(row) {
  const elasticModulusPa = Number(row?.value?.DEFAULT?.elasticModulusPa);
  if (!Number.isFinite(elasticModulusPa) || elasticModulusPa <= 0) {
    throw codedError(
      'PD-ELASTIC-THERMAL DEFAULT.elasticModulusPa must be a positive finite value.',
      'PRODUCT_ENGINEERING_DEFAULT_SOURCE_ELASTIC_MODULUS_INVALID',
    );
  }
  return elasticModulusPa / 1e6;
}

function requireStandardThermalExpansionPerK(row) {
  const thermalExpansionPerK = Number(row?.value?.DEFAULT?.thermalExpansionPerK);
  if (!Number.isFinite(thermalExpansionPerK) || thermalExpansionPerK <= 0) {
    throw codedError(
      'PD-ELASTIC-THERMAL DEFAULT.thermalExpansionPerK must be a positive finite value.',
      'PRODUCT_ENGINEERING_DEFAULT_SOURCE_THERMAL_EXPANSION_INVALID',
    );
  }
  return thermalExpansionPerK;
}

function normalizeMethods(value) {
  if (!Array.isArray(value)) {
    throw codedError(
      'Product engineering-default methods must be an array.',
      'PRODUCT_ENGINEERING_DEFAULT_METHOD_INVALID',
    );
  }
  const methods = [...new Set(value.map(stringValue).filter(Boolean))].sort();
  methods.forEach((methodId) => {
    if (!NON_FEA_METHOD_IDS.includes(methodId)) {
      throw codedError(
        `Unknown Non-FEA method in product engineering default: ${methodId}.`,
        'PRODUCT_ENGINEERING_DEFAULT_METHOD_INVALID',
      );
    }
  });
  return freezeDeep(methods);
}

function validateFiniteValue(value, label) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw codedError(`${label} must be finite.`, 'PRODUCT_ENGINEERING_DEFAULT_VALUE_INVALID');
    return;
  }
  if (typeof value === 'string' || typeof value === 'boolean') return;
  if (Array.isArray(value)) {
    value.forEach((item) => validateFiniteValue(item, label));
    return;
  }
  if (isRecord(value)) {
    Object.values(value).forEach((item) => validateFiniteValue(item, label));
    return;
  }
  throw codedError(`${label} contains an unsupported value.`, 'PRODUCT_ENGINEERING_DEFAULT_VALUE_INVALID');
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw codedError(`${label} must be a positive integer.`, 'PRODUCT_ENGINEERING_DEFAULT_PROFILE_INVALID');
  }
  return value;
}

function requiredText(value, label) {
  const text = stringValue(value);
  if (!text) throw codedError(`${label} is required.`, 'PRODUCT_ENGINEERING_DEFAULT_PROFILE_INVALID');
  return text;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function codedError(message, code, details = null) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}
