/** Live LAFEA viewport for source, retained mesh inspection and qualified results. */
import {
  focusLafeaRetainedMeshElement,
  renderLafeaBcLoadGlyphOverlay,
  renderLafeaRetainedMeshOverlay,
} from './lafea-canvas/retained-mesh-overlay.js';
import {
  selectLafeaBcLoadGlyphDisplayProjection,
} from './lafea-continuum-bc-load-glyph-display-cache.js';
import {
  createLafeaSourceWorkbenchViewportModel,
  mountLafeaSourceWorkbenchViewportModel,
} from './lafea-source-workbench-viewport.js';
import { evaluateLafeaRenderEvidenceIntake } from './lafea-render-evidence-intake.js';
import { lafeaWorkbenchReasonLabels } from './lafea-workbench-reason-labels.js';
import { mountLafeaHybridResultViewport } from './lafea-hybrid-result-viewport-public.js';

export const LAFEA_LIVE_WORKBENCH_VIEWPORT_SCHEMA = 'lafea-live-workbench-viewport/v1';
export const LAFEA_LIVE_WORKBENCH_VIEWPORT_MODES = Object.freeze(['SOURCE_AUTHORING', 'QUALIFIED_RESULT']);

export function createLafeaLiveWorkbenchViewportModel(input) {
  if (!isRecord(input)) throw liveViewportError('LAFEA_LIVE_VIEWPORT_INPUT_REQUIRED');
  const sourceSelection = projectSelectionForSource(input.selection ?? null, input.sceneRevision);
  const sourceModel = createLafeaSourceWorkbenchViewportModel(sourceInput(input, sourceSelection));
  const intake = evaluateLafeaRenderEvidenceIntake({ stageId: sourceModel.registryEntry.stageId,
    sceneRevision: sourceModel.scene.sceneRevision, packet: input.renderPacket ?? null,
    lifecycle: input.lifecycle ?? null, lifecycleBinding: input.lifecycleBinding ?? null });
  const mode = intake.status === 'READY' ? 'QUALIFIED_RESULT' : 'SOURCE_AUTHORING';
  return Object.freeze({ schema: LAFEA_LIVE_WORKBENCH_VIEWPORT_SCHEMA, mode, sourceModel, intake,
    retainedMeshIdentity: retainedMeshIdentity(input.retainedMeshEvidence),
    resultViewport: intake.status === 'READY' ? resultViewport(sourceModel.viewport, intake.packet) : null });
}

