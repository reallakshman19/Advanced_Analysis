#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createEmp1EngineeringEvidencePackage,
  classifyEmp1EngineeringEvidenceImport,
  requireEmp1EngineeringEvidencePackage,
} from '../src/core/emp1/emp1-engineering-evidence-export.js';
import { createEmp1EngineeringReviewRecord } from
  '../src/core/emp1/emp1-engineering-review-record.js';
import { semanticHash } from '../src/core/shared-primitives/canonical-json.js';
import {
  classifyEmp1WorkspaceEngineeringEvidenceImport,
  createEmp1WorkspaceEngineeringEvidencePackage,
} from '../src/workspace/emp1-engineering-review-workspace.js';
import {
  EMP1_WORKBENCH_C_STATE,
  EMP1_WORKBENCH_EXECUTION_CURRENTNESS,
} from '../src/workspace/emp1-workbench-run-state.js';

const sourceDocuments = {
  loadTransferDocument: { schema: 'lafea-stage-document/v1', stageId: 'LAFEA.1', value: 1 },
  sectionScreeningDocument: { schema: 'lafea-stage-document/v1', stageId: 'LAFEA.2', value: 2 },
};
const runInput = {
  schema: 'emp1-workbench-run-input/v3',
  localMethod: {
    routeRequest: {
      schema: 'emp1-wrc537-gamma5-zero-dp-orchestration-request/v2',
      loadCaseIdentity: 'LC-1',
      pressureResultIdentity: 'PR-1',
    },
    attachmentGeometry: {
      geometryIdentity: 'ATT-1',
      attachmentDiameter: 35.42857142857143,
      diameterBasis: 'OUTSIDE_DIAMETER_AT_SHELL_JUNCTURE',
      physicalLocation: 'ATTACHMENT_SHELL_JUNCTURE',
      unit: 'mm',
      sourceReference: 'FIXTURE/ATTACHMENT',
    },
    applicabilityGeometry: {
      geometryIdentity: 'APP-1',
      cylinderLengthBasis: 'BETWEEN_CYLINDER_END_PLANES',
      cylinderLength: 300,
      attachmentStationBasis:
        'FROM_CYLINDER_START_END_PLANE_TO_WRC_ATTACHMENT_REFERENCE_POINT',
      attachmentStationFromCylinderStart: 80,
      unit: 'mm',
      cylinderLengthSourceReference: 'FIXTURE/CYLINDER',
      attachmentStationSourceReference: 'FIXTURE/STATION',
    },
  },
};
const inputHashes = {
  loadTransferDocument: semanticHash(sourceDocuments.loadTransferDocument),
  sectionScreeningDocument: semanticHash(sourceDocuments.sectionScreeningDocument),
  attachmentGeometry: semanticHash(runInput.localMethod.attachmentGeometry),
  applicabilityGeometry: semanticHash(runInput.localMethod.applicabilityGeometry),
  localRoute: semanticHash(runInput.localMethod.routeRequest),
};
const routeAuthoritySnapshotPayload = {
  schema: 'emp1-workbench-route-authority-snapshot/v1',
  routeId: 'EMP1.C.WRC537.CYLINDRICAL.ORIGINAL.GAMMA5.ZERO_DP',
  productionUseAuthorized: true,
  routeModuleAuthorized: true,
  routeModuleSuspensionReasons: [],
  postAuthorityOracleSemanticHash: 'ORACLE-1',
  registry: {
    routeId: 'EMP1.C.WRC537.CYLINDRICAL.ORIGINAL.GAMMA5.ZERO_DP',
    registered: true,
    engineeringUseAuthorized: true,
    limitations: ['WRC_TABLE5_EIGHT_POINTS_NOT_GLOBAL_ABSOLUTE_MAXIMUM'],
    remainingBlocked: ['GLOBAL_EMP1_C_ROUTE'],
  },
};
const routeAuthorityHash = semanticHash(routeAuthoritySnapshotPayload);
const routeAuthoritySnapshot = {
  ...routeAuthoritySnapshotPayload,
  semanticHash: routeAuthorityHash,
};
const parents = {
  sourceHash: 'SOURCE-1',
  loadTransferResultHash: 'A-1',
  sectionScreeningResultHash: 'B-1',
  localCorrelationResultHash: 'C-1',
};
const result = {
  productId: 'EMP.1',
  loadTransfer: { qualification: 'PASS', resultHash: 'A-1', reasons: [] },
  sectionScreening: {
    qualification: 'PASS',
    decision: 'ESCALATE',
    resultHash: 'B-1',
    reasons: [],
  },
  localCorrelation: {
    state: 'EVALUATED_AUTHORIZED_BOUNDED_GAMMA5_ZERO_DP_ROUTE',
    decision: 'PASS',
    resultHash: 'C-1',
    reasons: [],
    productionRouteAuthority: true,
    globalEmp1CRouteAuthority: false,
    routeQualificationSha256: 'QUAL-ROUTE-1',
    methodGate: {
      state: 'METHOD_QUALIFIED',
      engineeringUseAuthorized: true,
      methodIdentity: 'WRC537_2013_CYLINDRICAL_ORIGINAL_GAMMA5_TABLE5_ZERO_DP',
      methodEdition: '2013',
      sourceDocumentSha256: 'WRC-SOURCE-1',
      datasetHash: 'WRC-DATASET-1',
      qualificationRecordHash: 'QUAL-RECORD-1',
      benchmarkHash: 'ORACLE-1',
    },
    numerics: {
      sourceDocumentSha256: 'WRC-SOURCE-1',
      datasetHash: 'WRC-DATASET-1',
      stressScope: {
        domain: 'HOST_CYLINDRICAL_SHELL_AT_ATTACHMENT_SHELL_JUNCTURE',
        locations: ['Au','Al','Bu','Bl','Cu','Cl','Du','Dl'],
      },
    },
    stressScope: {
      domain: 'HOST_CYLINDRICAL_SHELL_AT_ATTACHMENT_SHELL_JUNCTURE',
      locations: ['Au','Al','Bu','Bl','Cu','Cl','Du','Dl'],
    },
  },
  assessment: {
    schema: 'emp1-assessment/v1',
    productId: 'EMP.1',
    decision: 'ESCALATE',
    reasons: ['CODE_COMPLIANCE_NOT_ASSESSED'],
    parents,
    authority: {
      wrcEngineeringUseAuthorizedByScaffold: false,
      codeComplianceProduced: false,
      releaseQualified: false,
    },
    interpretation: {
      passIsCodeCompliance: false,
      releaseQualified: false,
      localCorrelationRequiredWhenScreeningEscalates: true,
    },
  },
};
const execution = {
  schema: 'emp1-workbench-product-execution/v2',
  productId: 'EMP.1',
  status: 'CALCULATED',
  decision: 'ESCALATE',
  sourceHash: 'SOURCE-1',
  inputHashes,
  changeClasses: [],
  runInput,
  result,
  authority: {
    boundedLocalRoutePrepared: true,
    boundedLocalRouteExecuted: true,
    routeAuthorityHash,
    routeAuthoritySnapshot,
    globalEmp1CRouteAuthority: false,
    codeComplianceProduced: false,
    releaseQualified: false,
  },
};
const reviewRecord = createEmp1EngineeringReviewRecord({
  disposition: 'ACCEPTED',
  reviewer: { identity: 'engineer:fixture', role: 'ENGINEER' },
  reviewedAt: '2026-09-23T06:30:00Z',
  basisCode: 'EMP1_ENGINEERING_RESULT_REVIEW',
  comment: 'Fixture review of the exact retained calculation.',
  evidence: {
    sourceHash: execution.sourceHash,
    routeAuthorityHash: execution.authority.routeAuthorityHash,
    routeAuthoritySnapshot: execution.authority.routeAuthoritySnapshot,
    result: execution.result,
  },
});
const benchmarkEvidence = {
  schema: 'emp1-benchmark-evidence-workspace/v1',
  comparators: [
    {
      comparatorId: 'CAUX',
      comparisonState: 'COMPARISON_QUALIFIED',
      engineeringUseAuthorized: false,
    },
    {
      comparatorId: 'PV_ELITE',
      referenceState: 'REFERENCE_NOT_AVAILABLE',
    },
  ],
  authorityBoundary: {
    presentationOnly: true,
    executesWrcMethod: false,
    selectsTolerance: false,
    mutatesExpectedValues: false,
    createsWrcMethodAuthority: false,
    createsEngineeringUseAuthority: false,
    createsProductionAuthority: false,
    createsCodeComplianceAuthority: false,
    createsReleaseAuthority: false,
  },
};
const releaseProfile = {
  id: 'EMP1_WRC537_2013_CYLINDRICAL_GAMMA5_ZERO_DP_V1',
  version: 'v1',
};

