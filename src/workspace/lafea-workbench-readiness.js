import { lafeaLifecycleReadiness } from './lafea-lifecycle.js';
import { projectLafeaWorkbenchReleaseBinding } from './lafea-workbench-release-binding.js';

const DOMAIN_FIRST_ROUTE = 'DOMAIN_FIRST_COMPILED_SOLVER_MODEL';

export function projectLafeaWorkbenchReadiness(stageId, stage) {
  const calculationState = stage.execution?.status === 'QUALIFIED'
    ? 'CALCULATION_ACCEPTED_BY_STAGE_CONTRACT'
    : stage.execution ? 'CALCULATION_NOT_ACCEPTED_BY_STAGE_CONTRACT' : 'CALCULATION_NOT_RUN';
  const lifecycle = stage.lifecycle;
  const binding = stage.lifecycleBinding;
  const domainFirst = stage.domainFirstProfileActive === true;
  const domainCurrent = domainFirst && stage.analysisDomainProjection?.state === 'CURRENT_PASS';
  const geometryCurrent = domainFirst && stage.analysisGeometryProjection?.state === 'CURRENT_PASS';
  const custody = stage.analysisMeshCustodyProjection;
  const domainMeshCurrent = domainFirst
    && custody?.state === 'CURRENT_PASS' && custody?.usableForRun === true;
  const releaseBinding = projectLafeaWorkbenchReleaseBinding(
    stage,
    stage.retainedTemplateReleaseRecord,
  );
  const releaseState = releaseBinding.releaseQualified
    ? 'RELEASE_QUALIFIED'
    : 'RELEASE_NOT_QUALIFIED';
  if (!lifecycle) return freeze({
    schema: 'lafea-workbench-lifecycle-readiness/v2',
    stageId,
    lifecycleInitialized: false,
    bindingStatus: binding.status,
    calculationState,
    resultState: 'RESULT_NOT_READY',
    codeState: 'CODE_NOT_READY',
    releaseState,
    releaseBinding,
    releaseBlockingReasons: [...releaseBinding.reasons],
    sourceCurrent: false,
    modelCurrent: false,
    preMeshModelCurrent: false,
    domainFirstProfileActive: domainFirst,
    domainCurrent: false,
    geometryCurrent: false,
    solverModelCurrent: false,
    meshApplicable: domainFirst,
    meshGenerated: Boolean(custody?.meshHash),
    meshQualified: false,
    resultReady: false,
    assessmentApplicable: false,
    assessmentReady: false,
    convergenceApplicable: false,
    convergenceReady: false,
    codeAssessmentApplicable: false,
    codeReady: false,
    reportCurrent: false,
    reportQualified: false,
    blockingReasons: ['LIFECYCLE_NOT_INITIALIZED'],
  });

  const base = lafeaLifecycleReadiness(lifecycle);
  const current = binding.status === 'CURRENT';
  const solverModelCurrent = domainFirst
    ? current && domainCurrent && geometryCurrent && domainMeshCurrent
    : current && base.modelCurrent;
  const domainExecutionReasons = domainFirst
    ? authoritativeDomainExecutionReasons(stage, lifecycle, custody, current)
    : [];
  const authoritativeDomainResultCurrent = domainFirst
    && base.resultReady && domainExecutionReasons.length === 0;
  const resultReady = domainFirst
    ? authoritativeDomainResultCurrent
    : current && base.resultReady;
  const codeReady = !domainFirst && current && base.codeReady;
  const blockingReasons = current
    ? unique([...base.blockingReasons, ...domainExecutionReasons])
    : unique([
      `LIFECYCLE_SOURCE_BINDING_${binding.status}`,
      ...base.blockingReasons,
      ...domainExecutionReasons,
    ]);

  return freeze({
    ...base,
    schema: 'lafea-workbench-lifecycle-readiness/v2',
    lifecycleInitialized: true,
    bindingStatus: binding.status,
    calculationState,
    resultState: resultReady ? 'RESULT_READY' : 'RESULT_NOT_READY',
    codeState: codeReady ? 'CODE_READY' : 'CODE_NOT_READY',
    releaseState,
    releaseBinding,
    releaseBlockingReasons: [...releaseBinding.reasons],
    sourceCurrent: current && base.sourceCurrent,
    modelCurrent: current && base.modelCurrent,
    preMeshModelCurrent: domainFirst ? current && domainCurrent : current && base.modelCurrent,
    domainFirstProfileActive: domainFirst,
    domainCurrent: current && domainCurrent,
    geometryCurrent: current && geometryCurrent,
    solverModelCurrent,
    meshGenerated: domainFirst ? Boolean(custody?.meshHash) : base.meshGenerated,
    meshQualified: domainFirst ? current && domainMeshCurrent : current && base.meshQualified,
    resultReady,
    assessmentReady: !domainFirst && current && base.assessmentReady,
    convergenceReady: !domainFirst && current && base.convergenceReady,
    codeReady,
    reportCurrent: !domainFirst && current && base.reportCurrent,
    reportQualified: !domainFirst && current && base.reportQualified,
    blockingReasons,
  });
}

