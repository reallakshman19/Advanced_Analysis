/**
 * Public failure-content projection for the canonical LAFEA/EMP.1 workbench.
 *
 * Internal stores may retain richer diagnostics for engineering/debug custody.
 * Product-facing state must not copy arbitrary exception/source-derived text.
 */

const DIAGNOSTIC_CODE_PATTERN = /^[A-Z][A-Z0-9_.-]{2,127}$/u;
const DEFAULT_PUBLIC_CODE = 'LAFEA_PUBLIC_FAILURE';
const REVIEWED_PUBLIC_DIAGNOSTIC_MESSAGES = Object.freeze({
  EMP1_WORKBENCH_LAFEA_1_REQUESTED_RADIUS_OUTSIDE_WALL:
    'Pressure evaluation radii no longer fit inside the current pipe wall. Use Undo to restore the previous geometry, or import coordinated assessment data before calculating.',
});

export function boundedLafeaDiagnosticCode(value, fallbackCode = DEFAULT_PUBLIC_CODE) {
  if (typeof value === 'string' && DIAGNOSTIC_CODE_PATTERN.test(value)) return value;
  if (typeof fallbackCode === 'string' && DIAGNOSTIC_CODE_PATTERN.test(fallbackCode)) {
    return fallbackCode;
  }
  return DEFAULT_PUBLIC_CODE;
}

export function publicLafeaFailure(error, fallbackCode, publicMessage) {
  const legacyCode = error instanceof Error
    && typeof error.message === 'string'
    && DIAGNOSTIC_CODE_PATTERN.test(error.message)
    ? error.message
    : null;
  const code = boundedLafeaDiagnosticCode(error?.code ?? legacyCode, fallbackCode);
  const prefix = typeof publicMessage === 'string' && publicMessage.trim()
    ? publicMessage.trim()
    : 'LAFEA operation failed.';
  return Object.freeze({
    code,
    message: `${prefix} Diagnostic code: ${code}.`,
  });
}

export function sanitizeLafeaPublicDiagnostic(value) {
  if (!isRecord(value) || value.severity !== 'ERROR') return value;
  const code = boundedLafeaDiagnosticCode(value.code);
  return Object.freeze({
    ...value,
    code,
    message: REVIEWED_PUBLIC_DIAGNOSTIC_MESSAGES[code]
      ?? `LAFEA operation failed. Diagnostic code: ${code}.`,
  });
}

export function sanitizeLafeaPublicState(value) {
  if (!isWorkbenchState(value)) return value;
  const stages = Object.fromEntries(Object.entries(value.stages).map(([stageId, stage]) => [
    stageId,
    sanitizeStage(stage),
  ]));
  return Object.freeze({
    ...value,
    stages: Object.freeze(stages),
    diagnostics: sanitizeDiagnostics(value.diagnostics),
  });
}

export function sanitizeLafeaPublicResult(value) {
  return sanitizeLafeaPublicState(value);
}

function sanitizeStage(stage) {
  if (!isRecord(stage)) return stage;
  let changed = false;
  const next = { ...stage };

  if (Array.isArray(stage.diagnostics)) {
    next.diagnostics = sanitizeDiagnostics(stage.diagnostics);
    changed = next.diagnostics !== stage.diagnostics;
  }
  if (isRecord(stage.execution) && Array.isArray(stage.execution.diagnostics)) {
    next.execution = Object.freeze({
      ...stage.execution,
      diagnostics: sanitizeDiagnostics(stage.execution.diagnostics),
    });
    changed = true;
  }
  if (isRecord(stage.lastEditResult) && Array.isArray(stage.lastEditResult.diagnostics)) {
    next.lastEditResult = Object.freeze({
      ...stage.lastEditResult,
      diagnostics: sanitizeDiagnostics(stage.lastEditResult.diagnostics),
    });
    changed = true;
  }

  return changed ? Object.freeze(next) : stage;
}

function sanitizeDiagnostics(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  let changed = false;
  const next = rows.map((row) => {
    const projected = sanitizeLafeaPublicDiagnostic(row);
    if (projected !== row) changed = true;
    return projected;
  });
  return changed ? Object.freeze(next) : rows;
}

function isWorkbenchState(value) {
  return isRecord(value)
    && isRecord(value.stages)
    && Array.isArray(value.diagnostics)
    && typeof value.status === 'string';
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
