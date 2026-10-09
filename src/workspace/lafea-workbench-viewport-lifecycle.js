/** Pure dependency contract for deciding whether a mounted LAFEA viewport may be reused. */
export const LAFEA_WORKBENCH_VIEWPORT_DEPENDENCY_SCHEMA =
  'lafea-workbench-viewport-dependencies/v1';

export function createLafeaWorkbenchViewportDependencies(input) {
  if (!input || typeof input !== 'object' || typeof input.stageId !== 'string') {
    throw new TypeError('LAFEA_WORKBENCH_VIEWPORT_DEPENDENCY_INPUT_REQUIRED');
  }
  if (!Number.isInteger(input.sceneRevision) || input.sceneRevision < 0) {
    throw new TypeError('LAFEA_WORKBENCH_VIEWPORT_SCENE_REVISION_INVALID');
  }
  const stage = input.stage;
  if (!stage || typeof stage !== 'object') {
    throw new TypeError('LAFEA_WORKBENCH_VIEWPORT_STAGE_REQUIRED');
  }
  const execution = stage.execution?.status === 'QUALIFIED' ? stage.execution : null;
  return Object.freeze({
    schema: LAFEA_WORKBENCH_VIEWPORT_DEPENDENCY_SCHEMA,
    stageId: input.stageId,
    sceneRevision: input.sceneRevision,
    renderPacket: input.renderPacket ?? null,
    retainedMeshEvidence: effectiveRetainedMeshEvidence(stage),
    analysisMeshCustodyState: stage.analysisMeshCustodyProjection?.state ?? null,
    executionHash: execution?.compiledExecutionHash ?? null,
    bcLoadGlyphProjectionHash: execution?.bcLoadGlyphProjection?.semanticHash ?? null,
    domainFirstProfileActive: stage.domainFirstProfileActive === true,
    shellMidsurfaceProfileActive: stage.shellMidsurfaceProfileActive === true,
  });
}

export function canReuseLafeaWorkbenchViewport(previous, next) {
  if (previous?.schema !== LAFEA_WORKBENCH_VIEWPORT_DEPENDENCY_SCHEMA
    || next?.schema !== LAFEA_WORKBENCH_VIEWPORT_DEPENDENCY_SCHEMA) {
    return false;
  }
  return previous.stageId === next.stageId
    && previous.sceneRevision === next.sceneRevision
    && previous.renderPacket === next.renderPacket
    && previous.retainedMeshEvidence === next.retainedMeshEvidence
    && previous.analysisMeshCustodyState === next.analysisMeshCustodyState
    && previous.executionHash === next.executionHash
    && previous.bcLoadGlyphProjectionHash === next.bcLoadGlyphProjectionHash
    && previous.domainFirstProfileActive === next.domainFirstProfileActive
    && previous.shellMidsurfaceProfileActive === next.shellMidsurfaceProfileActive;
}

function effectiveRetainedMeshEvidence(stage) {
  if (stage.analysisMeshCustodyProjection?.canView !== true) return null;
  if (stage.domainFirstProfileActive === true || stage.shellMidsurfaceProfileActive === true) {
    return stage.retainedAnalysisMeshEvidenceV2 ?? null;
  }
  return stage.retainedAnalysisMeshEvidence ?? null;
}
