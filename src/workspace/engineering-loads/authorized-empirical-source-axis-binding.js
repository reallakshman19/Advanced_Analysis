import { semanticHash } from '../../core/shared-piping-model/canonical-json.js';
import { clonePlain, freezeDeep, stringValue } from '../dataset-utils.js';
import { projectDataEntry } from '../project-data/project-data-contract.js';

export const AUTHORIZED_EMPIRICAL_SOURCE_AXIS_BINDING_SCHEMA =
  'authorized-empirical-source-axis-binding/v1';

const SOURCE_AXIS_PATH = 'sourcesAndUnits.sourceUpAxis';
const LENGTH_UNIT_PATH = 'sourcesAndUnits.lengthUnit';
const SUPPORTED_SOURCE_AXES = Object.freeze(['X', 'Y', 'Z']);
const IMPLEMENTED_LENGTH_UNIT = 'mm';
const LEGACY_SCALAR_KERNEL_BASIS = 'Z_UP';
const AXIS_GENERAL_MECHANICS_SCOPE = 'SOURCE_AXIS_GENERAL_MM_SCALAR_VERTICAL_GRAVITY';
const AXIS_INVARIANCE_BASIS = 'XYZ_PERMUTATION_INVARIANT_EUCLIDEAN_ROUTE_CHAINAGE_SCALAR_GRAVITY';

/**
 * Validates the exact source-axis authority consumed by the scalar gravity path.
 *
 * V2/V3 gravity mechanics consume Euclidean support grouping, Euclidean route/
 * CoG projection, route chainage and a scalar gravity magnitude. Those
 * operations are invariant under permutation of source X/Y/Z axes; the physical
 * vertical direction is therefore an authority/sign convention, not a special
 * coordinate used by the statics formulas. Source geometry remains in mm and
 * no arbitrary gravity-vector or unit transformation is introduced here.
 */
/**
 * The approved source length unit on its own.
 *
 * Separated from the full source basis because callers differ in what they
 * legitimately need: converting source geometry to metres requires the length
 * unit, while the up-axis only decides which way gravity acts and is not
 * consulted until distribution. Demanding the axis from a caller that never
 * uses it would fail closed on a profile that is complete for its purpose.
 */
/**
 * The approved source length unit when the profile carries one, else null.
 *
 * Optional rather than required because a missing unit is already fatal
 * downstream and says so precisely: the load-source projection stamps
 * UNIT_BLOCKED on every component. Demanding approval here would turn that
 * specific diagnostic into an earlier, blunter refusal, and would break
 * callers whose profile is complete for what they actually do. Nothing is
 * assumed when it is absent - the model's own units still decide.
 */
export function optionalAuthorizedEmpiricalSourceLengthUnit(profile) {
  const unitEntry = projectDataEntry(profile, LENGTH_UNIT_PATH);
  if (unitEntry?.approved !== true) return null;
  const lengthUnit = stringValue(unitEntry.value);
  return lengthUnit.toLowerCase() === IMPLEMENTED_LENGTH_UNIT ? IMPLEMENTED_LENGTH_UNIT : null;
}

export function requireAuthorizedEmpiricalSourceLengthUnit(profile) {
  const unitEntry = projectDataEntry(profile, LENGTH_UNIT_PATH);
  const lengthUnit = stringValue(unitEntry?.value);
  requireApprovedEntry(unitEntry, LENGTH_UNIT_PATH, 'EMPIRICAL_SOURCE_LENGTH_UNIT_AUTHORITY_INVALID');
  if (lengthUnit.toLowerCase() !== IMPLEMENTED_LENGTH_UNIT) {
    throw codedError(
      `Authorized empirical gravity currently implements ${IMPLEMENTED_LENGTH_UNIT} source geometry only; ${lengthUnit || 'missing'} requires an explicit engineering-unit transformation before calculation.`,
      'EMPIRICAL_SOURCE_LENGTH_UNIT_UNSUPPORTED',
      { projectDataPath: LENGTH_UNIT_PATH, requestedLengthUnit: lengthUnit || null },
    );
  }
  return { lengthUnit: IMPLEMENTED_LENGTH_UNIT, unitEntry };
}

