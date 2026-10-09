/**
 * Unit equality across the two spellings this product uses for the same unit.
 *
 * Project Data and the Non-FEA field registry write engineering units
 * typographically - "kg/m³", "m⁴" - because they are shown to engineers. The
 * common-enriched target-record fields spell the same units in ASCII -
 * "kg/m3", "m4" - because they are record keys. Both spellings are canonical
 * in their own layer, and neither can be changed without moving stored records
 * or the hashes computed over them.
 *
 * Comparing them as raw strings therefore rejects a configured default that is
 * correct. On the 1885S profile that is exactly what happened:
 * 1885S_HYDRO_WATER_DENSITY declares kg/m³ while fluid.hydroDensityKgM3 expects
 * kg/m3, the ancillary overlay raised CONFIGURED_DEFAULT_COMMON_UNIT_UNSUPPORTED,
 * and the mass projection refused to run.
 *
 * Only superscript digits are folded. That is a difference in how a digit is
 * written, not in what the unit means, so kg/m³ matches kg/m3 while kg/m3 still
 * does not match kg/m2 and kg still does not match g. No unit is converted and
 * no value is rescaled here.
 */

const SUPERSCRIPT_DIGITS = Object.freeze({
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
});

const SUPERSCRIPT_PATTERN = /[⁰¹²³⁴-⁹]/gu;

/** The ASCII spelling of a unit, for comparison only. */
export function normalizeEngineeringUnit(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(SUPERSCRIPT_PATTERN, (digit) => SUPERSCRIPT_DIGITS[digit]);
}

/** Whether two unit strings denote the same unit, ignoring superscript spelling. */
export function sameEngineeringUnit(left, right) {
  const normalizedLeft = normalizeEngineeringUnit(left);
  return normalizedLeft !== '' && normalizedLeft === normalizeEngineeringUnit(right);
}