export function mountLafeaLiveWorkbenchViewport(root, input) {
  if (!root?.ownerDocument) throw liveViewportError('LAFEA_LIVE_VIEWPORT_ROOT_REQUIRED');
  const model = createLafeaLiveWorkbenchViewportModel(input), viewportHost = root.ownerDocument.createElement('div');
  viewportHost.dataset.role = 'lafea-live-workbench-viewport-host'; root.replaceChildren(viewportHost);
  const glyphBinding = displayGlyphBinding(input);
  let mounted, blockedStatus = null, focusedMeshElementId = input.focusedMeshElementId ?? null, destroyed = false;
  if (model.mode === 'QUALIFIED_RESULT') {
    mounted = mountLafeaHybridResultViewport(viewportHost, { stageId: model.sourceModel.registryEntry.stageId,
      sourceScene: model.sourceModel.scene, intake: model.intake, viewport: model.resultViewport,
      selection: input.selection ?? null, THREE: input.THREE ?? null, onSelectionChange: input.onSelectionChange });
    renderResultOverlays();
  } else {
    mounted = mountLafeaSourceWorkbenchViewportModel(viewportHost, model.sourceModel, sourceInput(input, model.sourceModel.request.selection));
    blockedStatus = renderBlockedStatus(root, model.intake.blockingReasons);
  }
  root.dataset.liveViewportMode = model.mode;
  if (model.retainedMeshIdentity.meshHash) {
    root.dataset.retainedMeshHash = model.retainedMeshIdentity.meshHash;
  } else {
    delete root.dataset.retainedMeshHash;
  }
  if (model.retainedMeshIdentity.artifactHash) {
    root.dataset.retainedMeshArtifactHash = model.retainedMeshIdentity.artifactHash;
  } else {
    delete root.dataset.retainedMeshArtifactHash;
  }

  function currentState() {
    const meshIdentity = model.retainedMeshIdentity;
    if (model.mode === 'QUALIFIED_RESULT') {
      const state = mounted.getState(); return freeze({ schema: LAFEA_LIVE_WORKBENCH_VIEWPORT_SCHEMA, mode: model.mode,
        stageId: state.stageId, sceneRevision: state.sceneRevision, status: state.status, renderer: state.renderer,
        blockingReasons: [...state.blockingReasons], selection: state.selection, focusedMeshElementId,
        retainedMeshHash: meshIdentity.meshHash, retainedMeshArtifactHash: meshIdentity.artifactHash });
    }
    return freeze({ schema: LAFEA_LIVE_WORKBENCH_VIEWPORT_SCHEMA, mode: model.mode,
      stageId: model.sourceModel.registryEntry.stageId, sceneRevision: model.sourceModel.scene.sceneRevision,
      status: 'BLOCKED', renderer: mounted.getRenderer(), blockingReasons: [...model.intake.blockingReasons],
      selection: mounted.getSelection(), focusedMeshElementId,
      retainedMeshHash: meshIdentity.meshHash, retainedMeshArtifactHash: meshIdentity.artifactHash });
  }
  function refresh() { if (destroyed) throw liveViewportError('LAFEA_LIVE_VIEWPORT_DESTROYED'); if (model.mode === 'QUALIFIED_RESULT') { mounted.refresh(); renderResultOverlays(); } return currentState(); }
  function focusRetainedMeshElement(elementId) { if (destroyed) throw liveViewportError('LAFEA_LIVE_VIEWPORT_DESTROYED'); focusedMeshElementId = elementId; if (model.mode === 'QUALIFIED_RESULT') renderResultOverlays(); const found = focusLafeaRetainedMeshElement(viewportHost, elementId); input.onFocusMeshElement?.(elementId, found); return found; }
  function renderResultOverlays() {
    if (model.mode !== 'QUALIFIED_RESULT' || !input.retainedMeshEvidence) return null;
    const mesh = renderLafeaRetainedMeshOverlay({ target: viewportHost, evidence: input.retainedMeshEvidence,
      viewport: model.sourceModel.viewport, focusedElementId: focusedMeshElementId,
      custodyState: input.analysisMeshCustodyState ?? 'UNKNOWN', onFocusElement: focusRetainedMeshElement });
    renderLafeaBcLoadGlyphOverlay({ target: viewportHost, evidence: input.retainedMeshEvidence,
      viewport: model.sourceModel.viewport, projection: glyphBinding.projection,
      executionHash: glyphBinding.executionHash });
    return mesh;
  }
  return Object.freeze({ schema: LAFEA_LIVE_WORKBENCH_VIEWPORT_SCHEMA, scene: model.sourceModel.scene,
    getMode: () => model.mode, getState: currentState, getSelection: mounted.getSelection,
    selectSource: mounted.selectSource, clearSelection: mounted.clearSelection, refresh,
    destroy() { if (destroyed) return; destroyed = true; mounted.destroy(); blockedStatus?.remove?.(); root.replaceChildren(); root.dataset.liveViewportMode = 'DESTROYED'; delete root.dataset.retainedMeshHash; delete root.dataset.retainedMeshArtifactHash; } });
}

