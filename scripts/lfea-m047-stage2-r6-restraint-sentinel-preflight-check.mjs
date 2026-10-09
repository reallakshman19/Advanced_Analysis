#!/usr/bin/env node
/** Static/fixture contract for the M047 Stage 2 R6 restraint sentinel preflight. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectRestraintSentinels } from './lfea-m047-stage2-r6-restraint-sentinel-preflight.mjs';

const columns = ['NODE_NUM', 'STIFFNESS', 'GAP', 'CNODE'];
const blankRows = [
  { NODE_NUM: 20010, STIFFNESS: null, GAP: null, CNODE: null },
  { NODE_NUM: 20020, STIFFNESS: null, GAP: null, CNODE: null },
];
const pass = inspectRestraintSentinels({ columns, rows: blankRows });
assert.equal(pass.status, 'PASS');
assert.equal(pass.failureCount, 0);
assert.equal(pass.fields.STIFFNESS.blankCount, 2);
assert.equal(pass.fields.GAP.blankCount, 2);
assert.equal(pass.fields.CNODE.blankCount, 2);
assert.equal(pass.mechanicsChanged, false);
assert.equal(pass.toleranceChanged, false);
assert.equal(pass.comparisonPolicyChanged, false);

for (const [field, value] of [
  ['STIFFNESS', 0],
  ['GAP', -1],
  ['CNODE', ''],
]) {
  const rows = blankRows.map((row) => ({ ...row }));
  rows[1][field] = value;
  assert.throws(
    () => inspectRestraintSentinels({ columns, rows }),
    (error) => error.code === 'CAESAR_ACCDB_RESTRAINT_SENTINEL_NONBLANK'
      && error.evidence?.failures?.some((entry) => entry.field === field && entry.rowIndex === 1),
    `${field}=${JSON.stringify(value)} must be treated as populated, not blank`,
  );
}

assert.throws(
  () => inspectRestraintSentinels({ columns: columns.filter((column) => column !== 'CNODE'), rows: blankRows }),
  (error) => error.code === 'CAESAR_ACCDB_RESTRAINT_SENTINEL_COLUMN_MISSING'
    && error.evidence?.missingColumns?.includes('CNODE'),
  'schema drift must fail closed when a required sentinel column disappears',
);

const scriptPath = resolve('scripts/lfea-m047-stage2-r6-restraint-sentinel-preflight.mjs');
const source = readFileSync(scriptPath, 'utf8');
assert.match(source, /PORTABLE_ACCDB_READER_CANONICAL_NULL_ONLY_V1/u);
assert.match(source, /value !== null/u,
  'R6 must accept exact canonical null only; truthiness or numeric-sentinel heuristics are forbidden');
assert.match(source, /BLANK_MEANS_NO_DECLARED_GAP/u);
assert.match(source, /BLANK_MEANS_GROUNDED_RESTRAINT_NO_CONNECTING_NODE/u);
assert.match(source, /64c05a50e9ed0452622ff5880335460486f24ac8e6adecc9a300b549c9aa82f8/u,
  'R6 must pin the corrected BM4_L ACCDB member hash');
assert.match(source, /expectedSha256: PINNED_ACCDB_SHA256/u,
  'R6 must pass the pinned hash directly to the portable reader');
assert.doesNotMatch(source, /input\.expectedSha256/u,
  'R6 custody must not be caller-overridable for the BM4_L-specific preflight');
assert.doesNotMatch(source, /caesar-accdb-friction-solve/u,
  'R6 is a source preflight and must not import/change the nonlinear solver');

const syntax = spawnSync(process.execPath, ['--check', scriptPath], { encoding: 'utf8' });
assert.equal(syntax.status, 0, `R6 preflight must parse: ${syntax.stderr}`);

process.stdout.write('PASS m047 R6 restraint sentinel preflight contract\n');
