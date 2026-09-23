import { semanticHash } from '../shared-primitives/canonical-json.js';
import {
  bindEmp1EngineeringReviewEvidence,
  projectEmp1EngineeringReviewState,
  requireEmp1EngineeringReviewRecord,
} from './emp1-engineering-review-record.js';

export const EMP1_ENGINEERING_EVIDENCE_PACKAGE_SCHEMA =
  'emp1-engineering-evidence-package/v1';
export const EMP1_ENGINEERING_EVIDENCE_IMPORT_STATE = Object.freeze({
  CURRENT_REUSABLE: 'CURRENT_REUSABLE',
  HISTORICAL_NON_REPORTABLE: 'HISTORICAL_NON_REPORTABLE',
});

const EXECUTION_SCHEMA = 'emp1-workbench-product-execution/v2';
const PACKAGE_KEYS = Object.freeze([
  'schema',
  'product',
  'releaseProfile',
  'source',
  'calculation',
  'benchmark',
  'review',
  'limitations',
  'authorityBoundary',
  'semanticHash',
]);
const INPUT_HASH_KEYS = Object.freeze([
  'loadTransferDocument',
  'sectionScreeningDocument',
  'attachmentGeometry',
  'applicabilityGeometry',
  'localRoute',
]);

/**
 * Build a durable EMP.1 evidence package from one already-retained execution.
 *
 * This function does not run A/B/C, resolve WRC curves, reconstruct engineering
 * result hashes, or create route/release authority. Existing identities are
 * consumed and cross-checked before being serialized.
 */
export function createEmp1EngineeringEvidencePackage(input = {}) {
  const execution = requireExecution(input.execution);
  const source = sourceEvidence(input.sourceDocuments, execution);
  const calculation = calculationEvidence(execution);
  const benchmark = benchmarkEvidence(input.benchmarkEvidence);
  const review = reviewEvidence(input.reviewRecord ?? null, calculation);
  const payload = {
    schema: EMP1_ENGINEERING_EVIDENCE_PACKAGE_SCHEMA,
    product: {
      id: 'EMP.1',
      version: requiredText(
        input.productVersion,
        'EMP1_ENGINEERING_EVIDENCE_PRODUCT_VERSION_REQUIRED',
      ),
      executionSchema: EXECUTION_SCHEMA,
      evidencePackageVersion: 1,
    },
    releaseProfile: releaseProfile(input.releaseProfile),
    source,
    calculation,
    benchmark,
    review,
    limitations: limitations(calculation),
    authorityBoundary: authorityBoundary(),
  };
  return deepFreeze({
    ...payload,
    semanticHash: semanticHash(payload),
  });
}

/**
 * Validate an imported package as retained historical evidence.
 *
 * Successful validation proves internal identity/binding consistency only. It
 * does not establish that the evidence is current against the live workspace.
 */
export function requireEmp1EngineeringEvidencePackage(value) {
  const source = exactRecord(
    value,
    PACKAGE_KEYS,
    'EMP1_ENGINEERING_EVIDENCE_PACKAGE_KEYS_INVALID',
  );
  if (source.schema !== EMP1_ENGINEERING_EVIDENCE_PACKAGE_SCHEMA) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_PACKAGE_SCHEMA_UNSUPPORTED');
  }
  assertProduct(source.product);
  assertReleaseProfile(source.releaseProfile);
  assertSourceEvidence(source.source);
  assertCalculationEvidence(source.calculation, source.source);
  assertBenchmarkEvidence(source.benchmark);
  assertReviewEvidence(source.review, source.calculation);
  assertLimitations(source.limitations, source.calculation);
  assertAuthorityBoundary(source.authorityBoundary);
  const { semanticHash: retainedHash, ...payload } = source;
  if (retainedHash !== semanticHash(payload)) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_PACKAGE_SEMANTIC_HASH_MISMATCH');
  }
  return deepFreeze(structuredClone(source));
}

/**
 * Compare validated retained evidence to caller-owned live source/route state.
 *
 * Imported flags are never used to establish currentness. Exact source-input
 * hashes and the live route-authority hash are derived from caller-supplied
 * current state. A mismatch retains the package as historical/non-reportable.
 */
