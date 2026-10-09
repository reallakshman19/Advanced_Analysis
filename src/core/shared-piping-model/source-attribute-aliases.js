import { deepFreeze } from './immutable.js';

/**
 * Extra source attribute names a project maps onto engineering properties.
 *
 * Every source dialect names the same quantity differently, and the built-in
 * alias lists cannot enumerate them all. When a name is not recognised the
 * property is simply absent, and absence reads downstream as "the model does
 * not have this" rather than "the importer did not know the word" - a
 * distinction nothing in the pipeline can make on its own.
 *
 * That is not hypothetical. SJSON states insulation thickness as INSU, which
 * no built-in alias listed, so every component arrived with no insulation
 * thickness: the readiness checker concluded the lines were not insulated and
 * passed them, while the mass resolver refused to compute an insulation mass
 * it could not determine. The lines carry 80 mm of insulation.
 *
 * So the alias set is project-editable. Additions are additive only - a
 * project can teach the importer a new word for a property, and cannot
 * redefine what the property means, retarget a built-in name, or invent a
 * property that no formula consumes.
 */

/** Property keys a project may extend. Anything else is rejected by name. */
export function additionalAliasesFor(specs, configured, propertyKey) {
  const extra = normalizeConfiguredAliases(specs, configured)[propertyKey];
  return extra ? [...extra] : [];
}

/**
 * Merges project-configured aliases into a spec set.
 *
 * Built-in aliases keep their precedence: they are listed first, so a source
 * carrying both a standard name and a project alias still resolves through the
 * standard one and the evidence trail is unchanged for existing datasets.
 */
export function withConfiguredSourceAttributeAliases(specs, configured) {
  const byProperty = normalizeConfiguredAliases(specs, configured);
  if (Object.keys(byProperty).length === 0) return specs;
  return deepFreeze(Object.fromEntries(Object.entries(specs).map(([property, spec]) => {
    const extra = byProperty[property];
    if (!extra?.length) return [property, spec];
    const merged = [...spec.aliases];
    for (const alias of extra) if (!merged.includes(alias)) merged.push(alias);
    return [property, { ...spec, aliases: Object.freeze(merged) }];
  })));
}

/**
 * Validates a configured alias map against a spec set.
 *
 * Returns the usable additions and a diagnostic for anything refused, so a
 * mistyped property key or a duplicated alias is visible in the settings view
 * rather than silently doing nothing.
 */
export function validateConfiguredSourceAttributeAliases(specs, configured) {
  const issues = [];
  const accepted = {};
  if (configured === null || configured === undefined) return frozen({ accepted, issues });
  if (!isRecord(configured)) {
    issues.push(issue('SOURCE_ATTRIBUTE_ALIASES_INVALID', '', 'Configured source attribute aliases must be an object keyed by engineering property.'));
    return frozen({ accepted, issues });
  }
  const claimedBy = new Map();
  for (const [property, spec] of Object.entries(specs)) {
    for (const alias of spec.aliases) claimedBy.set(normalizeAlias(alias), property);
  }
  for (const [property, value] of Object.entries(configured)) {
    if (!Object.hasOwn(specs, property)) {
      issues.push(issue('SOURCE_ATTRIBUTE_ALIAS_UNKNOWN_PROPERTY', property, `${property} is not an engineering property; an alias cannot create one.`));
      continue;
    }
    const list = Array.isArray(value) ? value : [value];
    const usable = [];
    for (const raw of list) {
      const alias = normalizeAlias(raw);
      if (!alias) {
        issues.push(issue('SOURCE_ATTRIBUTE_ALIAS_EMPTY', property, `${property} has an empty alias.`));
        continue;
      }
      const owner = claimedBy.get(alias);
      if (owner && owner !== property) {
        // Retargeting a name that already means something else would silently
        // move evidence between properties, so it is refused rather than won
        // by whichever list is consulted first.
        issues.push(issue('SOURCE_ATTRIBUTE_ALIAS_CONFLICT', property, `${alias} already resolves ${owner} and cannot also resolve ${property}.`));
        continue;
      }
      if (usable.includes(alias)) continue;
      usable.push(alias);
      claimedBy.set(alias, property);
    }
    if (usable.length) accepted[property] = Object.freeze(usable);
  }
  return frozen({ accepted, issues });
}

function normalizeConfiguredAliases(specs, configured) {
  return validateConfiguredSourceAttributeAliases(specs, configured).accepted;
}

function normalizeAlias(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function issue(code, property, message) {
  return { code, property, message };
}

function frozen(value) {
  return deepFreeze(value);
}
