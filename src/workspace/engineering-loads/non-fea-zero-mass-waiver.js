import { semanticHash } from '../../core/shared-piping-model/canonical-json.js';
import { freezeDeep, isRecord, stringValue } from '../dataset-utils.js';

export const NON_FEA_ZERO_MASS_WAIVER_SCHEMA = 'non-fea-zero-mass-waiver/v1';

export const NON_FEA_ZERO_MASS_WAIVER_PATH = 'loadCalculation.zeroMassWaivers';

/**
 * The one blocker a zero-mass waiver forgives.
 *
 * A component the engineer has declared massless carries no load, so where it
 * sits on a route cannot change any reaction. Requiring a chainage for it is
 * asking a question whose answer has no consequence, and the audit's own
 * gasket precedent already treats a known-massless component that way.
 *
 * Nothing else is forgiven. An off-route, ambiguous or invalid CoG classifies
 * as fallback-prohibiting evidence about a component that *does* have mass, and
 * a waiver is not an answer to it.
 */
export const NON_FEA_ZERO_MASS_WAIVED_BLOCKER = 'EMPIRICAL_COMPONENT_ROUTE_CHAINAGE_MISSING';

/**
 * An engineer's declaration that a named component has no weighable mass.
 *
 * This exists because the alternative the product reached for first was to
 * infer zero from the catalogue: a fitting the weights master cannot match was
 * recorded at 0 kg under EXACT_APPROVED_MASTER, as though a master row said so.
 * A pressure gauge genuinely is 0 kg for support-load purposes, but that is an
 * engineering judgement about that gauge, not a fact the master states, and the
 * two must not be indistinguishable in the evidence record.
 *
 * So a waiver is explicit, per component, and carries the reason its author
 * gave. It is never inferred from a component type: the same dataset types a
 * 900# angle control valve as INST, and a type rule would silently zero it.
 * Eligibility may be *suggested* from a description, but only an entry here
 * waives anything.
 */
export function createNonFeaZeroMassWaiverSet(input = {}) {
  const entries = normalizeEntries(input.waivers);
  const base = {
    schema: NON_FEA_ZERO_MASS_WAIVER_SCHEMA,
    waivedEntityIds: entries.map((row) => row.entityId),
    entries,
  };
  return freezeDeep({ ...base, semanticHash: semanticHash(base) });
}

/**
 * Reads the approved waiver set from a Project Data profile.
 *
 * An unapproved or absent entry waives nothing: the caller gets an empty set
 * rather than an error, so a project that has never declared a waiver behaves
 * exactly as before.
 */
export function zeroMassWaiverSetFromProfile(profile) {
  const entry = readWaiverEntry(profile);
  if (!isRecord(entry) || entry.approved !== true || !isRecord(entry.value)) {
    return createNonFeaZeroMassWaiverSet({ waivers: [] });
  }
  const waivers = Object.entries(entry.value).map(([entityId, row]) => ({
    entityId,
    justification: isRecord(row) ? row.justification : row,
    waivedBy: isRecord(row) ? row.waivedBy : null,
  }));
  return createNonFeaZeroMassWaiverSet({ waivers });
}

/**
 * Rejects a waiver the audit shows is not the engineer's to make.
 *
 * A component with mass evidence is already answered, and one carrying a source
 * explicit moment has a real demand that excluding it from the load path would
 * drop. Both are caught here rather than at execution, so the reviewer is told
 * at the point of waiving instead of getting a quietly lighter model.
 */
export function assertZeroMassWaiversAdmissible(waiverSet, records) {
  const byEntityId = new Map((records || []).map((row) => [row.entityId, row]));
  const rejected = [];
  for (const entityId of waiverSet.waivedEntityIds) {
    const record = byEntityId.get(entityId);
    if (!record) {
      rejected.push({ entityId, code: 'NON_FEA_ZERO_MASS_WAIVER_ENTITY_UNKNOWN' });
      continue;
    }
    if ((record.explicitMoment?.magnitudeNm ?? 0) > 0) {
      rejected.push({ entityId, code: 'NON_FEA_ZERO_MASS_WAIVER_EXPLICIT_MOMENT_PRESENT' });
    }
  }
  return freezeDeep(rejected.sort((left, right) => compare(
    `${left.entityId}|${left.code}`,
    `${right.entityId}|${right.code}`,
  )));
}

/** Descriptions a waiver is offered for. Suggestion only; never applied on its own. */
const SUGGESTED_DESCRIPTION_PATTERNS = Object.freeze([
  /\bPRESSURE\s+GAUGE\b/u,
  /\bTEMPERATURE\s+(INSTRUMENT|GAUGE|ELEMENT)\b/u,
  /\bTHERMOWELL\b/u,
]);

/**
 * Whether to offer a waiver for a component, from its description alone.
 *
 * Deliberately description-driven rather than type-driven, and deliberately
 * only a default for the checkbox: the reviewer still decides.
 */
export function zeroMassWaiverSuggested(description) {
  const text = stringValue(description).toUpperCase();
  if (!text) return false;
  return SUGGESTED_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(text));
}

function normalizeEntries(value) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) {
    fail('Zero-mass waivers must be supplied as an array.', 'NON_FEA_ZERO_MASS_WAIVER_INVALID');
  }
  const byEntityId = new Map();
  for (const row of value) {
    if (!isRecord(row)) {
      fail('Each zero-mass waiver must be an object.', 'NON_FEA_ZERO_MASS_WAIVER_INVALID');
    }
    const entityId = stringValue(row.entityId);
    const justification = stringValue(row.justification);
    if (!entityId) {
      fail('A zero-mass waiver requires an exact component selector.', 'NON_FEA_ZERO_MASS_WAIVER_SELECTOR_INVALID');
    }
    // The reason is the whole point of the record: a waiver nobody explained is
    // indistinguishable from the inference this mechanism exists to replace.
    if (!justification) {
      fail(
        `Zero-mass waiver for ${entityId} requires a written justification.`,
        'NON_FEA_ZERO_MASS_WAIVER_JUSTIFICATION_REQUIRED',
      );
    }
    byEntityId.set(entityId, freezeDeep({
      entityId,
      justification,
      waivedBy: stringValue(row.waivedBy) || null,
    }));
  }
  return [...byEntityId.values()].sort((left, right) => compare(left.entityId, right.entityId));
}

function readWaiverEntry(profile) {
  return NON_FEA_ZERO_MASS_WAIVER_PATH.split('.')
    .reduce((current, key) => (isRecord(current) ? current[key] : undefined), profile);
}

function compare(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function fail(message, code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