export function classifyEmp1EngineeringEvidenceImport({
  package: retainedPackage,
  current,
} = {}) {
  const retained = requireEmp1EngineeringEvidencePackage(retainedPackage);
  const live = currentEvidence(current);
  const reasons = [];

  for (const key of INPUT_HASH_KEYS) {
    if (retained.source.inputHashes[key] !== live.inputHashes[key]) {
      reasons.push(`EMP1_ENGINEERING_EVIDENCE_CURRENT_${key.toUpperCase()}_MISMATCH`);
    }
  }
  if (!live.routeAuthorityHash) {
    reasons.push('EMP1_ENGINEERING_EVIDENCE_CURRENT_ROUTE_AUTHORITY_REQUIRED');
  } else if (retained.calculation.routeAuthority.hash !== live.routeAuthorityHash) {
    reasons.push('EMP1_ENGINEERING_EVIDENCE_CURRENT_ROUTE_AUTHORITY_MISMATCH');
  }
  if (live.productionUseAuthorized !== true) {
    reasons.push('EMP1_ENGINEERING_EVIDENCE_CURRENT_ROUTE_NOT_AUTHORIZED');
  }

  const uniqueReasons = Object.freeze([...new Set(reasons)]);
  const reportable = uniqueReasons.length === 0
    && retained.calculation.authority.boundedLocalRouteExecuted === true;
  const state = reportable
    ? EMP1_ENGINEERING_EVIDENCE_IMPORT_STATE.CURRENT_REUSABLE
    : EMP1_ENGINEERING_EVIDENCE_IMPORT_STATE.HISTORICAL_NON_REPORTABLE;
  const review = importedReviewState(retained.review, reportable, uniqueReasons);

  return deepFreeze({
    schema: 'emp1-engineering-evidence-import/v1',
    productId: 'EMP.1',
    packageSemanticHash: retained.semanticHash,
    state,
    reportable,
    deterministicReusePermitted: reportable,
    reasons: uniqueReasons,
    review,
    retainedCalculation: {
      sourceHash: retained.calculation.sourceHash,
      loadTransferResultHash: retained.calculation.resultHashes.loadTransfer,
      sectionScreeningResultHash: retained.calculation.resultHashes.sectionScreening,
      localCorrelationResultHash: retained.calculation.resultHashes.localCorrelation,
      assessmentSemanticHash: retained.calculation.resultHashes.assessment,
      routeAuthorityHash: retained.calculation.routeAuthority.hash,
    },
    currentComparison: {
      inputHashes: live.inputHashes,
      routeAuthorityHash: live.routeAuthorityHash,
      productionUseAuthorized: live.productionUseAuthorized,
    },
    authorityBoundary: {
      validatesHistoricalEvidenceOnly: true,
      importedCurrentFlagTrusted: false,
      importedRouteAuthorizationTrusted: false,
      importedReleaseAuthorityTrusted: false,
      createsSourceAuthority: false,
      createsMethodAuthority: false,
      createsApplicabilityAuthority: false,
      createsNumericalAuthority: false,
      createsCodeCompliance: false,
      createsReleaseAuthority: false,
    },
  });
}

function sourceEvidence(value, execution) {
  const documents = exactRecord(
    value,
    ['loadTransferDocument', 'sectionScreeningDocument'],
    'EMP1_ENGINEERING_EVIDENCE_SOURCE_DOCUMENTS_INVALID',
  );
  const inputHashes = requireInputHashes(execution.inputHashes);
  if (semanticHash(documents.loadTransferDocument) !== inputHashes.loadTransferDocument) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_LOAD_TRANSFER_SOURCE_HASH_MISMATCH');
  }
  if (semanticHash(documents.sectionScreeningDocument) !== inputHashes.sectionScreeningDocument) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_SECTION_SCREENING_SOURCE_HASH_MISMATCH');
  }
  assertRetainedRunInputHashes(execution.runInput, inputHashes);
  return deepFreeze({
    sourceHash: requiredText(
      execution.sourceHash,
      'EMP1_ENGINEERING_EVIDENCE_SOURCE_HASH_REQUIRED',
    ),
    inputHashes: structuredClone(inputHashes),
    loadTransferDocument: structuredClone(documents.loadTransferDocument),
    sectionScreeningDocument: structuredClone(documents.sectionScreeningDocument),
    runInput: structuredClone(execution.runInput),
  });
}

