import { semanticHash } from '../shared-primitives/canonical-json.js';
import { reconstructResultHashes } from '../local-stress/index.js';
import {
  EMP1_A_WRC_ZERO_DP_PRODUCER_QUALIFICATION_SHA256,
  createEmp1AZeroDpWrcQualifiedLoadCustody,
  deriveEmp1AZeroDpWrcLoadPackageCandidate,
} from './emp1-a-wrc-zero-dp-load-producer.js';
import {
  EMP1_WRC537_BOUNDED_DATASET_HASH,
  EMP1_WRC537_BOUNDED_GAMMA,
  EMP1_WRC537_BOUNDED_SOURCE_SHA256,
  EMP1_WRC537_BOUNDED_VARIANT,
} from './emp1-wrc537-cylindrical-bounded-domain.js';
import {
  requireEmp1Wrc537QualifiedCylindricalAxisAuthority,
} from './emp1-wrc537-cylindrical-axis-authority.js';
import { buildEmp1Wrc537CylindricalFrame } from './emp1-wrc537-cylindrical-frame.js';
import {
  requireEmp1Wrc537QualifiedApplicabilitySourceAuthority,
} from './emp1-wrc537-applicability-source-authority.js';
import {
  deriveEmp1Wrc537SourceCustody,
  requireEmp1Wrc537QualifiedR0SourceCustody,
  requireEmp1Wrc537SourceCustody,
} from './emp1-wrc537-source-custody.js';
import {
  EMP1_WRC537_GAMMA5_ZERO_DP_BENCHMARK_QUALIFICATION,
  EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION,
  runEmp1Wrc537Gamma5ZeroDpRoute,
} from './emp1-wrc537-gamma5-zero-dp-route.js';

export const EMP1_WRC537_GAMMA5_ZERO_DP_ORCHESTRATION_REQUEST_SCHEMA =
  'emp1-wrc537-gamma5-zero-dp-orchestration-request/v2';
export const EMP1_WRC537_GAMMA5_ZERO_DP_LOAD_LAYER_SCHEMA =
  'emp1-a-retained-foundation-layer/v1';

const REQUEST_KEYS = Object.freeze([
  'schema',
  'loadCaseIdentity',
  'pressureResultIdentity',
]);
const EXACT_GAMMA_POLICY = 'EXACT_SOURCE_TABULATED_GAMMA_ONLY';

export function createEmp1RetainedFoundationLayer(foundationResult) {
  const result = requireQualifiedFoundationResult(foundationResult);
  return deepFreeze({
    schema: EMP1_WRC537_GAMMA5_ZERO_DP_LOAD_LAYER_SCHEMA,
    qualification: 'PASS',
    resultHash: result.semanticHashes.resultPayloadSemanticHash,
    reasons: [],
    foundationResult: result,
  });
}

