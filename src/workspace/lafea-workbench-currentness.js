/** Pure, read-only B02 currentness projection over governed workbench state. */
export const LAFEA_COMPUTATIONAL_STATES = Object.freeze([
  'EDITED', 'READY', 'MESHED', 'RUNNING', 'CURRENT_RESULT', 'STALE_RESULT', 'REJECTED',
]);
export const LAFEA_WORKBENCH_QUALIFICATION_STATES = Object.freeze(['NOT_EVALUATED', 'FAIL', 'PASS']);
export const LAFEA_WORKBENCH_CURRENTNESS_SCHEMA = 'lafea-workbench-currentness/v1';

export function projectLafeaWorkbenchCurrentness(stage) {
  if (!stage || typeof stage.stageId !== 'string') throw new TypeError('LAFEA_WORKBENCH_CURRENTNESS_STAGE_INVALID');
  const lifecycle = stage.lifecycle ?? {}, readiness = stage.lifecycleReadiness ?? {};
  const artifacts = lifecycle.artifacts ?? {}, execution = stage.execution ?? null;
  const retained = ['EXECUTION', 'RESULT_EVIDENCE', 'RECOVERY']
    .map((kind) => artifacts[kind]).filter((row) => row?.status !== 'ABSENT' && row?.artifactHash);
  const pass = retained.some((row) => row.qualification === 'PASS') || execution?.status === 'QUALIFIED';
  const fail = retained.some((row) => ['FAIL', 'BLOCK'].includes(row.qualification)) || execution?.status === 'FAILED';
  const currentResult = readiness.resultReady === true;
  const computationalState = execution?.status === 'FAILED' ? 'REJECTED'
    : execution?.status === 'RUNNING' ? 'RUNNING'
      : currentResult ? 'CURRENT_RESULT'
        : retained.length || execution ? 'STALE_RESULT'
          : meshCurrent(stage, readiness) ? 'MESHED'
            : readiness.modelCurrent === true || readiness.preMeshModelCurrent === true
              || readiness.solverModelCurrent === true ? 'READY' : 'EDITED';
  const qualificationState = pass ? 'PASS' : fail ? 'FAIL' : 'NOT_EVALUATED';
  const qualificationBasis = currentResult && pass ? 'CURRENT_CHAIN'
    : pass ? 'HISTORICAL_RETAINED'
      : fail && computationalState === 'REJECTED' ? 'CURRENT_REJECTION'
        : fail ? 'RETAINED_FAILURE' : 'NONE';
  const currentAuthority = computationalState === 'CURRENT_RESULT' && qualificationState === 'PASS'
    && stage.lifecycleBinding?.status === 'CURRENT';
  const hash = (kind) => artifacts[kind]?.status !== 'ABSENT' ? artifacts[kind]?.artifactHash ?? null : null;
  return Object.freeze({
    schema: LAFEA_WORKBENCH_CURRENTNESS_SCHEMA, stageId: stage.stageId,
    computationalState, qualificationState, qualificationBasis, currentAuthority,
    historicalQualificationRetained: qualificationBasis === 'HISTORICAL_RETAINED',
    identity: Object.freeze({
      sourceRevisionHash: stage.sourceAuthority?.sourceHash ?? lifecycle.source?.sourceHash ?? null,
      documentRevisionToken: stage.lifecycleBinding?.currentDocumentDigest ?? null,
      documentRevisionTokenAuthority: 'EDITOR_REVISION_TOKEN_ONLY',
      canonicalModelHash: hash('CANONICAL_MODEL'),
      meshRevisionHash: stage.analysisMeshCustodyProjection?.meshHash ?? hash('ANALYSIS_MESH'),
      meshProfileHash: execution?.meshProfileHash ?? null,
      solverModelHash: execution?.solverModelHash ?? null,
      executionHash: execution?.compiledExecutionHash ?? hash('EXECUTION'),
      recoveryHash: hash('RECOVERY'), convergenceEvidenceHash: hash('CONVERGENCE'),
    }),
    blockingReasons: Object.freeze([...(readiness.blockingReasons ?? [])]),
  });
}

function meshCurrent(stage, readiness) {
  return readiness.meshQualified === true
    || (stage.analysisMeshCustodyProjection?.state === 'CURRENT_PASS'
      && stage.analysisMeshCustodyProjection?.usableForRun === true);
}
