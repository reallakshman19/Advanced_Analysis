/**
 * Frozen numerical-parity comparator for LAFEA compiled-vs-legacy execution.
 *
 * Structure is compared exactly: same keys, same array lengths, same
 * identities, same non-numeric values. Only finite numbers are compared with a
 * tolerance, and only where the two paths are mathematically required to agree.
 *
 * Tolerance derivation. IEEE-754 double epsilon is 2.220446049250313e-16. The
 * compared quantities are produced through element assembly and a Cholesky
 * solve, so representation error is amplified by roughly the condition number
 * of the assembled system. LAFEA_NUMERIC_PARITY_RELATIVE_TOLERANCE is fixed at
 * 1e-12, about 4.5e3 * eps, which covers that amplification for a small
 * well-conditioned continuum system with margin while staying several orders
 * below any physically meaningful discrepancy: a wrong normal direction, a
 * wrong Jacobian, a missing thickness or a factor of two all appear at 1e-1 to
 * 1e0 relative. The tolerance is a frozen contract value. It is NOT derived
 * from an observed deviation, and it must not be widened to make a comparison
 * pass; a comparison that needs more than this is reporting a real difference.
 */
export const LAFEA_NUMERIC_PARITY_RELATIVE_TOLERANCE = 1e-12;

/** Values at or below scale * this are compared absolutely, not relatively. */
const NEAR_ZERO_FRACTION = 1e-9;


export function compareLafeaNumericParity(actual, expected, options = {}) {
  const relativeTolerance = Number.isFinite(options.relativeTolerance)
    ? options.relativeTolerance
    : LAFEA_NUMERIC_PARITY_RELATIVE_TOLERANCE;
  const scale = magnitudeScale(expected);
  const state = {
    relativeTolerance,
    scale,
    nearZeroBand: scale * NEAR_ZERO_FRACTION,
    absoluteFloor: scale * relativeTolerance,
    maxRelativeDeviation: 0,
    maxAbsoluteDeviation: 0,
    comparedNumbers: 0,
    mismatch: null,
  };
  walk(actual, expected, '$', state);
  return Object.freeze({
    ok: state.mismatch === null,
    mismatch: state.mismatch,
    scale,
    relativeTolerance,
    comparedNumbers: state.comparedNumbers,
    maxRelativeDeviation: state.maxRelativeDeviation,
    maxAbsoluteDeviation: state.maxAbsoluteDeviation,
  });
}

function walk(actual, expected, path, state) {
  if (state.mismatch) return;
  if (typeof expected === 'number') {
    if (typeof actual !== 'number') {
      fail(state, path, 'EXPECTED_NUMBER', actual, expected);
      return;
    }
    if (!Number.isFinite(expected) || !Number.isFinite(actual)) {
      if (!Object.is(actual, expected)) fail(state, path, 'NONFINITE_MISMATCH', actual, expected);
      return;
    }
    compareNumber(actual, expected, path, state);
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      fail(state, path, 'EXPECTED_ARRAY', actual, expected);
      return;
    }
    if (actual.length !== expected.length) {
      fail(state, path, 'ARRAY_LENGTH', actual.length, expected.length);
      return;
    }
    expected.forEach((row, index) => walk(actual[index], row, `${path}[${index}]`, state));
    return;
  }
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
      fail(state, path, 'EXPECTED_OBJECT', actual, expected);
      return;
    }
    const expectedKeys = Object.keys(expected).sort();
    const actualKeys = Object.keys(actual).sort();
    const sameKeys = expectedKeys.length === actualKeys.length
      && expectedKeys.every((key, index) => key === actualKeys[index]);
    if (!sameKeys) {
      fail(state, path, 'OBJECT_KEYS', actualKeys, expectedKeys);
      return;
    }
    expectedKeys.forEach((key) => walk(actual[key], expected[key], `${path}.${key}`, state));
    return;
  }
  // Identities, labels, booleans and null compare exactly.
  if (!Object.is(actual, expected)) fail(state, path, 'VALUE', actual, expected);
}

function compareNumber(actual, expected, path, state) {
  state.comparedNumbers += 1;
  const absolute = Math.abs(actual - expected);
  state.maxAbsoluteDeviation = Math.max(state.maxAbsoluteDeviation, absolute);
  const magnitude = Math.max(Math.abs(actual), Math.abs(expected));
  if (magnitude <= state.nearZeroBand) {
    if (absolute > state.absoluteFloor) {
      fail(state, path, 'NEAR_ZERO_ABSOLUTE', actual, expected, {
        absolute,
        limit: state.absoluteFloor,
      });
    }
    return;
  }
  const relative = absolute / magnitude;
  state.maxRelativeDeviation = Math.max(state.maxRelativeDeviation, relative);
  if (relative > state.relativeTolerance) {
    fail(state, path, 'RELATIVE', actual, expected, {
      relative,
      limit: state.relativeTolerance,
    });
  }
}

function fail(state, path, reason, actual, expected, detail = {}) {
  if (state.mismatch) return;
  state.mismatch = Object.freeze({
    path, reason, actual, expected, ...detail,
  });
}

/** Largest finite magnitude anywhere in the reference structure. */
function magnitudeScale(value) {
  let scale = 0;
  const visit = (node) => {
    if (typeof node === 'number') {
      if (Number.isFinite(node)) scale = Math.max(scale, Math.abs(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node && typeof node === 'object') Object.values(node).forEach(visit);
  };
  visit(value);
  return scale > 0 ? scale : 1;
}
