import { canonicalLafeaSha256 } from './lafea-canonical-sha256.js';
import { LAFEA_CONTINUUM_PHYSICAL_PROBE_EVIDENCE_SCHEMA } from './lafea-continuum-physical-probe.js';

export const LAFEA_CONTINUUM_PROBE_COMPARISON_SCHEMA =
  'lafea-continuum-probe-comparison/v1';
export const LAFEA_CONTINUUM_PROBE_CONVERGENCE_DEFINITION_SCHEMA =
  'lafea-continuum-probe-convergence-definition/v1';
export const LAFEA_CONTINUUM_PROBE_CONVERGENCE_OBSERVATIONS_SCHEMA =
  'lafea-continuum-probe-convergence-observations/v1';
export const LAFEA_CONTINUUM_PROBE_CONVERGENCE_EVIDENCE_SCHEMA =
  'lafea-continuum-probe-convergence-evidence/v1';

const RATIO_TOLERANCE = 1e-10;

export function compareLafeaContinuumPhysicalProbeEvidence(left, right) {
  requireProbeEvidence(left);
  requireProbeEvidence(right);
  requireComparable(left, right);
  const delta = right.authoritativeValue - left.authoritativeValue;
  const scale = Math.max(Math.abs(left.authoritativeValue), Math.abs(right.authoritativeValue));
  const base = {
    schema: LAFEA_CONTINUUM_PROBE_COMPARISON_SCHEMA,
    probeIdentityHash: left.probeIdentityHash,
    quantityIdentityHash: left.quantityIdentityHash,
    units: left.authoritativeUnits,
    leftEvidenceHash: left.semanticHash,
    rightEvidenceHash: right.semanticHash,
    leftValue: left.authoritativeValue,
    rightValue: right.authoritativeValue,
    delta,
    absoluteDelta: Math.abs(delta),
    relativeDelta: scale > 0 ? delta / scale : null,
    compatible: true,
  };
  return deepFreeze({
    ...base,
    semanticHash: canonicalLafeaSha256({
      schema: 'lafea-continuum-probe-comparison-hash/v1', comparison: base,
    }),
  });
}

export function createLafeaContinuumProbeConvergenceDefinition(value) {
  return normalizeDefinition(value);
}

export function createLafeaContinuumProbeConvergenceObservations(value) {
  return normalizeObservations(value);
}

export function evaluateLafeaContinuumProbeConvergence(definitionValue, observationsValue) {
  const definition = normalizeDefinition(definitionValue);
  const observations = normalizeObservations(observationsValue);
  if (observations.studyId !== definition.studyId) {
    fail('LAFEA_G4_CONVERGENCE_STUDY_ID_MISMATCH');
  }
  if (observations.definitionHash !== definition.semanticHash) {
    fail('LAFEA_G4_CONVERGENCE_DEFINITION_HASH_MISMATCH');
  }
  const observationByLevel = new Map(observations.levels.map((row) => [row.levelId, row.evidence]));
  if (observationByLevel.size !== definition.levels.length) {
    fail('LAFEA_G4_CONVERGENCE_LEVEL_SET_MISMATCH');
  }
  const rows = definition.levels.map((level) => {
    const evidence = observationByLevel.get(level.levelId);
    if (!evidence) fail('LAFEA_G4_CONVERGENCE_LEVEL_SET_MISMATCH');
    requireProbeEvidence(evidence);
    if (evidence.quantityIdentityHash !== definition.quantityIdentityHash) {
      fail('LAFEA_G4_CONVERGENCE_QUANTITY_IDENTITY_MISMATCH');
    }
    return { ...level, evidence };
  });
  for (let index = 1; index < rows.length; index += 1) {
    requireComparable(rows[index - 1].evidence, rows[index].evidence);
    const actualRatio = rows[index - 1].h / rows[index].h;
    const scale = Math.max(1, Math.abs(definition.refinementRatio));
    if (Math.abs(actualRatio - definition.refinementRatio) > RATIO_TOLERANCE * scale) {
      fail('LAFEA_G4_CONVERGENCE_REFINEMENT_RATIO_MISMATCH');
    }
  }
  const values = rows.map((row) => row.evidence.authoritativeValue);
  const singularExcluded = rows.some((row) => row.evidence.pointwiseAcceptanceEligible === false);
  const sequence = classifySequence(values, definition);
  const base = {
    schema: LAFEA_CONTINUUM_PROBE_CONVERGENCE_EVIDENCE_SCHEMA,
    studyId: definition.studyId,
    definitionHash: definition.semanticHash,
    observationsHash: observations.semanticHash,
    probeIdentityHash: rows[0].evidence.probeIdentityHash,
    quantityIdentityHash: definition.quantityIdentityHash,
    units: rows[0].evidence.authoritativeUnits,
    levels: rows.map((row) => ({
      levelId: row.levelId,
      h: row.h,
      meshHash: row.evidence.custody.meshHash,
      executionHash: row.evidence.custody.executionHash,
      recoveryHash: row.evidence.custody.recoveryHash,
      probeEvidenceHash: row.evidence.semanticHash,
      value: row.evidence.authoritativeValue,
    })),
    classification: singularExcluded ? 'SINGULAR_EXCLUDED' : sequence.classification,
    observedOrders: singularExcluded ? [] : sequence.observedOrders,
    observedOrder: singularExcluded ? null : sequence.observedOrder,
    richardsonExtrapolatedValue: singularExcluded ? null : sequence.richardsonExtrapolatedValue,
    gciFineAbsolute: singularExcluded ? null : sequence.gciFineAbsolute,
    gciFinePercent: singularExcluded ? null : sequence.gciFinePercent,
    pointwiseAcceptanceEligible: !singularExcluded,
    definitionWasFrozenBeforeObservations: true,
    globalConvergenceAuthorityGranted: false,
    benchmarkAcceptanceGranted: false,
    releaseAuthorityGranted: false,
    temperatureAuthorityGranted: false,
  };
  return deepFreeze({
    ...base,
    semanticHash: canonicalLafeaSha256({
      schema: 'lafea-continuum-probe-convergence-evidence-hash/v1', evidence: base,
    }),
  });
}

