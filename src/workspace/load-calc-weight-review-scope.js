/** Manual catalogue-weight review is not the automatic pipe/fitting mass path. */
const MANUAL_WEIGHT_TYPES = new Set([
  'VALV', 'VALVE', 'FLAN', 'FLANGE', 'BLIND', 'BLIND_FLANGE',
  'INST', 'INSTRUMENT', 'RELIEF_VALVE', 'PRESSURE_RELIEF_VALVE',
  'SAFETY_VALVE', 'PRESSURE_SAFETY_VALVE', 'RVALV', 'RV', 'PRV', 'PSV', 'UZV',
]);

export function isManualWeightReviewType(type) {
  const normalized = String(type || '').trim().toUpperCase().replace(/[\s-]+/gu, '_');
  return MANUAL_WEIGHT_TYPES.has(normalized);
}