/** Compact production projection; the full executable contract lives in lafea-workbench-currentness.js. */
export function projectLafeaWorkbenchCurrentness(stage) {
  const r = stage.lifecycleReadiness ?? {}, a = stage.lifecycle?.artifacts ?? {}, e = stage.execution;
  const kept = [a.EXECUTION, a.RESULT_EVIDENCE, a.RECOVERY]
    .filter((x) => x?.status !== 'ABSENT' && x?.artifactHash);
  const pass = e?.status === 'QUALIFIED' || kept.some((x) => x.qualification === 'PASS');
  const fail = e?.status === 'FAILED' || kept.some((x) => x.qualification === 'FAIL' || x.qualification === 'BLOCK');
  const computationalState = e?.status === 'FAILED' ? 'REJECTED' : e?.status === 'RUNNING' ? 'RUNNING'
    : r.resultReady ? 'CURRENT_RESULT' : kept.length || e ? 'STALE_RESULT'
      : r.meshQualified ? 'MESHED' : r.modelCurrent || r.preMeshModelCurrent || r.solverModelCurrent ? 'READY' : 'EDITED';
  const qualificationState = pass ? 'PASS' : fail ? 'FAIL' : 'NOT_EVALUATED';
  const qualificationBasis = r.resultReady && pass ? 'CURRENT_CHAIN' : pass ? 'HISTORICAL_RETAINED'
    : fail && computationalState === 'REJECTED' ? 'CURRENT_REJECTION' : fail ? 'RETAINED_FAILURE' : 'NONE';
  const h = (kind) => a[kind]?.status !== 'ABSENT' ? a[kind]?.artifactHash ?? null : null;
  return {
    schema: 'lafea-workbench-currentness/v1', stageId: stage.stageId,
    computationalState, qualificationState, qualificationBasis,
    currentAuthority: computationalState === 'CURRENT_RESULT' && qualificationState === 'PASS'
      && stage.lifecycleBinding?.status === 'CURRENT',
    historicalQualificationRetained: qualificationBasis === 'HISTORICAL_RETAINED',
    identity: {
      sourceRevisionHash: stage.sourceAuthority?.sourceHash ?? stage.lifecycle?.source?.sourceHash ?? null,
      documentRevisionToken: stage.lifecycleBinding?.currentDocumentDigest ?? null,
      documentRevisionTokenAuthority: 'EDITOR_REVISION_TOKEN_ONLY',
      canonicalModelHash: h('CANONICAL_MODEL'),
      meshRevisionHash: stage.analysisMeshCustodyProjection?.meshHash ?? h('ANALYSIS_MESH'),
      meshProfileHash: e?.meshProfileHash ?? null, solverModelHash: e?.solverModelHash ?? null,
      executionHash: e?.compiledExecutionHash ?? h('EXECUTION'), recoveryHash: h('RECOVERY'),
      convergenceEvidenceHash: h('CONVERGENCE'),
    },
    blockingReasons: [...(r.blockingReasons ?? [])],
  };
}