function calculationEvidence(execution) {
  const result = record(execution.result, 'EMP1_ENGINEERING_EVIDENCE_RESULT_REQUIRED');
  const loadTransfer = record(
    result.loadTransfer,
    'EMP1_ENGINEERING_EVIDENCE_LOAD_TRANSFER_RESULT_REQUIRED',
  );
  const sectionScreening = record(
    result.sectionScreening,
    'EMP1_ENGINEERING_EVIDENCE_SECTION_SCREENING_RESULT_REQUIRED',
  );
  const localCorrelation = record(
    result.localCorrelation,
    'EMP1_ENGINEERING_EVIDENCE_LOCAL_CORRELATION_RESULT_REQUIRED',
  );
  const assessment = record(
    result.assessment,
    'EMP1_ENGINEERING_EVIDENCE_ASSESSMENT_REQUIRED',
  );
  const routeAuthority = requireRouteAuthority(execution.authority);
  const sourceHash = requiredText(
    execution.sourceHash,
    'EMP1_ENGINEERING_EVIDENCE_SOURCE_HASH_REQUIRED',
  );
  const resultHashes = {
    loadTransfer: requiredText(
      loadTransfer.resultHash,
      'EMP1_ENGINEERING_EVIDENCE_LOAD_TRANSFER_RESULT_HASH_REQUIRED',
    ),
    sectionScreening: requiredText(
      sectionScreening.resultHash,
      'EMP1_ENGINEERING_EVIDENCE_SECTION_SCREENING_RESULT_HASH_REQUIRED',
    ),
    localCorrelation: requiredText(
      localCorrelation.resultHash,
      'EMP1_ENGINEERING_EVIDENCE_LOCAL_CORRELATION_RESULT_HASH_REQUIRED',
    ),
    assessment: semanticHash(assessment),
  };
  requireAssessmentParents(assessment, sourceHash, resultHashes);
  requireNonAuthorizingAssessmentBoundary(assessment);
  const methodGate = record(
    localCorrelation.methodGate,
    'EMP1_ENGINEERING_EVIDENCE_METHOD_GATE_REQUIRED',
  );
  const numerics = record(
    localCorrelation.numerics,
    'EMP1_ENGINEERING_EVIDENCE_WRC_NUMERICS_REQUIRED',
  );
  const sourceDocumentSha256 = requiredText(
    methodGate.sourceDocumentSha256,
    'EMP1_ENGINEERING_EVIDENCE_WRC_SOURCE_SHA_REQUIRED',
  );
  const datasetHash = requiredText(
    methodGate.datasetHash,
    'EMP1_ENGINEERING_EVIDENCE_WRC_DATASET_HASH_REQUIRED',
  );
  if (numerics.sourceDocumentSha256 !== sourceDocumentSha256) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_WRC_SOURCE_IDENTITY_MISMATCH');
  }
  if (numerics.datasetHash !== datasetHash) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_WRC_DATASET_IDENTITY_MISMATCH');
  }
  if (localCorrelation.productionRouteAuthority !== true
    || localCorrelation.globalEmp1CRouteAuthority !== false) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_LOCAL_CORRELATION_AUTHORITY_INVALID');
  }

  const evidence = {
    schema: execution.schema,
    productId: execution.productId,
    status: execution.status,
    decision: execution.decision,
    sourceHash,
    inputHashes: structuredClone(execution.inputHashes),
    runInput: structuredClone(execution.runInput),
    result: structuredClone(result),
    routeAuthority: {
      hash: routeAuthority.hash,
      snapshot: structuredClone(routeAuthority.snapshot),
    },
    resultHashes,
    method: {
      identity: requiredText(
        methodGate.methodIdentity,
        'EMP1_ENGINEERING_EVIDENCE_WRC_METHOD_IDENTITY_REQUIRED',
      ),
      edition: requiredText(
        methodGate.methodEdition,
        'EMP1_ENGINEERING_EVIDENCE_WRC_METHOD_EDITION_REQUIRED',
      ),
      sourceDocumentSha256,
      datasetHash,
      qualificationRecordHash: requiredText(
        methodGate.qualificationRecordHash,
        'EMP1_ENGINEERING_EVIDENCE_WRC_QUALIFICATION_HASH_REQUIRED',
      ),
      routeQualificationSha256: requiredText(
        localCorrelation.routeQualificationSha256,
        'EMP1_ENGINEERING_EVIDENCE_ROUTE_QUALIFICATION_HASH_REQUIRED',
      ),
      independentOracleHash: requiredText(
        methodGate.benchmarkHash,
        'EMP1_ENGINEERING_EVIDENCE_ORACLE_HASH_REQUIRED',
      ),
    },
    authority: {
      boundedLocalRouteExecuted: true,
      globalEmp1CRouteAuthority: false,
      codeComplianceProduced: false,
      releaseQualified: false,
    },
  };
  return deepFreeze({
    ...evidence,
    evidenceSemanticHash: semanticHash(evidence),
  });
}

