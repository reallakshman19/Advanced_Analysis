export const GRAVITY_PROFILE_SCHEMA = 'gravity-profile/v1';
export const LOAD_CASE_SET_SCHEMA = 'load-case-set/v1';
export const LOAD_SOURCE_PROJECTION_SCHEMA = 'engineering-load-source-projection/v1';
export const LOAD_COMPOSITION_PROFILE_SCHEMA = 'load-composition-profile/v1';
export const MODEL_LOAD_PRIMITIVE_SET_SCHEMA = 'model-load-primitive-set/v1';
export const MODEL_LOAD_READINESS_AUDIT_SCHEMA = 'model-load-readiness-audit/v1';
export const GRAVITY_PROFILE_ID = 'STANDARD_GRAVITY_9_80665_V1';
export const COMPOSITION_PROFILE_ID = 'PIPING_COMPONENT_LOAD_COMPOSITION_V1';
export const GRAVITY_DIRECTION = 'GRAVITY_DOWN';
export const LOAD_CASE_IDS = Object.freeze(['EMPTY', 'HYD', 'OPE']);
export const PRIMITIVE_TYPES = Object.freeze({
  DISTRIBUTED: 'DISTRIBUTED_GRAVITY_LOAD',
  POINT: 'POINT_GRAVITY_LOAD',
  MOMENT: 'EXPLICIT_POINT_MOMENT',
});
export const FORMULA_IDS = Object.freeze({
  PIPE: 'PIPE_METAL_MASS_PER_LENGTH_V1',
  FLUID: 'FLUID_MASS_PER_LENGTH_V1',
  INSULATION: 'INSULATION_MASS_PER_LENGTH_V1',
  WEIGHT: 'MASS_TO_WEIGHT_FORCE_V1',
});
export const AUDIT_CODES = Object.freeze({
  READY: 'READY',
  MISSING_GEOMETRY: 'MISSING_GEOMETRY',
  GEOMETRY_LENGTH_CONFLICT: 'GEOMETRY_LENGTH_CONFLICT',
  MISSING_PIPE_MASS_INPUT: 'MISSING_PIPE_MASS_INPUT',
  INVALID_SECTION_DIMENSIONS: 'INVALID_SECTION_DIMENSIONS',
  MISSING_INSULATION_INPUT: 'MISSING_INSULATION_INPUT',
  MISSING_OPE_FLUID_INPUT: 'MISSING_OPE_FLUID_INPUT',
  MISSING_HYD_FLUID_INPUT: 'MISSING_HYD_FLUID_INPUT',
  MISSING_COMPONENT_MASS: 'MISSING_COMPONENT_MASS',
  MISSING_COMPONENT_COG: 'MISSING_COMPONENT_COG',
  // An approved zero-mass waiver answered this component, so it carries no
  // weighable mass. Distinct from EXCLUDED_NEGLIGIBLE_MASS: that is a
  // property of a gasket's type, this is an engineer's recorded decision.
  EXCLUDED_ZERO_MASS_WAIVER: 'EXCLUDED_ZERO_MASS_WAIVER',
  // The governed geometric-midpoint fallback was used to place a lumped
  // component's mass because no exact CoG authority existed. Recorded on the
  // component so the assumption is auditable rather than invisible.
  COMPONENT_COG_GEOMETRIC_MIDPOINT_ASSUMED: 'COMPONENT_COG_GEOMETRIC_MIDPOINT_ASSUMED',
  DOUBLE_COUNT_CONFLICT: 'DOUBLE_COUNT_CONFLICT',
  LUMPED_LINEAR_MASS_CONFLICT: 'LUMPED_LINEAR_MASS_CONFLICT',
  UNSUPPORTED_COMPONENT_TYPE: 'UNSUPPORTED_COMPONENT_TYPE',
  INVALID_NEGATIVE_VALUE: 'INVALID_NEGATIVE_VALUE',
  UNIT_BLOCKED: 'UNIT_BLOCKED',
  EXCLUDED_NEGLIGIBLE_MASS: 'EXCLUDED_NEGLIGIBLE_MASS',
  DERIVED_FROM_ADJACENT_PIPE_SECTION: 'DERIVED_FROM_ADJACENT_PIPE_SECTION',
});
export const LINEAR_TYPES = Object.freeze(['PIPE', 'STRAIGHT_PIPE', 'TUBE']);
export const LUMPED_TYPES = Object.freeze([
  'VALVE', 'FLANGE', 'TEE', 'REDUCER', 'ELBOW', 'BEND', 'INSTRUMENT', 'OLET', 'CAP', 'BLIND',
]);
/**
 * Elbow-type components. Includes the short SJSON type code (ELBO) alongside
 * the spelled-out form: this codebase's own LUMPED_TYPES above only lists
 * "ELBOW", which does not match a real SJSON-sourced dataset's "ELBO" at all
 * (nor do FLANGE/VALVE/REDUCER/INSTRUMENT match FLAN/VALV/REDU/INST) — a
 * pre-existing mismatch, not something introduced or fixed here.
 */
export const ELBOW_TYPES = Object.freeze(['ELBOW', 'ELBO', 'BEND']);
/**
 * Tee-type components. The SJSON short code already matches this codebase's
 * own LUMPED_TYPES entry ("TEE" both places), unlike ELBOW/FLANGE/VALVE.
 */
export const TEE_TYPES = Object.freeze(['TEE']);
/**
 * Branch-outlet and reducer fittings. Neither appears in the valve Weights
 * master at all, so like elbows and tees they are treated as pipe material
 * over an effective length rather than requiring a catalogue weight.
 */
export const OLET_TYPES = Object.freeze(['OLET', 'WELDOLET', 'SOCKOLET', 'THREDOLET']);
export const REDUCER_TYPES = Object.freeze(['REDUCER', 'REDU']);
/**
 * Gasket-type components carry negligible self-weight relative to the piping
 * they seal and are exempted from mass-evidence requirements rather than
 * requiring a point mass. Explicit evidence, if supplied, still wins.
 */
export const NEGLIGIBLE_MASS_TYPES = Object.freeze(['GASKET', 'GASK']);
