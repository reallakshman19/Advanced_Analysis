import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const sourcePath = 'src/workspace/lafea-retained-mesh-refinement.js';
const original = readFileSync(sourcePath, 'utf8');
const marker = '  const coreElements = plan.elementFamily === \'T6\'';
if (!original.includes(marker)) throw new Error('DIAGNOSTIC_CORE_ELEMENTS_MARKER_NOT_FOUND');

const injection = String.raw`
  {
    const characteristic = restored.map((triangle, triangleIndex) => {
      const rows = [];
      for (let edge = 0; edge < 3; edge += 1) {
        const left = triangle[edge];
        const right = triangle[(edge + 1) % 3];
        const length = Math.hypot(points[right].x - points[left].x, points[right].y - points[left].y);
        rows.push({ edgeIndex: edge, key: edgeKey(left, right), left, right, length });
      }
      rows.sort((a, b) => b.length - a.length || a.key.localeCompare(b.key));
      return { triangleIndex, longest: rows[0] };
    });
    const owners = new Map();
    restored.forEach((triangle, triangleIndex) => {
      for (let edge = 0; edge < 3; edge += 1) {
        const key = edgeKey(triangle[edge], triangle[(edge + 1) % 3]);
        const rows = owners.get(key) ?? [];
        rows.push(triangleIndex);
        owners.set(key, rows);
      }
    });
    const violations = [];
    for (const [sharedEdgeKey, edgeOwners] of owners) {
      if (edgeOwners.length !== 2) continue;
      const [leftIndex, rightIndex] = edgeOwners;
      const leftLength = characteristic[leftIndex].longest.length;
      const rightLength = characteristic[rightIndex].longest.length;
      const minimum = Math.min(leftLength, rightLength);
      const maximum = Math.max(leftLength, rightLength);
      const ratio = maximum / minimum;
      if (ratio <= adjacentSizeRatioMax + 1e-12) continue;
      const coarseTriangleIndex = leftLength >= rightLength ? leftIndex : rightIndex;
      const coarse = characteristic[coarseTriangleIndex];
      const triangle = restored[coarseTriangleIndex];
      const centroid = {
        x: triangle.reduce((sum, pointIndex) => sum + points[pointIndex].x, 0) / 3,
        y: triangle.reduce((sum, pointIndex) => sum + points[pointIndex].y, 0) / 3,
      };
      const targetDistance = Math.min(...plan.targets.map((target) => Math.hypot(centroid.x - target.x, centroid.y - target.y)));
      violations.push({
        sharedEdgeKey,
        ownerTriangleIndices: edgeOwners,
        coarseTriangleIndex,
        minimumCharacteristicLength: minimum,
        maximumCharacteristicLength: maximum,
        ratio,
        coarseLongestEdge: {
          key: coarse.longest.key,
          length: coarse.longest.length,
          constrained: constraints.has(coarse.longest.key),
          coordinates: [points[coarse.longest.left], points[coarse.longest.right]],
        },
        coarseTriangleCoordinates: triangle.map((pointIndex) => points[pointIndex]),
        coarseCentroid: centroid,
        targetDistance,
      });
    }
    violations.sort((a, b) => b.ratio - a.ratio || a.sharedEdgeKey.localeCompare(b.sharedEdgeKey));
    console.log('__LAFEA_EDGE_DIAGNOSTIC__' + JSON.stringify({
      diagnostic: 'LAFEA3_RETAINED_REFINEMENT_VIOLATING_COARSE_EDGE_CLASSIFICATION',
      adjacentSizeRatioMax,
      violationCount: violations.length,
      allCoarseLongestEdgesInterior: violations.every((row) => !row.coarseLongestEdge.constrained),
      constrainedCoarseLongestEdgeCount: violations.filter((row) => row.coarseLongestEdge.constrained).length,
      violations,
    }));
  }
`;

try {
  writeFileSync(sourcePath, original.replace(marker, `${injection}\n${marker}`), 'utf8');
  const run = spawnSync(process.execPath, ['scripts/lafea-retained-mesh-refinement-check.mjs'], {
    cwd: process.cwd(), encoding: 'utf8',
  });
  const combined = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  const taggedLine = combined.split(/\r?\n/u).find((line) => line.startsWith('__LAFEA_EDGE_DIAGNOSTIC__'));
  if (!taggedLine) throw new Error('DIAGNOSTIC_EDGE_CLASSIFICATION_NOT_EMITTED');
  const diagnostic = JSON.parse(taggedLine.slice('__LAFEA_EDGE_DIAGNOSTIC__'.length));
  mkdirSync('test-results', { recursive: true });
  writeFileSync(
    'test-results/lafea-retained-refinement-edge-classification.json',
    `${JSON.stringify(diagnostic, null, 2)}\n`,
    'utf8',
  );
  console.log(JSON.stringify(diagnostic, null, 2));
  if (!combined.includes('LAFEA_ANALYSIS_MESH_V2_REFINEMENT_ADJACENT_SIZE_RATIO_BLOCK')) {
    throw new Error('DIAGNOSTIC_EXPECTED_ADJACENCY_BLOCK_NOT_OBSERVED');
  }
} finally {
  writeFileSync(sourcePath, original, 'utf8');
}