function benchmarkEvidence(value) {
  const evidence = record(
    value,
    'EMP1_ENGINEERING_EVIDENCE_BENCHMARK_EVIDENCE_REQUIRED',
  );
  const projection = structuredClone(evidence);
  return deepFreeze({
    projection,
    projectionSemanticHash: semanticHash(projection),
    authorityBoundary: {
      comparisonEvidenceOnly: true,
      createsMethodAuthority: false,
      createsEngineeringUseAuthority: false,
      createsCodeCompliance: false,
      createsReleaseAuthority: false,
    },
  });
}

function reviewEvidence(reviewRecord, calculation) {
  const evidence = calculationReviewEvidence(calculation);
  const state = reviewRecord == null
    ? projectEmp1EngineeringReviewState({ reviewRecord: null })
    : projectEmp1EngineeringReviewState({
      reviewRecord: requireEmp1EngineeringReviewRecord(reviewRecord),
      evidence,
    });
  const recordValue = reviewRecord == null
    ? null
    : requireEmp1EngineeringReviewRecord(reviewRecord);
  const projection = reviewProjection(state);
  return deepFreeze({
    record: recordValue ? structuredClone(recordValue) : null,
    state: projection,
    stateSemanticHash: semanticHash(projection),
    authorityBoundary: {
      humanReviewAttestationOnly: true,
      createsMethodAuthority: false,
      createsApplicabilityAuthority: false,
      createsNumericalAuthority: false,
      createsCodeCompliance: false,
      createsReleaseAuthority: false,
    },
  });
}

function limitations(calculation) {
  const snapshot = calculation.routeAuthority.snapshot;
  const registry = snapshot?.registry;
  const localCorrelation = calculation.result.localCorrelation;
  return deepFreeze({
    routeLimitations: array(registry?.limitations),
    routeRemainingBlocked: array(registry?.remainingBlocked),
    routeSuspensionReasons: array(snapshot?.routeModuleSuspensionReasons),
    evaluatedStressScope: structuredClone(
      localCorrelation.stressScope ?? localCorrelation.numerics?.stressScope ?? null,
    ),
    continuousGlobalMaximumClaimed: false,
  });
}

function releaseProfile(value) {
  const profile = exactRecord(
    value,
    ['id', 'version'],
    'EMP1_ENGINEERING_EVIDENCE_RELEASE_PROFILE_INVALID',
  );
  return deepFreeze({
    id: requiredText(profile.id, 'EMP1_ENGINEERING_EVIDENCE_RELEASE_PROFILE_ID_REQUIRED'),
    version: requiredText(
      profile.version,
      'EMP1_ENGINEERING_EVIDENCE_RELEASE_PROFILE_VERSION_REQUIRED',
    ),
    releaseQualified: false,
  });
}

