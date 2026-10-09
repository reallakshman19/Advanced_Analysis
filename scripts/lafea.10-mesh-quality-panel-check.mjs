import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  qualifyAspectRatio, qualifyBoundarySegmentCount, qualifyMinimumAngle,
  qualifyScaledJacobian, qualifyShellWarpage, worstStatus,
} from '../src/core/lafea-meshing/index.js';
import { buildMeshQualityPanel, panelBlocksAdvance } from '../src/workspace/lafea-mesh-quality-panel.js';

// --- Drift guard: every metric the core gate table or workspace analysis-mesh
// gate can emit must be known to the panel. Without this, adding a governed
// metric can surface as a runtime UI throw instead of a qualification failure.
const gateSources = [
  '../src/core/lafea-meshing/quality-gates.js',
  '../src/workspace/lafea-analysis-mesh-quality.js',
].map((relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const governedMetrics = [...new Set(gateSources.flatMap((source) => (
  [...source.matchAll(/metric:\s*'([A-Z_]+)'/gu)].map((match) => match[1])
)))];
assert.ok(governedMetrics.length >= 7, 'expected core and workspace governed mesh-quality metrics');
governedMetrics.forEach((metric) => {
  assert.doesNotThrow(
    () => buildMeshQualityPanel([{ metric, value: 1, status: 'OK' }], { stageId: 'LAFEA.3', meshProfileIdentity: 'P' }),
    `panel must know governed gate metric ${metric}`,
  );
});

// --- The panel renders real gate results verbatim: no reclassification,
// no recomputation, and the panel's worst status agrees with the kernel's
// own `worstStatus` on the identical input. ---
const goodTriangle = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 8.66 }];
const sliverTriangle = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 9.9, y: 0.2 }];

const healthy = [
  qualifyAspectRatio(goodTriangle, { warn: 3, block: 10 }),
  qualifyMinimumAngle(goodTriangle, { warn: 25, block: 10 }),
  qualifyBoundarySegmentCount(24, 16),
];
const healthyPanel = buildMeshQualityPanel(healthy, { stageId: 'LAFEA.3', meshProfileIdentity: 'TEST_MESH_PROFILE_V1' });
assert.equal(healthyPanel.worstStatus, 'OK');
assert.equal(healthyPanel.worstStatus, worstStatus(healthy));
assert.equal(panelBlocksAdvance(healthyPanel), false);
assert.equal(healthyPanel.counts.ok, 3);
healthyPanel.rows.forEach((row, index) => {
  assert.equal(row.value, healthy[index].value, 'panel must render the gate value verbatim');
  assert.equal(row.status, healthy[index].status, 'panel must render the gate status verbatim');
  assert.ok(row.label && row.unit && row.sourcePath, 'every row carries label, unit and provenance');
});

// --- A BLOCK row blocks advancement and is never softened to a warning. ---
const blocking = [
  qualifyAspectRatio(sliverTriangle, { warn: 3, block: 10 }),
  qualifyMinimumAngle(sliverTriangle, { warn: 25, block: 10 }),
  qualifyBoundarySegmentCount(8, 16),
];
const blockingPanel = buildMeshQualityPanel(blocking, { stageId: 'LAFEA.3', meshProfileIdentity: 'TEST_MESH_PROFILE_V1' });
assert.equal(blockingPanel.worstStatus, 'BLOCK');
assert.equal(blockingPanel.worstStatus, worstStatus(blocking));
assert.equal(panelBlocksAdvance(blockingPanel), true);
assert.ok(blockingPanel.counts.block > 0);
assert.ok(blockingPanel.rows.some((row) => row.status === 'BLOCK'), 'a BLOCK row must render as BLOCK');

// --- Shell rows (LAFEA.4/.5 share this panel), including the workspace-owned
// shell orientation/topology gate that is additional to the core metric table.
const warpedQuad = [
  { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 10, y: 10, z: 3 }, { x: 0, y: 10, z: 0 },
];
const shellPanel = buildMeshQualityPanel(
  [
    qualifyShellWarpage(warpedQuad, { warn: 5, block: 15 }),
    qualifyScaledJacobian('T6', [
      { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 },
      { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
    ], { warn: 0.5, block: 0.2 }),
    {
      metric: 'SHELL_ORIENTATION_TOPOLOGY',
      value: 1,
      status: 'OK',
      warningThreshold: null,
      blockingThreshold: 1,
    },
  ],
  { stageId: 'LAFEA.4', meshProfileIdentity: 'TEST_MESH_PROFILE_V1' },
);
assert.equal(shellPanel.stageId, 'LAFEA.4');
assert.equal(shellPanel.rows.length, 3);
const shellTopologyRow = shellPanel.rows.find((row) => row.metric === 'SHELL_ORIENTATION_TOPOLOGY');
assert.equal(shellTopologyRow?.label, 'Shell orientation / topology');
assert.equal(shellTopologyRow?.value, 1);
assert.equal(shellTopologyRow?.status, 'OK');
assert.equal(shellTopologyRow?.threshold, 'blockingThreshold=1');

// --- Fail-closed input validation: an unknown metric is rejected rather
// than rendered as if it had been understood and gated. ---
assert.throws(
  () => buildMeshQualityPanel([{ metric: 'INVENTED_METRIC', value: 1, status: 'OK' }], { stageId: 'LAFEA.3', meshProfileIdentity: 'P' }),
  /not a known mesh-quality metric/,
);
assert.throws(
  () => buildMeshQualityPanel([{ metric: 'ASPECT_RATIO', value: Number.NaN, status: 'OK' }], { stageId: 'LAFEA.3', meshProfileIdentity: 'P' }),
  /finite number/,
);
assert.throws(
  () => buildMeshQualityPanel([{ metric: 'ASPECT_RATIO', value: 1, status: 'PROBABLY_FINE' }], { stageId: 'LAFEA.3', meshProfileIdentity: 'P' }),
  /must be OK, WARNING or BLOCK/,
);
assert.throws(() => buildMeshQualityPanel(healthy, { stageId: 'LAFEA.3' }), /meshProfileIdentity/);
assert.throws(() => buildMeshQualityPanel(healthy, { meshProfileIdentity: 'P' }), /stageId/);

// --- The panel is frozen: a consumer cannot mutate a rendered gate status. ---
assert.ok(Object.isFrozen(healthyPanel) && Object.isFrozen(healthyPanel.rows));
assert.throws(() => { healthyPanel.rows[0].status = 'OK'; }, TypeError);

console.log('LAFEA §10.3 mesh-quality panel (core + workspace governed metrics, verbatim rendering, BLOCK never softened, fail-closed inputs) passed.');