export function prepareEmp1Wrc537Gamma5ZeroDpLocalSource({
  source,
  loadTransfer,
  sectionScreening,
} = {}) {
  if (!record(source)) throw orchestrationError('EMP1_WRC537_ZERO_DP_ORCHESTRATION_SOURCE_REQUIRED');
  const request = requireRequest(source?.localMethod?.routeRequest);
  const applicabilitySourceAuthority = source?.localMethod?.applicabilitySourceAuthority == null
    ? null
    : requireEmp1Wrc537QualifiedApplicabilitySourceAuthority(
      source.localMethod.applicabilitySourceAuthority,
    );
  const foundationResult = requireFoundationResult(loadTransfer);
  const sourceCustody = deriveEmp1Wrc537SourceCustody({
    foundationResult,
    sectionScreening,
    loadCaseIdentity: request.loadCaseIdentity,
  });

  const loadCandidate = deriveEmp1AZeroDpWrcLoadPackageCandidate({
    result: foundationResult,
    loadCaseIdentity: request.loadCaseIdentity,
    pressureResultIdentity: request.pressureResultIdentity,
    wrcReferencePointGlobal: sourceCustody.loadReference.pointGlobal,
    productionObservationUsedToSetAuthority: false,
  });
  const loadCustody = createEmp1AZeroDpWrcQualifiedLoadCustody(loadCandidate);

  const prepared = structuredClone(source);
  prepared.localMethod = {
    requested: true,
    routeRequest: structuredClone(request),
    sourceSha256: EMP1_WRC537_BOUNDED_SOURCE_SHA256,
    datasetHash: EMP1_WRC537_BOUNDED_DATASET_HASH,
    shellFamily: 'CYLINDRICAL',
    attachmentShape: 'ROUND',
    gammaSelectionPolicy: EXACT_GAMMA_POLICY,
    sourceParameterResolved: true,
    interpolationUsed: false,
    extrapolationFallbackUsed: false,
    variant: EMP1_WRC537_BOUNDED_VARIANT,
    gamma: sourceCustody.geometry.gamma,
    sourceGamma: EMP1_WRC537_BOUNDED_GAMMA,
    beta: sourceCustody.geometry.beta,
    loadCustody,
    wrcSourceCustody: sourceCustody,
    applicabilitySourceAuthority,
  };
  return deepFreeze(prepared);
}

export function runEmp1Wrc537Gamma5ZeroDpLocalCorrelation({
  source,
  loadTransfer,
  sectionScreening,
  gate,
} = {}) {
  if (gate?.state !== 'METHOD_QUALIFIED' || gate?.engineeringUseAuthorized !== true) {
    throw orchestrationError('EMP1_WRC537_ZERO_DP_ORCHESTRATION_GATE_NOT_QUALIFIED');
  }
  const request = requireRequest(source?.localMethod?.routeRequest);
  const applicabilitySourceAuthority = requireEmp1Wrc537QualifiedApplicabilitySourceAuthority(
    source?.localMethod?.applicabilitySourceAuthority,
  );
  const foundationResult = requireFoundationResult(loadTransfer);
  const preparedCustody = requireEmp1Wrc537SourceCustody(
    source?.localMethod?.wrcSourceCustody,
  );
  const executionCustody = deriveEmp1Wrc537SourceCustody({
    foundationResult,
    sectionScreening,
    loadCaseIdentity: request.loadCaseIdentity,
  });
  if (semanticHash(preparedCustody) !== semanticHash(executionCustody)) {
    throw orchestrationError('EMP1_WRC537_ZERO_DP_SOURCE_CUSTODY_DRIFT');
  }
  const qualifiedCustody = requireEmp1Wrc537QualifiedR0SourceCustody(
    executionCustody,
  );
  const axisAuthority = requireEmp1Wrc537QualifiedCylindricalAxisAuthority(
    qualifiedCustody.wrcAxisAuthority,
  );
  buildEmp1Wrc537CylindricalFrame(axisAuthority.frameInput);

  const routeResult = runEmp1Wrc537Gamma5ZeroDpRoute({
    loadTransferResult: foundationResult,
    loadCaseIdentity: request.loadCaseIdentity,
    pressureResultIdentity: request.pressureResultIdentity,
    wrcReferencePointGlobal: qualifiedCustody.loadReference.pointGlobal,
    geometry: qualifiedCustody.geometry,
    axisAuthority,
    attachmentSourceAuthority: qualifiedCustody.attachmentGeometryEvidence,
    applicabilitySourceAuthority,
    stressConcentration: qualifiedCustody.stressConcentration,
  });
  const result = {
    ...routeResult,
    sourceCustody: qualifiedCustody,
    applicabilitySourceAuthority,
  };
  return deepFreeze({
    ...result,
    resultHash: semanticHash(result),
  });
}

