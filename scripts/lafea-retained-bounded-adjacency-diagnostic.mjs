import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const sourcePath = 'src/workspace/lafea-analysis-mesh-evidence-v2.js';
const original = readFileSync(sourcePath, 'utf8');
const marker = "  if (result.qualification !== 'PASS') {";
if (!original.includes(marker)) throw new Error('DIAGNOSTIC_ADJACENCY_MARKER_NOT_FOUND');
const injection = "  console.log('__LAFEA_BOUNDED_ADJACENCY__' + JSON.stringify(result));\n";

try {
  writeFileSync(sourcePath, original.replace(marker, `${injection}${marker}`), 'utf8');
  const run = spawnSync(process.execPath, ['scripts/lafea-retained-mesh-refinement-check.mjs'], {
    cwd: process.cwd(), encoding: 'utf8',
  });
  const combined = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  const tagged = combined.split(/\r?\n/u)
    .filter((line) => line.startsWith('__LAFEA_BOUNDED_ADJACENCY__'))
    .map((line) => JSON.parse(line.slice('__LAFEA_BOUNDED_ADJACENCY__'.length)));
  if (!tagged.length) throw new Error(`DIAGNOSTIC_ADJACENCY_NOT_EMITTED\n${combined}`);
  const result = tagged[tagged.length - 1];
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/lafea-retained-bounded-adjacency.json', `${JSON.stringify({
    diagnostic: 'LAFEA3_RETAINED_BOUNDED_ADJACENCY',
    childExitCode: run.status,
    ...result,
  }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    diagnostic: 'LAFEA3_RETAINED_BOUNDED_ADJACENCY',
    childExitCode: run.status,
    maximumAllowed: result.maximumAllowed,
    maximumObserved: result.maximumObserved,
    adjacentEdgeCount: result.adjacentEdgeCount,
    violatingAdjacencyCount: result.violatingAdjacencyCount,
    blockingElementIds: result.blockingElementIds,
    qualification: result.qualification,
  }, null, 2));
} finally {
  writeFileSync(sourcePath, original, 'utf8');
}
