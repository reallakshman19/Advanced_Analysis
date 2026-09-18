const WRC_LOCATIONS = Object.freeze(['Au', 'Al', 'Bu', 'Bl', 'Cu', 'Cl', 'Du', 'Dl']);

export const EMP1_PROFESSIONAL_RESULT_PRESENTATION_SCHEMA =
  'emp1-professional-result-presentation/v1';
export const EMP1_PROFESSIONAL_WRC_LOCATIONS = WRC_LOCATIONS;

/**
 * Read-only professional presentation over already-governed EMP.1 state.
 * This module grants no method, numerical, code or release authority.
 */
export function buildEmp1ProfessionalResultPresentation({
  execution,
  currentness,
  cState,
  localCorrelation,
} = {}) {
  const currentSnapshot = record(cState?.currentAuthoritySnapshot)
    ? cState.currentAuthoritySnapshot
    : null;
  const registry = record(currentSnapshot?.registry) ? currentSnapshot.registry : null;
  const scope = record(registry?.scope) ? registry.scope : null;
  const method = record(registry?.method) ? registry.method : null;
  const currentReportableResult = cState?.currentResultAvailable === true
    && currentness?.state === 'CURRENT'
    && record(localCorrelation);
  const calculated = currentReportableResult
    && execution?.authority?.boundedLocalRouteExecuted === true;
  const methodQualified = registry?.engineeringUseAuthorized === true;
  const codeCompliant = calculated
    && execution?.authority?.codeComplianceProduced === true;
  const released = calculated
    && execution?.authority?.releaseQualified === true;
  const governing = calculated
    ? governingEightPointStressIntensity(localCorrelation?.stresses?.stressIntensity)
    : unresolvedGoverning('CURRENT_REPORTABLE_CALCULATION_REQUIRED');

  return deepFreeze({
    schema: EMP1_PROFESSIONAL_RESULT_PRESENTATION_SCHEMA,
    status: {
      calculated,
      methodQualified,
      codeCompliant,
      released,
    },
    statusBasis: {
      calculation: calculated
        ? 'CURRENT_REPORTABLE_BOUNDED_C_EXECUTION'
        : 'CURRENT_REPORTABLE_BOUNDED_C_EXECUTION_NOT_ESTABLISHED',
      methodQualification: methodQualified
        ? 'CURRENT_REGISTRY_ENGINEERING_USE_AUTHORIZED'
        : 'CURRENT_REGISTRY_ENGINEERING_USE_NOT_AUTHORIZED',
      codeCompliance: codeCompliant
        ? 'EXPLICIT_EXECUTION_CODE_COMPLIANCE_PRODUCED'
        : 'NOT_ASSESSED_OR_NOT_PRODUCED',
      release: released
        ? 'EXPLICIT_EXECUTION_RELEASE_QUALIFIED'
        : 'NOT_RELEASE_QUALIFIED',
    },
    governing,
    domain: {
      routeId: currentSnapshot?.routeId ?? null,
      methodIdentity: method?.identity ?? null,
      edition: method?.edition ?? null,
      sourceDocumentSha256: method?.sourceDocumentSha256 ?? null,
      datasetHash: method?.datasetHash ?? null,
      qualificationRecordSha256: method?.qualificationRecordSha256 ?? null,
      shellFamily: scope?.shellFamily ?? null,
      attachmentShape: scope?.attachmentShape ?? null,
      variant: scope?.variant ?? null,
      gamma: finiteOrNull(scope?.gamma),
      betaMinimum: finiteOrNull(scope?.betaMinimum),
      betaMaximum: finiteOrNull(scope?.betaMaximum),
      differentialPressure: finiteOrNull(scope?.differentialPressure),
      Kn: finiteOrNull(scope?.Kn),
      Kb: finiteOrNull(scope?.Kb),
      interpolationAllowed: booleanOrNull(scope?.interpolationAllowed),
      crossVariantFallbackAllowed: booleanOrNull(scope?.crossVariantFallbackAllowed),
      stressOutputDomain: scope?.stressOutputDomain ?? null,
      attachmentStressCalculated: booleanOrNull(scope?.attachmentStressCalculated),
      nozzleStressCalculated: booleanOrNull(scope?.nozzleStressCalculated),
      evaluatedStressLocations: scope?.evaluatedStressLocations ?? null,
      eightPointEnvelopeBasis: scope?.eightPointEnvelopeBasis ?? null,
      absoluteShellMaximumAssured: booleanOrNull(scope?.absoluteShellMaximumAssured),
      continuousJunctureSearchPerformed:
        booleanOrNull(scope?.continuousJunctureSearchPerformed),
    },
    currentBlockers: uniqueText(cState?.blockerCodes),
    routeLimitations: uniqueText(registry?.limitations),
    unsupportedDomain: uniqueText(registry?.remainingBlocked),
  });
}

/**
 * Typographic form of a governed unit token. The retained token stays
 * authoritative; this only substitutes superscripts and middots for the ASCII
 * spelling carried by the numerics contract.
 */
const UNIT_DISPLAY = Object.freeze({
  'N/mm^2': 'N/mm²',
  'N*mm': 'N·mm',
});

export function emp1UnitLabel(token) {
  if (typeof token !== 'string' || token === '') return null;
  return UNIT_DISPLAY[token] ?? token;
}

/**
 * Column/row label carrying its governed unit. A missing unit is stated rather
 * than silently omitted, because an unlabelled stress cannot be checked.
 */
export function emp1UnitedLabel(label, token) {
  const unit = emp1UnitLabel(token);
  return `${label} (${unit ?? 'unit unresolved'})`;
}

/**
 * Engineer-facing stress magnitude at four significant figures. The exact
 * retained value travels beside it (data-emp1-exact-value and the full-precision
 * disclosure); display rounding is never calculation authority.
 */
export function emp1StressDisplayNumber(value) {
  if (!Number.isFinite(value)) return '—';
  return Number(value.toPrecision(4)).toString();
}

/** Exact retained magnitude, unrounded, for technical disclosure and export. */
export function emp1StressExactNumber(value) {
  if (!Number.isFinite(value)) return '—';
  return String(value);
}

export function governingEightPointStressIntensity(values) {
  if (!Array.isArray(values) || values.length !== WRC_LOCATIONS.length
    || values.some((value) => !Number.isFinite(value))) {
    return unresolvedGoverning('EXACT_EIGHT_FINITE_STRESS_INTENSITIES_REQUIRED');
  }
  let index = 0;
  for (let candidate = 1; candidate < values.length; candidate += 1) {
    if (values[candidate] > values[index]) index = candidate;
  }
  return deepFreeze({
    state: 'AVAILABLE',
    basis: 'MAXIMUM_STRESS_INTENSITY_OVER_EIGHT_EVALUATED_WRC_POINTS_ONLY',
    location: WRC_LOCATIONS[index],
    locationIndex: index,
    stressIntensity: values[index],
    evaluatedLocations: [...WRC_LOCATIONS],
    globalShellMaximumClaim: false,
  });
}

function unresolvedGoverning(reason) {
  return deepFreeze({
    state: 'UNRESOLVED',
    reason,
    basis: 'EIGHT_EVALUATED_WRC_POINTS_ONLY',
    location: null,
    locationIndex: null,
    stressIntensity: null,
    evaluatedLocations: [...WRC_LOCATIONS],
    globalShellMaximumClaim: false,
  });
}

function record(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function booleanOrNull(value) {
  return typeof value === 'boolean' ? value : null;
}

function uniqueText(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))];
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}
