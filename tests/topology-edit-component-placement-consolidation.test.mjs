import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TOPOLOGY_EDIT_COMPONENT_PLACEMENT_TOOLS,
  componentPlacementTargetReady,
  componentPlacementWorkflowActive,
} from '../src/workspace/viewport-productivity/topology-edit-component-placement-consolidation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runtime(tool, overrides = {}) {
  return {
    state: { tool, target: { canonicalIds: ['edge:host'] } },
    catalogue: () => ({ catalogueId: 'CAT-1' }),
    ...overrides,
  };
}

test('component placement consolidation covers exactly the existing governed placement families', () => {
  assert.deepEqual(TOPOLOGY_EDIT_COMPONENT_PLACEMENT_TOOLS, [
    'VALVE_ASSEMBLY', 'FLANGE', 'REDUCER', 'BRANCH', 'BLIND_FLANGE',
  ]);
  for (const tool of TOPOLOGY_EDIT_COMPONENT_PLACEMENT_TOOLS) {
    assert.equal(componentPlacementWorkflowActive(runtime(tool)), true);
    assert.equal(componentPlacementTargetReady(runtime(tool)), true);
  }
  assert.equal(componentPlacementWorkflowActive(runtime('ROUTE_ELBOW')), false);
  assert.equal(componentPlacementWorkflowActive(runtime('MOVE')), false);
});

test('automatic placement qualification requires both exact target and current catalogue', () => {
  assert.equal(componentPlacementTargetReady(runtime('FLANGE', {
    state: { tool: 'FLANGE', target: null },
  })), false);
  assert.equal(componentPlacementTargetReady(runtime('FLANGE', {
    catalogue: () => null,
  })), false);
});

test('component runtime invalidates every user-authority placement field and rejects stale automatic work', async () => {
  const source = await readFile(path.join(
    ROOT,
    'src/workspace/viewport-productivity/topology-edit-component-authoring-runtime.js',
  ), 'utf8');
  for (const field of [
    'stationMm', 'catalogueRecordId', 'inlineDirection',
    'valveRecordId', 'upstreamFlangeRecordId', 'downstreamFlangeRecordId',
    'clockingDeg', 'branchPipeLengthMm',
  ]) assert.match(source, new RegExp(field));
  assert.match(source, /componentPlacementRevision/);
  assert.match(source, /queueMicrotask/);
  assert.match(source, /runAutomaticComponentQualification/);
  assert.match(source, /discardStaleComponentCandidate/);
  assert.match(source, /await this\.previewOperation\(\)/);
  assert.match(source, /await this\.validateOperation\(\)/);
  assert.doesNotMatch(source, /Date\.now|Math\.random|randomUUID/);
  assert.doesNotMatch(source, /WorkspaceState|zustand/i);
});

test('blind flange participates in the same automatic placement revision contract', async () => {
  const source = await readFile(path.join(
    ROOT,
    'src/workspace/viewport-productivity/topology-edit-blind-flange-authoring-runtime.js',
  ), 'utf8');
  assert.match(source, /componentPlacementRevision/);
  assert.match(source, /queueComponentQualification/);
  assert.match(source, /renderComponentPlacementConsolidation/);
  assert.doesNotMatch(source, /Date\.now|Math\.random|randomUUID/);
});

test('Apply remains gated by the existing READY_TO_APPLY authoring phase', async () => {
  const source = await readFile(path.join(
    ROOT,
    'src/workspace/viewport-productivity/topology-edit-authoring-runtime.js',
  ), 'utf8');
  assert.match(
    source,
    /data-action="apply-authoring-operation" \$\{this\.state\.phase !== 'READY_TO_APPLY' \|\| this\.pending \? 'disabled' : ''\}/,
  );
});
