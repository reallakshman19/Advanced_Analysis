export const LAFEA4_TECH13_IMPLEMENTATION_CURRENTNESS_SCHEMA =
  'lafea4-tech13-implementation-currentness/v1';
export const LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT_MISSING_CODE =
  'LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT_MISSING';
export const LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT_MISMATCH_CODE =
  'LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT_MISMATCH';

const FINGERPRINT_PATTERN = /^sha256:[0-9a-f]{64}$/u;

/**
 * Browser production accepts only the source fingerprint injected through
 * Vite's explicit `define` replacement. The global fallback exists solely for
 * non-browser Node qualification after the harness independently recomputes
 * the exact source tree; it is never a browser authority seam and cannot
 * rescue a missing production build value.
 */
export function currentLafea4Tech13ImplementationFingerprint() {
  const buildValue = typeof __LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT__ === 'string'
    ? __LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT__
    : null;
  const browserRuntime = typeof window !== 'undefined' && typeof document !== 'undefined';
  const harnessValue = browserRuntime
    ? null
    : globalThis.__LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT__ ?? null;
  const value = buildValue ?? harnessValue;
  return typeof value === 'string' && FINGERPRINT_PATTERN.test(value) ? value : null;
}

export function evaluateLafea4Tech13ImplementationCurrentness(promotionRecord) {
  const qualifiedFingerprint = promotionRecord?.implementationFingerprint ?? null;
  const currentFingerprint = currentLafea4Tech13ImplementationFingerprint();
  let diagnosticCode = null;
  if (currentFingerprint === null) {
    diagnosticCode = LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT_MISSING_CODE;
  } else if (!FINGERPRINT_PATTERN.test(qualifiedFingerprint ?? '')
    || qualifiedFingerprint !== currentFingerprint) {
    diagnosticCode = LAFEA4_TECH13_IMPLEMENTATION_FINGERPRINT_MISMATCH_CODE;
  }
  return freeze({
    schema: LAFEA4_TECH13_IMPLEMENTATION_CURRENTNESS_SCHEMA,
    stageId: 'LAFEA.4',
    qualifiedImplementationFingerprint: qualifiedFingerprint,
    currentImplementationFingerprint: currentFingerprint,
    current: diagnosticCode === null,
    diagnosticCode,
  });
}

export function requireLafea4Tech13ImplementationCurrent(promotionRecord) {
  const state = evaluateLafea4Tech13ImplementationCurrentness(promotionRecord);
  if (!state.current) {
    const error = new TypeError(state.diagnosticCode);
    error.code = state.diagnosticCode;
    error.currentness = state;
    throw error;
  }
  return state;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