function currentEvidence(value) {
  const current = exactRecord(
    value,
    ['loadTransferDocument', 'sectionScreeningDocument', 'runInput', 'routeAuthority'],
    'EMP1_ENGINEERING_EVIDENCE_CURRENT_STATE_INVALID',
  );
  const runInput = record(
    current.runInput,
    'EMP1_ENGINEERING_EVIDENCE_CURRENT_RUN_INPUT_REQUIRED',
  );
  const localMethod = record(
    runInput.localMethod,
    'EMP1_ENGINEERING_EVIDENCE_CURRENT_LOCAL_METHOD_REQUIRED',
  );
  const routeAuthority = record(
    current.routeAuthority,
    'EMP1_ENGINEERING_EVIDENCE_CURRENT_ROUTE_AUTHORITY_REQUIRED',
  );
  const routeAuthorityHash = routeAuthority.routeAuthorityHash
    ?? routeAuthority.snapshot?.semanticHash
    ?? null;
  if (routeAuthorityHash != null && routeAuthority.snapshot?.semanticHash != null
    && routeAuthorityHash !== routeAuthority.snapshot.semanticHash) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_CURRENT_ROUTE_AUTHORITY_HASH_MISMATCH');
  }
  return deepFreeze({
    inputHashes: {
      loadTransferDocument: semanticHash(current.loadTransferDocument),
      sectionScreeningDocument: semanticHash(current.sectionScreeningDocument),
      attachmentGeometry: semanticHash(record(
        localMethod.attachmentGeometry,
        'EMP1_ENGINEERING_EVIDENCE_CURRENT_ATTACHMENT_GEOMETRY_REQUIRED',
      )),
      applicabilityGeometry: localMethod.applicabilityGeometry == null
        ? null
        : semanticHash(record(
          localMethod.applicabilityGeometry,
          'EMP1_ENGINEERING_EVIDENCE_CURRENT_APPLICABILITY_GEOMETRY_INVALID',
        )),
      localRoute: semanticHash(record(
        localMethod.routeRequest,
        'EMP1_ENGINEERING_EVIDENCE_CURRENT_ROUTE_REQUEST_REQUIRED',
      )),
    },
    routeAuthorityHash,
    productionUseAuthorized: routeAuthority.productionUseAuthorized === true,
  });
}

function assertProduct(value) {
  const product = exactRecord(
    value,
    ['id', 'version', 'executionSchema', 'evidencePackageVersion'],
    'EMP1_ENGINEERING_EVIDENCE_PRODUCT_INVALID',
  );
  if (product.id !== 'EMP.1'
    || product.executionSchema !== EXECUTION_SCHEMA
    || product.evidencePackageVersion !== 1) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_PRODUCT_IDENTITY_INVALID');
  }
  requiredText(product.version, 'EMP1_ENGINEERING_EVIDENCE_PRODUCT_VERSION_REQUIRED');
}

function assertReleaseProfile(value) {
  const profile = exactRecord(
    value,
    ['id', 'version', 'releaseQualified'],
    'EMP1_ENGINEERING_EVIDENCE_RELEASE_PROFILE_INVALID',
  );
  requiredText(profile.id, 'EMP1_ENGINEERING_EVIDENCE_RELEASE_PROFILE_ID_REQUIRED');
  requiredText(profile.version, 'EMP1_ENGINEERING_EVIDENCE_RELEASE_PROFILE_VERSION_REQUIRED');
  if (profile.releaseQualified !== false) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_RELEASE_PROFILE_MUST_NOT_AUTHORIZE_RELEASE');
  }
}

function assertSourceEvidence(value) {
  const source = exactRecord(
    value,
    [
      'sourceHash',
      'inputHashes',
      'loadTransferDocument',
      'sectionScreeningDocument',
      'runInput',
    ],
    'EMP1_ENGINEERING_EVIDENCE_SOURCE_INVALID',
  );
  requiredText(source.sourceHash, 'EMP1_ENGINEERING_EVIDENCE_SOURCE_HASH_REQUIRED');
  const inputHashes = requireInputHashes(source.inputHashes);
  if (semanticHash(source.loadTransferDocument) !== inputHashes.loadTransferDocument) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_LOAD_TRANSFER_SOURCE_HASH_MISMATCH');
  }
  if (semanticHash(source.sectionScreeningDocument) !== inputHashes.sectionScreeningDocument) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_SECTION_SCREENING_SOURCE_HASH_MISMATCH');
  }
  assertRetainedRunInputHashes(source.runInput, inputHashes);
}

