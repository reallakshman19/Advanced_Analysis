export const EMP1_APPLICABILITY_SUMMARY_SCHEMA = 'emp1-applicability-summary/v1';

const APPLICABILITY_SCHEMA = 'emp1-wrc537-cylindrical-applicability/v1';
const SUPPORTED_STATUSES = new Set([
  'PASS_WRC537_4_5_SOURCE_LIMITS_QUALIFIED',
  'PASS_WRC537_4_5_SOURCE_LIMITS_COMPARISON_ONLY',
  'INCOMPLETE_WRC537_4_5_SOURCE_EVIDENCE',
  'OUTSIDE_WRC537_4_5_SOURCE_LIMITS',
]);

/**
 * Project an already-evaluated EMP.1/WRC applicability result into a compact
 * engineering-governance summary. This module does not inspect source geometry,
 * transform loads, evaluate WRC rules, calculate ratios, or create authority.
 */
export function projectEmp1ApplicabilitySummary(applicabilityResult) {
  const result = requireApplicability(applicabilityResult);
  return deepFreeze({
    schema: EMP1_APPLICABILITY_SUMMARY_SCHEMA,
    productId: 'EMP.1',
    methodFamily: 'WRC537_CYLINDRICAL',
    status: result.status,
    existingAuthority: {
      comparisonApplicabilitySatisfied: boolean(
        result.comparisonApplicabilitySatisfied,
        'EMP1_APPLICABILITY_COMPARISON_STATE_REQUIRED',
      ),
      engineeringUseAuthorized: boolean(
        result.engineeringUseAuthorized,
        'EMP1_APPLICABILITY_ENGINEERING_AUTHORITY_REQUIRED',
      ),
      productionUseAuthorized: boolean(
        result.productionUseAuthorized,
        'EMP1_APPLICABILITY_PRODUCTION_AUTHORITY_REQUIRED',
      ),
    },
    source: projectSource(result),
    evaluatedCase: {
      meanRadius: finite(result.meanRadius, 'EMP1_APPLICABILITY_MEAN_RADIUS_REQUIRED'),
      loadsConsidered: projectLoads(result.loadsConsidered),
      evidence: projectEvidence(result.evidence),
    },
    rules: {
      radialLoad: projectRule(result.rules?.radialLoad, 'RADIAL_LOAD'),
      externalMoment: projectRule(result.rules?.externalMoment, 'EXTERNAL_MOMENT'),
    },
    reasons: stringArray(result.reasons),
    stressScope: projectStressScope(result.stressScope),
    authorityBoundary: {
      projectionOnly: true,
      consumesExistingApplicabilityResult: true,
      evaluatesGeometry: false,
      evaluatesLoads: false,
      evaluatesSourceLimits: false,
      calculatesRatios: false,
      createsEngineeringAuthority: false,
      createsMethodAuthority: false,
      createsApplicabilityAuthority: false,
      createsNumericalAuthority: false,
      createsCodeCompliance: false,
      createsReleaseAuthority: false,
    },
  });
}

function requireApplicability(value) {
  const result = record(value, 'EMP1_APPLICABILITY_RESULT_REQUIRED');
  if (result.schema !== APPLICABILITY_SCHEMA) {
    throw summaryError('EMP1_APPLICABILITY_RESULT_SCHEMA_INVALID');
  }
  if (!SUPPORTED_STATUSES.has(result.status)) {
    throw summaryError(`EMP1_APPLICABILITY_STATUS_UNSUPPORTED:${String(result.status)}`);
  }
  return result;
}

function projectSource(result) {
  return Object.freeze({
    qualification: text(result.sourceQualification),
    authoritySemanticHash: nullableText(result.sourceAuthoritySemanticHash),
    authorityHashRetained: Boolean(result.sourceAuthoritySemanticHash),
  });
}

function projectLoads(value) {
  const loads = record(value, 'EMP1_APPLICABILITY_LOADS_CONSIDERED_REQUIRED');
  return Object.freeze({
    P: finite(loads.P, 'EMP1_APPLICABILITY_LOAD_P_REQUIRED'),
    Mc: finite(loads.Mc, 'EMP1_APPLICABILITY_LOAD_MC_REQUIRED'),
    Ml: finite(loads.Ml, 'EMP1_APPLICABILITY_LOAD_ML_REQUIRED'),
  });
}

function projectEvidence(value) {
  if (value == null) return null;
  const evidence = record(value, 'EMP1_APPLICABILITY_EVIDENCE_INVALID');
  return Object.freeze({
    cylinderLength: finiteOrNull(evidence.cylinderLength),
    nearestCylinderEndDistance: finiteOrNull(evidence.nearestCylinderEndDistance),
    basisAuthority: nullableText(evidence.basisAuthority),
    sourceQualification: nullableText(evidence.sourceQualification),
    sourceReferences: projectSourceReferences(evidence.sourceReferences),
  });
}

function projectSourceReferences(value) {
  if (value == null) return null;
  const refs = record(value, 'EMP1_APPLICABILITY_SOURCE_REFERENCES_INVALID');
  return Object.freeze({
    cylinderLength: nullableText(refs.cylinderLength),
    nearestCylinderEndDistance: nullableText(refs.nearestCylinderEndDistance),
  });
}

function projectRule(value, label) {
  const rule = record(value, `EMP1_APPLICABILITY_${label}_RULE_REQUIRED`);
  return Object.freeze({
    sourceSection: text(rule.sourceSection),
    status: text(rule.status),
    limit: text(rule.limit),
    actualRatio: finiteOrNull(rule.actualRatio),
    minimumRatio: finite(rule.minimumRatio, `EMP1_APPLICABILITY_${label}_MINIMUM_RATIO_REQUIRED`),
    cylinderLength: finiteOrNull(rule.cylinderLength),
    nearestCylinderEndDistance: finiteOrNull(rule.nearestCylinderEndDistance),
  });
}

function projectStressScope(value) {
  const scope = record(value, 'EMP1_APPLICABILITY_STRESS_SCOPE_REQUIRED');
  return Object.freeze({
    domain: text(scope.domain),
    shellStressesCalculated: boolean(
      scope.shellStressesCalculated,
      'EMP1_APPLICABILITY_SHELL_STRESS_SCOPE_REQUIRED',
    ),
    attachmentStressesCalculated: boolean(
      scope.attachmentStressesCalculated,
      'EMP1_APPLICABILITY_ATTACHMENT_STRESS_SCOPE_REQUIRED',
    ),
    nozzleStressesCalculated: boolean(
      scope.nozzleStressesCalculated,
      'EMP1_APPLICABILITY_NOZZLE_STRESS_SCOPE_REQUIRED',
    ),
    recoveryLocation: text(scope.recoveryLocation),
    sourceSection: text(scope.sourceSection),
  });
}

function record(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw summaryError(code);
  return value;
}

function boolean(value, code) {
  if (typeof value !== 'boolean') throw summaryError(code);
  return value;
}

function text(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw summaryError('EMP1_APPLICABILITY_TEXT_REQUIRED');
  }
  return value;
}

function nullableText(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function finite(value, code) {
  if (!Number.isFinite(value)) throw summaryError(code);
  return Number(value);
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function stringArray(value) {
  return Object.freeze(Array.isArray(value) ? [...new Set(value.map(String))] : []);
}

function summaryError(code) {
  const error = new TypeError(code);
  error.code = code;
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