const evidencePackage = createEmp1EngineeringEvidencePackage({
  execution,
  sourceDocuments,
  reviewRecord,
  benchmarkEvidence,
  productVersion: '0.0.0',
  releaseProfile,
});
assert.equal(evidencePackage.schema, 'emp1-evidence-export/v1');
assert.equal(evidencePackage.product.id, 'EMP.1');
assert.equal(evidencePackage.product.version, '0.0.0');
assert.equal(evidencePackage.releaseProfile.id, releaseProfile.id);
assert.equal(evidencePackage.releaseProfile.releaseQualified, false);
assert.equal(evidencePackage.source.sourceHash, execution.sourceHash);
assert.deepEqual(evidencePackage.source.inputHashes, inputHashes);
assert.equal(evidencePackage.calculation.resultHashes.loadTransfer, 'A-1');
assert.equal(evidencePackage.calculation.resultHashes.sectionScreening, 'B-1');
assert.equal(evidencePackage.calculation.resultHashes.localCorrelation, 'C-1');
assert.equal(evidencePackage.calculation.routeAuthority.hash, routeAuthorityHash);
assert.equal(evidencePackage.calculation.routeAuthority.snapshot.semanticHash, routeAuthorityHash);
assert.equal(evidencePackage.calculation.method.sourceDocumentSha256, 'WRC-SOURCE-1');
assert.equal(evidencePackage.calculation.method.datasetHash, 'WRC-DATASET-1');
assert.equal(evidencePackage.calculation.method.routeQualificationSha256, 'QUAL-ROUTE-1');
assert.equal(evidencePackage.calculation.method.independentOracleHash, 'ORACLE-1');
assert.equal(evidencePackage.review.state.state, 'REVIEW_ACCEPTED');
assert.equal(evidencePackage.review.state.current, true);
assert.equal(evidencePackage.review.record.reviewId, reviewRecord.reviewId);
assert.equal(evidencePackage.authorityBoundary.codeComplianceState, 'NOT_ASSESSED');
assert.equal(evidencePackage.authorityBoundary.releaseQualified, false);
assert.equal(evidencePackage.authorityBoundary.globalEmp1CRouteAuthority, false);
assert.match(evidencePackage.semanticHash, /^fnv1a64:[0-9a-f]{16}$/u);