function authoritativeDomainExecutionReasons(stage, lifecycle, custody, currentBinding) {
  const reasons = [];
  const execution = stage.execution;
  const geometryHash = stage.analysisGeometryProjection?.analysisGeometryHash ?? null;
  const domainHash = stage.analysisDomainProjection?.analysisDomainHash ?? null;
  const meshHash = custody?.meshHash ?? null;
  const sourceHash = stage.sourceAuthority?.sourceHash ?? lifecycle.source?.sourceHash ?? null;
  const artifacts = lifecycle.artifacts ?? {};

  if (!currentBinding) reasons.push('DOMAIN_FIRST_EXECUTION_SOURCE_BINDING_NOT_CURRENT');
  if (stage.analysisDomainProjection?.state !== 'CURRENT_PASS') {
    reasons.push('DOMAIN_FIRST_EXECUTION_DOMAIN_NOT_CURRENT');
  }
  if (stage.analysisGeometryProjection?.state !== 'CURRENT_PASS') {
    reasons.push('DOMAIN_FIRST_EXECUTION_GEOMETRY_NOT_CURRENT');
  }
  if (custody?.state !== 'CURRENT_PASS' || custody?.usableForRun !== true) {
    reasons.push('DOMAIN_FIRST_EXECUTION_MESH_NOT_CURRENT_PASS');
  }
  if (!execution || execution.status !== 'QUALIFIED'
    || execution.route !== DOMAIN_FIRST_ROUTE) {
    reasons.push('DOMAIN_FIRST_EXECUTION_NOT_QUALIFIED');
    return unique(reasons);
  }
  if (execution.sourceHash !== sourceHash) reasons.push('DOMAIN_FIRST_EXECUTION_SOURCE_STALE');
  if (execution.analysisDomainHash !== domainHash) reasons.push('DOMAIN_FIRST_EXECUTION_DOMAIN_STALE');
  if (execution.analysisGeometryHash !== geometryHash) reasons.push('DOMAIN_FIRST_EXECUTION_GEOMETRY_STALE');
  if (execution.meshHash !== meshHash) reasons.push('DOMAIN_FIRST_EXECUTION_MESH_STALE');
  if (artifacts.ANALYSIS_GEOMETRY?.artifactHash !== geometryHash
    || artifacts.ANALYSIS_GEOMETRY?.status !== 'CURRENT'
    || artifacts.ANALYSIS_GEOMETRY?.qualification !== 'PASS') {
    reasons.push('DOMAIN_FIRST_LIFECYCLE_GEOMETRY_STALE');
  }
  if (artifacts.ANALYSIS_MESH?.artifactHash !== meshHash
    || artifacts.ANALYSIS_MESH?.status !== 'CURRENT'
    || artifacts.ANALYSIS_MESH?.qualification !== 'PASS') {
    reasons.push('DOMAIN_FIRST_LIFECYCLE_MESH_STALE');
  }
  if (artifacts.EXECUTION?.artifactHash !== execution.compiledExecutionHash
    || artifacts.EXECUTION?.status !== 'CURRENT'
    || artifacts.EXECUTION?.qualification !== 'PASS') {
    reasons.push('DOMAIN_FIRST_LIFECYCLE_EXECUTION_STALE');
  }
  if (artifacts.RECOVERY?.status !== 'CURRENT'
    || artifacts.RECOVERY?.qualification !== 'PASS') {
    reasons.push('DOMAIN_FIRST_LIFECYCLE_RECOVERY_NOT_CURRENT');
  }
  return unique(reasons);
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))];
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