export function createEmp1Wrc537Gamma5ZeroDpOrchestrationAdapters({
  runLoadTransfer,
  runSectionScreening,
} = {}) {
  if (typeof runLoadTransfer !== 'function') {
    throw orchestrationError('EMP1_WRC537_ZERO_DP_LOAD_TRANSFER_ADAPTER_REQUIRED');
  }
  if (typeof runSectionScreening !== 'function') {
    throw orchestrationError('EMP1_WRC537_ZERO_DP_SECTION_SCREENING_ADAPTER_REQUIRED');
  }
  return deepFreeze({
    runLoadTransfer,
    runSectionScreening,
    prepareLocalCorrelationSource: prepareEmp1Wrc537Gamma5ZeroDpLocalSource,
    runLocalCorrelation: runEmp1Wrc537Gamma5ZeroDpLocalCorrelation,
  });
}

export function emp1Wrc537Gamma5ZeroDpOrchestrationQualification() {
  return deepFreeze({
    methodQualification: EMP1_WRC537_GAMMA5_ZERO_DP_METHOD_QUALIFICATION,
    benchmarkQualification: EMP1_WRC537_GAMMA5_ZERO_DP_BENCHMARK_QUALIFICATION,
    loadProducerQualificationSha256: EMP1_A_WRC_ZERO_DP_PRODUCER_QUALIFICATION_SHA256,
  });
}

function requireFoundationResult(value) {
  if (value?.schema === 'local-attachment-foundation-result/v1') {
    return requireQualifiedFoundationResult(value);
  }
  if (value?.schema !== EMP1_WRC537_GAMMA5_ZERO_DP_LOAD_LAYER_SCHEMA
    || value?.qualification !== 'PASS'
    || value?.foundationResult?.schema !== 'local-attachment-foundation-result/v1') {
    throw orchestrationError('EMP1_WRC537_ZERO_DP_RETAINED_FOUNDATION_LAYER_REQUIRED');
  }
  const result = requireQualifiedFoundationResult(value.foundationResult);
  if (value.resultHash !== result.semanticHashes.resultPayloadSemanticHash) {
    throw orchestrationError('EMP1_WRC537_ZERO_DP_FOUNDATION_LAYER_HASH_MISMATCH');
  }
  return result;
}

function requireQualifiedFoundationResult(value) {
  if (!record(value) || value.schema !== 'local-attachment-foundation-result/v1'
    || value.qualification?.state !== 'ACCEPTED') {
    throw orchestrationError('EMP1_WRC537_ZERO_DP_FOUNDATION_RESULT_NOT_QUALIFIED');
  }
  const retained = value.semanticHashes?.resultPayloadSemanticHash;
  const reconstructed = reconstructResultHashes(value).resultPayloadSemanticHash;
  if (!retained || retained !== reconstructed) {
    throw orchestrationError('EMP1_WRC537_ZERO_DP_FOUNDATION_RESULT_HASH_DRIFT');
  }
  return value;
}

function requireRequest(value) {
  if (!record(value)) throw orchestrationError('EMP1_WRC537_ZERO_DP_REQUEST_REQUIRED');
  if (value.schema !== EMP1_WRC537_GAMMA5_ZERO_DP_ORCHESTRATION_REQUEST_SCHEMA) {
    throw orchestrationError('EMP1_WRC537_ZERO_DP_REQUEST_SCHEMA');
  }
  const unsupported = Object.keys(value).filter((key) => !REQUEST_KEYS.includes(key));
  if (unsupported.length) {
    throw orchestrationError(`EMP1_WRC537_ZERO_DP_REQUEST_UNSUPPORTED_FIELD:${unsupported.sort().join(',')}`);
  }
  requiredString(value.loadCaseIdentity, 'LOAD_CASE_IDENTITY');
  requiredString(value.pressureResultIdentity, 'PRESSURE_RESULT_IDENTITY');
  return deepFreeze(structuredClone(value));
}

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw orchestrationError(`EMP1_WRC537_ZERO_DP_${label}_REQUIRED`);
  }
  return value.trim();
}
function record(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function orchestrationError(code) { const error = new TypeError(code); error.code = code; return error; }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