const required = requireEmp1EngineeringEvidencePackage(evidencePackage);
assert.equal(required.semanticHash, evidencePackage.semanticHash);

const exact = classifyEmp1EngineeringEvidenceImport({
  package: evidencePackage,
  current: currentState(),
});
assert.equal(exact.state, 'CURRENT_REUSABLE');
assert.equal(exact.reportable, true);
assert.equal(exact.deterministicReusePermitted, true);
assert.deepEqual(exact.reasons, []);
assert.equal(exact.review.state, 'REVIEW_ACCEPTED');
assert.equal(exact.review.current, true);
assert.equal(exact.authorityBoundary.importedCurrentFlagTrusted, false);
assert.equal(exact.authorityBoundary.importedRouteAuthorizationTrusted, false);
assert.equal(exact.authorityBoundary.importedReleaseAuthorityTrusted, false);
assert.equal(exact.authorityBoundary.createsReleaseAuthority, false);

const workspacePackage = createEmp1WorkspaceEngineeringEvidencePackage({
  execution,
  executionCurrentness: {
    state: EMP1_WORKBENCH_EXECUTION_CURRENTNESS.CURRENT,
    inputCurrent: true,
    cAuthorityCurrent: true,
  },
  cState: {
    state: EMP1_WORKBENCH_C_STATE.CALCULATED_CURRENT,
    currentResultAvailable: true,
  },
  reviewRecord,
  sourceDocuments,
});
assert.equal(workspacePackage.schema, 'emp1-evidence-export/v1');
assert.equal(workspacePackage.review.state.state, 'REVIEW_ACCEPTED');
assert.equal(workspacePackage.benchmark.projection.schema,
  'emp1-benchmark-evidence-workspace/v1');
