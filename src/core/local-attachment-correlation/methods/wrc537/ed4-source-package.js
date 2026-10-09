export const WRC537_ED4_SOURCE_PACKAGE_SCHEMA = 'wrc537-ed4-source-package/v1';
export const WRC537_ED4_PACKAGE_READY = 'READY_FOR_TECHNICAL_IMPLEMENTATION';
export const WRC537_ED4_PACKAGE_BLOCKED = 'BLOCKED';

const TARGET_EDITION = Object.freeze({ bulletinNumber: 'WRC Bulletin 537', edition: '4', publicationDate: '2026-02' });
const REQUIRED_PARAMETER_IDS = Object.freeze([
  'SPHERE_U', 'SPHERE_GAMMA', 'SPHERE_RHO', 'CYL_LAMBDA', 'CYL_DELTA',
]);
const REQUIRED_LOAD_KEYS = Object.freeze([
  'spherical:P', 'spherical:V1', 'spherical:V2', 'spherical:M1', 'spherical:M2', 'spherical:Mt',
  'cylindrical:P', 'cylindrical:Vc', 'cylindrical:Vl', 'cylindrical:Mc', 'cylindrical:Ml', 'cylindrical:Mt',
]);
const TECHNICAL_AUTHORITY_CLASSES = Object.freeze(['PRIMARY_LICENSED', 'PRIMARY_AUTHORIZED']);

export function evaluateWrc537Ed4SourcePackage({ sourcePackage, sourceLedgerRows, coefficientRows }) {
  requireObject(sourcePackage, 'sourcePackage');
  requireArray(sourceLedgerRows, 'sourceLedgerRows');
  requireArray(coefficientRows, 'coefficientRows');

  const ledgerById = new Map(sourceLedgerRows.map((row) => [row.record_id, row]));
  const gates = [
    gate('PACKAGE_SCHEMA', sourcePackage.schema === WRC537_ED4_SOURCE_PACKAGE_SCHEMA,
      'Package schema must be the Edition 4 intake contract.'),
    gate('SOURCE_LEDGER_IDS_UNIQUE', sourceLedgerIdsUnique(sourceLedgerRows),
      'Every source-ledger record ID must be non-empty and unique.'),
    gate('EDITION_IDENTITY', editionIdentityExact(sourcePackage),
      'Bulletin number, edition and publication date must exactly identify WRC 537 Edition 4 / 2026-02.'),
    gate('CATALOG_IDENTITY_SOURCE', catalogIdentityQualified(sourcePackage, ledgerById),
      'Edition identity must be backed by official publisher/catalog metadata.'),
    gate('PRIMARY_TECHNICAL_SOURCE', primaryTechnicalSourceQualified(sourcePackage, ledgerById),
      'A licensed or otherwise authorized Edition 4 technical source must be retained with digest and ledger custody.'),
    gate('GEOMETRY_COMPLETE', geometryComplete(sourcePackage, ledgerById),
      'Geometry and physical applicability must be explicit and backed by Edition 4 primary technical source custody.'),
    gate('PARAMETERS_COMPLETE', parametersComplete(sourcePackage, ledgerById),
      'All required dimensionless parameter equations, inputs, numerical domains and boundary inclusivity must be source-qualified.'),
    gate('LOAD_CONVENTIONS_COMPLETE', loadConventionsComplete(sourcePackage, ledgerById),
      'All supported force/moment symbols require exact physical direction, positive sign, reference point and primary source custody.'),
    gate('STRESS_RECOVERY_COMPLETE', stressRecoveryComplete(sourcePackage, ledgerById),
      'Stress components, classes, surfaces, recovery locations, reconstruction and source stress measure must be qualified.'),
    gate('INTERPOLATION_POLICY_COMPLETE', interpolationComplete(sourcePackage, ledgerById),
      'Interpolation/extrapolation behavior must be explicit and source-qualified.'),
    gate('COEFFICIENT_INVENTORY_DECLARED', sourcePackage?.coefficients?.inventoryDeclared === true,
      'The Edition 4 coefficient/equation inventory must be explicitly declared complete before numerical rows can qualify.'),
    gate('COEFFICIENT_IDS_UNIQUE', coefficientIdsUnique(coefficientRows),
      'Retained coefficient IDs must be unique within the Edition 4 package.'),
    gate('COEFFICIENTS_COMPLETE', coefficientsComplete(coefficientRows, ledgerById),
      'Every retained Edition 4 coefficient must contain a finite value, source precision and primary technical source locator.'),
    gate('BENCHMARKS_COMPLETE', benchmarksComplete(sourcePackage, ledgerById),
      'At least one target-edition benchmark must retain inputs, expected results, source custody and independent reproduction.'),
    gate('LAFEA_MAPPING_COMPLETE', lafeaMappingComplete(sourcePackage),
      'All consumed geometry, loads and stress outputs must have explicit canonical LAFEA mappings.'),
    gate('NO_UNRESOLVED_TECHNICAL_FIELDS', !containsUnresolvedTechnicalValue(sourcePackage),
      'No technical field consumed by implementation may remain null, TBD, UNRESOLVED, NOT_VERIFIED or equivalent.'),
  ];

  const failedGateIds = gates.filter((row) => row.status === 'FAIL').map((row) => row.gateId);
  return deepFreeze({
    schema: 'wrc537-ed4-source-package-readiness/v1',
    methodIdentity: clone(TARGET_EDITION),
    state: failedGateIds.length ? WRC537_ED4_PACKAGE_BLOCKED : WRC537_ED4_PACKAGE_READY,
    gates,
    failedGateIds,
    statistics: {
      sourceLedgerRows: sourceLedgerRows.length,
      primaryTechnicalLedgerRows: sourceLedgerRows.filter(isPrimaryTechnicalLedgerRow).length,
      coefficientRows: coefficientRows.length,
      qualifiedCoefficientRows: coefficientRows.filter((row) => coefficientQualified(row, ledgerById)).length,
      requiredParameterCount: REQUIRED_PARAMETER_IDS.length,
      requiredLoadConventionCount: REQUIRED_LOAD_KEYS.length,
      benchmarkCount: Array.isArray(sourcePackage?.benchmarks) ? sourcePackage.benchmarks.length : 0,
    },
  });
}

