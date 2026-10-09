export const WRC537_ED4_SOURCE_PACKAGE_SCHEMA = 'wrc537-ed4-source-package/v1';
export const WRC537_ED4_PACKAGE_READY = 'READY_FOR_TECHNICAL_IMPLEMENTATION';
export const WRC537_ED4_PACKAGE_BLOCKED = 'BLOCKED';

const TARGET_EDITION = Object.freeze({
  bulletinNumber: 'WRC Bulletin 537',
  edition: '4',
  publicationDate: '2026-02',
});
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

  const ledgerById = new Map(sourceLedgerRows.map((row) => [row?.record_id, row]));
  const sourceDigest = sourcePackage?.technicalSource?.documentDigest;
  const gates = [
    gate('PACKAGE_SCHEMA', sourcePackage.schema === WRC537_ED4_SOURCE_PACKAGE_SCHEMA,
      'Package schema must be the Edition 4 intake contract.'),
    gate('SOURCE_LEDGER_IDS_UNIQUE', sourceLedgerIdsUnique(sourceLedgerRows),
      'Every source-ledger record ID must be non-empty and unique.'),
    gate('EDITION_IDENTITY', editionIdentityExact(sourcePackage),
      'Bulletin number, edition and publication date must exactly identify WRC 537 Edition 4 / 2026-02.'),
    gate('CATALOG_IDENTITY_SOURCE', catalogIdentityQualified(sourcePackage, ledgerById),
      'Edition identity must be backed by a DOCUMENT_IDENTITY publisher/catalog row.'),
    gate('PRIMARY_TECHNICAL_SOURCE', primaryTechnicalSourceQualified(sourcePackage, ledgerById),
      'A licensed or otherwise authorized Edition 4 DOCUMENT row must retain exact source digest custody.'),
    gate('DATUM_SOURCE_CUSTODY_COMPLETE', technicalDatumCustodyComplete(sourcePackage, coefficientRows, ledgerById),
      'Every consumed technical statement must resolve to an Edition 4 primary-verified DATUM row bound to the exact authorized source digest and locator.'),
    gate('GEOMETRY_COMPLETE', geometryComplete(sourcePackage, ledgerById),
      'Geometry and physical applicability must be explicit and backed by datum-level Edition 4 source custody.'),
    gate('PARAMETERS_COMPLETE', parametersComplete(sourcePackage, ledgerById),
      'All required dimensionless parameter equations require unique IDs, non-degenerate domains, bound inclusivity and datum custody.'),
    gate('LOAD_CONVENTIONS_COMPLETE', loadConventionsComplete(sourcePackage, ledgerById),
      'All twelve supported force/moment conventions require unique identities, exact signs/reference points and datum custody.'),
    gate('STRESS_RECOVERY_COMPLETE', stressRecoveryComplete(sourcePackage, ledgerById),
      'Stress components, classes, surfaces, recovery locations, reconstruction and source stress measure must be datum-qualified.'),
    gate('INTERPOLATION_POLICY_COMPLETE', interpolationComplete(sourcePackage, ledgerById),
      'Interpolation/extrapolation behavior must be explicit and datum-qualified.'),
    gate('COEFFICIENT_INVENTORY_DECLARED', sourcePackage?.coefficients?.inventoryDeclared === true,
      'The Edition 4 coefficient/equation inventory must be explicitly declared complete before numerical rows can qualify.'),
    gate('COEFFICIENT_IDS_UNIQUE', coefficientIdsUnique(coefficientRows),
      'Retained coefficient IDs must be non-empty and unique within the Edition 4 package.'),
    gate('COEFFICIENTS_COMPLETE', coefficientsComplete(coefficientRows, ledgerById, sourceDigest),
      'Every retained Edition 4 coefficient must contain a finite value, source precision and exact datum locator from the authorized source digest.'),
    gate('BENCHMARKS_COMPLETE', benchmarksComplete(sourcePackage, ledgerById),
      'Every target-edition benchmark must source-bind all numeric input leaves with units/locators, retain source-qualified expected results and independent reproduction evidence.'),
    gate('LAFEA_MAPPING_COMPLETE', lafeaMappingComplete(sourcePackage),
      'Canonical LAFEA mappings must be qualified, unique, and cover every mandatory WRC load identity exactly once.'),
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
      primaryTechnicalDocumentRows: sourceLedgerRows.filter(isPrimaryTechnicalDocumentRow).length,
      primaryDatumRows: sourceLedgerRows.filter((row) => isPrimaryDatumLedgerRow(row)
        && row.document_digest === sourceDigest).length,
      coefficientRows: coefficientRows.length,
      qualifiedCoefficientRows: coefficientRows.filter((row) => coefficientQualified(row, ledgerById, sourceDigest)).length,
      requiredParameterCount: REQUIRED_PARAMETER_IDS.length,
      requiredLoadConventionCount: REQUIRED_LOAD_KEYS.length,
      benchmarkCount: Array.isArray(sourcePackage?.benchmarks) ? sourcePackage.benchmarks.length : 0,
    },
  });
}