const workspaceExact = classifyEmp1WorkspaceEngineeringEvidenceImport({
  package: workspacePackage,
  loadTransferDocument: sourceDocuments.loadTransferDocument,
  sectionScreeningDocument: sourceDocuments.sectionScreeningDocument,
  runInput,
  routeAuthority: {
    productionUseAuthorized: true,
    routeAuthorityHash,
    snapshot: { semanticHash: routeAuthorityHash },
  },
});
assert.equal(workspaceExact.state, 'CURRENT_REUSABLE');
assert.equal(workspaceExact.reportable, true);
assert.equal(workspaceExact.review.state, 'REVIEW_ACCEPTED');

const routeChanged = classifyEmp1EngineeringEvidenceImport({
  package: evidencePackage,
  current: currentState({
    routeAuthority: {
      productionUseAuthorized: true,
      routeAuthorityHash: 'ROUTE-2',
      snapshot: { semanticHash: 'ROUTE-2' },
    },
  }),
});
assert.equal(routeChanged.state, 'HISTORICAL_NON_REPORTABLE');
assert.equal(routeChanged.reportable, false);
assert.ok(routeChanged.reasons.includes(
  'EMP1_ENGINEERING_EVIDENCE_CURRENT_ROUTE_AUTHORITY_MISMATCH',
));
assert.equal(routeChanged.review.state, 'REVIEW_STALE');
assert.equal(routeChanged.review.current, false);

const sourceChanged = structuredClone(sourceDocuments.loadTransferDocument);
sourceChanged.value = 999;
const sourceDrift = classifyEmp1EngineeringEvidenceImport({
  package: evidencePackage,
  current: currentState({ loadTransferDocument: sourceChanged }),
});
assert.equal(sourceDrift.state, 'HISTORICAL_NON_REPORTABLE');
assert.ok(sourceDrift.reasons.includes(
  'EMP1_ENGINEERING_EVIDENCE_CURRENT_LOADTRANSFERDOCUMENT_MISMATCH',
));

const suspended = classifyEmp1EngineeringEvidenceImport({
  package: evidencePackage,
  current: currentState({
    routeAuthority: {
      productionUseAuthorized: false,
      routeAuthorityHash,
      snapshot: { semanticHash: routeAuthorityHash },
    },
  }),
});
assert.equal(suspended.reportable, false);
assert.ok(suspended.reasons.includes(
  'EMP1_ENGINEERING_EVIDENCE_CURRENT_ROUTE_NOT_AUTHORIZED',
));

assertRejected('unsupported-schema', (next) => {
  next.schema = 'emp1-evidence-export/v999';
}, /PACKAGE_SCHEMA_UNSUPPORTED/u);
assertRejected('injected-current', (next) => {
  next.current = true;
}, /PACKAGE_KEYS_INVALID/u);
assertRejected('release-authority', (next) => {
  next.releaseProfile.releaseQualified = true;
}, /MUST_NOT_AUTHORIZE_RELEASE/u);
assertRejected('global-authority', (next) => {
  next.authorityBoundary.globalEmp1CRouteAuthority = true;
}, /AUTHORITY_BOUNDARY_INVALID/u);
assertRejected('route-snapshot-hash', (next) => {
  next.calculation.routeAuthority.snapshot.semanticHash = 'ROUTE-TAMPER';
}, /ROUTE_AUTHORITY_HASH_MISMATCH/u);
assertRejected('c-result', (next) => {
  next.calculation.result.localCorrelation.resultHash = 'C-TAMPER';
}, /ASSESSMENT_PARENT_MISMATCH|CALCULATION_SEMANTIC_HASH_MISMATCH|REVIEW_STATE_MISMATCH/u);
assertRejected('review-disposition', (next) => {
  next.review.record.disposition = 'REJECTED';
}, /REVIEW_RECORD_IDENTITY_MISMATCH/u);
assertRejected('benchmark-projection', (next) => {
  next.benchmark.projection.comparators[0].comparisonState = 'PASS_INVENTED';
}, /BENCHMARK_HASH_MISMATCH/u);
assertRejected('benchmark-authority-injection', (next) => {
  next.benchmark.projection.authorityBoundary.createsProductionAuthority = true;
  next.benchmark.projectionSemanticHash = semanticHash(next.benchmark.projection);
}, /BENCHMARK_PROJECTION_AUTHORITY_INVALID/u);