function assertCalculationEvidence(value, source) {
  const calculation = exactRecord(
    value,
    [
      'schema',
      'productId',
      'status',
      'decision',
      'sourceHash',
      'inputHashes',
      'runInput',
      'result',
      'routeAuthority',
      'resultHashes',
      'method',
      'authority',
      'evidenceSemanticHash',
    ],
    'EMP1_ENGINEERING_EVIDENCE_CALCULATION_INVALID',
  );
  if (calculation.schema !== EXECUTION_SCHEMA || calculation.productId !== 'EMP.1') {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_EXECUTION_IDENTITY_INVALID');
  }
  if (calculation.status !== 'CALCULATED') {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_CALCULATED_EXECUTION_REQUIRED');
  }
  if (calculation.sourceHash !== source.sourceHash) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_SOURCE_BINDING_MISMATCH');
  }
  if (semanticHash(calculation.inputHashes) !== semanticHash(source.inputHashes)
    || semanticHash(calculation.runInput) !== semanticHash(source.runInput)) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_INPUT_BINDING_MISMATCH');
  }
  const reconstructed = calculationEvidence({
    schema: calculation.schema,
    productId: calculation.productId,
    status: calculation.status,
    decision: calculation.decision,
    sourceHash: calculation.sourceHash,
    inputHashes: calculation.inputHashes,
    runInput: calculation.runInput,
    result: calculation.result,
    authority: {
      boundedLocalRouteExecuted: calculation.authority.boundedLocalRouteExecuted,
      routeAuthorityHash: calculation.routeAuthority.hash,
      routeAuthoritySnapshot: calculation.routeAuthority.snapshot,
      globalEmp1CRouteAuthority: calculation.authority.globalEmp1CRouteAuthority,
      codeComplianceProduced: calculation.authority.codeComplianceProduced,
      releaseQualified: calculation.authority.releaseQualified,
    },
  });
  if (reconstructed.evidenceSemanticHash !== calculation.evidenceSemanticHash) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_CALCULATION_SEMANTIC_HASH_MISMATCH');
  }
  if (semanticHash(reconstructed.resultHashes) !== semanticHash(calculation.resultHashes)
    || semanticHash(reconstructed.method) !== semanticHash(calculation.method)) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_CALCULATION_IDENTITY_DRIFT');
  }
}

function assertBenchmarkEvidence(value) {
  const benchmark = exactRecord(
    value,
    ['projection', 'projectionSemanticHash', 'authorityBoundary'],
    'EMP1_ENGINEERING_EVIDENCE_BENCHMARK_INVALID',
  );
  if (benchmark.projectionSemanticHash !== semanticHash(benchmark.projection)) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_BENCHMARK_HASH_MISMATCH');
  }
  const boundary = benchmark.authorityBoundary;
  for (const key of [
    'createsMethodAuthority',
    'createsEngineeringUseAuthority',
    'createsCodeCompliance',
    'createsReleaseAuthority',
  ]) {
    if (boundary?.[key] !== false) {
      throw evidenceError(`EMP1_ENGINEERING_EVIDENCE_BENCHMARK_AUTHORITY_INVALID:${key}`);
    }
  }
}

function assertReviewEvidence(value, calculation) {
  const review = exactRecord(
    value,
    ['record', 'state', 'stateSemanticHash', 'authorityBoundary'],
    'EMP1_ENGINEERING_EVIDENCE_REVIEW_INVALID',
  );
  const expected = reviewEvidence(review.record, calculation);
  if (review.stateSemanticHash !== expected.stateSemanticHash
    || semanticHash(review.state) !== semanticHash(expected.state)) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_REVIEW_STATE_MISMATCH');
  }
  for (const key of [
    'createsMethodAuthority',
    'createsApplicabilityAuthority',
    'createsNumericalAuthority',
    'createsCodeCompliance',
    'createsReleaseAuthority',
  ]) {
    if (review.authorityBoundary?.[key] !== false) {
      throw evidenceError(`EMP1_ENGINEERING_EVIDENCE_REVIEW_AUTHORITY_INVALID:${key}`);
    }
  }
}

