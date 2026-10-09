/** UI review preferences only. Never a mass/default/Run-eligibility authority. */
export const DEFAULT_WEIGHT_REVIEW_POLICY = Object.freeze({ flanges: true, valves: true,
  controlValves: true, reliefValves: true, instruments: true, instrumentAboveMm: 100 });
export const WEIGHT_REVIEW_FAMILIES = Object.freeze([
  ['flanges', 'Flanges / blind flanges'], ['valves', 'Valves / UZV'],
  ['controlValves', 'Control valves'], ['reliefValves', 'Relief / safety valves'], ['instruments', 'Instruments'],
]);
const STORAGE_KEY = 'AA.loadCalc.weightReviewPolicy.v1';
const normalized = type => String(type || '').trim().toUpperCase().replace(/[\s-]+/gu, '_');
const types = values => new Set(values.split(' '));
const flange = types('FLAN FLANGE BLIND BLIND_FLANGE');
const control = types('CONTROL_VALVE CONTROLVALVE CV XCV');
const relief = types('RELIEF_VALVE PRESSURE_RELIEF_VALVE SAFETY_VALVE PRESSURE_SAFETY_VALVE RVALV RV PRV PSV');
const valve = types('VALV VALVE UZV');
const instrument = types('INST INSTRUMENT');
export function normalizeWeightReviewPolicy(input = {}) {
  const policy = { ...DEFAULT_WEIGHT_REVIEW_POLICY, ...input };
  for (const [key] of WEIGHT_REVIEW_FAMILIES) if (typeof policy[key] !== 'boolean') throw new TypeError('Review switches must be true or false.');
  if (!Number.isFinite(policy.instrumentAboveMm) || policy.instrumentAboveMm < 0 || policy.instrumentAboveMm > 10000) {
    throw new TypeError('Enter an instrument bore threshold from 0 to 10000 mm.');
  }
  return Object.freeze(Object.fromEntries(Object.keys(DEFAULT_WEIGHT_REVIEW_POLICY).map(key => [key, policy[key]])));
}
export function readWeightReviewPolicy(storage = defaultStorage()) {
  try { return normalizeWeightReviewPolicy(JSON.parse(storage?.getItem(STORAGE_KEY) || '{}')); }
  catch { return DEFAULT_WEIGHT_REVIEW_POLICY; }
}
export function saveWeightReviewPolicy(input, storage = defaultStorage()) {
  const policy = normalizeWeightReviewPolicy(input);
  if (!storage) throw new Error('Browser settings storage is unavailable.');
  storage.setItem(STORAGE_KEY, JSON.stringify(policy)); return policy;
}
function defaultStorage() { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }
export function weightReviewBoreMm(context = {}) {
  const component = context.component || context;
  for (const evidence of [context.sourceBoreMm, context.boreMm, component.compatibilityEvidence?.sourceArriveBoreMm,
    component.compatibilityEvidence?.sourceLeaveBoreMm, component.engineeringProperties?.nominalBoreMm]) {
    const value = typeof evidence === 'object' && evidence !== null ? evidence.value : evidence;
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  }
  return null;
}
export function weightReviewFamily(type, context = {}) {
  const kind = normalized(type), description = String(context.description || '').toUpperCase();
  const equipment = valve.has(kind) || instrument.has(kind) || control.has(kind) || relief.has(kind);
  if (relief.has(kind) || equipment && /\b(RELIEF|SAFETY)\s+VALVE\b|\b(PSV|PRV)\b/.test(description)) return 'reliefValves';
  if (control.has(kind) || equipment && /\bCONTROL\s+VALVE\b|\bXCV\b/.test(description)) return 'controlValves';
  if (flange.has(kind)) return 'flanges';
  if (valve.has(kind) || instrument.has(kind) && /\bUZV\b/.test(description)) return 'valves';
  if (instrument.has(kind)) return 'instruments';
  return null;
}
export function isManualWeightReviewType(type, context = {}, input = readWeightReviewPolicy()) {
  const policy = normalizeWeightReviewPolicy(input), family = weightReviewFamily(type, context);
  if (!family || !policy[family]) return false;
  if (family !== 'instruments') return true;
  const bore = weightReviewBoreMm(context);
  return bore === null || bore > policy.instrumentAboveMm;
}