export function normalizeWrc537Ed4SourceDatum(datum, ledgerById) {
  requireObject(datum, 'datum');
  const source = ledgerById instanceof Map ? ledgerById.get(datum.sourceRef) : null;
  let authority = 'NON_TECHNICAL_OR_UNVERIFIED';
  if (isPrimaryDatumLedgerRow(source)) authority = 'ED4_PRIMARY_DATUM';
  else if (isPrimaryTechnicalDocumentRow(source)) authority = 'ED4_PRIMARY_TECHNICAL_DOCUMENT';
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
  const row = ledger.get(pkg?.identity?.catalogSourceRef);
  return row?.record_scope === 'DOCUMENT_IDENTITY'
    && resolved(row?.engineering_subject)
    && row?.authority_class === 'OFFICIAL_CATALOG_IDENTITY'
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
    && resolved(src?.accessBasis)
    && isDigest(src?.documentDigest)
    && row?.record_id === src.sourceRef
    && isPrimaryTechnicalDocumentRow(row)
    && row?.document_digest === src.documentDigest;
}

function technicalDatumCustodyComplete(pkg, coefficientRows, ledger) {
  const expectedDigest = pkg?.technicalSource?.documentDigest;
  if (!isDigest(expectedDigest)) return false;
  const refs = [];
  const push = (sourceRef) => refs.push(sourceRef);
  (pkg?.geometry?.definitions ?? []).forEach((row) => push(row?.sourceRef));
  push(pkg?.geometry?.applicability?.sourceRef);
  (pkg?.parameters ?? []).forEach((row) => push(row?.sourceRef));
  (pkg?.loads ?? []).forEach((row) => push(row?.sourceRef));
  (pkg?.stressRecovery?.stressComponents ?? []).forEach((row) => push(row?.sourceRef));
  (pkg?.stressRecovery?.locations ?? []).forEach((row) => push(row?.sourceRef));
  push(pkg?.stressRecovery?.surfaceReconstruction?.sourceRef);
  push(pkg?.stressRecovery?.stressIntensityOrEquivalent?.sourceRef);
  push(pkg?.interpolation?.sourceRef);
  (pkg?.benchmarks ?? []).forEach((row) => {
    push(row?.sourceRef);
    (row?.inputEvidence ?? []).forEach((input) => push(input?.sourceRef));
    (row?.expectedResults ?? []).forEach((result) => push(result?.sourceRef));
  });
  coefficientRows.forEach((row) => push(row?.source_ref));
  return refs.length > 0 && refs.every((sourceRef) => datumRef(sourceRef, ledger, expectedDigest));
}

function geometryComplete(pkg, ledger) {
  const expectedDigest = pkg?.technicalSource?.documentDigest;
  const geometry = pkg?.geometry;
  const rows = geometry?.definitions;
  const applicability = geometry?.applicability;
  const symbols = Array.isArray(rows) ? rows.map((row) => row?.symbol) : [];
  return geometry?.inventoryDeclared === true
    && Array.isArray(rows) && rows.length > 0
    && symbols.every(resolved) && new Set(symbols).size === symbols.length
    && rows.every((row) => resolved(row.definition) && datumRef(row.sourceRef, ledger, expectedDigest))
    && Array.isArray(applicability?.hostShellFamilies) && applicability.hostShellFamilies.length > 0
    && applicability.hostShellFamilies.every(resolved)
    && Array.isArray(applicability?.attachmentFamilies) && applicability.attachmentFamilies.length > 0
    && applicability.attachmentFamilies.every(resolved)
    && resolved(applicability?.intersectionOrientation)
    && resolved(applicability?.loadReferenceConvention)
    && Array.isArray(applicability?.exclusions) && applicability.exclusions.length > 0
    && applicability.exclusions.every(resolved)
    && datumRef(applicability?.sourceRef, ledger, expectedDigest);
}