function assertLimitations(value, calculation) {
  const expected = limitations(calculation);
  if (semanticHash(value) !== semanticHash(expected)) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_LIMITATIONS_MISMATCH');
  }
}

function assertAuthorityBoundary(value) {
  const expected = authorityBoundary();
  if (semanticHash(value) !== semanticHash(expected)) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_AUTHORITY_BOUNDARY_INVALID');
  }
}

function requireExecution(value) {
  const execution = record(value, 'EMP1_ENGINEERING_EVIDENCE_EXECUTION_REQUIRED');
  if (execution.schema !== EXECUTION_SCHEMA || execution.productId !== 'EMP.1') {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_EXECUTION_SCHEMA_INVALID');
  }
  if (execution.status !== 'CALCULATED'
    || execution.authority?.boundedLocalRouteExecuted !== true) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_CURRENT_CALCULATED_EXECUTION_REQUIRED');
  }
  return execution;
}

function requireRouteAuthority(value) {
  const authority = record(value, 'EMP1_ENGINEERING_EVIDENCE_EXECUTION_AUTHORITY_REQUIRED');
  const hash = requiredText(
    authority.routeAuthorityHash,
    'EMP1_ENGINEERING_EVIDENCE_ROUTE_AUTHORITY_HASH_REQUIRED',
  );
  const snapshot = record(
    authority.routeAuthoritySnapshot,
    'EMP1_ENGINEERING_EVIDENCE_ROUTE_AUTHORITY_SNAPSHOT_REQUIRED',
  );
  if (snapshot.semanticHash !== hash) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_ROUTE_AUTHORITY_HASH_MISMATCH');
  }
  if (authority.boundedLocalRouteExecuted !== true
    || authority.globalEmp1CRouteAuthority !== false
    || authority.codeComplianceProduced !== false
    || authority.releaseQualified !== false) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_EXECUTION_AUTHORITY_BOUNDARY_INVALID');
  }
  return { hash, snapshot };
}

function requireAssessmentParents(assessment, sourceHash, resultHashes) {
  const parents = record(
    assessment.parents,
    'EMP1_ENGINEERING_EVIDENCE_ASSESSMENT_PARENTS_REQUIRED',
  );
  const expected = {
    sourceHash,
    loadTransferResultHash: resultHashes.loadTransfer,
    sectionScreeningResultHash: resultHashes.sectionScreening,
    localCorrelationResultHash: resultHashes.localCorrelation,
  };
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (parents[key] !== expectedValue) {
      throw evidenceError(`EMP1_ENGINEERING_EVIDENCE_ASSESSMENT_PARENT_MISMATCH:${key}`);
    }
  }
}

function requireNonAuthorizingAssessmentBoundary(assessment) {
  if (assessment.authority?.codeComplianceProduced !== false
    || assessment.authority?.releaseQualified !== false
    || assessment.interpretation?.passIsCodeCompliance !== false
    || assessment.interpretation?.releaseQualified !== false) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_ASSESSMENT_AUTHORITY_BOUNDARY_INVALID');
  }
}

function requireInputHashes(value) {
  const inputHashes = exactRecord(
    value,
    INPUT_HASH_KEYS,
    'EMP1_ENGINEERING_EVIDENCE_INPUT_HASHES_INVALID',
  );
  for (const key of INPUT_HASH_KEYS) {
    if (key === 'applicabilityGeometry' && inputHashes[key] == null) continue;
    requiredText(
      inputHashes[key],
      `EMP1_ENGINEERING_EVIDENCE_INPUT_HASH_REQUIRED:${key}`,
    );
  }
  return inputHashes;
}