const source = await readFile(
  new URL('../src/core/emp1/emp1-engineering-evidence-export.js', import.meta.url),
  'utf8',
);
const workspaceSource = await readFile(
  new URL('../src/workspace/emp1-engineering-review-workspace.js', import.meta.url),
  'utf8',
);
assert.match(workspaceSource, /projectEmp1BenchmarkEvidenceWorkspace\(\)/u,
  'workspace export must source benchmark evidence from governed projection');
assert.doesNotMatch(
  workspaceSource.match(/export function createEmp1WorkspaceEngineeringEvidencePackage\([\s\S]*?\n\}/u)?.[0] ?? '',
  /benchmarkEvidence\s*,/u,
  'workspace export must not accept caller-authored benchmark evidence',
);
const workspaceExportSignature =
  workspaceSource.match(
    /export function createEmp1WorkspaceEngineeringEvidencePackage\([\s\S]*?\n\}/u,
  )?.[0] ?? '';
assert.doesNotMatch(workspaceExportSignature, /productVersion\s*,/u,
  'workspace export must not accept caller-authored product version');
assert.doesNotMatch(workspaceExportSignature, /releaseProfile\s*,/u,
  'workspace export must not accept caller-authored release profile');
assert.match(workspaceSource, /packageMetadata\.version/u);
assert.match(workspaceSource, /releaseProfile\.releaseProfileId/u);
assert.match(workspaceSource, /releaseProfile\.schema/u);
for (const forbidden of [
  'runEmp1(',
  'evaluateEmp1Wrc537',
  'emp1CBoundedRoute(',
  'reconstructResultHash',
  'releaseQualified: true',
  'createsReleaseAuthority: true',
  'codeComplianceProduced: true',
]) {
  assert.equal(source.includes(forbidden), false,
    `evidence package must not contain authority/numerical producer: ${forbidden}`);
}

console.log(JSON.stringify({
  schema: 'emp1-engineering-evidence-export-check/v1',
  status: 'PASS_DURABLE_EMP1_EVIDENCE_EXPORT_IMPORT_FAIL_CLOSED',
  packageSchema: evidencePackage.schema,
  packageSemanticHash: evidencePackage.semanticHash,
  sourceDocumentsBound: 2,
  resultHashesBound: 4,
  reviewState: evidencePackage.review.state.state,
  exactImportState: exact.state,
  workspaceExactImportState: workspaceExact.state,
  routeDriftState: routeChanged.state,
  sourceDriftState: sourceDrift.state,
  suspendedRouteReportable: suspended.reportable,
  falsifiersPassed: 9,
  importedCurrentFlagTrusted: false,
  importedRouteAuthorizationTrusted: false,
  importedReleaseAuthorityTrusted: false,
  codeComplianceCreated: false,
  releaseAuthorityCreated: false,
}, null, 2));

function currentState(overrides = {}) {
  const loadTransferDocument =
    overrides.loadTransferDocument ?? sourceDocuments.loadTransferDocument;
  const sectionScreeningDocument =
    overrides.sectionScreeningDocument ?? sourceDocuments.sectionScreeningDocument;
  const currentRunInput = overrides.runInput ?? runInput;
  return {
    inputHashes: {
      loadTransferDocument: semanticHash(loadTransferDocument),
      sectionScreeningDocument: semanticHash(sectionScreeningDocument),
      attachmentGeometry: semanticHash(currentRunInput.localMethod.attachmentGeometry),
      applicabilityGeometry: currentRunInput.localMethod.applicabilityGeometry == null
        ? null
        : semanticHash(currentRunInput.localMethod.applicabilityGeometry),
      localRoute: semanticHash(currentRunInput.localMethod.routeRequest),
    },
    routeAuthority: overrides.routeAuthority ?? {
      productionUseAuthorized: true,
      routeAuthorityHash,
      snapshot: { semanticHash: routeAuthorityHash },
    },
  };
}

function assertRejected(name, mutate, pattern) {
  const next = structuredClone(evidencePackage);
  mutate(next);
  reseal(next);
  assert.throws(
    () => requireEmp1EngineeringEvidencePackage(next),
    pattern,
    name,
  );
}

function reseal(value) {
  const { semanticHash: _old, ...payload } = value;
  value.semanticHash = semanticHash(payload);
}