function parametersComplete(pkg, ledger) {
  const expectedDigest = pkg?.technicalSource?.documentDigest;
  const rows = pkg?.parameters;
  if (!Array.isArray(rows)) return false;
  const ids = rows.map((row) => row?.parameterId);
  if (!ids.every(resolved) || new Set(ids).size !== ids.length) return false;
  return REQUIRED_PARAMETER_IDS.every((parameterId) => {
    const row = rows.find((candidate) => candidate?.parameterId === parameterId);
    return row && resolved(row.sourceSymbol) && resolved(row.equation)
      && Array.isArray(row.inputs) && row.inputs.length > 0 && row.inputs.every(resolved)
      && Number.isFinite(row.minimum) && Number.isFinite(row.maximum) && row.minimum < row.maximum
      && typeof row.minimumInclusive === 'boolean' && typeof row.maximumInclusive === 'boolean'
      && datumRef(row.sourceRef, ledger, expectedDigest);
  });
}

function loadConventionsComplete(pkg, ledger) {
  const expectedDigest = pkg?.technicalSource?.documentDigest;
  const rows = pkg?.loads;
  if (!Array.isArray(rows)) return false;
  const keys = rows.map((row) => `${row?.family}:${row?.sourceSymbol}`);
  if (new Set(keys).size !== keys.length) return false;
  return REQUIRED_LOAD_KEYS.every((key) => {
    const [family, symbol] = key.split(':');
    const row = rows.find((candidate) => candidate?.family === family && candidate?.sourceSymbol === symbol);
    return row && resolved(row.physicalDirection) && resolved(row.positiveDirection)
      && resolved(row.referencePoint) && datumRef(row.sourceRef, ledger, expectedDigest);
  });
}

function stressRecoveryComplete(pkg, ledger) {
  const expectedDigest = pkg?.technicalSource?.documentDigest;
  const stress = pkg?.stressRecovery;
  const componentIds = (stress?.stressComponents ?? []).map((row) => row?.sourceSymbol);
  const locationIds = (stress?.locations ?? []).map((row) => row?.locationId);
  return stress?.inventoryDeclared === true
    && Array.isArray(stress?.stressComponents) && stress.stressComponents.length > 0
    && componentIds.every(resolved) && new Set(componentIds).size === componentIds.length
    && stress.stressComponents.every((row) => resolved(row.meaning)
      && resolved(row.stressClass) && datumRef(row.sourceRef, ledger, expectedDigest))
    && Array.isArray(stress?.locations) && stress.locations.length > 0
    && locationIds.every(resolved) && new Set(locationIds).size === locationIds.length
    && stress.locations.every((row) => resolved(row.surface)
      && resolved(row.physicalLocation) && datumRef(row.sourceRef, ledger, expectedDigest))
    && resolved(stress?.surfaceReconstruction?.rule)
    && datumRef(stress?.surfaceReconstruction?.sourceRef, ledger, expectedDigest)
    && resolved(stress?.stressIntensityOrEquivalent?.definition)
    && stress?.stressIntensityOrEquivalent?.dimensionallyVerified === true
    && datumRef(stress?.stressIntensityOrEquivalent?.sourceRef, ledger, expectedDigest);
}

function interpolationComplete(pkg, ledger) {
  const expectedDigest = pkg?.technicalSource?.documentDigest;
  const row = pkg?.interpolation;
  return typeof row?.interpolationAuthorized === 'boolean'
    && typeof row?.extrapolationAuthorized === 'boolean'
    && resolved(row?.algorithm)
    && resolved(row?.boundaryBehavior)
    && datumRef(row?.sourceRef, ledger, expectedDigest);
}

function coefficientIdsUnique(rows) {
  if (rows.length === 0) return true;
  const ids = rows.map((row) => row?.coefficient_id);
  return ids.every(resolved) && new Set(ids).size === ids.length;
}

function coefficientsComplete(rows, ledger, expectedDigest) {
  return rows.length > 0 && rows.every((row) => coefficientQualified(row, ledger, expectedDigest));
}

function coefficientQualified(row, ledger, expectedDigest) {
  const source = ledger.get(row?.source_ref);
  return row?.method_id === 'WRC537'
    && editionTextMatchesTarget(row?.edition)
    && finite(row?.coefficient_value)
    && resolved(row?.published_precision)
    && resolved(row?.coefficient_id)
    && datumRef(row?.source_ref, ledger, expectedDigest)
    && resolved(row?.source_locator)
    && source?.locator === row.source_locator
    && row?.review_status === 'PRIMARY_SOURCE_VERIFIED';
}