function normalizeDefinition(value) {
  exactKeys(value, [
    'schema', 'studyId', 'quantityIdentityHash', 'refinementRatio', 'gciSafetyFactor',
    'nearZeroAbsolute', 'orderStabilityRelativeTolerance', 'levels',
  ]);
  if (value.schema !== LAFEA_CONTINUUM_PROBE_CONVERGENCE_DEFINITION_SCHEMA) {
    fail('LAFEA_G4_CONVERGENCE_DEFINITION_SCHEMA_INVALID');
  }
  if (!Array.isArray(value.levels) || value.levels.length < 3) {
    fail('LAFEA_G4_CONVERGENCE_REQUIRES_THREE_LEVELS');
  }
  const levels = value.levels.map((row) => {
    exactKeys(row, ['levelId', 'h']);
    return {
      levelId: text(row.levelId, 'LAFEA_G4_CONVERGENCE_LEVEL_ID_INVALID'),
      h: positive(row.h, 'LAFEA_G4_CONVERGENCE_H_INVALID'),
    };
  });
  if (new Set(levels.map((row) => row.levelId)).size !== levels.length) {
    fail('LAFEA_G4_CONVERGENCE_LEVEL_ID_DUPLICATE');
  }
  for (let index = 1; index < levels.length; index += 1) {
    if (!(levels[index - 1].h > levels[index].h)) {
      fail('LAFEA_G4_CONVERGENCE_H_NOT_STRICTLY_REFINED');
    }
  }
  const base = {
    schema: LAFEA_CONTINUUM_PROBE_CONVERGENCE_DEFINITION_SCHEMA,
    studyId: text(value.studyId, 'LAFEA_G4_CONVERGENCE_STUDY_ID_INVALID'),
    quantityIdentityHash: sha(value.quantityIdentityHash, 'LAFEA_G4_CONVERGENCE_QUANTITY_HASH_INVALID'),
    refinementRatio: greaterThanOne(value.refinementRatio, 'LAFEA_G4_CONVERGENCE_RATIO_INVALID'),
    gciSafetyFactor: positive(value.gciSafetyFactor, 'LAFEA_G4_CONVERGENCE_GCI_FACTOR_INVALID'),
    nearZeroAbsolute: nonnegative(value.nearZeroAbsolute, 'LAFEA_G4_CONVERGENCE_NEAR_ZERO_RULE_INVALID'),
    orderStabilityRelativeTolerance: nonnegative(
      value.orderStabilityRelativeTolerance,
      'LAFEA_G4_CONVERGENCE_ORDER_STABILITY_RULE_INVALID',
    ),
    levels,
  };
  return deepFreeze({
    ...base,
    semanticHash: canonicalLafeaSha256({
      schema: 'lafea-continuum-probe-convergence-definition-hash/v1', definition: base,
    }),
  });
}

function normalizeObservations(value) {
  exactKeys(value, ['schema', 'studyId', 'definitionHash', 'levels']);
  if (value.schema !== LAFEA_CONTINUUM_PROBE_CONVERGENCE_OBSERVATIONS_SCHEMA) {
    fail('LAFEA_G4_CONVERGENCE_OBSERVATIONS_SCHEMA_INVALID');
  }
  if (!Array.isArray(value.levels) || value.levels.length < 3) {
    fail('LAFEA_G4_CONVERGENCE_OBSERVATIONS_REQUIRE_THREE_LEVELS');
  }
  const levels = value.levels.map((row) => {
    exactKeys(row, ['levelId', 'evidence']);
    requireProbeEvidence(row.evidence);
    return {
      levelId: text(row.levelId, 'LAFEA_G4_CONVERGENCE_LEVEL_ID_INVALID'),
      evidence: row.evidence,
    };
  });
  if (new Set(levels.map((row) => row.levelId)).size !== levels.length) {
    fail('LAFEA_G4_CONVERGENCE_LEVEL_ID_DUPLICATE');
  }
  const base = {
    schema: LAFEA_CONTINUUM_PROBE_CONVERGENCE_OBSERVATIONS_SCHEMA,
    studyId: text(value.studyId, 'LAFEA_G4_CONVERGENCE_STUDY_ID_INVALID'),
    definitionHash: sha(value.definitionHash, 'LAFEA_G4_CONVERGENCE_DEFINITION_HASH_INVALID'),
    levels,
  };
  return deepFreeze({
    ...base,
    semanticHash: canonicalLafeaSha256({
      schema: 'lafea-continuum-probe-convergence-observations-hash/v1', observations: base,
    }),
  });
}