export function requireAuthorizedEmpiricalSourceBasis(profile) {
  const axisEntry = projectDataEntry(profile, SOURCE_AXIS_PATH);
  const axis = stringValue(axisEntry?.value).toUpperCase();
  requireApprovedEntry(axisEntry, SOURCE_AXIS_PATH, 'EMPIRICAL_SOURCE_AXIS_AUTHORITY_INVALID');
  if (!SUPPORTED_SOURCE_AXES.includes(axis)) {
    throw codedError(
      'Effective source up-axis must be X, Y, or Z before authorized support-load calculation.',
      'EMPIRICAL_SOURCE_AXIS_INVALID',
      { projectDataPath: SOURCE_AXIS_PATH, value: axisEntry?.value ?? null },
    );
  }

  const { unitEntry } = requireAuthorizedEmpiricalSourceLengthUnit(profile);
  return freezeDeep({
    sourceUpAxis: axis,
    sourceAxisBasis: `${axis}_UP`,
    lengthUnit: IMPLEMENTED_LENGTH_UNIT,
    mechanicsScope: AXIS_GENERAL_MECHANICS_SCOPE,
    axisInvarianceBasis: AXIS_INVARIANCE_BASIS,
    sourceAxisEvidence: clonePlain(axisEntry.evidence),
    sourceAxisEntrySemanticHash: semanticHash(axisEntry),
    lengthUnitEvidence: clonePlain(unitEntry.evidence),
    lengthUnitEntrySemanticHash: semanticHash(unitEntry),
  });
}

/**
 * Rebinds the legacy scalar-kernel metadata to the governed source axis only
 * after the axis-general mechanics qualification above has been required.
 * `Z_UP` on the raw distribution remains an internal compatibility marker from
 * the unchanged scalar kernel; it is not treated as source-axis authority.
 */
export function bindAuthorizedEmpiricalSourceAxis({ distribution, profile } = {}) {
  if (!distribution || typeof distribution !== 'object' || !Array.isArray(distribution.loadCases)) {
    throw codedError(
      'A support-load distribution is required for source-axis binding.',
      'EMPIRICAL_SOURCE_AXIS_DISTRIBUTION_INVALID',
    );
  }
  const basis = requireAuthorizedEmpiricalSourceBasis(profile);
  if (distribution.sourceAxisBasis !== LEGACY_SCALAR_KERNEL_BASIS) {
    throw codedError(
      'Authorized empirical gravity kernel basis is inconsistent with the qualified scalar-kernel compatibility marker.',
      'EMPIRICAL_SOURCE_AXIS_KERNEL_BASIS_MISMATCH',
      {
        expected: LEGACY_SCALAR_KERNEL_BASIS,
        actual: distribution.sourceAxisBasis ?? null,
      },
    );
  }

  const authority = freezeDeep({
    schema: AUTHORIZED_EMPIRICAL_SOURCE_AXIS_BINDING_SCHEMA,
    projectDataPath: SOURCE_AXIS_PATH,
    lengthUnitProjectDataPath: LENGTH_UNIT_PATH,
    legacyScalarKernelBasis: LEGACY_SCALAR_KERNEL_BASIS,
    ...basis,
  });
  const rebound = clonePlain(distribution);
  rebound.sourceAxisBasis = basis.sourceAxisBasis;
  rebound.sourceAxisAuthority = authority;
  rebound.loadCases = rebound.loadCases.map((loadCase) => ({
    ...loadCase,
    supportResults: (loadCase.supportResults || []).map((support) => ({
      ...support,
      sourceAxisBasis: basis.sourceAxisBasis,
    })),
  }));
  return freezeDeep(rebound);
}

function requireApprovedEntry(entry, projectDataPath, code) {
  if (entry?.approved !== true || !entry?.evidence) {
    throw codedError(
      `Effective ${projectDataPath} must retain approved source/project/default evidence.`,
      code,
      { projectDataPath },
    );
  }
}

function codedError(message, code, details = null) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}
