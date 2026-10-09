import { createDiagnostic, DIAGNOSTIC_SEVERITY } from './diagnostics.js';
import { findFirstIndexedEvidence } from './evidence-index.js';
import { deepFreeze } from './immutable.js';

const PORT_BORE_FIELDS = Object.freeze({ sourceArriveBoreMm: ['ABORE'], sourceLeaveBoreMm: ['LBORE'] });

/** Source port sizes are compatibility evidence, not a master section assignment. */
export function collectSourcePortBoreEvidence(index, scope) {
  const values = {}, diagnostics = [];
  for (const [field, aliases] of Object.entries(PORT_BORE_FIELDS)) {
    const found = findFirstIndexedEvidence(index, aliases);
    if (!found) continue;
    const value = positiveMillimetreBore(found.value);
    values[field] = {
      value, unit: 'mm', sourceValue: structuredClone(found.value),
      sourceKind: found.rootPath.split('.')[0], sourcePath: found.sourcePath,
      status: value === null ? 'INVALID' : 'VALID',
    };
    if (value === null) diagnostics.push(createDiagnostic(
      'SOURCE_PORT_BORE_INVALID', `${field} requires a positive nominal bore in millimetres.`,
      { severity: DIAGNOSTIC_SEVERITY.WARNING, scope, field, sourcePath: found.sourcePath },
    ));
  }
  return deepFreeze({ values, diagnostics });
}

function positiveMillimetreBore(raw) {
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  const match = String(raw).trim().match(/^([+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(?:mm)?$/i);
  const value = match ? Number(match[1]) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}