function benchmarksComplete(pkg, ledger) {
  const expectedDigest = pkg?.technicalSource?.documentDigest;
  const rows = pkg?.benchmarks;
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const ids = rows.map((row) => row?.caseId);
  if (!ids.every(resolved) || new Set(ids).size !== ids.length) return false;
  return rows.every((row) =>
    datumRef(row.sourceRef, ledger, expectedDigest)
    && row.targetEditionPrimarySourceVerified === true
    && row.independentlyReproduced === true
    && resolved(row.independentCalculationReference)
    && benchmarkInputEvidenceComplete(row, ledger, expectedDigest)
    && Array.isArray(row.expectedResults) && row.expectedResults.length > 0
    && row.expectedResults.every((result) => {
      const source = ledger.get(result?.sourceRef);
      return resolved(result.quantity)
        && Number.isFinite(result.value)
        && resolved(result.units)
        && Number.isFinite(result.absoluteTolerance) && result.absoluteTolerance >= 0
        && resolved(result.toleranceBasis)
        && datumRef(result.sourceRef, ledger, expectedDigest)
        && resolved(result.sourceLocator)
        && source?.locator === result.sourceLocator;
    }));
}

function benchmarkInputEvidenceComplete(benchmark, ledger, expectedDigest) {
  const input = benchmark?.input;
  const evidence = benchmark?.inputEvidence;
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || !Array.isArray(evidence) || evidence.length === 0) return false;
  const ids = evidence.map((row) => row?.inputId);
  if (!ids.every(resolved) || new Set(ids).size !== ids.length) return false;

  const expectedPaths = benchmarkNumericLeafPaths(input).map(pathKey).sort();
  const actualPaths = [];
  const valid = evidence.every((row) => {
    const source = ledger.get(row?.sourceRef);
    const pathValue = benchmarkNumericPath(input, row?.benchmarkPath);
    if (!pathValue.found) return false;
    actualPaths.push(pathKey(row.benchmarkPath));
    return resolved(row.units)
      && datumRef(row.sourceRef, ledger, expectedDigest)
      && resolved(row.sourceLocator)
      && source?.locator === row.sourceLocator;
  });
  return valid
    && new Set(actualPaths).size === actualPaths.length
    && actualPaths.sort().join('|') === expectedPaths.join('|');
}

function benchmarkNumericLeafPaths(value, path = [], rows = []) {
  if (Number.isFinite(value)) {
    rows.push(path);
    return rows;
  }
  if (!value || typeof value !== 'object') return rows;
  if (Array.isArray(value)) {
    value.forEach((child, index) => benchmarkNumericLeafPaths(child, [...path, index], rows));
  } else {
    Object.keys(value).sort().forEach((key) =>
      benchmarkNumericLeafPaths(value[key], [...path, key], rows));
  }
  return rows;
}

function benchmarkNumericPath(root, segments) {
  if (!Array.isArray(segments) || segments.length === 0) return { found: false };
  let value = root;
  for (const segment of segments) {
    const validString = typeof segment === 'string' && segment.trim().length > 0;
    const validIndex = Number.isInteger(segment) && segment >= 0;
    if (!validString && !validIndex) return { found: false };
    if (value === null || value === undefined || typeof value !== 'object' || !(segment in value)) {
      return { found: false };
    }
    value = value[segment];
  }
  return Number.isFinite(value) ? { found: true, value } : { found: false };
}

function pathKey(segments) {
  return JSON.stringify(segments);
}

function lafeaMappingComplete(pkg) {
  const map = pkg?.lafeaMapping;
  if (map?.qualified !== true) return false;
  if (!mappingArrayResolvedUnique(map.geometry) || !mappingArrayResolvedUnique(map.loads)
    || !mappingArrayResolvedUnique(map.stresses)) return false;
  const loadQuantities = new Set(map.loads.map((row) => row.sourceQuantity));
  return REQUIRED_LOAD_KEYS.every((key) => loadQuantities.has(key));
}

function mappingArrayResolvedUnique(rows) {
  if (!Array.isArray(rows) || rows.length === 0 || !rows.every(mappingResolved)) return false;
  const quantities = rows.map((row) => row.sourceQuantity);
  return new Set(quantities).size === quantities.length;
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

function datumRef(sourceRef, ledger, expectedDigest) {
  if (!isDigest(expectedDigest) || !resolved(sourceRef)) return false;
  const row = ledger.get(sourceRef);
  return isPrimaryDatumLedgerRow(row) && row.document_digest === expectedDigest;
}

function isPrimaryTechnicalDocumentRow(row) {
  return isPrimaryTechnicalBaseRow(row)
    && row.record_scope === 'DOCUMENT'
    && resolved(row.engineering_subject);
}

function isPrimaryDatumLedgerRow(row) {
  return isPrimaryTechnicalBaseRow(row)
    && row.record_scope === 'DATUM'
    && resolved(row.engineering_subject);
}

function isPrimaryTechnicalBaseRow(row) {
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