export function normalizeWrc537Ed4SourceDatum(datum, ledgerById) {
  requireObject(datum, 'datum');
  const source = ledgerById instanceof Map ? ledgerById.get(datum.sourceRef) : null;
  const authority = source && isPrimaryTechnicalLedgerRow(source)
    ? 'ED4_PRIMARY_TECHNICAL'
    : 'NON_TECHNICAL_OR_UNVERIFIED';
  return deepFreeze({
    ...clone(datum),
    normalizedAuthority: authority,
    normalizedValueState: resolved(datum.value ?? datum.definition ?? datum.equation)
      ? 'RESOLVED'
      : 'UNRESOLVED',
  });
}

function sourceLedgerIdsUnique(rows) {
  if (rows.length === 0) return false;
  const ids = rows.map((row) => row?.record_id);
  return ids.every(resolved) && new Set(ids).size === ids.length;
}
function editionIdentityExact(pkg) {
  const id = pkg?.identity;
  return id?.bulletinNumber === TARGET_EDITION.bulletinNumber
    && id?.edition === TARGET_EDITION.edition
    && id?.publicationDate === TARGET_EDITION.publicationDate;
}
function catalogIdentityQualified(pkg, ledger) {
  const ref = pkg?.identity?.catalogSourceRef;
  const row = ledger.get(ref);
  return row?.authority_class === 'OFFICIAL_CATALOG_IDENTITY'
    && row?.publisher === 'Welding Research Council, Inc.'
    && resolved(row?.locator)
    && row?.edition === TARGET_EDITION.edition
    && row?.publication_date === TARGET_EDITION.publicationDate
    && row?.verification_status === 'CATALOG_IDENTITY_VERIFIED';
}
function primaryTechnicalSourceQualified(pkg, ledger) {
  const src = pkg?.technicalSource;
  const row = ledger.get(src?.sourceRef);
  return src?.available === true
    && src?.editionVerified === true
    && src?.edition === TARGET_EDITION.edition
    && src?.publicationDate === TARGET_EDITION.publicationDate
    && resolved(src?.sourceId)
    && isDigest(src?.documentDigest)
    && row?.record_id === src.sourceRef
    && isPrimaryTechnicalLedgerRow(row)
    && row?.document_digest === src.documentDigest;
}
function geometryComplete(pkg, ledger) {
  const geometry = pkg?.geometry;
  const rows = geometry?.definitions;
  const applicability = geometry?.applicability;
  return geometry?.inventoryDeclared === true
    && Array.isArray(rows) && rows.length > 0
    && rows.every((row) => resolved(row.symbol) && resolved(row.definition)
      && primaryRef(row.sourceRef, ledger))
    && Array.isArray(applicability?.hostShellFamilies) && applicability.hostShellFamilies.length > 0
    && applicability.hostShellFamilies.every(resolved)
    && Array.isArray(applicability?.attachmentFamilies) && applicability.attachmentFamilies.length > 0
    && applicability.attachmentFamilies.every(resolved)
    && resolved(applicability?.intersectionOrientation)
    && resolved(applicability?.loadReferenceConvention)
    && Array.isArray(applicability?.exclusions) && applicability.exclusions.length > 0
    && applicability.exclusions.every(resolved)
    && primaryRef(applicability?.sourceRef, ledger);
}
function parametersComplete(pkg, ledger) {
  const rows = pkg?.parameters;
  if (!Array.isArray(rows)) return false;
  return REQUIRED_PARAMETER_IDS.every((parameterId) => {
    const row = rows.find((candidate) => candidate?.parameterId === parameterId);
    return row && resolved(row.sourceSymbol) && resolved(row.equation)
      && Array.isArray(row.inputs) && row.inputs.length > 0 && row.inputs.every(resolved)
      && Number.isFinite(row.minimum) && Number.isFinite(row.maximum) && row.minimum <= row.maximum
      && typeof row.minimumInclusive === 'boolean' && typeof row.maximumInclusive === 'boolean'
      && primaryRef(row.sourceRef, ledger);
  });
}
function loadConventionsComplete(pkg, ledger) {
  const rows = pkg?.loads;
  if (!Array.isArray(rows)) return false;
  return REQUIRED_LOAD_KEYS.every((key) => {
    const [family, symbol] = key.split(':');
    const row = rows.find((candidate) => candidate?.family === family && candidate?.sourceSymbol === symbol);
    return row && resolved(row.physicalDirection) && resolved(row.positiveDirection)
      && resolved(row.referencePoint) && primaryRef(row.sourceRef, ledger);
  });
}
function stressRecoveryComplete(pkg, ledger) {
  const stress = pkg?.stressRecovery;
  return stress?.inventoryDeclared === true
    && Array.isArray(stress?.stressComponents) && stress.stressComponents.length > 0
    && stress.stressComponents.every((row) => resolved(row.sourceSymbol) && resolved(row.meaning)
      && resolved(row.stressClass) && primaryRef(row.sourceRef, ledger))
    && Array.isArray(stress?.locations) && stress.locations.length > 0
    && stress.locations.every((row) => resolved(row.locationId) && resolved(row.surface)
      && resolved(row.physicalLocation) && primaryRef(row.sourceRef, ledger))
    && resolved(stress?.surfaceReconstruction?.rule)
    && primaryRef(stress?.surfaceReconstruction?.sourceRef, ledger)
    && resolved(stress?.stressIntensityOrEquivalent?.definition)
    && stress?.stressIntensityOrEquivalent?.dimensionallyVerified === true
    && primaryRef(stress?.stressIntensityOrEquivalent?.sourceRef, ledger);
}
function interpolationComplete(pkg, ledger) {
  const row = pkg?.interpolation;
  return typeof row?.interpolationAuthorized === 'boolean'
    && typeof row?.extrapolationAuthorized === 'boolean'
    && resolved(row?.algorithm)
    && resolved(row?.boundaryBehavior)
    && primaryRef(row?.sourceRef, ledger);
}
function coefficientIdsUnique(rows) {
  const ids = rows.map((row) => row?.coefficient_id);
  return ids.every(resolved) && new Set(ids).size === ids.length;
}
function coefficientsComplete(rows, ledger) {
  return rows.length > 0 && rows.every((row) => coefficientQualified(row, ledger));
}
function coefficientQualified(row, ledger) {
  return row?.method_id === 'WRC537'
    && editionTextMatchesTarget(row?.edition)
    && finite(row?.coefficient_value)
    && resolved(row?.published_precision)
    && resolved(row?.coefficient_id)
    && resolved(row?.source_ref)
    && primaryRef(row.source_ref, ledger)
    && resolved(row?.source_locator)
    && row?.review_status === 'PRIMARY_SOURCE_VERIFIED';
}
function benchmarksComplete(pkg, ledger) {
  const rows = pkg?.benchmarks;
  return Array.isArray(rows) && rows.length > 0 && rows.every((row) =>
    resolved(row.caseId)
    && primaryRef(row.sourceRef, ledger)
    && row.targetEditionPrimarySourceVerified === true
    && row.independentlyReproduced === true
    && row.input && typeof row.input === 'object'
    && Array.isArray(row.expectedResults) && row.expectedResults.length > 0
    && row.expectedResults.every((result) => resolved(result.quantity) && Number.isFinite(result.value)
      && resolved(result.units) && resolved(result.toleranceBasis)));
}
function lafeaMappingComplete(pkg) {
  const map = pkg?.lafeaMapping;
  return map?.qualified === true
    && Array.isArray(map?.geometry) && map.geometry.length > 0 && map.geometry.every(mappingResolved)
    && Array.isArray(map?.loads) && map.loads.length >= REQUIRED_LOAD_KEYS.length && map.loads.every(mappingResolved)
    && Array.isArray(map?.stresses) && map.stresses.length > 0 && map.stresses.every(mappingResolved);
}
function mappingResolved(row) {
  return resolved(row?.sourceQuantity) && resolved(row?.lafeaField) && resolved(row?.mappingType);
}
function containsUnresolvedTechnicalValue(pkg) {
  const technical = {
    technicalSource: pkg?.technicalSource,
    geometry: pkg?.geometry,
    parameters: pkg?.parameters,
    loads: pkg?.loads,
    stressRecovery: pkg?.stressRecovery,
    interpolation: pkg?.interpolation,
    coefficients: pkg?.coefficients,
    benchmarks: pkg?.benchmarks,
    lafeaMapping: pkg?.lafeaMapping,
  };
  return deepHasUnresolved(technical);
}
function deepHasUnresolved(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return !resolved(value);
  if (typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.length === 0 || value.some(deepHasUnresolved);
  return Object.values(value).some(deepHasUnresolved);
}
function primaryRef(sourceRef, ledger) {
  return resolved(sourceRef) && isPrimaryTechnicalLedgerRow(ledger.get(sourceRef));
}
function isPrimaryTechnicalLedgerRow(row) {
  return !!row && TECHNICAL_AUTHORITY_CLASSES.includes(row.authority_class)
    && row.publisher === 'Welding Research Council, Inc.'
    && row.bulletin_number === '537'
    && row.edition === TARGET_EDITION.edition
    && row.publication_date === TARGET_EDITION.publicationDate
    && isDigest(row.document_digest)
    && resolved(row.locator)
    && row.verification_status === 'PRIMARY_SOURCE_VERIFIED';
}
function editionTextMatchesTarget(value) {
  if (!resolved(value)) return false;
  const text = String(value).toLowerCase();
  return /(?:^|\D)4(?:th)?(?:\D|$)/u.test(text) && text.includes('2026');
}
function finite(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (!resolved(value)) return false;
  return Number.isFinite(Number(value));
}
function isDigest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}
function resolved(value) {
  if (typeof value !== 'string') return value !== null && value !== undefined;
  const text = value.trim().toUpperCase();
  return text.length > 0
    && !text.includes('UNRESOLVED')
    && !text.includes('TBD')
    && !text.includes('TO_BE_FILLED')
    && !text.includes('NOT_AVAILABLE')
    && !text.includes('NOT_VERIFIED')
    && !text.includes('UNKNOWN');
}
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
