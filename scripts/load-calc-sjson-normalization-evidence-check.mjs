import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Source inspection only: no Project Data write, qualification or mechanics change.
const file = 'public/fixtures/Sjson.json';
const bytes = readFileSync(file);
const sha256 = createHash('sha256').update(bytes).digest('hex');
assert.equal(sha256, '1e75a288545b771d2292cf730ca19d943e40fa547244478038da65eb8e4fc39a',
  'This evidence is for these exact supplied source bytes, not replacement files.');
const axes = { E: ['x', 1], W: ['x', -1], N: ['y', 1], S: ['y', -1], U: ['z', 1], D: ['z', -1] };
function decode(text) {
  const tokens = [...text.matchAll(/([EWSNUD])\s+([-+]?\d+(?:\.\d+)?)mm/gu)];
  assert.equal(tokens.length, 3, 'Three explicit millimetre directional coordinates required.');
  assert.equal(text.replace(/([EWSNUD])\s+([-+]?\d+(?:\.\d+)?)mm/gu, '').trim(), '',
    'Unsupported position text cannot silently qualify.');
  const out = {};
  for (const [, direction, value] of tokens) {
    const [axis, sign] = axes[direction];
    assert(!Object.hasOwn(out, axis), 'Duplicate coordinate axis is not source evidence.');
    out[axis] = sign * Number(value);
  }
  assert.deepEqual(Object.keys(out).sort(), ['x', 'y', 'z']);
  return out;
}
assert.deepEqual(decode('W 12mm N 3mm D 4mm'), { x: -12, y: 3, z: -4 });
assert.throws(() => decode('E 12m S 3m U 4m'));
assert.throws(() => decode('E 12mm W 3mm U 4mm'));
let inspected = 0;
function walk(entity) {
  const attributes = entity.attributes || {};
  if (attributes.POSI != null) {
    assert(attributes.POS, `${entity.name}: textual position requires numeric source POS.`);
    const decoded = decode(attributes.POSI);
    for (const axis of ['x', 'y', 'z']) {
      assert(Number.isFinite(attributes.POS[axis]), `${entity.name}: numeric source ${axis} absent.`);
      assert(Math.abs(decoded[axis] - attributes.POS[axis]) <= 1e-6,
        `${entity.name}: explicit source text contradicts numeric ${axis}.`);
    }
    inspected++;
  }
  (entity.children || []).forEach(walk);
}
JSON.parse(bytes).forEach(walk);
assert.equal(inspected, 223);
console.log(JSON.stringify({ status: 'PASS', scope: 'SOURCE_INSPECTION_ONLY', file, sha256,
  inspectedPositionPairs: inspected, contradictions: 0, lengthUnit: 'mm', sourceUpAxis: 'Z',
  engineeringApprovalWritten: false, gravityCalculated: false }, null, 2));
