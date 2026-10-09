import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const sourcePath = 'src/workspace/lafea-retained-mesh-refinement.js';
const original = readFileSync(sourcePath, 'utf8');
const marker = '  const coreElements = plan.elementFamily === \'T6\'';
if (!original.includes(marker)) throw new Error('DIAGNOSTIC_CORE_ELEMENTS_MARKER_NOT_FOUND');

const injection = String.raw`
  {
    const measureAdjacency = () => {
      const characteristic = restored.map((triangle, triangleIndex) => {
        const edges = [];
        for (let edge = 0; edge < 3; edge += 1) {
          const left = triangle[edge]; const right = triangle[(edge + 1) % 3];
          edges.push({
            key: edgeKey(left, right), left, right,
            length: Math.hypot(points[right].x - points[left].x, points[right].y - points[left].y),
          });
        }
        edges.sort((a, b) => b.length - a.length || a.key.localeCompare(b.key));
        return { triangleIndex, longest: edges[0] };
      });
      const owners = new Map();
      restored.forEach((triangle, triangleIndex) => {
        for (let edge = 0; edge < 3; edge += 1) {
          const key = edgeKey(triangle[edge], triangle[(edge + 1) % 3]);
          const rows = owners.get(key) ?? []; rows.push(triangleIndex); owners.set(key, rows);
        }
      });
      const violations = []; let maximumObserved = 1;
      for (const [sharedEdgeKey, edgeOwners] of owners) {
        if (edgeOwners.length !== 2) continue;
        const [leftIndex, rightIndex] = edgeOwners;
        const leftLength = characteristic[leftIndex].longest.length;
        const rightLength = characteristic[rightIndex].longest.length;
        const minimum = Math.min(leftLength, rightLength); const maximum = Math.max(leftLength, rightLength);
        const ratio = maximum / minimum; maximumObserved = Math.max(maximumObserved, ratio);
        if (ratio <= adjacentSizeRatioMax + 1e-12) continue;
        const coarseTriangleIndex = leftLength > rightLength
          ? leftIndex : rightLength > leftLength ? rightIndex : Math.min(leftIndex, rightIndex);
        violations.push({ sharedEdgeKey, ratio, coarseTriangleIndex, coarseLongest: characteristic[coarseTriangleIndex].longest });
      }
      violations.sort((a, b) => b.ratio - a.ratio || a.sharedEdgeKey.localeCompare(b.sharedEdgeKey));
      return { maximumObserved, violations };
    };
    const initial = measureAdjacency(); let insertionCount = 0; const maximumInsertions = 64;
    while (insertionCount < maximumInsertions) {
      const measured = measureAdjacency(); if (!measured.violations.length) break;
      let inserted = false;
      for (const violation of measured.violations) {
        const longest = violation.coarseLongest; if (constraints.has(longest.key)) continue;
        const midpoint = {
          x: (points[longest.left].x + points[longest.right].x) / 2,
          y: (points[longest.left].y + points[longest.right].y) / 2,
        };
        if (!insertInteriorPoint(points, restored, constraints, midpoint)) continue;
        insertionCount += 1; restored = lawsonFlip(points, restored, constraints); inserted = true; break;
      }
      if (!inserted) break;
    }
    const final = measureAdjacency();
    console.log('__LAFEA_LONGEST_EDGE_CLOSURE__' + JSON.stringify({
      diagnostic: 'LAFEA3_RETAINED_REFINEMENT_BOUNDED_LONGEST_EDGE_CLOSURE',
      maximumAllowed: adjacentSizeRatioMax,
      initialMaximumObserved: initial.maximumObserved,
      initialViolationCount: initial.violations.length,
      insertionCount,
      finalMaximumObserved: final.maximumObserved,
      finalViolationCount: final.violations.length,
      unresolvedConstrainedLongestEdgeCount: final.violations.filter((row) => constraints.has(row.coarseLongest.key)).length,
      qualification: final.violations.length ? 'BLOCK' : 'PASS',
    }));
  }
`;

try {
  writeFileSync(sourcePath, original.replace(marker, `${injection}\n${marker}`), 'utf8');
  const run = spawnSync(process.execPath, ['scripts/lafea-retained-mesh-refinement-check.mjs'], { cwd: process.cwd(), encoding: 'utf8' });
  const combined = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  const taggedLine = combined.split(/\r?\n/u).find((line) => line.startsWith('__LAFEA_LONGEST_EDGE_CLOSURE__'));
  if (!taggedLine) throw new Error(`DIAGNOSTIC_LONGEST_EDGE_REPORT_NOT_EMITTED\n${combined}`);
  const report = JSON.parse(taggedLine.slice('__LAFEA_LONGEST_EDGE_CLOSURE__'.length));
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/lafea-retained-refinement-longest-edge-closure.json', `${JSON.stringify({ ...report, childExitCode: run.status }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ...report, childExitCode: run.status }, null, 2));
  if (report.qualification !== 'PASS' || run.status !== 0) throw new Error('DIAGNOSTIC_LONGEST_EDGE_CLOSURE_NOT_QUALIFIED');
} finally {
  writeFileSync(sourcePath, original, 'utf8');
}
