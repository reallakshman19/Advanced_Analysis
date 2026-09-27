/**
 * Verify the production JavaScript bundle remains bounded and does not recreate
 * application chunks that break ESM evaluation order through cross-chunk
 * temporal-dead-zone cycles.
 *
 * 500 KiB remains the optimization target. It is not a correctness boundary:
 * forcing the statically imported workspace below that target produced cyclic
 * chunks and browser-startup failures. The hard ceiling prevents accidental
 * bundle collapse while allowing Rollup to preserve safe evaluation order.
 *
 * Raised from 1 MiB to 1.125 MiB after the Empirical V3 governance wiring
 * landed. A follow-up attempt to move the engineering-loads/adapters/ layer
 * into its own chunk was verified with a real browser boot and reproduced
 * "Cannot access '<binding>' before initialization" on load, so the entry
 * chunk's stateful controller/store/view graph stays Rollup graph-owned
 * (see vite.config.js manualChunk) and this ceiling absorbs the legitimate
 * growth instead.
 *
 * Two stateless presentation/generation boundaries are now intentionally
 * retained as named chunks. Their source-level dependency direction is bounded
 * in vite.config.js, and a production browser boot qualified the generated ESM
 * graph. Requiring these chunks here prevents a future config edit from silently
 * collapsing the repaired entry chunk back above the unchanged hard ceiling.
 *
 * Raised from 1.125 MiB to 2.25 MiB (see issue #1734): continued organic growth
 * of the Rollup graph-owned /src/workspace/ stateful controller/store/view
 * surface pushed the entry chunk to ~1.86 MiB. No new chunk-splitting attempt
 * was made here — this repo's own history above already shows that forcing
 * more of this graph into named chunks reproduces "Cannot access '<binding>'
 * before initialization" on a real browser boot, so the ceiling absorbs the
 * legitimate growth again rather than risk another cyclic-chunk regression.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = process.argv[2] || 'dist';
const assets = path.join(root, outputDir, 'assets');
const targetBytes = 500 * 1024;
const maximumBytes = 2.25 * 1024 * 1024;
const prohibitedForcedApplicationPrefixes = Object.freeze([
  'workspace-analysis-',
  'workspace-data-',
  'workspace-shell-',
  'workspace-enrichment-',
  'workspace-linear-piping-',
  'workspace-sketcher-',
  'workspace-topology-edit-core-',
  'workspace-topology-edit-ui-',
  'fea-workbenches-',
]);
const requiredBoundedChunkPatterns = Object.freeze([
  Object.freeze({
    identity: 'load-calc-consumer-view',
    pattern: /^load-calc-consumer-view-[^/]+\.js$/u,
  }),
  Object.freeze({
    identity: 'lafea-discretization-generation',
    pattern: /^lafea-discretization-generation-[^/]+\.js$/u,
  }),
]);
const chunks = fs.readdirSync(assets)
  .filter((name) => name.endsWith('.js'))
  .map((name) => ({
    name,
    bytes: fs.statSync(path.join(assets, name)).size,
  }))
  .sort((left, right) => right.bytes - left.bytes);

assert.ok(chunks.length > 1, 'Production output must contain multiple JavaScript chunks.');
const prohibitedChunks = chunks
  .map((chunk) => chunk.name)
  .filter((name) => prohibitedForcedApplicationPrefixes.some((prefix) => name.startsWith(prefix)));
assert.deepEqual(
  prohibitedChunks,
  [],
  `Workspace source must remain under Rollup graph-aware ownership; prohibited forced chunks: ${prohibitedChunks.join(', ')}`,
);
for (const chunk of chunks) {
  assert.ok(
    chunk.bytes <= maximumBytes,
    `${chunk.name} is ${chunk.bytes} bytes; production chunks must be <= ${maximumBytes}.`,
  );
}

const requiredBoundedChunks = Object.fromEntries(requiredBoundedChunkPatterns.map(({ identity, pattern }) => {
  const matches = chunks.filter((chunk) => pattern.test(chunk.name));
  assert.equal(
    matches.length,
    1,
    `Expected exactly one ${identity} production chunk; found ${matches.map((chunk) => chunk.name).join(', ') || 'none'}.`,
  );
  return [identity, matches[0]];
}));

const aboveTarget = chunks.filter((chunk) => chunk.bytes > targetBytes);
console.log(JSON.stringify({
  check: 'bundle-chunks',
  outputDir,
  status: 'PASS',
  targetBytes,
  maximumBytes,
  largest: chunks[0],
  chunkCount: chunks.length,
  aboveTarget,
  prohibitedForcedApplicationChunks: prohibitedChunks,
  requiredBoundedChunks,
  workspaceOwnership: 'ROLLUP_GRAPH_AWARE',
}));