function classifySequence(values, definition) {
  if (values.every((value) => Math.abs(value) <= definition.nearZeroAbsolute)) {
    return emptySequence('NEAR_ZERO_SCALE_LIMITED');
  }
  const differences = [];
  for (let index = 0; index < values.length - 1; index += 1) {
    differences.push(values[index] - values[index + 1]);
  }
  if (differences.slice(-2).some((value) => Math.abs(value) <= definition.nearZeroAbsolute)) {
    return emptySequence('NEAR_ZERO_FINE_DIFFERENCE');
  }
  if (differences.some((value, index) => index > 0 && value * differences[index - 1] < 0)) {
    return emptySequence('OSCILLATORY');
  }
  if (Math.abs(differences.at(-1)) >= Math.abs(differences.at(-2))) {
    return emptySequence('DIVERGENT');
  }
  const observedOrders = [];
  for (let index = 0; index < differences.length - 1; index += 1) {
    const coarse = Math.abs(differences[index]);
    const fine = Math.abs(differences[index + 1]);
    if (!(coarse > 0) || !(fine > 0)) return emptySequence('PRE_ASYMPTOTIC');
    const order = Math.log(coarse / fine) / Math.log(definition.refinementRatio);
    if (!Number.isFinite(order) || !(order > 0)) return emptySequence('DIVERGENT');
    observedOrders.push(order);
  }
  const observedOrder = observedOrders.at(-1);
  let classification = 'MONOTONIC_CONVERGING';
  if (observedOrders.length > 1) {
    const minimum = Math.min(...observedOrders);
    const maximum = Math.max(...observedOrders);
    const scale = Math.max(Math.abs(observedOrder), 1e-15);
    classification = (maximum - minimum) / scale > definition.orderStabilityRelativeTolerance
      ? 'PRE_ASYMPTOTIC' : 'ASYMPTOTIC';
  }
  if (classification === 'PRE_ASYMPTOTIC') {
    return { ...emptySequence(classification), observedOrders, observedOrder };
  }
  const fine = values.at(-1);
  const medium = values.at(-2);
  const denominator = definition.refinementRatio ** observedOrder - 1;
  if (!(denominator > 0)) {
    return { ...emptySequence('PRE_ASYMPTOTIC'), observedOrders, observedOrder };
  }
  const correction = (fine - medium) / denominator;
  const gciFineAbsolute = definition.gciSafetyFactor * Math.abs(fine - medium) / denominator;
  return {
    classification,
    observedOrders,
    observedOrder,
    richardsonExtrapolatedValue: fine + correction,
    gciFineAbsolute,
    gciFinePercent: Math.abs(fine) > definition.nearZeroAbsolute
      ? 100 * gciFineAbsolute / Math.abs(fine) : null,
  };
}

function emptySequence(classification) {
  return {
    classification,
    observedOrders: [],
    observedOrder: null,
    richardsonExtrapolatedValue: null,
    gciFineAbsolute: null,
    gciFinePercent: null,
  };
}
function requireProbeEvidence(value) {
  if (!value || value.schema !== LAFEA_CONTINUUM_PHYSICAL_PROBE_EVIDENCE_SCHEMA
    || value.status !== 'PASS' || !Number.isFinite(value.authoritativeValue)
    || typeof value.semanticHash !== 'string' || typeof value.quantityIdentityHash !== 'string'
    || typeof value.probeIdentityHash !== 'string') {
    fail('LAFEA_G4_PROBE_EVIDENCE_INVALID');
  }
}
function requireComparable(left, right) {
  if (left.probeIdentityHash !== right.probeIdentityHash
    || left.quantityIdentityHash !== right.quantityIdentityHash
    || left.authoritativeUnits !== right.authoritativeUnits) {
    fail('LAFEA_G4_PROBE_COMPARISON_IDENTITY_MISMATCH');
  }
}
function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('LAFEA_G4_CONVERGENCE_OBJECT_INVALID');
  }
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    fail('LAFEA_G4_CONVERGENCE_KEYS_INVALID');
  }
}
function text(value, code) { if (typeof value !== 'string' || !value.trim()) fail(code); return value.trim(); }
function positive(value, code) { if (!Number.isFinite(value) || !(value > 0)) fail(code); return value; }
function greaterThanOne(value, code) { if (!Number.isFinite(value) || !(value > 1)) fail(code); return value; }
function nonnegative(value, code) { if (!Number.isFinite(value) || value < 0) fail(code); return value; }
function sha(value, code) { if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) fail(code); return value; }
function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