function sourceInput(input, selection = input.selection ?? null) {
  const binding = displayGlyphBinding(input);
  return { stageId: input.stageId, document: input.document,
    lifecycle: input.lifecycle ?? null, lifecycleBinding: input.lifecycleBinding ?? null, sceneRevision: input.sceneRevision,
    selection, cssWidth: input.cssWidth, cssHeight: input.cssHeight, devicePixelRatio: input.devicePixelRatio,
    paddingRatio: input.paddingRatio, policy: input.policy, onMoveNode: input.onMoveNode,
    onSelectionChange: input.onSelectionChange, retainedMeshEvidence: input.retainedMeshEvidence ?? null,
    analysisMeshCustodyState: input.analysisMeshCustodyState ?? null,
    bcLoadGlyphProjection: binding.projection, executionHash: binding.executionHash,
    focusedMeshElementId: input.focusedMeshElementId ?? null, onFocusMeshElement: input.onFocusMeshElement };
}
function displayGlyphBinding(input) {
  const executionHash = input.executionHash ?? input.renderPacket?.lineage?.executionHash ?? null;
  const projection = input.bcLoadGlyphProjection
    ?? selectLafeaBcLoadGlyphDisplayProjection(executionHash);
  if (projection && projection.executionHash !== executionHash) {
    throw liveViewportError('LAFEA_LIVE_VIEWPORT_BC_LOAD_GLYPH_EXECUTION_MISMATCH');
  }
  return Object.freeze({ executionHash, projection });
}
function retainedMeshIdentity(evidence) {
  if (!isRecord(evidence)) return Object.freeze({ meshHash: null, artifactHash: null });
  return Object.freeze({
    meshHash: typeof evidence.meshHash === 'string' ? evidence.meshHash : null,
    artifactHash: typeof evidence.artifactHash === 'string' ? evidence.artifactHash : null,
  });
}
function projectSelectionForSource(value, sceneRevision) { if (!isRecord(value) || value.sourceEntityId === null || value.meshEntityId === null || value.sceneRevision !== sceneRevision) return value; return { sceneRevision, sourceEntityId: value.sourceEntityId, meshEntityId: null, entityRole: 'SOURCE' }; }
function resultViewport(sourceViewport, packet) { const value = structuredClone(sourceViewport); value.displayOptions = { sourceAuthoring: false, wireframe: false, fieldBounds: structuredClone(packet.field.bounds), colorMapId: packet.field.colorMapId, deformationScale: 0 }; return freeze(value); }
function renderBlockedStatus(root, reasons) {
  const documentRef = root.ownerDocument;
  const section = documentRef.createElement('section');
  section.dataset.role = 'lafea-live-result-blocked-status';
  section.setAttribute('aria-live', 'polite');
  const title = documentRef.createElement('p');
  title.textContent = 'Analysis results are not displayed yet. You can continue authoring the source model.';
  const list = documentRef.createElement('ul');
  lafeaWorkbenchReasonLabels(reasons).forEach((label) => {
    const item = documentRef.createElement('li');
    item.textContent = label;
    list.append(item);
  });
  section.append(title, list);
  if (reasons.length) section.append(renderBlockedTechnicalCodes(documentRef, reasons));
  root.append(section);
  return section;
}

/** Raw reason codes stay available for support and evidence, behind a disclosure. */
function renderBlockedTechnicalCodes(documentRef, reasons) {
  const details = documentRef.createElement('details');
  details.dataset.role = 'lafea-live-result-blocked-technical';
  const summary = documentRef.createElement('summary');
  summary.textContent = 'Technical reason codes';
  const codes = documentRef.createElement('ul');
  reasons.forEach((reason) => {
    const item = documentRef.createElement('li');
    const code = documentRef.createElement('code');
    code.textContent = reason;
    item.append(code);
    codes.append(item);
  });
  details.append(summary, codes);
  return details;
}
function freeze(value) { if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || Object.isFrozen(value)) return value; Object.values(value).forEach(freeze); return Object.freeze(value); }
function isRecord(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function liveViewportError(code) { const error = new TypeError(code); error.code = code; return error; }
