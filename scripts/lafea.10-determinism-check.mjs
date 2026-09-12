#!/usr/bin/env node

/**
 * LAFEA upgrade spec §10.2 meshing determinism check.
 *
 * Covers `src/core/lafea-meshing/determinism.js` and the T6 generator: no
 * random meshing — the same topology input meshed twice, including across
 * two independent Node process invocations (not just in-process
 * repetition), produces byte-identical node/element output.
 *
 * P2-8 and its shell-scope extensions make the external shell producers part
 * of this permanent determinism surface. The imported planar, multipatch,
 * cylindrical, cylindrical-hole and full-cylinder periodic qualifiers prove
 * geometry, topology, quality, custody and stage-scope contracts before this
 * legacy determinism check continues. A1 additionally requires those shell
 * producer routes themselves to be byte-identical across separate processes;
 * importing their checks only proved an in-process replay.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { canonicalSort, assignCanonicalNumbers, codeUnitCompare } from '../src/core/lafea-meshing/determinism.js';
import { canonicalTopology } from '../src/core/lafea-geometry/index.js';
import { triangulateRegion } from '../src/core/lafea-meshing/index.js';
import './lafea-shell-mesh-producer-check.mjs';
import './lafea-shell-multipatch-seam-check.mjs';
import './lafea-shell-curved-cylinder-check.mjs';
import './lafea-shell-curved-hole-check.mjs';
import './lafea-shell-periodic-cylinder-check.mjs';

console.log('\n--- LAFEA §10.2 meshing determinism check ---');
checkCanonicalOrderingPrimitives();
checkInProcessRepeatability();
checkCrossProcessRepeatability();
checkShellProducerCrossProcessRepeatability();
console.log('\n✅ LAFEA §10.2 meshing determinism check passed.\n');

function checkCanonicalOrderingPrimitives() {
  assert.equal(codeUnitCompare('A', 'B'), -1);
  assert.equal(codeUnitCompare('B', 'A'), 1);
  assert.equal(codeUnitCompare('A', 'A'), 0);

  const items = [{ id: 'C10' }, { id: 'C2' }, { id: 'C1' }];
  const sorted = canonicalSort(items, (item) => item.id);
  assert.deepEqual(sorted.map((i) => i.id), ['C1', 'C10', 'C2'], 'Code-unit order, not numeric order');

  const numbered = assignCanonicalNumbers(sorted, 'N');
  assert.deepEqual(numbered.map((i) => i.canonicalId), ['N1', 'N2', 'N3']);
  console.log('✅ Canonical ordering and numbering are total, deterministic and never PRNG-based.');
}

function squareTopologySource() {
  return {
    schema: 'lafea-geometry-topology/v1',
    vertices: [
      { vertexId: 'V1', x: 0, y: 0 }, { vertexId: 'V2', x: 10, y: 0 },
      { vertexId: 'V3', x: 10, y: 10 }, { vertexId: 'V4', x: 0, y: 10 },
    ],
    curves: [
      { curveId: 'C1', type: 'LINE', startVertexId: 'V1', endVertexId: 'V2', arc: null },
      { curveId: 'C2', type: 'LINE', startVertexId: 'V2', endVertexId: 'V3', arc: null },
      { curveId: 'C3', type: 'LINE', startVertexId: 'V3', endVertexId: 'V4', arc: null },
      { curveId: 'C4', type: 'LINE', startVertexId: 'V4', endVertexId: 'V1', arc: null },
    ],
    loops: [{ loopId: 'OUTER', curveIds: ['C1', 'C2', 'C3', 'C4'] }],
    regions: [{ regionId: 'PLATE', outerLoopId: 'OUTER', holeLoopIds: [] }],
  };
}

function checkInProcessRepeatability() {
  const topology = canonicalTopology(squareTopologySource());
  const first = triangulateRegion(topology, 'PLATE', { targetSize: 1.7, chordErrorLimit: 0.02 });
  const second = triangulateRegion(topology, 'PLATE', { targetSize: 1.7, chordErrorLimit: 0.02 });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  console.log('✅ Meshing the same topology twice in-process produces byte-identical output.');
}

function checkCrossProcessRepeatability() {
  const scriptPath = fileURLToPath(new URL('./lafea-mesh-determinism-worker.mjs', import.meta.url));
  const outputA = executeScript(scriptPath);
  const outputB = executeScript(scriptPath);
  assert.equal(outputA, outputB);
  assert.ok(outputA.length > 0);
  console.log('✅ Meshing the same topology in two independent Node process invocations produces byte-identical output.');
}

function checkShellProducerCrossProcessRepeatability() {
  const checks = [
    './lafea-shell-mesh-producer-check.mjs',
    './lafea-shell-multipatch-seam-check.mjs',
    './lafea-shell-curved-cylinder-check.mjs',
    './lafea-shell-curved-hole-check.mjs',
    './lafea-shell-periodic-cylinder-check.mjs',
  ];
  for (const relative of checks) {
    const scriptPath = fileURLToPath(new URL(relative, import.meta.url));
    const outputA = executeScript(scriptPath);
    const outputB = executeScript(scriptPath);
    assert.ok(outputA.length > 0, `${relative} produced no qualification output`);
    assert.equal(
      outputA,
      outputB,
      `${relative} changed output across independent Node process invocations`,
    );
  }
  console.log('✅ Planar, multipatch, cylindrical, cylindrical-hole and periodic shell producers are byte-identical across two independent Node process invocations.');
}

function executeScript(scriptPath) {
  return execFileSync('node', [scriptPath], {
    cwd: path.dirname(scriptPath),
    encoding: 'utf8',
  });
}
