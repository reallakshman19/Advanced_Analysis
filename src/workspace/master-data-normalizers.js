import { MASTER_FIELDS } from '../calc-workspace/cii-standalone-port/ui-adapted/xml-cii-adapted-fields-config.js';
import { computeLineNoKey } from '../calc-workspace/cii-standalone-port/core/linelist-mapping.js';
import { resolveLineListDensity } from '../calc-workspace/cii-standalone-port/core/line-density-resolver.js';

/**
 * Reports whether a required field is satisfied, directly or by derivation.
 *
 * A bore column may be supplied in millimetres or derived from a mapped NPS
 * column through the configured npsToDn table, so the mapping is complete when
 * either source is present.
 */
export function isMappedFieldSatisfied(field, fieldMap) {
  if (fieldMap[field.name]) return true;
  return Boolean(field.derivableFrom && fieldMap[field.derivableFrom]);
}

/**
 * Reports whether a derivation actually yields values for the supplied rows.
 *
 * Mapping alone does not prove a derivation works: pointing the NPS column at a
 * millimetre column leaves every derived bore empty while the mapping still
 * looks complete. Sampling rows keeps that failure visible.
 */
export function derivationYieldsValues(field, fieldMap, rawRows, sampleSize = 25) {
  if (!field.derivableFrom || fieldMap[field.name]) return true;
  const header = fieldMap[field.derivableFrom];
  if (!header || !Array.isArray(rawRows) || rawRows.length === 0) return true;
  const sample = rawRows.slice(0, sampleSize);
  return sample.some((row) => nominalBoreMmFromNps(row?.[header]) !== null);
}

/**
 * Validates if the required fields in the mapping profile are met.
 */
export function validateMappingProfile(masterKey, fieldMap) {
  const schema = MASTER_FIELDS[masterKey];
  if (!schema) return { valid: false, errors: ['Unknown master key'] };

  const errors = [];
  schema.fields.forEach((field) => {
    if (field.required && !isMappedFieldSatisfied(field, fieldMap)) {
      const alternative = field.derivableFrom
        ? ` (or map ${schema.fields.find((row) => row.name === field.derivableFrom)?.label || field.derivableFrom} to derive it)`
        : '';
      errors.push(`Required field missing: ${field.label}${alternative}`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Base normalizer that maps raw rows to canonical rows using the provided fieldMap.
 * Also preserves source provenance.
 */
function normalizeRows(masterKey, rawRows, fieldMap) {
  const schema = MASTER_FIELDS[masterKey];
  if (!schema) throw new Error('Unknown schema');

  return rawRows.map((rawRow, index) => {
    const canonical = {
      _sourceRowIndex: index,
      _sourceRowNumber: rawRow._sourceRowNumber ?? null,
      _sourceSheet: rawRow._sourceSheet || '',
      _sourceProvenance: rawRow,
    };

    schema.fields.forEach((field) => {
      const header = fieldMap[field.name];
      canonical[field.name] = header ? rawRow[header] : undefined;
    });

    // Derive an unmapped bore from the mapped NPS column. The conversion uses
    // the same configured npsToDn table the preview and wall-thickness resolver
    // use, so a derived bore never introduces a second size convention.
    schema.fields.forEach((field) => {
      if (!field.derivableFrom || fieldMap[field.name]) return;
      const sourceHeader = fieldMap[field.derivableFrom];
      if (!sourceHeader) return;
      const derived = nominalBoreMmFromNps(rawRow[sourceHeader]);
      if (derived === null) return;
      canonical[field.name] = derived;
      canonical._derivedFields = { ...(canonical._derivedFields || {}) };
      canonical._derivedFields[field.name] = {
        from: field.derivableFrom,
        sourceHeader,
        sourceValue: rawRow[sourceHeader],
        method: 'NPS_INCH_TO_DN_MM',
      };
    });

    return canonical;
  });
}

/**
 * Converts a nominal pipe size in inches to its DN millimetre bore.
 *
 * Unknown sizes return null rather than an arithmetic inch/25.4 conversion, so
 * an off-table size is reported as unmapped instead of silently fabricated.
 */
export function nominalBoreMmFromNps(value) {
  const inches = Number(String(value ?? '').trim());
  if (!Number.isFinite(inches) || inches <= 0) return null;
  const mapped = Number(NPS_TO_DN_MM[String(inches)]);
  return Number.isFinite(mapped) ? mapped : null;
}

/** Mirrors the default `config.weight.npsToDn` table used across the port. */
const NPS_TO_DN_MM = Object.freeze({
  '0.25': 8, '0.375': 10, '0.5': 15, '0.75': 20, '1': 25, '1.25': 32, '1.5': 40,
  '2': 50, '2.5': 65, '3': 80, '4': 100, '5': 125, '6': 150, '8': 200, '10': 250,
  '12': 300, '14': 350, '16': 400, '18': 450, '20': 500, '24': 600,
});

export function normalizeLineList(rawRows, fieldMap) {
  const validation = validateMappingProfile('lineList', fieldMap);
  if (!validation.valid) throw new Error(`Mapping invalid: ${validation.errors.join(', ')}`);

  const canonicalRows = normalizeRows('lineList', rawRows, fieldMap);
  return canonicalRows.map((row, idx) => {
    const rawRow = rawRows[idx];
    const key = computeLineNoKey(rawRow, fieldMap);
    const densityInfo = resolveLineListDensity({ ...row, _raw: rawRow }, null, fieldMap);
    return {
      ...row,
      lineKey: key,
      lineNoKey: key,
      operatingFluidDensity: densityInfo.value || '',
      density: densityInfo.value || '',
      densitySource: densityInfo.source || 'none',
    };
  });
}

export function normalizePipingClass(rawRows, fieldMap) {
  const validation = validateMappingProfile('pipingClass', fieldMap);
  if (!validation.valid) throw new Error(`Mapping invalid: ${validation.errors.join(', ')}`);

  return normalizeRows('pipingClass', rawRows, fieldMap);
}

export function normalizeWeight(rawRows, fieldMap) {
  const validation = validateMappingProfile('weight', fieldMap);
  if (!validation.valid) throw new Error(`Mapping invalid: ${validation.errors.join(', ')}`);

  return normalizeRows('weight', rawRows, fieldMap);
}

export function normalizeMaterialMap(rawRows, fieldMap) {
  const validation = validateMappingProfile('materialMap', fieldMap);
  if (!validation.valid) throw new Error(`Mapping invalid: ${validation.errors.join(', ')}`);

  return normalizeRows('materialMap', rawRows, fieldMap);
}