function assertRetainedRunInputHashes(runInput, inputHashes) {
  const value = record(runInput, 'EMP1_ENGINEERING_EVIDENCE_RUN_INPUT_REQUIRED');
  const localMethod = record(
    value.localMethod,
    'EMP1_ENGINEERING_EVIDENCE_LOCAL_METHOD_REQUIRED',
  );
  if (semanticHash(record(
    localMethod.attachmentGeometry,
    'EMP1_ENGINEERING_EVIDENCE_ATTACHMENT_GEOMETRY_REQUIRED',
  )) !== inputHashes.attachmentGeometry) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_ATTACHMENT_GEOMETRY_HASH_MISMATCH');
  }
  const applicabilityHash = localMethod.applicabilityGeometry == null
    ? null
    : semanticHash(record(
      localMethod.applicabilityGeometry,
      'EMP1_ENGINEERING_EVIDENCE_APPLICABILITY_GEOMETRY_INVALID',
    ));
  if (applicabilityHash !== inputHashes.applicabilityGeometry) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_APPLICABILITY_GEOMETRY_HASH_MISMATCH');
  }
  if (semanticHash(record(
    localMethod.routeRequest,
    'EMP1_ENGINEERING_EVIDENCE_ROUTE_REQUEST_REQUIRED',
  )) !== inputHashes.localRoute) {
    throw evidenceError('EMP1_ENGINEERING_EVIDENCE_LOCAL_ROUTE_HASH_MISMATCH');
  }
}

function calculationReviewEvidence(calculation) {
  return {
    sourceHash: calculation.sourceHash,
    routeAuthorityHash: calculation.routeAuthority.hash,
    routeAuthoritySnapshot: calculation.routeAuthority.snapshot,
    result: calculation.result,
  };
}

function reviewProjection(state) {
  return {
    schema: state.schema,
    state: state.state,
    reviewed: state.reviewed,
    current: state.current,
    disposition: state.disposition,
    reviewId: state.reviewId,
    reviewSemanticHash: state.reviewSemanticHash,
    changedBindings: [...(state.changedBindings ?? [])],
    evidenceBinding: state.evidenceBinding ? structuredClone(state.evidenceBinding) : null,
    currentEvidenceBinding:
      state.currentEvidenceBinding ? structuredClone(state.currentEvidenceBinding) : null,
  };
}

function importedReviewState(review, reportable, reasons) {
  if (review.record == null) {
    return deepFreeze({
      state: 'NOT_REVIEWED',
      current: false,
      disposition: null,
      reviewId: null,
      reviewSemanticHash: null,
      reasons: [],
    });
  }
  if (!reportable) {
    return deepFreeze({
      state: 'REVIEW_STALE',
      current: false,
      disposition: review.state.disposition,
      reviewId: review.state.reviewId,
      reviewSemanticHash: review.state.reviewSemanticHash,
      reasons: [...reasons],
    });
  }
  return deepFreeze({
    state: review.state.state,
    current: review.state.current === true,
    disposition: review.state.disposition,
    reviewId: review.state.reviewId,
    reviewSemanticHash: review.state.reviewSemanticHash,
    reasons: [],
  });
}

function authorityBoundary() {
  return deepFreeze({
    historicalEvidencePackageOnly: true,
    importedCurrentFlagTrusted: false,
    importedRouteAuthorizationTrusted: false,
    importedReleaseAuthorityTrusted: false,
    createsSourceAuthority: false,
    createsMethodAuthority: false,
    createsApplicabilityAuthority: false,
    createsNumericalAuthority: false,
    createsCodeCompliance: false,
    createsReleaseAuthority: false,
    globalEmp1CRouteAuthority: false,
    codeComplianceState: 'NOT_ASSESSED',
    releaseQualified: false,
  });
}

function exactRecord(value, keys, code) {
  const row = record(value, code);
  const actual = Object.keys(row).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw evidenceError(code);
  return row;
}
function record(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw evidenceError(code);
  return value;
}
function requiredText(value, code) {
  if (typeof value !== 'string' || !value.trim()) throw evidenceError(code);
  return value.trim();
}
function array(value) {
  return Array.isArray(value) ? structuredClone(value) : [];
}
function evidenceError(code) {
  const error = new TypeError(code);
  error.code = code;
  return error;
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
