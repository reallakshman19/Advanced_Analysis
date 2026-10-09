export const WRC537_SOURCE_READINESS_SCHEMA = 'wrc537-source-readiness-result/v1';
export const WRC537_READY_STATE = 'READY_FOR_IMPLEMENTATION';
export const WRC537_BLOCKED_STATE = 'BLOCKED';

const REQUIRED_PARAMETER_IDS = Object.freeze([
  'SPHERE_U',
  'SPHERE_GAMMA',
  'SPHERE_RHO',
  'CYL_LAMBDA',
  'CYL_DELTA',
]);
const REQUIRED_LOAD_KEYS = Object.freeze([
  'spherical:P', 'spherical:V1', 'spherical:V2', 'spherical:M1', 'spherical:M2', 'spherical:Mt',
  'cylindrical:P', 'cylindrical:Vc', 'cylindrical:Vl', 'cylindrical:Mc', 'cylindrical:Ml', 'cylindrical:Mt',
]);

export function evaluateWrc537SourceReadiness({ manifest, dataset, coefficientRows }) {
  requireObject(manifest, 'manifest');
  requireObject(dataset, 'dataset');
  requireArray(coefficientRows, 'coefficientRows');
  const targetEdition = manifest.targetEdition ?? null;

  const gates = [
    gate('TARGET_EDITION_SELECTED', targetEditionSelected(manifest),
      'An exact target bulletin edition and publication date must be selected.'),
    gate('TARGET_EDITION_CURRENT_CATALOG_IDENTITY', targetEditionCatalogIdentity(manifest),
      'The target edition identity must be retained from an authoritative catalog source.'),
    gate('TARGET_EDITION_PRIMARY_TECHNICAL_SOURCE', primaryTechnicalSourceAvailable(manifest),
      'The licensed/authorized target-edition technical source must be available and verified.'),
    gate('SOURCE_EDITION_CONSISTENCY', sourceEditionConsistent(manifest, dataset),
      'Research extracted from other editions cannot become target-edition engineering authority.'),
    gate('GEOMETRY_DEFINITIONS_COMPLETE', geometryDefinitionsComplete(dataset),
      'All geometry definitions consumed by the method must be resolved.'),
    gate('DIMENSIONLESS_PARAMETERS_COMPLETE', parametersComplete(dataset),
      'All required parameter equations, domains, and boundary inclusivity must be resolved.'),
    gate('LOAD_SIGNS_COMPLETE', loadSignsComplete(dataset),
      'All supported load/moment components require explicit positive-direction conventions.'),
    gate('LAFEA_MAPPING_COMPLETE', lafeaMappingComplete(dataset),
      'WRC stress/load/geometry quantities must have qualified LAFEA canonical mappings.'),
    gate('COEFFICIENT_VALUES_COMPLETE', coefficientValuesComplete(coefficientRows),
      'Every coefficient row must retain a finite numerical value.'),
    gate('COEFFICIENT_PRECISION_COMPLETE', coefficientPrecisionComplete(coefficientRows),
      'Every numerical coefficient must retain published/source precision.'),
    gate('COEFFICIENT_SOURCE_CUSTODY_COMPLETE',
      coefficientSourceCustodyComplete(coefficientRows, targetEdition),
      'Every coefficient must retain target-edition primary-source identity, locator, and verified status.'),
    gate('SIGN_TABLE_PRIMARY_VERIFIED', explicitTrue(manifest?.engineeringVerification?.signTablesPrimaryVerified),
      'Load/stress sign tables must be verified against the target-edition primary source.'),
    gate('INTERPOLATION_PRIMARY_VERIFIED', explicitTrue(manifest?.engineeringVerification?.interpolationPrimaryVerified),
      'Interpolation/extrapolation rules must be verified against the target-edition primary source.'),
    gate('STRESS_RECONSTRUCTION_PRIMARY_VERIFIED',
      explicitTrue(manifest?.engineeringVerification?.stressReconstructionPrimaryVerified),
      'Membrane/bending/surface reconstruction signs must be verified against the target edition.'),
    gate('STRESS_INTENSITY_MATH_PRIMARY_VERIFIED',
      explicitTrue(manifest?.engineeringVerification?.stressIntensityMathPrimaryVerified),
      'Stress-intensity/principal-stress mathematics must be dimensionally checked and source verified.'),
    gate('PUBLISHED_BENCHMARKS_AVAILABLE', publishedBenchmarksAvailable(manifest),
      'At least one target-edition published/reference numerical benchmark is required.'),
    gate('PUBLISHED_BENCHMARKS_REPRODUCED', publishedBenchmarksReproduced(manifest),
      'All retained implementation benchmarks must be independently reproduced.'),
  ];

  const failedGateIds = gates.filter((row) => row.status === 'FAIL').map((row) => row.gateId);
  return deepFreeze({
    schema: WRC537_SOURCE_READINESS_SCHEMA,
    methodIdentity: 'WRC537',
    targetEdition: clone(targetEdition),
    state: failedGateIds.length ? WRC537_BLOCKED_STATE : WRC537_READY_STATE,
    gates,
    failedGateIds,
    statistics: {
      coefficientRows: coefficientRows.length,
      coefficientRowsWithFiniteValue: coefficientRows.filter(hasFiniteCoefficient).length,
      coefficientRowsWithPublishedPrecision: coefficientRows.filter(hasPublishedPrecision).length,
      coefficientRowsPrimaryVerified: coefficientRows.filter((row) =>
        coefficientRowPrimaryVerified(row, targetEdition)).length,
      requiredParameterCount: REQUIRED_PARAMETER_IDS.length,
      requiredLoadConventionCount: REQUIRED_LOAD_KEYS.length,
    },
  });
}

