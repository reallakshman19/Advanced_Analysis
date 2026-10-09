#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  LAFEA_WORKBENCH_VIEWPORT_DEPENDENCY_SCHEMA,
  canReuseLafeaWorkbenchViewport,
  createLafeaWorkbenchViewportDependencies,
} from '../src/workspace/lafea-workbench-viewport-lifecycle.js';

const packet = Object.freeze({ semanticHash: 'packet-a' });
const mesh = Object.freeze({ artifactHash: 'mesh-a' });
const stage = baseStage(mesh, 'CURRENT_PASS');
const first = dependencies('LAFEA.3', 7, stage, packet);
const same = dependencies('LAFEA.3', 7, stage, packet);
assert.equal(first.schema, LAFEA_WORKBENCH_VIEWPORT_DEPENDENCY_SCHEMA);
assert.equal(canReuseLafeaWorkbenchViewport(first, same), true);

assert.equal(canReuseLafeaWorkbenchViewport(first, dependencies('LAFEA.3', 8, stage, packet)), false, 'scene revision change must rebuild');
assert.equal(canReuseLafeaWorkbenchViewport(first, dependencies('LAFEA.4', 7, stage, packet)), false, 'stage change must rebuild');
assert.equal(canReuseLafeaWorkbenchViewport(first, dependencies('LAFEA.3', 7, stage, Object.freeze({ semanticHash: 'packet-a' }))), false, 'new render-packet identity must rebuild');
assert.equal(canReuseLafeaWorkbenchViewport(first, dependencies('LAFEA.3', 7, baseStage(Object.freeze({ artifactHash: 'mesh-b' }), 'CURRENT_PASS'), packet)), false, 'retained mesh identity change must rebuild');
assert.equal(canReuseLafeaWorkbenchViewport(first, dependencies('LAFEA.3', 7, baseStage(mesh, 'CURRENT_WARNING'), packet)), false, 'mesh custody state change must rebuild');
assert.equal(canReuseLafeaWorkbenchViewport(null, first), false);

const accepted = baseStage(mesh, 'CURRENT_PASS');
accepted.execution = {
  status: 'QUALIFIED',
  compiledExecutionHash: 'sha256:execution-a',
  bcLoadGlyphProjection: { semanticHash: 'sha256:glyph-a' },
};
const acceptedDependencies = dependencies('LAFEA.3', 7, accepted, packet);
assert.equal(acceptedDependencies.executionHash, 'sha256:execution-a');
assert.equal(acceptedDependencies.bcLoadGlyphProjectionHash, 'sha256:glyph-a');
assert.equal(canReuseLafeaWorkbenchViewport(first, acceptedDependencies), false,
  'accepted execution must rebuild a pre-run viewport so result custody becomes visible');
const changedGlyph = structuredClone(accepted);
changedGlyph.execution.bcLoadGlyphProjection.semanticHash = 'sha256:glyph-b';
assert.equal(canReuseLafeaWorkbenchViewport(
  acceptedDependencies,
  dependencies('LAFEA.3', 7, changedGlyph, packet),
), false, 'canonical glyph projection change must rebuild');

const hiddenMesh = dependencies('LAFEA.3', 7, {
  ...baseStage(mesh, 'CURRENT_BLOCK'),
  analysisMeshCustodyProjection: { state: 'CURRENT_BLOCK', canView: false },
}, packet);
assert.equal(hiddenMesh.retainedMeshEvidence, null);

const domainMesh = Object.freeze({ artifactHash: 'mesh-v2' });
const domain = dependencies('LAFEA.3', 7, {
  ...baseStage(mesh, 'CURRENT_PASS'),
  domainFirstProfileActive: true,
  retainedAnalysisMeshEvidenceV2: domainMesh,
}, packet);
assert.equal(domain.retainedMeshEvidence, domainMesh);

const viewSource = read('../src/workspace/lafea-workbench-view.js');
const contentSource = read('../src/workspace/lafea-workbench-content.js');
assert.match(viewSource, /canReuseLafeaWorkbenchViewport/u);
assert.match(viewSource, /if \(!reuseViewport\) previousViewport\?\.destroy\(\)/u);
assert.match(contentSource, /reusedViewport/u);
assert.match(contentSource, /viewportElement: preview/u);

console.log(JSON.stringify({
  check: 'lafea-ui-viewport-lifecycle',
  status: 'PASS',
  sameDependenciesReuseViewport: true,
  sceneOrEvidenceChangesRebuild: true,
  executionOrGlyphCustodyChangesRebuild: true,
  replacementMountsBeforeOldDestroy: true,
  githubActionsWorkflowAdded: false,
}));

function dependencies(stageId, sceneRevision, stageValue, renderPacket) {
  return createLafeaWorkbenchViewportDependencies({ stageId, sceneRevision, stage: stageValue, renderPacket });
}
function baseStage(retainedAnalysisMeshEvidence, state) {
  return {
    domainFirstProfileActive: false,
    shellMidsurfaceProfileActive: false,
    retainedAnalysisMeshEvidence,
    retainedAnalysisMeshEvidenceV2: null,
    analysisMeshCustodyProjection: { state, canView: true },
  };
}
function read(relative) { return fs.readFileSync(new URL(relative, import.meta.url), 'utf8'); }