export function normalizeWrc537CoefficientRow(row, targetEdition = null) {
  requireObject(row, 'coefficientRow');
  const finiteValue = hasFiniteCoefficient(row);
  const precision = hasPublishedPrecision(row);
  const primaryVerified = coefficientRowPrimaryVerified(row, targetEdition);
  return deepFreeze({
    ...clone(row),
    normalizedValueState: finiteValue ? 'NUMERIC_VALUE_PRESENT' : 'STRUCTURE_ONLY_VALUE_UNRESOLVED',
    normalizedPrecisionState: precision ? 'SOURCE_PRECISION_PRESENT' : 'SOURCE_PRECISION_UNRESOLVED',
    normalizedAuthorityState: primaryVerified ? 'TARGET_EDITION_PRIMARY_SOURCE_VERIFIED'
      : 'NOT_TARGET_EDITION_PRIMARY_SOURCE_VERIFIED',
    normalizedEngineeringState: finiteValue && precision && primaryVerified
      ? 'ENGINEERING_DATA_CANDIDATE'
      : 'RESEARCH_ONLY',
  });
}

function targetEditionSelected(manifest) {
  return nonempty(manifest?.targetEdition?.edition)
    && /^\d{4}-\d{2}$/u.test(manifest?.targetEdition?.publicationDate ?? '');
}
function targetEditionCatalogIdentity(manifest) {
  return manifest?.targetEdition?.catalogIdentityVerified === true
    && nonempty(manifest?.targetEdition?.catalogAuthority)
    && nonempty(manifest?.targetEdition?.catalogReference);
}
function primaryTechnicalSourceAvailable(manifest) {
  return manifest?.targetEdition?.technicalSourceAvailable === true
    && manifest?.targetEdition?.technicalSourcePrimaryVerified === true
    && nonempty(manifest?.targetEdition?.technicalSourceReference);
}
function sourceEditionConsistent(manifest, dataset) {
  const target = manifest?.targetEdition;
  const extraction = manifest?.normalizedExtraction;
  return targetEditionSelected(manifest)
    && extraction?.targetEditionTechnicalDataVerified === true
    && extraction?.technicalEdition === target.edition
    && extraction?.technicalPublicationDate === target.publicationDate
    && dataset?.method?.bulletinNumber === 'WRC Bulletin 537';
}
function geometryDefinitionsComplete(dataset) {
  const rows = Array.isArray(dataset?.geometryDefinitions) ? dataset.geometryDefinitions : [];
  return rows.length > 0 && rows.every((row) => resolved(row?.definition));
}
function parametersComplete(dataset) {
  const rows = Array.isArray(dataset?.dimensionlessParameters) ? dataset.dimensionlessParameters : [];
  return REQUIRED_PARAMETER_IDS.every((id) => {
    const row = rows.find((entry) => entry?.parameterId === id);
    return row && resolved(row.equation) && Array.isArray(row.inputs) && row.inputs.length > 0
      && row.inputs.every(resolved) && Number.isFinite(row.minimum) && Number.isFinite(row.maximum)
      && typeof row.minimumInclusive === 'boolean' && typeof row.maximumInclusive === 'boolean';
  });
}
function loadSignsComplete(dataset) {
  const loads = Array.isArray(dataset?.loads) ? dataset.loads : [];
  return REQUIRED_LOAD_KEYS.every((key) => {
    const [family, symbol] = key.split(':');
    const row = loads.find((entry) => entry?.[family] === symbol);
    return row && resolved(row.positive);
  });
}
function lafeaMappingComplete(dataset) {
  const stresses = Array.isArray(dataset?.stressDefinitions) ? dataset.stressDefinitions : [];
  return stresses.length > 0 && stresses.every((row) => resolved(row?.laffeaMapping));
}
function coefficientValuesComplete(rows) {
  return rows.length > 0 && rows.every(hasFiniteCoefficient);
}
function coefficientPrecisionComplete(rows) {
  return rows.length > 0 && rows.every(hasPublishedPrecision);
}
function coefficientSourceCustodyComplete(rows, targetEdition) {
  return rows.length > 0 && rows.every((row) => coefficientRowPrimaryVerified(row, targetEdition));
}
function publishedBenchmarksAvailable(manifest) {
  const rows = manifest?.engineeringVerification?.publishedBenchmarks;
  return Array.isArray(rows) && rows.length > 0
    && rows.every((row) => nonempty(row?.caseId) && row?.targetEditionPrimarySourceVerified === true);
}
function publishedBenchmarksReproduced(manifest) {
  const rows = manifest?.engineeringVerification?.publishedBenchmarks;
  return publishedBenchmarksAvailable(manifest)
    && rows.every((row) => row?.independentlyReproduced === true);
}
function hasFiniteCoefficient(row) {
  if (typeof row?.coefficient_value === 'number') return Number.isFinite(row.coefficient_value);
  if (!nonempty(row?.coefficient_value) || !resolved(row.coefficient_value)) return false;
  const value = Number(row.coefficient_value);
  return Number.isFinite(value);
}
function hasPublishedPrecision(row) {
  return nonempty(row?.published_precision) && resolved(row.published_precision);
}
function coefficientRowPrimaryVerified(row, targetEdition) {
  return row?.review_status === 'PRIMARY_SOURCE_VERIFIED'
    && row?.extraction_confidence === 'PRIMARY_VERIFIED'
    && coefficientEditionMatchesTarget(row?.edition, targetEdition)
    && sourceLocatorPresent(row);
}
function coefficientEditionMatchesTarget(rowEdition, targetEdition) {
  if (!nonempty(rowEdition) || !nonempty(targetEdition?.edition)
    || !/^\d{4}-\d{2}$/u.test(targetEdition?.publicationDate ?? '')) return false;
  const edition = escapeRegex(targetEdition.edition.trim());
  const year = targetEdition.publicationDate.slice(0, 4);
  const editionPattern = new RegExp(`(?:^|\\D)${edition}(?:ST|ND|RD|TH)?(?:\\D|$)`, 'iu');
  return editionPattern.test(rowEdition) && rowEdition.includes(year);
}
function sourceLocatorPresent(row) {
  const exactLocator = [row?.source_equation, row?.source_table, row?.source_figure]
    .some((value) => resolved(value));
  return resolved(row?.source_page) && exactLocator;
}
function resolved(value) {
  if (typeof value !== 'string') return value !== null && value !== undefined;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0
    && !normalized.includes('UNRESOLVED')
    && !normalized.includes('NOT AVAILABLE')
    && !normalized.includes('NOT VERIFIED');
}
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'); }
function explicitTrue(value) { return value === true; }
function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
function gate(gateId, pass, requirement) {
  return deepFreeze({ gateId, status: pass ? 'PASS' : 'FAIL', requirement });
}
function requireObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path} must be an object.`);
}
function requireArray(value, path) {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array.`);
}
function clone(value) { return value === undefined ? undefined : structuredClone(value); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
